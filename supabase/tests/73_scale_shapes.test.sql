-- 규모를 줄인 세 자리가 **같은 답**을 내는가 (`20261107090000`)
--
-- 1. 덱 채우기는 점수의 네 항을 상대의 조각(일주 · 오행 요약 · 필요한 기운)마다 한 번 셈해 더한다. 조각을 잘못 짝지으면
--    점수가 남의 것이 된다 — `09_discovery_board` 는 여덟 글자와 필요한 기운이 모두 같은 사람들로 재므로 그 짝짓기를
--    못 본다. 여기서는 **셋을 다 다르게** 세우고, 덱의 위쪽 자리가 `discovery_preview_score_v2` 로 센 상위 컷 안에서
--    오는지 씨앗 여럿으로 잰다.
-- 2. 점수를 더하는 식은 한 곳(`discovery_preview_score_v2_of`)이다 — 두 문이 같은 비트를 내는지 모든 짝에 잰다.
-- 3. `discovery_unavailable` 은 짝 색인으로 묻는다 — 여섯 상태 × 두 방향에서 옛 뜻(살아 있는 셋만 막는다)과 같은지 잰다.
--
-- 대화방 목록이 내 방만 내는 것은 `34_chat` 이 잰다(남의 방이 있는 채로 김의 방 둘).
begin;
select plan(8);

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

/** 일간 · 필요한 기운 · 오행 요약이 사람마다 다르다 — 조각을 잘못 짝지으면 점수가 갈린다 */
create or replace function pg_temp.participant(mail text, i integer)
returns uuid
language plpgsql
as $$
declare
  uid uuid := tests.signup(mail);
  stems text[] := array['甲', '乙', '丙', '丁', '戊', '己', '庚', '辛', '壬', '癸'];
  elements text[] := array['木', '火', '土', '金', '水'];
begin
  perform set_config('request.jwt.claims', tests.claims(uid), true);
  perform tests.create_self_person(
    '나', 'solar', '1990-05-15', '1990-05-15', '14:30', 'female', '서울', 'jo', 'localMean',
    tests.chart(stems[1 + (i * 7) % 10]), 'chart-for-tests');
  perform tests.set_discovery_participation(true, pg_temp.summary(i * 5),
    tests.need(elements[1 + i % 5], elements[1 + (i / 5) % 5]));
  return uid;
end;
$$;

set local role authenticated;

create temporary table folks as
select i, pg_temp.participant('shape' || i || '@example.com', i) as uid
from generate_series(1, 26) as i;

reset role;

create temporary table me as select uid from folks where i = 1;

create temporary table pairs as
select
  other.user_id,
  mp.current_chart as a_chart, mine.element_summary as a_summary, mine.need_summary as a_need,
  tp.current_chart as b_chart, other.element_summary as b_summary, other.need_summary as b_need
from public.discovery_profile other
join public.app_user tu on tu.id = other.user_id
join public.person tp on tp.id = tu.self_person_id
cross join public.discovery_profile mine
join public.app_user mu on mu.id = mine.user_id
join public.person mp on mp.id = mu.self_person_id
where mine.user_id = (select uid from me)
  and other.user_id in (select uid from folks where i <> 1);

create temporary table scores as
select p.user_id,
  public.discovery_preview_score_v2(p.a_chart, p.a_summary, p.a_need, p.b_chart, p.b_summary, p.b_need) as score,
  row_number() over (order by
    public.discovery_preview_score_v2(p.a_chart, p.a_summary, p.a_need, p.b_chart, p.b_summary, p.b_need) desc,
    p.user_id) as rnk
from pairs p;

-- 스물다섯이 후보다. 컷은 `ceil(25 * 0.2)` = 다섯.
select is((select count(*)::int from scores), 25, '후보 스물다섯이 선다');

select cmp_ok(
  (select count(distinct score)::int from scores), '>=', 15,
  '점수가 넓게 갈린다 — 일간 · 필요한 기운 · 오행 요약이 저마다 움직인다');

-- ── 1. 덱의 위쪽 자리는 같은 점수로 센 컷 안에서 온다 ─────────────────────────

/*
  덱은 한 세대만 남으므로 세울 때마다 앞의 것이 지워진다 — 씨앗마다 세운 덱을 곧바로 옮겨 적는다.
*/
create temporary table seen (seed text, candidate uuid, exploration boolean);

do $$
declare
  s text;
  made uuid;
