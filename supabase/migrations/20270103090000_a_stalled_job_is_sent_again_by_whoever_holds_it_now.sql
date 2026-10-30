-- 제출 전에 멈춘 일감은 복구기가 다시 보낸다 — 지금 쥔 작업자만 제출 직전 문을 지난다 (ADR 0210)
--
-- ## 무엇이 틀렸나 — 2026-10-30 에 origin/main(7f9f803d)에서 잰 값
--
-- 1. 제출은 응답 뒤(`after`) 한 번뿐이다(`app/me/reading/pipeline.ts`). 그 콜백이 안 돌거나 제출 전에 죽으면 일감은 `frozen` ·
--    `preparing` 에 남고, 복구기는 다시 보내지 않고 2분 기한(`reading_job_prepare_deadline()`)에 `prepare-timeout` 으로 닫는다.
-- 2. `preparing` 에는 집은 시각이 없어, 그 작업자가 죽었는지 느린지 가를 수 없다.
--
-- ## 무엇을 바꾸나
--
-- - `lease_id` · `claimed_at` 이 `preparing` 에도 선다 — 회수의 임대(ADR 0201)와 같은 두 칸이다. 제출 직전 문이 둘을 비운다.
-- - `reading_job_send_patience()` — 30초. `frozen` 은 시도를 연 뒤, `preparing` 은 집은 뒤 이만큼 지나면 멈춘 것으로 친다.
-- - `reading_job_resendable(...)` — 다시 보내도 되는가의 판정 하나. `open_reading_jobs()` 의 `resendable` 칸과 다시 집는 문이 함께 읽는다.
-- - `retake_stalled_reading_job(시도, 임대)` — 복구기의 집기. 얼린 입력과 **이어진 맛보기의 스냅숏**을 함께 낸다 — 첫 작업자의
--   메모리에 있던 값이라 복구기는 DB 에서 읽어야 한다.
-- - `take_reading_job` · `match_run_awaiting_send` 가 임대 식별자를 받고, `prepare_reading_job` 은 **지금 쥔 식별자일 때만** 지난다.
-- - `fail_reading_job` 의 식별자 검사가 `preparing` 도 본다 — 임대를 잃은 옛 작업자의 늦은 실패가 새 작업자의 시도를 닫지 못한다.
--
-- ## 다시 보내지 않는 것
--
-- - **`submitting` 이후** — 제출 직전 문을 지났으면 provider 가 받았을 수 있다. 이름표가 없어도 다시 안 보낸다(ADR 0197).
-- - **이어야 할 맛보기가 아직 안 이어진 자기 풀이** — 이 회원에게 귀속된 세션이 어느 시도에도 안 이어졌거나 이어진 시도가 실패했으면,
--   죽은 누름이 그 세션을 이으려던 것일 수 있다. 보통 풀이로 보내면 풀이권이 이어쓰기 없는 글에 조용히 쓰인다(ADR 0143) — 지금처럼
--   기한에 닫는다. 표가 없는 회원의 보통 풀이도 여기 걸리면 닫힌다 — 다시 누르면 된다.
-- - **이 시도에 이어진 세션의 스냅숏이 없을 때** — 같은 까닭이다.
--
-- ## 옛 앱과 차례
--
-- 이 마이그레이션은 앱보다 먼저 오른다(`docs/ops/runbook/deploy.md` 규약 넷의 2). 옛 앱은 식별자 없이 집고 제출 직전 문을 부른다 —
-- 빈 식별자끼리 맞아 지난다. 복구기가 그 일감을 다시 집었으면 식별자가 달라 옛 작업자는 멈춘다. 옛 복구기는 새 칸을 안 읽어 지금처럼
-- 기한에 닫는다.
--
-- 재는 자리는 `supabase/tests/99_reading_job_resend.test.sql`.

-- ---------------------------------------------------------------------------
-- 1. 임대 두 칸이 `preparing` 에도 선다
-- ---------------------------------------------------------------------------

alter table public.reading_job
  drop constraint the_claim_time_marks_the_claim,
  drop constraint the_lease_lives_only_while_claimed;

/** 지금 `preparing` 인 일감은 이 순간 집힌 것으로 친다 — 산 작업자면 곧 지나가고, 죽었으면 인내가 지난 뒤 복구기가 다시 집는다 */
update public.reading_job set claimed_at = now() where status = 'preparing';

