-- 크론이 실패하면 알린다 — 정상 실행은 안 알린다 (G-42)
--
-- 여기서 재는 것 다섯.
--
--   1. **실패한 잡은 그 이름으로 한 줄이 간다** — 이름을 나열하지 않으므로 새 잡도 든다
--   2. **성공한 잡은 아무것도 안 적는다**
--   3. **밖으로 부른 요청의 실패를 센다** — 잡이 초록이어도
--   4. **꺼진 잡을 알린다**
--   5. **같은 날 두 번 돌아도 한 줄이다**
--
-- 잡과 실행 기록은 이 파일이 만든 것만 쓴다. 롤백이 되돌린다.
begin;
select plan(8);

select cron.schedule('watch-test-bad', '0 0 1 1 *', 'select 1');
select cron.schedule('watch-test-ok', '0 0 1 1 *', 'select 1');
select cron.schedule('watch-test-off', '0 0 1 1 *', 'select 1');
select cron.alter_job((select jobid from cron.job where jobname = 'watch-test-off'), active := false);

insert into cron.job_run_details (jobid, runid, database, username, command, status, return_message, start_time, end_time)
select j.jobid, 900000000 + j.jobid, 'postgres', 'postgres', 'select 1',
       case when j.jobname = 'watch-test-bad' then 'failed' else 'succeeded' end,
       case when j.jobname = 'watch-test-bad' then 'ERROR: 시험 — 터졌다' else '1 row' end,
       now() - interval '5 minutes', now() - interval '4 minutes'
from cron.job j where j.jobname in ('watch-test-bad', 'watch-test-ok');

delete from net._http_response;
insert into net._http_response (id, status_code, content, timed_out, created)
values (-1, 503, 'not configured', false, now() - interval '2 minutes'),
       (-2, 200, '{"open":0}', false, now() - interval '1 minute');

select lives_ok($$select public.watch_cron()$$, '감시기가 돈다');

select ok(
  (select detail like '%watch-test-bad%1번%터졌다%' from public.ops_alert
   where kind = 'cron-failed:watch-test-bad'),
  '실패한 잡은 그 이름과 횟수와 마지막 오류로 한 줄이 간다');

select is(
  (select count(*)::int from public.ops_alert where kind = 'cron-failed:watch-test-ok'),
  0, '성공한 잡은 아무것도 안 적는다');

select ok(
  (select detail like '%1번%503%' from public.ops_alert where kind = 'net-request-failed'),
  '밖으로 부른 요청의 실패를 센다 — 성공한 200 은 안 센다');

select ok(
  exists (select 1 from public.ops_alert where kind = 'cron-inactive:watch-test-off'),
  '꺼진 잡을 알린다');

select is(public.watch_cron(), 0, '같은 날 다시 돌면 새로 알리는 것이 없다');

select is(
  (select schedule from cron.job where jobname = 'cron-watch'),
  '*/10 * * * *', '감시기는 10분마다 지난 한 시간을 본다');

select function_privs_are('public', 'watch_cron', array[]::text[],
  'authenticated', array[]::text[],
  '감시기는 로그인한 사람이 부를 수 없다');

select * from finish();
rollback;
