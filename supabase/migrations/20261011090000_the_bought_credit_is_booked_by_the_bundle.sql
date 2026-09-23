-- 산 풀이권은 결제 주문에 매인 묶음이 들고, 어느 쓰임이 어느 몫을 썼는지가 묶음마다 남는다 (G-21 ⑤ ④, ADR 0106)
--
-- PG 와 무관하게 먼저 세우는 장부다. 판매는 닫힌 채다(`reading_sale_is_open()` = false) — 무료 몫을 1 로
-- 줄이는 일 · 저장 자리 10 을 걷는 일 · 판매를 여는 일은 공개 출시의 스위치이고 여기서 안 켠다.
--
-- ## 잔액은 여전히 센다 — 장부는 그 옆에 선다
--
-- 잔액(ADR 0021)과 문 셋의 거절(ADR 0043)은 한 글자도 안 바뀐다. 바뀌는 것은 한도 한 줄이다:
--
--   이 사람의 한도 = 무료 몫 + 예외 몫 + 산 몫(묶음마다 산 수 − 환불로 걷은 수)
--
-- 산 몫이 0 인 지금 모든 계정의 한도는 그대로다. 사용 이력(`reading_credit_use`)은 **환불 셈의 입력**이다 —
-- 잔액을 정하지 않는다. 잔액을 장부로 옮기면 ADR 0021 이 없앤 「빼기와 돌려주기」가 돌아온다.
--
-- ## 쓴 순서 — 무료 → 예외 → 오래된 묶음 (G-21 ③)
--
-- 시도나 요청이 자리를 잡는 순간(행이 생기는 순간) 트리거가 몫 하나를 붙인다. 무료 몫에 빈자리가 있으면
-- 무료, 없으면 예외, 없으면 산 때가 이른 묶음부터. 쓰임은 예약 → 확정 또는 풀림으로만 간다:
--
--   풀이 시도   running → 예약,  succeeded → 확정,  failed · 유효시간 넘김 · 지워짐 → 풀림
--   인연 요청   pending → 예약,  수락 → 그 자리에서 선 시도가 **같은 몫**을 이어 받는다,
--               거절 · 거둠 · 무효 · 만료 · 지워짐 → 풀림
--
-- 셈이 행을 안 고치고 풀어 주는 자리(유효시간을 넘긴 시도, 기한이 지난 요청, 수락 뒤 시도가 못 선 요청)는
-- 다음에 그 사람의 몫을 고를 때와 운영자가 환불 셈을 읽을 때 **먼저 정리한다**(`settle_reading_credit_uses`).
--
-- **확정된 쓰임은 대상이 지워져도 확정이다.** 사람을 지우면 시도가 cascade 로 사라져 셈이 한 자리를 되돌려
-- 준다(지금 동작 — 바꾸지 않는다). 장부는 그 쓰임을 지우지 않으므로 되돌아온 자리로 만든 풀이는 어느 몫에도
-- 안 든다 — `outside`(몫 밖)로 적힌다. 그래야 산 몫을 쓰고 대상을 지워 환불로 바꾸는 길이 없다. 한도가 내려가
-- 이미 넘게 쓴 계정(8 → 5, `20260911150000`)의 옛 쓰임도 채워 넣을 때 같은 자리에 선다.
--
-- ## 두 문이 마지막 한 번을 다투면 하나만
--
-- `start_reading_run_for` 는 셈 전에 사람 자물쇠(`reading:user:<id>` advisory)를 잡는데 `request_match` 는
-- 계정 행만 잠갔다 — 둘이 나란히 마지막 한 번을 읽으면 둘 다 지나갔다. `request_match` 가 셈 전에 같은
-- 자물쇠를 잡는다. 본문은 로컬의 살아 있는 정의에서 받아 적고 그 한 줄만 더했다(ADR 0043 의 규율).
--
-- ## 주문을 승인으로 만드는 문은 서버만
--
-- 주문은 로그인한 사람이 연다(판매가 열렸을 때만) — 대기 주문은 아무것도 안 준다. 승인 · 취소 · 환불은
-- `service_role` 만 부른다(결제 확인은 서버가 PG 에서 받아 적는다, ADR 0100). 표 다섯은 RLS 를 켜고 정책을
-- 두지 않으며 어느 API 역할에도 권한이 없다 — 몫을 만드는 길은 그 문들뿐이다.
--
-- ## 떠나면 — 결제 기록은 5년 따로, 앱은 못 읽는다 (G-25 ②)
--
-- `auth.users` 의 `before delete` 트리거가 승인된 적 있는 주문을 `retention.reading_payment` 로 옮긴다
-- (ADR 0098 과 같은 결). 옮긴 뒤 일반 표의 행은 cascade 로 지워진다. 마지막 결제 사건(승인 · 환불)부터
-- 5년이 지나면 크론이 지운다. 로그인 이메일은 옮기지 않는다 — 거래는 PG 의 거래번호로 되짚는다(ADR 0106).

-- ── 판매 목록과 스위치 ─────────────────────────────────────────────────────────

/** 묶음 넷의 가격(원, 부가세 포함) — G-21, 2026-09-23 에 사람이 정했다. 목록에 없는 수는 `null` */
create function public.reading_bundle_price(p_credits integer)
returns integer
language sql
immutable
set search_path = ''
as $$
  select case p_credits when 1 then 4900 when 3 then 12900 when 5 then 19900 when 20 then 59000 end
$$;

