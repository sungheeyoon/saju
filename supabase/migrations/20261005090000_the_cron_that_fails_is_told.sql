-- 크론이 실패하면 **운영자에게 알린다** — 정상 실행은 안 알린다 (G-42, ADR 0039 덧)
--
-- 2026-09-01 부터 사흘 동안 복구기가 4,542번 연속 실패했는데 아무도 몰랐다(ADR 0039 「배선은 한 번
-- 쏴 봐야 배선이다」). 크론의 실패는 `cron.job_run_details` 에만 남고, 그 표를 보는 것은 runbook 의
-- 「배포한 날 한 번」뿐이었다. 사람의 결정(2026-09-23)은 **실패 · 재시도 소진 · 사람의 조치가 필요한
-- 경우만 알린다**이다.
--
-- ## 무엇을 보나 — 셋
--
--   1. **잡이 실패했다** — `cron.job_run_details.status = 'failed'`. 등록된 잡 **전부**를 본다. 이름을
--      나열하면 새 잡이 빠진다. 종류는 `cron-failed:<잡 이름>` — 잡마다 하루 한 줄
--   2. **밖으로 부른 것이 실패했다** — 복구기(`reading-recovery`)는 `pg_net` 으로 우리 주소를 부르고
--      곧바로 성공으로 끝난다. 주소가 403 · 503 을 돌려줘도 잡은 초록이다 — 4,542번이 그랬다.
--      그래서 `net._http_response` 의 2xx 아닌 응답 · 오류 · 시간 초과를 센다(`net-request-failed`).
--      응답이 어느 잡의 것인지는 표가 모른다. 매분 부르는 것이 복구기 하나라 대부분 그것이다
--   3. **잡이 꺼져 있다** — `cron.job.active = false`. 누군가 끄고 잊으면 실패도 안 남는다
--      (`cron-inactive:<잡 이름>`)
--
-- 재시도 소진은 잡이 스스로 안다 — 탈퇴 처분의 기한 초과(`account-disposal-overdue`, G-53)와 하루
-- 상한 도달(`reading-budget-reached`)은 그 자리에서 이미 알린다. 여기서 다시 세지 않는다.
--
-- ## 같은 일은 하루 한 번
--
-- `notify_ops` 가 `(kind, day)` 로 막는다. 감시기는 10분마다 지난 한 시간을 보므로 창이 겹치지만,
-- 겹쳐 본 실패는 같은 종류라 두 번 안 간다. 정상 실행은 아무것도 안 적는다.
--
-- ## 잡지 않은 것
--
-- 감시기 자신이 계속 실패하면 그것은 못 알린다 — 다음 감시기가 없다. `pg_cron` 이 통째로 멈춘
-- 것도 못 알린다. 둘 다 runbook 「크론 실패 알림」의 「배포한 날 한 번 본다」가 든다.

create or replace function public.watch_cron()
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  failed record;
  told integer := 0;
  bad_calls integer;
  sample text;
begin
  -- 1. 실패한 잡
  for failed in
    select j.jobname, count(*) as n, max(d.end_time) as last,
           (array_agg(d.return_message order by d.end_time desc))[1] as message
    from cron.job_run_details d
    join cron.job j on j.jobid = d.jobid
    where d.status = 'failed'
      and coalesce(d.end_time, d.start_time) > now() - interval '1 hour'
    group by j.jobname
  loop
    if public.notify_ops(
      'cron-failed:' || failed.jobname,
      format('크론 %s 가 지난 한 시간에 %s번 실패했다(마지막 %s): %s',
             failed.jobname, failed.n, failed.last, left(coalesce(failed.message, ''), 200)))
    then
      told := told + 1;
    end if;
  end loop;

  -- 2. 밖으로 부른 것의 실패
  select count(*),
         (array_agg(format('%s %s', coalesce(r.status_code::text, '응답 없음'),
                           left(coalesce(r.error_msg, r.content, ''), 80))
                    order by r.created desc))[1]
  into bad_calls, sample
  from net._http_response r
  where r.created > now() - interval '1 hour'
    and (r.timed_out or r.error_msg is not null
         or r.status_code is null or r.status_code not between 200 and 299);

  if bad_calls > 0 and public.notify_ops(
    'net-request-failed',
    format('크론이 밖으로 부른 요청이 지난 한 시간에 %s번 실패했다 — 대부분 복구기(reading-recovery)다. 마지막: %s',
           bad_calls, sample))
  then
    told := told + 1;
  end if;

  -- 3. 꺼진 잡
  for failed in select j.jobname from cron.job j where not j.active loop
    if public.notify_ops(
      'cron-inactive:' || failed.jobname,
      format('크론 %s 가 꺼져 있다 — 실패도 남지 않는다', failed.jobname))
    then
      told := told + 1;
    end if;
  end loop;

  return told;
end;
$$;

revoke execute on function public.watch_cron() from anon, public, authenticated, service_role;

select cron.unschedule('cron-watch')
where exists (select 1 from cron.job where jobname = 'cron-watch');

select cron.schedule('cron-watch', '*/10 * * * *', 'select public.watch_cron()');
