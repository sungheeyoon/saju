-- 사람 저장과 신고의 빗장 (G-23 ④ ⑤, ADR 0102)
--
-- 여기서 재는 것 여섯.
--
--   1. **사람 저장은 한 시간에 스물까지다** — 스물한 번째가 거절된다
--   2. **하루에는 백까지다** — 시간 빗장을 잠시 올려 하루 빗장만 잰다
--   3. **나 자신은 안 센다**
--   4. **신고는 하루 스물까지다**
--   5. **아직 검토되지 않은 같은 대상 · 같은 사유의 신고는 또 쌓지 않는다** — 사유가 다르거나
--      검토가 끝났으면 된다. 중복은 하루 수보다 먼저 판정한다
--   6. **가입이 안 끝난 계정은 저장도 신고도 못 한다** — 공개 출시에서 가입은 본인인증을
--      품으므로(ADR 0101) 이것이 「인증을 마친 계정만」이 된다
--
-- 채팅 메시지 신고의 중복은 방이 서야 재므로 `34_chat` 이 잰다.
begin;
select plan(14);

create temporary table who as
select tests.signup('brake-kim@example.com') as kim,
       tests.signup('brake-lee@example.com') as lee,
       tests.signup_raw('brake-raw@example.com') as raw;
grant select on who to authenticated;

create or replace function pg_temp.acting(uid uuid)
returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claims', tests.claims(uid), true);
end;
$$;

create or replace function pg_temp.save(n int)
returns void language plpgsql as $$
begin
  for i in 1..n loop
    perform public.create_managed_person(
      '사람' || i, null, 'solar', '1990-01-01', '1990-01-01', '12:00', 'female', '서울',
      'jo', 'localMean', tests.chart(), 'chart-for-tests');
  end loop;
end;
$$;

-- ---------------------------------------------------------------------------
-- 사람 저장
-- ---------------------------------------------------------------------------
set local role authenticated;
select pg_temp.acting((select kim from who));

select lives_ok(
  $$select public.create_self_person('나', 'solar', '1990-05-15', '1990-05-15', '14:30', 'female', '서울',
      'jo', 'localMean', tests.chart(), 'chart-for-tests')$$,
  '나 자신은 빗장 밖이다');

select lives_ok($$select pg_temp.save(20)$$, '한 시간에 스물까지 저장한다');

select throws_ok(
  $$select pg_temp.save(1)$$,
  '53400', '사람은 한 시간에 20명까지 저장할 수 있습니다. 잠시 뒤에 다시 저장해 주세요.',
  '스물한 번째는 거절된다');

reset role;
create or replace function public.person_save_hourly_limit()
returns integer language sql immutable set search_path = '' as $$ select 1000 $$;
set local role authenticated;
select pg_temp.acting((select kim from who));

select lives_ok($$select pg_temp.save(80)$$, '시간 빗장을 치우면 하루 백까지 간다');

select throws_ok(
  $$select pg_temp.save(1)$$,
  '53400', '사람은 하루에 100명까지 저장할 수 있습니다. 내일 다시 저장해 주세요.',
  '백한 번째는 거절된다');

reset role;
update public.user_person_access set created_at = now() - interval '2 days'
where user_id = (select kim from who);
set local role authenticated;
select pg_temp.acting((select kim from who));

select lives_ok($$select pg_temp.save(1)$$, '어제까지의 저장은 오늘을 안 막는다 — 총량 제한이 아니다');

select pg_temp.acting((select raw from who));
select throws_ok(
  $$select pg_temp.save(1)$$,
  '42501', '가입을 먼저 끝내 주세요.',
  '가입이 안 끝난 계정은 사람을 저장하지 못한다');

-- ---------------------------------------------------------------------------
-- 신고
-- ---------------------------------------------------------------------------
reset role;
-- 마주친 적이 있어야 신고한다 — 후보로 한 번 본 것으로 둔다
insert into public.discovery_impression
  (viewer_user_id, candidate_user_id, policy_version, position, exploration,
   viewer_summary, candidate_summary, supplied_elements, complement, combined_balance)
select w.kim, w.lee, 'test', 1, false, '{}'::jsonb, '{}'::jsonb, '{}'::text[], 0, 0 from who w
union all
select w.raw, w.lee, 'test', 1, false, '{}', '{}', '{}', 0, 0 from who w;

set local role authenticated;
select pg_temp.acting((select kim from who));

select lives_ok(
  format('select public.report_user(%L, %L, null)', (select lee from who), 'harassment'),
  '처음 신고는 된다');

select throws_ok(
  format('select public.report_user(%L, %L, null)', (select lee from who), 'harassment'),
  '23505', '같은 사유의 신고가 이미 접수되어 검토 중입니다.',
  '같은 사람 · 같은 사유는 검토 전까지 또 쌓지 않는다');

select lives_ok(
  format('select public.report_user(%L, %L, null)', (select lee from who), 'impersonation'),
  '사유가 다르면 된다');

reset role;
update public.report set reviewed_at = now()
where reporter_user_id = (select kim from who) and reason = 'harassment';
-- 오늘 이미 열여덟을 더 낸 것으로 둔다 — 합이 스물
insert into public.report (reporter_user_id, reported_user_id, reason)
select w.kim, w.lee, 'other' from who w, generate_series(1, 18);
set local role authenticated;
select pg_temp.acting((select kim from who));

select throws_ok(
  format('select public.report_user(%L, %L, null)', (select lee from who), 'harassment'),
  '53400', '신고는 하루에 20건까지 할 수 있습니다. 내일 다시 해 주세요.',
  '하루 스물을 넘기면 거절된다 — 검토가 끝난 같은 사유라도');

select throws_ok(
  format('select public.report_user(%L, %L, null)', (select lee from who), 'impersonation'),
  '23505', '같은 사유의 신고가 이미 접수되어 검토 중입니다.',
  '한도에 닿아도 같은 신고를 다시 낸 사람에게는 「이미 접수」가 먼저 선다');

reset role;
update public.report set created_at = now() - interval '2 days'
where reporter_user_id = (select kim from who) and reason = 'other';
set local role authenticated;
select pg_temp.acting((select kim from who));

select lives_ok(
  format('select public.report_user(%L, %L, null)', (select lee from who), 'harassment'),
  '어제의 신고는 오늘을 안 막고, 검토가 끝난 같은 사유는 다시 낼 수 있다');

select pg_temp.acting((select raw from who));
select throws_ok(
  format('select public.report_user(%L, %L, null)', (select lee from who), 'harassment'),
  '42501', '가입을 먼저 끝내 주세요.',
  '가입이 안 끝난 계정은 신고하지 못한다');

select * from finish();
rollback;
