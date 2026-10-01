-- 이용 정지 × 쓰기 문 — **로그인한 사람이 부를 수 있는 쓰기 문 전부를 정지된 계정으로 두드린다**
--
-- `08_suspended` 는 대표 몇 개(프로필 · 후보 · 요약 · 노출 기록)를, `36_suspended_sentence` 는 거절 문장을 잰다.
-- 둘 다 **고른** 문이라, 새 쓰기 문이 정지 판정을 빠뜨리고 들어와도 붉어지는 자리가 없었다(2026-09-28 밤샘 감사
-- 「안 고친 것 — 시험」). 여기서는 목록을 손으로 적되, **`authenticated` 가 부를 수 있는 volatile 함수 전부와
-- 목록이 같은가**를 먼저 잰다 — 새 쓰기 문이 오면 이 파일에 한 줄을 적어야 초록이 된다. 그 줄에 정지된 계정이
-- 부르면 무엇이 서는지를 적는다.
--
-- 부르는 대상은 **실제로 있는 것**이다 — 자기 요청 · 자기 사진 · 자기 방 · 자기 풀이. 없는 id 로 부르면 활성 계정도
-- 같은 자리에서 막혀 「정지 때문에 막혔다」를 못 잰다. 정지 전에 다 만들어 두고, 정지한 뒤 두드린다.
--
-- **열려 있는 문은 운영자가 정한 것뿐이다**(2026-09-30). 처음 잰 날 정지 판정이 없던 넷 가운데 `acknowledge_warning` ·
-- `cancel_match_request` 는 **의도적으로 열어 둔다**(남에게 해가 없고 후속 피해를 줄인다), `clear_my_photo` 는 걷었고,
-- `set_person_listed` 는 막았다(`20261110090000`). 옛 사진 문 `set_my_photo` 는 `20261115090000` 이 걷었다. 열린 둘은 아래 목록에 `OK` 로 적는다 — 누가 닫으면 붉어진다.
begin;
select plan(47);

create or replace function pg_temp.summary(i integer)
returns jsonb
language sql
as $$
  select jsonb_build_object(
    'glyphCount', 8,
    'counts', jsonb_build_object('木', a, '火', b, '土', c, '金', d, '水', 8 - a - b - c - d),
    'ratios', jsonb_build_object(
      '木', a / 8.0, '火', b / 8.0, '土', c / 8.0, '金', d / 8.0, '水', (8 - a - b - c - d) / 8.0))
  from (select i % 3 as a, (i / 3) % 3 as b, (i / 9) % 3 as c, i % 2 as d) v;
$$;

create or replace function pg_temp.participant(mail text, i integer)
returns uuid
language plpgsql
as $$
declare
  uid uuid := tests.signup(mail);
begin
  perform set_config('request.jwt.claims', tests.claims(uid), true);
  perform tests.create_self_person(
    '나', 'solar', '1990-05-15', '1990-05-15', '14:30', 'female', '서울', 'jo', 'localMean',
    tests.chart(), 'chart-for-tests');
  perform public.save_my_profile(left(mail, 8), null);
  perform tests.set_discovery_participation(true, pg_temp.summary(i), tests.need());
  return uid;
end;
$$;

/**
 * 부르고 **무엇이 섰는지를 글자로** 낸다 — 섰으면 `OK`, 막혔으면 `SQLSTATE 문장`.
 *
 * `throws_ok` 를 문마다 적으면 「막혔다」만 재고 무엇으로 막혔는지는 errcode 하나다. 문장까지 한 줄로 내면 없는
 * 대상으로 막힌 것(「요청을 찾지 못했습니다」)과 정지로 막힌 것이 갈린다. invoker 라 부르는 역할 그대로 돈다.
 */
create or replace function pg_temp.knock(q text)
returns text
language plpgsql
as $$
begin
  execute q;
  return 'OK';
exception when others then
  return sqlstate || ' ' || sqlerrm;
