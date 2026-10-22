-- 집은 일감은 **임대**다 — 집은 시각과 임대 식별자를 남기고, 지금 쥔 작업자만 놓고 · 저장하고 · 실패로 닫는다 (ADR 0201)
--
-- ## 무엇이 틀렸나 — 2026-10-23 에 origin/main(92e4a4b8)에서 잰 값
--
-- 1. 집으면 `retrieving` 이 되는데 **집은 시각이 없다.** 회수하던 함수가 죽으면(Vercel 이 `maxDuration` 에서 끊음 · 배포 교체)
--    그 일감은 아무도 안 놓는다. `open_reading_jobs`(`20260925090000` 의 720줄)는 `retrieving` 을 8분 기한까지 건너뛰고,
--    기한 뒤 복구기(`app/api/cron/reading/route.ts` 88줄)가 결과가 provider 에 다 있어도 `model-timeout` 으로 닫는다.
-- 2. 놓기 · 저장 · 실패가 **누가 쥐었는지 안 본다.** 놓는 문(`release_reading_job`)은 시도 id 만 받는다 — 일감을 새로
--    집은 작업자가 있어도 옛 작업자의 늦은 놓기가 그 표시를 걷는다.
--
-- ## 무엇을 바꾸나
--
-- - `reading_job` 에 `lease_id`(임대 식별자 — 앱이 집을 때 짓는다) · `claimed_at`(집은 시각, DB 시계) 두 칸.
--   `claimed_at` 은 `retrieving` 일 때만 차 있고, `lease_id` 는 `retrieving` 일 때만 있을 수 있다(검사식 둘).
-- - `reading_job_lease()` — 150초. 셈은 ADR 0201: 일감 하나의 처리 상한(집기 응답 10초 + 회수 10초 × 2번 + 재시도 대기 60초 +
--   적기 두 번 — 저장 뒤 놓기나 실패 — 10초 × 2 = 110초)보다 길고, 8분 기한 안에 다시 집을 자리가 남게 짧다.
-- - `claim_reading_job(p_response_id, p_lease_id default null)` — `submitted` 와 **임대가 지난 `retrieving`** 을 집는다.
--   집으면 임대 식별자와 시각을 새로 쓴다 — 옛 작업자의 식별자는 그 순간 무효다.
-- - `release_reading_job(p_run_id, p_lease_id default null)` · `save_reading(…, p_lease_id default null)` ·
--   `fail_reading_job(…, p_lease_id default null)` — 식별자를 받으면 **그 식별자가 지금 쥔 것일 때만** 한다.
--   놓기는 못 놓았으면 `false` 를 낸다(전에는 `void`).
-- - `open_reading_jobs()` — 임대가 지난 `retrieving` 도 낸다(복구기가 다시 집도록). 기한 판정 · 닫는 코드는 그대로다.
--
-- ## 식별자 없이 부르면(`null`) — 옛 앱과 기한
--
-- 이 마이그레이션은 앱보다 먼저 오른다(`docs/ops/runbook/deploy.md` 규약 넷의 2). 옛 앱은 식별자를 모르고 집는다 —
-- 그때 `lease_id` 는 비고 `claimed_at` 만 선다. 식별자 없는 놓기 · 저장은 **식별자 없이 집힌 일감에만** 닿는다 — 새 앱이
-- 쥔 일감(식별자 있음)을 옛 앱이 건드리지 못한다. 실패로 닫기는 다르다 — 식별자 없는 `fail_reading_job` 은 기한이 닫는 길
-- (복구기 · 만료)과 제출 전 실패(`pipeline.ts`)이고 **8분 기한은 임대보다 앞선다.** 그래서 그 길은 지금 그대로 열려 있다.
--
-- ## 겹침과 정산
--
-- 저장 · 실패는 시도 행을 먼저 잠그고 일감 행을 잠근다(`for update`, 늘 이 차례). 집기 · 놓기는 일감 행만 잠근다. 그래서
-- 저장하는 동안 다른 작업자의 집기는 그 저장이 끝나기를 기다리고, 끝난 뒤에는 일감이 지워져(`reading_run_terminal_clears_job`)
-- 못 집는다. 풀이권 정산(`reading_run_settles_its_credit`)은 시도가 `running` 에서 떠날 때 한 번 — 저장은 됐는데 응답만
-- 끊겨도 두 번째 저장 · 실패는 「이미 끝난 시도」에서 서고 정산은 다시 안 돈다.
--
-- 재는 자리는 `supabase/tests/99_reading_job_lease.test.sql`.

