# 위임 규약 — 세션 기록

색인은 `docs/agents/delegation.md` 다.

## 세션 기록 — `docs/notes/`

세션 메모리에만 있던 것은 2026-09-22 에 저장소로 옮겼다. 규약이 된 것은 위임 규약(`docs/agents/delegation.md`)에, 절차가 된
것은 `docs/ops/runbook.md` 에, 결정이 된 것은 ADR 에 있고, **그 밖의 판단 기록**은
`docs/notes/` 에 그날의 사정째로 있다(차례는 `docs/notes/README.md`). 노트는 요구사항도 규칙도
아니다 — 코드가 왜 이 모양인지 되짚을 때 연다. **새 기억은 저장소에 적는다** — 규약이면 위임 규약,
틈이면 `docs/product/gaps.md`, 사정이면 노트에 날짜와 함께. 노트도 가지 → PR → `--auto` 로 넣는다(ADR 0121) —
새 노트는 차례(`docs/notes/README.md`)에 줄을 더하고, 적은 `ADR NNNN` 이 main 에 있는지 `scripts/code-rules.test.ts` 로 먼저 본다.

**라운드 노트는 다른 문서에 없는 것만 적는다(운영자 답 2026-10-05).** 권한 봉투(`docs/agents/delegation/unattended.md` 「무인 라운드」) · 조율자의 판단과
그 까닭 · 배운 것 · 헤맨 것이다. 머지 목록은 PR, 배포 SHA 와 smoke 값은 배포 기록(`docs/ops/runbook/deploy.md` 「묶음 배포」의 5 가 적게 하는 그 일의 이슈),
남은 일과 닫힌 일은 `docs/product/gaps.md` 가 원본이다 — 노트는 PR 번호 · `G-nn` 으로 가리키기만 한다. 까닭: 2026-10-05 밤
노트(#480)가 PR 본문 · changelog · 간극 대장의 기록과 거의 겹쳤다.

## 경로가 옮겨지면 — 고치는 것과 두는 것

지금을 말하는 문서는 지금 자리로 고친다 — 입구 문서 · 역할 문서 · 위임 규약 · PRD · 간극 대장 · 운영 소스 주석(시험이 잰다,
`docs/agents/code-rules/locks.md` 「린트가 잠근 것 · 시험이 잠근 것」). ADR 본문 · 노트 · changelog 의 지난 줄 · 마이그레이션
주석은 그날의 기록이라 옛 경로째 둔다 — 기록은 낡는 것이 맞다(ADR 0090 「잠그지 않은 것」, 2026-10-06 #504).
