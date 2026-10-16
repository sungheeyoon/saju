-- 운영자가 회원 화면에서 무상 풀이권을 지급 · 회수한다 (`20261214090000`, G-111 ①, ADR 0187)
--
--   1. **권한** — 운영자가 아니면 네 문 다 던지고(되감긴다), 서버 열쇠에도 안 열렸고, 공통 함수는 누구에게도 안 열렸다
--   2. **지급** — 1 ~ 10장, 장부 한 줄 · 예외 몫 = 장부 합 · 이용자 소식 한 줄(메모 없이) · 장애 알림 한 줄 · 접속기록 한 줄
--   3. **같은 요청 번호는 한 번만** — 다시 오면 같은 줄, 다른 내용이면 거절. 읽은 버전이 다르면 거절
--   4. **회수는 운영 지급분의 미사용 · 미예약만** — 무료 · 유료분은 줄지 않고, 유료 잔액 · 환불 셈은 그대로다
--   5. **회수와 사용은 같은 자물쇠 안에서 센다** — 셈하는 순간 `reading:user:<id>` 를 쥐고 있다. 회수한 뒤 다음 쓰임은 지급 몫을 못 고른다
--   6. **출처별 표 · 잔액** — 잔액은 한도 셈이고, 장부의 남은 수와 어긋날 수 있다(대상을 지운 확정 쓰임)
--   7. **통합 이력** — 구매 · 환불 · 사용 · 지급 · 회수, 반환 · 예약은 부호가 없다
--   8. **장부는 고치지 않는다 · 「기록 이전」의 모양 · 모든 계정의 장부 합 = 예외 몫**
--
-- 상한 검사를 빼면 2 가, 재시도 찾기를 빼면 3 이, 회수할 수 있는 수에서 예약을 빼지 않으면 4 가, 자물쇠를 셈 뒤로 옮기면 5 가 붉다.
begin;
select plan(57);

create or replace function pg_temp.acting(uid uuid)
returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claims', tests.claims(uid), true);
end;
$$;

create temporary table folks as
select
  tests.signup('cg-member@example.com') as member,
  tests.signup('cg-reporter@example.com') as reporter,
  tests.signup('cg-stranger@example.com') as stranger,
  tests.signup('cg-lockee@example.com') as lockee,
  tests.signup('cg-operator@example.com') as operator;
grant select on folks to authenticated, service_role, anon;

update public.app_user set nickname = '지급받는이' where id = (select member from folks);
update public.app_user set nickname = '운영자닉' where id = (select operator from folks);
insert into public.operator (user_id, note) values ((select operator from folks), '시험 — 무상 지급');

create temporary table asks (label text primary key, id uuid not null default gen_random_uuid());
insert into asks (label) values ('g1'), ('g2'), ('g3'), ('r1'), ('r2'), ('big'), ('stale'), ('x');
grant select on asks to authenticated, service_role, anon;

/** 이 파일이 만든 사람의 접속기록만 센다 — 표는 전역이다 */
create or replace function pg_temp.lines(who uuid)
returns table (action text, filter text, outcome text)
language sql security definer as $$
  select a.action, a.filter_summary, a.outcome from audit.operator_access a where a.actor_user_id = who order by a.id
$$;
grant execute on function pg_temp.lines(uuid) to authenticated, service_role, anon;

create or replace function pg_temp.extra(who uuid)
returns integer language sql security definer as $$
  select coalesce((select g.extra from public.reading_credit_grant g where g.user_id = who), 0)
$$;
grant execute on function pg_temp.extra(uuid) to authenticated;

-- 산 묶음 하나(3장) — 4 에서 회수가 유료 잔액을 안 건드리는지 본다
insert into public.reading_sale_reviewer (user_id, note) values ((select member from folks), '시험 — 무상 지급');
set local role authenticated;
select pg_temp.acting((select member from folks));
create temporary table ord (order_id uuid);
grant select, insert on ord to authenticated, service_role;
insert into ord select order_id from public.open_reading_order(3, 'portone', 'grant-bundle-0001');
set local role service_role;
select public.approve_reading_order((select order_id from ord), 'tx-grant-1', 12900, 'whk-grant-1');
reset role;

-- 신고 하나 — 회원이 신고받았다. 관련 신고로 이어진다
create or replace function pg_temp.report(who uuid, whom uuid)
returns uuid language sql as $$
  insert into public.report (reporter_user_id, reported_user_id, reason) values (who, whom, 'harassment') returning id
