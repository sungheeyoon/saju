-- ---------------------------------------------------------------------------
-- 한마디로 빗대면 — **점수가 못 하던 일을 한 문장이 진다**
-- ---------------------------------------------------------------------------
--
-- 실호출 산출물을 세어 보니 궁합 점수 열한 번이 전부 62~68 이었다. 0~100 이라고
-- 말하면서 실제로 쓰는 폭이 7 점이고, **같은 짝을 다시 불렀을 때의 흔들림(±3)이 다른
-- 짝과의 차이만큼 크다** — 그 숫자로는 두 관계를 구별할 수 없다.
--
-- 눈금을 고치는 대신 **숫자에서 의미를 내렸다.** 66 과 68 을 구별하라고 안 시키고,
-- 이 둘이 어떤 사이인지는 비유 한 문장이 진다. 같은 62~68 안에서도 전혀 다른 두
-- 관계를 말할 수 있는 자리다.
--
-- ## 열로 든다
--
-- 본문 첫 줄에서 긁어낼 수도 있었다. 안 한 까닭 셋이다.
--
-- 1. **화면이 그 줄을 알아야 한다.** 점수 아래 크게 세우려면 파싱이 아니라 값이어야
--    하고, 모델이 형식을 조금만 바꾸면 파싱은 깨진다.
-- 2. **검사를 걸 수 있다.** 오행을 빗댄 척 되살렸는지·한 줄에 드는지를 잰다.
-- 3. **목록에서 쓴다.** `/me/readings` 의 카드마다 한 줄이 서는데, 본문 파싱으로는
--    목록 RPC 가 본문을 실어야 한다 — 그 반환형은 **일부러 본문을 안 싣는다**(ADR 0033).
--
-- **옛 글에는 없다.** 되짚어 지어 넣지 않는다 — 그때 나온 글이 아니고, 지어 넣으면
-- 어느 것이 모델이 쓴 것인지 갈린다. `null` 이면 화면이 그 자리를 안 세운다.

alter table public.reading add column if not exists metaphor text;

comment on column public.reading.metaphor is
  '점수 아래 한 줄로 서는 비유. 이 열이 생기기 전 글에는 없다(null)';

create or replace function public.save_reading(
  p_run_id uuid,
  p_revision_a uuid,
  p_revision_b uuid,
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

  /**
   * **만료된 시도로는 저장하지 않는다.**
   *
   * 만료를 지나면 같은 대상에 새 시도가 열릴 수 있고, 그 새 시도가 이미 성공했을 수
   * 있다. 그때 늦게 돌아온 이 호출을 받아 주면 사용자가 방금 읽은 글이 옛 글로 되돌아간다.
   */
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
   * actor 는 앱이 대지 않고, 사용자 JWT 로 열린 시도 행에서만 읽는다.
   */
  select * into pinned
  from public.reading_scope_for(
    run.user_id, run.kind, run.person_a, run.person_b, run.match_id);

  if not found then
    raise exception '결과를 저장할 대상을 찾지 못했습니다.' using errcode = 'no_data_found';
  end if;

  /**
   * 만든 판본과 지금 판본이 갈렸다.
   *
   * 사용자가 글을 만드는 동안 출생정보를 고친 경우다. 그대로 저장하면 「지금 입력으로
   * 쓴 글」이라고 적힌 옛 글이 남는다. 저장하지 않고 그렇게 말한다 — 다시 누르면
   * 새 입력으로 만들어진다.
   */
  if pinned.revision_a is distinct from p_revision_a
     or pinned.revision_b is distinct from p_revision_b then
    raise exception '만드는 동안 출생정보가 바뀌었습니다. 새 입력으로 다시 만들어 주세요.'
      using errcode = 'check_violation';
  end if;

  update public.reading_run r
  set status = 'succeeded', finished_at = now(), model = p_model, prompt_version = p_prompt_version
  where r.id = p_run_id;

  insert into public.reading (
    kind, owner_user_id, match_id, person_a, person_b, revision_a, revision_b,
    output, score, metaphor, evidence, prompt, prompt_version, model, generation, viewed_at,
    source_run_id
  )
  values (
    run.kind,
    -- 공유 결과에는 주인이 없다. 누가 눌렀든 양쪽이 같은 것을 본다.
    case when run.kind = 'match' then null else run.user_id end,
    run.match_id, run.person_a, run.person_b,
    p_revision_a, p_revision_b,
    p_output, p_score, p_metaphor, p_evidence, p_prompt, p_prompt_version, p_model,
    coalesce(p_generation, '{}'::jsonb), p_viewed_at,
    /*
      **어느 시도가 이 글을 만들었나.** 교체될 때 함께 갈린다 — 안 갈면 새 글에 옛
      시도가 매달리고, 그 시도에 달린 설문이 읽지도 않은 글의 답이 된다.
    */
    p_run_id
  )
  on conflict (target_key) do update
  set revision_a = excluded.revision_a,
      revision_b = excluded.revision_b,
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

  /**
   * Match 만 알린다 — **상대에게만.**
   *
   * 누른 사람은 결과를 그 자리에서 본다. 상대는 자기가 보던 공유 결과가 바뀐 것을
   * 알아야 하고, 그것이 이 알림이 있는 유일한 이유다.
   */
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

revoke execute on function public.save_reading(
  uuid, uuid, uuid, text, smallint, text, text, text, text, text, jsonb, timestamptz
) from anon, public, authenticated;
grant execute on function public.save_reading(
  uuid, uuid, uuid, text, smallint, text, text, text, text, text, jsonb, timestamptz
) to service_role;

-- 인자가 하나 늘어 옛 서명이 남는다. 지워야 두 벌이 안 된다.
drop function if exists public.save_reading(
  uuid, uuid, uuid, text, smallint, text, text, text, text, jsonb, timestamptz
);

-- ---------------------------------------------------------------------------
-- 읽는 자리 둘도 함께 든다
-- ---------------------------------------------------------------------------

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
  /** 점수 아래 한 줄로 서는 비유 — 옛 글에는 없다(`null`) */
  metaphor text,
  output text,
  model text,
  viewed_at timestamptz,
  created_at timestamptz,
  viewer_is_first boolean,
  from_current_revision boolean,
  /**
   * 이 글을 만든 시도 — **설문이 매달릴 자리.**
   *
   * 이 값이 없는 글이 있다. 이 열이 생기기 전에 저장된 것들이고, 되짚어 지어 넣지
   * 않았다(위). 그 글에는 설문이 안 붙는다.
   */
  source_run_id uuid,
  /**
   * 그 시도에 **내가** 남긴 답 — 없으면 `null`.
   *
   * 「답했는가」만 내주던 때가 있었다. 그러면 고치는 화면이 **빈 칸으로 열리고**,
   * 거기서 다시 보내면 적어 두었던 글까지 `null` 로 덮인다 — 고치는 것이 아니라
   * 지우는 것이 된다.
   *
   * 값을 함께 내주므로 화면은 그 값으로 칸을 채워 연다. 공유 궁합은 두 사람이 따로
   * 답하므로 이것은 **부른 사람의 답**이다.
   */
  my_feedback jsonb
)
language sql
stable
security definer
set search_path = ''
as $$
  select
    r.id, r.kind, r.score, r.metaphor, r.output, r.model, r.viewed_at, r.created_at,
    s.viewer_is_first,
    r.revision_a = s.revision_a and r.revision_b is not distinct from s.revision_b,
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
   and r.match_id is not distinct from s.match_id;
