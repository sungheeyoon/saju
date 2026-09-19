-- 시도를 여는 그 트랜잭션이 생성 입력을 얼린다 (ADR 0071 · #66)
--
-- 오늘은 `start_reading_run` 이 시도를 열고, 응답이 나간 **뒤** `after` 안에서
-- `freeze_reading_job` 이 입력을 얼린다. 그 틈에 사용자가 입력을 고치면 **동의한 것과
-- 계산한 것이 갈린다.** 지금은 판본 id 가 그 틈을 덮고 있는데, 판본을 지우면 덮개도
-- 함께 사라지므로 **틈 자체를 없앤다.**
--
-- ## 무엇이 막고 있었나 — 재어 둔 셋
--
-- 1. `reading_job` 의 여섯 열이 `not null` 이라 **입력만 든 행을 넣을 수 없다.**
-- 2. `open_reading_jobs` 가 기한이 지난 것을 `model-timeout` 으로 닫는다 — **모델을 부른
--    적도 없이** 그 코드로 닫히게 된다.
-- 3. `match_run_awaiting_send` 가 **job 행이 없는** run 만 고른다. 수락이 job 을 먼저
--    넣으면 제출이 영영 안 일어난다.
--
-- 셋을 여기서 함께 푼다.
--
-- ## 상태가 둘 늘었다
--
--   frozen → preparing → submitting → submitted → retrieving
--
-- `frozen` 은 **입력은 얼었고 아직 아무것도 안 지었다**, `preparing` 은 **Node 가 그것을
-- 집었다**. 둘 다 프롬프트·근거·모델 설정이 비어 있고, `submitting` 부터 차 있다 —
-- 검사식이 그 둘을 묶는다.
--
-- 이름을 둘로 가르는 까닭은 **집는 일이 원자적이어야** 하기 때문이다. 조회와 전이가
-- 갈리면 두 프로세스가 같은 job 을 들고 두 번 제출한다.
--
-- ## 넓히기만 한다
--
-- 옛 `freeze_reading_job`(아홉 인자)과 옛 `save_reading`(열두 인자)을 **안 지운다.** 옛
-- 앱이 그대로 도는 동안 창이 안 생겨야 한다 — 좁히는 일은 #70 이 한다.

-- ---------------------------------------------------------------------------
-- 1. 얼린 입력이 값으로 앉는다
-- ---------------------------------------------------------------------------

/**
 * **판본 id 가 아니라 입력 그 자체를 든다.**
 *
 * 근거에는 대운·신살이 들어가고 그것은 경도·시간 기준·성별이 있어야 나온다. 그래서
 * **작업에는 입력 전체가** 간다 — Match 가 여덟 글자만 드는 것과 수명도 범위도 다르다
 * (ADR 0071).
 *
 * 열 이름은 `revision_birth` 가 이미 내주는 모양 그대로다. 받는 쪽(`StoredRevision`)이
 * 그 이름들을 알고 있고, 다른 이름으로 내면 옮겨 적는 자리가 생긴다.
 */
alter table public.reading_job
  add column birth_a jsonb,
  add column birth_b jsonb,
  add column about jsonb;

comment on column public.reading_job.birth_a is
  '얼린 계산 입력 한 벌 — 판본을 가리키지 않고 값으로 든다(ADR 0071)';
comment on column public.reading_job.about is
  '그때 그 사람들을 부르던 말과 두 사람의 사이 — 프롬프트에 실리므로 함께 언다';

/**
 * 이미 도는 작업에도 같은 값을 채운다.
 *
 * `not null` 로 좁히기 전에 채워야 한다. 이 마이그레이션이 도는 순간 살아 있는 작업은
 * 길어야 8분짜리이고, 그것들은 판본을 아직 들고 있으므로 거기서 읽어 온다.
 */
update public.reading_job j
set birth_a = public.revision_birth(j.revision_a),
    birth_b = public.revision_birth(j.revision_b),
    about = jsonb_build_object('names', null, 'relation', null)
where j.birth_a is null;

alter table public.reading_job
  alter column birth_a set not null,
  alter column about set not null;

-- ---------------------------------------------------------------------------
-- 2. 여섯 열이 상태와 묶인다
-- ---------------------------------------------------------------------------

/**
 * **`frozen` 인 행은 비어 있고, 아닌 행은 차 있다.**
 *
 * 하나씩 `null` 을 허용하면 「반쯤 지어진 작업」이 실재하고, 그 상태를 읽는 코드가
 * 생긴다. 검사식 하나로 묶어 두면 그 상태가 존재할 수 없다.
 */
alter table public.reading_job
  alter column prompt drop not null,
  alter column evidence drop not null,
  alter column prompt_version drop not null,
  alter column requested_model drop not null,
  alter column generation drop not null,
  alter column viewed_at drop not null;

alter table public.reading_job drop constraint reading_job_status_check;
alter table public.reading_job add constraint reading_job_status_check
  check (status in ('frozen', 'preparing', 'submitting', 'submitted', 'retrieving'));

alter table public.reading_job
  add constraint what_node_builds_arrives_together check (
    case when status in ('frozen', 'preparing')
      then prompt is null and evidence is null and prompt_version is null
       and requested_model is null and generation is null and viewed_at is null
      else prompt is not null and evidence is not null and prompt_version is not null
       and requested_model is not null and generation is not null and viewed_at is not null
    end
  );

/**
 * **이름표는 지은 것이 있어야 붙는다.** 얼리기만 한 작업에 `response_id` 가 있으면 그것은
 * 우리가 안 보낸 응답을 가리키는 값이다.
 */
alter table public.reading_job
  add constraint the_name_tag_follows_the_prompt
  check (response_id is null or status in ('submitted', 'retrieving'));

alter table public.reading_job alter column status set default 'frozen';

/**
 * 부분 인덱스를 **건는다.**
 *
 * `where status <> 'retrieving'` 는 「손볼 일감」이 그 셋이던 시절의 좁힘이다. 이제
 * `open_reading_jobs` 가 `frozen` 까지 보므로 그 조건이 덮지 못하고, 덮지 못하는 부분
 * 인덱스는 있으나 마나다.
 */
drop index public.reading_job_open_idx;
create index reading_job_open_idx on public.reading_job (created_at);

-- ---------------------------------------------------------------------------
-- 3. 준비되지 않은 작업의 기한 — **별도 시계, 별도 코드**
-- ---------------------------------------------------------------------------

/**
 * 얼렸는데 아무도 안 집어 간 작업을 닫는 기한.
 *
 *   준비 2분  <  모델 회수 8분  <  DB 만료 10분
 *
 * 2분인 것은 여기서 하는 일이 **읽고·세고·짓고·보내는 것**뿐이라서다 — 밀리초짜리
 * 몇 번과 짧은 왕복 하나다. 이보다 오래 걸렸다면 그것은 느린 것이 아니라 **아무도 안
 * 집은 것**이다(열쇠가 없는 배포, 죽은 프로세스).
 *
 * 모델 기한(8분)을 그대로 쓰면 아무 일도 안 일어난 작업이 6분을 더 기다렸다가
 * **모델 탓으로 닫힌다.**
 */
create or replace function public.reading_job_prepare_deadline()
returns interval
language sql
immutable
as $$ select interval '2 minutes' $$;

revoke execute on function public.reading_job_prepare_deadline()
  from anon, public, authenticated, service_role;

-- ---------------------------------------------------------------------------
-- 4. 그때 그 사람들을 부르던 말 — 입력과 함께 언다
-- ---------------------------------------------------------------------------

/**
 * 프롬프트에 실릴 **이름과 사이**를 그 자리에서 짓는다.
 *
 * 이 값도 생성 입력이다. 얼리지 않으면 만드는 동안 이름표를 고친 사용자의 글이 두 이름을
 * 섞어 쓰게 된다.
 *
 * **하나라도 못 찾으면 이름은 통째로 포기한다.** 한쪽만 이름으로 부르고 다른 쪽을 자리
 * 이름으로 부르면, 읽는 사람은 이름 없는 쪽이 덜 중요한 사람인 줄 안다(`aboutFor` 가
 * 앱에서 하던 판정을 그대로 옮겼다).
 *
 * `match` 는 **공개 닉네임**으로 부르고 사이는 안 싣는다 — 만난 방식이 사이를 정한다
 * (ADR 0058).
 */
create or replace function public.reading_about(
  p_actor uuid,
  p_kind text,
  p_person_a uuid,
  p_person_b uuid,
  p_match_id uuid
)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  label_a text;
  label_b text;
  said text;
begin
  if p_kind = 'match' then
    select nullif(btrim(low.nickname), ''), nullif(btrim(high.nickname), '')
      into label_a, label_b
    from public.match m
    join public.app_user low on low.id = m.user_low
    join public.app_user high on high.id = m.user_high
    where m.id = p_match_id;

    return jsonb_build_object(
      'names',
      case when label_a is not null and label_b is not null
        then jsonb_build_object('a', label_a, 'b', label_b) end,
      'relation', null);
  end if;

  select nullif(btrim(e.local_label), '') into label_a
  from public.user_person_access e
  where e.user_id = p_actor and e.person_id = p_person_a;

  if p_person_b is null then
    return jsonb_build_object(
      'names', case when label_a is not null then jsonb_build_object('a', label_a) end,
      'relation', null);
  end if;

  select nullif(btrim(e.local_label), '') into label_b
  from public.user_person_access e
  where e.user_id = p_actor and e.person_id = p_person_b;

  /**
   * 사이는 **쌍에 물어본다.** `pair_relation_of` 를 안 부르는 것은 그 함수가
   * `auth.uid()` 를 보기 때문이다 — 여기서는 actor 를 인자로 받으므로, 누르는 사람과
   * 시도의 임자가 갈리는 자리(수락)에서도 같은 답이 나와야 한다.
   */
  select r.relation into said
  from public.pair_relation r
  where r.user_id = p_actor
    and r.person_low = least(p_person_a, p_person_b)
    and r.person_high = greatest(p_person_a, p_person_b);

  return jsonb_build_object(
    'names',
    case when label_a is not null and label_b is not null
      then jsonb_build_object('a', label_a, 'b', label_b) end,
    'relation', said);
end;
$$;

revoke execute on function public.reading_about(uuid, text, uuid, uuid, uuid)
  from anon, public, authenticated, service_role;

-- ---------------------------------------------------------------------------
-- 5. 시도를 여는 트랜잭션이 얼린다
-- ---------------------------------------------------------------------------

/**
 * 시도 하나에 얼린 입력 하나 — **같은 문장 안에서.**
 *
 * `start_reading_run_for` 안에 인라인으로 적을 수도 있었다. 따로 두는 것은 **얼리는
 * 규칙이 한 자리**여야 하기 때문이다: 무엇을 얼리는가가 바뀌는 날 고칠 곳이 여기 하나다.
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
language sql
security definer
set search_path = ''
as $$
  insert into public.reading_job (
    run_id, revision_a, revision_b, birth_a, birth_b, about, status)
  values (
    p_run_id, p_revision_a, p_revision_b,
    public.revision_birth(p_revision_a),
    public.revision_birth(p_revision_b),
    public.reading_about(p_actor, p_kind, p_person_a, p_person_b, p_match_id),
    'frozen');
$$;

revoke execute on function public.freeze_reading_input(
  uuid, uuid, text, uuid, uuid, uuid, uuid, uuid)
  from anon, public, authenticated, service_role;

/**
 * 시도를 연다 — **여는 그 자리에서 입력이 언다.**
 *
 * 바탕은 `20260907210000` 의 정의다. 더한 것은 마지막 한 줄뿐이고, 그 한 줄이 이
 * 마이그레이션의 전부다: 시도 행을 넣은 다음 **같은 트랜잭션에서** 얼린 입력을 넣는다.
 *
 * 되돌아가는 자리(0행)에서는 아무것도 안 얼린다 — 열지 않은 시도에 재료를 남기면 그것이
 * 주인 없는 얼린 입력이 된다.
 */
/**
 * 시도를 연다 — **여는 그 자리에서 입력이 언다.**
 *
 * 바탕은 이 함수가 **마지막에 서 있던 정의**다(`20260912090000` 의 풀이권 예외와
 * `20260909090000` 의 하루 상한까지 든 판). 처음 것을 베끼면 그 뒤에 다른 층에서 푼
 * 것이 조용히 되감긴다 — 재어 보고 알았다: 운영자 풀이권 예외와 하루 상한이 한꺼번에
 * 되돌아갔다.
 *
 * 더한 것은 **마지막 한 줄**뿐이고, 그 한 줄이 이 마이그레이션의 전부다: 시도 행을 넣은
 * 다음 **같은 트랜잭션에서** 얼린 입력을 넣는다.
 *
 * 되돌아가는 자리(0행)에서는 아무것도 안 얼린다 — 열지 않은 시도에 재료를 남기면 그것이
 * 주인 없는 얼린 입력이 된다.
 */
create or replace function public.start_reading_run_for(
  p_actor uuid,
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

  /**
   * **여기가 이 마이그레이션의 한 줄이다** (ADR 0071 · #66).
   *
   * 시도를 여는 것과 입력을 얼리는 것이 한 트랜잭션 안에 있으므로, 그 사이에 낀 입력
   * 수정이 없다. Node 가 뒤에 채우는 것은 **자기가 지은 것**뿐이다.
   */
  perform public.freeze_reading_input(
    started, p_actor, scope.kind, scope.person_a, scope.person_b, scope.match_id,
    scope.revision_a, scope.revision_b);

  return query select
    started, scope.person_a, scope.person_b, scope.match_id,
    scope.revision_a, scope.revision_b, scope.viewer_is_first;
end;
$$;

revoke execute on function public.start_reading_run_for(uuid, text, text, uuid, uuid, uuid, text, text)
  from anon, public, authenticated, service_role;

-- ---------------------------------------------------------------------------
-- 6. 집는 일은 **원자적 전이**다
-- ---------------------------------------------------------------------------

/**
 * 얼린 작업을 집는다 — `frozen` → `preparing` 으로 **옮기면서** 내준다.
 *
 * **조회와 전이가 갈리면 두 번 제출된다.** 복구기와 응답 뒤 콜백이 겹치거나, 같은
 * 누름이 재전송되면 둘이 같은 작업을 들고 나란히 모델을 부른다. 한 문장으로 옮기면
 * **먼저 부른 쪽 하나만** 행을 받고 두 번째는 0행이다.
 *
 * 내주는 것은 **얼린 값 전부**다. 집은 쪽은 이 뒤로 `person` 도 판본도 다시 안 읽는다 —
 * 동결된 값이 유일한 진실이다.
 */
create or replace function public.take_reading_job(p_run_id uuid)
returns table (
  run_id uuid,
  kind text,
  person_a uuid,
  person_b uuid,
  match_id uuid,
  revision_a uuid,
  revision_b uuid,
  birth_a jsonb,
  birth_b jsonb,
  about jsonb
)
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
  select
    t.run_id, r.kind, r.person_a, r.person_b, r.match_id,
    t.revision_a, t.revision_b, t.birth_a, t.birth_b, t.about
  from taken t
  join public.reading_run r on r.id = t.run_id;
$$;

revoke execute on function public.take_reading_job(uuid) from anon, public, authenticated;
grant execute on function public.take_reading_job(uuid) to service_role;

/**
 * 수락이 연 시도를 집는다 — **요청 id 로 찾는다는 것만 다르다.**
 *
 * 수락을 부른 사람은 받은 쪽이고 시도는 청한 사람 것으로 서므로, 그 행을 볼 길이
 * 사용자에게 없다(ADR 0038). 그래서 열쇠가 여는 문 하나로 찾는다.
 *
 * **이제 「job 이 없는 run」을 고르지 않는다.** 얼리는 일이 수락 트랜잭션으로 들어왔으니
 * job 은 언제나 있다 — 고를 것은 **아직 아무도 안 집은 job**(`frozen`)이고, 그것을
 * 집으면서 옮긴다.
 *
 * 옛 열 일곱(`revision_a`·`revision_b`·`viewer_is_first`)을 **그대로 둔 채** 넷을 더한다.
 * 옛 앱이 도는 동안에도 이 문이 같은 답을 내야 창이 안 생긴다.
 */
drop function public.match_run_awaiting_send(uuid);

create function public.match_run_awaiting_send(p_request_id uuid)
returns table (
  run_id uuid,
  person_a uuid,
  person_b uuid,
  match_id uuid,
  revision_a uuid,
  revision_b uuid,
  viewer_is_first boolean,
  kind text,
  birth_a jsonb,
  birth_b jsonb,
  about jsonb
)
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
    t.revision_a, t.revision_b,
    /**
     * 글이 「첫 번째 분」이라 부르는 것이 누구인가 — 이 값은 **읽는 사람마다 다르다.**
     * 제출하는 자리는 사람이 아니므로 자리의 차례를 그대로 쓴다.
     */
    true,
    r.kind, t.birth_a, t.birth_b, t.about
  from taken t
  join public.reading_run r on r.id = t.run_id;
$$;

revoke execute on function public.match_run_awaiting_send(uuid)
  from anon, public, authenticated;
grant execute on function public.match_run_awaiting_send(uuid) to service_role;

-- ---------------------------------------------------------------------------
-- 7. `freeze_reading_job` 은 **넣는 함수에서 채우는 함수로**
-- ---------------------------------------------------------------------------

/**
 * Node 가 지은 것을 적는다 — **계산 입력은 안 받는다.**
 *
 * 프롬프트 · 근거 · 판본 이름 · 요청한 모델 · 생성 설정 · 기준 시각. 여섯 다 Node 가
 * 스스로 지은 것이고, 그 밖의 것은 이미 얼어 있다.
 *
 * @returns 채웠으면 `true`. **못 채웠으면 `false`** — 그 사이 시도가 닫혔거나 이미
 *   누가 채운 것이다. 예외가 아니라 사실이므로 값으로 낸다.
 */
create or replace function public.prepare_reading_job(
  p_run_id uuid,
  p_prompt text,
  p_evidence text,
  p_prompt_version text,
  p_requested_model text,
  p_generation jsonb,
  p_viewed_at timestamptz
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
      status = 'submitting'
  where j.run_id = p_run_id
    and j.status in ('frozen', 'preparing')
    and exists (
      select 1 from public.reading_run r where r.id = j.run_id and r.status = 'running');

  return found;
end;
$$;

revoke execute on function public.prepare_reading_job(
  uuid, text, text, text, text, jsonb, timestamptz)
  from anon, public, authenticated;
grant execute on function public.prepare_reading_job(
  uuid, text, text, text, text, jsonb, timestamptz) to service_role;

/**
 * 옛 문 — **좁히는 것은 #70 이 한다.**
 *
 * 옛 앱은 판본 id 둘을 함께 보내며 이 문을 부른다. 새 스키마에서는 그 행이 이미 서
 * 있으므로 **넣으면 충돌한다** — 그래서 있으면 채우고 없으면 넣는다. 보내 온 판본 id 는
 * 안 본다: 무엇으로 계산하는가는 이미 정해졌고, 앱이 그것을 고르는 자리는 없어졌다.
 */
create or replace function public.freeze_reading_job(
  p_run_id uuid,
  p_revision_a uuid,
  p_revision_b uuid,
  p_prompt text,
  p_evidence text,
  p_prompt_version text,
  p_requested_model text,
  p_generation jsonb,
  p_viewed_at timestamptz
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if public.prepare_reading_job(
       p_run_id, p_prompt, p_evidence, p_prompt_version,
       p_requested_model, p_generation, p_viewed_at)
  then
    return;
  end if;

  /* 얼린 행이 없는 시도다 — 옛 스키마로 열린 것이라 여기서 통째로 넣는다 */
  insert into public.reading_job (
    run_id, revision_a, revision_b, birth_a, birth_b, about,
    prompt, evidence, prompt_version, requested_model, generation, viewed_at, status)
  values (
    p_run_id, p_revision_a, p_revision_b,
    public.revision_birth(p_revision_a),
    public.revision_birth(p_revision_b),
    jsonb_build_object('names', null, 'relation', null),
    p_prompt, p_evidence, p_prompt_version, p_requested_model,
    coalesce(p_generation, '{}'::jsonb), p_viewed_at, 'submitting');
end;
$$;

-- ---------------------------------------------------------------------------
-- 8. 복구기 — **준비 전 작업을 모델 탓으로 닫지 않는다**
-- ---------------------------------------------------------------------------

/**
 * 손볼 일감을 낸다 — **어느 시계로 재고 무슨 코드로 닫을지를 함께 낸다.**
 *
 * `frozen`·`preparing` 은 **모델을 부른 적이 없다.** 그것이 증명되는 상태라, 기한도
 * 코드도 갈라야 한다. 부르는 쪽이 상태를 보고 코드를 고르게 두면 그 판정이 두 자리에
 * 생기고, 둘은 언젠가 갈린다.
 *
 * `submitting` 부터는 제출이 나갔을 수 있으므로 모델 시계로 잰다.
 */
drop function public.open_reading_jobs();

create function public.open_reading_jobs()
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
         or j.created_at <= now() - public.reading_job_deadline())
  order by j.created_at;
$$;

revoke execute on function public.open_reading_jobs() from anon, public, authenticated;
grant execute on function public.open_reading_jobs() to service_role;

/**
 * 일감을 집는다 — **얼린 값을 그대로 낸다.**
 *
 * 전에는 `revision_birth` 로 판본을 그 자리에서 읽었다. 이제 그 값은 시도를 열 때 이미
 * 얼었으므로 **열에서 읽는다** — 그 사이 사용자가 입력을 고쳐도 만든 것과 검사하는 것이
 * 같은 입력이다.
 *
 * **`frozen`·`preparing` 은 여기 안 온다.** 이름표가 없으니 애초에 안 잡히지만, 상태를
 * 명시해 둔다 — 「안 잡힐 것」과 「안 잡기로 한 것」은 다른 말이다.
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
    claimed.revision_a,
    claimed.revision_b,
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

/** 이름표를 채우면서 「보냈다」로 옮긴다 — **지은 것이 있는 작업만** */
create or replace function public.adopt_reading_job(p_run_id uuid, p_response_id text)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.reading_job j
  set response_id = p_response_id, status = 'submitted'
  where j.run_id = p_run_id
    and j.response_id is null
    and j.status = 'submitting'
    and exists (
      select 1 from public.reading_run r where r.id = j.run_id and r.status = 'running');

  return found;
end;
$$;

-- ---------------------------------------------------------------------------
-- 9. 저장 — **문에서 재고 출구에서는 안 잰다**
-- ---------------------------------------------------------------------------

/**
 * 결과를 저장한다 — **판본을 인자로 안 받고, 버전을 다시 안 잰다**(ADR 0071).
 *
 * ## 왜 인자에서 뺐나
 *
 * 앱이 판본을 대는 자리가 하나 남아 있었다. 그 값이 무엇이든 DB 는 그것이 이 시도의
 * 것인지 알 수 없다 — 얼린 작업에서 읽으면 그 물음 자체가 없어진다(ADR 0013 이
 * 「앱이 판본을 안 고른다」로 막아 둔 그 자리다).
 *
 * ## 왜 다시 안 재나
 *
 * 「만드는 동안 출생정보가 바뀌었습니다」를 **걷는다.** 정상적으로 동결된 최초 생성은
 * 그 뒤 입력이 바뀌어도 완료·저장한다 — 완성된 글이 당시 여덟 글자를 들고 「이전
 * 명식으로 만든 풀이」라고 적으면 된다.
 *
 * 걷는 이유는 인연 궁합에서 분명하다. 동의가 나고 풀이권까지 예약된(ADR 0038) 자리에서
 * 완성된 글을 버리면, 그것이 바로 **「동의는 났는데 아무도 못 여는 Match」**다.
 *
 * 남는 셋은 성격이 다르다: 만료 · 더 새 시도의 존재 · **자격 재확인**(차단·중지).
 * 앞의 둘은 순서 문제이고 뒤의 하나는 권한이다.
 *
 * ## 얼린 값을 **먼저** 읽는다
 *
 * 시도가 terminal 이 되는 순간 트리거가 얼린 작업을 지운다
 * (`reading_run_terminal_clears_job`). 상태를 옮기고 나서 읽으면 이미 없다.
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
   * 뒤에 읽으면 없다 — 시도가 terminal 이 되는 순간 트리거가 얼린 작업을 지운다
   * (`reading_run_terminal_clears_job`). 앞에 읽으면 **순서 검사보다 먼저 걸려서**,
   * 늦게 돌아온 호출이 「그 사이에 새 시도가 열렸다」 대신 「재료가 없다」로 거절된다 —
   * 부르는 쪽은 그 둘에 다르게 답해야 한다.
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
    output, score, metaphor, evidence, prompt, prompt_version, model, generation, viewed_at,
    source_run_id
  )
  values (
    run.kind,
    -- 공유 결과에는 주인이 없다. 누가 눌렀든 양쪽이 같은 것을 본다.
    case when run.kind = 'match' then null else run.user_id end,
    run.match_id, run.person_a, run.person_b,
    job.revision_a, job.revision_b,
    p_output, p_score, p_metaphor, p_evidence, p_prompt, p_prompt_version, p_model,
    coalesce(p_generation, '{}'::jsonb), p_viewed_at,
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
   * Match 만 알린다 — **상대에게만.** 누른 사람은 결과를 그 자리에서 본다.
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
  uuid, text, smallint, text, text, text, text, text, jsonb, timestamptz
) from anon, public, authenticated;
grant execute on function public.save_reading(
  uuid, text, smallint, text, text, text, text, text, jsonb, timestamptz
) to service_role;

-- ---------------------------------------------------------------------------
-- **옛 열두 인자짜리는 여기서 안 지운다** — 넓히고 나중에 좁힌다
-- ---------------------------------------------------------------------------
--
-- 인자가 둘 줄었으므로 이것은 고친 함수가 아니라 **새 함수**다. 같이 지우면 어느 순서로
-- 배포해도 창이 생긴다 — 마이그레이션이 먼저면 지금 떠 있는 앱이 없어진 함수를 부르고,
-- 배포가 먼저면 새 앱이 아직 없는 함수를 부른다. 그 창에 들어온 호출은 **모델은 이미
-- 돌았는데 글은 안 남는다.**
--
-- 좁히는 줄은 #70 이 쓴다.
