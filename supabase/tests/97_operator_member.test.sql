-- 운영자가 회원 한 명을 찾아 상태 · 풀이권 · 경고를 본다 (`20261212090000`, G-110 ③, ADR 0185)
--
--   1. **찾는다** — 닉네임(대소문자 · 앞뒤 빈칸을 안 가린다)이나 계정 id 로 한 명. 없으면 빈 결과, 말이 없으면 묻기만
--   2. **풀이권** — 산 회차 · 걷은 회차 · 산 것에서 쓴 것 · 예약 중 · 몫을 안 가린 쓴 것. 죽은 예약은 세지 않는다
--   3. **경고 이력** — 이 계정이 제재 대상인 경고 · 이용 정지 결정만, 남의 것 · 조치 없음은 안 선다. 12개월 셈
--   4. **접속기록** — 문마다 한 줄, 찾은 말(닉네임)은 안 적고 계정 id 만
--   5. **거절** — 운영자가 아니면 던지고(되감긴다), 거절은 따로 부르는 문이 적는다
--   6. **모양** — 둘 다 volatile, 로그인한 사람에게만 열려 있다. 판단 근거 · 이메일 칸이 반환형에 없다
--
-- 찾을 때 `nickname_key` 를 안 거치면 1 의 대소문자가, 장부를 세기 전에 예약을 안 풀면 2 의 예약이, 제재 대상 조건을 빼면
-- 3 의 남의 경고가, 기록에 찾은 말을 적으면 4 가 붉다.
begin;
select plan(24);

create or replace function pg_temp.acting(uid uuid)
returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claims', tests.claims(uid), true);
end;
$$;

create temporary table folks as
select
  tests.signup('om-member@example.com') as member,
  tests.signup('om-reporter@example.com') as reporter,
  tests.signup('om-other@example.com') as other,
  tests.signup('om-stranger@example.com') as stranger,
  tests.signup('om-operator@example.com') as operator;
grant select on folks to authenticated, service_role, anon;

update public.app_user set nickname = 'Om찾기' where id = (select member from folks);
insert into public.operator (user_id, note) values ((select operator from folks), '시험 — 회원 찾기');

/** 이 파일이 만든 사람의 줄만 센다 — 표는 전역이다 */
create or replace function pg_temp.lines(who uuid)
returns table (action text, target uuid, filter text, outcome text)
language sql security definer as $$
  select a.action, a.target_report_id, a.filter_summary, a.outcome
  from audit.operator_access a where a.actor_user_id = who order by a.id
$$;
grant execute on function pg_temp.lines(uuid) to authenticated, service_role, anon;

-- ── 준비 — 산 묶음 둘(1회 · 3회, 3회에서 하나를 돌려줌), 쓴 것 · 죽은 예약 · 무료 쓰임 ───────

insert into public.reading_sale_reviewer (user_id, note) values ((select member from folks), '시험 — 회원 찾기');

set local role authenticated;
select pg_temp.acting((select member from folks));
create temporary table ord (label text, order_id uuid);
grant select, insert on ord to authenticated, service_role;
insert into ord select 'one', order_id from public.open_reading_order(1, 'portone', 'member-one-0001');
insert into ord select 'three', order_id from public.open_reading_order(3, 'portone', 'member-three-0001');

set local role service_role;
select public.approve_reading_order((select order_id from ord where label = 'one'), 'tx-member-1', 4900, 'whk-member-1');
select public.approve_reading_order((select order_id from ord where label = 'three'), 'tx-member-3', 12900, 'whk-member-3');
select public.refund_reading_order((select order_id from ord where label = 'three'), 4300, 1, 'unused', 'rf-member-3');

reset role;
insert into public.reading_credit_use (user_id, share, bundle_id, source, state, confirmed_at)
select (select member from folks), 'bundle', b.id, 'run', 'confirmed', now()
from public.reading_bundle b where b.order_id = (select order_id from ord where label = 'one');
/** 죽은 예약 — 가리키는 시도도 요청도 없다 */
insert into public.reading_credit_use (user_id, share, bundle_id, source)
select (select member from folks), 'bundle', b.id, 'run'
from public.reading_bundle b where b.order_id = (select order_id from ord where label = 'three');
insert into public.reading_credit_use (user_id, share, source, state, confirmed_at)
values ((select member from folks), 'free', 'run', 'confirmed', now()),
       ((select member from folks), 'free', 'run', 'confirmed', now());

