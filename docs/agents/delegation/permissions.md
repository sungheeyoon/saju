# 위임 규약 — 권한 등급

색인은 `docs/agents/delegation.md` 다.

## 권한 등급 — 무엇을 해도 되고 무엇은 묻는가

등급은 **되돌릴 수 있는가**로 갈린다. 잠금 칸의 규칙은 `.claude/settings.json` 의 `ask`·`deny`
목록과 **같은 표**다 — 시험이 둘을 견준다. **그 설정 파일은 Claude Code 만 읽는다** — 다른 에이전트
(Codex 처럼 `AGENTS.md` 를 입구로 삼는 것)에게는 이 표가 전부다. `deny` 는 도구가 막고, `ask` 는
**어느 모드에서도 묻는다** — bypass 모드도 지나가지 않는다(2026-09-23 에 공식 문서로 확인).

**등급 3 의 잠금은 공식 운영에 들어간 뒤에 켠다(ADR 0093).** 지금은 운영 베타라 실제 사용자가 없고,
운영 DB 와 배포는 되돌려도 다치는 사람이 없다. 그래서 등급 3 의 잠금 칸은 비어 있고 에이전트는
`db push` · `gh pr merge` · 운영 SQL 을 묻지 않고 밟되 **밟고 나서 본 값을 적는다**(아래). 실호출은 운영 베타에서도
에이전트가 밟지 않고 운영자가 직접 돌린다 — `docs/agents/delegation/unattended.md` 「권한 봉투」의 기본값.
켤 목록은 「공식 운영에 들어가면 켜는 잠금」 절이 든다. **지금이 어느 단계인가는 `docs/product/prd/roadmap.md` §7.0 표의
「(지금)」 한 곳**이고, 시험은 그 표시가 공개 출시가 아닌 동안 `ask` 가 빈 배열인지 잰다 — 문서의 이 표와
설정을 함께 바꿔도 붉어진다. 잠금을 켜는 것은 단계를 옮기는 사람의 일이지 할 일 목록의 한 줄이 아니다.

| 등급 | 무엇 | 예 | 잠금 |
| --- | --- | --- | --- |
| **0 읽는다** | 저장소·로컬 스택·CI 로그·이슈를 읽는다 | `git log` · `npm test` · `gh run view` · 로컬 DB 질의 | 없음 |
| **1 로컬에서 고친다** | 작업 가지에서 파일을 고치고 시험을 돌린다. 로컬 스택은 마음껏 되돌린다 | `npm run db:reset` · `npm run test:e2e:authed` | 없음 |
| **2 밖으로 낸다 — 되돌릴 수 있게** | 가지를 밀고 PR 을 열고 이슈에 적는다. 리뷰 뒤 `--auto` 머지를 건다(gate 가 초록이 될 때까지 기다린다, ADR 0082). main 에 직접 미는 길은 없다 — 관리자까지 PR 로만 든다(ADR 0121) | `git push -u origin <가지>` · `gh pr create` · `gh pr merge --auto --squash` | 없음 — 단 아래 등급 3 의 예외 |
| **3 사람이 답한 뒤에 — 운영 배포** | **프로덕션 배포**(`vercel deploy --prod` · 대시보드의 Create Deployment — 머지는 배포가 아니다, ADR 0110). **운영 베타에서도 사람이 답한 뒤다** — 라운드 끝의 묶음 배포 한 번을 조율자가 밟는다(`docs/agents/delegation/coordinator.md` 「머지는 배포가 아니다」, `docs/ops/runbook/deploy.md` 「묶음 배포」) | `vercel deploy --prod` · Create Deployment | 사람 — 도구 잠금은 공식 운영 전이라 없다. 켤 목록은 아래 절 |
| **3 사람이 답한 뒤에** | 운영 DB 에 마이그레이션을 올리거나 임의 SQL 을 보내는 것, 토큰이 나가는 실호출, Vercel 변수, 원격 가지 삭제, 프로덕션 확인이 든 걸음 — **공식 운영에 들어간 뒤에 켠다(ADR 0093).** 운영 베타에서는 등급 2 처럼 밟고 값을 적는다 — 실호출만은 빼고 운영자가 직접 돌린다(`docs/agents/delegation/unattended.md` 「권한 봉투」) | `db push` · `db query --linked` · `READING_LIVE=1` · `vercel env` · `gh pr merge`(auto 아닌 즉시 머지) | 없음 — 공식 운영 전. 켤 목록은 아래 절 |
| **3 사람이 답한 뒤에 — 도구 밖** | 새 한글 문구는 표로 보이고 답을 기다린다(`docs/agents/code-rules.md`). 남이 띄운 dev 서버는 죽이기 전에 묻는다. 운영 SQL Editor 의 문장을 건네기만 하는 것은 공식 운영 뒤의 일이다(ADR 0093) — 지금은 `npm run db:remote -- --purpose "<목적>" "<sql>"` 로 직접 돌리고 값을 적는다. **단 운영 개인정보는 예외 없이 직접 조회하지 않는다**(아래, ADR 0105) — 질의를 써서 건네고 사람이 검토해 돈다 | 버튼 문구 · dev 서버 · 운영 개인정보 조회 | 사람 |
| **4 안 한다** | 되돌릴 수 없는 것. main 에 force push, `supabase config push`(원격의 구글 설정을 지운다), main 가지 삭제, Vercel 변수 삭제, 비밀 값을 커밋 | | `Bash(git push --force:*)` · `Bash(git push -f:*)` · `Bash(git push --force-with-lease:*)` · `Bash(npx supabase config push:*)` · `Bash(supabase config push:*)` · `Bash(./node_modules/.bin/supabase config push:*)` · `Bash(git push origin :main)` · `Bash(git push origin --delete main)` · `Bash(vercel env rm:*)` · `Bash(npx vercel env rm:*)` |

