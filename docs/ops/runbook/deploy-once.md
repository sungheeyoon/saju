# 운영 절차 — 한 번만 하는 배포

색인은 `docs/ops/runbook.md` 다.

## 카드 점수 `v2-beta` 배포 — **마이그레이션 → 백필 → 앱** (ADR 0113 · 0114, 한 번만)

`20261025160000_the_card_score_reads_the_day_pillars_and_the_needs.sql` 부터 후보 카드의 점수는 **필요한 기운 요약**
(`discovery_profile.need_summary`)을 읽고, 요약이 없거나 지금 셈 이름(`discovery_need_rule()`)의 것이 아닌 참여자는
**풀에서 빠진다** — 가운데 값을 넣지 않는다. 그래서 앱보다 먼저 기존 참여자를 채운다.

1. **마이그레이션.** `docs/ops/runbook/deploy.md` 「묶음 배포」의 0 처럼 `npx supabase migration list` → `npm run db:push`. 이 순간부터 앱이 새 것으로
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
5. **앱.** `docs/ops/runbook/deploy.md` 「묶음 배포」. 새 앱은 참여 문을 부를 때마다 요약을 새로 짓는다.
6. **두 문은 남긴다**(운영자 결정 2026-09-25). `need_summary_backfill_targets` · `set_discovery_need_summary` 는 `service_role`
   에만 열린 운영 문이고 `set_person_chart` 처럼 영구히 선다 — 아래처럼 규칙이 바뀔 때마다 백필이 다시 지난다.

**엔진이 억부 규칙이나 오행 무게를 올리는 날에도 같은 순서다** — `discovery_need_rule()` 을 새 이름으로 올리는
마이그레이션 → 백필(옛 이름의 요약이 대상이 된다) → 앱. 두 이름이 어긋나면 `scripts/card-score-sql.test.ts` 가 깨진다.

## 가입 코드 배포 — **훅을 먼저 끈다** (ADR 0042, 한 번만)

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