-- 경고 셋(하나는 신고한 쪽으로 받은 것, 하나는 13개월 전) · 남이 받은 경고 · 조치 없음
create or replace function pg_temp.report(whom uuid, reason text)
returns uuid language sql as $$
  insert into public.report (reporter_user_id, reported_user_id, reason)
  values ((select reporter from folks), whom, reason) returning id
$$;
create or replace function pg_temp.report_by(who uuid, whom uuid, reason text)
returns uuid language sql as $$
  insert into public.report (reporter_user_id, reported_user_id, reason) values (who, whom, reason) returning id
$$;
create temporary table cases as
select pg_temp.report(member, 'harassment') as recent,
       pg_temp.report(member, 'other') as old,
       pg_temp.report(member, 'other') as calm,
       pg_temp.report(other, 'inappropriate') as others,
       pg_temp.report_by(member, other, 'impersonation') as counter
from folks;
grant select on cases to authenticated, service_role, anon;

select public.review_report((select recent from cases), (select operator from folks), 'warning', '판단 근거 — 화면에 안 나간다',
                            (select member from folks));
select public.review_report((select old from cases), (select operator from folks), 'warning', null, (select member from folks));
select public.review_report((select calm from cases), (select operator from folks), 'no_action', null, null);
select public.review_report((select others from cases), (select operator from folks), 'warning', null, (select other from folks));
select public.review_report((select counter from cases), (select operator from folks), 'warning', null, (select member from folks));
update public.report set reviewed_at = now() - interval '13 months' where id = (select old from cases);
update public.report set reviewed_at = now() - interval '1 month' where id = (select counter from cases);

-- ── 1. 찾는다 ────────────────────────────────────────────────────────────────

set local role authenticated;
select pg_temp.acting((select operator from folks));

select is((select user_id from public.operator_member('  om찾기 ')), (select member from folks),
  '닉네임으로 찾는다 — 대소문자 · 앞뒤 빈칸을 안 가린다');
select is((select nickname from public.operator_member((select member from folks)::text)), 'Om찾기',
  '계정 id 로도 찾는다');
select is((select count(*)::integer from public.operator_member('없는이름')), 0, '없으면 빈 결과다');
select throws_ok($$select * from public.operator_member('   ')$$, '22023', null, '빈 말로는 안 찾는다');
select is((select count(*)::integer from public.operator_member(null)), 0,
  '말 없이 부르면 운영자인가만 묻는다 — 빈 결과, 기록 없음(아래 4 의 줄 수)');

-- ── 2. 풀이권 ────────────────────────────────────────────────────────────────

select is(
  (select cardinality(order_numbers) from public.operator_member('Om찾기')),
  2,
  '승인된 주문 둘의 번호 — 주문 화면으로 가는 길');
select ok(
  (select bool_and(n ~ '^rdo_') from public.operator_member('Om찾기') m, unnest(m.order_numbers) n),
  '주문 번호는 rdo_ 로 시작한다');
select results_eq(
  $$select status, bought_credits, refunded_credits, used_bought, reserved_bought, used_all
    from public.operator_member('Om찾기')$$,
  $$values ('active'::text, 4, 1, 1, 0, 3)$$,
  '상태 · 산 4 · 걷은 1 · 산 것에서 쓴 1 · 예약 중 0(죽은 예약은 풀고 센다) · 쓴 것 전체 3');

-- ── 3. 경고 이력 ─────────────────────────────────────────────────────────────

select results_eq(
  format($$select report_id, review_outcome, warning_category, counted
           from public.operator_member_warnings(%L)$$, (select member from folks)),
  format($$values (%L::uuid, 'warning'::text, 'harassment'::text, true),
                  (%L::uuid, 'warning'::text, 'impersonation'::text, true),
                  (%L::uuid, 'warning'::text, 'other'::text, false)$$,
         (select recent from cases), (select counter from cases), (select old from cases)),
  '제 경고만 최근 것부터 — 신고한 쪽으로 받은 경고도 서고, 조치 없음 · 남의 경고는 없고, 13개월 전 경고는 셈에 안 든다');