alter table public.reading_job
  add constraint the_claim_time_marks_the_claim check ((status in ('preparing', 'retrieving')) = (claimed_at is not null)),
  add constraint the_lease_lives_only_while_claimed check (lease_id is null or status in ('preparing', 'retrieving'));

comment on column public.reading_job.lease_id is
  '지금 이 일감을 쥔 작업자의 임대 식별자 — 앱이 집을 때 짓는다. 다시 집히면 바뀐다(ADR 0201 · ADR 0210)';
comment on column public.reading_job.claimed_at is
  '집은 시각(DB 시계) — 제출 전(`preparing`)은 reading_job_send_patience(), 회수(`retrieving`)는 reading_job_lease() 가 지나면 다시 집힌다';

/** 제출 전 일감을 기다리는 시간 — 30초(ADR 0210). 복구기 한 바퀴 1분을 더해도 2분 기한 안에 다시 집을 자리가 남는다 */
create function public.reading_job_send_patience()
returns interval
language sql
immutable
set search_path = ''
as $$ select interval '30 seconds' $$;

revoke execute on function public.reading_job_send_patience() from anon, public, authenticated, service_role;

-- ---------------------------------------------------------------------------
-- 2. 다시 보내도 되는가 — 판정은 여기 하나다
-- ---------------------------------------------------------------------------

create function public.reading_job_resendable(p_job public.reading_job, p_run public.reading_run)
returns boolean
language sql
stable
set search_path = ''
as $$
  select
    p_run.status = 'running'
    and p_job.created_at > now() - public.reading_job_prepare_deadline()
    and coalesce(
      case p_job.status
        when 'frozen' then p_job.created_at
        when 'preparing' then p_job.claimed_at
      end <= now() - public.reading_job_send_patience(),
      false)
    and not (
      p_run.kind = 'self'
      and exists (
        select 1
        from public.taste_session s
        left join public.reading_run linked on linked.id = s.reading_run_id
        where s.claimed_by = p_run.user_id
          and s.status = 'claimed'
          and (
            (s.reading_run_id = p_run.id and s.snapshot_at is null)
            or s.reading_run_id is null
            or (s.reading_run_id <> p_run.id and linked.status = 'failed'))));
$$;

revoke execute on function public.reading_job_resendable(public.reading_job, public.reading_run)
  from anon, public, authenticated, service_role;

drop function public.open_reading_jobs();

create function public.open_reading_jobs()
returns table (run_id uuid, response_id text, overdue boolean, failure_code text, resendable boolean)
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
    case when j.status in ('frozen', 'preparing') then 'prepare-timeout' else 'model-timeout' end,
    public.reading_job_resendable(j, r)
  from public.reading_job j
  join public.reading_run r on r.id = j.run_id
  where r.status = 'running'
    and (j.status <> 'retrieving'
         or j.claimed_at <= now() - public.reading_job_lease()
         or j.created_at <= now() - public.reading_job_deadline())
  order by j.created_at;
$$;

revoke execute on function public.open_reading_jobs() from anon, public, authenticated;
grant execute on function public.open_reading_jobs() to service_role;

-- ---------------------------------------------------------------------------
-- 3. 복구기의 집기 — 식별자를 새로 쓰고, 이어진 맛보기를 함께 낸다
-- ---------------------------------------------------------------------------

create function public.retake_stalled_reading_job(p_run_id uuid, p_lease_id uuid)
returns table(
  run_id uuid, kind text, birth_a jsonb, birth_b jsonb, about jsonb,
  preview_markdown text, continuation_question text, answer_direction text, supporting_claims text[])
language plpgsql
security definer
set search_path = ''
as $$
declare
  stalled_run public.reading_run;
  stalled_job public.reading_job;
begin
  if p_lease_id is null then
    return;
  end if;

  /* 시도 행을 먼저, 일감 행을 다음에 잠근다 — 닫는 쪽 · 저장과 같은 차례다 */
  select * into stalled_run from public.reading_run r where r.id = p_run_id for update;
  if not found or stalled_run.created_at <= now() - public.reading_run_timeout() then
    return;
  end if;

  select * into stalled_job from public.reading_job j where j.run_id = p_run_id for update;
  if not found or not public.reading_job_resendable(stalled_job, stalled_run) then
    return;
  end if;

  update public.reading_job j
  set status = 'preparing', lease_id = p_lease_id, claimed_at = now()
  where j.run_id = p_run_id;

  return query
    select stalled_job.run_id, stalled_run.kind::text, stalled_job.birth_a, stalled_job.birth_b, stalled_job.about,
           s.preview_markdown, s.continuation_question, s.answer_direction, s.supporting_claims
    from (select 1) one
    left join public.taste_session s
      on s.reading_run_id = p_run_id
     and s.claimed_by = stalled_run.user_id
     and s.status = 'claimed'
     and s.snapshot_at is not null;
