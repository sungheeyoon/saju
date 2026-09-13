-- 공유본이 **저장한 사람과 두 사람의 궁합까지** 든다 — 그리고 인연 궁합은 안 든다.
--
-- 여기서 재는 것 다섯.
--
-- 1. **저장한 사람의 풀이를 내보낸다** — 그 사람을 부르는 이름이 든 채로.
-- 2. **두 사람의 궁합을 내보낸다** — 점수까지 함께.
-- 3. **인연 궁합은 못 내보낸다.** 상대가 동의한 것은 한 사람에게 여는 것이지
--    누구에게든 여는 것이 아니다(ADR 0012). 새 서명이 `p_match_id` 를 아예 안 받는다.
-- 4. **남의 사람은 못 가리킨다.** 내 엣지에 없는 Person id 를 넣으면 0행이다.
-- 5. **옛 두 인자짜리가 아직 산다** — 넓히고 나중에 좁힌다.
begin;
select plan(17);

create or replace function pg_temp.acting(uid uuid)
returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claims', tests.claims(uid), true);
end;
$$;

create or replace function pg_temp.save(
  run uuid, rev_a uuid, rev_b uuid, body text, said text, points smallint)
returns uuid language sql security definer as $$
  select public.save_reading(
    run, rev_a, rev_b, body, points, said,
    '{"charts":{}}', '# 역할', 'reading-prompt-v1', 'gpt-share', '{}'::jsonb, now());
$$;

create or replace function pg_temp.shares()
returns integer language sql security definer as $$
  select count(*)::int from public.reading_share;
$$;

create or replace function pg_temp.joins(mail text)
returns uuid language plpgsql as $$
declare uid uuid := tests.signup(mail);
begin
  perform set_config('request.jwt.claims', tests.claims(uid), true);
  perform public.create_self_person(
    '나', 'solar', '1990-05-15', '1990-05-15', '14:30', 'female', '서울', 'jo', 'localMean');
  return uid;
end;
$$;

set local role authenticated;

create temporary table folks as
select pg_temp.joins('kim-more@example.com') as kim,
       pg_temp.joins('lee-more@example.com') as lee;
grant select on folks to authenticated, service_role;

-- ── 김이 사람 둘을 저장한다 ────────────────────────────────────────────────

select pg_temp.acting((select kim from folks));

create temporary table kin as
select public.create_managed_person(
  '엄마', null, 'solar', '1962-03-02', '1962-03-02', '07:10', 'female', '부산', 'jo', 'localMean'
) as mom,
public.create_managed_person(
  '동생', null, 'solar', '1995-08-08', '1995-08-08', '09:20', 'male', '대구', 'jo', 'localMean'
) as kid;
grant select on kin to authenticated, service_role;

-- ── 저장한 사람의 풀이 ─────────────────────────────────────────────────────

create temporary table person_run as
select * from public.start_reading_run(
  'person', 'more-person-0001', (select mom from kin), null, null, 'gpt-share', 'reading-prompt-v1');
grant select on person_run to authenticated, service_role;

select pg_temp.save(
  (select run_id from person_run), (select revision_a from person_run), null,
  '## 엄마' || chr(10) || '엄마님은 오래 참는 편입니다.' || chr(10) || '### 근거' || chr(10) || '- x',
  '오래 참는 사람입니다.', null);

create temporary table person_link as
select public.share_my_reading(
  '## 엄마' || chr(10) || '엄마님은 오래 참는 편입니다.',
  '오래 참는 사람입니다.', 'person', (select mom from kin), null) as token;
grant select on person_link to authenticated, service_role, anon;

select matches((select token from person_link), '^[0-9a-f]{32}$',
  '저장한 사람의 풀이로 링크가 난다');

select is(
  (select s.kind from public.shared_reading((select token from person_link)) s),
  'person',
  '공유본이 자기 갈래를 든다');

select is(
  (select s.body from public.shared_reading((select token from person_link)) s),
  '## 엄마' || chr(10) || '엄마님은 오래 참는 편입니다.',
  '그 사람을 부르는 이름이 든 채로 남는다');

select is(
  (select s.score from public.shared_reading((select token from person_link)) s),
  null::smallint,
  '한 사람짜리에는 점수가 없다');

/**
 * **누구 것인지 말한다.** 본문에 이미 있는 이름이고, 머리에 한 번 세우지 않으면
 * 읽는 사람이 그것을 글에서 찾아내야 한다.
 */
select is(
  (select s.name_a from public.shared_reading((select token from person_link)) s),
  '엄마',
  '저장한 사람은 내가 붙인 이름표로 선다');

select is(
  (select s.name_b from public.shared_reading((select token from person_link)) s),
  null,
  '한 사람짜리에는 둘째 이름이 없다');

-- ── 두 사람의 궁합 ─────────────────────────────────────────────────────────

create temporary table pair_run as
select * from public.start_reading_run(
  'private', 'more-pair-0001', (select mom from kin), (select kid from kin), null,
  'gpt-share', 'reading-prompt-v1');
