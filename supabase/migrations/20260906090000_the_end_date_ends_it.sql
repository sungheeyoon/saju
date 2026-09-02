-- 종료일이 **끝낸다** — 적혀만 있던 날짜를 집행한다
--
-- 일정은 안내에 날짜를 찍고 확인을 다시 받는 데만 쓰였다. 어느 접근 판정에도 안 걸려
-- 있어서 **11월 1일에도 그대로 돈다.** 「이 비공개 베타는 10월 31일에 끝납니다」라고
-- 적어 두고 안 끝나면, 그 문장은 지키는 것이 없다.
--
-- 거는 자리는 `is_active_account()` 하나다. 「status 하나가 모든 문을 막는다」고 적어
-- 둔 그 함수이고, 여기 걸면 discovery·요청·수락·풀이 생성·설문이 한꺼번에 닫힌다 —
-- 문마다 날짜를 적으면 그중 하나는 안 고쳐진다.

/**
 * 베타가 끝났는가.
 *
 * **일정이 없으면 끝난 것이 아니다.** 「아직 안 정했다」와 「지났다」는 다른 상태이고,
 * 합치면 날짜를 넣기 전에 아무도 못 들어오는 것이 아니라 **이미 끝난 서비스**가 된다.
 * 시작 전을 막는 것은 안내 관문의 일이다(ADR 0024).
 *
 * 날짜 비교라 시간대가 문제 된다. `current_date` 는 서버의 오늘이고 우리 종료일은
 * KST 기준이다 — 서버가 UTC 이므로 KST 자정이 지나도 UTC 로는 아직 그날이다. 그
 * 차이만큼 **늦게** 닫힌다. 늦게 닫히는 쪽으로 틀리는 것이 맞다: 일찍 닫으면 아직
 * 쓸 수 있다고 알린 시간에 문을 잠그는 것이 된다.
 */
create or replace function public.beta_is_over()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(
    (select current_date > s.ends_on from public.current_beta_schedule() s),
    false);
$$;

revoke execute on function public.beta_is_over() from public;
grant execute on function public.beta_is_over() to anon, authenticated;

/**
 * **끝나면 계정이 활성이 아니다.**
 *
 * `status` 는 안 건드린다. 그 값은 「이 사람을 중지했다」는 운영 판단이고, 베타가 끝난
 * 것은 그 사람에 대한 판단이 아니다 — 둘을 한 열에 적으면 종료 뒤에 중지를 풀 수 없다.
 * 갈라 두고 이 함수가 둘을 합쳐 답한다.
 */
create or replace function public.is_active_account()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select not public.beta_is_over()
    and exists (
      select 1 from public.app_user u
      where u.id = (select auth.uid()) and u.status = 'active'
    );
$$;

revoke execute on function public.is_active_account() from anon, public;
grant execute on function public.is_active_account() to authenticated;

/**
 * 끝난 뒤에는 **확인도 안 받는다.**
 *
 * 안 막으면 종료일 다음 날에 들어온 사람이 「10월 31일에 끝납니다」를 읽고 확인을
 * 남긴다 — 이미 지난 날짜에 대고 동의하는 것이다.
 */
