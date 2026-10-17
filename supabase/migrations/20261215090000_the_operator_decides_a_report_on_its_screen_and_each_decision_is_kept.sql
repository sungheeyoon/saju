-- 운영자가 신고 상세에서 판단 근거와 함께 처분하고, 처분마다 이력 한 줄이 쌓이며, 계정 상태는 공통 함수 하나로만 바뀐다
-- (G-111 ②, ADR 0188)
--
-- 그 전에는 처분을 런북의 검토 문(`review_report`)으로만 적었다 — 신고 행을 id 로만 골라 결과를 조건 없이 덮어썼고, 앞 결과는
-- 어디에도 안 남았다. 두 운영자가 같은 신고를 나란히 처리하면 늦게 누른 쪽이 말없이 이겼다. 정지는 `app_user.status` 를 직접
-- UPDATE 했고, 누가 왜 바꿨는지가 남지 않았다. 이 마이그레이션이 세우는 것:
--
-- 1. **처분 이력**(`report_review_entry`) — 처분 한 번이 한 줄(신고 · 차례 · 결과 · 판단 근거 · 제재 대상 · 경고 갈래 · 실행자 ·
--    요청 번호 · 시각). 덮어쓰지 않고 쌓인다. 신고 행은 지금 결과를 들고, 이 표는 지금 것까지 모든 결과를 든다. **신고의 처리
--    버전은 이 표의 줄 수다** — 처음 0, 적을 때마다 +1. 이미 검토된 신고는 지금 결과를 「기록 이전」 한 줄로 옮긴다(버전 1).
-- 2. **처분의 공통 함수**(`write_report_review`) — 화면의 문과 런북의 검토 문이 이것 하나를 지난다. 신고마다 자물쇠 안에서
--    같은 요청 번호를 **먼저** 찾고(있으면 첫 결과), 새 처분일 때만 신고 · 대상을 잰 뒤 읽은 버전을 견준다.
-- 3. **계정 상태 이력**(`account_status_change`)과 **상태를 바꾸는 공통 함수**(`change_account_status`) — 사유 갈래 · 메모 ·
--    실행자 · 관련 신고 · 요청 번호를 받는다. 신고의 이용 정지 결정이 이 함수로 정지하고, ③ 의 정지 · 해제 화면과 런북도 이것을
--    쓴다. `app_user.status` 가 바뀔 때마다 트리거가 이력 한 줄을 적는다 — 공통 함수를 거치지 않은 변경(직접 UPDATE)은 실행자 ·
--    사유가 빈 줄로 남고 장애 알림 길(`notify_ops`)로 한 줄이 간다. 이용자 스스로의 탈퇴 신청은 제 갈래로 적고 알리지 않는다.
-- 4. **운영자 권한은 이용 중인 계정만**(`is_operator`) — 정지 · 탈퇴 대기가 된 운영자 계정은 운영자 문을 못 쓴다. 전에는
--    `public.operator` 의 줄만 보아서, 스스로 탈퇴를 신청했거나 직접 UPDATE 로 정지된 운영자도 처분 · 지급을 했다.
-- 5. **운영자 문 둘** — 처분(`operator_review_report`)과 신고 상세의 대상 회원 요약(`operator_report_target`). 목록 문은 급한
--    순과 기한 지남을, 상세 문은 처리 버전 · 처분 이력 · 남은 정지를 더 낸다.
--
-- ## 바꾸지 않는 것
--
-- - **정지는 처분을 바꿔도 풀리지 않는다** — 이용 정지 결정을 다른 결과로 바꿔도 계정은 정지 그대로다. 해제는 회원 화면에서
--   사유 · 실행자와 함께 따로 한다(G-111 ③). 상세 문이 남은 정지를 `held_suspension_side` 로 알린다.
-- - 런북의 검토 문 `review_report` 는 인자 · 돌려주는 값 · 거절 코드가 그대로다(`52_report_review_door` · G-24 검증의 ⑨).
--   버전을 견주지 않는다(지금 것을 덮어쓴다) — 누구에게도 안 열렸고 운영 SQL 만 부른다. 덮어쓴 앞 결과는 이제 이력에 남는다.
-- - 경고의 셈 · 처분 이력은 지금 계정의 신고(`public.report`)만이다(G-110 의 경계). 떠난 사람의 신고는 화면이 읽지 않는다.
--
-- ## 접속기록
--
-- 쓰기 `reports.review`(신고 id 칸 · 거른 조건 칸 `version=<n>`, 재시도면 ` replayed`), 읽기 `reports.target`(신고 id 칸 ·
-- `reported=<id> reporter=<id>`). 판단 근거 · 메모 · 닉네임은 적지 않는다(ADR 0105). 거절은 앱이 `note_operator_denial` 로.
--
-- 재는 자리는 `supabase/tests/99_operator_report_review.test.sql`.

-- ---------------------------------------------------------------------------
-- 1. 기록 표와 거절 문이 새 동작을 받는다 — 목록은 바로 앞 `20261214090000`(무상 지급 `credits.grant` · `credits.revoke` ·
--    `members.credits` · `members.credit_history`)의 것에 둘을 더했다. 앞 것을 빠뜨리면 이미 적힌 줄이 검사식에 걸려 선다
-- ---------------------------------------------------------------------------

