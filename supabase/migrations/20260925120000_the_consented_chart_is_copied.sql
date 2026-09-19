-- 동의 당시 여덟 글자를 Match 와 Reading 이 직접 든다 (ADR 0071 · #68)
--
-- 되짚을 것을 **입력이 아니라 여덟 글자**로 옮긴다.
--
-- 오늘 `match` 는 판본을 통해 출생 원문·출생지·성별·자시 규칙·시간 기준까지 영구히
-- 붙들지만, ADR 0012 가 연 것은 **여덟 글자까지**다. 스냅샷은 정확히 그만큼이고,
-- **좁아지는 변경이다.**
--
-- ## 앱이 스냅샷을 주장하지 않는다
--
-- 수락 RPC 는 `p_request_id`·`p_accept` 만 받고 `person.current_chart` 를 **DB 안에서**
-- 복사한다. 앱이 스냅샷을 수락에 넘기면 DB 는 그 값이 그 입력에서 나온 것인지 알 수 없고,
-- 그건 ADR 0013 이 `save_reading` 에서 막아 둔 구멍을 다른 문에 다시 내는 일이다.
-- 같은 이유로 `save_reading` 도 스냅샷을 인자로 안 받고 얼린 작업에서 읽는다.
--
-- **사용자 경로에 여덟 글자를 주장하는 문은 입력을 쓰는 문 하나뿐이다**(A1). 그 뒤의
-- 복사는 전부 여기, DB 안에서 일어난다.
--
-- ## 수명이 다른 둘
--
--   Match 에는 **여덟 글자**가 — 동의한 범위가 거기까지다. 영구히 남는다.
--   작업에는 **입력 전체**가 — 대운·신살이 경도·시간 기준·성별을 요구한다. terminal 에 사라진다.
--
-- ## 넓히기만 한다
--
-- 새 열은 전부 `null` 을 허용한다. 이미 쌓인 행 중 **매인 판본이 더는 현재가 아닌** 것은
-- SQL 로 못 채운다 — 여덟 글자는 절기·자시·경도를 아는 TypeScript 엔진만 셀 수 있다.
-- 그 나머지는 앱 백필이 채우고, `not null` 로 좁히는 것은 #70 이다.

-- ---------------------------------------------------------------------------
-- 1. Match 가 동의 당시 여덟 글자를 든다
-- ---------------------------------------------------------------------------

/**
 * **판을 함께 적는다.**
 *
 * 스냅샷은 사본이라 엔진이 바뀌면 낡는다. 막을 수는 없고 **알아볼 수는 있다** — 판을
 * 옆에 두면 「이 복사가 어느 엔진의 것이었나」를 나중에 물을 수 있다(ADR 0071).
 *
 * 양쪽을 따로 든다. 한쪽만 백필이 늦으면 두 판이 실제로 갈리고, 한 칸으로 합쳐 두면
 * 그때 어느 쪽 이야기인지 말할 수 없다.
 */
alter table public.match
  add column chart_low jsonb,
  add column chart_high jsonb,
  add column chart_engine_low text,
  add column chart_engine_high text;

comment on column public.match.chart_low is
  '동의 당시 user_low 의 여덟 글자 — 출생 원문은 여기 없다(ADR 0012·0071)';

alter table public.match
  add constraint match_charts_have_shape check (
    (chart_low is null or public.is_chart_snapshot(chart_low))
    and (chart_high is null or public.is_chart_snapshot(chart_high)));

/** 판 없는 스냅샷은 낡았는지 물을 수 없고, 스냅샷 없는 판은 아무것도 안 가리킨다 */
alter table public.match
  add constraint match_charts_stand_with_their_engine check (
    (chart_low is null) = (chart_engine_low is null)
    and (chart_high is null) = (chart_engine_high is null));

/**
 * 이미 성립한 Match 중 **매인 판본이 아직 현재인 것**만 여기서 채운다.
 *
 * 그 경우에만 `person.current_chart` 가 그때의 여덟 글자와 같다고 말할 수 있다. 매인
 * 판본이 밀려난 Match 는 옛 입력에서 다시 세어야 하고, 그것은 SQL 이 못 한다 —
 * 앱 백필이 판본을 읽어 채운다(#70 이 `not null` 로 좁히기 전에).
 */
update public.match m
set chart_low = lo.current_chart,
    chart_engine_low = lo.chart_engine_version
from public.person_chart_revision r
join public.person lo on lo.id = r.person_id
where r.id = m.low_revision_id
  and lo.current_revision_id = m.low_revision_id
  and lo.current_chart is not null
  and m.chart_low is null;

update public.match m
set chart_high = hi.current_chart,
    chart_engine_high = hi.chart_engine_version
from public.person_chart_revision r
join public.person hi on hi.id = r.person_id
where r.id = m.high_revision_id
  and hi.current_revision_id = m.high_revision_id
  and hi.current_chart is not null
  and m.chart_high is null;

-- ---------------------------------------------------------------------------
-- 2. Reading 이 생성 당시 여덟 글자를 든다
-- ---------------------------------------------------------------------------

alter table public.reading
  add column chart_a jsonb,
  add column chart_b jsonb;

comment on column public.reading.chart_a is
  '이 글을 만들 때의 여덟 글자 — 지금 명식과 견주는 데만 쓴다(ADR 0071)';

alter table public.reading
  add constraint reading_charts_have_shape check (
    (chart_a is null or public.is_chart_snapshot(chart_a))
    and (chart_b is null or public.is_chart_snapshot(chart_b)));

update public.reading r
set chart_a = pa.current_chart
from public.person pa
where pa.id = r.person_a
  and r.revision_a = pa.current_revision_id
  and pa.current_chart is not null
  and r.chart_a is null;

update public.reading r
set chart_b = pb.current_chart
from public.person pb
where pb.id = r.person_b
  and r.revision_b = pb.current_revision_id
  and pb.current_chart is not null
  and r.chart_b is null;

-- ---------------------------------------------------------------------------
-- 3. 얼린 작업도 여덟 글자를 함께 언다
-- ---------------------------------------------------------------------------

/**
 * **보드에 설 값과 본문을 만들 값이 같은 시점의 것이어야 한다.**
 *
 * 본문은 얼린 **입력 전체**에서 나고 보드는 **여덟 글자**로 선다. 둘을 따로 읽으면 한
 * 화면에 두 시점이 섞인다 — 그래서 작업이 둘 다 든다.
 */
alter table public.reading_job
  add column chart_a jsonb,
  add column chart_b jsonb;

alter table public.reading_job
  add constraint job_charts_have_shape check (
    (chart_a is null or public.is_chart_snapshot(chart_a))
    and (chart_b is null or public.is_chart_snapshot(chart_b)));

update public.reading_job j
set chart_a = pa.current_chart
from public.reading_run run
join public.person pa on pa.id = run.person_a
where run.id = j.run_id and j.chart_a is null and pa.current_chart is not null;

update public.reading_job j
set chart_b = pb.current_chart
from public.reading_run run
join public.person pb on pb.id = run.person_b
where run.id = j.run_id and j.chart_b is null and pb.current_chart is not null;

/**
 * 얼릴 때 여덟 글자도 함께 베낀다 — **어디서 베끼는가가 kind 로 갈린다.**
 *
 * `match` 는 **동의 당시 값**을 Match 에서 읽는다. 지금 `person.current_chart` 를 읽으면
 * 그 뒤에 입력을 고친 사람의 새 여덟 글자가 동의한 적 없는 보드에 선다.
 *
 * 나머지는 지금 값이 곧 대상이다.
 */
create or replace function public.freeze_reading_input(
  p_run_id uuid,
  p_actor uuid,
  p_kind text,
  p_person_a uuid,
  p_person_b uuid,
  p_match_id uuid,
  p_revision_a uuid,
  p_revision_b uuid
)
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
    run_id, revision_a, revision_b, birth_a, birth_b, about, chart_a, chart_b, status)
  values (
    p_run_id, p_revision_a, p_revision_b,
    public.revision_birth(p_revision_a),
    public.revision_birth(p_revision_b),
    public.reading_about(p_actor, p_kind, p_person_a, p_person_b, p_match_id),
    glyphs_a, glyphs_b,
    'frozen');
