-- 카드 점수와 사진 자리의 **불변식**을 표 밖에서 잰다 (ADR 0113 · G-60)
--
-- `60_card_score_v2` 와 `61_profile_photos` 는 고른 줄을 잰다. 여기서는 고르지 않은 입력 전부나 섞은 차례에서도
-- 성질이 서는지를 잰다.
--
--   1. 일주 · 일지 축 — 60갑자 × 60갑자 3,600 쌍 전부에서 대칭이고 25 ~ 90 안이다
--   2. 카드 점수 — 같은 3,600 쌍에서 두 사람에게 같은 수이고, 반올림한 수가 0 ~ 100 안이다
--   3. 사진 자리 — 올리기 · 지우기 · 옮기기 · 대표 바꾸기 · 전부 내리기를 섞은 이백 걸음 뒤에도 매 걸음
--      자리가 1..k 이고, 순서가 모형(배열 하나)과 같다
begin;
select plan(6);

-- ── 1 · 2. 60갑자 전부 ───────────────────────────────────────────────────────

/** 60갑자와 그 순번 — 천간과 지지가 함께 한 칸씩 간다 */
create temporary table jiazi as
select i,
  (array['甲','乙','丙','丁','戊','己','庚','辛','壬','癸'])[i % 10 + 1] as stem,
  (array['子','丑','寅','卯','辰','巳','午','未','申','酉','戌','亥'])[i % 12 + 1] as branch
from generate_series(0, 59) as i;

/**
 * 한 사람 몫 — 순번에서 오행 개수와 필요한 기운을 지어 둔다. 셋째마다 여섯 글자(시각 모름)다.
 * 점수의 세 축이 모두 움직이도록 개수 · 1순위 · 가장 무거운 기운을 순번마다 다르게 한다.
 */
create temporary table side as
select j.i,
  jsonb_build_object('day', jsonb_build_object('stem', j.stem, 'branch', j.branch)) as chart,
  jsonb_build_object(
    'glyphCount', case when j.i % 3 = 0 then 6 else 8 end,
    'counts', jsonb_build_object(
      '木', c[1], '火', c[2], '土', c[3], '金', c[4], '水', c[5]),
    'ratios', jsonb_build_object('木', 0.2, '火', 0.2, '土', 0.2, '金', 0.2, '水', 0.2)) as summary,
  tests.need(
    (array['木','火','土','金','水'])[j.i % 5 + 1],
    (array['木','火','土','金','水'])[(j.i / 5) % 5 + 1]) as need
from jiazi j
cross join lateral (
  select case when j.i % 3 = 0
    then array[(j.i % 3), 1 + (j.i % 2), 1, 2 - (j.i % 2), 2]
    else array[1 + (j.i % 3), 2 - (j.i % 2), 1 + (j.i % 2), 1, 3 - (j.i % 3)]
  end as c
) counts;

select is(
  (select count(*)::int from side
   where (select sum(v::int) from jsonb_each_text(summary -> 'counts') as e(k, v))
         <> (summary ->> 'glyphCount')::int),
  0, '지어 둔 오행 개수의 합이 글자 수와 같다 — 시험 입력이 문을 지나는 모양이다');

create temporary table scored as
select a.i as ai, b.i as bi,
  public.discovery_day_pillar_axis_v2(a.chart, b.chart) as day_ab,
  public.discovery_day_pillar_axis_v2(b.chart, a.chart) as day_ba,
  public.discovery_preview_score_v2(a.chart, a.summary, a.need, b.chart, b.summary, b.need) as score_ab,
  public.discovery_preview_score_v2(b.chart, b.summary, b.need, a.chart, a.summary, a.need) as score_ba
from side a cross join side b;

select is((select count(*)::int from scored), 3600, '60갑자 × 60갑자 3,600 쌍을 모두 잰다');

select is(
  (select count(*)::int from scored
   where day_ab is null or day_ab <> day_ba or day_ab < 25 or day_ab > 90),
  0, '일주 · 일지 축은 모든 쌍에서 대칭이고 25 ~ 90 안이다');

