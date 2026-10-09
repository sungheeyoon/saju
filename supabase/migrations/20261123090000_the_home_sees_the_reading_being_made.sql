-- 홈이 만드는 중인 풀이를 보고, 소식이 그 풀이의 이름을 부른다 — 넓히기 (ADR 0157)
--
-- 운영자 지시(2026-10-09): 「사주풀이든 궁합이든 풀이를 만들고 있을 때는 홈에서 진행 상태를 간략하게 보여 주고, 끝나면 알림에
-- 띄워야 한다.」 이 파일은 그 가운데 **읽는 쪽 둘**만 든다. 완성 소식을 세우는 쓰기(`save_reading`)는 다음 파일
-- (`20261124090000`)이고, 그것은 앱이 나간 **뒤에** 오른다 — 옛 앱은 `reading_ready` 를 언제나 「인연 궁합이 완성됐어요」로
-- 읽기 때문이다(ADR 0157 「올리는 차례」).
--
--   1. **`my_running_readings()`** — 내가 연 시도 가운데 아직 도는 것. 대상(kind · 두 사람 · Match)과 부를 이름, 서버가 적은
--      진행 세 칸(ADR 0127)만 낸다. 글 · 근거 · 실패 이유는 없다. 홈은 이것으로 「만드는 중」 한 줄을 세운다.
--   2. **`my_notifications()` 끝에 두 칸** — 시도가 가리키는 두 사람을 **내가 부르는 이름**(`local_label`). 「사주풀이가
--      완성됐어요」만으로는 누구의 것인지 모른다. 반환 열이 늘므로 지우고 다시 세운다 — 옛 앱은 아는 칸만 집는다.
--
-- ## 넓히기다
--
-- 옛 앱은 새 문을 안 부르고 새 칸을 안 읽는다. 이 파일만 먼저 올라가도 화면은 그대로다.
--
-- 재는 자리는 `supabase/tests/84_running_readings.test.sql`.

-- ---------------------------------------------------------------------------
-- 1. 만드는 중인 풀이
-- ---------------------------------------------------------------------------

/**
 * 내가 연 시도 가운데 **지금 도는 것** — 최근 것이 앞이다.
 *
 * **보는 사람은 시도를 연 사람 하나다.** 인연 궁합의 시도도 연 쪽(청한 사람)만 본다 — 상대에게 그 시도는 자기가 누른 일이
 * 아니고, 다 되면 「완성됐어요」 소식이 간다(`save_reading`).
 *
 * **만료 시각이 지난 시도는 안 낸다.** 서버가 죽어 끝나지 못한 시도는 `running` 인 채 남을 수 있다 — 다음 누름이나 회수
 * 크론이 닫을 때까지. 그 줄을 「만드는 중」으로 세우면 홈이 끝나지 않는 일을 기다리게 한다. 상한은 저장 문과 같은
 * `reading_run_timeout()` 이다 — 그 뒤로는 저장도 거절되므로 「만드는 중」이 참일 수 없다.
 *
 * **좁힘은 `my_readings` 와 같다.** 한 사람 · 두 사람 풀이는 내 엣지가 있어야 이름이 붙고 줄이 선다 — 목록에서 뺀 사람의
 * 시도는 안 선다. 인연 궁합은 `visible_matches()` 가 든다(차단 · 정지로 내려간 Match 는 안 선다).
 */
create function public.my_running_readings()
returns table (
  kind text,
  person_a uuid,
  person_b uuid,
  match_id uuid,
  label_a text,
  label_b text,
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
  select
    run.kind,
    run.person_a,
    run.person_b,
    run.match_id,
    case
      when run.kind = 'self' then null
      when run.kind = 'match' then partner.nickname
      else edge_a.local_label
    end,
    edge_b.local_label,
    run.created_at,
    job.status,
    job.sections_begun,
    job.body_written
  from public.reading_run run
  left join public.reading_job job on job.run_id = run.id
  left join public.user_person_access edge_a
    on edge_a.user_id = (select auth.uid()) and edge_a.person_id = run.person_a
  left join public.user_person_access edge_b
    on edge_b.user_id = (select auth.uid()) and edge_b.person_id = run.person_b
  left join public.visible_matches() m on m.id = run.match_id
  left join public.app_user partner
    on partner.id = case when m.user_low = (select auth.uid()) then m.user_high else m.user_low end
  where public.is_active_account()
    and run.user_id = (select auth.uid())
    and run.status = 'running'
    and run.created_at > now() - public.reading_run_timeout()
    and case
      when run.kind = 'match' then m.id is not null
      else edge_a.person_id is not null and (run.person_b is null or edge_b.person_id is not null)
    end
  order by run.created_at desc;
$$;

revoke execute on function public.my_running_readings() from anon, public;
grant execute on function public.my_running_readings() to authenticated;

-- ---------------------------------------------------------------------------
-- 2. 소식이 풀이의 이름을 부른다
-- ---------------------------------------------------------------------------

/**
 * 몸통은 `20260909120000_the_name_is_made_at_signup.sql` 그대로에 끝의 두 칸만 더했다.
 *
 * **이름은 내가 부르는 이름이다**(`local_label`) — 소식은 내 것이고, 같은 사람을 남은 다르게 부를 수 있다. 내 사주(`self`)는
 * 부를 이름이 없어 `null` 이다(`my_readings` 와 같다). 엣지를 지웠으면 `null` 이고 화면은 이름 없는 문장으로 선다.
 *
 * Person id 는 이미 내주던 값이다 — 이름은 그 id 로 내가 이미 볼 수 있는 것을 다시 내주는 것이다.
 */
drop function public.my_notifications();

create function public.my_notifications()
returns table (
  notification_id uuid,
  kind text,
  counterpart_nickname text,
  request_id uuid,
  match_id uuid,
  reading_kind text,
  reading_person_a uuid,
  reading_person_b uuid,
  created_at timestamptz,
  read_at timestamptz,
  reading_label_a text,
  reading_label_b text
)
language sql
stable
security definer
set search_path = ''
as $$
  select
    n.id,
    n.kind,
    coalesce(by_request.nickname, by_match.nickname),
    n.request_id,
    n.match_id,
    run.kind,
    run.person_a,
    run.person_b,
    n.created_at,
    n.read_at,
    case when run.kind = 'self' then null else edge_a.local_label end,
    edge_b.local_label
  from public.visible_notifications() n
  left join public.match_request r on r.id = n.request_id
  left join public.app_user by_request
    on by_request.id = case
      when r.requester_user_id = (select auth.uid()) then r.addressee_user_id
      else r.requester_user_id end
  left join public.match m on m.id = n.match_id
  left join public.app_user by_match
    on by_match.id = case
      when m.user_low = (select auth.uid()) then m.user_high else m.user_low end
  left join public.reading_run run on run.id = n.run_id
  left join public.user_person_access edge_a
    on edge_a.user_id = (select auth.uid()) and edge_a.person_id = run.person_a
  left join public.user_person_access edge_b
    on edge_b.user_id = (select auth.uid()) and edge_b.person_id = run.person_b
  order by n.created_at desc
  limit 50;
$$;

revoke execute on function public.my_notifications() from anon, public;
grant execute on function public.my_notifications() to authenticated;
