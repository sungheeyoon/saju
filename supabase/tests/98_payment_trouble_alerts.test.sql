-- 결제 이상이 운영자에게 간다 (`20261213090000`, G-110 ④)
--
-- 여기서 재는 것 넷.
--
--   1. **결제 이상의 문은 열쇠에만 열린다** — `anon` · `authenticated` 는 못 부른다
--   2. **받는 것은 종류 · 결제 번호 · 짧은 까닭뿐이고 모양이 틀리면 던진다**
--   3. **결제 하나 · 종류 하나에 하루 한 줄이다** — 같은 결제의 재전송은 한 줄, 다른 결제는 같은 날에도 따로
--   4. **적는 것은 머리말 · 결제 번호 · 까닭 · 런북의 절이다**
--
-- 세는 것은 이 파일이 지은 결제 번호의 줄뿐이다.
begin;
select plan(12);

-- ── 1. 누가 부르나 ─────────────────────────────────────────────────────────────

select ok(
  has_function_privilege('service_role', 'public.report_payment_trouble(text, text, text)', 'execute'),
  '열쇠는 결제 이상을 알릴 수 있다');

select ok(
  not has_function_privilege('authenticated', 'public.report_payment_trouble(text, text, text)', 'execute')
  and not has_function_privilege('anon', 'public.report_payment_trouble(text, text, text)', 'execute'),
  '로그인한 사람 · 익명은 못 부른다 — 알림함을 채울 수 없다');

-- ── 2. 받는 모양 ──────────────────────────────────────────────────────────────

select throws_ok(
  $$select public.report_payment_trouble('refund-failed', 'rdo_95aa', 'x')$$,
  '22023', null,
  '종류는 셋 중 하나다');

select throws_ok(
  $$select public.report_payment_trouble('webhook-failed', 'rdo 95; drop', 'x')$$,
  '22023', null,
  '결제 번호는 짧은 토큰이다');

select throws_ok(
  $$select public.report_payment_trouble('webhook-failed', 'rdo_95bb', '홍길동 hong@example.com')$$,
  '22023', null,
  '까닭은 ASCII 한 줄이다 — 한글 이름이 들 자리가 없다');

select throws_ok(
  $$select public.report_payment_trouble('webhook-failed', 'rdo_95bb', repeat('x', 201))$$,
  '22023', null,
  '까닭은 200자 안이다');

-- ── 3. 하루 한 줄 · 결제마다 ───────────────────────────────────────────────────

select ok(
  public.report_payment_trouble('amount-mismatch', 'rdo_95aaaaaaaaaaaaaaaaaaaaaaaaaaaaaa', 'approve refused - amount differs (paid 100)'),
  '결제 번호 · 종류 · 까닭으로 한 줄을 적는다');

select ok(
  not public.report_payment_trouble('amount-mismatch', 'rdo_95aaaaaaaaaaaaaaaaaaaaaaaaaaaaaa', 'approve refused - amount differs (paid 100)'),
  '같은 날 같은 결제 · 종류는 두 번 안 적는다 — PortOne 의 재전송은 한 줄이다');

select ok(
  public.report_payment_trouble('amount-mismatch', 'rdo_95bbbbbbbbbbbbbbbbbbbbbbbbbbbbbb', 'approve refused - amount differs (paid 200)'),
  '다른 결제의 이상은 같은 날에도 따로 온다');

select ok(
  public.report_payment_trouble('webhook-failed', null, 'unreadable body'),
  '결제 번호를 못 읽었어도 적는다');

-- ── 4. 적는 것 ────────────────────────────────────────────────────────────────

select is(
  (select detail from public.ops_alert
   where kind = 'payment-amount-mismatch:rdo_95aaaaaaaaaaaaaaaaaaaaaaaaaaaaaa'),
  '결제 금액이 주문과 달라 묶음을 세우지 않았다 — 결제 rdo_95aaaaaaaaaaaaaaaaaaaaaaaaaaaaaa · approve refused - amount differs (paid 100). 런북 credits.md 「결제 이상 알림」',
  '머리말 · 결제 번호 · 까닭 · 런북의 절');

select is(
  (select detail from public.ops_alert where kind = 'payment-webhook-failed:-'
     and day = (now() at time zone 'Asia/Seoul')::date),
  '결제 알림을 처리하지 못했다 — 결제 번호 없음 · unreadable body. 런북 credits.md 「결제 이상 알림」',
  '번호가 없으면 「번호 없음」이다');

select * from finish();
rollback;
