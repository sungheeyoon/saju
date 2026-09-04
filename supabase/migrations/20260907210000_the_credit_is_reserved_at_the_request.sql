-- ---------------------------------------------------------------------------
-- 풀이권은 **요청할 때 예약**하고, 동의가 그것을 쓴다 (ADR 0038)
-- ---------------------------------------------------------------------------

/**
 * 「매칭 궁합은 요청한 사람만 풀이권을 쓴다」고 적어 두었는데, 코드가 하는 일은
 * **「먼저 누른 사람이 쓴다」**였다. 잠금도 셈도 대상에 걸리므로(ADR 0013·0021)
 * 동의한 쪽이 결과 화면을 먼저 열고 누르면 그쪽이 썼다.
 *
 * 요청자에게 고정하는 것만으로는 안 된다 — 요청자가 그새 풀이권을 다 쓰면 **동의는
 * 났는데 아무도 못 여는 Match** 가 남는다. 그래서 자리를 **요청할 때 잡는다.**
 *
 * ## 예약은 값이 아니라 세는 법이다 — 원장을 만들지 않는다
 *
 * `match_request.status` 가 이미 수명주기 전부를 든다: `pending` = 예약 ·
 * `accepted` = 사용 · `rejected`·`cancelled`·`invalidated`·`expired` = 해제.
 *
 *     남은 것 = 한도 − 성공한 시도 − 도는 시도 − 살아 있는 내 요청
 *
 * 원장을 두면 「차감」과 「반환」이라는 일이 생기고 **반환은 잊힌다**(ADR 0021).
 * 끊긴 요청 하나가 안 돌아온 채 남으면 사용자는 쓰지도 않은 것을 잃고 우리도 모른다.
 */

-- ---------------------------------------------------------------------------
-- 1. 7일 — 만료는 새 상태다
-- ---------------------------------------------------------------------------

/**
 * 답을 기다리는 기간 — **함수로 둔다.**
 *
 * 기본값 안에 `interval '7 days'` 를 박아 두면 값을 고칠 때 표 정의를 고치게 되고,
 * 세는 자리(`reading_credits_used`)와 미는 자리(`expire_match_requests`)가 저마다
 * 다른 숫자를 손으로 들게 된다. 한도를 함수로 둔 것과 같은 규율이다
 * (`reading_credit_limit`).
 */
create or replace function public.match_request_ttl()
returns interval
language sql
immutable
as $$ select interval '7 days' $$;

/**
 * **기본값이 닫아 주지 않는다.** 새 함수는 `PUBLIC` 에 열린 채로 서므로 손으로 닫는다 —
 * 13번 시험의 「열쇠가 부를 수 있는 문」 목록이 이 자리를 잡아 준다.
 */
revoke execute on function public.match_request_ttl() from anon, public;
grant execute on function public.match_request_ttl() to authenticated;

/**
 * **만료는 또 다른 사실이다.**
 *
 * `cancelled`(스스로 거둠)와 `invalidated`(입력이 바뀜)를 이미 가른 표다. 만료를 그
 * 둘 중 하나에 얹으면 사용자에게 「왜 사라졌는지」를 말할 수 없게 되는데, 그 표가
 * 다섯을 가른 이유가 바로 그것이었다.
 *
 * `one_live_request_between_two` 는 **안 건드린다.** 만료된 요청은 다시 청할 수 있어야
 * 하고, 그 인덱스는 `pending`·`accepted`·`rejected` 만 묶는다.
 */
alter table public.match_request drop constraint match_request_status_check;
alter table public.match_request add constraint match_request_status_check
  check (status in ('pending', 'accepted', 'rejected', 'invalidated', 'cancelled', 'expired'));

/**
 * 언제까지 기다리나 — **행이 스스로 든다.**
 *
 * `created_at + ttl` 로 그때그때 셈해도 값은 같다. 열로 두는 것은 **기간을 고쳐도 이미
 * 보낸 요청의 기한이 안 움직이게** 하려는 것이다. 셈으로 두면 7일을 3일로 줄이는 날
 * 어제 보낸 요청들이 소급해서 만료된다.
 */
