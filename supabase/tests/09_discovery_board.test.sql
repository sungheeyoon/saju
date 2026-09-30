-- 오늘의 인연 덱 — **여섯 자리, 떠나면 바로 채운다** (ADR 0037 · ADR 0115)
--
-- 덱은 가중 무작위라 한 번의 뽑기에서 잴 수 있는 것은 구조다: 여섯인가 · 탐색은 컷 밖에서 왔는가 ·
-- 위쪽은 컷 안에서 먼저 왔는가 · 중복이 없는가 · 전부 자격이 있는가. 그리고 채우기: 넘기면 한 명이
-- 뒤에 붙는가 · 자격을 잃으면 채우는가 · 풀이 모자라면 주는가 · 비면 비는가.
--
-- **씨앗을 인자로 받는 닫힌 문**(`refresh_discovery_snapshot_for`)이 있어 「가중치대로 뽑혔는가」와
-- 「자리마다 20% 가 아래에서 오는가」도 잰다 — 같은 씨앗이면 같은 덱이므로 여러 씨앗으로 뽑아
-- 등장 횟수를 세면 된다. 그 문과 채우는 문은 `authenticated` 에게 닫혀 있고, 그것도 여기서 잰다.
begin;
select plan(45);

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
  perform tests.create_self_person(
    '나', 'solar', '1990-05-15', '1990-05-15', '14:30', 'female', '서울', 'jo', 'localMean',
  tests.chart(), 'chart-for-tests');
  perform public.save_my_profile(left(mail, 8), null);
  perform tests.set_discovery_participation(true, pg_temp.summary(i), tests.need());
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
update public.discovery_profile set opted_in_at = null, opted_out_at = now()
where user_id not in (select uid from folks);

create temporary table me as select uid from folks where i = 1;
grant select on me to authenticated;

/**
 * 기대 점수 — 셈을 베끼지 않는다.
 *
 * 줄 세우기가 부르는 같은 점수 함수(`discovery_preview_score_v2`, ADR 0113 연인용)를 부른다. 갈리면 둘 중
 * 하나가 바뀐 것이다. 여기 사람들은 여덟 글자와 필요한 기운 요약이 같아서(`tests.chart()` · `tests.need()`)
 * 점수를 가르는 것은 오행 요약이다 — 보완과 균형 두 축이 움직인다.
 */
create temporary table scores as
select
  other.user_id,
  public.discovery_preview_score_v2(
    mp.current_chart, mine.element_summary, mine.need_summary,
    tp.current_chart, other.element_summary, other.need_summary) as score,
  row_number() over (order by
    public.discovery_preview_score_v2(
      mp.current_chart, mine.element_summary, mine.need_summary,
      tp.current_chart, other.element_summary, other.need_summary) desc,
    other.user_id) as rnk
from public.discovery_profile other
join public.app_user tu on tu.id = other.user_id
join public.person tp on tp.id = tu.self_person_id
cross join public.discovery_profile mine
join public.app_user mu on mu.id = mine.user_id
join public.person mp on mp.id = mu.self_person_id
where mine.user_id = (select uid from me)
  and other.user_id in (select uid from folks where i <> 1);
grant select on scores to authenticated;

-- 스물넷이 후보다. 컷은 `ceil(24 * 0.2)` = 다섯.
select is((select count(*)::int from scores), 24, '후보 스물넷이 선다');


-- ── 덱의 모양 — 여섯 자리 ─────────────────────────────────────────────────────

create temporary table first_id as
select public.refresh_discovery_snapshot_for((select uid from me), 'seed-a') as id;

grant select on first_id to authenticated;

create temporary table board as
select * from public.discovery_candidate_slot where snapshot_id = (select id from first_id);

select is(
  (select policy_version from public.discovery_candidate where id = (select id from first_id)),
  'v2-beta',
  '새 덱은 v2-beta 정책을 기록한다');

select is((select count(*)::int from board), 6, '덱에는 여섯이 선다');

select is(
  (select array_agg(position order by position) from board),
  array[0, 1, 2, 3, 4, 5],
  '자리는 0부터 빈틈없이 매겨진다');

select is(
  (select count(distinct candidate_user_id)::int from board),
  6,
  '한 사람도 두 번 서지 않는다');

select is(
  (select count(*)::int from board where candidate_user_id = (select uid from me)),
  0,
  '자기 자신은 후보가 아니다');

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
 * **위쪽 자리는 컷에서 먼저 온다.** 컷이 다섯이라 위쪽 자리가 다섯을 넘으면 넘친 자리만 아래에서 채운다.
 */
