-- 이미 받은 사진은 다시 안 보낸다 — **판본이 같으면 바이트가 없고, 판정은 판본보다 먼저다** (`20261227180000`, G-119 안 C)
--
-- 여기서 재는 것 셋.
--
-- 1. **같은 판본이면 바이트 없음** — 내가 든 판본을 넘기면 `base64` 가 `null` 이고 판본은 그대로 나온다
-- 2. **다른 판본 · 판본 없음이면 바이트** — 옛 판본 · 엉뚱한 수 · `null` 은 바이트를 싣는다. 자리에 다른 장이 앉으면
--    (옮기기) 그 자리의 판본이 달라 바이트가 나간다
-- 3. **볼 수 없는 사람은 판본도 안 받는다** — 판본을 맞혀도 0행. 아무 사이도 아닌 사람 · 볼 수 있다가 차단한 사람 ·
--    정지된 사람이 그렇다. 304 는 판정을 지난 뒤에만 나간다
-- 4. **저장소에 사는 장은 판본과 상관없이 바이트가 비고 판본은 나온다** — 그래서 라우트는 빈 바이트가 아니라 판본으로 304 를
--    가른다(`app/me/photo/photo-response.ts`). 판본을 안 넘겨도 `base64` 가 `null` 이다
--
-- 고치기 전(두 인자 `photo_at`)이면 세 인자 부름이 「함수가 없다」로 모두 붉다. 판본을 견주되 `may_see_photo` 밖에서
-- 견주면 3 이 붉고, 같은 판본에도 바이트를 실으면 1 이 붉다.
begin;
select plan(13);

create or replace function pg_temp.acting(uid uuid)
returns void
language plpgsql
as $$
begin
  perform set_config('request.jwt.claims', tests.claims(uid), true);
end;
$$;

create or replace function pg_temp.pic(label text)
returns text
language sql
as $$ select encode(convert_to(label, 'UTF8'), 'base64') $$;

create temporary table who as
select tests.signup('kim-photo-version@example.com') as kim,
       tests.signup('lee-photo-version@example.com') as lee,
       tests.signup('park-photo-version@example.com') as park;
grant select on who to authenticated;

set local role authenticated;
select pg_temp.acting((select kim from who));
select public.add_my_photo('image/png', pg_temp.pic('A'));
select public.add_my_photo('image/png', pg_temp.pic('B'));

create temporary table v as
select (select version from public.my_photos() where position = 1) as one,
       (select version from public.my_photos() where position = 2) as two;

-- ── 1. 같은 판본이면 바이트 없음 ─────────────────────────────────────────────

select is(
  (select base64 from public.photo_at((select kim from who), 1, (select one from v))),
  null,
  '든 판본을 넘기면 바이트가 없다');
select is(
  (select version from public.photo_at((select kim from who), 1, (select one from v))),
  (select one from v),
  '판본은 그대로 나온다 — 라우트가 304 에 같은 ETag 를 단다');

-- ── 2. 다른 판본 · 판본 없음이면 바이트 ──────────────────────────────────────

select is(
  (select convert_from(decode(base64, 'base64'), 'UTF8') from public.photo_at((select kim from who), 1, (select two from v))),
  'A',
  '다른 장의 판본이면 바이트가 나간다');
select is(
  (select convert_from(decode(base64, 'base64'), 'UTF8') from public.photo_at((select kim from who), 1, 0)),
  'A',
  '엉뚱한 판본이어도 바이트가 나간다');
select is(
  (select convert_from(decode(base64, 'base64'), 'UTF8') from public.photo_at((select kim from who), 1)),
  'A',
  '판본을 안 넘기면(옛 앱) 바이트가 나간다');

select public.move_my_photo(2, 1, (select two from v));
select is(
  (select convert_from(decode(base64, 'base64'), 'UTF8') || ':' || (version = (select two from v))::text
   from public.photo_at((select kim from who), 1, (select one from v))),
  'B:true',
  '1번 자리에 다른 장이 앉으면 옛 판본으로 물어도 새 장의 바이트와 그 판본이 나간다');

