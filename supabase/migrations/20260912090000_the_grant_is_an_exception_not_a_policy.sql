-- 풀이권 예외 — **정책을 옮기지 않고 한 사람만 푼다**
--
-- 운영자가 자기 계정에서 막혔다. 성공 아홉 건에 한도 다섯이니 넉 건이 이미 넘었다.
-- 푸는 길이 셋 있었는데 둘은 안 된다.
--
--   · `reading_credit_limit()` 을 올린다 → **전원**에게 적용된다. 그 숫자는 이틀 전에
--     여덟에서 다섯으로 되돌리며 「사람이 정했다」고 적은 값이다(`20260911150000`).
--     한 사람을 풀려고 모두의 약속을 옮기지 않는다.
--   · 그 사람의 `reading_run` 을 지우거나 상태를 바꾼다 → **기록을 훼손한다.** 게다가
--     이 저장소는 「지울 수 있는 것으로 잔액이 되살아나지 않는다」를 **설계로** 정했다
--     (`20260903090000`). 그 설계를 운영자가 몰래 어기는 것이 가장 나쁘다.
--
-- 남는 길이 이것이다. **한도는 그대로 두고, 그 위에 얹는 몫을 따로 든다.**
--
-- ## 왜 표인가
--
-- 상수 함수에 `case when uid = '…'` 을 넣을 수도 있었다. 그러면 사람 하나가 코드에
-- 박히고, 다음 사람은 마이그레이션을 또 쓴다. 예외는 **자료**이지 규칙이 아니다.
--
-- 초대 표와 같은 규율로 둔다(`20260824090000`): 운영자가 SQL 로 넣고, 앱에는 이 표에
-- 닿는 길이 하나도 없다. `service_role` 에도 안 준다 — 그 키가 새면 남에게 풀이권을
-- 나눠 주는 문이 되기 때문이다(ADR 0006).
--
-- ## 왜 「운영자」라는 이름을 안 붙였나
--
-- `is_operator` 같은 깃발을 세우면 그 깃발이 다른 데서도 쓰이기 시작하고, 그때부터
-- 「운영자는 무엇을 더 할 수 있나」가 이 표의 문제가 된다. 여기서 답하는 것은 하나다 —
-- **이 사람에게 풀이권을 몇 개 더 주는가.** 누구에게 왜 주었는지는 `note` 가 든다.

create table if not exists public.reading_credit_grant (
  user_id uuid primary key references auth.users (id) on delete cascade,
  /** 한도 위에 얹는 몫. **0 도 못 넣는다** — 없는 몫은 행을 안 만드는 것으로 말한다 */
  extra integer not null check (extra > 0),
  /** 누구에게 왜 주었나 — 초대 표의 메모와 같은 자리다 */
  note text not null,
  granted_at timestamptz not null default now()
);

comment on table public.reading_credit_grant is
  '풀이권 예외 — 한도(reading_credit_limit)는 그대로 두고 그 위에 얹는 몫. 운영자가 SQL 로 넣는다.';

alter table public.reading_credit_grant enable row level security;

-- 정책을 하나도 안 만든다. **읽는 문도 안 연다** — 이 표를 읽는 것은 아래 definer
-- 함수뿐이고, 그 함수는 부른 사람의 몫만 내준다. 사용자가 「나는 몇 개 더 받았나」를
-- 따로 물을 자리는 없다: 잔액 하나로 이미 답이 된다.
revoke all on public.reading_credit_grant from anon, authenticated, service_role;

/**
 * 이 사람의 한도 — **정책(상수) + 예외(표).**
 *
 * 한도를 읽는 자리가 셋이다: 화면(`my_reading_credits`)·인연 요청(`request_match`)·
 * 생성(`start_reading_run_for`). 셋이 각자 상수를 읽으면 예외를 넣을 때 하나를 빠뜨리고,
 * 그러면 **화면에는 잔액이 남았는데 누르면 거절되는** 자리가 생긴다. 한도를 묻는 자리를
 * 하나로 만들고 셋이 그것을 지난다.
 */
create or replace function public.reading_credit_limit_for(p_user uuid)
returns integer
language sql
stable
security definer
set search_path = ''
as $$
  select public.reading_credit_limit()
       + coalesce((select g.extra from public.reading_credit_grant g where g.user_id = p_user), 0);
$$;

revoke execute on function public.reading_credit_limit_for(uuid)
  from anon, public, authenticated, service_role;

-- 아래 셋은 **지금 프로덕션에 있는 정의를 그대로 받아 적고**, 한도를 읽는 표현 하나씩만
-- `reading_credit_limit_for(…)` 로 바꾼 것이다. 손으로 옮겨 적으면 그 사이에 바뀐 것을
-- 되돌리게 되므로(이 저장소가 이미 한 번 겪은 자리다) 살아 있는 정의에서 생성했다.

CREATE OR REPLACE FUNCTION public.my_reading_credits()
 RETURNS TABLE(credit_limit integer, used integer, reserved integer, requested integer, available integer)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
  select
    public.reading_credit_limit_for((select auth.uid())),
    c.used,
    c.reserved,
    c.requested,
    greatest(0, public.reading_credit_limit_for((select auth.uid())) - c.used - c.reserved - c.requested)
  from public.reading_credits_used((select auth.uid())) c;
$function$
;

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
    public.discovery_supplied_elements(shown.candidate_summary, shown.viewer_summary),
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

