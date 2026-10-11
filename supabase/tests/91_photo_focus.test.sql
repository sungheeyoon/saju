-- 사진의 보일 자리 (`20261203090000`, G-98)
--
-- 여기서 재는 것 다섯.
--
-- 1. **있던 장 · 새 장은 가운데(50 · 50)다** — 지금과 같다
-- 2. **정한 자리만 바뀐다** — 판본(그림 주소의 `?v=`)과 하루 올리기 한도는 그대로다
-- 3. **화면이 본 그 장이 아니면 · 칸 밖의 수면 거절한다.** 남의 장은 못 바꾼다
-- 4. **자리는 장을 따라간다** — 옮겨도 그 장의 자리이고, 바꾸면(새 바이트) 가운데로 돌아온다
-- 5. **읽는 문들이 같은 모양으로 낸다** — 덱 · 받은 요청 · 맺은 인연 · 대화방이 `[x1, y1, x2, y2, …]`. 끝난 요청은 빈 배열
--
-- 문을 지우거나 읽는 문의 새 칸을 빼면 2 · 5 가 붉다.
begin;
select plan(18);

create or replace function pg_temp.summary(w int, f int, e int, g int, s int)
returns jsonb
language sql
as $$
  select jsonb_build_object(
    'glyphCount', w + f + e + g + s,
    'counts', jsonb_build_object('木', w, '火', f, '土', e, '金', g, '水', s),
    'ratios', jsonb_build_object(
      '木', w / 8.0, '火', f / 8.0, '土', e / 8.0, '金', g / 8.0, '水', s / 8.0));
$$;

create or replace function pg_temp.participant(mail text, who text, summary jsonb, day_stem text)
returns uuid
language plpgsql
as $$
declare
  uid uuid := tests.signup(mail);
begin
  perform set_config('request.jwt.claims', tests.claims(uid), true);
  perform tests.create_self_person(
    '나', 'solar', '1990-05-15', '1990-05-15', '14:30', 'female', '서울', 'jo', 'localMean',
    tests.chart(day_stem), 'chart-for-tests');
  perform public.save_my_profile(who, null);
  perform tests.set_discovery_participation(true, summary, tests.need());
  return uid;
end;
$$;

create or replace function pg_temp.acting(uid uuid)
returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claims', tests.claims(uid), true);
end;
$$;

create or replace function pg_temp.pic(label text)
returns text language sql as $$ select encode(convert_to(label, 'UTF8'), 'base64') $$;

/** 표가 아무에게도 안 열려 있으므로 세는 손잡이를 따로 둔다 */
create or replace function pg_temp.uploads(uid uuid)
returns bigint language sql security definer as $$
  select count(*) from public.profile_photo_upload u where u.user_id = uid
$$;

set local role authenticated;

create temporary table folks as
select
  pg_temp.participant('kim-photo-focus@example.com', '김초', pg_temp.summary(4, 4, 0, 0, 0), '丙') as kim,
  pg_temp.participant('lee-photo-focus@example.com', '이초', pg_temp.summary(0, 0, 4, 4, 0), '戊') as lee;
grant select on folks to authenticated;

create temporary table seen (label text primary key, version bigint);
grant select, insert, update on seen to authenticated;

reset role;

-- 다른 검사가 남긴 참여자는 이 시험의 관심 밖이다(`32_test_isolation` 의 그 문장).
update public.discovery_profile set opted_in_at = null, opted_out_at = now()
where user_id not in (select kim from folks union all select lee from folks);

set local role authenticated;
select pg_temp.acting((select kim from folks));

-- ── 1. 새 장은 가운데 ───────────────────────────────────────────────────────

select public.add_my_photo('image/png', pg_temp.pic('one'));
select public.add_my_photo('image/png', pg_temp.pic('two'));
select results_eq(
  $$select position, focus_x, focus_y from public.my_photos()$$,
  $$values (1, 50, 50), (2, 50, 50)$$,
  '1. 새 장은 가운데(50 · 50)다');

-- ── 2. 정한 자리만 바뀐다 ───────────────────────────────────────────────────

insert into seen select 'two', version from public.my_photos() where position = 2;
select lives_ok(
  format($$select public.set_my_photo_focus(2, 20, 80, %s)$$, (select version from seen where label = 'two')),
  '2. 화면이 본 그 장의 자리를 정한다');
