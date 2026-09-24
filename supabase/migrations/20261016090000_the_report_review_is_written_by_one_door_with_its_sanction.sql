-- 신고 검토는 **문 하나**가 적고, 이용 정지 결정은 그 자리에서 계정을 정지한다 (ADR 0107, G-24)
--
-- 2026-09-24 에 로컬에서 되돌린 트랜잭션으로 잰 값(설명서 「신고 검토 결과」): 검토 기록(`20261010090000`)과 실제 제재
-- (`app_user.status`)는 DB 에서 서로 몰랐다. runbook 의 검토 SQL 은 UPDATE 둘이었고 둘째(정지)를 빠뜨려도 통과했다 —
-- 화면에서는 「해제한 뒤」와 「안 건 것」이 똑같이 보였다. 그 밖에 넷이 통과했다: `no_action`(조치 없음)에 제재 대상 ·
-- `warning`(경고)에 제재 대상 없음 · 운영자가 아닌 UUID 를 검토한 사람으로 · 결과 없이 제재 대상만. 그리고 `needs_more`
-- (추가 확인 필요)는 `reviewed_at` 이 차서 「검토함」으로 분류돼 미검토 목록과 3영업일 질의에서 빠졌다 — 보류한 건을 다시
-- 볼 목록이 없었다. 같은 날 운영 DB 의 두 표(`public.report` · `retention.report`)는 0줄이었다(건수만 쟀다).
--
-- ## 처리 필요 — 정의 하나
--
-- **처리 필요 = 아직 안 봤거나(`reviewed_at is null`) 추가 확인 필요(`needs_more`)다.** 처리 완료는 나머지 — 조치 없음 ·
-- 경고 · 이용 정지 결정, 그리고 결과 칸이 생기기 전에 본 옛 검토(시각만 있고 결과가 없는 줄)다. 이 정의는
-- `public.report_is_open` 한 곳에 있고 운영자 목록 문 · runbook 의 미검토 · 3영업일 질의 · 월 점검이 그것을 부른다.
-- 3영업일은 **처음 접수한 시각부터** 센다 — 보류해도 시계는 처음으로 안 돌아간다.
--
-- ## 문 하나 — `public.review_report`
--
-- 검토를 적는 길을 이 문 하나로 모은다. 부르는 사람은 운영자다(CLI, `npm run db:remote` — 목적과 해시가 접속기록에
-- 남는다). `auth.uid()` 가 없으므로 검토한 운영자를 인자로 받고 **그 id 가 `public.operator` 에 있는지 먼저 묻는다.**
-- 결과가 `suspension`(이용 정지 결정)이면 **같은 트랜잭션에서** 제재 대상의 계정을 `suspended` 로 옮긴다 — 한쪽이 실패하면
-- 둘 다 되감긴다. 떠난 사람의 신고(`retention.report`, ADR 0098)도 같은 문이 적는다 — 이용 정지를 적는데 그 계정이 이미
-- 없으면 거절한다(정지할 계정이 없는데 정지했다고 적지 않는다).
--
-- **묶음은 적는 순간에만이다.** 「이용 정지 결정」 줄이 있는 동안 계정이 계속 정지여야 한다는 영구 제약은 두지 않는다 —
-- 나중에 해제해도(runbook 「이용 정지와 해제」) 기록은 그때의 판단으로 그대로 선다.
--
-- ## 표의 제약 — 결과와 제재 대상이 맞물린다
--
-- `sanction_follows_the_outcome`: 경고 · 이용 정지 결정은 제재 대상과 실행한 운영자가 **둘 다 있어야** 하고, 그 밖의 결과
-- (조치 없음 · 추가 확인 필요 · 결과 없음)는 **둘 다 없어야** 한다. `suspension_names_who` 는 이것에 들어가므로 걷는다.
-- `retention.report` 에는 지금까지 칸의 모양 검사만 있었다 — `public.report` 의 논리 제약 다섯을 같은 이름으로 건다.
-- 계정의 **지금** 상태는 어느 표에서도 검사하지 않는다(떠난 사람은 계정이 없다). 옮기는 트리거는 `public.report` 의 줄을
-- 그대로 베끼므로 옮긴 줄은 같은 제약을 이미 지킨다.

-- ── 처리 필요 ────────────────────────────────────────────────────────────────

