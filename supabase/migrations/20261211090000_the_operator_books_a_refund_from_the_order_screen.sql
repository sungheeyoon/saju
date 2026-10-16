-- 운영자가 주문 화면(`/ops/orders`)에서 환불을 장부에 적는다 (G-110 ②, ADR 0184)
--
-- 환불을 적는 문(`refund_reading_order`)은 서버 열쇠만 불렀다 — 운영자는 break-glass 로 운영 SQL 을 열어 금액을 손으로 셈해
-- 넣었다. 이 마이그레이션은 운영자가 로그인한 채 부르는 쓰기 문 하나를 더한다: `operator_refund_reading_order`.
--
-- ## 금액은 DB 가 다시 셈한다
--
-- 산식은 ADR 0148 이다 — `결제액 × (이미 걷은 회차 + 이번에 걷을 회차) ÷ 산 회차`(원 미만 버림)에서 이미 돌려준 금액을 뺀다.
-- 화면은 같은 산식(`src/lib/reading/bundle.ts` 의 `refundOwed`)으로 셈해 보이고, 운영자가 본 그 금액을 함께 보낸다. 문은 같은
-- 산식으로 다시 셈해 **둘이 같을 때만** 적는다 — 화면을 연 뒤 다른 환불이 끼었거나 두 산식이 갈리면 적지 않고 거절한다.
--
-- ## PG 취소는 부르지 않는다
--
-- 돈은 운영자가 PortOne 콘솔에서 먼저 돌려주고, 그 취소 번호를 들고 와 적는다(런북 「수동 환불」의 차례 그대로). 그래서 취소
-- 번호는 빠질 수 없다 — 같은 번호로 다시 누르면 한 번만 적힌다(`refund_reading_order` 의 재시도 규칙, `20261015090000`).
--
-- ## 접속기록
--
-- 적을 때마다 동작 `credits.refund` 한 줄(거른 조건 칸에 주문 id 만)이 같은 트랜잭션에 남는다 — 거절되면 줄도 되감긴다.
-- 운영자가 아니면 `42501` 이고, 앱의 문이 `note_operator_denial('credits.refund')` 로 따로 적는다.

-- ---------------------------------------------------------------------------
-- 1. 기록 표와 거절 문이 새 동작을 받는다 — 목록은 `20261116090000` 의 것에 `credits.refund` 하나를 더했다
-- ---------------------------------------------------------------------------

alter table audit.operator_access drop constraint operator_access_action_check;
alter table audit.operator_access add constraint operator_access_action_check
  check (action in ('reports.list', 'reports.detail', 'reports.snapshot', 'credits.refund_basis', 'credits.refund',
                    'audit.export_status',
                    'survey.overview', 'survey.by_version', 'survey.tags', 'survey.comments',
                    'survey.service_overview', 'survey.service_counts', 'survey.service_texts',
                    'cli.query', 'cli.result'));

create or replace function public.note_operator_denial(p_action text, p_report_id uuid default null)
returns void
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  actor uuid := (select auth.uid());
begin
  if actor is null or public.is_operator() then
    return;
  end if;

  if p_action is null
     or p_action not in ('reports.list', 'reports.detail', 'reports.snapshot', 'credits.refund_basis', 'credits.refund',
                         'survey.overview', 'survey.by_version', 'survey.tags', 'survey.comments',
                         'survey.service_overview', 'survey.service_counts', 'survey.service_texts') then
    raise exception 'operator: unknown action' using errcode = '22023';
  end if;

  -- 세기 전에 그 사람의 줄을 세운다 — 나란히 온 두 번째는 첫째의 커밋 뒤에 센다
  perform pg_advisory_xact_lock(hashtextextended('audit:denial:' || actor::text, 0));

  if (select count(*) from audit.operator_access a
      where a.actor_user_id = actor and a.outcome = 'denied'
        and a.at > clock_timestamp() - interval '1 hour') >= 30 then
    return;
  end if;

  perform audit.note_app_access(p_action, p_report_id, null, 'denied');
