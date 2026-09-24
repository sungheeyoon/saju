-- 결제 알림 · 환불의 재시도는 같은 요청일 때만 인정되고, CLI 질의 하나의 결과는 나란히 적어도 한 줄이다 (ADR 0105 · 0106 정정)
--
-- 2026-09-24 리뷰가 찾은 DB 결함 둘. 이 마이그레이션 전에 pgTAP `51_payment_event_retry` 20 중 9 가, 흐름
-- `scripts/check-db-races.mjs` 의 5 가 붉었고(아래 각 절의 「전」), 뒤에 전부 초록이다.
--
-- ## 1. 같은 알림 번호는 같은 요청일 때만 재시도다 (ADR 0106)
--
-- `approve_reading_order` 는 `payment_event (provider, provider_event_id)` 가 부딪히면 **그 줄의 결과만** 돌려줬다
-- (`20261013090000`). 주문 A 에서 `applied` 된 알림 번호로 주문 B 를 부르면 B 는 묶음이 없는데 `applied` 를 받았다.
-- 전: pgTAP 에서 다른 주문 · 다른 금액 · 다른 거래 번호 · 다른 종류가 모두 「던지지 않음」.
--
-- **부딪힌 줄의 주문 · 종류 · 금액이 이번 요청과 모두 같을 때만 재시도로 인정한다.** 승인된(`applied`) 알림이면 주문의
-- 거래 번호도 견준다 — `payment_event` 는 거래 번호를 안 들지만, 승인된 알림이 남았다는 것은 그 주문이 그 거래
-- 번호로 승인됐다는 뜻이다(다른 번호면 `55000` 으로 던져 알림까지 되감긴다). 거절된 알림은 주문이 거래 번호를 안
-- 들었으니 견줄 것이 없다. 하나라도 다르면 `22023` 으로 던진다.
--
-- **던져도 잃는 것이 없다.** #206 이 금액 거절을 「던지지 않고 돌려준다」로 바꾼 것은 그 부름이 **새 알림**이라 남길
-- 줄이 있었기 때문이다. 여기서 부딪힌 알림 번호에는 이미 처음의 줄이 있고, 같은 번호로 두 번째 줄을 적을 자리가
-- 없다(유일 제약이 그 줄이다). 이 부름이 적은 것은 아무것도 없다 — `on conflict do nothing` 이 아무것도 안 넣었고
-- 주문의 `for update` 는 되감겨도 된다. 그러니 이것은 결제의 결과(`refused`)가 아니라 **부르는 쪽의 잘못**이고, 웹훅
-- (G-23 ⑥)이 오류를 로그에 남긴다.
--
-- 다른 주문의 같은 번호가 나란히 오면 `on conflict` 가 앞 쪽의 커밋을 기다린 뒤 부딪히므로, 늦은 쪽은 다음 문장의
-- 새 스냅샷(read committed)으로 커밋된 줄을 읽는다.
--
-- ## 1'. 환불도 같은 모양이었다 (ADR 0106)
--
-- `refund_reading_order` 는 같은 주문에 같은 제공자 환불 번호가 있으면 금액 · 회차를 안 보고 주문의 상태를 돌려줬다
-- — 4300 원 환불을 8600 원으로 다시 부르면 「적혔다」가 돌아왔다. 전: pgTAP 에서 다른 금액 · 회차 · 사유가 「던지지
-- 않음」. **금액 · 회차 · 사유가 모두 같을 때만 재시도로 인정하고**, 다르면 `22023`. 이 문도 첫 환불의 줄이 남아 있어
-- 던져도 잃는 것이 없다. 환불 번호의 유일성은 `(order_id, provider_refund_id)` 라 다른 주문의 같은 번호는 부딪힘이
-- 아니다 — 제공자가 번호를 주문 사이에 겹쳐 쓰는지는 PG 가 정해지면 본다(G-23 ⑥).
--
-- `cancel_reading_order` 는 같은 모양이 아니다 — 알림 번호가 없고, 대기가 아니면 지금 상태를 돌려줄 뿐 받은 사유를
-- 무엇으로도 인정하지 않는다. 그대로 둔다.
--
-- ## 2. CLI 질의 하나의 결과는 한 줄 — 유일 인덱스가 든다 (ADR 0105)
--
-- `operator_access_result_of` 는 일반 인덱스였고 `audit.note_cli_result` 는 「있나 본 뒤 넣기」였다
-- (`20261014090000`). 두 세션이 같은 질의의 결과를 나란히 적으면 둘 다 「없다」를 보고 두 줄을 적었다. 전: 흐름
-- 검사 5 에서 결과 2줄 · 뒤 세션이 안 기다림(106ms) · 다른 결과도 거절 안 됨.
--
-- **`result_of is not null` 부분 유일 인덱스로 바꾸고 `insert … on conflict do nothing` 뒤 다시 읽는다.** 늦은 쪽은
-- 앞 쪽의 커밋을 기다렸다가 부딪힌다. 그 줄이 **같은 결과**(성공/실패 · 분류)면 그 줄의 번호를 돌려준다 — 응답을
-- 잃고 다시 적는 CLI 가 실패하지 않는다. 다르면 전처럼 `23505` 로 거절한다. 운영 DB 에 같은 `result_of` 가 둘인 줄이
-- 없는 것은 올리기 전에 건수로 확인했다 — 있으면 유일 인덱스가 서지 않아 이 마이그레이션이 통째로 선다.
--
-- 본문은 로컬의 살아 있는 정의에서 받아 적고 고친 줄만 바꿨다(ADR 0043 의 규율). 반환형 · 인자는 그대로라
-- `create or replace` 로 다시 짓는다 — 부여한 권한이 그대로 남는다.