$$;

revoke execute on function public.my_reading(text, uuid, uuid, uuid) from anon, public;
grant execute on function public.my_reading(text, uuid, uuid, uuid) to authenticated;

drop function if exists public.my_readings();

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
  from_current_revision boolean
)
language sql
stable
security definer
set search_path = ''
as $$
  select
    l.kind, l.person_a, l.person_b, l.match_id,
    l.label_a, l.label_b, l.score, l.metaphor, l.created_at, l.from_current_revision
  from (
    /**
     * 내가 주인인 셋 — `self` · `person` · `private`.
     *
     * **이름이 붙는 근거가 곧 좁힘이다.** 엣지가 없으면 그 줄이 안 선다. 결과가 남아
     * 있어도 내가 그 사람을 목록에서 빼면 이 목록에서 사라진다 — 접근이 끊긴 사람의
     * 이름이 옛 결과를 통해 계속 보이지 않는 것이 요점이다(`my_private_readings` 와
     * 같은 규율). 그래서 `exists` 로 적는다: 붙이는 이름은 아래 스칼라 하위질의가
     * 내고, **줄이 서는가**는 여기서 정한다.
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
      /**
       * 한 사람짜리에서는 `pb` 가 없는 행이라 오른쪽이 `null is not distinct from null`
       * 로 참이 된다. 두 번째 사람을 따로 갈래 지어 세지 않는 것이 요점이다 — kind 로
       * 나누면 `person` 이 늘어난 날처럼 한 갈래만 안 고쳐진다.
       */
      r.revision_a = pa.current_revision_id
        and r.revision_b is not distinct from pb.current_revision_id as from_current_revision
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
     * 중지된 계정도, 상대가 중지된 것도, 차단도 저 함수 안에 있다. 여기서 조건을 다시
     * 적으면 두 자리가 갈리고, 갈리는 날 이 목록이 결과 화면보다 넓어진다.
     *
     * **「이전 입력」이 없다.** 공유 결과는 매인 판본으로 나고 그 판본이 곧 동의한
     * 대상이라(ADR 0010), 「그 뒤에 고친 입력으로 다시 봐야 한다」는 말이 성립하지 않는다.
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
    label_a, label_b, score, metaphor, created_at, from_current_revision
  )
  order by l.created_at desc;
$$;

revoke execute on function public.my_readings() from anon, public;
grant execute on function public.my_readings() to authenticated;
