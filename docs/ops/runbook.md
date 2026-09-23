# 운영 절차

폐쇄 초대 MVP 를 운영하는 데 필요한 일들. **화면은 없다** — `prd-archive` 가 초기에는 UI 대신
감사 가능한 관리자 절차를 쓸 수 있다고 했고, 지금이 그 단계다. 이 문서가 그 「절차」다.

여기 적힌 것을 그대로 실행할 수 있어야 한다. 기억에 기대면 초대 하나를 넣는 데도
표 이름을 더듬게 되고, 급할 때 더듬는 것은 대개 제재 쪽이다.

## 어디서 실행하나

Supabase 대시보드의 SQL Editor 에서 **원격 프로젝트**에 대고 실행한다.
`xgdeguyxgkillndraonc` — 배포된 앱이 보는 곳이다. **서울(`ap-northeast-2`)에 있다.**

> **옛 ref `skxtqxajfmxiusqrgbuf` 는 이제 아니다.** 프로젝트를 서울로 옮겼고, 이 문서가
> 한동안 옛 ref 를 가리키고 있었다. 여기 적힌 SQL 을 그 프로젝트에 대고 돌리면 아무
> 사용자도 없는 곳을 고치게 된다 — 실행 전에 주소창의 ref 를 눈으로 맞춘다.

로컬에서 연습하려면 `npm run db:start` 뒤에:

```bash
docker exec -i supabase_db_saju psql -U postgres -c "<문장>"   # 워크트리면 supabase_db_saju_wtN
```

> **`supabase config push` 를 쓰지 않는다.** 원격의 구글 설정을 지운다.

### 접속값은 여섯이고 넣는 손은 하나다

서울로 옮기면서 **Vercel 마켓플레이스 통합을 끊었다.** 그 통합이 같은 값을 이름 두 벌로
넣어 주고 있었고(`NEXT_PUBLIC_` 접두사, 그리고 옛 `anon`·`service_role` 이름), 코드가
주소를 이름 둘로 찾고 있었다. 지금은 넣는 자리가 손 하나뿐이라 그 갈래가 도달할 수 없다.

| 이름 | 어디서 쓰나 |
| --- | --- |
| `NEXT_PUBLIC_SUPABASE_URL` | 브라우저와 서버 양쪽 |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | 브라우저 |
| `SUPABASE_SECRET_KEY` | 서버 전용 — `definer` 함수를 부르는 자리 |
| `OPENAI_API_KEY` · `OPENAI_WEBHOOK_SECRET` | 풀이 생성과 webhook. 키는 Production · Preview, 서명 비밀은 Production 만(2026-09-24 `vercel env ls`) |
| `CRON_SECRET` | 복구기를 깨우는 자리 |

- **`NEXT_PUBLIC_` 이 붙으면 브라우저가 본다.** 열쇠를 그 접두사로 넣는 순간 공개된다.
- `POSTGRES_*` 일곱과 `SUPABASE_JWT_SECRET`, 옛 이름 키 넷은 **코드가 한 번도 안 읽어서**
  함께 지웠다. 다시 생기면 통합이 도로 붙은 것이다.
- **열쇠 쪽 이름 갈래는 로컬에만 남겼다.** `supabase status` 가 `SECRET_KEY` 를 안 내주는
  판본에서는 `SERVICE_ROLE_KEY` 뿐이라, 그 갈래가 없으면 로컬 시험이 열쇠 없는 배포와
  같은 얼굴로 실패한다(`playwright.config.ts` 가 이름 둘을 다 덮는 까닭).
- `vercel env pull` 은 **`--environment=production`** 이어야 운영 값이 온다. 그래도
  Secret 로 넣은 것은 안 내려온다 — `"[SENSITIVE]"` 자리표시자로 온다. **그대로 두지 마라** —
  값이 「있는」 것으로 세어져 `keyed-client.ts` 의 「열쇠가 없습니다」 검사를 지나가고 401 로
  떨어진다. 주석 처리해 두면 오류가 이름을 대 준다. 실호출에 드는 것은 `OPENAI_API_KEY` 한 줄이고
  손으로 붙인다.
- **CLI 로 임의 SQL 이 된다** — `npm run db:remote -- "<sql>"`(= `npx supabase db query --linked`, 기계 전체에서 한 번에 하나, ADR 0096). Management API 로 붙고
  `postgres` 로 돌므로 비밀번호도 `psql` 도 필요 없다. 다만 `postgres` 라 「비운영자 당사자에게
  무엇이 보이나」는 못 잰다 — 역할별 조회는 대시보드 SQL Editor(마지막 문장의 결과만 준다 — 역할을
  바꿔 가며 잰 줄은 임시 표에 모아 끝에서 한 번에 낸다)나 `SUPABASE_SECRET_KEY` 가 필요하고, 익명
  수준은 발행 키로 REST 를 두드려 잰다(없으면 `404` PGRST202, 닫혀 있으면 `42501`). 다중 문장은
  못 받는다(`begin; … rollback;` 이 죽는다).
- **`.env.development.local` 은 이름과 달리 운영 DB 를 가리킨다.** 로컬 스택에 대고
  돌릴 것을 여기 대고 돌리지 않는다.

### 비밀이 새면 — **교체가 먼저다** (G-23 ⑧)

비밀은 **서버 환경변수(Vercel)와 Supabase Vault 에만 있다.** 브라우저로 가는 파일에 비밀 이름이나
그 빌드의 비밀 값이 있으면 `npm run build` 끝의 `scripts/secret-env.mjs` 가 빌드를 세운다 — Vercel 의
운영 빌드도 진짜 값을 들고 이 검사를 지나며, 값은 찍지 않고 이름과 파일만 말한다. 코드가 읽는 이름의
갈래(비밀 · 공개 · 설정)와 비밀을 읽는 모듈의 `import 'server-only'` 는 `scripts/secret-env.test.ts` 가
잰다. **그 시험이 이 절도 읽는다** — 앱의 비밀과 마이그레이션이 Vault 에서 읽는 이름마다 아래 표에 줄이
있어야 초록이다. 새 비밀은 이 표에 줄이 서야 들어온다.

**순서는 넷이고 늘 같다.**

1. **새 값을 만든다 — 옛 값을 끄기 전에.** 둘이 함께 유효한 동안에는 아무것도 안 멈춘다.
2. **넣는다.** Vercel 은 대시보드 Settings → Environment Variables 에서 그 이름의 값을 고친다(표가
   말하는 환경 전부). **Vercel 변수는 새 배포부터 읽힌다** — Deployments 의 최신 Production 에서
   Redeploy 하고 Ready 를 본다. 값 교체는 사람이 대시보드에서 한다(에이전트에게 `vercel env rm` 은
   등급 4 다, `docs/agents/delegation.md`). Vault 는 SQL Editor 에서 고치고 재배포가 없다 — 다음 호출이 읽는다:

   ```sql
   select vault.update_secret((select id from vault.secrets where name = '<이름>'), '<새 값>');
   select name, updated_at from vault.secrets order by name;   -- 값은 안 본다
   ```

   로컬 `.env.development.local` 에 그 이름이 있으면 손으로 고친다(Secret 은 `vercel env pull` 로 안 온다).
3. **확인한다** — 표의 「확인」.
4. **옛 값을 끊는다.** 끊기 전에 3 을 본다 — 끊는 순간부터 옛 값을 든 자리는 멈춘다.

| 비밀 | 새 값은 어디서 | 넣는 자리 | 옛 값이 먼저 끊기면 멈추는 것 | 확인 · 끊기 |
| --- | --- | --- | --- | --- |
| `SUPABASE_SECRET_KEY` | Supabase 대시보드 → Project Settings → API Keys → Secret keys 에서 새 키. 여럿이 함께 선다 | Vercel **Production** · 로컬 → 재배포 | 열쇠를 쓰는 자리 전부(`app/keyed-client.ts`) — 풀이 생성의 계산 입력과 저장, webhook 영수증(503 이라 provider 가 72시간 다시 보낸다), 복구기(503 → `net-request-failed` 알림) | 새 배포에서 풀이 하나가 끝나는가. 그 뒤 옛 키를 지운다 |
| `SUPABASE_SERVICE_ROLE_KEY` | 운영에 없다 — 로컬 스택의 옛 이름 갈래이고 그 값은 `supabase status` 가 내는 개발 키다 | — | — | 운영 프로젝트의 **legacy `service_role` JWT** 가 켜져 있으면 같은 힘이다. 새면 API Keys 의 legacy 키를 끈다 — 앱은 발행 키와 새 비밀 키만 쓴다 |
| `OPENAI_API_KEY` | platform.openai.com → API keys. **같은 프로젝트**에 만든다 — 회수는 제출한 작업을 그 프로젝트에서 찾는다 | Vercel **Production · Preview** · 로컬(실호출) → 재배포 | 제출(`model-submit-failed`)과 **이미 떠난 작업의 회수** — 못 가져온 작업은 8분 deadline 에 닫히고, 토큰은 나갔는데 글은 없다 | 새 배포 Ready 뒤 `select count(*) from public.open_reading_jobs();` 가 0 일 때 옛 키를 끈다 |
| `OPENAI_WEBHOOK_SECRET` | platform.openai.com → Settings → Webhooks. 서명 비밀은 만들 때 한 번만 보이므로 **같은 주소로 endpoint 를 새로 만든다** | Vercel **Production** → 재배포 | webhook 이 401 이다. **결과는 안 잃는다** — 복구기가 1분마다 줍는다(ADR 0020). 늦어질 뿐이다. 두 endpoint 가 겹쳐 같은 결과가 두 번 와도 회수는 일감을 한 번만 집는다(`claim_reading_job`) | 새 배포 Ready 뒤 옛 endpoint 를 지운다. `CRON_SECRET` 과 같은 값을 쓰지 않는다 |
| `CRON_SECRET` = Vault `reading_recovery_secret` | 우리가 짓는다 — `openssl rand -base64 32` | **두 자리가 같은 값이다** — Vercel **Production**(Vercel Cron 이 이 값을 `Authorization: Bearer` 로 싣는다) → 재배포, 그리고 Vault `reading_recovery_secret` | 둘이 갈린 동안 1분 복구기가 403 이다 → `net-request-failed` 알림. webhook 이 살아 있으면 결과는 그대로 붙는다 | 새 배포 Ready 직후 Vault 를 바꾼다(창이 그만큼 짧다). `select status_code, created from net._http_response order by created desc limit 3;` 가 200. 두 자리를 다 바꾸면 옛 값은 끊긴 것이다 |
| Vault `reading_recovery_url` | 비밀이 아니다 — 공개 주소(`/api/cron/reading`). 도메인이 바뀔 때만 고친다 | Vault | — | — |
| Vault `ops_alert_url` | **주소 자체가 열쇠다** — 가진 사람은 운영 채널에 글을 넣는다. Slack 앱의 Incoming Webhooks 나 Discord 채널의 연동 → 웹후크에서 새 주소를 만든다 | Vault(재배포 없음) | 알림이 채널로 안 나간다. `ops_alert` 표에는 그대로 적힌다 | 「운영자 알림 배선」의 `notify_ops('ops-alert-test', …)` 가 닿으면 옛 웹후크를 지운다 |
| Vault `ops_alert_secret` | 넣었을 때만 있다 — 받는 쪽이 `Authorization` 을 볼 때 | Vault 와 받는 쪽을 함께 | 받는 쪽이 알림을 거절한다 | 위와 같다 |
| 구글 로그인 client secret | 코드에 없다 — Supabase Auth 가 든다. Google Cloud Console → Credentials → 그 OAuth client 에서 secret 을 더한다 | Supabase 대시보드 Authentication → Providers → Google(재배포 없음). **`supabase config push` 로 넣지 않는다**(맨 위 경고) | 구글 로그인 전부 | 새 창에서 로그인이 되면 Google 에서 옛 secret 을 끈다 |

