-- 운영자가 회원 상세에서 그 사람이 지금 쓸 수 있는 풀이권을 **이용자 본인 화면과 같은 셈**으로 보고, 그 아래 출처별 장부를 본다
-- (G-110 ③ 의 다음, 운영자 2026-10-17)
--
-- `operator_member`(`20261212090000`)는 묶음과 쓰임 장부의 수만 냈다 — 산 회차 · 걷은 회차 · 산 것에서 쓴 것 · 예약 중 · 전체 쓴
-- 것. 운영자는 「이 사람이 지금 몇 장 쓸 수 있나」를 그 수로 셈해야 했고, 그 셈은 이용자 화면의 잔액과 갈릴 수 있다.
--
-- ## 잔액은 본인 화면의 셈 그대로 — 한 함수를 둘이 부른다
--
-- 본인 화면의 잔액(`my_reading_credits`)은 `reading_credit_limit_for(나) − reading_credits_used(나)` 다(ADR 0021 · 0043). 그 몸을
-- 사람을 받는 안쪽 함수 `reading_credits_for(p_user)` 로 옮기고, `my_reading_credits` 는 그것을 `auth.uid()` 로 부르기만 한다.
-- `operator_member` 는 같은 함수를 찾은 계정으로 부른다 — 운영자가 보는 잔액과 이용자가 보는 잔액이 갈릴 자리가 없다.
-- 안쪽 함수는 아무에게도 안 연다(`reading_credits_used` 와 같은 이유 — 열면 남의 잔액을 세는 문이 된다).
--
-- ## 출처별은 장부다 — 잔액과 합이 다를 수 있다
--
-- 출처 셋(가입 무료 `free` · 운영 지급 `grant` · 유료 구매 `bundle`)마다 받은 수 · 사용(확정) · 남은 수, 그리고 예약 중 · 환불 확보
-- 중의 수를 쓰임 장부(`reading_credit_use`)와 묶음 · 확보에서 센다. 남은 수는 `pick_reading_credit_share` 가 보는 빈자리 그대로다
-- (받은 − 확정 − 예약, 묶음은 걷은 것 · 확보 중인 것도 뺀다). **풀이 대상을 지우면 셈은 자리를 돌려주지만 장부의 확정 줄은
-- 남는다**(ADR 0106) — 그래서 출처별 남은 수의 합이 잔액보다 작을 수 있다. 화면은 잔액을 크게, 출처별을 장부로 적는다.
--
-- ## 접속기록 — 늘지 않는다
--
-- 새 칸은 `members.find` 한 줄 안에서 읽는다. 기록 표의 동작 목록 · 거절 문은 그대로다.
--
-- ## 반환 칸만 는다
--
-- 칸이 늘면 Postgres 가 되쓰기를 거절해 떨어뜨리고 다시 세운다. 앞 칸은 이름 · 뜻 그대로 두어, 이것이 먼저 올라가도 지금 앱이
-- 그대로 읽는다(`docs/ops/runbook/deploy.md` 「규약 넷」의 3).
--
-- 재는 자리는 `supabase/tests/99_operator_member_balance.test.sql`.

-- ---------------------------------------------------------------------------
-- 1. 잔액을 세는 자리 — 사람을 받는 안쪽 함수 하나
-- ---------------------------------------------------------------------------

/**
 * 한 사람의 풀이권 — 한도 · 쓴 것 · 도는 것 · 답을 기다리는 요청 · 쓸 수 있는 것. 몸은 `my_reading_credits`
 * (`20260912090000`) 그대로이고, `auth.uid()` 자리에 인자를 받는다. 본인 화면과 운영자 회원 화면이 이것 하나를 지난다.
 */
create function public.reading_credits_for(p_user uuid)
returns table (credit_limit integer, used integer, reserved integer, requested integer, available integer)
language sql
stable
security definer
set search_path = ''
as $$
  select
    public.reading_credit_limit_for(p_user),
    c.used,
    c.reserved,
    c.requested,
    greatest(0, public.reading_credit_limit_for(p_user) - c.used - c.reserved - c.requested)
  from public.reading_credits_used(p_user) c;
$$;

revoke execute on function public.reading_credits_for(uuid) from anon, public, authenticated, service_role;

create or replace function public.my_reading_credits()
returns table (credit_limit integer, used integer, reserved integer, requested integer, available integer)
language sql
stable
security definer
set search_path = ''
as $$
  select * from public.reading_credits_for((select auth.uid()));
$$;

-- ---------------------------------------------------------------------------
-- 2. 회원 한 명 — 앞 칸 그대로, 잔액과 출처별 장부를 더한다
-- ---------------------------------------------------------------------------

drop function public.operator_member(text);

