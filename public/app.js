// 내 포트폴리오 대시보드 프론트엔드 (외부 라이브러리 없이 순수 JS)
'use strict';

const ICONS = {
  refresh:
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 12a9 9 0 0 1 15-6.7L21 8"/><path d="M21 3v5h-5"/><path d="M21 12a9 9 0 0 1-15 6.7L3 16"/><path d="M3 21v-5h5"/></svg>',
  up: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M12 19V5M5 12l7-7 7 7"/></svg>',
  down: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M12 5v14M19 12l-7 7-7-7"/></svg>',
  flat: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><path d="M5 12h14"/></svg>',
  cpu: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><rect x="6" y="6" width="12" height="12" rx="1.5"/><rect x="9.5" y="9.5" width="5" height="5" rx="0.5"/><path d="M9 2v3M15 2v3M9 19v3M15 19v3M2 9h3M2 15h3M19 9h3M19 15h3" stroke-linecap="round"/></svg>',
  zap: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"><path d="M13 2 4 14h6l-1 8 9-12h-6l1-8Z"/></svg>',
  atom:
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"><circle cx="12" cy="12" r="1.6" fill="currentColor" stroke="none"/><ellipse cx="12" cy="12" rx="9" ry="3.6"/><ellipse cx="12" cy="12" rx="9" ry="3.6" transform="rotate(60 12 12)"/><ellipse cx="12" cy="12" rx="9" ry="3.6" transform="rotate(120 12 12)"/></svg>',
  flask:
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round" stroke-linecap="round"><path d="M9 2h6M10 2v6.2L4.8 18a2 2 0 0 0 1.8 3h10.8a2 2 0 0 0 1.8-3L14 8.2V2"/><path d="M7.5 15h9"/></svg>',
  plus: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><path d="M12 5v14M5 12h14"/></svg>',
  close: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><path d="M6 6l12 12M18 6 6 18"/></svg>',
  trash:
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M4 7h16M9 7V4.8c0-.4.4-.8.9-.8h4.2c.5 0 .9.4.9.8V7M18 7l-.7 12.3a1.6 1.6 0 0 1-1.6 1.5H8.3a1.6 1.6 0 0 1-1.6-1.5L6 7"/></svg>',
  edit: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M12 20h9"/><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z"/></svg>',
};

function icon(name) {
  return `<span class="icon" data-icon="${name}">${ICONS[name] || ''}</span>`;
}

function directionIcon(direction) {
  if (direction === 'up') return icon('up');
  if (direction === 'down') return icon('down');
  return icon('flat');
}

function fmtPrice(n) {
  return n == null ? '-' : n.toLocaleString('ko-KR');
}

function fmtChange(change, changeRate, direction) {
  if (change == null || changeRate == null) return '-';
  const sign = direction === 'up' ? '+' : direction === 'down' ? '-' : '';
  return `${sign}${Math.abs(change).toLocaleString('ko-KR')} (${sign}${Math.abs(changeRate).toFixed(2)}%)`;
}

function fmtWon(raw) {
  if (raw == null) return '-';
  const n = Math.round(raw);
  const jo = Math.floor(n / 1e12);
  const eok = Math.floor((n % 1e12) / 1e8);
  if (jo > 0) return `${jo.toLocaleString('ko-KR')}조 ${eok.toLocaleString('ko-KR')}억`;
  if (eok > 0) return `${eok.toLocaleString('ko-KR')}억`;
  return n.toLocaleString('ko-KR');
}

function fmtProfit(profit, profitRate) {
  if (profit == null || profitRate == null) return null;
  const dir = profit > 0 ? 'up' : profit < 0 ? 'down' : 'flat';
  const sign = profit > 0 ? '+' : profit < 0 ? '-' : '';
  return { dir, text: `${sign}${Math.abs(Math.round(profit)).toLocaleString('ko-KR')}원 (${sign}${Math.abs(profitRate).toFixed(2)}%)` };
}