alter table public.match_request
  add column expires_at timestamptz not null default now() + public.match_request_ttl();

create index match_request_pending_expiry
  on public.match_request (expires_at)
  where status = 'pending';

/**
 * **만료도 판본을 놓는다.**
 *
 * 판본을 드는 것은 아직 결정되지 않았거나 성립한 요청뿐이고(`revision_is_held_only_while_it_decides`),
 * 놓는 일은 **호출부가 기억하지 않는다** — terminal 로 가는 자리마다 적으면 언젠가
 * 하나만 안 고쳐지고, 안 고쳐진 쪽은 언제나 더 오래 붙드는 쪽이다. 만료도 그 트리거에
 * 넣는다. 실제로 안 넣었더니 검사식이 그 자리에서 막았다.
 */
create or replace function public.settled_request_releases_revisions()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.status in ('rejected', 'invalidated', 'cancelled', 'expired') then
    new.requester_revision_id := null;
    new.addressee_revision_id := null;
  end if;
  return new;
end;
$$;

/**
 * **만료도 소식이다.**
 *
 * 요청자에게만 선다. 받은 쪽은 답을 안 한 것이라 알릴 일이 없고, 알리면 「답하지
 * 않았다」를 두드리는 도구가 된다. 요청자는 **자기 풀이권이 돌아왔다**는 것을 알아야
 * 한다 — 조용히 사라지면 쓰지도 않은 것을 잃은 줄 안다.
 */
alter table public.notification drop constraint notification_kind_check;
alter table public.notification add constraint notification_kind_check check (kind in (
  'request_received', 'request_accepted', 'request_rejected', 'request_invalidated',
  'request_expired',
  'reading_ready', 'reading_failed'
));

-- ---------------------------------------------------------------------------
-- 2. 세는 자리를 하나로 — `reading_credits_used`
-- ---------------------------------------------------------------------------

/**
 * 풀이권이 **어디에 잡혀 있나** — 한 자리에서 센다.
 *
 * 이 값을 묻는 곳이 둘이다: 잔액을 보여 주는 `my_reading_credits()` 와 시도를 여는
 * `start_reading_run_for` 의 검사. 둘이 저마다 세면 언젠가 한쪽만 고쳐지고,
 * **열려 있는 쪽은 언제나 더 바깥**이다 — 화면이 「없다」고 말하는데 문은 열려 있거나,
 * 그 반대가 된다.
 *
 * ## 셋을 갈라 낸다
 *
 * 합쳐 내면 화면이 「왜 못 누르는지」를 말할 수 없다. 기다리면 되는 것(`reserved`)과
 * 상대의 답을 기다리는 것(`requested`)과 이미 쓴 것(`used`)은 사용자가 할 일이 다르다.
 *
 * ## 유효시간 안의 것만 센다
 *
 * `running` 은 서버가 죽으면 그대로 남고, `pending` 은 아무도 안 밀면 7일이 지나도
 * 남는다. 그것까지 세면 **끊긴 하나가 풀이권을 영영 물고 있는다.** 미는 일(cron)이
 * 늦어도 셈은 제 시각을 본다 — 미는 것은 표시와 유일 인덱스를 위한 일이고, 잔액은
 * 여기서 이미 참이다.
 */
create or replace function public.reading_credits_used(p_actor uuid)
returns table (used integer, reserved integer, requested integer)
language sql
stable
security definer
set search_path = ''
as $$
  select
    (select count(*)::integer from public.reading_run r
     where r.user_id = p_actor and r.status = 'succeeded'),
    (select count(*)::integer from public.reading_run r
     where r.user_id = p_actor
       and r.status = 'running'
       and r.created_at > now() - public.reading_run_timeout()),
    (select count(*)::integer from public.match_request q
     where q.requester_user_id = p_actor
       and q.status = 'pending'
       and q.expires_at > now());
$$;

