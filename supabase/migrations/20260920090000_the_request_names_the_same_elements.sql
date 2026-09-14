-- 요청을 받은 사람도 **후보 카드와 같은 규칙**으로 채우는 오행을 본다
--
-- `request_match` 는 두 사람 몫의 「채우는 오행」을 요청에 적는다. 보낸 사람 몫은 스냅샷에
-- 적힌 값을 그대로 옮기므로 `discovery-v1` 규칙(내 비율 20% 미만 · 상대가 1개 이상)이다.
-- 받은 사람 몫은 이 함수가 그 자리에서 다시 세는데, **옛 규칙**(내게 0개 · 상대가 1개
-- 이상)을 부르고 있었다.
--
-- 까닭은 순서다. 이 함수의 마지막 정의(`20260912090000_the_grant_is_an_exception_not_a_policy`)가
-- v1 을 들인 마이그레이션(`20260915120000_discovery_v1_uses_visible_counts`)보다 앞이라, v1 을
-- 들일 때 이 한 줄만 안 옮겨졌다. 그래서 같은 요청 안에서 보낸 쪽과 받은 쪽이 서로 다른
-- 규칙으로 센 오행을 들고 있었다.
--
-- 바꾸는 것은 그 한 줄뿐이다. 이미 적힌 요청은 건드리지 않는다.

CREATE OR REPLACE FUNCTION public.request_match(p_candidate_user_id uuid)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  actor uuid := (select auth.uid());
  my_summary jsonb;
  my_revision uuid;
  their_summary jsonb;
  their_revision uuid;
  shown public.discovery_impression;
  counted record;
  new_request uuid;
begin
  if actor is null then
    raise exception '로그인이 필요합니다.' using errcode = '28000';
  end if;

  if not public.is_active_account() then
    raise exception '중지된 계정입니다.' using errcode = '42501';
  end if;

  if p_candidate_user_id is null or p_candidate_user_id = actor then
    raise exception '지금은 이 사람에게 요청할 수 없습니다. 후보 목록을 새로 열어 확인해 주세요.'
      using errcode = '42501';
  end if;

  /** **묻기 전에 잠근다** — 자격 확인과 insert 사이에 낀 차단·판본 수정이 새 pending 을 놓친다. */
  perform public.lock_users(actor, p_candidate_user_id);

  /** **잠근 뒤에 나를 다시 본다** — 그 사이 커밋된 제재를 새 스냅숏이 본다. */
  if not public.is_active_account() then
    raise exception '중지된 계정입니다.' using errcode = '42501';
  end if;

  -- 내 쪽 자격은 갈라서 말한다. 내가 고칠 수 있는 것이고, 이유를 모르면 못 고친다.
  select p.element_summary, p.element_revision_id into my_summary, my_revision
  from public.discovery_profile p
  where p.user_id = actor and p.opted_in_at is not null;

  if my_summary is null then
    raise exception '매칭 참여를 먼저 켜 주세요.' using errcode = '42501';
  end if;

  if my_revision is distinct from (
    select pe.current_revision_id from public.app_user u
    join public.person pe on pe.id = u.self_person_id
    where u.id = actor
  ) then
    raise exception '내 오행 요약이 지금 판본의 것이 아닙니다.' using errcode = '55000';
  end if;

  /**
   * **요청이 자리를 하나 잡는다.**
   *
   * 이 검사도 내 쪽 자격이라 갈라서 말한다 — 상대에 대해 아무것도 말하지 않으므로
   * 「이 사람에게 청할 수 없다」와 섞이지 않는다. 내가 고칠 수 있는 일이고, 이유를
   * 모르면 못 고친다.
   */
  select * into counted from public.reading_credits_used(actor);

  if counted.used + counted.reserved + counted.requested >= public.reading_credit_limit_for(actor) then
    raise exception '풀이권이 없어 요청할 수 없습니다. 요청 한 건이 풀이권 한 번을 잡고, 동의가 나면 그 한 번으로 궁합 풀이가 만들어집니다.'
      using errcode = 'check_violation';
  end if;

  /**
   * 상대 쪽은 **한 문장으로만** 거절하고, 자격은 후보 목록과 **같은 함수**에 묻는다.
   */
  if not public.discovery_eligible(actor, p_candidate_user_id) then
    raise exception '지금은 이 사람에게 요청할 수 없습니다. 후보 목록을 새로 열어 확인해 주세요.'
      using errcode = '42501';
  end if;

  select p.element_summary, p.element_revision_id into their_summary, their_revision
  from public.discovery_profile p
  where p.user_id = p_candidate_user_id;

  /** **내가 본 그 카드**를 찾는다 — 요약 두 벌이 지금과 같은 기록만 고른다(ADR 0009). */
  select i.* into shown
  from public.discovery_impression i
  where i.viewer_user_id = actor
    and i.candidate_user_id = p_candidate_user_id
    and i.viewer_summary = my_summary
    and i.candidate_summary = their_summary
  order by i.shown_at desc
  limit 1;

  if their_summary is null or shown.id is null then
    raise exception '지금은 이 사람에게 요청할 수 없습니다. 후보 목록을 새로 열어 확인해 주세요.'
      using errcode = '42501';
  end if;

  insert into public.match_request (
    requester_user_id, addressee_user_id,
    requester_revision_id, addressee_revision_id,
    impression_id, policy_version,
    supplied_to_requester, supplied_to_addressee, balance_band
  )
  values (
    actor, p_candidate_user_id,
    my_revision, their_revision,
    shown.id, shown.policy_version,
    shown.supplied_elements,
    public.discovery_supplied_elements_v1(shown.candidate_summary, shown.viewer_summary),
    public.discovery_balance_band(shown.combined_balance)
  )
  returning id into new_request;

  insert into public.notification (user_id, kind, request_id)
  values (p_candidate_user_id, 'request_received', new_request);

  return new_request;

exception
  when unique_violation then
    raise exception '지금은 이 사람에게 요청할 수 없습니다. 후보 목록을 새로 열어 확인해 주세요.'
      using errcode = '42501';
end;
$function$
;
