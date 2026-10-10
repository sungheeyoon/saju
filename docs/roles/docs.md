# 역할 — 문서 (대장 · 기록 · 원본 맞추기)

PRD · 간극 대장 · changelog · 용어집 · 노트 · 역할 문서를 코드와 결정에 맞추는 일이다.

## 먼저 읽는 것

- `docs/start.md` 「원본 — 무엇이 무엇을 답하나」 — 한 사실은 한 자리에 산다
- `docs/product/gaps.md` 머리말 — 상태 다섯 · 띠 넷 · `보류` 의 뜻
- `docs/agents/delegation/notes.md` 「세션 기록 — `docs/notes/`」
- `docs/agents/code-rules/comments.md` 「주석과 ADR 참조」 — `ADR NNNN` 표기
- `docs/agents/domain.md` — 용어집과 ADR 을 대하는 법

## 이 저장소의 방식

규칙은 아래 원본에만 있다 — 여기는 어디를 열지만 말한다(ADR 0145).

- [원본 — 무엇이 무엇을 답하나](../start.md#원본--무엇이-무엇을-답하나) — 한 사실의 자리 · 어긋나면 어느 쪽이 맞나
- [일하는 법](../agents/delegation/working.md) — 재는 법 · 값을 적는 자리는 하나다
- [결정 점검표](../agents/delegation/decisions.md) — 문서를 코드에 맞추다 정책이 바뀌면 결정
- [조율자 세션](../agents/delegation/coordinator.md) — 사실과 의도 · 버그 · 문서 노후 · 결정 미반영 가르기
- [나란히 맡길 때](../agents/delegation/parallel.md) — 중앙 문서는 제 줄만 · 머지는 하나씩 · `union`
- [린트가 잠근 것 · 시험이 잠근 것](../agents/code-rules/locks.md#린트가-잠근-것--시험이-잠근-것) — 입구 문서의 경로를 재는 시험. 역할 문서의 절 · 링크 · 읽기량은 ADR 0145 · 0147
- [Writing an ADR](../agents/domain.md#writing-an-adr) — 색인 줄과 후속 결정 줄

## 하지 않는 것 · 묻는 것

- `보류` 줄을 다시 권하거나 앞당기지 않는다 — 조건이 오면 운영자가 꺼낸다([조율자 세션](../agents/delegation/coordinator.md))
- 이미 있는 기록을 고치는 두 PR 을 나란히 두지 않는다 — 상반된 문장이 둘 다 남는다([나란히 맡길 때](../agents/delegation/parallel.md))
- 노트를 요구사항처럼 쓰지 않는다 — 규약이 된 것은 원본으로 옮긴다([세션 기록](../agents/delegation/notes.md))
- `docs/product/prd-archive.md` 에서 무엇을 만들지 읽지 않는다([원본](../start.md#원본--무엇이-무엇을-답하나))

## 끝날 때 고치는 것

- [ ] [끝났다는 것](../agents/delegation/done.md) — PR 칸 여섯과 「문서」 칸의 결정 여부
- [ ] 새 노트 → `docs/notes/` 의 차례(README)에 한 줄. 닫은 `G-nn` → 줄을 지우고 PRD 개정 기록 끝에 날짜와 함께 한 줄 (개정 기록은 끝에 쓰기만 하고 열지 않는다) — 꼴은 [끝났다는 것](../agents/delegation/done.md) 「문서」 칸
- [ ] 원본의 절 이름을 바꿨으면 → 그 절을 가리키던 역할 문서도. `npx vitest run scripts/` 가 잰다
- [ ] 공유 문서를 고쳐 읽기량 시험이 붉으면 → [천장에 걸리면](../agents/delegation/done.md#읽기량-천장에-걸리면) — 줄이지 말고 고칠 자리를 고른다

## 닿을 때 여는 것

손대기 전에 다 읽지 않는다 — 일이 그 자리에 닿을 때 연다(ADR 0147).

- 경로가 옮겨지면 → [경로가 옮겨지면](../agents/delegation/notes.md#경로가-옮겨지면--고치는-것과-두는-것) — 고칠 문서와 그날의 기록으로 둘 것(ADR 0090)
- 새 노트를 쓰거나 코드가 이렇게 된 사정을 거슬러 가면 → [노트의 차례](../notes/README.md)
- 역할 문서를 고치면 → [읽기량의 셈](../../scripts/read-budget.mjs) 머리말 — 무엇을 세나(백틱 파일 · 링크 · 「절」)와 안 세나(백틱 디렉터리 · 이 칸). `npm run read-budget -- <역할>` 이 파일마다 찍는다
- 운영자가 밟는 행정 절차(예: 통신판매업 신고)의 상태를 적으면 → [비어 있는 것](../legal/README.md#비어-있는-것--검토와-따로-채운다) — 그 절차가 채울 빈칸 곁에 둔다(#516)
