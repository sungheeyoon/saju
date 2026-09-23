-- 탈퇴의 자동 처분 — **신청 뒤 3일 안에, 흔적이 남으면 성공이 아니다** (G-53, ADR 0094 덧)
--
-- 여기서 재는 것 여섯.
--
--   1. **하루가 지나기 전에는 안 집는다** — 되돌릴 틈
--   2. **하루가 지나면 처분하고, 기록은 누구였는지를 안 든다**
--   3. **두 번 돌아도 안전하다** — 처분된 계정은 다시 안 집히고 오류도 없다
--   4. **실패하면 계정이 대기에 남고, 기록이 실패를 들고, 운영자에게 한 줄이 간다**
--   5. **흔적이 남으면 처분째 되감긴다** — 성공으로 적지 않는다
--   6. **기한(3일)을 넘기면 사람에게 알린다**
--
-- 처분하는 함수는 대기 중인 계정 **전부**를 집는다. 그래서 돌려준 수를 재지 않고 이 파일이
-- 만든 계정만 본다(`32_test_isolation`).
begin;
select plan(17);

create temporary table folks as
select
  tests.signup('dispose-early@example.com') as early,
  tests.signup('dispose-due@example.com') as due,
  tests.signup('dispose-broken@example.com') as broken,
  tests.signup('dispose-residue@example.com') as residue;

/** 앱의 문으로 신청한다 — 시계가 그 문이 적은 시각이어야 한다 */
create or replace function pg_temp.requests(who uuid)
returns void
language plpgsql
as $$
begin
  perform set_config('request.jwt.claims', tests.claims(who), true);
  perform public.request_account_deletion();
  perform set_config('request.jwt.claims', '', true);
end;
$$;

/** 신청 시각을 과거로 민다 — 하루 · 사흘을 실제로 기다리지 않으려고 */
create or replace function pg_temp.asked_ago(who uuid, ago interval)
returns void
language sql
as $$ update public.app_user set deletion_requested_at = now() - ago where id = who $$;

select pg_temp.requests(early) from folks;
select pg_temp.requests(due) from folks;
select pg_temp.requests(broken) from folks;
select pg_temp.requests(residue) from folks;

select is(
  (select count(*)::int from public.app_user a, folks f
   where a.id in (f.early, f.due, f.broken, f.residue) and a.status = 'deletion_requested'),
  4, '넷이 앱에서 신청했다');

-- ── 1 · 2 · 3 ──────────────────────────────────────────────────────────────────

select pg_temp.asked_ago(due, interval '25 hours') from folks;
select public.dispose_requested_accounts();

select is(
  (select count(*)::int from auth.users u where u.id = (select early from folks)),
  1, '신청 뒤 하루가 안 된 계정은 안 집는다 — 되돌릴 틈이다');

select is(
  (select count(*)::int from auth.users u where u.id = (select due from folks)),
  0, '하루가 지난 계정은 처분된다');

select is(
  (select count(*)::int from public.account_disposal d where d.user_id = (select due from folks)),
  0, '처분 기록은 누구였는지를 안 든다');

select ok(
  exists (select 1 from public.account_disposal d
          where d.user_id is null and d.disposed_at is not null and d.attempts = 1
            and d.last_error is null),
  '처분 기록은 신청 시각 · 처분 시각 · 시도 수만 남긴다');

select lives_ok($$select public.dispose_requested_accounts()$$,
  '두 번 돌아도 오류가 없다');

select is(
  (select count(*)::int from public.account_disposal d where d.disposed_at is not null
     and d.requested_at = (select min(requested_at) from public.account_disposal
                           where disposed_at is not null and last_attempt_at >= now() - interval '1 minute')),
  1, '두 번 돌아도 같은 처분이 두 번 적히지 않는다');

-- ── 4 · 실패 ───────────────────────────────────────────────────────────────────

/** 이 계정만 지워지지 않게 한다 — 처분 중 어디서든 터지는 오류의 대역 */
create function pg_temp.refuse_delete()
returns trigger language plpgsql as $$
begin
  if old.id = (select broken from folks) then
    raise exception '시험 — 지우지 못함';
  end if;
  return old;
end;
$$;
create trigger refuse_delete before delete on auth.users
  for each row execute function pg_temp.refuse_delete();

select pg_temp.asked_ago(broken, interval '30 hours') from folks;
select lives_ok($$select public.dispose_requested_accounts()$$,
  '한 계정이 실패해도 처분 전체는 멈추지 않는다');

select is(
  (select status from public.app_user where id = (select broken from folks)),
  'deletion_requested', '실패한 계정은 대기에 그대로 남는다 — 다음 시간에 다시 집힌다');

select ok(
  (select d.last_error like '%지우지 못함%' and d.disposed_at is null and d.attempts = 1
   from public.account_disposal d where d.user_id = (select broken from folks)),
  '기록이 실패를 든다 — 성공으로 적지 않는다');

select ok(
  exists (select 1 from public.ops_alert where kind = 'account-disposal-failed'),
  '실패는 운영자에게 한 줄로 간다');

select public.dispose_requested_accounts();
select is(
  (select d.attempts from public.account_disposal d where d.user_id = (select broken from folks)),
  2, '다시 돌면 다시 시도하고 수를 센다');

-- ── 5 · 흔적 ───────────────────────────────────────────────────────────────────

/** 지운 뒤에 그 사람의 감사 로그를 한 줄 새로 남긴다 — FK 밖의 흔적 */
create function pg_temp.leave_trace()
returns trigger language plpgsql as $$
begin
  if old.id = (select residue from folks) then
    insert into auth.audit_log_entries (instance_id, id, payload, created_at)
    values (old.instance_id, gen_random_uuid(),
            jsonb_build_object('actor_id', old.id::text), now());
  end if;
  return old;
end;
$$;
create trigger leave_trace after delete on auth.users
  for each row execute function pg_temp.leave_trace();

select pg_temp.asked_ago(residue, interval '30 hours') from folks;
select public.dispose_requested_accounts();

select is(
  (select count(*)::int from auth.users u where u.id = (select residue from folks)),
  1, '흔적이 남으면 처분째 되감긴다 — 계정이 돌아와 있다');

select ok(
  (select d.last_error like '%흔적%auth.audit_log_entries%' and d.disposed_at is null
   from public.account_disposal d where d.user_id = (select residue from folks)),
  '남은 자리의 이름을 기록이 든다');

-- ── 6 · 기한 ───────────────────────────────────────────────────────────────────

select pg_temp.asked_ago(broken, interval '73 hours') from folks;
select public.dispose_requested_accounts();

select ok(
  exists (select 1 from public.ops_alert where kind = 'account-disposal-overdue'),
  '신청 뒤 3일을 넘긴 대기가 있으면 사람에게 알린다');

-- ── 문과 일정 ──────────────────────────────────────────────────────────────────

select is(
  (select schedule from cron.job where jobname = 'account-disposal'),
  '23 * * * *', '한 시간마다 돈다 — 첫 시도 뒤 기한까지 스무 번 넘게 다시 집는다');

select function_privs_are('public', 'dispose_requested_accounts', array[]::text[],
  'authenticated', array[]::text[],
  '처분은 로그인한 사람이 부를 수 없다');

select * from finish();
rollback;