- **운영자 자격**(Supabase access token · DB 비밀번호 · Vercel · GitHub 토큰)은 코드에 없다. 각 대시보드에서
  폐기하고 다시 만든다. MFA 는 G-23 ⑨ 가 든다.
- **무료 지급 HMAC 키는 아직 코드에 없다**(G-20 이 만든다). 들어오는 PR 이 이 표에 줄을 더한다. 미리 적어 둘
  사실 하나 — **키를 바꾸면 저장된 식별값 전부와 대조가 끊긴다.** 원문(CI)을 안 남기므로 새 키로 옮길 길이
  없다(ADR 0101). 끊기면 그날 전에 떠난 사람이 다시 들어와 무료 몫을 또 받는다. 새었을 때 교체할지와 옛
  식별값의 처분은 그 PR 이 G-25 ⑧ 과 함께 정한다.
- **PG · 본인확인 키도 아직 없다** — 들어올 때 이 표에 줄을 더한다.

**git 기록에 새었을 때.** 푸시된 순간 샌 것으로 본다 — 클론 · 포크 · CI 로그가 이미 들고 있다.

1. **교체가 먼저다** — 위 표대로. 기록을 먼저 지우면 그동안 값은 살아 있다.
2. 어디에 있는지 찾는다 — 값을 화면에 찍지 않도록 앞 몇 글자로 센다:
   `git log --all -S '<앞 8글자>' --oneline`
3. 기록 정리(`git filter-repo` · main force push)는 **사람이 한다** — 에이전트에게 등급 4 다. 교체가 끝났으면
   남은 것은 끊긴 값이라 정리는 급하지 않다.

로그 · 에러 응답에 새었을 때도 교체가 먼저다. 2026-09-24 에 잰 값 — git 역사 전체에 비밀 모양의 문자열
(`sk-` · `sb_secret_` · `whsec_` · JWT · Slack · Discord 웹후크)은 없다(CI 의 껍데기 발행 키
`sb_publishable_ci_placeholder` 뿐). `.env*` 는 `.gitignore` 가 막고 추적되는 것은 `supabase/.env`(포트,
비밀 아님) 하나다. 앱의 `console.error` 넷 중 환경변수를 싣는 것은 없고, webhook 의 401 은 SDK 오류 문장을
답에 싣지 않는다(그날 고쳤다 — 「서명 비밀이 비었다」가 아무에게나 갔다).

---

## 테스트 시작하기 — **날짜 한 줄**

지금은 아무도 시작할 수 없다. 종료일이 없으면 안내가 만들어지지 않고, 안내가 없으면
`/signup` 에 폼이 아예 없다(ADR 0024). 배포 없이 **언제든** 넣고 옮길 수 있다.

> **일정을 옮기면 이미 가입한 사람도 다시 확인한다.** 관문이 「지금 일정 줄」을 보므로
> (ADR 0042) 그 사람들은 다음 방문에 `/signup` 으로 돌아가 확인 하나만 다시 누른다 —
> 코드와 닉네임은 다시 안 묻는다.

**두 가지를 함께 넣는다** — 언제 끝나는가와 **누가 약속하는가**. 처리자와 연락처가 없으면
열람·정정·삭제·처리정지가 적혀만 있는 권리가 되므로, 셋 중 하나라도 비면 안내가 안 선다.

```sql
-- 정한다. 파기 기한은 종료일과 여유에서 나므로 따로 적지 않는다.
insert into public.beta_schedule (
  ends_on, purge_within_days, note,
  operator_name, operator_officer, operator_contact)
values (
  '2026-10-31', 30, '고정 종료일 — 초대 시점과 무관하다',
  '<처리자 이름 또는 상호>', '<보호책임자 이름>', '<직접 닿는 이메일 또는 전화>');

-- 지금 값과 이력
select * from public.current_beta_schedule();
select id, ends_on, purge_within_days, note, set_at from public.beta_schedule order by id desc;
```

**덮어쓰지 않고 쌓는다.** 옮기려면 새 줄을 넣는다 — 이건 사용자에게 한 약속이고, 바뀐
기록이 남아야 「그때 뭐라고 했더라」에 답할 수 있다.

> **옮기면 모두가 안내를 다시 본다.** 확인 기록이 판본과 **본 날짜**를 함께 들기
> 때문이다(`notice_ends_on`). 기간이 바뀌는 것은 알린 내용이 바뀌는 것이라 그게 맞다 —
> 다시 안 물으면 11월에 지운다는 안내를 보고 확인한 사람의 자료를 이듬해까지 들게 된다.

> **연락처는 공개 화면에 그대로 실린다.** `/privacy` 는 로그인 없이 열리므로 여기 적는
> 주소는 누구나 본다. 개인 주소를 쓸지 별도 창구를 팔지는 정하고 넣는다.

**종료일은 초대와 무관하다.** 언제 몇 명을 초대하든 그날 끝난다 — 초대에서 며칠을 세는
값이 아니므로, 테스터를 늦게 넣었다고 자동으로 밀리지 않는다. 밀려면 새 줄을 넣는다.

넣고 나면 `/privacy` 를 열어 날짜가 문장 안에 서 있는지 눈으로 본 뒤 아래 「초대」로 간다.

**문구를 고쳤으면 판본도 올린다**(`NOTICE_VERSION`, 코드). 판본만 올리고 문구를 안 고치면
사람들을 이유 없이 다시 세우는 것이고, 문구만 고치고 판본을 안 올리면 아무도 새 문구를
못 본다. 날짜는 판본에 없다 — 둘은 따로 움직이고 관문이 둘 다 본다.

```sql
-- 누가 어느 판본·어느 날짜에서 무엇을 골랐나
select u.email, a.notice_version, a.notice_ends_on, a.notice_ack_at,
       a.improvement_consent as 개선활용, a.contact_consent as 후속연락
from public.app_user a join auth.users u on u.id = a.id
order by a.notice_ack_at desc nulls first;
```

---

## 초대 — **코드 한 줄** (ADR 0042)

이메일 명단은 걷었다. 지금 문을 여는 것은 **테스트 코드**다 — 운영자가 코드를 하나 만들고
그 문자열만 전하면 받은 사람이 스스로 들어온다.

> **테스트가 아닌 사람을 처음 들이기 전에 출시 단계를 옮긴다**(ADR 0093 · 0097). 실제 사용자의 자료가 운영
> DB 에 들어오는 날이 공개 뒤의 규율이 켜지는 날이다 — `docs/prd.md` §7.0 의 「(지금)」을 옮기면 머지 전 전체
> 검증(CI)과 등급 3 의 잠금이 함께 돌아온다. 잠금 쪽은 시험이 `docs/agents/delegation.md` 「공식 운영에
> 들어가면 켜는 잠금」의 걸음으로 데려간다. 코드를 먼저 건네고 나중에 옮기지 않는다.

코드에는 둘이 붙는다: **사는 기간**과 **최대 인원**. 기한 없는 코드는 새면 영원히 열린
문이고, 수 없는 코드는 한 사람이 퍼뜨리면 정원이 없다. 둘을 함께 두면 새어도 N명까지다.

**정원은 기간 전체에 누적이다**(ADR 0066). 이틀짜리 스무 명은 이틀 합쳐 스무 명이지
날마다 스무 명이 아니다 — `app_user.signup_code` 로 세므로 자리가 안 돌아온다.
**이틀을 덮겠다고 날짜만 다른 코드를 두 줄 넣지 마라.** 그러면 정원이 두 벌이 된다.

```sql
-- 오늘 하루, 열 명. 코드는 **대문자**로 넣는다(검사식이 그것만 받는다).
-- 하루의 경계는 서울 자정이다 — 「오늘」이 사용자가 읽는 오늘과 같아야 한다.
-- `valid_until` 을 안 적으면 하루짜리다.
insert into public.signup_code (code, note, valid_on, max_uses)
values ('SAJU1001', '1차 테스터 · 오픈채팅방 공지', (now() at time zone 'Asia/Seoul')::date, 10);

-- 오늘부터 내일까지, 합쳐서 스무 명.
insert into public.signup_code (code, note, valid_on, valid_until, max_uses)
values ('SAJU1002', '2차 테스터 · 오픈채팅방 공지',
        (now() at time zone 'Asia/Seoul')::date,
        (now() at time zone 'Asia/Seoul')::date + 1, 20);

-- 오늘 살아 있는 코드와 남은 자리
select c.code, c.note, c.valid_on, c.valid_until, c.max_uses,
       count(u.id) as 들어온사람,
       c.max_uses - count(u.id) as 남은자리
from public.signup_code c
left join public.app_user u on u.signup_code = c.code
where (now() at time zone 'Asia/Seoul')::date between c.valid_on and c.valid_until
group by c.code, c.note, c.valid_on, c.valid_until, c.max_uses;

-- 어느 계정이 어느 코드로 왔나
select au.email, u.signup_code, u.signed_up_at, u.nickname
from public.app_user u
join auth.users au on au.id = u.id
order by u.signed_up_at desc nulls last;
```

**`signed_up_at` 이 비어 있는 계정은 「구글 로그인만 한 사람」이다.** 코드를 못 넣었거나
안 넣은 것이고, 그 계정은 아무것도 못 한다 — 사주도 저장한 사람도 못 넣는다. 그대로 두면
된다. 다시 코드를 주면 그 자리에서 가입이 끝난다.

**코드를 지우는 것은 접근 회수가 아니다.** 이미 들어온 사람의 세션은 그대로 산다. 그리고
**누가 그 코드로 들어왔는지가 곧 기록**이라 쓰인 코드는 지워지지 않는다(FK). 막으려면
아래의 계정 중지를 쓴다.

```sql
-- 아직 아무도 안 쓴 코드만 지워진다. 쓰인 코드는 FK 가 막는다 — 그게 맞다.
delete from public.signup_code where code = 'SAJU1001';

-- 정원을 줄이거나 하루를 옮기는 편이 낫다
update public.signup_code set max_uses = 0 where code = 'SAJU1001';
```

> **훅은 껐다.** `[auth.hook.before_user_created]` 는 `config.toml` 에서 지웠다. **원격
> 프로젝트에서는 손으로 꺼야 하고, 그것을 마이그레이션보다 먼저 해야 한다** — 아래
> 「가입 코드 배포 — 훅을 먼저 끈다」.

---

## 풀이권

폐쇄 베타에서 한 사람이 AI 풀이를 몇 번 만들 수 있는가. **어디에도 적혀 있지 않다** —
`reading_run` 을 세는 것이 곧 잔액이다(ADR 0021). 그래서 누구의 잔액도 손으로 고칠 수
없고, 고칠 자리를 찾을 필요도 없다.

```sql
-- 누가 얼마나 썼나. `reserved` 는 지금 만들고 있는 것이 잡고 있는 자리다.
select u.email,
       count(*) filter (where r.status = 'succeeded') as 쓴것,
       count(*) filter (where r.status = 'running'
         and r.created_at > now() - public.reading_run_timeout()) as 만드는중,
       count(*) filter (where r.status = 'failed') as 실패
from auth.users u
left join public.reading_run r on r.user_id = u.id
group by u.email
order by 쓴것 desc;
```

한 사람에게 더 주려면 상한을 옮긴다. **그 사람만 올릴 수는 없다** — 값이 하나뿐인 것이
이 설계의 요점이다.

```sql
create or replace function public.reading_credit_limit()
returns integer language sql immutable as $$ select 5 $$;
```

> 옮기기 전에 **무엇을 근거로 옮기는지 적어 둔다.** 처음 다섯은 재어 보고 정한 값이
> 아니다(ADR 0021). 「달라고 해서」와 「테스터 대부분이 다섯에서 멈춰서」는 다른 근거이고,
> 뒤의 것만 다음 판을 정하는 데 쓸 수 있다.
>
> **2026-09-05 에 여덟으로 올렸다가 같은 날 다섯으로 되돌렸다.** 여덟의 근거는 셈이었다 —
> 내 사주 하나, 저장한 사람 하나, 그 둘의 궁합 하나면 셋이고, 남은 둘로 인연 요청을 띄우면
> 그 둘은 답이 올 때까지 **예약**으로 묶인다(ADR 0038). **요청 둘을 띄운 사람은 자기 풀이를
> 하나도 못 만든다.** 그 벽은 다섯에 그대로 남아 있다 — 테스터가 매칭을 한 바퀴 밟다가
> 여기서 멈추면 그때가 올릴 때다.

