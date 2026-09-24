-- 떠난 사람의 신고 기록 — **처분일부터 6개월, 떨어진 자리에, 운영자만** (G-52, ADR 0098)
--
-- 여기서 재는 것 여섯.
--
--   1. **떠나도 남는다** — 신고한 쪽이 떠나든 당한 쪽이 떠나든, 크론의 처분이든 `forget_user` 든
--      `auth.users` 를 직접 지우든. 남는 것은 ADR 0098 의 목록 그대로이고 일반 표에서는 사라진다
--   2. **떠나지 않은 두 사람의 신고는 옮기지 않는다**
--   3. **남은 쪽이 나중에 떠나면 탈퇴일만 채운다** — 시계는 안 옮긴다
--   4. **일반 역할이 못 읽는다** — `anon` · `authenticated` · `service_role`
--   5. **증거는 고치지 못한다** — 검토 상태 · 탈퇴일 · 보류만 적는다
--   6. **6개월이 지나면 사라지고, 보류는 안 사라진다** — 보류를 풀면 다음 실행이 지운다
--
-- 세는 것은 이 파일이 만든 행뿐이다(`32_test_isolation`).
begin;
select plan(31);

create temporary table folks as
select
  tests.signup('keep-reporter@example.com') as reporter,
  tests.signup('keep-reported@example.com') as reported,
  tests.signup('keep-bystander@example.com') as bystander,
  tests.signup('keep-direct@example.com') as direct,
  tests.signup('keep-waiting@example.com') as waiting;

/** 신고 한 건 — 이 파일은 신고하는 문이 아니라 떠난 뒤를 잰다. 문은 14 · 34 가 잰다 */
create or replace function pg_temp.report(who uuid, whom uuid, why text, said text default null)
returns uuid
language sql
as $$
  insert into public.report (reporter_user_id, reported_user_id, reason, detail)
  values (who, whom, why, said) returning id
$$;

create temporary table cases as
select
  pg_temp.report(reporter, reported, 'harassment', '겪은 일') as with_snapshot,
  pg_temp.report(reported, bystander, 'other') as reporter_stays,
  pg_temp.report(bystander, reporter, 'inappropriate') as bystander_to_reporter,
  pg_temp.report(bystander, direct, 'impersonation') as to_direct,
  pg_temp.report(waiting, bystander, 'other') as from_waiting
from folks;

insert into public.chat_report_snapshot (report_id, match_id, message_id, context_before, context_after, messages)
select with_snapshot, gen_random_uuid(), gen_random_uuid(), 1, 0,
       '[{"seq":1,"body":"앞의 말","chosen":false},{"seq":2,"body":"고른 말","chosen":true}]'::jsonb
from cases;

update public.report set reviewed_at = now() - interval '1 hour'
where id = (select with_snapshot from cases);

-- ── 1. 떠나도 남는다 — forget_user ─────────────────────────────────────────────

select lives_ok(
  format($$select public.forget_user(%L)$$, (select reporter from folks)),
  '신고한 사람이 떠난다');

select is(
  (select count(*)::int from public.report r, cases c
   where r.id in (c.with_snapshot, c.bystander_to_reporter)),
  0, '일반 표에서는 사라진다 — 그 사람이 든 신고 둘');

select is(
  (select count(*)::int from public.chat_report_snapshot s where s.report_id = (select with_snapshot from cases)),
  0, '일반 표의 스냅샷도 사라진다');

select is(
  (select count(*)::int from retention.report k, cases c
   where k.report_id in (c.with_snapshot, c.bystander_to_reporter)),
  2, '떨어진 자리에 둘 다 남는다 — 신고한 쪽 · 당한 쪽');

select ok(
  (select k.reason = 'harassment' and k.detail = '겪은 일'
          and k.reported_at is not null and k.reviewed_at is not null
   from retention.report k where k.report_id = (select with_snapshot from cases)),
  '사유 · 상세 · 신고 시각 · 검토 상태가 그대로 남는다');

select is(
  (select k.snapshot -> 'messages' -> 1 ->> 'body' from retention.report k
   where k.report_id = (select with_snapshot from cases)),
  '고른 말', '스냅샷이 본문째 남는다');

