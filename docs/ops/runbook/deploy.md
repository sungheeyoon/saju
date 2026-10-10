# 운영 절차 — 배포

색인은 `docs/ops/runbook.md` 다.

## 배포

**`main` 에 머지해도 배포되지 않는다**(ADR 0110). `vercel.json` 의 `git.deploymentEnabled: false` 가 가지 · `main` 의 푸시로
생기는 배포를 전부 끈다. 운영(주소는 `docs/ops/runbook/domain.md` 맨 위)에는 **기능 묶음이 끝났을 때
`main` 의 정확한 SHA 를 손으로 한 번** 올린다(아래 「묶음 배포」). 화면 확인은 로컬 e2e 와 스크린샷으로 하고, 밖에서 열어 볼
주소가 꼭 필요할 때만 Preview 를 손으로 하나 만든다(`vercel deploy`, `--prod` 없이).

**손으로 만든 배포도 앱이 바뀐 커밋만 빌드한다**(2026-09-24 운영자 결정 — Git 배포를 끈 뒤에도 남겨 둔다). `vercel.json` 의 `ignoreCommand` 가
`scripts/vercel-ignore.mjs` 를 부르고, 지난 성공 배포(`VERCEL_GIT_PREVIOUS_SHA`, 가지의 첫 배포면 `main` 과의 갈림점)
뒤에 바뀐 파일이 **전부** 문서(`docs/**` · `*.md`) · 마이그레이션 · pgTAP · `src`/`scripts` 의 단위 시험이면 건너뛴다.
Production 은 늘 빌드하고, 기준을 못 찾거나 git 이 실패하면 빌드한다. Vercel 은 **0 이면 건너뛰고 1 이면 빌드한다** —
`scripts/vercel-ignore.test.ts` 가 그 반대 의미를 든다. 건너뛴 배포는 `CANCELED` 로 서고 **하루 배포 수에는 여전히
센다**(Vercel 문서 「Ignored Build Step」의 note) — 아끼는 것은 빌드 시간과 동시 빌드 자리다. 건너뛴 가지를 굳이
빌드하려면 Deployments → Redeploy 에서 「Use project's Ignore Build Step」을 끈다.

마이그레이션은 따로 올린다.

```bash
npx supabase migration list   # remote 칸이 빈 줄이 밀린 것이다 — 먼저 본다
npm run db:push               # 밀린 것 전부를 원격에 적용한다 — 잠금 하나를 잡고 돈다(ADR 0096)
```

**`ignoreCommand` 는 빌드만 건너뛰고 배포 횟수는 줄이지 못한다.** Hobby 의 한도는 **24시간 이동 창에 100번**(그 밖에 한 시간
100 · 5분 60)이고 건너뛴 · 실패한 · 취소된 배포도 센다(Vercel 「Limits」). 2026-09-24 에는 Preview 편의를 우선해 Git 배포를
켜 두었는데(가지의 푸시 하나가 Preview 하나, 머지 하나가 Production 하나), 2026-09-25 에 하루 두 번 한도에 닿아 머지된 수정이
운영에 못 들었다. 그래서 끄고 **여러 PR 머지 → 운영 배포 한 번**으로 옮겼다(ADR 0110). 긴급 장애 수정만 곧바로 올린다.

#### 묶음 배포 — 최신 main 을 Production 으로 한 번

머지는 운영에 아무것도 안 올린다. 묶음이 끝났을 때(하루 한 번, 또는 한 라운드를 닫을 때) 한 번 올린다.

0. **올리기 전에.** 올리라고 한 변경은 그 PR 이 main 에 들면 올린다(ADR 0152). 묶음이면 머지를 기다리는 PR 이 없는지(`gh pr list`),
   `node scripts/deploy-range.mjs` 가 `wait` 면 `main` CI 가 초록인지(ADR 0159), 지난
   배포 뒤 `supabase/migrations/**` 가 바뀌었으면 **DB 를 먼저** 올리고 확인했는지(아래 규약 넷의 2 · 4) 본다. 1 은
   출력의 `head` 를 그대로 올린다. 한도 창의 남은 자리를 본다 — 모자라면 기다린다. `--from <운영 SHA>` 가 `docs-only` 면 안 올린다(운영 SHA 는 근거가 아니다)
