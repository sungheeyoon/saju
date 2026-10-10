# 위임 규약 — 로컬 환경의 함정

색인은 `docs/agents/delegation.md` 다.

## 로컬 환경의 함정

세션마다 같은 자리에서 시간을 잃었다. 접속값과 운영 절차는 `docs/ops/runbook.md`, 시험 명령은
`docs/agents/test-map.md` 가 든다. 여기는 그 둘에 없는 것만이다.

| 증상 | 원인 | 하는 일 |
| --- | --- | --- |
| 모든 주소가 500 이고 `globals.css` 파싱 오류가 뜬다 | `.next` 의 Turbopack CSS 캐시가 깨졌다. **원본은 멀쩡하다** | `lsof -ti tcp:3000 \| xargs kill -9 ; rm -rf .next ; npm run dev`. 다른 dist(`.next-check`)도 같다 |
| `Another next dev server is already running` | Next 16 은 한 디렉터리에 dev 서버 하나다 — 포트를 옮겨도 안 된다 | 3000 을 끄거나(사람이 쓰는 중이면 묻는다) `PLAYWRIGHT_PORT=3100 NEXT_DIST_DIR=.next-check` 로 `next start` 를 쓴다 |
| 로그인 e2e 74건이 전부 로그인 화면을 받는다 | 3000 의 dev 서버를 재사용해 운영 DB 를 봤다 | 위와 같다. CI 는 `CI=true` 라 이 함정이 없다 |
| 픽스처가 `Something went wrong` 으로 죽는다 | 로컬 스택의 하루 풀이 한도(`reading_daily_budget()`)가 찼다. 도구가 제 줄을 어제로 밀지만 다른 표식의 줄은 안 민다 | `docker logs supabase_db_<SAJU_STACK_ID> --tail 30 \| grep -i error` 로 확인(main 은 `saju`, 워크트리는 `saju_wtN`), `npm run db:reset` |
| pgTAP 이 e2e 뒤에 붉다 | 표를 전역으로 세는 자리가 남은 계정에 걸린다 | `npm run db:reset` 뒤 다시. 새로 쓰는 시험은 자기가 만든 행만 센다 |
| 로그인 e2e 가 `PGRST202 Could not find the function …` 로 붉다(예: 사진 지우기 `remove_my_photo(p_position, p_version)`) | 스택 자리에 옛 볼륨이 남아 있으면 `db:start` 는 새 마이그레이션을 올리지 않는다 — 앱은 새 서명을 부르고 로컬 DB 는 옛 함수를 든다(2026-09-26) | `npm run db:reset` 뒤 다시 |
| localhost 의 dev 서버만 탭 이동이 아주 느리다 · 서버 로그의 요청 시간은 멀쩡하다 | 메인 폴더 **안의** 워크트리(`.claude/worktrees/`)가 저마다 `node_modules` 를 복제해 메인의 dev 서버가 함께 감시한다(2026-09-27, 다섯 벌 8.3GB) | 머지된 워크트리를 `git worktree remove` 로 걷고 dev 서버를 다시 띄운다(`docs/agents/delegation/coordinator.md` 「끝난 워크트리를 걷는다」) |
| 새 워크트리에서 vitest 가 `server-only` 를 못 찾거나 dev 서버가 `node_modules` 를 거절한다 | 워크트리에는 `node_modules` 가 없다. 심볼릭 링크는 Turbopack 이 거절한다(2026-09-28) | 단위 · 타입 · 린트만이면 `ln -s <메인>/node_modules .`. dev 서버 · 흐름 · e2e 면 복사한다 — macOS `cp -Rc`(APFS 복제), Linux `cp -a --reflink=auto`(ext4 는 통째 — 759MB · 4초) |
| 워크트리에 `node_modules` 가 **있는데도** vitest 가 `server-only` 를 못 찾는다 | 그 폴더가 캐시만 든 껍데기다(`.vite` 하나뿐, 2026-10-10) — 이름이 있어 위 줄을 안 밟고, vitest 는 위 폴더로 올라가 찾다 선다 | `ls node_modules` 로 패키지가 있는지 보고, 껍데기면 지우고 위 줄대로 링크하거나 복사한다 |
| 워크트리에서 `npm run db:remote` 가 `LegacyProjectNotLinkedError` 로 선다 | 원격 프로젝트 연결(project-ref)은 `supabase/` 아래 `.temp` 폴더에 있고 git 이 안 든다 — 새 워크트리에는 없다(2026-10-10) | 메인 체크아웃의 그 `.temp` 를 워크트리의 `supabase/` 아래로 복사한다(`cp -a` 로 폴더째) |
| 에이전트 워크트리에서 `cannot be shown …` 으로 거절된다 — 변수 · `git` 글자가 든 heredoc · `xargs` · `git` 출력을 받는 파이프 | Claude Code 의 워크트리 격리가 실행 때 정해지는 명령을 막는다 | 단순 명령으로 나누고 값은 글자로 옮긴다. 여러 파일은 스크래치패드의 `node` 스크립트에 절대 경로를 준다 |
| `npm run build` 가 `FileSystemPath("").join("../../../node_modules/tailwindcss/index.css") leaves the filesystem root` 로 선다 | `.claude/worktrees/` 아래 워크트리 · 복사한 `node_modules` 에서 났다(2026-10-07). 2026-10-10 #604 에서는 `.claude/worktrees/` 아래에 `cp -a --reflink=auto` 로 복사한 `node_modules` 로 빌드가 됐다 — 원인은 확인 전 | CI `core` 차선의 빌드를 보거나, 저장소 밖 홈 디스크의 워크트리(`git worktree add --detach ~/saju-wt/<이름>`)에서 빌드하고 끝나면 걷는다 — `/tmp` 는 아래 줄 |
| dev 서버가 OOM 으로 죽고 도구 출력이 `ENOSPC` 로 멈춘다 | 이 WSL 의 `/tmp` 는 3.9GB tmpfs(메모리)다 — 워크트리마다 `node_modules`(약 760MB)를 복사하면 찬다(2026-10-08) | 워크트리는 홈 디스크(저장소 밖이면 `~/saju-wt/<이름>`)에 두고, 끝나면 `git worktree remove` 로 걷는다 |
| 대기 고리가 끝나지 않고 `jq: command not found` 가 찍힌다 | 이 기계에 `jq` 가 없다(2026-10-07) | `gh … --json <칸> -q '<jq 식>'` |
| `gh pr update-branch` 가 없다 · `gh pr edit` 가 classic Projects 오류로 선다 | Ubuntu apt 의 `gh` 2.46 | cli.github.com 의 apt 저장소에서 공식 `gh` 를 깐다(이 기계는 2026-10-06 부터 2.102.0) |
| 로컬 DB 자리 5 에서 `db:start` 가 `LegacyDbConnectError` · `ECONNREFUSED` 로 선다(2026-10-10) | 원인은 확인 전 | 다른 자리(`npm run stack:slot -- --auto`)를 쓴다 |
| `supabase: command not found` | PATH 에 없다 | `npx supabase` 나 `./node_modules/.bin/supabase` |
| WSL 에서 `db:start` · `npx supabase status` 가 Docker 에 못 닿는다 | Docker Desktop 이 꺼져 있다 — 또는 명령이 샌드박스 안에서 돈다(2026-10-08) | Docker Desktop 을 켜고, 샌드박스 밖에서 다시 부른다 |
| `supabase test db <파일>` 이 헬퍼 함수가 없다고 선다 | 파일 하나만 주면 `00_helpers.sql` 이 안 실린다 | `supabase/tests/00_helpers.sql` 을 앞에 함께 준다 |
| e2e 가 시간 초과로 끝난 뒤 다음 e2e 가 옛 화면을 받는다 | 남은 dev 서버를 `reuseExistingServer` 가 붙잡는다 | `lsof -ti tcp:3000 \| xargs kill` 뒤 다시 |
| `npx playwright test e2e/match.spec.ts` 만 붉다 | 그 spec 은 직렬이어야 한다 | `npm run test:e2e:match`(`--workers=1`) |
| `db query` 가 `cannot insert multiple commands` | prepared statement 라 `begin; … rollback;` 을 못 받는다 | 트랜잭션이 필요하면 `docker exec -i supabase_db_<SAJU_STACK_ID> psql -U postgres -d postgres` |
| `db diff --linked` 가 비밀번호를 묻는다 | 다른 인증 경로다(`db query --linked` 는 된다) | 양쪽에 같은 질의를 돌려 손으로 견준다 |
| `timeout` 이 없다 | macOS | coreutils 의 `gtimeout` |
| `db query --linked` 를 여럿이 동시에 부르면 `Initialising login role...` 뒤에 실패한다 | CLI 가 부를 때마다 로그인 역할을 세운다 — 나란히 부르면 서로 부딪힌다 | `npm run db:remote -- --purpose "<목적>" "<sql>"` 로 부른다 — 기계 전체에서 한 번에 하나만 돌고 나머지는 기다린다(ADR 0096) |
| 워크트리에서 운영에 닿는 CLI 를 처음 부를 때 macOS 가 키체인의 `Supabase CLI` 를 쓰려 한다고 묻는다 | 임시 서명(`adhoc`) 바이너리라 키체인이 **경로**로 허락을 기억한다 — 워크트리마다 새 경로다(2026-09-24) | 사람이 경로가 이 저장소의 `.claude/worktrees/…/supabase` 인지 보고 「항상 허용」. 거부하면 그 세션의 원격 걸음이 실패한다 |
| 프로덕션 확인에 계정이 필요하다 | 기존 계정은 실제 사용자다 | `.env.development.local` 의 `SUPABASE_SECRET_KEY` 로 `auth.admin.createUser({ email_confirm: true })` — 주소는 `@example.com`, 전용 코드로 `complete_signup` 을 지난다. 끝나면 `forget_user` 로 지우고 코드도 지운다(#115 · #121) |
| `gh pr merge --auto` 가 `BLOCKED` 로 선다 | gate 가 아직 안 끝났다 — 실패가 아니다 | `gh pr checks <n>` 으로 갈라 본다. `UNSTABLE` 도 도는 중일 수 있다 |
| `gh pr view <n> --json mergeStateStatus` 가 `BEHIND` 이고 `--auto` 가 안 든다 | 보호 규칙이 strict 다 — 가지가 최신 main 을 품어야 든다(2026-09-23, #143). auto-merge 는 가지를 스스로 올리지 않는다 | `gh pr update-branch <n>` — main 을 merge 하므로 force push 가 없다. gate 가 다시 돌고 초록이면 든다 |
| `.env.development.local` 의 값이 `"[SENSITIVE]"` 다 | Vercel 이 Secret 은 안 내려 준다. 그대로 두면 「있는」 값으로 세어져 401 로 떨어진다 | 주석 처리해 두면 오류가 이름을 대 준다. 실호출은 `OPENAI_API_KEY` 한 줄을 손으로 붙인다 |
| 실호출 첫 콜이 `Incorrect API key` | `.env.development.local` 값이 `"…"` 로 감싸여 있다 | `loadLocalEnv` 가 벗긴다 — 새 읽는 자리를 만들면 같은 것을 한다 |
| Production 배포가 전부 `Error` 인데 typecheck · lint · 단위 · e2e 는 초록이다 | `next build` 만 잡는 것이 있다 — 예: `app/**/icon.tsx` 는 메타데이터 라우트라 기본 내보내기가 없으면 「Export default doesn't exist」로 선다(2026-09-24). 파일 이름 `icon` · `apple-icon` · `opengraph-image` · `sitemap` · `robots` · `manifest` 는 `app/` 아래 어디서나 특별하다 | 화면을 바꾼 병합 뒤에 `npm run build` 를 한 번 돈다. 공용 아이콘은 `app/ui/icons.tsx` 다. 배포 상태는 `vercel ls --prod` |

## 워크트리에서 전후 그림 찍기

화면 PR 의 전후 그림(`docs/agents/delegation/done.md` 「끝났다는 것」)을 에이전트 워크트리에서 찍는 차례다. 도구와 그 사정은
`docs/notes/ui-walk-and-gallery.md` 가 든다 — 여기는 워크트리에서 매번 다시 배우던 것만이다(2026-10-10 라운드 보고).

1. **제 로컬 DB 를 세운다** — `npm run stack:slot -- N`(빈 번호는 `--auto`) 뒤 `npm run db:start`. 워크트리는 소스만 가르므로
   자리 없이 띄우면 남의 스택을 밟는다(ADR 0096). 옛 볼륨이 남아 함수가 없다고 하면 `npm run db:reset`(위 표).
2. **진짜 `node_modules` 를 복사한다** — 심볼릭 링크는 Turbopack 이 거절한다(위 표). `cp -a --reflink=auto <메인>/node_modules .`.
3. **화면 서버는 `node scripts/ui-dev.mjs`** — 로컬 스택에 붙이고 모델 열쇠를 비운 채 3100(`UI_PORT`)에 뜬다. `npm run dev` 는
   운영 DB 를 본다.
4. **찍기는 `UI_ONLY=<id,id> node scripts/ui-shots.mjs <폴더>`** — 고친 화면의 id 만 두 폭으로 찍는다(id 는 그 파일의 `PLAN`).
   고치기 전 그림은 main 을 체크아웃한 같은 자리에서 먼저 찍는다. **로딩 뼈대(`loading.tsx`)는 뼈대 무리의 `skeleton-*` id 로**
   찍는다(#604) — 도구가 지은 서버(`UI_PORT`+2)를 따로 세워 이동을 붙잡는다. `next dev` 로는 뼈대가 안 선다(`scripts/ui-shots.mjs` 의
   `serverAsBuilt` 머리말).
5. **`aria-disabled` 단추는 Playwright 에서 `force: true` 로 누른다** — 잠긴 단추가 「누른 뒤에 까닭을 말하는」 화면(ADR 0160)은
   보통의 `click()` 이 막혀 그 상태를 못 찍는다.
6. **`ui-dev` 를 띄운 채 e2e 를 돌리면 `PLAYWRIGHT_PORT=<ui-dev 포트>`(기본 3100)를 준다** — Playwright 가 그 서버를 재사용한다
   (`reuseExistingServer`). 주지 않으면 제 포트에 하나를 더 띄우려다 「한 디렉터리에 dev 서버 하나」(위 표)에 걸린다(2026-10-10).
