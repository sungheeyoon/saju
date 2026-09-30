# 역할 — 문서 (대장 · 기록 · 원본 맞추기)

PRD · 간극 대장 · changelog · 용어집 · 노트 · 역할 문서를 코드와 결정에 맞추는 일이다.

## 먼저 읽는 것

- `docs/start.md` 「원본 — 무엇이 무엇을 답하나」 — 한 사실은 한 자리에 산다
- `docs/product/gaps.md` 머리말 — 상태 다섯 · 띠 넷 · `보류` 의 뜻
- `docs/product/prd-changelog.md` 「개정의 방법」
- `docs/agents/delegation.md` 「세션 기록 — `docs/notes/`」
- `docs/notes/README.md` — 노트의 차례
- `docs/agents/code-rules.md` 「주석과 ADR 참조」 — `ADR NNNN` 표기
- `docs/agents/domain.md` — 용어집과 ADR 을 대하는 법

## 이 저장소의 방식

- **옮겨 적지 않고 가리킨다.** 지금 모양은 PRD, 틈은 간극 대장, 날짜별 변경은 changelog, 결정은 ADR, 낱말은 `CONTEXT.md`,
  사정은 노트, 절차는 runbook
- 문서에 수를 적지 않는다 — 실행이 찍게 한다(시험 수 · 파일 수는 금세 낡는다)
- 문서와 코드가 어긋나면 버그 · 문서 노후 · 결정 미반영 중 무엇인지 먼저 가른다. 문서를 코드에 맞추다 정책이 바뀌면 그것은 결정이다
- 입구 문서(`CLAUDE.md` · `AGENTS.md` · `docs/agents/` · `docs/roles/` …)의 백틱 경로와 `npm run` 이름, 역할 문서가 가리키는 절은 시험이 잰다
- 중앙 문서는 제가 바꾼 줄만 고친다. 나란히 도는 PR 이 있으면 머지는 하나씩이다 — changelog 는 끝에 덧붙인다(`union`)
- `docs/product/prd-archive.md` 는 요구사항이 아니다 — 거기서 무엇을 만들지 읽지 않는다

## 하지 않는 것 · 묻는 것

- `보류` 줄을 다시 권하거나 앞당기지 않는다 — 조건이 오면 운영자가 꺼낸다
- 이미 있는 기록을 고치는 두 PR 을 나란히 두지 않는다 — 상반된 문장이 둘 다 남는다
- 노트를 요구사항처럼 쓰지 않는다 — 규약이 된 것은 원본으로 옮긴다

## 끝날 때 고치는 것

- [ ] `npx vitest run scripts/` — 입구 경로 · ADR 참조 · 노트 차례 · 역할 문서의 절을 잰다
- [ ] 새 노트 → `docs/notes/README.md` 에 한 줄
- [ ] 닫은 `G-nn` → 줄을 지우고 changelog 에 날짜와 함께
- [ ] 원본의 절 이름을 바꿨으면 → 그 절을 가리키던 역할 문서도