CREATE OR REPLACE FUNCTION public.start_reading_run_for(p_actor uuid, p_kind text, p_idempotency_key text, p_person_a uuid DEFAULT NULL::uuid, p_person_b uuid DEFAULT NULL::uuid, p_match_id uuid DEFAULT NULL::uuid, p_model text DEFAULT NULL::text, p_prompt_version text DEFAULT NULL::text)
 RETURNS TABLE(run_id uuid, person_a uuid, person_b uuid, match_id uuid, revision_a uuid, revision_b uuid, viewer_is_first boolean)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  scope record;
  existing uuid;
  recent integer;
  counted record;
  started uuid;
  today integer;
begin
  if p_actor is null then
    raise exception '로그인이 필요합니다.' using errcode = '28000';
  end if;

  select * into scope
  from public.reading_scope_for(p_actor, p_kind, p_person_a, p_person_b, p_match_id);

  if not found then
    raise exception '결과를 만들 수 있는 대상이 아닙니다.' using errcode = 'check_violation';
  end if;

  if public.beta_is_over() then
    raise exception '비공개 테스트가 끝났습니다.' using errcode = 'check_violation';
  end if;

  perform pg_advisory_xact_lock(hashtext('reading:user:' || p_actor::text));
  perform pg_advisory_xact_lock(hashtext(
    'reading:target:' || scope.kind
      || ':' || coalesce(scope.owner_user_id::text, '')
      || ':' || coalesce(scope.person_a::text, '')
      || ':' || coalesce(scope.person_b::text, '')
      || ':' || coalesce(scope.match_id::text, '')));

  update public.reading_run r
  set status = 'failed', failure_code = 'expired', finished_at = now()
  where r.status = 'running'
    and r.created_at <= now() - public.reading_run_timeout()
    and r.kind = scope.kind
    and r.person_a is not distinct from scope.person_a
    and r.person_b is not distinct from scope.person_b
    and r.match_id is not distinct from scope.match_id;

  select r.id into existing
  from public.reading_run r
  where r.user_id = p_actor and r.idempotency_key = p_idempotency_key;

  if existing is not null then
    return;
  end if;

  select r.id into existing
  from public.reading_run r
  where r.status = 'running'
    and r.created_at > now() - public.reading_run_timeout()
    and r.kind = scope.kind
    and r.person_a is not distinct from scope.person_a
    and r.person_b is not distinct from scope.person_b
    and r.match_id is not distinct from scope.match_id;

  if existing is not null then
    return;
  end if;

  select * into counted from public.reading_credits_used(p_actor);

  if counted.used + counted.reserved + counted.requested >= public.reading_credit_limit_for(p_actor) then
    if counted.reserved > 0 then
      raise exception '지금 만들고 있는 풀이가 마지막 풀이권을 쓰고 있어요. 그것이 끝나면 다시 눌러 주세요.'
        using errcode = 'check_violation';
    end if;

    if counted.requested > 0 then
      raise exception '보낸 인연 요청이 풀이권을 잡고 있어요. 요청을 거두거나 상대의 답을 기다려 주세요.'
        using errcode = 'check_violation';
    end if;

    raise exception '풀이권을 다 쓰셨습니다. 테스트 기간에는 %번까지 만들 수 있어요.',
      public.reading_credit_limit_for(p_actor)
      using errcode = 'check_violation';
  end if;

  select count(*) into recent
  from public.reading_run r
  where r.user_id = p_actor
    and r.created_at > now() - interval '1 hour';

  if recent >= public.reading_rate_limit() then
    raise exception '한 시간에 만들 수 있는 결과 수를 넘었습니다. 잠시 뒤에 다시 시도해 주세요.'
      using errcode = 'check_violation';
  end if;

  /**
   * **오늘 전체가 다 찼는가** — 이 사람 것이 아니라 서비스 것이다.
   *
   * 코드를 갈라 둔다(`53400` configuration_limit_exceeded). 사람 자격은 전부
   * `check_violation` 이고 그것은 「당신이 고칠 수 있는 것」이다. 이 벽은 그 사람이
   * 무엇을 해도 오늘은 안 열린다 — 나중에 화면이 그 둘을 다르게 말해야 할 때,
   * 코드가 이미 갈려 있으면 문장만 고치면 된다.
   *
   * **풀이권은 안 나간다.** 여기까지 오면 시도 행 자체를 안 만들기 때문이다.
   */
  today := public.reading_spend_today();

  if today >= public.reading_daily_budget() then
    raise exception '오늘 만들 수 있는 풀이를 모두 썼습니다. 내일 다시 열립니다.'
      using errcode = '53400';
  end if;

  insert into public.reading_run (
    user_id, kind, person_a, person_b, match_id, idempotency_key, model, prompt_version
  )
  values (
    p_actor, scope.kind, scope.person_a, scope.person_b, scope.match_id,
    p_idempotency_key, p_model, p_prompt_version
  )
  returning id into started;

  /**
   * 방금 넣은 것까지 세서 문턱을 넘었으면 알린다. **아직 아무도 막히지 않았다** —
   * 다음 사람이 막힌다. 그것이 이 알림이 서는 이유다.
   */
  today := today + 1;

  if today >= public.reading_daily_budget() then
    perform public.notify_ops(
      'reading-budget-reached',
      format('오늘 시도 %s건으로 하루 상한(%s)을 채웠습니다. 다음 누름부터 막힙니다.',
             today, public.reading_daily_budget()));
  elsif today >= public.reading_budget_warning() then
    perform public.notify_ops(
      'reading-budget-warning',
      format('오늘 시도 %s건으로 하루 상한(%s)의 80%%를 넘었습니다.',
             today, public.reading_daily_budget()));
  end if;

  return query select
    started, scope.person_a, scope.person_b, scope.match_id,
    scope.revision_a, scope.revision_b, scope.viewer_is_first;
end;
$function$
;
