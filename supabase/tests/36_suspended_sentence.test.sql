-- 이용 정지 — **DB 가 던지는 거절 문장은 「이용이 정지된 계정입니다.」 하나다** (G-49)
--
-- 앱은 우리 한국어 문장을 그대로 화면에 세운다(`app/db-error.ts`). 그래서 DB 가 던지는 문장이 곧
-- 사람이 읽는 문장이다. 2026-09-23 까지 함수 21개가 옛 이름(「중지」)으로 던졌다.
--
--   1. **옛 문장을 던지는 함수가 없다** — 살아 있는 정의(`pg_proc.prosrc`)를 센다. 새 함수가 옛
--      마이그레이션에서 본문을 베껴 오면 여기서 빨개진다.
--   2. 이용이 정지된 계정으로 대표 함수들을 부르면 **새 문장이 선다** — errcode 까지.
begin;
select plan(11);

-- ── 1. 살아 있는 정의 ─────────────────────────────────────────────────────────

select is(
  (select count(*)::int
     from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.prosrc like '%''중지된 계정입니다%'),
  0,
  '옛 문장을 던지는 함수는 없다');

select cmp_ok(
  (select count(*)::int
     from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.prosrc like '%''이용이 정지된 계정입니다.''%'),
  '>=', 21,
  '정지된 계정을 거절하는 함수 21개가 새 문장을 든다');

-- ── 2. 부르면 무엇이 서나 ──────────────────────────────────────────────────────

create temporary table who as
select tests.signup('kim@example.com') as kim, tests.signup('lee@example.com') as lee;
grant select on who to authenticated;

update public.app_user set status = 'suspended' where id = (select kim from who);

set local role authenticated;
select set_config('request.jwt.claims', tests.claims((select kim from who)), true);

select throws_ok(
  $$select public.save_my_profile('민수', null)$$,
  '42501', '이용이 정지된 계정입니다.',
  '프로필을 못 고친다');

select throws_ok(
  $$select * from public.my_discovery_board()$$,
  '42501', '이용이 정지된 계정입니다.',
  '후보를 못 본다');

select throws_ok(
  format($$select public.request_match(%L)$$, (select lee from who)),
  '42501', '이용이 정지된 계정입니다.',
  '요청을 못 보낸다');

select throws_ok(
  format($$select public.block_user(%L)$$, (select lee from who)),
  '42501', '이용이 정지된 계정입니다.',
  '차단도 못 한다');

select throws_ok(
  format($$select public.report_user(%L, 'etc', null)$$, (select lee from who)),
  '42501', '이용이 정지된 계정입니다.',
  '신고도 못 한다');

select throws_ok(
  $$select public.request_account_deletion()$$,
  '42501', '이용이 정지된 계정입니다.',
  '탈퇴 신청도 DB 가 같은 문장으로 막는다');

select throws_ok(
  $$select public.create_self_person(
      '민수', 'solar', '1990-05-15', '1990-05-15', '14:30', 'male', '서울', 'jo', 'localMean',
      tests.chart(), 'chart-for-tests')$$,
  '42501', '이용이 정지된 계정입니다.',
  '사람을 못 만든다');

select throws_ok(
  format($$select public.send_chat_message(%L, '안녕하세요')$$, gen_random_uuid()),
  '42501', '이용이 정지된 계정입니다.',
  '대화를 못 보낸다');

/**
 * `share_my_reading` 만 errcode 없이(`P0001`) 던진다 — G-49 는 문장만 맞췄다.
 * 코드까지 맞추면 이 줄의 `P0001` 을 고친다.
 */
select throws_ok(
  $$select public.share_my_reading('본문', '비유', 'self', null, null)$$,
  'P0001', '이용이 정지된 계정입니다.',
  '풀이를 못 나눈다 — 같은 문장');

select * from finish();
rollback;
