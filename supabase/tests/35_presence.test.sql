-- 접속 상태 — **활동은 표 하나에 적히고, 구간은 DB 가 내며, 시각은 나가지 않는다** (ADR 0092)
--
--   1. 적는 문은 1분에 한 번만 적는다 — 요청마다 한 줄 쓰지 않는다
--   2. 표와 구간 함수는 `authenticated` 에 닫혀 있다 — 아무 계정의 구간이나 물을 수 없다
--   3. 경계 셋 — 5분 미만은 `now`, 24시간 미만은 `day`, 그 밖과 기록 없음은 `earlier`
--   4. 정지된 계정의 요청은 안 적힌다
--   5. 읽는 문 둘이 내주는 것은 구간 하나다 — 열린 방에만, 후보 카드에는 늘. 시각형 칸은 없다
--   6. 계정을 따라 사라진다
--
-- 역할을 갈아입는다(34 와 같은 까닭). 세는 것은 **이 파일이 만든 행**뿐이다.
begin;
select plan(33);

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

create or replace function pg_temp.participant(
  mail text, who text, summary jsonb, day_stem text default '丙')
returns uuid
language plpgsql
as $$
declare
  uid uuid := tests.signup(mail);
begin
  perform set_config('request.jwt.claims', tests.claims(uid), true);
  perform public.create_self_person(
    '나', 'solar', '1990-05-15', '1990-05-15', '14:30', 'female', '서울', 'jo', 'localMean',
    tests.chart(day_stem), 'chart-for-tests');
  perform public.save_my_profile(who, null);
  perform public.set_discovery_participation(true, summary);
  return uid;
end;
$$;

create or replace function pg_temp.acting(uid uuid)
returns void
language plpgsql
as $$
begin
  perform set_config('request.jwt.claims', tests.claims(uid), true);
end;
$$;

set local role authenticated;

create temporary table folks as
select
  pg_temp.participant('kim-presence@example.com', '김접', pg_temp.summary(4, 4, 0, 0, 0), '丙') as kim,
  pg_temp.participant('lee-presence@example.com', '이접', pg_temp.summary(0, 0, 4, 4, 0), '戊') as lee,
  pg_temp.participant('park-presence@example.com', '박접', pg_temp.summary(0, 0, 0, 0, 8), '庚') as park;
grant select on folks to authenticated;

reset role;

update public.discovery_profile set opted_in_at = null, opted_out_at = now()
where user_id not in (select kim from folks union all select lee from folks union all select park from folks);

-- 김·이 한 쌍 — 방이 선다
set local role authenticated;
select pg_temp.acting((select kim from folks));
select lives_ok($$select count(*) from public.my_discovery_board()$$, '김이 후보 목록을 연다');
create temporary table asked as select public.request_match((select lee from folks)) as to_lee;
grant select on asked to authenticated;
select pg_temp.acting((select lee from folks));
select is(public.respond_to_match_request((select to_lee from asked), true), 'accepted', '이가 수락한다');
reset role;

create temporary table rooms as
select (select m.id from public.match m where m.request_id = (select to_lee from asked)) as kim_lee;
grant select on rooms to authenticated;

-- ---------------------------------------------------------------------------
-- 정책의 수 — 앱이 물어볼 수 있다
-- ---------------------------------------------------------------------------
select results_eq(
  $$select now_window_seconds, write_window_seconds, day_window_seconds from public.presence_policy()$$,
  $$values (300, 60, 86400)$$,
  '「지금」 5분 · 억제 1분 · 하루 — 2026-09-23 에 정한 수 그대로');

-- ---------------------------------------------------------------------------
-- 1. 적는 문 — 1분에 한 번
-- ---------------------------------------------------------------------------
set local role authenticated;
select pg_temp.acting((select kim from folks));

select is(public.touch_activity(), true, '첫 요청은 적는다');
select is(public.touch_activity(), false, '1분 안의 두 번째 요청은 안 적는다');

reset role;
select is(
  (select count(*)::int from public.user_activity where user_id = (select kim from folks)),
  1,
  '계정당 한 줄이다');
select ok(
  (select last_active_at > now() - interval '5 seconds'
   from public.user_activity where user_id = (select kim from folks)),
  '적힌 시각은 지금이다');

update public.user_activity set last_active_at = now() - interval '2 minutes'
where user_id = (select kim from folks);

set local role authenticated;
select pg_temp.acting((select kim from folks));
select is(public.touch_activity(), true, '억제 창이 지나면 다시 적는다');
reset role;
select ok(
  (select last_active_at > now() - interval '5 seconds'
   from public.user_activity where user_id = (select kim from folks)),
  '다시 적은 시각도 지금이다');

-- 일부러 어겨 본 것 — 억제 창을 빼면 위의 「두 번째는 안 적는다」가 빨개진다.

-- ---------------------------------------------------------------------------
-- 2. 표와 구간 함수는 닫혀 있다
-- ---------------------------------------------------------------------------
set local role authenticated;
select pg_temp.acting((select kim from folks));

select throws_ok(
  $$select * from public.user_activity$$,
  '42501', null,
  'authenticated 는 활동 표를 못 읽는다 — 자기 줄도');

select throws_ok(
  format($$select public.activity_band_of(%L)$$, (select lee from folks)),
  '42501', null,
  '구간 함수도 직접 못 부른다 — 아무 계정의 구간이나 물을 수 있으면 그것이 새는 자리다');

select set_config('request.jwt.claims', '{"role":"anon"}', true);
select throws_ok(
  $$select public.touch_activity()$$,
  '28000', '로그인이 필요합니다.',
  '로그인 안 한 요청은 적지 않는다');

reset role;
select ok(not has_function_privilege('anon', 'public.touch_activity()', 'execute'),
  'anon 은 적는 문을 못 부른다');
