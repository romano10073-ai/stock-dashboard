# 내 포트폴리오 대시보드

코스피·코스닥 지수와 주요 시장지표(환율, 해외지수)를 보여주고, 보유 종목의 실시간 등락과
관련 뉴스를 스크래핑하여 함께 보여주는 개인용 모니터링 웹페이지입니다.

## 보유 종목 구성

| 구분 | 종목 | 종목코드 | 시장 |
|------|------|----------|------|
| 반도체 | 삼성전자 | 005930 | 코스피 |
| 반도체 | 한미반도체 | 042700 | 코스피 |
| 전력주 | 가온전선 | 000500 | 코스피 |
| 전력주 | 산일전기 | 062040 | 코스피 |
| 원전주 | 두산에너빌리티 | 034020 | 코스피 |
| 원전주 | 우진 | 105840 | 코스피 |
| 원전주 | 일진파워 | 094820 | 코스닥 |
| 바이오 | 에이프릴바이오 | 397030 | 코스닥 |
| 바이오 | 알테오젠 | 196170 | 코스닥 |

보유 종목을 바꾸려면 [config.js](config.js)의 `GROUPS`를 수정하세요.

## 특징

- 외부 npm 의존성 없음 — Node 내장 모듈만 사용 (`node server.js`만으로 실행)
- 최상단 티커바: KRX(한국거래소) 공식 오픈API로 KOSPI 시리즈 지수(코스피/코스피200 등)를 좌→우로 흐르는 애니메이션으로 표시
- 지수·시세: 네이버페이 증권 비공식 API를 서버에서 프록시(인증키 불필요)
- 뉴스: Google News RSS를 종목별 키워드로 검색, 정확 일치 필터로 무관 기사 제거
- 시세 20초 / 환율 5분 / 뉴스 10분 메모리 캐시로 과도한 외부 호출 방지
- 종목 클릭 시 해당 종목 관련 뉴스만, 섹터 칩 클릭 시 섹터 단위로 필터링
- 화면에서 바로 종목 검색·추가·삭제 (코드 수정 불필요) — `data/portfolio.json`에 저장되어 서버를 재시작해도 유지
- 종목 카드에 매입가·보유수량을 입력하면 평가손익(금액/수익률)이 함께 표시
- 종목 카드에 당일 고가·저가·거래량·시가총액 표시, 등락률 5% 이상이면 카드를 강조 표시
- 사번·이름 기반 로그인/회원가입(Supabase, 선택 사항). 로그인하지 않아도 모든 기능을 그대로
  사용할 수 있고, 로그인하면 우측 상단에 이름이 표시되고 접속 이력이 기록됨