end;
$$;

revoke execute on function public.freeze_reading_input(
  uuid, uuid, text, uuid, uuid, uuid, uuid, uuid)
  from anon, public, authenticated, service_role;

-- ---------------------------------------------------------------------------
-- 4. 수락 트랜잭션이 **DB 안에서** 복사한다
-- ---------------------------------------------------------------------------

/**
 * 받은 요청에 답한다 — **수락이 여덟 글자를 베낀다.**
 *
 * 바탕은 이 함수가 **마지막에 서 있던 정의**다(`20260907210000`). 더한 것은 `match` 를
 * 세우는 `insert` 의 칸 넷뿐이다.
 *
 * ## 앱이 값을 안 댄다
 *
 * 인자는 그대로 둘이다. 스냅샷을 인자로 받으면 DB 는 그 값이 그 사람의 입력에서 나온
 * 것인지 알 수 없다 — ADR 0013 이 `save_reading` 에서 막아 둔 구멍을 다른 문에 다시
 * 내는 일이다.
 *
 * ## 다시 세지 않는다
 *
 * **동의 대상은 수락 시점의 현재 엔진이 낸 여덟 글자다.** 그 값이 낡았다면 낡은 채로
 * 동의된 것이고, 그것을 막는 것은 **일괄 백필이지 수락 문이 아니다** — DB 는 절기·자시·
 * 경도를 못 세고, 상대의 입력은 수락하는 쪽 앱에 열려 있지 않다(ADR 0071).
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

  /**
   * **여기가 이 마이그레이션의 네 칸이다.**
   *
   * 판본 둘은 그대로 매고(#70 이 뗀다), 그 옆에 **동의 당시 여덟 글자**를 베낀다.
   * 값은 `person.current_chart` 에서 오고 앱은 한 글자도 안 댄다.
   */
  insert into public.match (
    request_id, user_low, user_high, low_revision_id, high_revision_id,
    chart_low, chart_high, chart_engine_low, chart_engine_high
  )
  select
    req.id,
    least(req.requester_user_id, req.addressee_user_id),
    greatest(req.requester_user_id, req.addressee_user_id),
    case when req.requester_user_id < req.addressee_user_id
      then req.requester_revision_id else req.addressee_revision_id end,
    case when req.requester_user_id < req.addressee_user_id
      then req.addressee_revision_id else req.requester_revision_id end,
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
   * ## 못 열어도 동의는 선다
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

