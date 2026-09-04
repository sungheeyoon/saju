-- 빗장은 사람당이 아니라 **전체에도** 걸린다 (ADR 0039)
--
-- 지금 걸린 셋은 전부 사람당이다 — 풀이권 5개, 시간당 20회, 저장 자리 10명. 그래서
-- 전체 지출의 상한은 `초대 인원 × 5` 이고, 그것을 세는 자리는 어디에도 없다.
--
-- 그리고 구멍이 하나 있다. **실패한 호출은 풀이권을 안 쓴다** — 잔액은 성공한 것과
-- 도는 것과 살아 있는 요청만 세기 때문이다(ADR 0038). 그런데 모델이 돌다가 끊기면
-- 토큰은 이미 나갔다. 그 사람은 잔액이 그대로라 다시 누를 수 있고, 그때 실제 상한은
-- **시간당 20회 × 사람 수 × 24시간**이다.
--
-- 그 구멍을 시간당 상한이 물고 있다(실패한 시도도 그 수에 든다 — 시험이 그것을 잰다).
-- 여기서 더하는 것은 **하루 전체 상한**과, **얼마나 썼는지 볼 수 있는 자리**다.
--
-- ## 앱 상한이 대시보드 상한보다 **먼저** 닿아야 한다
--
-- provider 쪽 한도에 닿으면 사용자가 받는 것은 「실패했습니다」뿐이다. 우리 쪽 한도에
-- 닿으면 「오늘은 여기까지」라고 말할 수 있다. 그래서 이 수는 대시보드에 건 수보다
-- 넉넉히 아래에 있어야 한다.

-- ---------------------------------------------------------------------------
-- 하루 전체 상한
-- ---------------------------------------------------------------------------

/**
 * 하루에 이 서비스 전체가 만들 수 있는 시도 수.
 *
 * **넉넉하게 시작한다.** 테스터 20명 × 풀이권 5개 = 100 이므로, 모두가 하루에 자기
 * 것을 다 눌러도 안 걸린다. 걸리는 것은 **버그로 도는 것**뿐이다 — 재시도가 새는
 * 자리나, 한 사람이 실패를 반복하며 계속 누르는 자리.
 *
 * **재는 것은 조이기 전에 하는 것이지 상한을 걸기 전에 할 일이 아니다.** 아래
 * `reading_spend_daily` 가 한 주치를 쌓으면 그 수를 보고 조인다. 그때까지 이 값이
 * 하는 일은 「사고를 막는 것」이지 「아껴 쓰게 하는 것」이 아니다.
 *
 * 하루의 경계는 **서울 자정**이다. 사용자가 「오늘」이라고 읽는 날과 같은 날이어야
 * 「내일 다시 열립니다」가 참이 된다.
 */
create or replace function public.reading_daily_budget()
returns integer
language sql
immutable
set search_path = ''
as $$ select 100 $$;

/**
 * 운영자에게 미리 알리는 자리 — **상한의 80%.**
 *
 * 수를 따로 적지 않고 상한에서 뽑는다. 두 곳에 적으면 상한을 조이는 날 경고만 옛
 * 수로 남고, 그러면 경고가 상한 뒤에 울린다.
 */
create or replace function public.reading_budget_warning()
returns integer
language sql
immutable
set search_path = ''
as $$ select (public.reading_daily_budget() * 4) / 5 $$;

/**
 * 오늘 이 서비스 전체가 만든 시도 수 — **성공도 실패도 다 센다.**
 *
 * 돈은 성공한 것에만 나가지 않는다. 성공만 세면 이 함수가 막으려는 바로 그 사고
 * (실패를 반복하며 도는 것)를 한 번도 못 센다.
 */
create or replace function public.reading_spend_today()
returns integer
language sql
stable
security definer
set search_path = ''
as $$
  select count(*)::integer
  from public.reading_run r
  where r.created_at >= (date_trunc('day', now() at time zone 'Asia/Seoul') at time zone 'Asia/Seoul');
$$;

-- ---------------------------------------------------------------------------
-- 운영자에게 가는 알림 — **사용자보다 먼저**
-- ---------------------------------------------------------------------------

/**
 * 운영자가 알아야 하는 일.
 *
 * **사용자가 먼저 아는 상한은 상한이 아니다.** 벽에 부딪힌 사람이 알려 줘야 운영자가
 * 안다면, 그 사이에 우리는 아무 손도 못 쓴 것이다.
 *
 * 하루에 한 종류당 한 줄이다(`unique (kind, day)`). 그 제약이 곧 「같은 것을 두 번
 * 두드리지 않는다」이고, 세는 자리를 따로 두지 않아도 된다.
 *
 * **사용자는 이 표를 못 읽는다.** 지금 몇 번이나 만들어졌는지는 운영의 값이지
 * 사용자에게 보일 값이 아니다.
 */