end;
$$;
grant execute on function pg_temp.knock(text) to authenticated;

-- ── 정지 전에 대상을 세운다 ────────────────────────────────────────────────────

set local role authenticated;

create temporary table folks as
select
  pg_temp.participant('kim-susp@example.com', 1) as kim,
  pg_temp.participant('lee-susp@example.com', 2) as lee,
  pg_temp.participant('park-susp@example.com', 3) as park,
  pg_temp.participant('choi-susp@example.com', 4) as choi;
grant select on folks to authenticated;

reset role;
/** 다른 시험이 남긴 참여자는 이 파일의 관심 밖이다 */
update public.discovery_profile set opted_in_at = null, opted_out_at = now()
where user_id not in (select kim from folks union all select lee from folks
                      union all select park from folks union all select choi from folks);

create temporary table kept (k text primary key, v uuid);
grant select, insert on kept to authenticated;

set local role authenticated;
select set_config('request.jwt.claims', tests.claims((select kim from folks)), true);

insert into kept
select 'self', self_person_id from public.app_user where id = (select kim from folks);
insert into kept values ('mom', public.create_managed_person(
  '엄마', null, 'solar', '1962-04-15', '1962-04-15', '07:20', 'female', '부산', 'jo', 'localMean',
  tests.chart('甲'), 'chart-for-tests'));
/** 요청은 덱에 선 사람에게만 간다 — 덱을 먼저 연다. 셋뿐이라 셋 다 선다 */
select count(*) from public.my_discovery_board();
insert into kept values ('to_lee', public.request_match((select lee from folks)));
insert into kept values ('to_park', public.request_match((select park from folks)));
insert into kept select 'run', run_id from public.start_reading_run('self', 'susp-run-0001');
select public.add_my_photo('image/jpeg', encode('\xffd8ffe000104a464946'::bytea, 'base64'));

select set_config('request.jwt.claims', tests.claims((select lee from folks)), true);
select public.respond_to_match_request((select v from kept where k = 'to_lee'), true);

reset role;
insert into kept select 'match', m.id from public.match m
where (select kim from folks) in (m.user_low, m.user_high) and (select lee from folks) in (m.user_low, m.user_high);
/** 지나친 사람 하나 — 되돌리는 문의 대상. 덱을 거치지 않고 바로 적는다(정책이 아니라 대상이 필요하다) */
insert into public.discovery_passed (user_id, passed_user_id) values ((select kim from folks), (select choi from folks));

/** 대상이 다 섰는가 — 하나라도 비면 아래 줄은 「없는 대상」으로 막힌 것을 정지로 읽는다 */
select is(
  (select count(*)::int from kept where v is not null),
  6,
  '정지 전에 대상 여섯(내 사람 · 대신 등록 · 요청 둘 · 풀이 · 인연)이 선다');

select is(
  (select count(*)::int from public.profile_photo where user_id = (select kim from folks)),
  1,
  '정지 전에 사진 한 장이 선다');

-- ── 정지한다 ──────────────────────────────────────────────────────────────────

update public.app_user set status = 'suspended' where id = (select kim from folks);

-- ── 목록이 문 전부와 같다 ─────────────────────────────────────────────────────

/**
 * 두드릴 문 — 이름 · 부르는 문장 · 정지된 계정이 받는 것.
 *
 * 문장을 적은 줄은 그 문장 그대로 서야 한다 —
 * 정지 거절 문장(「이용이 정지된 계정입니다.」, G-49)이 아닌 줄은 까닭을 `why` 에 적는다.
 */
create temporary table doors (name text primary key, call text not null, answer text not null, why text);
grant select on doors to authenticated;