alter table audit.operator_access drop constraint operator_access_action_check;
alter table audit.operator_access add constraint operator_access_action_check
  check (action in ('reports.list', 'reports.detail', 'reports.snapshot', 'reports.review', 'reports.target',
                    'credits.refund_basis',
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
     or p_action not in ('reports.list', 'reports.detail', 'reports.snapshot', 'reports.review', 'reports.target',
                         'credits.refund_basis',
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
-- 2. 기한 지남 — 접수 다음 날부터 오늘까지 평일이 셋을 넘었다(주말만 뺀 어림, 서울 날짜). 런북의 3영업일 질의와 같은 셈
-- ---------------------------------------------------------------------------

create function public.report_is_overdue(p_created_at timestamptz)
returns boolean
language sql
stable
set search_path = ''
as $$
  select (select count(*)
          from generate_series((p_created_at at time zone 'Asia/Seoul')::date + 1,
                               (now() at time zone 'Asia/Seoul')::date, interval '1 day') d
          where extract(isodow from d) < 6) > 3
$$;

comment on function public.report_is_overdue(timestamptz) is
  '접수 뒤 3영업일을 넘겼나 — 주말만 뺀 어림, 서울 날짜. 목록 문의 급한 순 · 기한 지남 딱지와 런북 질의가 같이 부른다 (ADR 0188)';

revoke execute on function public.report_is_overdue(timestamptz) from public, anon, authenticated, service_role;

-- ---------------------------------------------------------------------------
-- 3. 처분 이력 — 처분 한 번이 한 줄, 신고의 처리 버전은 그 줄 수
-- ---------------------------------------------------------------------------

/**
 * 신고 처분의 이력 — 지금 결과까지 모든 결과가 한 줄씩 쌓이고 고치지 않는다.
 *
 * 신고 id 는 외래키가 아니다 — 신고가 떠난 사람의 것으로 옮겨져도(`public.report` → `retention.report`, ADR 0098) 이력은 그대로
 * 신고를 따라간다. 떠난 사람의 신고가 파기될 때 그 이력도 함께 지운다(아래 트리거) — 판단 근거를 신고보다 오래 두지 않는다.
 */
create table public.report_review_entry (
  id uuid primary key default gen_random_uuid(),
  report_id uuid not null,
  /** 이 처분이 만든 처리 버전 — 1 부터. 신고마다 하나씩 */
  version integer not null check (version >= 1),
  /** 결과 — 「기록 이전」 줄은 결과 칸이 생기기 전의 옛 검토면 비었다 */
  outcome text check (outcome in ('no_action', 'warning', 'suspension', 'needs_more')),
  note text,
  sanctioned_user_id uuid,
  warning_category text,
  /** 실행한 운영자 — 문은 `auth.uid()`, 런북은 운영자 UUID 인자 */
  actor_user_id uuid,
  /** 화면이 처분 폼을 낼 때 지은 요청 번호 — 같은 번호는 한 줄. 런북 · 「기록 이전」 줄은 비었다 */
  request_id uuid unique,
  /** 이 마이그레이션이 지금 결과를 옮긴 줄 */
  carried_over boolean not null default false,
  at timestamptz not null default now(),
  constraint report_review_entry_version unique (report_id, version),
  constraint review_entry_has_an_outcome check (carried_over or outcome is not null),
  constraint review_entry_names_its_actor check (carried_over or actor_user_id is not null),
  constraint review_entry_note_is_short check (note is null or length(note) <= 500)
);

comment on table public.report_review_entry is
  '신고 처분 이력 — 처분 한 번이 한 줄, 신고의 처리 버전 = 그 신고의 줄 수. 신고가 파기되면 함께 지운다 (G-111 ②, ADR 0188)';

alter table public.report_review_entry enable row level security;
revoke all on public.report_review_entry from public, anon, authenticated, service_role;

/** 이력 줄은 고치지 않는다 — 결과를 바꾸면 새 줄이 쌓인다 */
create function public.report_review_entry_stays()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  raise exception 'report_review_entry: an entry is never changed — write a new review instead' using errcode = '55000';
end;
$$;

revoke execute on function public.report_review_entry_stays() from public, anon, authenticated, service_role;

create trigger report_review_entry_stays
before update on public.report_review_entry
for each row execute function public.report_review_entry_stays();

/** 떠난 사람의 신고가 파기되면 그 이력도 — 처분일부터 6개월(ADR 0098) */
create function public.forget_report_review_entries()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  delete from public.report_review_entry e where e.report_id = old.report_id;
  return old;
end;
$$;

revoke execute on function public.forget_report_review_entries() from public, anon, authenticated, service_role;

create trigger report_review_entries_go_with_the_report
after delete on retention.report
for each row execute function public.forget_report_review_entries();

-- 옮김 — 이미 검토된 신고의 지금 결과를 「기록 이전」 한 줄로(버전 1). 두 표 모두
insert into public.report_review_entry (
  report_id, version, outcome, note, sanctioned_user_id, warning_category, actor_user_id, carried_over, at)
select r.id, 1, r.review_outcome, r.review_note, r.sanctioned_user_id, r.warning_category, r.reviewed_by, true, r.reviewed_at
from public.report r
where r.reviewed_at is not null
union all
select k.report_id, 1, k.review_outcome, k.review_note, k.sanctioned_user_id, k.warning_category, k.reviewed_by, true,
       k.reviewed_at
from retention.report k
where k.reviewed_at is not null;

-- ---------------------------------------------------------------------------
-- 4. 계정 상태 이력 — 상태가 바뀔 때마다 한 줄, 공통 함수를 거치지 않았으면 실행자 · 사유가 빈 줄과 알림
-- ---------------------------------------------------------------------------

/**
 * 계정 상태가 바뀐 이력 — 한 번이 한 줄이고 고치지 않는다. 떠나면 계정과 함께 지워진다(`on delete cascade`) — 지급 장부(ADR 0187 의
 * 12)와 같은 규율이다. 신고로 정지한 것은 신고의 처분 이력이 신고를 따라 따로 남는다.
 *
 * 갈래: 정지 `report`(신고의 이용 정지 결정) · `policy`(운영정책 위반) · `payment`(결제 부정) · `eligibility`(이용 자격) · `other` /
 * 해제 `appeal`(소명 인정) · `mistake`(잘못 정지) · `other` / 탈퇴 대기의 해제 `deletion_withdrawn` / 이용자 스스로의
 * `deletion_request`. 갈래가 비었으면 공통 함수를 거치지 않은 변경이다 — 화면은 「실행자 · 사유 없음」 딱지를 단다.
 */
create table public.account_status_change (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.app_user (id) on delete cascade,
  from_status text not null,
  to_status text not null,
  reason text check (reason in ('report', 'policy', 'payment', 'eligibility', 'other', 'appeal', 'mistake',
                                'deletion_withdrawn', 'deletion_request')),
  /** 운영자의 메모 — 이용자에게 안 간다. 이메일 · 실명 · 연락처를 적지 않는다 */
  note text check (note is null or length(note) between 1 and 200),
  /** 관련 신고 — 신고의 이용 정지 결정이면 그 신고. 신고가 옮겨져도 id 는 남는다(FK 로 매지 않는다) */
  report_id uuid,
  request_id uuid unique,
  /** 실행한 사람 — 운영자 UUID, 탈퇴 신청이면 그 이용자. 계정이 지워져도 줄은 남는다(FK 로 매지 않는다) */
  actor_user_id uuid,
  at timestamptz not null default now(),
  constraint status_change_reason_has_an_actor check ((reason is null) = (actor_user_id is null)),
  constraint report_reason_names_its_report check ((reason = 'report') = (report_id is not null))
);

comment on table public.account_status_change is
  '계정 상태 이력 — 바뀔 때마다 한 줄. 갈래 · 실행자가 비었으면 공통 함수 밖의 변경 (G-111 ② · ③, ADR 0188)';

create index account_status_change_by_user on public.account_status_change (user_id, at desc);

alter table public.account_status_change enable row level security;
revoke all on public.account_status_change from public, anon, authenticated, service_role;

create function public.account_status_change_stays()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  raise exception 'account_status_change: a change is never edited' using errcode = '55000';
end;
$$;

revoke execute on function public.account_status_change_stays() from public, anon, authenticated, service_role;

create trigger account_status_change_stays
before update on public.account_status_change
for each row execute function public.account_status_change_stays();

/**
 * `app_user.status` 가 바뀌면 이력 한 줄 — 세 갈래.
 *
 * 1. 공통 함수(`change_account_status`)가 같은 트랜잭션의 설정 값(`saju.account_status_change`)에 실은 변경이면 그 갈래 · 메모 ·
 *    실행자로 적는다. 실은 값은 운영자만 일으키는 바뀜(정지 · 해제 · 탈퇴 대기의 해제)일 때만 받는다 — 이용자가 값을 실어도 제
 *    탈퇴 신청을 운영자의 일로 적지 못한다.
 * 2. 이용자 스스로 탈퇴를 신청했으면(`request_account_deletion` — 부른 사람이 그 계정) 갈래 `deletion_request`, 알리지 않는다.
 * 3. 그 밖은 공통 함수 밖의 변경이다 — 실행자 · 사유가 빈 줄을 적고 장애 알림 길로 한 줄을 보낸다.
 */
create function public.record_account_status_change()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  claim jsonb := nullif(current_setting('saju.account_status_change', true), '')::jsonb;
  made uuid;
begin
  if claim is not null
     and (claim ->> 'user_id')::uuid = new.id
     and claim ->> 'from' = old.status
     and claim ->> 'to' = new.status
     and new.status in ('suspended', 'active') then
    insert into public.account_status_change (
      id, user_id, from_status, to_status, reason, note, report_id, request_id, actor_user_id)
    values ((claim ->> 'id')::uuid, new.id, old.status, new.status, claim ->> 'reason', claim ->> 'note',
            (claim ->> 'report_id')::uuid, (claim ->> 'request_id')::uuid, (claim ->> 'actor')::uuid);
    return new;
  end if;

  if old.status = 'active' and new.status = 'deletion_requested' and (select auth.uid()) = new.id then
    insert into public.account_status_change (user_id, from_status, to_status, reason, actor_user_id)
    values (new.id, old.status, new.status, 'deletion_request', new.id);
    return new;
  end if;

  insert into public.account_status_change (user_id, from_status, to_status)
  values (new.id, old.status, new.status)
  returning id into made;

  perform public.notify_ops(
    'account-status:' || made::text,
    format('계정 상태가 실행자 · 사유 없이 바뀌었다 — 계정 %s · %s → %s', new.id, old.status, new.status));

  return new;
end;
$$;

revoke execute on function public.record_account_status_change() from public, anon, authenticated, service_role;

create trigger account_status_is_recorded
after update of status on public.app_user
for each row when (old.status is distinct from new.status)
execute function public.record_account_status_change();

/**
 * 계정 상태를 바꾸는 길 하나 — 신고의 이용 정지 결정 · 회원 화면의 정지 · 해제(G-111 ③) · 런북이 모두 이것을 부른다. 누구에게도
 * 열지 않는다.
 *
 * 바꿀 수 있는 것은 셋이다 — 이용 중 → 이용 정지(갈래 `report` · `policy` · `payment` · `eligibility` · `other`), 이용 정지 →
 * 이용 중(`appeal` · `mistake` · `other`), 탈퇴 대기 → 이용 중(`deletion_withdrawn`). 운영자 계정은 정지하지 않는다(G-111-10 —
 * 권한을 먼저 걷는다, `docs/ops/runbook/operators.md`). 메모는 1 ~ 200자이고, 신고의 정지 결정만 비워도 된다(판단 근거는 신고의
 * 처분 이력에 있다).
 *
 * 같은 요청 번호로 다시 오면 첫 줄을 돌려준다 — 다른 계정 · 바뀜 · 갈래면 거절한다.
 *
 * @param p_actor 실행한 운영자 — 화면의 문은 `auth.uid()`, 런북은 운영자 UUID
 * @returns 이력 줄 id
 */
create function public.change_account_status(
  p_actor uuid,
  p_user_id uuid,
  p_status text,
  p_reason text,
  p_note text,
  p_report_id uuid default null,
  p_request_id uuid default null)
returns uuid
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  memo constant text := nullif(btrim(coalesce(p_note, '')), '');
  now_status text;
  earlier public.account_status_change;
  made uuid := gen_random_uuid();
begin
  if p_actor is null or not exists (select 1 from public.operator o where o.user_id = p_actor) then
    raise exception '운영자만 계정 상태를 바꿉니다.' using errcode = '42501';
  end if;

  if p_status is null or p_status not in ('suspended', 'active') then
    raise exception 'account status: suspended or active' using errcode = '22023';
  end if;

  select a.status into now_status from public.app_user a where a.id = p_user_id for update;
  if not found then
    raise exception '회원을 찾지 못했습니다.' using errcode = 'P0002';
  end if;

  -- 같은 요청의 재시도 — 계정 행을 잡은 뒤에 찾는다(나란히 온 재시도는 첫째의 커밋 뒤에 본다)
  if p_request_id is not null then
    select * into earlier from public.account_status_change c where c.request_id = p_request_id;
    if found then
      if earlier.user_id <> p_user_id or earlier.to_status <> p_status or earlier.reason is distinct from p_reason
         or earlier.actor_user_id is distinct from p_actor then
        raise exception '이 요청 번호는 다른 처리에 쓰였습니다. 화면을 새로 열어 주세요.' using errcode = '22023';
      end if;
      return earlier.id;
    end if;
  end if;

  if p_status = 'suspended' then
    if now_status = 'deletion_requested' then
      -- 계정 검사식(`deletion_time_matches_status`)이 거절하던 것과 같은 코드다 — 런북의 검토 문을 부르는 쪽이 그대로 읽는다
      raise exception '탈퇴를 신청한 계정이라 정지할 수 없습니다.' using errcode = '23514';
    end if;
    if now_status <> 'active' then
      raise exception '이미 이용 정지된 계정입니다.' using errcode = '55000';
    end if;
    if exists (select 1 from public.operator o where o.user_id = p_user_id) then
      raise exception '운영자 계정은 정지할 수 없습니다.' using errcode = '55000';
    end if;
    if p_reason is null or p_reason not in ('report', 'policy', 'payment', 'eligibility', 'other') then
      raise exception '사유를 골라 주세요.' using errcode = '22023';
    end if;
  else
    if not ((now_status = 'suspended' and p_reason in ('appeal', 'mistake', 'other'))
            or (now_status = 'deletion_requested' and p_reason = 'deletion_withdrawn')) then
      raise exception '%', case when now_status = 'active' then '이미 이용 중인 계정입니다.' else '사유를 골라 주세요.' end
        using errcode = case when now_status = 'active' then '55000' else '22023' end;
    end if;
  end if;

  if (p_reason = 'report') <> (p_report_id is not null) then
    raise exception 'account status: a report goes with the report reason only' using errcode = '22023';
  end if;

  if p_reason <> 'report' and (memo is null or length(memo) > 200) then
    raise exception '메모를 200자 안으로 적어 주세요.' using errcode = '22023';
  end if;

  perform set_config('saju.account_status_change', jsonb_build_object(
    'id', made, 'user_id', p_user_id, 'from', now_status, 'to', p_status, 'reason', p_reason,
    'note', memo, 'report_id', p_report_id, 'request_id', p_request_id, 'actor', p_actor)::text, true);

  update public.app_user a
  set status = p_status,
      deletion_requested_at = case when p_status = 'active' then null else a.deletion_requested_at end
  where a.id = p_user_id;

  perform set_config('saju.account_status_change', '', true);

  if not exists (select 1 from public.account_status_change c where c.id = made) then
    raise exception 'account status: the change was not recorded' using errcode = '55000';
  end if;

  return made;
end;
$$;

revoke execute on function public.change_account_status(uuid, uuid, text, text, text, uuid, uuid)
  from public, anon, authenticated, service_role;

-- ---------------------------------------------------------------------------
-- 5. 처분의 공통 함수 — 화면의 문과 런북의 검토 문이 이것 하나를 지난다
-- ---------------------------------------------------------------------------

/**
 * 신고 한 건의 처분을 적는다 — 지금 계정의 신고(`public.report`)든 떠난 사람의 신고(`retention.report`)든. 누구에게도 열지 않는다.
 *
 * 신고마다 자물쇠(`report:review:<id>`) 안에서 차례대로 —
 *
 * 1. **같은 요청 번호를 먼저 찾는다.** 있으면 첫 결과(버전)를 돌려준다 — 그 사이 신고가 보관으로 옮겨졌어도 같다. 같은 번호에
 *    다른 신고 · 결과 · 제재 대상 · 갈래가 오면 거절한다.
 * 2. 새 처분일 때만 — `p_current_only` 면 지금 계정의 신고인가, 그리고 **읽은 버전**(`p_seen_version`)이 지금 버전(이력 줄 수)과
 *    같은가. 다르면 `55000` — 다른 운영자가 먼저 적었다.
 * 3. 신고 행에 지금 결과를 적고(모양은 표의 제약이 `23514` 로 잰다) 이력 한 줄을 쌓는다.
 * 4. 이용 정지 결정이면 같은 트랜잭션에서 제재 대상을 공통 함수(`change_account_status`, 갈래 `report`)로 정지한다 — 이미
 *    정지면 그대로 둔다. 계정이 없으면 `P0002`, 탈퇴 대기면 `23514`, 운영자 계정이면 `55000` 이고 위의 기록도 되감긴다.
 *    **다른 결과로 바꿔도 정지를 풀지 않는다** — 해제는 따로다(G-111 ③).
 *
 * @param p_seen_version 화면이 읽은 처리 버전 — `null` 이면 견주지 않는다(런북의 검토 문만). 화면의 문은 `null` · 음수를 받지 않는다
 * @returns 적은 표(`report` · `retention`) · 새 버전 · 같은 요청의 재시도였는가
 */
create function public.write_report_review(
  p_actor uuid,
  p_report_id uuid,
  p_outcome text,
  p_note text,
  p_sanctioned_user_id uuid,
  p_warning_category text,
  p_seen_version integer,
  p_request_id uuid,
  p_current_only boolean default false)
returns table (written text, review_version integer, replayed boolean)
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  warning constant boolean := p_outcome is not distinct from 'warning';
  earlier public.report_review_entry;
  current_version integer;
  account text;
  category text;
begin
  if p_actor is null or not exists (select 1 from public.operator o where o.user_id = p_actor) then
    raise exception 'review: the reviewer is not an operator' using errcode = '42501';
  end if;

  if p_outcome is null then
    raise exception 'review: an outcome is required' using errcode = '22023';
  end if;

  if p_warning_category is not null and not warning then
    raise exception 'review: a category goes with a warning only' using errcode = '22023';
  end if;

  perform pg_advisory_xact_lock(hashtext('report:review:' || p_report_id::text));

  -- 1. 같은 요청의 재시도 — 자물쇠 뒤, 신고 · 대상을 재기 전에
  if p_request_id is not null then
    select * into earlier from public.report_review_entry e where e.request_id = p_request_id;
    if found then
      if earlier.report_id <> p_report_id or earlier.outcome is distinct from p_outcome
         or earlier.sanctioned_user_id is distinct from p_sanctioned_user_id
         or (p_warning_category is not null and earlier.warning_category is distinct from p_warning_category)
         -- 재시도는 같은 사람의 것이다 — 남의 요청 번호를 들고 와 그 처분을 제 「성공」으로 받지 못한다
         or earlier.actor_user_id is distinct from p_actor then
        raise exception '이 요청 번호는 다른 처분에 쓰였습니다. 화면을 새로 열어 주세요.' using errcode = '22023';
      end if;
      written := case when exists (select 1 from public.report r where r.id = p_report_id) then 'report' else 'retention' end;
      review_version := earlier.version;
      replayed := true;
      return next;
      return;
    end if;
  end if;

  -- 2. 새 처분 — 신고와 읽은 버전
  if p_current_only and not exists (select 1 from public.report r where r.id = p_report_id) then
    raise exception '신고를 찾지 못했습니다.' using errcode = 'P0002';
  end if;

  select count(*)::integer into current_version from public.report_review_entry e where e.report_id = p_report_id;

  if p_seen_version is not null and p_seen_version <> current_version then
    raise exception '다른 운영자가 먼저 처리했습니다.' using errcode = '55000';
  end if;

  -- 3. 지금 결과와 이력 한 줄
  update public.report r
  set reviewed_at = now(),
      reviewed_by = p_actor,
      review_outcome = p_outcome,
      review_note = p_note,
      sanctioned_user_id = p_sanctioned_user_id,
      sanctioned_by = case when p_sanctioned_user_id is not null then p_actor end,
      warning_category = case when warning then coalesce(p_warning_category, r.reason) end,
      warning_ref = case when warning then coalesce(r.warning_ref, public.new_warning_ref(r.id)) else r.warning_ref end,
      -- 경고로 **들어오거나** 경고의 대상 · 갈래가 바뀌면 새 안내다 — 확인과 발송을 비운다. 같은 경고를 다시 적거나 경고에서
      -- 나가면 그대로 둔다(옮긴 경고가 앞 사람의 「확인함」을 물려받지 않게)
      warning_acknowledged_at = case when warning and (r.review_outcome is distinct from 'warning'
                                     or r.sanctioned_user_id is distinct from p_sanctioned_user_id
                                     or r.warning_category is distinct from coalesce(p_warning_category, r.reason)) then null
                                     else r.warning_acknowledged_at end,
      warning_emailed_at = case when warning and (r.review_outcome is distinct from 'warning'
                                     or r.sanctioned_user_id is distinct from p_sanctioned_user_id
                                     or r.warning_category is distinct from coalesce(p_warning_category, r.reason)) then null
                                else r.warning_emailed_at end,
      warning_email_result = case when warning and (r.review_outcome is distinct from 'warning'
                                     or r.sanctioned_user_id is distinct from p_sanctioned_user_id
                                     or r.warning_category is distinct from coalesce(p_warning_category, r.reason)) then null
                                  else r.warning_email_result end
  where r.id = p_report_id
  returning r.warning_category into category;

  if found then
    written := 'report';
  else
    update retention.report k
    set reviewed_at = now(),
        reviewed_by = p_actor,
        review_outcome = p_outcome,
        review_note = p_note,
        sanctioned_user_id = p_sanctioned_user_id,
        sanctioned_by = case when p_sanctioned_user_id is not null then p_actor end,
        warning_category = case when warning then coalesce(p_warning_category, k.reason) end,
        warning_ref = case when warning then coalesce(k.warning_ref, public.new_warning_ref(k.report_id)) else k.warning_ref end,
        warning_acknowledged_at = case when warning and (k.review_outcome is distinct from 'warning'
                                     or k.sanctioned_user_id is distinct from p_sanctioned_user_id
                                     or k.warning_category is distinct from coalesce(p_warning_category, k.reason)) then null
                                       else k.warning_acknowledged_at end,
        warning_emailed_at = case when warning and (k.review_outcome is distinct from 'warning'
                                     or k.sanctioned_user_id is distinct from p_sanctioned_user_id
                                     or k.warning_category is distinct from coalesce(p_warning_category, k.reason)) then null
                                  else k.warning_emailed_at end,
        warning_email_result = case when warning and (k.review_outcome is distinct from 'warning'
                                     or k.sanctioned_user_id is distinct from p_sanctioned_user_id
                                     or k.warning_category is distinct from coalesce(p_warning_category, k.reason)) then null
                                    else k.warning_email_result end
    where k.report_id = p_report_id
    returning k.warning_category into category;

    if not found then
      raise exception 'review: no such report' using errcode = 'P0002';
    end if;
    written := 'retention';
  end if;

  insert into public.report_review_entry (
    report_id, version, outcome, note, sanctioned_user_id, warning_category, actor_user_id, request_id)
  values (p_report_id, current_version + 1, p_outcome, p_note, p_sanctioned_user_id, category, p_actor, p_request_id);

  -- 4. 이용 정지 결정은 같은 트랜잭션에서 계정을 정지한다 — 여기서 실패하면 위의 기록도 되감긴다
  if p_outcome = 'suspension' then
    select a.status into account from public.app_user a where a.id = p_sanctioned_user_id for update;
    if not found then
      raise exception 'review: the sanctioned account is gone' using errcode = 'P0002';
    end if;
    if account <> 'suspended' then
      perform public.change_account_status(
        p_actor, p_sanctioned_user_id, 'suspended', 'report', null, p_report_id, p_request_id);
    end if;
  end if;

  review_version := current_version + 1;
  replayed := false;
  return next;

exception
  when unique_violation then
    -- 같은 요청 번호가 다른 신고에 나란히 왔다 — 자물쇠가 신고마다라 위의 재시도 찾기를 지났다
    if p_request_id is not null and exists (
         select 1 from public.report_review_entry e where e.request_id = p_request_id) then
      raise exception '이 요청 번호는 다른 처분에 쓰였습니다. 화면을 새로 열어 주세요.' using errcode = '22023';
    end if;
    raise;
end;
$$;

revoke execute on function public.write_report_review(uuid, uuid, text, text, uuid, text, integer, uuid, boolean)
  from public, anon, authenticated, service_role;

/**
 * 런북의 검토 문 — `20261020090000` 의 인자 · 돌려주는 값 · 거절을 그대로 두고 몸만 공통 함수로 옮겼다. 버전을 견주지 않는다
 * (지금 것을 덮어쓴다 — 덮어쓴 앞 결과는 이력에 남는다). 판단 근거는 비어도 받는다 — 런북이 적게 한다.
 *
 * @returns 적은 표 — `report`(지금 계정의 신고) · `retention`(떠난 사람의 신고)
 */
create or replace function public.review_report(
  p_report_id uuid,
  p_reviewer uuid,
  p_outcome text,
  p_note text,
  p_sanctioned_user_id uuid default null,
  p_warning_category text default null
)
returns text
language plpgsql
set search_path = ''
as $$
begin
  return (select w.written
          from public.write_report_review(
            p_reviewer, p_report_id, p_outcome, p_note, p_sanctioned_user_id, p_warning_category, null, null) w);
end;
$$;

comment on function public.review_report(uuid, uuid, text, text, uuid, text) is
  '런북의 검토 문 — 버전 없이 지금 것을 덮어쓰고 앞 결과는 처분 이력에 남는다. 운영 SQL 만 (ADR 0107 · 0188)';

-- ---------------------------------------------------------------------------
-- 6. 운영자 문 — 처분
-- ---------------------------------------------------------------------------

/**
 * 신고 상세의 처분 — 결과 넷(`no_action` · `needs_more` · `warning` · `suspension`), 판단 근거 필수(G-111-7, 500자). 경고 · 이용
 * 정지 결정에는 제재 대상(신고의 두 계정 중 하나)이 있어야 한다. 화면이 읽은 처리 버전과 요청 번호를 함께 받는다.
 *
 * @returns 새 처리 버전 · 같은 요청의 재시도였는가
 */
create function public.operator_review_report(
  p_report_id uuid,
  p_outcome text,
  p_note text,
  p_sanctioned_user_id uuid,
  p_warning_category text,
  p_seen_version integer,
  p_request_id uuid)
returns table (review_version integer, replayed boolean)
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  memo constant text := btrim(coalesce(p_note, ''));
  wrote record;
begin
  if not public.is_operator() then
    raise exception '운영자만 쓰는 자리입니다.' using errcode = '42501';
  end if;

  -- 화면은 늘 읽은 버전을 낸다 — 비었거나 음수면 버전 검사를 건너뛰는 길이 되므로 받지 않는다
  if p_seen_version is null or p_seen_version < 0 then
    raise exception '읽은 버전이 없습니다. 화면을 새로 열어 주세요.' using errcode = '22023';
  end if;

  if p_request_id is null then
    raise exception '요청 번호가 없습니다. 화면을 새로 열어 주세요.' using errcode = '22023';
  end if;

  if p_outcome is null or p_outcome not in ('no_action', 'needs_more', 'warning', 'suspension') then
    raise exception '처분을 골라 주세요.' using errcode = '22023';
  end if;

  if length(memo) = 0 then
    raise exception '판단 근거를 적어 주세요.' using errcode = '22023';
  end if;

  if length(memo) > 500 then
    raise exception '판단 근거를 500자 안으로 적어 주세요.' using errcode = '22023';
  end if;

  if (p_outcome in ('warning', 'suspension')) <> (p_sanctioned_user_id is not null) then
    raise exception '제재 대상을 골라 주세요.' using errcode = '22023';
  end if;

  select * into wrote
  from public.write_report_review(
    (select auth.uid()), p_report_id, p_outcome, memo, p_sanctioned_user_id, p_warning_category,
    p_seen_version, p_request_id, true) w;

  perform audit.note_app_access(
    'reports.review', p_report_id,
    format('version=%s', wrote.review_version) || case when wrote.replayed then ' replayed' else '' end,
    'allowed');

  review_version := wrote.review_version;
  replayed := wrote.replayed;
  return next;
end;
$$;

-- ---------------------------------------------------------------------------
-- 7. 운영자 문 — 신고 상세의 대상 회원 요약
-- ---------------------------------------------------------------------------

/**
 * 신고의 두 계정 — 신고받은 계정 · 신고한 계정 한 줄씩. 지금 상태 · 운영자 계정인가 · **현재 신고 기준** 최근 12개월 경고 수와
 * 이 신고의 경고가 그 수에 들었는가(`warned_here` — 이 신고를 다시 경고로 적을 때 두 번 세지 않게), 그리고 처분 이력 최근 셋
 * (신고의 경고 · 이용 정지 결정과 계정 상태 이력). 판단 근거 · 메모 · 신고한 사람은 안 낸다. 떠난 사람의 신고(`retention.report`)는
 * 세지 않는다(G-110 의 경계).
 */
create function public.operator_report_target(p_report_id uuid)
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
          -- 신고의 이용 정지 결정이 건 정지는 위 신고 줄이 이미 말한다 — 한 번의 정지가 두 칸을 먹지 않게
          where c.user_id = a.id and c.to_status in ('suspended', 'active') and c.reason is distinct from 'report'
        ) x
        order by x.at desc
        limit 3
      ) h), '[]'::jsonb)
  from (values ('reported', found_report.reported_user_id), ('reporter', found_report.reporter_user_id)) p(side, id)
  join public.app_user a on a.id = p.id;
