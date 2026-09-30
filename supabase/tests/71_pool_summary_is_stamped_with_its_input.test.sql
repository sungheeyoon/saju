-- 옛 입력에서 지은 요약은 **새 입력의 판을 달고 서지 않는다** (G-64, ADR 0136 — 운영자 검토 2026-09-30)
--
-- 서버는 저장된 입력 A 를 읽어 요약을 짓고, 그 뒤에 참여의 두 문(`set_discovery_participation` ·
-- `ensure_discovery_participation`)을 부른다. 그 사이에 다른 요청이 입력을 B 로 고치면 — 판을 안 받던 판은 저장하는
-- 순간의 판(B)을 요약 A 에 찍었고, 낡은 요약을 거르는 버전 검사가 그것을 「지금 입력의 것」으로 읽었다.
--
-- 여기서 그 엇갈림을 차례대로 일으킨다: 입력 A 의 판을 읽는다 → 입력을 B 로 고친다 → A 의 판을 실은 요약을 올린다.
-- 문은 `stale` 로 답하고 아무것도 안 쓴다. 지금 판을 실으면 선다. 두 문 다.
begin;
select plan(10);

create temporary table who (uid uuid, person_id uuid, v_a integer, e_a text, need_x jsonb, need_y jsonb, v_b integer, e_b text);
grant select, insert, update on who to authenticated, service_role;

/* 입력 A — 서버가 참여시킨 사람. 요약은 입력 A 의 판을 달고 선다 */
do $$
declare
  u uuid := tests.signup('pool-stamp@example.com');
  p uuid;
begin
  perform set_config('request.jwt.claims', tests.claims(u), true);
  p := tests.create_self_person('나', 'solar', '1990-05-15', '1990-05-15', '14:30', 'female', '서울', 'jo', 'localMean',
    tests.chart('丙'), 'chart-for-tests');
  perform tests.set_discovery_participation(true,
    '{"glyphCount":8,"counts":{"木":2,"火":2,"土":2,"金":1,"水":1},"ratios":{"木":0.25,"火":0.25,"土":0.25,"金":0.125,"水":0.125}}'::jsonb,
    tests.need());
  /* 열쇠 역할은 `tests` 스키마를 모른다 — 요약 두 벌은 역할을 바꾸기 전에 지어 둔다 */
  insert into who
  select u, p, v.input_version, v.chart_engine_version, tests.need('火', '水'), tests.need('水', '金')
  from tests.my_versions(u) v;
end;
$$;

/* 서버가 입력 A 로 요약을 지었다 — 그리고 문을 부르기 전에 다른 요청이 입력을 B 로 고친다 */
select tests.edit_person_input((select person_id from who), 'solar', '1971-02-20', '1971-02-20', '03:05', 'female', '서울',
  'jo', 'localMean', tests.chart('庚'), 'chart-for-tests');

/* 입력 B 의 판 — 열쇠 역할은 표를 못 읽으므로 여기서 적어 둔다 */
update who set (v_b, e_b) = (select v.input_version, v.chart_engine_version from tests.my_versions(who.uid) v);

select isnt(
  (select v_b from who),
  (select v_a from who),
  '입력이 B 로 바뀌어 판이 올랐다');

-- ── 참여를 켜는 문 ───────────────────────────────────────────────────────────

set local role service_role;

select is(
  public.set_discovery_participation((select uid from who), true,
    '{"glyphCount":8,"counts":{"木":8,"火":0,"土":0,"金":0,"水":0},"ratios":{"木":1,"火":0,"土":0,"金":0,"水":0}}'::jsonb,
    (select need_x from who), (select v_a from who), (select e_a from who)),
  'stale',
  '입력 A 의 판을 실은 요약은 「다시 지어라」로 답한다');

reset role;

select is(
  (select element_summary -> 'counts' ->> '木' from public.discovery_profile where user_id = (select uid from who)),
  '2',
  '옛 입력에서 지은 요약은 저장되지 않았다');

select is(
  (select element_input_version from public.discovery_profile where user_id = (select uid from who)),
  (select v_a from who),
  '풀의 요약은 새 입력의 판을 달지 않았다 — 여전히 입력 A 의 판이라 낡은 것으로 걸러진다');

-- ── 참여를 여는 문 ───────────────────────────────────────────────────────────

set local role service_role;

select is(
  public.ensure_discovery_participation((select uid from who), (select person_id from who),
    '{"glyphCount":8,"counts":{"木":8,"火":0,"土":0,"金":0,"水":0},"ratios":{"木":1,"火":0,"土":0,"金":0,"水":0}}'::jsonb,
    (select need_x from who), (select v_a from who), (select e_a from who)),
  'stale',
  '참여를 여는 문도 입력 A 의 판이면 「다시 지어라」로 답한다');

reset role;

select is(
  (select need_summary ->> 'primary' from public.discovery_profile where user_id = (select uid from who)),
  '木',
  '필요한 기운 요약도 옛 입력의 것으로 덮이지 않았다');

-- ── 엔진 판만 다른 것도 같다 ───────────────────────────────────────────────────

set local role service_role;

select is(
  public.ensure_discovery_participation((select uid from who), (select person_id from who),
    '{"glyphCount":8,"counts":{"木":8,"火":0,"土":0,"金":0,"水":0},"ratios":{"木":1,"火":0,"土":0,"金":0,"水":0}}'::jsonb,
    (select need_x from who),
    (select v_b from who), 'some-other-engine'),
  'stale',
  '입력 판이 맞아도 엔진 판이 다르면 쓰지 않는다');

-- ── 다시 지어 지금 판을 실으면 선다 ───────────────────────────────────────────

select is(
  public.set_discovery_participation((select uid from who), true,
    '{"glyphCount":8,"counts":{"木":0,"火":0,"土":0,"金":8,"水":0},"ratios":{"木":0,"火":0,"土":0,"金":1,"水":0}}'::jsonb,
    (select need_y from who),
    (select v_b from who), (select e_b from who)),
  'on',
  '입력 B 에서 다시 지은 요약은 선다');

reset role;

select is(
  (select element_summary -> 'counts' ->> '金' from public.discovery_profile where user_id = (select uid from who)),
  '8',
  '풀에 선 것은 다시 지은 요약이다');

select is(
  (select element_input_version from public.discovery_profile where user_id = (select uid from who)),
  (select input_version from public.person where id = (select person_id from who)),
  '그리고 그 요약이 지은 입력 B 의 판을 단다');

select * from finish();
rollback;