/**
 * 판매가 열렸는가 — **닫혀 있다.** 공개 출시에서 G-25 의 철회 기준과 결제 전 고지가 선 뒤 연다(G-21).
 * 여는 것은 이 한 줄을 바꾸는 마이그레이션이다.
 */
create function public.reading_sale_is_open()
returns boolean
language sql
immutable
set search_path = ''
as $$ select false $$;

-- ── 표 다섯 ────────────────────────────────────────────────────────────────────

/**
 * 결제 주문 — PG 에 중립이다. 대기 → 승인 → 부분 환불 → 전액 환불, 또는 대기 → 취소(결제 전에 닫힘).
 * 상태가 움직이는 길은 `reading_order_moves` 트리거가 든다.
 */
create table public.reading_order (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.app_user (id) on delete cascade,
  /** 무엇을 사는가 — 묶음의 회차 수 */
  bundle_credits integer not null check (bundle_credits in (1, 3, 5, 20)),
  /** 결제할 금액 — 주문을 여는 순간의 가격표에서 온다 */
  amount integer not null check (amount > 0),
  currency text not null default 'KRW' check (currency = 'KRW'),
  /** 결제 제공자 — `portone` 같은 이름. 시험의 헬퍼는 `dev` */
  provider text not null check (provider ~ '^[a-z][a-z0-9_-]{1,31}$'),
  /** 우리가 제공자에게 건네는 주문 번호(가맹점 주문 id) */
  provider_order_id text not null check (length(provider_order_id) between 1 and 100),
  /** 제공자가 돌려준 거래 번호 — 승인 때 선다 */
  provider_payment_id text check (provider_payment_id is null or length(provider_payment_id) between 1 and 200),
  /** 같은 누름이 두 번 와도 주문은 하나 */
  idempotency_key text not null check (length(idempotency_key) between 8 and 100),
  status text not null default 'pending'
    check (status in ('pending', 'approved', 'cancelled', 'partially_refunded', 'refunded')),
  refunded_amount integer not null default 0,
  created_at timestamptz not null default now(),
  approved_at timestamptz,
  closed_at timestamptz,
  close_reason text check (close_reason is null or close_reason in ('failed', 'abandoned', 'expired')),
  last_refunded_at timestamptz,

  unique (provider, provider_order_id),
  unique (user_id, idempotency_key),
  constraint refunded_within_amount check (refunded_amount between 0 and amount),
  constraint paid_has_a_payment check (
    (status in ('pending', 'cancelled')) = (approved_at is null)
    and (approved_at is null) = (provider_payment_id is null)),
  constraint cancelled_has_a_reason check (
    (status = 'cancelled') = (closed_at is not null) and (closed_at is null) = (close_reason is null)),
  constraint refund_matches_status check (
    case status
      when 'approved' then refunded_amount = 0
      when 'partially_refunded' then refunded_amount > 0 and refunded_amount < amount
      when 'refunded' then refunded_amount = amount
      else refunded_amount = 0
    end
    and (refunded_amount > 0) = (last_refunded_at is not null))
);

comment on table public.reading_order is
  '풀이권 결제 주문 — 서버만 승인한다. 떠나면 retention.reading_payment 로 옮긴 뒤 지운다 (G-21 ⑤, ADR 0106)';

create unique index reading_order_payment on public.reading_order (provider, provider_payment_id)
  where provider_payment_id is not null;
create index reading_order_by_user on public.reading_order (user_id, created_at);

/**
 * 산 묶음 — 주문 하나에 하나, 승인 때 선다. 한도에 얹히는 것은 `credits − refunded_credits`.
 * 「오래된 묶음」의 차례는 `acquired_at` 이다.
 */
create table public.reading_bundle (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null unique references public.reading_order (id) on delete cascade,
  user_id uuid not null references public.app_user (id) on delete cascade,
  credits integer not null check (credits > 0),
  /** 가격 스냅샷 — 그때 낸 금액 */
  price integer not null check (price > 0),
  currency text not null default 'KRW' check (currency = 'KRW'),
  acquired_at timestamptz not null default now(),
  /** 환불로 걷은 회차 — 안 쓴 것만 걷는다 */
  refunded_credits integer not null default 0,
  constraint refunded_within_credits check (refunded_credits between 0 and credits)
);

comment on table public.reading_bundle is
  '산 풀이권 묶음 — 주문 1:1, 한도에 credits − refunded_credits 가 얹힌다 (G-21 ⑤, ADR 0106)';

create index reading_bundle_by_user on public.reading_bundle (user_id, acquired_at, id);

/** 환불 한 번 — 금액과 걷은 회차. 사유는 분류 하나(자유 글에 개인정보가 섞이지 않게) */
create table public.reading_order_refund (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.reading_order (id) on delete cascade,
  amount integer not null check (amount > 0),
  credits integer not null check (credits >= 0),
  /** 청약철회 · 안 쓴 몫 환불 · 중복결제 · 미제공(장애) · 그 밖 */
  reason text not null check (reason in ('withdrawal', 'unused', 'duplicate', 'failure', 'other')),
  provider_refund_id text check (provider_refund_id is null or length(provider_refund_id) between 1 and 200),
  refunded_at timestamptz not null default now(),
  unique (order_id, provider_refund_id)
);

comment on table public.reading_order_refund is
  '풀이권 주문의 환불 기록 — 산식은 없다, 금액은 사람이 정해 적는다 (G-25 ⑥, ADR 0106)';