> **저장 자리보다 크게 올리지 않는다.** `person_limit()` 이 열이고, 풀이를 받으려면 대상이
> 저장돼 있어야 한다(ADR 0032). 이 부등식이 깨지는 순간 풀이권을 가지고도 쓸 데가 없는
> 사람이 생기고, 그때 다시 열어야 하는 것은 저장 한도가 아니라 **저장 없이 풀이 받기**다.

**전체 비용은 이 값이 안 막는다.** 사람당 상한일 뿐이라, 초대 인원이 늘면 하루 전체
상한(`reading_daily_budget()`, 아래 「AI 비용 한도」)과 OpenAI 쪽 예산을 함께 옮겨야 한다.
그리고 실패한 시도도 모델은 이미 불렸으므로 「성공 건수 × 인원」이 호출 상한이 아니다.

---

## 지우기

**「그만두기」와 「지우기」는 다른 일이다.** 매칭 참여를 끄는 것은 상태이고(ADR 0014)
계정 중지도 상태다. 여기 적힌 것은 되돌릴 수 없는 쪽이다.

### 한 사람

```sql
select * from public.forget_user('<user uuid>');
--  people_forgotten
```

한 문장이면 된다. `auth.users` 하나가 사라지면 `app_user` 가 따라가고 거기서 서른 갈래
남짓이 FK 로 따라간다(2026-09-23 에 31) — Person 엣지·discovery·요청·결과·시도·풀이 설문·서비스
설문·알림·차단·신고·활동 시각. **Match · 대화방 · 메시지는 따라가지 않고 그 사람의 칸만 빈다**
(ADR 0094, 아래). (세어 보려면 `pg_constraint` 에서 `app_user` 를 가리키는 FK 를 센다 — `confdeltype`
이 `n` 인 여섯이 자리만 비는 칸이다.)
그다음 **이 사람이 관리하던 Person 중** 아무도 안 보게 된 것을 지운다(ADR 0023) — 출생
입력은 그 행에 있으므로 함께 사라진다.
남이 놓고 간 고아는 안 건드린다 — 그것은 종료 파기의 일이다.

무엇이 함께 사라지는지 **누르기 전에** 알아야 한다.

- **함께 보던 궁합이 상대 화면에서도 사라진다.** 그 사람의 동의 당시 여덟 글자가 비고 그 Match 의
  궁합풀이와 시도가 지워진다(트리거 둘, ADR 0094). 상대의 Match 목록과 공유 결과에는 이미 없다 —
  `visible_matches()` 가 상대가 `active` 인지 묻는다. **Match 행은 대화방의 닻으로 남는다.**
- **대화방과 메시지는 상대에게 남는다.** 그 사람의 자리(참여자 · 닫은 사람 · 보낸 사람)만 빈다.
  상대는 방을 계속 보고 이름 자리에 「탈퇴한 사용자」가 선다. 열려 있던 방은 이 순간 닫힌다
  (`deletion_request`, 지금) — 보존 90일은 닫힌 날부터다(아래 「채팅」). **둘 다 떠나면** Match 째
  사라지고 방 · 메시지가 따라간다.
- **남이 관리하는 Person 은 남는다.** 「누가 만들었나」만 비워진다.
- **신고 기록은 따로 남는다**(ADR 0098). 신고한 쪽이든 신고당한 쪽이든, 지워지기 **전에** 트리거가
  그 사람이 든 신고와 스냅샷을 `retention.report` 로 옮기고 일반 표에서는 사라진다. 처분일부터 6개월
  뒤 크론이 지운다 — 아래 「떠난 사람의 신고 기록」.

**다시 못 들어오게 하는 것은 이 문이 아니다.** 삭제는 접근 회수가 아니고(위의 초대 절과
같은 구분), 코드는 사람에 매여 있지 않다 — 지운 사람이 같은 코드를 아직 들고 있으면 그
코드가 살아 있는 동안에는 다시 들어올 수 있다. 막으려면 **그 코드를 닫는다.**

```sql
update public.signup_code set max_uses = 0 where code = '<그 사람에게 준 코드>';
```

### 종료일이 되면 — **저절로 닫힌다**

종료일이 지나면 `is_active_account()` 가 거짓이 되어 discovery·요청·수락·풀이 생성·설문이
한꺼번에 닫히고, `/me` 아래는 「비공개 테스트가 끝났습니다」로 선다. 운영자가 그날 무엇을
누르지 않아도 된다 — 날짜가 집행한다.

```sql
-- 닫혔는지 본다
select public.beta_is_over(), * from public.current_beta_schedule();
```

미루려면 새 줄을 넣는다(위 「테스트 시작하기」). 넣는 순간 다시 열리고, **모두가 안내를
다시 본다** — 기간이 바뀌는 것은 알린 내용이 바뀌는 것이다.

파기는 저절로 안 된다. 아래를 손으로 돈다.

### 베타 종료 — 전부

```sql
-- 무엇을 지울 것인지 먼저 본다. 세어 보지 않고 지우지 않는다.
select count(*) as 계정 from auth.users;
select count(*) as 사람 from public.person;
```

```sql
-- 하나씩 잊는다. **전체가 한 트랜잭션이다** — 한 명에서 실패하면 앞에서 지운 사람까지
-- 전부 되돌아간다. 그게 맞다: 절반만 지워진 상태로 끝나는 것보다 아무것도 안 지워진
-- 상태에서 이유를 보고 다시 도는 편이 낫다. 어디서 멈췄는지는 notice 가 말한다.
do $$
declare victim uuid;
begin
  for victim in select id from auth.users loop
    raise notice '잊는 중: %', victim;
    perform public.forget_user(victim);
  end loop;
end $$;
```

```sql
-- 사람마다의 삭제는 **그 사람이 관리하던 Person 만** 정리한다(ADR 0023). 아무도
-- 관리한 적 없던 고아는 그 반복으로 안 사라지므로, 여기서 한 번 쓸어 낸다.
select public.forget_orphan_people();
```

```sql
-- 남은 것이 없어야 한다. 남았다면 그것이 이 절차의 구멍이다.
--
-- **FK 로 안 따라오는 것들이 이 목록에 있다.** `reading_webhook_event` 는 어느 표에도
-- 안 매여 있고(도착을 적는 영수증이라 그렇다), 감사 로그와 flow state 는 `forget_user`
-- 가 손으로 지운다 — 둘 다 사용자에 매여 있지 않다.
select
  (select count(*) from auth.users)                  as 계정,
  (select count(*) from auth.audit_log_entries)      as 감사로그,
  (select count(*) from auth.flow_state)             as 로그인중간상태,
  (select count(*) from public.signup_code)          as 가입코드,
  (select count(*) from public.person)               as 사람,
  (select count(*) from public.reading)              as 결과,
  (select count(*) from public.reading_run)          as 시도,
  (select count(*) from public.reading_job)          as 일감,
  (select count(*) from public.reading_feedback)     as 풀이설문,
  (select count(*) from public.service_survey)       as 서비스설문,
  (select count(*) from public.notification)         as 알림,
  (select count(*) from public.match)                as 매치,
  (select count(*) from public.chat_room)            as 대화방,
  (select count(*) from public.report)               as 신고,
  (select count(*) from public.chat_message)         as 메시지,
  (select count(*) from public.chat_report_snapshot) as 신고스냅샷,
  (select count(*) from public.profile_photo)        as 프로필사진,
  (select count(*) from public.reading_webhook_event) as 영수증;

-- **0 이 아닌 것이 맞는 자리 하나** — 떠난 사람의 신고 기록. 종료 파기도 탈퇴와 같은 문이라 처분일부터
-- 6개월 남고 크론이 지운다(ADR 0098). 크론을 끄지 않는다.
select count(*) as 따로둔_신고, min(retained_at) + retention.report_period() as 가장_이른_파기
from retention.report;
```

**프로필 사진은 손으로 안 지운다.** 바이트가 Postgres 안에 있고 `app_user` 에 cascade 로
매여 있어서, 계정이 사라지면 함께 사라진다(ADR 0040). 파일 저장소에 뒀다면 이 절차에
한 단계가 늘고 그 단계는 DB 밖에 있었을 것이다 — 위 표에 0 이 아닌 수가 남으면 그것이
이 결정이 깨졌다는 뜻이다.

**영수증은 마지막이다.** `reading_webhook_event` 는 도착을 적는 자리라 어느 FK 에도 안
매여 있다. 생성이 도는 중에 지우면 그 사이 도착한 응답을 두 번 집을 수 있다. 순서는
**생성 중단 → 재전송 창(최대 72시간) 경과 또는 webhook 폐쇄 → 영수증 삭제**다.

```sql
-- 위 검증에서 영수증만 남았을 때, 재전송 창이 지난 뒤에 지운다.
delete from public.reading_webhook_event;
```

```sql
-- 가입 코드는 사람 이름이 아니라 문자열과 운영자 메모다. 그래도 「누가 그 코드로
-- 들어왔나」가 계정과 함께 사라진 뒤에는 남길 이유가 없다.
delete from public.signup_code;
```

### DB 밖

절차가 DB 에서 끝나지 않는다. **여기 적힌 것 중 확인 안 된 것은 확인 안 됐다고 적어 둔다** —
안내에 「파기했습니다」라고 쓰려면 이 목록이 전부 닫혀 있어야 한다.

| 어디 | 무엇이 있나 | 얼마나 남나 |
| --- | --- | --- |
| Supabase Auth | 로그인 신원·세션·토큰 | `auth.users` 삭제가 identities·sessions·one_time_tokens·mfa_factors 를 cascade 로 데려간다(확인함). 감사 로그·flow state 는 FK 가 없어 `forget_user` 가 손으로 지운다 |
| Supabase 백업 | 지운 행이 스냅숏에 남는다 | **Free 플랜에는 자동 일일 백업과 PITR 이 없다.** 운영자가 손으로 dump 를 뜬 적이 없으면 남는 것이 없다. 플랜을 올리면 이 줄을 다시 쓴다 |
| Vercel 로그 | 요청 로그. 출생 원문은 안 적는다(`prd-archive` 로그 규율) | **Hobby 플랜의 런타임 로그 보존은 1시간.** 플랜을 올리면 이 줄을 다시 쓴다 |
| OpenAI | 프롬프트에 여덟 글자와 그 위의 사실이 들어간다. 정확한 생년월일시·출생지·분 단위는 안 나간다(ADR 0008) | `store: false` 로 보내되 `background: true` 라 회수용으로 **약 10분** 들고 있다. 그와 별개로 기본 abuse monitoring 로그가 **최대 30일**, 프롬프트 캐시가 마지막 사용 후 **최소 30분**이다 |

> **OpenAI 프로젝트의 ZDR·MAM 설정은 확인 안 됐다.** 별도 승인을 받은 기억이 없으면
> 기본값(최대 30일)으로 안내한다. 승인받았다면 대시보드에서 확인하고 이 줄을 고친다.
>
> 요금제 두 줄은 **지금 플랜 기준**이다. 플랜을 올리는 것은 보존 기간을 늘리는 일이고,
> 그때 처리방침도 함께 고쳐야 한다.

---

## 설문 읽기 — **화면이 있다** (ADR 0061)

운영자로 로그인해서 **`/ops/survey`** 를 연다. 메뉴에 없는 주소라 직접 친다.

화면이 드는 것 넷 — 들어온 답과 동의 분포, 판본별 평균, 아쉬운 점 태그, 적어 주신 글.
아래 SQL 과 **같은 수**를 낸다(집계가 `operator_survey_*` 넷으로 옮겨 갔다). 화면이 안
열리거나 그 수를 의심할 때만 아래로 내려간다.

