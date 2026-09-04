-- 중지된 계정 — **읽지도 쓰지도 못한다.** 판정은 앱이 아니라 정책이 든다.
begin;
select plan(12);

create temporary table who as
select tests.signup('kim@example.com') as kim, tests.signup('lee@example.com') as lee;
grant select on who to authenticated;

create temporary table summary as
select '{"glyphCount":8,"counts":{"木":2,"火":2,"土":2,"金":1,"水":1},
         "ratios":{"木":0.25,"火":0.25,"土":0.25,"金":0.125,"水":0.125}}'::jsonb as elements;
grant select on summary to authenticated;

set local role authenticated;
select set_config('request.jwt.claims', tests.claims((select kim from who)), true);

create temporary table mine as
select public.create_self_person(
  '민수', 'solar', '1990-05-15', '1990-05-15', '14:30', 'male', '서울', 'jo', 'localMean'
) as person_id;
grant select on mine to authenticated;

select public.create_managed_person(
  '엄마', null, 'solar', '1962-04-15', '1962-04-15', '07:20', 'female', '부산', 'jo', 'localMean');

select public.save_my_profile('민수', null);
select public.set_discovery_participation(true, (select elements from summary));

-- 여기까지는 다 된다. 이제 운영자가 계정을 중지한다.
reset role;
update public.app_user set status = 'suspended' where id = (select kim from who);

set local role authenticated;
select set_config('request.jwt.claims', tests.claims((select kim from who)), true);

-- ── 읽기 ──────────────────────────────────────────────────────────────────────
--
-- 여태 막힌 것은 쓰기뿐이었다. 화면은 「중지된 계정입니다」라고 말하고 있었으므로
-- **판정이 앱에만 있었다** — ADR 0004 가 막으려던 자리다.

select is((select count(*)::int from public.person), 0, '중지되면 내 Person 도 안 보인다');
select is((select count(*)::int from public.person_chart_revision), 0, '판본도 안 보인다');
select is((select count(*)::int from public.user_person_access), 0, '내 목록도 안 보인다');
select is((select count(*)::int from public.discovery_profile), 0, '내 프로필도 안 보인다');

/**
 * `app_user` 만은 그대로 읽힌다.
 *
 * 자기 상태를 못 읽으면 화면이 「중지된 계정입니다」라고 말할 근거를 잃고, 로그인은
 * 됐는데 아무 설명도 없는 화면이 남는다.
 */
select is(
  (select status from public.app_user where id = (select kim from who)),
  'suspended',
  '자기 계정 상태는 여전히 읽힌다 — 화면이 그렇게 말할 근거다');

-- ── 쓰기 ──────────────────────────────────────────────────────────────────────
with changed as (
  update public.user_person_access set local_label = '바꿔치기' returning 1
)
select is((select count(*)::int from changed), 0, '부를 이름을 못 고친다');

with removed as (
  delete from public.discovery_hidden returning 1
)
select is((select count(*)::int from removed), 0, '감춘 목록도 못 건드린다');

select throws_ok(
  $$select public.save_my_profile('새이름', null)$$,
  '42501', null,
  '이름도 못 고친다');

-- ── RPC ───────────────────────────────────────────────────────────────────────
select throws_ok(
  $$select * from public.my_discovery_board()$$,
  '42501', null,
  '후보를 볼 수 없다');

select throws_ok(
  format($$select public.refresh_discovery_summary(%L, %L)$$,
    (select person_id from mine), (select elements from summary)),
  '42501', null,
  '매칭 풀의 요약도 못 갱신한다');

/**
 * 노출 기록은 **손으로 적을 자리가 없다.**
 *
 * 예전에는 인증 사용자가 후보 id·자리·탐색 여부를 적어 넣는 RPC 가 있었다. 그 함수를
 * 없애고 `my_discovery_board` 안으로 넣었으므로, 중지된 계정이 기록을 남길 길도 함께 사라졌다.
 */
select hasnt_function('public', 'log_discovery_impressions',
  '노출 기록을 손으로 적는 함수는 없다');

select throws_ok(
  $$insert into public.discovery_impression
      (viewer_user_id, candidate_user_id, policy_version, position, exploration,
       viewer_summary, candidate_summary, supplied_elements, complement, combined_balance)
    values (gen_random_uuid(), gen_random_uuid(), 'discovery-v0', 999, false,
            '{}'::jsonb, '{}'::jsonb, array['木'], 100, 100)$$,
  '42501', null,
  '노출 기록 표에 직접 쓰지도 못한다');

reset role;
select * from finish();
rollback;
