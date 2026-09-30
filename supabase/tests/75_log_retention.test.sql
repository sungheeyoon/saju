-- 기록 셋의 보존 — 노출 기록 180일(덱에 선 카드는 남김) · 소식 90일 · 크론 이력 14일 (ADR 0138, 결정 대기)
--
-- 여기서 재는 것 다섯.
--
--   1. **기간이 지난 줄만 지운다** — 셋 모두, 기간 안의 줄은 남는다
--   2. **지금 덱에 선 카드의 노출 기록은 오래되어도 남는다** — 요청 · 넘김이 그 줄을 찾는다
--   3. **남은 카드로 여전히 넘길 수 있다** — 넘김의 정책(`discovery_shown_to_me`)이 그 줄을 읽는다
--   4. **요청은 남고 「어느 카드에서 왔나」만 빈다**
--   5. **매일 도는 잡이 서 있고, 사용자 역할은 못 부른다**
--
-- 세는 것은 이 파일이 만든 행뿐이다.
begin;
select plan(12);

create or replace function pg_temp.participant(mail text, i integer)
returns uuid
language plpgsql
as $$
declare
  uid uuid := tests.signup(mail);
begin
  perform set_config('request.jwt.claims', tests.claims(uid), true);
  perform tests.create_self_person(
    '나', 'solar', '1990-05-15', '1990-05-15', '14:30', 'female', '서울', 'jo', 'localMean',
    tests.chart(), 'chart-for-tests');
  perform tests.set_discovery_participation(true,
    jsonb_build_object('glyphCount', 8,
      'counts', jsonb_build_object('木', i % 3, '火', 2, '土', 2, '金', 1, '水', 3 - i % 3),
      'ratios', jsonb_build_object('木', (i % 3) / 8.0, '火', 0.25, '土', 0.25, '金', 0.125, '水', (3 - i % 3) / 8.0)),
    tests.need());
  return uid;
end;
$$;

set local role authenticated;
create temporary table folks as
select i, pg_temp.participant('keep-log' || i || '@example.com', i) as uid from generate_series(1, 9) i;
reset role;

create temporary table me as select uid from folks where i = 1;

-- 덱을 세우면 여섯의 노출 기록이 난다 — 그중 둘을 덱에서 내리고, 넷은 덱에 둔다
create temporary table deck as
select public.refresh_discovery_snapshot_for((select uid from me), 'keep-seed') as id;

create temporary table seated as
select candidate_user_id as uid, position from public.discovery_candidate_slot
where snapshot_id = (select id from deck);

grant select on seated to authenticated;

delete from public.discovery_candidate_slot
where snapshot_id = (select id from deck) and position in (4, 5);

-- 모든 노출 기록을 기간 밖으로 민다 — 덱에 남은 넷 · 내린 둘
update public.discovery_impression set shown_at = now() - interval '200 days'
where viewer_user_id = (select uid from me);

-- 기간 안의 노출 기록 하나 — 다른 사람이 본 것
insert into public.discovery_impression (viewer_user_id, candidate_user_id, policy_version, position, exploration,
  viewer_summary, candidate_summary, supplied_elements, complement, combined_balance, shown_at)
select (select uid from folks where i = 2), (select uid from folks where i = 3), 'v2-beta', 0, false,
  '{}'::jsonb, '{}'::jsonb, array[]::text[], 0, 0, now() - interval '10 days';

-- 내린 둘 중 하나에서 요청이 나갔다 — 요청은 남고 카드 칸만 빈다
set local session_replication_role = replica;
insert into public.match_request (requester_user_id, addressee_user_id, status, impression_id, policy_version,
  supplied_to_requester, supplied_to_addressee, balance_band, decided_at)
select (select uid from me), s.uid, 'expired',
  (select i.id from public.discovery_impression i where i.viewer_user_id = (select uid from me) and i.candidate_user_id = s.uid),
  'v2-beta', array[]::text[], array[]::text[], 'balanced', now()
from seated s where s.position = 4;
set local session_replication_role = origin;

-- 소식 둘 — 91일 전 · 89일 전
insert into public.notification (user_id, kind, created_at)
values ((select uid from me), 'reading_ready', now() - interval '91 days'),
       ((select uid from me), 'reading_ready', now() - interval '89 days');

