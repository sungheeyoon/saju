-- 지우는 일 — **FK 가 순서를 정하고, 안 매인 것만 손으로 적는다.**
--
-- 여기서 재는 것 넷.
--
-- 1. **삭제가 실제로 돈다.** 이 시험이 서기 전에는 판본 표의 `created_by` 가 삭제를
--    거절했다. 종료일을 약속하려면 그날 실행할 것이 실재해야 한다.
-- 2. **한 사람이 나가면 그 사람의 것만 사라진다.** 남이 관리하는 Person 의 입력을
--    데려가지 않는다.
-- 3. **주인 없는 출생정보가 안 남는다.** 아무도 관리하지 않게 된 Person 은 그 행째
--    사라진다.
-- 4. **함께 보던 궁합은 상대 화면에서도 사라진다.** Match 행은 대화방의 닻으로 남지만 상대의
--    목록에는 없다 — 무엇이 남고 무엇이 지워지는지는 37 이 잰다(ADR 0094).
-- 5. **FK 가 안 닿는 것까지 지운다.** 감사 로그·flow state·초대 명단은 사용자에 매여
--    있지 않아 cascade 가 못 데려간다 — 그런데 감사 로그는 모든 행이 이메일을 든다.
begin;
select plan(17);

create or replace function pg_temp.summary(w int, f int, e int, g int, s int)
returns jsonb language sql as $$
  select jsonb_build_object(
    'glyphCount', w + f + e + g + s,
    'counts', jsonb_build_object('木', w, '火', f, '土', e, '金', g, '水', s),
    'ratios', jsonb_build_object(
      '木', w / 8.0, '火', f / 8.0, '土', e / 8.0, '金', g / 8.0, '水', s / 8.0));
$$;

create or replace function pg_temp.participant(mail text, who text, summary jsonb)
returns uuid language plpgsql as $$
declare uid uuid := tests.signup(mail);
begin
  perform set_config('request.jwt.claims', tests.claims(uid), true);
  perform public.create_self_person(
    '나', 'solar', '1990-05-15', '1990-05-15', '14:30', 'female', '서울', 'jo', 'localMean',
  tests.chart(), 'chart-for-tests');
  perform public.save_my_profile(who, null);
  perform public.set_discovery_participation(true, summary, tests.need());
  return uid;
end;
$$;

create or replace function pg_temp.acting(uid uuid)
returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claims', tests.claims(uid), true);
end;
$$;

set local role authenticated;

create temporary table folks as
select
  pg_temp.participant('kim-gone@example.com', '김감', pg_temp.summary(4, 4, 0, 0, 0)) as kim,
  pg_temp.participant('lee-gone@example.com', '이감', pg_temp.summary(0, 0, 4, 4, 0)) as lee;
grant select on folks to authenticated, service_role;

reset role;
update public.discovery_profile set opted_in_at = null, opted_out_at = now()
where user_id not in (select kim from folks union all select lee from folks);
set local role authenticated;

/**
 * **둘이 같은 Person 을 관리한다.**
 *
 * 김이 등록한 「엄마」를 이도 관리하게 만든다. 김이 나가도 이 Person 은 남아야 한다 —
 * 판본은 Person 의 것이지 그것을 적어 넣은 사람의 것이 아니다.
 */
select pg_temp.acting((select kim from folks));
create temporary table shared as
select public.create_managed_person(
  '엄마', null, 'solar', '1962-03-02', '1962-03-02', '07:10', 'female', '부산', 'jo', 'localMean'
,
  tests.chart(), 'chart-for-tests') as mom,
public.create_managed_person(
  '삼촌', null, 'solar', '1958-09-30', '1958-09-30', '16:50', 'male', '대전', 'jo', 'localMean'
,
  tests.chart(), 'chart-for-tests') as unc;
grant select on shared to authenticated, service_role;

