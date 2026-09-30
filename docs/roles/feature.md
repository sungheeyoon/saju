# 역할 — 기능 (새 흐름 · 동작 바꾸기)

문 · 액션 · 도메인 lib 를 더하거나 동작을 바꾸는 일이다. 표를 건드리면 `docs/roles/db.md`, 화면을 그리면 `docs/roles/ui.md` 도 읽는다.

## 먼저 읽는 것

- `docs/prd.md` 「0. 지금 어디까지 왔나」와 그 기능의 절 — 무엇을 만드는가의 원본
- `docs/product/gaps.md` 의 그 `G-nn` 줄 — 「끝났다고 말할 조건」이 곧 이 일의 끝이다
- `CONTEXT.md` 의 그 영역 절 — 식별자와 문구가 쓸 낱말
- `docs/architecture.md` 「층 넷」 · 「새 것을 놓을 때」
- `docs/agents/code-rules.md` 「실패를 말하는 법」 · 「주석과 ADR 참조」
- `docs/agents/test-map.md` 「층 × 시험」
- 그 영역의 ADR — `grep -l <낱말> docs/adr/*.md`
- `docs/agents/delegation.md` 「결정 점검표 — 무엇이 바뀌면 결정인가」

## 이 저장소의 방식

- **이슈 · 메모의 문장은 가설이다.** 먼저 재고, 잰 값으로 「무엇이 참이 되는가」를 다시 쓴다
  (원본: `docs/agents/delegation.md` 「나란히 맡길 때」 · 「일하는 법」)
- 코드가 PRD 와 다르면 곧바로 어느 쪽을 고치지 않는다 — 버그 · 문서 노후 · 결정 미반영 중 무엇인지 먼저 가른다
  (원본: `docs/agents/delegation.md` 「조율자 세션」)
- 방향은 아래로만: 엔진 ← 도메인 lib ← 문 · 액션 ← 화면. 계산은 `src/lib/saju/`, 정책은 그 도메인의 `src/lib/*` 순수 함수,
  DB 는 화면 폴더의 `.ts` 문 하나, 누름은 `actions.ts`
  (원본: `docs/architecture.md` 「층 넷」 · 「새 것을 놓을 때」)
- 도메인 lib 끼리 새 방향을 열면 `scripts/layers.test.ts` 의 허용 목록과 `docs/architecture.md` 의 표를 함께 고친다
  (원본: `docs/architecture.md` 「층 넷」)
- 문은 실패를 셋으로 말한다. 서버 액션은 값으로 낸다. `error.message` 를 사용자에게 그대로 내지 않는다
  (원본: `docs/agents/code-rules.md` 「실패를 말하는 법」 · ADR 0078)
- 식별자는 영어, 뜻은 용어집 — DB 를 읽는 함수에 `query` · `fetch` · `repository` 를 안 쓴다. 이름은 무엇을 내주는가로 짓는다
  (원본: `docs/agents/code-rules.md` 「이름」)
- 주석은 한국어 산문, 결정은 `ADR NNNN`, TODO 는 안 남긴다 — 미결은 간극 대장이나 이슈로
  (원본: `docs/agents/code-rules.md` 「주석과 ADR 참조」)
- 로컬 최소는 `npm test` · `npm run typecheck` · `npm run lint` 이고 예외 넷이 있다
  (원본: `docs/agents/test-map.md` 「무엇을 고쳤으면 무엇을 돌리나」)

## 하지 않는 것 · 묻는 것

- 결정 점검표 다섯(볼 수 있는 것 · 실패 때 여닫음 · 보존 · 비용 · 문구) 중 하나라도 바뀌면 **ADR 을 같은 PR 에 쓰고, 머지하지 않고
  보고에 올린다** — 사람에게 묻는 것은 조율자다
- 실호출은 안 한다 — 명령과 볼 값을 PR 의 「사람이 할 걸음」에 적는다
- PRD 절 번호를 코드 주석에 적지 않는다 — 절은 옮겨진다. changelog 의 날짜나 `G-nn` 을 든다
- 운영 개인정보를 읽는 SQL 을 보내지 않는다(ADR 0105)

## 끝날 때 고치는 것

- [ ] 모양이 바뀌었으면 → `docs/prd.md` 그 절과 `docs/product/prd-changelog.md`
- [ ] `G-nn` 을 닫았으면 → 그 줄을 지우고 changelog 에 날짜와 함께. 새 틈이 생겼으면 줄을 더한다
- [ ] 결정이 있었으면 → ADR(번호는 머지 직전 main 의 빈 번호)
- [ ] 새 낱말 → `CONTEXT.md`. 돌리는 것이 바뀌었으면 → `docs/agents/test-map.md`
- [ ] 새 운영 절차 · 운영 SQL → `docs/ops/runbook.md`. 새 비밀 → `scripts/secret-env.mjs` 의 갈래
