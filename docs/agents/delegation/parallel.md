# 위임 규약 — 나란히 맡길 때

색인은 `docs/agents/delegation.md` 다.

## 나란히 맡길 때 — 공유 자원과 병렬의 조건

한 기계에서 세션 여럿이 이슈를 하나씩 들고 돌 때 부딪히는 것은 **소스가 아니라 소스 밖의 것**이다
(2026-09-23, #146). 이슈의 「공유 자원 · 병렬」 칸은 아래 이름으로 적는다.

| 공유 자원 | 무엇이 한 벌인가 | 나란히 돌리려면 |
| --- | --- | --- |
| **로컬 스택** | Supabase 컨테이너 · dev 서버 포트 · 흐름 검사 포트 | 워크트리마다 `npm run stack:slot -- --auto`(ADR 0096). 자리를 안 받은 두 워크트리는 **순차**다 |
| **원격 DB** | 운영 DB 하나 — `npm run db:push` · `npm run db:remote` | 격리가 없다. 잠금이 한 번에 하나로 세우지만, 마이그레이션이 드는 두 이슈는 **순차**다 — 번호 순서가 곧 적용 순서다 |
| **마이그레이션 사슬** | `supabase/migrations/` 의 시각 순서 · `src/lib/db/database.generated.ts` | 한 에이전트가 넓히기 → 앱 → 좁히기를 끝까지 쥔다(ADR 0071). 두 사슬은 **순차** |
| **중앙 문서** | `docs/product/gaps.md` · `docs/product/prd-changelog.md` · `docs/prd.md` · `docs/product/prd/` · `docs/agents/delegation.md` · `docs/agents/delegation/` · `GLOSSARY.md` · `docs/context/` | 각 PR 은 **제가 바꾼 줄만** 고친다. 나란히 돌려도 되지만 **머지는 하나씩** — strict 가 뒤 PR 을 `BEHIND` 로 세운다. changelog 는 끝에 덧붙이므로 늘 같은 자리에서 부딪혀 `merge=union` 을 걸었다(`.gitattributes`). **union 은 끝에 덧붙이는 PR 에만 믿는다** — 이미 있는 기록을 고치는 두 PR 은 상반된 문장이 조용히 둘 다 남으므로 **순차**(#155) |
| **잠금 시험** | `scripts/code-rules.test.ts` · `scripts/layers.test.ts` · `eslint.config.mjs` | 같은 파일을 두 PR 이 고치면 **순차** |
| **CI** | `.github/workflows/verify.yml` · `scripts/ci-plan.mjs` | **순차** |
| **e2e 기반** | `e2e/session.ts` · `playwright.config.ts` | 한 에이전트가 쥔다. spec 파일은 나눠도 된다 |

**「병렬 가능」은 셋이 다 참일 때만이다** — 공유 자원 칸의 파일이 서로 안 겹친다, 원격 DB 걸음이 없거나
하나뿐이다, DB · e2e 가 들면 워크트리마다 자리를 받는다. 하나라도 거짓이면 「순차」로 적고 선행 이슈를 단다.

**한 에이전트는 하나의 충돌 영역을 끝까지 쥔다.** 「이슈 1~10 은 A, 11~20 은 B」처럼 번호로 가르지 않는다 —
번호는 공유 자원을 모른다. 영역(마이그레이션 사슬 하나, CI, e2e 기반)으로 가르고, 영역 안의 이슈는 차례로 한다.
**조율자는 머지 순서와 충돌 해결만 쥔다.** 중앙 문서를 대신 고치지 않는다 — 코드 PR 과 그 뜻이 갈라진다.
`BEHIND` 는 `gh pr update-branch <n>` 으로, 충돌이면 가지에서 `git merge origin/main` 으로 푼다(`union` 은
로컬 병합에서만 걸린다).

**간극 대장을 줄마다 파일로 가르지 않는다(2026-09-23 에 잼).** 대장은 표의 줄이라 서로 다른 G 를 고친 두 PR 은
git 이 줄 단위로 합친다 — 부딪히는 것은 끝에 덧붙이는 changelog 였고, 그것은 `union` 이 푼다. 가르면
`code-rules.test.ts` 의 § 검사와 상태 검사를 파일 여럿에 옮겨야 한다.

**후보 문장을 믿지 말고 먼저 잰다.** 구조 후보 라운드에서 **연속 다섯 건**의 이슈 문장이 반쯤
틀렸다(#88 — 원인이 아예 다르거나, 수는 맞는데 가리키는 곳이 틀리거나, 다섯 주장 중 하나만 맞거나).
이슈가 적은 원인은 가설이다. 작업의 첫 걸음은 그 문장을 재어서 다시 쓰는 것이고, 잰 값은 PR
본문과 ADR 에 남긴다.