$$;
create temporary table cases as
select pg_temp.report(reporter, member) as about_member from folks;
grant select on cases to authenticated;

/** 4 에서 회수 전의 유료 묶음 셈 — 운영자 눈으로 읽어 둔다 */
create temporary table before_bundle (unused integer, bought integer);
grant select, insert on before_bundle to authenticated;

-- ── 1. 권한 ──────────────────────────────────────────────────────────────────

set local role authenticated;
select pg_temp.acting((select stranger from folks));

select throws_ok(
  format($$select * from public.operator_grant_reading_credits(%L, 1, 'operator', '메모', null, 0, %L)$$,
         (select member from folks), (select id from asks where label = 'x')),
  '42501', null, '운영자가 아니면 지급은 던진다');
select throws_ok(
  format($$select * from public.operator_revoke_reading_credits(%L, 1, 'mistake', '메모', 0, %L)$$,
         (select member from folks), (select id from asks where label = 'x')),
  '42501', null, '회수도');
select throws_ok(format($$select * from public.operator_member_grant_ledger(%L)$$, (select member from folks)),
  '42501', null, '지급 장부 읽기도');
select throws_ok(format($$select * from public.operator_member_credit_history(%L, 'all', 31)$$, (select member from folks)),
  '42501', null, '이력도');
select is((select count(*)::integer from pg_temp.lines((select stranger from folks))), 0,
  '던진 문 안에서는 아무것도 안 남는다 — 되감긴다');
select lives_ok($$select public.note_operator_denial(a)
                  from unnest(array['credits.grant', 'credits.revoke', 'members.credits', 'members.credit_history']) a$$,
  '거절은 따로 부르는 문이 넷 다 받는다');
select is((select count(*)::integer from pg_temp.lines((select stranger from folks)) where outcome = 'denied'), 4,
  '거절한 줄 넷');
select lives_ok($$select public.note_operator_denial(a)
                  from unnest(array['members.find', 'credits.refund_hold', 'today.figures']) a$$,
  '앞서 받던 동작은 그대로 받는다');

reset role;
select is(
  (select coalesce(array_agg(p.proname::text order by p.proname), '{}')
   from pg_proc p join pg_namespace n on n.oid = p.pronamespace
   where n.nspname = 'public'
     and p.proname in ('operator_grant_reading_credits', 'operator_revoke_reading_credits',
                       'operator_member_grant_ledger', 'operator_member_credit_history')
     and (has_function_privilege('service_role', p.oid, 'EXECUTE')
          or has_function_privilege('anon', p.oid, 'EXECUTE')
          or not has_function_privilege('authenticated', p.oid, 'EXECUTE')
          or p.provolatile <> 'v')),
  '{}'::text[],
  '네 문은 로그인한 사람에게만 열렸고 서버 열쇠에는 안 열렸다 — 다 volatile');
select is(
  (select coalesce(array_agg(p.proname::text order by p.proname), '{}')
   from pg_proc p join pg_namespace n on n.oid = p.pronamespace
   where n.nspname = 'public'
     and p.proname in ('book_reading_credit_grant', 'sync_reading_credit_grant', 'reading_credit_grant_left')
     and (has_function_privilege('service_role', p.oid, 'EXECUTE')
          or has_function_privilege('authenticated', p.oid, 'EXECUTE')
          or has_function_privilege('anon', p.oid, 'EXECUTE'))),
  '{}'::text[],
  '공통 함수 · 합 · 남은 수는 누구에게도 안 열렸다 — 런북은 운영 SQL 로만 부른다');
select ok(
  not has_table_privilege('authenticated', 'public.reading_credit_grant_entry', 'SELECT')
  and not has_table_privilege('service_role', 'public.reading_credit_grant_entry', 'INSERT'),
  '장부 표는 API 역할 어디에도 안 열렸다');

-- ── 2. 지급 ──────────────────────────────────────────────────────────────────

set local role authenticated;
select pg_temp.acting((select operator from folks));

select throws_ok(
  format($$select * from public.operator_grant_reading_credits(%L, 11, 'operator', '메모', null, 0, %L)$$,
         (select member from folks), (select id from asks where label = 'big')),
  '22023', '한 번에 1장에서 10장까지 지급합니다.', '한 번에 10장을 넘게 지급하지 못한다');
select throws_ok(
  format($$select * from public.operator_grant_reading_credits(%L, 0, 'operator', '메모', null, 0, %L)$$,
         (select member from folks), (select id from asks where label = 'big')),
  '22023', null, '0장도 안 된다');
