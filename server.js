// 내 포트폴리오 주식 대시보드 서버
// - 외부 npm 의존성 없이 Node 내장 http 모듈 + 전역 fetch(Node 18+) 사용
// - 시세: 네이버페이 증권 비공식 폴링 API (polling.finance.naver.com, api.stock.naver.com, ac.stock.naver.com)
//   확인 필요: 비공식 API로 인증키가 없고 요청 빈도 제한 정책이 공개되어 있지 않음.
//   서버 메모리 캐시(TTL)로 과도한 호출을 방지해 완화함.
// - 뉴스: Google News RSS 검색 (API 키 불필요, CORS 우회를 위해 서버에서 프록시)
// - 보유 종목: data/portfolio.json 파일에 저장. 화면에서 추가/삭제/매입정보 입력 시 이 파일이 갱신됨.
//   config.js의 GROUPS는 이 파일이 없을 때(최초 실행)만 시드 데이터로 사용됨.

'use strict';

const http = require('http');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { GROUPS: DEFAULT_GROUPS, FX_CODES, WORLD_INDEX_CODES } = require('./config');

// 간이 .env 로더 (외부 의존성 없이 KEY=VALUE 라인만 파싱)
function loadEnv(file) {
  try {
    const text = fs.readFileSync(file, 'utf8');
    for (const line of text.split(/\r?\n/)) {
      const m = line.match(/^\s*([\w.-]+)\s*=\s*(.*)\s*$/);
      if (!m) continue;
      const key = m[1];
      let val = m[2];
      if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
        val = val.slice(1, -1);
      }
      if (!(key in process.env)) process.env[key] = val;
    }
  } catch {
    // .env 파일이 없어도 무시 (환경변수로 직접 주입된 경우 대비)
  }
}
loadEnv(path.join(__dirname, '.env'));

// secrets.js에서 API 키 로드 (파일이 없으면 무시 — 기능이 꺼진 상태로 동작)
let secrets = {};
try {
  secrets = require('./secrets');
} catch {
  secrets = {};
}

const PORT = process.env.PORT || 3100;
const REQUEST_TIMEOUT_MS = 8000;
const QUOTE_CACHE_TTL_MS = 20 * 1000; // 20초 (지수/시세)
const FX_CACHE_TTL_MS = 5 * 60 * 1000; // 5분 (환율)
const NEWS_CACHE_TTL_MS = 10 * 60 * 1000; // 10분 (뉴스)
const KRX_CACHE_TTL_MS = 60 * 60 * 1000; // 1시간 (KRX 공식 API는 일별 종가 데이터라 자주 바뀌지 않음)
const DATA_FILE = path.join(__dirname, 'data', 'portfolio.json');
const CODE_RE = /^\d{6}$/;
const KRX_API_KEY = process.env.KRX_API_KEY || '';
const SUPABASE_URL = (process.env.SUPABASE_URL || '').replace(/\/+$/, '');
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
const SESSION_COOKIE = 'session_token';
const SESSION_TTL_MS = 12 * 60 * 60 * 1000; // 12시간
// secrets.js는 로컬 전용(.gitignore 처리)이라 Vercel 등 배포 환경에는 배포되지 않으므로,
// 배포 환경에서는 Vercel 프로젝트 환경변수(process.env.GEMINI_API_KEY)로 대체함.
const GEMINI_API_KEY = (secrets && secrets.GEMINI_API_KEY) || process.env.GEMINI_API_KEY || '';
// 확인 필요: 사용자가 지정한 모델명. 실제 존재/이용 가능 여부는 호출 시 오류로 확인됨.
const GEMINI_MODEL = 'gemini-3.1-flash-lite';
const AI_REQUEST_TIMEOUT_MS = 15000;

const UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36';

// ---- 포트폴리오 저장소 (JSON 파일) --------------------------------------------

function loadPortfolio() {
  try {
    const raw = fs.readFileSync(DATA_FILE, 'utf8');
    return JSON.parse(raw);
  } catch {
    const seed = { groups: DEFAULT_GROUPS.map((g) => ({ ...g, stocks: g.stocks.map((s) => ({ ...s })) })) };
    // 읽기 전용 배포 환경(Vercel 등)에서는 파일로 저장할 수 없어도 메모리상의 시드 데이터로 계속 동작
    try {
      savePortfolio(seed);
    } catch (err) {
      console.error('[portfolio] 초기 파일 생성 실패(읽기 전용 환경일 수 있음):', err.message);
    }
    return seed;
  }
}

function savePortfolio(data) {
  try {
    fs.mkdirSync(path.dirname(DATA_FILE), { recursive: true });
    fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2), 'utf8');
  } catch (err) {
    // Vercel 등 읽기 전용 배포 환경에서는 파일 저장이 불가능함
    console.error('[portfolio] 저장 실패:', err.message);
    throw new Error('현재 배포 환경에서는 보유 종목 변경사항이 저장되지 않습니다.');
  }
}

let portfolio = loadPortfolio();