/**
 * 제공자가 보낸 알림 — **같은 알림은 한 번만.** 서명 검증과 금액 대조는 G-23 ⑥ 이 이 자리에 얹는다.
 */
create table public.payment_event (
  id bigint generated always as identity primary key,
  provider text not null,
  provider_event_id text not null check (length(provider_event_id) between 1 and 200),
  order_id uuid references public.reading_order (id) on delete cascade,
  kind text not null check (kind in ('approved', 'cancelled', 'refunded')),
  amount integer,
  received_at timestamptz not null default clock_timestamp(),
  outcome text not null check (outcome in ('applied', 'refused')),
  unique (provider, provider_event_id)
);

comment on table public.payment_event is
  '결제 제공자의 알림 — (provider, provider_event_id) 로 한 번만 반영한다 (G-23 ⑥ 의 자리, ADR 0106)';

/**
 * 사용 이력 — 어느 시도 · 요청이 어느 몫을 썼는가. 잔액을 정하지 않는다(ADR 0021) — 환불 셈의 입력이다.
 */
create table public.reading_credit_use (
  id bigint generated always as identity primary key,
  user_id uuid not null references public.app_user (id) on delete cascade,
  /** free 무료 · grant 예외(ADR 0043) · bundle 산 묶음 · outside 몫 밖(셈이 되돌려 준 자리로 쓴 것) */
  share text not null check (share in ('free', 'grant', 'bundle', 'outside')),
  bundle_id uuid references public.reading_bundle (id) on delete cascade,
  /** 무엇이 자리를 잡았나 — 시도(run) 또는 인연 요청(request) */
  source text not null check (source in ('run', 'request')),
  run_id uuid references public.reading_run (id) on delete set null,
  request_id uuid references public.match_request (id) on delete set null,
  state text not null default 'reserved' check (state in ('reserved', 'confirmed', 'released')),
  reserved_at timestamptz not null default now(),
  confirmed_at timestamptz,
  released_at timestamptz,
  constraint bundle_share_names_the_bundle check ((share = 'bundle') = (bundle_id is not null)),
  constraint state_has_its_time check (
    case state
      when 'reserved' then confirmed_at is null and released_at is null
      when 'confirmed' then confirmed_at is not null and released_at is null
      else released_at is not null and confirmed_at is null
    end)
);

comment on table public.reading_credit_use is
  '풀이권 사용 이력 — 무료 → 예외 → 오래된 묶음. 환불 셈에만 든다 (G-21 ③ ④, ADR 0106)';

create unique index reading_credit_use_by_run on public.reading_credit_use (run_id) where run_id is not null;
create unique index reading_credit_use_by_request on public.reading_credit_use (request_id)
  where request_id is not null;
create index reading_credit_use_by_user on public.reading_credit_use (user_id, state);
create index reading_credit_use_by_bundle on public.reading_credit_use (bundle_id) where bundle_id is not null;

alter table public.reading_order enable row level security;
alter table public.reading_bundle enable row level security;
alter table public.reading_order_refund enable row level security;
alter table public.payment_event enable row level security;
alter table public.reading_credit_use enable row level security;

revoke all on public.reading_order, public.reading_bundle, public.reading_order_refund,
  public.payment_event, public.reading_credit_use
  from public, anon, authenticated, service_role;

-- ── 상태 기계 — 표가 스스로 지킨다 ────────────────────────────────────────────

/**
 * 주문이 움직이는 길 — 대기 → 승인 | 취소, 승인 → 부분 환불 | 전액 환불, 부분 환불 → 부분 환불 | 전액 환불.
 * 무엇을 샀는지 · 얼마였는지 · 누구 것인지는 안 바뀐다. 환불액은 줄지 않는다.
 */
create function public.reading_order_moves()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.user_id <> old.user_id or new.bundle_credits <> old.bundle_credits or new.amount <> old.amount
     or new.currency <> old.currency or new.provider <> old.provider
     or new.provider_order_id <> old.provider_order_id or new.idempotency_key <> old.idempotency_key
     or new.created_at <> old.created_at
     or (old.provider_payment_id is not null and new.provider_payment_id is distinct from old.provider_payment_id)
     or (old.approved_at is not null and new.approved_at is distinct from old.approved_at)
     or new.refunded_amount < old.refunded_amount
  then
    raise exception 'reading_order: what was ordered does not change' using errcode = '55000';
  end if;

  if new.status <> old.status and not (
       (old.status = 'pending' and new.status in ('approved', 'cancelled'))
    or (old.status = 'approved' and new.status in ('partially_refunded', 'refunded'))
    or (old.status = 'partially_refunded' and new.status = 'refunded'))
  then
    raise exception 'reading_order: % cannot become %', old.status, new.status using errcode = '55000';
  end if;

  return new;
end;
$$;

create trigger reading_order_moves
before update on public.reading_order
for each row execute function public.reading_order_moves();

/** 묶음은 걷은 회차만 는다 */
create function public.reading_bundle_moves()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if (to_jsonb(new) - 'refunded_credits') is distinct from (to_jsonb(old) - 'refunded_credits')
     or new.refunded_credits < old.refunded_credits
  then
    raise exception 'reading_bundle: only refunded credits grow' using errcode = '55000';
  end if;
  return new;
end;
$$;

create trigger reading_bundle_moves
before update on public.reading_bundle
for each row execute function public.reading_bundle_moves();

