-- 운영자가 회원 화면에서 신고와 무관한 이용 정지 · 그 해제를 사유 · 실행자와 함께 하고, 처분 이력을 한 목록으로 본다
-- (G-111 ③, ADR 0189)
--
-- 공통 함수(`change_account_status`) · 계정 상태 이력(`account_status_change`) · 상태 바뀜 트리거는 바로 앞 `20261215090000`
-- (ADR 0188 의 5 · 6)이 세웠다 — 누구에게도 안 열렸고 런북이 운영자 UUID 와 함께 불렀다. 이 마이그레이션이 세우는 것:
--
-- 1. **운영자 문 둘** — 정지(`operator_suspend_member`) · 해제(`operator_unsuspend_member`). `authenticated` 에 열고 안에서
--    `is_operator()` 로 닫는다 — **서버 열쇠에는 열지 않는다**(ADR 0043 · 0187 의 까닭 그대로). 실행자는 부른 사람(`auth.uid()`)이다.
--    둘 다 화면 몫의 판정(`screen_change_member_status`)을 지나 공통 함수를 부른다.
-- 2. **읽은 버전 = 그 계정의 상태 이력 줄 수.** 처음 0, 상태가 바뀔 때마다 +1(탈퇴 신청 · 직접 UPDATE 도 줄을 남기므로 센다). 화면이
--    읽은 버전과 지금이 다르면 `55000` — 두 운영자가 같은 계정을 나란히 정지 · 해제하지 않게. 처분 문(ADR 0188 의 3)과 같은 꼴이다.
-- 3. **같은 요청 찾기가 먼저** — 계정 행을 잡은 뒤 같은 요청 번호를 찾고, 있으면 버전을 견주지 않고 공통 함수가 첫 줄을 돌려준다
--    (다른 실행자면 여기서, 다른 계정 · 바뀜 · 갈래면 공통 함수에서 거절). 새 요청일 때만 버전을 잰다.
-- 4. **처분 이력 읽기**(`operator_member_sanctions`) — 신고의 경고 · 이용 정지 결정(현재 신고 기준, `public.report` 만)과 계정 상태
--    이력(정지 · 해제)을 한 목록에, 그리고 지금 상태 · 운영자 계정인가 · 읽은 버전 · 최근 12개월 경고 수. 회원 화면의 「경고 이력」
--    칸이 이것으로 바뀐다 — `operator_member_warnings` 는 지금 운영의 앱이 부르므로 걷지 않는다(앱이 이것으로 옮긴 뒤 좁히기).
--
-- ## 바꾸지 않는 것
--
-- - **신고로 정지하는 것은 신고의 처분이다**(ADR 0188 의 5) — 이 문들은 갈래 `report` 를 받지 않고 관련 신고를 싣지 않는다
--   (`report_reason_names_its_report` — 관련 신고는 그 신고의 정지 결정이라는 뜻이다). 「이용 정지 결정」 신고 기록은 해제해도 그대로다.
-- - 탈퇴 대기의 해제(`deletion_withdrawn`)는 지금처럼 런북이다(기록 「이 범위 밖으로 남긴 것」).
-- - 공통 함수 · 트리거 · 상태 이력 표는 손대지 않는다.
--
-- ## 접속기록
--
-- 쓰기 `members.suspend` · `members.unsuspend`(거른 조건 칸 `user=<id> entry=<id>`, 재시도면 ` replayed`), 읽기 `members.sanctions`
-- (`user=<id>`). 메모 · 닉네임은 적지 않는다(ADR 0105). 거절은 앱이 `note_operator_denial` 로.
--
-- 재는 자리는 `supabase/tests/99_operator_member_suspension.test.sql`.

-- ---------------------------------------------------------------------------
-- 1. 기록 표와 거절 문이 새 동작을 받는다 — 목록은 바로 앞 `20261215090000`(신고 처분 `reports.review` · `reports.target`)의 것에
--    셋을 더했다. 앞 것을 빠뜨리면 이미 적힌 줄이 검사식에 걸려 선다
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
                    'members.sanctions', 'members.suspend', 'members.unsuspend',
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
                         'members.find', 'members.warnings', 'members.credits', 'members.credit_history',
                         'members.sanctions', 'members.suspend', 'members.unsuspend') then
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
-- 2. 화면 몫의 판정 — 정지 · 해제 문 둘이 이것 하나를 지난다. 누구에게도 열지 않는다
-- ---------------------------------------------------------------------------