function getAllStocks() {
  return portfolio.groups.flatMap((g) => g.stocks.map((s) => ({ ...s, groupId: g.id, groupName: g.name })));
}

function findStockRef(code) {
  for (const g of portfolio.groups) {
    const s = g.stocks.find((s) => s.code === code);
    if (s) return s;
  }
  return null;
}

let quoteCache = null; // { at, data }
let fxCache = null; // { at, data }
let krxCache = null; // { at, data }
const newsCache = new Map(); // 'stock:CODE' -> { at, items }
const rssCache = new Map(); // query -> { at, items }
const sessions = new Map(); // token -> { employeeId, name, at }

// ---- 인증 (Supabase REST + 서버 세션 쿠키) -------------------------------------
// 확인 필요: 사번+이름만으로 로그인하는 방식은 비밀번호가 없어 '진짜' 인증이라기보다
// 사내 인원 식별/접속이력 기록에 가깝습니다. 외부에 공개되지 않는 사내용 도구를 전제로 함.
// Supabase는 service_role 키로 서버에서만 접근하고, 브라우저에는 세션 쿠키(HttpOnly)만 내려줍니다.

function parseCookies(req) {
  const header = req.headers.cookie || '';
  const cookies = {};
  header.split(';').forEach((pair) => {
    const idx = pair.indexOf('=');
    if (idx === -1) return;
    const k = pair.slice(0, idx).trim();
    const v = pair.slice(idx + 1).trim();
    if (k) cookies[k] = decodeURIComponent(v);
  });
  return cookies;
}

function createSession(employeeId, name) {
  const token = crypto.randomBytes(24).toString('hex');
  sessions.set(token, { employeeId, name, at: Date.now() });
  return token;
}

function getSession(req) {
  const token = parseCookies(req)[SESSION_COOKIE];
  if (!token) return null;
  const session = sessions.get(token);
  if (!session) return null;
  if (Date.now() - session.at > SESSION_TTL_MS) {
    sessions.delete(token);
    return null;
  }
  return session;
}

function setSessionCookie(res, token) {
  res.setHeader(
    'Set-Cookie',
    `${SESSION_COOKIE}=${token}; HttpOnly; Path=/; SameSite=Lax; Max-Age=${Math.floor(SESSION_TTL_MS / 1000)}`
  );
}

function clearSessionCookie(res) {
  res.setHeader('Set-Cookie', `${SESSION_COOKIE}=; HttpOnly; Path=/; SameSite=Lax; Max-Age=0`);
}

async function supabaseRequest(pathAndQuery, options = {}) {
  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
    throw new Error('SUPABASE_NOT_CONFIGURED');
  }
  const url = `${SUPABASE_URL}/rest/v1/${pathAndQuery}`;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  try {
    const res = await fetch(url, {
      ...options,
      signal: controller.signal,
      headers: {
        apikey: SUPABASE_SERVICE_ROLE_KEY,
        Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
        'Content-Type': 'application/json',
        ...(options.headers || {}),
      },
    });
    const text = await res.text();
    const json = text ? JSON.parse(text) : null;
    if (!res.ok) {
      const msg = (json && (json.message || json.msg || json.hint)) || `HTTP ${res.status}`;
      const err = new Error(msg);
      err.status = res.status;
      throw err;
    }
    return json;
  } finally {
    clearTimeout(timer);
  }
}

function isSupabaseNotConfigured(err) {
  return err.message === 'SUPABASE_NOT_CONFIGURED';
}

// 이 프로젝트의 Supabase에는 이미 users/login_history 테이블과
// app_signup/app_login RPC(Postgres 함수)가 준비되어 있어 이를 그대로 사용함.
// app_login은 성공/실패 여부와 무관하게 login_history에 접속 이력을 직접 기록해줌.

async function handleSignup(req, res) {
  let body;
  try {
    body = await readBody(req);
  } catch {
    return sendJson(res, { error: '요청 형식이 올바르지 않습니다.' }, 400);
  }
  const employeeId = String(body.employeeId || '').trim();
  const name = String(body.name || '').trim();
  const phone = String(body.phone || '').trim();
  if (!employeeId || !name || !phone) {
    return sendJson(res, { error: '사번, 이름, 연락처를 모두 입력해주세요.' }, 400);
  }

  try {
    const result = await supabaseRequest('rpc/app_signup', {
      method: 'POST',
      body: JSON.stringify({ p_employee_id: employeeId, p_name: name, p_phone: phone }),
    });
    if (!result || result.success !== true) {
      if (result && result.error === 'duplicate_employee_id') {
        return sendJson(res, { error: '이미 등록된 사번입니다.' }, 409);
      }
      return sendJson(res, { error: '회원가입에 실패했습니다.' }, 400);
    }
    sendJson(res, { ok: true });
  } catch (err) {
    if (isSupabaseNotConfigured(err)) {
      return sendJson(res, { error: 'Supabase 연결이 아직 설정되지 않았습니다. 관리자에게 문의해주세요.' }, 503);
    }
    console.error('[auth] 회원가입 실패:', err.message);
    sendJson(res, { error: '회원가입 중 오류가 발생했습니다.' }, 500);
  }
}