end;
$$;

-- ---------------------------------------------------------------------------
-- 8. 목록 문 — 급한 순 · 기한 지남 · 머리의 두 수
-- ---------------------------------------------------------------------------

drop function public.operator_reports(boolean, text, boolean, integer, text);

/**
 * `20261125090000` 의 것에 셋을 더했다 — 차례 `p_order`(`recent` 최신 순 · `urgent` 급한 순: 괴롭힘 · 위협 → 기한 지남 →
 * 접수가 오래된 순, G-111-6), 줄마다 기한 지남(`overdue` — 처리 필요이고 3영업일을 넘김), 그리고 머리의 두 수(처리 필요 ·
 * 기한 지남 — 거르기와 무관한 전체). 나머지는 그대로다.
 */
create function public.operator_reports(
  p_reviewed boolean default null,
  p_reason text default null,
  p_has_snapshot boolean default null,
  p_page integer default 0,
  p_warning_ref text default null,
  p_order text default 'recent'
)
returns table (
  report_id uuid,
  created_at timestamptz,
  reason text,
  reporter_user_id uuid,
  reporter_nickname text,
  reported_user_id uuid,
  reported_nickname text,
  reviewed_at timestamptz,
  review_outcome text,
  snapshot_messages integer,
  pages integer,
  is_open boolean,
  warning_ref text,
  chosen_excerpt text,
  overdue boolean,
  open_count integer,
  overdue_count integer
)
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  page_size constant integer := 30;
  ref constant text := upper(btrim(p_warning_ref));
  urgent constant boolean := p_order is not distinct from 'urgent';
  line record;
  shown uuid[] := '{}';
  opened integer;
  late integer;
