-- 운영자가 오늘 · 이번 주(서울 시간)의 가입 · 풀이 · 주문 · 매출 · 환불 수를 본다 (G-110 ①, ADR 0183)
--
-- 지금까지 이 수는 런북 SQL(`docs/ops/runbook/credits.md` 「주문 조회」)로만 읽혔다. `/ops/today` 의 문
-- (`app/ops/today/read.ts`)이 부르는 운영자 문 하나를 세운다.
--
-- ## 무엇을 세나 — ADR 0183
--
-- - **기간** — 서울 날짜의 0시부터 지금까지(오늘), 서울 날짜로 그 주 월요일 0시부터 지금까지(이번 주). 경계는 DB 가 짓는다 —
--   화면 · 서버의 시계는 Vercel 이 UTC 라 「오늘」이 아홉 시간 어긋난다.
-- - **가입** — 가입을 마친 시각(`app_user.signed_up_at`)이 기간 안인 계정.
-- - **풀이** — 성공으로 끝난 시도(`reading_run.status = 'succeeded'`)의 끝난 시각(`finished_at`)이 기간 안. 실패 · 도는 중은 안 센다.
-- - **주문 · 매출** — 결제가 승인된 시각(`reading_order.approved_at`)이 기간 안인 주문 수와 그 결제 금액의 합. 나중에 환불된
--   주문도 승인된 날의 매출에 그대로 든다 — 돌려준 돈은 환불 칸이 따로 센다.
-- - **환불** — 환불을 적은 시각(`reading_order_refund.refunded_at`)이 기간 안인 환불 줄 수와 금액 합. 한 주문을 두 번 나눠 돌려주면 둘이다.
--
-- 떠난 사람의 주문 · 시도는 표에서 빠지므로(결제 기록은 `retention.*` 으로 옮는다) 지난 수가 줄 수 있다 — 장부의 원본은
-- 이 화면이 아니라 PG 정산과 런북 SQL 이다.
--
-- ## 접속기록 — 설문 문과 같은 원칙 (`20261116090000`)
--
-- - **문이 적는다** — 성공한 읽기를 같은 트랜잭션에서 한 줄(`today.figures`). 대상 · 거른 조건 칸은 비운다 — 개인을 가리키지 않는 집계다.
-- - **거절은 문 밖에서** — 운영자가 아니면 `42501` 을 던지고, 앱의 문이 `note_operator_denial('today.figures')` 를 부른다.
--
-- ## 옛 앱에 안전하다
--
-- 새 문 하나와 기록 표 검사식의 동작 하나가 늘 뿐이다. `note_operator_denial` 은 서명 · 권한이 그대로다(`create or replace`).
-- 반출(`audit_export_batch`)은 동작을 걸러 내지 않아 새 줄을 그대로 가져가고, 칸이 안 바뀌어 반출 `version` 도 그대로다.
--
-- **나란히 선 G-110 의 다른 마이그레이션도 이 두 목록(검사식 · 거절 문)을 다시 짓는다** — 사슬에 올릴 때 뒤에 오는 쪽이 앞의
-- 동작을 함께 들어야 한다.
--
-- 재는 자리는 `supabase/tests/95_operator_today_figures.test.sql`.

-- ---------------------------------------------------------------------------
-- 1. 기록 표가 새 동작을 받는다 — 목록은 `20261116090000` 에 `today.figures` 하나를 더한 것
-- ---------------------------------------------------------------------------

alter table audit.operator_access drop constraint operator_access_action_check;
alter table audit.operator_access add constraint operator_access_action_check
  check (action in ('reports.list', 'reports.detail', 'reports.snapshot', 'credits.refund_basis',
                    'audit.export_status',
                    'survey.overview', 'survey.by_version', 'survey.tags', 'survey.comments',
                    'survey.service_overview', 'survey.service_counts', 'survey.service_texts',
                    'today.figures',
                    'cli.query', 'cli.result'));

alter table audit.operator_access drop constraint app_access_names_the_operator;
alter table audit.operator_access add constraint app_access_names_the_operator check (
  channel <> 'app' or (actor_user_id is not null and actor_name is null and purpose is null
                       and sql_sha256 is null and result_of is null and result is null and error_class is null
                       and (action like 'reports.%' or action like 'credits.%' or action like 'audit.%'
                            or action like 'survey.%' or action like 'today.%')));

-- ---------------------------------------------------------------------------
-- 2. 오늘 · 이번 주의 숫자
-- ---------------------------------------------------------------------------

/**
 * 오늘 · 이번 주(서울 시간)의 가입 · 풀이 · 주문 · 매출 · 환불 — **두 줄**(`today` 먼저, `week` 다음).
 *
 * `since` 는 그 기간이 시작한 순간이다(서울 0시를 timestamptz 로) — 화면이 「언제부터」를 그대로 적는다.
 * 운영자만 부르고, 읽을 때마다 접속기록에 한 줄을 적는다.
 */
create function public.operator_today_figures()
returns table (
  period text,
  since timestamptz,
  signups integer,
  readings integer,
  orders integer,
  revenue bigint,
  refunds integer,
  refunded bigint
)
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  seoul_now timestamp := now() at time zone 'Asia/Seoul';
begin
  if not public.is_operator() then
    raise exception '운영자만 읽는 자리입니다.' using errcode = '42501';
  end if;

  perform audit.note_app_access('today.figures', null, null, 'allowed');

  return query
  with spans (period, since, ord) as (
    values
      ('today'::text, date_trunc('day', seoul_now) at time zone 'Asia/Seoul', 1),
      -- 주는 월요일부터 — date_trunc('week') 가 ISO 주(월요일 시작)다
      ('week'::text, date_trunc('week', seoul_now) at time zone 'Asia/Seoul', 2)
  )
  select
    s.period,
    s.since,
    (select count(*) from public.app_user u where u.signed_up_at >= s.since)::integer,
    (select count(*) from public.reading_run r
     where r.status = 'succeeded' and r.finished_at >= s.since)::integer,
    (select count(*) from public.reading_order o where o.approved_at >= s.since)::integer,
    (select coalesce(sum(o.amount), 0) from public.reading_order o where o.approved_at >= s.since)::bigint,
    (select count(*) from public.reading_order_refund f where f.refunded_at >= s.since)::integer,
    (select coalesce(sum(f.amount), 0) from public.reading_order_refund f where f.refunded_at >= s.since)::bigint
  from spans s
  order by s.ord;
end;
$$;

revoke execute on function public.operator_today_figures() from public, anon, authenticated, service_role;
grant execute on function public.operator_today_figures() to authenticated;

-- ---------------------------------------------------------------------------
-- 3. 거절을 적는 문이 새 동작을 받는다 — 몸은 `20261116090000` 그대로
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
                         'today.figures') then
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
