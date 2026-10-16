-- 운영자 환불 — 확보 → 확정 · 준비 취소 (`20261211090000`, G-110 ②, ADR 0184)
--
-- 여기서 재는 것 여섯.
--
-- 1. **운영자만** — 산 사람 자신도 못 부르고, 그 거절이 따로 남는다(`42501`)
-- 2. **확보한 회차는 이용자가 못 쓴다** — 한도(`reading_credit_limit_for`)가 그만큼 줄고, 다음 쓰임의 몫 고르기
--    (`pick_reading_credit_share`)가 그 묶음을 건너뛰며, 서버 열쇠의 환불도 그 회차를 걷지 못한다. 풀면 돌아온다
-- 3. **금액은 확보할 때 정한다** — ADR 0148 의 누적 산식. 나눠 돌려줘도 누적으로 셈한다
-- 4. **진행 중은 주문마다 하나 · 안 쓴 것만 · 닫힌 주문 거절**
-- 5. **확정은 한 번** — 같은 취소 번호면 재시도, 다른 번호 · 빈 번호 · 준비 취소된 확보는 거절. 확정된 확보는 풀지 못한다
-- 6. **접속기록** — 진행 상태 · 확보 · 확정 · 준비 취소가 동작마다 남는다(주문 id 만)
-- 7. **손으로 푸는 준비 취소** — 서버 열쇠만, 무엇을 확인했는지 적어야 한다
-- 8. **떠나도 진행 중인 확보는 남는다** — 닫힌 확보는 걷히고, 남은 확보는 보관된 결제에 대해 확정되며(떠난 뒤의 환불 표),
--    크론이 닫힌 확보를 걷은 뒤의 재시도도 알아본다
-- 그리고 진행 중인 확보가 있으면 그 주문의 다른 환불(회차 없이 금액만이라도)은 막힌다.
--
-- 한도에서 확보를 빼지 않으면(`reading_credit_shares`) 2 의 한도 줄이, 몫 고르기에서 빼지 않으면 묶음 줄이 붉다.
begin;
select plan(52);

create or replace function pg_temp.acting(uid uuid)
returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claims', tests.claims(uid), true);
end;
$$;

create temporary table folks as
select
  tests.signup('refund-buyer@example.com') as buyer,
  tests.signup('refund-op@example.com') as op;
grant select on folks to authenticated, service_role;

insert into public.operator (user_id, note) values ((select op from folks), '시험 — 주문 화면에서 환불을 적는 사람');

-- 판매는 닫혀 있다 — 심사 계정으로 넣어 주문을 연다(ADR 0171)
insert into public.reading_sale_reviewer (user_id, note)
values ((select buyer from folks), '시험 — 운영자 환불');

set local role authenticated;
select pg_temp.acting((select buyer from folks));

create temporary table ord (label text, order_id uuid);
grant select, insert on ord to authenticated, service_role;
insert into ord select 'three', order_id from public.open_reading_order(3, 'portone', 'refund-three-0001');
insert into ord select 'one', order_id from public.open_reading_order(1, 'portone', 'refund-one-00001');
insert into ord select 'pending', order_id from public.open_reading_order(5, 'portone', 'refund-five-0001');

set local role service_role;
select is(
  (select outcome from public.approve_reading_order(
     (select order_id from ord where label = 'three'), 'tx-refund-3', 12900, 'whk-refund-3')),
  'applied',
  '준비 — 3회 주문(12,900원)이 먼저 승인된다');
select is(
  (select outcome from public.approve_reading_order(
     (select order_id from ord where label = 'one'), 'tx-refund-1', 4900, 'whk-refund-1')),
  'applied',
  '준비 — 1회 주문(4,900원)이 뒤에 승인된다');

-- 무료 몫을 다 쓰고 3회 묶음에서 하나를 쓴다 — 다음 쓰임이 묶음으로 가게. 표는 밖에서 못 쓰므로 소유자 권한으로
reset role;
-- 두 묶음이 같은 트랜잭션의 같은 시각에 섰다 — 3회 묶음을 앞으로 당겨 차례를 정한다(묶음 트리거는 걷은 회차만 받는다)
alter table public.reading_bundle disable trigger reading_bundle_moves;
update public.reading_bundle set acquired_at = acquired_at - interval '1 minute'
where order_id = (select order_id from ord where label = 'three');
alter table public.reading_bundle enable trigger reading_bundle_moves;
insert into public.reading_credit_use (user_id, share, source, state, confirmed_at)
select (select buyer from folks), 'free', 'run', 'confirmed', now()
from generate_series(1, tests.reading_credit_limit());
insert into public.reading_credit_use (user_id, share, bundle_id, source, state, confirmed_at)
select (select buyer from folks), 'bundle', b.id, 'run', 'confirmed', now()
from public.reading_bundle b where b.order_id = (select order_id from ord where label = 'three');

