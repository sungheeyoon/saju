-- 신고와 떠나기 — **차단과 나란히 있되 같은 일이 아니다.**
--
-- 여기서 재는 것 넷.
--
-- 1. **신고 기록은 신고한 사람만 자기 것을 본다.** 신고당한 쪽에게 보이면 그것이 곧
--    보복의 통로다.
-- 2. **마주친 적 없는 사람은 신고할 수 없다.** 없으면 uuid 를 넣어 보는 것만으로 남의
--    계정에 신고를 쌓을 수 있다.
-- 3. **삭제 요청은 상태 하나로 바깥 길을 다 막는다.** 새 관문을 두지 않았으므로,
--    이미 있던 문들이 그 값을 보고 막는지 실제로 눌러 본다.
-- 4. **요청은 정리되고 Match 는 남는다.** 답할 수 없는 요청을 상대가 계속 보지 않게
--    하되, 두 사람의 것인 Match 를 한쪽이 지우지는 않는다.
begin;
select plan(21);

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

create or replace function pg_temp.participant(mail text, who text, summary jsonb)
returns uuid
language plpgsql
as $$
declare
  uid uuid := tests.signup(mail);
begin
  perform set_config('request.jwt.claims', tests.claims(uid), true);
  perform public.create_self_person(
    '나', 'solar', '1990-05-15', '1990-05-15', '14:30', 'female', '서울', 'jo', 'localMean');
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

/**
 * 이 셋 말고는 후보 목록에서 치운다.
 *
 * **후보 목록은 열 명까지다.** 로컬 DB 에는 흐름·e2e 검사가 만든 참여자가 쌓여 있어서,
 * 치우지 않으면 「마주쳤다」가 상위 열에 들었는지에 달리게 된다 — 그러면 이 시험이
 * 재는 것은 신고 규칙이 아니라 **DB 가 비어 있는가**다.
 *
 * 소유자 권한으로 넣는다. 재려는 것은 「다시 보지 않기」가 아니라 그 뒤의 신고다.
 */
create or replace function pg_temp.only_these(viewer uuid, keep uuid[])
returns void
language sql
security definer
as $$
  insert into public.discovery_hidden (user_id, hidden_user_id)
  select viewer, p.user_id
  from public.discovery_profile p
  where p.user_id <> viewer and not (p.user_id = any (keep))
  on conflict do nothing;
$$;

set local role authenticated;

create temporary table folks as
select
  pg_temp.participant('kim-report@example.com', '김신', pg_temp.summary(4, 4, 0, 0, 0)) as kim,
  pg_temp.participant('lee-report@example.com', '이신', pg_temp.summary(0, 0, 4, 4, 0)) as lee,
  pg_temp.participant('park-report@example.com', '박신', pg_temp.summary(0, 0, 0, 0, 8)) as park;
grant select on folks to authenticated, service_role;

-- ---------------------------------------------------------------------------
-- 마주친 적 있어야 신고할 수 있다
-- ---------------------------------------------------------------------------

select pg_temp.only_these(
  (select kim from folks), array[(select lee from folks), (select park from folks)]);
select pg_temp.only_these(
  (select lee from folks), array[(select kim from folks), (select park from folks)]);
select pg_temp.only_these(
  (select park from folks), array[(select kim from folks), (select lee from folks)]);

select pg_temp.acting((select kim from folks));

select throws_ok(
  format('select public.report_user(%L, %L, null)', (select park from folks), 'harassment'),
  '42501', null,
  '마주친 적 없는 사람은 신고할 수 없다');

select throws_ok(
  format('select public.report_user(%L, %L, null)', (select kim from folks), 'harassment'),
  '22023', null,
  '자기 자신은 신고할 수 없다');

-- 후보 목록에서 한 번 보면 마주친 것이다.
select public.my_discovery_board();

select lives_ok(
  format('select public.report_user(%L, %L, %L)', (select lee from folks), 'harassment', '  겪은 일  '),
  '후보로 본 사람은 신고할 수 있다');

select is(
  (select detail from public.report where reported_user_id = (select lee from folks)),
  '겪은 일',
  '앞뒤 공백은 떼고 저장한다');

select throws_ok(
  format('select public.report_user(%L, %L, null)', (select lee from folks), 'because-i-said-so'),
  '22023', null,
  '고른 것 밖의 사유는 받지 않는다');

