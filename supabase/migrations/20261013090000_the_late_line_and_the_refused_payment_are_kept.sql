-- 늦게 커밋된 접속기록 줄도 반출되고, 거절된 결제 알림도 남고, 두 세션이 같은 문을 두드려도 한 번이다 (ADR 0105 · 0106 정정)
--
-- 2026-09-24 외부 리뷰가 찾은 DB 결함 넷. 넷 다 **두 세션의 차례**나 **되감기**에서 난다 — pgTAP 한 세션으로는
-- 안 보여서 로컬 스택에 psql 둘 · 셋을 띄워 재현했다(`scripts/check-db-races.mjs`). 이 마이그레이션 전에 14 중
-- 7 이 붉었고(아래 각 절의 「전」), 뒤에 14 전부 초록이다.
--
-- ## 1. 반출과 쓰기가 한 자물쇠를 나눠 쥔다 — 늦게 커밋된 낮은 번호를 건너뛰지 않는다 (ADR 0105)
--
-- `audit_export_batch` 는 「최근 10분 안의 줄 앞에서 멈춤」으로 범위의 구멍을 막았지만, 커밋 안 된 줄은 **보이지
-- 않으므로** 그 앞에서 멈출 수도 없다. 번호 5 를 받은 트랜잭션이 커밋하기 전에 6 이 커밋되고 반출되면
-- `audit_export_done` 이 커서를 6 으로 옮겨 5 는 다시 안 나간다. 전: 반출이 6 만 가져갔다(`가져간 것: late`).
--
-- **쓰는 쪽은 공유로, 반출은 배타로 같은 advisory 자물쇠를 쥔다.** 쓰는 문장은 줄마다가 아니라 **문장 트리거**
-- (`before insert … for each statement`)에서 공유 자물쇠를 잡고 커밋까지 쥔다 — 문장 트리거는 번호(identity 의
-- `nextval`)를 받기 전에 돈다. 반출은 배타 자물쇠를 잡은 **뒤에** 읽는다: 그 순간 번호를 받은 쓰기는 전부 커밋
-- 또는 되감김으로 끝났고, 그 뒤의 쓰기는 반출의 트랜잭션이 끝날 때까지 번호를 못 받는다. 그래서 반출이 본 가장
-- 큰 번호 아래에 나중에 나타날 줄이 없다. 10분 창은 걷는다 — 방금 적힌 줄도 바로 나간다.
--
-- **xid 경계(`pg_snapshot_xmin`)를 쓰지 않은 까닭.** 리뷰가 권한 길은 줄마다 쓴 트랜잭션 id(`xid8`)를 두고
-- 「xmin 보다 작은 xid 의 줄까지, 그 앞의 첫 미확정 줄 전에서 멈춤」이었다. 재 보니 **번호 차례와 xid 차례가
-- 다를 수 있어** 같은 구멍이 남는다 — T1 이 번호 5 를 받고 xid 101 을, T2 가 앞서 다른 쓰기로 xid 100 을 받은 뒤
-- 번호 6 을 받아 커밋하면, T1 이 도는 동안 xmin = 101 이라 6(xid 100)은 「확정」이고 5 는 안 보인다. 「첫 미확정
-- 줄」은 보이는 줄만 셀 수 있다. xid 로 막으려면 커서를 번호가 아니라 xid 로 옮겨야 하는데, 그러면 반출본의
-- 머리(첫/마지막 번호 · 이어지는 자리)와 `audit_export_done` 의 이어 붙이기가 모두 바뀐다. 자물쇠는 모양을 안
-- 바꾸고 구멍을 닫는다. 값은 읽는 운영자 문과 CLI 한 줄이 반출 한 번(하루 한 번, 밀리초)을 기다리는 것뿐이다.
-- 그래서 **칼럼을 더하지 않았고 기존 줄을 채울 규칙도 없다.**
--
-- 반출은 새 문장마다 새 스냅샷을 받는 `read committed` 에서만 옳다 — 스냅샷이 트랜잭션 머리에 굳는 격리에서는
-- 자물쇠를 기다린 뒤에도 옛 스냅샷을 읽는다. 그런 격리로 부르면 거절한다. PostgREST 의 기본은 `read committed` 다.
--
-- ## 2. 거절된 결제 알림은 거절을 돌려주며 남는다 (ADR 0106)
--
-- `approve_reading_order` 는 금액이 다르면 `payment_event(outcome = 'refused')` 를 넣은 뒤 바로 던졌다 — 던지면
-- 그 insert 도 되감긴다. 「이 알림은 거절했다」가 남지 않아 같은 알림이 다시 오면 처음 온 것처럼 다시 거절하고,
-- 분쟁 때 무엇을 받았는지를 말할 수 없었다. 전: pgTAP 에서 거절 뒤 알림 0줄.
--
-- **거절은 던지지 않고 결과로 돌려준다** — 한 줄 `(outcome, bundle_id)`. `applied` 면 묶음 id, `refused` 면 null. 같은
-- 알림이 다시 오면 처음의 결과를 그대로 돌려주고 한 줄도 더 안 적는다(전과 같은 성질). 반환형이 바뀌므로
-- 지우고 다시 짓는다 — 부르는 서버 코드는 아직 없다(G-23 ⑥ 의 웹훅이 부를 자리). 떠날 때 `retention.reading_payment`
-- 는 **승인된 적 있는 주문**의 알림을 거절까지 전부 옮긴다(결과 칸째). 승인된 적 없는 주문의 거절 알림은 옮기지
-- 않는다 — 그 주문은 거래가 아니라는 ADR 0106 의 선이다. 이 선은 G-23 ⑥ 에 남긴다.
--
-- ## 3. 같은 열쇠로 동시에 연 주문은 하나를 돌려준다 · 다른 묶음에 같은 열쇠는 거절 (ADR 0106)
--
-- `open_reading_order` 는 SELECT 뒤 INSERT 라 두 세션이 나란히 같은 열쇠로 오면 둘 다 「없다」를 보고, 늦은 쪽이
-- 고유 인덱스에서 `unique_violation` 을 받았다. 전: `duplicate key value violates unique constraint
-- "reading_order_user_id_idempotency_key_key"`. **`insert … on conflict (user_id, idempotency_key) do nothing`
-- 뒤 없으면 다시 읽는다** — 늦은 쪽은 앞 쪽의 커밋을 기다렸다가 같은 주문을 받는다. 그리고 같은 열쇠를 **다른
-- 묶음이나 다른 제공자**로 다시 부르면 옛 주문을 돌려주지 않고 거절한다(`22023`) — 5회 묶음을 누르고 3회 주문을
-- 받는 일이 없게.
--
-- ## 4. 거절 기록 한 시간 서른 줄을 사람마다 줄 세운다 (ADR 0105)
--
-- `note_operator_denial` 은 세고 적는다 — 나란히 부르면 둘 다 같은 수를 본다. 전: 스물아홉에서 둘이 함께 불러
-- 31 줄. **세기 전에 그 사람의 advisory 자물쇠를 쥔다** — 뒤 세션은 앞 세션의 커밋을 기다린 뒤 새 스냅샷으로 센다.
--
-- 본문은 로컬의 살아 있는 정의에서 받아 적고 고친 줄만 바꿨다(ADR 0043 의 규율).

