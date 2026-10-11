-- 사진 한 장을 그 자리에서 바꾼다 (`20261202090000`)
--
-- 여기서 재는 것 넷.
--
-- 1. **그 자리의 바이트와 판본만 바뀐다** — 자리 · 다른 장 · 장 수는 그대로다. 여섯 장이 찼어도 된다
-- 2. **하루 한도를 한 번 센다** — 올리기와 같은 셈. 스무 번이 차면 바꾸기도 막힌다
-- 3. **화면이 본 그 장이 아니면 거절하고, 그 거절은 한도를 안 깎는다** — 다른 탭이 먼저 바꾼 뒤의 낡은 누름
-- 4. **남의 사진은 못 바꾼다** — 자리만 같은 다른 계정의 장
--
-- 문을 지우거나(없는 함수) 판본을 안 보게 되돌리면 1 · 3 이 붉다.
begin;
select plan(11);

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

create or replace function pg_temp.bytes_at(uid uuid, n integer)
returns text language sql security definer as $$
  select convert_from(p.bytes, 'UTF8') from public.profile_photo p where p.user_id = uid and p.position = n
$$;

create temporary table who as
select tests.signup('kim-photo-replace@example.com') as kim,
       tests.signup('lee-photo-replace@example.com') as lee;
grant select on who to authenticated;

create temporary table seen (label text primary key, version bigint);
grant select, insert, update on seen to authenticated;

set local role authenticated;
select pg_temp.acting((select kim from who));

-- ── 1. 여섯 장이 찬 채로 셋째 장을 바꾼다 ───────────────────────────────────

select public.add_my_photo('image/png', pg_temp.pic('p' || i)) from generate_series(1, 6) as i;
insert into seen select 'before', version from public.my_photos() where position = 3;
insert into seen select 'second', version from public.my_photos() where position = 2;

insert into seen
select 'after', public.replace_my_photo(3, (select version from seen where label = 'before'), 'image/webp', pg_temp.pic('new'));

select is(pg_temp.bytes_at((select kim from who), 3), 'new', '1. 셋째 자리에 새 장이 앉았다');
select is((select count(*)::int from public.my_photos()), 6, '1. 장 수는 여섯 그대로다');
select is((select version from public.my_photos() where position = 3), (select version from seen where label = 'after'),
  '1. 돌려준 판본이 그 자리의 새 판본이다');
select isnt((select version from seen where label = 'after'), (select version from seen where label = 'before'),
  '1. 판본이 바뀌었다 — 그림 주소의 `?v=` 가 새 장을 가리킨다');
select is((select version from public.my_photos() where position = 2), (select version from seen where label = 'second'),
  '1. 다른 장은 그대로다');
select is(pg_temp.uploads((select kim from who)), 7::bigint, '2. 바꾸기는 한 번으로 센다');

-- ── 3. 낡은 누름은 거절하고 한도를 안 깎는다 ────────────────────────────────

select throws_ok(
  format($$select public.replace_my_photo(3, %s, 'image/png', %L)$$, (select version from seen where label = 'before'), pg_temp.pic('stale')),
  '22023', '사진을 바꾸지 못했어요. 다시 시도해 주세요.',
  '3. 화면이 본 장이 이미 바뀌었으면 거절한다');
select is(pg_temp.uploads((select kim from who)), 7::bigint, '3. 거절된 누름은 한도를 안 깎는다');

-- ── 4. 남의 사진은 못 바꾼다 ────────────────────────────────────────────────

select pg_temp.acting((select lee from who));
select throws_ok(
  format($$select public.replace_my_photo(3, %s, 'image/png', %L)$$, (select version from seen where label = 'after'), pg_temp.pic('theirs')),
  '22023', '사진을 바꾸지 못했어요. 다시 시도해 주세요.',
  '4. 다른 계정은 같은 자리 · 판본으로도 못 바꾼다');
select is(pg_temp.bytes_at((select kim from who), 3), 'new', '4. 그 장은 그대로다');

-- ── 2. 스무 번이 차면 바꾸기도 막힌다 ───────────────────────────────────────

select pg_temp.acting((select kim from who));
do $$
begin
  for i in 1..13 loop
    perform public.replace_my_photo(
      1, (select version from public.my_photos() where position = 1), 'image/png',
      encode(convert_to('r' || i, 'UTF8'), 'base64'));
  end loop;
end;
$$;
select throws_ok(
  format($$select public.replace_my_photo(1, %s, 'image/png', %L)$$,
    (select version from public.my_photos() where position = 1), pg_temp.pic('over')),
  '53400', '오늘은 사진을 더 올릴 수 없습니다. 내일 다시 올려 주세요.',
  '2. 스물한 번째 바꾸기는 거절된다');

reset role;
select * from finish();
rollback;