select results_eq(
  $$select position, focus_x, focus_y from public.my_photos()$$,
  $$values (1, 50, 50), (2, 20, 80)$$,
  '2. 그 장의 자리만 바뀌었다');
select is((select version from public.my_photos() where position = 2), (select version from seen where label = 'two'),
  '2. 판본은 그대로다 — 바이트가 그대로라 그림 주소도 그대로다');
select is(pg_temp.uploads((select kim from folks)), 2::bigint, '2. 하루 올리기 한도를 안 센다');
select lives_ok($$select public.set_my_photo_focus(1, 0, 100)$$, '2. 판본을 모르면(`null`) 자리만으로 정한다 — 올린 직후');

-- ── 3. 거절 ────────────────────────────────────────────────────────────────

select throws_ok(
  $$select public.set_my_photo_focus(2, 30, 30, 1)$$,
  '22023', '위치를 저장하지 못했어요. 다시 시도해 주세요.',
  '3. 화면이 본 장이 아니면 거절한다');
select throws_ok(
  $$select public.set_my_photo_focus(2, 101, 30)$$,
  '22023', '위치를 저장하지 못했어요. 다시 시도해 주세요.',
  '3. 칸 밖의 수(0..100 밖)는 거절한다');
select throws_ok(
  $$select public.set_my_photo_focus(3, 30, 30)$$,
  '22023', '위치를 저장하지 못했어요. 다시 시도해 주세요.',
  '3. 없는 자리는 거절한다');

select pg_temp.acting((select lee from folks));
select throws_ok(
  $$select public.set_my_photo_focus(2, 30, 30)$$,
  '22023', '위치를 저장하지 못했어요. 다시 시도해 주세요.',
  '3. 다른 계정은 같은 자리로도 못 바꾼다');

-- ── 4. 자리는 장을 따라간다 ─────────────────────────────────────────────────

select pg_temp.acting((select kim from folks));
select public.move_my_photo(2, 1, (select version from seen where label = 'two'));
select results_eq(
  $$select position, focus_x, focus_y from public.my_photos()$$,
  $$values (1, 20, 80), (2, 0, 100)$$,
  '4. 옮겨도 그 장의 자리다');

-- ── 5. 읽는 문들 ───────────────────────────────────────────────────────────

select pg_temp.acting((select lee from folks));
select is(
  (select photo_focus from public.my_discovery_board() where candidate_user_id = (select kim from folks)),
  array[20, 80, 0, 100],
  '5. 덱 카드는 그 사람의 장마다 자리를 낸다');
select pg_temp.acting((select kim from folks));
select lives_ok($$select count(*) from public.my_discovery_board()$$, '5. 김이 후보 목록을 연다');
create temporary table asked as select public.request_match((select lee from folks)) as id;
grant select on asked to authenticated;

select pg_temp.acting((select lee from folks));
select is(
  (select counterpart_photo_focus from public.my_match_requests() where request_id = (select id from asked)),
  array[20, 80, 0, 100],
  '5. 답할 요청은 상대의 자리를 낸다');

select public.respond_to_match_request((select id from asked), true);
select is(
  (select partner_photo_focus from public.my_matches() where partner_user_id = (select kim from folks)),
  array[20, 80, 0, 100],
  '5. 맺은 인연은 상대의 자리를 낸다');
select is(
  (select partner_photo_focus from public.my_chat_rooms() where partner_user_id = (select kim from folks)),
  array[20, 80, 0, 100],
  '5. 대화방은 상대의 자리를 낸다');
select is(
  (select counterpart_photo_focus from public.my_match_requests() where request_id = (select id from asked)),
  '{}'::integer[],
  '5. 끝난 요청은 빈 배열이다 — 사진 표시와 같은 문턱');

-- ── 4. 바꾸면 가운데로 ──────────────────────────────────────────────────────

select pg_temp.acting((select kim from folks));
select public.replace_my_photo(1, (select version from public.my_photos() where position = 1), 'image/png', pg_temp.pic('new'));
select results_eq(
  $$select position, focus_x, focus_y from public.my_photos()$$,
  $$values (1, 50, 50), (2, 0, 100)$$,
  '4. 바꾼 장은 가운데로 돌아오고 다른 장은 그대로다');

reset role;
select * from finish();
rollback;