/**
 * 회원 화면의 정지 · 해제 — 문 둘이 운영자인가를 잰 뒤 부른다.
 *
 * 차례: 모양(읽은 버전 · 요청 번호 · 갈래 · 메모) → 계정 행을 잡는다 → **같은 요청 번호를 먼저 찾는다**(있으면 버전을 견주지 않는다)
 * → 새 요청이면 읽은 버전(그 계정의 상태 이력 줄 수)을 견준다 → 공통 함수(`change_account_status`)가 지금 상태 · 운영자 계정 ·
 * 같은 요청의 내용을 잰다 → 접속기록 한 줄.
 *
 * 화면은 신고와 무관한 정지만 한다 — 갈래 `report` · 관련 신고를 받지 않는다(신고로 정지하는 것은 신고의 처분, ADR 0188 의 5).
 *
 * @param p_status `suspended`(정지) · `active`(해제)
 * @returns 이력 줄 id · 같은 요청의 재시도였는가
 */
create function public.screen_change_member_status(
  p_status text,
  p_user_id uuid,
  p_reason text,
  p_note text,
  p_seen_version integer,
  p_request_id uuid)
returns table (change_id uuid, replayed boolean)
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  memo constant text := btrim(coalesce(p_note, ''));
  now_version integer;
  again boolean := false;
  made uuid;
begin
  -- 화면은 늘 읽은 버전을 낸다 — 비었거나 음수면 버전 검사를 건너뛰는 길이 되므로 받지 않는다
  if p_seen_version is null or p_seen_version < 0 then
    raise exception '읽은 버전이 없습니다. 화면을 새로 열어 주세요.' using errcode = '22023';
  end if;

  if p_request_id is null then
    raise exception '요청 번호가 없습니다. 화면을 새로 열어 주세요.' using errcode = '22023';
  end if;

  if p_status = 'suspended' then
    if p_reason is null or p_reason not in ('policy', 'payment', 'eligibility', 'other') then
      raise exception '사유를 골라 주세요.' using errcode = '22023';
    end if;
  elsif p_status = 'active' then
    if p_reason is null or p_reason not in ('appeal', 'mistake', 'other') then
      raise exception '사유를 골라 주세요.' using errcode = '22023';
    end if;
  else
    raise exception 'member status: suspended or active' using errcode = '22023';
  end if;

  if length(memo) = 0 or length(memo) > 200 then
    raise exception '메모를 200자 안으로 적어 주세요.' using errcode = '22023';
  end if;

  -- 계정 행을 먼저 잡는다 — 나란히 온 두 누름은 한 줄로 서고, 둘째는 첫째의 커밋 뒤에 요청 번호 · 버전을 본다
  perform 1 from public.app_user a where a.id = p_user_id for update;
  if not found then
    raise exception '회원을 찾지 못했습니다.' using errcode = 'P0002';
  end if;

  -- 같은 요청의 재시도는 같은 운영자만이다 — 다른 운영자가 남의 요청 번호로 첫 결과를 받아 가지 못한다
  if exists (select 1 from public.account_status_change c
             where c.request_id = p_request_id and c.actor_user_id is distinct from (select auth.uid())) then
    raise exception '이 요청 번호는 다른 처리에 쓰였습니다. 화면을 새로 열어 주세요.' using errcode = '22023';
  end if;

  again := exists (select 1 from public.account_status_change c where c.request_id = p_request_id);

  if not again then
    select count(*)::integer into now_version from public.account_status_change c where c.user_id = p_user_id;
    if now_version <> p_seen_version then
      raise exception '그 사이 이 회원의 상태가 바뀌었습니다. 새로 읽고 다시 확인해 주세요.' using errcode = '55000';
    end if;
  end if;

  made := public.change_account_status(
    (select auth.uid()), p_user_id, p_status, p_reason, memo, null, p_request_id);

  perform audit.note_app_access(
    case when p_status = 'suspended' then 'members.suspend' else 'members.unsuspend' end,
    null,
    format('user=%s entry=%s', p_user_id, made) || case when again then ' replayed' else '' end,
    'allowed');

  change_id := made;
  replayed := again;
  return next;
end;
$$;

revoke execute on function public.screen_change_member_status(text, uuid, text, text, integer, uuid)
  from public, anon, authenticated, service_role;

-- ---------------------------------------------------------------------------
-- 3. 운영자 문 — 정지 · 해제
-- ---------------------------------------------------------------------------

/**
 * 신고와 무관한 이용 정지 — 이용 중인 계정만, 운영자 계정은 거절(G-111-10). 갈래 `policy`(운영정책 위반) · `payment`(결제 부정) ·
 * `eligibility`(이용 자격) · `other`, 메모 필수 200자(G-111-8).
 */
