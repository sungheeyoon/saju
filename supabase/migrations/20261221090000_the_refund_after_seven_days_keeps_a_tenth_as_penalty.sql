-- 산 날부터 7일이 지난 뒤의 「안 쓴 몫 환불」은 산식의 금액에서 10% 를 위약금으로 뺀다 (ADR 0192, 운영자 결정 2026-10-20)
--
-- ADR 0148 의 「7일 안이든 뒤든 같은 금액」을 바꾼다. 셈은 여전히 DB 가 확보할 때 정한다(`operator_hold_reading_refund`, ADR 0184) —
-- 몸은 `20261211090000` 그대로이고 금액 한 줄만 다르다:
--
--     owed = ⌊결제액 × (걷은 회차 + 이번 회차) ÷ 산 회차⌋
--            − ⌊결제액 × 위약금 회차 ÷ (산 회차 × 10)⌋
--            − 이미 돌려준 금액
--
-- 「위약금 회차」는 그 주문에서 「안 쓴 몫 환불」(`unused`)로 이미 걷은 회차의 합에, 이번이 그 사유면 이번 회차를 더한 것이다. 두 버림
-- 모두 **누적 값**에 한 번씩만 하므로 나눠 돌려줘도 한 번에 돌려줄 때와 합이 같고, 위약금이 두 번 빠지거나 덜 빠지지 않는다. 돌려준
-- 합은 결제액을 넘지 않는다. 위약금의 버림은 이용자 쪽으로 기운다.
--
-- **위약금을 떼는 사유는 `unused` 하나다.** 7일 안의 청약철회(`withdrawal`, 전자상거래법 제18조⑨) · 중복 결제(`duplicate`) · 미제공
-- (`failure`) · 그 밖(`other` — 심사 결제 · 이용 정지 · 해지 · 서비스 종료)은 떼지 않는다. **7일 안인지는 DB 가 세지 않는다** — 약관
-- 제15조①의 기점(결제 내용을 알리는 전자우편 또는 화면을 받은 날)은 코드에 없고, 운영자가 사유를 고르며 가린다. 표 · 사유 목록 ·
-- 서명은 그대로다.
--
-- 운영자 셈(`operator_reading_refund_basis`)에 칸 하나(`penalized_credits` — 그 주문에서 `unused` 로 걷은 회차의 합)를 끝에 더한다 —
-- 화면이 확보 전에 같은 금액을 미리 셈한다(`src/lib/reading/bundle.ts` 의 `refundBreakdown`). 반환 칸만 느는 확장이라 지우고 다시
-- 짓는다 — 옛 앱은 더한 칸을 무시한다. 옛 앱이 이 DB 에 붙은 동안은 「안 쓴 몫 환불」의 미리 보인 금액이 DB 셈과 달라 확보가
-- 거절된다(`22023` — 「환불 금액이 …원으로 바뀌었습니다」) — 잘못된 금액이 적히지는 않는다.
--
-- 재는 자리는 `supabase/tests/99_refund_penalty.test.sql` 이다.

-- ---------------------------------------------------------------------------
-- 1. 운영자 셈 — 위약금을 뗀 회차의 합을 함께 낸다
-- ---------------------------------------------------------------------------

/**
 * 주문 하나를 들고 그 계정의 주문 전부를 묶음별로 — 몸은 `20261211090000` 그대로다. 칸 하나를 끝에 더했다: `penalized_credits` — 그
 * 주문에서 「안 쓴 몫 환불」(`unused`)로 이미 걷은 회차의 합. 다음 환불의 누적 위약금이 이것을 센다(ADR 0192).
 */
drop function public.operator_reading_refund_basis(uuid);