-- ---------------------------------------------------------------------------
-- 1. 임대 두 칸
-- ---------------------------------------------------------------------------

alter table public.reading_job
  add column lease_id uuid,
  add column claimed_at timestamptz;

comment on column public.reading_job.lease_id is
  '지금 이 일감을 쥔 작업자의 임대 식별자 — 앱이 집을 때 짓는다. 다시 집히면 바뀐다(ADR 0201)';
comment on column public.reading_job.claimed_at is
  '집은 시각(DB 시계) — reading_job_lease() 가 지나면 다른 작업자가 다시 집는다(ADR 0201)';

/**
 * **지금 `retrieving` 인 일감은 이 순간 집힌 것으로 친다.** 그 작업자가 살아 있으면 임대 안에 끝내고, 죽었으면 임대가 지난 뒤
 * 복구기가 다시 집는다 — 8분 기한까지 갇혀 있던 일감이 여기서 풀린다.
 */
update public.reading_job set claimed_at = now() where status = 'retrieving';

alter table public.reading_job
  add constraint the_claim_time_marks_the_claim check ((status = 'retrieving') = (claimed_at is not null)),
  add constraint the_lease_lives_only_while_claimed check (lease_id is null or status = 'retrieving');

/** 임대 시간 — 150초(ADR 0201). 일감 하나의 처리 상한 110초 < 150초 < 8분 기한. 앱의 `READING_JOB_LEASE_MS` 와 같은 값이다 */
create function public.reading_job_lease()
returns interval
language sql
immutable
set search_path = ''
as $$ select interval '150 seconds' $$;

revoke execute on function public.reading_job_lease() from anon, public, authenticated, service_role;

-- ---------------------------------------------------------------------------
-- 2. 집기 — 임대가 지난 것도 집는다
-- ---------------------------------------------------------------------------

drop function public.claim_reading_job(text);

create function public.claim_reading_job(p_response_id text, p_lease_id uuid default null)
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
  set status = 'retrieving', lease_id = p_lease_id, claimed_at = now()
  where j.response_id = p_response_id
    and (j.status = 'submitted'
         or (j.status = 'retrieving' and j.claimed_at <= now() - public.reading_job_lease()))
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

revoke execute on function public.claim_reading_job(text, uuid) from anon, public, authenticated;
grant execute on function public.claim_reading_job(text, uuid) to service_role;

-- ---------------------------------------------------------------------------
-- 3. 놓기 — 쥔 작업자만, 놓았는지 답한다
-- ---------------------------------------------------------------------------

drop function public.release_reading_job(uuid);

create function public.release_reading_job(p_run_id uuid, p_lease_id uuid default null)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.reading_job j
  set status = 'submitted', lease_id = null, claimed_at = null
  where j.run_id = p_run_id
    and j.status = 'retrieving'
    and j.lease_id is not distinct from p_lease_id;

  return found;
end;
$$;

revoke execute on function public.release_reading_job(uuid, uuid) from anon, public, authenticated;
grant execute on function public.release_reading_job(uuid, uuid) to service_role;

-- ---------------------------------------------------------------------------
-- 4. 실패로 닫기 — 식별자를 받으면 쥔 작업자만
-- ---------------------------------------------------------------------------

drop function public.fail_reading_job(uuid, text, text, jsonb);

