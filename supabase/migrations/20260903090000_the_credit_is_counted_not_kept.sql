-- 풀이권 — **장부를 만들지 않는다**
--
-- 폐쇄 베타의 테스터에게 다섯 번을 준다. 그 다섯을 어디에 적어 둘까가 첫 질문이었는데
-- 답은 「적지 않는다」다. `reading_run` 이 이미 언제 누가 무엇을 만들려 했고 어떻게
-- 됐는지를 들고 있다. 잔액은 새 값이 아니라 **세는 법**이다.
--
-- 장부를 따로 두면 세는 자리가 둘이 되고, 그 순간 「차감」과 「반환」이라는 일이 생긴다.
-- 반환은 잊힌다 — 끊긴 시도 하나가 안 돌아온 채 남으면 사용자는 쓰지도 않은 것을 잃고,
-- 그 사실을 우리도 모른다. 세기만 하면 반환이라는 일 자체가 없다.
--
-- 그래서 정한 규칙 다섯이 규칙이 아니라 **결과**로 따라온다.
--
--   · 실패·시간 초과 자동 반환   → `failed` 를 애초에 안 센다
--   · 중복 클릭 추가 차감 없음   → 「한 대상에 도는 시도는 하나」가 두 번째 행을 안 만든다
--   · 저장된 결과 다시 보기 무료 → 조회는 시도를 만들지 않는다
--   · 공유 궁합은 누른 사람만    → `user_id` 가 누른 사람이다. 읽는 쪽은 세지 않는다
--   · 새로 만들기 1회            → 성공한 시도가 하나 는다
--
-- 지울 수 있는 것으로 잔액이 되살아나지도 않는다. `person` 에는 사용자 삭제 경로가
-- 없어서(select 정책뿐) 대상을 지워 `reading_run` 을 흘려보낼 수 없다.

/**
 * 한 사람에게 주는 풀이권.
 *
 * **재어 보고 정한 값이 아니다** — `reading_rate_limit()` 옆에 같은 말이 적혀 있고,
 * 여기서도 잴 자료가 아직 없다. 다만 그것과 **묻는 것이 다르다.** 저것은 비용이
 * 폭주하지 않게 막는 빗장이고 이것은 **제품 정책**이다: 폐쇄 베타에서 한 사람이 몇
 * 번 만들어 보게 할 것인가. 테스터가 실제로 몇 번에서 멈추는지 본 뒤에 옮긴다.
 *
 * 두 값을 한 함수로 합치지 않는 것은 그래서다. 합치면 「비용 때문에 내렸다」와
 * 「정책이라 다섯이다」가 한 숫자가 되고, 옮길 때 무엇을 근거로 옮기는지 잃는다.
 */
create or replace function public.reading_credit_limit()
returns integer
language sql
immutable
as $$ select 5 $$;

-- 상수 하나를 내주는 함수지만 닫는다. 기본값이 닫아 줄 거라 믿지 않는다 —
-- 이 저장소는 그 약속이 안 지켜진 자리를 이미 한 번 찾았다(`reading_job_deadline`).
revoke execute on function public.reading_credit_limit()
  from anon, public, authenticated, service_role;

/**
 * 내 풀이권 — **화면이 빼기를 하지 않는다.**
 *
 * `available` 을 여기서 낸다. 화면에 `limit` 과 `used` 만 내주면 빼는 일이 화면으로
 * 가고, 그러면 `reserved` 를 잊은 화면이 생겨 두 자리가 서로 다른 숫자를 말한다.
 * 빼는 일은 한 자리에서 한다.
 *
 * **uuid 를 받지 않는다.** 받으면 남의 잔액을 묻는 문이 된다 — definer 는 정책을
 * 지나가므로, 이 함수가 답할 수 있는 사람은 부른 사람 하나여야 한다.
 *
 * `reserved` 를 따로 내주는 것은 화면이 「하나는 지금 만들고 있어요」를 말할 수 있게
 * 하려는 것이다. 합쳐서 `available` 만 주면 잔액이 하나 줄어든 이유를 화면이 모른다.
 */
