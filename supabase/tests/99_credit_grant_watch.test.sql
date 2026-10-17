-- 탈퇴 대기 계정에는 무상 지급을 받지 않고, 지급 장부의 합을 매일 잰다 (`20261219090000`, G-111 R-7 · R-8, ADR 0191)
--
--   1. **탈퇴 대기에는 새 지급이 없다** — `23514` 「탈퇴 대기 계정이라 지급할 수 없습니다.」. 화면의 문 · 런북의 공통 함수 모두
--   2. **회수는 받는다 · 정지된 계정의 지급(보상)도 받는다 · 앞서 선 지급의 재시도는 첫 결과를 돌려준다**
--   3. **대조** — 장부 합과 예외 몫이 다른 계정마다 알림 한 줄(하루 한 번), 고치지 않는다. 맞는 계정은 조용하다
--   4. **도는 자리** — 크론 `credit-grant-watch` 가 매일 부르고, 그 함수는 누구에게도 안 열린다
begin;
select plan(12);

create or replace function pg_temp.acting(uid uuid)
returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claims', tests.claims(uid), true);
end;
$$;

create temporary table folks as
select
  tests.signup('gw-leaving@example.com') as leaving,
  tests.signup('gw-suspended@example.com') as suspended,
  tests.signup('gw-operator@example.com') as operator,
  gen_random_uuid() as first_request;
grant select on folks to authenticated, service_role, anon;

insert into public.operator (user_id, note) values ((select operator from folks), '시험 — 지급 대조');

/** 화면이 읽은 버전 — 그 계정의 장부 줄 수 */
create or replace function pg_temp.seen(who uuid) returns integer language sql security definer as $$
  select count(*)::integer from public.reading_credit_grant_entry e where e.user_id = who
$$;
grant execute on function pg_temp.seen(uuid) to authenticated;

create or replace function pg_temp.grant(who uuid, credits integer, request uuid default gen_random_uuid())
returns text language sql as $$
  select g.replayed::text from public.operator_grant_reading_credits(
    who, credits, 'outage', '장애 보상', null,
    pg_temp.seen(who), request) g
$$;
create or replace function pg_temp.revoke(who uuid, credits integer)
returns text language sql as $$
  select g.replayed::text from public.operator_revoke_reading_credits(
    who, credits, 'mistake', '잘못 지급',
    pg_temp.seen(who), gen_random_uuid()) g
$$;
create or replace function pg_temp.extra(who uuid) returns integer language sql security definer as $$
  select coalesce((select g.extra from public.reading_credit_grant g where g.user_id = who), 0)
$$;
grant execute on function pg_temp.extra(uuid) to authenticated;

-- ── 1 · 2. 탈퇴 대기 ─────────────────────────────────────────────────────────

set local role authenticated;
select pg_temp.acting((select operator from folks));
select is(pg_temp.grant((select leaving from folks), 3, (select first_request from folks)), 'false', '이용 중에는 지급한다');
reset role;

update public.app_user set status = 'deletion_requested', deletion_requested_at = now() where id = (select leaving from folks);

set local role authenticated;
select pg_temp.acting((select operator from folks));
select throws_ok(
  format($$select pg_temp.grant(%L, 1)$$, (select leaving from folks)),
  '23514', '탈퇴 대기 계정이라 지급할 수 없습니다.', '탈퇴 대기 계정에는 새 지급을 받지 않는다');
select is(pg_temp.grant((select leaving from folks), 3, (select first_request from folks)), 'true',
  '앞서 선 지급의 재시도는 첫 결과를 돌려준다 — 새 지급이 아니다');
select is(pg_temp.revoke((select leaving from folks), 1), 'false', '탈퇴 대기여도 회수는 받는다');
select is(pg_temp.extra((select leaving from folks)), 2, '예외 몫은 지급 3 − 회수 1');
reset role;

select throws_ok(
  format($$select * from public.book_reading_credit_grant(%L, %L, 'grant', 1, 'operator', '런북 지급', %L)$$,
         (select operator from folks), (select leaving from folks), gen_random_uuid()),
  '23514', '탈퇴 대기 계정이라 지급할 수 없습니다.', '런북의 공통 함수도 같은 거절이다');

update public.app_user set status = 'suspended' where id = (select suspended from folks);

set local role authenticated;
select pg_temp.acting((select operator from folks));
select is(pg_temp.grant((select suspended from folks), 2), 'false', '정지된 계정의 지급(보상)은 받는다');
reset role;

-- ── 3. 대조 ──────────────────────────────────────────────────────────────────

-- 예외 몫을 장부 밖에서 밀어 어긋나게 한다 — 직접 고치면 이렇게 갈린다(런북이 막는 일)
update public.reading_credit_grant set extra = extra + 5 where user_id = (select leaving from folks);

select ok(public.watch_reading_credit_grants() >= 1, '어긋난 계정을 센다');
select is(
  (select array_agg(a.detail) from public.ops_alert a
   where a.kind = 'credit-grant-mismatch:' || (select leaving from folks)::text),
  array[format('무상 지급 장부 합 2장과 예외 몫 7장이 다르다 — 계정 %s. 고치지 않았다', (select leaving from folks))],
  '어긋난 계정마다 알림 한 줄 — 계정 id 와 두 수만');

select public.watch_reading_credit_grants();
select is(
  (select array[count(*)::integer, pg_temp.extra((select leaving from folks))] from public.ops_alert a
   where a.kind = 'credit-grant-mismatch:' || (select leaving from folks)::text),
  array[1, 7], '같은 날 다시 재도 한 줄이고, 예외 몫을 고치지 않는다');
select is(
  (select count(*)::integer from public.ops_alert a
   where a.kind = 'credit-grant-mismatch:' || (select suspended from folks)::text),
  0, '맞는 계정은 조용하다');

-- ── 4. 도는 자리 ─────────────────────────────────────────────────────────────

select ok(
  exists (select 1 from cron.job j where j.jobname = 'credit-grant-watch' and j.schedule = '41 5 * * *'
                                     and j.command = 'select public.watch_reading_credit_grants()')
  and not has_function_privilege('authenticated', 'public.watch_reading_credit_grants()', 'execute')
  and not has_function_privilege('service_role', 'public.watch_reading_credit_grants()', 'execute'),
  '크론이 매일 부르고, 그 함수는 누구에게도 안 열린다');

select * from finish();
rollback;
