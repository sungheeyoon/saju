-- 후보 목록 — **고르는 일과 남기는 일이 한 함수 안에서 끝난다.**
--
-- 줄 세우기·탐색 배치·노출 기록이 전부 `discovery_board()` 안에 있으므로, 그 셋이
-- 서로 어긋나지 않는다는 것을 여기서 잰다. 부르는 쪽이 넣을 인자가 없다는 것도.
begin;
select plan(13);

/**
 * 참여자 하나를 세우는 손잡이.
 *
 * 오행 요약을 손으로 지어 넣는다. 앱이 판본에서 뽑는 값이지만 여기서 재려는 것은
 * **줄 세우기와 기록**이라, 점수가 벌어지게 요약을 골라 넣는 편이 낫다.
 */
create or replace function pg_temp.participant(mail text, wood integer)
returns uuid
language plpgsql
as $$
declare
  uid uuid := tests.signup(mail);
begin
  perform set_config('request.jwt.claims', tests.claims(uid), true);
  perform public.create_self_person(
    '나', 'solar', '1990-05-15', '1990-05-15', '14:30', 'female', '서울', 'jo', 'localMean');
  insert into public.discovery_profile (nickname, prefer_gender) values (left(mail, 12), 'any');
  perform public.set_discovery_participation(true, jsonb_build_object(
    'glyphCount', 8,
    'counts', jsonb_build_object('木', wood, '火', 8 - wood, '土', 0, '金', 0, '水', 0),
    'ratios', jsonb_build_object('木', wood / 8.0, '火', (8 - wood) / 8.0, '土', 0, '金', 0, '水', 0)));
  return uid;
end;
$$;

set local role authenticated;

create temporary table folks as
select i, pg_temp.participant('p' || i || '@example.com', i % 8) as uid
from generate_series(1, 12) as i;
grant select on folks to authenticated;

/**
 * **다른 검사가 남긴 참여자는 이 시험의 관심 밖이다.**
 *
 * `discovery_board` 는 `security definer` 라 RLS 로 스스로 좁혀지지 않는다. 좁히지
 * 않으면 이 파일은 「DB 가 비어 있는가」를 재게 된다 — 빈 DB 에서는 통과하고 flow
 * 검사가 남긴 자료 위에서는 깨진다. 1번이 나머지를 목록에서 빼 두고 시작한다.
 */
reset role;
insert into public.discovery_hidden (user_id, hidden_user_id)
select (select uid from folks where i = 1), p.user_id
from public.discovery_profile p
where p.user_id not in (select uid from folks);

set local role authenticated;

-- 1번이 본다.
select set_config('request.jwt.claims', tests.claims((select uid from folks where i = 1)), true);

create temporary table board as select * from public.discovery_board();
grant select on board to authenticated;

-- ── 목록의 모양 ───────────────────────────────────────────────────────────────
select is((select count(*)::int from board), 10, '한 번에 열 명까지 선다');

select is(
  (select array_agg(seat order by seat) from board),
  array[0, 1, 2, 3, 4, 5, 6, 7, 8, 9],
  '자리는 0부터 빈틈없이 매겨진다');

select is(
  (select count(distinct candidate_user_id)::int from board),
  10,
  '한 사람도 두 번 서지 않는다');

select is(
  (select count(*)::int from board where candidate_user_id = (select uid from folks where i = 1)),
  0,
  '자기 자신은 후보가 아니다');

-- ── 탐색 후보 ─────────────────────────────────────────────────────────────────
select is(
  (select count(*)::int from board where exploration),
  2,
  '열 자리 중 둘이 탐색이다');

select is(
  (select array_agg(seat order by seat) from board where exploration),
  array[2, 5],
  '탐색 자리는 앞뒤에 몰리지 않는다');

/**
 * 상위 여덟은 **점수 상위 여덟**이고 탐색 둘은 그 밖에서 온다.
 *
 * 기대값을 여기서 다시 세지만 셈을 베끼는 것이 아니다 — 같은 축 함수를 부르고 정책이
 * 선언한 가중치를 그대로 쓴다. 갈리면 둘 중 하나가 바뀐 것이다.
 */
reset role;
create temporary table expected as
select
  other.user_id,
  public.discovery_complement(mine.element_summary, other.element_summary) * 0.54
    + public.discovery_combined_balance(mine.element_summary, other.element_summary) * 0.46 as score
from public.discovery_profile other, public.discovery_profile mine
where mine.user_id = (select uid from folks where i = 1)
  and other.user_id <> mine.user_id
  -- 목록에서 빼 둔 남까지 세면 기대값이 실제 후보 풀과 달라진다.
  and other.user_id in (select uid from folks);

select is(
  (select array_agg(candidate_user_id order by candidate_user_id) from board where not exploration),
  (select array_agg(user_id order by user_id) from (
     select user_id from expected order by score desc, user_id limit 8) as top),
  '상위 여덟은 점수 상위 여덟이다');

select is(
  (select count(*)::int from board b
   where b.exploration
     and b.candidate_user_id in (
       select user_id from (select user_id from expected order by score desc, user_id limit 8) as top)),
  0,
  '탐색은 상위 밖에서만 뽑는다');

-- ── 노출 기록이 목록과 **정확히 같다** ────────────────────────────────────────
--
-- 기록을 앱이 적던 시절에는 「보여준 것」과 「적은 것」이 다를 수 있었다. 이제 한
-- 함수가 둘 다 하므로, 다르면 그건 함수가 스스로 어긋난 것이다.

select is(
  (select count(*)::int from public.discovery_impression
   where viewer_user_id = (select uid from folks where i = 1)),
  10,
  '보여준 만큼만 기록된다');

select is(
  (select array_agg(candidate_user_id order by position) from public.discovery_impression
   where viewer_user_id = (select uid from folks where i = 1)),
  (select array_agg(candidate_user_id order by seat) from board),
  '기록의 후보와 차례가 목록과 같다');

select is(
  (select array_agg(exploration order by position) from public.discovery_impression
   where viewer_user_id = (select uid from folks where i = 1)),
  (select array_agg(exploration order by seat) from board),
  '탐색 여부도 목록과 같다');

-- ── 같은 날이면 같은 목록 ─────────────────────────────────────────────────────
set local role authenticated;
select set_config('request.jwt.claims', tests.claims((select uid from folks where i = 1)), true);

select is(
  (select array_agg(candidate_user_id order by seat) from public.discovery_board()),
  (select array_agg(candidate_user_id order by seat) from board),
  '같은 날 다시 열면 같은 목록이다 — 씨앗이 나와 오늘이다');

-- ── 후보가 적으면 탐색 자리를 만들지 않는다 ───────────────────────────────────
--
-- 「정렬했다」는 말이 화면에서 거짓이 되지 않게, 비율은 실제로 채워지는 자리에 건다.
insert into public.discovery_hidden (hidden_user_id)
select uid from folks where i between 2 and 11;

select is(
  (select count(*)::int from public.discovery_board() where exploration),
  0,
  '후보가 둘뿐이면 아무도 탐색이 아니다');

reset role;
select * from finish();
rollback;