### 운영자를 세우고 내린다

「이 사람이 운영자인가」에만 답하는 표가 따로 있다(`public.operator`). 앱에는 이 표에 닿는
길이 없고 `service_role` 에도 안 열려 있다 — SQL Editor 에서만 넣는다.

```sql
-- 세운다
insert into public.operator (user_id, note)
select id, '누구에게 왜 주었는지'
from auth.users where email = '<그 사람의 구글 계정>';

-- 지금 누가 있나
select u.email, o.note, o.added_at
from public.operator o join auth.users u on u.id = o.user_id;

-- 내린다 — 이 줄이 사라지면 `/ops/survey` 는 그 사람에게 없는 화면이 된다
delete from public.operator where user_id =
  (select id from auth.users where email = '<그 사람의 구글 계정>');
```

**운영자라는 이름으로 열리는 문은 그 이름을 묻는 자리의 개수다.** 지금은 설문을 읽는 함수들과
신고를 읽는 함수 셋(`operator_reports` · `operator_report` · `operator_report_snapshot`, ADR 0103)이고 전부
읽기만 한다. 풀이권 예외는 여기 안 딸려 온다 — 그것은 별개의 표다(위 「풀이권」). 이 줄이 사라지면
`/ops/reports` 도 그 사람에게 없는 화면이 된다.

### 두 설문이 한 화면에 선다

`/ops/survey` 는 **풀이 설문**(글 하나에 대한 답)과 **서비스 설문**(서비스 전체에 대한 답,
ADR 0062) 둘을 함께 든다. 아래 SQL 은 앞의 것을 손으로 세는 자리이고, 서비스 설문 쪽은
「서비스 설문 — 손으로 세는 자리」 절에 있다.

### 손으로 세는 자리

답은 **그 글을 만든 시도에 매여 있다**(ADR 0022). 그래서 프롬프트 판본과 모델이 답 옆에
이미 있고, 따로 이어 붙일 일이 없다.

```sql
-- 프롬프트 판본별로 어떻게 읽혔나. 표본이 적을 때는 평균보다 개수를 먼저 본다.
select r.prompt_version, r.model, r.kind,
       count(*) as 답,
       round(avg(f.usefulness), 2) as 도움,
       round(avg(f.perceived_fit), 2) as 체감적합성,
       count(*) filter (where f.felt_length = 'long') as 길다,
       count(*) filter (where f.felt_length = 'short') as 짧다
from public.reading_feedback f
join public.reading_run r on r.id = f.reading_run_id
group by r.prompt_version, r.model, r.kind
order by 답 desc;
```

```sql
-- 무엇이 아쉬웠나. 태그는 여섯 이름뿐이다(`src/lib/reading/feedback.ts`).
select r.prompt_version, t as 태그, count(*)
from public.reading_feedback f
join public.reading_run r on r.id = f.reading_run_id,
     unnest(f.issue_tags) t
group by r.prompt_version, t
order by count(*) desc;
```

> **체감 적합성만 보고 판단하지 않는다.** 바넘 문장은 근거 없이도 「내 얘기 같다」를
> 만든다. 이 값만 오르고 근거 밀착성이 떨어지면 그것은 개선이 아니라 바넘화다(`prd-archive`).

**풀이 본문은 여기 없다.** `reading_run` 은 글을 남기지 않으므로 답 옆에 남는 것은 점수와
태그와 생성 메타데이터뿐이고, 사용자의 실제 풀이를 운영자가 읽을 일이 없다.

**설문 전체가 개선 활용 동의 뒤에 있다.** 점수도 태그도 동의한 사람의 것만 들어온다.

```sql
-- 적어 주신 글. 동의한 사람의 것만 들어온다(RPC 가 막는다).
select r.prompt_version, f.comment, f.submitted_at
from public.reading_feedback f
join public.reading_run r on r.id = f.reading_run_id
where f.comment is not null
order by f.submitted_at desc;
```

동의는 `app_user.improvement_consent` 하나다. **`null` 과 `false` 는 다르다** — `null` 은
아직 안 물어본 것이고 `false` 는 거절한 것이다. 안내 화면이 서기 전까지는 전부 `null` 이라
설문이 아무에게도 안 보인다.

값을 손으로 옮기지 않는다. `set_improvement_consent(boolean)` 이 그 문이고, **끄면 그
사람의 답이 함께 지워진다** — 한 트랜잭션이다(ADR 0022). `update` 로 값만 꺼 두면 답은
근거 없이 남는다.

```sql
-- 누가 어디에 있나
select improvement_consent as 동의, count(*) from public.app_user group by 1;
```

---

## 서비스 설문 — 손으로 세는 자리 (ADR 0062)

화면은 `/ops/survey` 의 아래쪽 절이다. 여기 SQL 은 그 화면이 안 열리거나 수를 의심할 때,
그리고 **파기 전에 합계를 뽑을 때** 쓴다.

**제출한 것만 센다.** `submitted_at` 이 비어 있는 줄은 쓰다 만 초안이고, 그 문장을 제출한
의견처럼 읽으면 안 된다.

```sql
-- 참여
select
  count(*) filter (where submitted_at is not null) as 제출,
  count(*) filter (where submitted_at is null)     as 초안,
  count(*) filter (where updated_at is not null)   as 고쳐_다시_제출
from public.service_survey;
```

```sql
-- 문항별 선택지. 이름은 코드가 말로 옮긴다(`src/lib/survey`).
select '좋았던 기능' as 문항, t as 선택, count(*)
from public.service_survey s, unnest(s.liked) t
where s.submitted_at is not null group by t
union all
select '몰랐던 기능', t, count(*)
from public.service_survey s, unnest(s.unknown_features) t
where s.submitted_at is not null group by t
union all
select '개선할 부분', t, count(*)
from public.service_survey s, unnest(s.improve) t
where s.submitted_at is not null group by t
order by 1, 3 desc;
```

```sql
-- 값 — **제시 금액 목록과 함께 본다.** 목록을 옮기고 나면 고른 값만으로는 뜻이 없다.
select price_options as 제시목록,
       price_solo as 사주풀이, price_pair as 궁합, count(*)
from public.service_survey
where submitted_at is not null
group by 1, 2, 3
order by count(*) desc;
```

> **지불 의향이지 실제 구매가 아니다.** 가격 후보를 좁히는 참고 자료로 쓰고, 판매 가격의
> 적절성은 실제 구매·이탈 결과와 함께 판단한다.

```sql
-- 적어 주신 글
select improve_text, free_text, submitted_at
from public.service_survey
where submitted_at is not null and (improve_text is not null or free_text is not null)
order by submitted_at desc;
```

### 파기 전에 뽑는다

답은 계정에 매여 있어 **베타 파기 때 함께 사라진다**(ADR 0023). 위 세 질의를 파기 **전에**
돌려 결과를 따로 보관한다 — 남기는 것은 사람을 못 가리키는 **합계뿐**이고, 자유 서술은
그대로 옮기지 않는다.

---

## 이용 정지와 해제

`status` 하나가 모든 문을 막는다 — 읽기까지 막는다(`is_active_account()`). 새 관문을
두지 않았으므로 이 값만 옮기면 discovery·요청·수락·AI 생성이 한꺼번에 닫힌다.

```sql
-- 이용 정지
update public.app_user
set status = 'suspended'
where id = (select id from auth.users where lower(email) = 'someone@example.com');

-- 해제
update public.app_user
set status = 'active', deletion_requested_at = null
where id = (select id from auth.users where lower(email) = 'someone@example.com');
```

> 탈퇴 대기(`deletion_requested`)를 해제할 때도 같은 문을 쓴다. 검사식이 상태와 시각을
> 함께 묶고 있으므로 `deletion_requested_at` 을 같이 비워야 한다.

```sql
-- 지금 살아 있지 않은 계정들
select u.email, a.status, a.deletion_requested_at
from public.app_user a join auth.users u on u.id = a.id
where a.status <> 'active'
order by a.deletion_requested_at desc nulls last;
```

---

## 신고와 차단

신고는 **운영자가 봐야 하는 기록**이고 차단은 사용자의 개인적 결정이다. 차단 기록을
운영 근거로 쓰지 않는다 — 「보기 싫다」와 「규칙을 어겼다」는 다른 일이다.

**읽는 것은 화면이 있다 — `/ops/reports`**(ADR 0103). 운영자로 로그인해 주소를 직접 친다(메뉴에 없다).
목록은 최신부터 30건씩이고 검토 상태 · 사유 · 대화 근거로 거른다. 「신고 내용 보기」가 신고 한 건과 신고
당시의 스냅샷을 연다. 화면은 읽기만 한다 — **봤다고 적는 것(`reviewed_at`)과 처분은 아래 SQL 이다.** 화면에는
이메일이 없다 — 이메일이 필요한 일(수사기관 요청 등)과 떠난 사람의 신고는 아래와 「떠난 사람의 신고 기록」의
SQL 로 읽는다. 아래의 읽는 질의는 화면이 안 열리거나 그 값을 의심할 때 쓴다.

```sql
-- 아직 안 본 신고
select r.id, r.created_at, r.reason, r.detail,
       reporter.email as 신고한_사람, reported.email as 신고당한_사람
from public.report r
join auth.users reporter on reporter.id = r.reporter_user_id
join auth.users reported on reported.id = r.reported_user_id
where r.reviewed_at is null
order by r.created_at;

-- 한 사람에게 쌓인 신고 — 처분을 정하는 자리
select reported.email, r.reason, count(*), max(r.created_at) as 마지막
from public.report r
join auth.users reported on reported.id = r.reported_user_id
group by reported.email, r.reason
order by count(*) desc;

-- 봤다고 적는다. 처분 자체는 여기 안 적는다 — 제재는 `app_user.status` 가 든다.
update public.report set reviewed_at = now() where id = '<report-id>';
```

차단은 참고로만 본다. 누가 누구를 차단했는지는 사용자에게 보이지 않으며, 여기서도
집계로만 읽는다.

```sql
select blocked.email, count(*) as 차단당한_수
from public.block b
join auth.users blocked on blocked.id = b.blocked_user_id
group by blocked.email
having count(*) > 1
order by count(*) desc;
```

## 떠난 사람의 신고 기록 — **처분일부터 6개월, 운영자만** (ADR 0098)

신고한 쪽이든 당한 쪽이든 떠나면, 그 사람이 든 신고는 지워지기 **전에** `retention.report` 로 옮겨진다
(`auth.users` 의 트리거 `reports_outlive_the_leaver` — 크론의 처분이든 `forget_user` 든 같다). 처리방침의 절
「신고 기록은 따로 둡니다」가 이것을 알린다(`notice-v6`).

- **남는 것** — 사유와 상세 · 신고 시각과 검토 상태 · 불변 스냅샷(jsonb) · 두 계정의 UUID · 옮긴 순간의 로그인
  이메일 · 가입일(`auth.users.created_at`) · 탈퇴일. **IP · 실명 · 주민등록번호 · 전화번호 · 주소는 없다** —
  받은 적이 없다
- **누가 읽나** — 이 SQL 을 도는 운영자(`postgres`)뿐이다. `retention` 스키마는 API 에 안 나가고 `anon` ·
  `authenticated` · `service_role` 이 못 쓴다 — 앱 서버의 비밀 열쇠로도 못 읽는다. **신고한 사람이 요구해도
  상대의 신원을 알려 주지 않는다**
- **언제 사라지나** — 먼저 떠난 쪽의 처분일(`retained_at`)부터 6개월. 크론 `report-retention-purge`(매시 47분)가
  지운다. 남은 쪽이 나중에 떠나면 그 사람의 탈퇴일만 채워지고 시계는 그대로다. 실패는 `cron-watch` 가
  `cron-failed:report-retention-purge` 로 알린다
- **증거는 못 고친다** — 적을 수 있는 것은 검토 상태와 보류 두 칸뿐이다. 나머지는 `55000` 으로 막힌다

