-- 처분 이력이 신고로 건 정지를 결과를 바꾼 뒤에도 잃지 않고, 풀이권 이력은 첫 줄까지 거슬러 읽힌다 (G-111 ① · ③, ADR 0188 · 0189 · 0187 덧)
--
-- 운영 `fa0d43a` 의 읽기 검토가 찾은 둘이다.
--
-- 1. **처분 이력에서 정지가 사라졌다.** 신고의 「이용 정지 결정」이 계정을 정지한 뒤 그 신고의 결과를 「조치 없음」 등으로 바꾸면 계정은
--    정지인 채인데(결과를 바꿔도 정지를 풀지 않는다, ADR 0188), 회원 화면의 처분 이력(`operator_member_sanctions`)과 신고 상세의
--    「처분 이력 최근 셋」(`operator_report_target`) 어디에도 그 정지가 안 보였다 — 신고 줄은 **지금** 결과가 경고 · 이용 정지
--    결정일 때만 읽고, 상태 이력 줄은 갈래 `report` 를 늘 뺐다(두 번 세지 않으려고).
--    **고친 규칙** — 갈래 `report` 의 상태 이력 줄은 **그 신고의 지금 결과가 이 계정을 대상으로 한 이용 정지 결정일 때만** 뺀다(그때는
--    신고 줄이 그 이야기를 한다). 그 밖에는 남긴다 — 실제로 계정을 바꾼 정지 · 해제는 늘 목록에 선다. 두 함수의 서명 · 돌려주는
--    칸은 그대로고 몸만 바꾼다(`create or replace`) — 지금 운영의 앱에 안전하다.
-- 2. **풀이권 이력이 300줄에서 멈췄다.** 화면은 「더 보기」로 30줄씩 늘려 300 에서 단추를 감췄고, DB 는 한 번에 500 까지 받았다.
--    이 마이그레이션이 이력 문(`operator_member_credit_history`)에 **커서**를 더한다 — 앞 쪽의 마지막 줄의 시각(`p_before_at`)과
--    그 줄의 열쇠(`p_before_key`, 돌려주는 새 칸 `line_key`). 그 줄보다 오래된 것부터 `p_limit` 줄이다. 둘 다 `default null` 이라
--    지금 운영의 앱(인자 셋)이 그대로 부른다 — 인자를 **더하기만** 했다(`docs/ops/runbook/deploy.md` 「규약 넷」의 2). 같은 이름의
--    옛 서명을 남기면 인자 셋의 부름이 두 함수 사이에서 모호해지므로 옛 것을 지우고 새 것을 세운다 — 옛 앱의 부름은 새 것이 받는다.
--    돌려주는 칸이 하나 느는 것은 안전하다(옛 앱은 아는 칸만 집는다).
--
-- ## 바꾸지 않는 것
--
-- - 접속기록 — 이력을 읽을 때마다 `members.credit_history` 한 줄(`user=<id>`, id 만). 커서는 적지 않는다.
-- - 처분 이력 · 대상 요약의 나머지(지금 상태 · 읽은 버전 · 12개월 경고 수 · 200줄 · 셋)와 신고 줄의 규칙(지금 결과가 경고 · 이용 정지
--   결정인 신고만).
-- - 이력의 줄 순서 — 시각 최근 것부터, 같은 시각이면 종류 · 원본 id(뒤집어) 차례다. 커서는 이 차례의 「그 줄 다음」이다.
--
-- 재는 자리는 `supabase/tests/99_operator_member_history_reads_back.test.sql`.

-- ---------------------------------------------------------------------------
-- 1. 회원 화면의 처분 이력 — `20261216090000` 의 몸에서 상태 이력 줄을 빼는 조건만 바꿨다
-- ---------------------------------------------------------------------------

