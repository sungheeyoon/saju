-- 떠난 사람의 승인된 적 없는 주문도 거절한 알림이 있으면 5년 따로 남는다 — 거래를 가리킬 최소 칸만 (ADR 0106 추기)
--
-- `20261013090000` 이 금액이 다른 승인 알림을 `payment_event(outcome = 'refused')` 로 남기게 했지만, 떠날 때
-- `retention.keep_payments_of_leaver` 는 **승인된 적 있는** 주문만 옮겼다. 승인 전에 거절만 받은 주문의 알림은 계정과
-- 함께 cascade 로 사라졌다 — G-23 ⑥ 의 「남은 물음」. 운영자가 2026-09-24 에 정했다: 금액이 틀린 결제도 돈이 오간
-- 거래일 수 있으니 **옮긴다, 최소 식별정보만.** 법적 범위(전자상거래법 시행령 제6조의 거래기록에 드는가, 칸을 줄여
-- 두는 것이 맞는가)는 변호사 검토 B-8 이다. 전: pgTAP `54_refused_payment_retention` 13 중 9 붉음.
--
-- ## 새 표 하나 — `reading_payment` 에 섞지 않는다
--
-- `retention.reading_payment` 는 승인된 거래의 모양이라 거래 번호 · 승인 시각 · 묶음이 `not null` 이다. 거기에 넣으려면 그
-- 제약을 풀어야 하고, 그러면 승인된 줄의 약속도 함께 느슨해진다. 그래서 같은 결(고치지 못함 · 보류 두 칸 · 만료 인덱스 ·
-- API 역할 셋에 닫힘)의 표를 따로 세운다. 두 표는 주문 하나를 나눠 들지 않는다 — 승인된 적 있는 주문은 거절 알림까지
-- `reading_payment` 로, 승인된 적 없는 주문은 거절 알림이 하나라도 있을 때만 이 표로 간다. 알림 없이 닫힌 주문은 전처럼
-- 안 옮긴다(결제가 시작되지 않은 주문이다).
--
-- ## 칸 — 거래를 가리킬 최소
--
-- 둔다: 내부 주문 번호 · 계정 내부 번호 · 제공자 · 가맹점 주문 번호(PG 에서 그 결제 시도를 되짚는 열쇠) · 주문 금액(받은
-- 금액과 견줘 왜 거절했는지를 말한다) · 주문 시각, 그리고 거절 알림마다 알림 번호 · 종류 · 받은 금액 · 받은 시각 · 결과.
-- 계정 내부 번호는 `reading_payment` 도 드는 값이다 — 같은 사람의 승인된 결제와 잇는 데만 쓴다(거절 뒤 다시 낸 결제가
-- 중복결제로 다퉈질 때). **안 둔다:** 로그인 이메일(ADR 0106 결정 11) · 주문 열쇠(`idempotency_key`) · 묶음 회차 ·
-- 통화 · 상태 · 닫힌 사유 · 거래 번호(승인 전이라 없다). 칸이 늘면 pgTAP 이 붉다.
--
-- ## 기한 — 마지막 거절 알림부터 5년
--
-- ADR 0106 은 「마지막 결제 사건(승인 · 환불)부터 5년」이다. 승인 · 환불이 없는 주문의 마지막 결제 사건은 마지막으로 받은
-- 거절 알림이다. 지우는 것은 전과 같은 크론 `payment-retention-purge` 가 부르는 `retention.purge_expired_payments()` 하나가
-- 두 표를 함께 지운다 — 크론 줄은 그대로다. 돌려주는 수는 두 표에서 지운 합이다.
--
-- 두 함수의 본문은 로컬의 살아 있는 정의(= `20261011090000`)에서 받아 적고 더한 줄만 바꿨다(ADR 0043 의 규율).

-- ── 표 ──────────────────────────────────────────────────────────────────────────

/**
 * 떠난 사람의 승인된 적 없는 주문 — 거절한 알림이 있을 때만. 계정에 FK 로 매지 않는다(떠난 뒤에 서는 기록이다).
 */
create table retention.refused_reading_payment (
  order_id uuid primary key,
  user_id uuid not null,
  provider text not null,
  /** 제공자에게 건넨 가맹점 주문 번호 — PG 에서 그 결제 시도를 되짚는다 */
  provider_order_id text not null,
  /** 주문 금액 — 알림이 가져온 금액과 견준다 */
  amount integer not null,
  ordered_at timestamptz not null,
  /** 거절 알림 — 번호 · 종류 · 받은 금액 · 받은 시각 · 결과, 받은 차례 */
  events jsonb not null,
  left_at timestamptz not null default now(),
  /** 지울 때 — 마지막 거절 알림 + 5년 */
  keep_until timestamptz not null,
  /** 보존 보류 — 분쟁 · 수사기관의 적법한 요청이 걸렸다. 사유가 끝나면 비운다 */
  hold_reason text check (hold_reason is null or length(btrim(hold_reason)) between 1 and 500),
  held_at timestamptz,
  constraint hold_has_a_time check ((hold_reason is null) = (held_at is null)),
  constraint events_are_a_list check (jsonb_typeof(events) = 'array' and jsonb_array_length(events) > 0)
);

comment on table retention.refused_reading_payment is
  '떠난 사람의 승인된 적 없는 주문의 거절 알림 — 최소 칸, 마지막 알림부터 5년 뒤 크론이 지운다. 앱은 못 읽는다 (G-23 ⑥, ADR 0106 추기)';

