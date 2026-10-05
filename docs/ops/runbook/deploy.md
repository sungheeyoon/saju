# 운영 절차 — 배포

색인은 `docs/ops/runbook.md` 다.

## 배포

**`main` 에 머지해도 배포되지 않는다**(ADR 0110). `vercel.json` 의 `git.deploymentEnabled: false` 가 가지 · `main` 의 푸시로
생기는 배포를 전부 끈다 — Preview 도 Production 도 없다. 운영(https://saju-snowy.vercel.app)에는 **기능 묶음이 끝났을 때
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

0. **올리기 전에.** 머지를 기다리는 PR 이 없는지(`gh pr list`), 최신 `main` 의 CI(`verify` · `main-red`)가 초록인지, 지난
   배포 뒤 `supabase/migrations/**` 가 바뀌었으면 **DB 를 먼저** 올리고 확인했는지(아래 규약 넷의 2 · 4) 본다. 올릴
   `main` 의 SHA 를 적는다. 한도 창의 남은 자리를 본다 — 모자라면 기다린다
1. **최신 main 을 Production 으로 올린다.** 깨끗한 `main` 체크아웃(또는 그 SHA 의 워크트리)에서 `vercel deploy --prod`, 아니면
   Vercel → Deployments → 「Create Deployment」에 `main` 을 넣는다. Production 은 `ignoreCommand` 가 건너뛰지 않는다. 빈 커밋을
   밀어 깨우지 않는다 — Git 배포는 꺼져 있어 아무 일도 안 일어난다
   **CLI 는 폴더를 통째로 올린다** — 쓰던 체크아웃에는 `.next` · `.next-check` 같은 빌드 캐시가 수백 MB 쌓여 `File size limit
   exceeded (100 MB)` 로 멈춘다(`.vercelignore` 가 없다, 2026-09-25). `git worktree add --detach <임시 폴더> <SHA>` 로 그 SHA 만
   꺼내고 `.vercel` 만 복사해 거기서 `vercel deploy --prod --yes` 를 부른다(12MB). 출력이 잘려 실패처럼 보여도 `vercel ls` 를 먼저
   본다 — 이미 올라갔을 수 있고, 다시 부르면 한도를 하나 더 쓴다
2. **배포 커밋 = main HEAD 인지 본다** — `git ls-remote origin main` 의 SHA 와 대시보드의 Source 커밋(또는
   `vercel inspect <배포 URL>`)이 같아야 한다. 다르면 옛 코드가 Production 이다 — 1 로 돌아간다
3. **Ready 를 본다** — `vercel ls saju` 에서 그 배포가 `● Ready` · `Production` 이고, `vercel inspect` 의 Aliases 에
   `https://saju-snowy.vercel.app` 이 선다
4. **smoke — 다섯 화면.** 홈(`/`) · 로그인(`/auth`) · 궁합(두 사람을 고르는 칸이 서는 화면) · 사람 목록(`/me/people`) ·
   운영자 신고 화면(`/ops/reports`). 로그인이 드는 셋은 운영자 계정으로 본다. 각각 제 제목이 서고 500 · 빈 화면 ·
   브라우저 콘솔의 CSP 위반이 없어야 통과다
5. **적는다** — 배포 SHA · Production URL · Ready 시각(서울) · smoke 다섯의 통과/실패를 그 일의 이슈에(G-24 검증이면
   `ops-verification` 이슈). 실패가 있으면 「CSP 가 화면을 막을 때」의 1 처럼 앞 배포를 Promote 해 되돌린다

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
   가입 훅처럼 **되돌릴 수 없는 걸음이 끼면 그 순서가 곧 안전이다**(아래 「가입 코드 배포」).
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
   `curl -sI https://saju-snowy.vercel.app/ | grep -i content-security` 로 운영 헤더를 확인한다.

### 카드 점수 `v2-beta` 배포 — **마이그레이션 → 백필 → 앱** (ADR 0113 · 0114, 한 번만)

`20261025160000_the_card_score_reads_the_day_pillars_and_the_needs.sql` 부터 후보 카드의 점수는 **필요한 기운 요약**
(`discovery_profile.need_summary`)을 읽고, 요약이 없거나 지금 셈 이름(`discovery_need_rule()`)의 것이 아닌 참여자는
**풀에서 빠진다** — 가운데 값을 넣지 않는다. 그래서 앱보다 먼저 기존 참여자를 채운다.

1. **마이그레이션.** 위 「묶음 배포」의 0 처럼 `npx supabase migration list` → `npm run db:push`. 이 순간부터 앱이 새 것으로
   가기 전까지 **요약이 없는 참여자는 후보 목록에서 안 보인다** — 2 를 바로 잇는다. 옛 앱은 참여 문을 두 인자로 부르고,
   새 인자(`p_need`)는 `default null` 이라 그대로 돈다(있던 요약을 안 지운다).
2. **백필 — 셈만 먼저.** 운영 접속값을 **환경변수로만** 준다(스크립트는 `.env.*` 를 스스로 안 읽는다).

   ```bash
   NEXT_PUBLIC_SUPABASE_URL=<운영 URL> SUPABASE_SECRET_KEY=<운영 secret> npx jiti scripts/backfill-need-summary.ts
   ```

   찍는 것은 `targets` · `would-update` · `skipped` · `failed` 수뿐이다. `failed` 가 0 이 아니면 멈추고 본다.
3. **백필 — 적는다.** 같은 줄 끝에 `--apply`. 한 번 더 `--apply` 로 돌려 `targets: 0` 인지 본다(멱등이다 — 다 채운
   뒤에는 대상이 없다). `skipped` 는 읽은 뒤 그 사람이 입력을 고쳐 안 적은 수다 — 그 사람은 앱을 열 때 채운다.
4. **값으로 적는다.** `npm run db:remote -- --purpose "v2-beta 백필 확인" "select count(*) filter (where need_summary is null) as missing, count(*) filter (where need_summary ->> 'rule' is distinct from public.discovery_need_rule()) as stale, count(*) as participants from public.discovery_profile where opted_in_at is not null"`
   — `missing` · `stale` 이 0 이어야 한다. 셋을 그 일의 이슈에 적는다.
5. **앱.** 위 「묶음 배포」. 새 앱은 참여 문을 부를 때마다 요약을 새로 짓는다.
6. **두 문은 남긴다**(운영자 결정 2026-09-25). `need_summary_backfill_targets` · `set_discovery_need_summary` 는 `service_role`
   에만 열린 운영 문이고 `set_person_chart` 처럼 영구히 선다 — 아래처럼 규칙이 바뀔 때마다 백필이 다시 지난다.

**엔진이 억부 규칙이나 오행 무게를 올리는 날에도 같은 순서다** — `discovery_need_rule()` 을 새 이름으로 올리는
마이그레이션 → 백필(옛 이름의 요약이 대상이 된다) → 앱. 두 이름이 어긋나면 `scripts/card-score-sql.test.ts` 가 깨진다.

### 가입 코드 배포 — **훅을 먼저 끈다** (ADR 0042, 한 번만)

`20260911090000_the_code_opens_the_signup.sql` 이 `gate_signup_by_invite` 를 지운다.
원격의 훅이 **그 함수를 가리킨 채로** 남아 있으면 GoTrue 가 없는 함수를 부르고,
그때 **아무도 로그인하지 못한다.** 로컬에서 실제로 그 상태를 봤다.

    Error running hook URI: pg-functions://postgres/public/gate_signup_by_invite

순서가 곧 안전이다.

**1. 훅을 끈다 (대시보드)**

<https://supabase.com/dashboard/project/xgdeguyxgkillndraonc/auth/hooks>

메뉴로 가면 왼쪽 사이드바의 **Authentication** → 그 안의 **Hooks** 다. 그 화면에 훅
종류가 카드로 서 있고 우리 것은 **Before User Created** 하나다 — 값에
`pg-functions://postgres/public/gate_signup_by_invite` 가 적혀 있는 그 카드다. 거기서
훅을 **끄거나 지운다**(활성 토글을 내리거나, 지정된 Postgres 함수를 비운다).

저장한 뒤 **화면을 새로 고쳐 실제로 꺼졌는지 눈으로 확인한다.** 이 한 걸음이 안 되면
다음 걸음이 서비스를 닫는다.

> `supabase config push` 로 대신하지 않는다. **원격의 구글 설정을 지운다**(`docs/ops/runbook/access.md` 맨 위 경고).

**2. 마이그레이션을 올린다**

```bash
npm run db:push
```

**3. 앱을 배포한다** — `main` 에 머지하면 자동으로 나간다.

**4. 첫 코드를 넣는다** — `docs/ops/runbook/signup.md` 「초대」의 `insert into public.signup_code …`.

**5. 확인한다** — 로그인이 되는가(훅이 안 남았는가), 코드 없이 `/me` 로 가면 `/signup`
이 서는가, 넣은 코드로 가입이 끝나는가.

```sql
-- 오늘 코드와 남은 자리
select c.code, c.max_uses, count(u.id) as 들어온사람
from public.signup_code c
left join public.app_user u on u.signup_code = c.code
where c.valid_on = (now() at time zone 'Asia/Seoul')::date
group by c.code, c.max_uses;

-- 가입이 안 끝난 계정 — 코드를 못 넣었거나 안 넣은 사람이다. 그대로 둬도 된다.
select au.email, u.signed_up_at
from public.app_user u join auth.users au on au.id = u.id
where u.signed_up_at is null;
```

**되돌려야 하면** 훅을 다시 켤 수는 없다 — 가리킬 함수가 없어졌기 때문이다. 되돌리는
길은 마이그레이션을 되돌리는 것 하나다. 그래서 **1번을 눈으로 확인한 뒤에만 2번으로 간다.**

배포 전 확인은 `npm run verify` 와 네 층 전부:

```bash
npm test && npm run test:db && npm run test:flow
npm run test:e2e          # 백엔드 없이 돈다
npm run test:e2e:authed   # `npm run db:start` 를 요구한다
```

**e2e 가 두 명령인 것은 계약이다.** 로그인하지 않은 사람을 돌려보내는 데 백엔드가
필요하면 그것부터 잘못이라, 그쪽은 CI 의 껍데기 접속값으로도 돈다. 로그인 흐름만
로컬 스택을 요구한다.

### 도메인을 옮길 때 — 주소를 든 자리 아홉

**지금은 자기 도메인이 없다** — 운영은 Vercel 별칭 `saju-snowy.vercel.app` 이다. 도메인을 사는 날 밟는다. 코드는 주소를
안 적으므로(`app/site-url.ts` 가 배포판이 아는 값을 읽는다) **바꿀 것은 전부 코드 밖이다.** 2026-09-30 에 저장소에서
주소를 드는 자리를 셌다(`grep -rn "saju-snowy\|SITE_URL\|redirectTo\|vault.create_secret"`) — 아래 아홉이다.

**순서가 뜻을 갖는다 — 옛 주소를 끝까지 살려 둔다.** 밖에서 우리를 부르는 것(복구기 · OpenAI 의 webhook · 구글 로그인의
되돌아옴)은 `POST` 나 한 번뿐인 되돌림이라 **308 넘김을 믿을 수 없다.** 새 주소가 서고, 부르는 쪽을 다 옮기고, 새 주소로
하나씩 닿는 것을 본 **뒤에** 옛 주소를 넘김으로 바꾼다. 두 주소가 함께 서는 동안은 아무것도 안 끊긴다.

| # | 자리 | 무엇을 하나 | 안 하면 | 확인 |
| --- | --- | --- | --- | --- |
| 1 | **Vercel 도메인** | Project → Settings → Domains 에 더하고 DNS(A · CNAME)를 건다. 이 단계에서는 옛 별칭을 **넘김으로 바꾸지 않는다** | — | `curl -sI https://<새 도메인>/` 가 200 이고 인증서가 선다 |
| 2 | **다시 배포** | 위 「묶음 배포」를 한 번. `VERCEL_PROJECT_PRODUCTION_URL` 은 배포마다 채워지는 값이라 도메인을 붙인 뒤의 배포부터 새 주소를 든다. 대표 주소를 못박고 싶으면 Vercel **Production** 에 `SITE_URL=https://<새 도메인>` 을 넣는다(`app/site-url.ts` 가 맨 앞에 읽는다) | 링크 미리보기의 그림 주소(`metadataBase`)가 옛 별칭을 가리킨다 — 옛 별칭이 살아 있는 동안은 보이지만, 넘김으로 바꾼 뒤 수집기가 못 따라가면 그림이 빈다 | `curl -s https://<새 도메인>/ \| grep -o 'og:image" content="[^"]*'` 가 새 도메인이다 |
| 3 | **Supabase Auth URL** | 대시보드 Authentication → URL Configuration 의 Site URL 을 새 주소로, Redirect URLs 에 `https://<새 도메인>/auth/callback` 을 더한다(옛 것은 6 까지 둔다). **`supabase config push` 로 넣지 않는다**(`docs/ops/runbook/access.md` 맨 위 경고) | `redirectTo`(`app/auth/sign-in-button.tsx`)가 목록에 없으면 Supabase 가 **Site URL 로 돌려보낸다** — 새 주소에서 로그인한 사람이 옛 주소에 떨어지고, 세션 쿠키는 오리진마다라 새 주소에서는 로그아웃 상태다 | 새 주소의 새 창에서 구글 로그인 → 새 주소의 `/me` 에 선다 |
| 4 | **구글 OAuth 동의 화면** | Google Cloud Console → OAuth consent screen 의 승인된 도메인 · 앱 홈 · 처리방침 링크가 있으면 새 도메인으로. 승인된 리디렉션 URI 는 **Supabase 의 `…supabase.co/auth/v1/callback`** 이라 그대로다 | 브랜드 확인을 받은 뒤라면 동의 화면이 경고를 띄울 수 있다 | 3 과 같은 로그인이 경고 없이 지난다 |
| 5 | **Vault `reading_recovery_url`** | `select vault.update_secret((select id from vault.secrets where name = 'reading_recovery_url'), 'https://<새 도메인>/api/cron/reading');` — 1분 복구기가 `pg_net` 으로 부르는 주소(`docs/ops/runbook/access.md` 「비밀이 새면」 표) | 넘김으로 바꾼 뒤 복구기가 308 을 받는다 → `cron-watch` 가 `net-request-failed` 를 보낸다. 결과는 webhook 이 살아 있으면 붙지만 멈춘 풀이를 아무도 안 줍는다 | 2분 뒤 `select status_code, created from net._http_response order by created desc limit 3;` 가 200 |
| 6 | **OpenAI webhook** | platform.openai.com → Settings → Webhooks 의 endpoint 를 `https://<새 도메인>/api/openai/webhook` 으로. 주소를 고칠 수 없어 새로 만들면 **서명 비밀이 바뀐다** — `docs/ops/runbook/access.md` 「비밀이 새면」의 `OPENAI_WEBHOOK_SECRET` 줄을 그대로 밟는다 | 결과가 1분 늦게 복구기로만 붙는다(ADR 0020). 비밀만 바뀌고 Vercel 에 안 넣으면 401 | 새 풀이 하나가 끝나고 `reading_run` 의 그 줄이 1분 안에 `succeeded` |
| 7 | **PortOne webhook** | **지금은 꺼져 있다**(`docs/ops/runbook/credits.md` 「결제 알림」). 켜는 날 콘솔에 넣는 주소가 새 도메인이다 | — | 켤 때 그 절의 「웹훅 테스트 호출」 |
| 8 | **옛 주소를 넘김으로** | 1~6 을 새 주소로 본 뒤, Vercel Domains 에서 `saju-snowy.vercel.app` 을 새 도메인으로 308 넘긴다. **지우지 않는다** — 이미 보낸 공유 링크(`/share/…`)가 그 주소를 들고 있다 | 옛 링크가 죽는다 | `curl -sI https://saju-snowy.vercel.app/share/x` 가 308 · `location: https://<새 도메인>/share/x` |
| 9 | **이 문서** | 「배포」의 운영 주소 · 「묶음 배포」 3 의 Aliases · 「CSP 가 화면을 막을 때」의 `curl` 이 옛 별칭을 든다. 새 도메인으로 고치는 PR 을 같은 날 넣는다. `scripts/check-share.mjs` 의 `HOST` 는 흉내 낸 값이라 그대로다 | 다음 사람이 옛 주소로 smoke 한다 | `grep -rn saju-snowy docs/ops` 가 넘김 설명 한 줄만 |

**안 바뀌는 것.** CSP(`next.config.ts`)는 `'self'` 와 Supabase 주소뿐이다. Vercel Cron(`vercel.json`)은 경로만 든다. 접속기록
반출의 AWS 역할은 Vercel OIDC 의 팀 · 프로젝트로 믿으므로 도메인과 상관없다(`docs/ops/runbook/security.md` 「반출 — 매일 S3」). 알림 주소(`ops_alert_url`)는
Slack · Discord 쪽이다.

**모두가 한 번 다시 로그인한다** — 세션 쿠키는 오리진마다다. 미리 알릴지 · 무엇이라 알릴지는 옮기는 날 운영자가 정한다
(화면 문구 — `docs/agents/delegation/decisions.md` 「결정 점검표」).
