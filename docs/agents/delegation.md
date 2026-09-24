# 위임 규약

이 문서는 **에이전트에게 일을 맡길 때 무엇이 오가는가** 하나만 답한다 — 어떤 이슈가 맡길 만한가,
무엇을 해도 되고 무엇은 사람에게 묻는가, 끝났다는 것이 무슨 뜻인가, 그리고 세션마다 새로 배우던
것이 어디에 적혀 있는가. 어디에 놓는가는 `docs/architecture.md`, 어떻게 적는가는
`docs/agents/code-rules.md`, 무엇을 돌리는가는 `docs/agents/test-map.md` 가 답한다.

여기 적힌 것은 **2026-09-22 에 잰 값**이다(ADR 0090). 그날까지 PR 마흔이 main 에
들었고 그중 스물다섯이 제목에 ADR 번호를 들었다. 권한을 잠그는 설정은 없었고(`.claude/` 없음, 이슈·PR 틀
없음), 세션 메모 63벌(약 500KB)이 저장소 밖에 있어 다른 에이전트가 못 봤다. 권한 등급의 표와
`.claude/settings.json` 이 같은 목록인지, 이슈 틀과 PR 틀의 칸이 이 문서에 있는지는
`scripts/code-rules.test.ts` 가 든다 — 어긋나면 **시험이 맞다.** 문서를 고친다.

## 시작하기 전에 — 붉은 main 이 먼저

