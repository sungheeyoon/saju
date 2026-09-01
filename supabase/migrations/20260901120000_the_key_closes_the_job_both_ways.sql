-- ---------------------------------------------------------------------------
-- 끝나는 길이 넷인데 닫는 문이 하나뿐이었다 (ADR 0020)
-- ---------------------------------------------------------------------------

/**
 * 만드는 일이 요청을 떠나면 **끝을 알리는 것도 밖에서 온다.**
 *
 * 성공 쪽은 이미 열려 있다 — `save_reading` 이 저장하면서 시도를 닫고, 열쇠에게 열려
 * 있다. 거기에 얼린 입력 치우는 일만 더하면 된다.
 *
 * **실패 쪽이 막혀 있었다.** `fail_reading_run` 은 `r.user_id = auth.uid()` 를 걸고
 * `authenticated` 에게만 열려 있다. provider 가 두드리는 문에는 사용자 JWT 가 없으므로
 * 부를 수 없고, 그러면 `failed`·`cancelled`·`incomplete` 와 검사 실패에서 시도가 열린 채
 * 남는다 — 그 대상이 만료까지 잠긴다.
 *
 * 사용자 쪽 문은 그대로 둔다. 화면이 부르는 길과 열쇠가 부르는 길은 자격을 묻는 방식이
 * 다르고, 한 함수로 합치면 **둘 중 넓은 쪽이 이긴다.**
 */

-- ---------------------------------------------------------------------------
-- 끝나면 얼린 입력이 간다 — 어느 길로 끝나든
-- ---------------------------------------------------------------------------

/**
 * 얼린 입력을 치우는 자리 — **함수가 아니라 상태 전이에 매단다.**
 *
 * ADR 은 「`save_reading` 을 넓힌다」고 적었다. 실제로 붙이려니 지워야 할 자리가 **넷**
 * 이었다.
 *
 *   save_reading          성공하며 닫는다
 *   fail_reading_job      webhook·복구기가 닫는다  (아래)
 *   fail_reading_run      사용자 쪽 실패가 닫는다
 *   start_reading_run     만료된 것을 쓸어 담으며 닫는다 (`failure_code = 'expired'`)
 *
 * 넷에 같은 줄을 적으면 하나는 안 고쳐진다. 그리고 안 고쳐진 그 하나가 판본을 영영
 * 붙들고 있게 된다 — 조용하고, 아무 시험도 안 걸리고, 보존 정책만 깨진다.
 *
 * **끝났다는 사실 하나에 매단다.** `running` 에서 벗어나는 모든 전이가 같은 규칙을
 * 지나므로 부르는 쪽이 기억할 것이 없다. 한 트랜잭션인 것도 그대로다 — 트리거는
 * 그 `update` 와 같은 트랜잭션에서 돈다.
 */
create or replace function public.clear_reading_job()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  delete from public.reading_job j where j.run_id = new.id;
  return new;
end;
$$;

revoke execute on function public.clear_reading_job() from anon, public, authenticated, service_role;

/**
 * **시도가 끝나면 얼린 입력이 간다 — 성공이든 실패든.**
 *
 * 부르는 자리마다 지우게 두면 자리가 넷이 되고, 자리가 넷이면 하나는 안 고쳐진다.
 * 여기 매달면 `save_reading` 도, 새 실패 함수도, `start_reading_run` 이 만료를 쓸어
 * 담는 자리도 전부 같은 규칙을 지난다 — **부르는 쪽이 기억하지 않아도 된다.**
 */
create trigger reading_run_terminal_clears_job
  after update of status on public.reading_run
  for each row
  when (old.status = 'running' and new.status <> 'running')
  execute function public.clear_reading_job();

-- ---------------------------------------------------------------------------
-- 실패 — 열쇠가 닫는 문
-- ---------------------------------------------------------------------------

/**
 * webhook 과 복구기가 시도를 닫는 자리.
 *
 * ## 예외를 던지지 않는다
 *
 * `fail_reading_run` 은 닫을 것이 없으면 예외를 낸다. 사용자가 부르는 길에서는 그게
 * 맞다 — 화면이 그 실패를 받아 말한다.
 *
 * 여기서는 반대다. 우리 deadline 이 먼저 닫은 뒤에 webhook 이 도착하는 일이 **정상**이고,
 * 그때 예외를 내면 provider 가 2xx 를 못 받아 72시간 동안 같은 사건을 다시 보낸다.
 * 닫을 것이 없었다는 것은 실패가 아니라 **이미 끝났다**는 사실이므로 값으로 낸다.
 *
 * ## uuid 를 받는다
 *
 * `security definer` 가 uuid 를 받으면 남의 것을 묻는 문이 된다. 여기서는 받는다 —
 * **부를 수 있는 것이 열쇠뿐**이고, 열쇠는 곧 서버다. 사용자 쪽 문(`fail_reading_run`)
 * 이 `auth.uid()` 를 계속 거는 이유이기도 하다.
 */
create or replace function public.fail_reading_job(
  p_run_id uuid,
  p_failure_code text,
  p_failure_detail text default null
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
      -- 길면 자른다. 원문은 여기 안 온다 — 프롬프트에 그 값이 없기 때문이다(ADR 0008).
      failure_detail = left(p_failure_detail, 500),
      finished_at = now()
  where r.id = p_run_id
    and r.status = 'running'
  returning r.* into failed;

  if not found then
    -- 이미 끝났다. 얼린 입력은 그때 트리거가 치웠다.
    return false;
  end if;

  /**
   * 닫는 일과 알리는 일이 한 문장 안에 있다 — `fail_reading_run` 과 같은 이유다
   * (ADR 0017). 끝나는 길이 넷으로 늘었으니 갈릴 자리도 넷으로 늘었다.
   *
   * Match 를 함께 든다. 목록에서 숨긴 것은 알림함에서도 숨긴다.
   */
  insert into public.notification (user_id, kind, run_id, match_id)
  values (failed.user_id, 'reading_failed', failed.id, failed.match_id);

  return true;
end;
$$;

/**
 * **열쇠 말고는 아무도 못 부른다.**
 *
 * 이로써 열쇠에 직접 열린 함수는 셋이다 — `match_calculation_inputs` · `save_reading` ·
 * `fail_reading_job`. 그 수를 세는 시험이 13번에 있고 함께 고친다. **고치지 않고 여는
 * 것이 더 나쁘다** — 열린 문의 수를 아무도 안 세게 되기 때문이다.
 */
revoke execute on function public.fail_reading_job(uuid, text, text)
  from anon, public, authenticated;
grant execute on function public.fail_reading_job(uuid, text, text) to service_role;
