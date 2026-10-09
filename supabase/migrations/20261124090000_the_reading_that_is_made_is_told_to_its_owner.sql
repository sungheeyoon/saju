-- 다 만든 풀이는 연 사람에게 소식으로 선다 — 내 사주 · 저장한 사람 · 궁합풀이 (ADR 0157)
--
-- 운영자 지시(2026-10-09): 「끝나면 알림에 띄워야 한다.」 지금까지 `reading_ready` 는 인연 궁합의 **상대**에게만 섰다 —
-- 「누른 사람은 결과를 그 자리에서 본다」가 그 까닭이었다(`src/lib/consent` 의 `NOTIFICATION_KINDS`). 만드는 일이 누름에서
-- 떨어져 나간 뒤로(ADR 0016) 그 전제는 실패 쪽에서 먼저 무너졌고(`20260831090000_reading_failure_is_told.sql` — 「모를 때는
-- 말하는 쪽으로 눕힌다」), 이제 성공 쪽도 같다. 몇 분짜리 일 앞에서 다른 화면으로 가는 것은 우리가 그러라고 만든 것이다
-- (「이 화면을 벗어나도 풀이는 계속 만들어져요」).
--
-- **인연 궁합은 그대로다.** 연 쪽에는 서지 않고 상대에게 선다 — 그 풀이는 동의가 열고 연 쪽은 스스로 누르지 않는다(ADR 0038).
-- 연 쪽에도 세울지는 이 파일이 정하지 않는다(간극 대장 G-81).
--
-- 소식은 **시도를 가리킨다**(`run_id`) — 실패 소식과 같은 길이다. 대상(kind · 두 사람)은 시도 행이 들고, 시도가 지워지면 소식도
-- 함께 간다(FK `on delete cascade`).
--
-- ## 올리는 차례 — 앱이 먼저다
--
-- 옛 앱은 `reading_ready` 를 kind 와 상관없이 「인연 궁합이 완성됐어요」로 읽는다. 이 파일이 앱보다 먼저 오르면 내 사주가 다 된
-- 사람에게 그 문장이 선다. 그래서 **ADR 0157 의 앱이 나간 뒤에** 올린다. 새 앱은 이 파일이 없어도 그대로 돈다 — 그때는 완성
-- 소식이 안 설 뿐이다. 인자도 반환형도 안 바뀐다(`create or replace` — 권한도 그대로다).
--
-- 몸통은 `20261025150000_the_reading_keeps_the_scale_it_was_scored_on.sql` 의 정의 그대로에 끝의 `else` 갈래만 더했다.
--
-- 재는 자리는 `supabase/tests/85_reading_ready_for_owner.test.sql`.

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
  else
    /* 내가 주인인 셋 — 다 되면 연 사람에게 선다. 차단 · 정지는 위의 `reading_scope_for` 가 이미 걸렀다 */
    insert into public.notification (user_id, kind, run_id)
    values (run.user_id, 'reading_ready', run.id);
  end if;

  return reading_id;
end;
$$;
