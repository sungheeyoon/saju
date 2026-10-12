-- 카드사 심사 계정은 판매가 닫힌 채로도 주문을 연다 (G-21, ADR 0171)
--
-- 운영자 결정(2026-10-12): 카드사 심사 때 결제창은 심사 계정에게만 연다. 판매는 변호사 검토 뒤(G-21) 그대로 닫혀 있다 —
-- `reading_sale_is_open()` 은 false 그대로이고 이 마이그레이션은 그 한 줄을 건드리지 않는다.
--
-- 심사 계정은 **자료**로 가린다(ADR 0043 의 규율). 예외 표(`reading_credit_grant`)는 쓰지 않는다 — 그 표가 답하는 물음은
-- 「이 사람에게 풀이권을 몇 개 더 주는가」 하나이고, 「누가 판매 전에 살 수 있나」를 거기 얹으면 몫이 없는 심사 계정에
-- 행을 둘 자리가 없다(`extra > 0`). 운영자 깃발도 안 세운다 — 이 표가 답하는 것도 하나다: **이 사람은 판매가 닫힌 동안에도
-- 주문을 열 수 있는가.** 운영자가 SQL 로 넣고(`docs/ops/runbook/credits.md` 「심사 계정」), 앱에는 이 표에 닿는 길이 없다.
--
-- 바뀌는 문은 하나다 — `open_reading_order` 의 스위치 판정이 `reading_sale_is_open_for(부른 사람)` 을 지난다. 그 밖의
-- 판정(로그인 · 활성 계정 · 가격표 · 같은 열쇠)과 본문은 `20261013090000` 의 정의를 그대로 받아 적었다. 승인 · 취소 · 환불은
-- 그대로 서버만이고, 심사 계정이 산 묶음도 승인 웹훅(`app/api/portone/webhook/`)이 세운다 — 다른 길은 없다.
--
-- 앱이 묻는 문 둘을 더한다(둘 다 stable · 부른 사람의 것만):
--   my_reading_sale_is_open()  — 상품 화면이 「결제하기」를 세울지
--   my_reading_order(id)       — 결제 뒤 화면이 그 주문의 상태(대기 · 승인 …)를 말할지

create table public.reading_sale_reviewer (
  user_id uuid primary key references public.app_user (id) on delete cascade,
  /** 누구이고 왜 넣었나 — 「○○카드 심사 2026-10」 처럼. 걷을 때 이 메모로 찾는다 */
  note text not null check (length(note) between 1 and 200),
  added_at timestamptz not null default now()
);

comment on table public.reading_sale_reviewer is
  '판매가 닫힌 동안에도 주문을 열 수 있는 계정 — 카드사 심사 계정. 운영자가 SQL 로 넣고 심사가 끝나면 걷는다 (ADR 0171).';

alter table public.reading_sale_reviewer enable row level security;

-- 정책을 하나도 안 만든다. 어느 API 역할에도 안 연다 — 이 표를 읽는 것은 아래 definer 함수뿐이다.
revoke all on public.reading_sale_reviewer from anon, authenticated, service_role;

/**
 * 이 사람에게 판매가 열렸는가 — 판매 스위치가 켜졌거나, 심사 계정이거나. 주문을 여는 문과 화면이 같은 판정을 지난다 —
 * 둘이 따로 물으면 「단추는 섰는데 누르면 거절」이 난다(ADR 0043 이 한도에서 막은 자리와 같다).
 */
create function public.reading_sale_is_open_for(p_user uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select public.reading_sale_is_open()
      or exists (select 1 from public.reading_sale_reviewer r where r.user_id = p_user)
$$;

revoke execute on function public.reading_sale_is_open_for(uuid) from public, anon, authenticated, service_role;

/** 부른 사람에게 판매가 열렸는가 — 상품 화면이 「결제하기」를 세울지. 로그인 안 했으면 거짓 */
create function public.my_reading_sale_is_open()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select (select auth.uid()) is not null and public.reading_sale_is_open_for((select auth.uid()))
$$;

revoke execute on function public.my_reading_sale_is_open() from public, anon, authenticated, service_role;
grant execute on function public.my_reading_sale_is_open() to authenticated;

/**
 * 부른 사람의 주문 하나 — 상태 · 산 회차 · 금액. 남의 주문이나 없는 주문은 빈 결과다(있는지조차 말하지 않는다).
 * 주문 표는 여전히 밖에서 못 읽는다 — 이 문이 내주는 세 칸만 보인다.
 */
create function public.my_reading_order(p_order_id uuid)
returns table (status text, bundle_credits integer, amount integer)
language sql
stable
security definer
set search_path = ''
as $$
  select o.status, o.bundle_credits, o.amount
  from public.reading_order o
  where o.id = p_order_id and o.user_id = (select auth.uid())
$$;

revoke execute on function public.my_reading_order(uuid) from public, anon, authenticated, service_role;
grant execute on function public.my_reading_order(uuid) to authenticated;

-- 본문은 `20261013090000` 의 정의 그대로 — 스위치 판정 한 줄만 `reading_sale_is_open_for(actor)` 로 바꿨다.
-- 판정의 차례(로그인 → 판매 → 활성 계정)도 그대로다: 심사 계정이 아닌 정지 계정은 여전히 「판매가 닫혔다」를 받는다.
create or replace function public.open_reading_order(p_bundle_credits integer, p_provider text, p_idempotency_key text)
returns table (order_id uuid, provider_order_id text, amount integer)
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  actor uuid := (select auth.uid());
  opened public.reading_order;
begin
  if actor is null then
    raise exception 'reading_order: sign in first' using errcode = '28000';
  end if;

  if not public.reading_sale_is_open_for(actor) then
    raise exception 'reading_order: the sale is closed' using errcode = '55000';
  end if;

  if not public.is_active_account() then
    raise exception 'reading_order: the account is not active' using errcode = '42501';
  end if;

  if public.reading_bundle_price(p_bundle_credits) is null then
    raise exception 'reading_order: no such bundle' using errcode = '22023';
  end if;

  insert into public.reading_order (
    id, user_id, bundle_credits, amount, provider, provider_order_id, idempotency_key)
  select g.id, actor, p_bundle_credits, public.reading_bundle_price(p_bundle_credits), p_provider,
         'rdo_' || replace(g.id::text, '-', ''), p_idempotency_key
  from (select gen_random_uuid() as id) g
  on conflict (user_id, idempotency_key) do nothing
  returning * into opened;

  if not found then
    select * into opened from public.reading_order o
    where o.user_id = actor and o.idempotency_key = p_idempotency_key;
  end if;

  if opened.bundle_credits <> p_bundle_credits or opened.provider <> p_provider then
    raise exception 'reading_order: the idempotency key belongs to another order' using errcode = '22023';
  end if;

  return query select opened.id, opened.provider_order_id, opened.amount;
end;
$$;
