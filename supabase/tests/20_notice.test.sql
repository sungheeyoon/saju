-- 안내는 첫 입력보다 먼저다 — **묻고 나면 「안 물었다」가 아니다.**
--
-- 여기서 재는 것 넷.
--
-- 1. **안내를 안 본 사람은 첫 입력을 못 넣는다.** 화면에도 관문이 있지만 되돌릴 수
--    없는 첫 쓰기는 DB 가 막는다 — 화면만 막으면 주소나 RPC 로 지나간다.
-- 2. **확인과 선택 답이 한 번에 남는다.** 갈라 받으면 물었는데 답이 `null` 인 사람이
--    생기고, 그 값은 안 물어본 사람과 같아진다.
-- 3. **거절해도 서비스는 그대로다.** 닫히는 것은 설문 하나뿐이다.
-- 4. **철회가 곧 지움이다.** 안내 화면에서 거절한 경우에도 같다.
begin;
select plan(33);

create or replace function pg_temp.acting(uid uuid)
returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claims', tests.claims(uid), true);
end;
$$;

/**
 * **일정을 비우고 시작한다.**
 *
 * 이 파일은 「정해지지 않았을 때」부터 잰다. 그런데 그 표는 전역이고, 다른 검사가 넣어
 * 둔 줄이 남아 있으면 첫 줄부터 다른 세상을 재게 된다 — 이 저장소가 되풀이해 걸린
 * 자리다. 트랜잭션이 되돌아가므로 밖에는 안 남는다.
 */
delete from public.beta_schedule;

set local role authenticated;

/** **안내를 안 본 사람**으로 시작한다 — 이 파일이 재려는 것이 그 자리다 */
create temporary table fresh as select tests.signup_raw('kim-notice@example.com') as kim;
grant select on fresh to authenticated, service_role;

select pg_temp.acting((select kim from fresh));

/** 일정이 없으면 확인 자체가 안 남는다 — 안내가 만들어지지 않기 때문이다 */
select throws_like(
  $$select public.acknowledge_notice('notice-v1', (select s.schedule_id from public.current_beta_schedule() s), false, true)$$,
  '%기간이 정해지지%',
  '일정이 없으면 확인이 남지 않는다');

reset role;
insert into public.beta_schedule (ends_on, note, operator_name, operator_officer, operator_contact)
values ('2026-10-31', '시험', '운영자', '담당', 'ops@example.com');
set local role authenticated;
select pg_temp.acting((select kim from fresh));

-- ── 안내 앞 ────────────────────────────────────────────────────────────────

select is(
  (select a.notice_ack_at from public.app_user a where a.id = (select kim from fresh)),
  null,
  '가입만 한 사람은 안내를 본 적이 없다');

/**
 * **여기가 출생정보가 처음 들어오는 자리다.** 그 앞에 무엇을 어떤 목적으로 얼마나
 * 보관하는지 알리지 않으면, 알린 적 없는 처리가 시작된다.
 */
select throws_like(
  $$select public.create_self_person(
      '나', 'solar', '1990-05-15', '1990-05-15', '14:30', 'female', '서울', 'jo', 'localMean')$$,
  '%처리 안내%',
  '안내를 안 봤으면 첫 입력을 넣을 수 없다');

-- ── 확인 ───────────────────────────────────────────────────────────────────

/** 판본을 안 들고 오면 무엇을 보여 줬는지 못 남긴다 */
select throws_ok(
  $$select public.acknowledge_notice('', (select s.schedule_id from public.current_beta_schedule() s), true, true)$$,
  '23514', null, '판본 없이는 확인이 남지 않는다');

/**
 * **선택 답을 비운 채 지나갈 수 없다.**
 *
 * `null` 은 「아직 안 물었다」인데 이 화면은 물었다. 지나가게 두면 거절한 사람과
 * 안 물어본 사람이 같은 값이 되고, 다시 물어야 할 사람을 못 고른다.
 */
select throws_ok(
  $$select public.acknowledge_notice('notice-v1', (select s.schedule_id from public.current_beta_schedule() s), null, false)$$,
  '23514', null, '선택 항목을 비운 채로는 지나갈 수 없다');

select lives_ok(
  $$select public.acknowledge_notice('notice-v1', (select s.schedule_id from public.current_beta_schedule() s), false, true)$$,
  '확인과 선택 답이 함께 남는다');

select is(
  (select array[a.notice_version, a.improvement_consent::text, a.contact_consent::text]
   from public.app_user a where a.id = (select kim from fresh)),
  array['notice-v1', 'false', 'true'],
  '판본과 두 답이 그대로 남는다');

select isnt(
  (select a.notice_ack_at from public.app_user a where a.id = (select kim from fresh)),
  null, '언제 보여 줬는지도 남는다');

