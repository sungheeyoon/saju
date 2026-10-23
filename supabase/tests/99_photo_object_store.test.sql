-- 사진의 바이트가 저장소에 살 수 있다 — 표 · 지울 줄 · 열쇠 목록 (`20261227090000`, G-120)
--
-- 여기서 재는 것.
--
-- 1. **표를 받아야 놓는다** — 열쇠는 DB 가 내 접두사로 짓고, 표는 한 번만 쓰이며, 남의 표로는 못 놓는다. 하루 한도는 표를 받을 때 센다
-- 2. **열쇠를 잃는 모든 길이 지울 줄에 넣는다** — 바꾸기(저장소 · 바이트 길) · 지우기 · 계정 삭제. 자리만 옮기면 안 넣는다
-- 3. **저장하지 못한 올리기가 고아로 안 남는다** — 앱이 버린 표, 한 시간 지난 표가 지울 줄로 간다
-- 4. **청소기는 아직 쓰이는 열쇠를 안 지운다** · 실패는 간격을 늘리고 다섯 번째부터 알린다
-- 5. **월 점검의 열쇠 목록**(`photo_object_keys`)은 열쇠 줄만 낸다
-- 6. **한 줄은 바이트 또는 열쇠 하나** · 청소기 · 열쇠 목록은 로그인한 사람에게 닫혀 있다
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

create or replace function pg_temp.ticketed(key text)
returns boolean language sql security definer as $$
  select exists (select 1 from public.photo_upload_ticket t where t.object_key = key)
$$;

create or replace function pg_temp.trashed(key text)
returns boolean language sql security definer as $$
  select exists (select 1 from public.photo_object_trash t where t.object_key = key)
$$;

create or replace function pg_temp.key_at(uid uuid, n integer)
returns text language sql security definer as $$
  select p.object_key from public.profile_photo p where p.user_id = uid and p.position = n
$$;

create or replace function pg_temp.has_bytes_at(uid uuid, n integer)
returns boolean language sql security definer as $$
  select p.bytes is not null from public.profile_photo p where p.user_id = uid and p.position = n
$$;

create temporary table who as
select tests.signup('kim-photo-store@example.com') as kim,
       tests.signup('lee-photo-store@example.com') as lee;
grant select on who to authenticated, service_role;

create temporary table kept (k text primary key, v text);
grant select, insert, update on kept to authenticated, service_role;

/**
 * 올리는 문 넷은 운영에서 닫혀 있다(`20261227120000` — 열람 방식이 정해지는 날 연다). 그 차례를 재려고 이 트랜잭션 안에서만
 * 연다 — 끝에서 되돌아간다. 닫혀 있다는 것은 아래 6 과 `74_authenticated_doors` 가 잰다
 */
select ok(not has_function_privilege('authenticated', 'public.begin_my_photo_upload()', 'execute')
  and not has_function_privilege('authenticated', 'public.add_my_photo_object(text, text)', 'execute')
  and not has_function_privilege('authenticated', 'public.replace_my_photo_object(integer, bigint, text, text)', 'execute')
  and not has_function_privilege('authenticated', 'public.drop_my_photo_upload(text)', 'execute'),
  '0. 올리는 문 넷은 로그인한 사람에게 닫혀 있다 — 켜는 날의 결정 전');
grant execute on function public.begin_my_photo_upload() to authenticated;
grant execute on function public.add_my_photo_object(text, text) to authenticated;
grant execute on function public.replace_my_photo_object(integer, bigint, text, text) to authenticated;
grant execute on function public.drop_my_photo_upload(text) to authenticated;

/** 다른 시험이 남긴 지울 줄 · 알림과 섞이지 않게 — 트랜잭션 안이라 되돌아간다 */
delete from public.photo_object_trash;
delete from public.photo_upload_ticket;
delete from public.ops_alert where kind = 'photo-trash-stuck';

set local role authenticated;
select pg_temp.acting((select kim from who));

-- ── 1. 표를 받아야 놓는다 ────────────────────────────────────────────────────

insert into kept values ('first', public.begin_my_photo_upload());

select ok((select v from kept where k = 'first') like format('photos/%s/%%', (select kim from who)),
  '1. 열쇠는 내 접두사다');
select is(pg_temp.uploads((select kim from who)), 1::bigint, '1. 표를 받을 때 하루 한도를 한 번 센다');