create temporary table seen (label text, n integer, id uuid);
grant select, insert on seen to authenticated, service_role;
insert into seen values ('limit', public.reading_credit_limit_for((select buyer from folks)), null);

-- ── 1. 운영자만 ───────────────────────────────────────────────────────────────

set local role authenticated;
select pg_temp.acting((select buyer from folks));
select throws_ok(
  format($$select * from public.operator_hold_reading_refund(%L, 1, 'unused', 4300, gen_random_uuid())$$,
         (select order_id from ord where label = 'three')),
  '42501', null, '산 사람 자신도 환불을 준비하지 못한다');
select throws_ok(
  format($$select * from public.operator_reading_refund_hold(%L)$$, (select order_id from ord where label = 'three')),
  '42501', null, '진행 상태도 운영자만 읽는다');
select lives_ok(
  $$select public.note_operator_denial('credits.refund_hold')$$,
  '앱의 문이 그 거절을 따로 적는다');

-- ── 4. 안 쓴 것만 · 닫힌 주문 거절 ─────────────────────────────────────────────

select pg_temp.acting((select op from folks));
select throws_ok(
  format($$select * from public.operator_hold_reading_refund(%L, 2, 'unused', 8000, gen_random_uuid())$$,
         (select order_id from ord where label = 'three')),
  '22023', '환불 금액이 8600원으로 바뀌었습니다. 새로 읽고 다시 확인해 주세요.',
  '확인창에 보인 금액이 지금의 셈과 다르면 잠그지 않는다');
select is(
  (select array[owner_ref, (owner_nickname is not null)::text] from public.operator_reading_refund_basis(
     (select order_id from ord where label = 'three')) where asked),
  array[left((select buyer from folks)::text, 8), 'true'],
  '주문 셈이 그 계정의 닉네임과 계정 앞 8자를 함께 낸다 — 확인창이 대상을 가른다');
select throws_ok(
  format($$select * from public.operator_hold_reading_refund(%L, 3, 'unused', 12900, gen_random_uuid())$$,
         (select order_id from ord where label = 'three')),
  '22023', '걷을 수 있는 회차는 2장입니다.', '쓴 회차는 잠그지 못한다 — 안 쓴 것은 둘이다');
select throws_ok(
  format($$select * from public.operator_hold_reading_refund(%L, 1, 'unused', 5000, gen_random_uuid())$$,
         (select order_id from ord where label = 'pending')),
  '55000', '환불할 수 없는 상태의 주문입니다.', '결제 전 주문은 환불하지 못한다');

reset role;
select is(
  (select bundle_id from public.pick_reading_credit_share((select buyer from folks))),
  (select id from public.reading_bundle where order_id = (select order_id from ord where label = 'three')),
  '확보 전 — 다음 쓰임은 먼저 산 3회 묶음의 안 쓴 자리로 간다');

-- ── 3. 확보 — 금액은 여기서 정한다 ─────────────────────────────────────────────

set local role authenticated;
select pg_temp.acting((select op from folks));
insert into seen
select 'hold-a', h.amount, h.hold_id
from public.operator_hold_reading_refund((select order_id from ord where label = 'three'), 2, 'unused', 8600, 'a0000000-0000-4000-8000-000000000001'::uuid) h;
select is((select n from seen where label = 'hold-a'), 8600, '안 쓴 둘을 잠그고 금액을 정한다 — 12,900 × 2 ÷ 3 = 8,600원');
select is(
  (select hold_id from public.operator_hold_reading_refund(
     (select order_id from ord where label = 'three'), 2, 'unused', 8600, 'a0000000-0000-4000-8000-000000000001'::uuid)),
  (select id from seen where label = 'hold-a'),
  '응답이 끊겨 같은 요청 번호로 다시 오면 같은 확보를 돌려준다');
select is(
  (select count(*)::integer from public.operator_reading_refund_hold((select order_id from ord where label = 'three'))),
  1,
  '재시도는 확보를 하나 더 짓지 않는다');