- "AI 요약" 버튼: Gemini API로 오늘 수집된 보유 종목 뉴스 중 가장 중요한 1건을 골라 한 줄 요약 + 출처 표시
- 네이비(#1E3A5F)·소프트블루(#5B8DB8) 기반 플랫 UI

## 실행

```bash
npm start
# 또는
node server.js
```

브라우저에서 http://localhost:3100 접속. 포트 변경: `PORT=8080 node server.js`

## KRX API 키 설정 (상단 티커바)

최상단 티커바는 한국거래소(KRX) Open API의 "KOSPI 시리즈 일별시세정보"를 사용합니다.
프로젝트 루트의 `.env` 파일에 인증키를 설정하세요(`.env`는 `.gitignore`에 포함되어 커밋되지 않습니다).

```
KRX_API_KEY=발급받은_KRX_OpenAPI_인증키
```

`.env.example`을 참고해 새로 설정할 수 있습니다. 키가 없거나 유효하지 않으면 티커바에
안내 문구가 표시되고 나머지 기능(지수/시세/뉴스 등)은 정상 동작합니다.

**확인 필요**: KRX Open API는 `data.krx.co.kr`에서 인증키를 발급받는 것과는 별개로,
사용하려는 API마다 "활용신청" 후 관리자 승인이 필요합니다. 인증키가 맞는데도 티커바에
"인증에 실패했습니다"가 뜬다면 KRX Data Marketplace 마이페이지에서 "KOSPI 시리즈
일별시세정보" API의 활용신청 승인 상태를 확인해주세요. 승인만 되면 코드 수정 없이
바로 정상 동작합니다.

## Supabase 로그인/회원가입 설정 (선택 사항)

사번·이름으로 로그인하는 사내용 인증 기능은 Supabase를 사용합니다. **로그인은 완전히
선택 사항**이며, 로그인하지 않아도 보유 종목·뉴스·AI 요약 등 모든 기능을 그대로 사용할
수 있습니다 — Supabase가 일시적으로 응답하지 않아도(예: 무료 티어 자동 일시정지) 나머지
기능에는 영향이 없습니다. 로그인은 우측 상단에 이름을 표시하고 `login_history`에 접속
이력을 남기는 부가 기능입니다.

비밀번호 없이 사번+이름만으로 로그인하는 방식이라, 브라우저에는 세션 쿠키(HttpOnly)만
내려주고 Supabase 접속은 **서버(.env)에서 secret(service_role) 키로만** 처리합니다(연락처
등 개인정보가 담긴 회원 테이블을 브라우저가 직접 조회하지 않도록 하기 위함).

현재 연결된 Supabase 프로젝트(`tmzpoptpvbonzngvblhc`)에는 이미 아래가 준비되어 있어
서버가 그대로 사용합니다(직접 테이블에 쓰지 않고 RPC를 호출):

- `users` (employee_id, name, phone, role), `login_history` (employee_id, name, success, created_at) 테이블
- `app_signup(p_employee_id, p_name, p_phone)` — 회원가입, 사번 중복 시 `{success:false, error:"duplicate_employee_id"}`
- `app_login(p_employee_id, p_name)` — 로그인 확인 + login_history에 성공/실패 여부까지 자동 기록
- 그 외 `news`, `earnings`, `favorites`, `app_list_favorites`, `app_toggle_favorite` 테이블/RPC도 존재(현재 이 앱에서는 미사용)

`.env` 설정:

```
SUPABASE_URL=https://tmzpoptpvbonzngvblhc.supabase.co
SUPABASE_SERVICE_ROLE_KEY=발급받은_secret_키
```

다른 Supabase 프로젝트로 새로 시작하는 경우 [supabase.sql](supabase.sql)을 참고해
테이블만이라도 만들 수 있지만, `app_signup`/`app_login` RPC는 별도로 작성해야 합니다.

**주의**: secret(service_role) 키는 데이터베이스 전체에 접근 가능한 비밀키입니다. 브라우저
코드에는 절대 넣지 말고 `.env`에만 두세요(`.env`는 `.gitignore`에 포함). `sb_publishable_...`
(브라우저에 노출돼도 되는 공개 키)나 `sbp_...`(계정 전체를 관리하는 Personal Access Token,
이 기능과 무관)와 헷갈리지 않도록 주의하세요.

## AI 요약 설정 (Gemini)

뉴스 패널 상단의 "AI가 분석한 오늘의 핵심뉴스" 카드는 Google Gemini API를 사용합니다.
API 키는 `.env`가 아니라 **`secrets.js`** 파일에서 읽습니다(다른 키들과 다른 방식이니 주의).

1. `secrets.example.js`를 참고해 프로젝트 루트에 `secrets.js`를 만듭니다(이미 생성되어 있고
   `.gitignore`에 포함되어 커밋되지 않습니다).
2. https://aistudio.google.com/apikey 에서 API 키를 발급받아 채워넣습니다.

```js
// secrets.js
module.exports = {
  GEMINI_API_KEY: '발급받은_Gemini_API_키',
};
```

동작 방식: 버튼을 누르면 서버가 그날 수집된 보유 종목 뉴스 후보(최대 10건)를 Gemini
(`gemini-3.1-flash-lite`)에 보내고, Gemini는 `{selectedIndex, headline}` 형태의 JSON으로만
답하도록 강제됩니다(Gemini의 `responseSchema` 구조화 출력 기능 사용). 서버는 그 인덱스로
원본 기사를 찾아 실제 출처·링크와 함께 화면에 내려줍니다 — AI가 출처를 잘못 지어내는 것을
막기 위해 출처는 항상 서버가 가진 원본 데이터에서 가져옵니다.

**확인 필요**: `gemini-3.1-flash-lite`는 요청하신 모델명을 그대로 사용했습니다. 실제 사용
가능한 모델인지는 확인하지 못했으니, 버튼을 눌렀을 때 오류 문구가 뜨면 모델명을 Google AI
Studio에서 확인 가능한 최신 모델명으로 교체해주세요(`server.js`의 `GEMINI_MODEL` 상수 한
곳만 고치면 됩니다). 키가 없거나 호출에 실패해도 카드에 안내 문구만 표시되고 나머지
기능은 정상 동작합니다.

## API

- `GET /api/indices` — (공개) 코스피·코스닥 지수, 참고용 해외지수(다우/나스닥/S&P500) — 로그인 불필요
- `GET /api/marketindex` — (공개) 주요 환율(USD/EUR/JPY/CNY) 시장지표 — 로그인 불필요
- `GET /api/krx/kospi` — (공개) KRX 공식 API 기반 KOSPI 시리즈 지수(상단 티커바용) — 로그인 불필요
- `POST /api/auth/signup` — 회원가입 `{ employeeId, name, phone }`
- `POST /api/auth/login` — 로그인 `{ employeeId, name }` (성공 시 세션 쿠키 발급, 로그인 이력 저장)
- `POST /api/auth/logout` — 로그아웃
- `GET /api/auth/me` — 로그인 상태 확인
- 아래는 **로그인 필요** (세션 쿠키 없으면 401):
  - `GET /api/meta` — 보유 종목 그룹/종목 메타데이터 (`data/portfolio.json` 기준)
  - `GET /api/quotes` — 지수 + 보유 종목 실시간 시세(고가/저가/거래량/시가총액/평가손익 포함)
  - `GET /api/news`, `GET /api/news?code=<종목코드>` — 보유 종목 관련 뉴스
  - `POST /api/ai/summary` — Gemini로 오늘의 핵심뉴스 1건 요약(`{headline, source, link, stockName}`)
  - `GET /api/search?q=<검색어>` — 종목명 자동완성 검색(추가할 종목 찾기)
  - `POST /api/portfolio/stocks` — 종목 추가 `{ groupId, code, name, market, avgPrice?, quantity? }`
  - `PATCH /api/portfolio/stocks/<종목코드>` — 매입가·수량 수정 `{ avgPrice, quantity }`
  - `DELETE /api/portfolio/stocks/<종목코드>` — 종목 삭제

## 데이터 저장

보유 종목·매입정보는 `data/portfolio.json`에 저장됩니다. 이 파일이 없으면 최초 실행 시
`config.js`의 기본 종목으로 자동 생성됩니다. 백업하고 싶다면 이 파일만 복사해두면 됩니다.

## 확인 필요 / 알려진 한계

- 시세·환율 API는 네이버페이 증권의 비공식 엔드포인트로, 정식 공개 문서가 없어 응답 형식이
  예고 없이 바뀔 수 있습니다. 요청 빈도 제한 정책도 공개되어 있지 않아 서버 캐시로 완화만 하고 있습니다.
- '우진'처럼 흔한 이름의 종목은 뉴스 검색 시 동명 기업 기사가 일부 섞일 수 있습니다.
- 실시간 시세는 지연 시세일 수 있으며, 실제 매매 판단에는 사용하지 마세요.
- 로그인은 비밀번호 없이 사번+이름 일치만으로 처리됩니다. 사번을 아는 사람이면 다른 사람 이름으로
  로그인할 수 있으므로, 외부에 공개되지 않는 사내 전용 도구로만 사용하세요.
- 세션은 서버 메모리에 저장됩니다. 서버를 재시작하면 로그인된 사용자는 모두 로그아웃 처리됩니다.
- Supabase 무료 티어는 약 1주일 이상 미사용 시 프로젝트가 자동으로 일시정지(pause)될 수
  있습니다. 이 경우 로그인/회원가입만 실패하고 나머지 기능(보유 종목/뉴스/AI 요약 등)은
  그대로 동작합니다. Supabase 대시보드에서 프로젝트를 재개(Resume)하면 로그인도 복구됩니다.
- Gemini API 키는 Google AI Studio(https://aistudio.google.com/apikey )에서 발급받은 키를
  사용해야 합니다. `AIzaSy...`, `AQ....` 등 여러 형태가 실제로 동작함을 확인했으나, 다른
  용도의 Google 토큰(다른 프로젝트의 OAuth 액세스 토큰, Personal Access Token 등)은 겉보기엔
  비슷해도 인증에 실패합니다 — 반드시 AI Studio에서 발급한 키인지 확인하세요.
