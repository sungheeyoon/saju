-- ---------------------------------------------------------------------------
-- 생성 실패를 알린다 — **전제가 무너진 자리를 되돌린다**
-- ---------------------------------------------------------------------------

/**
 * `reading_failed` 를 넣는다. 앞 파일이 넣지 않기로 한 이유는 이거였다.
 *
 * > 생성이 요청과 같은 왕복 안에서 끝나므로 실패는 누른 사람 화면에 그 자리에 서고,
 * > 시도 기록이 그 사실을 든다. (…) 생성이 비동기가 되는 날 이 값이 필요해지고,
 * > 그날 이 자리를 다시 본다.
 *
 * **그날이 왔다.** ADR 0016 이 만드는 일을 `after` 로 옮겼다. 이제 누름과 생성이 같은
 * 왕복이 아니므로 **탭을 닫으면 실패를 말할 화면이 없다.** 4분짜리 생성 앞에서 탭을
 * 닫는 것은 이상한 행동이 아니라 우리가 그러라고 만든 것이다.
 *
 * 그때 실패는 조용하다. 그 대상의 화면으로 **다시 걸어 들어와야만** 보인다
 * (`my_last_reading_run` → `initialFailed`). 자기 풀이는 `/me` 라 다시 오지만, 비공개
 * 궁합은 두 사람을 다시 골라 들어가야 하는 자리다 — 안 오면 영영 모른다.
 *
 * 알림함에 한 번 더 서는 것이 「같은 말을 두 자리에서 하는 것」이라던 걱정은 남는다.
 * 다만 그 걱정은 **누른 사람이 언제나 보고 있다**는 전제 위에 있었고, 지금은 누가
 * 보고 있는지 서버가 알 방법이 없다. 모를 때는 **말하는 쪽으로 눕힌다** — 두 번
 * 듣는 것과 못 듣는 것 중 고쳐야 하는 것은 뒤쪽이다.
 */

-- ---------------------------------------------------------------------------
-- 무엇이 실패했나 — **시도를 든다**
-- ---------------------------------------------------------------------------

/**
 * 알림이 **시도**를 가리킨다.
 *
 * 대상(kind · 두 Person · Match)을 알림 행에 베껴 적을 수도 있었다. 그러면 같은 사실이
 * 두 표에 앉고, 둘은 언젠가 갈린다. 시도 행이 이미 그 전부를 들고 있으므로 그것을
 * 가리키기만 한다 — **지우는 규칙도 FK 가 든다.** 판본 정리가 시도를 거둬 가면 그
 * 시도를 가리키던 알림도 함께 간다.
 */
alter table public.notification
  add column run_id uuid references public.reading_run (id) on delete cascade;

alter table public.notification drop constraint notification_kind_check;
alter table public.notification add constraint notification_kind_check check (kind in (
  'request_received', 'request_accepted', 'request_rejected', 'request_invalidated',
  'reading_ready', 'reading_failed'
));

-- ---------------------------------------------------------------------------
-- 실패를 적는 자리가 알림도 세운다
-- ---------------------------------------------------------------------------

/**
 * 시도를 닫으면서 알림을 함께 세운다.
 *
 * **부르는 쪽이 기억하지 않는다.** 실패를 적는 자리는 파이프라인 안에 여럿이고
 * (`closed` · `unexpected` · 검사 실패 · 모델 실패), 알림을 앱에서 넣게 두면 그중
 * 하나는 안 고쳐진다. 닫는 일과 알리는 일이 한 문장 안에 있으면 갈릴 자리가 없다.
 *
 * ## 여기 오는 것은 **아직 도는 시도**뿐이다
 *
 * 「늦게 돌아온 호출이 성공한 새 글을 두고 실패를 말하지 않게」 더 나중 시도를 찾아
 * 걸러야 하나 싶었는데, 그런 시도는 여기 못 온다. `start_reading_run` 이 새 시도를
 * 열면서 **만료된 것을 먼저 닫기 때문**이다(`expired`). 그래서 같은 대상에 `running`
 * 이 둘일 수 없고, 늦게 돌아온 호출은 이 함수에서 0행을 만나 예외로 끝난다.
 *
 * **닿지 않는 갈래를 미리 적지 않는다.** 적어 두면 그 조건이 실제로 무는지 아무도
 * 모른 채 남고, 나중에 이 자리를 읽는 사람은 있지도 않은 사정을 상상하게 된다.
 *
 * 대신 **만료로 닫히는 것은 여기를 지나지 않는다**는 사실이 남는다. 서버가 죽어
 * 끝나지 못한 시도는 다음 누름이 쓸어 담으므로 알릴 사람이 이미 그 화면에 있다.
 * 아무도 다시 안 누르면 그 실패는 조용한 채로 남는다 — 그것을 말하려면 사람 없이
 * 도는 자리가 있어야 하고, 지금 그런 자리는 없다.
 */
create or replace function public.fail_reading_run(
  p_run_id uuid,
  p_failure_code text,
  p_failure_detail text default null
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
      -- 길면 자른다. 실패 이유를 못 적는 것보다 낫고, 어차피 원문은 여기 안 온다.
      failure_detail = left(p_failure_detail, 500),
      finished_at = now()
  where r.id = p_run_id
    and r.user_id = (select auth.uid())
    and r.status = 'running'
  returning r.* into failed;

  if not found then
    raise exception '기록할 시도를 찾지 못했습니다.' using errcode = 'no_data_found';
  end if;

  /**
   * Match 를 함께 든다. 그래야 차단으로 내려간 Match 의 실패 통보가 알림함에만 남지
   * 않는다 — **목록에서 숨긴 것은 알림함에서도 숨긴다**(`visible_notifications`).
   */
  insert into public.notification (user_id, kind, run_id, match_id)
  values (failed.user_id, 'reading_failed', failed.id, failed.match_id);
end;
$$;

-- ---------------------------------------------------------------------------
-- 알림함이 **무엇을 만들다 실패했는지** 함께 낸다
-- ---------------------------------------------------------------------------

/**
 * 실패 알림은 사람이 아니라 **대상**으로 알아본다.
 *
 * 지금까지 알림은 전부 상대가 있는 사건이었고 별명 하나면 어느 줄인지 알 수 있었다.
 * 실패는 다르다 — 자기 풀이도 비공개 궁합도 상대가 없다. 「풀이를 만들지 못했습니다」
 * 한 줄만 서면 **어느 것을 다시 눌러야 하는지** 알 수 없다.
 *
 * 그래서 시도가 든 대상을 함께 낸다. 문장은 여전히 여기서 안 난다(`notificationText`)
 * — 나가는 것은 종류와 그 대상을 가리키는 값뿐이다.
 *
 * **Person id 를 내주는 것은 이미 열린 것을 다시 내주는 것이다.** 그 시도는 부른
 * 사람의 것이고(`user_id`), 같은 id 가 이미 궁합 화면의 주소에 실려 있다.
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
  read_at timestamptz
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
    n.read_at
  from public.visible_notifications() n
  left join public.match_request r on r.id = n.request_id
  left join public.discovery_profile by_request
    on by_request.user_id = case
      when r.requester_user_id = (select auth.uid()) then r.addressee_user_id
      else r.requester_user_id end
  left join public.match m on m.id = n.match_id
  left join public.discovery_profile by_match
    on by_match.user_id = case
      when m.user_low = (select auth.uid()) then m.user_high else m.user_low end
  left join public.reading_run run on run.id = n.run_id
  order by n.created_at desc
  limit 50;
$$;

revoke execute on function public.my_notifications() from anon, public;
grant execute on function public.my_notifications() to authenticated;