async function handleLogin(req, res) {
  let body;
  try {
    body = await readBody(req);
  } catch {
    return sendJson(res, { error: '요청 형식이 올바르지 않습니다.' }, 400);
  }
  const employeeId = String(body.employeeId || '').trim();
  const name = String(body.name || '').trim();
  if (!employeeId || !name) {
    return sendJson(res, { error: '사번과 이름을 입력해주세요.' }, 400);
  }

  try {
    const result = await supabaseRequest('rpc/app_login', {
      method: 'POST',
      body: JSON.stringify({ p_employee_id: employeeId, p_name: name }),
    });
    if (!result || result.success !== true) {
      return sendJson(res, { error: '사번 또는 이름이 일치하지 않습니다.' }, 401);
    }
    const token = createSession(result.employee_id, result.name);
    setSessionCookie(res, token);
    sendJson(res, { ok: true, employeeId: result.employee_id, name: result.name });
  } catch (err) {
    if (isSupabaseNotConfigured(err)) {
      return sendJson(res, { error: 'Supabase 연결이 아직 설정되지 않았습니다. 관리자에게 문의해주세요.' }, 503);
    }
    console.error('[auth] 로그인 실패:', err.message);
    sendJson(res, { error: '로그인 중 오류가 발생했습니다.' }, 500);
  }
}

function handleLogout(req, res) {
  const token = parseCookies(req)[SESSION_COOKIE];
  if (token) sessions.delete(token);
  clearSessionCookie(res);
  sendJson(res, { ok: true });
}

function handleMe(req, res) {
  const session = getSession(req);
  if (!session) return sendJson(res, { loggedIn: false });
  sendJson(res, { loggedIn: true, employeeId: session.employeeId, name: session.name });
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    let data = '';
    req.on('data', (chunk) => {
      data += chunk;
      if (data.length > 1e6) req.destroy(new Error('요청이 너무 큽니다.'));
    });
    req.on('end', () => {
      try {
        resolve(data ? JSON.parse(data) : {});
      } catch (err) {
        reject(err);
      }
    });
    req.on('error', reject);
  });
}

async function fetchJson(url) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  try {
    const res = await fetch(url, { signal: controller.signal, headers: { 'User-Agent': UA } });
    if (!res.ok) throw new Error('HTTP ' + res.status);
    return await res.json();
  } finally {
    clearTimeout(timer);
  }
}

function parseNum(raw) {
  if (raw == null) return null;
  const n = parseFloat(String(raw).replace(/,/g, ''));
  return Number.isNaN(n) ? null : n;
}

function directionFromCode(code) {
  if (code === '2') return 'up'; // 상승
  if (code === '5') return 'down'; // 하락
  return 'flat';
}

// ---- 지수/시세 (네이버 폴링 API) --------------------------------------------

async function fetchIndices() {
  const json = await fetchJson('https://polling.finance.naver.com/api/realtime/domestic/index/KOSPI,KOSDAQ');
  return (json.datas || []).map((d) => ({
    code: d.itemCode,
    name: d.stockName,
    price: parseNum(d.closePrice),
    change: parseNum(d.compareToPreviousClosePrice),
    changeRate: parseNum(d.fluctuationsRatio),
    direction: directionFromCode(d.compareToPreviousPrice && d.compareToPreviousPrice.code),
  }));
}

async function fetchWorldIndices() {
  const json = await fetchJson('https://api.stock.naver.com/index/major');
  const map = new Map((json || []).map((it) => [it.reutersCode, it]));
  return WORLD_INDEX_CODES.map((code) => {
    const it = map.get(code);
    if (!it) return { code, name: code, price: null, changeRate: null, direction: 'flat' };
    return {
      code,
      name: it.indexName,
      price: parseNum(it.closePrice),
      changeRate: parseNum(it.fluctuationsRatio),
      direction: directionFromCode(it.compareToPreviousPrice && it.compareToPreviousPrice.code),
    };
  });
}

async function fetchStockQuotes(codes) {
  if (!codes.length) return [];
  const json = await fetchJson('https://polling.finance.naver.com/api/realtime/domestic/stock/' + codes.join(','));
  return json.datas || [];
}