**운영 개인정보 — 에이전트는 예외 없이 직접 조회하지 않는다(2026-09-24, ADR 0105).** 운영 베타에서 등급 3 을 묻지 않고
밟는 것(ADR 0093)과 따로 선 경계이고, 공개 출시 전부터 지킨다. 이메일 · 닉네임과 계정의 짝 · 메시지 본문 · 출생정보 ·
풀이를 운영 DB 에서 읽는 SQL 을 에이전트가 보내지 않는다 — 필요하면 질의를 써 주고 사람이 검토해 break-glass 로 돈다
(`docs/ops/runbook/access.md` 「개인정보는 화면으로만」). 에이전트가 보내도 되는 원격 질의는 **개인을 가리키지 않는 것**뿐이다 —
건수 · 집계 · `migration list` · 크론 · advisor · 설정 한 칸. 그것도 `npm run db:remote -- --purpose "<목적>" "<sql>"` 로만
보낸다 — 목적과 SQL 해시가 접속기록에 `(agent)` 로 남는다. `.claude/settings.json` 은 SQL 의 내용을 못 가르므로 이 경계는
도구가 아니라 이 문장이 든다.

**`gh pr merge --auto` 는 등급 2 다** — gate 가 필수 검사라 초록까지 기다린다(2026-09-22 부터,
ADR 0082). 보호 규칙이 strict 라(2026-09-23) 가지가 최신 main 위에 있어야 든다 — 여러 세션이 나란히
머지해도 main 에 드는 상태는 그 main 위에서 gate 를 지난 것이다.
**main 은 PR 로만 — 관리자까지(2026-09-28, ADR 0121).** 보호 규칙의 `enforce_admins` 를 켰다 — 운영자 · 조율자 ·
에이전트 누구의 커밋도 main 에 직접 들지 않고 PR 의 `gate` 를 지나야 든다. 운영자와 에이전트가 같은 GitHub 계정을
써서 GitHub 가 둘을 못 가르고, `.claude/settings.json` 은 Claude Code 만 읽으며 `deny` 는 우회된 적이 있어(아래 「잠그지
않은 것」) 에이전트만 막을 방법이 없다. 문서 · 세션 기록도 가지 → PR → `--auto` 로 넣는다(문서만 바뀐 PR 은 `policy`
차선만 돈다). 비상시 운영자가 저장소 설정에서 보호를 잠시 끌 수 있다 — 끄면 **켤 때까지** 그 사이에 든 커밋과 다시 켠
시각을 그날 노트에 적는다.

