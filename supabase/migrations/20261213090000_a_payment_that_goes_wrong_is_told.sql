-- 결제가 어긋나면 운영자에게 간다 — 금액 불일치 · 돈은 들어왔는데 묶음이 없음 · 결제 알림 처리 실패 (G-110 ④)
--
-- 판매를 열기 전에 결제 이상이 장애 알림과 같은 길로 와야 한다(G-110). 지금은 결제 알림의 문(`app/api/portone/webhook`)이
-- 까닭을 Vercel 로그의 `portone webhook` 줄에만 남겨, 금액이 달라 묶음이 안 섰어도 · 이미 닫힌 주문에 돈이 또 들어왔어도 ·
-- DB 에 못 닿아 PortOne 이 다섯 번 다시 보내다 그쳐도 아무도 몰랐다. 알림 길은 이미 있다 — `notify_ops(kind, detail)` 가
-- `ops_alert` 에 `(kind, day)` 로 한 줄을 적고 Vault 의 `ops_alert_url` 로 보낸다(`20260909090000`). 그 문은 아무에게도
-- 열리지 않았고, 앱이 부를 수 있는 것은 서버 오류의 문(`report_request_error`, `20261108090000`)뿐이다. 그 모양을 따라
-- 결제 이상의 문을 하나 더 연다. **새 제공자 · 새 비용은 없다.**
--
-- - **열쇠(`service_role`)에만 연다.** 결제 알림의 문은 아무나 두드리는 주소라, 앱은 **서명이 맞은 뒤에만** 이 문을
--   부른다(`settle.ts`) — 서명이 틀리거나 설정이 없는 503 은 알리지 않는다. 그러니 알림을 일으킬 수 있는 것은 PortOne 뿐이다.
-- - **받는 것은 셋뿐이다** — 종류(셋 중 하나), 가맹점 결제 번호(`rdo_…`, 없으면 null), 까닭(문이 로그에
--   남기던 영어 한 줄, 받은 금액이 들 수 있다). 사람 · 이메일 · 계정 id 가 들 칸은 없다 — 까닭은 인쇄 가능한 ASCII
--   200자 안이다.
-- - 종류는 `payment-<종류>:<결제 번호>` — **결제 하나에 하루 한 줄**이다. PortOne 이 같은 결제를 다섯 번 다시 보내도 한 줄이고,
--   다른 결제의 이상은 같은 날에도 따로 온다(서버 오류처럼 「종류마다 하루 한 줄」이면 둘째 결제부터 묻힌다).
-- - 모양이 틀리면 던진다(`22023`) — 앱은 그 실패를 삼키고 로그에 남긴다(알림이 결제 알림의 답을 바꾸지 않는다).
--
-- 운영자가 알림을 받고 하는 일은 `docs/ops/runbook/credits.md` 「결제 이상 알림」. 재는 자리는
-- `supabase/tests/95_payment_trouble_alerts.test.sql`.

/**
 * 결제 이상 하나를 운영자에게 알린다 — 결제 번호마다 · 종류마다 하루 한 줄.
 *
 * @param p_kind `amount-mismatch`(금액이 주문과 달라 거절) · `paid-without-bundle`(PortOne 은 결제 완료인데 묶음을 세우지
 *   않았고 다시 와도 같다) · `webhook-failed`(서명은 맞았는데 처리하지 못했다 — 503 이면 PortOne 이 다시 보낸다)
 * @param p_payment_id 가맹점 결제 번호 — 글자 · 숫자 · `_-` 64자 안. 본문에서 못 읽었으면 `null`
 * @param p_reason 문이 남긴 까닭 — 인쇄 가능한 ASCII 1–200자
 * @returns 이번에 새로 적었으면 참 — 같은 날 같은 결제 · 종류는 거짓
 */
create function public.report_payment_trouble(p_kind text, p_payment_id text, p_reason text)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  headline text;
begin
  headline := case p_kind
    when 'amount-mismatch' then '결제 금액이 주문과 달라 묶음을 세우지 않았다'
    when 'paid-without-bundle' then '돈은 들어왔는데 묶음이 없다'
    when 'webhook-failed' then '결제 알림을 처리하지 못했다'
  end;

  if headline is null then
    raise exception 'payment-trouble: kind is one of amount-mismatch, paid-without-bundle, webhook-failed'
      using errcode = '22023';
  end if;

  if p_payment_id is not null and p_payment_id !~ '^[A-Za-z0-9_-]{1,64}$' then
    raise exception 'payment-trouble: payment id is a short token' using errcode = '22023';
  end if;

  if p_reason is null or p_reason !~ '^[ -~]{1,200}$' then
    raise exception 'payment-trouble: reason is one short ascii line' using errcode = '22023';
  end if;

  return public.notify_ops(
    'payment-' || p_kind || ':' || coalesce(p_payment_id, '-'),
    format('%s — 결제 %s · %s. 런북 credits.md 「결제 이상 알림」',
           headline, coalesce(p_payment_id, '번호 없음'), p_reason));
end;
$$;

revoke execute on function public.report_payment_trouble(text, text, text) from public, anon, authenticated;
grant execute on function public.report_payment_trouble(text, text, text) to service_role;
