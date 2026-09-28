-- 밤샘 감사가 찾은 문 셋 — **사용자가 시도를 닫는 문 · 차단 뒤의 사진 · 서울의 종료일** (ADR 0120)
--
-- 여기서 재는 것은 셋이다. 넷째(첫 덱을 두 세션이 나란히 세운다)는 한 세션의 pgTAP 이 못 만드는 경합이라
-- `scripts/check-db-races.mjs` 의 7 이 psql 둘로 잰다.
--
--   1. **사용자는 도는 시도를 실패로 닫지 못한다.** 실패한 시도는 풀이권을 안 쓰지만 서비스 전체의 하루 상한에는
--      센다 — 사용자가 열고 곧바로 닫기를 되풀이하면 모두의 그날 풀이가 멈춘다. 닫는 문은 열쇠(`fail_reading_job`)뿐이다
--   2. **차단한 · 차단당한 사람의 사진은 요청을 주고받았어도 닫힌다.** 끝난 요청(거절 · 만료 · 무효)은 사진을 안
--      연다 — 끝난 요청만 사진이 닫히면 「거절」과 「차단」이 갈려 차단이 알려진다(PRD 「차단은 소식이 아니다」).
--      요청 목록의 끝난 줄은 그대로 서되(거절로 선다) 소개와 사진 표시는 기다리는 요청에만 싣는다
--   3. **종료일은 서울의 그날 끝까지다.** 세션의 시간대가 무엇이든 서울 날짜로 판정한다 — UTC 로 판정하면 종료
--      다음 날 서울 00:00~09:00 동안 화면은 닫혔는데 RPC 로는 쓰기가 지나갔다
--
-- 3 은 세션 시간대를 UTC-12 와 UTC+14 로 바꿔 가며 잰다. 옛 정의(`current_date`)는 서울 시각이 몇 시든 두 단언
-- 중 적어도 하나에서 붉다 — 앞은 서울 21시 전, 뒤는 서울 19시 뒤에 틀린다.
begin;
select plan(19);

create or replace function pg_temp.acting(uid uuid)
returns void
language plpgsql
as $$
begin
  perform set_config('request.jwt.claims', tests.claims(uid), true);
end;
$$;

/**
 * **열린 베타를 이 파일이 세운다** — 종료일을 오늘(서울)에서 세어 둔다. 손잡이가 적는 고정 날짜가 지나도 1 · 2 가
 * 「베타가 끝났다」로 엉뚱하게 붉지 않게. 일정은 늘 가장 늦게 적은 줄이 이긴다(`current_beta_schedule`).
 */
insert into public.beta_schedule (ends_on, note, operator_name, operator_officer, operator_contact)
values ((now() at time zone 'Asia/Seoul')::date + 30, '열린 베타', '만세력 운영자', '시험 담당', 'ops@example.com');

create temporary table who as
select tests.signup('kim-audit@example.com') as kim,
       tests.signup('lee-audit@example.com') as lee,
       tests.signup('park-audit@example.com') as park,
       tests.signup('choi-audit@example.com') as choi;
grant select on who to authenticated;

-- ── 1. 사용자는 시도를 닫지 못한다 ──────────────────────────────────────────

select hasnt_function('public', 'fail_reading_run', '사용자 권한으로 시도를 실패로 닫는 문이 없다');

set local role authenticated;
select pg_temp.acting((select kim from who));
select throws_ok(
  format($$select public.fail_reading_run(%L::uuid, 'model-call-failed', null, '{"total_tokens": 1}'::jsonb)$$,
    gen_random_uuid()),
  '42883', null,
  '로그인한 사람이 시도를 닫으려 부르면 문이 없다');
reset role;

select ok(
  not has_function_privilege('authenticated', 'public.fail_reading_job(uuid, text, text, jsonb)', 'execute'),
  '열쇠가 닫는 문은 로그인한 사람에게 닫혀 있다');
select ok(
  has_function_privilege('service_role', 'public.fail_reading_job(uuid, text, text, jsonb)', 'execute'),
  '열쇠는 여전히 시도를 닫는다');

-- ── 2. 차단 뒤의 사진 ───────────────────────────────────────────────────────

/**
 * 요청은 문(`request_match`)을 안 거치고 모양 그대로 넣는다 — 여기서 재는 것은 요청이 **있을 때** 사진이 열리는
 * 갈래이지 요청을 여는 자격이 아니다. 자격은 `10_match_request` 가 잰다.
 */
insert into public.profile_photo (user_id, position, content_type, bytes)
values ((select lee from who), 1, 'image/png', '\x89504e47'::bytea),
       ((select kim from who), 1, 'image/png', '\x89504e47'::bytea);
update public.app_user set intro = '이의 소개' where id = (select lee from who);

create temporary table asked (id uuid, asker uuid);
with made as (
  insert into public.match_request
    (requester_user_id, addressee_user_id, policy_version, supplied_to_requester, supplied_to_addressee, balance_band)
  select a.u, (select lee from who), 'discovery-v1', '{}', '{}', 'balanced'
  from (values ((select kim from who)), ((select park from who))) as a(u)
  returning id, requester_user_id
)
insert into asked select id, requester_user_id from made;
grant select on asked to authenticated;