/**
 * 쓰임은 예약에서만 움직인다 — 예약 → 확정 | 풀림. 몫은 안 바뀐다. 시도를 잇는 것(예약 중에 한 번)과
 * 가리키던 행이 지워져 비는 것만 된다.
 */
create function public.reading_credit_use_moves()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.user_id <> old.user_id or new.share <> old.share
     or new.bundle_id is distinct from old.bundle_id or new.source <> old.source
     or new.reserved_at <> old.reserved_at
     or (new.request_id is not null and new.request_id is distinct from old.request_id)
     or (new.run_id is not null and new.run_id is distinct from old.run_id
         and (old.run_id is not null or old.state <> 'reserved'))
     or (new.state <> old.state and old.state <> 'reserved')
     or (old.state <> 'reserved' and (new.confirmed_at is distinct from old.confirmed_at
                                      or new.released_at is distinct from old.released_at))
  then
    raise exception 'reading_credit_use: a use only moves out of reserved' using errcode = '55000';
  end if;
  return new;
end;
$$;

create trigger reading_credit_use_moves
before update on public.reading_credit_use
for each row execute function public.reading_credit_use_moves();

-- ── 한도 — 몫 셋을 한 자리에서 ────────────────────────────────────────────────

/**
 * 한 사람의 몫 셋 — 무료 · 예외 · 산 것. **상수를 읽는 자리는 여기 하나다**(`25_reading_credit_grant`).
 * 공개 출시에서 무료 몫을 가입 시각으로 가를 때(G-21 ①) 고치는 자리도 여기다.
 */
create function public.reading_credit_shares(p_user uuid)
returns table (free_credits integer, granted_credits integer, bought_credits integer)
language sql
stable
security definer
set search_path = ''
as $$
  select
    public.reading_credit_limit(),
    coalesce((select g.extra from public.reading_credit_grant g where g.user_id = p_user), 0),
    coalesce((select sum(b.credits - b.refunded_credits)::integer
              from public.reading_bundle b where b.user_id = p_user), 0);
$$;

/** 이 사람의 한도 — 무료 + 예외 + 산 몫. 문 셋(화면 · 인연 요청 · 생성)이 이것 하나를 지난다(ADR 0043) */
create or replace function public.reading_credit_limit_for(p_user uuid)
returns integer
language sql
stable
security definer
set search_path = ''
as $$
  select s.free_credits + s.granted_credits + s.bought_credits
  from public.reading_credit_shares(p_user) s;
$$;

-- ── 사용 이력 — 정리하고, 고르고, 적는다 ──────────────────────────────────────

/**
 * 셈이 이미 풀어 준 예약을 장부에서도 푼다 — 유효시간을 넘긴 시도, 기한이 지난 요청, 수락 뒤 시도가
 * 못 선 요청, 가리키던 행이 지워진 예약. 셈(`reading_credits_used`)과 같은 물음이다.
 */
create function public.settle_reading_credit_uses(p_user uuid)
returns void
language sql
volatile
security definer
set search_path = ''
as $$
  update public.reading_credit_use u
  set state = 'released', released_at = now()
  where u.user_id = p_user
    and u.state = 'reserved'
    and not exists (
      select 1 from public.reading_run r
      where r.id = u.run_id
        and r.status = 'running'
        and r.created_at > now() - public.reading_run_timeout())
    and not exists (
      select 1 from public.match_request q
      where u.run_id is null
        and q.id = u.request_id
        and q.status = 'pending'
        and q.expires_at > now());
$$;

/**
 * 다음 쓰임이 들 몫 — 무료에 빈자리가 있으면 무료, 없으면 예외, 없으면 산 때가 이른 묶음. 다 차 있으면
 * `outside`(셈이 되돌려 준 자리 — 지운 대상의 시도, 내려간 한도). 사람 자물쇠 안에서 부른다.
 */
create function public.pick_reading_credit_share(p_user uuid, out share text, out bundle_id uuid)
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
    and b.credits - b.refunded_credits > (
      select count(*) from public.reading_credit_use u
      where u.bundle_id = b.id and u.state <> 'released')
  order by b.acquired_at, b.id
  limit 1;

  share := case when bundle_id is null then 'outside' else 'bundle' end;
end;
$$;

/**
 * 시도가 서면 쓰임 하나 — 수락이 연 시도(`match-accept:<요청 id>`, `respond_to_match_request`)는 새 몫을
 * 고르지 않고 요청의 예약을 이어 받는다. 실패로 선 행은 자리를 안 잡는다.
 */
create function public.book_reading_credit_for_run()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  picked record;
begin
  if new.status = 'failed' then
    return null;
  end if;

  perform pg_advisory_xact_lock(hashtext('reading:user:' || new.user_id::text));

  if new.kind = 'match' and new.idempotency_key like 'match-accept:%' then
    update public.reading_credit_use u
    set run_id = new.id,
        state = case when new.status = 'succeeded' then 'confirmed' else u.state end,
        confirmed_at = case when new.status = 'succeeded' then now() end
    where u.user_id = new.user_id
      and u.source = 'request'
      and u.state = 'reserved'
      and u.run_id is null
      and u.request_id::text = substr(new.idempotency_key, length('match-accept:') + 1);

    if found then
      return null;
    end if;
  end if;

  select * into picked from public.pick_reading_credit_share(new.user_id);

  insert into public.reading_credit_use (
    user_id, share, bundle_id, source, run_id, state, reserved_at, confirmed_at)
  values (
    new.user_id, picked.share, picked.bundle_id, 'run', new.id,
    case when new.status = 'succeeded' then 'confirmed' else 'reserved' end,
    new.created_at,
    case when new.status = 'succeeded' then coalesce(new.finished_at, now()) end);

  return null;