reset role;
-- 이도 「엄마」를 본다. 이 엣지는 김이 나가도 남는다.
insert into public.user_person_access (user_id, person_id, local_label, role)
values ((select lee from folks), (select mom from shared), '이모', 'viewer');
set local role authenticated;

-- ── Match 하나 ──────────────────────────────────────────────────────────────

select pg_temp.acting((select kim from folks));
select lives_ok($$select count(*) from public.my_discovery_board()$$, '김이 후보 목록을 연다');

create temporary table asked as
select public.request_match((select lee from folks)) as request_id;
grant select on asked to authenticated, service_role;

select pg_temp.acting((select lee from folks));
select is(
  public.respond_to_match_request((select request_id from asked), true),
  'accepted',
  '수락하면 Match 가 선다');

select is(
  (select count(*)::int from public.my_matches()),
  1,
  '이의 화면에 Match 가 하나 선다');

-- ── 지운다 ──────────────────────────────────────────────────────────────────

reset role;

/**
 * **FK 가 안 닿는 자리를 먼저 채워 둔다.**
 *
 * 실제로는 GoTrue 가 로그인마다 쌓는다. 여기서는 손으로 한 줄 넣어 「지워지는가」만
 * 잰다 — 이 행이 남으면 「한 사람을 잊었다」가 거짓이 된다.
 */
insert into auth.audit_log_entries (id, instance_id, payload, created_at)
values (
  gen_random_uuid(), '00000000-0000-0000-0000-000000000000',
  jsonb_build_object(
    'action', 'login',
    'actor_id', (select kim from folks)::text,
    'actor_username', 'kim-gone@example.com'),
  now());

create temporary table forgotten as
select * from public.forget_user((select kim from folks));
grant select on forgotten to authenticated, service_role;

select is(
  (select count(*)::int from auth.users where id = (select kim from folks)),
  0,
  '계정이 사라진다');

select is(
  (select count(*)::int from public.app_user where id = (select kim from folks)),
  0,
  '앱 계정도 함께 사라진다');

/**
 * **매여 있지 않은 것도 사라진다.**
 *
 * 감사 로그는 사용자 id 를 열로 안 들고 `payload` 안에 넣는다 — 그래서 FK 가 없고
 * cascade 가 못 데려간다. 확인해 보니 로컬의 모든 행이 이메일을 그대로 들고 있었다.
 */
select is(
  (select count(*)::int from auth.audit_log_entries a
   where a.payload ->> 'actor_id' = (select kim from folks)::text
      or a.payload ->> 'actor_username' = 'kim-gone@example.com'),
  0,
  '로그인 감사 기록이 남지 않는다');

/*
  **초대 명단은 이제 없다**(ADR 0042). 이 자리에 「명단에서도 그 주소가 사라진다」가
  있었다 — 표를 걷으면서 함께 걷었다. 이메일이 남는 자리가 하나 줄었으므로 지우는
  일이 닿아야 할 곳도 하나 줄었다.
*/

/** 열여덟 갈래가 FK 로 따라간다 — 이 시험은 표 이름을 세 개만 짚어 본다 */
select is(
  (select count(*)::int from public.discovery_profile where user_id = (select kim from folks)),
  0,
  '공개 프로필이 따라간다');

select is(
  (select count(*)::int from public.user_person_access where user_id = (select kim from folks)),
  0,
  '관리하던 엣지가 따라간다');

select is(
  (select count(*)::int from public.match_request where requester_user_id = (select kim from folks)),
  0,
  '보낸 요청이 따라간다');

-- ── 무엇이 남고 무엇이 안 남는가 ────────────────────────────────────────────

/**
 * **주인 없는 출생정보가 안 남는다.**
 *
 * 김의 selfPerson 과 김만 관리하던 「삼촌」은 아무도 볼 수 없게 됐다. 남아 있으면
 * 그것은 지운 적 없는 출생정보다.
 */
select is(
  (select count(*)::int from public.person where id = (select unc from shared)),
  0,
  '아무도 관리하지 않게 된 Person 이 사라진다');