async function getQuotesSnapshot() {
  if (quoteCache && Date.now() - quoteCache.at < QUOTE_CACHE_TTL_MS) return quoteCache.data;

  const allStocks = getAllStocks();
  const codes = allStocks.map((s) => s.code);
  const [indices, world, stockData] = await Promise.all([
    fetchIndices().catch((err) => {
      console.error('[quotes] 지수 조회 실패:', err.message);
      return quoteCache ? quoteCache.data.indices : [];
    }),
    fetchWorldIndices().catch((err) => {
      console.error('[quotes] 해외지수 조회 실패:', err.message);
      return quoteCache ? quoteCache.data.world : [];
    }),
    fetchStockQuotes(codes).catch((err) => {
      console.error('[quotes] 종목 시세 조회 실패:', err.message);
      return null;
    }),
  ]);

  const byCode = new Map((stockData || []).map((d) => [d.itemCode, d]));
  const prevStocks = quoteCache ? new Map(quoteCache.data.stocks.map((s) => [s.code, s])) : new Map();

  const stocks = allStocks.map((s) => {
    const d = byCode.get(s.code);
    if (!d) {
      return (
        prevStocks.get(s.code) || {
          code: s.code,
          name: s.name,
          market: s.market,
          groupId: s.groupId,
          groupName: s.groupName,
          price: null,
          change: null,
          changeRate: null,
          direction: 'flat',
          marketStatus: null,
          open: null,
          high: null,
          low: null,
          volume: null,
          marketCap: null,
          avgPrice: s.avgPrice != null ? s.avgPrice : null,
          quantity: s.quantity != null ? s.quantity : null,
          profit: null,
          profitRate: null,
        }
      );
    }
    const price = parseNum(d.closePrice);
    const avgPrice = s.avgPrice != null ? Number(s.avgPrice) : null;
    const quantity = s.quantity != null ? Number(s.quantity) : null;
    let profit = null;
    let profitRate = null;
    if (price != null && avgPrice && quantity) {
      profit = (price - avgPrice) * quantity;
      profitRate = ((price - avgPrice) / avgPrice) * 100;
    }
    return {
      code: s.code,
      name: s.name,
      market: s.market,
      groupId: s.groupId,
      groupName: s.groupName,
      price,
      change: parseNum(d.compareToPreviousClosePrice),
      changeRate: parseNum(d.fluctuationsRatio),
      direction: directionFromCode(d.compareToPreviousPrice && d.compareToPreviousPrice.code),
      marketStatus: d.marketStatus || null,
      open: parseNum(d.openPrice),
      high: parseNum(d.highPrice),
      low: parseNum(d.lowPrice),
      volume: parseNum(d.accumulatedTradingVolume),
      marketCap: parseNum(d.marketValueFull),
      avgPrice,
      quantity,
      profit,
      profitRate,
    };
  });

  const data = { updatedAt: new Date().toISOString(), indices, world, stocks };
  quoteCache = { at: Date.now(), data };
  return data;
}

// 로그인 없이도 보이는 시장지표(코스피/코스닥/해외지수)만 추려서 반환
async function handleIndices(res) {
  const data = await getQuotesSnapshot();
  sendJson(res, { updatedAt: data.updatedAt, indices: data.indices, world: data.world });
}

// ---- 환율 시장지표 (api.stock.naver.com) ------------------------------------

async function getFxSnapshot() {
  if (fxCache && Date.now() - fxCache.at < FX_CACHE_TTL_MS) return fxCache.data;

  try {
    const json = await fetchJson('https://api.stock.naver.com/marketindex/exchange');
    const map = new Map((json.normalList || []).map((it) => [it.reutersCode, it]));
    const items = FX_CODES.map(({ code, label }) => {
      const it = map.get(code);
      if (!it) return { code, label, price: null, change: null, changeRate: null, direction: 'flat' };
      return {
        code,
        label,
        price: parseNum(it.closePrice),
        change: parseNum(it.fluctuations),
        changeRate: parseNum(it.fluctuationsRatio),
        direction: directionFromCode(it.fluctuationsType && it.fluctuationsType.code),
      };
    });
    const data = { updatedAt: new Date().toISOString(), items };
    fxCache = { at: Date.now(), data };
    return data;
  } catch (err) {
    console.error('[fx] 조회 실패:', err.message);
    if (fxCache) return fxCache.data;
    return { updatedAt: new Date().toISOString(), items: [], error: '환율 조회에 실패했습니다.' };
  }
}

// ---- KRX 공식 API (KOSPI 시리즈 일별시세정보, 상단 티커바용) --------------------
// 확인 필요: KRX Open API는 인증키 발급과 별개로 API별 '활용신청' 승인이 필요할 수 있음
// (승인 대기 중이면 키가 올바르더라도 401 Unauthorized가 반환됨).

