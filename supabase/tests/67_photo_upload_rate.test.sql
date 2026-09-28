-- 사진은 하루(서울)에 스무 장까지 올린다 (`20261102090000`, 결정 대기)
--
-- 여기서 재는 것 넷.
--
-- 1. **올리고 지우기를 되풀이해도 스무 번에서 멈춘다** — 지금 몇 장인가가 아니라 오늘 몇 번 올렸나를 센다
-- 2. **옛 문(`set_my_photo`)도 같은 셈이다** — 1번 자리를 제자리에서 덮어써도 센다
-- 3. **어제 올린 것은 안 센다**
-- 4. **세는 것은 그 계정뿐이고, 표는 아무에게도 안 열려 있다**
--
-- 옛 정의(세지 않는다)를 되살리면 1 · 2 가 붉다.
begin;
select plan(9);

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

create or replace function pg_temp.photos(uid uuid)
returns bigint language sql security definer as $$
  select count(*) from public.profile_photo p where p.user_id = uid
$$;

create temporary table who as
select tests.signup('kim-upload-rate@example.com') as kim,
       tests.signup('lee-upload-rate@example.com') as lee;
grant select on who to authenticated;

set local role authenticated;
select pg_temp.acting((select kim from who));

-- ── 1. 올리고 지우기를 되풀이해도 스무 번 ───────────────────────────────────

-- 여섯 장을 올리고 한 장 지우고 올리기를 되풀이해 스무 번을 채운다 — 자리는 여섯을 안 넘는다
select public.add_my_photo('image/png', pg_temp.pic('p' || i)) from generate_series(1, 6) as i;
do $$
begin
  for i in 1..14 loop
    perform public.remove_my_photo(6);
    perform public.add_my_photo('image/png', pg_temp.pic('q' || i));
  end loop;
end;
$$;

select is(pg_temp.uploads((select kim from who)), 20::bigint, '1. 스무 번이 적혔다');
select is(pg_temp.photos((select kim from who)), 6::bigint,
  '1. 자리는 여섯 그대로다');

select public.remove_my_photo(6);
select is(pg_temp.uploads((select kim from who)), 20::bigint, '1. 지우기는 안 센다');

select throws_ok(
  format($$select public.add_my_photo('image/png', %L)$$, pg_temp.pic('over')),
  '53400', '오늘은 사진을 더 올릴 수 없습니다. 내일 다시 올려 주세요.',
  '1. 스물한 번째는 자리가 비어 있어도 거절된다');

-- ── 2. 옛 문도 같은 셈 ───────────────────────────────────────────────────────

select throws_ok(
  format($$select public.set_my_photo('image/png', %L)$$, pg_temp.pic('old-door')),
  '53400', '오늘은 사진을 더 올릴 수 없습니다. 내일 다시 올려 주세요.',
  '2. 옛 문으로 대표 사진을 덮어써도 막힌다');

-- ── 4. 세는 것은 그 계정뿐 ──────────────────────────────────────────────────

select pg_temp.acting((select lee from who));
select is(public.add_my_photo('image/png', pg_temp.pic('lee')), 1, '4. 다른 계정은 그대로 올린다');

select throws_ok($$select count(*) from public.profile_photo_upload$$, '42501', null,
  '4. 올린 기록 표는 사용자에게 안 열려 있다');

-- ── 3. 어제 올린 것은 안 센다 ───────────────────────────────────────────────

reset role;
update public.profile_photo_upload set uploaded_at = uploaded_at - interval '1 day'
where user_id = (select kim from who);
set local role authenticated;

select pg_temp.acting((select kim from who));
select is(public.add_my_photo('image/png', pg_temp.pic('tomorrow')), 6, '3. 어제의 스무 번은 오늘을 안 막는다');
select is(pg_temp.uploads((select kim from who)), 1::bigint, '3. 어제 줄은 걷히고 오늘 한 번만 남는다');

reset role;
select * from finish();
rollback;