-- ── 1. 반출과 쓰기의 자물쇠 ────────────────────────────────────────────────────

/** 반출과 쓰기가 나눠 쥐는 advisory 자물쇠의 열쇠 — 한 자리에서만 짓는다 */
create function audit.export_lock_key()
returns bigint
language sql
immutable
set search_path = ''
as $$ select hashtextextended('audit:operator_access:export', 0) $$;

/**
 * 쓰는 문장이 번호를 받기 **전에** 공유 자물쇠를 잡는다 — 커밋까지 쥔다. 쓰기끼리는 안 부딪히고 반출만 기다린다.
 * 줄 트리거가 아니라 문장 트리거인 까닭: identity 의 번호는 줄 트리거보다 먼저 정해진다.
 */
create function audit.hold_for_export()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  perform pg_advisory_xact_lock_shared(audit.export_lock_key());
  return null;
end;
$$;

create trigger operator_access_waits_for_export
before insert on audit.operator_access
for each statement execute function audit.hold_for_export();

revoke execute on function audit.export_lock_key(), audit.hold_for_export()
  from public, anon, authenticated, service_role;

/**
 * 지난 반출 뒤의 줄을 번호 차례로 — **배타 자물쇠를 잡은 뒤에** 읽는다. 그 순간 번호를 받은 쓰기는 다 끝났다.
 * `service_role` 만 부른다(크론 라우트의 열쇠). 이용자 개인정보가 없는 표라 그 열쇠에 연다.
 */