/**
 * **답하는 수는 「이 사람 때문에 사라진 것」이다.**
 *
 * 처음에는 `forget_orphan_people()` 을 그대로 불러 DB 전체의 고아를 쓸었다. 그러면 한
 * 사람을 지우는 일이 남과 무관한 행까지 데려가고, 답한 숫자도 이 사람의 것이 아니다.
 * 그때 그 숫자를 근거로 「무엇이 지워졌나」를 말하게 된다.
 *
 * 이 시험도 처음에는 그 전역 수를 기대해서, 검사 DB 에 남이 남긴 고아가 있으면 빨개졌다 —
 * **전역 개수를 세는 시험은 「DB 가 비어 있는가」를 잰다.**
 */
select is(
  (select people_forgotten from forgotten),
  2,
  '몇을 잊었는지 답한다 — 자기 명식과 혼자 관리하던 한 사람');

/**
 * **남이 관리하는 Person 은 남는다.**
 *
 * `cascade` 로 두었다면 김이 나가면서 이가 보던 「엄마」의 명식까지 데려갔을 것이다.
 * 입력은 Person 의 것이지 그것을 적어 넣은 사람의 것이 아니다.
 */
select is(
  (select count(*)::int from public.person where id = (select mom from shared)),
  1,
  '남이 관리하는 Person 은 남는다');

select isnt(
  (select current_chart from public.person where id = (select mom from shared)),
  null,
  '그 Person 의 명식도 그대로다');

-- ── 함께 보던 궁합은 상대 화면에서도 사라진다 ───────────────────────────────

/**
 * Match 는 두 계정 사이에 선 것이라(ADR 0010) 한쪽 계정이 사라지면 그 화면은 설 수 없다.
 * 행은 대화방의 닻으로 남고 떠난 쪽의 여덟 글자와 궁합풀이는 지워진다(ADR 0094, 37).
 */
set local role authenticated;
select pg_temp.acting((select lee from folks));
select is(
  (select count(*)::int from public.my_matches()),
  0,
  '남은 사람의 Match 목록에서도 그 Match 가 사라진다');

-- ── 한 사람을 지우는 일이 남의 것을 데려가지 않는다 ─────────────────────────

/** 남이 놓고 간 고아는 이 삭제가 데려가지 않는다 — 전체 쓸기는 종료 파기의 일이다 */
reset role;
/**
 * **온전하게 태어난다**(ADR 0071). `current_chart` 가 `not null` 이 된 뒤로 빈 행은
 * 실재할 수 없다 — 시각을 모르는 사람이라 시주도 없는 한 벌을 든다.
 */
insert into public.person (id, current_chart, chart_engine_version)
values ('00000000-0000-0000-0000-0000000000aa', tests.chart('壬', false), 'chart-for-tests');
set local role authenticated;
reset role;
create temporary table stranded as
select * from public.forget_user((select lee from folks));
grant select on stranded to authenticated, service_role;

select is(
  (select count(*)::int from public.person
   where id = '00000000-0000-0000-0000-0000000000aa'),
  1,
  '남이 놓고 간 고아는 그대로 남는다');

/**
 * **답한 수를 재지 않는다.** 이 함수는 DB 전체를 쓰는 것이 그 일이라 답도 전역이고,
 * 그 숫자에 값을 걸면 **「DB 가 비어 있는가」를 재는 시험**이 된다 — 이 파일이 위에서
 * 한 번 걸린 바로 그 자리다. 재려는 것은 「그것까지 데려가는가」이므로 그것만 본다.
 */
select lives_ok($$select public.forget_orphan_people()$$, '전체 쓸기가 돈다');

select is(
  (select count(*)::int from public.person
   where id = '00000000-0000-0000-0000-0000000000aa'),
  0,
  '전체 쓸기는 남이 놓고 간 고아까지 데려간다');

select * from finish();
rollback;
