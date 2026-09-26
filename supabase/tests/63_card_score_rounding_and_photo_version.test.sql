-- 밤 리뷰(2026-09-26)의 붉은 발견 셋 — 고친 뒤에 초록이다 (`20261027090000`)
--
--   1. 카드 점수가 참값 .5 에서 TS(`previewScoreOf`)와 1점 갈렸다 — numeric 나눗셈 절단(乙亥 × 丙申: SQL 52 · TS 53).
--      소수 아홉째 자리 맞추기로는 TS 가 부동소수로 내리는 쌍(壬戌 × 辛未: TS 42)에서 거꾸로 갈린다 — 둘 다 잰다.
--      TS 가 같은 쌍에 같은 수를 내는지는 `60_card_score_v2` 의 표를 `scripts/card-score-sql.test.ts` 가 다시 잰다.
--   2. 같은 자리를 두 번 지우면 둘째 누름이 당겨 앉은 다른 장을 지웠다 — 판본(`p_version`)을 본다.
--      옮기기도 같다. 판본 없이 부르는 옛 앱은 앞처럼 자리만 본다.
--   3. 전부 내리기(`clear_my_photo`)가 계정 행을 안 잠가 올리기와 겹치면 자리가 벌어졌다.
--      두 세션이 필요한 경합 대신 **이 거래가 계정 행을 잠갔는가**(`xmax`)를 잰다.
begin;
select plan(14);

-- ── 1. 카드 점수 — .5 에서 TS 와 같은 쪽으로 ───────────────────────────────────

create or replace function pg_temp.score(
  a_day text, a_glyphs int, a_counts int[], a_need text,
  b_day text, b_glyphs int, b_counts int[], b_need text)
returns integer
language sql
as $$
  select least(100, greatest(0, round(public.discovery_preview_score_v2(
    jsonb_build_object('day', jsonb_build_object('stem', left(a_day, 1), 'branch', right(a_day, 1))),
    jsonb_build_object('glyphCount', a_glyphs, 'counts', jsonb_build_object(
      '木', a_counts[1], '火', a_counts[2], '土', a_counts[3], '金', a_counts[4], '水', a_counts[5])),
    tests.need(left(a_need, 1), right(a_need, 1)),
    jsonb_build_object('day', jsonb_build_object('stem', left(b_day, 1), 'branch', right(b_day, 1))),
    jsonb_build_object('glyphCount', b_glyphs, 'counts', jsonb_build_object(
      '木', b_counts[1], '火', b_counts[2], '土', b_counts[3], '金', b_counts[4], '水', b_counts[5])),
    tests.need(left(b_need, 1), right(b_need, 1))))))::integer;
$$;

select is(
  pg_temp.score('乙亥', 8, array[1, 3, 0, 2, 2], '水火', '丙申', 6, array[2, 1, 0, 1, 2], '木水'),
  53, '乙亥(8글자) × 丙申(6글자) — 참값 52.5, TS 가 내는 53 과 같다');

select is(
  pg_temp.score('壬戌', 6, array[1, 0, 2, 0, 3], '金土', '辛未', 6, array[0, 0, 3, 1, 2], '木土'),
  42, '壬戌 × 辛未 — 참값 42.5 를 TS 의 부동소수가 42.49999999999999 로 내린다, 카드도 42');

select is(
  public.discovery_preview_score_v2(
    '{"day":{"stem":"壬","branch":"戌"}}', '{"glyphCount":6,"counts":{"木":1,"火":0,"土":2,"金":0,"水":3}}',
    tests.need('金', '土'),
    '{"day":{"stem":"辛","branch":"未"}}', '{"glyphCount":6,"counts":{"木":0,"火":0,"土":3,"金":1,"水":2}}',
    tests.need('木', '土')),
  42.49999999999999::numeric,
  '반올림 전 수도 TS 의 부동소수를 가장 짧게 적은 수와 같다');

select ok(
  (select array_agg(p.proconfig) from pg_proc p
   where p.oid = 'public.discovery_preview_score_v2(jsonb, jsonb, jsonb, jsonb, jsonb, jsonb)'::regprocedure)::text
    like '%extra_float_digits=3%',
  '부르는 세션의 extra_float_digits 가 0 이어도 점수는 가장 짧은 자리수로 옮겨진다');

-- ── 2. 지우기 · 옮기기 — 판본 ───────────────────────────────────────────────