end;
$$;

revoke execute on function public.retake_stalled_reading_job(uuid, uuid) from anon, public, authenticated;
grant execute on function public.retake_stalled_reading_job(uuid, uuid) to service_role;

-- ---------------------------------------------------------------------------
-- 4. 첫 작업자의 집기 — 식별자를 받는다
-- ---------------------------------------------------------------------------

drop function public.take_reading_job(uuid);

create function public.take_reading_job(p_run_id uuid, p_lease_id uuid default null)
returns table(
  run_id uuid, kind text, person_a uuid, person_b uuid, match_id uuid,
  birth_a jsonb, birth_b jsonb, about jsonb)
language sql
security definer
set search_path = ''
as $$
  with taken as (
    update public.reading_job j
    set status = 'preparing', lease_id = p_lease_id, claimed_at = now()
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

revoke execute on function public.take_reading_job(uuid, uuid) from anon, public, authenticated;
grant execute on function public.take_reading_job(uuid, uuid) to service_role;

drop function public.match_run_awaiting_send(uuid);

create function public.match_run_awaiting_send(p_request_id uuid, p_lease_id uuid default null)
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
    set status = 'preparing', lease_id = p_lease_id, claimed_at = now()
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

revoke execute on function public.match_run_awaiting_send(uuid, uuid) from anon, public, authenticated;
grant execute on function public.match_run_awaiting_send(uuid, uuid) to service_role;

-- ---------------------------------------------------------------------------
-- 5. 제출 직전 문 — 지금 쥔 작업자만 지난다
-- ---------------------------------------------------------------------------

drop function public.prepare_reading_job(uuid, text, text, text, text, jsonb, timestamptz, smallint, text, text);

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
  p_score_relation text default null,
  p_lease_id uuid default null
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
begin
  /*
    시도 행을 먼저 잠근다 — 닫는 쪽(`fail_reading_job` · 만료)은 시도 행 → (트리거로) 작업 행 차례다. 이 문이 작업 행 → 시도 행
    차례로 잡으면 둘이 엇갈려 교착할 수 있다. 같은 차례로 맞춘다.
  */
  perform 1 from public.reading_run r where r.id = p_run_id for update;

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
      status = 'submitting',
      lease_id = null,
      claimed_at = null
  where j.run_id = p_run_id
    and j.status in ('frozen', 'preparing')
    /* 다시 집혔으면 식별자가 바뀌었다 — 옛 작업자는 여기서 멈추고 모델을 안 부른다(ADR 0210) */
    and j.lease_id is not distinct from p_lease_id
    and exists (
      select 1 from public.reading_run r where r.id = j.run_id and r.status = 'running');

  if not found then
    return false;
  end if;

  /* 이 문 뒤에서만 모델에 보낸다 — 하루 상한이 이 표시를 센다(ADR 0198) */
  update public.reading_run r
  set prepared_at = coalesce(r.prepared_at, now())
  where r.id = p_run_id;

  return true;
end;
$$;

revoke execute on function public.prepare_reading_job(
  uuid, text, text, text, text, jsonb, timestamptz, smallint, text, text, uuid)
  from anon, public, authenticated;
grant execute on function public.prepare_reading_job(
  uuid, text, text, text, text, jsonb, timestamptz, smallint, text, text, uuid) to service_role;

-- ---------------------------------------------------------------------------
-- 6. 실패 닫기 — 식별자를 든 부름은 `preparing` 에서도 지금 쥔 것인지 본다
-- ---------------------------------------------------------------------------

create or replace function public.fail_reading_job(
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
   * **쥔 작업자가 닫는 길**이면 지금 쥔 것인지 본다 — 시도 행을 먼저, 일감 행을 다음에 잠근다(저장과 같은 차례).
   * 식별자 없는 길(기한 · 제출 뒤 실패)은 묻지 않는다 — 기한은 임대보다 앞서고, 제출 직전 문을 지난 작업자는 하나뿐이다.
   */
  if p_lease_id is not null then
    perform 1 from public.reading_run r where r.id = p_run_id for update;
    perform 1 from public.reading_job j
    where j.run_id = p_run_id and j.status in ('preparing', 'retrieving') and j.lease_id = p_lease_id
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