create table public.ops_alert (
  id uuid primary key default gen_random_uuid(),
  kind text not null,
  detail text not null check (length(detail) <= 500),
  /** 서울 날짜 — 「하루에 한 번」이 사용자가 읽는 날과 같은 날이어야 한다 */
  day date not null default (now() at time zone 'Asia/Seoul')::date,
  created_at timestamptz not null default now(),
  unique (kind, day)
);

alter table public.ops_alert enable row level security;

/**
 * 알림을 적고, 주소가 있으면 던진다.
 *
 * **주소는 Vault 에서 읽는다**(`wake_reading_recovery` 와 같은 규율). 저장소에 적으면
 * 그 값이 git 에 남고, 저장소를 읽을 수 있는 사람이 곧 운영자 채널에 글을 넣을 수 있는
 * 사람이 된다. 실제 값은 배포할 때 손으로 넣는다:
 *
 *   select vault.create_secret('https://hooks.slack.com/…', 'ops_alert_url');
 *
 * **안 넣었으면 조용히 지나간다.** 값이 없다는 것은 아직 배선이 안 끝났다는 뜻이지
 * 무언가 잘못됐다는 뜻이 아니다 — 그리고 표에는 이미 적혔으므로 알림이 사라지지 않는다.
 *
 * 몸통에 `text` 와 `content` 를 함께 싣는다. Slack 은 앞을, Discord 는 뒤를 읽는다 —
 * 채널을 고르는 일이 이 함수를 고치는 일이 되지 않게.
 *
 * @returns 이번에 새로 적혔으면 `true`. 같은 날 이미 적혔으면 `false` 이고 아무것도 안 던진다.
 */
create or replace function public.notify_ops(p_kind text, p_detail text)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  url text;
  secret text;
  written boolean := false;
begin
  insert into public.ops_alert (kind, detail)
  values (p_kind, left(p_detail, 500))
  on conflict (kind, day) do nothing;

  if not found then
    return false;
  end if;
  written := true;

  select decrypted_secret into url
  from vault.decrypted_secrets where name = 'ops_alert_url';

  if url is null then
    return written;
  end if;

  select decrypted_secret into secret
  from vault.decrypted_secrets where name = 'ops_alert_secret';

  /**
   * 답을 기다리지 않는다 — `pg_net` 은 요청을 큐에 넣고 곧 돌아온다. 그래야 이 알림이
   * **사용자의 누름을 붙들지 않는다.** 결과가 궁금하면 `net._http_response` 를 본다.
   */
  perform extensions.http_post(
    url := url,
    body := jsonb_build_object(
      'text', p_kind || ' — ' || p_detail,
      'content', p_kind || ' — ' || p_detail,
      'kind', p_kind,
      'detail', p_detail,
      'at', to_char(now() at time zone 'Asia/Seoul', 'YYYY-MM-DD HH24:MI') || ' KST'),
    headers := case
      when secret is null then '{"Content-Type": "application/json"}'::jsonb
      else jsonb_build_object('Content-Type', 'application/json', 'Authorization', 'Bearer ' || secret)
    end,
    timeout_milliseconds := 5000);

  return written;
end;
$$;

/**
 * **아무에게도 열지 않는다.** 부르는 것은 `definer` 함수뿐이다. 열어 두면 이 함수를
 * 부르는 것만으로 Vault 의 주소에 아무 글이나 던지는 요청을 만들 수 있다.
 */
revoke execute on function public.notify_ops(text, text)
  from anon, public, authenticated, service_role;

revoke execute on function public.reading_daily_budget() from anon, public, authenticated;
revoke execute on function public.reading_budget_warning() from anon, public, authenticated;
revoke execute on function public.reading_spend_today() from anon, public, authenticated;

-- ---------------------------------------------------------------------------
-- 문 안쪽에 한 줄 — **막는 것과 알리는 것**
-- ---------------------------------------------------------------------------