end;
$$;

-- ---------------------------------------------------------------------------
-- 2. 운영자가 환불을 적는 문
-- ---------------------------------------------------------------------------

/**
 * 운영자가 주문 하나의 안 쓴 유료 회차를 걷고 그 금액을 장부에 적는다 — PG 에서 돌려준 **뒤에**.
 *
 * 금액은 받지만 믿지 않는다: ADR 0148 의 누적 산식으로 다시 셈해 같을 때만 `refund_reading_order` 에 맡긴다. 걷는 회차는
 * 하나 이상이고 그 묶음의 안 쓴 것(예약 중은 빼고)을 넘지 못한다. 같은 취소 번호가 이미 적혔으면 회차 · 사유가 같을 때만
 * 재시도로 보고 지금 상태를 돌려준다 — 그때 금액은 처음 적힌 것이다.
 *
 * @returns 주문의 새 상태(`partially_refunded` · `refunded`)
 */
create function public.operator_refund_reading_order(
  p_order_id uuid, p_credits integer, p_amount integer, p_reason text, p_provider_refund_id text)
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
  owed integer;
begin
  if not public.is_operator() then
    raise exception '운영자만 쓰는 자리입니다.' using errcode = '42501';
  end if;

  perform audit.note_app_access('credits.refund', null, format('order=%s', p_order_id), 'allowed');

  if p_provider_refund_id is null or length(btrim(p_provider_refund_id)) = 0 then
    raise exception 'PG 취소 번호를 적어 주세요.' using errcode = '22023';
  end if;

  select * into o from public.reading_order where id = p_order_id for update;
  if not found then
    raise exception '주문을 찾지 못했습니다.' using errcode = 'no_data_found';
  end if;

  select * into earlier from public.reading_order_refund f
  where f.order_id = o.id and f.provider_refund_id = p_provider_refund_id;
  if found then
    if earlier.credits is distinct from p_credits or earlier.reason is distinct from p_reason then
      raise exception '이 PG 취소 번호는 다른 환불에 이미 적혔습니다.' using errcode = '22023';
    end if;
    return o.status;
  end if;

  if o.status not in ('approved', 'partially_refunded') then
    raise exception '환불할 수 없는 상태의 주문입니다.' using errcode = '55000';
  end if;

  perform pg_advisory_xact_lock(hashtext('reading:user:' || o.user_id::text));
  perform public.settle_reading_credit_uses(o.user_id);

  select * into b from public.reading_bundle where order_id = o.id for update;

  select count(*)::integer into taken
  from public.reading_credit_use u
  where u.bundle_id = b.id and u.state <> 'released';

  if p_credits is null or p_credits < 1 or p_credits > b.credits - b.refunded_credits - taken then
    raise exception '걷을 수 있는 회차는 %장입니다.', b.credits - b.refunded_credits - taken using errcode = '22023';
  end if;

  owed := floor(o.amount::numeric * (b.refunded_credits + p_credits) / b.credits)::integer - o.refunded_amount;

  if p_amount is distinct from owed then
    raise exception '환불 금액이 %원으로 바뀌었습니다. 새로 읽고 다시 확인해 주세요.', owed using errcode = '22023';
  end if;

  return public.refund_reading_order(o.id, owed, p_credits, p_reason, p_provider_refund_id);
end;
$$;

comment on function public.operator_refund_reading_order(uuid, integer, integer, text, text) is
  '운영자가 PG 에서 돌려준 뒤 환불을 장부에 적는다 — 금액은 ADR 0148 산식으로 다시 셈해 같을 때만 (G-110 ②, ADR 0184).';

revoke execute on function public.operator_refund_reading_order(uuid, integer, integer, text, text)
  from public, anon, authenticated, service_role;
grant execute on function public.operator_refund_reading_order(uuid, integer, integer, text, text) to authenticated;