begin
  if not public.is_operator() then
    raise exception '운영자만 읽는 자리입니다.' using errcode = '42501';
  end if;

  if p_page is null or p_page < 0 then
    raise exception 'operator: page must be zero or more' using errcode = '22023';
  end if;

  if p_order is null or p_order not in ('recent', 'urgent') then
    raise exception 'operator: order is recent or urgent' using errcode = '22023';
  end if;

  select count(*)::integer, count(*) filter (where public.report_is_overdue(r.created_at))::integer
  into opened, late
  from public.report r
  where public.report_is_open(r.reviewed_at, r.review_outcome);

  for line in
    select
      r.id,
      r.created_at,
      r.reason,
      r.reporter_user_id,
      reporter.nickname as reporter_nickname,
      r.reported_user_id,
      reported.nickname as reported_nickname,
      r.reviewed_at,
      r.review_outcome,
      case when s.report_id is null then null else jsonb_array_length(s.messages) end as snapshot_messages,
      ceil(count(*) over () / page_size::numeric)::integer as pages,
      public.report_is_open(r.reviewed_at, r.review_outcome) as is_open,
      r.warning_ref,
      (select public.report_excerpt(e ->> 'body')
       from jsonb_array_elements(s.messages) e
       where coalesce((e ->> 'chosen')::boolean, false)
       order by (e ->> 'seq')::bigint
       limit 1) as chosen_excerpt,
      public.report_is_open(r.reviewed_at, r.review_outcome) and public.report_is_overdue(r.created_at) as overdue
    from public.report r
    left join public.chat_report_snapshot s on s.report_id = r.id
    left join public.app_user reporter on reporter.id = r.reporter_user_id
    left join public.app_user reported on reported.id = r.reported_user_id
    where (p_reviewed is null or public.report_is_open(r.reviewed_at, r.review_outcome) = not p_reviewed)
      and (p_reason is null or r.reason = p_reason)
      and (p_has_snapshot is null or (s.report_id is not null) = p_has_snapshot)
      and (ref is null or r.warning_ref = ref)
    order by
      case when urgent then public.report_is_open(r.reviewed_at, r.review_outcome) end desc,
      case when urgent then r.reason = 'harassment' end desc,
      case when urgent then public.report_is_open(r.reviewed_at, r.review_outcome)
                            and public.report_is_overdue(r.created_at) end desc,
      case when urgent then r.created_at end asc,
      case when not urgent then r.created_at end desc,
      r.id desc
    limit page_size
    offset p_page::bigint * page_size
  loop
    report_id := line.id;
    created_at := line.created_at;
    reason := line.reason;
    reporter_user_id := line.reporter_user_id;
    reporter_nickname := line.reporter_nickname;
    reported_user_id := line.reported_user_id;
    reported_nickname := line.reported_nickname;
    reviewed_at := line.reviewed_at;
    review_outcome := line.review_outcome;
    snapshot_messages := line.snapshot_messages;
    pages := line.pages;
    is_open := line.is_open;
    warning_ref := line.warning_ref;
    chosen_excerpt := line.chosen_excerpt;
    overdue := line.overdue;
    open_count := opened;
    overdue_count := late;
    if line.chosen_excerpt is not null then
      shown := shown || line.id;
    end if;
    return next;
  end loop;

  /** 쪽을 다 읽은 뒤에 한 줄 — 발췌가 보인 신고 id 들과 함께. 같은 트랜잭션이라 못 적으면 읽은 것도 되감긴다 */
  perform audit.note_app_access(
    'reports.list',
    null,
    format('review=%s reason=%s evidence=%s page=%s',
           coalesce(case p_reviewed when true then 'done' when false then 'open' end, 'all'),
           coalesce(p_reason, 'all'),
           coalesce(case p_has_snapshot when true then 'chat' when false then 'none' end, 'all'),
           p_page)
      || coalesce(' ref=' || ref, '')
      || case when urgent then ' order=urgent' else '' end,
    'allowed',
    nullif(shown, '{}'));