begin
  foreach s in array array['shape-a', 'shape-b', 'shape-c', 'shape-d', 'shape-e', 'shape-f'] loop
    made := public.refresh_discovery_snapshot_for((select uid from me), s);
    insert into seen
    select s, slot.candidate_user_id, slot.exploration
    from public.discovery_candidate_slot slot where slot.snapshot_id = made;
  end loop;
end;
$$;

select is((select count(*)::int from seen), 36, '씨앗 여섯 · 덱마다 여섯');

/** 컷이 다섯이라 위쪽 자리가 다섯을 넘으면 넘친 자리만 아래에서 채운다 — `09` 와 같은 단언을 덱마다 */
select is(
  (select count(*)::int from seen v join scores s on s.user_id = v.candidate
   where not v.exploration and s.rnk <= 5),
  (select sum(least(5, n))::int from (
     select count(*) as n from seen where not exploration group by seed) per_deck),
  '위쪽 자리는 조각마다 센 점수로도 같은 컷 안에서 먼저 온다');

select is(
  (select count(*)::int from seen v join scores s on s.user_id = v.candidate
   where v.exploration and s.rnk <= 5),
  0,
  '탐색은 컷 밖에서만 온다');

/** 카드에 적은 보완 · 균형은 자리에 앉는 사람에게만 셈하지만 값은 같은 함수의 것이다 */
select is(
  (select count(*)::int from public.discovery_impression i join pairs p on p.user_id = i.candidate_user_id
   where i.viewer_user_id = (select uid from me)
     and (i.complement is distinct from public.discovery_need_complement_v2(p.a_need, p.a_summary, p.b_need, p.b_summary)
       or i.combined_balance is distinct from public.discovery_count_balance_v1(p.a_summary, p.b_summary)
       or i.supplied_elements is distinct from public.discovery_supplied_elements_v1(p.a_summary, p.b_summary))),
  0,
  '노출 기록의 보완 · 균형 · 채워 주는 오행이 그 사람의 값이다');

-- ── 2. 더하는 식은 한 곳 ──────────────────────────────────────────────────────

select is(
  (select count(*)::int from pairs p
   where public.discovery_preview_score_v2(p.a_chart, p.a_summary, p.a_need, p.b_chart, p.b_summary, p.b_need)
     is distinct from public.discovery_preview_score_v2_of(
       public.discovery_day_pillar_axis_v2(p.a_chart, p.b_chart),
       public.discovery_need_direction_v2_float(p.a_need, p.b_summary),
       public.discovery_need_direction_v2_float(p.b_need, p.a_summary),
       public.discovery_count_balance_v2_float(p.a_summary, p.b_summary))),
  0,
  '카드 점수와 네 항을 더하는 식이 모든 짝에 같은 비트다');

-- ── 3. 살아 있는 요청만 짝을 가린다 — 두 방향 ────────────────────────────────

create temporary table statuses as
select s.status, s.live
from (values ('pending', true), ('accepted', true), ('rejected', true),
             ('invalidated', false), ('cancelled', false), ('expired', false)) as s(status, live);

create temporary table verdicts (status text, direction text, unavailable boolean, live boolean);

do $$
declare
  s record;
  a uuid := (select uid from folks where i = 2);
  b uuid := (select uid from folks where i = 3);
  forward boolean;
  backward boolean;
begin
  for s in select * from statuses loop
    -- 요청 하나를 그 상태로 세운다 — 트리거(풀이권)는 여기서 재는 것이 아니다
    set local session_replication_role = replica;
    insert into public.match_request (requester_user_id, addressee_user_id, status, policy_version,
      supplied_to_requester, supplied_to_addressee, balance_band, decided_at)
    values (a, b, s.status, 'v2-beta', array[]::text[], array[]::text[], 'balanced',
      case when s.status = 'pending' then null else now() end);
    set local session_replication_role = origin;

    forward := public.discovery_unavailable(a, b);
    backward := public.discovery_unavailable(b, a);
    insert into verdicts values (s.status, 'a→b', forward, s.live), (s.status, 'b→a', backward, s.live);

    delete from public.match_request where requester_user_id = a and addressee_user_id = b;
  end loop;
end;
$$;

select is(
  (select array_agg(status || ' ' || direction order by status, direction) from verdicts
   where unavailable is distinct from live),
  null,
  '대기 · 수락 · 거절만 두 방향 모두 짝을 가리고, 무효 · 취소 · 만료는 안 가린다');

select * from finish();
rollback;