select throws_ok(
  format($$select * from public.operator_grant_reading_credits(%L, 1, 'mistake', '메모', null, 0, %L)$$,
         (select member from folks), (select id from asks where label = 'big')),
  '22023', '사유를 골라 주세요.', '지급의 갈래는 장애 보상 · 운영 지급뿐이다');
select throws_ok(
  format($$select * from public.operator_grant_reading_credits(%L, 1, 'operator', '   ', null, 0, %L)$$,
         (select member from folks), (select id from asks where label = 'big')),
  '22023', null, '메모는 필수다');
select throws_ok(
  format($$select * from public.operator_grant_reading_credits(%L, 1, 'outage', '메모', %L, 0, %L)$$,
         (select stranger from folks), (select about_member from cases), (select id from asks where label = 'big')),
  '22023', '관련 신고가 이 회원의 신고가 아닙니다.', '관련 신고는 그 회원이 신고했거나 신고받은 것만');

select results_eq(
  format($$select replayed from public.operator_grant_reading_credits(%L, 3, 'outage', '장애 보상 — 10/16 오류', %L, 0, %L)$$,
         (select member from folks), (select about_member from cases), (select id from asks where label = 'g1')),
  $$values (false)$$,
  '3장을 지급한다 — 관련 신고와 함께');
select is(pg_temp.extra((select member from folks)), 3, '예외 몫이 장부의 합이 된다');
select lives_ok(
  format($$select * from public.operator_grant_reading_credits(%L, 10, 'operator', '운영 지급', null, 1, %L)$$,
         (select member from folks), (select id from asks where label = 'g2')),
  '10장까지는 된다');
select is(pg_temp.extra((select member from folks)), 13, '둘의 합');

-- ── 3. 같은 요청 번호는 한 번만 · 읽은 버전 ─────────────────────────────────

select results_eq(
  format($$select replayed from public.operator_grant_reading_credits(%L, 3, 'outage', '장애 보상 — 10/16 오류', %L, 0, %L)$$,
         (select member from folks), (select about_member from cases), (select id from asks where label = 'g1')),
  $$values (true)$$,
  '같은 요청 번호로 다시 오면 첫 결과를 돌려준다 — 읽은 버전이 낡아도');
select is(pg_temp.extra((select member from folks)), 13, '두 번 더하지 않는다');
select throws_ok(
  format($$select * from public.operator_grant_reading_credits(%L, 2, 'outage', '메모', null, 2, %L)$$,
         (select member from folks), (select id from asks where label = 'g1')),
  '22023', null, '같은 번호에 다른 수량이면 거절한다');
select throws_ok(
  format($$select * from public.operator_grant_reading_credits(%L, 1, 'operator', '메모', null, 1, %L)$$,
         (select member from folks), (select id from asks where label = 'stale')),
  '55000', null, '읽은 버전(장부 줄 수)이 지금과 다르면 거절한다 — 그 사이 다른 지급이 있었다');

reset role;
select is(
  (select count(*)::integer from public.reading_credit_grant_entry where user_id = (select member from folks)),
  2, '장부는 두 줄이다');
select is(
  (select count(*)::integer from public.notification
   where user_id = (select member from folks) and kind = 'credits_granted'),
  2, '이용자 소식은 지급마다 한 줄 — 재시도는 안 더한다');
select is(
  (select count(*)::integer from public.ops_alert a
   where a.kind in (select 'credit-grant:' || e.id from public.reading_credit_grant_entry e
                    where e.user_id = (select member from folks))),
  2, '장애 알림 길도 지급마다 한 줄');
select ok(
  (select bool_and(a.detail !~ '장애 보상 — 10/16' and a.detail ~ (select member from folks)::text)
   from public.ops_alert a
   where a.kind in (select 'credit-grant:' || e.id from public.reading_credit_grant_entry e
                    where e.user_id = (select member from folks))),
  '알림은 계정 id · 수량 · 갈래만 — 메모는 안 간다');
select results_eq(
  format($$select report_id, actor_user_id, carried_over from public.reading_credit_grant_entry
           where request_id = %L$$, (select id from asks where label = 'g1')),
  format($$values (%L::uuid, %L::uuid, false)$$, (select about_member from cases), (select operator from folks)),
  '실행자는 부른 사람이고 관련 신고가 남는다');

set local role authenticated;
select pg_temp.acting((select member from folks));
select results_eq(
  $$select kind, credit_count, credit_reason from public.my_notifications() where kind like 'credits_%' order by credit_count$$,
  $$values ('credits_granted'::text, 3, 'outage'::text), ('credits_granted', 10, 'operator')$$,
  '이용자는 소식에서 수량과 갈래를 읽는다');
