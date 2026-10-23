-- DB 크기가 읽기 전용 문턱(500MB)에 닿기 **전에** 운영자에게 간다 (`20261224090000`, ADR 0199)
--
-- 여기서 재는 것 다섯.
--
--   1. **세는 값은 Supabase 가 세는 것과 같은 꼴이다** — 클러스터의 모든 DB 의 `pg_database_size` 합
--   2. **문턱 아래는 안 알리고, 경고 · 위험은 저마다 하루 한 줄이다**
--   3. **감시기가 이 갈래를 돈다** — 문턱을 0 으로 내리면 감시기 한 바퀴가 경고 한 줄을 남긴다(갈래가 없으면 붉다)
--   4. **크기를 못 재도 감시기는 끝까지 간다** — 실패를 한 줄로 알리고, 앞의 네 갈래가 함께 넘어지지 않는다
--   5. **아무도 직접 못 부른다** — 알림함을 채울 수 없다
--
-- 500MB 를 실제로 채우지 않는다 — 알리는 함수가 크기를 인자로 받고, 감시기 쪽은 트랜잭션 안에서 문턱 · 셈 함수를 바꿔 잰다
-- (끝의 `rollback` 이 되돌린다).
begin;
select plan(12);

delete from public.ops_alert;

-- ── 1. 세는 값 — 한 번 잰 값을 견준다 ────────────────────────────────────────────

create temporary table measured as
select public.database_size_counted() as counted,
       (select sum(pg_database_size(oid))::bigint from pg_database) as summed,
       pg_database_size(current_database()) as this_one;

select ok(
  (select counted = summed and counted >= this_one from measured),
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

-- ── 3. 감시기가 이 갈래를 돈다 ──────────────────────────────────────────────────

delete from public.ops_alert;

select public.watch_cron();

select is(
  (select count(*)::int from public.ops_alert where kind like 'database-size-%'),
  0,
  '시험 DB 는 문턱보다 작다 — 크기 알림은 없다');

/** 경고 문턱을 0 으로 내린다 — 어떤 DB 든 넘는다. 감시기에 다섯째 갈래가 없으면 아래가 붉다 */
create or replace function public.database_size_warning_bytes()
returns bigint language sql immutable set search_path = '' as $$ select 0::bigint $$;

select public.watch_cron();

select is(
  (select count(*)::int from public.ops_alert where kind = 'database-size-warning'),
  1,
  '문턱을 넘으면 감시기 한 바퀴가 경고 한 줄을 남긴다');

-- ── 4. 크기를 못 재도 끝까지 간다 ───────────────────────────────────────────────

delete from public.ops_alert;

create or replace function public.database_size_counted()
returns bigint language plpgsql stable security definer set search_path = '' as $$
begin
  raise exception 'size is unreadable for the test';
end;
$$;

select lives_ok($$select public.watch_cron()$$, '크기를 못 재도 감시기는 넘어지지 않는다');

select is(
  (select detail from public.ops_alert where kind = 'database-size-unreadable'),
  'DB 크기를 못 쟀다: size is unreadable for the test',
  '못 잰 것을 한 줄로 알린다');

-- ── 5. 누가 부르나 ─────────────────────────────────────────────────────────────

select ok(
  not exists (
    select 1
    from unnest(array['anon', 'authenticated', 'service_role']) as who (role_name)
    cross join unnest(array[
      'public.database_size_alert(bigint)',
      'public.database_size_counted()',
      'public.database_size_warning_bytes()',
      'public.database_size_critical_bytes()']) as fn (signature)
    where has_function_privilege(who.role_name, fn.signature, 'execute')),
  '크기 알림 · 크기 셈 · 문턱 둘은 감시기 안에서만 돈다 — 익명 · 로그인한 사람 · 열쇠 모두 못 부른다');

select * from finish();
rollback;