create or replace function public.my_reading_credits()
returns table (credit_limit integer, used integer, reserved integer, available integer)
language sql
stable
security definer
set search_path = ''
as $$
  select
    public.reading_credit_limit(),
    counted.used,
    counted.reserved,
    greatest(0, public.reading_credit_limit() - counted.used - counted.reserved)
  from (
    select
      count(*) filter (where r.status = 'succeeded')::integer as used,
      /*
        **유효시간 안의 것만 센다.** 서버가 죽으면 그 행을 닫을 사람이 없어서 `running`
        이 그대로 남는데, 그것까지 세면 끊긴 시도 하나가 풀이권을 영영 물고 있는다.
        `start_reading_run` 이 같은 시계로 대상 잠금을 풀고 있으므로 여기서도 그것을
        쓴다 — 두 자리가 다른 시계를 보면 「잠기지도 세지지도 않는」 틈이 생긴다.
      */
      count(*) filter (
        where r.status = 'running'
          and r.created_at > now() - public.reading_run_timeout()
      )::integer as reserved
    from public.reading_run r
    where r.user_id = (select auth.uid())
  ) counted;
$$;

revoke execute on function public.my_reading_credits() from anon, public;
grant execute on function public.my_reading_credits() to authenticated;

/**
 * 시도를 여는 문에 **풀이권 검사를 넣는다.**
 *
 * `create or replace` 로 되쓰는 바탕은 26일자 정의다 — 그 뒤로 이 함수를 고친 곳이
 * 없다. 바뀐 것은 선언 둘과 셈 한 덩어리뿐이고 나머지는 그대로다.
 *
 * 검사가 서는 자리가 중요하다. **「이미 도는 시도가 있다」보다 뒤**여야 한다 — 앞에
 * 두면 다 쓴 사람이 만들고 있는 것을 보러 다시 눌렀을 때 「기다리세요」 대신
 * 「풀이권이 없습니다」를 읽는다. 그 사람은 이미 낸 것을 기다리는 중이다.
 */
