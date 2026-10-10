# 입구 — 무엇을 하려는가

이 저장소에서 일을 여는 사람(에이전트든 사람이든)은 **여기서 역할 하나를 고르고, 그 역할 문서를 끝까지 읽은 뒤에
손을 댄다.** 역할 문서는 한 화면이고 칸이 넷이다 — 먼저 읽는 것 · 이 저장소의 방식 · 하지 않는 것 · 묻는 것 · 끝날 때
고치는 것. 맨 뒤의 「닿을 때 여는 것」은 손대기 전에 읽지 않고, 일이 그 줄의 자리에 닿을 때 연다(ADR 0147). 역할 문서는 **원본으로 가는 길잡이(Router)다** — 규칙을 줄여 다시 말하지 않고 원본의 절을 링크로 가리키며,
멈출 자리(「하지 않는 것 · 묻는 것」)만 짧게 들고 줄마다 출처를 단다(ADR 0140·0145). 규칙이 바뀌면 원본을 고치고, 역할
문서는 가리키는 절이 옮겨졌을 때만 고친다. 가리킨 절 · 링크가 실제로 있는지와 역할마다 읽기량 예상치(고정 + 일마다 고르는 것 가운데 가장 큰 것)는 `scripts/code-rules.test.ts` 가 잰다.

## 모두가 먼저 보는 것

1. **붉은 main** — `gh issue list --label ci-main-red` 가 비어 있지 않으면 그것부터(`docs/agents/delegation/working.md` 「시작하기 전에」)
2. **나란히 도는 세션** — `git worktree list`. 작업 가지는 워크트리로 연다(`docs/agents/delegation/working.md` 「일하는 법」)
3. **지금 단계** — `docs/product/prd/roadmap.md` 「7.0 출시 범위」 표의 「(지금)」. 운영 베타 동안 등급 3 은 밟고 값을 적는다(ADR 0093)
4. **보류 줄** — `docs/product/gaps.md` 의 `보류` 는 그 조건이 올 때까지 권하지도 묻지도 않는다
5. **로컬 환경** — 새 워크트리에는 `node_modules` 가 없다. 무엇이든 돌리기 전에 `docs/agents/delegation/local-env.md` 「로컬 환경의 함정」

## 역할 고르기

| 하려는 일 | 역할 문서 | Claude Code 에이전트 |
| --- | --- | --- |
| 화면의 모양 · 문구 · 디자인을 바꾼다 | `docs/roles/ui.md` | `ui` |
| 기능이나 흐름을 더하거나 동작을 바꾼다 | `docs/roles/feature.md` | `feature` |
| 표 · 함수 · 정책(마이그레이션) · pgTAP 을 고친다 | `docs/roles/db.md` | `db` |
| 풀이 글 · 프롬프트 · 문장 층 · 만세력 엔진을 고친다 | `docs/roles/reading.md` | `reading` |
| 배포 · 운영 DB 확인 · 크론 · 운영 절차를 밟는다 | `docs/roles/ops.md` | `ops` |
| 읽기만 하는 검토 · 감사 · 두 번째 의견 | `docs/roles/reviewer.md` | `reviewer` |
| 문서 · 대장 · 세션 기록을 맞춘다 | `docs/roles/docs.md` | `docs` |
| 사람과 말하며 위의 에이전트 여럿을 맡긴다 | `docs/roles/coordinator.md` | — (사람과 말하는 세션 자신) |

**일이 둘에 걸치면 둘 다 읽는다** — 기능이 새 표를 들이면 `feature` 와 `db`. 그래도 **한 에이전트는 한 충돌 영역을 끝까지
쥔다**(`docs/agents/delegation/parallel.md` 「나란히 맡길 때」). 에이전트 정의(`.claude/agents/`)는 역할 문서를 읽으라는 한 줄뿐이다 —
그 파일은 Claude Code 만 읽고, 다른 에이전트에게는 이 표가 전부다. 대화가 저장소 일로 넘어가도 이 표에서
연다 — 직접 할지 맡길지는 `docs/agents/delegation/coordinator.md` 「조율자 세션」.

## 원본 — 무엇이 무엇을 답하나

| 물음 | 원본 | 어긋나면 |
| --- | --- | --- |
| 제품이 지금 무엇을 하나 | `docs/prd.md` | PRD 가 맞다 — 다만 먼저 버그 · 문서 노후 · 결정 미반영 중 무엇인지 가른다 |
| 아직 없는 것 · 안 정한 것 · 보류 | `docs/product/gaps.md` | — |
| 언제 무엇이 바뀌었나 | `docs/product/prd-changelog.md` | — |
| 낱말 · 화면 문구 규칙 | `GLOSSARY.md` | — |
| 왜 이렇게 정했나 | `docs/adr/README.md`(영역마다 지금 유효한 ADR) → `docs/adr/` | 다시 열려면 그 근거가 왜 더는 안 서는지 적는다(`docs/agents/domain.md`) |
| 코드가 어디에 살고 무엇을 불러도 되나 | `docs/architecture.md` | `scripts/layers.test.ts` · `eslint.config.mjs` 가 맞다 |
| 코드를 어떻게 적나 | `CODING_STANDARDS.md` | `scripts/code-rules.test.ts` · 린트가 맞다 |
| 무엇을 돌리나 | `docs/agents/test-map.md` | `scripts/ci-plan.mjs` 가 맞다 |
| 이미 정한 화면 문구 | `docs/product/copy-ledger.md`(규칙 · 무리 색인) → `docs/product/copy-ledger/` 의 그 화면 무리 | 없으면 표로 묻는다 |
| 맡기는 법 · 권한 · 병렬 · PR 의 칸 | `docs/agents/delegation.md` | 권한 표는 `.claude/settings.json` 과 시험이 견준다 |
| 운영에서 무엇을 어떤 차례로 | `docs/ops/runbook.md` | — |
| 운영 주소 · 도메인 | `docs/ops/runbook/domain.md` 맨 위 | 주석 · 다른 문서는 주소를 적지 않고 여기를 가리킨다 — `scripts/code-rules.test.ts` 가 잰다 |
| 풀이 문장이 무엇까지 말하나 | `docs/text/` | — |
| 법무 · 변호사 검토 | `docs/legal/README.md` | — |
| 코드가 왜 이 모양이 됐나(사정) | `docs/notes/README.md` | 요구사항도 규칙도 아니다 — 코드가 맞다 |

`docs/product/prd-archive.md` 는 요구사항이 아니다. 코드 주석의 US 번호가 가리키는 곳으로만 남았다.

## 선순환 — 일이 문서로 돌아오는 길

1. **읽고 시작한다** — 역할 문서 → 그 문서의 「먼저 읽는 것」. 이슈 · 메모의 문장은 가설이라 먼저 잰다
2. **끝날 때 문서를 고친다** — 역할 문서의 넷째 칸을 PR 의 「문서」 칸에 옮겨 적는다(`docs/agents/delegation/done.md` 「끝났다는 것」)
3. **헤맨 자리는 보고에 한 줄** — 역할 문서에 없어서 찾아다닌 것, 가리킨 절이 틀렸던 것. 조율자가 라운드 끝에 `/retro` 로
   거둔다(`docs/roles/coordinator.md`, ADR 0146)
4. **사정은 노트에** — 라운드의 기록은 `docs/notes/` 에 날짜와 함께. 같은 라운드를 이어 가거나 코드가 이렇게 된 사정을
   추적할 때 관련 노트를 읽는다 — 노트는 요구사항도 규칙도 아니다