/**
 * 닉네임이나 계정 id 로 회원 한 명을 찾는다 (G-110 ③). 없으면 빈 결과다 — 없는 것도 한 줄로 적힌다. `null` 이면 운영자인가만
 * 묻고 빈 결과다(적지 않는다) — 찾는 말 없이 연 화면이 거절을 받아 404 가 되게.
 *
 * - `available` — 지금 쓸 수 있는 풀이권. 본인 화면과 같은 셈(`reading_credits_for`)
 * - `free_credits` · `free_used` · `free_left` — 가입 무료 몫 · 그 몫의 확정 쓰임 · 장부의 빈자리
 * - `granted_credits` · `granted_used` · `granted_left` — 운영 지급 몫(`reading_credit_grant.extra`) · 확정 쓰임 · 빈자리
 * - `bought_credits` · `refunded_credits` · `used_bought` · `reserved_bought` · `bundle_left` — 묶음의 산 수 합 · 걷은 수 합 ·
 *   확정 쓰임 · 예약 중 · 빈자리(묶음마다 산 − 걷은 − 확보 중 − 살아 있는 쓰임)
 * - `reserved_all` — 몫을 가리지 않은 예약 중(도는 풀이 · 답을 기다리는 요청)
 * - `held_credits` — 진행 중인 환불 확보가 잡은 수
 * - `used_all` · `outside_used` — 몫을 가리지 않은 확정 쓰임 · 그중 몫 밖(지운 대상으로 돌아온 자리로 쓴 것)
 * - `order_numbers` — 승인된 적 있는 주문의 번호(`rdo_…`), 최근 것부터
 *
 * 세기 전에 셈이 이미 풀어 준 예약을 장부에서도 푼다(`settle_reading_credit_uses`) — 환불 셈과 같다.
 */
create function public.operator_member(p_query text default null)
returns table (
  user_id uuid,
  nickname text,
  status text,
  bought_credits integer,
  refunded_credits integer,
  used_bought integer,
  reserved_bought integer,
  used_all integer,
  order_numbers text[],
  available integer,
  free_credits integer,
  free_used integer,
  free_left integer,
  granted_credits integer,
  granted_used integer,
  granted_left integer,
  bundle_left integer,
  reserved_all integer,
  held_credits integer,
  outside_used integer
)
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  q constant text := btrim(p_query);
  by_id constant boolean := q ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$';
  found uuid;
begin
  if not public.is_operator() then
    raise exception '운영자만 읽는 자리입니다.' using errcode = '42501';
  end if;

  -- 찾는 말이 없으면 묻기만 한다 — 화면이 처음 열릴 때 운영자인가를 이것으로 안다(거절당하면 404). 읽은 것이 없어 안 적는다
  if q is null then
    return;
  end if;

  if length(q) not between 1 and 64 then
    raise exception 'operator: query must be 1 to 64 characters' using errcode = '22023';
  end if;

  if by_id then
    select a.id into found from public.app_user a where a.id = q::uuid;
  else
    select a.id into found from public.app_user a where public.nickname_key(a.nickname) = public.nickname_key(q);
  end if;

  perform audit.note_app_access(
    'members.find',
    null,
    format('by=%s user=%s', case when by_id then 'id' else 'nickname' end, coalesce(found::text, 'none')),
    'allowed');

  if found is null then
    return;
  end if;

  perform public.settle_reading_credit_uses(found);

  return query
  with uses as (
    select
      count(*) filter (where u.share = 'free' and u.state = 'confirmed')::integer as free_used,
      count(*) filter (where u.share = 'free' and u.state = 'reserved')::integer as free_reserved,
      count(*) filter (where u.share = 'grant' and u.state = 'confirmed')::integer as granted_used,
      count(*) filter (where u.share = 'grant' and u.state = 'reserved')::integer as granted_reserved,
      count(*) filter (where u.share = 'bundle' and u.state = 'confirmed')::integer as used_bought,
      count(*) filter (where u.share = 'bundle' and u.state = 'reserved')::integer as reserved_bought,
      count(*) filter (where u.state = 'reserved')::integer as reserved_all,
      count(*) filter (where u.state = 'confirmed')::integer as used_all,
      count(*) filter (where u.share = 'outside' and u.state = 'confirmed')::integer as outside_used
    from public.reading_credit_use u
    where u.user_id = found
  ),
  bundles as (
    select
      coalesce(sum(b.credits), 0)::integer as bought,
      coalesce(sum(b.refunded_credits), 0)::integer as refunded,
      coalesce(sum(public.reading_bundle_held(b.id)), 0)::integer as held,
      coalesce(sum(greatest(0, b.credits - b.refunded_credits - public.reading_bundle_held(b.id) - (
        select count(*) from public.reading_credit_use u
        where u.bundle_id = b.id and u.state <> 'released'))), 0)::integer as left_over
    from public.reading_bundle b
    where b.user_id = found
  )
  select
    a.id,
    a.nickname,
    a.status,
    bundles.bought,
    bundles.refunded,
    uses.used_bought,
    uses.reserved_bought,
    uses.used_all,
    (select coalesce(array_agg(o.provider_order_id order by o.approved_at desc, o.id), '{}')
     from public.reading_order o where o.user_id = a.id and o.approved_at is not null),
    balance.available,
    shares.free_credits,
    uses.free_used,
    greatest(0, shares.free_credits - uses.free_used - uses.free_reserved),
    shares.granted_credits,
    uses.granted_used,
    greatest(0, shares.granted_credits - uses.granted_used - uses.granted_reserved),
    bundles.left_over,
    uses.reserved_all,
    bundles.held,
    uses.outside_used
  from public.app_user a
  cross join uses
  cross join bundles
  cross join public.reading_credit_shares(found) shares
  cross join public.reading_credits_for(found) balance
  where a.id = found;
end;
$$;

revoke execute on function public.operator_member(text) from anon, public, service_role;
grant execute on function public.operator_member(text) to authenticated;
