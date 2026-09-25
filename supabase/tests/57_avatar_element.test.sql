-- 기본 아바타의 색 — **그 사람 일간의 오행 하나만, 사진이 없을 때만** (운영자 2026-09-24)
--
-- 두 문(`my_discovery_board` · `my_passed_connections`)이 끝에 `avatar_element` 한 칸을 낸다.
-- 여기서 잠그는 것은 넷이다.
--
--   1. 사진이 없는 후보에게 그 사람 **지금 내 명식** 일간의 오행이 간다(甲 → 木 · 丙 → 火 · 庚 → 金)
--   2. 사진이 있는 후보에게는 `null` — 쓰지 않을 값을 내보내지 않는다
--   3. 명식이 없으면 `null`
--   4. **천간 글자는 어디에도 안 나간다** — 반환 칸 목록이 정확히 이것이고, 행 전체에 천간이 없다
--
-- 사람마다 일간을 다르게 준다(`tests.chart(day_stem)`). 모두 같은 일간이면 「누구의 일간인가」를
-- 못 가른다.
begin;
select plan(16);

create temporary table folks (who text, day_stem text, uid uuid);
grant select on folks to authenticated;

do $$
declare
  one record;
  u uuid;
begin
  for one in select * from (values
    ('viewer', '戊'), ('wood', '甲'), ('fire', '丙'), ('metal', '庚'), ('photo', '壬')) as v(who, stem)
  loop
    u := tests.signup('avatar-' || one.who || '@example.com');
    insert into folks values (one.who, one.stem, u);
    perform set_config('request.jwt.claims', tests.claims(u), true);
    perform public.create_self_person('나', 'solar', '1990-05-15', '1990-05-15', '14:30', 'female', '서울', 'jo', 'localMean',
      tests.chart(one.stem), 'chart-for-tests');
    perform public.save_my_profile(one.who, null);
    perform public.set_discovery_participation(true,
      '{"glyphCount":8,"counts":{"木":2,"火":2,"土":2,"金":1,"水":1},"ratios":{"木":0.25,"火":0.25,"土":0.25,"金":0.125,"水":0.125}}'::jsonb, tests.need());
  end loop;
end;
$$;

-- 다른 시험이 남긴 참여자는 관심 밖이다 — 뽑는 함수는 definer 라 RLS 로 좁혀지지 않는다.
update public.discovery_profile set opted_in_at = null, opted_out_at = now()
where user_id not in (select uid from folks);

insert into public.profile_photo (user_id, content_type, bytes)
values ((select uid from folks where who = 'photo'), 'image/png', '\x89504e47'::bytea);

-- ── 1 · 2. 후보 목록 ─────────────────────────────────────────────────────────

set local role authenticated;
select set_config('request.jwt.claims', tests.claims((select uid from folks where who = 'viewer')), true);

create temporary table board as select * from public.my_discovery_board();

select is((select count(*)::int from board), 4, '후보 넷이 선다');

select is(
  (select avatar_element from board where candidate_user_id = (select uid from folks where who = 'wood')),
  '木', '사진이 없는 甲 일간의 아바타는 木 을 입는다');
select is(
  (select avatar_element from board where candidate_user_id = (select uid from folks where who = 'fire')),
  '火', '사진이 없는 丙 일간의 아바타는 火 를 입는다');
select is(
  (select avatar_element from board where candidate_user_id = (select uid from folks where who = 'metal')),
  '金', '사진이 없는 庚 일간의 아바타는 金 을 입는다');
select is(
  (select avatar_element from board where candidate_user_id = (select uid from folks where who = 'photo')),
  null, '사진이 있는 후보에게는 아바타 색을 보내지 않는다');

select is(
  (select count(*)::int from board where avatar_element is not null
     and avatar_element <> all (array['木', '火', '土', '金', '水'])),
  0, '아바타 칸은 오행 다섯 중 하나이거나 비어 있다');

select is(
  (select count(*)::int from board where to_jsonb(board)::text ~ '[甲乙丙丁戊己庚辛壬癸]'),
  0, '후보 목록의 어느 칸에도 천간 글자가 없다');

-- ── 지나친 인연 ─────────────────────────────────────────────────────────────

reset role;
insert into public.discovery_passed (user_id, passed_user_id, passed_at)
select (select uid from folks where who = 'viewer'), uid, now() - interval '1 minute'
from folks where who <> 'viewer';
set local role authenticated;

create temporary table passed as select * from public.my_passed_connections();

select is(
  (select avatar_element from passed where candidate_user_id = (select uid from folks where who = 'fire')),
  '火', '지나친 인연의 기본 아바타도 그 사람 일간의 오행을 입는다');
select is(
  (select avatar_element from passed where candidate_user_id = (select uid from folks where who = 'photo')),
  null, '지나친 인연도 사진이 있으면 아바타 색을 보내지 않는다');
select is(
  (select count(*)::int from passed where to_jsonb(passed)::text ~ '[甲乙丙丁戊己庚辛壬癸]'),
  0, '지나친 인연의 어느 칸에도 천간 글자가 없다');

-- ── 3. 명식이 없으면 비어 있다 ──────────────────────────────────────────────

reset role;
select is(
  public.day_master_element_of(tests.signup('avatar-nochart@example.com')),
  null, '내 명식이 없는 사람의 아바타 색은 비어 있다');

select ok(
  not has_function_privilege('authenticated', 'public.day_master_element_of(uuid)', 'execute'),
  '아무 id 로나 일간의 갈래를 묻는 함수는 로그인한 사람도 못 부른다');
select ok(
  not has_function_privilege('anon', 'public.day_master_element_of(uuid)', 'execute'),
  '익명도 못 부른다');

-- ── 4. 반환 칸 목록 — 천간을 싣는 칸이 없다 ─────────────────────────────────

select set_eq(
  $$select a.name from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    cross join lateral unnest(p.proargnames, p.proargmodes) as a(name, mode)
    where n.nspname = 'public' and p.proname = 'my_discovery_board' and a.mode = 't'$$,
  $$values ('candidate_user_id'), ('nickname'), ('intro'), ('has_photo'), ('seat'), ('exploration'),
           ('supplied_elements'), ('balance_band'), ('preview_score'), ('activity'), ('avatar_element')$$,
  '후보 목록이 내주는 칸은 이 열하나뿐이다 — 일간 · 명식 칸은 없다');

select set_eq(
  $$select a.name from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    cross join lateral unnest(p.proargnames, p.proargmodes) as a(name, mode)
    where n.nspname = 'public' and p.proname = 'my_passed_connections' and a.mode = 't'$$,
  $$values ('candidate_user_id'), ('nickname'), ('intro'), ('has_photo'), ('passed_at'),
           ('supplied_elements'), ('balance_band'), ('preview_score'), ('avatar_element')$$,
  '지나친 인연이 내주는 칸은 이 아홉뿐이다 — 일간 · 명식 칸은 없다');

select ok(
  has_function_privilege('authenticated', 'public.my_discovery_board()', 'execute')
    and has_function_privilege('authenticated', 'public.my_passed_connections()', 'execute')
    and not has_function_privilege('anon', 'public.my_discovery_board()', 'execute')
    and not has_function_privilege('anon', 'public.my_passed_connections()', 'execute'),
  '다시 세운 두 문의 권한은 앞과 같다 — 로그인한 사람만');

select * from finish();
rollback;
