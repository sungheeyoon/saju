-- 사진 올리기는 DB 의 스위치 하나를 따른다 (`20261228140000`, G-120 · ADR 0204)
--
-- 여기서 재는 것.
--
-- 1. **기본값은 `db` 다** — 바이트 길은 지금처럼 받고, 저장소 길의 문 셋은 거절한다. `db push` 만으로 저장소 길이 안 열린다
-- 2. **`paused` 는 모든 올리는 문을 거절한다** — 바이트 길 둘 · 저장소 길 셋. 거절된 올리기는 하루 한도를 안 깎는다.
--    지우기 · 옮기기 · 위치 조정 · 표 버리기는 그대로다
-- 3. **`s3` 는 저장소 길만 받는다** — 바이트 길 둘은 「다시 시도」로 거절한다(스위치 전에 그려진 화면)
-- 4. **표를 받은 뒤 스위치가 멈추면 놓지 못하고, 표는 버릴 수 있다**
-- 5. **스위치는 한 줄이고 셋 밖의 값을 안 받는다** · 앱 역할은 표를 못 읽고 못 쓴다 · 값은 `photo_upload_mode()` 로만 · 안의 문은 닫혀 있다
-- 6. **정지된 사람은 스위치보다 정지 문장을 먼저 받는다**
begin;
select plan(31);

create or replace function pg_temp.acting(uid uuid)
returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claims', tests.claims(uid), true);
end;
$$;

create or replace function pg_temp.pic(label text)
returns text language sql as $$ select encode(convert_to(label, 'UTF8'), 'base64') $$;

/** 표가 아무에게도 안 열려 있으므로 보는 손잡이를 따로 둔다 */
create or replace function pg_temp.uploads(uid uuid)
returns bigint language sql security definer as $$
  select count(*) from public.profile_photo_upload u where u.user_id = uid
$$;

create or replace function pg_temp.photos(uid uuid)
returns bigint language sql security definer as $$
  select count(*) from public.profile_photo p where p.user_id = uid
$$;

create or replace function pg_temp.switch_to(m text)
returns void language sql security definer as $$
  update public.photo_upload_switch set mode = m, changed_at = now()
$$;

create temporary table who as
select tests.signup('kim-upload-switch@example.com') as kim;
grant select on who to authenticated;

create temporary table kept (k text primary key, v text);
grant select, insert, update on kept to authenticated;

delete from public.photo_upload_ticket;

-- ── 1. 기본값 `db` ──────────────────────────────────────────────────────────

select is((select mode from public.photo_upload_switch), 'db', '1. 스위치의 기본값은 db 다 — 지금 길 그대로');

set local role authenticated;
select pg_temp.acting((select kim from who));

select is(public.photo_upload_mode(), 'db', '1. 로그인한 사람은 값을 읽는다');
select is(public.add_my_photo('image/png', pg_temp.pic('A')), 1, '1. db — 바이트 길로 더한다');
select ok(public.replace_my_photo(1, (select version from public.my_photos() where position = 1), 'image/png', pg_temp.pic('A2')) > 0,
  '1. db — 바이트 길로 바꾼다');
select throws_ok($$select public.begin_my_photo_upload()$$, '55000', '사진을 올리지 못했어요. 다시 시도해 주세요.',
  '1. db — 저장소 길의 표를 안 준다');
select throws_ok(
  $$select public.add_my_photo_object('photos/00000000-0000-4000-8000-000000000000/00000000-0000-4000-8000-000000000000', 'image/webp')$$,
  '55000', '사진을 올리지 못했어요. 다시 시도해 주세요.', '1. db — 저장소 길로 못 더한다');
select throws_ok(
  $$select public.replace_my_photo_object(1, 0, 'photos/00000000-0000-4000-8000-000000000000/00000000-0000-4000-8000-000000000000', 'image/webp')$$,
  '55000', '사진을 올리지 못했어요. 다시 시도해 주세요.', '1. db — 저장소 길로 못 바꾼다');
select is(pg_temp.uploads((select kim from who)), 2::bigint, '1. 거절된 표는 하루 한도를 안 깎는다 — 받은 올리기 둘만 센다');

-- ── 2. `paused` ─────────────────────────────────────────────────────────────

reset role;
select pg_temp.switch_to('paused');
set local role authenticated;
select pg_temp.acting((select kim from who));

select is(public.photo_upload_mode(), 'paused', '2. 멈춘 값을 읽는다');
select throws_ok($$select public.add_my_photo('image/png', 'QQ==')$$,
  '55000', '사진 보관 방식을 바꾸는 중이라 지금은 사진을 올릴 수 없어요.', '2. paused — 바이트 길로 못 더한다');
select throws_ok(
  format($$select public.replace_my_photo(1, %s, 'image/png', 'QQ==')$$, (select version from public.my_photos() where position = 1)),
  '55000', '사진 보관 방식을 바꾸는 중이라 지금은 사진을 올릴 수 없어요.', '2. paused — 바이트 길로 못 바꾼다');