/**
 * 한 회원의 처분 이력 — 한 줄(없는 계정이면 빈 결과).
 *
 * - `status` · `is_operator` — 지금 상태와 운영자 계정인가. 화면이 단추(「이용 정지」 · 「정지 해제」)를 고르고, 운영자 계정이면
 *   정지 단추를 세우지 않는다(G-111-10). 최종으로 막는 것은 공통 함수다.
 * - `version` — 그 계정의 상태 이력 줄 수. 정지 · 해제 문이 받는 「읽은 버전」이다.
 * - `warnings_12m` — **현재 신고 기준** 최근 12개월 경고 수(ADR 0108 추기 — `operator_member_warnings` 의 `counted` 와 같은 셈).
 * - `lines` — 최근 것부터, 200줄까지. 두 갈래:
 *   - 신고 처분(`source = 'report'`) — 이 계정이 제재 대상인 경고 · 이용 정지 결정(**지금** 결과). 신고 id · 갈래 · 안내번호 · 이용자
 *     확인 · 12개월 셈 · 실행자 닉네임(`reviewed_by`). 판단 근거는 안 낸다 — 신고 상세가 든다. 떠난 사람의 신고(`retention.report`)는
 *     읽지 않는다(G-110 의 경계).
 *   - 계정 상태(`source = 'status'`) — 정지 · 해제로 바뀐 줄. 신고의 정지 결정이 건 정지(갈래 `report`)는 **그 신고의 지금 결과가 이
 *     계정의 이용 정지 결정이면** 위 신고 줄이 이미 말하므로 빼고, 결과를 바꿨거나 대상이 바뀌었거나 신고가 일반 표에 없으면 남긴다
 *     (ADR 0188 의 16 덧) — 실제로 계정을 바꾼 정지는 늘 목록에 선다. 읽은 버전에는 늘 든다. `kind` 가 `suspended` · `active`, 앞 상태는
 *     `from_status` — 탈퇴 대기의 해제도 `active` 다. 갈래 · 메모 · 관련 신고 · 실행자 닉네임, 그리고 `recorded` — 갈래 · 실행자가
 *     비었으면 공통 함수 밖의 변경이다(화면이 「실행자 · 사유 없음」 딱지를 단다).
 *
 * 실행자는 닉네임으로만 낸다(G-111-9) — 내부 기록은 UUID 그대로다.
 */
