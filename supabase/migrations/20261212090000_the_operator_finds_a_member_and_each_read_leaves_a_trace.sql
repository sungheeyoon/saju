-- 운영자가 회원 한 명을 닉네임이나 계정 id 로 찾아 상태 · 풀이권 · 경고를 보고, 읽을 때마다 접속기록에 한 줄이 남는다
-- (G-110 ③, ADR 0185)
--
-- 그 전에는 회원을 찾는 화면이 없었다 — 풀이권 문의 · 이의 제기 · 환불을 받으면 운영자는 runbook 의 SQL 로 계정을 찾아야
-- 했고, 이메일로 계정을 찾는 것은 break-glass 다(`docs/ops/runbook/access.md`). 신고 화면(`/ops/reports`)과 같은 경계로 문
-- 둘을 세운다.
--
-- ## 찾는 열쇠 — 닉네임 또는 계정 id, 이메일은 아니다
--
-- 운영 화면은 이미 계정을 닉네임과 내부 UUID 로만 가른다(`/ops/reports`). 이의 제기 메일도 「답장으로 닉네임을 물어
-- `/ops/reports` 에서 찾는다」가 절차다(ADR 0108). 닉네임은 유일하므로(`app_user_nickname_is_unique`, `nickname_key`)
-- 찾으면 한 명이다 — 목록을 내지 않는다. 이메일은 문이 받지도 내지도 않는다.
--
-- ## 보여 주는 칸 — G-110 이 든 넷만
--
-- 상태 · 산 풀이권 · 쓴 풀이권 · 경고 이력, 그리고 주문 화면으로 가는 주문 번호. 출생정보 · 풀이 · 저장한 사람 · 이메일 · 주문 금액은 안 낸다(주문은 G-110 ② 의
-- 화면이 주문 번호로 읽는다). 경고 이력은 지금 계정의 신고(`public.report`)에서 이 계정이 제재 대상인 줄뿐이다 — 판단 근거
-- (`review_note`) · 신고한 사람은 안 낸다. 떠난 사람의 신고로 옮겨진 경고(`retention.report`)는 떨어진 보관이라(ADR 0098)
-- 앱이 읽는 길을 새로 내지 않는다.
--
-- ## 접속기록 — 신고 문과 같은 원칙 (`20261010100000` · `20261116090000`)
--
-- - **문이 적는다** — 둘 다 `volatile` 이고 성공한 읽기를 같은 트랜잭션에서 적는다. 동작은 `members.find` ·
--   `members.warnings`.
-- - **찾은 말을 적지 않는다** — 닉네임은 이용자 개인정보다(반출본은 지울 수 없다). 거른 조건 칸에는 무엇으로 찾았는가
--   (`by=nickname|id`)와 찾은 계정의 내부 id(`user=<uuid>`, 없으면 `user=none`)만 적는다 — 대장의 「대상」이 계정 UUID 인
--   것과 같다(`docs/ops/runbook/access.md`). 주문의 환불 셈이 `order=<id>` 를 적는 것과 같은 칸이다.
-- - **거절은 문 밖에서** — 앱의 문이 `note_operator_denial('members.find')` 를 제 트랜잭션에서 부른다.
--
-- 반출은 동작을 걸러 내지 않고 칸이 그대로라 묶음 `version` 은 그대로다.
--
-- 재는 자리는 `supabase/tests/97_operator_member.test.sql`.

-- ---------------------------------------------------------------------------
-- 1. 기록 표가 회원 동작을 받는다 — `20261116090000` 의 목록에 둘을 더한다
-- ---------------------------------------------------------------------------

alter table audit.operator_access drop constraint operator_access_action_check;
alter table audit.operator_access add constraint operator_access_action_check
  check (action in ('reports.list', 'reports.detail', 'reports.snapshot', 'credits.refund_basis',
                    'audit.export_status',
                    'survey.overview', 'survey.by_version', 'survey.tags', 'survey.comments',
                    'survey.service_overview', 'survey.service_counts', 'survey.service_texts',
                    'members.find', 'members.warnings',
                    'cli.query', 'cli.result'));

alter table audit.operator_access drop constraint app_access_names_the_operator;
alter table audit.operator_access add constraint app_access_names_the_operator check (
  channel <> 'app' or (actor_user_id is not null and actor_name is null and purpose is null
                       and sql_sha256 is null and result_of is null and result is null and error_class is null
                       and (action like 'reports.%' or action like 'credits.%' or action like 'audit.%'
                            or action like 'survey.%' or action like 'members.%')));

-- ---------------------------------------------------------------------------
-- 2. 회원 한 명 — 상태와 풀이권
-- ---------------------------------------------------------------------------

