# 운영 절차 — 도는 잡 · 제품 지표

색인은 `docs/ops/runbook.md` 다.

## 도는 잡이 정말 도나 — **실패는 여기에만 남는다**

`pg_cron` 이 돌리는 것은 앱 로그에 안 남고 `cron.job_run_details` 에만 남는다. 그래서
**실패해도 아무도 모른다.** 실제로 그랬다: 복구기가 2026-09-01 부터 **4,542번 연속
실패**하고 있었고(`extensions.http_get` 은 없다 — `pg_net` 은 `net` 에 산다), 알림 배선을
쏴 보다가 같은 착각을 발견해서야 드러났다(ADR 0039).

**이제 감시기가 본다**(2026-09-23, G-42). 크론 `cron-watch`(10분마다)가 `watch_cron()` 으로 지난 한 시간을
보고, 넷 중 하나면 `notify_ops` 로 한 줄을 보낸다 — 정상 실행은 아무것도 안 적는다. 같은 종류는 하루 한 번이다.

| 종류 | 뜻 | 할 일 |
| --- | --- | --- |
| `cron-failed:<잡>` | 그 잡의 SQL 이 실패했다. 알림에 마지막 오류가 붙는다 | 아래 질의로 `return_message` 를 보고 함수를 고친다 |
| `net-request-failed` | 크론이 밖으로 부른 요청이 2xx 가 아니었다 — 대부분 복구기다. 잡은 초록이어도 이것이 온다 | 403 이면 `CRON_SECRET` 과 Vault 의 `reading_recovery_secret` 이 갈렸다, 503 이면 Vercel 쪽 열쇠 · DB 문 |
| `cron-inactive:<잡>` | 잡이 꺼져 있다 | 일부러 끈 것이 아니면 `select cron.alter_job(<jobid>, active := true)` |
| `reading-failure-rate` | 지난 한 시간에 끝난 풀이 시도 중 실패가 다섯 번 이상이고 절반 이상이다(`20261108090000`, 문턱은 `reading_failure_alert_floor()` · `reading_failure_alert_share()`). 알림에 가장 잦은 실패 코드가 붙는다 | 코드가 검사 실패(`length-out-of-contract` 같은 것)면 프롬프트 · 모델 판, `unexpected` 면 Vercel 로그의 `submit:` · `collect:` 줄 |

재시도 소진은 잡이 스스로 알린다 — `account-disposal-overdue`(G-53) · `reading-budget-reached` · 로그인 전 사주 문단의 `taste-budget-warning` · `taste-budget-reached`(`docs/ops/runbook/ai.md` 「로그인 전 사주 문단 — 비밀 둘 · 상한 · 비용」).

**서버 오류는 앱이 알린다** — `request-error:<자리>:<라우트 파일>`(자리는 `render` · `route` · `action` · `proxy`). 앱의
`instrumentation.ts` 의 `onRequestError` 가 열쇠로 `report_request_error` 를 부르고(Production 만, `app/request-error.ts`),
라우트 파일 · 자리마다 하루 한 줄이다. 알림에는 라우트 무늬와 digest 만 있다 — Vercel 로그에서 그 digest 로 오류 줄을 찾는다.
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

0 이 있으면 복구기는 멈춰 있다 — `docs/ops/runbook/access.md` 「비밀이 새면」 표의 `CRON_SECRET` = Vault `reading_recovery_secret` · Vault
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
찍는다. 2026-09-30 에 마이그레이션에서 센 것은 여덟이다 — `reading-recovery`(1분) · `match-request-expiry`(매시 7분) ·
`account-disposal`(매시 23분, G-53) · `report-retention-purge`(매시 47분, ADR 0098) · `cron-watch`(10분, G-42) ·
`cron-run-retention-purge`(매일 04:37 UTC, 크론 실행 이력 14일, ADR 0138) · `payment-retention-purge`(매일 04:53 UTC) · `audit-export-watch`(매일 06:29 UTC, `docs/ops/runbook/security.md` 「반출 — 매일 S3」). 2026-10-03 에
`taste-sweep`(5분마다, 매시 1 · 6 · 11 … 분, ADR 0143 — `20261118090000`)이 더해졌다.
Vercel Cron 은 둘이다(`vercel.json`) — 복구기의 하루 청소(`/api/cron/reading`)와 접속기록 반출(`/api/cron/audit-export`,
ADR 0105). 둘은 `cron-watch` 가 못 본다 — 반출은 pg_cron 의 `audit-export-watch` 가 매일 본다(시도나 성공이 이틀 넘게 없으면 알린다).
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