select throws_ok(
  format($$select * from public.operator_hold_reading_refund(%L, 1, 'unused', 4300, 'a0000000-0000-4000-8000-000000000001'::uuid)$$,
         (select order_id from ord where label = 'three')),
  '22023', '이 요청 번호는 다른 환불 준비에 쓰였습니다. 화면을 새로 열어 주세요.',
  '같은 요청 번호에 다른 회차는 거절한다');
select throws_ok(
  format($$select * from public.operator_hold_reading_refund(%L, 1, 'unused', 4300, gen_random_uuid())$$,
         (select order_id from ord where label = 'three')),
  '55000', '이 주문에는 진행 중인 환불이 있습니다.', '같은 주문에 진행 중인 확보는 하나뿐이다');
select is(
  (select array[credits, amount, remaining_amount]
   from public.operator_reading_refund_hold((select order_id from ord where label = 'three'))),
  array[2, 8600, 4300],
  '화면을 다시 열어도 진행 중인 확보가 선다 — 회차 · 금액 · 취소 후 잔액');

-- ── 2. 확보한 회차는 이용자가 못 쓴다 ──────────────────────────────────────────

reset role;
select is(
  public.reading_credit_limit_for((select buyer from folks)),
  (select n from seen where label = 'limit') - 2,
  '확보하면 한도가 잠근 둘만큼 준다 — 풀이 시작 · 인연 요청이 이 한도로 막힌다');
select is(
  (select bundle_id from public.pick_reading_credit_share((select buyer from folks))),
  (select id from public.reading_bundle where order_id = (select order_id from ord where label = 'one')),
  '다음 쓰임은 잠긴 3회 묶음을 건너뛰고 1회 묶음으로 간다');
set local role authenticated;
select pg_temp.acting((select buyer from folks));
select is(
  (select remaining from public.my_reading_orders() m where m.bundle_credits = 3),
  0,
  '산 사람의 결제 내역에서도 잠긴 회차는 남은 것이 아니다');

set local role service_role;
select throws_ok(
  format($$select public.refund_reading_order(%L, 4300, 1, 'unused', 'sql-refund-1')$$,
         (select order_id from ord where label = 'three')),
  '55000', null, '서버 열쇠의 환불도 잠긴 회차를 걷지 못한다');
select throws_ok(
  format($$select public.refund_reading_order(%L, 12900, 0, 'other', 'sql-refund-2')$$,
         (select order_id from ord where label = 'three')),
  '55000', null, '회차 없이 금액만 돌려주는 환불도 확보가 열린 동안은 막힌다 — 확보 금액을 먼저 쓰지 못한다');

-- ── 준비 취소 ─────────────────────────────────────────────────────────────────

set local role authenticated;
select pg_temp.acting((select op from folks));
select lives_ok(
  format($$select public.operator_release_reading_refund(%L)$$, (select id from seen where label = 'hold-a')),
  '확정 전에는 준비를 취소한다');
select is(
  (select count(*)::integer from public.operator_reading_refund_hold((select order_id from ord where label = 'three'))),
  0,
  '준비를 취소하면 진행 중인 것이 없다');
select throws_ok(
  format($$select public.operator_book_reading_refund(%L, 'pg-cancel-0')$$, (select id from seen where label = 'hold-a')),
  '55000', '준비가 취소된 환불입니다. 다시 준비해 주세요.', '준비 취소된 확보는 확정하지 못한다');

reset role;
select is(
  public.reading_credit_limit_for((select buyer from folks)),
  (select n from seen where label = 'limit'),
  '풀면 잠갔던 회차가 한도로 돌아온다');

-- ── 5. 확정은 한 번 ───────────────────────────────────────────────────────────

set local role authenticated;
select pg_temp.acting((select op from folks));
insert into seen
select 'hold-b', h.amount, h.hold_id
from public.operator_hold_reading_refund((select order_id from ord where label = 'three'), 1, 'unused', 4300, gen_random_uuid()) h;
select is((select n from seen where label = 'hold-b'), 4300, '하나를 다시 준비한다 — 12,900 × 1 ÷ 3 = 4,300원');
select throws_ok(
  format($$select public.operator_book_reading_refund(%L, '  ')$$, (select id from seen where label = 'hold-b')),
  '22023', 'PG 취소 번호를 적어 주세요.', 'PG 취소 번호 없이는 확정하지 않는다');
select is(
  public.operator_book_reading_refund((select id from seen where label = 'hold-b'), 'pg-cancel-1'),
  'partially_refunded',
  '취소 번호로 확정하면 장부에 4,300원이 적힌다');
