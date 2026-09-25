-- 프로필 사진 여러 장 — **여섯 장까지, 자리는 빈틈없이, 여는 조건은 한 장일 때와 같다** (G-60)
--
-- 여기서 재는 것은 다섯이다.
--
--   1. 상한 — 일곱째 장은 거절한다. 한 장의 상한 · 형식은 그대로다
--   2. 자리 — 올리면 맨 뒤, 지우면 뒤가 당겨 앉고, 옮기면 사이가 밀린다. 언제나 1..k
--   3. 여는 조건 — 장 단위의 답이 없다. 한 사람의 사진은 여섯 장이 함께 열리고 함께 닫힌다
--   4. 옛 문 — `photo_of` 는 대표, `set_my_photo` 는 대표만 바꾸고, `clear_my_photo` 는 전부 내린다
--   5. 떠나면 전부 사라진다 — FK 를 따라간다
begin;
select plan(40);

create or replace function pg_temp.acting(uid uuid)
returns void
language plpgsql
as $$
begin
  perform set_config('request.jwt.claims', tests.claims(uid), true);
end;
$$;

/** 한 장의 바이트 — 무엇인지 알아볼 수 있게 글자를 싣는다 */
create or replace function pg_temp.pic(label text)
returns text
language sql
as $$ select encode(convert_to(label, 'UTF8'), 'base64') $$;

/** 내 사진들을 자리 순서대로 한 줄로 — 「어느 장이 어느 자리에」를 한 값으로 잰다 */
create or replace function pg_temp.order_of(uid uuid)
returns text
language sql
as $$
  select string_agg(convert_from(bytes, 'UTF8'), ',' order by position)
  from public.profile_photo where user_id = uid
$$;

create temporary table who as
select tests.signup('kim-photos@example.com') as kim,
       tests.signup('lee-photos@example.com') as lee,
       tests.signup('park-photos@example.com') as park;
grant select on who to authenticated;

set local role authenticated;
select pg_temp.acting((select kim from who));

-- ── 1. 상한 ──────────────────────────────────────────────────────────────────

select is(public.add_my_photo('image/png', pg_temp.pic('A')), 1, '첫 장은 1번에 앉는다');
select is(public.add_my_photo('image/webp', pg_temp.pic('B')), 2, '둘째 장은 맨 뒤(2번)에 앉는다');
select public.add_my_photo('image/jpeg', pg_temp.pic('C'));
select public.add_my_photo('image/png', pg_temp.pic('D'));
select public.add_my_photo('image/png', pg_temp.pic('E'));
select is(public.add_my_photo('image/png', pg_temp.pic('F')), 6, '여섯째 장까지 앉는다');

select throws_ok(
  format($$select public.add_my_photo('image/png', %L)$$, pg_temp.pic('G')),
  '22023', '사진은 6장까지입니다.',
  '일곱째 장은 거절한다');

reset role;
select is(pg_temp.order_of((select kim from who)), 'A,B,C,D,E,F', '거절된 장은 어디에도 안 앉는다');
set local role authenticated;
select pg_temp.acting((select kim from who));

select throws_ok(
  format($$select public.add_my_photo('image/gif', %L)$$, pg_temp.pic('gif')),
  '22023', null,
  '받기로 한 형식이 아니면 거절한다 — 한 장일 때와 같다');

select throws_ok(
  format($$select public.add_my_photo('image/png', %L)$$, encode(repeat('0', 600000)::bytea, 'base64')),
  '22023', '사진은 512KB까지입니다.',
  '512KB 를 넘는 장은 거절한다 — 상한은 장마다 그대로다');

-- ── 2. 자리 ──────────────────────────────────────────────────────────────────

select public.move_my_photo(4, 1);
reset role;
select is(pg_temp.order_of((select kim from who)), 'D,A,B,C,E,F',
  '넷째를 첫 칸에 두면 사이의 장이 한 칸씩 밀린다 — 맞바꾸지 않는다');
set local role authenticated;
select pg_temp.acting((select kim from who));

select public.move_my_photo(1, 6);
reset role;
select is(pg_temp.order_of((select kim from who)), 'A,B,C,E,F,D', '첫 장을 끝에 두면 나머지가 한 칸씩 당겨진다');
set local role authenticated;
select pg_temp.acting((select kim from who));

select public.move_my_photo(3, 3);
reset role;
select is(pg_temp.order_of((select kim from who)), 'A,B,C,E,F,D', '제자리로 옮기면 아무것도 안 바뀐다');
set local role authenticated;
select pg_temp.acting((select kim from who));

select throws_ok($$select public.move_my_photo(1, 7)$$, '22023', null, '없는 자리로는 못 옮긴다');
select throws_ok($$select public.move_my_photo(0, 2)$$, '22023', null, '없는 자리에서는 못 옮긴다');

