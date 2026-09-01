-- ---------------------------------------------------------------------------
-- 영수증을 먼저 적고 일은 나중에 한다 (ADR 0020)
-- ---------------------------------------------------------------------------

/**
 * webhook 이 하는 일은 **받았다는 사실을 적는 것까지**다.
 *
 * 몇 초 안에 2xx 가 없으면 provider 는 최대 72시간 같은 사건을 다시 보낸다. 회수·검사·
 * 저장을 응답 전에 하면 그 시간이 길어질수록 재전송이 늘고, 늘어난 재전송이 다시 같은
 * 일을 시킨다 — **스스로 커지는 고리**다.
 *
 * 그래서 문을 둘로 연다. 하나는 도착을 적고, 하나는 그 뒤에 일감을 집는다.
 */

-- ---------------------------------------------------------------------------
-- 도착을 적는다
-- ---------------------------------------------------------------------------

/**
 * @returns 이번에 처음 적었으면 `true`. 이미 있던 사건이면 `false`.
 *
 * **예외를 내지 않는다.** 재전송은 정상이고, 두 번째 호출에서 예외를 내면 provider 가
 * 2xx 를 못 받아 또 보낸다. 「이미 있다」는 실패가 아니라 사실이므로 값으로 낸다.
 */
create or replace function public.record_reading_webhook_event(
  p_event_id text,
  p_response_id text,
  p_event_type text
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.reading_webhook_event (event_id, response_id, event_type)
  values (p_event_id, p_response_id, p_event_type)
  on conflict (event_id) do nothing;

  return found;
end;
$$;

revoke execute on function public.record_reading_webhook_event(text, text, text)
  from anon, public, authenticated;
grant execute on function public.record_reading_webhook_event(text, text, text) to service_role;

-- ---------------------------------------------------------------------------
-- 일감을 집는다 — **얼린 입력과 붙들어 둔 판본을 함께**
-- ---------------------------------------------------------------------------

/**
 * 판본 하나를 화면이 읽는 것과 **같은 열들**로 낸다.
 *
 * 열 이름을 여기서 새로 짓지 않는다. 받는 쪽(`StoredRevision`)이 이미 그 이름들을 알고
 * 있고, 다른 이름으로 내면 그 자리에서 옮겨 적는 코드가 생긴다 — 옮겨 적는 자리가
 * 생기면 언젠가 한 칸이 틀린다.
 */
create or replace function public.revision_birth(p_revision uuid)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select case when p_revision is null then null else (
    select jsonb_build_object(
      'calendar', r.calendar,
      'original_date', r.original_date,
      'solar_date', r.solar_date,
      'birth_time', r.birth_time,
      'gender', r.gender,
      'city', r.city,
      'late_night_rule', r.late_night_rule,
      'time_basis', r.time_basis)
    from public.person_chart_revision r where r.id = p_revision
  ) end;
$$;

/** 안에서만 쓴다 — 판본 원문을 내주는 문을 밖에 열지 않는다 */
revoke execute on function public.revision_birth(uuid)
  from anon, public, authenticated, service_role;

/**
 * 회수하는 쪽이 필요로 하는 것을 한 번에 낸다.
 *
 * 판본을 **행째로** 낸다. 검사(`checkReading`)가 출생 원문을 알아야 유출을 재는데,
 * webhook 에는 사용자 세션이 없어 RLS 로는 그 행에 닿을 수 없다. 붙들어 둔 이유가 여기서
 * 값을 낸다 — 그 사이 사용자가 입력을 고쳐도 **만든 것과 검사하는 것이 같은 입력**이다.
 *
 * ## 집으면 표시한다
 *
 * `retrieving` 으로 옮기고 낸다. 복구기가 1분마다 도는데 표시를 안 하면 같은 일감을
 * 두 번 집어 모델을 두 번 회수하고 저장을 두 번 시도한다. 저장 쪽이 막아 주기는 하지만
 * (`status <> 'running'`), 막히는 것에 기대는 것과 안 겹치게 하는 것은 다르다.
 *
 * @returns 집을 것이 없으면 0행 — 이미 누가 집었거나 끝난 시도다.
 */
create or replace function public.claim_reading_job(p_response_id text)
returns table (
  run_id uuid,
  kind text,
  revision_a uuid,
  revision_b uuid,
  prompt text,
  evidence text,
  prompt_version text,
  requested_model text,
  generation jsonb,
  viewed_at timestamptz,
  birth_a jsonb,
  birth_b jsonb
)
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
    and j.status <> 'retrieving'
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
    claimed.revision_a,
    claimed.revision_b,
    claimed.prompt,
    claimed.evidence,
    claimed.prompt_version,
    claimed.requested_model,
    claimed.generation,
    claimed.viewed_at,
    public.revision_birth(claimed.revision_a),
    public.revision_birth(claimed.revision_b);
end;
$$;

revoke execute on function public.claim_reading_job(text) from anon, public, authenticated;
grant execute on function public.claim_reading_job(text) to service_role;

-- ---------------------------------------------------------------------------
-- 집었는데 아직이면 놓는다
-- ---------------------------------------------------------------------------

/**
 * **되돌려 놓지 않으면 그 일감은 영영 안 집힌다.**
 *
 * 집으면서 `retrieving` 으로 표시하는데, 회수해 보니 아직 도는 중일 수 있다
 * (`queued`·`in_progress`). 그때 표시를 그대로 두면 복구기가 다음 바퀴에 그 일감을
 * 건너뛴다 — 표시는 「누가 보고 있다」는 뜻이지 「끝났다」가 아니다.
 *
 * 끝난 시도의 일감은 안 건드린다. 그 사이 성공이나 실패로 닫혔으면 트리거가 이미
 * 치웠고, 여기서 되살릴 것이 없다.
 */
create or replace function public.release_reading_job(p_run_id uuid)
returns void
language sql
security definer
set search_path = ''
as $$
  update public.reading_job j
  set status = 'submitted'
  where j.run_id = p_run_id and j.status = 'retrieving';
$$;

revoke execute on function public.release_reading_job(uuid) from anon, public, authenticated;
grant execute on function public.release_reading_job(uuid) to service_role;