insert into doors
select d.name, d.call, d.answer, d.why
from (values
  ('add_my_photo',          $$select public.add_my_photo('image/jpeg', '/9j/4A==')$$, '42501 이용이 정지된 계정입니다.', null),
  ('block_user',            format($$select public.block_user(%L)$$, (select lee from folks)), '42501 이용이 정지된 계정입니다.', null),
  ('complete_signup',       format($$select public.complete_signup('SUSPENDED-0000', '민수', 'notice-for-tests', %s, false, false)$$,
                              (select s.schedule_id from public.current_beta_schedule() s)),
                            '42501 이용이 정지된 계정입니다.', null),
  ('create_managed_person', $$select public.create_managed_person('아빠', null, 'solar', '1960-01-01', '1960-01-01', '07:20', 'male', '부산', 'jo', 'localMean', tests.chart('乙'), 'chart-for-tests')$$,
                            '42501 이용이 정지된 계정입니다.', null),
  ('move_my_photo',         $$select public.move_my_photo(1, 1, 0)$$, '42501 이용이 정지된 계정입니다.', null),
  ('my_discovery_board',    $$select * from public.my_discovery_board()$$, '42501 이용이 정지된 계정입니다.', null),
  ('my_passed_connections', $$select * from public.my_passed_connections()$$, '42501 이용이 정지된 계정입니다.', null),
  ('remove_my_photo',       $$select public.remove_my_photo(1, 0)$$, '42501 이용이 정지된 계정입니다.', null),
  ('report_chat_message',   $$select public.report_chat_message(gen_random_uuid(), 'etc', null)$$, '42501 이용이 정지된 계정입니다.', null),
  ('report_user',           format($$select public.report_user(%L, 'etc', null)$$, (select lee from folks)), '42501 이용이 정지된 계정입니다.', null),
  ('request_account_deletion', $$select public.request_account_deletion()$$, '42501 이용이 정지된 계정입니다.', null),
  ('request_match',         format($$select public.request_match(%L)$$, (select choi from folks)), '42501 이용이 정지된 계정입니다.', null),
  ('respond_to_match_request', format($$select public.respond_to_match_request(%L, true)$$, (select v from kept where k = 'to_park')),
                            '42501 이용이 정지된 계정입니다.', null),
  ('save_my_profile',       $$select public.save_my_profile('새이름', null)$$, '42501 이용이 정지된 계정입니다.', null),
  ('save_service_survey',   $$select public.save_service_survey(array[]::text[], array[]::text[], array[]::text[], null, array[]::text[], array[]::text[], null, null, array[]::text[], null, array[]::text[], false)$$,
                            '42501 이용이 정지된 계정입니다.', null),
  ('send_chat_message',     format($$select public.send_chat_message(%L, '안녕하세요')$$, (select v from kept where k = 'match')),
                            '42501 이용이 정지된 계정입니다.', null),
  ('share_my_reading',      $$select public.share_my_reading('본문', '비유', 'self', null, null)$$, 'P0001 이용이 정지된 계정입니다.',
                            'errcode 없이 던진다 — 문장만 맞췄다(`36_suspended_sentence`)'),

  -- 정지로 막히지만 다른 문장으로 — 판정이 읽기 권한(정지되면 아무것도 안 보인다) 안에 있다
  ('create_pair_for_reading', format($$select * from public.create_pair_for_reading(null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, %L, %L, false, null, null, null, null)$$,
                              (select v from kept where k = 'self'), (select v from kept where k = 'mom')),
                            '42501 저장한 사람 목록에 없는 사람입니다.', '정지되면 내 사람이 안 보인다 — 그 판정으로 막힌다'),
  ('leave_reading_feedback', format($$select public.leave_reading_feedback(%L, 4::smallint, 4::smallint, 'right')$$, (select v from kept where k = 'run')),
                            'P0002 답할 풀이를 찾지 못했습니다.', '풀이의 범위(`reading_scope_for`)가 활성 계정만 낸다'),
  ('mark_chat_read',        format($$select public.mark_chat_read(%L)$$, (select v from kept where k = 'match')),
                            '42501 chat: no such room', '방이 보이는가(`chat_room_readable`)가 활성 계정만 본다'),
  ('person_for_pair',       format($$select public.person_for_pair(%L, null, null, null, null, null, null, null, null, null, null, null, null)$$, (select v from kept where k = 'mom')),
                            '42501 저장한 사람 목록에 없는 사람입니다.', '정지되면 내 사람이 안 보인다'),
  ('restore_passed_connection', format($$select public.restore_passed_connection(%L)$$, (select choi from folks)),
                            '42501 지금은 이 인연을 다시 만나볼 수 없습니다. 목록을 새로 열어 주세요.', '되돌릴 자격(활성 계정)으로 막힌다'),
  ('set_contact_consent',   $$select public.set_contact_consent(true)$$, '42501 이용이 정지된 계정입니다.', null),
  ('set_improvement_consent', $$select public.set_improvement_consent(true)$$, '42501 이용이 정지된 계정입니다.', null),
  ('set_person_listed',     format($$select public.set_person_listed(%L, false)$$, (select v from kept where k = 'mom')),
                            '42501 이용이 정지된 계정입니다.', null),
  ('set_pair_relation',     format($$select public.set_pair_relation(%L, %L, 'family')$$, (select v from kept where k = 'self'), (select v from kept where k = 'mom')),
                            '42501 new row violates row-level security policy for table "pair_relation"', 'invoker — 정책이 막는다'),
  ('start_reading_run',     $$select * from public.start_reading_run('self', 'susp-run-0002')$$,
                            '23514 결과를 만들 수 있는 대상이 아닙니다.', '풀이의 범위가 활성 계정만 낸다'),
  ('open_reading_order',    $$select * from public.open_reading_order(10, 'portone', 'susp-order-0001')$$,
                            '55000 reading_order: the sale is closed', '판매가 닫힌 판정이 먼저 선다 — 판매가 열리면 정지 판정(42501)이 선다'),

  -- 막히지 않되 아무것도 안 쓴다
  ('mark_notifications_read', $$select public.mark_notifications_read()$$, 'OK', '보이는 알림(`visible_notifications`)이 활성 계정만 낸다 — 0 을 고친다'),
  ('touch_activity',        $$select public.touch_activity()$$, 'OK', '활성 계정이 아니면 쓰지 않고 거짓을 낸다'),

  -- 의도적으로 열려 있다 — 운영자 결정(2026-09-30): 남에게 해가 없고 후속 피해를 줄인다
  ('acknowledge_warning',   $$select public.acknowledge_warning('W-0000')$$, 'OK', '의도적으로 열림 — 받은 경고를 읽었다고 적는다'),
  ('cancel_match_request',  format($$select public.cancel_match_request(%L)$$, (select v from kept where k = 'to_park')), 'OK',
                            '의도적으로 열림 — 내가 보낸 요청을 거둔다')
) as d(name, call, answer, why);