create index retention_refused_payment_expiry on retention.refused_reading_payment (keep_until)
  where hold_reason is null;

alter table retention.refused_reading_payment enable row level security;
revoke all on retention.refused_reading_payment from public, anon, authenticated, service_role;

/** 옮긴 기록은 고치지 못한다 — 보류 두 칸만. 판단은 `reading_payment` 의 것과 같다 */
create trigger retained_refusal_is_immutable
before update on retention.refused_reading_payment
for each row execute function retention.refuse_payment_update();

-- ── 떠날 때 옮기는 문 ───────────────────────────────────────────────────────────

/** 떠나기 **전에** 그 사람의 결제를 옮긴다 — `auth.users` 의 `before delete`(ADR 0098 과 같은 자리) */
create or replace function retention.keep_payments_of_leaver()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform public.settle_reading_credit_uses(old.id);

  insert into retention.reading_payment (
    order_id, user_id, provider, provider_order_id, provider_payment_id, bundle_credits, amount, currency,
    status, refunded_amount, ordered_at, approved_at, last_refunded_at, bundle, refunds, events, keep_until)
  select
    o.id, o.user_id, o.provider, o.provider_order_id, o.provider_payment_id, o.bundle_credits, o.amount,
    o.currency, o.status, o.refunded_amount, o.created_at, o.approved_at, o.last_refunded_at,
    jsonb_build_object(
      'credits', b.credits,
      'price', b.price,
      'acquired_at', b.acquired_at,
      'refunded_credits', b.refunded_credits,
      'uses', coalesce((
        select jsonb_agg(jsonb_build_object(
                 'source', u.source, 'state', u.state, 'reserved_at', u.reserved_at,
                 'confirmed_at', u.confirmed_at, 'released_at', u.released_at)
               order by u.id)
        from public.reading_credit_use u where u.bundle_id = b.id), '[]'::jsonb)),
    coalesce((
      select jsonb_agg(jsonb_build_object(
               'amount', f.amount, 'credits', f.credits, 'reason', f.reason,
               'provider_refund_id', f.provider_refund_id, 'refunded_at', f.refunded_at)
             order by f.refunded_at, f.id)
      from public.reading_order_refund f where f.order_id = o.id), '[]'::jsonb),
    coalesce((
      select jsonb_agg(jsonb_build_object(
               'provider_event_id', e.provider_event_id, 'kind', e.kind, 'amount', e.amount,
               'received_at', e.received_at, 'outcome', e.outcome)
             order by e.id)
      from public.payment_event e where e.order_id = o.id), '[]'::jsonb),
    greatest(o.approved_at, coalesce(o.last_refunded_at, o.approved_at)) + retention.payment_period()
  from public.reading_order o
  join public.reading_bundle b on b.order_id = o.id
  where o.user_id = old.id and o.approved_at is not null
  on conflict (order_id) do nothing;

  -- 승인된 적 없는 주문은 거절 알림이 있을 때만, 최소 칸으로 (20261018090000)
  insert into retention.refused_reading_payment (
    order_id, user_id, provider, provider_order_id, amount, ordered_at, events, keep_until)
  select
    o.id, o.user_id, o.provider, o.provider_order_id, o.amount, o.created_at,
    r.events, r.last_at + retention.payment_period()
  from public.reading_order o
  cross join lateral (
    select jsonb_agg(jsonb_build_object(
             'provider_event_id', e.provider_event_id, 'kind', e.kind, 'amount', e.amount,
             'received_at', e.received_at, 'outcome', e.outcome)
           order by e.id) as events,
           max(e.received_at) as last_at
    from public.payment_event e where e.order_id = o.id and e.outcome = 'refused'
  ) r
  where o.user_id = old.id and o.approved_at is null and r.events is not null
  on conflict (order_id) do nothing;

  return old;
end;
$$;

comment on constraint reading_order_user_id_fkey on public.reading_order is
  '떠나면 지운다 — 그 전에 auth.users 의 트리거(payments_outlive_the_leaver)가 승인된 적 있는 주문은 retention.reading_payment 로, 거절 알림만 받은 주문은 retention.refused_reading_payment 로 옮겼다 (ADR 0106)';

comment on table public.reading_order is
  '풀이권 결제 주문 — 서버만 승인한다. 떠나면 retention.reading_payment(승인된 적 있는 주문) · retention.refused_reading_payment(거절 알림만 받은 주문)로 옮긴 뒤 지운다 (G-21 ⑤, ADR 0106)';

-- ── 지우는 문 — 두 표를 함께 ────────────────────────────────────────────────────

/** 5년이 지난 줄을 지운다 — 승인된 결제와 거절 기록 두 표, 보류가 걸린 줄은 남긴다. @returns 이번에 지운 수(합) */
create or replace function retention.purge_expired_payments()
returns integer
language plpgsql
set search_path = ''
as $$
declare
  gone integer;
  gone_refused integer;
begin
  with purged as (
    delete from retention.reading_payment k
    where k.keep_until <= now() and k.hold_reason is null
    returning 1
  )
  select count(*)::integer into gone from purged;

  with purged as (
    delete from retention.refused_reading_payment k
    where k.keep_until <= now() and k.hold_reason is null
    returning 1
  )
  select count(*)::integer into gone_refused from purged;

  return gone + gone_refused;
end;
$$;

revoke execute on all functions in schema retention from public, anon, authenticated, service_role;