select is(
  public.operator_book_reading_refund((select id from seen where label = 'hold-b'), 'pg-cancel-1'),
  'partially_refunded',
  '같은 취소 번호로 다시 눌러도 한 번만 적힌다');
select throws_ok(
  format($$select public.operator_book_reading_refund(%L, 'pg-cancel-9')$$, (select id from seen where label = 'hold-b')),
  '22023', '이 환불은 다른 PG 취소 번호로 이미 적혔습니다.', '확정된 확보에 다른 취소 번호는 거절한다');
select throws_ok(
  format($$select public.operator_release_reading_refund(%L)$$, (select id from seen where label = 'hold-b')),
  '55000', '이미 장부에 적힌 환불입니다.', '확정된 확보는 풀지 못한다');

-- 둘째 — 누적 산식: 12,900 × 2 ÷ 3 = 8,600 에서 이미 돌려준 4,300 을 뺀다
insert into seen
select 'hold-c', h.amount, h.hold_id
from public.operator_hold_reading_refund((select order_id from ord where label = 'three'), 1, 'withdrawal', 4300, gen_random_uuid()) h;
select is((select n from seen where label = 'hold-c'), 4300, '나눠 돌려주면 누적으로 셈한다 — 둘째도 4,300원');
select throws_ok(
  format($$select public.operator_book_reading_refund(%L, 'pg-cancel-1')$$, (select id from seen where label = 'hold-c')),
  '22023', '이 PG 취소 번호는 이 주문의 다른 환불에 이미 적혔습니다.', '앞 환불의 취소 번호로 다른 확보를 확정하지 못한다');
select is(
  public.operator_book_reading_refund((select id from seen where label = 'hold-c'), 'pg-cancel-2'),
  'partially_refunded',
  '둘째를 확정한다');

reset role;
select is(
  (select array[b.refunded_credits, o.refunded_amount,
                (select count(*)::integer from public.reading_order_refund f where f.order_id = o.id)]
   from public.reading_bundle b join public.reading_order o on o.id = b.order_id
   where o.id = (select order_id from ord where label = 'three')),
  array[2, 8600, 2],
  '3회 주문의 장부 — 걷은 둘 · 돌려준 8,600원 · 환불 줄 둘(재시도는 줄을 더하지 않았다)');

-- ── 6. 접속기록 ───────────────────────────────────────────────────────────────

select is(
  (select array_agg(a.action || ':' || n order by a.action)
   from (select action, count(*)::text as n from audit.operator_access
         where actor_user_id = (select op from folks) and outcome = 'allowed'
           and action like 'credits.refund\_%' and action <> 'credits.refund_basis'
           and filter_summary = 'order=' || (select order_id from ord where label = 'three')
         group by action) a),
  array['credits.refund_book:3', 'credits.refund_hold:4', 'credits.refund_release:1', 'credits.refund_status:3'],
  '진행 상태 · 확보 · 확정 · 준비 취소가 동작마다 남고(재시도도 한 줄) 거절된 시도는 되감긴다 — 거른 조건 칸에는 주문 id 만');
select is(
  (select count(*)::integer from audit.operator_access a
   where a.actor_user_id = (select buyer from folks) and a.action = 'credits.refund_hold' and a.outcome = 'denied'),
  1,
  '운영자가 아닌 사람의 시도는 거절 한 줄로 남는다');

-- ── 7. 손으로 푸는 준비 취소 — 서버 열쇠 · 사유 필수 ─────────────────────────────

set local role authenticated;
select pg_temp.acting((select op from folks));
insert into seen
select 'hold-one', h.amount, h.hold_id
from public.operator_hold_reading_refund((select order_id from ord where label = 'one'), 1, 'unused', 4900, gen_random_uuid()) h;

set local role service_role;
select throws_ok(
  format($$select public.release_reading_refund_by_hand(%L, '봤음')$$, (select id from seen where label = 'hold-one')),
  '22023', null, '손으로 풀 때는 무엇을 확인했는지 적어야 한다');
select lives_ok(
  format($$select public.release_reading_refund_by_hand(%L, 'PortOne 콘솔 확인 - 확보 뒤 취소 없음')$$,
         (select id from seen where label = 'hold-one')),
  '콘솔을 본 사유를 남기고 서버 열쇠로 푼다');

reset role;
select is(
  (select release_note from public.reading_refund_hold where id = (select id from seen where label = 'hold-one')),
  'by hand: PortOne 콘솔 확인 - 확보 뒤 취소 없음',
  '손으로 푼 사유가 확보 줄에 남는다');