/**
 * `start_reading_run_for` 를 다시 쓴다 — **달라진 것은 끝의 두 토막뿐이다.**
 *
 * 1. 넣기 **전에** 오늘 전체 수를 보고, 상한에 닿았으면 거절한다. 사람의 자격을 다 본
 *    뒤에 서는 것은 이유가 있다 — 자기 잔액이 없는 사람에게 「오늘은 여기까지」라고
 *    말하면 내일 다시 와서 같은 벽을 만난다. **고칠 수 있는 이유를 먼저 말한다.**
 * 2. 넣은 **뒤에** 문턱을 넘었으면 운영자에게 알린다. 넣기 전에 알리면 그 알림은
 *    거절과 같은 트랜잭션에 있다가 함께 되돌려진다 — 예외가 나면 방금 적은 줄도
 *    사라지기 때문이다. 그래서 **막기 전에 울린다**: 80% 에서 한 번, 상한을 채운
 *    그 시도에서 한 번. 둘 다 아직 아무도 벽을 만나기 전이다.
 *
 * 나머지는 그대로다. 왜 이렇게 생겼는지는 원래 파일의 주석이 든다 — 여기서 되풀이하면
 * 두 벌이 되고, 두 벌은 갈린다.
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

  if counted.used + counted.reserved + counted.requested >= public.reading_credit_limit() then
    if counted.reserved > 0 then
      raise exception '지금 만들고 있는 풀이가 마지막 풀이권을 쓰고 있어요. 그것이 끝나면 다시 눌러 주세요.'
        using errcode = 'check_violation';
    end if;

    if counted.requested > 0 then
      raise exception '보낸 인연 요청이 풀이권을 잡고 있어요. 요청을 거두거나 상대의 답을 기다려 주세요.'
        using errcode = 'check_violation';
    end if;

    raise exception '풀이권을 다 쓰셨습니다. 테스트 기간에는 %번까지 만들 수 있어요.',
      public.reading_credit_limit()
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
   * 무엇을 해도 오늘은 안 열린다 — 나중에 화면이 그 둘을 다르게 말해야 할 때,
   * 코드가 이미 갈려 있으면 문장만 고치면 된다.
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

  return query select
    started, scope.person_a, scope.person_b, scope.match_id,
    scope.revision_a, scope.revision_b, scope.viewer_is_first;
end;
$$;

revoke execute on function public.start_reading_run_for(uuid, text, text, uuid, uuid, uuid, text, text)
  from anon, public, authenticated, service_role;

-- ---------------------------------------------------------------------------
-- 쓴 토큰은 **실패한 시도에도** 남는다
-- ---------------------------------------------------------------------------

/**
 * 이 시도가 쓴 토큰.
 *
 * 성공한 것은 이미 글 옆에 남는다(`reading.generation->'usage'`). 그런데 **돈은 실패한
 * 시도에도 나간다** — 모델이 다 돌고 나서 계약한 모양으로 못 내거나, 우리 검사가
 * 무는 자리가 그렇다. 그 토큰을 아무 데도 안 적으면 「얼마나 썼나」가 언제나 실제보다
 * 작게 나오고, 그 수를 근거로 상한을 조이면 조인 것이 조인 것이 아니다.
 *
 * **못 센 것은 `null` 이다.** 0 으로 채우면 비용이 조용히 0 이 된다 — 제출 자체가
 * 실패한 시도(모델이 안 돌았다)와 「돌았는데 못 셌다」는 다른 사실이다.
 */
alter table public.reading_run add column usage jsonb;

/**
 * 성공한 시도의 토큰을 **글에서 시도 행으로 옮긴다.**
 *
 * `save_reading` 안에서 한 줄 더 쓰는 것이 곧은 길이지만, 그 함수는 백오십 줄이고
 * 여기서 통째로 다시 적으면 그 안의 판단들이 조용히 낡는다. 고칠 것이 한 줄이면
 * 한 줄만 움직인다.
 *
 * **세는 자리는 하나여야 한다.** 성공은 `reading` 에, 실패는 `reading_run` 에 있으면
 * 지출을 묻는 쪽이 두 표를 더해야 하고, 그 덧셈은 언젠가 한쪽을 잊는다.
 */
create or replace function public.carry_usage_to_run()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.source_run_id is not null and new.generation ? 'usage' then
    update public.reading_run r
    set usage = new.generation -> 'usage'
    where r.id = new.source_run_id;
  end if;
  return new;
end;
$$;

create trigger reading_carries_usage
  after insert or update on public.reading
  for each row execute function public.carry_usage_to_run();

/**
 * **아무에게도 열지 않는다.** 트리거는 표가 부르는 것이라 실행 권한이 필요 없다.
 * 열어 두면 시도 행의 토큰을 손으로 덧쓰는 문이 하나 생긴다 — 13번 시험이 「권한을
 * 손대지 않은 함수가 하나도 없다」로 이 자리를 지킨다.
 */