`--auto` 없는 즉시 머지가 등급 3 인 까닭은 검사를 안 지난 코드가 main 에 들고, 다음 묶음 배포가 그것을
그대로 싣기 때문이다(2026-09-20 에 한 번 그랬다 — 그때는 머지가 곧 배포였다). 잠금이 `gh pr merge` 전체를 묻는 것은 규칙이 인자를 못 가르기 때문이고, 물으면
「`--auto` 다」로 답이 된다.

**예외 — 마이그레이션이 든 PR 은 `--auto` 도 등급 3 이다.** 머지가 곧 배포이던 때(ADR 0110 전)는 gate 초록 즉시
앱이 나가 `docs/ops/runbook/deploy.md` 의 「마이그레이션이 먼저, 앱이 나중」이 뒤집혔다. 지금은 머지가 앱을 안 내보내지만, **그 main 을 올리는
다음 묶음 배포가 DB 보다 먼저 나가지 않게** 순서를 머지에서부터 지킨다(`docs/ops/runbook/deploy.md` 「배포」 규약 넷 · 「묶음 배포」 0).
그런 PR 은 `db push` 와 확인이 끝난 뒤에만 머지를 건다 — 운영 베타에서는 에이전트가 그 걸음을 직접 밟고 값을 적으며, 공식 운영 뒤에는 사람이
끝냈다고 답한 뒤다(ADR 0093). 순서 자체는 언제나 지킨다. 앱이 새 함수를 부르는 변경이면 **넓히는 마이그레이션 PR 과 앱 PR 로 나눈다** —
앞 PR 은 옛 앱에 안전하니 먼저 들고 `db push` 를 지나며, 뒤 PR 이 그 뒤에 든다(ADR 0071 의 A 단계가
그 모양이다). 이 예외는 시험이 안 잰다 — `ci-plan.mjs` 가 그 경로를 아니까 잠글 자리는 있다.

**등급 3 을 밟고 나면 무엇을 봤는지 값으로 적는다.** `db push` 뒤에는 `migration list` 의 remote
칸과 PostgREST 캐시(`docs/ops/runbook/deploy.md` 「배포」), 실호출은 운영자가 돌리므로 에이전트는 볼 값(저장된 판본과 검사 결과)을 PR 에 적어 건네고,
묶음 배포 뒤에는 Vercel 의 Ready 와 배포 SHA = main HEAD.

**잠그지 않은 것 — 2026-09-23 에 잰 값.** 규칙이 서 있다고 도구가 지키는 것이 아니다. 두 가지를 밟았다.
① **사용자의 `allow` 가 프로젝트의 `ask` 를 이겼다.** `.claude/settings.local.json` 에 확인 창의 「항상 허용」으로
쌓인 `Bash(gh pr *)` · `Bash(npx supabase *)` · `Bash(git push *)` 가 있는 동안 `ask` 21개가 켜져 있어도
`gh pr merge` 는 묻지 않았고, 그 세 줄을 지우자 물었다. ② `deny` 는 `cd x && git push --force-with-lease` 를
막지 않았다(같은 날, 작업 가지). 그러니 잠금을 켤 때는 `ask` 만 되돌리지 말고 `settings.local.json` 의 넓은
`allow` 를 함께 걷고, 켠 뒤 `gh pr merge --help` 같은 해 없는 명령으로 창이 뜨는지 재 본다. 가지를 main
위로 옮길 때는 rebase 대신 main 을 merge 해 force push 가 필요 없게 한다. 이 표는 도구가 지키는 담이
아니라 **에이전트가 읽는 규약**이고, 설정은 그 규약을 도구가 아는 데까지 옮긴 것이다.

### 공식 운영에 들어가면 켜는 잠금 (ADR 0093)

**사람이 `docs/product/prd/roadmap.md` §7.0 의 「(지금)」을 공개 출시로 옮기는 날의 걸음이다.** 그 전에는 아무도 이 절을
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
- `Bash(TASTE_LIVE=1:*)`
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