select ok(has_function_privilege('authenticated', 'public.touch_activity()', 'execute'),
  'authenticated 는 적는 문을 부른다');

-- ---------------------------------------------------------------------------
-- 3. 경계 셋 — postgres 로 시각을 옮기고 구간을 묻는다
-- ---------------------------------------------------------------------------
update public.user_activity set last_active_at = now() - interval '4 minutes 59 seconds'
where user_id = (select kim from folks);
select is(public.activity_band_of((select kim from folks)), 'now', '4분 59초 전은 「지금」');

update public.user_activity set last_active_at = now() - interval '5 minutes'
where user_id = (select kim from folks);
select is(public.activity_band_of((select kim from folks)), 'day', '5분 전은 「최근 24시간」 — 경계는 미만');

update public.user_activity set last_active_at = now() - interval '23 hours 59 minutes'
where user_id = (select kim from folks);
select is(public.activity_band_of((select kim from folks)), 'day', '23시간 59분 전은 「최근 24시간」');

update public.user_activity set last_active_at = now() - interval '24 hours'
where user_id = (select kim from folks);
select is(public.activity_band_of((select kim from folks)), 'earlier', '24시간 전은 「그 전」 — 경계는 미만');

select is(public.activity_band_of((select lee from folks)), 'earlier', '기록이 없으면 「그 전」');
select is(public.activity_band_of(gen_random_uuid()), 'earlier', '없는 계정도 같은 답 — 존재가 안 샌다');

-- ---------------------------------------------------------------------------
-- 4. 정지된 계정의 요청은 안 적힌다
-- ---------------------------------------------------------------------------
update public.app_user set status = 'suspended' where id = (select lee from folks);

set local role authenticated;
select pg_temp.acting((select lee from folks));
select is(public.touch_activity(), false, '정지된 계정의 요청은 안 적는다 — 던지지도 않는다');
reset role;

select is(
  (select count(*)::int from public.user_activity where user_id = (select lee from folks)),
  0,
  '정지된 계정의 줄은 안 생긴다');

update public.app_user set status = 'active' where id = (select lee from folks);

-- ---------------------------------------------------------------------------
-- 5. 읽는 문 둘이 내주는 것은 구간 하나다
-- ---------------------------------------------------------------------------
-- 정지를 풀어도 방은 닫힌 채다(ADR 0091) — 위의 정지가 김·이 방을 닫았으므로 되돌려 둔다.
-- 이 시험이 재는 것은 구간이지 닫힘이 아니다.
update public.chat_room set closed_reason = null, closed_by_user_id = null, closed_at = null
where match_id = (select kim_lee from rooms);

update public.user_activity set last_active_at = now() where user_id = (select kim from folks);

set local role authenticated;
select pg_temp.acting((select lee from folks));
select is(
  (select partner_activity from public.my_chat_rooms() where match_id = (select kim_lee from rooms)),
  'now',
  '방 목록에 상대의 구간이 선다');
reset role;

update public.user_activity set last_active_at = now() - interval '25 hours'
where user_id = (select kim from folks);

set local role authenticated;
select pg_temp.acting((select lee from folks));
select is(
  (select partner_activity from public.my_chat_rooms() where match_id = (select kim_lee from rooms)),
  'earlier',
  '25시간 전이면 「그 전」');

-- 후보 카드 — 박의 목록에 김(그 전)과 이(기록 없음)가 선다
select pg_temp.acting((select park from folks));
select is(
  (select activity from public.my_discovery_board() where candidate_user_id = (select kim from folks)),
  'earlier',
  '후보 카드에 그 사람의 구간이 선다');
select is(
  (select activity from public.my_discovery_board() where candidate_user_id = (select lee from folks)),
  'earlier',
  '기록 없는 후보는 「그 전」');
reset role;

update public.user_activity set last_active_at = now() where user_id = (select kim from folks);
set local role authenticated;
select pg_temp.acting((select park from folks));
select is(
  (select activity from public.my_discovery_board() where candidate_user_id = (select kim from folks)),
  'now',
  '구간은 읽는 순간 계산된다 — 스냅샷에 갇히지 않는다');

-- 닫힌 방에는 안 선다
select pg_temp.acting((select kim from folks));
select ok(public.block_user((select lee from folks)), '김이 이를 차단한다');
select pg_temp.acting((select lee from folks));
select is(
  (select partner_activity from public.my_chat_rooms() where match_id = (select kim_lee from rooms)),
  null,
  '닫힌 방에는 상대의 구간이 안 선다 — 방은 보이되 그 칸은 비어 있다');
reset role;

-- 모양 — 시각형 칸은 없고 구간은 text 다
select ok(
  pg_get_function_result('public.my_chat_rooms'::regproc) like '%partner_activity text%',
  '방 목록의 구간 칸은 text 다');
select ok(
  pg_get_function_result('public.my_discovery_board'::regproc) like '%activity text%',
  '후보 목록의 구간 칸은 text 다');
select is(
  (select count(*)::int
   from pg_proc p
   cross join lateral unnest(p.proargnames, p.proargmodes) as a(name, mode)
   where p.pronamespace = 'public'::regnamespace
     and p.proname in ('my_chat_rooms', 'my_discovery_board')
     and a.mode = 't' and a.name like '%active_at%'),
  0,
  '두 읽는 문 어느 칸에도 활동 시각은 없다');

-- ---------------------------------------------------------------------------
-- 6. 계정을 따라 사라진다
-- ---------------------------------------------------------------------------
select public.forget_user((select kim from folks));
select is(
  (select count(*)::int from public.user_activity where user_id = (select kim from folks)),
  0,
  '계정이 지워지면 활동 줄도 따라간다');

select * from finish();
rollback;
