-- 정지된 이용자가 제 정지의 사유 갈래를 읽고, 정지된 사람의 탈퇴 요청은 문의로 받아 운영자가 탈퇴 대기로 옮긴다
-- (G-111-8 · R-1, ADR 0190)
--
-- 공통 함수(`change_account_status`) · 계정 상태 이력(`account_status_change`) · 상태 바뀜 트리거는 `20261215090000`(ADR 0188)이,
-- 회원 화면의 정지 · 해제 문은 `20261216090000`(ADR 0189)이 세웠다. 이 마이그레이션이 세우는 것:
--
-- 1. **본인의 문 하나**(`my_suspension`) — 지금 이용 정지인 사람만 제 닉네임과 지금 정지의 갈래를 읽는다. 정지 화면의 본문이
--    이것으로 선다. `is_active_account()` 를 묻지 않는다 — 정지된 사람이 읽는 문이라서다. 갈래만 나간다: 메모 · 실행자 · 관련 신고 ·
--    시각은 안 나간다. 상태 이력에 갈래가 없으면(직접 UPDATE · `20261215090000` 전의 정지) 갈래가 빈 한 줄이다.
-- 2. **정지 → 탈퇴 대기**(R-1, 운영자 결정 2026-10-17) — 정지된 사람이 탈퇴를 원하면 문의로 받아 운영자가 공통 함수로 옮긴다
--    (갈래 `deletion_request`, 메모 필수). 이용자 스스로의 신청(`request_account_deletion`)과 같은 일을 같은 트랜잭션에서 한다 —
--    탈퇴 대기 시각을 적고, 인연 찾기 노출을 끄고, 답을 기다리던 요청을 정리한다. 처분은 지금처럼 크론(`account-disposal`)이 한다.
-- 3. **정지에서 온 탈퇴 대기의 해제는 정지로 돌아간다** — 갈래 `deletion_withdrawn` 의 해제가 탈퇴 대기 앞의 상태로 간다. 정지에서
--    왔으면 `suspended`, 이용 중에서 왔으면 지금처럼 `active`. 정지에서 온 것을 `active` 로 풀면 거절한다(`22023`) — 탈퇴를 거두는
--    것이 정지를 푸는 길이 되지 않게.
-- 4. **상태 이력의 시각은 줄이 적히는 순간**(`clock_timestamp()`) — 한 트랜잭션 안의 바뀜 둘에도 차례가 선다(위 둘이 마지막 줄을 고른다).
--
-- ## 바꾸지 않는 것
--
-- - `request_account_deletion` 은 그대로다 — 정지된 계정은 화면에서 탈퇴를 신청하지 못한다(`42501`).
-- - 화면의 정지 · 해제 문(`screen_change_member_status`)은 그대로다 — 탈퇴 대기로 옮기는 것과 그 해제는 런북만이다.
-- - 공통 함수의 다른 바뀜 · 거절 코드 · 요청 번호 · 상태 이력 표는 그대로다.
--
-- 재는 자리는 `supabase/tests/99_my_suspension.test.sql`.

-- ---------------------------------------------------------------------------
-- 0. 이력의 시각은 줄마다 — 한 트랜잭션 안의 두 바뀜도 차례가 선다
-- ---------------------------------------------------------------------------

-- `now()` 는 트랜잭션의 시작 시각이라 한 트랜잭션(런북의 `do` 블록 · 시험) 안의 바뀜 둘이 같은 `at` 을 받았다. 아래 둘(지금 정지의
-- 갈래 · 탈퇴 대기가 어디서 왔나)은 「마지막 줄」을 `at` 으로 고르므로, 같은 시각이면 무작위 id 가 차례를 정했다. 줄이 적히는
-- 순간의 시각으로 바꾼다 — 이미 적힌 줄은 그대로다.
alter table public.account_status_change alter column at set default clock_timestamp();

-- ---------------------------------------------------------------------------
-- 1. 본인의 문 — 지금 정지의 갈래
-- ---------------------------------------------------------------------------

