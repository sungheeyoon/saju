-- 신고와 계정 삭제 요청
--
-- 공개 범위를 넓히기 전에 갖춰야 하는 안전 운영 기반의 나머지 둘이다(`prd-archive`: US 61 · 69).
-- 차단은 이미 있다 — 차단은 **내가 안 보겠다**는 것이고, 신고는 **운영자가 봐야
-- 한다**는 것이다. 한 버튼으로 합치면 「보기 싫다」와 「규칙을 어겼다」가 같은 기록이
-- 되어 제재의 근거가 되지 못한다.

-- ---------------------------------------------------------------------------
-- 신고
-- ---------------------------------------------------------------------------

/**
 * 한 사람이 다른 사람을 운영자에게 알린 사건.
 *
 * **차단과 나란히 두되 합치지 않는다.** 차단은 되돌릴 수 없는 개인적 결정이고 신고는
 * 운영자에게 넘기는 기록이다. 신고했다고 자동으로 차단하지 않는다 — 신고한 뒤에도
 * 대화를 이어 갈지는 신고한 사람이 정할 일이고, 그 둘을 묶으면 「신고하면 관계가
 * 끊긴다」가 되어 신고를 망설이게 만든다.
 *
 * **같은 사람을 여러 번 신고할 수 있다.** 사건이 여러 번 일어날 수 있기 때문이다.
 * `block` 이 쌍을 기본키로 두는 것과 여기가 다른 이유다 — 차단은 상태이고 신고는 사건이다.
 */
create table public.report (
  id uuid primary key default gen_random_uuid(),
  reporter_user_id uuid not null references public.app_user (id) on delete cascade,
  reported_user_id uuid not null references public.app_user (id) on delete cascade,

  /**
   * 왜 알리는가 — **고른 것만 받는다.**
   *
   * 자유 서술만 받으면 운영자가 매번 읽어서 분류해야 하고, 분류가 사람마다 달라져
   * 「무엇이 몇 건인가」를 셀 수 없다. 자유 서술은 `detail` 이 따로 받는다.
   */
  reason text not null check (reason in ('harassment', 'impersonation', 'inappropriate', 'other')),

  /** 사용자가 적은 말. 없을 수 있다 — 빈 문자열로 저장하지 않는다 */
  detail text check (detail is null or length(btrim(detail)) between 1 and 1000),

  created_at timestamptz not null default now(),

  /**
   * 운영자가 본 시각.
   *
   * 처분 자체는 여기 적지 않는다 — 제재는 `app_user.status` 가 들고, 이 표에 결론까지
   * 적으면 같은 사실이 두 자리에 있게 된다. 여기 남는 것은 「봤다」뿐이다.
   */
  reviewed_at timestamptz,

  constraint cannot_report_self check (reporter_user_id <> reported_user_id)
);

create index report_unreviewed on public.report (created_at desc) where reviewed_at is null;
create index report_by_reported on public.report (reported_user_id, created_at desc);

-- ---------------------------------------------------------------------------
-- 계정 삭제 요청
-- ---------------------------------------------------------------------------

/**
 * **상태를 하나 더 둔다 — 새 관문을 두지 않는다.**
 *
 * 「삭제를 요청하면 discovery·요청·Match·AI 를 즉시 막는다」(`prd-archive`)를 새 칸으로 두면
 * 막는 자리마다 `is_active_account()` 와 그 칸을 **둘 다** 물어야 하고, 자리가 여럿이면
 * 하나는 안 고쳐진다. 그래서 이미 모든 문이 묻고 있는 값 하나에 값을 더한다 —
 * `is_active_account()` 는 그대로 `status = 'active'` 를 보므로 새로 고칠 문이 없다.
 *
 * `suspended` 와 갈라 두는 것은 **이유가 다르기 때문**이다. 하나는 운영자가 건 제재이고
 * 하나는 본인이 낸 요청이다. 한 값으로 합치면 화면이 「중지된 계정입니다」라고만 말하게
 * 되고, 자기가 요청해서 그렇게 된 사람에게 그 문장은 거짓이 된다.
 */
alter table public.app_user drop constraint app_user_status_check;
alter table public.app_user add constraint app_user_status_check
  check (status in ('active', 'suspended', 'deletion_requested'));

/** 언제 요청했는가 — 보존 기간을 세는 자리는 공개 출시 전에 정한다(`prd-archive`) */
alter table public.app_user add column deletion_requested_at timestamptz;

alter table public.app_user add constraint deletion_time_matches_status
  check ((status = 'deletion_requested') = (deletion_requested_at is not null));

-- ---------------------------------------------------------------------------
-- 권한 — 신고 기록은 **신고한 사람만** 자기 것을 본다
-- ---------------------------------------------------------------------------

revoke all on public.report from anon, authenticated;
alter table public.report enable row level security;

/**
 * 넣는 것도 읽는 것도 표에 직접 하지 못한다.
 *
 * 넣는 것은 RPC 가 한다(자격을 묻고 대상이 실재하는지 확인해야 한다). 읽는 것은
 * 정책으로 연다 — 화면이 「이미 신고했습니다」를 말하려면 자기 것을 셀 수 있어야 한다.
 * **신고당한 쪽에게는 열지 않는다.** 누가 자기를 신고했는지 보이면 그것이 곧 보복의
 * 통로다.
 */
grant select on public.report to authenticated;