1. **0 의 `head` 를 Production 으로 올린다.** 그 SHA 의 워크트리(아래)에서 `vercel deploy --prod`, 아니면
   Vercel → Deployments → 「Create Deployment」에 그 SHA 를 넣는다. Production 은 `ignoreCommand` 가 건너뛰지 않는다. 빈 커밋을
   밀어 깨우지 않는다 — Git 배포는 꺼져 있어 아무 일도 안 일어난다
   **CLI 는 폴더를 통째로 올린다** — 쓰던 체크아웃에는 `.next` · `.next-check` 같은 빌드 캐시가 수백 MB 쌓여 `File size limit
   exceeded (100 MB)` 로 멈춘다(`.vercelignore` 가 없다, 2026-09-25). `git worktree add --detach <임시 폴더> <SHA>` 로 그 SHA 만
   꺼내고 `.vercel` 만 복사해 거기서 `vercel deploy --prod --yes` 를 부른다(12MB). 출력이 잘려 실패처럼 보여도 `vercel ls` 를 먼저
   본다 — 이미 올라갔을 수 있고, 다시 부르면 한도를 하나 더 쓴다
2. **배포 커밋 = 0 의 `head` 인지 본다** — 대시보드의 Source 커밋(또는 `vercel inspect <배포 URL>`)이 그 SHA 여야
   한다. 다르면 판정하지 않은 코드가 Production 이다 — 1 로 돌아간다
3. **Ready 를 본다** — `vercel ls saju` 에서 그 배포가 `● Ready` · `Production` 이고, `vercel inspect` 의 Aliases 에
   운영 주소가 선다
4. **smoke — 다섯 화면.** 홈(`/`) · 로그인(`/auth`) · 궁합(두 사람을 고르는 칸이 서는 화면) · 사람 목록(`/me/people`) ·
   운영자 신고 화면(`/ops/reports`). 로그인이 드는 셋은 운영자 계정으로 본다. 각각 제 제목이 서고 500 · 빈 화면 ·
   브라우저 콘솔의 CSP 위반이 없어야 통과다
