-- 후보 목록 — **뽑는 일과 보는 일이 갈렸다** (ADR 0037)
--
-- 전에는 이 파일이 「같은 날 다시 열면 같은 목록인가」를 쟀다. 결정적 순서였으므로
-- 상위 여덟을 그대로 베껴 견줄 수 있었다. 이제 여덟은 **가중 무작위**라 그 자리에서
-- 잴 수 있는 것은 구조다: 열 명인가 · 8+2 인가 · 위쪽은 컷 안에서 왔는가 · 중복이
-- 없는가 · 전부 자격이 있는가.
--
-- 그리고 **씨앗을 인자로 받는 닫힌 문**(`refresh_discovery_snapshot_for`)이 있어
-- 「가중치대로 뽑혔는가」도 잰다 — 같은 씨앗이면 같은 목록이므로 여러 씨앗으로 뽑아
-- 등장 횟수를 세면 된다. 그 문은 `authenticated` 에게 닫혀 있고, 그것도 여기서 잰다.
begin;
select plan(25);

/**
 * 참여자 하나를 세우는 손잡이.
 *
 * **요약을 사람마다 다르게 짓는다.** 전에는 두 오행만 움직여 스물넷 중 열다섯이
 * 같은 점수로 묶였고, 그러면 「점수가 높을수록 잘 뽑힌다」를 잴 수 없다. 다섯 축을
 * 모두 움직여 점수가 23 부터 75 까지 벌어지게 한다.
 */
create or replace function pg_temp.summary(i integer)
returns jsonb
language sql
as $$
  select jsonb_build_object(
    'glyphCount', 8,
    'counts', jsonb_build_object('木', a, '火', b, '土', c, '金', d, '水', 8 - a - b - c - d),
    'ratios', jsonb_build_object(
      '木', a / 8.0, '火', b / 8.0, '土', c / 8.0, '金', d / 8.0, '水', (8 - a - b - c - d) / 8.0))
  from (select i % 3 as a, (i / 3) % 3 as b, (i / 9) % 3 as c, i % 2 as d) v;
$$;

create or replace function pg_temp.participant(mail text, i integer)
returns uuid
language plpgsql
as $$
declare
  uid uuid := tests.signup(mail);
begin
  perform set_config('request.jwt.claims', tests.claims(uid), true);
  perform public.create_self_person(
    '나', 'solar', '1990-05-15', '1990-05-15', '14:30', 'female', '서울', 'jo', 'localMean');
  perform public.save_my_profile(left(mail, 8), null);
  perform public.set_discovery_participation(true, pg_temp.summary(i));
  return uid;
end;
$$;

set local role authenticated;

/**
 * **스물다섯을 세운다** — 상위 20% 컷이 실제로 잘리게.
 *
 * 후보가 스무 명이 안 되면 컷이 전부라 「잘라 낸 아래」가 없고, 그러면 탐색 자리도
 * 서지 않는다(그 자리는 아래에서만 뽑으므로). 그 성질도 마지막에 따로 잰다.
 */
create temporary table folks as
select i, pg_temp.participant('board' || i || '@example.com', i) as uid
from generate_series(1, 25) as i;
grant select on folks to authenticated;

/**
 * **다른 검사가 남긴 참여자는 이 시험의 관심 밖이다.**
 *
 * 뽑는 함수는 `security definer` 라 RLS 로 스스로 좁혀지지 않는다. 좁히지 않으면 이
 * 파일은 「DB 가 비어 있는가」를 재게 된다.
 */
reset role;
insert into public.discovery_hidden (user_id, hidden_user_id)
select (select uid from folks where i = 1), p.user_id
from public.discovery_profile p
where p.user_id not in (select uid from folks);

create temporary table me as select uid from folks where i = 1;
grant select on me to authenticated;

/**
 * 기대 점수 — 셈을 베끼지 않는다.
 *
 * 같은 축 함수를 부르고 정책이 선언한 가중치를 그대로 쓴다. 갈리면 둘 중 하나가 바뀐 것이다.
 */
