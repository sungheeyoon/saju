-- 인연 궁합의 새 시도도 두 사람에게 알린다 — 시작 신호 (ADR 0155 「2026-10-11 덧」, G-106 닫음)
--
-- 인연 궁합 시도의 신호는 `tell_match_reading_settled`(`20261120090000` 「7. 인연 궁합」) 하나였고, `reading_run` 의
-- **UPDATE 로 `running` 에서 벗어날 때만** 울었다. 실패 뒤 상대가 인연 궁합 화면의 「궁합풀이 받기」로 새 시도를 열면
-- 내 방 머리의 궁합 단추(`app/me/chat/[matchId]/room-compat.ts`)는 그 시도가 끝날 때까지 「다시 받기」로 남았다.
--
-- 운영자 결정(2026-10-11): 신호를 더한다. match 갈래의 **INSERT(새 시도)** 에도 그 Match 의 두 사람에게 계정 채널의
-- `requests` · match_id 를 보낸다. 모양 · 채널 · 권한은 끝 신호 그대로다 — 문장 단위(전이 표) · (사람 · match_id) 하나에
-- 한 번 · 떠난 자리에는 안 보냄 · 본문 없음 · 실패는 `tell_changed` 가 삼킨다 · 아무 역할에도 열지 않는다.
--
-- 앱은 안 고친다 — 라이브 층은 이미 `requests` 로 대화방(`/me/chat`)을 다시 그린다(`app/live/changes.ts` 의 `redrawsOn`).
--
-- 재는 자리는 `supabase/tests/82_live_channel.test.sql` 「b. 인연 궁합」.

/**
 * 매칭 풀이의 새 시도가 섰다 → 그 Match 의 두 사람에게 `requests` · match_id. 누른 사람만이 아니다 — 상대의 방 머리도
 * 「만드는 중」으로 선다. 떠난 자리에는 안 보낸다.
 */
create function public.tell_match_reading_started()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  t record;
begin
  for t in
    select distinct side.user_id, m.id as match_id
    from after_rows n
    join public.match m on m.id = n.match_id
    cross join lateral (values (m.user_low), (m.user_high)) as side (user_id)
    where n.kind = 'match'
      and side.user_id is not null
  loop
    perform public.tell_changed(t.user_id, 'requests', t.match_id, null);
  end loop;

  return null;
end;
$$;

create trigger match_reading_started_tells_the_pair
after insert on public.reading_run
referencing new table as after_rows
for each statement execute function public.tell_match_reading_started();

revoke execute on function public.tell_match_reading_started() from public, anon, authenticated, service_role;
