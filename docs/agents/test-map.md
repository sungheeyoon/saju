# 시험 지도

이 문서는 **무엇을 고쳤을 때 무엇을 돌리는가** 하나만 답한다. 어디에 놓는가는
`docs/architecture.md`, 어떻게 적는가는 `docs/agents/code-rules.md`. CI 가 무엇을 돌리는가의
**규칙은 `scripts/ci-plan.mjs` 한 곳**이고(ADR 0082), 이 문서는 그 규칙을 사람이 읽는 표로
옮긴 것이다 — 어긋나면 `ci-plan.mjs` 가 맞다. 값은 **2026-09-22 에 잰 것**이다(ADR 0087). **파일 수 · 시험 수는
적지 않는다 — 실행이 찍는다**(`docs/agents/delegation/working.md` 「값을 적는 자리는 하나다」). 적어 두었던 수는 PR 몇 개 만에 낡아
한 문서 안에서도 서로 달랐다(2026-09-28). 단위는 `npm test` 의 끝 줄, pgTAP 은 `npm run test:db` 의 끝 줄과
`select plan(N)` 의 합, e2e 는 `npx playwright test --list`, 파일 수는 `find … -name '*.test.ts'` 가 찍는다.

## 차례

이 파일은 색인이다 — 표 · 명령 · 차선은 아래 파일 하나에만 산다(2026-10-05 에 절을 묶어 나눴다). 고친 자리에 맞는 파일만
연다. 처음이면 `docs/agents/test-map/what-to-run.md` 를 먼저 본다.

| 파일 | 절 | 무엇을 드나 |
| --- | --- | --- |
| `docs/agents/test-map/kinds.md` | 「시험은 넷이고, 층마다 닿는 것이 다르다」 · 「층 × 시험」 | 단위 · pgTAP · 흐름 · e2e 의 명령과 필요한 것 · vitest 가 `.tsx` 에서 멈추는 자리 · 층마다 무엇이 재나 |
| `docs/agents/test-map/what-to-run.md` | 「무엇을 고쳤으면 무엇을 돌리나」 | 공개 출시 전의 로컬 최소와 예외 넷 · 고친 자리 → 명령 표 · 머지 직전의 `merge:sim` · 주석 경로 잠금 · 워크트리의 포트 |
| `docs/agents/test-map/live.md` | 「잠긴 시험 넷 — `*.live.test.ts`」 | 실호출 · 백필 시험과 켜는 값 · 운영 접속값을 읽는 파일 |
| `docs/agents/test-map/ci.md` | 「CI」 | 출시 단계와 차선 여섯 · 주소로 고르는 판정 표 · `audit` · 빌드의 비밀 검사 · 공개 출시 뒤 세 단계 · 실패 artifact |
| `docs/agents/test-map/reach.md` | 「커버리지 — 한 번 쟀다」 · 「계약 문구 — 글자가 곧 결정인 것」 · 「재지 않는 것」 · 「어디를 봐야 하나」 | 한 번 잰 커버리지와 문턱을 안 거는 까닭 · `copy-contracts` · 재지 않는 것 · 시험 도구 파일 |