**열린 `ci-main-red` 이슈가 있으면 새 작업보다 먼저 고친다**(#161, ADR 0097). 공개 출시 전에는 전체 검증이 머지
뒤 main 에서 비차단으로 돈다 — 그 결과를 들고 있는 것이 그 이슈 하나다. 붉은 main 위에 새 PR 을 쌓으면 어느 것이
깼는지 가를 수 없고, 나란히 선 세션이 다 같은 빨간불을 제 것으로 읽는다. `gh issue list --label ci-main-red` 로 본다.

## 맡길 이슈 — `ready-for-agent` 의 조건

`ready-for-agent` 딱지(`docs/agents/triage-labels.md`)는 **아래 칸이 다 채워진 이슈**에만 붙는다.
틀은 `.github/ISSUE_TEMPLATE/ready-for-agent.md` 이고 칸 이름은 이 표와 같다. 한 칸이라도 비면
`needs-info` 다.

| 칸 | 무엇을 적나 | 비면 무슨 일이 나나 |
| --- | --- | --- |
| **무엇이 참이 되는가** | 끝난 뒤에 참이 되는 문장 하나. 커밋 제목이 된다(`docs/agents/code-rules.md` 「커밋과 PR」) | 「고친다」만 있고 무엇이 달라지는지 없으면 에이전트가 범위를 정한다 |
| **어디를 건드리나** | 층과 파일(`docs/architecture.md` 의 층 이름으로). 안 건드릴 곳도 적는다 | 옆 층까지 손댄다 — 2026-09-22 에 타임아웃 열여덟이 그렇게 PR 에 실렸다 |
| **무엇을 돌리나** | `docs/agents/test-map.md` 「무엇을 고쳤으면」 표의 줄. 실호출·`db push` 가 들면 그것도 | 단위 시험만 보고 초록이라 믿는다 |
| **끝났다고 말할 조건** | 사람이 확인할 수 있는 문장. 간극 대장의 줄이면 그 `G-nn` 의 「끝났다고 말할 조건」 그대로 | 「다 했다」를 에이전트가 정한다 |
| **권한 등급** | 아래 표의 등급 중 이 일이 닿는 가장 높은 것. 3 이면 **어느 걸음**이 3 인지 | 등급 3 걸음을 묻지 않고 밟거나, 반대로 물을 필요 없는 것을 묻는다 |
| **결정이 필요한 자리** | 있으면 ADR 을 쓴다고 적고, 사람이 답할 것은 `G-nn` 이나 물음으로 | 결정을 코드 주석에 숨긴다 |
| **읽을 문서** | 그 층의 ADR 번호, 용어집 절, 관련 노트(`docs/notes/`) | 같은 결정을 다시 내린다 |
| **선행 이슈** | 이것보다 먼저 main 에 들어야 하는 이슈 번호. 없으면 「없음」 | 넓히기 전에 좁히기가 들거나, 앞 PR 의 파일 위에서 두 번 고친다 |
| **공유 자원 · 병렬** | 아래 「나란히 맡길 때」 표에서 이 일이 쥐는 것, 그리고 「병렬 가능」 · 「순차」 중 하나와 그 까닭 | 두 세션이 같은 자원을 쥐고 서로의 빨간불을 제 것으로 읽는다 |

## 나란히 맡길 때 — 공유 자원과 병렬의 조건

한 기계에서 세션 여럿이 이슈를 하나씩 들고 돌 때 부딪히는 것은 **소스가 아니라 소스 밖의 것**이다
(2026-09-23, #146). 이슈의 「공유 자원 · 병렬」 칸은 아래 이름으로 적는다.

| 공유 자원 | 무엇이 한 벌인가 | 나란히 돌리려면 |
| --- | --- | --- |
| **로컬 스택** | Supabase 컨테이너 · dev 서버 포트 · 흐름 검사 포트 | 워크트리마다 `npm run stack:slot -- --auto`(ADR 0096). 자리를 안 받은 두 워크트리는 **순차**다 |
| **원격 DB** | 운영 DB 하나 — `npm run db:push` · `npm run db:remote` | 격리가 없다. 잠금이 한 번에 하나로 세우지만, 마이그레이션이 드는 두 이슈는 **순차**다 — 번호 순서가 곧 적용 순서다 |
| **마이그레이션 사슬** | `supabase/migrations/` 의 시각 순서 · `src/lib/db/database.generated.ts` | 한 에이전트가 넓히기 → 앱 → 좁히기를 끝까지 쥔다(ADR 0071). 두 사슬은 **순차** |
| **중앙 문서** | `docs/product/gaps.md` · `docs/product/prd-changelog.md` · `docs/prd.md` · `docs/agents/delegation.md` · `CONTEXT.md` | 각 PR 은 **제가 바꾼 줄만** 고친다. 나란히 돌려도 되지만 **머지는 하나씩** — strict 가 뒤 PR 을 `BEHIND` 로 세운다. changelog 는 끝에 덧붙이므로 늘 같은 자리에서 부딪혀 `merge=union` 을 걸었다(`.gitattributes`). **union 은 끝에 덧붙이는 PR 에만 믿는다** — 이미 있는 기록을 고치는 두 PR 은 상반된 문장이 조용히 둘 다 남으므로 **순차**(#155) |
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

### 조율자 세션 — 사람 하나 · 백그라운드 에이전트 여럿 (2026-09-23~24 에 잼)

사람과 말하는 세션(조율자)은 **직접 고치지 않고 맡긴다.** 일은 `Agent` 도구로 `isolation: "worktree"` ·
`run_in_background: true` 에이전트에 하나씩 준다. 이틀 동안 이 방식으로 PR #193~#210 을 머지했다.

- **사람에게 묻는 곳은 조율자 하나다.** 에이전트에게는 「묻지 말고 끝까지 진행 · 머지하고 결정한 것은 보고만」을
  준다. 사람 판단이 드는 것(정책 · 문구 · 비용 · 되돌릴 수 없는 설정)은 에이전트가 **멈추지 않고 보고에 모으고**,
  조율자가 모아서 `AskUserQuestion` 한 번(질문 넷까지)으로 묻는다. 사람만 할 수 있는 것(계정 · AWS · 사업자
  정보 · 변호사)은 빈칸 · `[변호사 검토 필요]` 로 두고 나머지를 끝낸다.
- **브리프는 차가운 시작이다** — 에이전트는 이 대화를 모른다. 칸: 먼저 읽을 것(파일 경로) · 정해진 것(사람 결정을
  그대로) · 할 일 · **건드리지 않을 자리(지금 나란히 도는 세션과 그 파일)** · 워크트리(`stack:slot`) · 돌릴 시험 ·
  내보내기(PR → 필요하면 `db push` 와 remote 값 → 최신 main 위로 `--auto` 머지) · 보고 형식. 나란히 도는 세션이
  없다고 적었다가 나중에 하나 더 띄우면 앞 세션에 `SendMessage` 로 알린다.
- **PR 본문 등 임시 파일은 워크트리 안에 쓴다** — 스크래치 폴더를 두 에이전트가 같이 써서 서로 덮었다(#209).
  에이전트는 `.md` 보고 파일을 못 쓸 수 있다(하네스가 막는다) — 보고는 메시지로 받고 조율자가 저장한다.
- **병렬로 둘 것과 차례로 둘 것** 은 위 표를 따른다. 실제로 부딪힌 것: ADR 번호(머지 직전 main 의 빈 번호),
  pgTAP 파일 번호, 마이그레이션 타임스탬프(머지 직전 main 의 마지막 뒤), gaps 의 같은 줄(제 조각만 다시 얹기).
- **보고를 그대로 옮기지 않는다.** 에이전트 · 외부 리뷰의 주장은 조율자가 코드에서 확인한 뒤 사람에게 전하고,
  동의 · 이견을 한 줄로 말한다. 사람이 붙여 넣은 외부 리뷰도 같다.
- **Vercel 하루 배포 한도**(Hobby 100, 건너뛴 배포도 센다)에 병렬 PR 이 금방 닿는다. 에이전트는 Ready 를 기다리지
  않는다. 한도가 풀린 뒤 조율자가 runbook 「한도가 풀린 뒤」로 main HEAD = Production 과 smoke 를 확인하고 이슈에 적는다.
- 워크트리마다 운영 CLI 첫 호출에 키체인 창이 뜬다 — 아래 「로컬 환경의 함정」.
- **끝난 워크트리를 걷는다.** 머지된 에이전트의 워크트리가 남아 스택 자리를 쥐면 새 에이전트의 `stack:slot --auto` 가
  「빈 자리 없음」으로 거절한다(2026-09-24, 워크트리 16개가 자리 1~9 를 쥠). 새 라운드를 띄우기 전에 가지가 머지된 워크트리를
  `git worktree remove` 로 걷는다(사람에게 한 번 확인).

## 권한 등급 — 무엇을 해도 되고 무엇은 묻는가

등급은 **되돌릴 수 있는가**로 갈린다. 잠금 칸의 규칙은 `.claude/settings.json` 의 `ask`·`deny`
목록과 **같은 표**다 — 시험이 둘을 견준다. **그 설정 파일은 Claude Code 만 읽는다** — 다른 에이전트
(Codex 처럼 `AGENTS.md` 를 입구로 삼는 것)에게는 이 표가 전부다. `deny` 는 도구가 막고, `ask` 는
**어느 모드에서도 묻는다** — bypass 모드도 지나가지 않는다(2026-09-23 에 공식 문서로 확인).

**등급 3 의 잠금은 공식 운영에 들어간 뒤에 켠다(ADR 0093).** 지금은 운영 베타라 실제 사용자가 없고,
운영 DB 와 배포는 되돌려도 다치는 사람이 없다. 그래서 등급 3 의 잠금 칸은 비어 있고 에이전트는
`db push` · 실호출 · `gh pr merge` · 운영 SQL 을 묻지 않고 밟되 **밟고 나서 본 값을 적는다**(아래).
켤 목록은 「공식 운영에 들어가면 켜는 잠금」 절이 든다. **지금이 어느 단계인가는 `docs/prd.md` §7.0 표의
「(지금)」 한 곳**이고, 시험은 그 표시가 공개 출시가 아닌 동안 `ask` 가 빈 배열인지 잰다 — 문서의 이 표와
설정을 함께 바꿔도 붉어진다. 잠금을 켜는 것은 단계를 옮기는 사람의 일이지 할 일 목록의 한 줄이 아니다.

| 등급 | 무엇 | 예 | 잠금 |
| --- | --- | --- | --- |
| **0 읽는다** | 저장소·로컬 스택·CI 로그·이슈를 읽는다 | `git log` · `npm test` · `gh run view` · 로컬 DB 질의 | 없음 |
| **1 로컬에서 고친다** | 작업 가지에서 파일을 고치고 시험을 돌린다. 로컬 스택은 마음껏 되돌린다 | `npm run db:reset` · `npm run test:e2e:authed` | 없음 |
| **2 밖으로 낸다 — 되돌릴 수 있게** | 가지를 밀고 PR 을 열고 이슈에 적는다. 리뷰 뒤 `--auto` 머지를 건다(gate 가 초록이 될 때까지 기다린다, ADR 0082) | `git push -u origin <가지>` · `gh pr create` · `gh pr merge --auto --squash` | 없음 — 단 아래 등급 3 의 예외 |
| **3 사람이 답한 뒤에** | **main 머지는 곧 프로덕션 배포다.** 운영 DB 에 마이그레이션을 올리거나 임의 SQL 을 보내는 것, 토큰이 나가는 실호출, Vercel 변수, 원격 가지 삭제, 프로덕션 확인이 든 걸음 — **공식 운영에 들어간 뒤에 켠다(ADR 0093).** 운영 베타에서는 등급 2 처럼 밟고 값을 적는다 | `db push` · `db query --linked` · `READING_LIVE=1` · `vercel env` · `gh pr merge`(auto 아닌 즉시 머지) | 없음 — 공식 운영 전. 켤 목록은 아래 절 |
| **3 사람이 답한 뒤에 — 도구 밖** | 새 한글 문구는 표로 보이고 답을 기다린다(`docs/agents/code-rules.md`). 남이 띄운 dev 서버는 죽이기 전에 묻는다. 운영 SQL Editor 의 문장을 건네기만 하는 것은 공식 운영 뒤의 일이다(ADR 0093) — 지금은 `npm run db:remote -- --purpose "<목적>" "<sql>"` 로 직접 돌리고 값을 적는다. **단 운영 개인정보는 예외 없이 직접 조회하지 않는다**(아래, ADR 0105) — 질의를 써서 건네고 사람이 검토해 돈다 | 버튼 문구 · dev 서버 · 운영 개인정보 조회 | 사람 |
| **4 안 한다** | 되돌릴 수 없는 것. main 에 force push, `supabase config push`(원격의 구글 설정을 지운다), main 가지 삭제, Vercel 변수 삭제, 비밀 값을 커밋 | | `Bash(git push --force:*)` · `Bash(git push -f:*)` · `Bash(git push --force-with-lease:*)` · `Bash(npx supabase config push:*)` · `Bash(supabase config push:*)` · `Bash(./node_modules/.bin/supabase config push:*)` · `Bash(git push origin :main)` · `Bash(git push origin --delete main)` · `Bash(vercel env rm:*)` · `Bash(npx vercel env rm:*)` |

**운영 개인정보 — 에이전트는 예외 없이 직접 조회하지 않는다(2026-09-24, ADR 0105).** 운영 베타에서 등급 3 을 묻지 않고
밟는 것(ADR 0093)과 따로 선 경계이고, 공개 출시 전부터 지킨다. 이메일 · 닉네임과 계정의 짝 · 메시지 본문 · 출생정보 ·
풀이를 운영 DB 에서 읽는 SQL 을 에이전트가 보내지 않는다 — 필요하면 질의를 써 주고 사람이 검토해 break-glass 로 돈다
(`docs/ops/runbook.md` 「개인정보는 화면으로만」). 에이전트가 보내도 되는 원격 질의는 **개인을 가리키지 않는 것**뿐이다 —
건수 · 집계 · `migration list` · 크론 · advisor · 설정 한 칸. 그것도 `npm run db:remote -- --purpose "<목적>" "<sql>"` 로만
보낸다 — 목적과 SQL 해시가 접속기록에 `(agent)` 로 남는다. `.claude/settings.json` 은 SQL 의 내용을 못 가르므로 이 경계는
도구가 아니라 이 문장이 든다.

**`gh pr merge --auto` 는 등급 2 다** — gate 가 필수 검사라 초록까지 기다린다(2026-09-22 부터,
ADR 0082). 보호 규칙이 strict 라(2026-09-23) 가지가 최신 main 위에 있어야 든다 — 여러 세션이 나란히
머지해도 main 에 드는 상태는 그 main 위에서 gate 를 지난 것이다.
`--auto` 없는 즉시 머지가 등급 3 인 까닭은 그것이 검사 전 배포이기 때문이다(2026-09-20
에 한 번 그랬다). 잠금이 `gh pr merge` 전체를 묻는 것은 규칙이 인자를 못 가르기 때문이고, 물으면
「`--auto` 다」로 답이 된다.

**예외 — 마이그레이션이 든 PR 은 `--auto` 도 등급 3 이다.** `supabase/migrations/**` 가 바뀐 PR 에
`--auto` 를 걸면 gate 초록 즉시 앱이 나가고 DB 는 그대로라, runbook 의 「마이그레이션이 먼저, 앱이
나중」이 뒤집힌다(`docs/ops/runbook.md` 「배포」 규약 넷). 그런 PR 은 `db push` 와 확인이 끝난 뒤에만
머지를 건다 — 운영 베타에서는 에이전트가 그 걸음을 직접 밟고 값을 적으며, 공식 운영 뒤에는 사람이
끝냈다고 답한 뒤다(ADR 0093). 순서 자체는 언제나 지킨다. 앱이 새 함수를 부르는 변경이면 **넓히는 마이그레이션 PR 과 앱 PR 로 나눈다** —
앞 PR 은 옛 앱에 안전하니 먼저 들고 `db push` 를 지나며, 뒤 PR 이 그 뒤에 든다(ADR 0071 의 A 단계가
그 모양이다). 이 예외는 시험이 안 잰다 — `ci-plan.mjs` 가 그 경로를 아니까 잠글 자리는 있다.

**등급 3 을 밟고 나면 무엇을 봤는지 값으로 적는다.** `db push` 뒤에는 `migration list` 의 remote
칸과 PostgREST 캐시(`docs/ops/runbook.md` 「배포」), 실호출 뒤에는 저장된 판본과 검사 결과,
머지 뒤에는 Vercel 의 Ready.

**잠그지 않은 것 — 2026-09-23 에 잰 값.** 규칙이 서 있다고 도구가 지키는 것이 아니다. 두 가지를 밟았다.
① **사용자의 `allow` 가 프로젝트의 `ask` 를 이겼다.** `.claude/settings.local.json` 에 확인 창의 「항상 허용」으로
쌓인 `Bash(gh pr *)` · `Bash(npx supabase *)` · `Bash(git push *)` 가 있는 동안 `ask` 21개가 켜져 있어도
`gh pr merge` 는 묻지 않았고, 그 세 줄을 지우자 물었다. ② `deny` 는 `cd x && git push --force-with-lease` 를
막지 않았다(같은 날, 작업 가지). 그러니 잠금을 켤 때는 `ask` 만 되돌리지 말고 `settings.local.json` 의 넓은
`allow` 를 함께 걷고, 켠 뒤 `gh pr merge --help` 같은 해 없는 명령으로 창이 뜨는지 재 본다. 가지를 main
위로 옮길 때는 rebase 대신 main 을 merge 해 force push 가 필요 없게 한다. 이 표는 도구가 지키는 담이
아니라 **에이전트가 읽는 규약**이고, 설정은 그 규약을 도구가 아는 데까지 옮긴 것이다.

### 공식 운영에 들어가면 켜는 잠금 (ADR 0093)

**사람이 `docs/prd.md` §7.0 의 「(지금)」을 공개 출시로 옮기는 날의 걸음이다.** 그 전에는 아무도 이 절을
밟지 않는다 — 간극 대장에 줄이 없는 까닭이다(2026-09-23, #142). 단계를 옮기면 시험이 붉어지고, 아래를
다 하면 다시 초록이 된다.

1. 아래 목록을 `.claude/settings.json` 의 `ask` 에 그대로 옮기고 등급 3 의 잠금 칸에 옮겨 적는다
2. `.claude/settings.local.json` 의 넓은 `allow`(`Bash(gh pr *)` · `Bash(npx supabase *)` · `Bash(git push *)`
   같은 것)를 걷는다 — 그것이 `ask` 를 이긴다(「잠그지 않은 것」)
3. `gh pr merge --help` 처럼 해 없는 명령으로 창이 뜨는지 잰다

시험은 이 목록이 열 개를 넘고 `deny` 와 겹치지 않는지, 공개 출시 전에는 `ask` 가 비어 있는지, 공개
출시 뒤에는 `ask` 가 이 목록과 같은지 잰다.

- `Bash(npx supabase db push:*)`
- `Bash(supabase db push:*)`
- `Bash(./node_modules/.bin/supabase db push:*)`
- `Bash(npx supabase db query --linked:*)`
- `Bash(supabase db query --linked:*)`
- `Bash(./node_modules/.bin/supabase db query --linked:*)`
- `Bash(npm run db:push:*)`
- `Bash(npm run db:remote:*)`
- `Bash(READING_LIVE=1:*)`
- `Bash(READING_PAIR_LIVE=1:*)`
- `Bash(READING_MATCH_INPUT_LIVE=1:*)`
- `Bash(BACKFILL_CHART=1:*)`
- `Bash(BACKFILL_READING_CHART=1:*)`
- `Bash(vercel env:*)`
- `Bash(npx vercel env:*)`
- `Bash(vercel --prod:*)`
- `Bash(npx vercel --prod:*)`
- `Bash(vercel deploy:*)`
- `Bash(npx vercel deploy:*)`
- `Bash(gh pr merge:*)`
- `Bash(git push origin --delete:*)`
- `Bash(git push --delete:*)`
- `Bash(git branch -D:*)`

도구 밖에서는 운영 SQL Editor 에서 돌릴 문장을 건네기만 한다(가입 코드 INSERT · 상한 올리기).

## 끝났다는 것 — PR 이 드는 칸

PR 틀(`.github/pull_request_template.md`)의 칸이다. 칸 이름은 이 표와 같고, **안 한 것은 안 했다고
적는다** — 「안 돌린 것을 통과로 적지 않는다」(ADR 0079).

| 칸 | 무엇을 적나 | 왜 |
| --- | --- | --- |
| **무엇이 참이 되는가** | 이슈의 첫 칸 그대로. 재어 보니 달랐으면 **잰 값으로 다시 쓴 문장** | 이슈 문장은 가설이다 |
| **잰 값** | 고치기 전에 잰 수와 그 방법. 후보 문장과 어디가 달랐나 | 값 없이 「정리했다」는 다음 사람이 다시 잰다 |
| **돌린 것** | `docs/agents/test-map.md` 의 명령과 결과(수까지) — 공개 출시 전의 최소는 단위 · 타입 · 린트와 예외 넷이다. 화면·라우트면 e2e, 프롬프트 본문이면 실호출, 마이그레이션이면 `db:types` diff. **안 돌린 것과 그 까닭** | 단위 시험은 화면이 사라진 것을 모른다 |
| **잠금이면 일부러 어긴 것** | 린트·시험·pgTAP 을 새로 세웠으면 **옛 상태를 되살리거나 일부러 어긴 파일**로 빨개지는 것을 본 기록. 같은 뜻의 다른 표기(별칭/상대경로, 정적/동적, `.ts`/`.jsx`)까지 | 「규칙을 넣었다」와 「규칙이 건다」는 다른 문장이다(ADR 0085·0086) |
| **문서** | 결정이 있으면 ADR(같은 PR). 낱말이 생기면 `CONTEXT.md`, 모양이 바뀌면 `docs/prd.md` 와 changelog, 틈이 생기거나 닫히면 `docs/product/gaps.md`, 돌리는 것이 바뀌면 `docs/agents/test-map.md` | 문서와 코드가 어긋나면 시험이 있는 쪽만 산다 |
| **사람이 할 걸음** | 등급 3 — `db push` · 실호출 · 문구 확인 · 운영 SQL. **앱 배포 ≠ DB 마이그레이션**(`docs/ops/runbook.md` 「배포」) | 머지가 곧 배포인데 DB 는 따로 간다 |

**커밋과 PR 제목**은 `type(scope): 한국어 문장 (ADR NNNN)` 이다(`docs/agents/code-rules.md`).
squash 본문은 PR 본문이 아니라 **커밋 메시지들을 이어 붙인 것**이라(저장소 설정
`COMMIT_MESSAGES`) 커밋을 하나로 두거나 머지 화면에서 다듬는다. 원격 가지는 자동으로 안
지워진다(`delete_branch_on_merge: false`) — 머지 뒤 `git fetch --prune` 과 함께 손으로 정리한다.

## 일하는 법 — 세션마다 다시 배우던 것

세션 메모에서 옮겼다. 규칙이 아니라 **한 번씩 틀리고 나서 적은 것**이고, 까닭이 있는 것은 까닭을
남겼다.

**재는 법**

- **먼저 재고, 잰 값으로 문장을 다시 쓴다.** 이슈·메모·주석의 문장은 가설이다. `git ls-files` 의
  글롭 수 같은 아티팩트를 근거로 쓰지 않는다 — 시험 수는 stash 로 A/B 해서 잰다.
- **잰 것보다 세게 말하지 않는다.** 「전부 초록」은 워크플로 둘을 다 본 뒤에, 「프로덕션 확인」은
  무엇을 어느 열쇠로 봤는지와 함께. 못 잰 것은 「익명까지 쟀고 나머지는 이 SQL 을 돌려 달라」로
  끝낸다.
- **부재로 통과하는 검사는 안 잰 것이다.** 초록인데 안 이상하면 한 번 지워 보고 깨지는지 본다.
  잠금은 옛 상태를 되살려 증명하고, 「틀린 것을 맞다고 보는 경우」까지 두 방향을 밟는다.
- **소스 글자를 세는 잠금은 글자가 바뀌면 조용히 0 이 된다** — 무늬가 아니라 읽기 자체를 센다.
- **「환경 문제」로 넘기기 전에 원인까지 간다.** 안 밟았다고 적는 것은 정직하지만 그것으로 끝내면
  그 자리는 영영 안 밟힌다.
- **값을 적는 자리는 하나다.** 도구·씨앗·검사가 화면의 값을 다시 적으면 그 도구가 거짓말을 찍는다 —
  읽는 쪽이 진짜 자리에 묻게 한다. 문서에 수를 안 적고 실행이 찍게 한다.
- **죽은 코드는 셋으로 가른다** — 시험에서만 쓰는 것(손대지 않는다, 이 저장소는 내부를 일부러
  시험한다) · `export` 만 떼면 되는 것 · 아무 데서도 안 쓰는 것(하나씩 까닭을 본다).
- **기능을 걷기 전에 「시험이 그걸 도구로 쓰나」를 본다.** 「다시 보지 않기」 표가 시험 격리 기반
  시설이었다(ADR 0077).

**사용자와**

- **대화는 존댓말**(`~요` · `~입니다`). 커밋 메시지와 코드 주석은 저장소 관례대로 평서형이다.
- **새 지시가 방금 한 일과 부딪혀 보이면 둘 다 참인 구성을 먼저 찾는다.** 양자택일로 물으면 사용자가
  원한 적 없는 폐기를 고르게 된다. 되돌리기는 마지막 수단이고 선택지의 기본값이 아니다.
- **보고와 심문은 다르다.** 충돌은 한 줄로 적고 끝낸다. 선택지를 셋씩 만들어 묻지 않는다. 지시가
  분명하면 그대로 하고, 걱정되는 자리는 바꾼 화면을 찍어 보인다.
- **한글 문구는 표로 보이고 답을 기다린다.** 사용자가 문안을 불러 주면 줄바꿈까지 그대로 쓴다.
  문구만 바뀐 라운드는 시험을 안 돌린다 — 다만 e2e 가 그 문자열을 붙들고 있으면 스펙은 같이 고친다.
  **예외(2026-09-24, ADR 0103)** — `/ops/**` 에서 운영자에게만 보이는 설명 · 제목 · 빈 상태 문구는 사전 표 승인을
  생략하고 PR 에 변경 문구를 표로 모아 보고한다. 개인정보의 이용 · 보관, 운영자의 권한, 제재 결과, 사용자에게 전달되는
  문구는 이 예외에 들지 않는다.
- **main 의 낯선 커밋은 사용자가 민 것이다.** 묻지 않고 그 위에서 이어 간다. 내 작업과 부딪힐 때만
  사실로 보고한다.
- **「올리라」는 판단을 사용자가 진다는 뜻이지 확인을 건너뛰라는 뜻이 아니다.** 프롬프트를 고쳤으면
  올리기 전에 한 번 부른다 — 2026-09-07 에 그 한 번을 건너뛰어 사고가 둘 났다.
- **프롬프트에 규칙을 쌓지 않는다.** 금지 목록이 길면 글이 점검표가 된다 — 지시가 결론의 모양을
  시키게 하고 본보기 한 토막을 준다. 「후보·시험값·자료상」처럼 제품이 덜 됐다고 스스로 말하는 말투는
  세기(「~일 것 같아요」)로 녹인다.

**저장소와**

- **다른 에이전트나 사용자가 같은 폴더에 있을 수 있다 — 작업 가지는 worktree 로 연다.** 2026-09-22
  에 HEAD 가 남의 가지 위에 있어 PR 에 남의 커밋이 섞였다.
- **워크트리는 소스만 가른다 — 스택 자리를 따로 받는다(ADR 0096).** 이름과 포트가 같으면 한 워크트리의
  `db:reset` 이 다른 워크트리의 데이터를 지우고 e2e 는 남의 dev 서버를 잰다. 여는 순서는 넷이다:

  ```bash
  git worktree add ../saju-<일> -b <가지> origin/main
  cp -Rc node_modules ../saju-<일>/        # 복제다(APFS). 심볼릭 링크는 Turbopack 이 거절한다
  cd ../saju-<일> && npm run stack:slot -- --auto   # 빈 번호를 받는다. 쥔 번호를 달라면 거절한다
  npm run db:start
  ```

  받은 번호는 이슈의 「공유 자원 · 병렬」 칸에 적는다(`로컬 스택: 자리 3`). 끝나면 `npm run db:stop`.
  main 체크아웃은 자리 0(기본값)이다.
- **원격 DB 에 닿는 명령은 `npm run db:push` · `npm run db:remote -- --purpose "<목적>" "<sql>"` 로 부른다.** 목적 없이는
  `db:remote` 가 안 돌고, 목적과 SQL 의 sha256 이 운영 접속기록에 남는다(ADR 0105). 운영 DB 는
  하나라 격리할 수 없다 — 둘 다 기계 전체의 잠금 하나를 잡고 돌며, 다른 세션이 쥐고 있으면 누가 무엇을
  하는지 찍고 기다린다(ADR 0096). `npx supabase db push` 를 직접 부르면 잠금을 지나친다. **남은 잠금은
  스스로 걷지 않는다** — 쥐었던 쪽이 없으면 멈춰서 걷는 법을 말한다. 걷기 전에 `migration list` 의 remote 칸을 본다.
- **담기 전에 `git diff` 를 본다.** 한 파일 안에 사용자의 배선이 섞여 있을 수 있고, 로컬
  타입체크는 디스크를 보지 git 을 안 본다 — 추적 안 된 모듈을 부르는 커밋이 CI 에서만 깨진다.
  커밋 뒤 `git status` 의 `??` 를 흘려보지 않는다.
- **PRD 절 번호를 코드 주석에 들지 않는다.** 절은 옮겨진다 — changelog 의 날짜나 `G-nn` 을 든다
  (ADR 0089).
- **마이그레이션을 쓴 그 순간부터 이 기계의 dev 화면은 깨져 있다** — dev 서버가 운영 DB 를 보기
  때문이다. 배포 순서는 `docs/ops/runbook.md` 「배포」.

## 로컬 환경의 함정

세션마다 같은 자리에서 시간을 잃었다. 접속값과 운영 절차는 `docs/ops/runbook.md`, 시험 명령은
`docs/agents/test-map.md` 가 든다. 여기는 그 둘에 없는 것만이다.

| 증상 | 원인 | 하는 일 |
| --- | --- | --- |
| 모든 주소가 500 이고 `globals.css` 파싱 오류가 뜬다 | `.next` 의 Turbopack CSS 캐시가 깨졌다. **원본은 멀쩡하다** | `lsof -ti tcp:3000 \| xargs kill -9 ; rm -rf .next ; npm run dev`. 다른 dist(`.next-check`)도 같다 |
| `Another next dev server is already running` | Next 16 은 한 디렉터리에 dev 서버 하나다 — 포트를 옮겨도 안 된다 | 3000 을 끄거나(사람이 쓰는 중이면 묻는다) `PLAYWRIGHT_PORT=3100 NEXT_DIST_DIR=.next-check` 로 `next start` 를 쓴다 |
| 로그인 e2e 74건이 전부 로그인 화면을 받는다 | 3000 의 dev 서버를 재사용해 운영 DB 를 봤다 | 위와 같다. CI 는 `CI=true` 라 이 함정이 없다 |
| 픽스처가 `Something went wrong` 으로 죽는다 | 로컬 스택의 하루 풀이 한도 100 이 찼다. 도구가 제 줄을 어제로 밀지만 다른 표식의 줄은 안 민다 | `docker logs supabase_db_<SAJU_STACK_ID> --tail 30 \| grep -i error` 로 확인(main 은 `saju`, 워크트리는 `saju_wtN`), `npm run db:reset` |
| pgTAP 이 e2e 뒤에 붉다 | 표를 전역으로 세는 자리가 남은 계정에 걸린다 | `npm run db:reset` 뒤 다시. 새로 쓰는 시험은 자기가 만든 행만 센다 |
| `supabase: command not found` | PATH 에 없다 | `npx supabase` 나 `./node_modules/.bin/supabase` |
| `db query` 가 `cannot insert multiple commands` | prepared statement 라 `begin; … rollback;` 을 못 받는다 | 트랜잭션이 필요하면 `docker exec -i supabase_db_<SAJU_STACK_ID> psql -U postgres -d postgres` |
| `db diff --linked` 가 비밀번호를 묻는다 | 다른 인증 경로다(`db query --linked` 는 된다) | 양쪽에 같은 질의를 돌려 손으로 견준다 |
| `timeout` 이 없다 | macOS | coreutils 의 `gtimeout` |
| `db query --linked` 를 여럿이 동시에 부르면 `Initialising login role...` 뒤에 실패한다 | CLI 가 부를 때마다 로그인 역할을 세운다 — 나란히 부르면 서로 부딪힌다 | `npm run db:remote -- --purpose "<목적>" "<sql>"` 로 부른다 — 기계 전체에서 한 번에 하나만 돌고 나머지는 기다린다(ADR 0096). 부를 때마다 로그인 역할을 두 번 세운다(기록 한 번 · SQL 한 번) |
| 워크트리에서 운영에 닿는 CLI(`db push` · `db:remote` · advisor)를 처음 부를 때 macOS 가 「supabase 가 키체인의 `Supabase CLI` 를 쓰려 한다」고 묻는다 | CLI 토큰은 로그인 키체인에 있고, CLI 바이너리가 임시 서명(`adhoc`)이라 키체인은 **경로**로 허락을 기억한다. 워크트리마다 `node_modules/@supabase/cli-darwin-arm64/bin/supabase` 가 새 경로다(내용은 같다, 2026-09-24) | 사람이 경로가 이 저장소의 `.claude/worktrees/…/supabase` 인지 보고 「항상 허용」. 거부하면 그 세션의 원격 걸음이 실패한다. 워크트리를 새로 세우면 다시 묻는다 |
| 프로덕션 확인에 계정이 필요하다 | 기존 계정은 실제 사용자다 | `.env.development.local` 의 `SUPABASE_SECRET_KEY` 로 `auth.admin.createUser({ email_confirm: true })` — 주소는 `@example.com`, 전용 코드로 `complete_signup` 을 지난다. 끝나면 `forget_user` 로 지우고 코드도 지운다(2026-09-23 #115 · #121) |
| `gh pr merge --auto` 가 `BLOCKED` 로 선다 | gate 가 아직 안 끝났다 — 실패가 아니다 | `gh pr checks <n>` 으로 갈라 본다. `UNSTABLE` 도 도는 중일 수 있다 |
| `gh pr view <n> --json mergeStateStatus` 가 `BEHIND` 이고 `--auto` 가 안 든다 | 보호 규칙이 strict 다 — 가지가 최신 main 을 품어야 든다(2026-09-23, #143). auto-merge 는 가지를 스스로 올리지 않는다 | `gh pr update-branch <n>` — main 을 merge 하므로 force push 가 없다. gate 가 다시 돌고 초록이면 든다 |
| `.env.development.local` 의 값이 `"[SENSITIVE]"` 다 | Vercel 이 Secret 은 안 내려 준다. 그대로 두면 「있는」 값으로 세어져 401 로 떨어진다 | 주석 처리해 두면 오류가 이름을 대 준다. 실호출은 `OPENAI_API_KEY` 한 줄을 손으로 붙인다 |
| 실호출 첫 콜이 `Incorrect API key` | `.env.development.local` 값이 `"…"` 로 감싸여 있다 | `loadLocalEnv` 가 벗긴다 — 새 읽는 자리를 만들면 같은 것을 한다 |
| Production 배포가 전부 `Error` 인데 typecheck · lint · 단위 · e2e 는 초록이다 | `next build` 만 잡는 것이 있다 — 예: `app/**/icon.tsx` 는 Next 가 파비콘 메타데이터 라우트로 읽어 기본 내보내기가 없으면 「Export default doesn't exist」로 선다(2026-09-24, 두 시간 동안 배포가 멈췄다). 파일 이름 `icon` · `apple-icon` · `opengraph-image` · `sitemap` · `robots` · `manifest` 는 `app/` 아래 어디서나 특별하다 | 화면을 바꾼 병합 뒤에 `npm run build` 를 한 번 돈다. 공용 아이콘은 `app/ui/icons.tsx` 다. 배포 상태는 `vercel ls --prod` |

## 세션 기록 — `docs/notes/`

세션 메모리에만 있던 것은 2026-09-22 에 저장소로 옮겼다. 규약이 된 것은 이 문서에, 절차가 된
것은 `docs/ops/runbook.md` 에, 결정이 된 것은 ADR 에 있고, **그 밖의 판단 기록 열다섯**은
`docs/notes/` 에 그날의 사정째로 있다(차례는 `docs/notes/README.md`). 노트는 요구사항도 규칙도
아니다 — 코드가 왜 이 모양인지 되짚을 때 연다. **새 기억은 저장소에 적는다** — 규약이면 여기,
틈이면 `docs/product/gaps.md`, 사정이면 노트에 날짜와 함께.