select is(
  (select count(*)::int from board b join scores s on s.user_id = b.candidate_user_id
   where not b.exploration and s.rnk <= 5),
  (select least(5, count(*))::int from board where not exploration),
  '위쪽 자리는 컷 안에서 먼저 채운다');

/** 탐색 자리는 새로 채우는 자리들 사이에 선다 — 맨 앞에 서지 않는다 */
select is(
  (select count(*)::int from board where exploration and position = 0),
  0,
  '탐색 자리는 맨 앞에 서지 않는다');

-- ── 기록이 목록과 **정확히 같다** ─────────────────────────────────────────────

select is(
  (select array_agg(candidate_user_id order by position) from public.discovery_impression
   where viewer_user_id = (select uid from me)),
  (select array_agg(candidate_user_id order by position) from board),
  '노출 기록의 후보와 차례가 덱과 같다');

select is(
  (select array_agg(exploration order by position) from public.discovery_impression
   where viewer_user_id = (select uid from me)),
  (select array_agg(exploration order by position) from board),
  '탐색 여부도 덱과 같다');

-- ── 씨앗 ──────────────────────────────────────────────────────────────────────

/*
  뽑아 두고 나서 읽는다. 볼러틸 함수가 심은 행은 **그 행을 심은 질의 자신에게는 안
  보인다** — 읽는 자리와 만드는 자리를 한 문장에 두면 언제나 NULL 이 나온다.
*/
create temporary table again as
select public.refresh_discovery_snapshot_for((select uid from me), 'seed-a') as id;

select is(
  (select array_agg(candidate_user_id order by position)
   from public.discovery_candidate_slot where snapshot_id = (select id from again)),
  (select array_agg(candidate_user_id order by position) from board),
  '같은 씨앗이면 같은 덱이다');

select is(
  (select count(*)::int from public.discovery_candidate where user_id = (select uid from me)),
  1,
  '덱은 한 세대만 남는다 — 이어지므로 「직전」이 없다');

/**
 * **씨앗 다섯 중 하나라도 다른 덱을 내면 씨앗이 덱을 정한다.**
 *
 * 다른 씨앗 하나('seed-b')와만 견줬을 때 main CI 에서 한 번 같은 덱(같은 차례)이 나와 붉었다(2026-09-28,
 * 659b936). 로컬에서 씨앗 이천 개로 덱을 세워 두 씨앗이 같은 덱을 낼 확률을 재면 판마다 1만분의 1 안팎이었다
 * (2026-09-29, 세 판). 다섯이 모두 'seed-a' 와 같을 확률은 그 다섯제곱쯤이다. 씨앗을 무시하면 다섯 모두 같아 붉는다.
 */
create temporary table other_seeds (seed text, deck uuid[]);
do $$
declare
  actor uuid := (select uid from me);
  s text;
  made uuid;
begin
  foreach s in array array['seed-b', 'seed-c', 'seed-d', 'seed-e', 'seed-f'] loop
    made := public.refresh_discovery_snapshot_for(actor, s);
    insert into other_seeds
    select s, array_agg(candidate_user_id order by position)
    from public.discovery_candidate_slot where snapshot_id = made;
  end loop;
end
$$;

select ok(
  exists (
    select 1 from other_seeds
    where deck is distinct from (select array_agg(candidate_user_id order by position) from board)),
  '씨앗이 다르면 덱이 달라진다 — 다른 씨앗 다섯 중 하나라도');

-- ── 가중치 — **점수가 높을수록 자주 뽑힌다** ──────────────────────────────────

/**
 * 씨앗 삼천 개로 덱을 세워 등장 횟수를 센다. 새 덱은 늘 빈 자리에서 여섯을 뽑으므로 앞 덱이 결과를 안 깎는다.
 * 삼천인 까닭은 아래 「컷을 걷어 내도」다 — 그 검사가 세는 자리는 덱마다 네에 하나꼴로만 선다.
 */
create temporary table draws (user_id uuid, exploration boolean, position integer);
do $$
declare
  actor uuid := (select uid from me);
  s integer;
  made uuid;