create or replace function public.operator_member_sanctions(p_user_id uuid)
returns table (
  status text,
  is_operator boolean,
  version integer,
  warnings_12m integer,
  lines jsonb
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

  perform audit.note_app_access('members.sanctions', null, format('user=%s', p_user_id), 'allowed');

  return query
  select
    a.status,
    exists (select 1 from public.operator o where o.user_id = a.id),
    (select count(*)::integer from public.account_status_change c where c.user_id = a.id),
    (select count(*)::integer from public.report w
     where w.sanctioned_user_id = a.id and w.review_outcome = 'warning'
       and w.reviewed_at > now() - interval '12 months'),
    coalesce((
      select jsonb_agg(to_jsonb(h) order by h.at desc, h.id desc)
      from (
        select x.*
        from (
          select
            r.id,
            'report'::text as source,
            r.reviewed_at as at,
            r.review_outcome as kind,
            null::text as from_status,
            r.warning_category as reason,
            null::text as note,
            r.id as report_id,
            r.warning_ref,
            r.warning_acknowledged_at as acknowledged_at,
            r.review_outcome = 'warning' and r.reviewed_at > now() - interval '12 months' as counted,
            true as recorded,
            (select n.nickname from public.app_user n where n.id = r.reviewed_by) as actor_nickname
          from public.report r
          where r.sanctioned_user_id = a.id and r.review_outcome in ('warning', 'suspension')
          union all
          select
            c.id,
            'status',
            c.at,
            c.to_status,
            c.from_status,
            c.reason,
            c.note,
            c.report_id,
            null,
            null,
            false,
            c.reason is not null,
            (select n.nickname from public.app_user n where n.id = c.actor_user_id)
          from public.account_status_change c
          where c.user_id = a.id and c.to_status in ('suspended', 'active')
            -- 신고 줄이 이 정지를 말할 때만 뺀다 — 결과를 바꾼 뒤에도 정지는 계정에 남아 있다
            and (c.reason is distinct from 'report'
                 or not exists (select 1 from public.report s
                                where s.id = c.report_id and s.sanctioned_user_id = c.user_id
                                  and s.review_outcome = 'suspension'))
        ) x
        order by x.at desc, x.id desc
        limit 200
      ) h), '[]'::jsonb)
  from public.app_user a
  where a.id = p_user_id;
end;
$$;

-- ---------------------------------------------------------------------------
-- 2. 신고 상세의 대상 회원 요약 — `20261215090000` 의 몸에서 같은 조건만 바꿨다
-- ---------------------------------------------------------------------------

/**
 * 신고의 두 계정 — 신고받은 계정 · 신고한 계정 한 줄씩. 지금 상태 · 운영자 계정인가 · **현재 신고 기준** 최근 12개월 경고 수와
 * 이 신고의 경고가 그 수에 들었는가(`warned_here` — 이 신고를 다시 경고로 적을 때 두 번 세지 않게), 그리고 처분 이력 최근 셋
 * (신고의 경고 · 이용 정지 결정과 계정 상태 이력 — 신고로 건 정지는 그 신고의 지금 결과가 이용 정지 결정일 때만 신고 줄 하나로
 * 선다, 회원 화면의 처분 이력과 같은 규칙). 판단 근거 · 메모 · 신고한 사람은 안 낸다. 떠난 사람의 신고(`retention.report`)는
 * 세지 않는다(G-110 의 경계).
 */
create or replace function public.operator_report_target(p_report_id uuid)
returns table (
  side text,
  user_id uuid,
  nickname text,
  status text,
  is_operator boolean,
  warnings_12m integer,
  warned_here boolean,
  recent jsonb
)
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  found_report public.report;
begin
  if not public.is_operator() then
    raise exception '운영자만 읽는 자리입니다.' using errcode = '42501';
  end if;

  select * into found_report from public.report r where r.id = p_report_id;

  perform audit.note_app_access(
    'reports.target', p_report_id,
    case when found_report.id is null then 'user=none'
         else format('reported=%s reporter=%s', found_report.reported_user_id, found_report.reporter_user_id) end,
    'allowed');

  if found_report.id is null then
    return;
  end if;

  return query
  select
    p.side,
    a.id,
    a.nickname,
    a.status,
    exists (select 1 from public.operator o where o.user_id = a.id),
    (select count(*)::integer from public.report w
     where w.sanctioned_user_id = a.id and w.review_outcome = 'warning'
       and w.reviewed_at > now() - interval '12 months'),
    found_report.review_outcome is not distinct from 'warning'
      and found_report.sanctioned_user_id is not distinct from a.id
      and found_report.reviewed_at > now() - interval '12 months',
    coalesce((
      select jsonb_agg(jsonb_build_object('at', h.at, 'kind', h.kind, 'reason', h.reason, 'report_id', h.report_id)
                       order by h.at desc)
      from (
        select x.at, x.kind, x.reason, x.report_id
        from (
          select w.reviewed_at as at, w.review_outcome as kind, w.warning_category as reason, w.id as report_id
          from public.report w
          where w.sanctioned_user_id = a.id and w.review_outcome in ('warning', 'suspension')
          union all
          select c.at, c.to_status, c.reason, c.report_id
          from public.account_status_change c
          where c.user_id = a.id and c.to_status in ('suspended', 'active')
            -- 신고의 이용 정지 결정이 건 정지는 그 결정이 지금도 서 있을 때만 위 신고 줄이 말한다 — 한 번의 정지가 두 칸을 먹지
            -- 않게, 그리고 결과를 바꾼 뒤에도 정지가 사라지지 않게
            and (c.reason is distinct from 'report'
                 or not exists (select 1 from public.report s
                                where s.id = c.report_id and s.sanctioned_user_id = c.user_id
                                  and s.review_outcome = 'suspension'))
        ) x
        order by x.at desc
        limit 3
      ) h), '[]'::jsonb)
  from (values ('reported', found_report.reported_user_id), ('reporter', found_report.reporter_user_id)) p(side, id)
  join public.app_user a on a.id = p.id;
end;
$$;

-- ---------------------------------------------------------------------------
-- 3. 풀이권 이력 — 커서. `20261214090000` 의 몸에 커서 둘과 돌려주는 칸 `line_key` 를 더했다
-- ---------------------------------------------------------------------------

drop function public.operator_member_credit_history(uuid, text, integer);

/**
 * 한 회원의 풀이권 이력 — 구매 · 환불 · 사용 · 지급 · 회수를 한 목록에 최근 것부터.
 *
 * 줄마다 출처(`free` · `grant` · `bundle` · `outside`)와 증감 사유. 수(`delta`)는 늘고 준 것만 부호가 있다 — 확정 사용은 −1, 예약
 * (`state = 'reserved'`)과 반환(`released`)은 `null` 이다(차감이 아니다). 사용 줄은 **무엇을 풀었는지 적지 않는다** — 시도인가
 * 요청인가(`cause`)와 상태뿐이다(ADR 0185 의 2). 구매 · 환불 줄은 수량과 주문 번호만이고 금액은 주문 화면이 든다.
 *
 * 차례는 시각 최근 것부터, 같은 시각이면 종류 · 원본 id(뒤집어)다. `line_key`(`<종류>:<원본 id>`)는 그 차례 안에서 줄 하나를 가른다.
 *
 * @param p_filter `all` · `orders`(구매 · 환불) · `grants`(지급 · 회수) · `uses`(사용)
 * @param p_limit 줄 수 — 화면은 하나 더 청해 「더 보기」를 안다
 * @param p_before_at · p_before_key 앞 쪽의 마지막 줄의 `at` · `line_key` — 둘 다 주면 그 줄 다음부터, 둘 다 비면 맨 앞부터
 */
create function public.operator_member_credit_history(
  p_user_id uuid,
  p_filter text,
  p_limit integer,
  p_before_at timestamptz default null,
  p_before_key text default null)
returns table (
  at timestamptz,
  kind text,
  source text,
  delta integer,
  state text,
  cause text,
  reason text,
  note text,
  order_number text,
  actor_nickname text,
  report_id uuid,
  carried_over boolean,
  line_key text
)
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  before_kind text;
  before_tie text;
begin
  if not public.is_operator() then
    raise exception '운영자만 읽는 자리입니다.' using errcode = '42501';
  end if;

  if p_filter is null or p_filter not in ('all', 'orders', 'grants', 'uses') then
    raise exception 'operator: filter is all, orders, grants or uses' using errcode = '22023';
  end if;

  if p_limit is null or p_limit not between 1 and 500 then
    raise exception 'operator: limit is 1 to 500' using errcode = '22023';
  end if;

  -- 커서는 둘이 한 벌이다 — 하나만 오면 「그 줄 다음」을 정하지 못한다
  if (p_before_at is null) <> (p_before_key is null) then
    raise exception 'operator: cursor is a time and a key together' using errcode = '22023';
  end if;

  if p_before_key is not null then
    before_kind := split_part(p_before_key, ':', 1);
    before_tie := substr(p_before_key, length(before_kind) + 2);
    if before_kind not in ('purchase', 'refund', 'use', 'grant', 'revoke') or before_tie = '' then
      raise exception 'operator: cursor key is <kind>:<id>' using errcode = '22023';
    end if;
  end if;

  perform audit.note_app_access('members.credit_history', null, format('user=%s', p_user_id), 'allowed');

  perform public.settle_reading_credit_uses(p_user_id);

  return query
  select h.at, h.kind, h.source, h.delta, h.state, h.cause, h.reason, h.note, h.order_number,
         (select a.nickname from public.app_user a where a.id = h.actor), h.report_id, h.carried_over,
         h.kind || ':' || h.tie
  from (
    select b.acquired_at as at, 'purchase'::text as kind, 'bundle'::text as source, b.credits as delta,
           null::text as state, null::text as cause, null::text as reason, null::text as note,
           o.provider_order_id as order_number, null::uuid as actor, null::uuid as report_id,
           false as carried_over, b.id::text as tie
    from public.reading_bundle b
    join public.reading_order o on o.id = b.order_id
    where b.user_id = p_user_id and p_filter in ('all', 'orders')
    union all
    select f.refunded_at, 'refund', 'bundle', -f.credits, null, null, f.reason, null,
           o.provider_order_id,
           (select h.held_by from public.reading_refund_hold h
            where h.order_id = f.order_id and h.provider_refund_id = f.provider_refund_id
            order by h.held_at desc limit 1),
           null, false, f.id::text
    from public.reading_order_refund f
    join public.reading_order o on o.id = f.order_id
    where o.user_id = p_user_id and p_filter in ('all', 'orders')
    union all
    select coalesce(u.released_at, u.confirmed_at, u.reserved_at), 'use', u.share,
           case when u.state = 'confirmed' then -1 end,
           u.state, u.source, null, null, null, null, null, false, u.id::text
    from public.reading_credit_use u
    where u.user_id = p_user_id and p_filter in ('all', 'uses')
    union all
    select e.at, e.kind, 'grant', case e.kind when 'grant' then e.credits else -e.credits end,
           null, null, e.reason, e.note, null, e.actor_user_id, e.report_id, e.carried_over, e.id::text
    from public.reading_credit_grant_entry e
    where e.user_id = p_user_id and p_filter in ('all', 'grants')
  ) h
  -- 아래 차례(시각 ↓ · 종류 ↑ · 원본 id ↓)에서 커서 줄보다 뒤인 것만
  where p_before_at is null
     or h.at < p_before_at
     or (h.at = p_before_at and (h.kind > before_kind or (h.kind = before_kind and h.tie < before_tie)))
  order by h.at desc, h.kind, h.tie desc
  limit p_limit;
end;
$$;

revoke execute on function public.operator_member_credit_history(uuid, text, integer, timestamptz, text)
  from public, anon, service_role;
grant execute on function public.operator_member_credit_history(uuid, text, integer, timestamptz, text) to authenticated;