create function public.operator_reading_refund_basis(p_order_id uuid)
returns table (
  order_id uuid,
  asked boolean,
  status text,
  provider text,
  provider_order_id text,
  provider_payment_id text,
  amount integer,
  currency text,
  refunded_amount integer,
  ordered_at timestamptz,
  approved_at timestamptz,
  credits integer,
  refunded_credits integer,
  used integer,
  reserved integer,
  unused integer,
  first_used_at timestamptz,
  last_used_at timestamptz,
  owner_nickname text,
  owner_ref text,
  penalized_credits integer
)
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  owner uuid;
begin
  if not public.is_operator() then
    raise exception '운영자만 읽는 자리입니다.' using errcode = '42501';
  end if;

  perform audit.note_app_access('credits.refund_basis', null, format('order=%s', p_order_id), 'allowed');

  select o.user_id into owner from public.reading_order o where o.id = p_order_id;

  if owner is null then
    return;
  end if;

  perform public.settle_reading_credit_uses(owner);

  return query
  select
    o.id,
    o.id = p_order_id,
    o.status,
    o.provider,
    o.provider_order_id,
    o.provider_payment_id,
    o.amount,
    o.currency,
    o.refunded_amount,
    o.created_at,
    o.approved_at,
    b.credits,
    b.refunded_credits,
    coalesce(u.used, 0),
    coalesce(u.reserved, 0),
    case when b.id is null then null
         else b.credits - b.refunded_credits - coalesce(u.used, 0) - coalesce(u.reserved, 0)
              - public.reading_bundle_held(b.id) end,
    u.first_at,
    u.last_at,
    (select a.nickname from public.app_user a where a.id = o.user_id),
    left(o.user_id::text, 8),
    coalesce((select sum(f.credits) from public.reading_order_refund f
              where f.order_id = o.id and f.reason = 'unused'), 0)::integer
  from public.reading_order o
  left join public.reading_bundle b on b.order_id = o.id
  left join lateral (
    select count(*) filter (where x.state = 'confirmed')::integer as used,
           count(*) filter (where x.state = 'reserved')::integer as reserved,
           min(x.reserved_at) as first_at,
           max(x.reserved_at) as last_at
    from public.reading_credit_use x
    where x.bundle_id = b.id and x.state <> 'released'
  ) u on true
  where o.user_id = owner
  order by o.approved_at nulls last, o.created_at, o.id;
end;
$$;