select public.remove_my_photo(1);
reset role;
select is(pg_temp.order_of((select kim from who)), 'B,C,E,F,D', '대표를 지우면 둘째가 대표가 되고 뒤가 당겨 앉는다');
set local role authenticated;
select pg_temp.acting((select kim from who));

select public.remove_my_photo(3);
select lives_ok($$select public.remove_my_photo(6)$$, '없는 자리를 지우라 해도 조용히 지나간다');

select is(
  (select array_agg(position order by position) from public.my_photos()),
  array[1, 2, 3, 4],
  '자리는 언제나 1..k 다 — 빈틈이 없다');

reset role;
select is(pg_temp.order_of((select kim from who)), 'B,C,F,D', '가운데를 지워도 순서가 유지된다');
set local role authenticated;
select pg_temp.acting((select kim from who));

select is(
  (select count(distinct version)::int from public.my_photos()),
  4,
  '장마다 판본이 다르다 — 주소의 `?v=` 가 그 장을 가리킨다');

select is(
  (select count(*)::int from public.my_photos() where version is null),
  0,
  '판본이 빈 장은 없다');

-- ── 3. 여는 조건 — 한 장일 때와 같다 ────────────────────────────────────────

select is(
  (select convert_from(decode(base64, 'base64'), 'UTF8') from public.photo_at((select kim from who), 3)),
  'F',
  '내 사진은 자리마다 내가 읽는다');

select is(
  (select count(*)::int from public.photo_at((select kim from who), 5)),
  0,
  '없는 자리는 0행이다');

select pg_temp.acting((select park from who));
select is(
  (select count(*)::int from generate_series(1, 6) n, public.photo_at((select kim from who), n)),
  0,
  '아무 사이도 아닌 사람에게는 어느 자리도 안 열린다');
select is(
  (select count(*)::int from public.photo_at(gen_random_uuid(), 1)),
  0,
  '없는 사람의 사진도 같은 답을 받는다');

/* 김과 이가 서로의 후보로 선다 — `24_profile` 과 같은 자리 */
select pg_temp.acting((select kim from who));
select public.create_self_person(
  '나', 'solar', '1990-05-15', '1990-05-15', '14:30', 'female', '서울', 'jo', 'localMean',
  tests.chart(), 'chart-for-tests');
select public.save_my_profile('김사진', null);
select public.set_discovery_participation(true,
  '{"glyphCount":8,"counts":{"木":4,"火":4,"土":0,"金":0,"水":0},"ratios":{"木":0.5,"火":0.5,"土":0,"金":0,"水":0}}'::jsonb,
  tests.need());

select pg_temp.acting((select lee from who));
select public.create_self_person(
  '나', 'solar', '1992-03-03', '1992-03-03', '09:00', 'female', '서울', 'jo', 'localMean',
  tests.chart(), 'chart-for-tests');
select public.save_my_profile('이사진', null);
select public.set_discovery_participation(true,
  '{"glyphCount":8,"counts":{"木":0,"火":0,"土":4,"金":4,"水":0},"ratios":{"木":0,"火":0,"土":0.5,"金":0.5,"水":0}}'::jsonb,
  tests.need());

reset role;
update public.discovery_profile set opted_in_at = null, opted_out_at = now()
where user_id not in (select kim from who union select lee from who);
set local role authenticated;
select pg_temp.acting((select lee from who));

create temporary table board as select * from public.my_discovery_board();

select is(
  (select photo_count from board where candidate_user_id = (select kim from who)),
  4,
  '카드가 사진 장 수를 말한다');
select is(
  (select has_photo from board where candidate_user_id = (select kim from who)),
  true,
  '옛 칸 `has_photo` 도 그대로 선다 — 옛 앱이 읽는다');
select is(
  (select photo_count from board where candidate_user_id = (select lee from who)),
  null,
  '보는 사람 자신은 목록에 없다');

select is(
  (select count(*)::int from generate_series(1, 6) n, public.photo_at((select kim from who), n)),
  4,
  '후보로 선 사람의 사진은 네 장이 다 열린다');

select is(
  (select convert_from(decode(base64, 'base64'), 'UTF8') from public.photo_of((select kim from who))),
  'B',
  '옛 문 `photo_of` 는 대표(1번)를 연다');

/**
 * **여는 조건이 사람 단위다.** 자리마다 `photo_at` 이 열리는가가 `may_see_photo` 하나와 정확히 같다 —
 * 보는 사람 셋 × 자리 여섯에서 어긋난 칸이 하나도 없다.
 */
reset role;
create temporary table seen (viewer uuid, n int, opened boolean, allowed boolean);
grant all on seen to authenticated;