/**
 * 내 지금 정지 — 지금 `suspended` 인 사람만 한 줄(닉네임 · 갈래), 아니면 빈 결과.
 *
 * 갈래는 **정지로 들어온 마지막 줄**의 것이다 — 이력에서 `to_status = 'suspended'` 이고 탈퇴 대기의 해제(`deletion_withdrawn`, 정지로
 * 되돌아온 줄)가 아닌 마지막 줄. 그 줄의 갈래가 정지 갈래 다섯(`report` · `policy` · `payment` · `eligibility` · `other`) 가운데
 * 하나면 그것, 아니면(공통 함수 밖의 변경) 비운다. 그런 줄이 없으면(`20261215090000` 전의 정지) 비운다.
 *
 * 메모 · 실행자 · 관련 신고 · 시각은 내지 않는다 — 이용자에게는 갈래만 간다(G-111 「모두에 걸리는 것」).
 */
create function public.my_suspension()
returns table (nickname text, reason text)
language sql
stable
security definer
set search_path = ''
as $$
  select a.nickname,
         (select case when c.reason in ('report', 'policy', 'payment', 'eligibility', 'other') then c.reason end
          from public.account_status_change c
          where c.user_id = a.id
            and c.to_status = 'suspended'
            and c.reason is distinct from 'deletion_withdrawn'
          order by c.at desc, c.id desc
          limit 1)
  from public.app_user a
  where a.id = (select auth.uid())
    and a.status = 'suspended'
$$;

comment on function public.my_suspension() is
  '내 지금 정지 — 닉네임과 갈래만. 정지인 사람만 한 줄 (G-111-8, ADR 0190)';

revoke execute on function public.my_suspension() from public, anon, service_role;
grant execute on function public.my_suspension() to authenticated;

-- ---------------------------------------------------------------------------
-- 2. 트리거 — 정지 → 탈퇴 대기를 공통 함수의 변경으로 받는다
-- ---------------------------------------------------------------------------

/**
 * `20261215090000` 의 것에 한 갈래를 더했다 — 공통 함수가 실은 값을 받는 바뀜에 **정지 → 탈퇴 대기**(R-1). 그 밖은 한 글자도
 * 안 바꿨다. 이용 중 → 탈퇴 대기는 여전히 이용자 스스로의 신청(2)으로만 적힌다 — 이용자가 값을 실어도 제 신청을 운영자의 일로 적지
 * 못한다. 정지 → 탈퇴 대기는 이용자가 일으킬 길이 없다(`request_account_deletion` 이 `42501`).
 */
create or replace function public.record_account_status_change()
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
     and (new.status in ('suspended', 'active')
          or (old.status = 'suspended' and new.status = 'deletion_requested')) then
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

-- ---------------------------------------------------------------------------
-- 3. 공통 함수 — 정지 → 탈퇴 대기, 그리고 그 해제는 정지로
-- ---------------------------------------------------------------------------

/**
 * 계정 상태를 바꾸는 길 하나 — `20261215090000` 의 것에 바뀜 둘을 더했다(ADR 0190).
 *
 * 바꿀 수 있는 것:
 *
 * - 이용 중 → 이용 정지(갈래 `report` · `policy` · `payment` · `eligibility` · `other`)
 * - 이용 정지 → 이용 중(`appeal` · `mistake` · `other`)
 * - **이용 정지 → 탈퇴 대기**(`deletion_request`) — 정지된 사람의 탈퇴 요청을 문의로 받았을 때(R-1). 탈퇴 대기 시각을 지금으로
 *   적고, `request_account_deletion` 과 같이 인연 찾기 노출을 끄고 답을 기다리던 요청을 정리한다. 처분은 크론이 한다.
 * - 탈퇴 대기 → 그 앞의 상태(`deletion_withdrawn`) — 탈퇴 대기로 들어온 마지막 줄이 정지에서 왔으면 `suspended`, 아니면 `active`.
 *   다른 쪽을 고르면 `22023`.
 *
 * 운영자 계정은 정지하지 않는다(G-111-10). 메모는 1 ~ 200자이고, 신고의 정지 결정만 비워도 된다. 같은 요청 번호로 다시 오면 첫 줄을
 * 돌려준다 — 다른 계정 · 바뀜 · 갈래면 거절한다.
 *
 * @param p_actor 실행한 운영자 — 화면의 문은 `auth.uid()`, 런북은 운영자 UUID
 * @returns 이력 줄 id
 */