```sql
-- 따로 둔 신고 — 파기 예정일과 보류
select report_id, reported_at, reason, reviewed_at,
       reporter_email, reporter_left_at, reported_email, reported_left_at,
       retained_at, retained_at + retention.report_period() as 파기_예정,
       hold_reason, held_at
from retention.report
order by retained_at desc;

-- 한 건의 스냅샷을 편다 — 「채팅 — 신고 스냅샷을 읽는다」와 같은 모양
select (e ->> 'seq')::bigint as 차례,
       (e ->> 'created_at')::timestamptz at time zone 'Asia/Seoul' as 보낸_시각,
       e ->> 'sender_user_id' as 보낸_사람,
       (e ->> 'chosen')::boolean as 고른_것,
       e ->> 'body' as 본문
from retention.report k
cross join lateral jsonb_array_elements(k.snapshot -> 'messages') e
where k.report_id = '<report-id>'
order by 차례;

-- 봤다고 적는다 — 떠난 뒤에도 검토는 이어진다
update retention.report set reviewed_at = now() where report_id = '<report-id>';

-- 크론이 도는가
select jobname, schedule, active from cron.job where jobname = 'report-retention-purge';
```

### 수사기관의 요청이 오면

주는 것은 **확인된 수사기관의 적법한 요청**에만, **가진 범위 안에서**다(ADR 0098 「정한 것」). 근거는
전기통신사업법 제83조③ · 형사소송법의 영장이고, 개인정보 보호법 제18조②2 가 제3자 제공을 연다.

1. **서면을 받는다.** 제83조④ — 요청사유 · 가입자와의 연관성 · 필요한 자료의 범위를 적은 서면. 긴급해서 서면
   없이 왔으면 사유가 끝나는 대로 서면을 받는다. 서면이 없으면 주지 않는다
2. **기관을 확인한다.** 공문의 발신 기관 대표 번호로 되걸어 요청자를 확인한다 — 전화나 메일로 온 요청의 번호로
   되걸지 않는다
3. **범위를 좁힌다.** 요청서가 가리키는 계정 · 신고만 뽑는다. 줄 수 있는 것은 위 「남는 것」뿐이고, 그중
   요청서가 적은 항목만이다. 살아 있는 계정의 것이면 `public.report` · `auth.users` 에서, 떠난 사람의 것이면
   `retention.report` 에서 뽑는다
4. **대장에 적는다.** 제83조⑤ — 제공한 날 · 요청 기관 · 요청서 번호 · 제공한 자료의 범위를 적고 요청서를 함께
   보관한다. 대장은 이 DB 밖의 운영 문서에 둔다(요청서가 종이이거나 PDF 다)
5. **반기마다 보고한다.** 제83조⑥ — 제공 현황을 연 2회 과기정통부에 보고한다. 제공이 없던 반기에는 할 것이 없다

### 보존 요청 — 보류를 걸고 푼다

6개월 안에 수사기관이 **보존**을 요청하면(적법한 서면) 그 줄에 보류를 건다. 걸린 줄은 크론이 안 지운다.
보류는 요청서가 가리킨 줄에만 건다 — 한 사람의 신고 전부에 거는 것이 아니다.

```sql
-- 건다 — 무엇을 근거로 걸었는지 남긴다: 기관 · 문서 번호 · 받은 날
update retention.report
set hold_reason = '<기관> <문서 번호> <받은 날> 보존 요청', held_at = now()
where report_id = '<report-id>';

-- 걸린 줄
select report_id, hold_reason, held_at, retained_at + retention.report_period() as 원래_파기_예정
from retention.report where hold_reason is not null;

-- 푼다 — 사유가 끝났을 때(수사 종결 통보 · 요청 철회). 6개월이 이미 지났으면 다음 실행(매시 47분)이 지운다
update retention.report set hold_reason = null, held_at = null where report_id = '<report-id>';
```

**보류는 연장이 아니라 미룸이다.** 풀면 원래 처분일부터 센 6개월로 돌아간다. 보류를 걸어 둔 채 잊지 않도록
분기마다 위 「걸린 줄」 질의를 한 번 돈다.

---

## 탈퇴 신청의 처리

사용자가 `/me/settings` 의 「탈퇴」에서 신청하면 상태가 **탈퇴 대기**(`deletion_requested`)로 옮겨지고,
그 순간 후보 노출이 꺼지고 살아 있던 요청이 정리된다. **처분은 크론이 한다**(2026-09-23, G-53, ADR 0094 덧) —
처분이 끝난 계정이 **탈퇴**다(PRD §5.3).

- **기한은 신청 뒤 3일이다** — 달력의 날이고 주말 · 공휴일을 안 가른다. 시계는 앱이 적은
  `deletion_requested_at` 하나다. **연락처로 요청하는 경로는 없다.**
- 크론 `account-disposal`(매시 23분)이 **신청 뒤 하루가 지난** 대기를 집어 `forget_user` 를 돌리고, 바로
  흔적을 잰다(`account_residue`). 흔적이 남으면 처분째 되감기고 계정은 대기에 남아 다음 시간에 다시 집힌다.
  하루를 두는 것은 되돌릴 틈이고, 남은 이틀은 다시 시도할 여유다.
- **운영자가 할 일은 알림이 왔을 때뿐이다.** `account-disposal-failed`(실패) · `account-disposal-overdue`
  (신청 뒤 3일이 지난 대기가 있다). 성공은 안 알린다.

```sql
-- 기다리는 계정과 그 시도 — 실패한 줄만 id 를 든다
select a.id, a.deletion_requested_at, d.attempts, d.last_attempt_at, d.last_error
from public.app_user a
left join public.account_disposal d on d.user_id = a.id
where a.status = 'deletion_requested'
order by a.deletion_requested_at;

-- 처분된 것 — 누구였는지는 안 남는다. 신청 · 처분 시각과 시도 수만
select requested_at, disposed_at, attempts from public.account_disposal
where disposed_at is not null order by disposed_at desc limit 20;

-- 크론이 도는가
select jobname, schedule, active from cron.job where jobname = 'account-disposal';
```

**실패했을 때.** `last_error` 가 원인을 든다 — 「처분 뒤 흔적이 남았다: <자리>」면 그 자리가
`forget_user` 가 모르는 새 흔적이다. 그 자리를 `forget_user` 에 더하는 마이그레이션이 해법이고, 그때까지는
크론이 한 시간마다 다시 실패하고 알린다(같은 종류는 하루 한 번). 손으로 급히 처분해야 하면 아래 한 줄과
흔적 질의를 그대로 쓴다 — 크론과 같은 문이다.

**무엇이 지워지고 무엇이 남는가**(2026-09-23, ADR 0094 · PRD §5.3). 처분은 아래 한 줄이고, 무엇을
지우고 남기는지는 FK 와 트리거가 든다 — 운영자가 표마다 지우지 않는다.

| 무엇 | 처분 |
| --- | --- |
| 계정 · 닉네임 · 사진 · 활동 · Person 과 입력 · 풀이 · 설문 · 동의 · 요청 · 소식 · 차단 · 공유 링크 | **지운다.** 남이 함께 관리하는 Person 은 남는다(ADR 0023) |
| 함께 보던 궁합 — 그 사람의 동의 당시 여덟 글자, 그 Match 의 궁합풀이와 시도 | **지운다.** 상대 화면에서는 신청 때부터 내려가 있었다 |
| 대화방 · 메시지 | **남는다.** 그 사람의 자리만 비고 상대가 닫힌 날부터 90일까지 본다. 상대 화면의 이름은 「탈퇴한 사용자」 |
| Match 행 | **남는다** — 대화방을 매단 자리로만. 상대도 떠나면 방째 사라진다 |
| 신고 · 신고 스냅샷 | **따로 6개월 남는다.** 지워지기 전에 `retention.report` 로 옮겨지고 일반 표에서는 사라진다 — 위 「떠난 사람의 신고 기록」(ADR 0098) |

- **처리 기한은 신청 뒤 3일이고 크론이 센다**(위). 화면과 처리방침의 「영업일 3일」 문장은 #165 가
  `notice-v6` 으로 한 번에 고친다 — 그 사이에는 약속보다 빨리 지우는 쪽이다.
- **되돌리려면 처분 전에** 상태를 `active` 로 되돌린다 — 닫힌 대화방은 다시 안 열린다(ADR 0091).
  처분 뒤에는 되돌릴 길이 없다.

```sql
-- **`delete from auth.users` 를 직접 쓰지 않는다.**
--
-- 그 문장은 FK 가 닿는 것만 데려간다. 감사 로그(모든 행이 이메일을 든다)와 flow state 는
-- 사용자에 안 매여 있어 그대로 남는다(ADR 0023). 위의 「지우기」 절과 같은 문을 쓴다 —
-- 절차가 둘이면 하나는 낡는다.
select * from public.forget_user('<user-id>');
```

지운 뒤에는 **위 「베타 종료 — 전부」의 검증 질의를 그대로** 돌려 그 사람의 흔적이
없는지 본다. 한 사람을 지운 뒤라 전체가 0일 수는 없으므로, 그 사람의 이메일과 id 로
좁혀 본다. 대화방이 남았는지와 그 사람의 여덟 글자가 비었는지도 함께 본다.

```sql
select
  (select count(*) from auth.users where id = '<user-id>') as 계정,
  -- **두 조건을 다 본다.** `forget_user` 가 그 둘로 지운다 — id 로만 세면 이메일만
  -- 든 행(로그인 시도 등)이 남아도 0으로 보인다.
  (select count(*) from auth.audit_log_entries
   where payload ->> 'actor_id' = '<user-id>'
      or payload ->> 'actor_username' = '<지운 주소>') as 감사로그,
  (select count(*) from auth.flow_state where user_id = '<user-id>') as 로그인중간상태;

-- 남는 것 — 처분 전에 적어 둔 Match id 들로 본다. 상대의 칸과 여덟 글자는 그대로, 그 사람의
-- 칸 · 여덟 글자 · 궁합풀이는 비고, 방은 닫힌 채 남는다.
select m.id, m.user_low, m.user_high,
       m.chart_low is not null as 낮은쪽_여덟글자, m.chart_high is not null as 높은쪽_여덟글자,
       (select count(*) from public.reading r where r.match_id = m.id) as 궁합풀이,
       r.closed_reason, r.closed_at,
       (select count(*) from public.chat_message x where x.room_id = r.id and x.sender_user_id is null) as 떠난쪽_메시지
from public.match m join public.chat_room r on r.match_id = m.id
where m.id in ('<match-id>');
```

---

## 채팅 (ADR 0091)

채팅 안전 베타의 운영자 수단은 **화면이 아니라 여기 SQL 이다**(PRD §7.0). 방은 Match 에 1:1 이고
차단 · 이용 정지 · 탈퇴 신청이 트리거로 닫는다. 운영자가 누를 것은 없다 — 이용 정지는 위 「이용 정지와
해제」의 그 한 줄이 방까지 닫는다.

**대화방 전체를 여는 열쇠는 없다.** 운영자가 읽는 것은 신고에 붙은 스냅샷뿐이다. 아래 질의는
전부 SQL Editor(`postgres`)에서 돈다 — 앱 역할에는 이 표들이 닫혀 있다.

### 신고 스냅샷을 읽는다

**화면이 먼저다 — `/ops/reports/<report-id>`**(ADR 0103). 스냅샷을 차례대로 펴고, 고른 메시지에 「신고한
메시지」가 서고, 보낸 쪽을 「신고한 사용자」 · 「신고받은 사용자」로 적는다. 목록에서 「대화 근거 있음」으로
거르면 스냅샷이 붙은 신고만 남는다. 아래 SQL 은 화면이 안 열릴 때, 보낸 사람의 이메일이 필요할 때, 그리고
검토 완료를 적을 때 쓴다.