/**
 * **안쪽 문은 아무에게도 안 연다.** actor 를 인자로 받으므로 열어 두면 남의 잔액을
 * 세는 문이 된다 — 그 수는 그 사람이 요청을 몇 건 띄웠는지를 말해 준다.
 */
revoke execute on function public.reading_credits_used(uuid)
  from anon, public, authenticated, service_role;

-- ---------------------------------------------------------------------------
-- 3. 잔액 — 열 하나가 는다
-- ---------------------------------------------------------------------------

/**
 * `create or replace` 가 아니라 **떨어뜨리고 다시 세운다.** 내주는 열이 늘면 Postgres 는
 * 되쓰기를 거절한다.
 */
drop function public.my_reading_credits();

create function public.my_reading_credits()
returns table (
  credit_limit integer,
  used integer,
  /** 지금 만들고 있는 것이 잡고 있는 자리 */
  reserved integer,
  /** 상대의 답을 기다리는 내 요청이 잡고 있는 자리 */
  requested integer,
  available integer
)
language sql
stable
security definer
set search_path = ''
as $$
  select
    public.reading_credit_limit(),
    c.used,
    c.reserved,
    c.requested,
    greatest(0, public.reading_credit_limit() - c.used - c.reserved - c.requested)
  from public.reading_credits_used((select auth.uid())) c;
$$;

revoke execute on function public.my_reading_credits() from anon, public;
grant execute on function public.my_reading_credits() to authenticated;

-- ---------------------------------------------------------------------------
-- 4. 시도를 여는 문 — 안쪽에 actor 를 받는 문을 세운다
-- ---------------------------------------------------------------------------

/**
 * 시도를 연다 — **누구 이름으로 여는지를 인자가 정한다.**
 *
 * 수락은 **받은 쪽 세션**에서 일어나는데 시도는 요청자 것으로 서야 한다. 지금 함수는
 * `auth.uid()` 로 actor 를 정하므로 그대로 부르면 시도가 받은 쪽 것으로 서고, 그러면
 * 풀이권도 받은 쪽에서 나간다 — 이 ADR 이 없애려던 바로 그 일이다.
 *
 * `reading_scope_for` / `reading_scope` 가 정확히 이 모양이라 새 규칙이 아니다.
 * **안쪽 문은 아무에게도 안 연다** — 열어 두면 남의 이름으로 시도를 여는 문이 된다.
 *
 * 바탕은 6일자 정의다(종료일 검사가 들어간 것). 바뀐 것은 `auth.uid()` 가 `p_actor` 가
 * 된 것과 풀이권 셈을 `reading_credits_used` 에 넘긴 것뿐이다.
 */