/** 판본과 시각은 함께 있거나 함께 없다 — 반쪽으로는 다시 보여 줄지를 못 정한다 */
reset role;
select throws_ok(
  format($$update public.app_user set notice_ack_at = null where id = %L$$,
    (select kim from fresh)),
  '23514', null, '시각만 지우고 판본을 남길 수 없다');
set local role authenticated;
select pg_temp.acting((select kim from fresh));

-- ── 지나온 뒤 ──────────────────────────────────────────────────────────────

/* 안내 다음이 이름이다 — 이 사람은 `signup_raw` 로 만들어 아직 아무것도 안 지났다 */
select public.save_my_profile('김안', null);

select lives_ok(
  $$select public.create_self_person(
      '나', 'solar', '1990-05-15', '1990-05-15', '14:30', 'female', '서울', 'jo', 'localMean')$$,
  '안내를 본 뒤에는 첫 입력이 들어간다');

/**
 * **거절해도 서비스는 그대로다.**
 *
 * 위에서 개선 활용을 거절했다. 닫히는 것은 설문 하나뿐이고, 사주·풀이 생성은 이 값을
 * 묻지 않는다 — 거절이 서비스를 좁히면 그것은 유효한 동의가 아니다.
 */
select lives_ok(
  $$select * from public.start_reading_run('self', 'notice-self-0001')$$,
  '개선 활용을 거절해도 풀이를 만들 수 있다');

select is(
  (select available from public.my_reading_credits()),
  4,
  '풀이권도 그대로 돈다');

-- ── 다시 물을 때 ───────────────────────────────────────────────────────────

/**
 * 문구가 바뀌면 다시 보여 준다. 그때 마음을 바꾼 사람의 **이미 남긴 답도 지운다** —
 * 동의를 근거로 처리하던 것은 동의가 사라지면 근거가 사라진다(ADR 0022).
 */
select lives_ok(
  $$select public.acknowledge_notice('notice-v2', (select s.schedule_id from public.current_beta_schedule() s), true, false)$$,
  '새 판본을 다시 확인할 수 있다');

select is(
  (select array[a.notice_version, a.improvement_consent::text, a.contact_consent::text]
   from public.app_user a where a.id = (select kim from fresh)),
  array['notice-v2', 'true', 'false'],
  '새 판본과 바뀐 답이 남는다');

reset role;
insert into public.reading_feedback (
  reading_run_id, respondent_user_id, usefulness, perceived_fit, felt_length)
select r.id, (select kim from fresh), 4, 4, 'right'
from public.reading_run r where r.user_id = (select kim from fresh) limit 1;
set local role authenticated;
select pg_temp.acting((select kim from fresh));

select lives_ok(
  $$select public.acknowledge_notice('notice-v3', (select s.schedule_id from public.current_beta_schedule() s), false, false)$$,
  '다시 물었을 때 거절할 수 있다');

reset role;
select is(
  (select count(*)::int from public.reading_feedback
   where respondent_user_id = (select kim from fresh)),
  0,
  '안내 화면에서 거절해도 이미 남긴 답이 지워진다');
set local role authenticated;

-- ── 남의 것은 못 만진다 ────────────────────────────────────────────────────

/**
 * `acknowledge_notice` 는 **uuid 를 안 받는다.** definer 라 정책을 지나가므로, 받으면
 * 남의 확인을 대신 남기는 문이 된다.
 *
 * 남의 행을 **읽어서** 확인하지 않는다 — 정책이 자기 행만 내주므로 그 질의는 언제나
 * 0행이고, 그러면 이 줄은 아무것도 안 재게 된다.
 */
select pg_temp.acting(tests.signup('lee-notice@example.com'));
select lives_ok(
  $$select public.acknowledge_notice('notice-v9', (select s.schedule_id from public.current_beta_schedule() s), true, true)$$,
  '남이 자기 확인을 남긴다');

reset role;
select is(
  (select array[notice_version, improvement_consent::text]
   from public.app_user where id = (select kim from fresh)),
  array['notice-v3', 'false'],
  '남이 확인해도 내 답은 그대로다');

-- ── 일정을 옮기면 ─────────────────────────────────────────────────────────

/**
 * **낡은 화면에 대고 누른 확인은 지금 약속에 대한 확인이 아니다.**
 *
 * 운영자가 날짜를 옮기는 동안 누군가는 옛 날짜가 적힌 화면을 열어 두고 있다. 그 확인을
 * 받아 주면 그 사람은 11월에 지운다는 안내를 보고 확인했는데 기록은 이듬해가 된다.
 */
reset role;
insert into public.beta_schedule (ends_on, note, operator_name, operator_officer, operator_contact)
values ('2026-12-31', '연장', '운영자', '담당', 'ops@example.com');
set local role authenticated;
select pg_temp.acting((select kim from fresh));

select throws_like(
  $$select public.acknowledge_notice('notice-v3', 1::bigint, false, false)$$,
  '%바뀌었습니다%',
  '옛 안내를 들고 온 확인은 거절된다');