/** 보는 사람 하나 — 문은 그 사람으로 부르고, `may_see_photo` 는 닫힌 함수라 같은 신분(claims)으로 소유자가 묻는다 */
create or replace function pg_temp.look_as(viewer uuid)
returns void
language plpgsql
as $$
begin
  perform set_config('request.jwt.claims', tests.claims(viewer), true);
  set local role authenticated;
  insert into seen select viewer, n,
    exists (select 1 from public.photo_at((select kim from who), n)), null
  from generate_series(1, 6) n;
  reset role;
  update seen set allowed = public.may_see_photo((select kim from who)) and n <= 4
  where seen.viewer = look_as.viewer;
end;
$$;

select pg_temp.look_as((select lee from who));
select pg_temp.look_as((select park from who));
select pg_temp.look_as((select kim from who));
set local role authenticated;

select is((select count(*)::int from seen where opened is distinct from allowed), 0,
  '어느 자리든 여는 답이 `may_see_photo` 와 같다 — 장 단위의 규칙이 없다');
select is((select count(*)::int from seen where opened), 8, '열린 칸은 김 자신과 후보인 이의 네 장씩이다');

select pg_temp.acting((select lee from who));
select public.block_user((select kim from who));
select is(
  (select count(*)::int from generate_series(1, 6) n, public.photo_at((select kim from who), n)),
  0,
  '차단하면 네 장이 함께 닫힌다');

-- ── 4. 옛 문 ────────────────────────────────────────────────────────────────

select pg_temp.acting((select kim from who));
select public.set_my_photo('image/jpeg', pg_temp.pic('Z'));
reset role;
select is(pg_temp.order_of((select kim from who)), 'Z,C,F,D', '옛 `set_my_photo` 는 대표만 바꾸고 나머지는 둔다');
set local role authenticated;

select pg_temp.acting((select park from who));
select public.set_my_photo('image/png', pg_temp.pic('P'));
reset role;
select is(pg_temp.order_of((select park from who)), 'P', '사진이 없으면 옛 문이 1번에 놓는다');
set local role authenticated;

select pg_temp.acting((select kim from who));
select public.clear_my_photo();
select is((select count(*)::int from public.my_photos()), 0, '옛 `clear_my_photo` 는 전부 내린다');

-- ── 권한 ────────────────────────────────────────────────────────────────────

reset role;
select ok(
  not has_function_privilege('anon', 'public.add_my_photo(text, text)', 'execute')
    and not has_function_privilege('anon', 'public.remove_my_photo(integer)', 'execute')
    and not has_function_privilege('anon', 'public.move_my_photo(integer, integer)', 'execute')
    and not has_function_privilege('anon', 'public.my_photos()', 'execute')
    and not has_function_privilege('anon', 'public.photo_at(uuid, integer)', 'execute'),
  '익명은 새 문 다섯을 못 부른다');
select ok(
  has_function_privilege('authenticated', 'public.add_my_photo(text, text)', 'execute')
    and has_function_privilege('authenticated', 'public.remove_my_photo(integer)', 'execute')
    and has_function_privilege('authenticated', 'public.move_my_photo(integer, integer)', 'execute')
    and has_function_privilege('authenticated', 'public.my_photos()', 'execute')
    and has_function_privilege('authenticated', 'public.photo_at(uuid, integer)', 'execute'),
  '로그인한 사람은 새 문 다섯을 부른다');
select ok(
  not has_function_privilege('authenticated', 'public.profile_photo_bytes(text, text)', 'execute')
    and not has_function_privilege('authenticated', 'public.lock_my_photos()', 'execute'),
  '안에서만 쓰는 두 함수는 로그인한 사람도 못 부른다');
select ok(
  not has_table_privilege('authenticated', 'public.profile_photo', 'select')
    and not has_table_privilege('authenticated', 'public.profile_photo', 'insert')
    and not has_table_privilege('authenticated', 'public.profile_photo', 'update'),
  '표는 여전히 아무에게도 안 열린다 — 자리를 바꾸는 길은 문뿐이다');

select throws_ok(
  $$insert into public.profile_photo (user_id, position, content_type, bytes)
    values ((select park from who), 7, 'image/png', '\x00'::bytea)$$,
  '23514', null,
  '표도 일곱째 자리를 안 받는다');

-- ── 5. 떠나면 전부 사라진다 ─────────────────────────────────────────────────

set local role authenticated;
select pg_temp.acting((select park from who));
select public.add_my_photo('image/png', pg_temp.pic('Q'));
select public.add_my_photo('image/png', pg_temp.pic('R'));
reset role;

select is((select count(*)::int from public.profile_photo where user_id = (select park from who)), 3,
  '떠나기 전에는 세 장이 있다');
select public.forget_user((select park from who));
select is((select count(*)::int from public.profile_photo where user_id = (select park from who)), 0,
  '계정이 사라지면 여러 장이 함께 사라진다 — 손으로 적은 줄이 없다');

select * from finish();
rollback;