create temporary table scores as
select
  other.user_id,
  public.discovery_complement(mine.element_summary, other.element_summary) * 0.54
    + public.discovery_combined_balance(mine.element_summary, other.element_summary) * 0.46 as score,
  row_number() over (order by
    public.discovery_complement(mine.element_summary, other.element_summary) * 0.54
    + public.discovery_combined_balance(mine.element_summary, other.element_summary) * 0.46 desc,
    other.user_id) as rnk
from public.discovery_profile other, public.discovery_profile mine
where mine.user_id = (select uid from me)
  and other.user_id in (select uid from folks where i <> 1);
grant select on scores to authenticated;

-- 스물넷이 후보다. 컷은 `ceil(24 * 0.2)` = 다섯.
select is((select count(*)::int from scores), 24, '후보 스물넷이 선다');

-- ── 스냅샷의 모양 ─────────────────────────────────────────────────────────────

create temporary table first_id as
select public.refresh_discovery_snapshot_for((select uid from me), 'seed-a') as id;

create temporary table board as
select * from public.discovery_snapshot_slot where snapshot_id = (select id from first_id);

select is((select count(*)::int from board), 10, '한 번에 열 명이 선다');

select is(
  (select array_agg(position order by position) from board),
  array[0, 1, 2, 3, 4, 5, 6, 7, 8, 9],
  '자리는 0부터 빈틈없이 매겨진다');

select is(
  (select count(distinct candidate_user_id)::int from board),
  10,
  '한 사람도 두 번 서지 않는다');

select is(
  (select count(*)::int from board where candidate_user_id = (select uid from me)),
  0,
  '자기 자신은 후보가 아니다');

select is(
  (select count(*)::int from board where exploration),
  2,
  '열 자리 중 둘이 탐색이다');

select is(
  (select array_agg(position order by position) from board where exploration),
  array[2, 5],
  '탐색 자리는 앞뒤에 몰리지 않는다');

/**
 * **탐색은 잘라 낸 아래에서만 온다.**
 *
 * 위에서 뽑으면 어차피 보일 사람을 탐색이라 부르는 것이라 아무것도 탐색하지 않는다.
 */
select is(
  (select count(*)::int from board b join scores s on s.user_id = b.candidate_user_id
   where b.exploration and s.rnk <= 5),
  0,
  '탐색은 상위 컷 밖에서만 뽑는다');

/**
 * **컷 안의 다섯은 전부 선다.**
 *
 * 여덟을 뽑는데 컷이 다섯이라 다섯이 다 뽑히고, 모자란 자리는 아래에서 채워진다.
 * 「컷에서 여덟」이 컷보다 클 때 무슨 일이 나는지를 여기서 못 박아 둔다.
 */
select is(
  (select count(*)::int from board b join scores s on s.user_id = b.candidate_user_id
   where not b.exploration and s.rnk <= 5),
  5,
  '컷 안의 다섯은 모두 위쪽 자리에 선다');

-- ── 기록이 목록과 **정확히 같다** ─────────────────────────────────────────────

select is(
  (select array_agg(candidate_user_id order by position) from public.discovery_impression
   where viewer_user_id = (select uid from me)),
  (select array_agg(candidate_user_id order by position) from board),
  '노출 기록의 후보와 차례가 스냅샷과 같다');

select is(
  (select array_agg(exploration order by position) from public.discovery_impression
   where viewer_user_id = (select uid from me)),
  (select array_agg(exploration order by position) from board),
  '탐색 여부도 스냅샷과 같다');

-- ── 씨앗 ──────────────────────────────────────────────────────────────────────

/** 같은 씨앗이면 같은 목록이다 — 직전 스냅샷을 지우고 같은 자리에서 다시 뽑는다 */
delete from public.discovery_snapshot where user_id = (select uid from me);