create policy "내가 낸 신고만 보인다"
on public.report for select to authenticated
using (reporter_user_id = (select auth.uid()));

-- ---------------------------------------------------------------------------
-- 신고하는 문
-- ---------------------------------------------------------------------------

/**
 * 신고한다 — **차단과 같은 관문을 지난다.**
 *
 * 대상이 실재하지 않으면 조용히 아무 일도 하지 않는다(`block_user` 와 같다). 없는
 * 사람을 신고하려 할 때 오류로 답하면 이 문이 「그 계정이 있는가」를 묻는 문이 된다.
 */
create or replace function public.report_user(
  p_user_id uuid,
  p_reason text,
  p_detail text default null
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor uuid := (select auth.uid());
  trimmed text := nullif(btrim(coalesce(p_detail, '')), '');
begin
  if actor is null then
    raise exception '로그인이 필요합니다.' using errcode = '28000';
  end if;

  if not public.is_active_account() then
    raise exception '중지된 계정입니다.' using errcode = '42501';
  end if;

  if p_user_id is null or p_user_id = actor then
    raise exception '자기 자신은 신고할 수 없습니다.' using errcode = '22023';
  end if;

  if p_reason is null or p_reason not in ('harassment', 'impersonation', 'inappropriate', 'other') then
    raise exception '신고 사유를 골라 주세요.' using errcode = '22023';
  end if;

  if trimmed is not null and length(trimmed) > 1000 then
    raise exception '적어 주신 내용이 너무 깁니다.' using errcode = '22023';
  end if;

  /**
   * **아무나 신고할 수는 없다.** 마주친 적 있는 사람만 신고할 수 있다 — 후보로 봤거나,
   * 요청을 주고받았거나, Match 가 성립한 사이다. 이 조건이 없으면 uuid 를 넣어 보는
   * 것만으로 남의 계정에 신고를 쌓을 수 있다.
   */
  if not exists (
    select 1 from public.discovery_impression i
    where i.viewer_user_id = actor and i.candidate_user_id = p_user_id
    union all
    select 1 from public.match_request r
    where (r.requester_user_id = actor and r.addressee_user_id = p_user_id)
       or (r.requester_user_id = p_user_id and r.addressee_user_id = actor)
    union all
    select 1 from public.match m
    where (m.user_low = actor and m.user_high = p_user_id)
       or (m.user_low = p_user_id and m.user_high = actor)
  ) then
    raise exception '마주친 적 없는 사람은 신고할 수 없습니다.' using errcode = '42501';
  end if;

  insert into public.report (reporter_user_id, reported_user_id, reason, detail)
  select actor, p_user_id, p_reason, trimmed
  where exists (select 1 from public.app_user u where u.id = p_user_id);

  return true;
end;
$$;

-- ---------------------------------------------------------------------------
-- 떠나는 문
-- ---------------------------------------------------------------------------

/**
 * 계정 삭제를 요청한다.
 *
 * **지우지 않는다.** 폐쇄 MVP 에서 실제 삭제는 운영자가 처리하고(`prd-archive`), 무엇을
 * 삭제·익명화·보존할지는 공개 출시 전에 따로 정한다 — 다른 User 의 권리와 이미 공유된
 * 결과가 얽혀 있어 무조건 연쇄 삭제하지 않기로 했기 때문이다.
 *
 * 이 함수가 **즉시** 하는 일은 셋이다.
 *
 * 1. 상태를 옮긴다 — 그 한 값이 discovery·요청·수락·Reading 생성을 다 막는다.
 * 2. 매칭 참여를 끄고 매칭 풀에 내놓은 오행 요약을 거둔다.
 * 3. 살아 있던 요청을 끝낸다. 안 끝내면 상대가 답할 수 없는 요청을 계속 본다.
 *
 * 성립한 Match 는 건드리지 않는다. 두 사람의 것이고 한쪽이 지울 수 있는 것이 아니다.
 */
create or replace function public.request_account_deletion()
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor uuid := (select auth.uid());
  account public.app_user;
begin
  if actor is null then
    raise exception '로그인이 필요합니다.' using errcode = '28000';
  end if;

  select * into account from public.app_user where id = actor for update;

  if account.status = 'deletion_requested' then
    -- 두 번 눌러도 처음 요청한 시각을 밀어내지 않는다.
    return true;
  end if;

  if account.status <> 'active' then
    raise exception '중지된 계정입니다.' using errcode = '42501';
  end if;

  update public.app_user
  set status = 'deletion_requested', deletion_requested_at = now()
  where id = actor;

  update public.discovery_profile
  set opted_in_at = null, element_summary = null, element_revision_id = null
  where user_id = actor;

  with ended as (
    update public.match_request
    set status = case when requester_user_id = actor then 'cancelled' else 'rejected' end,
        decided_at = now()
    where status = 'pending'
      and (requester_user_id = actor or addressee_user_id = actor)
    returning id, requester_user_id, status
  )
  insert into public.notification (user_id, kind, request_id)
  select ended.requester_user_id, 'request_rejected', ended.id
  from ended
  where ended.status = 'rejected';

  return true;
end;
$$;

revoke execute on function public.report_user(uuid, text, text) from anon, public;
grant execute on function public.report_user(uuid, text, text) to authenticated;

revoke execute on function public.request_account_deletion() from anon, public;
grant execute on function public.request_account_deletion() to authenticated;