select is(
  (select count(*)::int from scored
   where score_ab is null or score_ab <> score_ba
      or round(score_ab) < 0 or round(score_ab) > 100),
  0, '카드 점수는 모든 쌍에서 두 사람에게 같은 수이고 0 ~ 100 안이다');

-- ── 3. 사진 자리 — 섞은 이백 걸음 ────────────────────────────────────────────

create temporary table who as select tests.signup('mix-photos@example.com') as uid;

/**
 * 걸음을 섞어 두고 매 걸음 뒤에 표를 모형과 견준다. 틀린 걸음 수를 돌려준다.
 *
 * 모형은 사진 이름의 배열 하나다 — 올리면 뒤에 붙고, 지우면 빠지고, 옮기면 그 자리로 끼어들고(사이가 밀린다),
 * 대표를 바꾸면 첫 칸이 바뀌고(없으면 첫 칸에 선다), 전부 내리면 빈다. 문은 `authenticated` 로 부르고
 * 표는 소유자로 읽는다 — 표는 아무에게도 안 열려 있다.
 */
create or replace function pg_temp.mixed_steps(p_uid uuid, p_steps integer)
returns integer
language plpgsql
as $$
declare
  model text[] := array[]::text[];
  label text;
  roll double precision;
  n integer;
  f integer;
  t integer;
  moved text;
  wrong integer := 0;
  seen text;
  positions integer[];
begin
  perform setseed(0.2026);
  for step in 1..p_steps loop
    n := coalesce(array_length(model, 1), 0);
    label := 'p' || step;
    roll := random();

    perform set_config('role', 'authenticated', true);
    perform set_config('request.jwt.claims', tests.claims(p_uid), true);

    if roll < 0.35 then
      if n < 6 then
        perform public.add_my_photo('image/png', encode(convert_to(label, 'UTF8'), 'base64'));
        model := model || label;
      else
        begin
          perform public.add_my_photo('image/png', encode(convert_to(label, 'UTF8'), 'base64'));
          wrong := wrong + 1;  -- 일곱째 장이 앉았다
        exception when sqlstate '22023' then
          null;
        end;
      end if;
    elsif roll < 0.55 then
      f := 1 + floor(random() * (n + 1))::integer;  -- 가끔 없는 자리(n + 1)를 지운다
      perform public.remove_my_photo(f);
      if f <= n then
        model := model[1:f - 1] || model[f + 1:n];
      end if;
    elsif roll < 0.85 then
      if n > 0 then
        f := 1 + floor(random() * n)::integer;
        t := 1 + floor(random() * n)::integer;
        perform public.move_my_photo(f, t);
        moved := model[f];
        model := model[1:f - 1] || model[f + 1:n];
        model := model[1:t - 1] || moved || model[t:n - 1];
      end if;
    elsif roll < 0.95 then
      perform public.set_my_photo('image/webp', encode(convert_to(label, 'UTF8'), 'base64'));
      if n = 0 then
        model := array[label];
      else
        model[1] := label;
      end if;
    else
      perform public.clear_my_photo();
      model := array[]::text[];
    end if;

    perform set_config('role', 'postgres', true);

    select string_agg(convert_from(p.bytes, 'UTF8'), ',' order by p.position),
           array_agg(p.position::integer order by p.position)
      into seen, positions
    from public.profile_photo p where p.user_id = p_uid;

    if coalesce(seen, '') <> coalesce(array_to_string(model, ','), '')
       or coalesce(positions, array[]::integer[])
          <> coalesce((select array_agg(g) from generate_series(1, coalesce(array_length(model, 1), 0)) g),
                      array[]::integer[]) then
      wrong := wrong + 1;
    end if;
  end loop;
  return wrong;
end;
$$;

select is(pg_temp.mixed_steps((select uid from who), 200), 0,
  '섞은 이백 걸음 동안 매 걸음 자리는 1..k 이고 순서가 모형과 같다');

select ok(
  (select count(*) from public.profile_photo where user_id = (select uid from who)) between 0 and 6,
  '끝난 뒤에도 여섯 장을 넘지 않는다');

select * from finish();
rollback;