/**
 * 닉네임이나 계정 id 로 회원 한 명을 찾는다 (G-110 ③). 없으면 빈 결과다 — 없는 것도 한 줄로 적힌다. `null` 이면 운영자인가만
 * 묻고 빈 결과다(적지 않는다) — 찾는 말 없이 연 화면이 거절을 받아 404 가 되게.
 *
 * 풀이권은 쓰임 장부(`reading_credit_use`)와 묶음(`reading_bundle`)에서 센다 — 환불 셈(`operator_reading_refund_basis`)과
 * 같은 입력이다. 세기 전에 셈이 이미 풀어 준 예약을 장부에서도 푼다(`settle_reading_credit_uses`) — 환불 셈과 같다.
 *
 * - `bought_credits` · `refunded_credits` — 묶음의 산 회차 합 · 걷은 회차 합
 * - `used_bought` · `reserved_bought` — 산 묶음에서 확정된 쓰임 · 지금 예약 중인 쓰임
 * - `used_all` — 몫(무료 · 예외 · 묶음 · 몫 밖)을 가리지 않은 확정된 쓰임
 * - `order_numbers` — 승인된 적 있는 주문의 번호(`rdo_…`), 최근 것부터. 주문 화면(`/ops/orders?order=`)으로 가는 길이다 —
 *   금액 · 상태는 그 화면이 주문 번호로 읽는다(G-110 ②)
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
  order_numbers text[]
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
  select
    a.id,
    a.nickname,
    a.status,
    coalesce((select sum(b.credits) from public.reading_bundle b where b.user_id = a.id), 0)::integer,
    coalesce((select sum(b.refunded_credits) from public.reading_bundle b where b.user_id = a.id), 0)::integer,
    (select count(*) from public.reading_credit_use u
     where u.user_id = a.id and u.share = 'bundle' and u.state = 'confirmed')::integer,
    (select count(*) from public.reading_credit_use u
     where u.user_id = a.id and u.share = 'bundle' and u.state = 'reserved')::integer,
    (select count(*) from public.reading_credit_use u
     where u.user_id = a.id and u.state = 'confirmed')::integer,
    (select coalesce(array_agg(o.provider_order_id order by o.approved_at desc, o.id), '{}')
     from public.reading_order o where o.user_id = a.id and o.approved_at is not null)
  from public.app_user a
  where a.id = found;
end;
$$;

-- ---------------------------------------------------------------------------
-- 3. 회원 한 명의 경고 이력
-- ---------------------------------------------------------------------------

/**
 * 이 계정이 제재 대상으로 적힌 검토 — 경고와 이용 정지 결정, 최근 것부터 (G-110 ③, ADR 0107 · 0108).
 *
 * 줄마다 신고 id(상세 화면으로 가는 길) · 검토한 때 · 결과 · 안내번호 · 경고 갈래 · 이용자가 확인한 때, 그리고
 * `counted` — 경고 3회째의 셈에 드는가(경고이고 `reviewed_at` 이 12개월 안, ADR 0108 추기). 판단 근거 · 신고한 사람은 안 낸다.
 *
 * 이의 제기를 인정해 조치 없음으로 고친 경고는 제재 대상이 비므로(`sanction_follows_the_outcome`) 여기 안 선다 — 셈에서도
 * 빠진 것이다. 그 경고는 안내번호로 `/ops/reports` 에서 찾는다.
 */
create function public.operator_member_warnings(p_user_id uuid)
returns table (
  report_id uuid,
  reviewed_at timestamptz,
  review_outcome text,
  warning_ref text,
  warning_category text,
  warning_acknowledged_at timestamptz,
  counted boolean
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

  perform audit.note_app_access('members.warnings', null, format('user=%s', p_user_id), 'allowed');

  return query
  select
    r.id,
    r.reviewed_at,
    r.review_outcome,
    r.warning_ref,
    r.warning_category,
    r.warning_acknowledged_at,
    r.review_outcome = 'warning' and r.reviewed_at > now() - interval '12 months'
  from public.report r
  where r.sanctioned_user_id = p_user_id
    and r.review_outcome in ('warning', 'suspension')
  order by r.reviewed_at desc, r.id desc;
end;
$$;

revoke execute on function public.operator_member(text) from anon, public, service_role;
revoke execute on function public.operator_member_warnings(uuid) from anon, public, service_role;
grant execute on function public.operator_member(text) to authenticated;
grant execute on function public.operator_member_warnings(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- 4. 거절을 적는 문이 회원 동작을 받는다 — 몸은 `20261116090000` 그대로
-- ---------------------------------------------------------------------------

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
                         'survey.overview', 'survey.by_version', 'survey.tags', 'survey.comments',
                         'survey.service_overview', 'survey.service_counts', 'survey.service_texts',
                         'members.find', 'members.warnings') then
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