end;
$$;

create trigger reading_run_books_a_credit
after insert on public.reading_run
for each row execute function public.book_reading_credit_for_run();

/** 시도가 끝나면 — 성공은 확정, 실패는 풀림. 이미 정리된 쓰임은 건드리지 않는다 */
create function public.settle_reading_credit_for_run()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.reading_credit_use u
  set state = case when new.status = 'succeeded' then 'confirmed' else 'released' end,
      confirmed_at = case when new.status = 'succeeded' then now() end,
      released_at = case when new.status = 'succeeded' then null else now() end
  where u.run_id = new.id and u.state = 'reserved';
  return null;
end;
$$;

create trigger reading_run_settles_its_credit
after update of status on public.reading_run
for each row
when (old.status = 'running' and new.status <> 'running')
execute function public.settle_reading_credit_for_run();

/** 요청이 서면 예약 하나 — 요청한 사람의 몫에서 */
create function public.book_reading_credit_for_request()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  picked record;
begin
  if new.status <> 'pending' then
    return null;
  end if;

  perform pg_advisory_xact_lock(hashtext('reading:user:' || new.requester_user_id::text));

  select * into picked from public.pick_reading_credit_share(new.requester_user_id);

  insert into public.reading_credit_use (user_id, share, bundle_id, source, request_id, reserved_at)
  values (new.requester_user_id, picked.share, picked.bundle_id, 'request', new.id, new.created_at);

  return null;
end;
$$;

create trigger match_request_books_a_credit
after insert on public.match_request
for each row execute function public.book_reading_credit_for_request();

/** 요청이 수락 말고 다른 끝으로 가면 풀린다. 수락은 곧 설 시도가 이어 받는다 */
create function public.settle_reading_credit_for_request()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.status <> 'accepted' then
    update public.reading_credit_use u
    set state = 'released', released_at = now()
    where u.request_id = new.id and u.run_id is null and u.state = 'reserved';
  end if;
  return null;
end;
$$;

create trigger match_request_settles_its_credit
after update of status on public.match_request
for each row
when (old.status = 'pending' and new.status <> 'pending')
execute function public.settle_reading_credit_for_request();

-- ── 이미 자리를 잡고 있는 것을 채워 넣는다 ────────────────────────────────────
--
-- 셈이 지금 세는 것 — 성공한 시도, 유효시간 안의 시도, 기한 안의 대기 요청 — 을 시각 순으로 무료 → 예외에
-- 붙인다. 묶음은 아직 없다. 넘치는 것(내려간 한도 · 지운 대상 때문에)은 몫 밖이다.

with counted as (
  select r.user_id, 'run'::text as source, r.id as run_id, null::uuid as request_id,
         case when r.status = 'succeeded' then 'confirmed' else 'reserved' end as state,
         r.created_at as reserved_at,
         case when r.status = 'succeeded' then coalesce(r.finished_at, r.created_at) end as confirmed_at
  from public.reading_run r
  where r.status = 'succeeded'
     or (r.status = 'running' and r.created_at > now() - public.reading_run_timeout())
  union all
  select q.requester_user_id, 'request', null, q.id, 'reserved', q.created_at, null
  from public.match_request q
  where q.status = 'pending' and q.expires_at > now()
),
ordered as (
  select c.*,
         row_number() over (partition by c.user_id order by c.reserved_at, c.run_id, c.request_id) as n,
         s.free_credits, s.granted_credits
  from counted c
  cross join lateral public.reading_credit_shares(c.user_id) s
)
insert into public.reading_credit_use (
  user_id, share, source, run_id, request_id, state, reserved_at, confirmed_at)
select o.user_id,
       case when o.n <= o.free_credits then 'free'
            when o.n <= o.free_credits + o.granted_credits then 'grant'
            else 'outside' end,
       o.source, o.run_id, o.request_id, o.state, o.reserved_at, o.confirmed_at
from ordered o
order by o.user_id, o.n;

-- ── 인연 요청도 셈 전에 사람 자물쇠를 잡는다 ──────────────────────────────────

create or replace function public.request_match(p_candidate_user_id uuid)
returns uuid
language plpgsql
security definer
set search_path = ''
as $function$
declare
  actor uuid := (select auth.uid());
  my_summary jsonb;
  my_version integer;
  their_summary jsonb;
  their_version integer;
  shown public.discovery_impression;
  counted record;
  new_request uuid;