create or replace function public.start_reading_run(
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
  used integer;
  reserved integer;
  started uuid;
begin
  select * into scope
  from public.reading_scope(p_kind, p_person_a, p_person_b, p_match_id);

  -- 0행이 곧 거절이다. 없는 대상과 못 보는 대상을 여기서도 가르지 않는다.
  if not found then
    raise exception '결과를 만들 수 있는 대상이 아닙니다.' using errcode = 'check_violation';
  end if;

  /**
   * **줄을 세운다 — 「보고 나서 넣는」 것은 잠금이 아니다.**
   *
   * 처음에는 도는 시도가 있는지 **읽어 보고** 없으면 넣었다. 두 트랜잭션이 나란히
   * 읽으면 둘 다 「없다」를 보고 둘 다 넣는다 — 모델이 두 번 불리고 뒤의 글이 앞의
   * 글을 덮는다. 판본 저장이 Person 행을 잠그고 줄을 서는 것과 같은 자리다(ADR 0011).
   *
   * 두 자물쇠를 **언제나 같은 차례로** 잡는다(사람 → 대상). 차례가 갈리면 서로를
   * 기다리는 짝이 생긴다.
   */
  perform pg_advisory_xact_lock(hashtext('reading:user:' || (select auth.uid())::text));
  perform pg_advisory_xact_lock(hashtext(
    'reading:target:' || scope.kind
      || ':' || coalesce(scope.owner_user_id::text, '')
      || ':' || coalesce(scope.person_a::text, '')
      || ':' || coalesce(scope.person_b::text, '')
      || ':' || coalesce(scope.match_id::text, '')));

  /**
   * **끝나지 못한 시도를 여기서 닫는다.**
   *
   * 서버가 죽거나 플랫폼이 요청을 끊으면 그 행을 닫을 사람이 없다. 그냥 두면 그 대상이
   * 영영 잠기고, 더 나쁜 것은 **늦게 돌아온 첫 호출이 새 결과를 덮는 것**이다. 여는
   * 자리에서 닫아 두면 저장 쪽이 「이미 실패한 시도」를 거절할 근거를 갖는다.
   */
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
  where r.user_id = (select auth.uid()) and r.idempotency_key = p_idempotency_key;

  -- 같은 열쇠로 이미 돌았다. 아무것도 시작하지 않고 0행으로 답한다.
  if existing is not null then
    return;
  end if;

  /**
   * **같은 대상에 도는 시도는 하나다 — 사람마다가 아니라 대상마다.**
   *
   * 처음에는 `user_id` 로도 좁혔다. 그러면 공유 궁합에서 **두 당사자가 서로의 시도를
   * 아예 못 본다** — 둘이 동시에 누르면 모델이 두 번 불리고 뒤의 글이 앞의 글을
   * 덮는다. 대상이 하나인데 잠금이 사람별이었던 것이다.
   */
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

  /**
   * **풀이권 — 성공한 것과 지금 도는 것을 함께 센다.**
   *
   * 성공만 세면 넷을 쓴 사람이 서로 다른 두 대상을 잇달아 누를 때 둘 다 「넷」을 보고
   * 시작해 여섯이 된다. 도는 시도는 아직 성공이 아니지만 **성공할 자리를 이미 잡고**
   * 있으므로, 허용을 정할 때는 그 자리도 찬 것으로 본다.
   *
   * 실패하면 `running` 이 `failed` 로 가면서 그 자리가 저절로 풀리고, 성공하면
   * `succeeded` 로 갈 뿐이라 합계가 그대로다. **어느 쪽으로도 되돌리는 일을 하지
   * 않는다** — 차감과 반환이라는 일이 아예 없다.
   *
   * **셈이 흔들리지 않는 것은 위의 사람 자물쇠 덕이다.** 그 자물쇠는 원래 다른 것을
   * 막으려고 잡은 것이지만 한 사람의 시작을 줄 세우므로 이 셈도 그 줄 안에서 돈다.
   * 자물쇠 밖에서 세면 나란히 읽은 둘이 같은 잔액을 보고 둘 다 지나간다.
   *
   * **아래 시간당 한도와 다른 것을 묻는다.** 이것은 제품 정책이라 성공만 세고, 아래
   * 것은 비용 빗장이라 실패도 센다. 한 사람이 실패만 되풀이하면 풀이권은 그대로여도
   * 모델은 계속 불리므로, 둘 중 하나를 지우면 그 자리가 열린다.
   */
  select
    count(*) filter (where r.status = 'succeeded'),
    count(*) filter (
      where r.status = 'running'
        and r.created_at > now() - public.reading_run_timeout()
    )
  into used, reserved
  from public.reading_run r
  where r.user_id = (select auth.uid());

  if used + reserved >= public.reading_credit_limit() then
    /*
      **두 상태를 갈라 말한다.** 자리가 다 찬 것은 같지만 할 일이 다르다 — 하나는
      기다리면 되고 하나는 끝난 것이다. 한 문장으로 합치면 기다리면 되는 사람이
      끝났다고 읽는다.
    */
    if reserved > 0 then
      raise exception '지금 만들고 있는 풀이가 마지막 풀이권을 쓰고 있어요. 그것이 끝나면 다시 눌러 주세요.'
        using errcode = 'check_violation';
    end if;

    raise exception '풀이권을 다 쓰셨습니다. 테스트 기간에는 %번까지 만들 수 있어요.',
      public.reading_credit_limit()
      using errcode = 'check_violation';
  end if;

  select count(*) into recent
  from public.reading_run r
  where r.user_id = (select auth.uid())
    and r.created_at > now() - interval '1 hour';

  if recent >= public.reading_rate_limit() then
    raise exception '한 시간에 만들 수 있는 결과 수를 넘었습니다. 잠시 뒤에 다시 시도해 주세요.'
      using errcode = 'check_violation';
  end if;

  insert into public.reading_run (
    user_id, kind, person_a, person_b, match_id, idempotency_key, model, prompt_version
  )
  values (
    (select auth.uid()), scope.kind, scope.person_a, scope.person_b, scope.match_id,
    p_idempotency_key, p_model, p_prompt_version
  )
  returning id into started;

  return query select
    started, scope.person_a, scope.person_b, scope.match_id,
    scope.revision_a, scope.revision_b, scope.viewer_is_first;
end;
$$;


-- `create or replace` 는 권한을 그대로 두지만, 이 줄이 없으면 이 파일만 읽고는
-- 누가 부를 수 있는지 알 수 없다. 다시 적어 둔다.
revoke execute on function public.start_reading_run(text, text, uuid, uuid, uuid, text, text)
  from anon, public;
grant execute on function public.start_reading_run(text, text, uuid, uuid, uuid, text, text)
  to authenticated;
