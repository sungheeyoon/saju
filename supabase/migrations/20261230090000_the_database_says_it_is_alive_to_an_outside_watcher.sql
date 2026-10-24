-- DB 가 살아 있다고 **바깥 감시**에 10분마다 알린다 — 신호가 끊기면 바깥이 운영자에게 알린다 (G-118 dead-man heartbeat)
--
-- 알림의 길은 DB 안의 `notify_ops`(Vault `ops_alert_url`) 하나뿐이라, `pg_cron` 이 멈추거나 · 감시기(`cron-watch`)가 계속
-- 실패하거나 · DB 가 읽기 전용이 되거나(Free 500MB, ADR 0199) · 프로젝트가 멈추면 그 길이 함께 선다
-- (`docs/ops/runbook/jobs.md` 「감시기가 못 보는 것 셋」). 이 잡은 **반대 방향**이다 — 살아 있을 때만 바깥에 신호를 보내고,
-- 신호가 끊긴 것을 바깥 서비스가 알린다.
--
-- ## 무엇을 더하나
--
-- 1. `ping_ops_heartbeat()` — Vault `ops_heartbeat_url` 로 GET 한 번. **감시기가 지난 25분 안에 성공했을 때만** 보낸다 —
--    감시기가 실패하는 동안 신호가 끊겨, 「감시기가 못 보는 것」의 첫째(감시기 자신의 실패)도 바깥이 본다.
--    `pg_net` 은 요청을 표(`net.http_request_queue`)에 적어 보내므로 DB 가 읽기 전용이면 이 함수가 실패하고 신호도 끊긴다.
-- 2. 크론 `ops-heartbeat` — 10분마다, 감시기(`*/10`)와 5분 엇갈려(`5-59/10`). 바깥 서비스의 기간은 10분, 유예는 10분 안팎.
--
-- **주소가 없으면 아무것도 안 한다**(`false`). 서비스를 고르기 전(G-118 결정 대기)에도 올려 둘 수 있게 — 넣는 날은 Vault 에
-- 한 줄이다(`docs/ops/runbook/jobs.md` 「바깥 감시」). 주소는 서비스가 정하고 그 자체가 열쇠라 Vault 에 둔다.
-- 서비스에 따라 다른 꼴(`/fail` · `/start` 같은 덧붙임)은 쓰지 않는다 — 신호의 있고 없음만 쓴다.
--
-- 보내는 것은 빈 GET 하나다 — 개인정보도 운영 값도 싣지 않는다.

/**
 * 바깥 감시에 「살아 있다」를 보낸다.
 *
 * @returns 보냈으면 참 — 주소가 없거나 감시기가 25분 넘게 성공하지 못했으면 거짓
 */
create function public.ping_ops_heartbeat()
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  url text;
begin
  select decrypted_secret into url
  from vault.decrypted_secrets where name = 'ops_heartbeat_url';

  if url is null then
    return false;
  end if;

  if not exists (
    select 1
    from cron.job_run_details d
    join cron.job j on j.jobid = d.jobid
    where j.jobname = 'cron-watch'
      and d.status = 'succeeded'
      and d.end_time > now() - interval '25 minutes'
  ) then
    return false;
  end if;

  perform net.http_get(url := url, timeout_milliseconds := 10000);
  return true;
end;
$$;

revoke execute on function public.ping_ops_heartbeat() from public, anon, authenticated, service_role;

select cron.schedule('ops-heartbeat', '5-59/10 * * * *', 'select public.ping_ops_heartbeat()');