select is(
  (select count(*)::integer from unnest(
     (select p.proargnames from pg_proc p join pg_namespace n on n.oid = p.pronamespace
      where n.nspname = 'public' and p.proname = 'my_notifications')) a where a ~ 'note'),
  0, '소식의 칸에 메모가 없다');

-- ── 4. 회수는 운영 지급분의 미사용 · 미예약만 ───────────────────────────────

-- 무료는 다 썼고(시도 없이 적힌 확정 — 지운 대상의 것과 같은 자리), 지급 몫에서 확정 넷 · 풀린 하나 · 살아 있는 시도 둘의 예약.
-- 시도가 서면 트리거가 몫을 고른다 — 무료가 찼으니 지급 몫이다. 남은 지급분 = 13 − 4 − 2 = 7
reset role;
insert into public.reading_credit_use (user_id, share, source, state, confirmed_at)
select (select member from folks), 'free', 'run', 'confirmed', now() from generate_series(1, tests.reading_credit_limit());
insert into public.reading_credit_use (user_id, share, source, state, confirmed_at)
select (select member from folks), 'grant', 'run', 'confirmed', now() from generate_series(1, 4);
insert into public.reading_credit_use (user_id, share, source, state, released_at)
values ((select member from folks), 'grant', 'run', 'released', now());
insert into public.reading_run (user_id, kind, idempotency_key)
values ((select member from folks), 'self', 'grant-live-0001'), ((select member from folks), 'self', 'grant-live-0002');

select is(
  (select count(*)::integer from public.reading_credit_use u
   where u.user_id = (select member from folks) and u.share = 'grant' and u.state = 'reserved'),
  2, '살아 있는 시도 둘이 지급 몫을 예약했다 — 무료가 찼으므로');

set local role authenticated;
select pg_temp.acting((select operator from folks));
insert into before_bundle
select (select unused from public.operator_reading_refund_basis((select order_id from ord))), null;

select results_eq(
  format($$select granted, used, reserved, revocable from public.operator_member_grant_ledger(%L)$$,
         (select member from folks)),
  $$values (13, 4, 2, 7)$$,
  '무상 지급: 받은 13 · 사용 4 · 예약 중 2 · 남은 7');
select throws_ok(
  format($$select * from public.operator_revoke_reading_credits(%L, 8, 'mistake', '잘못 지급', 2, %L)$$,
         (select member from folks), (select id from asks where label = 'r1')),
  '22023', '회수할 수 있는 지급분보다 많습니다 — 지금 7장입니다.',
  '예약 중 · 쓴 지급분은 회수하지 못한다');
select throws_ok(
  format($$select * from public.operator_revoke_reading_credits(%L, 1, 'outage', '메모', 2, %L)$$,
         (select member from folks), (select id from asks where label = 'r1')),
  '22023', '사유를 골라 주세요.', '회수의 갈래는 잘못 지급 · 중복 지급 · 기타뿐이다');
select results_eq(
  format($$select replayed from public.operator_revoke_reading_credits(%L, 7, 'duplicate', '중복 지급', 2, %L)$$,
         (select member from folks), (select id from asks where label = 'r1')),
  $$values (false)$$,
  '남은 7장을 다 회수한다');
select is(pg_temp.extra((select member from folks)), 6, '예외 몫이 13 − 7 = 6 이 된다 — 쓴 4 와 예약 2');

select is(
  (select unused from public.operator_reading_refund_basis((select order_id from ord))),
  (select unused from before_bundle),
  '회수는 유료 묶음의 안 쓴 수(환불 셈)를 건드리지 않는다');

reset role;
select is(
  (select bought_credits from public.reading_credit_shares((select member from folks))),
  3,
  '유료 몫도 그대로다');
select is(
  (select free_credits from public.reading_credit_shares((select member from folks))),
  tests.reading_credit_limit(),
  '무료 몫도 그대로다');

set local role authenticated;
select pg_temp.acting((select operator from folks));
select throws_ok(
  format($$select * from public.operator_revoke_reading_credits(%L, 1, 'other', '기타', 3, %L)$$,
         (select member from folks), (select id from asks where label = 'r2')),
  '22023', '회수할 수 있는 지급분보다 많습니다 — 지금 0장입니다.',
  '지급분이 0 이면 무료 · 유료가 남아도 회수하지 못한다');