function timeAgo(iso) {
  if (!iso) return '';
  const diffMs = Date.now() - new Date(iso).getTime();
  if (diffMs < 0) return '방금 전';
  const min = Math.floor(diffMs / 60000);
  if (min < 1) return '방금 전';
  if (min < 60) return `${min}분 전`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr}시간 전`;
  const day = Math.floor(hr / 24);
  return `${day}일 전`;
}

function fmtUpdatedAt(iso) {
  if (!iso) return '';
  const d = new Date(iso);
  const hh = String(d.getHours()).padStart(2, '0');
  const mm = String(d.getMinutes()).padStart(2, '0');
  const ss = String(d.getSeconds()).padStart(2, '0');
  return `${hh}:${mm}:${ss} 기준`;
}

async function fetchJSON(url, options) {
  const res = await fetch(url, options);
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || 'HTTP ' + res.status);
  return data;
}

function debounce(fn, ms) {
  let t = null;
  return (...args) => {
    clearTimeout(t);
    t = setTimeout(() => fn(...args), ms);
  };
}

// ---- 상태 --------------------------------------------------------------

const BIG_MOVE_THRESHOLD = 5; // % — 이 이상 등락이면 카드에 강조 표시
const TICKER_PX_PER_SEC = 40; // 티커바 흐르는 속도(px/초) — 값이 작을수록 더 천천히 흐름

const state = {
  auth: { loggedIn: false, employeeId: null, name: null }, // 로그인은 선택 사항(접속 이력 기록용)
  meta: null, // { groups }
  quotes: null, // { updatedAt, indices, world, stocks }
  fx: null, // { items }
  newsAll: [], // 전체 보유종목 최신 뉴스(종목당 최대 5건)
  newsByStock: new Map(), // code -> items
  sectionFilter: 'all', // 'all' | groupId
  selectedStock: null, // code | null
  editingHolding: null, // code | null — 매입가/수량 인라인 편집 중인 카드
  selectedSuggestion: null, // 검색에서 고른 종목 { code, name, market }
};

const el = {
  updatedAt: document.getElementById('updatedAt'),
  refreshBtn: document.getElementById('refreshBtn'),
  indices: document.getElementById('indices'),
  filterBar: document.getElementById('filterBar'),
  portfolioGroups: document.getElementById('portfolioGroups'),
  newsTitle: document.getElementById('newsTitle'),
  newsUpdated: document.getElementById('newsUpdated'),
  newsList: document.getElementById('newsList'),
  aiSummaryBtn: document.getElementById('aiSummaryBtn'),
  aiHighlightBody: document.getElementById('aiHighlightBody'),
  addStockBtn: document.getElementById('addStockBtn'),
  addModalOverlay: document.getElementById('addModalOverlay'),
  addModalClose: document.getElementById('addModalClose'),
  addModalCancel: document.getElementById('addModalCancel'),
  addModalSubmit: document.getElementById('addModalSubmit'),
  modalError: document.getElementById('modalError'),
  stockSearchInput: document.getElementById('stockSearchInput'),
  suggestList: document.getElementById('suggestList'),
  selectedStockBox: document.getElementById('selectedStock'),
  groupSelect: document.getElementById('groupSelect'),
  avgPriceInput: document.getElementById('avgPriceInput'),
  quantityInput: document.getElementById('quantityInput'),
  authStatus: document.getElementById('authStatus'),
  authGateBtn: document.getElementById('authGateBtn'),
  authModalOverlay: document.getElementById('authModalOverlay'),
  authModalClose: document.getElementById('authModalClose'),
  authModalTitle: document.getElementById('authModalTitle'),
  loginForm: document.getElementById('loginForm'),
  loginEmployeeId: document.getElementById('loginEmployeeId'),
  loginName: document.getElementById('loginName'),
  loginError: document.getElementById('loginError'),
  signupForm: document.getElementById('signupForm'),
  signupEmployeeId: document.getElementById('signupEmployeeId'),
  signupName: document.getElementById('signupName'),
  signupPhone: document.getElementById('signupPhone'),
  signupError: document.getElementById('signupError'),
  signupSuccess: document.getElementById('signupSuccess'),
};

// ---- 렌더링: 지수/시장지표 ------------------------------------------------

function renderIndices() {
  const parts = [];

  if (state.quotes) {
    for (const idx of state.quotes.indices) {
      parts.push(`
        <div class="index-card">
          <p class="idx-name">${idx.name}</p>
          <p class="idx-price">${fmtPrice(idx.price)}</p>
          <span class="change ${idx.direction}">${directionIcon(idx.direction)}${fmtChange(idx.change, idx.changeRate, idx.direction)}</span>
        </div>
      `);
    }
  }

  if (state.fx && state.fx.items) {
    for (const fx of state.fx.items) {
      parts.push(`
        <div class="fx-card">
          <span class="fx-label">${fx.label}</span>
          <span class="fx-price">${fmtPrice(fx.price)}</span>
          <span class="change ${fx.direction}">${directionIcon(fx.direction)}${fx.changeRate == null ? '-' : Math.abs(fx.changeRate).toFixed(2) + '%'}</span>
        </div>
      `);
    }
  }

  const world = (state.quotes && state.quotes.world) || [];
  if (world.length) {
    const chips = world
      .map(
        (w) => `
        <span class="world-chip">
          <span class="name">${w.name}</span>
          <span class="change ${w.direction}">${directionIcon(w.direction)}${w.changeRate == null ? '-' : Math.abs(w.changeRate).toFixed(2) + '%'}</span>
        </span>`
      )
      .join('');
    parts.push(`<div class="world-strip">${chips}</div>`);
  }

  el.indices.innerHTML = parts.join('');
}

// ---- 렌더링: 필터바 --------------------------------------------------------

function renderFilterBar() {
  if (!state.meta) return;
  const chips = [{ id: 'all', name: '전체' }, ...state.meta.groups.map((g) => ({ id: g.id, name: g.name }))];
  el.filterBar.innerHTML = chips
    .map(
      (c) =>
        `<button type="button" class="chip" data-section="${c.id}" aria-pressed="${state.sectionFilter === c.id}">${c.name}</button>`
    )
    .join('');
}

// ---- 렌더링: 보유 종목 ------------------------------------------------------

function stockMetaLine(q) {
  const parts = [];
  if (q.high != null && q.low != null) parts.push(`고 ${fmtPrice(q.high)} · 저 ${fmtPrice(q.low)}`);
  if (q.volume != null) parts.push(`거래량 ${fmtPrice(q.volume)}`);
  if (q.marketCap != null) parts.push(`시총 ${fmtWon(q.marketCap)}`);
  return parts.join(' &nbsp;·&nbsp; ');
}

function holdingRow(code, q) {
  const isEditing = state.editingHolding === code;

  if (isEditing) {
    return `
      <div class="holding-edit" data-code="${code}">
        <input type="number" min="0" class="text-input text-input-sm" data-field="avgPrice" placeholder="평균 매입가(원)" value="${q.avgPrice != null ? q.avgPrice : ''}" />
        <input type="number" min="0" class="text-input text-input-sm" data-field="quantity" placeholder="보유 수량(주)" value="${q.quantity != null ? q.quantity : ''}" />
        <div class="holding-edit-actions">
          <button type="button" class="btn btn-xs btn-primary" data-action="save-holding" data-code="${code}">저장</button>
          <button type="button" class="btn btn-xs" data-action="cancel-holding">취소</button>
        </div>
      </div>
    `;
  }

  const profit = fmtProfit(q.profit, q.profitRate);
  if (profit) {
    return `
      <button type="button" class="holding-summary" data-action="edit-holding" data-code="${code}">
        <span class="holding-label">평가손익</span>
        <span class="change ${profit.dir}">${directionIcon(profit.dir)}${profit.text}</span>
        ${icon('edit')}
      </button>
    `;
  }
  return `
    <button type="button" class="holding-summary holding-summary--empty" data-action="edit-holding" data-code="${code}">
      ${icon('edit')} 매입가·수량 입력하고 손익 보기
    </button>
  `;
}

function renderPortfolio() {
  if (!state.meta || !state.quotes) return;
  const quoteByCode = new Map(state.quotes.stocks.map((s) => [s.code, s]));

  const groups = state.meta.groups.filter((g) => state.sectionFilter === 'all' || state.sectionFilter === g.id);

  el.portfolioGroups.innerHTML = groups
    .map((g) => {
      let upCount = 0;
      let downCount = 0;
      for (const s of g.stocks) {
        const q = quoteByCode.get(s.code);
        if (q && q.direction === 'up') upCount++;
        if (q && q.direction === 'down') downCount++;
      }

      const cards = g.stocks
        .map((s) => {
          const q = quoteByCode.get(s.code) || {};
          const pressed = state.selectedStock === s.code;
          const bigMove = q.changeRate != null && Math.abs(q.changeRate) >= BIG_MOVE_THRESHOLD;
          const meta = stockMetaLine(q);
          return `
            <div class="stock-card ${bigMove ? 'big-move ' + q.direction : ''}" data-code="${s.code}">
              <button type="button" class="stock-card-main" data-action="select-stock" data-code="${s.code}" aria-pressed="${pressed}">
                <div class="stock-card-head">
                  <span class="stock-name">${s.name}</span>
                  <span class="market-badge">${s.market}</span>
                </div>
                <span class="stock-code">${s.code}</span>
                <div class="stock-price-row">
                  <span class="stock-price">${fmtPrice(q.price)}</span>
                  <span class="change ${q.direction || 'flat'}">${directionIcon(q.direction || 'flat')}${fmtChange(q.change, q.changeRate, q.direction)}</span>
                </div>
                ${meta ? `<div class="stock-meta-line">${meta}</div>` : ''}
              </button>
              <div class="stock-card-foot">
                ${holdingRow(s.code, q)}
                <button type="button" class="icon-btn danger" data-action="delete-stock" data-code="${s.code}" data-name="${s.name}" aria-label="${s.name} 삭제">
                  ${icon('trash')}
                </button>
              </div>
            </div>
          `;
        })
        .join('');

      const summary =
        upCount || downCount
          ? `<span class="group-summary"><span class="change up">${upCount}종목 상승</span><span class="change down">${downCount}종목 하락</span></span>`
          : '';

      return `
        <div class="group-block">
          <h3 class="group-title">${icon(g.icon)}${g.name}<span class="group-count">${g.stocks.length}종목</span>${summary}</h3>
          <div class="stock-grid">${cards}</div>
        </div>
      `;
    })
    .join('');
}

// ---- 렌더링: 뉴스 -----------------------------------------------------------

function newsItemHtml(item, showStockTag) {
  const tag = showStockTag ? `<span class="stock-tag">${item.stockName}</span>` : '';
  return `
    <li class="news-item">
      <a href="${item.link}" target="_blank" rel="noopener noreferrer">${item.title}</a>
      <div class="news-meta">
        ${tag}
        <span>${item.source}</span>
        <span>${timeAgo(item.pubDate)}</span>
      </div>
    </li>
  `;
}

function renderNewsList(items, showStockTag) {
  if (!items || !items.length) {
    el.newsList.innerHTML = '<li class="news-empty">관련 뉴스를 찾지 못했습니다.</li>';
    return;
  }
  el.newsList.innerHTML = items.map((it) => newsItemHtml(it, showStockTag)).join('');
}

// ---- AI 요약 (Gemini) ------------------------------------------------------

async function runAiSummary() {
  el.aiSummaryBtn.disabled = true;
  el.aiHighlightBody.innerHTML = `
    <div class="ai-loading">${icon('refresh')} AI가 오늘의 뉴스를 분석하고 있어요…</div>
  `;
  try {
    const data = await fetchJSON('/api/ai/summary', { method: 'POST' });
    const stockTag = data.stockName ? `<span class="stock-tag">${data.stockName}</span>` : '';
    el.aiHighlightBody.innerHTML = `
      <p class="ai-headline">${data.headline}</p>
      <div class="ai-source">
        ${stockTag}
        <a href="${data.link}" target="_blank" rel="noopener noreferrer">${data.source}</a>
      </div>
    `;
  } catch (err) {
    el.aiHighlightBody.innerHTML = `<p class="ai-error">${err.message || 'AI 요약에 실패했습니다. 잠시 후 다시 시도해주세요.'}</p>`;
  } finally {
    el.aiSummaryBtn.disabled = false;
  }
}

function currentGroupName() {
  if (!state.meta) return '';
  const g = state.meta.groups.find((g) => g.id === state.sectionFilter);
  return g ? g.name : '';
}

async function renderNewsPanel() {
  if (state.selectedStock) {
    const stock = state.meta.groups.flatMap((g) => g.stocks).find((s) => s.code === state.selectedStock);
    el.newsTitle.textContent = `${stock ? stock.name : state.selectedStock} 관련 뉴스`;
    el.newsUpdated.textContent = '';

    if (!state.newsByStock.has(state.selectedStock)) {
      el.newsList.innerHTML = '<li class="news-empty">뉴스를 불러오는 중입니다…</li>';
      try {
        const data = await fetchJSON(`/api/news?code=${encodeURIComponent(state.selectedStock)}`);
        state.newsByStock.set(state.selectedStock, data.items || []);
      } catch (err) {
        console.error(err);
        state.newsByStock.set(state.selectedStock, []);
      }
    }
    renderNewsList(state.newsByStock.get(state.selectedStock), false);
    return;
  }

  el.newsTitle.textContent = state.sectionFilter === 'all' ? '전체 보유종목 뉴스' : `${currentGroupName()} 관련 뉴스`;
  const items =
    state.sectionFilter === 'all' ? state.newsAll : state.newsAll.filter((it) => it.groupId === state.sectionFilter);
  renderNewsList(items, true);
}

// ---- 렌더링: 상단 티커바 (KOSPI 시리즈) ------------------------------------

function renderTicker(data) {
  const track = document.getElementById('tickerTrack');
  if (!data || !data.items || !data.items.length) {
    track.style.animation = 'none';
    track.innerHTML = `<span class="ticker-empty">${(data && data.error) || 'KOSPI 시리즈 지수를 불러올 수 없습니다.'}</span>`;
    return;
  }

  const itemsHtml = data.items
    .map((it) => {
      const rate = it.changeRate == null ? '-' : `${Math.abs(it.changeRate).toFixed(2)}%`;
      const label = it.direction === 'up' ? '상승' : it.direction === 'down' ? '하락' : '보합';
      const tooltip = [
        it.open != null ? `시가 ${fmtPrice(it.open)}` : null,
        it.high != null ? `고가 ${fmtPrice(it.high)}` : null,
        it.low != null ? `저가 ${fmtPrice(it.low)}` : null,
        it.volume != null ? `거래량 ${fmtPrice(it.volume)}` : null,
        it.tradingValue != null ? `거래대금 ${fmtWon(it.tradingValue)}` : null,
        it.marketCap != null ? `상장시가총액 ${fmtWon(it.marketCap)}` : null,
      ]
        .filter(Boolean)
        .join(' · ');
      return `
        <span class="ticker-item" title="${tooltip}">
          <span class="ticker-name">${it.name}</span>
          <span class="ticker-price">${it.close == null ? '-' : it.close.toLocaleString('ko-KR')}</span>
          <span class="change ${it.direction}">${directionIcon(it.direction)}${rate} ${label}</span>
        </span>
      `;
    })
    .join('');

  track.style.animation = '';
  // 끊김 없는 좌→우 순환을 위해 목록을 두 번 이어붙임
  track.innerHTML = itemsHtml + itemsHtml;

  // 항목 수(내용 길이)와 무관하게 체감 속도가 일정하도록 실제 너비 기반으로 재생 시간을 계산
  const oneCopyWidth = track.scrollWidth / 2;
  const duration = Math.max(20, oneCopyWidth / TICKER_PX_PER_SEC);
  track.style.animationDuration = `${duration}s`;
}

async function loadKrxTicker() {
  try {
    const data = await fetchJSON('/api/krx/kospi');
    renderTicker(data);
  } catch (err) {
    console.error('KRX 티커 조회 실패:', err);
    renderTicker({ items: [], error: '데이터를 불러오지 못했습니다.' });
  }
}

function renderUpdatedAt() {
  const at = (state.quotes && state.quotes.updatedAt) || null;
  el.updatedAt.textContent = at ? fmtUpdatedAt(at) : '';
}

// ---- 데이터 로딩 ----------------------------------------------------------

async function loadMeta() {
  state.meta = await fetchJSON('/api/meta');
}

async function loadQuotes() {
  state.quotes = await fetchJSON('/api/quotes');
}

async function loadFx() {
  state.fx = await fetchJSON('/api/marketindex');
}

async function loadNewsAll() {
  const data = await fetchJSON('/api/news');
  state.newsAll = data.items || [];
}

async function refreshQuotesAndFx() {
  el.refreshBtn.classList.add('is-loading');
  try {
    await Promise.all([loadQuotes(), loadFx()]);
    renderIndices();
    renderPortfolio();
    renderUpdatedAt();
  } catch (err) {
    console.error('시세 갱신 실패:', err);
  } finally {
    el.refreshBtn.classList.remove('is-loading');
  }
}

// ---- 인증(로그인/회원가입/로그아웃) -------------------------------------------

async function checkAuth() {
  try {
    const data = await fetchJSON('/api/auth/me');
    state.auth = data.loggedIn
      ? { loggedIn: true, employeeId: data.employeeId, name: data.name }
      : { loggedIn: false, employeeId: null, name: null };
  } catch (err) {
    console.error('로그인 상태 확인 실패:', err);
    state.auth = { loggedIn: false, employeeId: null, name: null };
  }
}

function renderAuthStatus() {
  if (!state.auth.loggedIn) {
    el.authStatus.innerHTML = '';
    return;
  }
  el.authStatus.innerHTML = `
    <span class="auth-user">${state.auth.name}님</span>
    <button type="button" class="btn btn-xs" id="logoutBtn">로그아웃</button>
  `;
  document.getElementById('logoutBtn').addEventListener('click', doLogout);
}

function applyAuthView() {
  el.authGateBtn.hidden = state.auth.loggedIn;
  renderAuthStatus();
}

function switchAuthTab(tab) {
  const isLogin = tab === 'login';
  el.loginForm.hidden = !isLogin;
  el.signupForm.hidden = isLogin;
  el.authModalTitle.textContent = isLogin ? '로그인' : '회원가입';
  document.querySelectorAll('.auth-tab').forEach((btn) => {
    btn.setAttribute('aria-pressed', String(btn.dataset.tab === tab));
  });
}

function openAuthModal(tab) {
  switchAuthTab(tab || 'login');
  el.loginError.hidden = true;
  el.signupError.hidden = true;
  el.signupSuccess.hidden = true;
  el.authModalOverlay.hidden = false;
  setTimeout(() => (el.loginForm.hidden ? el.signupEmployeeId : el.loginEmployeeId).focus(), 0);
}

function closeAuthModal() {
  el.authModalOverlay.hidden = true;
}

async function loadMainData() {
  await loadMeta();
  renderFilterBar();
  await Promise.all([loadQuotes(), loadNewsAll()]);
  renderIndices();
  renderPortfolio();
  renderUpdatedAt();
  renderNewsPanel();
}

async function doLogin(e) {
  e.preventDefault();
  el.loginError.hidden = true;
  const employeeId = el.loginEmployeeId.value.trim();
  const name = el.loginName.value.trim();
  if (!employeeId || !name) return;

  try {
    const data = await fetchJSON('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ employeeId, name }),
    });
    state.auth = { loggedIn: true, employeeId: data.employeeId, name: data.name };
    applyAuthView();
    closeAuthModal();
    el.loginForm.reset();
  } catch (err) {
    el.loginError.hidden = false;
    el.loginError.textContent = err.message || '로그인에 실패했습니다.';
  }
}

async function doSignup(e) {
  e.preventDefault();
  el.signupError.hidden = true;
  el.signupSuccess.hidden = true;
  const employeeId = el.signupEmployeeId.value.trim();
  const name = el.signupName.value.trim();
  const phone = el.signupPhone.value.trim();
  if (!employeeId || !name || !phone) return;

  try {
    await fetchJSON('/api/auth/signup', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ employeeId, name, phone }),
    });
    el.signupSuccess.hidden = false;
    el.signupSuccess.textContent = '회원가입이 완료되었습니다. 로그인해주세요.';
    el.signupForm.reset();
    switchAuthTab('login');
    el.loginEmployeeId.value = employeeId;
    el.loginName.focus();
  } catch (err) {
    el.signupError.hidden = false;
    el.signupError.textContent = err.message || '회원가입에 실패했습니다.';
  }
}

async function doLogout() {
  try {
    await fetchJSON('/api/auth/logout', { method: 'POST' });
  } catch (err) {
    console.error('로그아웃 실패:', err);
  }
  state.auth = { loggedIn: false, employeeId: null, name: null };
  applyAuthView();
}

// ---- 종목 추가 모달 ---------------------------------------------------------

function populateGroupSelect() {
  el.groupSelect.innerHTML = state.meta.groups.map((g) => `<option value="${g.id}">${g.name}</option>`).join('');
}

function openAddModal() {
  state.selectedSuggestion = null;
  el.stockSearchInput.value = '';
  el.suggestList.hidden = true;
  el.suggestList.innerHTML = '';
  el.selectedStockBox.hidden = true;
  el.avgPriceInput.value = '';
  el.quantityInput.value = '';
  el.modalError.hidden = true;
  el.addModalSubmit.disabled = true;
  populateGroupSelect();
  el.addModalOverlay.hidden = false;
  setTimeout(() => el.stockSearchInput.focus(), 0);
}

function closeAddModal() {
  el.addModalOverlay.hidden = true;
}

const runSearch = debounce(async (q) => {
  if (!q) {
    el.suggestList.hidden = true;
    el.suggestList.innerHTML = '';
    return;
  }
  try {
    const data = await fetchJSON(`/api/search?q=${encodeURIComponent(q)}`);
    const items = data.items || [];
    if (!items.length) {
      el.suggestList.hidden = false;
      el.suggestList.innerHTML = '<li class="suggest-empty">검색 결과가 없습니다.</li>';
      return;
    }
    el.suggestList.hidden = false;
    el.suggestList.innerHTML = items
      .map(
        (it) =>
          `<li class="suggest-item" data-code="${it.code}" data-name="${it.name}" data-market="${it.market}">
            <span class="suggest-name">${it.name}</span>
            <span class="market-badge">${it.market}</span>
            <span class="suggest-code">${it.code}</span>
          </li>`
      )
      .join('');
  } catch (err) {
    el.suggestList.hidden = false;
    el.suggestList.innerHTML = '<li class="suggest-empty">검색 중 오류가 발생했습니다.</li>';
  }
}, 300);

function selectSuggestion(code, name, market) {
  state.selectedSuggestion = { code, name, market };
  el.stockSearchInput.value = name;
  el.suggestList.hidden = true;
  el.selectedStockBox.hidden = false;
  el.selectedStockBox.innerHTML = `<span class="suggest-name">${name}</span><span class="market-badge">${market}</span><span class="suggest-code">${code}</span>`;
  el.addModalSubmit.disabled = false;
}

async function submitAddStock() {
  if (!state.selectedSuggestion) return;
  const allCodes = new Set(state.meta.groups.flatMap((g) => g.stocks.map((s) => s.code)));
  if (allCodes.has(state.selectedSuggestion.code)) {
    el.modalError.hidden = false;
    el.modalError.textContent = '이미 추가된 종목입니다.';
    return;
  }

  el.addModalSubmit.disabled = true;
  el.addModalSubmit.textContent = '추가 중…';
  try {
    const body = {
      groupId: el.groupSelect.value,
      code: state.selectedSuggestion.code,
      name: state.selectedSuggestion.name,
      market: state.selectedSuggestion.market,
      avgPrice: el.avgPriceInput.value || null,
      quantity: el.quantityInput.value || null,
    };
    const data = await fetchJSON('/api/portfolio/stocks', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    state.meta.groups = data.groups;
    closeAddModal();
    await refreshQuotesAndFx();
    renderFilterBar();
  } catch (err) {
    el.modalError.hidden = false;
    el.modalError.textContent = err.message || '종목 추가에 실패했습니다.';
    el.addModalSubmit.disabled = false;
  } finally {
    el.addModalSubmit.textContent = '추가하기';
  }
}

async function deleteStock(code, name) {
  if (!confirm(`'${name}' 종목을 보유 목록에서 삭제할까요?`)) return;
  try {
    const data = await fetchJSON(`/api/portfolio/stocks/${encodeURIComponent(code)}`, { method: 'DELETE' });
    state.meta.groups = data.groups;
    if (state.selectedStock === code) state.selectedStock = null;
    state.newsByStock.delete(code);
    renderFilterBar();
    await refreshQuotesAndFx();
    await loadNewsAll();
    renderNewsPanel();
  } catch (err) {
    alert(err.message || '삭제에 실패했습니다.');
  }
}

async function saveHolding(code, avgPriceValue, quantityValue) {
  try {
    const data = await fetchJSON(`/api/portfolio/stocks/${encodeURIComponent(code)}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ avgPrice: avgPriceValue || null, quantity: quantityValue || null }),
    });
    state.meta.groups = data.groups;
    state.editingHolding = null;
    await refreshQuotesAndFx();
  } catch (err) {
    alert(err.message || '저장에 실패했습니다.');
  }
}