/** 처리 필요인가 — 안 봤거나 추가 확인 필요. 옛 검토(시각만 있고 결과 없음)는 처리 완료다 */
create function public.report_is_open(p_reviewed_at timestamptz, p_outcome text)
returns boolean
language sql
immutable
set search_path = ''
as $$
  select p_reviewed_at is null or p_outcome is not distinct from 'needs_more'
$$;

comment on function public.report_is_open(timestamptz, text) is
  '처리 필요 = reviewed_at is null or review_outcome = needs_more. 목록 문 · runbook 질의 · 월 점검이 같이 부른다 (ADR 0107)';

revoke execute on function public.report_is_open(timestamptz, text) from public, anon, authenticated, service_role;

-- ── 제약 ────────────────────────────────────────────────────────────────────

alter table public.report
  drop constraint suspension_names_who,
  add constraint sanction_follows_the_outcome check (
    case when review_outcome in ('warning', 'suspension')
      then sanctioned_user_id is not null and sanctioned_by is not null
      else sanctioned_user_id is null and sanctioned_by is null
    end);

alter table retention.report
  add constraint review_has_a_reviewer
    check (review_outcome is null or (reviewed_at is not null and reviewed_by is not null)),
  add constraint review_note_needs_an_outcome
    check (review_note is null or review_outcome is not null),
  add constraint sanction_falls_on_a_party
    check (sanctioned_user_id is null or sanctioned_user_id in (reporter_user_id, reported_user_id)),
  add constraint sanction_has_an_actor
    check ((sanctioned_user_id is null) = (sanctioned_by is null)),
  add constraint sanction_follows_the_outcome check (
    case when review_outcome in ('warning', 'suspension')
      then sanctioned_user_id is not null and sanctioned_by is not null
      else sanctioned_user_id is null and sanctioned_by is null
    end);

comment on column public.report.review_outcome is
  '검토 결과 — no_action · warning · suspension · needs_more. review_report 하나가 적는다 (ADR 0105 · 0107)';

-- ── 검토를 적는 문 ──────────────────────────────────────────────────────────

/**
 * 신고 한 건의 검토를 적는다 — 운영자가 CLI 로 부른다(`npm run db:remote`, runbook 「신고와 차단」).
 *
 * 제재 대상은 신고의 두 계정 중 하나이고 경고 · 이용 정지 결정에만 준다. 실행한 운영자는 검토한 운영자다.
 * 모양이 틀리면 표의 제약이 `23514` 로 거절한다 — 여기서 같은 검사를 다시 적지 않는다.
 *
 * @returns 적은 표 — `report`(지금 계정의 신고) · `retention`(떠난 사람의 신고)
 */
create function public.review_report(
  p_report_id uuid,
  p_reviewer uuid,
  p_outcome text,
  p_note text,
  p_sanctioned_user_id uuid default null
)
returns text
language plpgsql
set search_path = ''
as $$
declare
  written text;
begin
  if p_reviewer is null or not exists (select 1 from public.operator o where o.user_id = p_reviewer) then
    raise exception 'review: the reviewer is not an operator' using errcode = '42501';
  end if;

  if p_outcome is null then
    raise exception 'review: an outcome is required' using errcode = '22023';
  end if;

  update public.report r
  set reviewed_at = now(),
      reviewed_by = p_reviewer,
      review_outcome = p_outcome,
      review_note = p_note,
      sanctioned_user_id = p_sanctioned_user_id,
      sanctioned_by = case when p_sanctioned_user_id is not null then p_reviewer end
  where r.id = p_report_id;

  if found then
    written := 'report';
  else
    update retention.report k
    set reviewed_at = now(),
        reviewed_by = p_reviewer,
        review_outcome = p_outcome,
        review_note = p_note,
        sanctioned_user_id = p_sanctioned_user_id,
        sanctioned_by = case when p_sanctioned_user_id is not null then p_reviewer end
    where k.report_id = p_report_id;

    if not found then
      raise exception 'review: no such report' using errcode = 'P0002';
    end if;
    written := 'retention';
  end if;

  -- 이용 정지 결정은 같은 트랜잭션에서 계정을 정지한다 — 여기서 실패하면 위의 기록도 되감긴다
  if p_outcome = 'suspension' then
    update public.app_user a set status = 'suspended' where a.id = p_sanctioned_user_id;
    if not found then
      raise exception 'review: the sanctioned account is gone' using errcode = 'P0002';
    end if;
  end if;

  return written;
