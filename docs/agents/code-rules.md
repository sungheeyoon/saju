# 코드 규칙

이 문서는 **코드를 어떻게 적는가** 하나만 답한다 — 이름, 실패를 말하는 법, 주석과 ADR 참조,
탈출구, 화면 문구, 금지어. 어디에 놓는가는 `docs/architecture.md` 가, 낱말은 `CONTEXT.md` 가,
무엇을 만드는가는 `docs/prd.md` 가 답한다.

여기 적힌 것은 정한 규칙이 아니라 **2026-09-22 에 잰 값**이다(ADR 0086). 린트가 잡을 수 있는
것은 `eslint.config.mjs` 가 잡고, 못 잡는 것(파일 이름 · ADR 참조 · 탈출구의 지문)은
`scripts/code-rules.test.ts` 가 든다. 문서와 둘이 어긋나면 **린트와 시험이 맞다.** 문서를 고친다.


## 차례

이 파일은 색인이다 — 규칙 · 잰 값 · 표는 아래 파일 하나에만 산다(2026-10-05 에 변경 이유별로 나눴다). 고치는 자리에 맞는
파일만 연다.

| 파일 | 절 | 무엇을 드나 |
| --- | --- | --- |
| `docs/agents/code-rules/names.md` | 「이름」 | 파일 · 폴더 · 시험 · 마이그레이션 · ADR · 타입 · 값 · export 의 이름과 잰 값 · 식별자와 용어집 |
| `docs/agents/code-rules/failures.md` | 「실패를 말하는 법」 | 문의 세 갈래 · 서버 액션이 값으로 내는 법 · 엔진과 도메인 lib 의 값과 예외 · `console` 의 갈래 |
| `docs/agents/code-rules/comments.md` | 「주석과 ADR 참조」 | 주석의 언어와 내용 · `ADR NNNN` 표기 · TODO 를 안 남기는 까닭 · 시험 이름 |
| `docs/agents/code-rules/escapes.md` | 「탈출구 — 지문으로 잠겨 있고 줄어들기만 한다」 | 이중 캐스트 · `!` · 실패를 지우는 자리 · `eslint-disable` 의 예산과 대신 |
| `docs/agents/code-rules/screen-copy.md` | 「화면 문구」 | 문구 규칙의 원본 · 에이전트가 문구를 표로 묻는 법 · 문구 대장을 먼저 보는 차례 |
| `docs/agents/code-rules/banned-words.md` | 「금지어」 | 식별자 · 화면 문구 · 풀이 본문 · 프롬프트 · 주석의 금지어와 누가 잠그나 |
| `docs/agents/code-rules/locks.md` | 「커밋과 PR」 · 「린트가 잠근 것 · 시험이 잠근 것」 · 「알려진 어긋남」 | 커밋 제목의 꼴 · 린트 규칙과 시험이 드는 것 · 잠그지 않은 것 · 고치지 않고 적어 둔 자리 |