-- ── 5. 회수와 사용은 같은 자물쇠 안에서 센다 ─────────────────────────────────

reset role;
/**
 * 한 세션으로는 나란히 부르는 둘을 못 만든다(`48_reading_bundle_ledger` 5 와 같은 꼴). 대신 **셈하는 순간 그 사람의 자물쇠를 쥐고
 * 있는가**를 잰다. 자물쇠는 트랜잭션 끝까지 남으므로 이 트랜잭션에서 아직 한 번도 안 잠긴 사람(`lockee`)에게 잰다 — 장부 줄은
 * 문을 거치지 않고 적는다.
 */
create temporary table lock_seen (who uuid, held boolean);
grant insert, select on lock_seen to authenticated;

alter function public.reading_credit_grant_left(uuid) rename to reading_credit_grant_left_real;
create function public.reading_credit_grant_left(p_user uuid)
returns integer
language plpgsql volatile security definer set search_path = '' as $$
begin
  insert into pg_temp.lock_seen values (p_user, exists (
    select 1 from pg_catalog.pg_locks l
    where l.locktype = 'advisory' and l.pid = pg_catalog.pg_backend_pid() and l.granted
      and ((l.classid::bigint << 32) | l.objid::bigint)
          = pg_catalog.hashtext('reading:user:' || p_user::text)::bigint));
  return public.reading_credit_grant_left_real(p_user);
end;
$$;

insert into public.reading_credit_grant_entry (user_id, kind, credits, reason, note, request_id, actor_user_id)
values ((select lockee from folks), 'grant', 2, 'operator', '자물쇠 재기', gen_random_uuid(), (select operator from folks));
select public.sync_reading_credit_grant((select lockee from folks));

set local role authenticated;
select pg_temp.acting((select operator from folks));
select lives_ok(
  format($$select * from public.operator_revoke_reading_credits(%L, 1, 'mistake', '자물쇠 재기', 1, gen_random_uuid())$$,
         (select lockee from folks)),
  '처음 잠기는 사람에게서 1장을 회수한다');

reset role;
select is((select array_agg(held) from lock_seen where who = (select lockee from folks)), array[true],
  '회수는 셈하는 순간 풀이 시작 · 인연 요청과 같은 사람 자물쇠를 쥐고 있다');

-- 풀린 예약 하나 — 살아 있던 시도 하나가 실패로 끝났다. 그 자리가 지급 몫으로 돌아와 1장을 회수할 수 있다
update public.reading_run set status = 'failed', failure_code = 'model_error', finished_at = now()
where user_id = (select member from folks) and idempotency_key = 'grant-live-0001';

set local role authenticated;
select pg_temp.acting((select operator from folks));
select lives_ok(
  format($$select * from public.operator_revoke_reading_credits(%L, 1, 'other', '실패로 돌아온 자리', 3, %L)$$,
         (select member from folks), (select id from asks where label = 'r2')),
  '실패로 돌아온 지급 자리 1장을 회수한다');

reset role;
select is(
  (select share from public.pick_reading_credit_share((select member from folks))),
  'bundle',
  '무료를 다 쓰면 회수한 지급 몫이 아니라 산 묶음으로 간다 — 회수한 자리를 다시 쓰지 못한다');

-- ── 6. 지급 장부의 지금 ─────────────────────────────────────────────────────

set local role authenticated;
select pg_temp.acting((select operator from folks));
select results_eq(
  format($$select granted, used, reserved, revocable, version from public.operator_member_grant_ledger(%L)$$,
         (select member from folks)),
  $$values (5, 4, 1, 0, 4)$$,
  '지급 받은 5(13 − 8) · 사용 4 · 예약 1 · 회수할 것 0 · 장부 넷');

-- ── 7. 통합 이력 ─────────────────────────────────────────────────────────────

select results_eq(
  format($$select kind, source, delta, state from public.operator_member_credit_history(%L, 'grants', 31)
           order by kind, delta$$, (select member from folks)),
  $$values ('grant'::text, 'grant'::text, 3, null::text), ('grant', 'grant', 10, null),
           ('revoke', 'grant', -7, null), ('revoke', 'grant', -1, null)$$,
  '지급 · 회수 — 수는 늘고 준 만큼(한 트랜잭션이라 시각이 같아 수로 줄 세운다)');
