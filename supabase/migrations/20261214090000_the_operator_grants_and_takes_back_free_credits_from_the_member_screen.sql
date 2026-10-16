-- 운영자가 회원 화면에서 무상 풀이권을 지급 · 회수하고, 한 건이 한 줄인 지급 장부가 예외 몫의 원본이 된다 (G-111 ①, ADR 0187)
--
-- 그 전에는 무상 지급이 `reading_credit_grant.extra` 숫자 하나(계정당 한 줄)였다 — 누가 언제 왜 몇 장을 더하고 뺐는지가 남지
-- 않았고, 운영자가 SQL 로만 넣었다(ADR 0043). 이 마이그레이션이 세우는 것:
--
-- 1. **지급 장부**(`reading_credit_grant_entry`) — 지급 · 회수 한 건이 한 줄(수량 · 사유 갈래 · 메모 · 관련 신고 · 요청 번호 ·
--    실행자 · 시각). 고치지 않고 쌓인다. **`reading_credit_grant.extra` 는 장부의 합이다** — 지급 · 회수의 공통 함수
--    (`book_reading_credit_grant`)가 장부 줄과 `extra` 를 같은 트랜잭션에서 함께 고친다(합이 0 이면 행을 지운다 — `extra > 0`
--    규칙 그대로). 그래서 한도를 읽는 자리(`reading_credit_shares`)와 실시간 갱신 트리거(ADR 0155)는 그대로다.
-- 2. **옮김** — 지금 `extra` 가 있는 계정마다 「기록 이전」 지급 한 줄(갈래 `operator`, 메모 = 지금 `note`, 시각 = `granted_at`,
--    실행자 · 요청 번호 없음). 옮긴 뒤 계정마다 장부 합 = `extra` 인지 이 마이그레이션이 검사하고, 다르면 선다.
-- 3. **운영자 문 넷** — 지급 · 회수(쓰기)와 지급 장부의 지금 · 통합 이력(읽기). `authenticated` 에 열고 안에서 `is_operator()` 로
--    닫는다. **서버 열쇠(`service_role`)에는 열지 않는다**(ADR 0043 의 까닭 그대로). 실행자는 부른 사람(`auth.uid()`)이다.
-- 4. **알림 둘** — 지급마다 장애 알림 길(`notify_ops`)에 계정 id · 수량 · 갈래 한 줄. 지급 · 회수 모두 이용자의 소식에 한 줄
--    (`credits_granted` · `credits_revoked`) — 수량과 갈래만 가고 메모는 안 간다.
--
-- ## 바꾸지 않는 것
--
-- - 쓰는 순서(무료 → 운영 지급 → 먼저 산 묶음, `pick_reading_credit_share`)와 실패 반환(쓰임 줄이 `released` 가 되어 그 출처로
--   돌아온다) — `48_reading_bundle_ledger` 가 잠근다.
-- - 회수는 **운영 지급분의 미사용 · 미예약만**이다 — `Σ지급 − Σ회수 − grant 몫의 released 아닌 쓰임`. 가입 무료분 · 유료 구매분은
--   이 문으로 줄지 않는다(유료분은 주문 화면의 환불, ADR 0184). 사람 자물쇠(`reading:user:<id>`) 안에서 세고 적으므로 풀이 시작 ·
--   인연 요청과 나란히 와도 한쪽만 마지막 한 장을 갖는다.
--
-- ## 같은 요청은 한 번만
--
-- 화면이 확인창을 열 때 지은 요청 번호에 유일 제약을 건다. 같은 번호로 다시 오면 첫 결과를 돌려주고(`replayed`), 같은 번호에 다른
-- 대상 · 종류 · 수량 · 갈래가 오면 거절한다. 화면이 읽은 장부 줄 수(`p_seen_version`)가 지금과 다르면 거절한다 — 다른 운영자가 그
-- 사이 같은 계정에 지급 · 회수했다(두 운영자가 같은 보상을 나란히 주는 것을 막는다).
--
-- ## 접속기록
--
-- 쓰기 `credits.grant` · `credits.revoke`(거른 조건 칸에 `user=<id> entry=<id>`, 관련 신고가 있으면 `report=<id>`), 읽기
-- `members.credits` · `members.credit_history`(`user=<id>`). 메모는 적지 않는다(반출본은 지울 수 없다, ADR 0105). 거절은 앱의
-- 문이 `note_operator_denial` 로 같은 이름을 따로 적는다. `app_access_names_the_operator` 는 `credits.%` · `members.%` 를 이미
-- 받아 다시 짓지 않는다.
--
-- 재는 자리는 `supabase/tests/99_operator_credit_grant.test.sql`.

