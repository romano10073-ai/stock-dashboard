// Vercel 서버리스 함수 진입점.
// 실제 라우팅/비즈니스 로직은 server.js의 requestHandler를 그대로 재사용함
// (로컬 `node server.js` 실행과 Vercel 배포가 같은 핸들러를 공유).
module.exports = require('../server.js');
