-- 맛보기 퍼널 단계를 세션당 한 번 센다 (`20261119090000`)
--
-- 여기서 재는 것.
--
--   1. **문은 열쇠에만, 표는 아무에게도** — 익명 · 로그인한 사람은 문을 못 부르고, 열쇠도 표를 직접 못 만진다
--   2. **세션당 한 번** — 같은 세션의 같은 단계는 두 번째부터 안 센다. 다른 단계 · 다른 세션은 따로 센다
--   3. **세션 · 브라우저 HMAC 이 함께 맞아야 센다** — 다른 HMAC · 없는 세션은 아무것도 안 늘린다
--   4. **앱이 못 세는 단계는 던진다** — DB 가 세는 단계 · 회수가 세는 `reading_succeeded` · 걷은 `more_clicked`(G-85)
--   5. **세션이 지워지면 표도 지워진다**
--
-- 이 파일이 만든 행만 센다 — 오늘의 퍼널 줄은 트랜잭션 안에서 0 으로 두고 잰다(롤백이 되돌린다).
begin;
select plan(17);

create function pg_temp.h(tag text)
returns text language sql immutable as $$ select encode(sha256(convert_to('taste-step-test:' || tag, 'UTF8')), 'hex') $$;

create function pg_temp.today(metric text)
returns bigint language sql as $$
  select coalesce((select c.value from public.taste_daily_count c where c.day = public.taste_today() and c.metric = $1), 0)
$$;

create function pg_temp.step(session uuid, browser text, step text)
returns boolean language sql as $$ select public.count_taste_step_once(session, pg_temp.h(browser), step) $$;

delete from public.taste_daily_count where day = public.taste_today();

-- 세션 둘 — 예약 문이 세운다(모델은 안 부른다 · 결과도 안 적는다)
create temp table made as
select
  (select r.session_id from public.reserve_taste(pg_temp.h('fp-a'), 'taste-v1', 'luna-none-v1', pg_temp.h('browser-a'), pg_temp.h('ip-a')) r) as a,
  (select r.session_id from public.reserve_taste(pg_temp.h('fp-b'), 'taste-v1', 'luna-none-v1', pg_temp.h('browser-b'), pg_temp.h('ip-b')) r) as b,
  pg_temp.h('browser-a') as ha;
grant select on made to anon, authenticated;

-- ===========================================================================
-- 1. 권한
-- ===========================================================================

select ok(
  has_function_privilege('service_role', 'public.count_taste_step_once(uuid, text, text)', 'execute')
  and not has_function_privilege('anon', 'public.count_taste_step_once(uuid, text, text)', 'execute')
  and not has_function_privilege('authenticated', 'public.count_taste_step_once(uuid, text, text)', 'execute'),
  '세션당 한 번 세는 문은 열쇠만 부른다');

set local role anon;
select throws_ok(format($$select public.count_taste_step_once(%L, %L, 'signup_started')$$, (select a from made), (select ha from made)),
  '42501', null, '익명은 퍼널을 직접 못 센다');
reset role;

set local role authenticated;
select throws_ok($$select * from public.taste_session_step$$, '42501', null, '로그인한 사람은 센 표를 못 읽는다');
reset role;

set local role service_role;
select throws_ok($$select * from public.taste_session_step$$, '42501', null, '열쇠도 표를 직접 못 읽는다 — 문으로만');
reset role;

-- ===========================================================================
-- 2. 세션당 한 번
-- ===========================================================================

select is(pg_temp.step((select a from made), 'browser-a', 'signup_started'), true, '처음 누른 가입 시작은 센다');
select is(pg_temp.step((select a from made), 'browser-a', 'signup_started'), false, '같은 세션의 가입 시작은 다시 안 센다');
select is(pg_temp.today('funnel:signup_started'), 1::bigint, '가입 시작을 두 번 눌러도 수는 하나다');

select is(pg_temp.step((select b from made), 'browser-b', 'signup_started'), true, '다른 세션은 따로 센다');
select is(pg_temp.today('funnel:signup_started'), 2::bigint, '두 세션의 가입 시작은 둘이다');

select is(pg_temp.step((select a from made), 'browser-a', 'signup_completed'), true, '다른 단계는 따로 센다 — 가입을 마치고 돌아온 것');
select is(pg_temp.step((select a from made), 'browser-a', 'signup_completed'), false,
  '귀속 표를 지우고 다시 돌아와도 같은 세션은 다시 안 센다');

-- ===========================================================================
-- 3. 세션 · HMAC 이 함께 맞아야
-- ===========================================================================

select is(pg_temp.step((select b from made), 'browser-a', 'signup_completed'), false, '다른 브라우저의 HMAC 으로는 안 센다');
select is(pg_temp.step(gen_random_uuid(), 'browser-a', 'signup_completed'), false, '없는 세션은 안 센다');
select is(pg_temp.today('funnel:signup_completed'), 1::bigint, '안 센 누름은 수를 안 늘린다');

-- ===========================================================================
-- 4. 앱이 못 세는 단계
-- ===========================================================================

select throws_ok(format($$select public.count_taste_step_once(%L, %L, 'reading_succeeded')$$, (select a from made), pg_temp.h('browser-a')),
  '22023', null, '풀이 성공은 회수가 센다 — 이 문은 안 받는다');
select throws_ok(format($$select public.count_taste_step_once(%L, %L, 'more_clicked')$$, (select b from made), pg_temp.h('browser-b')),
  '22023', null, '「더보기」는 걷은 단계다 — 이 문은 안 받는다(G-85)');

-- ===========================================================================
-- 5. 세션과 함께 지워진다
-- ===========================================================================

delete from public.taste_session where id = (select a from made);
select is((select count(*)::int from public.taste_session_step where session_id = (select a from made)), 0,
  '세션이 지워지면 센 표도 함께 지워진다');

select * from finish();
rollback;
