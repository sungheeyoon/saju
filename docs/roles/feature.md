# 역할 — 기능 (새 흐름 · 동작 바꾸기)

문 · 액션 · 도메인 lib 를 더하거나 동작을 바꾸는 일이다. 표를 건드리면 `docs/roles/db.md`, 화면을 그리면 `docs/roles/ui.md` 도 읽는다.

## 먼저 읽는 것

- `docs/prd.md` 「0. 지금 어디까지 왔나」와 그 기능의 절 — 무엇을 만드는가의 원본
- `docs/product/gaps.md` 의 그 `G-nn` 줄 — 「끝났다고 말할 조건」이 곧 이 일의 끝이다
- `CONTEXT.md` 의 그 영역 절 — 식별자와 문구가 쓸 낱말
- `docs/architecture.md` 「층 넷」 · 「새 것을 놓을 때」
- `docs/agents/code-rules.md` 「실패를 말하는 법」 · 「주석과 ADR 참조」
- `docs/agents/test-map.md` 「층 × 시험」
- 그 영역의 ADR — [현재 결정 색인](../adr/README.md)에서 영역을 찾아 그 번호만 연다
- `docs/agents/delegation/decisions.md` 「결정 점검표 — 무엇이 바뀌면 결정인가」

## 이 저장소의 방식

규칙은 아래 원본에만 있다 — 여기는 어디를 열지만 말한다(ADR 0145).

- [일하는 법](../agents/delegation/working.md) — 이슈 · 메모의 문장은 가설이다, 재는 법
- [조율자 세션](../agents/delegation/coordinator.md) — 사실과 의도: 버그 · 문서 노후 · 결정 미반영 가르기
- [층 넷](../architecture.md#층-넷) · [새 것을 놓을 때](../architecture.md#새-것을-놓을-때) — 방향 · 자리 · 도메인 lib 사이 새 방향
- [실패를 말하는 법](../agents/code-rules.md#실패를-말하는-법) · [이름](../agents/code-rules.md#이름) · [주석과 ADR 참조](../agents/code-rules.md#주석과-adr-참조)
- [무엇을 고쳤으면 무엇을 돌리나](../agents/test-map.md#무엇을-고쳤으면-무엇을-돌리나) — 로컬 최소와 예외 넷

## 하지 않는 것 · 묻는 것

- 결정 점검표 다섯 중 하나라도 바뀌면 머지하지 않고 보고에 올린다 — 앞의 넷은 ADR 을 같은 PR 에, 문구는 운영자 승인([결정 점검표](../agents/delegation/decisions.md))
- 실호출은 안 한다 — 명령과 볼 값을 「사람이 할 걸음」에([권한 등급](../agents/delegation/permissions.md))
- PRD 절 번호를 코드 주석에 적지 않는다 — changelog 의 날짜나 `G-nn` 을 든다([일하는 법](../agents/delegation/working.md))
- 운영 개인정보를 읽는 SQL 을 보내지 않는다([권한 등급](../agents/delegation/permissions.md) · ADR 0105)

## 끝날 때 고치는 것

- [ ] [끝났다는 것](../agents/delegation/done.md) — PR 칸 여섯. 「문서」 칸이 고칠 원본(ADR · `CONTEXT.md` · PRD 와 changelog · 간극 대장 · 시험 지도)을 든다
- [ ] 새 운영 절차 · 운영 SQL → `docs/ops/runbook/` 의 그 작업 파일(새 파일이면 색인에 한 줄). 새 비밀 → `scripts/secret-env.mjs` 의 갈래