```sql
-- 아직 안 본 신고 중 메시지를 고른 것 — 스냅샷이 붙어 있다
select r.id, r.created_at, r.reason, r.detail,
       reporter.email as 신고한_사람, reported.email as 신고당한_사람,
       s.match_id, s.context_before, s.context_after, jsonb_array_length(s.messages) as 베낀_건수
from public.report r
join public.chat_report_snapshot s on s.report_id = r.id
join auth.users reporter on reporter.id = r.reporter_user_id
join auth.users reported on reported.id = r.reported_user_id
where r.reviewed_at is null
order by r.created_at;

-- 한 신고의 스냅샷을 차례대로 편다. `chosen` 이 참인 줄이 고른 메시지다.
-- 보낸 사람은 이메일로 푼다 — 계정이 이미 사라졌으면 uuid 만 남는다.
select (e ->> 'seq')::bigint as 차례,
       (e ->> 'created_at')::timestamptz at time zone 'Asia/Seoul' as 보낸_시각,
       coalesce(u.email, e ->> 'sender_user_id') as 보낸_사람,
       (e ->> 'chosen')::boolean as 고른_것,
       e ->> 'body' as 본문
from public.chat_report_snapshot s
cross join lateral jsonb_array_elements(s.messages) e
left join auth.users u on u.id = (e ->> 'sender_user_id')::uuid
where s.report_id = '<report-id>'
order by 차례;

-- 봤다고 적는다 — 「신고와 차단」과 같은 줄. 처분은 `app_user.status` 가 든다.
update public.report set reviewed_at = now() where id = '<report-id>';
```

스냅샷은 **불변**이다 — `update` 는 소유자에게도 막힌다(`55000`). 지워지는 길은 신고가 사라질
때뿐이고, 신고는 계정을 따라간다(「지우기」). 그 전에 트리거가 신고째 `retention.report` 로 옮긴다 —
떠난 사람의 신고는 위 「떠난 사람의 신고 기록」에서 읽는다.

### 닫힌 지 90일 지난 방의 메시지를 지운다 — **손으로**

크론이 아니다(PRD §7.1). 배포한 날이나 달마다 한 번 돈다. 기간은 DB 의 `chat_retention()` 이
들고(90일), 이 함수와 pgTAP 이 같은 문을 돌린다.

```sql
-- 무엇을 지울 것인지 먼저 본다. 세어 보지 않고 지우지 않는다.
select r.match_id, r.closed_reason, r.closed_at, count(m.id) as 메시지
from public.chat_room r
join public.chat_message m on m.room_id = r.id
where r.closed_at < now() - public.chat_retention()
group by r.match_id, r.closed_reason, r.closed_at
order by r.closed_at;

-- 지운다. 지우는 것은 메시지뿐이다 — 방은 남아 닫힌 이유를 계속 말하고, 스냅샷은 신고를 따른다.
select public.purge_closed_chat_messages();  -- 지운 메시지 수
```

### 한도에 걸린 건수를 본다

전송 한도는 계정당 1분 30건이고(`chat_policy()`), 걸린 전송은 거절되며 **한 건 한 줄**로 남는다.
거절이 값으로 돌아오기 때문에 트랜잭션이 남는다(ADR 0091).

```sql
-- 최근 7일, 날짜 × 사람
select (h.created_at at time zone 'Asia/Seoul')::date as 날짜, u.email, count(*) as 거절
from public.chat_rate_limit_hit h
join auth.users u on u.id = h.user_id
where h.created_at > now() - interval '7 days'
group by 1, 2
order by 1 desc, 3 desc;

-- 지금 정책의 수 다섯 — 앱의 lib 이 같은 수를 들어야 한다
select * from public.chat_policy();
```

### 접속 상태 — 구간만 나간다 (ADR 0092)

로그인된 요청마다 `proxy.ts` 가 `touch_activity()` 를 부르고, 그 문은 **1분에 한 번**만
`user_activity.last_active_at` 을 적는다. 상대에게 나가는 것은 구간 셋(`now` 5분 미만 · `day` 24시간
미만 · `earlier`)뿐이고 시각은 어느 읽는 문에도 없다. 표는 앱 역할에 닫혀 있어 여기서만 읽는다.

```sql
-- 지금 정책의 수 셋(초) — 앱의 lib 이 같은 수를 들어야 한다
select * from public.presence_policy();

-- 한 사람의 마지막 활동과 구간
select a.last_active_at, public.activity_band_of(a.user_id) as 구간
from public.user_activity a where a.user_id = '<user uuid>';

-- 프로덕션 확인 — 구간을 바꿔 본다(#121 의 끝났다고 말할 조건 2)
update public.user_activity set last_active_at = now() - interval '25 hours' where user_id = '<B>';

-- 읽는 문 둘의 반환에 활동 시각이 없다(pgTAP 35 와 같은 질의 — 0 이어야 한다)
select count(*) from pg_proc p
cross join lateral unnest(p.proargnames, p.proargmodes) as a(name, mode)
where p.pronamespace = 'public'::regnamespace
  and p.proname in ('my_chat_rooms', 'my_discovery_board')
  and a.mode = 't' and a.name like '%active_at%';
```

### 완료 조건 여섯을 프로덕션에서 밟는 순서

§7.0 의 여섯을 **운영자가 지정한 테스트 계정 둘**(A · B)로 한 번씩 밟는다. 화면은 `/me/chat`(탭 「채팅」)
이고 방은 함께 보는 궁합의 「채팅」으로도 연다. 확인은 SQL 로 한다.

1. **주고받는다.** A 와 B 를 매칭시키고(요청 → 수락) 서로 한 줄씩 보낸다.
   ```sql
   select r.match_id, r.closed_reason, count(m.id) as 메시지
   from public.chat_room r left join public.chat_message m on m.room_id = r.id
   where r.user_low = least('<A>', '<B>') and r.user_high = greatest('<A>', '<B>')
   group by r.match_id, r.closed_reason;   -- closed_reason 이 null, 메시지 2
   ```
2. **한도 거절.** A 가 1분 안에 31건을 보낸다(화면에서든 `send_chat_message` 를 31번 부르든).
   31번째가 거절되고 `chat_rate_limit_hit` 에 A 의 줄이 하나 선다(위 「한도에 걸린 건수」).
3. **신고 스냅샷.** B 가 A 의 메시지 하나를 골라 신고한다. 위 「신고 스냅샷을 읽는다」로 고른
   메시지와 앞뒤가 베껴졌는지 본다. 이때 방은 그대로 열려 있어야 한다(신고는 닫지 않는다).
4. **차단.** A 가 B 를 차단한다. 방의 `closed_reason` 이 `block` 이고, **둘 다** 이전 대화를 보며
   둘 다 입력이 안 된다. 그리고 매칭 목록에서는 내려간다(§6.5).
5. **이용 정지.** 다른 쌍(A · C)을 세우고 C 를 정지한다(「이용 정지와 해제」의 한 줄). 방의 `closed_reason`
   이 `suspension`, `closed_by_user_id` 가 C. A 는 방과 대화를 보고 C 는 아무것도 못 본다.
   ```sql
   update public.app_user set status = 'suspended' where id = '<C>';
   select closed_reason, closed_by_user_id, closed_at from public.chat_room
   where user_low = least('<A>', '<C>') and user_high = greatest('<A>', '<C>');
   ```
6. **삭제 요청.** 또 다른 쌍(A · D)을 세우고 D 가 `/me/settings` 의 「탈퇴」→「탈퇴를 신청합니다」로 신청한다. `closed_reason` 이
   `deletion_request`, `closed_at` 이 D 의 `deletion_requested_at` 과 같다. A 는 보고 D 는 못 본다.

끝나면 테스트 계정을 「지우기」로 정리한다 — **쌍의 두 계정을 다** 지운다. 한쪽만 지우면 방과 메시지는
남는 쪽에 남는다(ADR 0094). 둘 다 지우면 Match 째 사라지고, 신고 · 스냅샷은 신고를 따라 사라진다.
지우기 전에 위 검증의 결과를 이슈 #115 에 적는다.

---

## AI 생성 — 호출량 · 실패 · 지연

한 번의 생성 요청이 `reading_run` 에 한 줄이다. **본문은 남지 않는다**(ADR 0013) —
여기서 볼 수 있는 것은 언제·무엇으로·어떻게 끝났나뿐이다.

```sql
-- 최근 24시간: 얼마나 불렀고 얼마나 실패했나
select date_trunc('hour', created_at) as 시각,
       count(*) as 시도,
       count(*) filter (where status = 'succeeded') as 성공,
       count(*) filter (where status = 'failed') as 실패,
       round(avg(extract(epoch from (finished_at - created_at))) filter
             (where finished_at is not null)::numeric, 1) as 평균_초
from public.reading_run
where created_at > now() - interval '24 hours'
group by 1 order by 1 desc;

-- 무엇이 막고 있나 — 검사에 걸린 것과 모델이 못 낸 것을 가른다
select failure_code, count(*), max(created_at) as 마지막
from public.reading_run
where status = 'failed' and created_at > now() - interval '7 days'
group by failure_code order by count(*) desc;

-- 도는 채로 남은 시도 (서버가 죽은 자리). DB 가 10분 뒤 만료로 닫지만 세어 둔다.
select id, kind, user_id, created_at
from public.reading_run
where status = 'running' and created_at < now() - interval '10 minutes';

-- 지금 어떤 모델·프롬프트 판본으로 서 있나
select model, prompt_version, count(*), max(created_at) as 마지막
from public.reading_run group by 1, 2 order by 4 desc;
```

**여기서는 호출 수만 센다.** 쓴 토큰과 하루 상한은 아래 「AI 비용 한도」가 들고, 금액은
provider 쪽에 있다.

> **게이트웨이가 아니라 OpenAI 를 직접 부른다.** 이 문단은 「Vercel AI Gateway 에
> 예산 한도를 걸어 둔다」라고 적혀 있었는데, 게이트웨이가 카드 없음으로 거절하는
> 동안 `@ai-sdk/openai` 로 옮겼다(`app/me/reading/model.ts`). 한도를 걸 자리도
> 함께 옮겨 갔다.

바깥 한도는 **OpenAI 대시보드**에 건다 — Settings → Organization → Limits 의 월 예산과
경고선, 그리고 자동 충전 끄기. 안쪽 한도는 앱에 있다(아래).

지금 서 있는 값은 `GENERATION` 이 든다. 무엇으로 얼마나 불렀는지는 위의
`reading_run` 질의가 세고, **그것에 값을 곱해 보는 일은 대시보드에서 한다.**

---

## AI 비용 한도 — **안쪽 벽과 바깥 벽** (ADR 0039)

벽이 둘이고 **안쪽이 먼저 닿아야 한다.** 앱 상한에 닿은 사용자는 「오늘은 여기까지,
내일 다시 열립니다」를 읽는다. 대시보드 한도에 먼저 닿으면 읽는 것은 「실패했습니다」뿐이다.

| | 값 | 어디 |
|---|---|---|
| 사람당 풀이권 | 5 | `reading_credit_limit()` |
| 사람당 시간당 | 20 (실패한 시도도 든다) | `reading_rate_limit()` |
| **전체 하루** | **500**(2026-09-23 에 100 → 500, G-03) | `reading_daily_budget()` |
| 운영자 경고 | 상한의 80% — 400 | `reading_budget_warning()` |
| 운영 검증 계정 | 세되 따로 낸다 | `verification_account` 표 · `reading_spend_daily` 의 `verification_*` 칸 |
| 바깥 벽 | 월 예산·자동 충전 끔 | OpenAI 대시보드 |

### 얼마나 썼나

```sql
-- 날짜·종류별 시도와 토큰. `usage_unknown` 이 크면 토큰 합이 실제보다 작다는 뜻이다.
select * from public.reading_spend_daily order by day desc, kind;

-- 실제 사용자의 수 — 운영 검증 계정의 시도를 뺀다(상한은 둘 다 센다)
select day, sum(attempts - verification_attempts) as 사용자_시도,
       sum(verification_attempts) as 검증_시도
from public.reading_spend_daily group by day order by day desc;

-- 오늘 몇 번 썼나 (상한이 보는 바로 그 수)
select public.reading_spend_today() as 오늘, public.reading_daily_budget() as 상한;
```

