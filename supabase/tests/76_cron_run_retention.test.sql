-- 크론 실행 이력은 14일만 남는다 — 소식 · 노출 기록은 지우지 않는다 (ADR 0138)
--
-- 여기서 재는 것 넷.
--
--   1. **14일이 지난 이력만 지운다**
--   2. **소식 · 노출 기록은 안 건드린다** — 운영자 결정(2026-09-30), G-67
--   3. **매일 도는 잡이 서 있다**
--   4. **사용자 역할 · 열쇠는 지우는 문을 못 부른다**
--
-- 잡과 실행 기록은 이 파일이 만든 것만 센다. 롤백이 되돌린다.
begin;
select plan(6);

create temporary table who as select tests.signup('keep-cron-runs@example.com') as uid;

select cron.schedule('keep-runs-test', '0 0 1 1 *', 'select 1');
insert into cron.job_run_details (jobid, runid, database, username, command, status, return_message, start_time, end_time)
select j.jobid, 920000000 + v.g, 'postgres', 'postgres', 'select 1', 'succeeded', '1 row',
       now() - (v.g || ' days')::interval, now() - (v.g || ' days')::interval
from cron.job j, (values (15), (13)) as v(g)
where j.jobname = 'keep-runs-test';

-- 아주 오래된 소식 하나 — 지우지 않는다
insert into public.notification (user_id, kind, created_at)
values ((select uid from who), 'reading_ready', now() - interval '400 days');

create temporary table purged as select retention.purge_old_cron_runs() as gone;

select is(
  (select array_agg(d.end_time > now() - interval '14 days') from cron.job_run_details d
   join cron.job j on j.jobid = d.jobid where j.jobname = 'keep-runs-test'),
  array[true],
  '14일 안의 이력만 남는다');

select cmp_ok((select gone from purged), '>=', 1, '지운 수를 낸다');

select is(
  (select count(*)::int from public.notification where user_id = (select uid from who)),
  1,
  '소식은 400일이 지나도 지우지 않는다 — 운영자 결정(2026-09-30)');

select is(
  (select count(*)::int from pg_proc p join pg_namespace n on n.oid = p.pronamespace
   where n.nspname = 'retention' and p.prosrc ~ '(discovery_impression|public\.notification)'),
  0,
  '보존 스키마의 어떤 문도 소식 · 노출 기록을 안 지운다');

select is(
  (select schedule || ' ' || command from cron.job where jobname = 'cron-run-retention-purge' and active),
  '37 4 * * * select retention.purge_old_cron_runs()',
  '매일 04:37 UTC 에 돈다');

select ok(
  not has_function_privilege('authenticated', 'retention.purge_old_cron_runs()', 'execute')
  and not has_function_privilege('service_role', 'retention.purge_old_cron_runs()', 'execute')
  and not has_function_privilege('anon', 'retention.purge_old_cron_runs()', 'execute'),
  '사용자 역할 · 열쇠는 지우는 문을 못 부른다');

select * from finish();
rollback;