/**
 * **목록이 문 전부와 같다.** `authenticated` 가 부를 수 있는 public 함수 가운데 volatile 인 것(쓰기이거나 쓰기를 품은
 * 읽기)에서 운영자 문을 뺀 집합이다. 운영자 문은 정지가 아니라 운영자인가로 닫힌다(`45_operator_reports` 등).
 * 풀에 오르는 값을 쓰는 문 넷은 `authenticated` 에 닫혀 있어 여기 안 든다 — 아래 따로 두드린다.
 */
select set_eq(
  $$select p.proname::text
    from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.provolatile = 'v'
      and has_function_privilege('authenticated', p.oid, 'EXECUTE')
      and p.proname not like 'operator\_%' and p.proname <> 'note_operator_denial'$$,
  $$select name from doors$$,
  '로그인한 사람이 부를 수 있는 쓰기 문이 이 파일의 목록과 같다 — 새 문은 여기에 한 줄을 적는다');

-- ── 두드린다 ──────────────────────────────────────────────────────────────────

set local role authenticated;
select set_config('request.jwt.claims', tests.claims((select kim from folks)), true);

create temporary table knocked as
select name, pg_temp.knock(call) as got from doors;

reset role;

select is(k.got, d.answer, d.name || ' — ' || coalesce(d.why, '정지 거절'))
from doors d join knocked k using (name)
order by d.name;

