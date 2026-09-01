-- ---------------------------------------------------------------------------
-- webhook 이 흘린 것을 복구기가 줍는다 (ADR 0020)
-- ---------------------------------------------------------------------------

/**
 * webhook 은 안 올 수 있다. 그물이 하나면 그때 그 시도는 만료까지 잠긴 채로 남는다.
 *
 * 복구기가 1분마다 돈다. 두 가지를 한다 — **아직 안 끝난 것을 가져와 보고**, **너무
 * 오래된 것을 닫는다**. 시계의 순서는 ADR 이 값으로 박았다.
 *
 *   복구 주기 1분  <  우리 deadline 8분  <  DB 만료 10분
 *
 * provider 회수 가능 시간은 그 줄에 없다. 「약 10분」이라고만 알려진 값이라 우리 숫자와
 * 나란히 세우면 보장 안 되는 것을 보장인 척 쓰게 된다. **8분 이후의 회수 가능성에 기대지
 * 않는다.**
 */

create or replace function public.reading_job_deadline()
returns interval
language sql
immutable
as $$ select interval '8 minutes' $$;

/**
 * **닫는다 — 기본값이 닫아 줄 거라 믿지 않는다.**
 *
 * 26일자 마이그레이션이 「앞으로 생길 함수도 닫힌 채로 시작하게 기본 권한까지 바꾼다」고
 * 적어 두었는데, 이 함수를 revoke 없이 만들었더니 `proacl` 이 비어 anon·authenticated·
 * service_role 모두에게 열렸다. **약속이 실제로는 안 지켜지고 있었다.**
 *
 * 상수 하나를 내주는 함수라 새어도 해가 없다. 해가 없는 자리에서 드러났을 뿐이고,
 * 다음에는 그렇지 않을 수 있다. 그래서 `proacl` 이 빈 함수가 하나도 없는지를 시험이
 * 따로 센다(13번) — 이 줄을 잊는 날 거기서 걸린다.
 */
revoke execute on function public.reading_job_deadline() from anon, public, authenticated, service_role;

/**
 * 손볼 일감을 낸다.
 *
 * `overdue` 를 여기서 판정한다. 부르는 쪽이 시각을 빼서 재면 서버 시계와 DB 시계가
 * 갈리고, 그 차이가 곧 「아직인데 닫혔다」가 된다 — 판정은 한 시계로 한다.
 *
 * **`retrieving` 은 안 낸다.** 누가 보고 있는 것이고, 그 사람이 끝내거나 놓는다. 다만
 * 놓지 못하고 죽는 일이 있으므로 `deadline` 은 그것까지 덮는다.
 */
create or replace function public.open_reading_jobs()
returns table (run_id uuid, response_id text, overdue boolean)
language sql
stable
security definer
set search_path = ''
as $$
  select
    j.run_id,
    j.response_id,
    j.created_at <= now() - public.reading_job_deadline()
  from public.reading_job j
  join public.reading_run r on r.id = j.run_id
  where r.status = 'running'
    and (j.status <> 'retrieving'
         or j.created_at <= now() - public.reading_job_deadline())
  order by j.created_at;
$$;

revoke execute on function public.open_reading_jobs() from anon, public, authenticated;
grant execute on function public.open_reading_jobs() to service_role;

-- ---------------------------------------------------------------------------
-- 이름표를 잃은 일감을 되찾는다
-- ---------------------------------------------------------------------------

/**
 * **제출과 기록 사이의 틈**을 메우는 자리다.
 *
 * 제출은 됐는데 `response_id` 를 적기 전에 끊기면 그 일감은 주인을 잃는다 — 돈은 나가고
 * 결과는 아무 데도 안 붙는다. 그래서 요청의 `metadata.reading_run_id` 에 이름표를 실어
 * 보냈고(ADR 0020), webhook 이 그 값을 읽어 여기로 온다.
 *
 * **이미 이름표가 있으면 안 덮는다.** 같은 시도에 두 번 제출된 일은 없어야 하지만,
 * 있었다면 나중 것으로 덮는 순간 앞의 결과가 미아가 된다. 그때는 아무것도 안 하고
 * `false` 를 내서 부르는 쪽이 그 사실을 알게 한다.
 */
create or replace function public.adopt_reading_job(p_run_id uuid, p_response_id text)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.reading_job j
  set response_id = p_response_id
  where j.run_id = p_run_id
    and j.response_id is null
    and exists (
      select 1 from public.reading_run r where r.id = j.run_id and r.status = 'running');

  return found;
end;
$$;

revoke execute on function public.adopt_reading_job(uuid, text) from anon, public, authenticated;
grant execute on function public.adopt_reading_job(uuid, text) to service_role;