// ---- 이벤트 ---------------------------------------------------------------

el.refreshBtn.addEventListener('click', () => refreshQuotesAndFx());

el.filterBar.addEventListener('click', (e) => {
  const btn = e.target.closest('.chip');
  if (!btn) return;
  state.sectionFilter = btn.dataset.section;
  state.selectedStock = null;
  renderFilterBar();
  renderPortfolio();
  renderNewsPanel();
});

el.portfolioGroups.addEventListener('click', (e) => {
  const selectBtn = e.target.closest('[data-action="select-stock"]');
  const deleteBtn = e.target.closest('[data-action="delete-stock"]');
  const editBtn = e.target.closest('[data-action="edit-holding"]');
  const saveBtn = e.target.closest('[data-action="save-holding"]');
  const cancelBtn = e.target.closest('[data-action="cancel-holding"]');

  if (deleteBtn) {
    e.stopPropagation();
    deleteStock(deleteBtn.dataset.code, deleteBtn.dataset.name);
    return;
  }
  if (editBtn) {
    e.stopPropagation();
    state.editingHolding = editBtn.dataset.code;
    renderPortfolio();
    return;
  }
  if (cancelBtn) {
    e.stopPropagation();
    state.editingHolding = null;
    renderPortfolio();
    return;
  }
  if (saveBtn) {
    e.stopPropagation();
    const card = saveBtn.closest('.holding-edit');
    const avgPriceValue = card.querySelector('[data-field="avgPrice"]').value;
    const quantityValue = card.querySelector('[data-field="quantity"]').value;
    saveHolding(saveBtn.dataset.code, avgPriceValue, quantityValue);
    return;
  }
  if (selectBtn) {
    const code = selectBtn.dataset.code;
    state.selectedStock = state.selectedStock === code ? null : code;
    renderPortfolio();
    renderNewsPanel();
  }
});

