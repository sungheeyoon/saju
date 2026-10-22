-- DB 가 살아 있다고 바깥 감시에 알린다 (G-118 dead-man heartbeat)
--
-- 여기서 재는 것 다섯.
--
--   1. **주소가 없으면 아무것도 안 보낸다** — 서비스를 고르기 전에도 올려 둘 수 있다
--   2. **감시기가 최근에 성공했으면 주소로 GET 한 번** — 요청은 큐에 들어갈 뿐이라 네트워크를 안 탄다
--   3. **감시기가 25분 넘게 성공하지 못했으면 안 보낸다** — 감시기의 실패도 신호의 끊김으로 바깥이 본다
--   4. **10분마다, 감시기와 5분 엇갈려 돈다**
--   5. **로그인한 사람도 방문자도 부를 수 없다**
--
-- Vault 와 실행 기록은 이 파일이 만든 것만 쓴다. 롤백이 되돌린다.
begin;
select plan(8);

delete from vault.secrets where name = 'ops_heartbeat_url';
delete from cron.job_run_details
where jobid = (select jobid from cron.job where jobname = 'cron-watch');

select is(public.ping_ops_heartbeat(), false, '주소가 없으면 아무것도 안 보낸다');

select vault.create_secret('http://127.0.0.1:9/heartbeat', 'ops_heartbeat_url');

select is(public.ping_ops_heartbeat(), false, '감시기가 한 번도 성공하지 않았으면 안 보낸다');

insert into cron.job_run_details (jobid, runid, database, username, command, status, return_message, start_time, end_time)
select j.jobid, 910000000, 'postgres', 'postgres', 'select public.watch_cron()', 'succeeded', '1 row',
       now() - interval '40 minutes', now() - interval '40 minutes'
from cron.job j where j.jobname = 'cron-watch';

select is(public.ping_ops_heartbeat(), false, '감시기의 마지막 성공이 25분보다 오래면 안 보낸다');

insert into cron.job_run_details (jobid, runid, database, username, command, status, return_message, start_time, end_time)
select j.jobid, 910000001, 'postgres', 'postgres', 'select public.watch_cron()', 'succeeded', '1 row',
       now() - interval '6 minutes', now() - interval '6 minutes'
from cron.job j where j.jobname = 'cron-watch';

create temporary table queued_before as
select count(*)::int as n from net.http_request_queue where url = 'http://127.0.0.1:9/heartbeat';

-- 부름과 세기를 한 문장에 두면 세는 쪽이 문장 시작의 스냅숏을 봐 방금 선 줄을 못 본다 — 따로 부른다
select is(public.ping_ops_heartbeat(), true, '감시기가 최근에 성공했으면 보낸다');

select is(
  (select count(*)::int from net.http_request_queue where url = 'http://127.0.0.1:9/heartbeat'),
  (select n from queued_before) + 1,
  '그 주소로 요청 한 줄이 큐에 선다');

select is(
  (select schedule from cron.job where jobname = 'ops-heartbeat'),
  '5-59/10 * * * *', '10분마다, 감시기와 5분 엇갈려 돈다');

select function_privs_are('public', 'ping_ops_heartbeat', array[]::text[],
  'authenticated', array[]::text[],
  '로그인한 사람은 부를 수 없다 — 부르는 것만으로 밖으로 요청을 만든다');

select function_privs_are('public', 'ping_ops_heartbeat', array[]::text[],
  'anon', array[]::text[],
  '로그인 전 방문자도 부를 수 없다');

select * from finish();
rollback;