**금액은 여기 없다.** 단가는 provider 가 정하므로 토큰까지만 낸다 — 원 단위는 대시보드다.

### 운영 검증 계정 — 누구의 시도를 따로 세나

제품을 확인하려고 누르는 계정이다. **세는 것은 그대로이고**(토큰은 누가 눌렀든 나간다) 지출 표가
그 계정의 수를 `verification_*` 칸에 따로 낸다. 주소는 저장소에 안 적는다 — 운영 DB 에만 둔다.

```sql
insert into public.verification_account (user_id, note)
select id, '운영 검증 — <누가 언제>' from auth.users where email = '<주소>';

-- 지금 몇이 서 있나 (주소는 찍지 않는다)
select count(*) from public.verification_account;
```

### 막혔을 때 — **하루 봉쇄를 푸는 한 줄**

OpenAI 장애로 실패가 쌓여 상한이 찼는데 사람들이 아직 못 쓴 경우다. 실패도 그 수에
들므로 **아무도 글 하나 못 받고 하루가 닫힐 수 있다.** 그때 상한을 임시로 올린다:

```sql
create or replace function public.reading_daily_budget()
returns integer language sql immutable set search_path = '' as $$ select 800 $$;
```

**올리기 전에 셋을 본다.**

1. `select * from public.reading_spend_daily where day = (now() at time zone 'Asia/Seoul')::date;`
   — 실패가 대부분인가. 성공이 쌓여 찬 것이면 그것은 사고가 아니라 정상 사용이고,
   그때 올리는 것은 **비용을 쓰겠다는 결정**이다
2. **바깥 벽이 위에 있는가.** 새 값 × 한 번 비용이 대시보드 월 예산 안에 드는가.
   안쪽을 바깥보다 높이 올리면 이 문서의 첫 줄이 거짓이 된다
3. 장애가 끝났는가. 실패가 계속 나는 중에 올리면 **새는 구멍을 넓히는 것**이다

**그날 안에 되돌린다.** 되돌리는 것도 같은 한 줄이고, 값만 500 이다. 안 되돌리면 다음
사고 때 이 벽은 없는 것과 같다.

### 운영자 알림 배선

경고(80%)와 도달은 `ops_alert` 에 적히고, **주소가 있으면** 거기로도 던진다. Slack·Discord
Incoming Webhook 둘 다 그대로 받는다.

```sql
-- 넣기 (한 번)
select vault.create_secret('https://hooks.slack.com/services/…', 'ops_alert_url');

-- 들어갔나 — 값은 안 본다
select count(*) from vault.decrypted_secrets where name = 'ops_alert_url';

-- 실제로 나가는지 한 번 쏴 본다
select public.notify_ops('ops-alert-test', '배선 확인');

-- 나갔나 — 200 이면 닿았다
select status_code, created from net._http_response order by created desc limit 3;
```

> `notify_ops` 는 **하루에 한 종류당 한 줄**이다. 같은 이름으로 두 번 쏘면 두 번째는
> `false` 를 내고 아무것도 안 던진다. 다시 시험하려면 이름을 바꾸거나
> `delete from public.ops_alert where kind = 'ops-alert-test';` 로 지운다.

```sql
-- 무엇이 언제 울렸나
select kind, detail, created_at from public.ops_alert order by created_at desc limit 20;
```

---

## 도는 잡이 정말 도나 — **실패는 여기에만 남는다**

`pg_cron` 이 돌리는 것은 앱 로그에 안 남고 `cron.job_run_details` 에만 남는다. 그래서
**실패해도 아무도 모른다.** 실제로 그랬다: 복구기가 2026-09-01 부터 **4,542번 연속
실패**하고 있었고(`extensions.http_get` 은 없다 — `pg_net` 은 `net` 에 산다), 알림 배선을
쏴 보다가 같은 착각을 발견해서야 드러났다(ADR 0039).

**이제 감시기가 본다**(2026-09-23, G-42). 크론 `cron-watch`(10분마다)가 `watch_cron()` 으로 지난 한 시간을
보고, 셋 중 하나면 `notify_ops` 로 한 줄을 보낸다 — 정상 실행은 아무것도 안 적는다. 같은 종류는 하루 한 번이다.

| 종류 | 뜻 | 할 일 |
| --- | --- | --- |
| `cron-failed:<잡>` | 그 잡의 SQL 이 실패했다. 알림에 마지막 오류가 붙는다 | 아래 질의로 `return_message` 를 보고 함수를 고친다 |
| `net-request-failed` | 크론이 밖으로 부른 요청이 2xx 가 아니었다 — 대부분 복구기다. 잡은 초록이어도 이것이 온다 | 403 이면 `CRON_SECRET` 과 Vault 의 `reading_recovery_secret` 이 갈렸다, 503 이면 Vercel 쪽 열쇠 · DB 문 |
| `cron-inactive:<잡>` | 잡이 꺼져 있다 | 일부러 끈 것이 아니면 `select cron.alter_job(<jobid>, active := true)` |

재시도 소진은 잡이 스스로 알린다 — `account-disposal-overdue`(G-53) · `reading-budget-reached`.

**감시기가 못 보는 것 둘** — 감시기 자신이 계속 실패하는 것, `pg_cron` 이 통째로 멈춘 것. 그래서
**배포한 날과, 잡을 건드린 날에 한 번씩은 여전히 본다.**

```sql
select j.jobname, d.status, count(*) as 횟수,
       min(d.start_time) as 처음, max(d.start_time) as 마지막,
       max(d.return_message) filter (where d.status = 'failed') as 마지막_실패
from cron.job_run_details d
join cron.job j on j.jobid = d.jobid
where d.start_time > now() - interval '24 hours'
group by 1, 2 order by 1, 2;
```

지금 서 있는 잡은 넷이다 — `reading-recovery`(1분) · `match-request-expiry`(매시 7분) ·
`account-disposal`(매시 23분, G-53) · `cron-watch`(10분, G-42).
**`failed` 가 한 줄이라도 있으면 그 잡은 지금 안 도는 것이다.**

---

## 제품 지표

`prd-archive` 의 「제품 분석 지표」를 SQL 로 읽는 자리. 성장 목표 숫자는 아직 두지 않았다 —
먼저 분포를 본다.

```sql
-- 온보딩: 가입한 사람 중 자기 사주를 저장한 비율
select count(*) as 계정,
       count(self_person_id) as selfPerson_저장,
       round(100.0 * count(self_person_id) / nullif(count(*), 0), 1) as 비율
from public.app_user where status = 'active';

-- 참여 · 노출 · 요청 · 수락
select
  (select count(*) from public.discovery_profile where opted_in_at is not null) as 참여중,
  (select count(*) from public.discovery_impression) as 노출,
  (select count(*) from public.match_request) as 요청,
  (select count(*) from public.match_request where status = 'accepted') as 수락,
  (select count(*) from public.match_request where status = 'rejected') as 거절,
  (select count(*) from public.match_request where status = 'pending') as 미응답;

-- 자리와 탐색 여부에 따라 요청률이 다른가 — `discovery-v0` 를 평가하는 근거
select i.position, i.exploration, count(*) as 노출,
       count(r.id) as 요청,
       round(100.0 * count(r.id) / nullif(count(*), 0), 1) as 요청률
from public.discovery_impression i
left join public.match_request r
  on r.requester_user_id = i.viewer_user_id
 and r.addressee_user_id = i.candidate_user_id
group by i.position, i.exploration
order by i.position, i.exploration;

-- 출생시간 유무에 따른 노출 격차 (고정 표본 측정은 `src/lib/discovery/exposure.test.ts`)
select per.birth_time is not null as 시각_있음,
       count(distinct p.user_id) as 사람,
       count(i.candidate_user_id) as 노출
from public.discovery_profile p
join public.app_user a on a.id = p.user_id
join public.person per on per.id = a.self_person_id
left join public.discovery_impression i on i.candidate_user_id = p.user_id
where p.opted_in_at is not null
group by 1;
```

### 풀이 재사용 — 최소 측정 (G-37)

로그인 사용자의 풀이 생성만 센다 — 외부 분석 도구 · 쿠키 · 익명 식별자는 없다(2026-09-23 사람의 결정).
읽는 것은 `reading_run` 의 **사용자 ID · 상태 · 시각뿐**이고, 이메일 · 닉네임 · 출생정보 · 풀이 본문은 안 읽는다.
복사해 두는 표도 없다 — 매번 이 질의가 센다. 운영 검증 계정(`verification_account`)은 뺀다.

- **요청**은 시도 행 하나다 — 상한(G-03)이 세는 것과 같다. 개인 · 저장한 사람 · 직접 궁합 · 수락 뒤 자동 궁합 · 다시 받기가
  다 들고, 자동 궁합은 그 행의 사용자에게 센다
- **성공률**은 끝난 시도(성공 + 실패) 중 성공이다 — 도는 중인 것은 분모에 안 넣는다
- **재사용률**은 첫 성공 뒤 30일이 **다 지난** 사람만 분모에 든다. 창이 아직 열린 사람은 따로 센다 — 섞으면 막 온
  사람이 「안 돌아왔다」로 세어져 비율이 낮게 읽힌다
- **탈퇴하면 빠진다.** `reading_run.user_id` 가 `on delete cascade` 라 처분 때 그 사람의 행이 지워진다(ADR 0094) —
  비율은 남은 사용자의 것이다. 사용자별 화면은 만들지 않는다

```sql
with runs as (
  select r.user_id, r.status, r.created_at
  from public.reading_run r
  where not exists (select 1 from public.verification_account v where v.user_id = r.user_id)
),
firsts as (
  select user_id, min(created_at) as first_success
  from runs where status = 'succeeded' group by user_id
),
again as (
  select f.first_success,
         exists (select 1 from runs r
                 where r.user_id = f.user_id and r.status = 'succeeded'
                   and r.created_at > f.first_success
                   and r.created_at <= f.first_success + interval '30 days') as reused
  from firsts f
)
select
  (select count(*) from runs) as 요청,
  (select count(*) from runs where status = 'succeeded') as 성공,
  (select count(*) from runs where status = 'failed') as 실패,
  round(100.0 * (select count(*) from runs where status = 'succeeded')
        / nullif((select count(*) from runs where status <> 'running'), 0), 1) as 성공률,
  (select count(*) from again where first_success <= now() - interval '30 days') as 창_닫힌_사람,
  (select count(*) from again where first_success <= now() - interval '30 days' and reused) as 그중_다시_성공,
  round(100.0 * (select count(*) from again where first_success <= now() - interval '30 days' and reused)
        / nullif((select count(*) from again where first_success <= now() - interval '30 days'), 0), 1) as 재사용률,
  (select count(*) from again where first_success > now() - interval '30 days') as 창_열린_사람,
  (select count(*) from again where first_success > now() - interval '30 days' and reused) as 그중_이미_다시_성공;
```

2026-09-23 에 운영에서 한 번 돌린 값: 요청 29 · 성공 28 · 실패 1 · 성공률 96.6% · 창이 닫힌 사람 0(재사용률은 아직 없다) ·
창이 열린 사람 12 중 이미 다시 성공한 사람 10. 검증 계정 1개를 뺀 수다.

---

## 보안 점검 — advisor 와 접속기록 (G-23 ⑩ ⑪)

### 보안 advisor — **부르는 명령 하나** (G-23 ⑪)

Supabase 가 스키마와 인증 설정을 훑어 내는 경고다(splinter). 다시 잴 때는 이 한 줄이다 — 원격에 닿으므로
잠금을 지난다(ADR 0096).

```bash
node scripts/remote-lock.mjs npx supabase db advisors --linked --type security --level info --output-format json \
  | jq -r '.results | group_by(.name) | .[] | "\(.[0].level) \(.[0].name) \(length)"'
```

같은 것을 Management API 로도 받는다 — `GET /v1/projects/xgdeguyxgkillndraonc/advisors/security`(열쇠는 CLI 가
macOS 키체인에 둔 것, 문서에 적지 않는다). **로컬 스택의 `--local` 은 0028 · 0029 와 인증 경고를 안 낸다** —
판본이 다르다. 운영에 대고 잰다.