revoke execute on function public.carry_usage_to_run()
  from anon, public, authenticated, service_role;

/**
 * 실패도 토큰을 들고 닫힌다 — **사용자 경로.**
 *
 * 인자를 하나 더 받으므로 옛 서명을 지우고 다시 세운다. `create or replace` 로는
 * 인자 수가 다른 함수가 **둘** 서고, 그때 이름으로 부르는 쪽(PostgREST)이 어느 것을
 * 부를지 정하지 못한다.
 */
drop function public.fail_reading_run(uuid, text, text);

create function public.fail_reading_run(
  p_run_id uuid,
  p_failure_code text,
  p_failure_detail text default null,
  p_usage jsonb default null
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  failed public.reading_run;
begin
  update public.reading_run r
  set status = 'failed',
      failure_code = p_failure_code,
      failure_detail = left(p_failure_detail, 500),
      -- 못 받았으면 안 적는다. 여기서 `'{}'` 로 채우면 「돌았는데 못 셌다」가 사라진다.
      usage = coalesce(p_usage, r.usage),
      finished_at = now()
  where r.id = p_run_id
    and r.user_id = (select auth.uid())
    and r.status = 'running'
  returning r.* into failed;

  if not found then
    raise exception '기록할 시도를 찾지 못했습니다.' using errcode = 'no_data_found';
  end if;

  insert into public.notification (user_id, kind, run_id, match_id)
  values (failed.user_id, 'reading_failed', failed.id, failed.match_id);
end;
$$;

revoke execute on function public.fail_reading_run(uuid, text, text, jsonb) from anon, public;
grant execute on function public.fail_reading_run(uuid, text, text, jsonb) to authenticated;

/** 실패도 토큰을 들고 닫힌다 — **열쇠로 도는 경로**(ADR 0020). 위와 같은 이유로 지우고 세운다 */
drop function public.fail_reading_job(uuid, text, text);

create function public.fail_reading_job(
  p_run_id uuid,
  p_failure_code text,
  p_failure_detail text default null,
  p_usage jsonb default null
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  failed public.reading_run;
begin
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

revoke execute on function public.fail_reading_job(uuid, text, text, jsonb)
  from anon, public, authenticated;
grant execute on function public.fail_reading_job(uuid, text, text, jsonb) to service_role;

-- ---------------------------------------------------------------------------
-- 얼마나 썼나 — **재는 자리**
-- ---------------------------------------------------------------------------

/**
 * 날짜별·kind 별 지출.
 *
 * **돈이 아니라 토큰으로 낸다.** 단가는 provider 가 정하고 우리 저장소가 아는 값이
 * 아니다 — 여기에 숫자를 적으면 그 숫자는 조용히 낡고, 낡은 단가로 계산한 「비용」이
 * 상한을 옮기는 근거가 된다. 원 단위가 필요하면 대시보드가 답한다.
 *
 * **못 센 시도를 따로 낸다**(`usage_unknown`). 그 수가 크면 이 표의 토큰 합은 실제보다
 * 작다는 뜻이고, 그것을 모른 채 상한을 조이면 조인 값이 참이 아니다.
 *
 * 하루의 경계는 서울 자정이다 — 상한이 보는 날과 같은 날이어야 둘을 나란히 놓을 수 있다.
 */
create view public.reading_spend_daily as
select
  (r.created_at at time zone 'Asia/Seoul')::date as day,
  r.kind,
  count(*)::integer as attempts,
  count(*) filter (where r.status = 'succeeded')::integer as succeeded,
  count(*) filter (where r.status = 'failed')::integer as failed,
  count(*) filter (where r.usage is null)::integer as usage_unknown,
  sum((r.usage ->> 'inputTokens')::bigint) as input_tokens,
  sum((r.usage ->> 'outputTokens')::bigint) as output_tokens,
  sum((r.usage ->> 'totalTokens')::bigint) as total_tokens
from public.reading_run r
group by 1, 2;

/**
 * **운영자만 읽는다.**
 *
 * 뷰는 만든 사람의 권한으로 돌아 RLS 를 지나간다. 열어 두면 로그인한 누구나 이 서비스가
 * 하루에 몇 번 불렸는지 셀 수 있고, 그것은 사용자에게 보일 값이 아니다.
 */
revoke all on public.reading_spend_daily from anon, authenticated;
