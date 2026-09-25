-- 궁합풀이는 **그 점수를 잰 눈금**을 함께 든다 (ADR 0113)
--
-- 2026-09-25 에 점수가 `discovery-v1`(오행 균형 70 · 개수 보완 30) 한 벌에서 `v2-beta` 두 벌로 갈렸다 — 연인 · 배우자와
-- 성립한 인연은 연인용(일주 · 일지 40 · 필요한 기운 보완 40 · 오행 균형 20), 가족 · 친구 · 동료 · 모름은 일반(보완 60 ·
-- 균형 40). 풀이 점수는 기준점에서 움직인 값이고(ADR 0060), 이미 저장된 풀이의 점수는 그대로다(ADR 0113 의 6).
--
-- 그래서 풀이를 다시 여는 화면은 **그 풀이를 만든 때의 눈금**으로 지표를 그려야 한다. 옛 풀이 옆에 새 판의 수를
-- 세우면 한 화면에 눈금이 둘이 된다. 그러려면 풀이가 셋을 들어야 한다.
--
-- - `score_baseline` — 프롬프트에 실은 기준점. 프롬프트에서 되읽을 수도 있지만(`baselineIn`) 화면이 프롬프트를
--   읽게 두지 않는다 — 프롬프트는 내부 화면의 것이다
-- - `score_version` — `discovery-v1` · `v2-beta`. **옛 행은 `null` 이고 그것이 `discovery-v1` 이다** — 되짚어
--   채우지 않는다. 그때 적힌 값이 아니다
-- - `score_relation` — 기준점을 고를 때 쓴 사이. 모르면 `null`. 인연 궁합은 사이와 상관없이 연인용이다
--
-- 값은 앱이 프롬프트를 지을 때 정하고(`readingEvidenceOf`), **프롬프트와 같은 걸음에** 얼린 작업에 적힌다
-- (`prepare_reading_job`). 저장하는 문은 인자로 받지 않고 얼린 작업에서 옮긴다 — 프롬프트 · 근거와 같은 길이다.
-- 앱이 저장할 때 따로 대면 그 값이 이 시도의 프롬프트에 실린 수인지 DB 가 알 수 없다.
--
-- **배포 순서: DB 가 먼저다.** 새 인자는 기본값이 `null` 이라 옛 앱은 그대로 돈다(세 칸이 비어 옛 판으로 읽힌다 —
-- 옛 앱의 기준점은 실제로 옛 판이다). 새 앱이 옛 DB 를 만나면 `prepare_reading_job` 을 못 찾는다.
--
-- 재는 자리는 `supabase/tests/59_reading_score_scale.test.sql`.

-- ---------------------------------------------------------------------------
-- 1. 칸 — 풀이와 얼린 작업에 같은 셋
-- ---------------------------------------------------------------------------

alter table public.reading
  add column score_baseline smallint,
  add column score_version text,
  add column score_relation text;

alter table public.reading
  add constraint reading_score_baseline_range check (score_baseline between 0 and 100),
  add constraint reading_score_version_known check (score_version in ('discovery-v1', 'v2-beta')),
  add constraint reading_score_relation_known check (score_relation in ('family', 'friend', 'partner')),
  /* 눈금은 점수가 나는 두 kind 에만 있다 — 한 사람 풀이에는 점수가 없다 */
  add constraint reading_score_scale_is_for_pairs check (
    kind in ('private', 'match')
    or (score_baseline is null and score_version is null and score_relation is null));

comment on column public.reading.score_baseline is '프롬프트에 실은 궁합 기준점 (ADR 0060 · 0113). 옛 풀이는 null';
comment on column public.reading.score_version is '기준점의 판 — discovery-v1 · v2-beta. null 은 이 칸 전의 풀이이고 discovery-v1 이다';
comment on column public.reading.score_relation is '기준점을 고를 때 쓴 사이 — family · friend · partner, 모르면 null';

alter table public.reading_job
  add column score_baseline smallint,
  add column score_version text,
  add column score_relation text;

alter table public.reading_job
  add constraint job_score_baseline_range check (score_baseline between 0 and 100),
  add constraint job_score_version_known check (score_version in ('discovery-v1', 'v2-beta')),
  add constraint job_score_relation_known check (score_relation in ('family', 'friend', 'partner'));