revoke execute on function public.respond_to_match_request(uuid, boolean) from anon, public;
grant execute on function public.respond_to_match_request(uuid, boolean) to authenticated;

-- ---------------------------------------------------------------------------
-- 5. 저장이 얼린 여덟 글자를 옮겨 적는다
-- ---------------------------------------------------------------------------

/**
 * 결과를 저장한다 — **여덟 글자도 얼린 작업에서 읽는다.**
 *
 * 바탕은 #66 이 세운 열 인자짜리다. 더한 것은 `chart_a`·`chart_b` 두 칸이고, 그 값은
 * 인자가 아니라 작업에서 온다 — 앱이 스냅샷을 주장하는 자리를 늘리지 않는다.
 */
create or replace function public.save_reading(
  p_run_id uuid,
  p_output text,
  p_score smallint,
  p_metaphor text,
  p_evidence text,
  p_prompt text,
  p_prompt_version text,
  p_model text,
  p_generation jsonb,
  p_viewed_at timestamptz
)
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
    kind, owner_user_id, match_id, person_a, person_b, revision_a, revision_b,
    chart_a, chart_b,
    output, score, metaphor, evidence, prompt, prompt_version, model, generation, viewed_at,
    source_run_id
  )
  values (
    run.kind,
    -- 공유 결과에는 주인이 없다. 누가 눌렀든 양쪽이 같은 것을 본다.
    case when run.kind = 'match' then null else run.user_id end,
    run.match_id, run.person_a, run.person_b,
    job.revision_a, job.revision_b,
    job.chart_a, job.chart_b,
    p_output, p_score, p_metaphor, p_evidence, p_prompt, p_prompt_version, p_model,
    coalesce(p_generation, '{}'::jsonb), p_viewed_at,
    p_run_id
  )
  on conflict (target_key) do update
  set revision_a = excluded.revision_a,
      revision_b = excluded.revision_b,
      chart_a = excluded.chart_a,
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