-- 크론 이력 둘 — 15일 전 · 13일 전
select cron.schedule('keep-log-test', '0 0 1 1 *', 'select 1');
insert into cron.job_run_details (jobid, runid, database, username, command, status, return_message, start_time, end_time)
select j.jobid, 910000000 + g, 'postgres', 'postgres', 'select 1', 'succeeded', '1 row',
       now() - (g || ' days')::interval, now() - (g || ' days')::interval
from cron.job j, (values (15), (13)) as v(g)
where j.jobname = 'keep-log-test';

create temporary table purged as select retention.purge_old_logs() as result;

-- ── 1 · 2. 기간 밖만 · 덱에 선 카드는 남긴다 ─────────────────────────────────

select is(
  (select count(*)::int from public.discovery_impression i join seated s on s.uid = i.candidate_user_id
   where i.viewer_user_id = (select uid from me) and s.position < 4),
  4,
  '지금 덱에 선 넷의 노출 기록은 200일이 지나도 남는다');

select is(
  (select count(*)::int from public.discovery_impression i join seated s on s.uid = i.candidate_user_id
   where i.viewer_user_id = (select uid from me) and s.position >= 4),
  0,
  '덱에서 내린 둘의 노출 기록은 기간이 지나 지워진다');

select is(
  (select count(*)::int from public.discovery_impression
   where viewer_user_id = (select uid from folks where i = 2) and shown_at > now() - interval '11 days'),
  1,
  '기간 안의 노출 기록은 남는다');

select is(
  (select array_agg(created_at > now() - interval '90 days') from public.notification where user_id = (select uid from me)),
  array[true],
  '소식은 90일 안의 것만 남는다');

select is(
  (select count(*)::int from cron.job_run_details d join cron.job j on j.jobid = d.jobid
   where j.jobname = 'keep-log-test'),
  1,
  '크론 이력은 14일 안의 것만 남는다');

select ok(
  (select (result ->> 'impression')::int >= 2 and (result ->> 'notification')::int >= 1
      and (result ->> 'cron_run')::int >= 1 from purged),
  '지운 수를 셋으로 낸다');

-- ── 3. 남은 카드로 여전히 넘길 수 있다 ──────────────────────────────────────

select set_config('request.jwt.claims', tests.claims((select uid from me)), true);
set local role authenticated;

select lives_ok(
  $$insert into public.discovery_passed (user_id, passed_user_id)
    values ((select auth.uid()), (select uid from seated where position = 0))$$,
  '덱에 남은 카드는 오래된 노출 기록으로도 넘길 수 있다');

select throws_ok(
  $$insert into public.discovery_passed (user_id, passed_user_id)
    values ((select auth.uid()), (select uid from seated where position = 5))$$,
  '42501', null,
  '기록이 지워진 사람은 넘길 수 없다 — 덱에 없는 사람이다(`65_passed_only_shown` 과 같은 뜻)');

reset role;

-- ── 4. 요청은 남는다 ──────────────────────────────────────────────────────────

select is(
  (select count(*)::int from public.match_request
   where requester_user_id = (select uid from me) and addressee_user_id = (select uid from seated where position = 4)
     and impression_id is null),
  1,
  '요청은 남고 어느 카드에서 왔는지만 빈다');

-- ── 5. 잡과 권한 ──────────────────────────────────────────────────────────────

select is(
  (select schedule || ' ' || command from cron.job where jobname = 'log-retention-purge' and active),
  '37 4 * * * select retention.purge_old_logs()',
  '매일 04:37 UTC 에 돈다');

select ok(
  not has_function_privilege('authenticated', 'retention.purge_old_logs()', 'execute')
  and not has_function_privilege('service_role', 'retention.purge_old_logs()', 'execute')
  and not has_function_privilege('anon', 'retention.purge_old_logs()', 'execute'),
  '사용자 역할 · 열쇠는 지우는 문을 못 부른다');

select ok(
  (select retention.impression_period() = interval '180 days'
      and retention.notification_period() = interval '90 days'
      and retention.cron_run_period() = interval '14 days'),
  '기간 셋은 ADR 0138 의 제안값이다 — 운영자 답에 따라 이 줄과 함수를 함께 고친다');

select * from finish();
rollback;