/*
  뽑아 두고 나서 읽는다. 볼러틸 함수가 심은 행은 **그 행을 심은 질의 자신에게는 안
  보인다** — 읽는 자리와 만드는 자리를 한 문장에 두면 언제나 NULL 이 나온다.
*/
create temporary table again as
select public.refresh_discovery_snapshot_for((select uid from me), 'seed-a') as id;

select is(
  (select array_agg(candidate_user_id order by position)
   from public.discovery_snapshot_slot where snapshot_id = (select id from again)),
  (select array_agg(candidate_user_id order by position) from board),
  '같은 씨앗이면 같은 목록이다');

delete from public.discovery_snapshot where user_id = (select uid from me);

create temporary table other_seed as
select public.refresh_discovery_snapshot_for((select uid from me), 'seed-b') as id;

select isnt(
  (select array_agg(candidate_user_id order by position)
   from public.discovery_snapshot_slot where snapshot_id = (select id from other_seed)),
  (select array_agg(candidate_user_id order by position) from board),
  '씨앗이 다르면 목록이 달라진다');

-- ── 가중치 — **점수가 높을수록 자주 뽑힌다** ──────────────────────────────────

/**
 * 씨앗 백스물을 넣어 등장 횟수를 센다.
 *
 * 매번 직전 스냅샷을 지우는 것은 「직전에 있던 사람 제외」가 등장 횟수를 반씩 깎기
 * 때문이다 — 그 규칙은 따로 잰다. 여기서 재려는 것은 **뽑기의 기울기** 하나다.
 */
delete from public.discovery_snapshot where user_id = (select uid from me);

create temporary table draws (user_id uuid, exploration boolean);
do $$
declare
  actor uuid := (select uid from me);
  s integer;
  made uuid;
begin
  for s in 1..120 loop
    delete from public.discovery_snapshot where user_id = actor;
    made := public.refresh_discovery_snapshot_for(actor, 'weights-' || s);
    insert into draws
    select candidate_user_id, exploration
    from public.discovery_snapshot_slot where snapshot_id = made;
  end loop;
end
$$;

select cmp_ok(
  (select count(*)::int from draws d join scores s on s.user_id = d.user_id where s.rnk <= 12),
  '>',
  (select count(*)::int from draws d join scores s on s.user_id = d.user_id where s.rnk > 12),
  '점수가 높은 절반이 더 자주 선다');

/**
 * **컷을 걷어 내도 기울어 있다.**
 *
 * 위의 검사는 상위 컷이 늘 뽑히는 것만으로도 통과한다. 컷 밖에서 채워지는 자리만
 * 따로 세면 남는 것은 가중 무작위 하나다 — 그 자리도 점수를 따라야 한다.
 */
select cmp_ok(
  (select count(*)::int from draws d join scores s on s.user_id = d.user_id
   where not d.exploration and s.rnk between 6 and 14),
  '>',
  (select count(*)::int from draws d join scores s on s.user_id = d.user_id
   where not d.exploration and s.rnk > 14),
  '컷 밖에서도 점수가 높은 쪽이 더 자주 채워진다');

-- ── 직전 스냅샷 ───────────────────────────────────────────────────────────────

delete from public.discovery_snapshot where user_id = (select uid from me);

create temporary table one as
select public.refresh_discovery_snapshot_for((select uid from me), 'gen-1') as id;
create temporary table two as
select public.refresh_discovery_snapshot_for((select uid from me), 'gen-2') as id;

select is(
  (select count(*)::int
   from public.discovery_snapshot_slot a
   join public.discovery_snapshot_slot b on b.candidate_user_id = a.candidate_user_id
   where a.snapshot_id = (select id from one) and b.snapshot_id = (select id from two)),
  0,
  '직전 스냅샷에 있던 사람은 다시 서지 않는다');

select is(
  (select count(*)::int from public.discovery_snapshot where user_id = (select uid from me)),
  2,
  '두 세대만 남는다');

