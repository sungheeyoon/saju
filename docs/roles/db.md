# 역할 — DB (마이그레이션 · 함수 · 정책 · pgTAP)

`supabase/migrations/` 와 `supabase/tests/` 를 고치는 일이다. 앱이 그 함수를 부르게 하는 쪽은 `docs/roles/feature.md` 다.

## 먼저 읽는 것

- `docs/architecture.md` 「문 — DB 를 부르는 자리」 · 「그 밖의 자리」
- `docs/agents/delegation/permissions.md` 「권한 등급」 — 특히 「예외 — 마이그레이션이 든 PR」 문단
- `docs/agents/delegation/parallel.md` 「나란히 맡길 때」 — 원격 DB · 마이그레이션 사슬은 순차다
- `docs/ops/runbook/deploy.md` 「규약 넷 — 앱과 DB 는 따로 간다」 · 「묶음 배포」의 0
- `docs/ops/runbook/access.md` 「개인정보는 화면으로만」
- `docs/agents/test-map/what-to-run.md` 「무엇을 고쳤으면 무엇을 돌리나」의 마이그레이션 줄
- ADR 0084(모양을 잠근다)

## 이 저장소의 방식

규칙은 아래 원본에만 있다 — 여기는 어디를 열지만 말한다(ADR 0145).

- [권한 등급](../agents/delegation/permissions.md) — `db push` 의 차례 · 본 값 적기 · 마이그레이션 PR 의 예외 · 운영 개인정보
- [규약 넷](../ops/runbook/deploy.md#규약-넷--앱과-db-는-따로-간다-adr-0090) — 마이그레이션이 먼저 · 넓히기 → 앱 → 좁히기(ADR 0071)
- [문 — DB 를 부르는 자리](../architecture.md#문--db-를-부르는-자리) — 문이 실패를 말하는 셋(ADR 0078)
- [개인정보는 화면으로만](../ops/runbook/access.md#개인정보는-화면으로만--원격-sql-의-경계-adr-0105) — 원격 SQL 의 경계 · 접속기록(ADR 0105)
- [이름](../agents/code-rules/names.md#이름) — 마이그레이션 파일 이름
- [무엇을 고쳤으면 무엇을 돌리나](../agents/test-map/what-to-run.md#무엇을-고쳤으면-무엇을-돌리나) — 로컬 차례(`db:reset` → `test:db` → `db:types` …)
- [시험은 넷이고](../agents/test-map/kinds.md#시험은-넷이고-층마다-닿는-것이-다르다) — pgTAP 이 닿는 곳
- [일하는 법](../agents/delegation/working.md) — 원격에 닿는 명령 둘과 기계 잠금
- [조율자 세션](../agents/delegation/coordinator.md) — 타임스탬프 · pgTAP 번호는 머지 직전 main 의 마지막 뒤
- [로컬 환경의 함정](../agents/delegation/local-env.md) — 옛 볼륨 · 전역으로 세는 pgTAP · `db query` 의 한계
- [공개 출시](../product/gaps.md#공개-출시) — `security definer` 함수의 `search_path` 를 재는 줄

## 하지 않는 것 · 묻는 것

- 운영 개인정보를 읽는 SQL 을 보내지 않는다 — 질의를 써서 건넨다([권한 등급](../agents/delegation/permissions.md) · ADR 0105)
- `supabase config push` 는 등급 4 다 — 원격의 구글 설정을 지운다([권한 등급](../agents/delegation/permissions.md))
- 남은 원격 잠금을 스스로 걷지 않는다 — 멈추고 걷는 법을 말한다([일하는 법](../agents/delegation/working.md))
- RLS · grant · 보존 기간 · 실패 때 여닫음이 바뀌면 결정이다 — ADR 을 쓰고 머지하지 않고 보고한다([결정 점검표](../agents/delegation/decisions.md))

## 끝날 때 고치는 것

- [ ] [끝났다는 것](../agents/delegation/done.md) — PR 칸 여섯. 「사람이 할 걸음」에 밟은 `db push` 와 본 값, 「문서」에 결정 여부와 고친 원본
- [ ] 새 표 · 함수의 이름이 도메인 낱말이면 → [용어 ↔ 코드](../context/code-names.md#9-용어--코드)
- [ ] 운영에서 손으로 도는 SQL · 절차가 바뀌었으면 → `docs/ops/runbook/` 의 그 작업 파일(새 파일이면 색인에 한 줄)