-- ── 1. 승인 알림의 재시도 ──────────────────────────────────────────────────────

/**
 * 결제를 승인으로 적고 묶음을 세운다 — **서버만**(`service_role`). 금액이 주문과 다르면 **거절을 돌려준다** —
 * 던지지 않으므로 알림(`p_event_id`)의 거절 기록이 남는다. 같은 알림이나 같은 거래 번호로 두 번 와도 묶음은
 * 하나이고, 같은 알림에는 처음의 결과가 돌아간다. **같은 알림 번호를 다른 주문 · 금액 · 종류 · 거래 번호로 부르면
 * 재시도가 아니다** — `22023`(`20261015090000`).
 *
 * @returns 한 줄 — `applied` 와 묶음 id, 또는 `refused` 와 null
 */
create or replace function public.approve_reading_order(
  p_order_id uuid, p_provider_payment_id text, p_amount integer, p_event_id text default null)
returns table (outcome text, bundle_id uuid)
language plpgsql
volatile
security definer
set search_path = ''
as $$
#variable_conflict use_column
declare
  o public.reading_order;
  earlier public.payment_event;
begin
  select * into o from public.reading_order r where r.id = p_order_id for update;

  if not found then
    raise exception 'reading_order: no such order' using errcode = 'no_data_found';
  end if;

  if p_event_id is not null then
    insert into public.payment_event (provider, provider_event_id, order_id, kind, amount, outcome)
    values (o.provider, p_event_id, o.id, 'approved', p_amount,
            case when p_amount = o.amount then 'applied' else 'refused' end)
    on conflict (provider, provider_event_id) do nothing;

    if not found then
      select * into earlier from public.payment_event e
      where e.provider = o.provider and e.provider_event_id = p_event_id;

      -- 같은 요청의 재시도만 — 다른 주문 · 종류 · 금액, 승인된 알림이면 다른 거래 번호는 거절한다
      if earlier.order_id is distinct from o.id
         or earlier.kind <> 'approved'
         or earlier.amount is distinct from p_amount
         or (earlier.outcome = 'applied' and o.provider_payment_id is distinct from p_provider_payment_id) then
        raise exception 'payment_event: the event id belongs to another request' using errcode = '22023';
      end if;

      outcome := earlier.outcome;
      if earlier.outcome = 'applied' then
        select b.id into bundle_id from public.reading_bundle b where b.order_id = o.id;
      end if;
      return next;
      return;
    end if;
  end if;

  if p_amount is distinct from o.amount then
    outcome := 'refused';
    return next;
    return;
  end if;

  if o.status <> 'pending' then
    if o.provider_payment_id = p_provider_payment_id then
      outcome := 'applied';
      select b.id into bundle_id from public.reading_bundle b where b.order_id = o.id;
      return next;
      return;
    end if;
    raise exception 'reading_order: the order is already %', o.status using errcode = '55000';
  end if;

  perform pg_advisory_xact_lock(hashtext('reading:user:' || o.user_id::text));

  update public.reading_order r
  set status = 'approved', approved_at = now(), provider_payment_id = p_provider_payment_id
  where r.id = o.id;

  insert into public.reading_bundle (order_id, user_id, credits, price, currency, acquired_at)
  values (o.id, o.user_id, o.bundle_credits, o.amount, o.currency, now())
  returning id into bundle_id;

  outcome := 'applied';
  return next;
end;
$$;

-- ── 1'. 환불의 재시도 ──────────────────────────────────────────────────────────

/**
 * 환불을 적는다 — 서버만. **산식은 없다**(G-25 ⑥): 금액과 걷을 회차는 사람이 `operator_reading_refund_basis`
 * 를 읽고 정한다. 걷는 회차는 그 묶음의 **안 쓴** 것을 넘지 못한다 — 예약 중인 것은 풀릴 때까지 안 쓴 것이
 * 아니다(G-21 ③). 제공자 환불 번호가 같으면 한 번만 적힌다 — **금액 · 회차 · 사유까지 같을 때만**, 다르면
 * `22023`(`20261015090000`).
 *
 * @returns 주문의 새 상태
 */
