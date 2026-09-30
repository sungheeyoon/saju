-- 서버의 오류와 풀이의 잦은 실패를 운영자에게 알린다 — 넓히기 (밤샘 감사 SRE, 2026-09-28)
--
-- 감사가 적은 것 둘: **함수 오류 알림이 없다**(서버 컴포넌트 · 라우트 · 액션이 던져도 Vercel 로그에만 남는다),
-- **AI 실패율 알림이 없다**(풀이가 한 시간 내내 실패해도 사용자가 말해 주기 전에는 모른다). 알림 길은 이미 하나
-- 있다 — `notify_ops(kind, detail)` 가 `ops_alert` 에 `(kind, day)` 로 하루 한 줄을 적고 Vault 의 주소로 보낸다
-- (`20260909090000`, 실행 권한은 거기서 걷었다 — 다시 연 곳이 없다). **새 제공자 · 새 비용은 없다.**
--
-- ## 1. 서버 오류 — `report_request_error(route, kind, digest)`
--
-- 앱의 `instrumentation.ts` 의 `onRequestError` 가 부른다(뒤따르는 앱 PR). 이 마이그레이션은 문만 연다 — 옛 앱은
-- 안 부르므로 옛 앱에 안전하다(ADR 0071 의 넓히기).
--
-- - **열쇠(`service_role`)에만 연다.** 로그인한 사람 · 익명이 부를 수 있으면 아무 종류나 지어 운영자의 알림함을
--   채울 수 있다.
-- - **받는 것은 셋뿐이다** — 라우트 파일의 무늬(`/app/me/[id]/page` 처럼, Next 의 `context.routePath`), 오류가 난
--   자리(`render` · `route` · `action` · `proxy`, Next 의 `context.routeType`), 오류의 digest. **오류 문장 · 실제
--   주소 · 요청 머리는 안 받는다** — 문장에는 입력값이, 주소에는 사람 id 가 섞일 수 있다. digest 로 Vercel 로그의
--   그 줄을 찾는다.
-- - 종류는 `request-error:<자리>:<라우트 무늬>` — **라우트 파일마다 하루 한 줄**이다. 무늬는 파일 경로라 수가 정해져
--   있다(주소가 아니다).
-- - 모양이 틀린 값은 던진다(`22023`) — 앱은 그 실패를 삼킨다(알림이 오류 처리를 붙들지 않는다).
--
-- ## 2. 풀이의 잦은 실패 — `watch_cron()` 의 넷째 갈래
--
-- 감시기(10분마다, 지난 한 시간)가 `reading_run` 의 끝난 시도를 센다. **실패가 다섯 번 이상이고 끝난 것의 절반
-- 이상이면** `reading-failure-rate` 로 알린다 — 하루 한 줄. 문턱 둘은 **운영자가 승인했다(2026-09-30)** — 이름 붙은
-- 함수 둘(`reading_failure_alert_floor` · `reading_failure_alert_share`)에 두어 한 줄로 고친다. 적는 것은 수와 가장
-- 잦은 실패 코드뿐이다 — 사람 · 본문은 안 적는다.
--
-- `reading_run` 에는 끝난 시각의 색인이 없어 감시기가 표 전체를 훑게 된다 — 끝난 시도만 드는 부분 색인을 더한다.
--
-- 재는 자리는 `supabase/tests/74_ops_alerts.test.sql`.

-- ---------------------------------------------------------------------------
-- 1. 서버 오류를 받는 문
-- ---------------------------------------------------------------------------

/**
 * 서버가 던진 오류 하나를 운영자에게 알린다 — 라우트 파일 · 자리마다 하루 한 줄.
 *
 * @param p_route 라우트 파일의 무늬(`context.routePath`) — `/` 로 시작, 200자 안, 글자 · 숫자 · `_-.[]()@/` 만
 * @param p_kind `render` · `route` · `action` · `proxy`
 * @param p_digest 오류의 digest — 없으면 `null`
 * @returns 이번에 새로 적었으면 참 — 같은 날 같은 종류는 거짓
 */
create function public.report_request_error(p_route text, p_kind text, p_digest text)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
begin
  if p_kind is null or p_kind not in ('render', 'route', 'action', 'proxy') then
    raise exception 'request-error: kind is one of render, route, action, proxy' using errcode = '22023';
  end if;

  if p_route is null or p_route !~ '^/[A-Za-z0-9_.()@/\[\]-]{0,199}$' then
    raise exception 'request-error: route is a route file pattern' using errcode = '22023';
  end if;

  if p_digest is not null and p_digest !~ '^[A-Za-z0-9_-]{1,64}$' then
    raise exception 'request-error: digest is a short token' using errcode = '22023';
  end if;

  return public.notify_ops(
    'request-error:' || p_kind || ':' || p_route,
    format('서버 오류 — %s %s · digest %s. Vercel 로그에서 digest 로 찾는다',
           p_kind, p_route, coalesce(p_digest, '없음')));
end;
$$;

revoke execute on function public.report_request_error(text, text, text) from public, anon, authenticated;
grant execute on function public.report_request_error(text, text, text) to service_role;

-- ---------------------------------------------------------------------------
-- 2. 풀이의 잦은 실패
-- ---------------------------------------------------------------------------

/** 한 시간에 이만큼은 실패해야 알린다 — 운영자 승인(2026-09-30). 한둘은 모델의 흔들림이다 */
create function public.reading_failure_alert_floor()
returns integer
language sql
immutable
set search_path = ''
as $$ select 5 $$;

/** 끝난 시도 중 실패가 이 몫 이상이면 알린다 — 운영자 승인(2026-09-30) */
create function public.reading_failure_alert_share()
returns numeric
language sql
immutable
set search_path = ''
as $$ select 0.5 $$;

revoke execute on function public.reading_failure_alert_floor() from public, anon, authenticated, service_role;
revoke execute on function public.reading_failure_alert_share() from public, anon, authenticated, service_role;

create index reading_run_finished on public.reading_run (finished_at) where finished_at is not null;

/**
 * 감시기 — 앞의 셋(`20261005090000`)은 한 글자도 안 바꾸고 넷째 갈래를 더한다.
 */
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

  return told;
end;
$$;