create or replace function public.acknowledge_notice(
  p_version text,
  p_ends_on date,
  p_improvement boolean,
  p_contact boolean
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  now_ends date;
begin
  if p_version is null or length(btrim(p_version)) = 0 then
    raise exception '안내 판본을 알 수 없습니다.' using errcode = 'check_violation';
  end if;

  if p_improvement is null or p_contact is null then
    raise exception '선택 항목에 답해 주세요.' using errcode = 'check_violation';
  end if;

  if public.beta_is_over() then
    raise exception '비공개 테스트가 끝났습니다.' using errcode = 'check_violation';
  end if;

  select s.ends_on into now_ends from public.current_beta_schedule() s;

  if now_ends is null then
    raise exception '아직 테스트 기간이 정해지지 않았습니다.' using errcode = 'check_violation';
  end if;

  if p_ends_on is distinct from now_ends then
    raise exception '안내가 바뀌었습니다. 새로고침 후 다시 확인해 주세요.'
      using errcode = 'check_violation';
  end if;

  update public.app_user u
  set notice_version = p_version,
      notice_ends_on = now_ends,
      notice_ack_at = now(),
      improvement_consent = p_improvement,
      contact_consent = p_contact
  where u.id = (select auth.uid()) and u.status = 'active';

  if not found then
    raise exception '계정을 찾지 못했습니다.' using errcode = 'no_data_found';
  end if;

  if p_improvement = false then
    delete from public.reading_feedback f
    where f.respondent_user_id = (select auth.uid());
  end if;
end;
$$;

revoke execute on function public.acknowledge_notice(text, date, boolean, boolean)
  from anon, public;
grant execute on function public.acknowledge_notice(text, date, boolean, boolean)
  to authenticated;

/**
 * 첫 입력도 막는다.
 *
 * `is_active_account()` 를 안 쓰고 `status` 를 직접 보던 자리라 종료가 안 닿았다.
 * 바탕은 안내 관문을 넣은 5일자 정의이고, 바뀐 것은 검사 한 줄이다.
 */
create or replace function public.create_self_person(
  p_local_label text,
  p_calendar text,
  p_original_date date,
  p_solar_date date,
  p_birth_time time,
  p_gender text,
  p_city text,
  p_late_night_rule text,
  p_time_basis text
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor uuid := (select auth.uid());
  account public.app_user;
  new_person uuid;
  new_revision uuid;
begin
  if actor is null then
    raise exception '로그인이 필요합니다.' using errcode = '28000';
  end if;

  select * into account from public.app_user where id = actor for update;

  if account.status <> 'active' then
    raise exception '중지된 계정입니다.' using errcode = '42501';
  end if;

  if public.beta_is_over() then
    raise exception '비공개 테스트가 끝났습니다.' using errcode = '42501';
  end if;

  if account.notice_ack_at is null then
    raise exception '먼저 처리 안내를 확인해 주세요.' using errcode = '42501';
  end if;

  if account.self_person_id is not null then
    raise exception '이미 자신의 사주를 등록했습니다.' using errcode = '23505';
  end if;

  insert into public.person default values returning id into new_person;

  insert into public.user_person_access (user_id, person_id, local_label, role)
  values (actor, new_person, p_local_label, 'owner');

  insert into public.person_chart_revision (
    person_id, calendar, original_date, solar_date, birth_time,
    gender, city, late_night_rule, time_basis, created_by
  )
  values (
    new_person, p_calendar, p_original_date, p_solar_date, p_birth_time,
    p_gender, p_city, p_late_night_rule, p_time_basis, actor
  )
  returning id into new_revision;

  update public.person set current_revision_id = new_revision where id = new_person;
  update public.app_user set self_person_id = new_person where id = actor;

  return new_person;
end;
$$;

revoke execute on function public.create_self_person(
  text, text, date, date, time, text, text, text, text) from anon, public;
grant execute on function public.create_self_person(
  text, text, date, date, time, text, text, text, text) to authenticated;

/**
 * 생성 문에도 건다 — **`reading_scope_for` 가 중앙 관문을 안 지난다.**
 *
 * 그 함수는 actor 를 인자로 받으므로 `auth.uid()` 를 쓰는 `is_active_account()` 를
 * 못 쓰고 `status` 열을 직접 본다. 그래서 종료일이 그 길에 안 닿았다 — 끝난 뒤에도
 * 모델이 불렸다. **돈이 나가는 문**이라 여기서 따로 막는다.
 *
 * 바탕은 풀이권을 넣은 3일자 정의다.
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
language plpgsql
security definer
set search_path = ''
as $$
declare
  scope record;
  existing uuid;
  recent integer;
  used integer;
  reserved integer;
  started uuid;
begin
  select * into scope
  from public.reading_scope(p_kind, p_person_a, p_person_b, p_match_id);

  -- 0행이 곧 거절이다. 없는 대상과 못 보는 대상을 여기서도 가르지 않는다.
  if not found then
    raise exception '결과를 만들 수 있는 대상이 아닙니다.' using errcode = 'check_violation';
  end if;

  /**
   * **끝났으면 안 만든다.**
   *
   * `is_active_account()` 가 종료일을 보게 했지만 이 길은 그 함수를 안 지난다 —
   * `reading_scope_for` 가 `status` 열을 직접 보기 때문이다(actor 를 인자로 받는
   * 함수라 `auth.uid()` 를 쓰는 그 함수를 못 쓴다). 그래서 **돈이 나가는 문**에는
   * 여기서 따로 건다.
   */
  if public.beta_is_over() then
    raise exception '비공개 테스트가 끝났습니다.' using errcode = 'check_violation';
  end if;

  /**
   * **줄을 세운다 — 「보고 나서 넣는」 것은 잠금이 아니다.**
   *
   * 처음에는 도는 시도가 있는지 **읽어 보고** 없으면 넣었다. 두 트랜잭션이 나란히
   * 읽으면 둘 다 「없다」를 보고 둘 다 넣는다 — 모델이 두 번 불리고 뒤의 글이 앞의
   * 글을 덮는다. 판본 저장이 Person 행을 잠그고 줄을 서는 것과 같은 자리다(ADR 0011).
   *
   * 두 자물쇠를 **언제나 같은 차례로** 잡는다(사람 → 대상). 차례가 갈리면 서로를
   * 기다리는 짝이 생긴다.
   */
  perform pg_advisory_xact_lock(hashtext('reading:user:' || (select auth.uid())::text));
  perform pg_advisory_xact_lock(hashtext(
    'reading:target:' || scope.kind
      || ':' || coalesce(scope.owner_user_id::text, '')
      || ':' || coalesce(scope.person_a::text, '')
      || ':' || coalesce(scope.person_b::text, '')
      || ':' || coalesce(scope.match_id::text, '')));

  /**
   * **끝나지 못한 시도를 여기서 닫는다.**
   *
   * 서버가 죽거나 플랫폼이 요청을 끊으면 그 행을 닫을 사람이 없다. 그냥 두면 그 대상이
   * 영영 잠기고, 더 나쁜 것은 **늦게 돌아온 첫 호출이 새 결과를 덮는 것**이다. 여는
   * 자리에서 닫아 두면 저장 쪽이 「이미 실패한 시도」를 거절할 근거를 갖는다.
   */
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
  where r.user_id = (select auth.uid()) and r.idempotency_key = p_idempotency_key;

  -- 같은 열쇠로 이미 돌았다. 아무것도 시작하지 않고 0행으로 답한다.
  if existing is not null then
    return;
  end if;

  /**
   * **같은 대상에 도는 시도는 하나다 — 사람마다가 아니라 대상마다.**
   *
   * 처음에는 `user_id` 로도 좁혔다. 그러면 공유 궁합에서 **두 당사자가 서로의 시도를
   * 아예 못 본다** — 둘이 동시에 누르면 모델이 두 번 불리고 뒤의 글이 앞의 글을
   * 덮는다. 대상이 하나인데 잠금이 사람별이었던 것이다.
   */
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
   * **풀이권 — 성공한 것과 지금 도는 것을 함께 센다.**
   *
   * 성공만 세면 넷을 쓴 사람이 서로 다른 두 대상을 잇달아 누를 때 둘 다 「넷」을 보고
   * 시작해 여섯이 된다. 도는 시도는 아직 성공이 아니지만 **성공할 자리를 이미 잡고**
   * 있으므로, 허용을 정할 때는 그 자리도 찬 것으로 본다.
   *
   * 실패하면 `running` 이 `failed` 로 가면서 그 자리가 저절로 풀리고, 성공하면
   * `succeeded` 로 갈 뿐이라 합계가 그대로다. **어느 쪽으로도 되돌리는 일을 하지
   * 않는다** — 차감과 반환이라는 일이 아예 없다.
   *
   * **셈이 흔들리지 않는 것은 위의 사람 자물쇠 덕이다.** 그 자물쇠는 원래 다른 것을
   * 막으려고 잡은 것이지만 한 사람의 시작을 줄 세우므로 이 셈도 그 줄 안에서 돈다.
   * 자물쇠 밖에서 세면 나란히 읽은 둘이 같은 잔액을 보고 둘 다 지나간다.
   *
   * **아래 시간당 한도와 다른 것을 묻는다.** 이것은 제품 정책이라 성공만 세고, 아래
   * 것은 비용 빗장이라 실패도 센다. 한 사람이 실패만 되풀이하면 풀이권은 그대로여도
   * 모델은 계속 불리므로, 둘 중 하나를 지우면 그 자리가 열린다.
   */
  select
    count(*) filter (where r.status = 'succeeded'),
    count(*) filter (
      where r.status = 'running'
        and r.created_at > now() - public.reading_run_timeout()
    )
  into used, reserved
  from public.reading_run r
  where r.user_id = (select auth.uid());

  if used + reserved >= public.reading_credit_limit() then
    /*
      **두 상태를 갈라 말한다.** 자리가 다 찬 것은 같지만 할 일이 다르다 — 하나는
      기다리면 되고 하나는 끝난 것이다. 한 문장으로 합치면 기다리면 되는 사람이
      끝났다고 읽는다.
    */
    if reserved > 0 then
      raise exception '지금 만들고 있는 풀이가 마지막 풀이권을 쓰고 있어요. 그것이 끝나면 다시 눌러 주세요.'
        using errcode = 'check_violation';
    end if;

    raise exception '풀이권을 다 쓰셨습니다. 테스트 기간에는 %번까지 만들 수 있어요.',
      public.reading_credit_limit()
      using errcode = 'check_violation';
  end if;

  select count(*) into recent
  from public.reading_run r
  where r.user_id = (select auth.uid())
    and r.created_at > now() - interval '1 hour';

  if recent >= public.reading_rate_limit() then
    raise exception '한 시간에 만들 수 있는 결과 수를 넘었습니다. 잠시 뒤에 다시 시도해 주세요.'
      using errcode = 'check_violation';
  end if;

  insert into public.reading_run (
    user_id, kind, person_a, person_b, match_id, idempotency_key, model, prompt_version
  )
  values (
    (select auth.uid()), scope.kind, scope.person_a, scope.person_b, scope.match_id,
    p_idempotency_key, p_model, p_prompt_version
  )
  returning id into started;

  return query select
    started, scope.person_a, scope.person_b, scope.match_id,
    scope.revision_a, scope.revision_b, scope.viewer_is_first;
end;
$$;

revoke execute on function public.start_reading_run(text, text, uuid, uuid, uuid, text, text)
  from anon, public;
grant execute on function public.start_reading_run(text, text, uuid, uuid, uuid, text, text)
  to authenticated;