-- ── 막힌 문은 아무것도 안 바꿨다 ──────────────────────────────────────────────

select is(
  (select count(*)::int from public.profile_photo where user_id = (select kim from folks)),
  1,
  '사진은 그대로다 — 올리기 · 옮기기 · 지우기 문이 막혔고, 전부 내리던 옛 문(`clear_my_photo`)은 걷었다');

select is(
  (select count(*)::int from public.match_request where requester_user_id = (select kim from folks) and status = 'pending'),
  0,
  '보낸 요청은 의도적으로 열린 문(`cancel_match_request`)으로만 거둬졌다 — 새 요청은 서지 않았다');

select is(
  (select count(*)::int from public.person p
   join public.user_person_access a on a.person_id = p.id
   where a.user_id = (select kim from folks)),
  2,
  '사람은 늘지 않았다 — 내 사람과 대신 등록 둘 그대로');

/** 수락이 인연 풀이를 하나 세우므로 이 파일이 연 시도(`susp-`)만 센다 */
select is(
  (select count(*)::int from public.reading_run
   where user_id = (select kim from folks) and idempotency_key like 'susp-%'),
  1,
  '풀이 시도는 늘지 않았다');

-- ── 표에 직접 쓰기 ────────────────────────────────────────────────────────────

set local role authenticated;
select set_config('request.jwt.claims', tests.claims((select kim from folks)), true);

select throws_ok(
  format($$insert into public.discovery_passed (user_id, passed_user_id) values (%L, %L)$$,
    (select kim from folks), (select lee from folks)),
  '42501', null,
  '지나친 목록에 직접 못 쌓는다');

with changed as (update public.discovery_profile set prefer_gender = 'female' returning 1)
select is((select count(*)::int from changed), 0, '풀의 선호 성별을 못 고친다');

with changed as (update public.user_person_access set note = '바꿔치기' returning 1)
select is((select count(*)::int from changed), 0, '저장한 사람의 메모를 못 고친다');

with gone as (delete from public.user_person_access where person_id = (select v from kept where k = 'mom') returning 1)
select is((select count(*)::int from gone), 0, '저장한 사람을 목록에서 못 지운다');

-- ── 풀에 오르는 값을 쓰는 문 넷 — 열쇠로 불러도 DB 가 정지를 본다(ADR 0136) ─────────

select throws_ok(
  $$select tests.create_self_person('민수', 'solar', '1990-05-15', '1990-05-15', '14:30', 'male', '서울', 'jo', 'localMean', tests.chart(), 'chart-for-tests')$$,
  '42501', '이용이 정지된 계정입니다.',
  '열쇠의 create_self_person 도 정지를 본다');

select throws_ok(
  format($$select tests.edit_person_input(%L, 'solar', '1990-05-16', '1990-05-16', '14:30', 'male', '서울', 'jo', 'localMean', tests.chart(), 'chart-for-tests')$$,
    (select v from kept where k = 'self')),
  '42501', '이용이 정지된 계정입니다.',
  '열쇠의 edit_person_input 도 정지를 본다');

select throws_ok(
  $$select tests.set_discovery_participation(false, null, null)$$,
  '42501', '이용이 정지된 계정입니다.',
  '열쇠의 set_discovery_participation 도 정지를 본다');

select throws_ok(
  format($$select tests.ensure_discovery_participation(%L, %L, tests.need())$$,
    (select v from kept where k = 'self'), pg_temp.summary(5)),
  '42501', '이용이 정지된 계정입니다.',
  '열쇠의 ensure_discovery_participation 도 정지를 본다');

reset role;
select * from finish();
rollback;