-- ---------------------------------------------------------------------------
-- 6. 「이전 명식으로 만든 풀이」를 **여덟 글자로** 판정한다
-- ---------------------------------------------------------------------------

/**
 * `from_current_revision` 옆에 `from_current_chart` 를 세운다 — **넓히고 나중에 좁힌다.**
 *
 * ## 한쪽으로 거짓말하던 것이 고쳐진다
 *
 * 지금은 출생지를 서울에서 부산으로 고치면 새 판본이 서고, **여덟 글자가 그대로여도**
 * 화면이 「이전 입력」이라 적는다. 화면이 하려는 말은 **「이전 명식」**이므로 여덟 글자로
 * 견주는 쪽이 맞다(ADR 0071).
 *
 * ## 옛 글은 판본으로 견준다
 *
 * 스냅샷이 없는 글이 있다 — 이 열이 생기기 전에 저장된 것들이고, 매인 판본이 밀려난
 * 것은 SQL 로 못 채운다. 그때는 **옛 방식으로 견준다**: 없는 값을 「다르다」로 읽으면
 * 멀쩡한 글에 「이전 입력」 딱지가 붙는다.
 *
 * ## 견주는 자리는 계속 SQL 이다
 *
 * 화면이 재면 판정하는 자리가 둘이 되고, 둘은 갈린다(ADR 0033).
 */
drop function public.my_reading(text, uuid, uuid, uuid);

create function public.my_reading(
  p_kind text,
  p_person_a uuid default null,
  p_person_b uuid default null,
  p_match_id uuid default null
)
returns table (
  id uuid,
  kind text,
  score smallint,
  metaphor text,
  output text,
  model text,
  viewed_at timestamptz,
  created_at timestamptz,
  viewer_is_first boolean,
  from_current_revision boolean,
  /** 그 글의 여덟 글자가 아직 지금 명식인가 — `match` 는 언제나 참이다 */
  from_current_chart boolean,
  source_run_id uuid,
  my_feedback jsonb
)
language sql
stable
security definer
set search_path = ''
as $$
  select
    r.id, r.kind, r.score, r.metaphor,
    case when s.kind = 'match' then public.reading_user_body(r.output) else r.output end,
    r.model, r.viewed_at, r.created_at,
    s.viewer_is_first,
    r.revision_a = s.revision_a and r.revision_b is not distinct from s.revision_b,
    case
      /**
       * 공유 결과는 동의 당시 여덟 글자로 나고 그 값이 곧 동의한 대상이라, 「그 뒤에
       * 고친 입력으로 다시 봐야 한다」는 말이 성립하지 않는다(ADR 0010·0012).
       */
      when s.kind = 'match' then true
      when r.chart_a is null then
        r.revision_a = s.revision_a and r.revision_b is not distinct from s.revision_b
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