-- ── 3. 볼 수 없는 사람은 판본도 안 받는다 ────────────────────────────────────

select pg_temp.acting((select park from who));
select is(
  (select count(*)::int from public.photo_at((select kim from who), 1, (select two from v))),
  0,
  '아무 사이도 아닌 사람은 판본을 맞혀도 0행이다');

/* 김과 이가 서로의 후보로 선다 — `61_profile_photos` 와 같은 자리 */
select pg_temp.acting((select kim from who));
select tests.create_self_person(
  '나', 'solar', '1990-05-15', '1990-05-15', '14:30', 'female', '서울', 'jo', 'localMean',
  tests.chart(), 'chart-for-tests');
select public.save_my_profile('김판본', null);
select tests.set_discovery_participation(true,
  '{"glyphCount":8,"counts":{"木":4,"火":4,"土":0,"金":0,"水":0},"ratios":{"木":0.5,"火":0.5,"土":0,"金":0,"水":0}}'::jsonb,
  tests.need());

select pg_temp.acting((select lee from who));
select tests.create_self_person(
  '나', 'solar', '1992-03-03', '1992-03-03', '09:00', 'female', '서울', 'jo', 'localMean',
  tests.chart(), 'chart-for-tests');
select public.save_my_profile('이판본', null);
select tests.set_discovery_participation(true,
  '{"glyphCount":8,"counts":{"木":0,"火":0,"土":4,"金":4,"水":0},"ratios":{"木":0,"火":0,"土":0.5,"金":0.5,"水":0}}'::jsonb,
  tests.need());

reset role;
update public.discovery_profile set opted_in_at = null, opted_out_at = now()
where user_id not in (select kim from who union select lee from who);
set local role authenticated;
select pg_temp.acting((select lee from who));
select count(*) from public.my_discovery_board();

select is(
  (select base64 from public.photo_at((select kim from who), 1, (select two from v))),
  null,
  '후보로 선 사람은 든 판본이면 바이트 없이 판본만 받는다');

reset role;
update public.app_user set status = 'suspended' where id = (select lee from who);
set local role authenticated;
select is(
  (select count(*)::int from public.photo_at((select kim from who), 1, (select two from v))),
  0,
  '정지되면 판본을 맞혀도 0행이다');
reset role;
update public.app_user set status = 'active' where id = (select lee from who);
set local role authenticated;
select is(
  (select count(*)::int from public.photo_at((select kim from who), 1, (select two from v))),
  1,
  '정지가 풀리면 다시 열린다 — 앞 줄의 0행은 정지 때문이다');

select public.block_user((select kim from who));
select is(
  (select count(*)::int from public.photo_at((select kim from who), 1, (select two from v))),
  0,
  '차단하면 판본을 맞혀도 0행이다 — 브라우저가 든 장에 304 가 안 나가고 404 다');

-- ── 4. 저장소에 사는 장은 판본과 상관없이 바이트가 비고 판본은 나온다 ────────

/* 저장소 길은 스위치가 `db` 라 거절하므로(`20261228140000`) 표에 바로 놓는다 — 트랜잭션 안이라 되돌아간다 */
reset role;
insert into public.profile_photo (user_id, position, content_type, object_key)
values ((select park from who), 1, 'image/webp', format('photos/%s/%s', (select park from who), gen_random_uuid()));
set local role authenticated;
select pg_temp.acting((select park from who));

select is(
  (select (base64 is null)::text || ':' || (version is not null)::text from public.photo_at((select park from who), 1)),
  'true:true',
  '저장소에 사는 장은 판본을 안 넘겨도 바이트가 비고 판본은 나온다 — 빈 바이트가 「같은 판본」이 아니다');
select is(
  (select count(*)::int from public.photo_at((select park from who), 1, 0)),
  1,
  '저장소에 사는 장도 판정을 지나면 한 줄이다 — 판본이 다르면 라우트가 그 줄의 열쇠로 저장소에서 읽는다(ADR 0203)');

select * from finish();
rollback;