create or replace function public.refund_reading_order(
  p_order_id uuid, p_amount integer, p_credits integer, p_reason text,
  p_provider_refund_id text default null)
returns text
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  o public.reading_order;
  b public.reading_bundle;
  earlier public.reading_order_refund;
  taken integer;
begin
  select * into o from public.reading_order where id = p_order_id for update;

  if not found then
    raise exception 'reading_order: no such order' using errcode = 'no_data_found';
  end if;

  if p_provider_refund_id is not null then
    select * into earlier from public.reading_order_refund f
    where f.order_id = o.id and f.provider_refund_id = p_provider_refund_id;

    if found then
      -- 같은 요청의 재시도만 — 다른 금액 · 회차 · 사유는 거절한다
      if earlier.amount is distinct from p_amount
         or earlier.credits is distinct from p_credits
         or earlier.reason is distinct from p_reason then
        raise exception 'reading_order: the refund id belongs to another refund' using errcode = '22023';
      end if;
      return o.status;
    end if;
  end if;

  if o.status not in ('approved', 'partially_refunded') then
    raise exception 'reading_order: a % order is not refunded', o.status using errcode = '55000';
  end if;

  if p_amount is null or p_amount <= 0 or o.refunded_amount + p_amount > o.amount then
    raise exception 'reading_order: the refund exceeds what was paid' using errcode = '22023';
  end if;

  perform pg_advisory_xact_lock(hashtext('reading:user:' || o.user_id::text));
  perform public.settle_reading_credit_uses(o.user_id);

  select * into b from public.reading_bundle where order_id = o.id for update;

  select count(*)::integer into taken
  from public.reading_credit_use u
  where u.bundle_id = b.id and u.state <> 'released';

  if p_credits is null or p_credits < 0 or p_credits > b.credits - b.refunded_credits - taken then
    raise exception 'reading_order: only unused credits are taken back (% left)',
      b.credits - b.refunded_credits - taken using errcode = '22023';
  end if;

  insert into public.reading_order_refund (order_id, amount, credits, reason, provider_refund_id)
  values (o.id, p_amount, p_credits, p_reason, p_provider_refund_id);

  update public.reading_bundle set refunded_credits = refunded_credits + p_credits where id = b.id;

  update public.reading_order
  set refunded_amount = refunded_amount + p_amount,
      last_refunded_at = now(),
      status = case when refunded_amount + p_amount = amount then 'refunded' else 'partially_refunded' end
  where id = o.id
  returning status into o.status;

  return o.status;
end;
$$;

-- ── 2. CLI 결과 한 줄 ──────────────────────────────────────────────────────────

drop index audit.operator_access_result_of;
create unique index operator_access_result_of on audit.operator_access (result_of) where result_of is not null;

/**
 * CLI 가 SQL 을 보낸 **뒤에** 결과 한 줄을 더한다 — `scripts/db-remote.mjs` 가 같은 잠금 안에서 부른다.
 * 앞 줄의 실행자 · 목적 · 해시를 그대로 옮겨 적는다 — 결과 줄만 보고도 무엇의 결과인지 안다. 같은 줄의 결과는
 * 한 번만 — 나란히 적어도 유일 인덱스가 한 줄로 세운다. 같은 결과를 다시 적으면 그 줄의 번호를, 다른 결과면
 * `23505`(`20261015090000`).
 *
 * @returns 적은(또는 이미 적힌 같은) 줄의 번호
 */
create or replace function audit.note_cli_result(p_query_id bigint, p_result text, p_error_class text default null)
returns bigint
language plpgsql
set search_path = ''
as $$
declare
  q audit.operator_access;
  class text := case when p_result = 'failed' then coalesce(p_error_class, 'unknown') end;
  written bigint;
  earlier audit.operator_access;
begin
  select * into q from audit.operator_access a where a.id = p_query_id and a.action = 'cli.query';
  if not found then
    raise exception 'audit: no such cli query %', p_query_id using errcode = 'no_data_found';
  end if;

  insert into audit.operator_access
    (channel, actor_name, action, purpose, sql_sha256, outcome, result_of, result, error_class)
  values ('cli', q.actor_name, 'cli.result', q.purpose, q.sql_sha256, 'allowed', q.id, p_result, class)
  on conflict (result_of) where result_of is not null do nothing
  returning id into written;

  if written is not null then
    return written;
  end if;

  select * into earlier from audit.operator_access a where a.result_of = p_query_id;
  if earlier.result is distinct from p_result or earlier.error_class is distinct from class then
    raise exception 'audit: the result of % is already written', p_query_id using errcode = '23505';
  end if;

  return earlier.id;
end;
$$;