select ok(
  (select k.reporter_user_id = f.reporter and k.reported_user_id = f.reported
          and k.reporter_email = 'keep-reporter@example.com'
          and k.reported_email = 'keep-reported@example.com'
   from retention.report k, folks f where k.report_id = (select with_snapshot from cases)),
  '두 계정의 UUID 와 로그인 이메일이 남는다');

select ok(
  (select k.reporter_joined_at is not null and k.reported_joined_at is not null
          and k.reporter_left_at > now() - interval '1 minute' and k.reported_left_at is null
          and k.retained_at > now() - interval '1 minute'
   from retention.report k where k.report_id = (select with_snapshot from cases)),
  '가입일 둘 · 떠난 쪽의 탈퇴일 · 처분일이 남고, 남은 쪽의 탈퇴일은 비어 있다');

select is(
  (select array_agg(key order by key collate "C") from retention.report k,
     jsonb_object_keys(to_jsonb(k)) key
   where k.report_id = (select with_snapshot from cases)),
  array['detail', 'held_at', 'hold_reason', 'reason', 'report_id', 'reported_at',
        'reported_email', 'reported_joined_at', 'reported_left_at', 'reported_user_id',
        'reporter_email', 'reporter_joined_at', 'reporter_left_at', 'reporter_user_id',
        'retained_at', 'review_note', 'review_outcome', 'reviewed_at', 'reviewed_by',
        'sanctioned_by', 'sanctioned_user_id', 'snapshot',
        'warning_acknowledged_at', 'warning_category', 'warning_email_result', 'warning_emailed_at', 'warning_ref'],
  '남는 칸은 ADR 0098 의 목록 · 보류 · 검토 기록(ADR 0105) · 경고의 칸(ADR 0108)뿐이다 — IP · 실명 · 전화번호의 자리가 없다');

-- ── 2. 떠나지 않은 두 사람의 신고는 옮기지 않는다 ─────────────────────────────

select is(
  (select count(*)::int from public.report where id = (select reporter_stays from cases)),
  1, '둘 다 남은 신고는 일반 표에 그대로 있다');

select is(
  (select count(*)::int from retention.report where report_id = (select reporter_stays from cases)),
  0, '둘 다 남은 신고는 옮기지 않는다');

-- ── 1. 떠나도 남는다 — auth.users 를 직접 지워도 (ADR 0023) ───────────────────

delete from auth.users where id = (select direct from folks);

select ok(
  (select k.reported_left_at is not null and k.reporter_left_at is null
          and k.reported_email = 'keep-direct@example.com'
   from retention.report k where k.report_id = (select to_direct from cases)),
  '누가 auth.users 를 직접 지워도 같은 답이다 — 당한 쪽이 떠나도 남는다');

-- ── 1. 떠나도 남는다 — 크론의 처분 ─────────────────────────────────────────────

update public.app_user
set status = 'deletion_requested', deletion_requested_at = now() - interval '25 hours'
where id = (select waiting from folks);

select public.dispose_requested_accounts();

select is(
  (select count(*)::int from auth.users where id = (select waiting from folks)),
  0, '크론이 처분한다 — 옮긴 기록은 흔적으로 세지 않는다(FK 가 아니다)');

select is(
  (select count(*)::int from public.account_disposal
   where user_id = (select waiting from folks)),
  0, '처분이 성공으로 적혔다');

select is(
  (select count(*)::int from retention.report where report_id = (select from_waiting from cases)),
  1, '크론이 처분한 사람의 신고도 남는다');

-- ── 3. 남은 쪽이 나중에 떠나면 탈퇴일만 채운다 ────────────────────────────────

/** 처분일을 과거로 민다 — 증거가 아니라 시험의 시계다. 트리거가 막으므로 이 트랜잭션 안에서만 뗀다 */
create or replace function pg_temp.retained_ago(id uuid, ago interval)
returns void
language plpgsql
as $$
begin
  alter table retention.report disable trigger retained_report_is_immutable;
  update retention.report set retained_at = now() - ago where report_id = id;
  alter table retention.report enable trigger retained_report_is_immutable;
end;
$$;

select pg_temp.retained_ago(with_snapshot, interval '10 days') from cases;

select lives_ok(
  format($$select public.forget_user(%L)$$, (select reported from folks)),
  '신고당한 사람도 나중에 떠난다');