el.addStockBtn.addEventListener('click', openAddModal);
el.addModalClose.addEventListener('click', closeAddModal);
el.addModalCancel.addEventListener('click', closeAddModal);
el.addModalOverlay.addEventListener('click', (e) => {
  if (e.target === el.addModalOverlay) closeAddModal();
});
el.addModalSubmit.addEventListener('click', submitAddStock);

el.stockSearchInput.addEventListener('input', () => {
  state.selectedSuggestion = null;
  el.addModalSubmit.disabled = true;
  el.selectedStockBox.hidden = true;
  el.modalError.hidden = true;
  runSearch(el.stockSearchInput.value.trim());
});

el.suggestList.addEventListener('click', (e) => {
  const li = e.target.closest('.suggest-item');
  if (!li) return;
  selectSuggestion(li.dataset.code, li.dataset.name, li.dataset.market);
});

document.addEventListener('keydown', (e) => {
  if (e.key !== 'Escape') return;
  if (!el.addModalOverlay.hidden) closeAddModal();
  if (!el.authModalOverlay.hidden) closeAuthModal();
});

document.querySelectorAll('.auth-tab').forEach((btn) => {
  btn.addEventListener('click', () => switchAuthTab(btn.dataset.tab));
});
el.loginForm.addEventListener('submit', doLogin);
el.signupForm.addEventListener('submit', doSignup);