-- 같은 사람을 다시 신고할 수 있다 — 차단은 상태이고 신고는 사건이다.
select lives_ok(
  format('select public.report_user(%L, %L, null)', (select lee from folks), 'inappropriate'),
  '같은 사람을 두 번 신고할 수 있다');

select is(
  (select count(*)::int from public.report where reported_user_id = (select lee from folks)),
  2,
  '두 건이 따로 남는다');

-- ---------------------------------------------------------------------------
-- 신고 기록은 낸 사람만 본다
-- ---------------------------------------------------------------------------

select pg_temp.acting((select lee from folks));

select is(
  (select count(*)::int from public.report),
  0,
  '신고당한 쪽에는 한 줄도 안 보인다');

select throws_ok(
  format('insert into public.report (reporter_user_id, reported_user_id, reason)
          values (%L, %L, %L)', (select lee from folks), (select kim from folks), 'other'),
  '42501', null,
  '표에 직접 넣지 못한다 — 문은 RPC 하나다');

select pg_temp.acting((select kim from folks));

select is(
  (select count(*)::int from public.report),
  2,
  '내가 낸 신고는 내가 본다');

-- ---------------------------------------------------------------------------
-- 떠나기 — 상태 하나가 바깥 길을 다 막는다
-- ---------------------------------------------------------------------------

-- 한 쌍 사이에 유효한 pending 은 하나뿐이므로(ADR 0009) 상대를 갈라 둘을 만든다.
select pg_temp.acting((select lee from folks));
select public.my_discovery_board();
select public.request_match((select park from folks));

select pg_temp.acting((select park from folks));
select public.my_discovery_board();
select public.request_match((select kim from folks));

/*
  요청 표는 사용자에게 직접 안 열려 있다 — 읽는 문은 `my_match_requests()` 하나다.
  여기서 세려는 것은 화면이 아니라 **표에 남은 사실**이므로 소유자로 돌아가 센다.
  같은 이유로 참여 요약도 소유자로 읽는다 — 삭제를 요청한 계정으로 읽으면 정책이
  0행을 내주고, 그러면 「거둬졌다」가 「안 보인다」와 구별되지 않는다.
*/
-- 이 시점의 park: lee 에게서 받은 요청 하나와 kim 에게 보낸 요청 하나.
reset role;
select is(
  (select count(*)::int from public.match_request
   where status = 'pending' and (requester_user_id = (select park from folks)
      or addressee_user_id = (select park from folks))),
  2,
  '떠나기 전에 살아 있는 요청이 둘이다');

set local role authenticated;
select lives_ok(
  'select public.request_account_deletion()',
  '삭제를 요청한다');

select is(
  (select status from public.app_user where id = (select park from folks)),
  'deletion_requested',
  '상태가 옮겨진다');

select isnt(
  (select deletion_requested_at from public.app_user where id = (select park from folks)),
  null,
  '요청한 시각이 남는다');

reset role;
select is(
  (select count(*)::int from public.match_request
   where status = 'pending' and (requester_user_id = (select park from folks)
      or addressee_user_id = (select park from folks))),
  0,
  '살아 있던 요청이 정리된다 — 답할 수 없는 요청을 상대가 계속 보지 않는다');

select is(
  (select opted_in_at from public.discovery_profile where user_id = (select park from folks)),
  null,
  '매칭 참여가 꺼지고 내놓은 요약도 거둬진다');

set local role authenticated;

-- **새 관문을 두지 않았다.** 이미 있던 문들이 이 상태를 보고 막는지 눌러 본다.
select throws_ok(
  format('select public.request_match(%L)', (select lee from folks)),
  '42501', null,
  '삭제를 요청한 계정은 새 요청을 보내지 못한다');

select throws_ok(
  format('select public.report_user(%L, %L, null)', (select lee from folks), 'other'),
  '42501', null,
  '삭제를 요청한 계정은 신고도 하지 못한다');

select is(
  (select count(*)::int from public.person),
  0,
  '삭제를 요청한 계정에는 자기 Person 도 안 보인다 — 정책이 같은 값을 본다');

-- 두 번 눌러도 처음 요청한 시각을 밀어내지 않는다.
select lives_ok(
  'select public.request_account_deletion()',
  '두 번 눌러도 그대로다');

-- 상태 값과 시각은 함께 움직인다 — 검사식이 그것을 강제한다.
reset role;
select throws_ok(
  format('update public.app_user set status = %L where id = %L',
         'deletion_requested', (select kim from folks)),
  '23514', null,
  '시각 없이 상태만 옮길 수 없다');

select * from finish();
rollback;
