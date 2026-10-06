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
| localhost 의 dev 서버만 탭 이동이 말도 안 되게 느리다(운영은 빠르다) · 서버 로그의 요청 시간은 0.2~0.6초로 멀쩡하다 | 에이전트 워크트리(`.claude/worktrees/`)가 메인 폴더 **안에** 서고, 저마다 `node_modules` 를 통째로 복제한다 — 밤 라운드 뒤 다섯 벌 8.3GB 를 메인의 dev 서버가 함께 감시했다. 캐시를 지우고 다시 띄워도 그대로였고, 워크트리를 걷고 다시 띄우자 풀렸다(2026-09-27) | 라운드가 끝나면 머지된 워크트리를 `git worktree remove` 로 걷고 dev 서버를 다시 띄운다(`docs/agents/delegation/coordinator.md` 「끝난 워크트리를 걷는다」) |
| 새 워크트리에서 vitest 가 `server-only` 를 못 찾거나 dev 서버가 `node_modules` 를 거절한다 | 워크트리는 소스만 가진다 — `node_modules` 가 없다. 심볼릭 링크로 이으면 Turbopack 이 거절한다(2026-09-28, 에이전트 셋이 따로 밟음) | 단위 · 타입 · 린트만이면 링크로 족하다 — `ln -s <메인>/node_modules .`(2026-10-06). dev 서버 · 흐름 · e2e 를 돌릴 때만 복사한다 — macOS `cp -Rc <메인>/node_modules ./`(APFS 복제), Linux `cp -a --reflink=auto <메인>/node_modules ./`(ext4 는 통째 복사 — 759MB · 4초, 2026-10-06) |
| 에이전트 워크트리에서 변수(`$X` · `$(…)`)를 든 복합 명령이나 `git` 글자가 든 heredoc 이 `cannot be shown …` 으로 거절된다 | Claude Code 의 워크트리 격리가 실행 때 정해지는 명령을 막는다(2026-10-06) | 단순 명령 여럿으로 나누고 앞 출력의 값은 글자로 옮긴다. 파일은 편집 도구로 고친다 |
| `gh pr update-branch` 가 없다 · `gh pr edit` 가 classic Projects 오류로 선다 | Ubuntu apt 의 `gh` 2.46 | cli.github.com 의 apt 저장소에서 공식 `gh` 를 깐다(이 기계는 2026-10-06 부터 2.102.0) |
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
