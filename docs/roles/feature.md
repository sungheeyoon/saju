# 역할 — 기능 (새 흐름 · 동작 바꾸기)

문 · 액션 · 도메인 lib 를 더하거나 동작을 바꾸는 일이다. 표를 건드리면 `docs/roles/db.md`, 화면을 그리면 `docs/roles/ui.md` 도 읽는다.

## 먼저 읽는 것

- `docs/product/prd/foundation.md` 「0. 지금 어디까지 왔나」와 그 기능의 절([PRD 영역 파일](../product/prd/) 가운데 하나 — 어느 파일인지는 색인 `docs/prd.md`) — 무엇을 만드는가의 원본
- `docs/architecture.md` 「층 넷」 · 「새 것을 놓을 때」
- `docs/agents/code-rules/failures.md` 「실패를 말하는 법」 · `docs/agents/code-rules/comments.md` 「주석과 ADR 참조」
- `docs/agents/test-map/kinds.md` 「층 × 시험」
- 그 영역의 ADR — [현재 결정 색인](../adr/README.md)에서 영역을 찾아 그 번호만 연다
- `docs/agents/delegation/decisions.md` 「결정 점검표 — 무엇이 바뀌면 결정인가」

## 이 저장소의 방식

규칙은 아래 원본에만 있다 — 여기는 어디를 열지만 말한다(ADR 0145).

- [일하는 법](../agents/delegation/working.md#일하는-법--세션마다-다시-배우던-것) — 이슈 · 메모의 문장은 가설이다, 재는 법
- [층 넷](../architecture.md#층-넷) · [새 것을 놓을 때](../architecture.md#새-것을-놓을-때) — 방향 · 자리 · 도메인 lib 사이 새 방향
- [실패를 말하는 법](../agents/code-rules/failures.md#실패를-말하는-법) · [이름](../agents/code-rules/names.md#이름) · [주석과 ADR 참조](../agents/code-rules/comments.md#주석과-adr-참조)
- [무엇을 고쳤으면 무엇을 돌리나](../agents/test-map/what-to-run.md#무엇을-고쳤으면-무엇을-돌리나) — 로컬 최소와 예외 넷

## 하지 않는 것 · 묻는 것

- 결정 점검표 다섯 중 하나라도 바뀌면 머지하지 않고 보고에 올린다 — 앞의 넷은 ADR 을 같은 PR 에, 문구는 운영자 승인([결정 점검표](../agents/delegation/decisions.md))
- 실호출은 안 한다 — 명령과 볼 값을 「사람이 할 걸음」에([권한 등급](../agents/delegation/permissions.md))
- PRD 절 번호를 코드 주석에 적지 않는다 — changelog 의 날짜나 `G-nn` 을 든다([일하는 법](../agents/delegation/working.md))
- 운영 개인정보를 읽는 SQL 을 보내지 않는다([권한 등급](../agents/delegation/permissions.md) · ADR 0105)

## 끝날 때 고치는 것

- [ ] [끝났다는 것](../agents/delegation/done.md) — PR 칸 여섯. 「문서」 칸이 고칠 원본을 든다
- [ ] 새 운영 절차 · 운영 SQL → `docs/ops/runbook/` 의 그 작업 파일(새 파일이면 색인에 한 줄)

## 닿을 때 여는 것

손대기 전에 다 읽지 않는다 — 일이 그 자리에 닿을 때 연다(ADR 0147).

- 맡은 일이 `G-nn` 을 들면 → [간극 대장](../product/gaps.md)의 그 줄만(`grep -n 'G-nn'`) — 「끝났다고 말할 조건」이 곧 이 일의 끝이다
- 새 식별자 · 표 · 문구의 이름을 짓거나 낯선 도메인 낱말을 만나면 → [용어집 색인](../../GLOSSARY.md)이 가리키는 [그 영역 파일](../context/)
- 이슈 문장 · 문서가 코드와 어긋나면 → [조율자 세션](../agents/delegation/coordinator.md) — 버그 · 문서 노후 · 결정 미반영 가르기
- 새 비밀(환경 변수)을 들이면 → [비밀의 갈래](../../scripts/secret-env.mjs)