begin
  for s in 1..3000 loop
    made := public.refresh_discovery_snapshot_for(actor, 'weights-' || s);
    insert into draws
    select candidate_user_id, exploration, position
    from public.discovery_candidate_slot where snapshot_id = made;
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
 * 위의 검사는 상위 컷이 늘 뽑히는 것만으로도 통과한다. 컷 밖에서 채워지는 위쪽 자리만
 * 따로 세면 남는 것은 가중 무작위 하나다 — 그 자리도 점수를 따라야 한다.
 *
 * 그 자리는 여섯 동전이 모두 위쪽일 때(0.8⁶ ≈ 26%)의 여섯째 한 자리뿐이라 삼천 덱에 780 안팎이다. **점수로 가른
 * 두 무리의 한 사람당 등장**을 견준다 — 컷 밖에서 점수 50 이상(여섯 안팎)과 40 미만(여덟 안팎). 점수 차이가
 * 1.5 배쯤이라 기대 차이는 표준편차의 네 배를 넘는다. 전에는 천 덱 · 컷 밖을 순위로 반 갈라 아홉과 열을 견줬고,
 * 사용자 id 가 매번 무작위라 CI 에서 한 번 뒤집혔다(2026-09-27, 로컬 여섯 판 중 한 판 127 대 132).
 */
select cmp_ok(
  (select count(*)::numeric / nullif((select count(*) from scores where rnk > 5 and score >= 50), 0)
   from draws d join scores s on s.user_id = d.user_id
   where not d.exploration and s.rnk > 5 and s.score >= 50),
  '>',
  (select count(*)::numeric / nullif((select count(*) from scores where rnk > 5 and score < 40), 0)
   from draws d join scores s on s.user_id = d.user_id
   where not d.exploration and s.rnk > 5 and s.score < 40),
  '컷 밖에서도 점수가 높은 쪽이 더 자주 채워진다');

/**
 * **자리마다 20% 가 아래에서 온다** — 옛 「열에 둘」과 같은 몫. 여섯 자리 삼천 덱이면 탐색은 3600 안팎이다
 * (이항분포의 표준편차는 약 54). 넓게 잡아 15~25% 를 잰다.
 */
select ok(
  (select avg(case when exploration then 1.0 else 0.0 end) between 0.15 and 0.25 from draws),
  '자리마다 다섯에 하나꼴로 잘라 낸 아래에서 온다');

-- ── 넘기면 채워진다 ──────────────────────────────────────────────────────────

create temporary table deck_before as
select candidate_user_id, position from public.discovery_candidate_slot
where snapshot_id = (select id from public.discovery_candidate where user_id = (select uid from me));
grant select on deck_before to authenticated;

create temporary table impressions_before as
select count(*)::int as n from public.discovery_impression where viewer_user_id = (select uid from me);
grant select on impressions_before to authenticated;

/** 앱이 넘기는 길 그대로 — `discovery_passed` 에 한 줄 */
insert into public.discovery_passed (user_id, passed_user_id)
select (select uid from me), candidate_user_id from deck_before order by position limit 1;

set local role authenticated;
select set_config('request.jwt.claims', tests.claims((select uid from me)), true);

create temporary table after_pass as select * from public.my_discovery_board();

reset role;

select is((select count(*)::int from after_pass), 6, '한 명을 넘기면 풀에서 한 명이 채워 여섯이 된다');

select is(
  (select array_agg(candidate_user_id order by seat) from (select * from after_pass order by seat limit 5) f),
  (select array_agg(candidate_user_id order by position) from (select * from deck_before order by position offset 1) b),
  '남은 다섯은 차례 그대로 앞에 선다');

select is(
  (select count(*)::int from after_pass a
   where a.seat = (select max(seat) from after_pass)
     and a.candidate_user_id not in (select candidate_user_id from deck_before)),
  1,
  '새 사람은 덱 맨 뒤에 붙는다');

select is(
  (select count(*)::int from public.discovery_impression where viewer_user_id = (select uid from me)),
  (select n + 1 from impressions_before),
  '노출 기록은 새로 붙은 한 사람만 더 적는다');

set local role authenticated;
select set_config('request.jwt.claims', tests.claims((select uid from me)), true);

select is(
  (select array_agg(candidate_user_id order by seat) from public.my_discovery_board()),
  (select array_agg(candidate_user_id order by seat) from after_pass),
  '자리가 차 있으면 읽기는 뽑지 않는다 — 두 번 열어도 같은 덱이다');

reset role;

select is(
  (select count(*)::int from after_pass a where not public.discovery_eligible((select uid from me), a.candidate_user_id)),
  0,
  '채운 사람도 자격 규칙을 지난 사람이다');

/** 그 사이 자격을 잃은 사람도 떠난 사람이다 — 자리를 채운다 */
update public.discovery_profile set opted_in_at = null, opted_out_at = now()
where user_id = (select candidate_user_id from after_pass order by seat limit 1);

set local role authenticated;
select set_config('request.jwt.claims', tests.claims((select uid from me)), true);
create temporary table after_leave as select * from public.my_discovery_board();
reset role;