create or replace function public.start_reading_run_for(
  p_actor uuid,
  p_kind text,
  p_idempotency_key text,
  p_person_a uuid default null,
  p_person_b uuid default null,
  p_match_id uuid default null,
  p_model text default null,
  p_prompt_version text default null
)
returns table (
  run_id uuid,
  person_a uuid,
  person_b uuid,
  match_id uuid,
  revision_a uuid,
  revision_b uuid,
  viewer_is_first boolean
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  scope record;
  existing uuid;
  recent integer;
  counted record;
  started uuid;
begin
  if p_actor is null then
    raise exception '로그인이 필요합니다.' using errcode = '28000';
  end if;

  select * into scope
  from public.reading_scope_for(p_actor, p_kind, p_person_a, p_person_b, p_match_id);

  -- 0행이 곧 거절이다. 없는 대상과 못 보는 대상을 여기서도 가르지 않는다.
  if not found then
    raise exception '결과를 만들 수 있는 대상이 아닙니다.' using errcode = 'check_violation';
  end if;

  /** **끝났으면 안 만든다** — 돈이 나가는 문에는 종료일을 여기서 따로 건다. */
  if public.beta_is_over() then
    raise exception '비공개 테스트가 끝났습니다.' using errcode = 'check_violation';
  end if;

  /**
   * **줄을 세운다 — 「보고 나서 넣는」 것은 잠금이 아니다.**
   *
   * 두 자물쇠를 **언제나 같은 차례로** 잡는다(사람 → 대상). 차례가 갈리면 서로를
   * 기다리는 짝이 생긴다.
   */
  perform pg_advisory_xact_lock(hashtext('reading:user:' || p_actor::text));
  perform pg_advisory_xact_lock(hashtext(
    'reading:target:' || scope.kind
      || ':' || coalesce(scope.owner_user_id::text, '')
      || ':' || coalesce(scope.person_a::text, '')
      || ':' || coalesce(scope.person_b::text, '')
      || ':' || coalesce(scope.match_id::text, '')));

  /** **끝나지 못한 시도를 여기서 닫는다** — 안 그러면 그 대상이 영영 잠긴다. */
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

  -- 같은 열쇠로 이미 돌았다. 아무것도 시작하지 않고 0행으로 답한다.
  if existing is not null then
    return;
  end if;

  /** **같은 대상에 도는 시도는 하나다 — 사람마다가 아니라 대상마다.** */
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

  /**
   * **풀이권 — 쓴 것, 도는 것, 그리고 답을 기다리는 요청.**
   *
   * 세는 것은 `reading_credits_used` 하나이고 여기서는 그것을 부르기만 한다. 화면이
   * 보는 잔액과 이 문이 보는 잔액이 갈릴 자리를 없앤다.
   *
   * **셈이 흔들리지 않는 것은 위의 사람 자물쇠 덕이다.** 그 자물쇠가 한 사람의 시작을
   * 줄 세우므로 이 셈도 그 줄 안에서 돈다.
   *
   * 검사가 서는 자리는 **「이미 도는 시도가 있다」보다 뒤**다 — 앞에 두면 다 쓴 사람이
   * 만들고 있는 것을 보러 다시 눌렀을 때 「기다리세요」 대신 「없습니다」를 읽는다.
   */
  select * into counted from public.reading_credits_used(p_actor);

  if counted.used + counted.reserved + counted.requested >= public.reading_credit_limit() then
    /*
      **세 상태를 갈라 말한다.** 자리가 다 찬 것은 같지만 할 일이 다르다 — 하나는
      기다리면 되고, 하나는 보낸 요청을 거두면 되고, 하나는 끝난 것이다.
    */
    if counted.reserved > 0 then
      raise exception '지금 만들고 있는 풀이가 마지막 풀이권을 쓰고 있어요. 그것이 끝나면 다시 눌러 주세요.'
        using errcode = 'check_violation';
    end if;

    if counted.requested > 0 then
      raise exception '보낸 인연 요청이 풀이권을 잡고 있어요. 요청을 거두거나 상대의 답을 기다려 주세요.'
        using errcode = 'check_violation';
    end if;

    raise exception '풀이권을 다 쓰셨습니다. 테스트 기간에는 %번까지 만들 수 있어요.',
      public.reading_credit_limit()
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

  insert into public.reading_run (
    user_id, kind, person_a, person_b, match_id, idempotency_key, model, prompt_version
  )
  values (
    p_actor, scope.kind, scope.person_a, scope.person_b, scope.match_id,
    p_idempotency_key, p_model, p_prompt_version
  )
  returning id into started;

  return query select
    started, scope.person_a, scope.person_b, scope.match_id,
    scope.revision_a, scope.revision_b, scope.viewer_is_first;
end;
$$;

revoke execute on function public.start_reading_run_for(uuid, text, text, uuid, uuid, uuid, text, text)
  from anon, public, authenticated, service_role;

/**
 * 바깥문 — **누르는 사람이 곧 actor 다.**
 *
 * `reading_scope` 가 `reading_scope_for` 를 감싸는 것과 같은 모양이고, 같은 이유로
 * 열려 있는 쪽은 이쪽뿐이다.
 */
create or replace function public.start_reading_run(
  p_kind text,
  p_idempotency_key text,
  p_person_a uuid default null,
  p_person_b uuid default null,
  p_match_id uuid default null,
  p_model text default null,
  p_prompt_version text default null
)
returns table (
  run_id uuid,
  person_a uuid,
  person_b uuid,
  match_id uuid,
  revision_a uuid,
  revision_b uuid,
  viewer_is_first boolean
)
language sql
security definer
set search_path = ''
as $$
  select * from public.start_reading_run_for(
    (select auth.uid()), p_kind, p_idempotency_key,
    p_person_a, p_person_b, p_match_id, p_model, p_prompt_version);
$$;

revoke execute on function public.start_reading_run(text, text, uuid, uuid, uuid, text, text)
  from anon, public;
grant execute on function public.start_reading_run(text, text, uuid, uuid, uuid, text, text)
  to authenticated;

-- ---------------------------------------------------------------------------
-- 5. 요청이 자리를 잡는다
-- ---------------------------------------------------------------------------

/**
 * **풀이권 없이는 청할 수 없다.**
 *
 * 지금 이 함수는 풀이권을 전혀 모른다. 그래서 다 쓴 사람도 요청을 보낼 수 있었고, 그
 * 요청이 수락되면 **동의는 났는데 아무도 못 여는 Match** 가 남았다.
 *
 * 검사는 **잠근 뒤**에 선다. 앞에 두면 나란히 부른 둘이 같은 잔액을 보고 둘 다 지나가
 * 요청 둘이 한 자리에 앉는다.
 *
 * 이것이 **제품에 새로 서는 사실**이다 — 「풀이권을 다 쓰셨습니다」가 인연 찾기 화면에
 * 처음 선다. 버그가 아니라 정책이고, PRD 가 그것을 적는다(§4.2).
 */
create or replace function public.request_match(p_candidate_user_id uuid)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
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

  if counted.used + counted.reserved + counted.requested >= public.reading_credit_limit() then
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
$$;

revoke execute on function public.request_match(uuid) from anon, public;
grant execute on function public.request_match(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- 6. 동의가 시도를 연다 — 요청자 이름으로
-- ---------------------------------------------------------------------------

/**
 * 받은 요청에 답한다 — **수락은 시도를 열기만 한다.**
 *
 * 모델은 여기서 안 부른다. 지금도 안 부르고 있었다(ADR 0020: 생성은 요청을 떠난다) —
 * 제출은 응답 뒤(`after`)가 하거나 복구기가 줍는다. 여기서 하는 일은 예약을 사용으로
 * 옮기는 것 하나다: `pending` 이 `accepted` 가 되면서 셈에서 빠지고, 그 자리를 새
 * `running` 시도가 이어받는다. **아무것도 되돌리지 않는다.**
 *
 * 차례가 중요하다. 상태를 먼저 `accepted` 로 옮기고 나서 시도를 연다 — 반대로 하면
 * 이 사람의 살아 있는 요청이 아직 한 자리를 잡고 있어서, 마지막 한 장으로 청한 사람의
 * 동의가 「풀이권을 다 쓰셨습니다」로 막힌다.
 *
 * 바탕은 25일자 정의다. 바뀐 것은 수락 갈래 끝의 한 덩어리뿐이다.
 */
create or replace function public.respond_to_match_request(p_request_id uuid, p_accept boolean)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor uuid := (select auth.uid());
  req public.match_request;
  requester_now uuid;
  addressee_now uuid;
  new_match uuid;
begin
  if actor is null then
    raise exception '로그인이 필요합니다.' using errcode = '28000';
  end if;

  /** **`null` 은 답이 아니다** — 명시적 동의 경계에서 「모름」이 「예」로 읽히면 안 된다. */
  if p_accept is null then
    raise exception '수락인지 거절인지 정해 주세요.' using errcode = '22004';
  end if;

  if not public.is_active_account() then
    raise exception '중지된 계정입니다.' using errcode = '42501';
  end if;

  /** **읽고 → 잠그고 → 다시 읽는다.** 계정을 먼저, 요청을 나중에 — `block_user` 와 같은 차례다. */
  select * into req from public.match_request where id = p_request_id;

  -- 없는 요청과 남의 요청의 답이 **같다.**
  if not found or req.addressee_user_id <> actor then
    raise exception '요청을 찾지 못했습니다.' using errcode = '42501';
  end if;

  perform public.lock_users(req.requester_user_id, actor);

  select * into req from public.match_request where id = p_request_id for update;

  if not found or req.addressee_user_id <> actor then
    raise exception '요청을 찾지 못했습니다.' using errcode = '42501';
  end if;

  if req.status <> 'pending' then
    return req.status;
  end if;

  /**
   * **기한이 지난 요청은 답이 아니라 만료다.**
   *
   * 미는 일은 cron 이 하지만 그것이 늦을 수 있다. 늦은 사이에 수락되면 이미 풀린
   * 풀이권으로 Match 가 서고, 그러면 예약이 지키던 약속이 깨진다 — 셈은 제 시각을
   * 보므로(`reading_credits_used`) 그 자리는 이미 남이 가져갔을 수 있다.
   */
  if req.expires_at <= now() then
    update public.match_request
    set status = 'expired', decided_at = now()
    where id = req.id;

    insert into public.notification (user_id, kind, request_id)
    values (req.requester_user_id, 'request_expired', req.id);

    return 'expired';
  end if;

  /** **양쪽 계정이 살아 있어야 한다.** 상대가 중지됐다는 것은 알리지 않는다. */
  if exists (
    select 1 from public.app_user u
    where u.id in (req.requester_user_id, req.addressee_user_id) and u.status <> 'active'
  ) then
    raise exception '요청을 찾지 못했습니다.' using errcode = '42501';
  end if;

  select pe.current_revision_id into requester_now
  from public.app_user u join public.person pe on pe.id = u.self_person_id
  where u.id = req.requester_user_id;

  select pe.current_revision_id into addressee_now
  from public.app_user u join public.person pe on pe.id = u.self_person_id
  where u.id = req.addressee_user_id;

  if requester_now is distinct from req.requester_revision_id
     or addressee_now is distinct from req.addressee_revision_id
  then
    update public.match_request
    set status = 'invalidated', decided_at = now()
    where id = req.id;

    insert into public.notification (user_id, kind, request_id)
    values (req.requester_user_id, 'request_invalidated', req.id),
           (req.addressee_user_id, 'request_invalidated', req.id);

    return 'invalidated';
  end if;

  if p_accept is not true then
    update public.match_request
    set status = 'rejected', decided_at = now()
    where id = req.id;

    -- 거절은 요청한 쪽에만 알린다. 내가 거절했다는 것은 내가 안다.
    insert into public.notification (user_id, kind, request_id)
    values (req.requester_user_id, 'request_rejected', req.id);

    return 'rejected';
  end if;

  update public.match_request
  set status = 'accepted', decided_at = now()
  where id = req.id;

  insert into public.match (
    request_id, user_low, user_high, low_revision_id, high_revision_id
  )
  values (
    req.id,
    least(req.requester_user_id, req.addressee_user_id),
    greatest(req.requester_user_id, req.addressee_user_id),
    case when req.requester_user_id < req.addressee_user_id
      then req.requester_revision_id else req.addressee_revision_id end,
    case when req.requester_user_id < req.addressee_user_id
      then req.addressee_revision_id else req.requester_revision_id end
  )
  returning id into new_match;

  -- 성립은 **양쪽 다** 알아야 하는 사건이다.
  insert into public.notification (user_id, kind, request_id, match_id)
  values (req.requester_user_id, 'request_accepted', req.id, new_match),
         (req.addressee_user_id, 'request_accepted', req.id, new_match);

  /**
   * **동의가 예약을 쓴다** — 시도는 **요청자 이름으로** 선다.
   *
   * 열쇠는 요청 id 에서 짓는다. 같은 요청이 두 번 수락되는 일은 없어야 하지만, 있어도
   * 같은 열쇠라 두 번째가 0행이 된다.
   *
   * ## 못 열어도 동의는 선다
   *
   * 여기서 던지면 **수락 전체가 되돌아간다.** 시도를 못 여는 이유는 여럿이고
   * (베타 종료 · 시간당 한도 · 같은 대상에 이미 도는 시도) 그중 어느 것도 「동의하지
   * 말라」는 뜻이 아니다. 동의는 두 사람이 정한 사실이므로 그 사실을 못 여는 시도가
   * 취소하게 두지 않는다.
   *
   * 그러면 결과 화면에 글도 도는 시도도 없는 자리가 남는데, **그 자리는 버튼이 든다** —
   * 「누를 버튼이 없다」는 성공 경로의 약속이지 실패 경로의 약속이 아니다.
   */
  begin
    perform public.start_reading_run_for(
      req.requester_user_id, 'match', 'match-accept:' || req.id::text,
      null, null, new_match);
  exception
    when others then null;
  end;

  return 'accepted';
end;
$$;

revoke execute on function public.respond_to_match_request(uuid, boolean) from anon, public;
grant execute on function public.respond_to_match_request(uuid, boolean) to authenticated;

-- ---------------------------------------------------------------------------
-- 7. 기한이 지난 요청을 민다
-- ---------------------------------------------------------------------------

/**
 * 7일 답이 없으면 만료다.
 *
 * **잔액은 이것을 안 기다린다.** `reading_credits_used` 가 `expires_at > now()` 만
 * 세므로 풀이권은 기한이 지나는 그 순간 이미 돌아와 있다. 이 일이 하는 것은 **표시와
 * 유일 인덱스**다 — 목록에서 그 요청이 내려가고, 같은 사람에게 다시 청할 수 있게 된다
 * (`one_live_request_between_two` 는 `pending` 을 묶는다).
 *
 * **요청자에게만 알린다.** 받은 쪽은 답을 안 한 것이라 알릴 일이 없고, 알리면
 * 「답하지 않았다」를 두드리는 도구가 된다. 요청자는 자기 풀이권이 돌아왔다는 것을
 * 알아야 한다 — 조용히 사라지면 쓰지도 않은 것을 잃은 줄 안다.
 */
create or replace function public.expire_match_requests()
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  expired integer;
begin
  with gone as (
    update public.match_request q
    set status = 'expired', decided_at = now()
    where q.status = 'pending' and q.expires_at <= now()
    returning q.id, q.requester_user_id
  ), told as (
    insert into public.notification (user_id, kind, request_id)
    select g.requester_user_id, 'request_expired', g.id from gone g
    returning 1
  )
  select count(*)::integer into expired from gone;

  return expired;
end;
$$;

/** **아무에게도 안 연다.** 부르는 것은 `cron` 뿐이고, 그것은 소유자 권한으로 돈다. */
revoke execute on function public.expire_match_requests()
  from anon, public, authenticated, service_role;

/**
 * 한 시간마다. 7일짜리 기한에 분 단위는 값만 쓴다 — 그리고 **잔액은 이미 참이므로**
 * 이 일이 늦어도 사용자가 잃는 것은 없다.
 *
 * 이름으로 지우고 다시 건다. `create or replace` 가 없는 자리라 두 번 돌리면 일정이 둘이 된다.
 */
select cron.unschedule('match-request-expiry')
where exists (select 1 from cron.job where jobname = 'match-request-expiry');

select cron.schedule('match-request-expiry', '7 * * * *', 'select public.expire_match_requests()');

-- ---------------------------------------------------------------------------
-- 8. 도는 시도는 **대상의 사실**이다 — 공유 궁합에서만
-- ---------------------------------------------------------------------------

/**
 * 마지막 시도가 어떻게 됐나 — **공유 궁합에서는 사람으로 안 좁힌다.**
 *
 * 이 함수가 `r.user_id = auth.uid()` 로 좁히고 있었다. 여태 그래도 됐던 것은 누른
 * 사람이 곧 보는 사람이었기 때문이다. 이제 공유 궁합의 시도는 **동의가 열고 청한
 * 사람 이름으로 선다**(ADR 0038) — 그대로 두면 **동의한 쪽 화면이 「아무것도 안 하고
 * 있다」고 말한다.** 실제로 그랬다: 청한 쪽에는 「만드는 중」이 서고 동의한 쪽에는
 * 아무것도 안 섰다.
 *
 * 같은 이유가 잠금에도 이미 적혀 있다 — **잠금은 사람이 아니라 대상에 건다**(ADR 0013).
 * 도는 시도도 그 대상의 사실이고, 공유 궁합의 대상은 두 사람의 것이다.
 *
 * **나머지 셋은 그대로 좁힌다.** `private` 은 같은 두 사람을 서로 다른 두 사용자가
 * 관리할 수 있고(Person 은 claim 으로 공유될 수 있다), 아래 join 은 소유자를 안 보고
 * 대상 열만 맞춘다 — 좁힘을 걷으면 남의 시도 상태가 내 화면에 선다.
 */
create or replace function public.my_last_reading_run(
  p_kind text,
  p_person_a uuid default null,
  p_person_b uuid default null,
  p_match_id uuid default null
)
returns table (status text, failure_code text, failure_detail text, created_at timestamptz)
language sql
stable
security definer
set search_path = ''
as $$
  select run.status, run.failure_code, run.failure_detail, run.created_at
  from public.reading_scope(p_kind, p_person_a, p_person_b, p_match_id) s
  join lateral (
    select *
    from public.reading_run r
    where (s.kind = 'match' or r.user_id = (select auth.uid()))
      and r.kind = s.kind
      and r.person_a is not distinct from s.person_a
      and r.person_b is not distinct from s.person_b
      and r.match_id is not distinct from s.match_id
    order by r.created_at desc
    limit 1
  ) run on true;
$$;

revoke execute on function public.my_last_reading_run(text, uuid, uuid, uuid) from anon, public;
grant execute on function public.my_last_reading_run(text, uuid, uuid, uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- 9. 동의가 연 시도를 서버가 찾아 제출한다
-- ---------------------------------------------------------------------------

/**
 * 수락이 연 시도 — **아직 아무것도 안 떠난 것.**
 *
 * 수락은 시도를 열기만 하고, 자르기·프롬프트·제출은 Node 가 한다(ADR 0020). 그 일을
 * 하려면 서버가 **방금 열린 그 시도**를 알아야 하는데, 수락을 부른 사람은 요청자가
 * 아니라 받은 쪽이고 `reading_run` 은 아무에게도 안 열린다.
 *
 * 그래서 열쇠로 여는 문 하나를 둔다. 내주는 것은 `start_reading_run` 이 이미 내주는
 * 것과 **같은 한 벌**이다 — 제출하는 코드가 두 모양을 알 필요가 없다.
 *
 * **아직 얼리지 않은 것만 낸다**(`reading_job` 이 없는 것). 있으면 이미 떠났거나
 * 복구기의 몫이고, 여기서 또 제출하면 같은 시도에 두 번 나간다.
 */
create or replace function public.match_run_awaiting_send(p_request_id uuid)
returns table (
  run_id uuid,
  person_a uuid,
  person_b uuid,
  match_id uuid,
  revision_a uuid,
  revision_b uuid,
  viewer_is_first boolean
)
language sql
stable
security definer
set search_path = ''
as $$
  select
    r.id, r.person_a, r.person_b, r.match_id,
    m.low_revision_id, m.high_revision_id,
    /**
     * 글이 「첫 번째 분」이라 부르는 것이 누구인가 — 이 값은 **읽는 사람마다 다르다.**
     * 제출하는 자리는 사람이 아니므로 판본의 차례를 그대로 쓴다. 화면이 세우는 안내는
     * `my_reading` 이 보는 사람마다 따로 내준다.
     */
    true
  from public.match m
  join public.reading_run r on r.match_id = m.id
  where m.request_id = p_request_id
    and r.status = 'running'
    and r.created_at > now() - public.reading_run_timeout()
    and not exists (select 1 from public.reading_job j where j.run_id = r.id);
$$;

revoke execute on function public.match_run_awaiting_send(uuid)
  from anon, public, authenticated;
grant execute on function public.match_run_awaiting_send(uuid) to service_role;