create temporary table who as
select tests.signup('version-photos@example.com') as uid,
       tests.signup('clear-lock-photos@example.com') as quiet;
grant select on who to authenticated;

create or replace function pg_temp.order_of(uid uuid)
returns text
language sql
security definer
as $$
  select coalesce(string_agg(convert_from(bytes, 'UTF8'), ',' order by position), '')
  from public.profile_photo where user_id = uid;
$$;

set local role authenticated;
select set_config('request.jwt.claims', tests.claims((select uid from who)), true);
select public.add_my_photo('image/png', encode(convert_to(x, 'UTF8'), 'base64'))
from unnest(array['A', 'B', 'C', 'D']) x;

create temporary table seen as select * from public.my_photos();  -- 두 탭이 본 목록

select public.remove_my_photo(2, (select version from seen where position = 2));
select public.remove_my_photo(2, (select version from seen where position = 2));  -- 둘째 탭 · 재시도
reset role;
select is(pg_temp.order_of((select uid from who)), 'A,C,D',
  '같은 장을 지운 둘째 누름은 조용히 지나간다 — 당겨 앉은 C 가 남는다');

set local role authenticated;
select set_config('request.jwt.claims', tests.claims((select uid from who)), true);
select is(
  (select version from public.my_photos() where position = 2),
  (select version from seen where position = 3),
  '판본은 그 장을 따라간다 — 당겨 앉은 C 의 판본은 앞과 같다');

select throws_ok(
  $$select public.move_my_photo(1, 3, (select version from seen where position = 2))$$,
  '22023', '사진을 옮기지 못했습니다.',
  '1번에 없는 장(B)의 판본으로는 못 옮긴다 — 화면이 목록을 다시 받는다');
reset role;
select is(pg_temp.order_of((select uid from who)), 'A,C,D', '거절된 옮기기는 아무 장도 안 움직인다');

set local role authenticated;
select set_config('request.jwt.claims', tests.claims((select uid from who)), true);
select public.move_my_photo(3, 1, (select version from seen where position = 4));
reset role;
select is(pg_temp.order_of((select uid from who)), 'D,A,C', '맞는 판본이면 옮긴다');

set local role authenticated;
select set_config('request.jwt.claims', tests.claims((select uid from who)), true);
select public.remove_my_photo(p_position => 1);                  -- 옛 앱 — 판본 없이 자리만
select public.move_my_photo(p_from => 2, p_to => 1);             -- 옛 앱 — 판본 없이 자리만
reset role;
select is(pg_temp.order_of((select uid from who)), 'C,A',
  '판본 없이 부르는 옛 앱은 앞처럼 자리만 본다');

select ok(
  to_regprocedure('public.remove_my_photo(integer)') is null
    and to_regprocedure('public.move_my_photo(integer, integer)') is null,
  '옛 서명은 없다 — 같은 이름 인자의 호출에 후보가 하나다(PostgREST 가 PGRST203 으로 서지 않는다)');

select ok(
  not has_function_privilege('anon', 'public.remove_my_photo(integer, bigint)', 'execute')
    and not has_function_privilege('anon', 'public.move_my_photo(integer, integer, bigint)', 'execute')
    and has_function_privilege('authenticated', 'public.remove_my_photo(integer, bigint)', 'execute')
    and has_function_privilege('authenticated', 'public.move_my_photo(integer, integer, bigint)', 'execute'),
  '새 서명 둘은 로그인한 사람만 부른다');

select ok(
  not has_function_privilege('authenticated', 'public.profile_photo_version(timestamptz)', 'execute')
    and not has_function_privilege('authenticated', 'public.discovery_need_direction_v2_float(jsonb, jsonb)', 'execute')
    and not has_function_privilege('authenticated', 'public.discovery_count_balance_v2_float(jsonb, jsonb)', 'execute'),
  '안에서만 쓰는 새 함수 셋은 로그인한 사람도 못 부른다');

-- ── 3. 전부 내리기 — 계정 행을 잠근다 ───────────────────────────────────────

set local role authenticated;
select set_config('request.jwt.claims', tests.claims((select quiet from who)), true);
select public.clear_my_photo();
reset role;
select ok(
  (select u.xmax = pg_current_xact_id()::xid from public.app_user u where u.id = (select quiet from who)),
  '전부 내리기가 이 거래에서 계정 행을 잠갔다 — 올리기와 같은 잠금을 기다린다');

select * from finish();
rollback;
