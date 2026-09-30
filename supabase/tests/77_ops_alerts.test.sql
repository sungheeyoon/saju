-- 서버 오류와 풀이의 잦은 실패가 운영자에게 간다 (`20261108090000`)
--
-- 여기서 재는 것 넷.
--
--   1. **서버 오류의 문은 열쇠에만 열린다** — `anon` · `authenticated` 는 못 부른다
--   2. **받는 것은 무늬 · 자리 · digest 뿐이고 모양이 틀리면 던진다** — 주소 · 문장이 들 자리가 없다
--   3. **라우트 파일 · 자리마다 하루 한 줄이다**
--   4. **풀이 실패는 다섯 번 이상 · 절반 이상일 때만 알린다** — 넷이면 안 가고, 절반이 안 되면 안 간다
--
-- 세는 것은 이 파일이 만든 행뿐이다 — 앞서 끝난 시도는 한 시간 밖으로 밀어 두고(롤백이 되돌린다) 센다.
begin;
select plan(13);

-- ── 1. 누가 부르나 ─────────────────────────────────────────────────────────────

select ok(
  has_function_privilege('service_role', 'public.report_request_error(text, text, text)', 'execute'),
  '열쇠는 서버 오류를 알릴 수 있다');

select ok(
  not has_function_privilege('authenticated', 'public.report_request_error(text, text, text)', 'execute')
  and not has_function_privilege('anon', 'public.report_request_error(text, text, text)', 'execute'),
  '로그인한 사람 · 익명은 못 부른다 — 알림함을 채울 수 없다');

-- ── 2. 받는 모양 ──────────────────────────────────────────────────────────────

select throws_ok(
  $$select public.report_request_error('/app/me/page', 'boom', null)$$,
  '22023', null,
  '자리는 넷 중 하나다');

select throws_ok(
  $$select public.report_request_error('https://example.com/me?id=1', 'render', null)$$,
  '22023', null,
  '라우트는 파일 무늬다 — 주소와 물음표는 못 든다');

select throws_ok(
  $$select public.report_request_error('/app/me/page', 'render', 'not a digest; drop')$$,
  '22023', null,
  'digest 는 짧은 토큰이다');

-- ── 3. 하루 한 줄 ─────────────────────────────────────────────────────────────

select ok(
  public.report_request_error('/app/me/[id]/(tabs)/@slot/[[...rest]]/page', 'render', '1234567890'),
  '라우트 무늬 · 자리 · digest 로 한 줄을 적는다');

select is(
  (select detail from public.ops_alert
   where kind = 'request-error:render:/app/me/[id]/(tabs)/@slot/[[...rest]]/page'),
  '서버 오류 — render /app/me/[id]/(tabs)/@slot/[[...rest]]/page · digest 1234567890. Vercel 로그에서 digest 로 찾는다',
  '적는 것은 자리 · 무늬 · digest 뿐이다');

select ok(
  not public.report_request_error('/app/me/[id]/(tabs)/@slot/[[...rest]]/page', 'render', '999'),
  '같은 날 같은 라우트 · 자리는 두 번 안 적는다');

select ok(
  public.report_request_error('/app/me/[id]/(tabs)/@slot/[[...rest]]/page', 'action', null),
  '자리가 다르면 다른 줄이다 — digest 가 없어도 된다');

-- ── 4. 풀이의 잦은 실패 ───────────────────────────────────────────────────────

-- 앞서 끝난 시도는 한 시간 밖으로 민다 — 이 파일이 만든 것만 센다
update public.reading_run set finished_at = now() - interval '2 hours'
where finished_at > now() - interval '1 hour';

create temporary table who as select tests.signup('failing-readings@example.com') as uid;

/** 끝난 시도 n 개 — 시도를 여는 문과 풀이권은 여기서 재는 것이 아니다(15 · 16 이 잰다) */
create or replace function pg_temp.runs(n integer, outcome text)
returns void
language plpgsql
as $$
begin
  set local session_replication_role = replica;
  insert into public.reading_run (user_id, kind, status, failure_code, idempotency_key, finished_at)
  select (select uid from who), 'self', outcome,
    case when outcome = 'failed' then 'length-out-of-contract' end,
    'alert-' || outcome || '-' || g || '-' || gen_random_uuid(), now() - interval '5 minutes'
  from generate_series(1, n) g;
  set local session_replication_role = origin;
end;
$$;

select pg_temp.runs(4, 'failed');
select public.watch_cron();

select is(
  (select count(*)::int from public.ops_alert where kind = 'reading-failure-rate'),
  0,
  '실패 넷 · 성공 영 — 문턱(다섯) 아래라 안 알린다');

select pg_temp.runs(1, 'failed');
select pg_temp.runs(6, 'succeeded');
select public.watch_cron();

select is(
  (select count(*)::int from public.ops_alert where kind = 'reading-failure-rate'),
  0,
  '실패 다섯 · 성공 여섯 — 절반이 안 되니 안 알린다');

select pg_temp.runs(1, 'failed');
select public.watch_cron();

select is(
  (select detail from public.ops_alert where kind = 'reading-failure-rate'),
  '풀이가 지난 한 시간에 끝난 12번 중 6번 실패했다. 가장 잦은 실패 코드: length-out-of-contract',
  '실패 여섯 · 성공 여섯 — 절반에 닿아 수와 가장 잦은 코드를 알린다');

select public.watch_cron();

select is(
  (select count(*)::int from public.ops_alert where kind = 'reading-failure-rate'),
  1,
  '같은 날 다시 돌아도 한 줄이다');

select * from finish();
rollback;