select is(
  (select count(*)::int from after_leave),
  6,
  '그 사이 자격을 잃은 사람은 빠지고 자리는 채워진다');

select is(
  (select count(*)::int from after_leave where candidate_user_id = (select candidate_user_id from after_pass order by seat limit 1)),
  0,
  '자격을 잃은 사람은 덱에 없다');

/** 스물네 시간이 지나도 덱을 갈아엎지 않는다 — 떠나는 사람만큼만 바뀐다 */
update public.discovery_candidate set generated_at = now() - interval '25 hours'
where user_id = (select uid from me);

set local role authenticated;
select set_config('request.jwt.claims', tests.claims((select uid from me)), true);

select is(
  (select array_agg(candidate_user_id order by seat) from public.my_discovery_board()),
  (select array_agg(candidate_user_id order by seat) from after_leave),
  '스물네 시간이 지나도 덱은 그대로다');

-- ── 되돌리면 잠시 일곱 ───────────────────────────────────────────────────────

select lives_ok(
  format('select public.restore_passed_connection(%L)',
    (select candidate_user_id from deck_before order by position limit 1)),
  '넘긴 사람을 되돌린다');

select is(
  (select count(*)::int from public.my_discovery_board()),
  7,
  '되돌린 사람이 맨 앞에 서고 덱은 잠시 일곱이다 — 아무도 말없이 빠지지 않는다');

reset role;

-- ── 풀이 모자라면 줄고, 비면 빈 목록 ─────────────────────────────────────────

/** 나 말고 셋만 풀에 남긴다 */
update public.discovery_profile set opted_in_at = null, opted_out_at = now()
where user_id in (select user_id from scores where rnk > 3);

create temporary table few as
select count(*)::int as n from scores s
where s.rnk <= 3 and public.discovery_eligible((select uid from me), s.user_id);
grant select on few to authenticated;

select cmp_ok((select n from few), '<', 6, '풀에 남은 사람이 여섯보다 적다');

set local role authenticated;
select set_config('request.jwt.claims', tests.claims((select uid from me)), true);

select is(
  (select count(*)::int from public.my_discovery_board()),
  (select n from few),
  '풀에 더 올 사람이 없으면 덱은 여섯보다 줄어든다');

reset role;
update public.discovery_profile set opted_in_at = null, opted_out_at = now()
where user_id in (select user_id from scores);

set local role authenticated;
select set_config('request.jwt.claims', tests.claims((select uid from me)), true);

select is((select count(*)::int from public.my_discovery_board()), 0, '풀이 비면 덱도 빈다');

reset role;
update public.discovery_profile set opted_in_at = now(), opted_out_at = null
where user_id in (select user_id from scores);

set local role authenticated;
select set_config('request.jwt.claims', tests.claims((select uid from me)), true);

select is(
  (select count(*)::int from public.my_discovery_board()),
  6,
  '풀에 사람이 돌아오면 다음에 읽을 때 다시 여섯이다');

-- ── 옛 앱의 새로고침 문 — 좁히기로 걷었다 (G-61) ─────────────────────────────

reset role;
select hasnt_function('public', 'refresh_discovery_snapshot', array[]::name[],
  '사람이 누르는 새로고침 문은 없다 — 덱은 떠나는 만큼 채운다');
select hasnt_function('public', 'my_discovery_snapshot', array[]::name[],
  '새로고침 단추의 남은 대기를 내주던 문도 없다');
select hasnt_function('public', 'discovery_refresh_cooldown', array[]::name[],
  '5분 쿨다운도 없다');

update public.discovery_candidate set policy_version = 'discovery-v1'
where user_id = (select uid from me);

set local role authenticated;
select set_config('request.jwt.claims', tests.claims((select uid from me)), true);
create temporary table upgraded as select * from public.my_discovery_board();

reset role;
select is(
  (select policy_version from public.discovery_candidate where user_id = (select uid from me)
   order by seq desc limit 1),
  'v2-beta',
  '이전 정책 덱은 읽을 때 즉시 다시 만든다');

set local role authenticated;
select set_config('request.jwt.claims', tests.claims((select uid from me)), true);

/** 씨앗을 고를 수 있는 문은 **닫혀 있다** — 열려 있으면 노출 기록이 무엇을 잰 것인지 말할 수 없다 */
select throws_ok(
  format('select public.refresh_discovery_snapshot_for(%L, %L)', (select uid from me), 'mine'),
  '42501',
  null,
  '씨앗을 넣는 문은 authenticated 에게 닫혀 있다');