5. **적는다** — 배포 SHA · Production URL · Ready 시각(서울) · smoke 다섯의 통과/실패를 그 일의 이슈에(G-24 검증이면
   `ops-verification` 이슈). 실패가 있으면 「CSP 가 화면을 막을 때」의 1 처럼 앞 배포를 Promote 해 되돌린다.
   **Promote 할 앞 배포는 지금 운영 DB 에서 서야 한다** — 좁히기(「규약 넷」의 3)가 지운 문을 부르는 앱은 그 자리가 실패한다.
   2026-10-10 G-77 좁히기(`20261127090000`) 뒤로 `41a91368`(#526) 앞의 앱은 채팅 읽음이 실패한다

한도에 걸려 올리지 못했으면 창이 비는 시각(가장 오래된 배포 + 24시간)을 적고 그 뒤에 0 부터 다시 밟는다.

### 규약 넷 — 앱과 DB 는 따로 간다 (ADR 0090)

세션 메모에만 있던 것을 2026-09-22 에 옮겼다. 에이전트가 이 절을 밟는 걸음은 공식 운영에 들어간 뒤에는
사람이 답한 뒤고, 운영 베타에서는 직접 밟고 본 값을 적는다(`docs/agents/delegation/permissions.md` 권한 등급 3,
ADR 0093).

1. **앱 배포 ≠ DB 마이그레이션.** main 머지는 아무것도 내보내지 않고, 묶음 배포는 앱만 내보낸다. 마이그레이션이 든 PR 이
   머지돼도 원격 DB 는 그대로다 — 2026-09-12 에 마이그레이션 넷이 안 오른 채 최신 앱이 돌아 후보 카드의
   점수는 SQL 이, 궁합풀이의 기준점은 TS 가 서로 다른 셈으로 냈다. 그리고 **마이그레이션을 쓴 그
   순간부터 이 기계의 dev 화면은 깨져 있다** — dev 서버가 `.env.development.local` 로 운영 DB 를
   보므로 새 함수를 부르는 화면이 `PGRST202` 로 죽는다. pgTAP 도 CI 도 못 잡는다(둘 다 로컬 DB 다).
2. **마이그레이션이 먼저, 앱이 나중.** 새 앱이 없는 함수를 부르는 창을 안 만든다. 그러려면
   마이그레이션이 **옛 앱에도 안전**해야 한다 — 새 열은 기본값을 들고, 새 인자는 `default` 를 든다.
   가입 훅처럼 **되돌릴 수 없는 걸음이 끼면 그 순서가 곧 안전이다**(`docs/ops/runbook/deploy-once.md` 「가입 코드 배포」).
3. **넓히고, 재고, 좁힌다.** RPC 의 인자를 바꾸면 그것은 고친 함수가 아니라 새 함수다. 옛 서명을
   같은 마이그레이션에서 지우면 어느 순서로 배포해도 창이 생긴다 — 마이그레이션 먼저면 떠 있는
   앱이 없어진 함수를 부르고, 배포 먼저면 새 앱이 아직 없는 함수를 부른다. 이 저장소에서 그 창에
   든 호출은 **모델이 이미 돌아 토큰은 나가고 글은 안 남는다.** 새 서명을 세우고 옛 것을 남긴 채
   올리고(넓히기, ADR 0071 A 단계), 프로덕션에서 새 값이 실제로 실리는가 · 도는 시도가 0 인가 ·
   마지막 시도가 성공했는가를 본 뒤(재기), 옛 서명을 지운다(좁히기, #60). **두 벌인 동안은 시험이
   그 상태를 값으로 든다** — 열쇠에 열린 함수 목록에 같은 이름을 두 번 적어 두었다가 좁히는 날 한
   줄을 뺀다. 반환 열이 느는 쪽은 안전하다(옛 앱은 아는 필드만 집는다) — 위험한 것은 **인자**다.
4. **올린 뒤 무엇을 보나.** 등록은 `migration list` 의 remote 칸, 캐시는 발행 키로 RPC 를 불러
   `PGRST202`(못 찾음)인지 `42501`(권한 거절)인지 — 뒤엣것이면 PostgREST 가 함수를 찾은 것이다.
   잡을 건드렸으면 `cron.job_run_details`(`docs/ops/runbook/jobs.md` 「도는 잡이 정말 도나」). 앱은 Vercel 의 Ready.

**`db push` 뒤에 새 함수를 손으로 다시 적을 때는 프로덕션의 살아 있는 정의에서 뜬다** — 옮겨
적으면 그 사이에 바뀐 것을 되돌린다(ADR 0043 의 풀이권 함수가 그랬다).

### CSP 가 화면을 막을 때 — **보고만 하는 정책으로 되돌린다** (G-23 ②)

CSP 는 2026-09-23 부터 강제다(`next.config.ts` 의 `contentSecurityPolicy`). 강제에서 어긴 것은 곧 깨진
화면이다 — 스크립트 · 요청 · 이미지가 막히고, 브라우저 콘솔에 `Refused to …because it violates the
following Content Security Policy directive` 가 선다. 받는 서버(`report-uri`)는 두지 않았으므로 **운영에서
알 길은 사용자의 제보와 콘솔뿐이다.**

1. **먼저 되돌린다.** 이 커밋 앞의 배포를 Vercel 에서 **Promote** 하거나(가장 빠르다, 코드 안 바꿈), `next.config.ts`
   의 헤더 키 `Content-Security-Policy` 를 `Content-Security-Policy-Report-Only` 로 바꾸고 `frame-ancestors 'none'`
   한 줄짜리 강제 헤더를 다시 세워 가지 → PR → gate → `--auto` 로 넣는다(급하면 운영자가 보호를 잠시 끄고, 켤 때까지를 노트에
   적는다 — ADR 0121) — `frame-ancestors` 는 보고만 하는 정책에서 무시된다.
2. **원인을 본다.** 콘솔 문장의 지시어(`connect-src` · `img-src` …)와 막힌 주소가 답이다. 새 외부 출처면
   그 지시어에 **그 출처 하나만** 더한다 — `*` 이나 `https:` 로 넓히지 않는다. 우리 코드가 인라인 `eval`
   이나 `data:` 스크립트를 새로 부른 것이면 코드를 고친다.
3. **다시 강제한다.** 고친 가지에서 e2e 전부를 돌린다 — 자동 손잡이(`e2e/csp.ts`)가 어긴 자리 0 을 든다.
   `curl -sI <운영 주소>/ | grep -i content-security` 로 운영 헤더를 확인한다.