select is(public.add_my_photo_object((select v from kept where k = 'first'), 'image/webp'), 1, '1. 표로 첫 자리에 놓는다');
select ok(not pg_temp.ticketed((select v from kept where k = 'first')), '1. 놓으면 표가 걷힌다');
select is(pg_temp.key_at((select kim from who), 1), (select v from kept where k = 'first'), '1. 줄이 열쇠를 든다');
select ok(not pg_temp.has_bytes_at((select kim from who), 1), '1. 열쇠 줄에는 바이트가 없다');
select is(pg_temp.uploads((select kim from who)), 1::bigint, '1. 놓을 때는 다시 세지 않는다');

select throws_ok(
  format($$select public.add_my_photo_object(%L, 'image/webp')$$, (select v from kept where k = 'first')),
  '22023', '사진을 올리지 못했어요. 다시 시도해 주세요.',
  '1. 같은 표로 두 번 못 놓는다');

insert into kept values ('kims', public.begin_my_photo_upload());
select pg_temp.acting((select lee from who));
select throws_ok(
  format($$select public.add_my_photo_object(%L, 'image/webp')$$, (select v from kept where k = 'kims')),
  '22023', '사진을 올리지 못했어요. 다시 시도해 주세요.',
  '1. 남의 표로는 못 놓는다');
select throws_ok(
  $$select public.add_my_photo_object('photos/00000000-0000-4000-8000-000000000000/00000000-0000-4000-8000-000000000000', 'image/gif')$$,
  '22023', 'JPG · PNG · WebP 만 올릴 수 있습니다.',
  '1. 형식은 바이트 길과 같은 목록이다');

-- ── 2. 열쇠를 잃는 길 ────────────────────────────────────────────────────────

select pg_temp.acting((select kim from who));
select public.add_my_photo_object((select v from kept where k = 'kims'), 'image/jpeg');
insert into kept select 'v1', version::text from public.my_photos() where position = 1;

select public.move_my_photo(1, 2, (select version from public.my_photos() where position = 1));
reset role;
select ok(not pg_temp.trashed((select v from kept where k = 'first')), '2. 자리만 옮기면 지울 줄에 안 넣는다');
set local role authenticated;
select pg_temp.acting((select kim from who));

insert into kept values ('second', public.begin_my_photo_upload());
insert into kept
select 'v2', public.replace_my_photo_object(2, (select version from public.my_photos() where position = 2),
                                            (select v from kept where k = 'second'), 'image/webp')::text;
select is(pg_temp.key_at((select kim from who), 2), (select v from kept where k = 'second'), '2. 바꾸면 그 자리에 새 열쇠');
select ok(pg_temp.trashed((select v from kept where k = 'first')), '2. 저장소 길로 바꾸면 옛 열쇠가 지울 줄에 간다');
select isnt((select v from kept where k = 'v2'), (select v from kept where k = 'v1'), '2. 판본이 바뀐다');

select public.replace_my_photo(2, (select version from public.my_photos() where position = 2), 'image/png', pg_temp.pic('back'));
select ok(pg_temp.trashed((select v from kept where k = 'second')), '2. 바이트 길로 바꿔도 옛 열쇠가 지울 줄에 간다');
select ok(pg_temp.key_at((select kim from who), 2) is null and pg_temp.has_bytes_at((select kim from who), 2),
  '2. 바이트 길로 바꾼 줄은 열쇠를 걷고 바이트를 든다');

select public.remove_my_photo(1, (select version from public.my_photos() where position = 1));
select ok(pg_temp.trashed((select v from kept where k = 'kims')), '2. 지우면 열쇠가 지울 줄에 간다');

-- ── 3. 저장하지 못한 올리기 ──────────────────────────────────────────────────

insert into kept values ('dropped', public.begin_my_photo_upload());
select public.drop_my_photo_upload((select v from kept where k = 'dropped'));
select ok(not pg_temp.ticketed((select v from kept where k = 'dropped')) and pg_temp.trashed((select v from kept where k = 'dropped')),
  '3. 버린 표는 지울 줄로 간다');