begin
  if actor is null then
    raise exception '로그인이 필요합니다.' using errcode = '28000';
  end if;

  if not public.is_active_account() then
    raise exception '이용이 정지된 계정입니다.' using errcode = '42501';
  end if;

  if p_candidate_user_id is null or p_candidate_user_id = actor then
    raise exception '지금은 이 사람에게 요청할 수 없습니다. 후보 목록을 새로 열어 확인해 주세요.'
      using errcode = '42501';
  end if;

  /** **묻기 전에 잠근다** — 자격 확인과 insert 사이에 낀 차단·입력 수정이 새 pending 을 놓친다. */
  perform public.lock_users(actor, p_candidate_user_id);

  /** **잠근 뒤에 나를 다시 본다** — 그 사이 커밋된 제재를 새 스냅숏이 본다. */
  if not public.is_active_account() then
    raise exception '이용이 정지된 계정입니다.' using errcode = '42501';
  end if;

  -- 내 쪽 자격은 갈라서 말한다. 내가 고칠 수 있는 것이고, 이유를 모르면 못 고친다.
  select p.element_summary into my_summary
  from public.discovery_profile p
  where p.user_id = actor and p.opted_in_at is not null;

  if my_summary is null then
    raise exception '매칭 참여를 먼저 켜 주세요.' using errcode = '42501';
  end if;

  if not public.my_summary_is_current(actor) then
    raise exception '내 오행 요약이 지금 입력의 것이 아닙니다.' using errcode = '55000';
  end if;

  /**
   * **셈 전에 사람 자물쇠를 잡는다** — `start_reading_run_for` 와 같은 자물쇠다(ADR 0106). 계정 행만
   * 잠그면 풀이 시작과 이 요청이 나란히 마지막 한 번을 읽고 둘 다 지나간다.
   */
  perform pg_advisory_xact_lock(hashtext('reading:user:' || actor::text));

  select * into counted from public.reading_credits_used(actor);

  if counted.used + counted.reserved + counted.requested >= public.reading_credit_limit_for(actor) then
    raise exception '풀이권이 없어 요청할 수 없습니다. 요청 한 건이 풀이권 한 번을 잡고, 동의가 나면 그 한 번으로 궁합 풀이가 만들어집니다.'
      using errcode = 'check_violation';
  end if;

  /** 상대 쪽은 **한 문장으로만** 거절하고, 자격은 후보 목록과 **같은 함수**에 묻는다. */
  if not public.discovery_eligible(actor, p_candidate_user_id) then
    raise exception '지금은 이 사람에게 요청할 수 없습니다. 후보 목록을 새로 열어 확인해 주세요.'
      using errcode = '42501';
  end if;

  select p.element_summary into their_summary
  from public.discovery_profile p
  where p.user_id = p_candidate_user_id;

  select pe.input_version into my_version
  from public.app_user u join public.person pe on pe.id = u.self_person_id
  where u.id = actor;

  select pe.input_version into their_version
  from public.app_user u join public.person pe on pe.id = u.self_person_id
  where u.id = p_candidate_user_id;

  /** **내가 본 그 카드**를 찾는다 — 요약 두 벌이 지금과 같은 기록만 고른다(ADR 0009). */
  select i.* into shown
  from public.discovery_impression i
  where i.viewer_user_id = actor
    and i.candidate_user_id = p_candidate_user_id
    and i.viewer_summary = my_summary
    and i.candidate_summary = their_summary
  order by i.shown_at desc
  limit 1;

  if their_summary is null or shown.id is null then
    raise exception '지금은 이 사람에게 요청할 수 없습니다. 후보 목록을 새로 열어 확인해 주세요.'
      using errcode = '42501';
  end if;

  insert into public.match_request (
    requester_user_id, addressee_user_id,
    requester_input_version, addressee_input_version,
    impression_id, policy_version,
    supplied_to_requester, supplied_to_addressee, balance_band
  )
  values (
    actor, p_candidate_user_id,
    my_version, their_version,
    shown.id, shown.policy_version,
    shown.supplied_elements,
    public.discovery_supplied_elements_v1(shown.candidate_summary, shown.viewer_summary),
    public.discovery_balance_band(shown.combined_balance)
  )
  returning id into new_request;

  insert into public.notification (user_id, kind, request_id)
  values (p_candidate_user_id, 'request_received', new_request);

  return new_request;

exception
  when unique_violation then
    raise exception '지금은 이 사람에게 요청할 수 없습니다. 후보 목록을 새로 열어 확인해 주세요.'
      using errcode = '42501';
end;
$function$;

-- ── 주문의 문 — 여는 것은 사람, 승인 · 취소 · 환불은 서버 ──────────────────────

/**
 * 주문을 연다 — **판매가 열렸을 때만.** 대기 주문은 아무것도 주지 않는다. 같은 열쇠로 다시 부르면 같은
 * 주문이 돌아온다(두 번 누름). 가격은 이 순간의 가격표에서 온다 — 부르는 쪽이 금액을 대지 않는다.
 *
 * @returns 주문 id · 제공자에게 건넬 주문 번호 · 금액
 */
create function public.open_reading_order(p_bundle_credits integer, p_provider text, p_idempotency_key text)
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

  select * into opened from public.reading_order o
  where o.user_id = actor and o.idempotency_key = p_idempotency_key;

  if not found then
    insert into public.reading_order (
      id, user_id, bundle_credits, amount, provider, provider_order_id, idempotency_key)
    select g.id, actor, p_bundle_credits, public.reading_bundle_price(p_bundle_credits), p_provider,
           'rdo_' || replace(g.id::text, '-', ''), p_idempotency_key
    from (select gen_random_uuid() as id) g
    returning * into opened;
  end if;

  return query select opened.id, opened.provider_order_id, opened.amount;
end;
$$;

/**
 * 결제를 승인으로 적고 묶음을 세운다 — **서버만**(`service_role`). 금액이 주문과 다르면 거절한다.
 * 같은 알림(`p_event_id`)이나 같은 거래 번호로 두 번 와도 묶음은 하나다.
 *
 * @returns 묶음 id
 */
create function public.approve_reading_order(
  p_order_id uuid, p_provider_payment_id text, p_amount integer, p_event_id text default null)