select lives_ok(
  $$select public.acknowledge_notice('notice-v3',
      (select s.schedule_id from public.current_beta_schedule() s), false, false)$$,
  '지금 안내로는 확인된다');

select is(
  (select a.notice_ends_on from public.app_user a where a.id = (select kim from fresh)),
  '2026-12-31'::date,
  '본 날짜가 확인 기록에 남는다');

/** 파기 기한은 **DB 가 짓는다** — 화면마다 더하면 그중 하나가 다른 수를 더한다 */
select is(
  (select array[ends_on::text, purge_by::text] from public.current_beta_schedule()),
  array['2026-12-31', '2027-01-30'],
  '파기 기한이 종료일에서 난다');

/** 덮어쓰지 않고 쌓는다 — 무엇을 언제 약속했는지 답할 수 있어야 한다 */
reset role;
select is(
  (select count(*)::int from public.beta_schedule),
  2,
  '일정을 옮겨도 앞의 약속이 남는다');
set local role authenticated;

-- ── 종료일이 끝낸다 ────────────────────────────────────────────────────────

/**
 * **적혀만 있던 날짜를 집행한다.**
 *
 * 일정은 안내에 날짜를 찍고 확인을 다시 받는 데만 쓰였다. 어느 접근 판정에도 안 걸려
 * 있어서 다음 날에도 그대로 돌았다 — 「10월 31일에 끝납니다」라고 적어 두고 안 끝나면
 * 그 문장은 지키는 것이 없다.
 */
select is(public.beta_is_over(), false, '종료일 전에는 안 끝났다');

reset role;
insert into public.beta_schedule (ends_on, note, operator_name, operator_officer, operator_contact)
values ('2020-01-01', '지난 날', '운영자', '담당', 'ops@example.com');
set local role authenticated;
select pg_temp.acting((select kim from fresh));

select is(public.beta_is_over(), true, '종료일이 지나면 끝난 것이다');

/** **한 자리에 걸어 모든 문이 닫힌다** — 문마다 날짜를 적으면 하나는 안 고쳐진다 */
select is(public.is_active_account(), false, '끝나면 계정이 활성이 아니다');

select throws_like(
  $$select * from public.start_reading_run('self', 'over-0001')$$,
  '%끝났습니다%',
  '끝난 뒤에는 풀이를 만들 수 없다 — 돈이 나가는 문이라 따로 건다');

select throws_like(
  $$select public.acknowledge_notice('notice-v3',
      (select s.schedule_id from public.current_beta_schedule() s), false, false)$$,
  '%끝났습니다%',
  '끝난 뒤에는 확인도 안 받는다');

/**
 * **끝난 서비스가 새 자료를 받으면 안 된다.**
 *
 * 설문도 자격을 `reading_scope_for` 에 물었는데 그 함수는 `status` 열만 본다 —
 * 풀이 생성에서 이미 만난 자리이고, 같은 이유로 여기도 종료 뒤에 답이 들어갔다.
 */
select throws_like(
  format($$select public.leave_reading_feedback(%L::uuid, 4::smallint, 4::smallint, 'right')$$,
    gen_random_uuid()),
  '%',
  '끝난 뒤에는 설문도 안 받는다');

/**
 * **`status` 는 안 건드린다.** 그 값은 「이 사람을 중지했다」는 운영 판단이고, 베타가
 * 끝난 것은 그 사람에 대한 판단이 아니다 — 한 열에 적으면 종료 뒤에 중지를 풀 수 없다.
 */
reset role;
select is(
  (select a.status from public.app_user a where a.id = (select kim from fresh)),
  'active',
  '끝나도 계정 상태 자체는 그대로다');
set local role authenticated;
select pg_temp.acting((select kim from fresh));

/** 미루면 다시 열린다 */
reset role;
insert into public.beta_schedule (ends_on, note, operator_name, operator_officer, operator_contact)
values ('2099-12-31', '연장', '운영자', '담당', 'ops@example.com');
set local role authenticated;
select pg_temp.acting((select kim from fresh));

select is(public.beta_is_over(), false, '날짜를 미루면 다시 열린다');

/** 공백은 「있다」가 아니다 — 빈 문자열이 든 안내는 화면에 아무것도 안 적히는 자리를 만든다 */
reset role;
select throws_ok(
  $$insert into public.beta_schedule
      (ends_on, operator_name, operator_officer, operator_contact)
    values ('2027-01-01', '  ', '담당', 'ops@example.com')$$,
  '23514', null, '공백 운영자 정보는 안 들어간다');

select throws_ok(
  $$insert into public.beta_schedule (ends_on, operator_name)
    values ('2027-01-01', '운영자')$$,
  '23514', null, '셋 중 하나만 넣을 수 없다');

select * from finish();
rollback;