insert into kept values ('stale', public.begin_my_photo_upload());
reset role;
update public.photo_upload_ticket set issued_at = now() - interval '2 hours' where object_key = (select v from kept where k = 'stale');
set local role service_role;
select is(public.photo_sweep_tickets(), 1, '3. 한 시간 지난 표 하나를 옮긴다');
select ok(pg_temp.trashed((select v from kept where k = 'stale')), '3. 그 표의 열쇠가 지울 줄에 있다');

-- ── 4. 청소기 ────────────────────────────────────────────────────────────────

reset role;
set local role authenticated;
select pg_temp.acting((select kim from who));
insert into kept values ('live', public.begin_my_photo_upload());
select public.add_my_photo_object((select v from kept where k = 'live'), 'image/webp');

/**
 * 아직 쓰이는 열쇠가 지울 줄에 섞였다고 친다 — 옮기는 사이의 경합. 시험은 한 트랜잭션이라 `now()` 가 시작 시각에 멈춰 있다 —
 * 줄의 차례(`next_try_at`, 기본 `clock_timestamp()`)를 그보다 앞으로 당겨야 차례가 온 줄이 된다
 */
reset role;
insert into public.photo_object_trash (object_key) select v from kept where k = 'live';
update public.photo_object_trash set next_try_at = now() - interval '1 minute';
set local role service_role;

create temporary table due as select b.object_key from public.photo_trash_batch(100) b;
grant select on due to authenticated, service_role;

select ok(exists (select 1 from due where object_key = (select v from kept where k = 'first')),
  '4. 차례가 온 열쇠는 낸다');
select ok(not exists (select 1 from due where object_key = (select v from kept where k = 'live')),
  '4. 아직 쓰이는 열쇠는 내지 않는다');
select ok(not pg_temp.trashed((select v from kept where k = 'live')), '4. 쓰이는 열쇠의 줄은 지울 줄에서 걷는다');

select public.photo_trash_settle(array[(select v from kept where k = 'first')], array[(select v from kept where k = 'second')], 'delete:accessdenied');
select ok(not pg_temp.trashed((select v from kept where k = 'first')), '4. 지운 것은 걷는다');
select ok(not exists (select 1 from public.photo_trash_batch(100) b where b.object_key = (select v from kept where k = 'second')),
  '4. 못 지운 것은 다음 차례까지 안 나온다');

reset role;
update public.photo_object_trash set attempts = 4 where object_key = (select v from kept where k = 'second');
set local role service_role;
select ok(public.photo_trash_settle(null, array[(select v from kept where k = 'second')], 'delete:accessdenied'),
  '4. 다섯 번째 실패에 운영 알림을 낸다');

-- ── 5. 월 점검의 열쇠 목록 ─────────────────────────────────────────────────

create temporary table listed as select k.object_key from public.photo_object_keys('', 1000) k;
grant select on listed to authenticated, service_role;
reset role;
select ok(exists (select 1 from listed where object_key = (select v from kept where k = 'live'))
  and not exists (select 1 from listed l join public.profile_photo p on p.object_key = l.object_key where p.bytes is not null),
  '5. 열쇠 목록은 열쇠 줄만 낸다 — 바이트 줄은 점검 밖이다');

-- ── 2(끝). 계정을 지우면 ─────────────────────────────────────────────────────

reset role;
select public.forget_user((select kim from who));
select ok(pg_temp.trashed((select v from kept where k = 'live')),
  '2. 계정을 지우면 남은 열쇠가 지울 줄에 간다');

-- ── 6. 모양과 문 ─────────────────────────────────────────────────────────────

select throws_ok(
  format($$insert into public.profile_photo (user_id, position, content_type) values (%L, 2, 'image/webp')$$, (select lee from who)),
  '23514', null,
  '6. 바이트도 열쇠도 없는 줄은 못 선다');

select ok(
  not has_function_privilege('authenticated', 'public.photo_trash_batch(integer)', 'execute')
  and not has_function_privilege('authenticated', 'public.photo_trash_settle(text[], text[], text)', 'execute')
  and not has_function_privilege('authenticated', 'public.photo_sweep_tickets()', 'execute')
  and not has_function_privilege('authenticated', 'public.photo_object_keys(text, integer)', 'execute')
  and has_function_privilege('service_role', 'public.photo_trash_batch(integer)', 'execute')
  and has_function_privilege('service_role', 'public.photo_object_keys(text, integer)', 'execute'),
  '6. 청소기 · 열쇠 목록은 열쇠에만 열린다');

select * from finish();
rollback;