select ok(
  (select bool_and(warning_ref ~ '^W-') from public.operator_member_warnings((select member from folks))),
  '줄마다 안내번호가 있다');

-- ── 4. 접속기록 ──────────────────────────────────────────────────────────────

reset role;
select results_eq(
  $$select action, target, filter, outcome from pg_temp.lines((select operator from folks))
    where action like 'members.%'$$,
  format($$values ('members.find'::text, null::uuid, %L::text, 'allowed'::text),
                  ('members.find', null, %L, 'allowed'),
                  ('members.find', null, 'by=nickname user=none', 'allowed'),
                  ('members.find', null, %L, 'allowed'),
                  ('members.find', null, %L, 'allowed'),
                  ('members.find', null, %L, 'allowed'),
                  ('members.warnings', null, %L, 'allowed'),
                  ('members.warnings', null, %L, 'allowed')$$,
         'by=nickname user=' || (select member from folks),
         'by=id user=' || (select member from folks),
         'by=nickname user=' || (select member from folks),
         'by=nickname user=' || (select member from folks),
         'by=nickname user=' || (select member from folks),
         'user=' || (select member from folks),
         'user=' || (select member from folks)),
  '문마다 한 줄 — 무엇으로 찾았나와 찾은 계정 id 만');
select is(
  (select count(*)::integer from audit.operator_access a
   where to_jsonb(a)::text ~* '(om찾기|없는이름|om-|@example|판단 근거)'),
  0,
  '기록에 찾은 닉네임 · 이메일 · 판단 근거가 없다');

-- ── 5. 거절 ──────────────────────────────────────────────────────────────────

set local role authenticated;
select pg_temp.acting((select stranger from folks));

select throws_ok($$select * from public.operator_member('Om찾기')$$, '42501', null, '운영자가 아니면 찾기는 던진다');
select throws_ok($$select * from public.operator_member(null)$$, '42501', null, '말 없이 불러도 던진다 — 화면이 404 가 된다');
select throws_ok(format($$select * from public.operator_member_warnings(%L)$$, (select member from folks)),
  '42501', null, '경고 이력도');
select is((select count(*)::integer from pg_temp.lines((select stranger from folks))), 0,
  '던진 문 안에서는 아무것도 안 남는다 — 되감긴다');
select lives_ok($$select public.note_operator_denial('members.find')$$, '거절은 따로 부르는 문이 적는다');
select lives_ok($$select public.note_operator_denial('members.warnings')$$, '두 동작을 다 받는다');
select results_eq(
  $$select action, outcome from pg_temp.lines((select stranger from folks))$$,
  $$values ('members.find'::text, 'denied'::text), ('members.warnings', 'denied')$$,
  '거절한 줄이 동작 · 거절로 남는다');
select lives_ok($$select public.note_operator_denial('survey.overview')$$, '앞서 받던 동작은 그대로 받는다');

-- ── 6. 모양 ──────────────────────────────────────────────────────────────────

reset role;
create temporary table member_doors as
select p.oid, p.proname::text as name, p.provolatile
from pg_proc p join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public' and p.proname in ('operator_member', 'operator_member_warnings');

select is(
  (select coalesce(array_agg(name order by name), '{}') from member_doors where provolatile <> 'v'),
  '{}'::text[],
  '둘 다 volatile — stable 이면 적지 못한다');
select is(
  (select coalesce(array_agg(name order by name), '{}') from member_doors
   where not has_function_privilege('authenticated', oid, 'EXECUTE')
      or has_function_privilege('anon', oid, 'EXECUTE')
      or has_function_privilege('service_role', oid, 'EXECUTE')),
  '{}'::text[],
  '둘 다 로그인한 사람에게만 열려 있다');
select is(
  (select coalesce(array_agg(a order by a), '{}')
   from member_doors d, unnest(
     (select p.proargnames from pg_proc p where p.oid = d.oid)) a
   where a ~ '(email|note|reporter|birth)'),
  '{}'::text[],
  '반환형에 이메일 · 판단 근거 · 신고한 사람 · 출생 칸이 없다');
select is((select count(*)::integer from member_doors), 2, '문은 둘이다');

select * from finish();
rollback;
