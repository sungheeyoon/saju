-- DB 크기가 Free 의 읽기 전용 문턱(500MB)에 닿기 **전에** 운영자에게 알린다 (ADR 0199, 결정 대기 — 문턱 둘은 운영자가 정한다)
--
-- 감시가 없었다(`pg_database_size` 를 부르는 자리 0, 2026-10-22). Supabase Free 는 DB 크기가 500MB 를 넘으면 읽기 전용이
-- 되고(<https://supabase.com/docs/guides/platform/database-size> — 「Free Plan projects enter read-only mode when your
-- database size exceeds 500 MB」, 크기는 클러스터의 모든 DB 의 `pg_database_size` 합, 2026-10-22 에 읽음), 그때는
-- 가입 · 풀이 · 채팅 · 사진이 다 선다. 사진은 DB 의 `bytea` 다.
--
-- **알림도 함께 선다.** `notify_ops` 는 `ops_alert` 에 한 줄을 **적어야** 보낸다(`20260909090000`) — 읽기 전용에서는 그
-- insert 가 「cannot execute INSERT in a read-only transaction」으로 실패한다. 그러니 이 알림의 요점은 **문턱에 닿기 전에**
-- 울리는 것이다. 넘은 뒤의 알림은 없다.
--
-- ## 무엇을 더하나
--
-- 1. `database_size_counted()` — Supabase 가 세는 것과 같은 값(클러스터의 모든 DB 의 `pg_database_size` 합).
--    2026-10-22 운영 값 52MB(54,256,665 바이트 — `postgres` 37MB · `template0` · `template1` 각 7.5MB).
-- 2. 문턱 둘 — `database_size_warning_bytes()` 350MB · `database_size_critical_bytes()` 425MB. **운영자 결정 대기** — 이름
--    붙은 함수에 두어 한 줄로 고친다(`reading_failure_alert_floor` 와 같은 꼴).
-- 3. `database_size_alert(p_bytes)` — 값을 받아 문턱을 견주고 `notify_ops` 로 하루 한 줄(`database-size-warning` ·
--    `database-size-critical`). 값을 인자로 받는 것은 시험이 500MB 를 실제로 채우지 않고 재려는 것이다. 열쇠에도 안 연다 —
--    감시기 안에서만 돈다.
-- 4. `watch_cron()` 의 다섯째 갈래 — 앞의 넷(`20261108090000`, 운영의 살아 있는 정의와 같다 — 2026-10-22 에 견줘 봤다)은
--    한 글자도 안 바꾸고 끝에 붙인다. 10분마다 돈다. 이 갈래는 제 블록 안에서 돈다 — 크기를 못 재면 `database-size-unreadable`
--    을 알리고 끝나, 앞의 넷이 함께 넘어지지 않는다.
--
-- 새 제공자 · 새 비용은 없다. 재는 자리는 `supabase/tests/99_database_size_alert.test.sql`.

/** 「경고」 문턱 — 350MB. 운영자 결정 대기(ADR 0199). 넘으면 하루 한 번 알린다 */
create function public.database_size_warning_bytes()
returns bigint
language sql
immutable
set search_path = ''
as $$ select 350::bigint * 1024 * 1024 $$;

/** 「위험」 문턱 — 425MB. 운영자 결정 대기(ADR 0199). 500MB 에서 읽기 전용이 되고 그 뒤에는 알림도 못 나간다 */
create function public.database_size_critical_bytes()
returns bigint
language sql
immutable
set search_path = ''
as $$ select 425::bigint * 1024 * 1024 $$;

/** Supabase 가 세는 DB 크기 — 클러스터의 모든 DB 의 `pg_database_size` 합(머리말 1) */
create function public.database_size_counted()
returns bigint
language sql
stable
security definer
set search_path = ''
as $$ select sum(pg_catalog.pg_database_size(d.oid))::bigint from pg_catalog.pg_database d $$;

/**
 * 크기 하나를 문턱과 견주어 알린다 — 위험이면 위험만, 경고면 경고만. 종류마다 하루 한 줄이다(`ops_alert` 의 `(kind, day)`).
 *
 * @returns 이번에 새로 알렸으면 참
 */
create function public.database_size_alert(p_bytes bigint)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
begin
  if p_bytes is null then
    return false;
  end if;

  if p_bytes >= public.database_size_critical_bytes() then
    return public.notify_ops(
      'database-size-critical',
      format('DB 크기 %s — 위험 문턱(%s)을 넘었다. 500MB 에서 읽기 전용이 되고 그 뒤에는 이 알림도 못 나간다. 지금 지우거나 플랜을 올린다',
             pg_catalog.pg_size_pretty(p_bytes), pg_catalog.pg_size_pretty(public.database_size_critical_bytes())));
  end if;

  if p_bytes >= public.database_size_warning_bytes() then
    return public.notify_ops(
      'database-size-warning',
      format('DB 크기 %s — 경고 문턱(%s)을 넘었다. 500MB 에서 읽기 전용이 된다. 큰 표를 본다',
             pg_catalog.pg_size_pretty(p_bytes), pg_catalog.pg_size_pretty(public.database_size_warning_bytes())));
  end if;

  return false;
end;
$$;

revoke execute on function public.database_size_warning_bytes() from public, anon, authenticated, service_role;
revoke execute on function public.database_size_critical_bytes() from public, anon, authenticated, service_role;
revoke execute on function public.database_size_counted() from public, anon, authenticated, service_role;
revoke execute on function public.database_size_alert(bigint) from public, anon, authenticated, service_role;

CREATE OR REPLACE FUNCTION public.watch_cron()
 RETURNS integer
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  failed record;
  told integer := 0;
  bad_calls integer;
  sample text;
  runs_failed integer;
  runs_done integer;
  common_code text;
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

  -- 4. 풀이의 잦은 실패 — 지난 한 시간에 끝난 시도(머리말 2)
  select count(*) filter (where r.status = 'failed')::integer,
         count(*)::integer,
         mode() within group (order by r.failure_code) filter (where r.status = 'failed')
  into runs_failed, runs_done, common_code
  from public.reading_run r
  where r.finished_at is not null
    and r.finished_at > now() - interval '1 hour'
    and r.status in ('succeeded', 'failed');

  if runs_failed >= public.reading_failure_alert_floor()
     and runs_failed >= runs_done * public.reading_failure_alert_share()
     and public.notify_ops(
       'reading-failure-rate',
       format('풀이가 지난 한 시간에 끝난 %s번 중 %s번 실패했다. 가장 잦은 실패 코드: %s',
              runs_done, runs_failed, coalesce(common_code, '없음')))
  then
    told := told + 1;
  end if;

  -- 5. DB 크기 — 읽기 전용이 되기 **전에** 울린다(머리말). 이 갈래가 넘어져도 앞의 넷이 보낸 것은 남는다 — 실패를 알리고 끝까지 간다
  begin
    if public.database_size_alert(public.database_size_counted()) then
      told := told + 1;
    end if;
  exception when others then
    if public.notify_ops('database-size-unreadable', format('DB 크기를 못 쟀다: %s', left(sqlerrm, 200))) then
      told := told + 1;
    end if;
  end;

  return told;
end;
$function$;