set local role authenticated;
select pg_temp.acting((select kim from who));
select is(
  (select count(*)::int from public.photo_of((select lee from who))), 1,
  '기다리는 요청을 보낸 사람은 받은 사람의 사진을 본다');
select is(
  (select counterpart_intro from public.my_match_requests()
   where request_id = (select id from asked where asker = (select kim from who))),
  '이의 소개',
  '기다리는 요청의 줄에는 소개가 선다');

-- 이가 김을 차단한다 — 김이 보낸 요청은 거절로 거둬진다
select pg_temp.acting((select lee from who));
select is(public.block_user((select kim from who)), true, '받은 사람이 보낸 사람을 차단한다');
select is(
  (select count(*)::int from public.photo_of((select kim from who))), 0,
  '차단한 사람은 요청을 주고받았던 상대의 사진을 못 본다');

select pg_temp.acting((select kim from who));
select is(
  (select count(*)::int from public.photo_of((select lee from who))), 0,
  '차단당한 사람은 요청을 주고받았던 상대의 사진을 못 본다');
select is(
  (select status from public.my_match_requests()
   where request_id = (select id from asked where asker = (select kim from who))),
  'rejected',
  '차단이 끊은 요청은 보낸 사람에게 거절로 선다 — 줄은 그대로다');
select is(
  (select array[coalesce(counterpart_intro, '없음'), counterpart_has_photo::text] from public.my_match_requests()
   where request_id = (select id from asked where asker = (select kim from who))),
  array['없음', 'false'],
  '끊긴 요청의 줄에는 상대의 소개도 사진 표시도 없다');

-- 박의 요청은 차단 없이 거절된다 — 차단과 같은 답이어야 차단이 알려지지 않는다
select pg_temp.acting((select lee from who));
select lives_ok(
  format($$select public.respond_to_match_request(%L::uuid, false)$$,
    (select id from asked where asker = (select park from who))),
  '받은 사람이 박의 요청을 거절한다');

select pg_temp.acting((select park from who));
select is(
  (select count(*)::int from public.photo_of((select lee from who))), 0,
  '그냥 거절된 요청도 사진을 안 연다 — 거절과 차단이 같은 답이다');
select is(
  (select array[coalesce(counterpart_intro, '없음'), counterpart_has_photo::text] from public.my_match_requests()
   where request_id = (select id from asked where asker = (select park from who))),
  array['없음', 'false'],
  '그냥 거절된 줄도 소개와 사진 표시를 안 싣는다 — 차단된 줄과 모양이 같다');

/**
 * **수락된 요청도 차단 뒤에는 닫힌다.** 성립한 쌍의 사진은 `visible_matches` 가 차단을 보고 닫지만, 요청 갈래가
 * 차단을 안 보면 그 갈래로 다시 열린다.
 */
reset role;
insert into public.match_request
  (requester_user_id, addressee_user_id, status, decided_at, policy_version,
   supplied_to_requester, supplied_to_addressee, balance_band)
values ((select choi from who), (select kim from who), 'accepted', now(), 'discovery-v1', '{}', '{}', 'balanced');
set local role authenticated;

select pg_temp.acting((select choi from who));
select is(
  (select count(*)::int from public.photo_of((select kim from who))), 1,
  '수락된 요청의 두 사람은 서로의 사진을 본다');
select pg_temp.acting((select kim from who));
select is(public.block_user((select choi from who)), true, '수락한 사람이 상대를 차단한다');
select pg_temp.acting((select choi from who));
select is(
  (select count(*)::int from public.photo_of((select kim from who))), 0,
  '수락된 요청이라도 차단 뒤에는 사진이 닫힌다');
reset role;

-- ── 3. 종료일은 서울의 그날 끝까지다 ────────────────────────────────────────

/**
 * 일정은 늘 가장 늦게 적은 줄이 이긴다(`current_beta_schedule`). 줄을 더해 종료일을 바꾸고, 파일 끝의
 * `rollback` 이 걷는다. 이 절이 파일 끝에 있는 까닭이다 — 앞의 단언은 열린 베타 위에서 잰다.
 */
insert into public.beta_schedule (ends_on, note, operator_name, operator_officer, operator_contact)
values ((now() at time zone 'Asia/Seoul')::date - 1, '어제 끝났다', '만세력 운영자', '시험 담당', 'ops@example.com');

set local timezone to 'Etc/GMT+12';
select ok(public.beta_is_over(), '서울로 어제가 종료일이면 세션 시간대가 UTC-12 라도 끝났다');

insert into public.beta_schedule (ends_on, note, operator_name, operator_officer, operator_contact)
values ((now() at time zone 'Asia/Seoul')::date, '오늘 끝난다', '만세력 운영자', '시험 담당', 'ops@example.com');

set local timezone to 'Etc/GMT-14';
select ok(not public.beta_is_over(), '서울로 오늘이 종료일이면 세션 시간대가 UTC+14 라도 아직 안 끝났다');

select * from finish();
rollback;
