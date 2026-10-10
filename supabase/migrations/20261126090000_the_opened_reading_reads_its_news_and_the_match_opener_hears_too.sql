-- 결과 화면을 열면 그 풀이의 완성 소식이 읽음이 되고, 인연 궁합을 연 쪽에도 완성 소식이 선다 (ADR 0157 「2026-10-10 덧」)
--
-- 운영자 결정(2026-10-10) 둘이다.
--
-- 1. **결과 화면을 열면 그 풀이의 「다 됐어요」 소식을 읽음으로 바꾼다** — 그 풀이의 완성 소식만이고, 다른 소식은 건드리지 않는다.
--    읽음으로 바꾸는 문 `mark_reading_ready_read(p_reading_id)` 가 새로 선다. 결과 화면이 그 글을 보인 뒤에 브라우저에서 부른다
--    (`app/me/reading/news-read.ts`) — 서버가 그리는 자리에서 부르면 링크의 미리 가져오기만으로도 읽은 셈이 된다.
-- 2. **인연 궁합을 연 쪽에도 완성 소식이 선다** — 내 사주 · 저장한 사람 · 궁합풀이와 같은 규칙이다. 상대에게 서던 것은 그대로다.
--    두 줄 다 Match 를 가리킨다(`match_id`) — 같은 사건이 두 사람에게 같은 모양으로 서고, 문장은 읽는 사람의 상대를 부른다
--    (「{닉네임} 님과의 인연 궁합이 완성됐어요」, 이미 쓰던 확정 문구).
--
-- ## 올리는 차례 — 앱보다 먼저다(넓히기)
--
-- 새 문이 하나 서고 `save_reading` 은 몸만 바뀐다(인자 · 반환형 그대로, `create or replace` — 권한도 그대로다). 지금 나가 있는 앱은
-- 새 문을 안 부르고, 연 쪽의 인연 궁합 완성 소식을 상대의 것과 같은 문장 · 같은 링크로 그린다(`notificationText` ·
-- `destinationFor` 는 Match 를 가리키는 완성 소식을 누가 받든 같게 읽는다). 이 PR 의 앱은 새 문을 부르므로 이 파일이 먼저 올라야
-- 한다 — 없으면 결과 화면의 읽음 처리만 실패하고(부속이라 화면은 그대로 선다) 소식은 안 읽은 채 남는다.
--
-- 재는 자리는 `supabase/tests/87_reading_ready_read_on_open.test.sql`(1)과 `supabase/tests/13_reading.test.sql`(2).

-- ---------------------------------------------------------------------------
-- 1. 결과 화면을 열면 그 풀이의 완성 소식이 읽음이 된다
-- ---------------------------------------------------------------------------

/**
 * 이 풀이(`reading.id`)의 **완성 소식 가운데 내 것 · 안 읽은 것**만 읽음으로 바꾼다 — 바꾼 수를 낸다.
 *
 * **「그 풀이의 소식」은 대상으로 찾는다.** 풀이 행은 대상마다 하나이고 다시 받아도 같은 행이 덮인다(`target_key`) — 그래서 같은
 * 대상의 앞선 시도가 세운 완성 소식도 지금 보는 이 글의 소식이다. 인연 궁합은 Match 가 곧 대상이고(`match_id`), 내가 주인인 셋은
 * 소식이 가리키는 시도의 대상(kind · 두 사람 · 연 사람)이 이 풀이와 같은가로 본다.
 *
 * **남의 소식은 못 바꾼다.** 바꾸는 줄은 `visible_notifications()` 안의 것뿐이다 — 내 소식이고, 지금 보이는 것이다. 남의 풀이
 * id 를 주면 그 대상의 연 사람이 남이라 내 소식 중 맞는 것이 없다(0). 보이지 않는 소식을 읽음으로 바꾸지 않는 까닭은
 * `mark_notifications_read` 와 같다 — 제재가 풀렸을 때 본 적 없는 소식이 읽은 것으로 뜬다.
 *
 * **여러 번 불러도 한 번이다.** 안 읽은 줄만 바꾸므로 두 번째부터는 0 이고 읽은 시각도 그대로다. 바뀐 줄이 없으면 계정 채널에도
 * 아무것도 안 간다(`notification_read_tells_its_owner` 는 바뀐 줄의 주인에게만 알린다).
 *
 * 없는 풀이 · 로그인 없음은 0 이다 — 읽음으로 바꿀 것이 없는 것과 같은 답이다.
 */
create function public.mark_reading_ready_read(p_reading_id uuid)
returns integer
language sql
volatile
security definer
set search_path = ''
as $$
  with opened as (
    select r.kind, r.owner_user_id, r.match_id, r.person_a, r.person_b
    from public.reading r
    where r.id = p_reading_id
  ),
  told as (
    select v.id
    from public.visible_notifications() v
    cross join opened o
    left join public.reading_run run on run.id = v.run_id
    where v.kind = 'reading_ready'
      and v.read_at is null
      and case
        when o.kind = 'match' then v.match_id = o.match_id
        else run.kind = o.kind
          and run.user_id = o.owner_user_id
          and run.person_a = o.person_a
          and run.person_b is not distinct from o.person_b
      end
  ),
  marked as (
    update public.notification n
    set read_at = now()
    where n.id in (select t.id from told t)
      and n.read_at is null
    returning 1
  )
  select count(*)::int from marked;
$$;

revoke execute on function public.mark_reading_ready_read(uuid) from anon, public;
grant execute on function public.mark_reading_ready_read(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- 2. 인연 궁합을 연 쪽에도 완성 소식이 선다
-- ---------------------------------------------------------------------------

/**
 * 몸통은 `20261124090000_the_reading_that_is_made_is_told_to_its_owner.sql` 의 정의 그대로에 인연 궁합 갈래의 소식만 두 줄이 됐다.
 */
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

    /* 두 사람 다 — 시도를 연 쪽(청한 사람)과 그 상대. 같은 Match 를 가리켜 문장은 읽는 사람의 상대를 부른다 */
    insert into public.notification (user_id, kind, match_id)
    values (partner, 'reading_ready', run.match_id),
           (run.user_id, 'reading_ready', run.match_id);
  else
    /* 내가 주인인 셋 — 다 되면 연 사람에게 선다. 차단 · 정지는 위의 `reading_scope_for` 가 이미 걸렀다 */
    insert into public.notification (user_id, kind, run_id)
    values (run.user_id, 'reading_ready', run.id);
  end if;

  return reading_id;
end;
$$;
