# 운영 절차 — 도는 잡 · 제품 지표

색인은 `docs/ops/runbook.md` 다.

## 도는 잡이 정말 도나 — **실패는 여기에만 남는다**

`pg_cron` 이 돌리는 것은 앱 로그에 안 남고 `cron.job_run_details` 에만 남는다. 그래서
**실패해도 아무도 모른다.** 실제로 그랬다: 복구기가 2026-09-01 부터 **4,542번 연속
실패**하고 있었고(`extensions.http_get` 은 없다 — `pg_net` 은 `net` 에 산다), 알림 배선을
쏴 보다가 같은 착각을 발견해서야 드러났다(ADR 0039).

**이제 감시기가 본다**(2026-09-23, G-42). 크론 `cron-watch`(10분마다)가 `watch_cron()` 으로 지난 한 시간을
보고, 다섯 중 하나면 `notify_ops` 로 한 줄을 보낸다 — 정상 실행은 아무것도 안 적는다. 같은 종류는 하루 한 번이다.

| 종류 | 뜻 | 할 일 |
| --- | --- | --- |
| `cron-failed:<잡>` | 그 잡의 SQL 이 실패했다. 알림에 마지막 오류가 붙는다 | 아래 질의로 `return_message` 를 보고 함수를 고친다 |
| `net-request-failed` | 크론이 밖으로 부른 요청이 2xx 가 아니었다 — 대부분 복구기다. 잡은 초록이어도 이것이 온다 | 403 이면 `CRON_SECRET` 과 Vault 의 `reading_recovery_secret` 이 갈렸다, 503 이면 Vercel 쪽 열쇠 · DB 문 |
| `cron-inactive:<잡>` | 잡이 꺼져 있다 | 일부러 끈 것이 아니면 `select cron.alter_job(<jobid>, active := true)` |
| `reading-failure-rate` | 지난 한 시간에 끝난 풀이 시도 중 실패가 다섯 번 이상이고 절반 이상이다(`20261108090000`, 문턱은 `reading_failure_alert_floor()` · `reading_failure_alert_share()`). 알림에 가장 잦은 실패 코드가 붙는다 | 코드가 검사 실패(`length-out-of-contract` 같은 것)면 프롬프트 · 모델 판, `unexpected` 면 Vercel 로그의 `submit:` · `collect:` 줄 |
| `database-size-warning` · `database-size-critical` · `database-size-unreadable` | DB 크기(클러스터의 모든 DB 의 `pg_database_size` 합 — Supabase 가 세는 값)가 350MB · 425MB 를 넘었다(`20261224090000`, ADR 0199 — 문턱은 `database_size_warning_bytes()` · `database_size_critical_bytes()`). **Free 는 500MB 에서 읽기 전용이 되고 그 뒤에는 `ops_alert` 에 못 적어 이 알림도 못 나간다**. `database-size-unreadable` 은 감시기가 크기를 못 쟀다는 뜻이다(다른 갈래는 그대로 돈다) | 큰 표를 본다 — `select concat(n.nspname, '.', c.relname), pg_size_pretty(pg_total_relation_size(c.oid)) from pg_class c join pg_namespace n on n.oid = c.relnamespace where c.relkind in ('r', 'm', 'p') order by pg_total_relation_size(c.oid) desc limit 10;`(크기만 — 개인정보 없음). 지울 것이 없으면 플랜을 올린다. **이미 읽기 전용이 됐으면** Supabase 문서의 차례로 푼다(<https://supabase.com/docs/guides/platform/database-size>, 2026-10-22 읽음) — `set session characteristics as transaction read write;` → 지운다 → `vacuum;` → `set default_transaction_read_only = 'off';` |

**지급 장부의 대조도 잡이 스스로 알린다** — `credit-grant-mismatch:<계정 id>`(크론 `credit-grant-watch`, 매일 05:41 UTC, G-111 R-8 ·
ADR 0191). 무상 지급 장부의 합과 예외 몫(`reading_credit_grant.extra`)이 다른 계정마다 하루 한 줄이고 아무것도 고치지 않는다. 할 일은
`docs/ops/runbook/credits.md` 「무상 풀이권 지급 · 회수」의 대조 절.

재시도 소진은 잡이 스스로 알린다 — `account-disposal-overdue`(G-53) · `reading-budget-reached` · 로그인 전 사주 문단의 `taste-budget-warning` · `taste-budget-reached`(`docs/ops/runbook/ai.md` 「로그인 전 사주 문단 — 비밀 둘 · 상한 · 비용」).

**서버 오류는 앱이 알린다** — `request-error:<자리>:<라우트 파일>`(자리는 `render` · `route` · `action` · `proxy`). 앱의
`instrumentation.ts` 의 `onRequestError` 가 열쇠로 `report_request_error` 를 부르고(Production 만, `app/request-error.ts`),
라우트 파일 · 자리마다 하루 한 줄이다. 알림에는 라우트 무늬와 digest 만 있다 — Vercel 로그에서 그 digest 로 오류 줄을 찾는다. **Hobby 플랜의 런타임 로그는 짧게만 남는다**
(`docs/ops/runbook/erasure.md` 「DB 밖」 표의 「Vercel 로그」 줄) — 알림을 받으면 미루지 말고 연다. 로그가 이미 없으면 digest 와 라우트 무늬만 남는다.
알림을 보내다 실패하면 삼키고 로그에 `request-error: report_request_error` 한 줄을 남긴다. Next 는 오류 응답 전에 이 부름을 기다리므로 부름은 1.5초에 끊고, 한 인스턴스 안에서도 같은 날 같은 라우트 · 자리는 한 번만 부른다.

**감시기가 못 보는 것 셋** — 감시기 자신이 계속 실패하는 것, `pg_cron` 이 통째로 멈춘 것, 그리고 **복구기의 Vault 배선이
빈 것.** `wake_reading_recovery()` 는 Vault 의 `reading_recovery_url` · `reading_recovery_secret` 중 하나라도 값이 `null`
이면 아무것도 안 하고 돌아간다 — 1분마다 예외를 쌓으면 그 소음이 진짜 실패를 덮기 때문이다(ADR 0020). 그래서 이름을 한
글자 틀리거나 값을 안 넣어도 잡은 초록이고, 요청을 안 보내니 `net-request-failed` 도 안 온다. 그래서
**배포한 날과, 잡을 건드린 날에 한 번씩은 여전히 본다** — 아래 둘 다.

```sql
-- 복구기의 Vault 배선 — wake 와 같은 조건(`decrypted_secret is not null`)을 본다. 값은 안 읽는다. 둘 다 1 이어야 한다
select (select count(*) from vault.decrypted_secrets
        where name = 'reading_recovery_url' and decrypted_secret is not null) as url_ok,
       (select count(*) from vault.decrypted_secrets
        where name = 'reading_recovery_secret' and decrypted_secret is not null) as secret_ok;
```

0 이 있으면 복구기는 멈춰 있다 — `docs/ops/runbook/secret-leak.md` 「비밀이 새면」 표의 `CRON_SECRET` = Vault `reading_recovery_secret` · Vault
`reading_recovery_url` 줄대로 넣는다. 들어갔는지는 2분 뒤 `select status_code, created from net._http_response order by
created desc limit 3;` 가 200 인지로 본다. 2026-10-01 에 운영에서 둘 다 1 이었다.

```sql
select j.jobname, d.status, count(*) as 횟수,
       min(d.start_time) as 처음, max(d.start_time) as 마지막,
       max(d.return_message) filter (where d.status = 'failed') as 마지막_실패
from cron.job_run_details d
join cron.job j on j.jobid = d.jobid
where d.start_time > now() - interval '24 hours'
group by 1, 2 order by 1, 2;
```

서 있는 잡의 원본은 `supabase/migrations/` 의 `cron.schedule` 이고, 운영의 실제는 `select jobname, schedule from cron.job;` 이
찍는다. 2026-09-30 에 마이그레이션에서 센 것은 여덟이다 — `reading-recovery`(1분) · `match-request-expiry`(1분) ·
`account-disposal`(매시 23분, G-53) · `report-retention-purge`(매시 47분, ADR 0098) · `cron-watch`(10분, G-42) ·
`cron-run-retention-purge`(매일 04:37 UTC, 크론 실행 이력 14일, ADR 0138) · `payment-retention-purge`(매일 04:53 UTC) · `audit-export-watch`(매일 06:29 UTC, `docs/ops/runbook/security.md` 「반출 — 매일 S3」). 2026-10-03 에
`taste-sweep`(5분마다, 매시 1 · 6 · 11 … 분, ADR 0143 — `20261118090000`)이 더해졌다. 2026-10-17 에 `credit-grant-watch`(매일 05:41 UTC,
무상 지급 장부의 대조, ADR 0191 — `20261219090000`)가 더해졌다. 2026-10-08(#526) 에 머지된 `20261121090000` 이 `push-dispatch`(매분) ·
`push-delivery-retention-purge`(매일 04:43 UTC)를 세웠다(ADR 0156) — 2026-10-22 에 다시 센 이 목록이 빠뜨린 둘이다. 웹 푸시를 켜는 걸음과
확인은 `docs/ops/runbook/push.md`.
Vercel Cron 은 둘이다(`vercel.json`) — 복구기의 하루 청소(`/api/cron/reading`)와 접속기록 반출(`/api/cron/audit-export`,
ADR 0105). 둘은 `cron-watch` 가 못 본다 — 반출은 pg_cron 의 `audit-export-watch` 가 매일 본다(시도나 성공이 이틀 넘게 없으면 알린다).
**`failed` 가 한 줄이라도 있으면 그 잡은 지금 안 도는 것이다.**

### 바깥 감시 — 앱이 통째로 죽거나 DB 가 알림을 못 쓸 때 (G-118)

위의 알림은 전부 DB 안의 `notify_ops` 한 길로 나간다 — `pg_cron` 이 멈추거나 · 감시기가 계속 실패하거나 · DB 가 읽기 전용이
되거나(Free 500MB, ADR 0199) · 프로젝트가 멈추면 그 길이 함께 서고, 앱이 통째로 응답하지 않는 것(도메인 · 배포 · 플랜 한도)은
그 길이 아예 모른다. 그래서 **바깥 서비스가 두 꼴로 본다** — 주소를 두드리는 uptime 감시, 그리고 DB 가 10분마다 보내는 신호가
끊기면 알리는 dead-man heartbeat. **어느 서비스를 쓸지 · 비용은 운영자 결정이다**(간극 대장 G-118 — 후보와 추천은
[기록](../../product/gaps/records/g-118.md)). 아래는 서비스와 상관없이 정한 것이다.

**무엇을 보나** — `<운영 주소>` 는 `docs/ops/runbook/domain.md` 맨 위의 그 한 줄이다(여기 적지 않는다).

| # | 꼴 | 대상 | 정상 | 주기 · 유예 | 이것이 잡는 것 |
| --- | --- | --- | --- | --- | --- |
| 1 | uptime(HTTP) | `<운영 주소>/` | 200 | 5분 | 도메인 · DNS · 인증서 · Vercel 프로젝트 전체 — 이 화면은 빌드 때 그려져 CDN 이 내므로 **함수 · DB 는 못 본다** |
| 2 | uptime(HTTP) | `<운영 주소>/api/health` | 200 · 본문 `{"status":"ok"}` | 5분 | 함수가 돈다 · 앱이 접속값으로 DB 에 닿는다(로그인 없는 역할로 공개 문 `current_beta_schedule` 하나, 5초에 끊는다). DB 를 못 읽으면 503 `{"status":"unavailable"}`. **이 문은 #804(결정 대기 — 자격을 묻지 않는 문)에 있고 아직 운영에 없다** |
| 3 | heartbeat | 서비스가 주는 신호 주소 → Vault `ops_heartbeat_url` | 10분마다 GET 하나 | 기간 10분 · 유예 10분 | `pg_cron` 멈춤 · 감시기(`cron-watch`)의 25분 넘는 실패 · 읽기 전용 · 프로젝트 멈춤. 크론 `ops-heartbeat`(`5-59/10`, `ping_ops_heartbeat()`)가 **감시기가 25분 안에 성공했을 때만** 보낸다 — 마이그레이션은 draft #805 에 있고 아직 운영에 없다 |

**어디로 알리나** — 바깥 서비스가 **직접** 보낸다(DB 를 안 지난다). 운영자 이메일 하나는 반드시 걸고, 지금 운영 채널(Slack ·
Discord — Vault `ops_alert_url` 과 같은 채널)을 더한다. 채널의 웹훅이 끊긴 것은 이 감시도 모른다 — 이메일이 그 몫이다.

**잡지 못하는 것** — 화면 하나만 깨진 것(서버 오류 알림 `request-error:*` 이 본다) · 로그인 · 풀이 같은 흐름의 실패(풀이 실패율 ·
#770 의 운영자 확인이 본다) · 운영 채널 웹훅의 폐기.

**보내는 것과 받는 것** — 두드리는 요청과 신호는 본문이 없고, 상태 문의 답은 한 낱말이다. 개인정보는 바깥 서비스로 가지 않는다
(운영자 이메일 · 채널 주소는 서비스 계정의 설정이다).

#### 서비스를 고른 날 — 붙이는 차례

1. **서비스 계정**을 만들고 MFA 를 켠다(#304 의 MFA 줄에 이 서비스를 더한다). 알림 받을 곳에 운영자 이메일을 넣고, 채널을 쓰면 그 연동을 더한다.
2. **uptime 둘** — 위 표 1 · 2 를 HTTP(S) 감시로 만든다. 2 는 본문 낱말(`"status":"ok"`)을 보는 감시가 있으면 그것으로, 없으면 상태 코드로.
   방법 GET · 넘김 따라가지 않음(넘김이 생기면 그것이 바뀐 것이다) · 제한시간 30초 안팎.
3. **heartbeat 하나** — 기간 10분 · 유예 10분으로 만들고 신호 주소를 받는다. 신호 주소는 **열쇠다**(가진 사람이 「살아 있다」를 꾸민다) —
   저장소 · 이슈 · 노트에 적지 않는다.
4. **Vault 에 넣는다**(heartbeat 마이그레이션이 운영에 오른 뒤 — `docs/ops/runbook/deploy.md` 「배포」의 `db push` 차례):

   ```sql
   select vault.create_secret('<신호 주소>', 'ops_heartbeat_url');
   -- 들어갔나 — 값은 안 본다. 1 이어야 한다
   select count(*) from vault.decrypted_secrets where name = 'ops_heartbeat_url' and decrypted_secret is not null;
   -- 한 번 쏴 본다 — 감시기가 25분 안에 성공했으면 참
   select public.ping_ops_heartbeat();
   ```

   주소를 바꿀 때는 `vault.update_secret((select id from vault.secrets where name = 'ops_heartbeat_url'), '<새 주소>')`.
   새면 `docs/ops/runbook/secret-leak.md` 「비밀이 새면」 표의 Vault `ops_heartbeat_url` 줄대로 바꾼다.

**붙인 뒤 확인** — 값은 #304 의 그 줄 댓글에 날짜와 함께.

- `curl -s -o /dev/null -w '%{http_code}\n' <운영 주소>/api/health` 가 200, 서비스 화면의 두 감시가 「up」
- 2분 뒤 `select status_code, created from net._http_response order by created desc limit 3;` 에 200 이 있고, 서비스 화면의 heartbeat 가 「up」
- **알림이 실제로 오나** — heartbeat 잡을 잠시 끈다: `select cron.alter_job((select jobid from cron.job where jobname = 'ops-heartbeat'), active := false);`
  → 20~25분 안에 이메일(과 채널)로 「down」이 온다 → `active := true` 로 되돌리고 「up」이 오는 것을 본다. 끈 동안 감시기가
  `cron-inactive:ops-heartbeat` 를 한 번 보내는 것은 정상이다

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
