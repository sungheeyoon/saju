-- 붉은 시험 — 머지하지 않는다. 발견 둘을 재어 보인다.
begin;
select plan(3);

-- ── 발견 1: 카드(SQL)와 풀이 기준점(TS)이 .5 에서 1점 갈린다 (여덟 글자 × 여섯 글자) ──
-- TS `previewScoreOf(…, { policy: 'romantic' })` 는 이 쌍에 53 을 낸다(부동소수 52.5 → Math.round).
-- SQL 은 numeric 나눗셈이 1/6 · 1/14 를 유한 자리에서 자르므로 52.4999…9990 → round 52.
select is(
  least(100, greatest(0, round(public.discovery_preview_score_v2(
    jsonb_build_object('day', jsonb_build_object('stem', '乙', 'branch', '亥')),
    jsonb_build_object('glyphCount', 8, 'counts', jsonb_build_object('木', 1, '火', 3, '土', 0, '金', 2, '水', 2)),
    tests.need('水', '火'),
    jsonb_build_object('day', jsonb_build_object('stem', '丙', 'branch', '申')),
    jsonb_build_object('glyphCount', 6, 'counts', jsonb_build_object('木', 2, '火', 1, '土', 0, '金', 1, '水', 2)),
    tests.need('木', '水')))))::integer,
  53, '乙亥(8글자) × 丙申(6글자) — TS 가 내는 53 과 같다');

-- ── 발견 2: 같은 자리를 두 번 지우면 둘째 누름이 다른 장을 지운다 ──
create temporary table who as select tests.signup('red-photos@example.com') as uid;
grant select on who to authenticated;
set local role authenticated;
select set_config('request.jwt.claims', tests.claims((select uid from who)), true);
select public.add_my_photo('image/png', encode(convert_to(x, 'UTF8'), 'base64')) from unnest(array['A', 'B', 'C']) x;
create temporary table stale as select version from public.my_photos() where position = 2;  -- 두 탭이 본 B
select public.remove_my_photo(2, (select version from stale));
select public.remove_my_photo(2, (select version from stale));  -- 둘째 탭 · 재시도가 같은 화면(2번 = B)을 보고 누른 것
reset role;
select is(
  (select string_agg(convert_from(bytes, 'UTF8'), ',' order by position)
   from public.profile_photo where user_id = (select uid from who)),
  'A,C', '같은 장을 지운 둘째 누름은 조용히 지나간다 — 함수 주석의 약속');

-- ── 발견 3: 전부 내리기(clear)는 계정 행을 안 잠근다 ──
-- 두 세션이 필요해 여기서는 모양만 잰다: 쓰는 문은 모두 lock_my_photos 를 지나야 한다.
select ok(
  (select prosrc ilike '%lock_my_photos%' or prosrc ilike '%for update%'
   from pg_proc where oid = 'public.clear_my_photo()'::regprocedure),
  'clear_my_photo 도 계정 행을 잠근다 — 올리기와 겹치면 1..k 가 깨진다');

select * from finish();
rollback;