el.aiSummaryBtn.addEventListener('click', runAiSummary);

el.authGateBtn.addEventListener('click', () => openAuthModal('login'));
el.authModalClose.addEventListener('click', closeAuthModal);
el.authModalOverlay.addEventListener('click', (e) => {
  if (e.target === el.authModalOverlay) closeAuthModal();
});

// ---- 초기화 ---------------------------------------------------------------

async function init() {
  // 보유 종목·뉴스·AI 요약은 로그인 없이도 전부 이용 가능. 로그인은 우측 상단 프로필
  // 표시(및 접속 이력 기록)를 위한 선택 기능일 뿐, 화면 구성과는 무관함.
  await checkAuth();
  applyAuthView();
  await loadMainData();
  loadKrxTicker();

  setInterval(refreshQuotesAndFx, 30 * 1000);

  setInterval(async () => {
    await loadNewsAll();
    if (!state.selectedStock) renderNewsPanel();
  }, 10 * 60 * 1000);

  // KRX는 일별 종가 데이터라 자주 바뀌지 않으므로 10분 간격으로만 갱신
  setInterval(loadKrxTicker, 10 * 60 * 1000);
}

init().catch((err) => {
  console.error('초기화 실패:', err);
  el.newsList.innerHTML = '<li class="news-empty">데이터를 불러오지 못했습니다. 새로고침해 주세요.</li>';
});