select throws_ok(
  format('select public.fill_discovery_deck(%L, %L, %L)', (select uid from me), (select id from first_id), 'mine'),
  '42501',
  null,
  '채우는 문도 authenticated 에게 닫혀 있다');

reset role;

/** 아래 절은 지나친 기록을 처음부터 쌓는다 */
delete from public.discovery_passed where user_id = (select uid from me);

-- ── 지나친 인연 — **영구 숨김과 다른 수명** ────────────────────────────────────
--
-- 스물과 24시간은 다른 것을 잰다. 스물은 사용자가 다시 꺼내 볼 수 있는 목록의 길이이고,
-- 24시간은 그 목록 밖으로 밀려난 사람이 다시 후보가 되기까지의 대기다. 그래서 여기서
-- 재는 것은 **세 자리**다: 스물 안 · 스물 밖이지만 24시간 안 · 둘 다 아닌 자리.

/**
 * **지금 실제로 후보인 사람을 고른다.**
 *
 * 앞 블록이 「그 사이 자격을 잃은 사람」을 재려고 한 명의 참여를 꺼 둔다. 점수 순으로
 * 첫 사람을 집으면 그 줄과 겹칠 수 있고, 그러면 이 시험은 **지나치기와 무관한 이유로**
 * 빨개진다 — 재려는 것은 지나치기가 후보 자격을 어떻게 바꾸는가다.
 */
-- 앞 절이 참여를 끈 한 명을 되살려, 이 절에서는 표시 상한만 잰다.
update public.discovery_profile set opted_in_at = now(), opted_out_at = null
where user_id in (select user_id from scores);

create temporary table passer as
select user_id from scores
where public.discovery_eligible((select uid from me), user_id)
order by rnk limit 1;

select is(
  public.discovery_eligible((select uid from me), (select user_id from passer)),
  true,
  '지나치기 전에는 후보다');

insert into public.discovery_passed (user_id, passed_user_id)
values ((select uid from me), (select user_id from passer));

select is(
  public.discovery_eligible((select uid from me), (select user_id from passer)),
  false,
  '지나친 사람은 후보에서 빠진다');

/** 스물 안에 있으면 **시간과 무관하다** — 목록에 서 있는 사람을 추천하지 않는다 */
update public.discovery_passed set passed_at = now() - interval '30 days'
where user_id = (select uid from me) and passed_user_id = (select user_id from passer);

select is(
  public.discovery_eligible((select uid from me), (select user_id from passer)),
  false,
  '스물 안이면 30일이 지나도 추천하지 않는다');

/**
 * **스물 밖으로 민다.** 이 사람보다 최근에 지나친 사람을 스물 채우면 목록에서 밀려난다.
 * 그래도 마지막 넘김에서 24시간이 안 지났으면 아직 후보가 아니다 — 이 조건이 없으면
 * 스물한 번째를 넘기는 순간 가장 오래된 사람이 바로 다음 카드로 선다.
 */
update public.discovery_passed set passed_at = now() - interval '2 hours'
where user_id = (select uid from me) and passed_user_id = (select user_id from passer);

insert into public.discovery_passed (user_id, passed_user_id, passed_at)
select (select uid from me), user_id, now() - interval '1 hour'
from scores where user_id <> (select user_id from passer) order by rnk limit 20;

select is(
  (select count(*)::int from public.discovery_passed where user_id = (select uid from me)),
  21,
  '스물하나가 쌓였다 — 하나는 목록 밖이다');

select is(
  public.discovery_eligible((select uid from me), (select user_id from passer)),
  false,
  '스물 밖이어도 24시간이 안 지났으면 추천하지 않는다');

/** 스물 밖이고 24시간도 지났다 — **기록이 남아 있어도 후보로 돌아온다** */
update public.discovery_passed set passed_at = now() - interval '25 hours'
where user_id = (select uid from me) and passed_user_id = (select user_id from passer);

select is(
  public.discovery_eligible((select uid from me), (select user_id from passer)),
  true,
  '스물 밖이고 24시간이 지나면 다시 후보가 된다');

-- ── 보관함을 읽는 문 ─────────────────────────────────────────────────────────

set local role authenticated;
select set_config('request.jwt.claims', tests.claims((select uid from me)), true);

/**
 * **최근 순으로 스물까지.** 스물하나를 쌓아도 스물만 낸다 — 목록의 길이는 읽을 때 자른다.
 * 이 호출이 서는 것으로 반환형이 맞는지도 함께 잰다.
 */
select is(
  (select count(*)::int from public.my_passed_connections()),
  20,
  '보관함은 최근 스물까지만 낸다');

reset role;
select * from finish();
rollback;