select ok(
  (select k.reported_left_at > now() - interval '1 minute'
          and k.retained_at < now() - interval '9 days'
   from retention.report k where k.report_id = (select with_snapshot from cases)),
  '남은 쪽의 탈퇴일만 채우고 처분일은 그대로다');

select is(
  (select count(*)::int from retention.report where report_id = (select with_snapshot from cases)),
  1, '같은 신고가 두 줄이 되지 않는다');

select is(
  (select count(*)::int from retention.report where report_id = (select reporter_stays from cases)),
  1, '그 사람이 신고한 것도 이제 옮겨졌다');

-- ── 4. 일반 역할이 못 읽는다 ────────────────────────────────────────────────────

select ok(
  not has_schema_privilege('anon', 'retention', 'usage')
  and not has_schema_privilege('authenticated', 'retention', 'usage')
  and not has_schema_privilege('service_role', 'retention', 'usage'),
  'API 역할 셋 다 떨어진 자리에 들어가지 못한다 — 앱 서버의 비밀 열쇠도');

select ok(
  not has_table_privilege('anon', 'retention.report', 'select')
  and not has_table_privilege('authenticated', 'retention.report', 'select')
  and not has_table_privilege('service_role', 'retention.report', 'select'),
  '표에도 권한이 없다');

select is(
  (select count(*)::int
   from pg_proc p join pg_namespace n on n.oid = p.pronamespace
   where n.nspname = 'retention'
     and (p.proacl is null
          or has_function_privilege('anon', p.oid, 'execute')
          or has_function_privilege('authenticated', p.oid, 'execute')
          or has_function_privilege('service_role', p.oid, 'execute'))),
  0, '떨어진 자리의 함수를 API 역할이 부르지 못한다');

set local role authenticated;
select throws_ok(
  'select count(*) from retention.report',
  '42501', null,
  '로그인한 사람이 읽으려 하면 막힌다');
reset role;

-- ── 5. 증거는 고치지 못한다 ─────────────────────────────────────────────────────

select throws_ok(
  format($$update retention.report set detail = '고친 말' where report_id = %L$$,
         (select with_snapshot from cases)),
  '55000', 'retention: the retained report is immutable',
  '상세를 고치지 못한다 — 소유자도');

select throws_ok(
  format($$update retention.report set reported_left_at = now() - interval '1 year' where report_id = %L$$,
         (select with_snapshot from cases)),
  '55000', 'retention: the retained report is immutable',
  '한 번 적힌 탈퇴일은 옮기지 못한다');

select lives_ok(
  format($$update retention.report set reviewed_at = now() where report_id = %L$$,
         (select to_direct from cases)),
  '검토 상태는 적는다');

-- ── 6. 6개월이 지나면 사라지고, 보류는 안 사라진다 ─────────────────────────────

select pg_temp.retained_ago(with_snapshot, interval '6 months' + interval '1 day') from cases;
select pg_temp.retained_ago(to_direct, interval '6 months' + interval '1 day') from cases;
select pg_temp.retained_ago(from_waiting, interval '6 months' - interval '1 day') from cases;

select lives_ok(
  format($$update retention.report set hold_reason = '시험경찰서 보존 요청 제1호', held_at = now()
           where report_id = %L$$, (select to_direct from cases)),
  '적법한 보존 요청이 걸린 줄에 보류를 건다');

select throws_ok(
  format($$update retention.report set hold_reason = '시각 없는 보류' where report_id = %L$$,
         (select with_snapshot from cases)),
  '23514', null,
  '보류는 건 시각과 함께 적는다');

select retention.purge_expired_reports();

select is(
  (select array_agg(k.report_id order by k.report_id) from retention.report k, cases c
   where k.report_id in (c.with_snapshot, c.to_direct, c.from_waiting)),
  (select array_agg(x order by x) from cases c, unnest(array[c.to_direct, c.from_waiting]) x),
  '6개월이 지난 줄은 사라지고, 보류가 걸린 줄과 6개월이 안 된 줄은 남는다');

update retention.report set hold_reason = null, held_at = null
where report_id = (select to_direct from cases);
select retention.purge_expired_reports();

select is(
  (select count(*)::int from retention.report where report_id = (select to_direct from cases)),
  0, '보류를 풀면 다음 실행이 지운다');

select is(
  (select schedule from cron.job where jobname = 'report-retention-purge' and active),
  '47 * * * *', '크론이 매시 지운다');

select * from finish();
rollback;
