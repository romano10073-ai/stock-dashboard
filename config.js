// 보유 종목 포트폴리오 정의
// 종목코드는 웹 검색으로 교차 확인 및 네이버 시세 API 응답으로 실재 확인 완료(2026-07-09 기준).
// keywords : 뉴스 검색(Google News RSS)에 사용하는 질의어
// match    : 노이즈 제거용 "정확 일치" 명칭 — 기사 제목/요약에 포함되어야 채택
//
// 확인 필요: '우진'은 흔한 단어라 동명 기업(우진플라임 등) 기사가 섞일 수 있음.
//            검색어를 '우진 원전'/'우진 계측기' 등으로 좁혀 완화했으나 완벽하지 않을 수 있음.
const GROUPS = [
  {
    id: 'semiconductor',
    name: '반도체',
    icon: 'cpu',
    stocks: [
      { code: '005930', name: '삼성전자', market: 'KOSPI', keywords: ['삼성전자'], match: ['삼성전자'] },
      { code: '042700', name: '한미반도체', market: 'KOSPI', keywords: ['한미반도체'], match: ['한미반도체'] },
    ],
  },
  {
    id: 'power',
    name: '전력주',
    icon: 'zap',
    stocks: [
      { code: '000500', name: '가온전선', market: 'KOSPI', keywords: ['가온전선'], match: ['가온전선'] },
      { code: '062040', name: '산일전기', market: 'KOSPI', keywords: ['산일전기'], match: ['산일전기'] },
    ],
  },
  {
    id: 'nuclear',
    name: '원전주',
    icon: 'atom',
    stocks: [
      { code: '034020', name: '두산에너빌리티', market: 'KOSPI', keywords: ['두산에너빌리티'], match: ['두산에너빌리티'] },
      { code: '105840', name: '우진', market: 'KOSPI', keywords: ['우진 원전', '우진 계측기'], match: ['우진'] },
      { code: '094820', name: '일진파워', market: 'KOSDAQ', keywords: ['일진파워'], match: ['일진파워'] },
    ],
  },
  {
    id: 'bio',
    name: '바이오',
    icon: 'flask',
    stocks: [
      { code: '397030', name: '에이프릴바이오', market: 'KOSDAQ', keywords: ['에이프릴바이오'], match: ['에이프릴바이오'] },
      { code: '196170', name: '알테오젠', market: 'KOSDAQ', keywords: ['알테오젠'], match: ['알테오젠'] },
    ],
  },
];

// 시장지표에 노출할 환율 코드 (api.stock.naver.com/marketindex/exchange 응답의 reutersCode 기준)
const FX_CODES = [
  { code: 'FX_USDKRW', label: '미국 USD' },
  { code: 'FX_EURKRW', label: '유럽 EUR' },
  { code: 'FX_JPYKRW', label: '일본 JPY(100)' },
  { code: 'FX_CNYKRW', label: '중국 CNY' },
];

// 코스피/코스닥 외 참고용 해외 지수 (api.stock.naver.com/index/major 응답의 reutersCode 기준)
const WORLD_INDEX_CODES = ['.DJI', '.IXIC', '.INX'];

module.exports = { GROUPS, FX_CODES, WORLD_INDEX_CODES };