**2026-09-24 에 잰 값(운영).** 합계 WARN 87 → 71, INFO 26 → 26. 고친 뒤 값은 `20261009120000` 을 올린 다음 다시 불러 쟀고, 발행 키로 `rpc/beta_is_over` 를 부르면 `42501` 이다.

| lint | 고치기 전 | 고친 뒤 | 무엇을 했나 |
| --- | --- | --- | --- |
| WARN `function_search_path_mutable`(0011) | 15 | 0 | 상수 함수 열다섯에 `search_path = ''` — `20261009120000` |
| WARN `anon_security_definer_function_executable`(0028) | 3 | 2 | `beta_is_over()` 를 닫았다 — 화면이 안 부르고 definer 안에서만 불린다 |
| WARN `authenticated_security_definer_function_executable`(0029) | 68 | 68 | `claimed_by` · `may_edit_person_input`(남의 claim · 편집권을 묻는 신탁) · `beta_is_over` 를 닫아 65 가 됐고, 같은 날 G-24 가 `/ops/reports` 의 운영자 문 셋(`operator_reports` · `operator_report` · `operator_report_snapshot`, `is_operator()` 검사)을 더했다 |
| WARN `auth_leaked_password_protection` | 1 | 1 | **남긴다 — Pro 플랜부터다**(아래) |
| INFO `rls_enabled_no_policy` | 26 | 26 | **남긴다 — 의도다**(아래) |

잠금은 pgTAP `44_advisor_lints`(invoker 까지 search_path · 닫은 셋) 와 `33_function_shape`(anon 에 열린 문은
둘 — `current_beta_schedule()` · `shared_reading(text)`).

**남긴 것과 까닭.**

- **0028 둘 · 0029 예순여덟은 앱이 부르라고 연 문이다.** 이 저장소의 쓰기와 읽기는 `security definer` RPC 가
  들고(`docs/notes/rpc-and-exposure-rules.md`), 각 문은 `auth.uid()` 나 그것을 묻는 범위 함수(`reading_scope` · `is_operator` ·
  `visible_notifications` · `may_see_photo`)로 좁힌다 — 2026-09-24 에 `auth.uid()` 를 직접 안 묻는 열여섯의
  몸을 열어 범위 함수 · 운영자 검사 · 상수 · 공유 토큰임을 봤다.
  advisor 문서도 「일부러 연 문이면 그 대상에 대해 무시해도 된다」고 적는다(lint 0029 의 세 번째 길). 대상별로
  끄는 장치는 없고, 규칙째 끄면 **의도하지 않은 새 문도 함께 숨는다** — 끄지 않는다. 이 중 다섯은 정책 · invoker
  함수 · 흐름 검사가 사용자 역할로 불러 닫을 수 없다: `is_active_account` · `chat_room_readable`(RLS 정책) ·
  `set_person_listed`(invoker `create_pair_for_reading`) · `chat_policy` · `presence_policy`(흐름 검사가
  사용자 열쇠로 수를 대조한다). **글자 그대로 0 으로 만드는 길**은 definer 몸을 노출 안 된 스키마로 옮기고
  `public` 에 invoker 껍데기를 두는 것인데, 열리는 문이 같아 막는 것이 없다 — 하지 않았다.
- **유출 비밀번호 검사(HaveIBeenPwned)는 Pro 플랜부터다**(<https://supabase.com/docs/guides/auth/password-security>,
  2026-09-24). 조직 플랜은 `free`(Management API `GET /v1/organizations/{id}` 의 `plan`). 앱의 로그인은 구글
  하나지만 이메일 공급자가 켜져 있다(`external_email_enabled: true`, 확인 메일 필요) — e2e 와 운영 확인 계정이
  비밀번호로 들어오는 길이다. 끌지는 G-23 줄에 남겼다.
- **정책 없는 RLS 표 스물여섯은 의도다** — 앱은 표를 직접 읽지 않고 definer 문으로만 닿는다. 정책이 없으면
  anon · authenticated 는 한 줄도 못 본다. 등급이 INFO 라 경고가 아니다.

**인증 설정 — 바꾼 것 없음(2026-09-24).** 운영 값: OTP 만료 3600초(`mailer_otp_exp`, advisor 의 한도 안),
TOTP MFA 켜짐, 전화 공급자 꺼짐, 익명 로그인 꺼짐, refresh 회전 켜짐. `supabase/config.toml` 은 advisor 가
보는 값과 어긋남이 없다.

### 운영자 접속기록 — **어디에 며칠 남나** (G-23 ⑩ · G-25 ③)

G-25 ③ 이 운영자의 개인정보처리시스템 접속기록을 **1년 이상** 두기로 했다(안전성 확보조치 기준 제8조).
2026-09-24 에 자리마다 잰 값이다. 플랜은 CLI · API 로 읽었다 — Supabase 조직 `free`, Vercel 팀
`sungheeyoons-projects` `hobby`, GitHub 개인 계정(`User`, 저장소 공개).

| 자리 | 기록 종류 — 누가 · 언제 · 무엇 | 보존 | 근거 · 확인 날짜 |
| --- | --- | --- | --- |
| Supabase SQL Editor · Table Editor · `db query --linked`(`npm run db:remote`) | Postgres 로그. **`log_statement = ddl` 이라 읽기(select)는 안 남는다**, `pgaudit` 은 설치 안 됨 | **읽기 0일** · DDL 1일 | 운영에서 `current_setting('log_statement')` · `pg_extension`(2026-09-24) · 로그 보존 Free 1일 <https://supabase.com/pricing> |
| Supabase 조직 · 프로젝트 설정(Management API 행위 포함) | Platform Audit Logs | **없음** — Team · Enterprise 만 | <https://supabase.com/docs/guides/security/platform-audit-logs>(2026-09-24) |
| Supabase 계정 | Account Audit Logs(<https://supabase.com/dashboard/account/audit>) — 제 계정의 행위 | **모름** — 문서에 일수가 없고 API(PAT)로는 못 읽는다(`401`) | 같은 문서(2026-09-24). 사람이 화면에서 가장 오래된 줄을 본다 |
| 앱의 운영자 화면 `/ops/**` | Vercel 런타임 로그(요청 경로 · 시각). 누가 봤는지는 없다. DB 는 `operator_*` 호출을 안 적는다 | **1시간** | <https://vercel.com/docs/logs/runtime> Hobby(2026-09-24) |
| Vercel 팀 | Activity Log — 환경변수 복호화(`env-variable-read`, 사용자 이름) · 배포 · 설정 변경. **로그인은 안 남는다**(SSO 만) | **1년 넘음** — 2025-08-09 줄이 보인다(13달+) | <https://vercel.com/docs/activity-log> 「since its creation」 · `vercel activity -a --until 2026-01-01`(2026-09-24). Audit Log 는 Enterprise |
| GitHub 개인 계정 | Security log — 로그인 · 토큰 · 설정 | **90일** — JSON · CSV 로 내보내기는 화면에서만 | <https://docs.github.com/en/authentication/keeping-your-account-and-data-secure/reviewing-your-security-log>(2026-09-24). **개인정보처리시스템이 아니다** — 저장소에 이용자 자료가 없고 Actions 비밀값도 0(`gh secret list`) |
| PortOne 관리자 콘솔 | — | **계약 전이라 못 잼** | G-21 에서 가맹할 때 콘솔 접속기록 보존 기간을 묻는다 |

**1년에 못 미치는 자리 — 이용자 자료에 닿는 둘이 다 0 이다.** Supabase 의 SQL · 표 편집기와 앱의 `/ops`
화면은 누가 무엇을 읽었는지가 아무 데도 1년 남지 않는다. 돈이 드는 길(Team 플랜)도 로그 28일 · Platform
Audit 이라 **읽기는 여전히 안 남는다** — 플랜으로 풀리는 틈이 아니다. 무료 길 셋을 견줬다.

| 길 | 무엇을 덮나 | 약한 곳 |
| --- | --- | --- |
| ① `pgaudit`(`postgres` 역할 read · write) + 매일 로그를 받아 밖에 쌓는 크론 | SQL Editor · `db:remote` · 대시보드 표 편집 | 로그가 하루면 사라져 **크론이 하루 빠지면 그날이 없다**. 크론이 Management 열쇠를 들어야 하고, SQL 본문에 이용자 자료가 섞인 채 밖에 쌓인다 |
| ② **DB 안 운영자 접속기록 표** — `/ops` 의 `operator_*` 문이 한 줄씩 적고, `npm run db:remote` 도 돌기 전에 한 줄 적는다 | `/ops` 화면 전부 · CLI 로 보내는 SQL 전부 | 대시보드 SQL Editor 는 안 덮는다 — 그 자리에서 이용자 자료를 읽지 않는 것을 규약으로 둔다. `postgres` 는 표를 고칠 수 있다 |
| ③ 손으로 적는 장부 | 전부 | 잊으면 없다 |

**권하는 것은 ②다** — 하루 틈이 없고, 열쇠가 밖으로 안 나가고, 저장소 안에서 끝난다. G-24 가 `/ops/reports`
에 새 운영자 문을 여는 중이라 **그 머지 뒤에 한 번에 만든다**(그 문들도 함께 적게). 정할 것 하나 — CLI SQL 의
**본문을 적는가**(이용자 자료가 섞인다) **목적과 해시만 적는가**. G-23 줄에 남겼다.

**사람이 할 걸음.**

1. Supabase <https://supabase.com/dashboard/account/audit> 에서 가장 오래된 줄의 날짜를 보고 위 표의 「모름」을
   값으로 바꾼다
2. GitHub 보안 로그는 90일이라 **분기마다 한 번** <https://github.com/settings/security-log> → Export → JSON 을
   저장소 밖(개인 보관소)에 쌓는다 — 개인정보처리시스템은 아니지만 비밀값이 생기는 날 필요해진다
3. PortOne 가맹 때 콘솔 접속기록 보존 기간을 묻는다(G-21)

## 배포

`main` 에 푸시하면 자동 배포된다 — https://saju-snowy.vercel.app

마이그레이션은 따로 올린다.

```bash
npx supabase migration list   # remote 칸이 빈 줄이 밀린 것이다 — 먼저 본다
npm run db:push               # 밀린 것 전부를 원격에 적용한다 — 잠금 하나를 잡고 돈다(ADR 0096)
```

### 규약 넷 — 앱과 DB 는 따로 간다 (ADR 0090)

세션 메모에만 있던 것을 2026-09-22 에 옮겼다. 에이전트가 이 절을 밟는 걸음은 공식 운영에 들어간 뒤에는
사람이 답한 뒤고, 운영 베타에서는 직접 밟고 본 값을 적는다(`docs/agents/delegation.md` 권한 등급 3,
ADR 0093).

1. **앱 배포 ≠ DB 마이그레이션.** main 머지는 앱만 내보낸다. 마이그레이션이 든 PR 이 머지돼도
   원격 DB 는 그대로다 — 2026-09-12 에 마이그레이션 넷이 안 오른 채 최신 앱이 돌아 후보 카드의
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
   잡을 건드렸으면 `cron.job_run_details`(「도는 잡이 정말 도나」). 앱은 Vercel 의 Ready.

**`db push` 뒤에 새 함수를 손으로 다시 적을 때는 프로덕션의 살아 있는 정의에서 뜬다** — 옮겨
적으면 그 사이에 바뀐 것을 되돌린다(ADR 0043 의 풀이권 함수가 그랬다).

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

> `supabase config push` 로 대신하지 않는다. **원격의 구글 설정을 지운다**(맨 위 경고).

**2. 마이그레이션을 올린다**

```bash
npm run db:push
```

**3. 앱을 배포한다** — `main` 에 머지하면 자동으로 나간다.

**4. 첫 코드를 넣는다** — 위 「초대」의 `insert into public.signup_code …`.

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