revoke execute on function public.my_reading(text, uuid, uuid, uuid) from anon, public;
grant execute on function public.my_reading(text, uuid, uuid, uuid) to authenticated;

drop function public.my_readings();

create function public.my_readings()
returns table (
  kind text,
  person_a uuid,
  person_b uuid,
  match_id uuid,
  label_a text,
  label_b text,
  score smallint,
  metaphor text,
  created_at timestamptz,
  from_current_revision boolean,
  from_current_chart boolean
)
language sql
stable
security definer
set search_path = ''
as $$
  select
    l.kind, l.person_a, l.person_b, l.match_id,
    l.label_a, l.label_b, l.score, l.metaphor, l.created_at,
    l.from_current_revision, l.from_current_chart
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
      r.revision_a = pa.current_revision_id
        and r.revision_b is not distinct from pb.current_revision_id as from_current_revision,
      case
        when r.chart_a is null then
          r.revision_a = pa.current_revision_id
            and r.revision_b is not distinct from pb.current_revision_id
        else coalesce(
          r.chart_a = pa.current_chart and r.chart_b is not distinct from pb.current_chart,
          false)
      end as from_current_chart
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
      true,
      true
    from public.reading r
    join public.visible_matches() m on m.id = r.match_id
    join public.app_user partner
      on partner.id = case
        when m.user_low = (select auth.uid()) then m.user_high else m.user_low end
    where r.kind = 'match'
  ) l (
    kind, person_a, person_b, match_id,
    label_a, label_b, score, metaphor, created_at, from_current_revision, from_current_chart
  )
  order by l.created_at desc;
$$;

revoke execute on function public.my_readings() from anon, public;
grant execute on function public.my_readings() to authenticated;

-- ---------------------------------------------------------------------------
-- 7. 결과 화면의 보드는 **저장된 스냅샷**으로 선다
-- ---------------------------------------------------------------------------

/**
 * Match 한 건이 여는 범위 — **여덟 글자가 함께 나간다.**
 *
 * 앞서는 판본 id 둘만 내주고 서버가 열쇠로 계산 입력을 읽어 여덟 글자를 **계산**했다
 * (`match_calculation_inputs`). 이제 그 값은 수락 때 베껴 둔 것이 있으므로 그대로 낸다 —
 * 상대의 계산 입력을 읽는 열쇠 문이 이 길에서 빠진다(ADR 0010 개정).
 *
 * 나가는 것이 넓어지지 않는다. 여덟 글자는 동의로 열린 바로 그 값이고(ADR 0012),
 * 출생 원문·출생지·성별은 여기 없다.
 *
 * 판본 id 둘은 그대로 둔다 — 옛 앱이 도는 동안 창이 안 생겨야 한다(#70 이 뗀다).
 */
drop function public.my_match_scope(uuid);

create function public.my_match_scope(p_match_id uuid)
returns table (
  match_id uuid,
  partner_user_id uuid,
  partner_nickname text,
  partner_intro text,
  partner_has_photo boolean,
  my_revision_id uuid,
  partner_revision_id uuid,
  /** 동의 당시 내 여덟 글자 */
  my_chart jsonb,
  /** 동의 당시 상대의 여덟 글자 */
  partner_chart jsonb,
  supplied_to_me text[],
  supplied_to_them text[],
  balance_band text,
  created_at timestamptz
)
language sql
stable
security definer
set search_path = ''
as $$
  select
    m.id,
    partner.id,
    partner.nickname,
    partner.intro,
    exists (select 1 from public.profile_photo f where f.user_id = partner.id),
    case when m.user_low = (select auth.uid()) then m.low_revision_id else m.high_revision_id end,
    case when m.user_low = (select auth.uid()) then m.high_revision_id else m.low_revision_id end,
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

revoke execute on function public.my_match_scope(uuid) from anon, public;
grant execute on function public.my_match_scope(uuid) to authenticated;
