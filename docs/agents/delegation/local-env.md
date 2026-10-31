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
| `next dev` 가 「개발 서버가 운영 Supabase(…)에 붙으려 한다」로 시작하지 않는다 | `.env.development.local` 은 Vercel 이 내린 **운영** 접속값이다 — 그대로 띄우면 누른 것이 운영을 바꾸고 로컬 픽스처 쿠키도 안 먹는다(2026-10-11). `next.config.ts` 가 개발 서버만 거절한다(`remoteDevRefusal`), 빌드 · `next start` 는 그대로 | `npm run dev:local`(= `UI_PORT=<포트> node scripts/ui-dev.mjs`) — 로컬 스택 값을 프로세스 환경으로 덮는다. 일부러 운영에 붙이려면 `DEV_ALLOW_REMOTE=1` |
| 픽스처가 `Something went wrong` 으로 죽는다 | 로컬 스택의 하루 풀이 한도(`reading_daily_budget()`)가 찼다. 도구가 제 줄을 어제로 밀지만 다른 표식의 줄은 안 민다 | `docker logs supabase_db_<SAJU_STACK_ID> --tail 30 \| grep -i error` 로 확인(main 은 `saju`, 워크트리는 `saju_wtN`), `npm run db:reset` |
| pgTAP 이 e2e 뒤에 붉다 | 표를 전역으로 세는 자리가 남은 계정에 걸린다 | `npm run db:reset` 뒤 다시. 새로 쓰는 시험은 자기가 만든 행만 센다 |
| 로그인 e2e 가 `PGRST202 Could not find the function …` 로 붉다(예: 사진 지우기 `remove_my_photo(p_position, p_version)`) | 스택 자리에 옛 볼륨이 남아 있으면 `db:start` 는 새 마이그레이션을 올리지 않는다 — 앱은 새 서명을 부르고 로컬 DB 는 옛 함수를 든다(2026-09-26) | `npm run db:reset` 뒤 다시 |
| localhost 의 dev 서버만 탭 이동이 아주 느리다 · 서버 로그의 요청 시간은 멀쩡하다 | 메인 폴더 **안의** 워크트리(`.claude/worktrees/`)가 저마다 `node_modules` 를 복제해 메인의 dev 서버가 함께 감시한다(2026-09-27, 다섯 벌 8.3GB) | 머지된 워크트리를 `git worktree remove` 로 걷고 dev 서버를 다시 띄운다(`docs/agents/delegation/coordinator.md` 「끝난 워크트리를 걷는다」) |
| 새 워크트리에서 vitest 가 `server-only` 를 못 찾거나 dev 서버가 `node_modules` 를 거절한다 | 워크트리에는 `node_modules` 가 없다. 심볼릭 링크는 Turbopack 이 거절한다(2026-09-28) | 단위 · 타입 · 린트만이면 `ln -s <메인>/node_modules .`. dev 서버 · 흐름 · e2e 면 복사한다 — macOS `cp -Rc`(APFS 복제), Linux `cp -a --reflink=auto`(ext4 는 통째 — 759MB · 4초) |
| 워크트리에 `node_modules` 가 **있는데도** vitest 가 `server-only` 를 못 찾는다 | 그 폴더가 캐시만 든 껍데기다(`.vite` 하나뿐, 2026-10-10) — 이름이 있어 위 줄을 안 밟고, vitest 는 위 폴더로 올라가 찾다 선다 | `ls node_modules` 로 패키지가 있는지 보고, 껍데기면 지우고 위 줄대로 링크하거나 복사한다 |
| 워크트리에서 `npm run db:remote` · `supabase migration list` · `db push` 가 `LegacyProjectNotLinkedError` 로 선다 | 원격 프로젝트 연결(project-ref)은 `supabase/` 아래 `.temp` 폴더에 있고 gitignore 라 git 이 안 든다 — 새 워크트리에는 없다(2026-10-10 · 2026-10-14) | 메인 체크아웃의 그 `.temp` 를 열어 `project-ref` 가 운영 프로젝트인지 본 뒤 워크트리의 `supabase/` 아래로 복사한다(`cp -a` 로 폴더째) |
| 에이전트 워크트리에서 `cannot be shown …` 으로 거절된다 — 변수 · 명령 치환(`$()`) · heredoc(특히 `git` 글자가 든 것) · `for` 루프 · `xargs` · `git` 출력을 받는 파이프 · `&&` 로 이은 `git` · `gh` 명령 · `vercel inspect <url> \| grep alias` 처럼 운영 CLI 출력을 받는 파이프 · `gh … -q '<jq 식>'` · `git` 글자가 든 스크립트를 heredoc 으로 넘긴 `python3` · `node` | Claude Code 의 워크트리 격리가 실행 때 정해지는 명령을 막는다 — 2026-10-14 라운드의 에이전트 다섯이 다 겪었다. `vercel` 파이프는 2026-10-18 배포 에이전트들, `gh -q` 는 2026-10-23 라운드의 에이전트 넷 다(같은 날 다른 세션에서는 통과했다 — 늘 막히는 것은 아니다). 2026-10-30 Expo 라운드에서도 되풀이됐다 — `cd <경로>; git merge …` 처럼 앞에 `cd` 를 붙인 `git` 도 걸린다 | `git` · `gh` 명령은 하나씩 따로 부르고 값은 글자로 옮긴다. `vercel inspect <url>` 은 파이프 없이 불러 출력의 Aliases 를 눈으로 읽는다(`docs/ops/runbook/deploy.md` 「배포」 3 단계). 커밋 · PR 본문처럼 긴 글은 파일로 써서 `-F` · `--body-file` 로 준다. 여러 파일이나 이어진 걸음은 스크립트 파일(`node` · `sh`)에 절대 경로를 주고 그 파일을 돌린다. 그 파일을 두는 자리는 `docs/agents/delegation/done.md` 「끝났다는 것」의 「임시 파일」 줄 — 제 워크트리 안이다 |
| `npm run build` 가 `FileSystemPath("").join("../../../node_modules/tailwindcss/index.css") leaves the filesystem root` 로 선다 | `.claude/worktrees/` 아래 워크트리 · 복사한 `node_modules` 에서 났다(2026-10-07). 2026-10-10 #604 에서는 `.claude/worktrees/` 아래에 `cp -a --reflink=auto` 로 복사한 `node_modules` 로 빌드가 됐다 — 원인은 확인 전 | CI `core` 차선의 빌드를 보거나, 저장소 밖 홈 디스크의 워크트리(`git worktree add --detach ~/saju-wt/<이름>`)에서 빌드하고 끝나면 걷는다 — `/tmp` 는 아래 줄 |
| 에이전트 워크트리에서 `git worktree add`(예: `docs/ops/runbook/deploy.md` 「묶음 배포」 1 단계의 임시 폴더)가 거절된다 | 워크트리 격리가 제 워크트리를 겨누지 않는 `git` 명령을 막는다(2026-10-18 배포) | `git -C <제 워크트리> worktree add --detach ~/saju-wt/<이름> <SHA>` 로 제 워크트리를 겨눠 부른다. 끝나면 같은 꼴의 `worktree remove` 로 걷는다 |
| 열린 PR 의 가지를 main 위로 `git rebase` 한 뒤 `git push --force`(`--force-with-lease` 도)가 거절된다 | 워크트리 격리가 원격 가지를 다시 쓰는 push 를 막는다 — 보통의 push 거절로 읽혀 헤맸다(2026-10-18 #761) | main 이 꼭 필요할 때만(`DIRTY` · 새 main 의 코드가 드는 때 — `BEHIND` 만이면 할 것이 없다, 아래 줄) rebase 하지 않고 `git fetch origin main` 뒤 `git merge origin/main` 으로 올려 보통 push 한다(`docs/agents/delegation/parallel.md` 「나란히 맡길 때」의 충돌 푸는 법과 같다). squash 본문에 merge 커밋 메시지가 섞이니 머지할 때 본문을 다듬는다(`docs/agents/delegation/done.md` 「끝났다는 것」의 squash 본문) |
| dev 서버가 OOM 으로 죽고 도구 출력이 `ENOSPC` 로 멈춘다 | 이 WSL 의 `/tmp` 는 3.9GB tmpfs(메모리)다 — 워크트리마다 `node_modules`(약 760MB)를 복사하면 찬다(2026-10-08) | 워크트리는 홈 디스크(저장소 밖이면 `~/saju-wt/<이름>`)에 두고, 끝나면 `git worktree remove` 로 걷는다 |
| 대기 고리가 끝나지 않고 `jq: command not found` 가 찍힌다 | 이 기계에 `jq` 가 없다(2026-10-07) | `gh … --json <칸> -q '<jq 식>'`. 에이전트 워크트리에서 `-q` 도 거절되면(위의 격리 줄) `--json <칸>` 만 받아 눈으로 읽는다 |
| `gh pr update-branch` 가 없다 · `gh pr edit` 가 classic Projects 오류로 선다 | Ubuntu apt 의 `gh` 2.46 | cli.github.com 의 apt 저장소에서 공식 `gh` 를 깐다(이 기계는 2026-10-06 부터 2.102.0) |
| 로컬 DB 자리 5 에서 `db:start` 가 `LegacyDbConnectError` · `ECONNREFUSED` 로 선다(2026-10-10) | 원인은 확인 전 | 다른 자리(`npm run stack:slot -- --auto`)를 쓴다 |
| `supabase: command not found` | PATH 에 없다 | `npx supabase` 나 `./node_modules/.bin/supabase` |
| WSL 에서 `db:start` · `npx supabase status` 가 Docker 에 못 닿는다 | Docker Desktop 이 꺼져 있다 — 또는 명령이 샌드박스 안에서 돈다(2026-10-08) | Docker Desktop 을 켜고, 샌드박스 밖에서 다시 부른다 |
| `docker version` 이 「could not be found in this WSL 2 distro」이고 `/usr/bin/docker` 링크의 대상(`/mnt/wsl/docker-desktop/`)이 없다 | Docker Desktop 엔진이 꺼져 있다 — 설치가 없는 것이 아니다(2026-10-31). Windows 쪽 `docker.exe version` 이 `dockerDesktopLinuxEngine` 파이프를 못 찾는다고 답하면 이 줄이다 | 사람이 Docker Desktop 을 켠다. 아래 줄(CI 에 기대기)로 넘어가지 않는다 |
| `docker` 명령이 아예 없고 `db:start` 가 `LegacyDockerLifecycleInspectError` 로 선다 | 이 WSL 에 Docker 가 없다(Docker Desktop 의 WSL 연동 꺼짐, 2026-10-12) — 로컬에서 pgTAP · `db:types` 를 못 돌린다 | 생성 타입(`src/lib/db/database.generated.ts`)은 손으로 고치고, CI 의 `test:db`(pgTAP)와 `db:types` 재생성 diff 에 기댄다. PR 에 「로컬에서 못 돌렸다 — CI 가 덮었다」를 적는다(#664) |
| `supabase test db <파일>` 이 헬퍼 함수가 없다고 선다 | 파일 하나만 주면 `00_helpers.sql` 이 안 실린다 | `supabase/tests/00_helpers.sql` 을 앞에 함께 준다 |
| e2e 가 시간 초과로 끝난 뒤 다음 e2e 가 옛 화면을 받는다 | 남은 dev 서버를 `reuseExistingServer` 가 붙잡는다 | `lsof -ti tcp:3000 \| xargs kill` 뒤 다시 |
| `npx playwright test e2e/match.spec.ts` 만 붉다 | 그 spec 은 직렬이어야 한다 | `npm run test:e2e:match`(`--workers=1`) |
| `db query` 가 `cannot insert multiple commands` | prepared statement 라 `begin; … rollback;` 을 못 받는다 | 트랜잭션이 필요하면 `docker exec -i supabase_db_<SAJU_STACK_ID> psql -U postgres -d postgres` |
| `db diff --linked` 가 비밀번호를 묻는다 | 다른 인증 경로다(`db query --linked` 는 된다) | 양쪽에 같은 질의를 돌려 손으로 견준다 |
| 기계가 바쁠 때(빌드 · 다른 워크트리의 시험과 겹칠 때) `npm test` 의 엔진 시험이 `Test timed out in 5000ms` 로 붉다 | 로컬 `testTimeout` 은 5초다(`vitest.config.mts`, CI 는 30초) — 코드가 아니라 일꾼 수가 부하를 키운다(2026-10-22). CI 에서는 안 난다 — `calibration` · `seoul-date` · `lunar` 를 포함해 verify 의 실패 실행 200개(2026-09-11~10-30)에 든 붉은 `core` · `policy` job 49개에 시간 초과가 0건이라 시한을 안 고쳤다(2026-10-31, 옛 이름 `fast` 의 job 은 안 셌다) | `npx vitest run --maxWorkers=4` 로 다시. 그래도 붉으면 그때 코드를 본다 |
| `timeout` 이 없다 | macOS | coreutils 의 `gtimeout` |
| `pkill -f <글자>` 를 부르자 명령이 결과 없이 죽는다 | 그 글자가 제 셸의 명령줄에도 들어 있어 셸이 저를 죽인다(2026-10-30 Expo 라운드) | 띄울 때 받은 PID 로 끈다. 글자로 찾아야 하면 첫 글자를 묶는다 — `pkill -f '[e]xpo start'`. 남이 띄운 프로세스는 끄지 않는다 |
| 가지들을 임시로 합쳐 본 뒤, 진짜 머지의 충돌이 묻지 않고 풀린다(`Resolved '…' using previous resolution`) | 이 저장소는 `rerere.enabled=true` 이고 `rr-cache` 는 워크트리끼리 함께 쓴다 — 임시 합침에서 고른 해결을 다른 가지 · 다른 워크트리의 머지가 되풀이한다(2026-10-30 Expo 라운드) | 임시 합침은 시험하는 데만 쓰고 그 가지를 PR 에 올리지 않는다. 머지에서 그 문장이 보이면 그 파일을 읽어 보고, 틀렸으면 `git rerere forget <파일>` 뒤 `git checkout -m <파일>` 로 충돌을 되살려 다시 푼다 |
| 맥에서만 `scripts/aws-wizard.test.ts` 가 붉다 · 마법사가 「bash 4.4 이상」이라며 멈춘다 | macOS 의 `/bin/bash` 는 3.2 다 — 마법사는 `inherit_errexit` · 연관 배열을 쓴다. 시험은 PATH 의 bash 를 쓴다(CI 는 ubuntu 라 초록, 2026-10-24) | `brew install bash` — `/opt/homebrew/bin` 이 PATH 에서 `/bin` 앞이면 된다 |
| `db query --linked` 를 여럿이 동시에 부르면 `Initialising login role...` 뒤에 실패한다 | CLI 가 부를 때마다 로그인 역할을 세운다 — 나란히 부르면 서로 부딪힌다 | `npm run db:remote -- --purpose "<목적>" "<sql>"` 로 부른다 — 기계 전체에서 한 번에 하나만 돌고 나머지는 기다린다(ADR 0096) |
| 워크트리에서 운영에 닿는 CLI 를 처음 부를 때 macOS 가 키체인의 `Supabase CLI` 를 쓰려 한다고 묻는다 | 임시 서명(`adhoc`) 바이너리라 키체인이 **경로**로 허락을 기억한다 — 워크트리마다 새 경로다(2026-09-24) | 사람이 경로가 이 저장소의 `.claude/worktrees/…/supabase` 인지 보고 「항상 허용」. 거부하면 그 세션의 원격 걸음이 실패한다 |
| 프로덕션 확인에 계정이 필요하다 | 기존 계정은 실제 사용자다 | `.env.development.local` 의 `SUPABASE_SECRET_KEY` 로 `auth.admin.createUser({ email_confirm: true })` — 주소는 `@example.com`, 전용 코드로 `complete_signup` 을 지난다. 끝나면 `forget_user` 로 지우고 코드도 지운다(#115 · #121) |
| `gh pr merge --auto` 가 `BLOCKED` 로 선다 | gate 가 아직 안 끝났다 — 실패가 아니다 | `gh pr checks <n>` 으로 갈라 본다. `UNSTABLE` 도 도는 중일 수 있다 |
| `gh pr view <n> --json mergeStateStatus` 가 `BEHIND` 다 | 가지가 최신 main 을 안 품었다는 뜻뿐이다 — 보호 규칙의 strict 는 껐다(2026-10-12, 그 전에는 이것이 `--auto` 를 막았다 · #143) | 할 것이 없다 — gate 가 초록이면 든다. 안 들면 `BLOCKED`(위 줄) · `DIRTY`(충돌 — 가지에서 main 을 merge)를 본다 |
| `.env.development.local` 의 값이 `"[SENSITIVE]"` 다 | Vercel 이 Secret 은 안 내려 준다. 그대로 두면 「있는」 값으로 세어져 401 로 떨어진다 | 주석 처리해 두면 오류가 이름을 대 준다. 실호출은 `OPENAI_API_KEY` 한 줄을 손으로 붙인다 |
| 실호출 첫 콜이 `Incorrect API key` | `.env.development.local` 값이 `"…"` 로 감싸여 있다 | `loadLocalEnv` 가 벗긴다 — 새 읽는 자리를 만들면 같은 것을 한다 |
| Production 배포가 전부 `Error` 인데 typecheck · lint · 단위 · e2e 는 초록이다 | `next build` 만 잡는 것이 있다 — 예: `app/**/icon.tsx` 는 메타데이터 라우트라 기본 내보내기가 없으면 「Export default doesn't exist」로 선다(2026-09-24). 파일 이름 `icon` · `apple-icon` · `opengraph-image` · `sitemap` · `robots` · `manifest` 는 `app/` 아래 어디서나 특별하다 | 로컬에서는 최소 셋(단위 · 타입 · 린트, `docs/agents/test-map/what-to-run.md`)만 돈다 — 빌드는 CI `core` 차선이 돈다. 이 특별한 이름의 파일을 더하거나 고쳤으면 그 PR 의 CI 빌드가 초록인지 본다. 공용 아이콘은 `app/ui/icons.tsx` 다. 배포 상태는 `vercel ls --prod` |

## 앱을 웹 번들로 재기

`mobile/` 화면을 기기 없이 재는 차례다(2026-10-30 Expo 라운드). 앱 시험의 나머지는 인계 노트 `docs/notes/2026-10-30-expo-app-round.md` 「시험하는 법」이 든다.

1. `mobile/app.json` 의 `web.output` 을 잠시 `single` 로 둔다 — `server` 는 AsyncStorage 가 서버 렌더에서 죽는다. **커밋하지 않는다.**
2. `mobile/` 에서 `npx expo start --web` 을 띄우고 390px 폭으로 연다.
3. Supabase 응답은 Playwright 의 가로채기로 가짜를 끼운다 — 운영 DB 를 밟지 않는다(개발 빌드도 운영 Supabase 를 본다). 로그인은 `__DEV__` 가 건너뛴다.
4. 부품을 웹과 나란히 보려면 띄운 채 `APP_URL=http://localhost:<포트> node scripts/design-compare.mjs <폴더>` — 웹 상수와 앱의 `/dev-parts` 를 같은 차례로 찍어 `compare.png` 한 장을 낸다.
   데이터가 찬 화면은 `localStorage` 에 가짜 세션(`sb-<주소의 첫 토막>-auth-token`)을 넣는다. 가짜 값의 함정 — `late_night_rule` 은 `jo` · `ya`, `time_basis` 는 `record` 등 진짜 값이어야 명식이 선다. 관문은 `current_beta_schedule` 을 못 읽으면 가입을 마친 사람을 들여보낸다(500 을 주면 빠르다). `EXPO_PUBLIC_SITE_URL` 쪽 앱용 문도 가로챈다.
5. **이것은 네이티브가 아니다** — 구글 로그인 창 · 사진 고르기와 굽기 · 딥 링크 · 키보드는 안 돈다. PR 의 「안 돌린 것」에 적는다.

## 앱을 네이티브로 재기

안드로이드 에뮬레이터의 Expo Go 에 가짜 서버를 물려 라우트를 전수로 잰다 — 운영을 안 밟고 데이터가 찬 채로다(2026-10-31, #927 이 이 길로 웹 번들에 안 보이던 셋을 찾았다). 도구는 `mobile/scripts/measure/` 다. **실제 DB · 구글 로그인 · iOS 는 재지 않는다** — PR 의 「안 돌린 것」에 적는다. 그림은 저장소 밖(`MEASURE_DIR`)에 둔다.

1. 에뮬레이터를 띄우고 Expo Go(SDK 와 맞는 판)를 깐다 — `adb.exe install -r -g <Windows 경로의 apk>`. API 37 은 권한도 준다 — `adb shell pm grant host.exp.exponent android.permission.ACCESS_LOCAL_NETWORK`.
2. 포트를 잇는다 — `adb reverse tcp:8081 tcp:8081` · `adb reverse tcp:18999 tcp:18999`.
3. `mobile/.env.local` 을 가짜로 둔다 — `EXPO_PUBLIC_SUPABASE_URL` · `EXPO_PUBLIC_SITE_URL` 은 `http://localhost:18999`, `EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY` 는 아무 글자. **운영 값을 넣지 않는다.**
4. `node mobile/scripts/measure/fake-server.mjs` — 상태는 `curl 'localhost:18999/__set?m=<상태>'`(`reset` · `empty` · `unsigned` · `closed` · `suspended` · `warning` · `no-credits` · `no-self`).
5. `mobile/` 에서 `REACT_EDITOR=none EXPO_NO_TELEMETRY=1 npx expo start --clear --port 8081 --go > "$MEASURE_DIR/metro.log" 2>&1`.
6. `mobile/scripts/measure/dev-seed.tsx.txt` 를 `mobile/src/app/dev-seed.tsx` 로 잠시 복사하고 `python3 mobile/scripts/measure/device.py link /dev-seed` 로 세션을 넣는다. **이 복사본과 `.env.local` 은 끝나면 지운다 — 커밋하지 않는다.**
7. 라우트를 쓴다 — `python3 mobile/scripts/measure/sweep.py me=/me chat=/me/chat …` 가 그림 · 글자 · 새 로그를 모은다. 누르는 흐름은 `device.py` 의 `tap` · `input` · `type` · `key` 로 스크립트 파일에 적는다.

환경값은 `ADB`(WSL 은 Windows SDK 의 `adb.exe` 전체 경로) · `MEASURE_DIR`(기본은 임시 폴더의 `saju-measure`) · `FAKE_PORT` 다. 앱이 새 DB 함수를 부르면 가짜 서버 기록에 `!! 없는 rpc` 가 찍힌다 — 그 답을 `fake-server.mjs` 에 더한다.

| 증상 | 원인 | 하는 일 |
| --- | --- | --- |
| API 37 에서 Expo Go 가 Metro 에 못 붙는다 | 로컬 네트워크 권한(`ACCESS_LOCAL_NETWORK`)이 없다 | 1 의 `pm grant` |
| 딥 링크가 앱으로 안 간다 | `am start` 에 패키지 인자를 붙였다 | `am start -a android.intent.action.VIEW -d 'exp://127.0.0.1:8081/--/<경로>'` 까지만(`device.py link`) |
| 붉은 화면의 스택 줄을 누르자 PC 에 VS Code 가 뜬다 | Metro 가 편집기를 연다 | `REACT_EDITOR=none` 으로 띄운다 |
| 누른 자리가 엉뚱하다 | 좌표는 Expo 도구 단추 · 판 크기로 어긋난다 | 좌표를 쓰지 않는다 — `uiautomator` 덤프의 글자로 찾아 누른다(`device.py tap`) |
| `input text` 를 보냈는데 메뉴가 뜨거나 앱이 다시 읽힌다 | 입력칸에 초점이 없으면 글자가 RN 단축키(`r` · `d` …)로 먹는다 | `device.py input` 으로 초점을 준 뒤 `type`. 한글은 못 넣는다 |
| 눌렀는데 앞 화면 글자가 읽힌다 | 글자가 화면 전환보다 늦게 바뀐다 | 전환 뒤 몇 초 기다리고 읽는다 — 안 나왔다고 바로 판정하지 않는다 |
| `adb` 가 결과 없이 멈춘다 | Windows 쪽 `adb.exe` 프로세스가 쌓여 데몬이 멈춘다 | `adb.exe kill-server` 로 내리고 다시 부른다. 부를 때 `timeout` 을 두고 나란히 부르지 않는다 |
| 뿌리 `node_modules` 가 없다 | `mobile/` 의 `npm ci` 만으로 Metro · `tsc` 가 도는 것은 `.claude/worktrees/` 가 메인의 `node_modules` 밑에 있어서다(2026-10-31 에 쟀다). `scripts/` 시험은 그래도 못 돌고, 저장소 밖 복사본은 `src/lib` 의 `astronomy-engine` 을 못 찾는다 | 뿌리에 `npm ci`, 또는 CI 처럼 `node_modules` 를 잇는다 |
| `git` · `github` · `timeout` 글자가 든 복합 명령이 거절된다 | 워크트리 격리가 복합 명령을 못 잰다(위 표의 격리 줄) | 스크립트 파일에 적고 파일을 부른다 |

## 워크트리에서 전후 그림 찍기

화면 PR 의 전후 그림(`docs/agents/delegation/done.md` 「끝났다는 것」)을 에이전트 워크트리에서 찍는 차례다. 도구와 그 사정은
`docs/notes/ui-walk-and-gallery.md` 가 든다 — 여기는 워크트리에서 매번 다시 배우던 것만이다(2026-10-10 라운드 보고).

1. **제 로컬 DB 를 세운다** — `npm run stack:slot -- N`(빈 번호는 `--auto`) 뒤 `npm run db:start`. 워크트리는 소스만 가르므로
   자리 없이 띄우면 남의 스택을 밟는다(ADR 0096). 옛 볼륨이 남아 함수가 없다고 하면 `npm run db:reset`(위 표).
2. **진짜 `node_modules` 를 복사한다** — 심볼릭 링크는 Turbopack 이 거절한다(위 표). `cp -a --reflink=auto <메인>/node_modules .`.
3. **화면 서버는 `node scripts/ui-dev.mjs`** — 로컬 스택에 붙이고 모델 열쇠를 비운 채 3100(`UI_PORT`)에 뜬다(`npm run dev:local`). `npm run dev` 를
   그냥 띄우면 운영 접속값이라 시작을 거절한다(`next.config.ts`).
4. **찍기는 `UI_ONLY=<id,id> node scripts/ui-shots.mjs <폴더>`** — 고친 화면의 id 만 두 폭으로 찍는다(id 는 그 파일의 `PLAN`).
   고치기 전 그림은 main 을 체크아웃한 같은 자리에서 먼저 찍는다. **로딩 뼈대(`loading.tsx`)는 뼈대 무리의 `skeleton-*` id 로**
   찍는다(#604) — 도구가 지은 서버(`UI_PORT`+2)를 따로 세워 이동을 붙잡는다. `next dev` 로는 뼈대가 안 선다(`scripts/ui-shots.mjs` 의
   `serverAsBuilt` 머리말).
5. **`aria-disabled` 단추는 Playwright 에서 `force: true` 로 누른다** — 잠긴 단추가 「누른 뒤에 까닭을 말하는」 화면(ADR 0160)은
   보통의 `click()` 이 막혀 그 상태를 못 찍는다.
6. **`ui-dev` 를 띄운 채 e2e 를 돌리면 `PLAYWRIGHT_PORT=<ui-dev 포트>`(기본 3100)를 준다** — Playwright 가 그 서버를 재사용한다
   (`reuseExistingServer`). 주지 않으면 제 포트에 하나를 더 띄우려다 「한 디렉터리에 dev 서버 하나」(위 표)에 걸린다(2026-10-10).
7. **로그인 상태로 찍는 임시 spec 은 이름을 `playwright.config.ts` 의 `AUTHED` 꼴에 맞춘다** — 예: 이름 끝을 `signed-in.spec.ts` 로.
   맞지 않으면 로그인 없는 프로젝트에서 돌아 운영 화면 대신 로그인 화면을 찍는다(2026-10-17).
8. **Docker 가 없으면(위 표의 `LegacyDockerLifecycleInspectError`) 꾸민 데이터로 찍는다** — 1 의 스택 없이 `next dev` 에 가짜 Supabase
   값(`NEXT_PUBLIC_SUPABASE_URL=http://127.0.0.1:54321` 처럼 로컬 주소 — `remoteDevRefusal` 이 통과시킨다)을 주고, `/me/**` 아래의 임시
   주소에 고친 진짜 부품과 꾸민 데이터를 넣어 찍는다(2026-10-18 #753 · #754). 함정 셋 —
   ① 임시 주소가 `app/` 아래 있는 동안 경계 시험 셋(`app/auth/signed-in.boundary.test.ts` · `scripts/ci-plan.test.ts` · `app/action-calls.boundary.test.ts`)이
   붉다 — 찍고 나서 지운 뒤 시험을 돈다 ② 지운 뒤 `.next` 도 지운다 — 남은 생성 타입이 없는 주소를 가리켜 타입 검사가 붉다
   ③ `/me` 의 시안 주소에서는 하단 독이 선다 — 대화방(독을 걷은 판)을 가린다. 그 판의 그림은 독이 없는 진짜 화면과 견주어 읽는다.
   PR 에 「꾸민 데이터로 찍었다」를 적는다.
