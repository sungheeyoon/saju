-- ---------------------------------------------------------------------------
-- 복구기를 깨우는 것은 Vercel 이 아니라 Supabase 다 (ADR 0020)
-- ---------------------------------------------------------------------------

/**
 * 복구 주기를 1분으로 적어 놓고 **Vercel cron 에 걸었는데, Hobby 는 하루 한 번이다.**
 * 요금제를 안 보고 적은 값이었다. 분 단위 cron 은 배포 자체가 거절된다.
 *
 * 화면이 3초마다 물어보고 있으니 거기 얹는 길도 있었다. 안 그러기로 한 이유가 셋이다.
 *
 *   **탭을 닫으면 복구도 닫힌다.** 사람이 없을 때가 복구가 필요한 때다.
 *   **폴링은 읽기 전용으로 잠겨 있다**(`actions.ts`). 그 잠금을 푸는 것이 이 일보다 크다.
 *   **3초마다 provider 를 조회하게 된다.** 그것을 막으려면 throttling 이 또 필요하다.
 *
 * 그래서 깨우는 쪽만 바꾼다. 복구 API 도, 집는 문도, 시계도 그대로다.
 *
 *   Supabase 복구 1분  <  우리 deadline 8분  <  DB 실행 만료 10분
 *   화면 폴링 3초 = 표시용
 *   Vercel 하루 cron = 최후 청소
 */

create extension if not exists pg_cron;
create extension if not exists pg_net with schema extensions;

-- ---------------------------------------------------------------------------
-- 값은 저장소에 안 적는다
-- ---------------------------------------------------------------------------

/**
 * 주소와 열쇠는 **Vault 에서 읽는다.**
 *
 * 마이그레이션에 적으면 그 값이 git 에 남고, 저장소를 읽을 수 있는 사람이 곧 복구기를
 * 부를 수 있는 사람이 된다. 실제 값은 배포할 때 손으로 넣는다.
 *
 *   select vault.create_secret('https://…/api/cron/reading', 'reading_recovery_url');
 *   select vault.create_secret('<CRON_SECRET 과 같은 값>',    'reading_recovery_secret');
 *
 * **`CRON_SECRET` 과 `OPENAI_WEBHOOK_SECRET` 은 다른 값이다.** 앞은 이 문을 아무나 못
 * 두드리게 막고, 뒤는 들어온 것이 정말 provider 가 보낸 것인지 서명을 본다. 하나로 쓰면
 * 한쪽이 새는 순간 둘 다 샌다.
 */
create or replace function public.wake_reading_recovery()
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  url text;
  secret text;
begin
  select decrypted_secret into url
  from vault.decrypted_secrets where name = 'reading_recovery_url';

  select decrypted_secret into secret
  from vault.decrypted_secrets where name = 'reading_recovery_secret';

  /**
   * **아직 안 넣었으면 조용히 지나간다.**
   *
   * 여기서 예외를 내면 1분마다 실패가 쌓이고, 그 소음이 진짜 실패를 덮는다. 값이 없다는
   * 것은 아직 배선이 안 끝났다는 뜻이지 무언가 잘못됐다는 뜻이 아니다.
   */
  if url is null or secret is null then
    return;
  end if;

  /**
   * **시간을 넉넉히 준다.** `pg_net` 의 기본 문턱은 2초인데, 복구기는 일감 여럿을 차례로
   * 집으므로 그보다 오래 걸린다. 2초에 끊기면 매 분 같은 일을 시작만 하고 버린다.
   *
   * 답을 기다리지 않는다 — `pg_net` 은 비동기라 요청을 큐에 넣고 곧 돌아온다. 결과가
   * 궁금하면 `net._http_response` 를 본다.
   */
  perform extensions.http_get(
    url := url,
    headers := jsonb_build_object('Authorization', 'Bearer ' || secret),
    timeout_milliseconds := 45000);
end;
$$;

/**
 * **아무에게도 열지 않는다.** 부르는 것은 `cron` 뿐이고, 그것은 소유자 권한으로 돈다.
 * 열어 두면 이 함수를 부르는 것만으로 Vault 의 값을 밖으로 흘리는 요청을 만들 수 있다.
 */
revoke execute on function public.wake_reading_recovery()
  from anon, public, authenticated, service_role;

-- ---------------------------------------------------------------------------
-- 1분마다
-- ---------------------------------------------------------------------------

/**
 * 이름으로 지우고 다시 건다. `create or replace` 가 없는 자리라 두 번 돌리면 일정이
 * 둘이 되고, 그러면 복구기가 분당 두 번 불린다.
 */
select cron.unschedule('reading-recovery')
where exists (select 1 from cron.job where jobname = 'reading-recovery');

select cron.schedule('reading-recovery', '* * * * *', 'select public.wake_reading_recovery()');