create or replace function public.change_account_status(
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
  came_from text;
  earlier public.account_status_change;
  made uuid := gen_random_uuid();
begin
  if p_actor is null or not exists (select 1 from public.operator o where o.user_id = p_actor) then
    raise exception '운영자만 계정 상태를 바꿉니다.' using errcode = '42501';
  end if;

  if p_status is null or p_status not in ('suspended', 'active', 'deletion_requested') then
    raise exception 'account status: suspended, active or deletion_requested' using errcode = '22023';
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

  -- 탈퇴 대기가 어디서 왔나 — 탈퇴 대기로 들어온 마지막 줄의 앞 상태. 이력이 없으면(`20261215090000` 전) 이용 중에서 왔다
  if now_status = 'deletion_requested' then
    select c.from_status into came_from
    from public.account_status_change c
    where c.user_id = p_user_id and c.to_status = 'deletion_requested'
    order by c.at desc, c.id desc
    limit 1;
    came_from := coalesce(came_from, 'active');
  end if;

  if p_status = 'deletion_requested' then
    if now_status = 'deletion_requested' then
      raise exception '이미 탈퇴 대기인 계정입니다.' using errcode = '55000';
    end if;
    if now_status <> 'suspended' then
      -- 이용 중인 사람은 화면에서 스스로 신청한다(`request_account_deletion`) — 운영자가 대신 옮기는 길이 아니다
      raise exception '이용 정지인 계정만 탈퇴 대기로 옮깁니다.' using errcode = '55000';
    end if;
    if p_reason is distinct from 'deletion_request' then
      raise exception '사유를 골라 주세요.' using errcode = '22023';
    end if;
  elsif p_status = 'suspended' and now_status = 'deletion_requested' then
    -- 정지에서 온 탈퇴 대기의 해제만 정지로 간다 — 탈퇴 대기를 정지하는 길이 아니다
    if p_reason is distinct from 'deletion_withdrawn' then
      -- 계정 검사식(`deletion_time_matches_status`)이 거절하던 것과 같은 코드다 — 런북의 검토 문을 부르는 쪽이 그대로 읽는다
      raise exception '탈퇴를 신청한 계정이라 정지할 수 없습니다.' using errcode = '23514';
    end if;
    if came_from <> 'suspended' then
      raise exception '이용 중에서 온 탈퇴 대기는 이용 중으로 되돌립니다.' using errcode = '22023';
    end if;
  elsif p_status = 'suspended' then
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
    if now_status = 'deletion_requested' and came_from = 'suspended' then
      raise exception '정지 중에 받은 탈퇴 요청이라 이용 정지로 되돌립니다.' using errcode = '22023';
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
      deletion_requested_at = case when p_status = 'deletion_requested' then now() else null end
  where a.id = p_user_id;

  perform set_config('saju.account_status_change', '', true);

  if not exists (select 1 from public.account_status_change c where c.id = made) then
    raise exception 'account status: the change was not recorded' using errcode = '55000';
  end if;

  -- 탈퇴 대기는 이용자 스스로의 신청과 같은 자리에 선다(`request_account_deletion`) — 노출이 꺼지고 기다리던 요청이 정리된다
  if p_status = 'deletion_requested' then
    update public.discovery_profile
    set opted_in_at = null,
        element_summary = null,
        element_input_version = null,
        element_chart_engine_version = null
    where user_id = p_user_id;

    with ended as (
      update public.match_request
      set status = case when requester_user_id = p_user_id then 'cancelled' else 'rejected' end,
          decided_at = now()
      where status = 'pending'
        and (requester_user_id = p_user_id or addressee_user_id = p_user_id)
      returning id, requester_user_id, status
    )
    insert into public.notification (user_id, kind, request_id)
    select ended.requester_user_id, 'request_rejected', ended.id
    from ended
    where ended.status = 'rejected';
  end if;

  return made;
end;
$$;

revoke execute on function public.change_account_status(uuid, uuid, text, text, text, uuid, uuid)
  from public, anon, authenticated, service_role;