revoke execute on function public.operator_reading_refund_basis(uuid) from public, anon, authenticated, service_role;
grant execute on function public.operator_reading_refund_basis(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- 2. 확보 — 금액에 누적 위약금을 뺀다
-- ---------------------------------------------------------------------------

/**
 * 환불을 준비한다 — 돌려줄 회차를 잠그고 금액을 확정해 진행 중으로 둔다. 걷는 회차는 하나 이상이고 그 묶음의 안 쓴 것
 * (예약 중 · 다른 확보는 빼고)을 넘지 못한다. 사람 자물쇠 안에서 잠그므로 풀이 시작과 나란히 와도 한쪽만 그 회차를 갖는다.
 * 사유가 「안 쓴 몫 환불」(`unused`)이면 금액에서 10% 위약금을 누적으로 뺀다(ADR 0192) — 몸은 `20261211090000` 그대로다.
 */
create or replace function public.operator_hold_reading_refund(
  p_order_id uuid, p_credits integer, p_reason text, p_expected_amount integer, p_request_id uuid)
returns table (hold_id uuid, credits integer, amount integer)
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  o public.reading_order;
  b public.reading_bundle;
  taken integer;
  free integer;
  owed integer;
  penalized integer;
  made uuid;
  earlier record;
begin
  if not public.is_operator() then
    raise exception '운영자만 쓰는 자리입니다.' using errcode = '42501';
  end if;

  perform audit.note_app_access('credits.refund_hold', null, format('order=%s', p_order_id), 'allowed');

  if p_reason is null or p_reason not in ('withdrawal', 'unused', 'duplicate', 'failure', 'other') then
    raise exception '환불 사유를 골라 주세요.' using errcode = '22023';
  end if;

  select * into o from public.reading_order where id = p_order_id for update;
  if not found then
    raise exception '주문을 찾지 못했습니다.' using errcode = 'no_data_found';
  end if;

  if p_request_id is null then
    raise exception '요청 번호가 없습니다. 화면을 새로 열어 주세요.' using errcode = '22023';
  end if;

  -- 같은 요청의 재시도 — 주문 자물쇠 뒤에 찾는다(나란히 온 재시도는 첫째의 커밋 뒤에 본다). 같은 확보를 돌려준다
  select h.id, h.order_id, h.credits, h.amount, h.reason into earlier
  from public.reading_refund_hold h where h.request_id = p_request_id;
  if found then
    if earlier.order_id <> o.id or earlier.credits <> p_credits or earlier.reason <> p_reason then
      raise exception '이 요청 번호는 다른 환불 준비에 쓰였습니다. 화면을 새로 열어 주세요.' using errcode = '22023';
    end if;
    hold_id := earlier.id;
    credits := earlier.credits;
    amount := earlier.amount;
    return next;
    return;
  end if;

  if o.status not in ('approved', 'partially_refunded') then
    raise exception '환불할 수 없는 상태의 주문입니다.' using errcode = '55000';
  end if;

  if exists (select 1 from public.reading_refund_hold h where h.order_id = o.id and h.state = 'held') then
    raise exception '이 주문에는 진행 중인 환불이 있습니다.' using errcode = '55000';
  end if;

  perform pg_advisory_xact_lock(hashtext('reading:user:' || o.user_id::text));
  perform public.settle_reading_credit_uses(o.user_id);

  select * into b from public.reading_bundle where order_id = o.id for update;

  select count(*)::integer into taken
  from public.reading_credit_use u
  where u.bundle_id = b.id and u.state <> 'released';

  free := b.credits - b.refunded_credits - taken;

  if p_credits is null or p_credits < 1 or p_credits > free then
    raise exception '걷을 수 있는 회차는 %장입니다.', free using errcode = '22023';
  end if;

  -- 위약금을 뗀 회차의 누적 — 이번이 「안 쓴 몫 환불」이면 이번 회차도 든다(ADR 0192)
  select coalesce(sum(f.credits), 0)::integer into penalized
  from public.reading_order_refund f
  where f.order_id = o.id and f.reason = 'unused';
  if p_reason = 'unused' then
    penalized := penalized + p_credits;
  end if;

  -- 두 버림 모두 누적 값에 한 번씩 — 나눠 돌려줘도 위약금이 두 번 빠지거나 덜 빠지지 않는다(앱의 `refundBreakdown` 과 같은 식)
  owed := floor(o.amount::numeric * (b.refunded_credits + p_credits) / b.credits)::integer
          - floor(o.amount::numeric * penalized / (b.credits * 10))::integer
          - o.refunded_amount;

  if owed <= 0 then
    raise exception '돌려줄 금액이 없습니다.' using errcode = '22023';
  end if;

  -- 확인창에 보인 금액과 지금의 셈이 다르면 적지 않는다 — 그 사이 다른 환불이 끼었거나 화면이 낡았다
  if p_expected_amount is distinct from owed then
    raise exception '환불 금액이 %원으로 바뀌었습니다. 새로 읽고 다시 확인해 주세요.', owed using errcode = '22023';
  end if;

  insert into public.reading_refund_hold (
    order_id, bundle_id, user_id, provider_order_id, provider_payment_id, paid_amount, remaining_amount,
    credits, amount, reason, request_id, held_by)
  values (
    o.id, b.id, o.user_id, o.provider_order_id, o.provider_payment_id, o.amount, o.amount - o.refunded_amount - owed,
    p_credits, owed, p_reason, p_request_id, (select auth.uid()))
  returning id into made;

  hold_id := made;
  credits := p_credits;
  amount := owed;
  return next;
end;
$$;