-- ---------------------------------------------------------------------------
-- 2. 얼리는 문 — 프롬프트와 같은 걸음에 눈금을 적는다
-- ---------------------------------------------------------------------------
--
-- 인자 셋이 끝에 붙고 기본값은 `null` 이다. 나머지는 `20260925090000` 그대로다.

drop function if exists public.prepare_reading_job(
  uuid, text, text, text, text, jsonb, timestamptz);

create function public.prepare_reading_job(
  p_run_id uuid,
  p_prompt text,
  p_evidence text,
  p_prompt_version text,
  p_requested_model text,
  p_generation jsonb,
  p_viewed_at timestamptz,
  p_score_baseline smallint default null,
  p_score_version text default null,
  p_score_relation text default null
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.reading_job j
  set prompt = p_prompt,
      evidence = p_evidence,
      prompt_version = p_prompt_version,
      requested_model = p_requested_model,
      generation = coalesce(p_generation, '{}'::jsonb),
      viewed_at = p_viewed_at,
      score_baseline = p_score_baseline,
      score_version = p_score_version,
      score_relation = p_score_relation,
      status = 'submitting'
  where j.run_id = p_run_id
    and j.status in ('frozen', 'preparing')
    and exists (
      select 1 from public.reading_run r where r.id = j.run_id and r.status = 'running');

  return found;
end;
$$;

revoke execute on function public.prepare_reading_job(
  uuid, text, text, text, text, jsonb, timestamptz, smallint, text, text)
  from anon, public, authenticated;
grant execute on function public.prepare_reading_job(
  uuid, text, text, text, text, jsonb, timestamptz, smallint, text, text) to service_role;

-- ---------------------------------------------------------------------------
-- 3. 저장하는 문 — 얼린 작업의 눈금을 풀이로 옮긴다
-- ---------------------------------------------------------------------------
--
-- 인자는 그대로다(`create or replace` — 권한도 그대로 남는다). `20260925180000` 의 몸통에서 insert 의 세 칸과
-- 덮어쓰기 세 줄만 더했다. **다시 만든 풀이는 새 눈금으로 덮인다** — 옛 판 풀이를 새로 받으면 새 판이 된다.

create or replace function public.save_reading(
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
    source_run_id,
    score_baseline, score_version, score_relation
  )
  values (
    run.kind,
    -- 공유 결과에는 주인이 없다. 누가 눌렀든 양쪽이 같은 것을 본다.
    case when run.kind = 'match' then null else run.user_id end,
    run.match_id, run.person_a, run.person_b,
    job.chart_a, job.chart_b,
    p_output, p_score, p_metaphor, p_evidence, p_prompt, p_prompt_version, p_model,
    coalesce(p_generation, '{}'::jsonb), p_viewed_at,
    p_run_id,
    job.score_baseline, job.score_version, job.score_relation
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
      score_baseline = excluded.score_baseline,
      score_version = excluded.score_version,
      score_relation = excluded.score_relation,
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
-- 4. 읽는 문 — 끝에 세 칸
-- ---------------------------------------------------------------------------
--
-- `20261024090000` 그대로에 세 칸을 끝에 더한다. 새로 열리는 값은 없다 — 기준점은 풀이 점수의 출발점이고, 사이는
-- 이 쌍에 내가 적어 둔 값이다. 인연 궁합의 사이는 늘 `null` 이다. 반환형이 바뀌므로 지우고 다시 세운다.

drop function if exists public.my_reading(text, uuid, uuid, uuid);

create function public.my_reading(
  p_kind text, p_person_a uuid default null, p_person_b uuid default null,
  p_match_id uuid default null)
returns table(
  id uuid, kind text, score smallint, metaphor text, output text, model text,
  viewed_at timestamptz, created_at timestamptz, viewer_is_first boolean,
  from_current_chart boolean, source_run_id uuid, my_feedback jsonb,
  day_master_a text, day_master_b text,
  score_baseline smallint, score_version text, score_relation text)
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
    ),
    /* 표지의 일간 — 그 글을 만들 때의 사본. 공유 궁합은 결과 화면이 동의 당시 사본으로 따로 칠한다 */
    case when s.kind = 'match' then null else r.chart_a ->> 'dayMaster' end,
    case when s.kind = 'match' then null else r.chart_b ->> 'dayMaster' end,
    /* 그 풀이를 잰 눈금 (ADR 0113) */
    r.score_baseline, r.score_version, r.score_relation
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