-- ── 8. 산 사람이 떠나도 진행 중인 확보는 남고 확정된다 ─────────────────────────

create temporary table leaving as select tests.signup('refund-leaver@example.com') as leaver;
grant select on leaving to authenticated, service_role;
insert into public.reading_sale_reviewer (user_id, note) values ((select leaver from leaving), '시험 — 떠나는 사람');

set local role authenticated;
select pg_temp.acting((select leaver from leaving));
insert into ord select 'leaver', order_id from public.open_reading_order(3, 'portone', 'refund-leave-0001');

set local role service_role;
select is(
  (select outcome from public.approve_reading_order(
     (select order_id from ord where label = 'leaver'), 'tx-refund-l', 12900, 'whk-refund-l')),
  'applied',
  '준비 — 떠날 사람의 3회 주문이 승인된다');

set local role authenticated;
select pg_temp.acting((select op from folks));
insert into seen
select 'hold-l0', h.amount, h.hold_id
from public.operator_hold_reading_refund((select order_id from ord where label = 'leaver'), 1, 'unused', 4300, gen_random_uuid()) h;
select lives_ok(
  format($$select public.operator_release_reading_refund(%L)$$, (select id from seen where label = 'hold-l0')),
  '준비 — 앞의 확보 하나는 준비 취소로 닫힌다');
insert into seen
select 'hold-l', h.amount, h.hold_id
from public.operator_hold_reading_refund((select order_id from ord where label = 'leaver'), 3, 'withdrawal', 12900, gen_random_uuid()) h;
select is((select n from seen where label = 'hold-l'), 12900, '셋을 다 잠그면 결제액 전부다');

-- 떠난다 — 주문은 보관 표로 옮겨지고 지워진다
reset role;
delete from auth.users where id = (select leaver from leaving);

select is(
  (select array_agg(state order by held_at) from public.reading_refund_hold
   where order_id = (select order_id from ord where label = 'leaver')),
  array['held'],
  '떠나면 닫힌 확보는 걷히고 진행 중인 확보는 남는다');
select is(
  (select count(*)::integer from retention.reading_payment where order_id = (select order_id from ord where label = 'leaver')),
  1,
  '결제는 보관 표로 옮겨졌다');

set local role authenticated;
select pg_temp.acting((select op from folks));
select is(
  (select array[departed::text, paid_amount::text, remaining_amount::text, (provider_order_id like 'rdo\_%')::text]
   from public.operator_reading_refund_hold((select order_id from ord where label = 'leaver'))),
  array['true', '12900', '0', 'true'],
  '떠난 뒤에도 주문 번호로 진행 중인 확보가 선다 — 결제 번호 · 결제액 · 취소 후 잔액을 확보가 든다');
select is(
  public.operator_book_reading_refund((select id from seen where label = 'hold-l'), 'pg-leave-1'),
  'refunded',
  '떠난 뒤에도 확정한다 — 보관된 결제가 전액 환불이 된다');
select is(
  public.operator_book_reading_refund((select id from seen where label = 'hold-l'), 'pg-leave-1'),
  'refunded',
  '같은 취소 번호로 다시 눌러도 한 번만 적힌다');

reset role;
select is(
  (select array[count(*)::integer, sum(amount)::integer, sum(credits)::integer]
   from retention.reading_refund_after_leave where order_id = (select order_id from ord where label = 'leaver')),
  array[1, 12900, 3],
  '떠난 뒤의 확정은 떠난 뒤의 환불 표에 한 줄로 남는다');

do $$ begin perform retention.purge_expired_payments(); end $$;
select is(
  (select count(*)::integer from public.reading_refund_hold where order_id = (select order_id from ord where label = 'leaver')),
  0,
  '크론이 주문 없는 닫힌 확보를 걷는다');

set local role authenticated;
select pg_temp.acting((select op from folks));
select is(
  public.operator_book_reading_refund((select id from seen where label = 'hold-l'), 'pg-leave-1'),
  'refunded',
  '확보 줄이 걷힌 뒤의 재시도도 떠난 뒤의 환불 표로 알아본다');
select throws_ok(
  format($$select public.operator_book_reading_refund(%L, 'pg-leave-9')$$, (select id from seen where label = 'hold-l')),
  '22023', '이 환불은 다른 PG 취소 번호로 이미 적혔습니다.', '걷힌 뒤에도 다른 취소 번호는 거절한다');

select * from finish();
rollback;
