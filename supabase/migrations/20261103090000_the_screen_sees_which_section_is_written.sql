-- 만드는 동안 **몇 번째 절까지 썼는지**를 적고 화면에 내준다 (흐름 시안 g · 운영자 결정 2026-09-29, 넓히기)
--
-- 풀이 생성 중 화면은 초를 셌다 — 서버가 어느 단계인지 몰랐기 때문이다(`app/me/reading/panel.tsx` 의
-- 「꾸며 낸 진행」). 이제 제출한 응답을 서버가 스트림으로 따라 읽으며 소제목(`## `)이 설 때마다 **절 번호만**
-- 적는다. 글은 한 자도 적지 않는다 — 검사 전의 글을 내보내지 않는다.
--
-- ## 무엇이 바뀌나
--
-- - `reading_job` 에 두 칸: `sections_begun`(시작한 절의 수) · `body_written`(본문을 다 썼다 — 검사용 근거 절이
--   섰거나 본문이 닫혔다). 얼린 작업은 시도가 끝나면 지워지므로(`clear_reading_job`) 이 값도 **도는 동안만** 산다.
-- - `note_reading_progress` — 열쇠만 부르는 문. 값은 **올라가기만** 한다(늦게 온 작은 값이 되돌리지 못한다).
--   도는 시도의 제출된 작업에만 적는다.
-- - `my_last_reading_run` 이 세 칸을 더 낸다 — 작업의 상태 · 시작한 절 · 본문을 다 썼는가. 보는 사람은 그대로다
--   (그 시도를 이미 보던 사람). 돌려주는 모양이 바뀌므로 지우고 다시 만든다. 옛 앱은 앞의 네 칸만 읽는다.
--
-- ## 넓히기다
--
-- 옛 앱은 새 문을 안 부르고 새 칸을 안 읽는다 — 이 마이그레이션만 먼저 올라가도 아무것도 안 바뀐다. 앱이
-- 뒤따라 든다(ADR 0071 의 순서).
--
-- 재는 자리는 `supabase/tests/68_reading_progress.test.sql`.

alter table public.reading_job
  add column sections_begun smallint not null default 0,
  add column body_written boolean not null default false,
  /* 절은 많아야 열 남짓이다 — 스트림을 잘못 센 값이 화면을 끝없이 늘리지 못하게 막는다 */
  add constraint job_sections_begun_range check (sections_begun between 0 and 60);

/**
 * 스트림을 따라 읽는 쪽이 절 머리를 볼 때마다 부른다.
 *
 * **올라가기만 한다.** 같은 시도를 두 자리가 따라 읽거나 늦은 호출이 뒤에 와도 줄지 않는다. 60 을 넘는 값은
 * 60 으로 자른다 — 거절하면 따라 읽는 쪽이 그 뒤로 아무것도 못 적는다.
 *
 * @returns 적었으면 `true`. 끝난 시도 · 아직 제출 전인 작업이면 `false` — 따라 읽는 쪽은 그때 멈춘다.
 */
create function public.note_reading_progress(
  p_run_id uuid,
  p_sections_begun integer,
  p_body_written boolean
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.reading_job j
  set sections_begun = greatest(j.sections_begun, least(greatest(coalesce(p_sections_begun, 0), 0), 60)),
      body_written = j.body_written or coalesce(p_body_written, false)
  where j.run_id = p_run_id
    and j.status in ('submitting', 'submitted', 'retrieving')
    and exists (
      select 1 from public.reading_run r where r.id = j.run_id and r.status = 'running');

  return found;
end;
$$;

revoke execute on function public.note_reading_progress(uuid, integer, boolean) from anon, authenticated, public;
grant execute on function public.note_reading_progress(uuid, integer, boolean) to service_role;

-- 몸통은 `20260907210000_the_credit_is_reserved_at_the_request.sql` 의 정의(지금 로컬 · 운영의 것)에
-- 얼린 작업을 옆으로 붙인 것이다. 작업은 시도가 도는 동안만 있으므로 끝난 시도에는 세 칸이 `null` 이다.
drop function public.my_last_reading_run(text, uuid, uuid, uuid);

create function public.my_last_reading_run(
  p_kind text,
  p_person_a uuid default null,
  p_person_b uuid default null,
  p_match_id uuid default null
)
returns table (
  status text,
  failure_code text,
  failure_detail text,
  created_at timestamptz,
  job_status text,
  sections_begun smallint,
  body_written boolean
)
language sql
stable
security definer
set search_path = ''
as $$
  select run.status, run.failure_code, run.failure_detail, run.created_at,
         job.status, job.sections_begun, job.body_written
  from public.reading_scope(p_kind, p_person_a, p_person_b, p_match_id) s
  join lateral (
    select *
    from public.reading_run r
    where (s.kind = 'match' or r.user_id = (select auth.uid()))
      and r.kind = s.kind
      and r.person_a is not distinct from s.person_a
      and r.person_b is not distinct from s.person_b
      and r.match_id is not distinct from s.match_id
    order by r.created_at desc
    limit 1
  ) run on true
  left join public.reading_job job on job.run_id = run.id and run.status = 'running';
$$;

revoke execute on function public.my_last_reading_run(text, uuid, uuid, uuid) from anon, public;
grant execute on function public.my_last_reading_run(text, uuid, uuid, uuid) to authenticated;
