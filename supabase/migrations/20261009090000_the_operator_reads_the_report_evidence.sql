-- 운영자가 **신고와 그 근거 스냅샷을 화면에서 읽는다** (G-24 1차판, ADR 0103)
--
-- 채팅 안전 베타까지 신고를 읽는 길은 runbook 의 SQL 이었다(「신고와 차단」 · 「채팅 — 신고 스냅샷을
-- 읽는다」). 설문이 그랬던 것처럼(`20260915150000`) 읽기만 하는 일에 매번 쓰기 권한이 있는 자리로
-- 들어가야 했고, 스냅샷을 펴는 `jsonb_array_elements` 질의는 문서에만 있어 아무도 재지 않았다.
--
-- 그래서 읽는 문 셋을 세운다 — 목록 · 한 건 · 그 한 건의 스냅샷. 셋 다 `is_operator()` 를 묻고,
-- `authenticated` 에게만 열고, `service_role` 에는 안 연다(운영자 표와 같은 까닭 — 그 열쇠가 새면
-- 남의 신고를 읽는 문이 된다).
--
-- ## 무엇을 **안** 내주나
--
-- - **이메일 · 출생정보 · 사주 입력 · 풀이 · 저장한 사람.** 신고를 읽는 데 필요한 것은 두 계정을
--   가르는 것뿐이고, 그것은 닉네임과 내부 UUID 로 된다. 이메일은 runbook 의 SQL 에만 남는다.
-- - **대화방과 현재 메시지.** 스냅샷은 신고 당시의 사본이다(ADR 0091). `match_id` · `message_id` 도
--   안 내준다 — 화면에 방으로 가는 실마리가 서면 그것이 곧 「전체 대화를 여는 열쇠」의 첫 걸음이다.
-- - **보낸 사람의 UUID.** 스냅샷의 한 줄은 두 계정 중 어느 쪽이 보냈는지만 내준다 — 방에는 둘뿐이다.
-- - **떠난 사람의 신고(`retention.report`).** ADR 0098 의 경계 그대로다. 그 스키마에는 손대지 않고,
--   읽는 길은 runbook 의 SQL 하나다.
--
-- ## 쓰는 문은 없다
--
-- 검토 완료(`reviewed_at`) · 이용 정지 · 메모는 이 마이그레이션에 없다. 1차판은 읽기 전용이고
-- 검토 완료는 당분간 runbook 의 한 줄이다.

/**
 * 신고 목록 — 최신부터 **30건씩.**
 *
 * 한 쪽의 수(30)는 이 함수만 안다. 화면은 그 수 대신 거른 결과의 쪽 수(`pages`)를 받는다 — 수를
 * 두 자리에 적으면 한쪽만 바뀌는 날 마지막 쪽이 사라지거나 빈 쪽이 선다.
 *
 * 거르는 칸 셋은 다 `null` 이면 안 거른다. 검토 여부는 `reviewed_at` 이 있는가 하나다.
 */
create or replace function public.operator_reports(
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
  snapshot_messages integer,
  pages integer
)
language plpgsql
stable
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
    case when s.report_id is null then null else jsonb_array_length(s.messages) end,
    ceil(count(*) over () / page_size::numeric)::integer
  from public.report r
  left join public.chat_report_snapshot s on s.report_id = r.id
  left join public.app_user reporter on reporter.id = r.reporter_user_id
  left join public.app_user reported on reported.id = r.reported_user_id
  where (p_reviewed is null or (r.reviewed_at is not null) = p_reviewed)
    and (p_reason is null or r.reason = p_reason)
    and (p_has_snapshot is null or (s.report_id is not null) = p_has_snapshot)
  order by r.created_at desc, r.id desc
  limit page_size
  offset p_page::bigint * page_size;
end;
$$;

/**
 * 신고 한 건 — 두 계정의 **지금** 상태까지.
 *
 * 계정 상태는 근거가 아니라 「지금 이 사람에게 무슨 일이 걸려 있나」다. 화면은 그것을 신고 칸 옆에
 * 두고, 스냅샷 안에는 섞지 않는다. 없는 신고는 빈 결과다 — 「그런 신고가 있나」를 오류로 답하지 않는다.
 */
create or replace function public.operator_report(p_report_id uuid)
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
  captured_at timestamptz,
  context_before integer,
  context_after integer
)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if not public.is_operator() then
    raise exception '운영자만 읽는 자리입니다.' using errcode = '42501';
  end if;

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
    s.captured_at,
    s.context_before,
    s.context_after
  from public.report r
  left join public.chat_report_snapshot s on s.report_id = r.id
  left join public.app_user reporter on reporter.id = r.reporter_user_id
  left join public.app_user reported on reported.id = r.reported_user_id
  where r.id = p_report_id;
end;
$$;

/**
 * 한 신고의 스냅샷을 **베낀 차례대로** 편다 — 사본(`chat_report_snapshot.messages`)만 읽는다.
 *
 * 보낸 쪽은 신고의 두 계정에 대어 `reporter` · `reported` 로 옮긴다. 어느 쪽도 아니면 `null` 이다 —
 * 베낄 때 이미 보낸 사람이 떠나 칸이 비어 있던 줄이다(ADR 0094). 고른 메시지는 `chosen` 이 참인
 * 한 줄이고, 그 참을 여기서 다시 판정하지 않는다 — 베낄 때 적힌 값을 그대로 낸다.
 */
create or replace function public.operator_report_snapshot(p_report_id uuid)
returns table (
  seq bigint,
  sent_at timestamptz,
  side text,
  body text,
  chosen boolean
)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if not public.is_operator() then
    raise exception '운영자만 읽는 자리입니다.' using errcode = '42501';
  end if;

  return query
  select
    (e ->> 'seq')::bigint,
    (e ->> 'created_at')::timestamptz,
    case (e ->> 'sender_user_id')::uuid
      when r.reporter_user_id then 'reporter'
      when r.reported_user_id then 'reported'
    end,
    e ->> 'body',
    coalesce((e ->> 'chosen')::boolean, false)
  from public.chat_report_snapshot s
  join public.report r on r.id = s.report_id
  cross join lateral jsonb_array_elements(s.messages) e
  where s.report_id = p_report_id
  order by (e ->> 'seq')::bigint;
end;
$$;

revoke execute on function public.operator_reports(boolean, text, boolean, integer)
  from anon, public, service_role;
revoke execute on function public.operator_report(uuid) from anon, public, service_role;
revoke execute on function public.operator_report_snapshot(uuid) from anon, public, service_role;

grant execute on function public.operator_reports(boolean, text, boolean, integer) to authenticated;
grant execute on function public.operator_report(uuid) to authenticated;
grant execute on function public.operator_report_snapshot(uuid) to authenticated;
