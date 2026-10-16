-- 운영자가 주문 화면(`/ops/orders`)에서 환불을 확보 → (PG 콘솔에서 취소) → 확정한다 (G-110 ②, ADR 0184)
--
-- 환불을 적는 문(`refund_reading_order`)은 서버 열쇠만 불렀다 — 운영자는 break-glass 로 운영 SQL 을 열어 금액을 손으로 셈해
-- 넣었다. 돈은 PG 콘솔에서 먼저 나가고 장부는 뒤에 적으므로, **그 사이에 이용자가 남은 풀이권을 쓰면 돈은 나갔는데 장부가
-- 거절된다.** 그래서 환불을 세 걸음으로 나눈다.
--
-- 1. **확보**(`operator_hold_reading_refund`) — 돌려줄 회차를 잠그고 금액을 확정해 `reading_refund_hold` 에 「진행 중」으로
--    둔다. 잠긴 회차는 한도(`reading_credit_shares`)와 다음 쓰임의 몫 고르기(`pick_reading_credit_share`)에서 빠진다 — 사람
--    자물쇠(`reading:user:<id>`) 안에서 확보하므로 풀이 시작 · 인연 요청과 나란히 와도 한쪽만 그 회차를 갖는다. 같은 주문에
--    진행 중인 확보는 하나뿐이다.
-- 2. **취소** — 운영자가 PortOne 콘솔에서 확보된 금액을 취소한다. DB 는 부르지 않는다.
-- 3. **확정**(`operator_book_reading_refund`) — 취소 번호를 들고 그 확보를 장부에 적는다(`refund_reading_order`). 같은 취소
--    번호로 다시 눌러도 한 번만 적힌다. 확정 전에는 **준비 취소**(`operator_release_reading_refund`)로 확보를 푼다.
--
-- 진행 중인 확보는 화면을 닫았다 다시 열어도 `operator_reading_refund_hold` 로 다시 선다.
--
-- 금액은 ADR 0148 의 누적 산식이다 — `결제액 × (이미 걷은 회차 + 이번 회차) ÷ 산 회차`(원 미만 버림) − 이미 돌려준 금액.
--
-- ## 접속기록
--
-- 문마다 동작 하나 — 진행 상태 읽기 `credits.refund_status`, 확보 `credits.refund_hold`, 확정 `credits.refund_book`, 준비 취소
-- `credits.refund_release`. 거른 조건 칸에 주문 id 만 적고, 같은 트랜잭션이라 거절된 시도는 줄도 되감긴다. 운영자가 아니면
-- `42501` 이고 앱이 `note_operator_denial` 로 같은 이름을 따로 적는다.
--
-- ## 서버 열쇠의 환불도 확보를 넘지 않는다
--
-- `refund_reading_order`(SQL 차례 — 쓴 회차까지 돌려주는 미제공 등)도 다른 확보가 잡은 회차는 안 쓴 것으로 세지 않는다.
-- 산 사람의 결제 내역(`my_reading_orders`)의 남은 회차도 확보를 뺀다.

-- ---------------------------------------------------------------------------
-- 1. 기록 표와 거절 문이 새 동작을 받는다 — 목록은 `20261116090000` 의 것에 넷을 더했다
-- ---------------------------------------------------------------------------