returns uuid
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  o public.reading_order;
  bundle uuid;
begin
  select * into o from public.reading_order where id = p_order_id for update;

  if not found then
    raise exception 'reading_order: no such order' using errcode = 'no_data_found';
  end if;

  if p_event_id is not null then
    insert into public.payment_event (provider, provider_event_id, order_id, kind, amount, outcome)
    values (o.provider, p_event_id, o.id, 'approved', p_amount,
            case when p_amount = o.amount then 'applied' else 'refused' end)
    on conflict (provider, provider_event_id) do nothing;

    if not found then
      select b.id into bundle from public.reading_bundle b where b.order_id = o.id;
      return bundle;
    end if;
  end if;

  if p_amount is distinct from o.amount then
    raise exception 'reading_order: the paid amount % is not the order amount %', p_amount, o.amount
      using errcode = '22023';
  end if;

  if o.status <> 'pending' then
    if o.provider_payment_id = p_provider_payment_id then
      select b.id into bundle from public.reading_bundle b where b.order_id = o.id;
      return bundle;
    end if;
    raise exception 'reading_order: the order is already %', o.status using errcode = '55000';
  end if;

  perform pg_advisory_xact_lock(hashtext('reading:user:' || o.user_id::text));

  update public.reading_order
  set status = 'approved', approved_at = now(), provider_payment_id = p_provider_payment_id
  where id = o.id;

  insert into public.reading_bundle (order_id, user_id, credits, price, currency, acquired_at)
  values (o.id, o.user_id, o.bundle_credits, o.amount, o.currency, now())
  returning id into bundle;

  return bundle;
end;
$$;

/** 결제 전에 닫힌 주문 — 실패 · 포기 · 기한 넘김. 서버만. 이미 닫혔으면 그대로 */
create function public.cancel_reading_order(p_order_id uuid, p_reason text)
returns text
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  o public.reading_order;
begin
  select * into o from public.reading_order where id = p_order_id for update;

  if not found then
    raise exception 'reading_order: no such order' using errcode = 'no_data_found';
  end if;

  if o.status <> 'pending' then
    return o.status;
  end if;

  update public.reading_order
  set status = 'cancelled', closed_at = now(), close_reason = p_reason
  where id = o.id;

  return 'cancelled';
end;
$$;

/**
 * 환불을 적는다 — 서버만. **산식은 없다**(G-25 ⑥): 금액과 걷을 회차는 사람이 `operator_reading_refund_basis`
 * 를 읽고 정한다. 걷는 회차는 그 묶음의 **안 쓴** 것을 넘지 못한다 — 예약 중인 것은 풀릴 때까지 안 쓴 것이
 * 아니다(G-21 ③). 제공자 환불 번호가 같으면 한 번만 적힌다.
 *
 * @returns 주문의 새 상태
 */