grant select on pair_run to authenticated, service_role;

select pg_temp.save(
  (select run_id from pair_run), (select revision_a from pair_run), (select revision_b from pair_run),
  '## 두 사람' || chr(10) || '둘은 속도가 다릅니다.', '속도가 다른 둘입니다.', 72::smallint);

create temporary table pair_link as
select public.share_my_reading(
  '## 두 사람' || chr(10) || '둘은 속도가 다릅니다.',
  '속도가 다른 둘입니다.', 'private', (select mom from kin), (select kid from kin)) as token;
grant select on pair_link to authenticated, service_role, anon;

select is(
  (select s.kind from public.shared_reading((select token from pair_link)) s),
  'private',
  '궁합 공유본도 자기 갈래를 든다');

select is(
  (select s.score from public.shared_reading((select token from pair_link)) s),
  72::smallint,
  '궁합은 점수까지 함께 나간다 — 빼면 받은 사람이 다른 글을 본다');

select isnt((select token from pair_link), (select token from person_link),
  '대상이 다르면 링크도 다르다');

/**
 * 차례를 화면이 다시 정하지 않는다. `reading_scope` 가 Person id 로 줄 세워 내주고
 * 본문의 이름도 그 차례를 따라 붙었으므로, 같은 차례로 적어야 머리와 본문이 같은
 * 사람을 같은 이름으로 부른다.
 */
select is(
  (select s.name_a || ' × ' || s.name_b from public.shared_reading((select token from pair_link)) s),
  (select case when kin.mom < kin.kid then '엄마 × 동생' else '동생 × 엄마' end from kin),
  '궁합은 두 이름을 판본과 같은 차례로 든다');

-- ── 자기 풀이는 닉네임으로 선다 ────────────────────────────────────────────

create temporary table self_run as
select * from public.start_reading_run(
  'self', 'more-self-0001', null, null, null, 'gpt-share', 'reading-prompt-v1');
grant select on self_run to authenticated, service_role;

select pg_temp.save(
  (select run_id from self_run), (select revision_a from self_run), null,
  '## 나' || chr(10) || '스스로 정한 기준이 있습니다.', '기준이 뚜렷한 사람입니다.', null);

create temporary table self_link as
select public.share_my_reading(
  '## 나' || chr(10) || '스스로 정한 기준이 있습니다.',
  '기준이 뚜렷한 사람입니다.', 'self', null, null) as token;
grant select on self_link to authenticated, service_role, anon;

/**
 * **목록과 다른 이름을 쓴다.** `/me/readings` 는 이 줄을 「내 사주」로 적는다 —
 * 거기서는 내 목록이라 이름이 오히려 줄을 헷갈리게 하기 때문이다(`line.ts`). 공유본을
 * 읽는 사람에게는 반대다: 「내 사주」는 그 사람에게 아무 말도 안 한다.
 */
select is(
  (select s.name_a from public.shared_reading((select token from self_link)) s),
  (select u.nickname from public.app_user u where u.id = (select kim from folks)),
  '자기 풀이는 닉네임으로 선다');

-- ── 인연 궁합은 부를 수 없는 모양이다 ──────────────────────────────────────

select throws_ok(
  $$select public.share_my_reading('아무 글', null, 'match', null, null)$$,
  null, '이 갈래는 공유 링크를 만들 수 없습니다',
  '인연 궁합은 갈래 이름으로도 막힌다');

select is(
  (select count(*)::int from pg_proc p
   join pg_namespace n on n.oid = p.pronamespace
   where n.nspname = 'public' and p.proname = 'share_my_reading'
     and pg_get_function_arguments(p.oid) like '%p_match_id%'),
  0,
  '어느 서명도 Match 를 가리킬 자리를 안 준다');

-- ── 남의 사람은 못 가리킨다 ────────────────────────────────────────────────

select pg_temp.acting((select lee from folks));

select throws_ok(
  format($$select public.share_my_reading(
    '## 엄마', '오래 참는 사람입니다.', 'person', %L::uuid, null)$$, (select mom from kin)),
  null, '공유할 풀이가 없습니다',
  '내 엣지에 없는 사람은 공유 대상이 못 된다');

select throws_ok(
  format($$select public.share_my_reading(
    '## 두 사람', '속도가 다른 둘입니다.', 'private', %L::uuid, %L::uuid)$$,
    (select mom from kin), (select kid from kin)),
  null, '공유할 풀이가 없습니다',
  '남의 두 사람 궁합도 못 가리킨다');

select is(pg_temp.shares(), 3, '막힌 시도는 한 줄도 안 남긴다');

-- ── 옛 서명이 아직 산다 ────────────────────────────────────────────────────

select is(
  (select count(*)::int from pg_proc p
   join pg_namespace n on n.oid = p.pronamespace
   where n.nspname = 'public' and p.proname = 'share_my_reading'),
  2,
  '두 서명이 함께 서 있다 — 넓히고 나중에 좁힌다');

select * from finish();
rollback;
