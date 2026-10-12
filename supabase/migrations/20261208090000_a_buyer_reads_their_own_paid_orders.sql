-- 산 사람은 제 결제 내역을 다시 본다 — 본인 주문만 (G-21, ADR 0174)
--
-- 결제 내역 화면(`/me/credits/history`)이 묶음마다 주문 번호 · 상품 · 금액 · 결제 시각 · 남은 회차 · 상태를 보인다. 전자상거래법
-- 제13조② 의 계약내용을 산 사람이 다시 볼 자리이고, 환불을 신청할 때 알려 줄 주문 번호가 여기 선다(리디 「충전내역」의 꼴).
--
-- 문 하나만 더한다 — `my_reading_orders()`. 표(`reading_order` · `reading_bundle` · `reading_credit_use`)는 여전히 밖에서 못 읽는다.
-- 내주는 칸은 운영자 환불 셈(`operator_reading_refund_basis`)의 부분집합이고 **부른 사람의 것만**이다. 거래 번호 · 멱등 열쇠 ·
-- 쓴 때는 내지 않는다 — 산 사람이 환불을 신청할 때 드는 것은 주문 번호다. 로그인 이메일 같은 새 개인정보는 없다(ADR 0106 결정 11).
--
-- 승인된 적 있는 주문(묶음이 선 것)만 낸다 — 대기 · 결제 전에 닫힌 주문은 거래가 아니다(ADR 0106 결정 10 과 같은 선).
--
-- 남은 회차 = 산 수 − 걷은 수 − 쓴 것 − **아직 살아 있는** 예약. 운영자 셈은 읽기 전에 `settle_reading_credit_uses` 로 죽은
-- 예약(유효시간을 넘긴 시도 · 기한이 지난 요청)을 풀어 적지만, 이 문은 로그인한 사람의 읽기라 쓰지 않는다(`stable` — 쓰기를
-- 품으면 `75_suspended_write_doors` 의 쓰기 문이 된다). 대신 그 함수와 같은 물음으로 죽은 예약을 세지 않는다 — 둘이 갈리면
-- 운영자 셈이 맞고, 이 수는 화면의 안내다.

create function public.my_reading_orders()
returns table (
  provider_order_id text,
  bundle_credits integer,
  amount integer,
  refunded_amount integer,
  status text,
  paid_at timestamptz,
  remaining integer
)
language sql
stable
security definer
set search_path = ''
as $$
  select
    o.provider_order_id,
    o.bundle_credits,
    o.amount,
    o.refunded_amount,
    o.status,
    o.approved_at,
    b.credits - b.refunded_credits - (
      select count(*)::integer
      from public.reading_credit_use x
      where x.bundle_id = b.id
        and (x.state = 'confirmed'
             or (x.state = 'reserved'
                 and (exists (
                        select 1 from public.reading_run r
                        where r.id = x.run_id
                          and r.status = 'running'
                          and r.created_at > now() - public.reading_run_timeout())
                      or exists (
                        select 1 from public.match_request q
                        where x.run_id is null
                          and q.id = x.request_id
                          and q.status = 'pending'
                          and q.expires_at > now())))))
  from public.reading_order o
  join public.reading_bundle b on b.order_id = o.id
  where o.user_id = (select auth.uid())
  order by o.approved_at desc, o.created_at desc, o.id
$$;

comment on function public.my_reading_orders() is
  '부른 사람의 결제 내역 — 승인된 적 있는 주문마다 주문 번호 · 회차 · 금액 · 환불한 금액 · 상태 · 결제 시각 · 남은 회차 (ADR 0174).';

revoke execute on function public.my_reading_orders() from public, anon, authenticated, service_role;
grant execute on function public.my_reading_orders() to authenticated;
