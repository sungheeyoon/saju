-- 판본 저장소와 보존 기계를 지운다 (ADR 0071 · #70)
--
-- #69 까지로 **읽는 자리가 0** 이 됐다. 남은 것은 FK 가 `not null` 이라서 계속 쓰이던
-- 행들과, 그 행을 세어 지우던 기계다. 여기서 그 둘을 함께 걷는다.
--
-- ## 배포 차례가 이 파일의 전제다
--
-- 앱 먼저, 백필, **그 다음에** 이 마이그레이션이다. 아래 세 자리에서 `raise exception`
-- 으로 그 차례를 강제한다 — 빈 값이 남은 채로 `not null` 을 걸면 그때는 조용히 실패하는
-- 것이 아니라 **행이 사라진 것처럼 보이는** 장애가 된다.
--
-- ## 되쓰는 바탕은 마지막에 서 있던 정의다
--
-- 옛 마이그레이션을 베끼지 않았다. 이 저장소에서 그렇게 했다가 운영자 풀이권 예외와
-- 하루 상한이 한꺼번에 되감긴 적이 있다. 아래는 전부 스키마 덤프에서 가져와 판본 관련
-- 줄만 덜어낸 것이다.
--
-- 서명이 그대로인 함수는 `create or replace` 로 둔다 — **권한이 유지된다.** 서명이
-- 바뀌는 것만 drop 하고, 그때마다 grant 를 손으로 다시 적는다(이 저장소는 기본 실행
-- 권한을 걷어 두었고, grant 를 빠뜨린 함수는 `proacl` 이 빈 채로 PUBLIC 에 열린다).

-- ---------------------------------------------------------------------------
-- 1. 풀이 대상과 시도 — 판본 두 칸이 서명에서 빠진다
-- ---------------------------------------------------------------------------

drop function if exists public.reading_scope(text, uuid, uuid, uuid);
drop function if exists public.start_reading_run(text, text, uuid, uuid, uuid, text, text);
drop function if exists public.start_reading_run_for(uuid, text, text, uuid, uuid, uuid, text, text);
drop function if exists public.reading_scope_for(uuid, text, uuid, uuid, uuid);
drop function if exists public.freeze_reading_input(uuid, uuid, text, uuid, uuid, uuid, uuid, uuid);

create function public.reading_scope_for(
  p_actor uuid, p_kind text, p_person_a uuid default null, p_person_b uuid default null,
  p_match_id uuid default null)
returns table(
  kind text, owner_user_id uuid, person_a uuid, person_b uuid, match_id uuid,
  viewer_is_first boolean)
language sql
stable security definer
set search_path = ''
as $$
  -- 자기 풀이 — 대상을 인자로 받지 않는다. 내 selfPerson 하나뿐이다.
  select 'self', u.id, u.self_person_id, null::uuid, null::uuid, true
  from public.app_user u
  join public.person p on p.id = u.self_person_id
  where p_kind = 'self'
    and u.id = p_actor
    and u.status = 'active'
    and p.calendar is not null

  union all

  /**
   * 저장한 사람 하나 — **내 엣지에 있는 Person 이면 된다.**
   *
   * **내 selfPerson 은 이 갈래가 아니다.** 안 막으면 같은 명식에 결과가 둘 생기고,
   * 같은 자료로 풀이권이 두 번 나간다. 자격은 화면이 아니라 여기서 정한다.
   */
  select 'person', p_actor, p.id, null::uuid, null::uuid, true
  from public.person p
  where p_kind = 'person'
    and p_person_a is not null
    and p.id = p_person_a
    and p.calendar is not null
    and exists (
      select 1 from public.app_user u where u.id = p_actor and u.status = 'active'
    )
    -- definer 라 RLS 가 안 걸린다. 좁히는 조건을 손으로 적는다.
    and exists (
      select 1 from public.user_person_access e
      where e.user_id = p_actor and e.person_id = p.id
    )
    and not exists (
      select 1 from public.app_user me
      where me.id = p_actor and me.self_person_id = p.id
    )

  union all

  -- 비공개 궁합 — 두 사람 다 **내 엣지**에 있어야 한다. Match 상대는 엣지가 없다.
  select 'private', p_actor, lo.id, hi.id, null::uuid, true
  from public.person lo
  join public.person hi on hi.id = greatest(p_person_a, p_person_b)
  where p_kind = 'private'
    and p_person_a is not null and p_person_b is not null and p_person_a <> p_person_b
    and lo.id = least(p_person_a, p_person_b)
    and exists (
      select 1 from public.app_user u where u.id = p_actor and u.status = 'active'
    )
    and lo.calendar is not null and hi.calendar is not null
    and exists (
      select 1 from public.user_person_access e
      where e.user_id = p_actor and e.person_id = lo.id
    )
    and exists (
      select 1 from public.user_person_access e
      where e.user_id = p_actor and e.person_id = hi.id
    )

  union all

  /**
   * 공유 궁합 — 차례는 Match 가 정한다.
   *
   * 두 Person 을 **사용자에게서** 찾는다. 판본 행을 거치지 않으므로 판본이 없어져도 이
   * 갈래가 선다 — 동의 당시 여덟 글자는 `match` 가 이미 들고 있다(#68).
   */
  select 'match', null::uuid, lo.self_person_id, hi.self_person_id, m.id, m.user_low = p_actor
  from public.match m
  join public.app_user lo on lo.id = m.user_low
  join public.app_user hi on hi.id = m.user_high
  where p_kind = 'match' and m.id = p_match_id
    and p_actor in (m.user_low, m.user_high)
    and lo.status = 'active' and hi.status = 'active'
    and lo.self_person_id is not null and hi.self_person_id is not null
    and not exists (
      select 1 from public.block b
      where (b.user_id = m.user_low and b.blocked_user_id = m.user_high)
         or (b.user_id = m.user_high and b.blocked_user_id = m.user_low)
    );
$$;

/**
 * 시도를 여는 트랜잭션이 **계산 입력을 값으로 얼린다** (ADR 0071 · #66).
 *
 * 판본 id 두 칸이 인자에서 빠졌다. 그 값이 하던 일 — 「어느 입력으로 계산할지」 — 은
 * #66 이 `birth_a`·`birth_b` 로 옮겼고, 이제 가리키는 행 자체가 없다.
 */
create function public.freeze_reading_input(
  p_run_id uuid, p_actor uuid, p_kind text,
  p_person_a uuid, p_person_b uuid, p_match_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  glyphs_a jsonb;
  glyphs_b jsonb;
begin
  if p_kind = 'match' then
    select m.chart_low, m.chart_high into glyphs_a, glyphs_b
    from public.match m where m.id = p_match_id;
  else
    select p.current_chart into glyphs_a from public.person p where p.id = p_person_a;

    if p_person_b is not null then
      select p.current_chart into glyphs_b from public.person p where p.id = p_person_b;
    end if;
  end if;

  insert into public.reading_job (
    run_id, birth_a, birth_b, about, chart_a, chart_b, status)
  values (
    p_run_id,
    public.person_birth(p_person_a),
    public.person_birth(p_person_b),
    public.reading_about(p_actor, p_kind, p_person_a, p_person_b, p_match_id),
    glyphs_a, glyphs_b,
    'frozen');
end;
$$;

create function public.start_reading_run_for(
  p_actor uuid, p_kind text, p_idempotency_key text,
  p_person_a uuid default null, p_person_b uuid default null, p_match_id uuid default null,
  p_model text default null, p_prompt_version text default null)
returns table(run_id uuid, person_a uuid, person_b uuid, match_id uuid, viewer_is_first boolean)
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
  today integer;
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
   * 무엇을 해도 오늘은 안 열린다.
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

  perform public.freeze_reading_input(
    started, p_actor, scope.kind, scope.person_a, scope.person_b, scope.match_id);

  return query select
    started, scope.person_a, scope.person_b, scope.match_id, scope.viewer_is_first;
end;
$$;

create function public.reading_scope(
  p_kind text, p_person_a uuid default null, p_person_b uuid default null,
  p_match_id uuid default null)
returns table(
  kind text, owner_user_id uuid, person_a uuid, person_b uuid, match_id uuid,
  viewer_is_first boolean)
language sql
stable security definer
set search_path = ''
as $$
  select * from public.reading_scope_for(
    (select auth.uid()), p_kind, p_person_a, p_person_b, p_match_id);
$$;

create function public.start_reading_run(
  p_kind text, p_idempotency_key text,
  p_person_a uuid default null, p_person_b uuid default null, p_match_id uuid default null,
  p_model text default null, p_prompt_version text default null)
returns table(run_id uuid, person_a uuid, person_b uuid, match_id uuid, viewer_is_first boolean)
language sql
security definer
set search_path = ''
as $$
  select * from public.start_reading_run_for(
    (select auth.uid()), p_kind, p_idempotency_key,
    p_person_a, p_person_b, p_match_id, p_model, p_prompt_version);
$$;

grant execute on function public.start_reading_run(text, text, uuid, uuid, uuid, text, text)
  to authenticated;

-- ---------------------------------------------------------------------------
-- 2. 일감을 집는 문 셋 — 판본 두 칸이 결과에서 빠진다
-- ---------------------------------------------------------------------------

drop function if exists public.take_reading_job(uuid);
drop function if exists public.match_run_awaiting_send(uuid);
drop function if exists public.claim_reading_job(text);

/** 옛 문 — 얼린 행이 없던 시절의 것이다. 그 시절이 끝났다 */
drop function if exists public.freeze_reading_job(
  uuid, uuid, uuid, text, text, text, text, jsonb, timestamptz);
drop function if exists public.revision_birth(uuid);

create function public.take_reading_job(p_run_id uuid)
returns table(
  run_id uuid, kind text, person_a uuid, person_b uuid, match_id uuid,
  birth_a jsonb, birth_b jsonb, about jsonb)
language sql
security definer
set search_path = ''
as $$
  with taken as (
    update public.reading_job j
    set status = 'preparing'
    where j.run_id = p_run_id
      and j.status = 'frozen'
      and exists (
        select 1 from public.reading_run r
        where r.id = j.run_id
          and r.status = 'running'
          and r.created_at > now() - public.reading_run_timeout())
    returning j.*
  )
  select t.run_id, r.kind, r.person_a, r.person_b, r.match_id, t.birth_a, t.birth_b, t.about
  from taken t
  join public.reading_run r on r.id = t.run_id;
$$;

create function public.match_run_awaiting_send(p_request_id uuid)
returns table(
  run_id uuid, person_a uuid, person_b uuid, match_id uuid, viewer_is_first boolean,
  kind text, birth_a jsonb, birth_b jsonb, about jsonb)
language sql
security definer
set search_path = ''
as $$
  with target as (
    select r.id
    from public.match m
    join public.reading_run r on r.match_id = m.id
    where m.request_id = p_request_id
      and r.status = 'running'
      and r.created_at > now() - public.reading_run_timeout()
  ),
  taken as (
    update public.reading_job j
    set status = 'preparing'
    where j.run_id in (select id from target)
      and j.status = 'frozen'
    returning j.*
  )
  select
    t.run_id, r.person_a, r.person_b, r.match_id,
    /**
     * 글이 「첫 번째 분」이라 부르는 것이 누구인가 — 이 값은 **읽는 사람마다 다르다.**
     * 제출하는 자리는 사람이 아니므로 자리의 차례를 그대로 쓴다.
     */
    true,
    r.kind, t.birth_a, t.birth_b, t.about
  from taken t
  join public.reading_run r on r.id = t.run_id;
$$;

create function public.claim_reading_job(p_response_id text)
returns table(
  run_id uuid, kind text, prompt text, evidence text, prompt_version text,
  requested_model text, generation jsonb, viewed_at timestamptz,
  birth_a jsonb, birth_b jsonb)
language plpgsql
security definer
set search_path = ''
as $$
declare
  claimed public.reading_job;
begin
  update public.reading_job j
  set status = 'retrieving'
  where j.response_id = p_response_id
    and j.status = 'submitted'
    and exists (
      select 1 from public.reading_run r where r.id = j.run_id and r.status = 'running')
  returning j.* into claimed;

  if not found then
    return;
  end if;

  return query
  select
    claimed.run_id,
    (select r.kind from public.reading_run r where r.id = claimed.run_id),
    claimed.prompt,
    claimed.evidence,
    claimed.prompt_version,
    claimed.requested_model,
    claimed.generation,
    claimed.viewed_at,
    claimed.birth_a,
    claimed.birth_b;
end;
$$;

grant execute on function public.take_reading_job(uuid) to service_role;
grant execute on function public.match_run_awaiting_send(uuid) to service_role;
grant execute on function public.claim_reading_job(text) to service_role;

-- ---------------------------------------------------------------------------
-- 3. 결과 저장 — 옛 열두 인자가 사라지고 판본 두 칸이 빠진다
-- ---------------------------------------------------------------------------

drop function if exists public.save_reading(
  uuid, uuid, uuid, text, smallint, text, text, text, text, text, jsonb, timestamptz);
drop function if exists public.save_reading(
  uuid, text, smallint, text, text, text, text, text, jsonb, timestamptz);

create function public.save_reading(
  p_run_id uuid, p_output text, p_score smallint, p_metaphor text, p_evidence text,
  p_prompt text, p_prompt_version text, p_model text, p_generation jsonb,
  p_viewed_at timestamptz)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  run record;
  job record;
  pinned record;
  reading_id uuid;
  partner uuid;
begin
  -- 행을 잠그고 읽는다. 같은 시도로 두 번 저장하려는 길을 여기서 막는다.
  select * into run from public.reading_run r where r.id = p_run_id for update;

  if not found then
    raise exception '기록할 시도를 찾지 못했습니다.' using errcode = 'no_data_found';
  end if;

  if run.status <> 'running' then
    raise exception '이미 끝난 시도입니다.' using errcode = 'check_violation';
  end if;

  if run.created_at <= now() - public.reading_run_timeout() then
    raise exception '만드는 데 너무 오래 걸려 이 결과는 저장하지 않았습니다.'
      using errcode = 'check_violation';
  end if;

  if exists (
    select 1 from public.reading_run later
    where later.created_at > run.created_at
      and later.kind = run.kind
      and later.person_a is not distinct from run.person_a
      and later.person_b is not distinct from run.person_b
      and later.match_id is not distinct from run.match_id
  ) then
    raise exception '그 사이에 새 시도가 열려 이 결과는 저장하지 않았습니다.'
      using errcode = 'check_violation';
  end if;

  /**
   * **저장 직전에도 자격을 묻는다.** 시작할 때 자격이 있었다고 해서 만드는 동안 생긴
   * 차단·계정 중지를 무시하면 「새 접근과 접촉을 즉시 멈춘다」가 최대 십 분 늦어진다.
   */
  select * into pinned
  from public.reading_scope_for(
    run.user_id, run.kind, run.person_a, run.person_b, run.match_id);

  if not found then
    raise exception '결과를 저장할 대상을 찾지 못했습니다.' using errcode = 'no_data_found';
  end if;

  /**
   * **얼린 값은 차례를 다 본 뒤에, 상태를 옮기기 전에 읽는다.**
   *
   * 뒤에 읽으면 없다 — 시도가 terminal 이 되는 순간 트리거가 얼린 작업을 지운다.
   * 앞에 읽으면 순서 검사보다 먼저 걸려서, 늦게 돌아온 호출이 「그 사이에 새 시도가
   * 열렸다」 대신 「재료가 없다」로 거절된다.
   */
  select * into job from public.reading_job j where j.run_id = p_run_id;

  if not found then
    raise exception '얼린 계산 입력을 찾지 못했습니다.' using errcode = 'no_data_found';
  end if;

  update public.reading_run r
  set status = 'succeeded', finished_at = now(), model = p_model, prompt_version = p_prompt_version
  where r.id = p_run_id;

  insert into public.reading (
    kind, owner_user_id, match_id, person_a, person_b,
    chart_a, chart_b,
    output, score, metaphor, evidence, prompt, prompt_version, model, generation, viewed_at,
    source_run_id
  )
  values (
    run.kind,
    -- 공유 결과에는 주인이 없다. 누가 눌렀든 양쪽이 같은 것을 본다.
    case when run.kind = 'match' then null else run.user_id end,
    run.match_id, run.person_a, run.person_b,
    job.chart_a, job.chart_b,
    p_output, p_score, p_metaphor, p_evidence, p_prompt, p_prompt_version, p_model,
    coalesce(p_generation, '{}'::jsonb), p_viewed_at,
    p_run_id
  )
  on conflict (target_key) do update
  set chart_a = excluded.chart_a,
      chart_b = excluded.chart_b,
      output = excluded.output,
      score = excluded.score,
      metaphor = excluded.metaphor,
      evidence = excluded.evidence,
      prompt = excluded.prompt,
      prompt_version = excluded.prompt_version,
      model = excluded.model,
      generation = excluded.generation,
      viewed_at = excluded.viewed_at,
      source_run_id = excluded.source_run_id,
      created_at = now()
  returning id into reading_id;

  if run.kind = 'match' then
    select case when m.user_low = run.user_id then m.user_high else m.user_low end
    into partner
    from public.match m where m.id = run.match_id;

    insert into public.notification (user_id, kind, match_id)
    values (partner, 'reading_ready', run.match_id);
  end if;

  return reading_id;
end;
$$;

grant execute on function public.save_reading(
  uuid, text, smallint, text, text, text, text, text, jsonb, timestamptz) to service_role;

-- ---------------------------------------------------------------------------
-- 4. 읽는 문 — `from_current_revision` 이 사라진다
--
-- 두 벌을 함께 내주던 잠깐이 끝난다(#68). 남는 것은 **여덟 글자로 견준 하나**다 —
-- 출생지만 고쳐 판본이 새로 서도 여덟 글자가 같으면 그 글은 낡지 않았다.
-- ---------------------------------------------------------------------------

drop function if exists public.my_reading(text, uuid, uuid, uuid);
drop function if exists public.my_readings();

create function public.my_reading(
  p_kind text, p_person_a uuid default null, p_person_b uuid default null,
  p_match_id uuid default null)
returns table(
  id uuid, kind text, score smallint, metaphor text, output text, model text,
  viewed_at timestamptz, created_at timestamptz, viewer_is_first boolean,
  from_current_chart boolean, source_run_id uuid, my_feedback jsonb)
language sql
stable security definer
set search_path = ''
as $$
  select
    r.id, r.kind, r.score, r.metaphor,
    case when s.kind = 'match' then public.reading_user_body(r.output) else r.output end,
    r.model, r.viewed_at, r.created_at,
    s.viewer_is_first,
    case
      /**
       * 공유 결과는 동의 당시 여덟 글자로 나고 그 값이 곧 동의한 대상이라, 「그 뒤에
       * 고친 입력으로 다시 봐야 한다」는 말이 성립하지 않는다(ADR 0010·0012).
       */
      when s.kind = 'match' then true
      else coalesce(
        r.chart_a = pa.current_chart and r.chart_b is not distinct from pb.current_chart,
        false)
    end,
    r.source_run_id,
    (
      select jsonb_build_object(
        'usefulness', f.usefulness,
        'perceivedFit', f.perceived_fit,
        'feltLength', f.felt_length,
        'issueTags', to_jsonb(f.issue_tags),
        'comment', f.comment)
      from public.reading_feedback f
      where f.reading_run_id = r.source_run_id
        and f.respondent_user_id = (select auth.uid())
    )
  from public.reading_scope(p_kind, p_person_a, p_person_b, p_match_id) s
  join public.reading r
    on r.kind = s.kind
   and r.owner_user_id is not distinct from s.owner_user_id
   and r.person_a = s.person_a
   and r.person_b is not distinct from s.person_b
   and r.match_id is not distinct from s.match_id
  left join public.person pa on pa.id = r.person_a
  left join public.person pb on pb.id = r.person_b;
$$;

create function public.my_readings()
returns table(
  kind text, person_a uuid, person_b uuid, match_id uuid, label_a text, label_b text,
  score smallint, metaphor text, created_at timestamptz, from_current_chart boolean)
language sql
stable security definer
set search_path = ''
as $$
  select
    l.kind, l.person_a, l.person_b, l.match_id,
    l.label_a, l.label_b, l.score, l.metaphor, l.created_at, l.from_current_chart
  from (
    /**
     * 내가 주인인 셋 — `self` · `person` · `private`.
     *
     * **이름이 붙는 근거가 곧 좁힘이다.** 엣지가 없으면 그 줄이 안 선다. 결과가 남아
     * 있어도 내가 그 사람을 목록에서 빼면 이 목록에서 사라진다.
     */
    select
      r.kind,
      r.person_a,
      r.person_b,
      null::uuid as match_id,
      case when r.kind = 'self' then null else (
        select e.local_label from public.user_person_access e
        where e.user_id = (select auth.uid()) and e.person_id = r.person_a
      ) end as label_a,
      (
        select e.local_label from public.user_person_access e
        where e.user_id = (select auth.uid()) and e.person_id = r.person_b
      ) as label_b,
      r.score,
      r.metaphor,
      r.created_at,
      coalesce(
        r.chart_a = pa.current_chart and r.chart_b is not distinct from pb.current_chart,
        false) as from_current_chart
    from public.reading r
    join public.person pa on pa.id = r.person_a
    left join public.person pb on pb.id = r.person_b
    where public.is_active_account()
      and r.owner_user_id = (select auth.uid())
      and exists (
        select 1 from public.user_person_access e
        where e.user_id = (select auth.uid()) and e.person_id = r.person_a
      )
      and (
        r.person_b is null
        or exists (
          select 1 from public.user_person_access e
          where e.user_id = (select auth.uid()) and e.person_id = r.person_b
        )
      )

    union all

    /**
     * 함께 본 궁합 — **좁힘은 `visible_matches()` 가 이미 든다.**
     *
     * **「이전 입력」이 없다.** 공유 결과는 동의 당시 여덟 글자로 나고 그 값이 곧 동의한
     * 대상이라, 「그 뒤에 고친 입력으로 다시 봐야 한다」는 말이 성립하지 않는다.
     */
    select
      r.kind,
      null::uuid,
      null::uuid,
      r.match_id,
      partner.nickname,
      null::text,
      r.score,
      r.metaphor,
      r.created_at,
      true
    from public.reading r
    join public.visible_matches() m on m.id = r.match_id
    join public.app_user partner
      on partner.id = case
        when m.user_low = (select auth.uid()) then m.user_high else m.user_low end
    where r.kind = 'match'
  ) l (
    kind, person_a, person_b, match_id,
    label_a, label_b, score, metaphor, created_at, from_current_chart
  )
  order by l.created_at desc;
$$;

grant execute on function public.my_reading(text, uuid, uuid, uuid) to authenticated;
grant execute on function public.my_readings() to authenticated;

-- ---------------------------------------------------------------------------
-- 5. 공유 결과의 한 벌 — 판본 id 두 칸이 빠진다
--
-- 화면은 이미 `my_chart`·`partner_chart` 로 보드를 세운다(#68). 판본 id 는 아무도
-- 안 읽는 채로 서 있었다.
-- ---------------------------------------------------------------------------

drop function if exists public.my_match_scope(uuid);

create function public.my_match_scope(p_match_id uuid)
returns table(
  match_id uuid, partner_user_id uuid, partner_nickname text, partner_intro text,
  partner_has_photo boolean, my_chart jsonb, partner_chart jsonb,
  supplied_to_me text[], supplied_to_them text[], balance_band text,
  created_at timestamptz)
language sql
stable security definer
set search_path = ''
as $$
  select
    m.id,
    partner.id,
    partner.nickname,
    partner.intro,
    exists (select 1 from public.profile_photo f where f.user_id = partner.id),
    case when m.user_low = (select auth.uid()) then m.chart_low else m.chart_high end,
    case when m.user_low = (select auth.uid()) then m.chart_high else m.chart_low end,
    case when r.requester_user_id = (select auth.uid())
      then r.supplied_to_requester else r.supplied_to_addressee end,
    case when r.requester_user_id = (select auth.uid())
      then r.supplied_to_addressee else r.supplied_to_requester end,
    r.balance_band,
    m.created_at
  from public.visible_matches() m
  join public.match_request r on r.id = m.request_id
  join public.app_user partner
    on partner.id = case
      when m.user_low = (select auth.uid()) then m.user_high else m.user_low end
  where m.id = p_match_id;
$$;

grant execute on function public.my_match_scope(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- 6. 추천 — 「지금 것인가」를 판본이 아니라 **입력 판**으로 묻는다
--
-- #69 가 `my_summary_is_current` 를 세웠고, 그때는 판본과 입력 판이 함께 움직여서 둘 다
-- 맞았다. 이제 한쪽이 사라지므로 묻는 자리를 하나로 모은다.
--
-- 서명이 그대로라 `create or replace` 다 — **권한이 유지된다.**
-- ---------------------------------------------------------------------------

create or replace function public.ensure_discovery_participation(
  p_person_id uuid, p_summary jsonb)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor uuid := (select auth.uid());
  account public.app_user;
  mine public.person;
  opted_out timestamptz;
begin
  if actor is null then
    raise exception '로그인이 필요합니다.' using errcode = '28000';
  end if;

  if not public.is_active_account() then
    raise exception '중지된 계정입니다.' using errcode = '42501';
  end if;

  /*
    **여기서는 행을 안 잠근다.** 이 함수는 홈을 열 때마다 도는 자리이고, 잠그면 한 사람의
    두 탭이 서로를 기다린다. 겹쳐 들어와도 마지막 쓰기가 같은 값을 쓴다.
  */
  select * into account from public.app_user where id = actor;

  -- 내 사주가 아니면 아무 일도 아니다. 가족·친구를 고쳤다고 내 노출이 바뀌지 않는다.
  if account.self_person_id is null or account.self_person_id is distinct from p_person_id then
    return false;
  end if;

  if account.nickname is null then
    return false;
  end if;

  select opted_out_at into opted_out from public.discovery_profile where user_id = actor;
  if opted_out is not null then
    return false;
  end if;

  if not public.is_element_summary(p_summary) then
    raise exception '오행 요약의 모양이 맞지 않습니다.' using errcode = '22023';
  end if;

  select * into mine from public.person where id = account.self_person_id;

  if mine.calendar is null then
    return false;
  end if;

  insert into public.discovery_profile (
    user_id, opted_in_at, element_summary,
    element_input_version, element_chart_engine_version)
  values (
    actor, now(), p_summary,
    mine.input_version, mine.chart_engine_version)
  on conflict (user_id) do update
    set opted_in_at = coalesce(public.discovery_profile.opted_in_at, now()),
        element_summary = excluded.element_summary,
        element_input_version = excluded.element_input_version,
        element_chart_engine_version = excluded.element_chart_engine_version;

  return true;
end;
$$;

create or replace function public.set_discovery_participation(p_on boolean, p_summary jsonb)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor uuid := (select auth.uid());
  account public.app_user;
  mine public.person;
begin
  if actor is null then
    raise exception '로그인이 필요합니다.' using errcode = '28000';
  end if;

  select * into account from public.app_user where id = actor for update;

  if account.status <> 'active' then
    raise exception '중지된 계정입니다.' using errcode = '42501';
  end if;

  if not p_on then
    insert into public.discovery_profile (user_id, opted_out_at)
    values (actor, now())
    on conflict (user_id) do update
      set opted_in_at = null,
          opted_out_at = now(),
          element_summary = null,
          element_input_version = null,
          element_chart_engine_version = null;
    return false;
  end if;

  if account.self_person_id is null then
    raise exception '먼저 내 사주를 등록해 주세요.' using errcode = '23502';
  end if;

  if account.nickname is null then
    raise exception '먼저 닉네임을 정해 주세요.' using errcode = '23502';
  end if;

  select * into mine from public.person where id = account.self_person_id;

  if mine.calendar is null then
    raise exception '저장된 출생정보를 찾지 못했습니다.' using errcode = '23502';
  end if;

  if not public.is_element_summary(p_summary) then
    raise exception '오행 요약의 모양이 맞지 않습니다.' using errcode = '22023';
  end if;

  insert into public.discovery_profile (
    user_id, opted_in_at, element_summary,
    element_input_version, element_chart_engine_version)
  values (
    actor, now(), p_summary,
    mine.input_version, mine.chart_engine_version)
  on conflict (user_id) do update
    set opted_in_at = coalesce(public.discovery_profile.opted_in_at, now()),
        opted_out_at = null,
        element_summary = excluded.element_summary,
        element_input_version = excluded.element_input_version,
        element_chart_engine_version = excluded.element_chart_engine_version;

  return true;
end;
$$;

create or replace function public.my_discovery_board()
returns table(
  candidate_user_id uuid, nickname text, intro text, has_photo boolean, seat integer,
  exploration boolean, supplied_elements text[], balance_band text, preview_score integer)
language plpgsql
security definer
set search_path = ''
as $$
#variable_conflict use_column
declare
  actor uuid := (select auth.uid());
  my_summary jsonb;
  opted timestamptz;
  snap uuid;
  made_at timestamptz;
  snap_summary jsonb;
  snap_policy text;
begin
  if actor is null then
    raise exception '로그인이 필요합니다.' using errcode = '28000';
  end if;

  if not public.is_active_account() then
    raise exception '중지된 계정입니다.' using errcode = '42501';
  end if;

  select p.element_summary, p.opted_in_at
    into my_summary, opted
  from public.discovery_profile p where p.user_id = actor;

  if opted is null then
    raise exception '매칭 참여를 먼저 켜 주세요.' using errcode = '42501';
  end if;

  if not public.my_summary_is_current(actor) then
    raise exception '내 오행 요약이 지금 입력의 것이 아닙니다.' using errcode = '55000';
  end if;

  select s.id, s.generated_at, s.viewer_summary, s.policy_version
    into snap, made_at, snap_summary, snap_policy
  from public.discovery_snapshot s
  where s.user_id = actor
  order by s.seq desc
  limit 1;

  if snap is null
     or made_at < now() - interval '24 hours'
     or snap_summary is distinct from my_summary
     or snap_policy is distinct from 'discovery-v1' then
    snap := public.refresh_discovery_snapshot_for(actor, gen_random_uuid()::text);
  end if;

  return query
  select
    slot.candidate_user_id,
    who.nickname,
    who.intro,
    exists (select 1 from public.profile_photo f where f.user_id = slot.candidate_user_id),
    slot.position,
    slot.exploration,
    slot.supplied_elements,
    slot.balance_band,
    least(100, greatest(0, round(
      public.discovery_deficit_complement_v1(my_summary, slot.candidate_summary) * 0.3
      + public.discovery_count_balance_v1(my_summary, slot.candidate_summary) * 0.7
    )))::integer
  from public.discovery_snapshot_slot slot
  join public.app_user who on who.id = slot.candidate_user_id
  join public.discovery_profile theirs on theirs.user_id = slot.candidate_user_id
  where slot.snapshot_id = snap
    and public.discovery_eligible(actor, slot.candidate_user_id)
    and theirs.element_summary = slot.candidate_summary
  order by slot.position;
end;
$$;

create or replace function public.refresh_discovery_snapshot_for(p_actor uuid, p_seed text)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  my_summary jsonb;
  opted timestamptz;
  previous uuid;
  made uuid;
  written integer;
begin
  if p_actor is null then
    raise exception '로그인이 필요합니다.' using errcode = '28000';
  end if;

  if not exists (
    select 1 from public.app_user u where u.id = p_actor and u.status = 'active'
  ) then
    raise exception '중지된 계정입니다.' using errcode = '42501';
  end if;

  select p.element_summary, p.opted_in_at
    into my_summary, opted
  from public.discovery_profile p where p.user_id = p_actor;

  if opted is null then
    raise exception '매칭 참여를 먼저 켜 주세요.' using errcode = '42501';
  end if;

  if not public.my_summary_is_current(p_actor) then
    raise exception '내 오행 요약이 지금 입력의 것이 아닙니다.' using errcode = '55000';
  end if;

  select s.id into previous
  from public.discovery_snapshot s
  where s.user_id = p_actor
  order by s.seq desc
  limit 1;

  insert into public.discovery_snapshot (user_id, policy_version, viewer_summary)
  values (p_actor, 'discovery-v1', my_summary)
  returning id into made;

  with eligible as (
    select
      other.user_id,
      public.discovery_deficit_complement_v1(my_summary, other.element_summary) as complement,
      public.discovery_count_balance_v1(my_summary, other.element_summary) as balance,
      public.discovery_supplied_elements_v1(my_summary, other.element_summary) as supplied,
      other.element_summary as summary,
      exists (
        select 1 from public.discovery_snapshot_slot s
        where s.snapshot_id = previous and s.candidate_user_id = other.user_id
      ) as shown_before
    from public.discovery_profile other
    where public.discovery_eligible(p_actor, other.user_id)
  ),
  scored as (
    select e.*, e.complement * 0.3 + e.balance * 0.7 as score,
      public.discovery_seeded_unit(p_seed, e.user_id) as u
    from eligible e
  ),
  fresh as (
    select s.* from scored s where not s.shown_before
  ),
  sizes as (
    select count(*)::int as n from fresh
  ),
  keep as (
    select case when sizes.n < 20 then sizes.n else ceil(sizes.n * 0.2)::int end as k
    from sizes
  ),
  ranked as (
    select f.*, row_number() over (order by f.score desc, f.user_id) as rnk from fresh f
  ),
  tops as (
    select r.*, false as exploration
    from ranked r, keep
    where r.rnk <= keep.k
    order by power(r.u, 1.0 / greatest(r.score, 0.0001)) desc, r.user_id
    limit 8
  ),
  explorers as (
    select r.*, true as exploration
    from ranked r, keep
    where r.rnk > keep.k
    order by r.u, r.user_id
    limit 2
  ),
  picked as (
    select user_id, supplied, summary, complement, balance, score, u, exploration from tops
    union all
    select user_id, supplied, summary, complement, balance, score, u, exploration from explorers
  ),
  filler as (
    select s.user_id, s.supplied, s.summary, s.complement, s.balance, s.score, s.u,
      false as exploration
    from scored s
    where not exists (select 1 from picked p where p.user_id = s.user_id)
    order by s.shown_before, power(s.u, 1.0 / greatest(s.score, 0.0001)) desc, s.user_id
    limit (select greatest(0, 10 - (select count(*)::int from picked)))
  ),
  chosen as (
    select * from picked
    union all
    select * from filler
  ),
  counts as (
    select count(*)::int as wanted,
      count(*) filter (where exploration)::int as explorers
    from chosen
  ),
  sorted as (
    select c.*, row_number() over (
      order by power(c.u, 1.0 / greatest(c.score, 0.0001)) desc, c.user_id
    ) as ti
    from chosen c where not c.exploration
  ),
  wandering as (
    select c.*, row_number() over (order by c.u, c.user_id) as ei
    from chosen c where c.exploration
  ),
  slots as (
    select i as ei,
      (floor((i * counts.wanted)::numeric / (counts.explorers + 1))::int - 1) as at
    from counts, generate_series(1, counts.explorers) as i
  ),
  seats as (
    select s.idx, slots.ei, (slots.ei is not null) as is_exploration,
      sum(case when slots.ei is null then 1 else 0 end)
        over (order by s.idx rows between unbounded preceding and current row) as top_index
    from counts, generate_series(0, counts.wanted - 1) as s(idx)
    left join slots on slots.at = s.idx
  ),
  placed as (
    select seats.idx, seats.is_exploration,
      coalesce(w.user_id, t.user_id) as user_id,
      coalesce(w.supplied, t.supplied) as supplied,
      coalesce(w.summary, t.summary) as summary,
      coalesce(w.complement, t.complement) as complement,
      coalesce(w.balance, t.balance) as balance
    from seats
    left join wandering w on seats.is_exploration and w.ei = seats.ei
    left join sorted t on not seats.is_exploration and t.ti = seats.top_index
  ),
  kept as (
    insert into public.discovery_snapshot_slot (
      snapshot_id, position, candidate_user_id, candidate_summary,
      exploration, supplied_elements, balance_band
    )
    select made, placed.idx, placed.user_id, placed.summary, placed.is_exploration,
      placed.supplied, public.discovery_balance_band(placed.balance)
    from placed
    returning 1
  ),
  logged as (
    insert into public.discovery_impression (
      viewer_user_id, candidate_user_id, policy_version, position, exploration,
      viewer_summary, candidate_summary, supplied_elements, complement, combined_balance
    )
    select p_actor, placed.user_id, 'discovery-v1', placed.idx, placed.is_exploration,
      my_summary, placed.summary, placed.supplied, placed.complement, placed.balance
    from placed
    returning 1
  )
  select count(*) into written from kept;

  delete from public.discovery_snapshot s
  where s.user_id = p_actor
    and s.id not in (
      select g.id from (
        select d.id, row_number() over (order by d.seq desc) as gen
        from public.discovery_snapshot d where d.user_id = p_actor
      ) g where g.gen <= 2
    );

  return made;
end;
$$;

-- ---------------------------------------------------------------------------
-- 7. 요청과 수락 — 「그 사이에 입력이 바뀌었나」를 **세는 수**로 묻는다
--
-- 판본 id 를 견주던 자리가 `input_version` 을 견준다(#69 가 그 칸을 이미 적어 두었다).
-- 뜻은 같고 값이 가볍다 — 세는 수는 원문을 안 담는다.
-- ---------------------------------------------------------------------------

create or replace function public.request_match(p_candidate_user_id uuid)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor uuid := (select auth.uid());
  my_summary jsonb;
  my_version integer;
  their_summary jsonb;
  their_version integer;
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

  /** **묻기 전에 잠근다** — 자격 확인과 insert 사이에 낀 차단·입력 수정이 새 pending 을 놓친다. */
  perform public.lock_users(actor, p_candidate_user_id);

  /** **잠근 뒤에 나를 다시 본다** — 그 사이 커밋된 제재를 새 스냅숏이 본다. */
  if not public.is_active_account() then
    raise exception '중지된 계정입니다.' using errcode = '42501';
  end if;

  -- 내 쪽 자격은 갈라서 말한다. 내가 고칠 수 있는 것이고, 이유를 모르면 못 고친다.
  select p.element_summary into my_summary
  from public.discovery_profile p
  where p.user_id = actor and p.opted_in_at is not null;

  if my_summary is null then
    raise exception '매칭 참여를 먼저 켜 주세요.' using errcode = '42501';
  end if;

  if not public.my_summary_is_current(actor) then
    raise exception '내 오행 요약이 지금 입력의 것이 아닙니다.' using errcode = '55000';
  end if;

  select * into counted from public.reading_credits_used(actor);

  if counted.used + counted.reserved + counted.requested >= public.reading_credit_limit_for(actor) then
    raise exception '풀이권이 없어 요청할 수 없습니다. 요청 한 건이 풀이권 한 번을 잡고, 동의가 나면 그 한 번으로 궁합 풀이가 만들어집니다.'
      using errcode = 'check_violation';
  end if;

  /** 상대 쪽은 **한 문장으로만** 거절하고, 자격은 후보 목록과 **같은 함수**에 묻는다. */
  if not public.discovery_eligible(actor, p_candidate_user_id) then
    raise exception '지금은 이 사람에게 요청할 수 없습니다. 후보 목록을 새로 열어 확인해 주세요.'
      using errcode = '42501';
  end if;

  select p.element_summary into their_summary
  from public.discovery_profile p
  where p.user_id = p_candidate_user_id;

  select pe.input_version into my_version
  from public.app_user u join public.person pe on pe.id = u.self_person_id
  where u.id = actor;

  select pe.input_version into their_version
  from public.app_user u join public.person pe on pe.id = u.self_person_id
  where u.id = p_candidate_user_id;

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
    requester_input_version, addressee_input_version,
    impression_id, policy_version,
    supplied_to_requester, supplied_to_addressee, balance_band
  )
  values (
    actor, p_candidate_user_id,
    my_version, their_version,
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
$$;

create or replace function public.respond_to_match_request(p_request_id uuid, p_accept boolean)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor uuid := (select auth.uid());
  req public.match_request;
  requester_now integer;
  addressee_now integer;
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
   * 풀이권으로 Match 가 서고, 그러면 예약이 지키던 약속이 깨진다.
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

  /**
   * **그 사이에 입력이 바뀌었나** — 세는 수로 묻는다(ADR 0071).
   *
   * 앞서는 판본 id 를 견줬다. 같은 물음이고, 답이 달라지는 자리가 하나 있다: 출생지만
   * 고쳐 여덟 글자가 그대로여도 **입력은 바뀐 것이다.** 요청은 그때 동의하려던 입력에
   * 매여 있으므로 무효가 맞다.
   */
  select pe.input_version into requester_now
  from public.app_user u join public.person pe on pe.id = u.self_person_id
  where u.id = req.requester_user_id;

  select pe.input_version into addressee_now
  from public.app_user u join public.person pe on pe.id = u.self_person_id
  where u.id = req.addressee_user_id;

  if requester_now is distinct from req.requester_input_version
     or addressee_now is distinct from req.addressee_input_version
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

  /**
   * **동의 당시 여덟 글자를 베낀다** (#68). 값은 `person.current_chart` 에서 오고 앱은
   * 한 글자도 안 댄다 — 넘기면 DB 는 그 값이 그 입력에서 나온 것인지 알 수 없다.
   */
  insert into public.match (
    request_id, user_low, user_high,
    chart_low, chart_high, chart_engine_low, chart_engine_high
  )
  select
    req.id,
    least(req.requester_user_id, req.addressee_user_id),
    greatest(req.requester_user_id, req.addressee_user_id),
    lo.current_chart,
    hi.current_chart,
    lo.chart_engine_version,
    hi.chart_engine_version
  from public.app_user low_user
  join public.person lo on lo.id = low_user.self_person_id
  join public.app_user high_user
    on high_user.id = greatest(req.requester_user_id, req.addressee_user_id)
  join public.person hi on hi.id = high_user.self_person_id
  where low_user.id = least(req.requester_user_id, req.addressee_user_id)
  returning id into new_match;

  -- 성립은 **양쪽 다** 알아야 하는 사건이다.
  insert into public.notification (user_id, kind, request_id, match_id)
  values (req.requester_user_id, 'request_accepted', req.id, new_match),
         (req.addressee_user_id, 'request_accepted', req.id, new_match);

  /**
   * **동의가 예약을 쓴다** — 시도는 **요청자 이름으로** 선다.
   *
   * 여기서 던지면 **수락 전체가 되돌아간다.** 시도를 못 여는 이유는 여럿이고 그중 어느
   * 것도 「동의하지 말라」는 뜻이 아니다. 동의는 두 사람이 정한 사실이므로 그 사실을 못
   * 여는 시도가 취소하게 두지 않는다.
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
  set opted_in_at = null,
      element_summary = null,
      element_input_version = null,
      element_chart_engine_version = null
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

-- ---------------------------------------------------------------------------
-- 8. 사람을 만드는 문 — **온전하게 태어난다**
--
-- 앞서는 `insert into person default values` 로 빈 행을 세우고 그 다음에 입력을 채웠다.
-- `current_chart` 가 `not null` 이 되면 그 빈 행은 실재할 수 없다 — 게다가
-- `person_hour_matches_birth_time` 이 시각과 시주를 함께 묶으므로, 여덟 글자만 먼저
-- 넣는 길도 없다. **한 문장으로 태어나야 한다.**
--
-- 그래서 만드는 자리(INSERT)와 고치는 자리(UPDATE)가 각각 하나씩이다. 둘을 한 함수로
-- 합치려면 「행이 있으면 고치고 없으면 만든다」가 되는데, 그러면 오타 난 id 하나가
-- 사람을 하나 더 만든다.
-- ---------------------------------------------------------------------------

create function public.new_person_with_input(
  p_calendar text, p_original_date date, p_solar_date date, p_birth_time time,
  p_gender text, p_city text, p_late_night_rule text, p_time_basis text,
  p_chart jsonb, p_chart_engine_version text)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  new_person uuid;
begin
  perform public.reject_bad_chart(p_chart, p_chart_engine_version, p_birth_time);

  insert into public.person (
    calendar, original_date, solar_date, birth_time, gender, city,
    late_night_rule, time_basis, input_version, current_chart, chart_engine_version)
  values (
    p_calendar, p_original_date, p_solar_date, p_birth_time, p_gender, p_city,
    p_late_night_rule, p_time_basis, 1, p_chart, p_chart_engine_version)
  returning id into new_person;

  return new_person;
end;
$$;

/** 옛 서명 셋 — 여덟 글자를 안 싣던 문이다. 앱도 검사도 다 새 문으로 옮겼다 */
drop function if exists public.create_self_person(
  text, text, date, date, time, text, text, text, text);
drop function if exists public.create_managed_person(
  text, text, text, date, date, time, text, text, text, text);
drop function if exists public.add_person_revision(
  uuid, text, date, date, time, text, text, text, text);

create or replace function public.create_self_person(
  p_local_label text, p_calendar text, p_original_date date, p_solar_date date,
  p_birth_time time, p_gender text, p_city text, p_late_night_rule text, p_time_basis text,
  p_chart jsonb, p_chart_engine_version text)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor uuid := (select auth.uid());
  account public.app_user;
  new_person uuid;
begin
  /**
   * **관문이 값 검사보다 먼저다.**
   *
   * 여덟 글자를 먼저 재면, 가입을 안 끝낸 사람이 빈 값으로 두드렸을 때 「여덟 글자를
   * 함께 보내야 합니다」(22004)가 난다 — 그 사람이 들어야 할 말은 「가입을 먼저
   * 끝내 주세요」다. 자격을 다 물은 **뒤에** 값을 본다.
   */
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

  if account.signed_up_at is null then
    raise exception '가입을 먼저 끝내 주세요.' using errcode = '42501';
  end if;

  if account.self_person_id is not null then
    raise exception '이미 자신의 사주를 등록했습니다.' using errcode = '23505';
  end if;

  perform public.reject_bad_chart(p_chart, p_chart_engine_version, p_birth_time);

  new_person := public.new_person_with_input(
    p_calendar, p_original_date, p_solar_date, p_birth_time,
    p_gender, p_city, p_late_night_rule, p_time_basis, p_chart, p_chart_engine_version);

  insert into public.user_person_access (user_id, person_id, local_label, role)
  values (actor, new_person, p_local_label, 'owner');

  update public.app_user set self_person_id = new_person where id = actor;

  return new_person;
end;
$$;

create or replace function public.create_managed_person(
  p_local_label text, p_note text, p_calendar text, p_original_date date, p_solar_date date,
  p_birth_time time, p_gender text, p_city text, p_late_night_rule text, p_time_basis text,
  p_chart jsonb, p_chart_engine_version text)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor uuid := (select auth.uid());
  account public.app_user;
  new_person uuid;
begin
  /** 관문이 값 검사보다 먼저다 — `create_self_person` 과 같은 자리, 같은 까닭 */
  if actor is null then
    raise exception '로그인이 필요합니다.' using errcode = '28000';
  end if;

  select * into account from public.app_user where id = actor;

  if account.status <> 'active' then
    raise exception '중지된 계정입니다.' using errcode = '42501';
  end if;

  if account.signed_up_at is null then
    raise exception '가입을 먼저 끝내 주세요.' using errcode = '42501';
  end if;

  perform public.reject_bad_chart(p_chart, p_chart_engine_version, p_birth_time);

  new_person := public.new_person_with_input(
    p_calendar, p_original_date, p_solar_date, p_birth_time,
    p_gender, p_city, p_late_night_rule, p_time_basis, p_chart, p_chart_engine_version);

  insert into public.user_person_access (user_id, person_id, local_label, note, role)
  values (actor, new_person, p_local_label, nullif(btrim(p_note), ''), 'owner');

  if not public.may_add_revision(new_person, actor) then
    raise exception '이 사람의 출생정보를 쌓을 수 없습니다.' using errcode = '42501';
  end if;

  return new_person;
end;
$$;

/**
 * 입력을 고치는 **유일한 문** — 이제 아무것도 안 쌓는다.
 *
 * 판본 행을 넣던 두 문장과 `retain_person_revisions` 호출이 빠졌다. 남는 일은 셋이다:
 * 달라졌는지 견주고, 달라졌으면 그 자리를 고치고, 답을 기다리던 요청을 무효로 만든다.
 */
create or replace function public.write_person_input(
  p_person_id uuid, p_actor uuid, p_calendar text, p_original_date date, p_solar_date date,
  p_birth_time time, p_gender text, p_city text, p_late_night_rule text, p_time_basis text,
  p_chart jsonb, p_chart_engine_version text)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  now_input public.person;
  same boolean;
begin
  if p_chart is not null then
    perform public.reject_bad_chart(p_chart, p_chart_engine_version, p_birth_time);
  end if;

  /**
   * **자격을 묻고 나서 쓰는 함수는 그 사이를 잠근다.** 지금 입력을 읽기 전에 잡는다 —
   * 잠그지 않으면 두 저장이 둘 다 「안 바뀌었네」를 보고 나란히 나아간다.
   *
   * 잠그는 차례는 Person → app_user 다(`invalidate_pending_requests` 가 뒤에서 계정을
   * 잠근다). 반대 차례로 두 자원을 잡는 길은 없다.
   */
  select * into now_input from public.person where id = p_person_id for update;

  if not found then
    raise exception '그 사람을 찾지 못했습니다.' using errcode = 'no_data_found';
  end if;

  /**
   * **여덟 칸을 그대로 견준다.** 지문을 안 쓴다 — 열쇠 없는 해시는 원문의 다른 표기일
   * 뿐이고, 여기서 하려는 일은 「달라졌나」 하나다.
   */
  same := now_input.calendar is not distinct from p_calendar
      and now_input.original_date is not distinct from p_original_date
      and now_input.solar_date is not distinct from p_solar_date
      and now_input.birth_time is not distinct from p_birth_time
      and now_input.gender is not distinct from p_gender
      and now_input.city is not distinct from p_city
      and now_input.late_night_rule is not distinct from p_late_night_rule
      and now_input.time_basis is not distinct from p_time_basis;

  if same then
    /**
     * 입력은 그대로다. 판이나 값이 다르면 **여덟 글자만** 갱신한다 — 사용자가 입력을
     * 바꾼 것이 아니므로 `input_version` 도 안 오르고 **pending 요청도 안 죽는다.**
     */
    if p_chart is not null then
      update public.person
      set current_chart = p_chart, chart_engine_version = p_chart_engine_version
      where id = p_person_id
        and (current_chart is distinct from p_chart
          or chart_engine_version is distinct from p_chart_engine_version);
    end if;

    return now_input.input_version;
  end if;

  update public.person
  set calendar = p_calendar,
      original_date = p_original_date,
      solar_date = p_solar_date,
      birth_time = p_birth_time,
      gender = p_gender,
      city = p_city,
      late_night_rule = p_late_night_rule,
      time_basis = p_time_basis,
      input_version = public.person.input_version + 1,
      current_chart = coalesce(p_chart, public.person.current_chart),
      chart_engine_version =
        case when p_chart is null then public.person.chart_engine_version
             else p_chart_engine_version end
  where id = p_person_id;

  /**
   * ADR 0004 — Evidence 를 바꾸는 수정이 pending 요청을 무효화한다. 같은 트랜잭션이라
   * 그 사이에 낀 수락이 없다. 범위는 `claimed_by` 가 정한다 — 가족·친구를 고치는 것은
   * 아무 요청과도 상관이 없다.
   */
  perform public.invalidate_pending_requests(public.claimed_by(p_person_id));

  return now_input.input_version + 1;
end;
$$;

/**
 * 고친 뒤 **무엇을 돌려주나** — 판본 id 가 없으니 `input_version` 이다.
 *
 * 이름은 그대로 둔다(`add_person_revision`). 가리키던 표가 없어졌다고 문 이름을 바꾸면
 * 이 배포와 상관없는 자리가 함께 깨지고, 그 값은 이 변경이 치를 것이 아니다.
 */
drop function if exists public.add_person_revision(
  uuid, text, date, date, time, text, text, text, text, jsonb, text);

create function public.add_person_revision(
  p_person_id uuid, p_calendar text, p_original_date date, p_solar_date date,
  p_birth_time time, p_gender text, p_city text, p_late_night_rule text, p_time_basis text,
  p_chart jsonb, p_chart_engine_version text)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor uuid := (select auth.uid());
begin
  /** 관문이 값 검사보다 먼저다 — 남의 것을 두드린 사람은 그 사실부터 들어야 한다 */
  if actor is null then
    raise exception '로그인이 필요합니다.' using errcode = '28000';
  end if;

  if (select status from public.app_user where id = actor) <> 'active' then
    raise exception '중지된 계정입니다.' using errcode = '42501';
  end if;

  if not public.may_add_revision(p_person_id, actor) then
    raise exception '이 사람의 출생정보를 고칠 수 없습니다.' using errcode = '42501';
  end if;

  perform public.reject_bad_chart(p_chart, p_chart_engine_version, p_birth_time);

  return public.write_person_input(
    p_person_id, actor, p_calendar, p_original_date, p_solar_date, p_birth_time,
    p_gender, p_city, p_late_night_rule, p_time_basis, p_chart, p_chart_engine_version);
end;
$$;

grant execute on function public.add_person_revision(
  uuid, text, date, date, time, text, text, text, text, jsonb, text) to authenticated;

-- ---------------------------------------------------------------------------
-- 9. 열쇠 문 둘 — 하나는 닫고 하나는 열쇠를 바꾼다
-- ---------------------------------------------------------------------------

/**
 * **상대의 계산 입력을 읽던 문이 닫힌다** (ADR 0010 개정).
 *
 * 이 문이 있던 까닭은 공유 결과 화면이 두 사람의 명식을 **서버에서 다시 계산**했기
 * 때문이다. #68 이 동의 당시 여덟 글자를 `match` 에 베껴 두면서 그 계산이 통째로
 * 없어졌고, 남은 것은 열려 있다는 사실뿐이었다.
 */
drop function if exists public.match_calculation_inputs(uuid);

/**
 * 엔진 판이 바뀐 뒤 남의 Person 의 여덟 글자를 다시 채우는 운영 문.
 *
 * **조건부인 것은 그대로다** — 읽었던 것을 함께 받아, 그 사이 입력이 바뀌었으면 쓰지
 * 않고 `false` 로 답한다. 바뀐 것은 그 「읽었던 것」이 판본 id 에서 **입력 판**으로
 * 옮겨 간 것뿐이다.
 */
drop function if exists public.set_person_chart(uuid, uuid, jsonb, text);

create function public.set_person_chart(
  p_person_id uuid, p_expected_input_version integer, p_chart jsonb,
  p_chart_engine_version text)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  stored_birth_time time;
  written integer;
begin
  select p.birth_time into stored_birth_time
  from public.person p
  where p.id = p_person_id
    and p.calendar is not null
    and p.input_version = p_expected_input_version;

  /* 그 사이에 입력이 바뀌었거나 없는 사람이다. 둘을 가르지 않는다 */
  if not found then
    return false;
  end if;

  perform public.reject_bad_chart(p_chart, p_chart_engine_version, stored_birth_time);

  update public.person
  set current_chart = p_chart, chart_engine_version = p_chart_engine_version
  where id = p_person_id
    and input_version = p_expected_input_version;

  get diagnostics written = row_count;
  return written = 1;
end;
$$;

grant execute on function public.set_person_chart(uuid, integer, jsonb, text) to service_role;

-- ---------------------------------------------------------------------------
-- 10. 잊기 — 세던 것 하나가 없어진다
-- ---------------------------------------------------------------------------

/**
 * **판본 수를 안 센다.** 지울 판본이 없어서가 아니라 **표가 없어서**다.
 *
 * 세던 값을 0 으로 남겨 두지 않았다. 0 은 「지울 것이 없었다」로 읽히고, 그것은 이
 * 함수가 무엇을 했는지를 잘못 말한다(runbook 이 이 값을 읽는다).
 */
drop function if exists public.forget_user(uuid);

create function public.forget_user(p_user_id uuid)
returns table(people_forgotten integer)
language plpgsql
security definer
set search_path = ''
as $$
declare
  touched uuid[];
  gone integer;
  mail text;
begin
  select u.email into mail from auth.users u where u.id = p_user_id;

  if mail is null and not exists (select 1 from auth.users u where u.id = p_user_id) then
    raise exception '그런 계정이 없습니다.' using errcode = 'no_data_found';
  end if;

  select coalesce(array_agg(e.person_id), array[]::uuid[]) into touched
  from public.user_person_access e where e.user_id = p_user_id;

  delete from auth.audit_log_entries a
  where a.payload ->> 'actor_id' = p_user_id::text
     or (mail is not null and a.payload ->> 'actor_username' = mail);

  delete from auth.flow_state f where f.user_id = p_user_id;

  delete from auth.users u where u.id = p_user_id;

  with cleaned as (
    delete from public.person p
    where p.id = any(touched)
      and not exists (
        select 1 from public.user_person_access e where e.person_id = p.id
      )
    returning 1
  )
  select count(*)::integer into gone from cleaned;

  return query select gone;
end;
$$;

-- ---------------------------------------------------------------------------
-- 11. 보존 기계 — 세는 것도, 놓는 것도, 지문도 없다
-- ---------------------------------------------------------------------------

drop trigger if exists moved_summary_frees_revisions on public.discovery_profile;
drop trigger if exists request_revision_tags on public.match_request;
drop trigger if exists settled_request_releases_revisions on public.match_request;
drop trigger if exists settled_requests_free_revisions on public.match_request;

/** 지문 트리거는 **표보다 먼저** 걷는다 — 표를 지우는 것은 한참 뒤(13절)다 */
drop trigger if exists revision_fingerprint on public.person_chart_revision;

drop function if exists public.moved_summary_frees_revisions();
drop function if exists public.set_request_revision_tags();
drop function if exists public.settled_request_releases_revisions();
drop function if exists public.settled_requests_free_revisions();
drop function if exists public.set_revision_fingerprint();
drop function if exists public.revision_fingerprint(
  text, date, date, time, text, text, text, text);

/**
 * **`pg_constraint` 를 훑어 참조를 읽던 함수**가 사라진다(ADR 0011 폐기).
 *
 * 잘 지은 장치였다 — FK 가 늘어도 세는 자리를 안 고쳐도 됐다. 다만 그것이 지키던 것은
 * 「아무도 안 가리키는 이전 입력」이고, 이제 이전 입력 자체를 안 쌓는다.
 */
drop function if exists public.retain_person_revisions(uuid);
drop function if exists public.revisions_in_use(uuid[]);

-- ---------------------------------------------------------------------------
-- 12. 검사식 — 판본을 가리키던 자리가 **여덟 글자**를 가리킨다
-- ---------------------------------------------------------------------------

alter table public.match_request
  drop constraint if exists revision_is_held_only_while_it_decides;

alter table public.discovery_profile drop constraint if exists opted_in_needs_summary;

alter table public.reading drop constraint if exists match_is_a_consent;
alter table public.reading drop constraint if exists person_is_one_person;
alter table public.reading drop constraint if exists private_is_two_people;
alter table public.reading drop constraint if exists self_is_one_person;

-- ---------------------------------------------------------------------------
-- 13. 가리키던 칸과 표 — 여기서 사라진다
-- ---------------------------------------------------------------------------

alter table public.match_request
  drop column if exists requester_revision_id,
  drop column if exists addressee_revision_id,
  drop column if exists requester_revision_tag,
  drop column if exists addressee_revision_tag;

alter table public.match
  drop column if exists low_revision_id,
  drop column if exists high_revision_id;

alter table public.reading
  drop column if exists revision_a,
  drop column if exists revision_b;

alter table public.reading_job
  drop column if exists revision_a,
  drop column if exists revision_b;

alter table public.discovery_profile drop column if exists element_revision_id;

alter table public.person drop column if exists current_revision_id;

drop table if exists public.person_chart_revision;

-- ---------------------------------------------------------------------------
-- 14. 좁히기 — **백필이 끝났어야 여기를 지난다**
--
-- 빈 값이 남은 채로 `not null` 을 걸면 그 뒤의 읽기가 조용히 0행을 내고, 사용자에게는
-- 「내 것이 사라졌다」로 보인다. 그래서 세어 보고 **소리 내어 멈춘다.**
-- ---------------------------------------------------------------------------

do $$
declare
  blank integer;
begin
  select count(*) into blank from public.person where current_chart is null;

  if blank > 0 then
    raise exception
      '여덟 글자가 빈 Person 이 %명 남아 있습니다. 백필(BACKFILL_CHART=1)을 먼저 끝내세요.',
      blank;
  end if;
end $$;

do $$
declare
  blank integer;
begin
  select count(*) into blank
  from public.match m
  where m.chart_low is null or m.chart_high is null
     or m.chart_engine_low is null or m.chart_engine_high is null;

  if blank > 0 then
    raise exception
      '동의 당시 여덟 글자가 빈 Match 가 %건 남아 있습니다. 백필(BACKFILL_READING_CHART=1)을 먼저 끝내세요.',
      blank;
  end if;
end $$;

do $$
declare
  blank integer;
begin
  select count(*) into blank
  from public.reading r
  where r.chart_a is null
     or (r.kind in ('match', 'private') and r.chart_b is null);

  if blank > 0 then
    raise exception
      '여덟 글자가 빈 풀이가 %건 남아 있습니다. 백필(BACKFILL_READING_CHART=1)을 먼저 끝내세요.',
      blank;
  end if;
end $$;

alter table public.person
  alter column current_chart set not null,
  alter column chart_engine_version set not null;

/** 판본 두 칸이 `not null` 로 지키던 것을 여덟 글자가 그대로 이어받는다 */
alter table public.match
  alter column chart_low set not null,
  alter column chart_high set not null,
  alter column chart_engine_low set not null,
  alter column chart_engine_high set not null;

alter table public.reading alter column chart_a set not null;

alter table public.reading_job alter column chart_a set not null;

alter table public.discovery_profile
  add constraint opted_in_needs_summary check (
    opted_in_at is null
    or (element_summary is not null and element_input_version is not null));

/** 갈래마다 **둘째 사람이 있고 없고**를 여덟 글자가 말한다 — 앞서는 판본이 말했다 */
alter table public.reading
  add constraint self_is_one_person check (
    kind <> 'self'
    or (owner_user_id is not null and match_id is null and person_b is null
        and chart_b is null and score is null)),
  add constraint person_is_one_person check (
    kind <> 'person'
    or (owner_user_id is not null and match_id is null and person_b is null
        and chart_b is null and score is null)),
  add constraint private_is_two_people check (
    kind <> 'private'
    or (owner_user_id is not null and match_id is null and person_b is not null
        and chart_b is not null and person_a < person_b)),
  add constraint match_is_a_consent check (
    kind <> 'match'
    or (owner_user_id is null and match_id is not null and person_b is not null
        and chart_b is not null));