end;
$$;

comment on function public.review_report(uuid, uuid, text, text, uuid) is
  '신고 검토를 적는 문 하나 — 운영자 CLI 만. 이용 정지 결정은 같은 트랜잭션에서 계정을 정지한다 (ADR 0107)';

revoke execute on function public.review_report(uuid, uuid, text, text, uuid)
  from public, anon, authenticated, service_role;

-- ── 운영자 문 둘 — 처리 필요를 거르고 낸다 ─────────────────────────────────────

-- 반환 칸(`is_open`)이 느는 것은 옛 앱에 안전하다 — 옛 앱은 아는 칸만 집는다. 칸이 바뀌므로 다시 짓고 권한을 다시 준다.
drop function public.operator_reports(boolean, text, boolean, integer);
drop function public.operator_report(uuid);

/**
 * `20261010100000` 의 것에서 세 자리만 바꿨다 — 거르는 칸(`p_reviewed` 는 이제 「처리 완료인가」)이 `report_is_open` 을
 * 부르고, 줄마다 처리 필요인가(`is_open`)를 내고, 접속기록의 거른 조건이 `review=done|open|all` 로 적힌다. 인자 이름은
 * 옛 앱이 부르는 그대로 둔다.
 */
create function public.operator_reports(
  p_reviewed boolean default null,
  p_reason text default null,
  p_has_snapshot boolean default null,
  p_page integer default 0
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
  is_open boolean
)
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  page_size constant integer := 30;
begin
  if not public.is_operator() then
    raise exception '운영자만 읽는 자리입니다.' using errcode = '42501';
  end if;

  if p_page is null or p_page < 0 then
    raise exception 'operator: page must be zero or more' using errcode = '22023';
  end if;

  perform audit.note_app_access(
    'reports.list',
    null,
    format('review=%s reason=%s evidence=%s page=%s',
           coalesce(case p_reviewed when true then 'done' when false then 'open' end, 'all'),
           coalesce(p_reason, 'all'),
           coalesce(case p_has_snapshot when true then 'chat' when false then 'none' end, 'all'),
           p_page),
    'allowed');

  return query
  select
    r.id,
    r.created_at,
    r.reason,
    r.reporter_user_id,
    reporter.nickname,
    r.reported_user_id,
    reported.nickname,
    r.reviewed_at,
    r.review_outcome,
    case when s.report_id is null then null else jsonb_array_length(s.messages) end,
    ceil(count(*) over () / page_size::numeric)::integer,
    public.report_is_open(r.reviewed_at, r.review_outcome)
  from public.report r
  left join public.chat_report_snapshot s on s.report_id = r.id
  left join public.app_user reporter on reporter.id = r.reporter_user_id
  left join public.app_user reported on reported.id = r.reported_user_id
  where (p_reviewed is null or public.report_is_open(r.reviewed_at, r.review_outcome) = not p_reviewed)
    and (p_reason is null or r.reason = p_reason)
    and (p_has_snapshot is null or (s.report_id is not null) = p_has_snapshot)
  order by r.created_at desc, r.id desc
  limit page_size
  offset p_page::bigint * page_size;
end;
$$;

/** `20261010100000` 의 것에 처리 필요인가(`is_open`) 한 칸을 더했다 — 나머지는 한 글자도 안 바꿨다 */
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
  is_open boolean
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
    public.report_is_open(r.reviewed_at, r.review_outcome)
  from public.report r
  left join public.chat_report_snapshot s on s.report_id = r.id
  left join public.app_user reporter on reporter.id = r.reporter_user_id
  left join public.app_user reported on reported.id = r.reported_user_id
  left join public.app_user reviewer on reviewer.id = r.reviewed_by
  where r.id = p_report_id;
end;
$$;

revoke execute on function public.operator_reports(boolean, text, boolean, integer)
  from anon, public, service_role;
revoke execute on function public.operator_report(uuid) from anon, public, service_role;

grant execute on function public.operator_reports(boolean, text, boolean, integer) to authenticated;
grant execute on function public.operator_report(uuid) to authenticated;