create function public.refund_reading_order(
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
  taken integer;
begin
  select * into o from public.reading_order where id = p_order_id for update;

  if not found then
    raise exception 'reading_order: no such order' using errcode = 'no_data_found';
  end if;

  if p_provider_refund_id is not null and exists (
    select 1 from public.reading_order_refund f
    where f.order_id = o.id and f.provider_refund_id = p_provider_refund_id)
  then
    return o.status;
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

-- ── 운영자 — 환불 셈의 입력을 한 번에 (ADR 0105 의 규칙: 읽을 때마다 적는다) ──────

alter table audit.operator_access drop constraint operator_access_action_check;
alter table audit.operator_access add constraint operator_access_action_check
  check (action in ('reports.list', 'reports.detail', 'reports.snapshot', 'credits.refund_basis', 'cli.query'));
alter table audit.operator_access drop constraint app_access_names_the_operator;
alter table audit.operator_access add constraint app_access_names_the_operator check (
  channel <> 'app' or (actor_user_id is not null and actor_name is null and purpose is null
                       and sql_sha256 is null and (action like 'reports.%' or action like 'credits.%')));

/**
 * 주문 하나를 들고 그 계정의 주문 전부를 묶음별로 — 산 수 · 쓴 수 · 예약 중 수 · 안 쓴 수 · 결제 금액 ·
 * 결제 시각 · 이미 환불한 것. 어느 산식(G-25 ⑥)이든 이것으로 셈한다. 읽기 전에 풀린 예약을 정리한다.
 * 운영자만, 읽을 때마다 접속기록에 한 줄(주문 id 만 — 개인을 가리키는 값을 안 적는다).
 */
create function public.operator_reading_refund_basis(p_order_id uuid)
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
         else b.credits - b.refunded_credits - coalesce(u.used, 0) - coalesce(u.reserved, 0) end,
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

  if (select count(*) from audit.operator_access a
      where a.actor_user_id = actor and a.outcome = 'denied'
        and a.at > clock_timestamp() - interval '1 hour') >= 30 then
    return;
  end if;

  perform audit.note_app_access(p_action, p_report_id, null, 'denied');
end;
$$;

-- ── 떠난 사람의 결제 기록 — 5년 따로 ──────────────────────────────────────────

/** 얼마나 두나 — 마지막 결제 사건(승인 · 환불)부터. 전자상거래법 시행령 제6조①2 · 3 (G-25 ②) */
create function retention.payment_period()
returns interval
language sql
immutable
set search_path = ''
as $$ select interval '5 years' $$;

/**
 * 떠난 사람의 결제 한 건 — 승인된 적 있는 주문만(결제 전에 닫힌 주문은 거래가 아니다). 묶음 · 쓰임 · 환불 ·
 * 알림은 jsonb 로 옮긴다. 계정에 FK 로 매지 않는다 — 가리키는 사람이 떠난 뒤에 서는 기록이다.
 */
create table retention.reading_payment (
  order_id uuid primary key,
  user_id uuid not null,
  provider text not null,
  provider_order_id text not null,
  provider_payment_id text not null,
  bundle_credits integer not null,
  amount integer not null,
  currency text not null,
  status text not null,
  refunded_amount integer not null,
  ordered_at timestamptz not null,
  approved_at timestamptz not null,
  last_refunded_at timestamptz,
  /** 묶음 — 산 수 · 가격 · 산 때 · 걷은 수 · 떠날 때의 쓴 수와 쓰임 목록 */
  bundle jsonb not null,
  refunds jsonb not null default '[]'::jsonb,
  events jsonb not null default '[]'::jsonb,
  /** 떠난 때 — 옮긴 순간 */
  left_at timestamptz not null default now(),
  /** 지울 때 — 마지막 결제 사건 + 5년 */
  keep_until timestamptz not null,
  /** 보존 보류 — 분쟁 · 수사기관의 적법한 요청이 걸렸다. 사유가 끝나면 비운다 */
  hold_reason text check (hold_reason is null or length(btrim(hold_reason)) between 1 and 500),
  held_at timestamptz,
  constraint hold_has_a_time check ((hold_reason is null) = (held_at is null))
);

comment on table retention.reading_payment is
  '떠난 사람의 결제 기록 — 마지막 결제 사건부터 5년 뒤 크론이 지운다. 앱은 못 읽는다 (G-25 ②, ADR 0106)';

create index retention_payment_expiry on retention.reading_payment (keep_until) where hold_reason is null;

alter table retention.reading_payment enable row level security;
revoke all on retention.reading_payment from public, anon, authenticated, service_role;

/** 옮긴 기록은 고치지 못한다 — 보류 두 칸만 */
create function retention.refuse_payment_update()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if (to_jsonb(new) - array['hold_reason', 'held_at']) is distinct from (to_jsonb(old) - array['hold_reason', 'held_at']) then
    raise exception 'retention: the retained payment is immutable' using errcode = '55000';
  end if;
  return new;
end;
$$;

create trigger retained_payment_is_immutable
before update on retention.reading_payment
for each row execute function retention.refuse_payment_update();

/** 떠나기 **전에** 그 사람의 결제를 옮긴다 — `auth.users` 의 `before delete`(ADR 0098 과 같은 자리) */
create function retention.keep_payments_of_leaver()
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

  return old;
end;
$$;

create trigger payments_outlive_the_leaver
before delete on auth.users
for each row execute function retention.keep_payments_of_leaver();

comment on constraint reading_order_user_id_fkey on public.reading_order is
  '떠나면 지운다 — 그 전에 auth.users 의 트리거(payments_outlive_the_leaver)가 retention.reading_payment 로 옮겼다 (ADR 0106)';

/** 5년이 지난 줄을 지운다 — 보류가 걸린 줄은 남긴다. @returns 이번에 지운 수 */
create function retention.purge_expired_payments()
returns integer
language plpgsql
set search_path = ''
as $$
declare
  gone integer;
begin
  with purged as (
    delete from retention.reading_payment k
    where k.keep_until <= now() and k.hold_reason is null
    returning 1
  )
  select count(*)::integer into gone from purged;
  return gone;
end;
$$;

-- ── 권한 — 여는 문 둘만 로그인한 사람에게, 승인 · 취소 · 환불은 서버에게 ─────────

revoke execute on function
  public.reading_bundle_price(integer),
  public.reading_sale_is_open(),
  public.reading_order_moves(),
  public.reading_bundle_moves(),
  public.reading_credit_use_moves(),
  public.reading_credit_shares(uuid),
  public.settle_reading_credit_uses(uuid),
  public.pick_reading_credit_share(uuid),
  public.book_reading_credit_for_run(),
  public.settle_reading_credit_for_run(),
  public.book_reading_credit_for_request(),
  public.settle_reading_credit_for_request(),
  public.open_reading_order(integer, text, text),
  public.approve_reading_order(uuid, text, integer, text),
  public.cancel_reading_order(uuid, text),
  public.refund_reading_order(uuid, integer, integer, text, text),
  public.operator_reading_refund_basis(uuid)
  from public, anon, authenticated, service_role;

revoke execute on all functions in schema retention from public, anon, authenticated, service_role;

grant execute on function public.open_reading_order(integer, text, text) to authenticated;
grant execute on function public.operator_reading_refund_basis(uuid) to authenticated;
grant execute on function public.approve_reading_order(uuid, text, integer, text) to service_role;
grant execute on function public.cancel_reading_order(uuid, text) to service_role;
grant execute on function public.refund_reading_order(uuid, integer, integer, text, text) to service_role;

/** 이름으로 지우고 다시 건다. 매일 04:53 UTC — 다른 잡(매분 · 7 · 23 · 10분마다 · 47)과 안 겹친다 */
select cron.unschedule('payment-retention-purge')
where exists (select 1 from cron.job where jobname = 'payment-retention-purge');

select cron.schedule('payment-retention-purge', '53 4 * * *', 'select retention.purge_expired_payments()');