select throws_ok($$select public.begin_my_photo_upload()$$,
  '55000', '사진 보관 방식을 바꾸는 중이라 지금은 사진을 올릴 수 없어요.', '2. paused — 표를 안 준다');
select throws_ok(
  $$select public.add_my_photo_object('photos/00000000-0000-4000-8000-000000000000/00000000-0000-4000-8000-000000000000', 'image/webp')$$,
  '55000', '사진 보관 방식을 바꾸는 중이라 지금은 사진을 올릴 수 없어요.', '2. paused — 저장소 길로 못 더한다');
select throws_ok(
  $$select public.replace_my_photo_object(1, 0, 'photos/00000000-0000-4000-8000-000000000000/00000000-0000-4000-8000-000000000000', 'image/webp')$$,
  '55000', '사진 보관 방식을 바꾸는 중이라 지금은 사진을 올릴 수 없어요.', '2. paused — 저장소 길로 못 바꾼다');
select is(pg_temp.uploads((select kim from who)), 2::bigint, '2. 멈춘 동안의 거절은 하루 한도를 안 깎는다');
select lives_ok(
  format($$select public.set_my_photo_focus(1, 30, 70, %s)$$, (select version from public.my_photos() where position = 1)),
  '2. paused — 위치 조정은 그대로다');
select lives_ok(
  format($$select public.remove_my_photo(1, %s)$$, (select version from public.my_photos() where position = 1)),
  '2. paused — 지우기는 그대로다');
select is(pg_temp.photos((select kim from who)), 0::bigint, '2. 지운 장이 빠졌다');

-- ── 3. `s3` ─────────────────────────────────────────────────────────────────

reset role;
select pg_temp.switch_to('s3');
set local role authenticated;
select pg_temp.acting((select kim from who));

select throws_ok($$select public.add_my_photo('image/png', 'QQ==')$$,
  '55000', '사진을 올리지 못했어요. 다시 시도해 주세요.', '3. s3 — 바이트 길로 못 더한다');
insert into kept values ('first', public.begin_my_photo_upload());
select is(public.add_my_photo_object((select v from kept where k = 'first'), 'image/webp'), 1, '3. s3 — 저장소 길로 더한다');
select throws_ok(
  format($$select public.replace_my_photo(1, %s, 'image/png', 'QQ==')$$, (select version from public.my_photos() where position = 1)),
  '55000', '사진을 올리지 못했어요. 다시 시도해 주세요.', '3. s3 — 바이트 길로 못 바꾼다');
insert into kept values ('second', public.begin_my_photo_upload());
select ok(
  public.replace_my_photo_object(1, (select version from public.my_photos() where position = 1), (select v from kept where k = 'second'), 'image/webp') > 0,
  '3. s3 — 저장소 길로 바꾼다');

-- ── 4. 표를 받은 뒤 멈추면 ──────────────────────────────────────────────────

insert into kept values ('third', public.begin_my_photo_upload());
reset role;
select pg_temp.switch_to('paused');
set local role authenticated;
select pg_temp.acting((select kim from who));

select throws_ok(
  format($$select public.add_my_photo_object(%L, 'image/webp')$$, (select v from kept where k = 'third')),
  '55000', '사진 보관 방식을 바꾸는 중이라 지금은 사진을 올릴 수 없어요.', '4. 표를 받은 뒤 멈추면 못 놓는다');
select lives_ok(
  format($$select public.drop_my_photo_upload(%L)$$, (select v from kept where k = 'third')),
  '4. 표는 버릴 수 있다 — 지울 줄로 간다');

-- ── 5. 스위치의 모양 · 권한 ─────────────────────────────────────────────────

select throws_ok($$select count(*) from public.photo_upload_switch$$, '42501', null, '5. 로그인한 사람은 스위치 표를 못 읽는다');
select throws_ok($$update public.photo_upload_switch set mode = 'db'$$, '42501', null, '5. 로그인한 사람은 스위치를 못 바꾼다');
select throws_ok($$select public.photo_upload_must_be('db')$$, '42501', null, '5. 안의 문은 로그인한 사람이 못 부른다');
reset role;

select throws_ok($$update public.photo_upload_switch set mode = 'off'$$, '23514', null, '5. 셋 밖의 값은 안 받는다');
select throws_ok($$insert into public.photo_upload_switch (id, mode) values (false, 'db')$$, '23514', null, '5. 둘째 줄은 안 선다');
select ok(not has_function_privilege('anon', 'public.photo_upload_mode()', 'execute')
  and not has_function_privilege('service_role', 'public.photo_upload_mode()', 'execute'),
  '5. 값을 읽는 문은 로그인한 사람에게만 열려 있다');

-- ── 6. 정지된 사람 ──────────────────────────────────────────────────────────

update public.app_user set status = 'suspended' where id = (select kim from who);
set local role authenticated;
select pg_temp.acting((select kim from who));
select throws_ok($$select public.begin_my_photo_upload()$$, '42501', '이용이 정지된 계정입니다.',
  '6. 정지된 사람은 스위치가 멈췄어도 정지 문장을 먼저 받는다');
reset role;

select * from finish();
rollback;