create function public.operator_suspend_member(
  p_user_id uuid, p_reason text, p_note text, p_seen_version integer, p_request_id uuid)
returns table (change_id uuid, replayed boolean)
language plpgsql
volatile
security definer
set search_path = ''
as $$
begin
  if not public.is_operator() then
    raise exception '운영자만 쓰는 자리입니다.' using errcode = '42501';
  end if;

  return query
  select s.change_id, s.replayed
  from public.screen_change_member_status('suspended', p_user_id, p_reason, p_note, p_seen_version, p_request_id) s;
end;
$$;

/**
 * 이용 정지의 해제 — 이용 정지인 계정만. 갈래 `appeal`(소명 인정) · `mistake`(잘못 정지) · `other`, 메모 필수 200자. 신고의 「이용
 * 정지 결정」 기록은 그대로 남는다 — 해제는 계정의 상태만 바꾼다.
 */
create function public.operator_unsuspend_member(
  p_user_id uuid, p_reason text, p_note text, p_seen_version integer, p_request_id uuid)
returns table (change_id uuid, replayed boolean)
language plpgsql
volatile
security definer
set search_path = ''
as $$
begin
  if not public.is_operator() then
    raise exception '운영자만 쓰는 자리입니다.' using errcode = '42501';
  end if;

  return query
  select s.change_id, s.replayed
  from public.screen_change_member_status('active', p_user_id, p_reason, p_note, p_seen_version, p_request_id) s;
end;
$$;

-- ---------------------------------------------------------------------------
-- 4. 운영자 문 — 처분 이력
-- ---------------------------------------------------------------------------

/**
 * 한 회원의 처분 이력 — 한 줄(없는 계정이면 빈 결과).
 *
 * - `status` · `is_operator` — 지금 상태와 운영자 계정인가. 화면이 단추(「이용 정지」 · 「정지 해제」)를 고르고, 운영자 계정이면
 *   정지 단추를 세우지 않는다(G-111-10). 최종으로 막는 것은 공통 함수다.
 * - `version` — 그 계정의 상태 이력 줄 수. 정지 · 해제 문이 받는 「읽은 버전」이다.
 * - `warnings_12m` — **현재 신고 기준** 최근 12개월 경고 수(ADR 0108 추기 — `operator_member_warnings` 의 `counted` 와 같은 셈).
 * - `lines` — 최근 것부터, 200줄까지. 두 갈래:
 *   - 신고 처분(`source = 'report'`) — 이 계정이 제재 대상인 경고 · 이용 정지 결정. 신고 id · 갈래 · 안내번호 · 이용자 확인 ·
 *     12개월 셈 · 실행자 닉네임(`reviewed_by`). 판단 근거는 안 낸다 — 신고 상세가 든다. 떠난 사람의 신고(`retention.report`)는
 *     읽지 않는다(G-110 의 경계).
 *   - 계정 상태(`source = 'status'`) — 정지 · 해제로 바뀐 줄. 신고의 정지 결정이 건 정지(갈래 `report`)는 위 신고 줄이 이미 말하므로
 *     두 번 세우지 않는다(대상 요약의 최근 셋과 같다) — 읽은 버전에는 든다(`kind` 가 `suspended` · `active`, 앞 상태는 `from_status` — 탈퇴
 *     대기의 해제도 `active` 다). 갈래 · 메모 · 관련 신고 · 실행자 닉네임, 그리고 `recorded` — 갈래 · 실행자가 비었으면 공통 함수 밖의 변경이다(화면이 「실행자 · 사유 없음」 딱지를 단다).
 *
 * 실행자는 닉네임으로만 낸다(G-111-9) — 내부 기록은 UUID 그대로다.
 */
create function public.operator_member_sanctions(p_user_id uuid)
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
            and c.reason is distinct from 'report'
        ) x
        order by x.at desc, x.id desc
        limit 200
      ) h), '[]'::jsonb)
  from public.app_user a
  where a.id = p_user_id;
end;
$$;

revoke execute on function public.operator_suspend_member(uuid, text, text, integer, uuid) from public, anon, service_role;
revoke execute on function public.operator_unsuspend_member(uuid, text, text, integer, uuid) from public, anon, service_role;
revoke execute on function public.operator_member_sanctions(uuid) from public, anon, service_role;
grant execute on function public.operator_suspend_member(uuid, text, text, integer, uuid) to authenticated;
grant execute on function public.operator_unsuspend_member(uuid, text, text, integer, uuid) to authenticated;
grant execute on function public.operator_member_sanctions(uuid) to authenticated;