function formatYmd(d) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}${m}${day}`;
}

async function fetchKrxKospiForDate(dateStr) {
  // 확인 필요: KRX 공식 레퍼런스 클라이언트(pykrx-openapi)는 AUTH_KEY를 헤더가 아니라
  // 쿼리 파라미터로 전달함. 헤더 방식으로도 테스트해봤으나 동일하게 401이 발생해 쿼리 파라미터로 전환.
  const url =
    'https://data-dbg.krx.co.kr/svc/apis/idx/kospi_dd_trd?AUTH_KEY=' +
    encodeURIComponent(KRX_API_KEY) +
    '&basDd=' +
    encodeURIComponent(dateStr);
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  try {
    const res = await fetch(url, { signal: controller.signal });
    const json = await res.json().catch(() => null);
    if (!res.ok) {
      const msg = (json && (json.respMsg || json.message)) || 'HTTP ' + res.status;
      throw new Error(msg);
    }
    return (json && json.OutBlock_1) || [];
  } finally {
    clearTimeout(timer);
  }
}

// 오늘부터 최대 maxBackDays 만큼 거슬러 올라가며 데이터가 있는 최근 영업일을 탐색
async function findLatestKrxKospi(maxBackDays = 10) {
  const d = new Date();
  let lastErr = null;
  for (let i = 0; i < maxBackDays; i++) {
    const dateStr = formatYmd(d);
    try {
      const rows = await fetchKrxKospiForDate(dateStr);
      if (rows && rows.length) return { basDd: dateStr, rows };
    } catch (err) {
      lastErr = err;
      // 인증/권한 오류는 날짜를 바꿔도 동일하게 실패하므로 즉시 중단
      if (/401|403|Unauthorized|Forbidden/i.test(err.message)) throw err;
    }
    d.setDate(d.getDate() - 1);
  }
  if (lastErr) throw lastErr;
  return { basDd: formatYmd(d), rows: [] };
}

function parseKrxNum(raw) {
  if (raw == null || raw === '-' || raw === '') return null;
  const n = parseFloat(String(raw).replace(/,/g, ''));
  return Number.isNaN(n) ? null : n;
}

async function getKrxKospiSnapshot() {
  if (krxCache && Date.now() - krxCache.at < KRX_CACHE_TTL_MS) return krxCache.data;

  if (!KRX_API_KEY) {
    const data = { asOf: null, items: [], error: 'KRX_API_KEY가 설정되지 않았습니다.' };
    krxCache = { at: Date.now(), data };
    return data;
  }

  try {
    const { basDd, rows } = await findLatestKrxKospi();
    const items = rows.map((r) => {
      const change = parseKrxNum(r.CMPPREVDD_IDX);
      const direction = change == null || change === 0 ? 'flat' : change > 0 ? 'up' : 'down';
      return {
        name: r.IDX_NM,
        class: r.IDX_CLSS,
        close: parseKrxNum(r.CLSPRC_IDX),
        change,
        changeRate: parseKrxNum(r.FLUC_RT),
        direction,
        open: parseKrxNum(r.OPNPRC_IDX),
        high: parseKrxNum(r.HGPRC_IDX),
        low: parseKrxNum(r.LWPRC_IDX),
        volume: parseKrxNum(r.ACC_TRDVOL),
        tradingValue: parseKrxNum(r.ACC_TRDVAL),
        marketCap: parseKrxNum(r.MKTCAP),
      };
    });
    const data = { asOf: basDd, items, error: items.length ? null : '최근 영업일 데이터를 찾지 못했습니다.' };
    krxCache = { at: Date.now(), data };
    return data;
  } catch (err) {
    console.error('[krx] KOSPI 시리즈 조회 실패:', err.message);
    const data = {
      asOf: null,
      items: [],
      error: /401|403|Unauthorized|Forbidden/i.test(err.message)
        ? 'KRX API 인증에 실패했습니다. 인증키와 API 활용신청(승인) 상태를 확인해주세요.'
        : 'KRX API 조회 중 오류가 발생했습니다.',
    };
    krxCache = { at: Date.now(), data };
    return data;
  }
}

async function handleKrxKospi(res) {
  sendJson(res, await getKrxKospiSnapshot());
}

// ---- 종목 검색 (자동완성, ac.stock.naver.com) --------------------------------

async function handleSearch(res, params) {
  const q = (params.get('q') || '').trim();
  if (!q) return sendJson(res, { items: [] });
  try {
    const json = await fetchJson('https://ac.stock.naver.com/ac?q=' + encodeURIComponent(q) + '&target=stock');
    const items = (json.items || [])
      .filter(
        (it) => it.category === 'stock' && it.nationCode === 'KOR' && (it.typeCode === 'KOSPI' || it.typeCode === 'KOSDAQ')
      )
      .slice(0, 8)
      .map((it) => ({ code: it.code, name: it.name, market: it.typeCode }));
    sendJson(res, { items });
  } catch (err) {
    console.error('[search] 실패:', err.message);
    sendJson(res, { items: [], error: '검색에 실패했습니다.' });
  }
}

// ---- 보유 종목 추가/삭제/매입정보 -----------------------------------------------

async function handleAddStock(req, res) {
  let body;
  try {
    body = await readBody(req);
  } catch {
    return sendJson(res, { error: '요청 형식이 올바르지 않습니다.' }, 400);
  }
  const { groupId, code, name, market, avgPrice, quantity } = body || {};
  if (!groupId || !CODE_RE.test(code || '') || !name) {
    return sendJson(res, { error: 'groupId, code(6자리 숫자), name이 필요합니다.' }, 400);
  }
  const group = portfolio.groups.find((g) => g.id === groupId);
  if (!group) return sendJson(res, { error: '알 수 없는 그룹입니다.' }, 404);
  if (getAllStocks().some((s) => s.code === code)) {
    return sendJson(res, { error: '이미 추가된 종목입니다.' }, 409);
  }

  // 실재하는 종목인지 네이버 시세로 한 번 확인
  const quotes = await fetchStockQuotes([code]).catch(() => []);
  if (!quotes.length) {
    return sendJson(res, { error: '종목 시세를 확인할 수 없습니다. 종목코드를 다시 확인해주세요.' }, 400);
  }

  const nAvg = avgPrice === '' || avgPrice == null ? null : Number(avgPrice);
  const nQty = quantity === '' || quantity == null ? null : Number(quantity);

  const stock = {
    code,
    name,
    market: market || (quotes[0].stockExchangeType && quotes[0].stockExchangeType.nameKor === '코스닥' ? 'KOSDAQ' : 'KOSPI'),
    keywords: [name],
    match: [name],
    avgPrice: Number.isFinite(nAvg) ? nAvg : null,
    quantity: Number.isFinite(nQty) ? nQty : null,
  };
  group.stocks.push(stock);
  savePortfolio(portfolio);
  quoteCache = null;
  sendJson(res, { ok: true, groups: portfolio.groups });
}

function handleDeleteStock(res, code) {
  let found = false;
  for (const g of portfolio.groups) {
    const idx = g.stocks.findIndex((s) => s.code === code);
    if (idx !== -1) {
      g.stocks.splice(idx, 1);
      found = true;
      break;
    }
  }
  if (!found) return sendJson(res, { error: '해당 종목을 찾을 수 없습니다.' }, 404);
  savePortfolio(portfolio);
  newsCache.delete('stock:' + code);
  quoteCache = null;
  sendJson(res, { ok: true, groups: portfolio.groups });
}

async function handleUpdateHolding(req, res, code) {
  let body;
  try {
    body = await readBody(req);
  } catch {
    return sendJson(res, { error: '요청 형식이 올바르지 않습니다.' }, 400);
  }
  const stock = findStockRef(code);
  if (!stock) return sendJson(res, { error: '해당 종목을 찾을 수 없습니다.' }, 404);

  const { avgPrice, quantity } = body || {};
  const nAvg = avgPrice === '' || avgPrice == null ? null : Number(avgPrice);
  const nQty = quantity === '' || quantity == null ? null : Number(quantity);
  stock.avgPrice = Number.isFinite(nAvg) ? nAvg : null;
  stock.quantity = Number.isFinite(nQty) ? nQty : null;

  savePortfolio(portfolio);
  quoteCache = null;
  sendJson(res, { ok: true, groups: portfolio.groups });
}

// ---- 뉴스 (Google News RSS) --------------------------------------------------

function decode(str = '') {
  return str
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&apos;/g, "'")
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/\s+/g, ' ')
    .trim();
}

function pick(block, tag) {
  const m = block.match(new RegExp(`<${tag}[^>]*>([\\s\\S]*?)</${tag}>`, 'i'));
  return m ? m[1] : '';
}

function parseRss(xml) {
  const items = [];
  const itemBlocks = xml.match(/<item[\s\S]*?<\/item>/gi) || [];
  for (const block of itemBlocks) {
    const rawTitle = decode(pick(block, 'title'));
    const link = decode(pick(block, 'link'));
    const pubDate = pick(block, 'pubDate').trim();
    const description = decode(pick(block, 'description'));
    const sourceMatch = block.match(/<source[^>]*>([\s\S]*?)<\/source>/i);
    let source = sourceMatch ? decode(sourceMatch[1]) : '';

    let title = rawTitle;
    if (!source && rawTitle.includes(' - ')) {
      const parts = rawTitle.split(' - ');
      source = parts[parts.length - 1];
    }
    if (source && title.endsWith(' - ' + source)) {
      title = title.slice(0, -(source.length + 3)).trim();
    }

    if (!title || !link) continue;
    items.push({
      title,
      link,
      source: source || '언론사',
      pubDate: pubDate ? new Date(pubDate).toISOString() : null,
      description,
    });
  }
  return items;
}

async function fetchGoogleNews(query) {
  const key = query.toLowerCase();
  const cached = rssCache.get(key);
  if (cached && Date.now() - cached.at < NEWS_CACHE_TTL_MS) return cached.items;

  const url =
    'https://news.google.com/rss/search?q=' + encodeURIComponent(query) + '&hl=ko&gl=KR&ceid=KR:ko';

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  try {
    const res = await fetch(url, { signal: controller.signal, headers: { 'User-Agent': UA } });
    if (!res.ok) throw new Error('HTTP ' + res.status);
    const xml = await res.text();
    const items = parseRss(xml);
    rssCache.set(key, { at: Date.now(), items });
    return items;
  } catch (err) {
    if (cached) return cached.items;
    console.error(`[news] "${query}" 수집 실패:`, err.message);
    return [];
  } finally {
    clearTimeout(timer);
  }
}

function matchesTerms(item, terms) {
  if (!terms || !terms.length) return true;
  const hay = ((item.title || '') + ' ' + (item.description || '')).toLowerCase();
  return terms.some((t) => hay.includes(String(t).toLowerCase()));
}

async function aggregate(keywords, match) {
  const results = await Promise.all(keywords.map(fetchGoogleNews));
  const map = new Map();
  for (const list of results) {
    for (const item of list) {
      if (!map.has(item.link)) map.set(item.link, item);
    }
  }
  const all = [...map.values()];
  const kept = match && match.length ? all.filter((it) => matchesTerms(it, match)) : all;
  kept.sort((a, b) => (Date.parse(b.pubDate || 0) || 0) - (Date.parse(a.pubDate || 0) || 0));
  return kept;
}

async function getStockNews(stock) {
  const cacheKey = 'stock:' + stock.code;
  const cached = newsCache.get(cacheKey);
  if (cached && Date.now() - cached.at < NEWS_CACHE_TTL_MS) return cached.items;
  const items = (await aggregate(stock.keywords, stock.match)).slice(0, 12);
  newsCache.set(cacheKey, { at: Date.now(), items });
  return items;
}

// 보유 종목 전체의 뉴스를 모아 최신순으로 반환 (핸들러와 AI 요약 기능이 공유)
async function getMergedPortfolioNews() {
  const allStocks = getAllStocks();
  const results = await Promise.all(
    allStocks.map(async (s) => {
      const items = await getStockNews(s);
      return items.slice(0, 5).map((it) => ({
        ...it,
        stockCode: s.code,
        stockName: s.name,
        groupId: s.groupId,
        groupName: s.groupName,
      }));
    })
  );
  const merged = results.flat();
  merged.sort((a, b) => (Date.parse(b.pubDate || 0) || 0) - (Date.parse(a.pubDate || 0) || 0));
  return merged;
}

async function handleNews(res, params) {
  const code = (params.get('code') || '').trim();

  if (code) {
    const stock = getAllStocks().find((s) => s.code === code);
    if (!stock) return sendJson(res, { error: '알 수 없는 종목코드입니다.' }, 404);
    const items = await getStockNews(stock);
    return sendJson(res, { updatedAt: new Date().toISOString(), code, name: stock.name, items });
  }

  const merged = await getMergedPortfolioNews();
  sendJson(res, { updatedAt: new Date().toISOString(), items: merged.slice(0, 40) });
}

// ---- AI 요약 (Gemini API) ---------------------------------------------------
// 확인 필요: 응답 형식은 서버가 지정한 JSON 스키마(responseSchema)로 강제하되,
// 모델이 이를 완전히 지키지 않는 경우를 대비해 본문에서 JSON 블록을 추출하는 보강 로직도 둠.

function extractJson(text) {
  try {
    return JSON.parse(text);
  } catch {
    const match = text.match(/\{[\s\S]*\}/);
    if (match) {
      try {
        return JSON.parse(match[0]);
      } catch {
        // 아래에서 에러 처리
      }
    }
    throw new Error('AI 응답을 해석할 수 없습니다.');
  }
}

async function callGeminiHeadline(candidates) {
  if (!GEMINI_API_KEY) {
    throw new Error('GEMINI_NOT_CONFIGURED');
  }

  const list = candidates
    .map((c, i) => `${i + 1}. [${c.stockName}] ${c.title} (출처: ${c.source})`)
    .join('\n');
  const prompt =
    '당신은 한국 주식 시장 뉴스를 다루는 애널리스트입니다. 아래는 오늘 수집된 보유 종목 관련 뉴스 후보 목록입니다.\n\n' +
    list +
    '\n\n이 중 투자자에게 가장 중요하고 영향력이 큰 뉴스를 하나만 선택하고, 그 내용을 한국어 한 문장으로 간결하게 요약하세요.';

  const url =
    `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent` +
    `?key=${encodeURIComponent(GEMINI_API_KEY)}`;

  const body = {
    contents: [{ parts: [{ text: prompt }] }],
    generationConfig: {
      responseMimeType: 'application/json',
      responseSchema: {
        type: 'object',
        properties: {
          selectedIndex: { type: 'integer', description: '선택한 뉴스의 번호(1부터 시작)' },
          headline: { type: 'string', description: '한국어 한 문장 요약' },
        },
        required: ['selectedIndex', 'headline'],
      },
    },
  };

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), AI_REQUEST_TIMEOUT_MS);
  try {
    const res = await fetch(url, {
      method: 'POST',
      signal: controller.signal,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    const json = await res.json().catch(() => null);
    if (!res.ok) {
      const msg = (json && json.error && json.error.message) || 'HTTP ' + res.status;
      throw new Error(msg);
    }

    const text =
      json &&
      json.candidates &&
      json.candidates[0] &&
      json.candidates[0].content &&
      json.candidates[0].content.parts &&
      json.candidates[0].content.parts[0] &&
      json.candidates[0].content.parts[0].text;
    if (!text) throw new Error('AI로부터 빈 응답을 받았습니다.');

    const parsed = extractJson(text);
    const idx = Number(parsed.selectedIndex);
    if (!Number.isInteger(idx) || idx < 1 || idx > candidates.length || !parsed.headline) {
      throw new Error('AI 응답 형식이 올바르지 않습니다.');
    }

    const picked = candidates[idx - 1];
    return {
      headline: String(parsed.headline).trim(),
      source: picked.source,
      link: picked.link,
      stockName: picked.stockName,
    };
  } finally {
    clearTimeout(timer);
  }
}

async function handleAiSummary(res) {
  try {
    const candidates = (await getMergedPortfolioNews()).slice(0, 10);
    if (!candidates.length) {
      return sendJson(res, { error: '분석할 뉴스가 없습니다.' }, 404);
    }
    const result = await callGeminiHeadline(candidates);
    sendJson(res, { ok: true, ...result });
  } catch (err) {
    if (err.message === 'GEMINI_NOT_CONFIGURED') {
      return sendJson(res, { error: 'AI 요약 기능이 아직 설정되지 않았습니다. secrets.js의 GEMINI_API_KEY를 확인해주세요.' }, 503);
    }
    console.error('[ai] 요약 실패:', err.message);
    sendJson(res, { error: 'AI 요약에 실패했습니다. 잠시 후 다시 시도해주세요.' }, 500);
  }
}

// ---- 메타 / HTTP 서버 --------------------------------------------------------

function handleMeta(res) {
  sendJson(res, { groups: portfolio.groups });
}

function sendJson(res, obj, status = 200) {
  const body = JSON.stringify(obj);
  res.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 'no-store',
  });
  res.end(body);
}

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
};

function serveStatic(res, urlPath) {
  const rel = urlPath === '/' ? '/index.html' : urlPath;
  const filePath = path.join(__dirname, 'public', path.normalize(rel));
  if (!filePath.startsWith(path.join(__dirname, 'public'))) {
    res.writeHead(403);
    return res.end('Forbidden');
  }
  fs.readFile(filePath, (err, data) => {
    if (err) {
      res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
      return res.end('Not Found');
    }
    res.writeHead(200, { 'Content-Type': MIME[path.extname(filePath)] || 'application/octet-stream' });
    res.end(data);
  });
}

const STOCK_ITEM_RE = /^\/api\/portfolio\/stocks\/(\d{6})$/;

// Vercel 서버리스 함수(api/[...path].js)와 로컬 Node 서버(node server.js)가 함께 사용하는 핸들러
async function requestHandler(req, res) {
  try {
    const parsed = new URL(req.url, `http://${req.headers.host}`);
    const stockMatch = parsed.pathname.match(STOCK_ITEM_RE);

    // 시장지표류(로그인 불필요)
    if (parsed.pathname === '/api/indices') return await handleIndices(res);
    if (parsed.pathname === '/api/marketindex') return sendJson(res, await getFxSnapshot());
    if (parsed.pathname === '/api/krx/kospi') return await handleKrxKospi(res);

    // 인증 — 로그인은 선택 사항(접속 이력 기록용)이며, 아래 기능 이용에 필수는 아님
    if (parsed.pathname === '/api/auth/signup' && req.method === 'POST') return await handleSignup(req, res);
    if (parsed.pathname === '/api/auth/login' && req.method === 'POST') return await handleLogin(req, res);
    if (parsed.pathname === '/api/auth/logout' && req.method === 'POST') return handleLogout(req, res);
    if (parsed.pathname === '/api/auth/me') return handleMe(req, res);

    // 보유 종목·뉴스·AI 요약: 로그인 없이도 이용 가능
    if (parsed.pathname === '/api/meta') return handleMeta(res);
    if (parsed.pathname === '/api/quotes') return sendJson(res, await getQuotesSnapshot());
    if (parsed.pathname === '/api/news') return await handleNews(res, parsed.searchParams);
    if (parsed.pathname === '/api/ai/summary' && req.method === 'POST') return await handleAiSummary(res);
    if (parsed.pathname === '/api/search') return await handleSearch(res, parsed.searchParams);
    if (parsed.pathname === '/api/portfolio/stocks' && req.method === 'POST') return await handleAddStock(req, res);
    if (stockMatch && req.method === 'DELETE') return handleDeleteStock(res, stockMatch[1]);
    if (stockMatch && req.method === 'PATCH') return await handleUpdateHolding(req, res, stockMatch[1]);

    return serveStatic(res, parsed.pathname);
  } catch (err) {
    console.error(err);
    sendJson(res, { error: err.message }, 500);
  }
}

// `node server.js`로 직접 실행할 때만 로컬 HTTP 서버를 띄움.
// Vercel 등에서 이 파일을 require()할 때는 listen()을 호출하지 않고 핸들러만 내보냄.
if (require.main === module) {
  http.createServer(requestHandler).listen(PORT, () => {
    console.log(`내 포트폴리오 대시보드: http://localhost:${PORT}`);
  });
}

module.exports = requestHandler;