alter table audit.operator_access drop constraint operator_access_action_check;
alter table audit.operator_access add constraint operator_access_action_check
  check (action in ('reports.list', 'reports.detail', 'reports.snapshot', 'credits.refund_basis',
                    'credits.refund_status', 'credits.refund_hold', 'credits.refund_book', 'credits.refund_release',
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
     or p_action not in ('reports.list', 'reports.detail', 'reports.snapshot', 'credits.refund_basis',
                         'credits.refund_status', 'credits.refund_hold', 'credits.refund_book', 'credits.refund_release',
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
-- 2. 확보 — 진행 중인 환불
-- ---------------------------------------------------------------------------

create table public.reading_refund_hold (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.reading_order (id) on delete cascade,
  bundle_id uuid not null references public.reading_bundle (id) on delete cascade,
  /** 잠근 회차 — 진행 중인 동안 한도와 몫 고르기에서 빠진다 */
  credits integer not null check (credits > 0),
  /** 확보할 때 확정한 금액(원) — 확정은 이 금액을 적는다 */
  amount integer not null check (amount > 0),
  reason text not null check (reason in ('withdrawal', 'unused', 'duplicate', 'failure', 'other')),
  /** held 진행 중 · booked 장부에 확정 · released 준비 취소 */
  state text not null default 'held' check (state in ('held', 'booked', 'released')),
  /** 확보한 운영자 — 계정이 지워져도 줄은 남는다 */
  held_by uuid,
  held_at timestamptz not null default now(),
  closed_at timestamptz,
  /** 확정할 때 받은 PG 취소 번호 */
  provider_refund_id text check (provider_refund_id is null or length(provider_refund_id) between 1 and 200),
  constraint closed_has_its_time check ((state = 'held') = (closed_at is null)),
  constraint booked_has_the_refund_id check ((state = 'booked') = (provider_refund_id is not null))
);

comment on table public.reading_refund_hold is
  '진행 중인 환불 — 확보한 회차는 확정 · 준비 취소 전까지 쓰지 못한다 (G-110 ②, ADR 0184)';

/** 같은 주문에 진행 중인 확보는 하나 */
create unique index reading_refund_hold_one_open on public.reading_refund_hold (order_id) where state = 'held';
create index reading_refund_hold_by_bundle on public.reading_refund_hold (bundle_id) where state = 'held';

alter table public.reading_refund_hold enable row level security;
revoke all on public.reading_refund_hold from public, anon, authenticated, service_role;

/** 묶음 하나에서 진행 중인 확보가 잡은 회차 */
create function public.reading_bundle_held(p_bundle_id uuid)
returns integer
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(sum(h.credits), 0)::integer
  from public.reading_refund_hold h
  where h.bundle_id = p_bundle_id and h.state = 'held';
$$;

revoke execute on function public.reading_bundle_held(uuid) from public, anon, authenticated, service_role;

-- ---------------------------------------------------------------------------
-- 3. 한도와 몫 고르기가 확보를 뺀다 — 몸은 `20261011090000` 그대로, 묶음의 몫에서 확보만 뺐다
-- ---------------------------------------------------------------------------

create or replace function public.reading_credit_shares(p_user uuid)
returns table (free_credits integer, granted_credits integer, bought_credits integer)
language sql
stable
security definer
set search_path = ''
as $$
  select
    public.reading_credit_limit(),
    coalesce((select g.extra from public.reading_credit_grant g where g.user_id = p_user), 0),
    coalesce((select sum(b.credits - b.refunded_credits - public.reading_bundle_held(b.id))::integer
              from public.reading_bundle b where b.user_id = p_user), 0);
$$;

create or replace function public.pick_reading_credit_share(p_user uuid, out share text, out bundle_id uuid)
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  shares record;
begin
  perform public.settle_reading_credit_uses(p_user);

  select * into shares from public.reading_credit_shares(p_user);

  if (select count(*) from public.reading_credit_use u
      where u.user_id = p_user and u.share = 'free' and u.state <> 'released') < shares.free_credits then
    share := 'free';
    return;
  end if;

  if (select count(*) from public.reading_credit_use u
      where u.user_id = p_user and u.share = 'grant' and u.state <> 'released') < shares.granted_credits then
    share := 'grant';
    return;
  end if;

  select b.id into bundle_id
  from public.reading_bundle b
  where b.user_id = p_user
    and b.credits - b.refunded_credits - public.reading_bundle_held(b.id) > (
      select count(*) from public.reading_credit_use u
      where u.bundle_id = b.id and u.state <> 'released')
  order by b.acquired_at, b.id
  limit 1;

  share := case when bundle_id is null then 'outside' else 'bundle' end;
end;
$$;

-- ---------------------------------------------------------------------------
-- 4. 서버 열쇠의 환불 — 몸은 `20261015090000` 그대로, 안 쓴 것에서 진행 중인 확보를 뺐다
-- ---------------------------------------------------------------------------

/**
 * 환불을 적는다 — 서버만. 금액과 걷을 회차는 부르는 쪽이 정한다(운영자 화면은 확보가 정한 것을 넘긴다). 걷는 회차는 그
 * 묶음의 **안 쓴** 것을 넘지 못한다 — 예약 중인 것(G-21 ③)과 진행 중인 확보가 잡은 것은 안 쓴 것이 아니다. 제공자 환불
 * 번호가 같으면 한 번만 적힌다 — **금액 · 회차 · 사유까지 같을 때만**, 다르면 `22023`.
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
  free integer;
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

  free := b.credits - b.refunded_credits - taken - public.reading_bundle_held(b.id);

  if p_credits is null or p_credits < 0 or p_credits > free then
    raise exception 'reading_order: only unused credits are taken back (% left)', free using errcode = '22023';
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

-- ---------------------------------------------------------------------------
-- 5. 운영자 셈 · 산 사람의 내역 — 안 쓴 것 · 남은 것에서 확보를 뺀다
-- ---------------------------------------------------------------------------

/**
 * 주문 하나를 들고 그 계정의 주문 전부를 묶음별로 — 몸은 `20261011090000` 그대로다. 안 쓴 수(`unused`)에서 진행 중인 확보가
 * 잡은 회차를 뺐다 — 화면이 고를 수 있는 회차가 이것이다. 확보 자체는 `operator_reading_refund_hold` 가 낸다.
 */
create or replace function public.operator_reading_refund_basis(p_order_id uuid)
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
  last_used_at timestamptz
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
    u.last_at
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

/** 몸은 `20261208090000` 그대로 — 남은 회차에서 진행 중인 환불이 잡은 회차를 뺐다 */
create or replace function public.my_reading_orders()
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
    b.credits - b.refunded_credits - public.reading_bundle_held(b.id) - (
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

-- ---------------------------------------------------------------------------
-- 6. 운영자 문 넷 — 진행 상태 · 확보 · 확정 · 준비 취소
-- ---------------------------------------------------------------------------

/**
 * 주문 하나에 진행 중인 환불 — 없으면 빈 답. 화면을 닫았다 다시 열어도 이것으로 이어서 확정한다.
 * 잔여(`remaining_amount`)는 결제액에서 이미 돌려준 것과 이번 확보 금액을 뺀 것이다 — PG 부분취소 화면의 「취소 후 잔액」.
 */
create function public.operator_reading_refund_hold(p_order_id uuid)
returns table (
  hold_id uuid,
  credits integer,
  amount integer,
  reason text,
  held_at timestamptz,
  provider_payment_id text,
  remaining_amount integer
)
language plpgsql
volatile
security definer
set search_path = ''
as $$
begin
  if not public.is_operator() then
    raise exception '운영자만 읽는 자리입니다.' using errcode = '42501';
  end if;

  perform audit.note_app_access('credits.refund_status', null, format('order=%s', p_order_id), 'allowed');

  return query
  select h.id, h.credits, h.amount, h.reason, h.held_at, o.provider_payment_id,
         o.amount - o.refunded_amount - h.amount
  from public.reading_refund_hold h
  join public.reading_order o on o.id = h.order_id
  where h.order_id = p_order_id and h.state = 'held';
end;
$$;

/**
 * 환불을 준비한다 — 돌려줄 회차를 잠그고 금액을 확정해 진행 중으로 둔다. 걷는 회차는 하나 이상이고 그 묶음의 안 쓴 것
 * (예약 중 · 다른 확보는 빼고)을 넘지 못한다. 사람 자물쇠 안에서 잠그므로 풀이 시작과 나란히 와도 한쪽만 그 회차를 갖는다.
 */
create function public.operator_hold_reading_refund(p_order_id uuid, p_credits integer, p_reason text)
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
  made uuid;
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

  owed := floor(o.amount::numeric * (b.refunded_credits + p_credits) / b.credits)::integer - o.refunded_amount;

  if owed <= 0 then
    raise exception '돌려줄 금액이 없습니다.' using errcode = '22023';
  end if;

  insert into public.reading_refund_hold (order_id, bundle_id, credits, amount, reason, held_by)
  values (o.id, b.id, p_credits, owed, p_reason, (select auth.uid()))
  returning id into made;

  hold_id := made;
  credits := p_credits;
  amount := owed;
  return next;
end;
$$;

/**
 * 확보한 환불을 장부에 확정한다 — PG 콘솔에서 취소한 **뒤에**, 그 취소 번호로. 금액 · 회차 · 사유는 확보가 정한 것이다.
 * 같은 취소 번호로 다시 부르면 한 번만 적히고 지금 상태를 돌려준다. 다른 번호로 확정된 확보 · 준비 취소된 확보는 거절한다.
 *
 * @returns 주문의 새 상태
 */
create function public.operator_book_reading_refund(p_hold_id uuid, p_provider_refund_id text)
returns text
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  h public.reading_refund_hold;
  refund_id text := btrim(coalesce(p_provider_refund_id, ''));
  outcome text;
begin
  if not public.is_operator() then
    raise exception '운영자만 쓰는 자리입니다.' using errcode = '42501';
  end if;

  select * into h from public.reading_refund_hold where id = p_hold_id for update;
  if not found then
    raise exception '진행 중인 환불을 찾지 못했습니다.' using errcode = 'no_data_found';
  end if;

  perform audit.note_app_access('credits.refund_book', null, format('order=%s', h.order_id), 'allowed');

  if refund_id = '' then
    raise exception 'PG 취소 번호를 적어 주세요.' using errcode = '22023';
  end if;

  if h.state = 'booked' then
    if h.provider_refund_id is distinct from refund_id then
      raise exception '이 환불은 다른 PG 취소 번호로 이미 적혔습니다.' using errcode = '22023';
    end if;
    return (select o.status from public.reading_order o where o.id = h.order_id);
  end if;

  if h.state = 'released' then
    raise exception '준비가 취소된 환불입니다. 다시 준비해 주세요.' using errcode = '55000';
  end if;

  if exists (select 1 from public.reading_order_refund f
             where f.order_id = h.order_id and f.provider_refund_id = refund_id) then
    raise exception '이 PG 취소 번호는 이 주문의 다른 환불에 이미 적혔습니다.' using errcode = '22023';
  end if;

  -- 확보를 먼저 닫는다 — 아래 문이 안 쓴 것을 셀 때 이 확보가 잡은 회차가 다시 풀려 있어야 한다
  update public.reading_refund_hold
  set state = 'booked', closed_at = now(), provider_refund_id = refund_id
  where id = h.id;

  outcome := public.refund_reading_order(h.order_id, h.amount, h.credits, h.reason, refund_id);
  return outcome;
end;
$$;

/** 확정 전의 확보를 푼다 — 잠근 회차가 다시 쓸 수 있게 된다. 이미 풀린 것은 그대로, 확정된 것은 거절 */
create function public.operator_release_reading_refund(p_hold_id uuid)
returns void
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  h public.reading_refund_hold;
begin
  if not public.is_operator() then
    raise exception '운영자만 쓰는 자리입니다.' using errcode = '42501';
  end if;

  select * into h from public.reading_refund_hold where id = p_hold_id for update;
  if not found then
    raise exception '진행 중인 환불을 찾지 못했습니다.' using errcode = 'no_data_found';
  end if;

  perform audit.note_app_access('credits.refund_release', null, format('order=%s', h.order_id), 'allowed');

  if h.state = 'booked' then
    raise exception '이미 장부에 적힌 환불입니다.' using errcode = '55000';
  end if;

  if h.state = 'held' then
    update public.reading_refund_hold set state = 'released', closed_at = now() where id = h.id;
  end if;
end;
$$;

comment on function public.operator_hold_reading_refund(uuid, integer, text) is
  '환불 준비 — 회차를 잠그고 금액을 확정해 진행 중으로 둔다 (G-110 ②, ADR 0184).';
comment on function public.operator_book_reading_refund(uuid, text) is
  '환불 확정 — PG 콘솔에서 취소한 뒤 그 취소 번호로 확보를 장부에 적는다 (G-110 ②, ADR 0184).';
comment on function public.operator_release_reading_refund(uuid) is
  '환불 준비 취소 — 확정 전의 확보를 푼다 (G-110 ②, ADR 0184).';
comment on function public.operator_reading_refund_hold(uuid) is
  '주문 하나에 진행 중인 환불 — 화면을 다시 열어도 이어서 확정한다 (G-110 ②, ADR 0184).';

revoke execute on function public.operator_reading_refund_hold(uuid),
  public.operator_hold_reading_refund(uuid, integer, text),
  public.operator_book_reading_refund(uuid, text),
  public.operator_release_reading_refund(uuid)
  from public, anon, authenticated, service_role;
grant execute on function public.operator_reading_refund_hold(uuid),
  public.operator_hold_reading_refund(uuid, integer, text),
  public.operator_book_reading_refund(uuid, text),
  public.operator_release_reading_refund(uuid)
  to authenticated;