/**
 * **풀이 얕으면 직전 제외를 풀어서 채운다.**
 *
 * 후보를 열둘로 줄이면 새로 뽑을 사람이 둘뿐이다. 그래도 열 자리를 채운다 — 못 채우면
 * 목록이 하루아침에 두 명으로 줄어든 것처럼 보인다.
 */
insert into public.discovery_hidden (user_id, hidden_user_id)
select (select uid from me), user_id from scores where rnk > 12;

create temporary table shallow as
select public.refresh_discovery_snapshot_for((select uid from me), 'shallow') as id;

select is(
  (select count(*)::int from public.discovery_snapshot_slot
   where snapshot_id = (select id from shallow)),
  10,
  '풀이 얕으면 직전 스냅샷 사람으로 채워 열을 세운다');

delete from public.discovery_hidden
where user_id = (select uid from me) and hidden_user_id in (select user_id from scores where rnk > 12);

-- ── 읽는 함수 ─────────────────────────────────────────────────────────────────

set local role authenticated;
select set_config('request.jwt.claims', tests.claims((select uid from me)), true);

create temporary table read_once as select * from public.my_discovery_board();

select is(
  (select array_agg(candidate_user_id order by seat) from public.my_discovery_board()),
  (select array_agg(candidate_user_id order by seat) from read_once),
  '읽는 함수는 만들지 않고 읽는다 — 두 번 열어도 같은 목록이다');

reset role;
select is(
  (select count(*)::int from public.discovery_snapshot where user_id = (select uid from me)),
  2,
  '읽기만으로는 세대가 늘지 않는다');

/** 그 사이 자격을 잃은 사람은 빠진다 — 자리를 메우지 않는다. 메우는 것은 다시 뽑는 일이다 */
insert into public.discovery_hidden (user_id, hidden_user_id)
select (select uid from me), candidate_user_id
from public.discovery_snapshot_slot
where snapshot_id = (
  select id from public.discovery_snapshot where user_id = (select uid from me)
  order by seq desc limit 1)
order by position limit 1;

set local role authenticated;
select set_config('request.jwt.claims', tests.claims((select uid from me)), true);

select is(
  (select count(*)::int from public.my_discovery_board()),
  (select count(*)::int from read_once) - 1,
  '그 사이 자격을 잃은 사람은 목록에서 빠진다');

/** 스물네 시간이 지나면 읽는 함수가 스스로 새로 만든다 */
reset role;
update public.discovery_snapshot set generated_at = now() - interval '25 hours'
where user_id = (select uid from me);

set local role authenticated;
select set_config('request.jwt.claims', tests.claims((select uid from me)), true);
create temporary table drained as select * from public.my_discovery_board();

reset role;
select cmp_ok(
  (select max(generated_at) from public.discovery_snapshot where user_id = (select uid from me)),
  '>',
  now() - interval '1 minute',
  '스물네 시간이 지나면 읽을 때 새로 만들어진다');

-- ── 새로고침과 쿨다운 ─────────────────────────────────────────────────────────

set local role authenticated;
select set_config('request.jwt.claims', tests.claims((select uid from me)), true);

select throws_ok(
  'select public.refresh_discovery_snapshot()',
  '55000',
  '방금 새로 받았습니다. 잠시 뒤에 다시 받아 주세요.',
  '만든 지 5분 안이면 새로고침이 거절된다');

reset role;
update public.discovery_snapshot set generated_at = now() - interval '6 minutes'
where user_id = (select uid from me);

set local role authenticated;
select set_config('request.jwt.claims', tests.claims((select uid from me)), true);

select lives_ok(
  'select public.refresh_discovery_snapshot()',
  '5분이 지나면 새로 받는다');

/** 씨앗을 고를 수 있는 문은 **닫혀 있다** — 열려 있으면 노출 기록이 무엇을 잰 것인지 말할 수 없다 */
select throws_ok(
  format('select public.refresh_discovery_snapshot_for(%L, %L)', (select uid from me), 'mine'),
  '42501',
  null,
  '씨앗을 넣는 문은 authenticated 에게 닫혀 있다');

reset role;
select * from finish();
rollback;
