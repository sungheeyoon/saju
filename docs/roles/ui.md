# 역할 — 화면 (모양 · 문구 · 디자인)

`app/**/*.tsx` 와 `app/ui/` 를 고치는 일이다. 새 동작이 붙으면 `docs/roles/feature.md` 도 읽는다.

## 먼저 읽는 것

- `docs/product/copy-ledger.md` 「01 규칙」과 고칠 화면의 줄 — **문구는 여기서 먼저 찾는다**
- `docs/agents/code-rules.md` 「화면 문구」 · `CONTEXT.md` 「8. 화면 문구 규칙」 — 말투와 표기(해요체는 ADR 0135)
- ADR 0109 — 디자인 체계는 토큰 한 벌이고 부품은 `app/ui/` 에 있다
- `docs/product/prd/screens.md` 「3. 화면」 가운데 고칠 화면의 절 — 지금 모양의 원본
- `docs/architecture.md` 「새 것을 놓을 때」 — 화면은 그리기만 한다
- `docs/agents/test-map.md` 「무엇을 고쳤으면 무엇을 돌리나」의 화면 줄

## 이 저장소의 방식

규칙은 아래 원본에만 있다 — 여기는 어디를 열지만 말한다(ADR 0145).

- [화면 문구](../agents/code-rules.md#화면-문구) · [문구 대장의 규칙](../product/copy-ledger.md#01-규칙--버튼은-결과를-말하고-닫는-것은-취소다) — 대장에 없으면 표로 묻는다 · 같은 사실은 상수 하나
- [그 밖의 자리](../architecture.md#그-밖의-자리) · [새 것을 놓을 때](../architecture.md#새-것을-놓을-때) — 토큰과 `app/ui/` · 화면은 DB 를 부르지 않는다(ADR 0109 · 0080)
- [무엇을 고쳤으면 무엇을 돌리나](../agents/test-map.md#무엇을-고쳤으면-무엇을-돌리나) · [CI](../agents/test-map.md#ci) — 로컬 최소 · e2e 의 예외 · 주소 차선
- [로컬 환경의 함정](../agents/delegation/local-env.md) — 남의 dev 서버 · `next build` 만 잡는 파일 이름
- [무인 라운드](../agents/delegation/unattended.md) · [끝났다는 것](../agents/delegation/done.md) — 뜻을 바꾸지 않는 다듬기와 전후 그림

## 하지 않는 것 · 묻는 것

- 새 사용자 문구 · 화면 흐름 · 메뉴 구조는 결정이다 — PR 까지 만들고 머지하지 않는다. 예외는 `/ops/**` 의 운영자 전용 설명뿐([결정 점검표](../agents/delegation/decisions.md) · [무인 라운드](../agents/delegation/unattended.md))
- 남이 띄운 dev 서버(3000)는 죽이기 전에 묻는다 — 그 서버를 재사용한 e2e 는 운영 DB 를 본다([로컬 환경의 함정](../agents/delegation/local-env.md))
- 운영 배포 · 운영 smoke 는 안 한다 — 머지는 배포가 아니다([권한 등급](../agents/delegation/permissions.md) · [운영 역할](ops.md))

## 끝날 때 고치는 것

- [ ] [끝났다는 것](../agents/delegation/done.md) — PR 칸 여섯 · 전후 그림은 PR 본문에. 「문서」 칸이 고칠 원본(PRD 와 changelog · `CONTEXT.md` · ADR)을 든다
- [ ] 확정된 문구 → `docs/product/copy-ledger.md` 에 줄을 더한다(그 PR 이)
- [ ] 토큰 · 공용 부품의 규칙을 바꿨으면 → ADR 0109 추기 또는 새 ADR
