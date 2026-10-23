-- 스위치를 바꾸는 일은 진행 중인 올리기를 기다린다 (`20261229150000`, G-120 · ADR 0203 덧붙임)
--
-- 두 세션을 한 pgTAP 트랜잭션에서 겹칠 수 없으므로 **기다림이 생기는 까닭**을 잰다. 기다림 자체는 `scripts/check-db-races.mjs` 의 9.
--
-- 1. 검사를 지난 올리기는 그 트랜잭션이 끝날 때까지 스위치 줄을 쥔다 — 줄의 `xmax` 가 이 트랜잭션이다(행 잠금은 `pg_locks` 에
--    부딪칠 때만 서므로 줄 머리로 본다). 잠금을 빼면(`20261228140000` 의 읽기만 하는 정의) 붉다
-- 2. 그 잠금은 `for share` 다 — 운영자의 `update`(`for no key update`)와 부딪친다. `for key share` 는 키 아닌 칸의 갱신과 안
--    부딪쳐 기다림이 없다
-- 3. 올리는 문 다섯이 모두 그 검사를 지난다 · 검사 함수는 `volatile` 이다(`for share` 는 `stable` 에서 못 쓴다)
-- 4. 같은 트랜잭션의 운영자 갱신은 막히지 않는다 — 잠금은 남의 갱신만 기다리게 한다
begin;
select plan(7);

create or replace function pg_temp.acting(uid uuid)
returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claims', tests.claims(uid), true);
end;
$$;

create or replace function pg_temp.pic(label text)
returns text language sql as $$ select encode(convert_to(label, 'UTF8'), 'base64') $$;

/** 스위치 줄을 이 트랜잭션이 쥐고 있나 — 줄 머리의 `xmax` 가 이 트랜잭션의 xid(32비트)인가 */
create or replace function pg_temp.switch_held_by_me()
returns boolean language sql security definer as $$
  select s.xmax::text = (txid_current() % 4294967296)::text from public.photo_upload_switch s where s.id
$$;

create temporary table who as
select tests.signup('kim-upload-switch-waits@example.com') as kim;
grant select on who to authenticated;

-- ── 1. 검사를 지난 올리기가 스위치 줄을 쥔다 ─────────────────────────────────

select ok(not pg_temp.switch_held_by_me(), '1. 올리기 전에는 이 트랜잭션이 스위치 줄을 안 쥔다');

set local role authenticated;
select pg_temp.acting((select kim from who));
select is(public.add_my_photo('image/png', pg_temp.pic('A')), 1, '1. db — 바이트 길로 더한다');
reset role;

select ok(pg_temp.switch_held_by_me(),
  '1. 검사를 지난 올리기는 커밋까지 스위치 줄을 쥔다 — 운영자의 바꾸기가 이 커밋을 기다린다');

-- ── 2 · 3. 잠금의 세기 · 지나는 문 ───────────────────────────────────────────

select ok(
  pg_get_functiondef('public.photo_upload_must_be(text)'::regprocedure) ~* '\mfor\s+share\M'
  and pg_get_functiondef('public.photo_upload_must_be(text)'::regprocedure) !~* '\mkey\s+share\M',
  '2. 검사는 스위치 줄을 for share 로 읽는다 — for key share 는 mode 갱신과 안 부딪친다');

select is(
  (select p.provolatile::text from pg_proc p where p.oid = 'public.photo_upload_must_be(text)'::regprocedure),
  'v', '3. 검사 함수는 volatile 이다');

select is(
  (select count(*)::int from unnest(array[
     'public.add_my_photo(text, text)',
     'public.replace_my_photo(integer, bigint, text, text)',
     'public.begin_my_photo_upload()',
     'public.add_my_photo_object(text, text)',
     'public.replace_my_photo_object(integer, bigint, text, text)']) f
   where pg_get_functiondef(f::regprocedure) ~ 'photo_upload_must_be\('),
  5, '3. 올리는 문 다섯이 모두 그 검사를 지난다');

-- ── 4. 같은 트랜잭션의 갱신 ──────────────────────────────────────────────────

select lives_ok($$update public.photo_upload_switch set mode = 'paused', changed_at = now()$$,
  '4. 잠금을 쥔 트랜잭션 자신은 바꿀 수 있다 — 기다리는 것은 다른 세션의 갱신이다');

select * from finish();
rollback;