create or replace function public.audit_export_batch(p_limit integer default 5000)
returns table (
  id bigint,
  at timestamptz,
  channel text,
  actor_user_id uuid,
  actor_name text,
  action text,
  target_report_id uuid,
  filter_summary text,
  purpose text,
  sql_sha256 text,
  outcome text,
  after_id bigint
)
language plpgsql
volatile
security definer
set search_path = ''
as $$
#variable_conflict use_column
begin
  if current_setting('transaction_isolation') <> 'read committed' then
    raise exception 'audit: export reads under read committed only' using errcode = '55000';
  end if;

  perform pg_advisory_xact_lock(audit.export_lock_key());

  return query
  with last_export as (
    select coalesce(max(e.last_id), 0) as after_id from audit.operator_access_export e
  )
  select a.id, a.at, a.channel, a.actor_user_id, a.actor_name, a.action, a.target_report_id,
         a.filter_summary, a.purpose, a.sql_sha256, a.outcome, l.after_id
  from audit.operator_access a, last_export l
  where a.id > l.after_id
  order by a.id
  limit least(greatest(coalesce(p_limit, 5000), 1), 50000);
end;
$$;

-- ── 2. 거절된 결제 알림 ────────────────────────────────────────────────────────

drop function public.approve_reading_order(uuid, text, integer, text);

/**
 * 결제를 승인으로 적고 묶음을 세운다 — **서버만**(`service_role`). 금액이 주문과 다르면 **거절을 돌려준다** —
 * 던지지 않으므로 알림(`p_event_id`)의 거절 기록이 남는다. 같은 알림이나 같은 거래 번호로 두 번 와도 묶음은
 * 하나이고, 같은 알림에는 처음의 결과가 돌아간다.
 *
 * @returns 한 줄 — `applied` 와 묶음 id, 또는 `refused` 와 null
 */
create function public.approve_reading_order(
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
  earlier text;
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
      select e.outcome into earlier from public.payment_event e
      where e.provider = o.provider and e.provider_event_id = p_event_id;

      outcome := earlier;
      if earlier = 'applied' then
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

revoke execute on function public.approve_reading_order(uuid, text, integer, text)
  from public, anon, authenticated, service_role;
grant execute on function public.approve_reading_order(uuid, text, integer, text) to service_role;

-- ── 3. 같은 열쇠의 주문 ────────────────────────────────────────────────────────

/**
 * 주문을 연다 — **판매가 열렸을 때만.** 대기 주문은 아무것도 주지 않는다. 같은 열쇠로 다시 부르면 — 나란히
 * 불러도 — 같은 주문이 돌아온다(두 번 누름). 같은 열쇠를 다른 묶음 · 다른 제공자에 쓰면 거절한다. 가격은 이
 * 순간의 가격표에서 온다 — 부르는 쪽이 금액을 대지 않는다.
 *
 * @returns 주문 id · 제공자에게 건넬 주문 번호 · 금액
 */
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

  if not public.reading_sale_is_open() then
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

-- ── 4. 거절 기록의 한도 ────────────────────────────────────────────────────────

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
     or p_action not in ('reports.list', 'reports.detail', 'reports.snapshot', 'credits.refund_basis') then
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
