-- DB 크기가 읽기 전용 문턱(500MB)에 닿기 **전에** 운영자에게 간다 (`20261224090000`, ADR 0199)
--
-- 여기서 재는 것 넷.
--
--   1. **세는 값은 Supabase 가 세는 것과 같은 꼴이다** — 클러스터의 모든 DB 의 `pg_database_size` 합
--   2. **문턱 아래는 안 알리고, 경고 · 위험은 저마다 하루 한 줄이다**
--   3. **감시기가 이 갈래를 돈다** — 작은 DB 에서는 아무것도 안 보낸다
--   4. **아무도 직접 못 부른다** — 알림함을 채울 수 없다
--
-- 500MB 를 실제로 채우지 않는다 — 알리는 함수가 크기를 인자로 받는다.
begin;
select plan(10);

delete from public.ops_alert;

-- ── 1. 세는 값 ──────────────────────────────────────────────────────────────────

select ok(
  public.database_size_counted() >= pg_database_size(current_database())
  and public.database_size_counted() = (select sum(pg_database_size(oid))::bigint from pg_database),
  '센 크기는 클러스터의 모든 DB 의 합이다 — 지금 DB 하나보다 작지 않다');

-- ── 2. 문턱 ─────────────────────────────────────────────────────────────────────

select ok(
  not public.database_size_alert(public.database_size_warning_bytes() - 1),
  '경고 문턱 아래는 안 알린다');

select ok(
  public.database_size_alert(public.database_size_warning_bytes()),
  '경고 문턱에 닿으면 알린다');

select is(
  (select detail from public.ops_alert where kind = 'database-size-warning'),
  'DB 크기 350 MB — 경고 문턱(350 MB)을 넘었다. 500MB 에서 읽기 전용이 된다. 큰 표를 본다',
  '경고는 지금 크기와 문턱을 적는다');

select ok(
  not public.database_size_alert(public.database_size_warning_bytes() + 1),
  '같은 날 경고는 두 번 안 간다');

select ok(
  public.database_size_alert(public.database_size_critical_bytes()),
  '위험 문턱에 닿으면 경고와 따로 한 줄이 간다');

select is(
  (select count(*)::int from public.ops_alert where kind like 'database-size-%'),
  2,
  '경고 하나 · 위험 하나');

-- ── 3. 감시기 ───────────────────────────────────────────────────────────────────

delete from public.ops_alert;

select lives_ok($$select public.watch_cron()$$, '감시기가 다섯째 갈래까지 돈다');

select is(
  (select count(*)::int from public.ops_alert where kind like 'database-size-%'),
  0,
  '시험 DB 는 문턱보다 작다 — 크기 알림은 없다');

-- ── 4. 누가 부르나 ─────────────────────────────────────────────────────────────

select ok(
  not has_function_privilege('authenticated', 'public.database_size_alert(bigint)', 'execute')
  and not has_function_privilege('anon', 'public.database_size_alert(bigint)', 'execute')
  and not has_function_privilege('service_role', 'public.database_size_alert(bigint)', 'execute')
  and not has_function_privilege('service_role', 'public.database_size_counted()', 'execute'),
  '크기 알림 · 크기 셈은 감시기 안에서만 돈다 — 로그인한 사람 · 익명 · 열쇠 모두 못 부른다');

select * from finish();
rollback;