create function public.fail_reading_job(
  p_run_id uuid,
  p_failure_code text,
  p_failure_detail text default null,
  p_usage jsonb default null,
  p_lease_id uuid default null
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  failed public.reading_run;
begin
  /**
   * **회수하던 작업자가 닫는 길**이면 지금 쥔 것인지 본다 — 시도 행을 먼저, 일감 행을 다음에 잠근다(저장과 같은 차례).
   * 식별자 없는 길(기한 · 제출 전 실패)은 묻지 않는다 — 8분 기한은 임대보다 앞선다.
   */
  if p_lease_id is not null then
    perform 1 from public.reading_run r where r.id = p_run_id for update;
    perform 1 from public.reading_job j
    where j.run_id = p_run_id and j.status = 'retrieving' and j.lease_id = p_lease_id
    for update;
    if not found then
      return false;
    end if;
  end if;

  update public.reading_run r
  set status = 'failed',
      failure_code = p_failure_code,
      failure_detail = left(p_failure_detail, 500),
      usage = coalesce(p_usage, r.usage),
      finished_at = now()
  where r.id = p_run_id
    and r.status = 'running'
  returning r.* into failed;

  if not found then
    return false;
  end if;

  insert into public.notification (user_id, kind, run_id, match_id)
  values (failed.user_id, 'reading_failed', failed.id, failed.match_id);

  return true;
end;
$$;

revoke execute on function public.fail_reading_job(uuid, text, text, jsonb, uuid) from anon, public, authenticated;
grant execute on function public.fail_reading_job(uuid, text, text, jsonb, uuid) to service_role;

-- ---------------------------------------------------------------------------
-- 5. 저장 — 식별자를 받으면 쥔 작업자만. 나머지는 `20261126090000` 그대로
-- ---------------------------------------------------------------------------

drop function public.save_reading(
  uuid, text, smallint, text, text, text, text, text, jsonb, timestamptz);

create function public.save_reading(
  p_run_id uuid, p_output text, p_score smallint, p_metaphor text, p_evidence text,
  p_prompt text, p_prompt_version text, p_model text, p_generation jsonb,
  p_viewed_at timestamptz, p_lease_id uuid default null)
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
   *
   * **일감 행도 잠근다**(ADR 0201) — 저장이 끝날 때까지 다른 작업자가 이 일감을 다시 집지 못한다.
   */
  select * into job from public.reading_job j where j.run_id = p_run_id for update;

  if not found then
    raise exception '얼린 계산 입력을 찾지 못했습니다.' using errcode = 'no_data_found';
  end if;

  /**
   * **지금 쥔 작업자만 저장한다**(ADR 0201). 임대가 지나 다른 작업자가 다시 집었으면 옛 작업자의 늦은 결과는 여기서 선다.
   * 식별자 없는 저장(옛 앱)은 식별자 없이 집힌 일감에만 닿는다.
   */
  if job.lease_id is distinct from p_lease_id then
    raise exception '이 일감을 지금 쥔 작업자가 아니라 저장하지 않았습니다.'
      using errcode = 'check_violation';
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

revoke execute on function public.save_reading(
  uuid, text, smallint, text, text, text, text, text, jsonb, timestamptz, uuid) from anon, public, authenticated;
grant execute on function public.save_reading(
  uuid, text, smallint, text, text, text, text, text, jsonb, timestamptz, uuid) to service_role;

-- ---------------------------------------------------------------------------
-- 6. 복구기 — 임대가 지난 `retrieving` 도 낸다
-- ---------------------------------------------------------------------------

/**
 * 손볼 일감을 낸다. 바뀐 것은 거르는 조건 하나 — 집힌 일감도 **임대가 지났으면** 낸다. 복구기는 그것을 회수로 보내고,
 * 회수가 다시 집는다(`claim_reading_job`). 기한(`overdue`)과 닫는 코드는 `20260925090000` 그대로다 — 기한이 지났으면
 * 임대와 상관없이 닫는다.
 */
create or replace function public.open_reading_jobs()
returns table (run_id uuid, response_id text, overdue boolean, failure_code text)
language sql
stable
security definer
set search_path = ''
as $$
  select
    j.run_id,
    j.response_id,
    j.created_at <= now() - case when j.status in ('frozen', 'preparing')
      then public.reading_job_prepare_deadline()
      else public.reading_job_deadline() end,
    case when j.status in ('frozen', 'preparing') then 'prepare-timeout' else 'model-timeout' end
  from public.reading_job j
  join public.reading_run r on r.id = j.run_id
  where r.status = 'running'
    and (j.status <> 'retrieving'
         or j.claimed_at <= now() - public.reading_job_lease()
         or j.created_at <= now() - public.reading_job_deadline())
  order by j.created_at;
$$;