select results_eq(
  format($$select kind, delta, state from public.operator_member_credit_history(%L, 'uses', 50)
           where source = 'grant' order by state, delta nulls first$$, (select member from folks)),
  $$values ('use'::text, -1, 'confirmed'::text), ('use', -1, 'confirmed'), ('use', -1, 'confirmed'), ('use', -1, 'confirmed'),
           ('use', null, 'released'), ('use', null, 'released'), ('use', null, 'reserved')$$,
  '사용 — 확정만 −1, 반환 · 예약은 부호가 없다');
select results_eq(
  format($$select kind, delta, order_number ~ '^rdo_' from public.operator_member_credit_history(%L, 'orders', 31)$$,
         (select member from folks)),
  $$values ('purchase'::text, 3, true)$$,
  '구매 — 수량과 주문 번호만');
select results_eq(
  format($$select actor_nickname from public.operator_member_credit_history(%L, 'grants', 1)$$, (select member from folks)),
  $$values ('운영자닉'::text)$$,
  '실행자는 닉네임으로 선다');
select throws_ok(
  format($$select * from public.operator_member_credit_history(%L, 'money', 31)$$, (select member from folks)),
  '22023', null, '모르는 거르기는 거절한다');

reset role;
select results_eq(
  $$select action, filter from pg_temp.lines((select operator from folks))
    where action in ('credits.grant', 'credits.revoke') and filter like 'user=' || (select member from folks) || ' %'$$,
  format($$select a, f from (values
           ('credits.grant'::text, %L::text), ('credits.grant', %L), ('credits.grant', %L),
           ('credits.revoke', %L), ('credits.revoke', %L)) v(a, f)$$,
         (select format('user=%s entry=%s report=%s', e.user_id, e.id, e.report_id) from public.reading_credit_grant_entry e
          where e.request_id = (select id from asks where label = 'g1')),
         (select format('user=%s entry=%s', e.user_id, e.id) from public.reading_credit_grant_entry e
          where e.request_id = (select id from asks where label = 'g2')),
         (select format('user=%s entry=%s report=%s', e.user_id, e.id, e.report_id) from public.reading_credit_grant_entry e
          where e.request_id = (select id from asks where label = 'g1')),
         (select format('user=%s entry=%s', e.user_id, e.id) from public.reading_credit_grant_entry e
          where e.request_id = (select id from asks where label = 'r1')),
         (select format('user=%s entry=%s', e.user_id, e.id) from public.reading_credit_grant_entry e
          where e.request_id = (select id from asks where label = 'r2'))),
  '쓰기마다 한 줄 — 계정 · 장부 줄 · 관련 신고 id 만(재시도도 한 줄)');
select is(
  (select count(*)::integer from audit.operator_access a
   where to_jsonb(a)::text ~ '(장애 보상|중복 지급|운영 지급|지급받는이|@example)'),
  0, '기록에 메모 · 닉네임 · 이메일이 없다');

-- ── 8. 장부는 고치지 않는다 · 「기록 이전」 · 장부 합 = 예외 몫 ─────────────

select throws_ok(
  format($$update public.reading_credit_grant_entry set credits = 1 where request_id = %L$$,
         (select id from asks where label = 'g1')),
  '55000', null, '장부 줄은 고치지 않는다 — 회수 한 줄로 바로잡는다');
select throws_ok(
  format($$insert into public.reading_credit_grant_entry (user_id, kind, credits, reason, note, carried_over, request_id)
           values (%L, 'grant', 1, 'operator', '옮김', true, gen_random_uuid())$$, (select member from folks)),
  '23514', null, '「기록 이전」 줄은 요청 번호가 없다');
select lives_ok(
  format($$insert into public.reading_credit_grant_entry (user_id, kind, credits, reason, note, carried_over, at)
           values (%L, 'grant', 12, 'operator', '옛 note 그대로 — 길이 제한 밖', true, now() - interval '1 year')$$,
         (select stranger from folks)),
  '「기록 이전」 줄은 실행자 · 요청 번호 없이 10장을 넘어도 선다 — 옛 extra 그대로');
select public.sync_reading_credit_grant((select stranger from folks));
select is(
  (select count(*)::integer
   from (select coalesce(g.user_id, e.user_id) as u
         from public.reading_credit_grant g
         full join (select x.user_id, sum(case x.kind when 'grant' then x.credits else -x.credits end) as total
                    from public.reading_credit_grant_entry x group by x.user_id) e on e.user_id = g.user_id
         where coalesce(g.extra, 0) <> coalesce(e.total, 0)) off),
  0,
  '모든 계정에서 장부의 합 = 예외 몫 — 옮긴 줄 포함');

select * from finish();
rollback;