end;
$$;

-- ---------------------------------------------------------------------------
-- 9. 상세 문 — 처리 버전 · 처분 이력 · 남은 정지
-- ---------------------------------------------------------------------------

drop function public.operator_report(uuid);

/**
 * `20261019090000` 의 것에 셋을 더했다 — 처리 버전(`review_version`, 이력 줄 수 — 처분 폼이 함께 낸다), 처분 이력
 * (`review_log` — 최근 것부터: 버전 · 결과 · 제재 대상의 자리 · 경고 갈래 · 판단 근거 · 실행자 닉네임 · 시각 · 「기록 이전」인가),
 * 남은 정지(`held_suspension_side` — 이 신고에서 이용 정지 결정을 받았던 계정이 지금 결과는 정지가 아닌데 여전히 정지면 그 자리).
 * 나머지는 그대로다.
 */
create function public.operator_report(p_report_id uuid)
returns table (
  report_id uuid,
  created_at timestamptz,
  reason text,
  detail text,
  reporter_user_id uuid,
  reporter_nickname text,
  reporter_status text,
  reported_user_id uuid,
  reported_nickname text,
  reported_status text,
  reviewed_at timestamptz,
  reviewer_nickname text,
  review_outcome text,
  review_note text,
  sanctioned_side text,
  captured_at timestamptz,
  context_before integer,
  context_after integer,
  is_open boolean,
  warning_ref text,
  warning_category text,
  warning_acknowledged_at timestamptz,
  review_version integer,
  review_log jsonb,
  held_suspension_side text
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

  perform audit.note_app_access('reports.detail', p_report_id, null, 'allowed');

  return query
  select
    r.id,
    r.created_at,
    r.reason,
    r.detail,
    r.reporter_user_id,
    reporter.nickname,
    reporter.status,
    r.reported_user_id,
    reported.nickname,
    reported.status,
    r.reviewed_at,
    reviewer.nickname,
    r.review_outcome,
    r.review_note,
    case r.sanctioned_user_id
      when r.reporter_user_id then 'reporter'
      when r.reported_user_id then 'reported'
    end,
    s.captured_at,
    s.context_before,
    s.context_after,
    public.report_is_open(r.reviewed_at, r.review_outcome),
    r.warning_ref,
    r.warning_category,
    r.warning_acknowledged_at,
    (select count(*)::integer from public.report_review_entry e where e.report_id = r.id),
    coalesce((
      select jsonb_agg(jsonb_build_object(
               'version', e.version,
               'outcome', e.outcome,
               'sanctioned_side', case e.sanctioned_user_id
                                    when r.reporter_user_id then 'reporter'
                                    when r.reported_user_id then 'reported' end,
               'warning_category', e.warning_category,
               'note', e.note,
               'actor_nickname', (select a.nickname from public.app_user a where a.id = e.actor_user_id),
               'at', e.at,
               'carried_over', e.carried_over)
             order by e.version desc)
      from public.report_review_entry e
      where e.report_id = r.id), '[]'::jsonb),
    (select case held.id when r.reporter_user_id then 'reporter' when r.reported_user_id then 'reported' end
     from public.app_user held
     where held.status = 'suspended'
       and exists (select 1 from public.report_review_entry e
                   where e.report_id = r.id and e.outcome = 'suspension' and e.sanctioned_user_id = held.id)
       and not (r.review_outcome is not distinct from 'suspension' and r.sanctioned_user_id = held.id)
       and held.id in (r.reporter_user_id, r.reported_user_id)
     order by held.id = r.reported_user_id desc
     limit 1)
  from public.report r
  left join public.chat_report_snapshot s on s.report_id = r.id
  left join public.app_user reporter on reporter.id = r.reporter_user_id
  left join public.app_user reported on reported.id = r.reported_user_id
  left join public.app_user reviewer on reviewer.id = r.reviewed_by
  where r.id = p_report_id;
end;
$$;

revoke execute on function public.operator_reports(boolean, text, boolean, integer, text, text)
  from anon, public, service_role;
revoke execute on function public.operator_report(uuid) from anon, public, service_role;
revoke execute on function public.operator_review_report(uuid, text, text, uuid, text, integer, uuid)
  from anon, public, service_role;
revoke execute on function public.operator_report_target(uuid) from anon, public, service_role;

grant execute on function public.operator_reports(boolean, text, boolean, integer, text, text) to authenticated;
grant execute on function public.operator_report(uuid) to authenticated;
grant execute on function public.operator_review_report(uuid, text, text, uuid, text, integer, uuid) to authenticated;
grant execute on function public.operator_report_target(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- 10. 운영자 권한은 이용 중인 계정만 — 정지 · 탈퇴 대기인 운영자 계정은 운영자 문을 못 쓴다(G-111-10)
-- ---------------------------------------------------------------------------

/**
 * 지금 부른 사람이 운영자인가 — 운영자 표에 있고 **계정이 이용 중일 때만.** 운영자 계정을 정지하는 길은 공통 함수가 막지만
 * (권한을 먼저 걷는다, `docs/ops/runbook/operators.md`), 스스로의 탈퇴 신청이나 직접 UPDATE 로 계정이 멈춘 운영자가 처분 ·
 * 지급을 이어 하지 못하게 판정하는 자리 하나에서 닫는다. 밖에서는 못 묻는 것은 그대로다.
 */
create or replace function public.is_operator()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.operator o
    join public.app_user a on a.id = o.user_id
    where o.user_id = (select auth.uid()) and a.status = 'active'
  );
$$;

revoke execute on function public.is_operator() from anon, public, authenticated, service_role;

-- ---------------------------------------------------------------------------
-- 11. 무상 지급의 공통 함수도 실행자가 운영자인지 재고, 같은 요청의 재시도는 같은 사람의 것만 받는다 — 처분 · 상태의 공통
--     함수와 같은 규율(ADR 0188). 몸은 `20261214090000` 그대로이고 두 검사만 더했다
-- ---------------------------------------------------------------------------

create or replace function public.book_reading_credit_grant(
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
  -- 실행자는 운영자다 — 처분 · 상태의 공통 함수와 같은 검사(런북에서 UUID 를 잘못 넣어도 아무나 실행자로 남지 않게)
  if not exists (select 1 from public.operator o where o.user_id = p_actor) then
    raise exception '운영자만 지급 · 회수합니다.' using errcode = '42501';
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
       or earlier.reason <> p_reason or earlier.actor_user_id is distinct from p_actor then
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

revoke execute on function public.book_reading_credit_grant(uuid, uuid, text, integer, text, text, uuid, uuid, integer)
  from public, anon, authenticated, service_role;