-- ---------------------------------------------------------------------------
-- 1. 기록 표와 거절 문이 새 동작을 받는다 — 목록은 바로 앞 `20261212090000`(회원 `members.*`)의 것에 넷을 더했다. 앞 것의
--    동작을 빠뜨리면 이미 적힌 줄이 검사식에 걸려 이 마이그레이션이 선다
-- ---------------------------------------------------------------------------

alter table audit.operator_access drop constraint operator_access_action_check;
alter table audit.operator_access add constraint operator_access_action_check
  check (action in ('reports.list', 'reports.detail', 'reports.snapshot', 'credits.refund_basis',
                    'credits.refund_status', 'credits.refund_hold', 'credits.refund_book', 'credits.refund_release',
                    'credits.grant', 'credits.revoke',
                    'audit.export_status',
                    'survey.overview', 'survey.by_version', 'survey.tags', 'survey.comments',
                    'survey.service_overview', 'survey.service_counts', 'survey.service_texts',
                    'today.figures',
                    'members.find', 'members.warnings', 'members.credits', 'members.credit_history',
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
                         'credits.grant', 'credits.revoke',
                         'survey.overview', 'survey.by_version', 'survey.tags', 'survey.comments',
                         'survey.service_overview', 'survey.service_counts', 'survey.service_texts',
                         'today.figures',
                         'members.find', 'members.warnings', 'members.credits', 'members.credit_history') then
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
-- 2. 지급 장부
-- ---------------------------------------------------------------------------

/**
 * 무상 풀이권의 지급 · 회수 — 한 건이 한 줄이고 고치지 않는다. `reading_credit_grant.extra` 는 이 장부의 합이다.
 *
 * 떠나면 계정과 함께 지워진다(`on delete cascade`) — 예외 몫(`reading_credit_grant`) · 쓰임 장부(`reading_credit_use`)와 같은
 * 규율이다. 무상분은 결제가 아니라 따로 보관할 기록이 아니다.
 */
create table public.reading_credit_grant_entry (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  /** grant 지급 · revoke 회수 */
  kind text not null check (kind in ('grant', 'revoke')),
  credits integer not null check (credits > 0),
  /** 지급: outage 장애 보상 · operator 운영 지급. 회수: mistake 잘못 지급 · duplicate 중복 지급 · other 기타 */
  reason text not null,
  /** 운영자의 메모 — 이용자에게 안 간다. 이메일 · 실명 · 연락처를 적지 않는다(화면이 칸 아래에서 말한다) */
  note text not null,
  /** 관련 신고 — 신고 화면에서 넘어온 지급에만. 신고가 떠나 옮겨져도 id 는 남는다(FK 로 매지 않는다) */
  report_id uuid,
  /** 화면이 확인창을 열 때 지은 요청 번호 — 같은 번호는 한 줄. 「기록 이전」 줄만 비었다 */
  request_id uuid unique,
  /** 실행한 운영자 — 문은 `auth.uid()`, 런북은 운영자 UUID 인자. 계정이 지워져도 줄은 남는다(FK 로 매지 않는다) */
  actor_user_id uuid,
  /** `reading_credit_grant.extra` 에서 옮긴 「기록 이전」 줄 — 누가 줬는지 모른다 */
  carried_over boolean not null default false,
  at timestamptz not null default now(),
  constraint grant_entry_reason_fits_its_kind check (
    (kind = 'grant' and reason in ('outage', 'operator'))
    or (kind = 'revoke' and reason in ('mistake', 'duplicate', 'other'))),
  constraint a_grant_is_at_most_ten check (carried_over or kind = 'revoke' or credits <= 10),
  constraint grant_entry_note_is_short check (carried_over or length(btrim(note)) between 1 and 200),
  constraint carried_entry_is_a_bare_grant check (
    carried_over = (request_id is null)
    and (not carried_over or (kind = 'grant' and actor_user_id is null and report_id is null))),
  constraint grant_entry_names_its_actor check (carried_over or actor_user_id is not null),
  constraint only_a_grant_names_a_report check (kind = 'grant' or report_id is null)
);

comment on table public.reading_credit_grant_entry is
  '무상 풀이권 지급 장부 — 지급 · 회수 한 건이 한 줄, reading_credit_grant.extra 는 그 합 (G-111 ①, ADR 0187)';

create index reading_credit_grant_entry_by_user on public.reading_credit_grant_entry (user_id, at desc);

alter table public.reading_credit_grant_entry enable row level security;
revoke all on public.reading_credit_grant_entry from public, anon, authenticated, service_role;

/** 장부 줄은 고치지 않는다 — 잘못 준 것은 회수 한 줄로 바로잡는다 */
create function public.reading_credit_grant_entry_stays()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  raise exception 'reading_credit_grant_entry: an entry is never changed — book a revoke instead' using errcode = '55000';
end;
$$;

revoke execute on function public.reading_credit_grant_entry_stays() from public, anon, authenticated, service_role;

create trigger reading_credit_grant_entry_stays
before update on public.reading_credit_grant_entry
for each row execute function public.reading_credit_grant_entry_stays();

-- ---------------------------------------------------------------------------
-- 3. 옮김 — 지금의 `extra` 를 「기록 이전」 한 줄로. 합이 안 맞으면 선다
-- ---------------------------------------------------------------------------

insert into public.reading_credit_grant_entry (user_id, kind, credits, reason, note, carried_over, at)
select g.user_id, 'grant', g.extra, 'operator', g.note, true, g.granted_at
from public.reading_credit_grant g;

do $$
declare
  off integer;
begin
  select count(*) into off
  from (
    select coalesce(g.user_id, e.user_id) as user_id
    from public.reading_credit_grant g
    full join (
      select x.user_id, sum(case x.kind when 'grant' then x.credits else -x.credits end) as total
      from public.reading_credit_grant_entry x
      group by x.user_id
    ) e on e.user_id = g.user_id
    where coalesce(g.extra, 0) <> coalesce(e.total, 0)
  ) mismatched;

  if off <> 0 then
    raise exception 'reading_credit_grant_entry: % accounts do not add up to their extra', off;
  end if;
end;
$$;

-- ---------------------------------------------------------------------------
-- 4. 이용자의 소식 — 지급 · 회수 한 줄씩, 장부 줄을 가리킨다
-- ---------------------------------------------------------------------------

alter table public.notification
  add column credit_entry_id uuid references public.reading_credit_grant_entry (id) on delete cascade;

create index notification_by_credit_entry on public.notification (credit_entry_id);

alter table public.notification drop constraint notification_kind_check;
alter table public.notification add constraint notification_kind_check check (kind in (
  'request_received', 'request_accepted', 'request_rejected', 'request_invalidated', 'request_expired',
  'reading_ready', 'reading_failed',
  'credits_granted', 'credits_revoked'));

alter table public.notification add constraint credit_notice_names_its_entry check (
  (kind in ('credits_granted', 'credits_revoked')) = (credit_entry_id is not null));

/**
 * 몸통은 `20261123090000` 그대로에 끝의 두 칸만 더했다 — 풀이권 소식의 수량과 갈래. **메모는 내지 않는다.** 칸이 늘어 지우고
 * 다시 짓는다 — 옛 앱은 더한 칸을 무시한다.
 */
drop function public.my_notifications();

create function public.my_notifications()
returns table (
  notification_id uuid,
  kind text,
  counterpart_nickname text,
  request_id uuid,
  match_id uuid,
  reading_kind text,
  reading_person_a uuid,
  reading_person_b uuid,
  created_at timestamptz,
  read_at timestamptz,
  reading_label_a text,
  reading_label_b text,
  credit_count integer,
  credit_reason text
)
language sql
stable
security definer
set search_path = ''
as $$
  select
    n.id,
    n.kind,
    coalesce(by_request.nickname, by_match.nickname),
    n.request_id,
    n.match_id,
    run.kind,
    run.person_a,
    run.person_b,
    n.created_at,
    n.read_at,
    case when run.kind = 'self' then null else edge_a.local_label end,
    edge_b.local_label,
    entry.credits,
    entry.reason
  from public.visible_notifications() n
  left join public.match_request r on r.id = n.request_id
  left join public.app_user by_request
    on by_request.id = case
      when r.requester_user_id = (select auth.uid()) then r.addressee_user_id
      else r.requester_user_id end
  left join public.match m on m.id = n.match_id
  left join public.app_user by_match
    on by_match.id = case
      when m.user_low = (select auth.uid()) then m.user_high else m.user_low end
  left join public.reading_run run on run.id = n.run_id
  left join public.user_person_access edge_a
    on edge_a.user_id = (select auth.uid()) and edge_a.person_id = run.person_a
  left join public.user_person_access edge_b
    on edge_b.user_id = (select auth.uid()) and edge_b.person_id = run.person_b
  left join public.reading_credit_grant_entry entry on entry.id = n.credit_entry_id
  order by n.created_at desc
  limit 50;
$$;

revoke execute on function public.my_notifications() from anon, public;
grant execute on function public.my_notifications() to authenticated;

-- ---------------------------------------------------------------------------
-- 5. 지급 · 회수의 공통 함수 — 화면의 문과 런북이 이것 하나를 지난다
-- ---------------------------------------------------------------------------

/** 한 계정의 장부 합을 예외 몫에 옮긴다 — 0 이면 행을 지운다. 사람 자물쇠 안에서 부른다 */
create function public.sync_reading_credit_grant(p_user uuid)
returns integer
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  total integer;
begin
  select coalesce(sum(case e.kind when 'grant' then e.credits else -e.credits end), 0)::integer into total
  from public.reading_credit_grant_entry e
  where e.user_id = p_user;

  if total < 0 then
    raise exception 'reading_credit_grant_entry: more taken back than granted' using errcode = '55000';
  end if;

  if total = 0 then
    delete from public.reading_credit_grant g where g.user_id = p_user;
  else
    insert into public.reading_credit_grant (user_id, extra, note, granted_at)
    values (p_user, total, '지급 장부의 합 (reading_credit_grant_entry)', now())
    on conflict (user_id) do update
      set extra = excluded.extra, note = excluded.note, granted_at = excluded.granted_at
      where public.reading_credit_grant.extra is distinct from excluded.extra;
  end if;

  return total;
end;
$$;

/** 운영 지급분 중 회수할 수 있는 수 — 받은 것 − 쓴 것 − 예약 중. 부르기 전에 장부를 정리한다(`settle_reading_credit_uses`) */
create function public.reading_credit_grant_left(p_user uuid)
returns integer
language sql
stable
security definer
set search_path = ''
as $$
  select greatest(0,
    coalesce((select sum(case e.kind when 'grant' then e.credits else -e.credits end)
              from public.reading_credit_grant_entry e where e.user_id = p_user), 0)
    - (select count(*) from public.reading_credit_use u
       where u.user_id = p_user and u.share = 'grant' and u.state <> 'released'))::integer;
$$;

/**
 * 무상 풀이권 한 건을 장부에 적는다 — 지급이든 회수든. **화면의 문(`operator_grant_reading_credits` ·
 * `operator_revoke_reading_credits`)과 런북 SQL 이 이것 하나를 부른다.** 누구에게도 열지 않는다.
 *
 * 사람 자물쇠(`reading:user:<id>`) 안에서 — 같은 요청 번호를 찾고, 읽은 버전을 견주고, 회수면 쓰임 장부를 정리해 회수할 수 있는
 * 수를 센 뒤 — 장부 한 줄 · 예외 몫 · 이용자 소식 한 줄을 적고, 지급이면 장애 알림 길에 한 줄을 보낸다.
 *
 * @param p_actor 실행한 운영자 — 문은 `auth.uid()`, 런북은 운영자 UUID
 * @param p_seen_version 화면이 읽은 그 계정의 장부 줄 수 — 다르면 거절한다. `null` 이면 견주지 않는다 — 이 함수는 누구에게도
 *   안 열렸고 운영 SQL(런북)만 `null` 을 낸다. 화면의 문 둘은 `null` · 음수를 받지 않는다
 * @returns 장부 줄 · 같은 요청의 재시도였는가
 */
create function public.book_reading_credit_grant(
  p_actor uuid,
  p_user_id uuid,
  p_kind text,
  p_credits integer,
  p_reason text,
  p_note text,
  p_request_id uuid,
  p_report_id uuid default null,
  p_seen_version integer default null)
returns table (entry_id uuid, replayed boolean)
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  memo constant text := btrim(coalesce(p_note, ''));
  earlier public.reading_credit_grant_entry;
  left_now integer;
  made uuid;
begin
  if p_actor is null then
    raise exception '실행한 운영자가 없습니다.' using errcode = '22023';
  end if;

  if p_request_id is null then
    raise exception '요청 번호가 없습니다. 화면을 새로 열어 주세요.' using errcode = '22023';
  end if;

  if p_kind is null or p_kind not in ('grant', 'revoke') then
    raise exception 'credit grant: kind is grant or revoke' using errcode = '22023';
  end if;

  if (p_kind = 'grant' and (p_reason is null or p_reason not in ('outage', 'operator')))
     or (p_kind = 'revoke' and (p_reason is null or p_reason not in ('mistake', 'duplicate', 'other'))) then
    raise exception '사유를 골라 주세요.' using errcode = '22023';
  end if;

  if p_credits is null or p_credits < 1 or (p_kind = 'grant' and p_credits > 10) then
    raise exception '%', case p_kind when 'grant' then '한 번에 1장에서 10장까지 지급합니다.'
                                     else '회수할 수량을 1장 이상 골라 주세요.' end
      using errcode = '22023';
  end if;

  if length(memo) not between 1 and 200 then
    raise exception '메모를 200자 안으로 적어 주세요.' using errcode = '22023';
  end if;

  if not exists (select 1 from public.app_user a where a.id = p_user_id) then
    raise exception '회원을 찾지 못했습니다.' using errcode = 'no_data_found';
  end if;

  if p_report_id is not null and p_kind <> 'grant' then
    raise exception '관련 신고는 지급에만 답니다.' using errcode = '22023';
  end if;

  perform pg_advisory_xact_lock(hashtext('reading:user:' || p_user_id::text));

  -- 같은 요청의 재시도 — 자물쇠 뒤에 찾는다(나란히 온 재시도는 첫째의 커밋 뒤에 본다). 같은 줄을 돌려준다
  select * into earlier from public.reading_credit_grant_entry e where e.request_id = p_request_id;
  if found then
    if earlier.user_id <> p_user_id or earlier.kind <> p_kind or earlier.credits <> p_credits
       or earlier.reason <> p_reason then
      raise exception '이 요청 번호는 다른 지급 · 회수에 쓰였습니다. 화면을 새로 열어 주세요.' using errcode = '22023';
    end if;
    entry_id := earlier.id;
    replayed := true;
    return next;
    return;
  end if;

  -- 관련 신고는 **새 지급일 때만** 잰다 — 첫 지급 뒤 신고가 보관으로 옮겨져도(신고한 사람이 떠남) 같은 요청의 재시도는 위에서
  -- 첫 결과를 돌려받는다
  if p_report_id is not null and not exists (
       select 1 from public.report r
       where r.id = p_report_id and p_user_id in (r.reporter_user_id, r.reported_user_id)) then
    raise exception '관련 신고가 이 회원의 신고가 아닙니다.' using errcode = '22023';
  end if;

  if p_seen_version is not null
     and p_seen_version <> (select count(*) from public.reading_credit_grant_entry e where e.user_id = p_user_id) then
    raise exception '그 사이 이 회원의 무상 풀이권이 바뀌었습니다. 새로 읽고 다시 확인해 주세요.' using errcode = '55000';
  end if;

  if p_kind = 'revoke' then
    perform public.settle_reading_credit_uses(p_user_id);
    left_now := public.reading_credit_grant_left(p_user_id);
    if p_credits > left_now then
      raise exception '회수할 수 있는 지급분보다 많습니다 — 지금 %장입니다.', left_now using errcode = '22023';
    end if;
  end if;

  insert into public.reading_credit_grant_entry (
    user_id, kind, credits, reason, note, report_id, request_id, actor_user_id)
  values (p_user_id, p_kind, p_credits, p_reason, memo, p_report_id, p_request_id, p_actor)
  returning id into made;

  perform public.sync_reading_credit_grant(p_user_id);

  insert into public.notification (user_id, kind, credit_entry_id)
  values (p_user_id, case p_kind when 'grant' then 'credits_granted' else 'credits_revoked' end, made);

  -- 지급마다 한 줄 — 종류에 장부 줄 id 를 붙여 하루 한 줄(`ops_alert` 의 유일 제약)에 묻히지 않는다. 계정 id · 수량 · 갈래만
  if p_kind = 'grant' then
    perform public.notify_ops(
      'credit-grant:' || made::text,
      format('무상 풀이권 %s장을 지급했다 — 계정 %s · %s',
             p_credits, p_user_id, case p_reason when 'outage' then '장애 보상' else '운영 지급' end));
  end if;

  entry_id := made;
  replayed := false;
  return next;

exception
  when unique_violation then
    -- 같은 요청 번호가 다른 계정에 나란히 왔다 — 자물쇠가 계정마다라 위의 재시도 찾기를 지났다
    raise exception '이 요청 번호는 다른 지급 · 회수에 쓰였습니다. 화면을 새로 열어 주세요.' using errcode = '22023';
end;
$$;

revoke execute on function public.sync_reading_credit_grant(uuid) from public, anon, authenticated, service_role;
revoke execute on function public.reading_credit_grant_left(uuid) from public, anon, authenticated, service_role;
revoke execute on function public.book_reading_credit_grant(uuid, uuid, text, integer, text, text, uuid, uuid, integer)
  from public, anon, authenticated, service_role;

-- ---------------------------------------------------------------------------
-- 6. 운영자 문 — 지급 · 회수
-- ---------------------------------------------------------------------------

/**
 * 무상 풀이권을 지급한다 — 1 ~ 10장, 갈래 `outage` · `operator`, 메모 필수. 관련 신고는 그 회원이 신고했거나 신고받은 것만.
 * 현금 환불 대상이 아니다(환불 셈은 묶음만 센다, ADR 0106).
 */
create function public.operator_grant_reading_credits(
  p_user_id uuid, p_credits integer, p_reason text, p_note text, p_report_id uuid,
  p_seen_version integer, p_request_id uuid)
returns table (entry_id uuid, replayed boolean)
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  booked record;
begin
  if not public.is_operator() then
    raise exception '운영자만 쓰는 자리입니다.' using errcode = '42501';
  end if;

  -- 화면은 늘 읽은 버전을 낸다 — 비었거나 음수면 버전 검사를 건너뛰는 길이 되므로 받지 않는다
  if p_seen_version is null or p_seen_version < 0 then
    raise exception '읽은 버전이 없습니다. 화면을 새로 열어 주세요.' using errcode = '22023';
  end if;

  select * into booked
  from public.book_reading_credit_grant(
    (select auth.uid()), p_user_id, 'grant', p_credits, p_reason, p_note, p_request_id, p_report_id, p_seen_version) b;

  perform audit.note_app_access(
    'credits.grant', null,
    format('user=%s entry=%s', p_user_id, booked.entry_id)
      || coalesce(' report=' || p_report_id::text, ''),
    'allowed');

  entry_id := booked.entry_id;
  replayed := booked.replayed;
  return next;
end;
$$;

/** 운영 지급분의 미사용 · 미예약을 회수한다 — 갈래 `mistake` · `duplicate` · `other`, 메모 필수 */
create function public.operator_revoke_reading_credits(
  p_user_id uuid, p_credits integer, p_reason text, p_note text, p_seen_version integer, p_request_id uuid)
returns table (entry_id uuid, replayed boolean)
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  booked record;
begin
  if not public.is_operator() then
    raise exception '운영자만 쓰는 자리입니다.' using errcode = '42501';
  end if;

  -- 화면은 늘 읽은 버전을 낸다 — 비었거나 음수면 버전 검사를 건너뛰는 길이 되므로 받지 않는다
  if p_seen_version is null or p_seen_version < 0 then
    raise exception '읽은 버전이 없습니다. 화면을 새로 열어 주세요.' using errcode = '22023';
  end if;

  select * into booked
  from public.book_reading_credit_grant(
    (select auth.uid()), p_user_id, 'revoke', p_credits, p_reason, p_note, p_request_id, null, p_seen_version) b;

  perform audit.note_app_access(
    'credits.revoke', null, format('user=%s entry=%s', p_user_id, booked.entry_id), 'allowed');

  entry_id := booked.entry_id;
  replayed := booked.replayed;
  return next;
end;
$$;

-- ---------------------------------------------------------------------------
-- 7. 운영자 문 — 지급 장부의 지금 · 통합 이력
-- ---------------------------------------------------------------------------

/**
 * 한 회원의 운영 무상 지급분 — 받은 수(Σ지급 − Σ회수) · 사용(확정) · 예약 중 · 회수할 수 있는 수, 그리고 장부 줄 수(`version`).
 * 지급 · 회수 폼이 읽는다 — 회수 수량의 위 끝과, 문이 받는 「읽은 버전」이다. 출처별 표 · 잔액은 회원 화면의 풀이권 칸이 든다.
 * 회수할 수 있는 수는 쓰임 장부의 셈이다 — 이용자의 잔액(한도 셈, ADR 0021)과는 다른 수다(ADR 0187).
 */
create function public.operator_member_grant_ledger(p_user_id uuid)
returns table (
  granted integer,
  used integer,
  reserved integer,
  revocable integer,
  version integer
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

  perform audit.note_app_access('members.credits', null, format('user=%s', p_user_id), 'allowed');

  if not exists (select 1 from public.app_user a where a.id = p_user_id) then
    return;
  end if;

  perform public.settle_reading_credit_uses(p_user_id);

  return query
  select
    coalesce((select sum(case e.kind when 'grant' then e.credits else -e.credits end)
              from public.reading_credit_grant_entry e where e.user_id = p_user_id), 0)::integer,
    (select count(*)::integer from public.reading_credit_use u
     where u.user_id = p_user_id and u.share = 'grant' and u.state = 'confirmed'),
    (select count(*)::integer from public.reading_credit_use u
     where u.user_id = p_user_id and u.share = 'grant' and u.state = 'reserved'),
    public.reading_credit_grant_left(p_user_id),
    (select count(*)::integer from public.reading_credit_grant_entry e where e.user_id = p_user_id);
end;
$$;

/**
 * 한 회원의 풀이권 이력 — 구매 · 환불 · 사용 · 지급 · 회수를 한 목록에 최근 것부터.
 *
 * 줄마다 출처(`free` · `grant` · `bundle` · `outside`)와 증감 사유. 수(`delta`)는 늘고 준 것만 부호가 있다 — 확정 사용은 −1, 예약
 * (`state = 'reserved'`)과 반환(`released`)은 `null` 이다(차감이 아니다). 사용 줄은 **무엇을 풀었는지 적지 않는다** — 시도인가
 * 요청인가(`cause`)와 상태뿐이다(ADR 0185 의 2). 구매 · 환불 줄은 수량과 주문 번호만이고 금액은 주문 화면이 든다.
 *
 * @param p_filter `all` · `orders`(구매 · 환불) · `grants`(지급 · 회수) · `uses`(사용)
 * @param p_limit 줄 수 — 화면은 하나 더 청해 「더 보기」를 안다
 */
create function public.operator_member_credit_history(p_user_id uuid, p_filter text, p_limit integer)
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
  carried_over boolean
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

  if p_filter is null or p_filter not in ('all', 'orders', 'grants', 'uses') then
    raise exception 'operator: filter is all, orders, grants or uses' using errcode = '22023';
  end if;

  if p_limit is null or p_limit not between 1 and 500 then
    raise exception 'operator: limit is 1 to 500' using errcode = '22023';
  end if;

  perform audit.note_app_access('members.credit_history', null, format('user=%s', p_user_id), 'allowed');

  perform public.settle_reading_credit_uses(p_user_id);

  return query
  select h.at, h.kind, h.source, h.delta, h.state, h.cause, h.reason, h.note, h.order_number,
         (select a.nickname from public.app_user a where a.id = h.actor), h.report_id, h.carried_over
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
  order by h.at desc, h.kind, h.tie desc
  limit p_limit;
end;
$$;

revoke execute on function public.operator_grant_reading_credits(uuid, integer, text, text, uuid, integer, uuid)
  from public, anon, service_role;
revoke execute on function public.operator_revoke_reading_credits(uuid, integer, text, text, integer, uuid)
  from public, anon, service_role;
revoke execute on function public.operator_member_grant_ledger(uuid) from public, anon, service_role;
revoke execute on function public.operator_member_credit_history(uuid, text, integer) from public, anon, service_role;
grant execute on function public.operator_grant_reading_credits(uuid, integer, text, text, uuid, integer, uuid)
  to authenticated;
grant execute on function public.operator_revoke_reading_credits(uuid, integer, text, text, integer, uuid)
  to authenticated;
grant execute on function public.operator_member_grant_ledger(uuid) to authenticated;
grant execute on function public.operator_member_credit_history(uuid, text, integer) to authenticated;
