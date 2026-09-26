-- 후보 카드의 예측 궁합 점수 — `v2-beta` 연인용이 TS 와 **같은 수**를 낸다 (ADR 0113)
--
-- 셈이 두 언어에 하나씩 있다 — 후보 카드는 SQL(`discovery_preview_score_v2`)이, 궁합풀이의 기준점과 비교기는
-- TS(`compat-axes.ts` · `element-axes.ts`)가 낸다. 갈리면 카드와 풀이가 다른 수를 말한다.
--
-- 그래서 **이 파일의 두 표를 두 시험이 함께 읽는다.** 여기서는 SQL 이 표대로 내는지 재고,
-- `scripts/card-score-sql.test.ts` 는 이 파일을 열어 같은 줄을 TS 로 다시 잰다. 표를 고치면
-- 둘 중 하나가 깨진다 — 한쪽만 고칠 수 없다.
--
--   1. **일주 관계 이름** — 천간 100 쌍 · 지지 144 쌍 전부. 표에 없는 쌍은 관계가 없다.
--   2. **카드 점수** — 고른 스물한 쌍(첫 줄과 끝 줄은 아래 후보 목록이 그대로 쓴다). 합이 충을 푸는 쌍(57.5), 25 · 90 에서 멈추는 쌍, 반올림이 .5 에 걸린 쌍,
--      참값이 .5 인데 TS 의 부동소수가 올리는 쌍(乙亥 × 丙申 → 53)과 내리는 쌍(壬戌 × 辛未 → 42, `20261027090000`),
--      시각을 몰라 여섯 글자인 쌍을 넣었다.
--
-- 그리고 **요약이 없는 사람에게 가운데 값을 주지 않는다**(ADR 0113 개정 3b)를 잰다 — 점수는 `null` 이고,
-- 풀에서 빠지고, 내 것이 없으면 목록이 `55000` 으로 선다. 백필의 문 둘은 `service_role` 에만 열린다.
begin;
select plan(28);

-- ── 1. 일주 관계 이름 ───────────────────────────────────────────────────────

-- 표 시작: 일주 관계 (card-score-sql.test.ts 가 읽는다 — 줄 모양을 바꾸지 않는다)
create temporary table day_kinds (x text, y text, kinds text);
insert into day_kinds values
  ('甲', '己', 'stemCombination'),
  ('甲', '庚', 'stemClash'),
  ('乙', '庚', 'stemCombination'),
  ('乙', '辛', 'stemClash'),
  ('丙', '辛', 'stemCombination'),
  ('丙', '壬', 'stemClash'),
  ('丁', '壬', 'stemCombination'),
  ('丁', '癸', 'stemClash'),
  ('戊', '癸', 'stemCombination'),
  ('己', '甲', 'stemCombination'),
  ('庚', '甲', 'stemClash'),
  ('庚', '乙', 'stemCombination'),
  ('辛', '乙', 'stemClash'),
  ('辛', '丙', 'stemCombination'),
  ('壬', '丙', 'stemClash'),
  ('壬', '丁', 'stemCombination'),
  ('癸', '丁', 'stemClash'),
  ('癸', '戊', 'stemCombination'),
  ('子', '丑', 'branchDirectionalCombination,branchSixCombination'),
  ('子', '卯', 'branchPunishment'),
  ('子', '辰', 'branchTripleCombination'),
  ('子', '午', 'branchClash'),
  ('子', '未', 'branchHarm,branchResentment'),
  ('子', '申', 'branchTripleCombination'),
  ('子', '酉', 'branchDestruction,branchGhostGate'),
  ('子', '亥', 'branchDirectionalCombination'),
  ('丑', '子', 'branchDirectionalCombination,branchSixCombination'),
  ('丑', '辰', 'branchDestruction'),
  ('丑', '午', 'branchGhostGate,branchHarm,branchResentment'),
  ('丑', '未', 'branchClash,branchPunishment'),
  ('丑', '酉', 'branchTripleCombination'),
  ('丑', '戌', 'branchPunishment'),
  ('寅', '卯', 'branchDirectionalCombination'),
  ('寅', '巳', 'branchHarm,branchPunishment'),
  ('寅', '午', 'branchTripleCombination'),
  ('寅', '未', 'branchGhostGate'),
  ('寅', '申', 'branchClash,branchPunishment'),
  ('寅', '酉', 'branchResentment'),
  ('寅', '亥', 'branchDestruction,branchSixCombination'),
  ('卯', '子', 'branchPunishment'),
  ('卯', '寅', 'branchDirectionalCombination'),
  ('卯', '辰', 'branchDirectionalCombination,branchHarm'),
  ('卯', '午', 'branchDestruction'),
  ('卯', '未', 'branchTripleCombination'),
  ('卯', '申', 'branchGhostGate,branchResentment'),
  ('卯', '酉', 'branchClash'),
  ('卯', '戌', 'branchSixCombination'),
  ('卯', '亥', 'branchTripleCombination'),
  ('辰', '子', 'branchTripleCombination'),
  ('辰', '丑', 'branchDestruction'),
  ('辰', '卯', 'branchDirectionalCombination,branchHarm'),
  ('辰', '辰', 'branchPunishment'),
  ('辰', '酉', 'branchSixCombination'),
  ('辰', '戌', 'branchClash'),
  ('辰', '亥', 'branchGhostGate,branchResentment'),
  ('巳', '寅', 'branchHarm,branchPunishment'),
  ('巳', '午', 'branchDirectionalCombination'),
  ('巳', '申', 'branchDestruction,branchPunishment,branchSixCombination'),
  ('巳', '酉', 'branchTripleCombination'),
  ('巳', '戌', 'branchGhostGate,branchResentment'),
  ('巳', '亥', 'branchClash'),
  ('午', '子', 'branchClash'),
  ('午', '丑', 'branchGhostGate,branchHarm,branchResentment'),
  ('午', '寅', 'branchTripleCombination'),
  ('午', '卯', 'branchDestruction'),
  ('午', '巳', 'branchDirectionalCombination'),
  ('午', '午', 'branchPunishment'),
  ('午', '未', 'branchDirectionalCombination,branchSixCombination'),
  ('午', '戌', 'branchTripleCombination'),
  ('未', '子', 'branchHarm,branchResentment'),
  ('未', '丑', 'branchClash,branchPunishment'),
  ('未', '寅', 'branchGhostGate'),
  ('未', '卯', 'branchTripleCombination'),
  ('未', '午', 'branchDirectionalCombination,branchSixCombination'),
  ('未', '戌', 'branchDestruction,branchPunishment'),
  ('申', '子', 'branchTripleCombination'),
  ('申', '寅', 'branchClash,branchPunishment'),
  ('申', '卯', 'branchGhostGate,branchResentment'),
  ('申', '巳', 'branchDestruction,branchPunishment,branchSixCombination'),
  ('申', '酉', 'branchDirectionalCombination'),
  ('申', '亥', 'branchHarm'),
  ('酉', '子', 'branchDestruction,branchGhostGate'),
  ('酉', '丑', 'branchTripleCombination'),
  ('酉', '寅', 'branchResentment'),
  ('酉', '卯', 'branchClash'),
  ('酉', '辰', 'branchSixCombination'),
  ('酉', '巳', 'branchTripleCombination'),
  ('酉', '申', 'branchDirectionalCombination'),
  ('酉', '酉', 'branchPunishment'),
  ('酉', '戌', 'branchDirectionalCombination,branchHarm'),
  ('戌', '丑', 'branchPunishment'),
  ('戌', '卯', 'branchSixCombination'),
  ('戌', '辰', 'branchClash'),
  ('戌', '巳', 'branchGhostGate,branchResentment'),
  ('戌', '午', 'branchTripleCombination'),
  ('戌', '未', 'branchDestruction,branchPunishment'),
  ('戌', '酉', 'branchDirectionalCombination,branchHarm'),
  ('亥', '子', 'branchDirectionalCombination'),
  ('亥', '寅', 'branchDestruction,branchSixCombination'),
  ('亥', '卯', 'branchTripleCombination'),
  ('亥', '辰', 'branchGhostGate,branchResentment'),
  ('亥', '巳', 'branchClash'),
  ('亥', '申', 'branchHarm'),
  ('亥', '亥', 'branchPunishment'),
  (null, null, null);
-- 표 끝: 일주 관계
delete from day_kinds where x is null;

select is((select count(*)::int from day_kinds), 104, '관계가 있는 쌍은 천간 18 · 지지 86 이다');

select is(
  (select count(*)::int
   from unnest(array['甲','乙','丙','丁','戊','己','庚','辛','壬','癸']) as a(s),
        unnest(array['甲','乙','丙','丁','戊','己','庚','辛','壬','癸']) as b(s)
   -- 두 일지를 관계가 없는 子 · 子 로 두면 천간의 이름만 남는다
   where array_to_string(public.discovery_day_relation_kinds_v2(
           jsonb_build_object('stem', a.s, 'branch', '子'), jsonb_build_object('stem', b.s, 'branch', '子')), ',')
         is distinct from
         coalesce((select d.kinds from day_kinds d where d.x = a.s and d.y = b.s), '')),
  0, '천간 100 쌍의 관계 이름이 표와 같다');

select is(
  (select count(*)::int
   from unnest(array['子','丑','寅','卯','辰','巳','午','未','申','酉','戌','亥']) as a(b),
        unnest(array['子','丑','寅','卯','辰','巳','午','未','申','酉','戌','亥']) as b(b)
   where array_to_string(public.discovery_day_relation_kinds_v2(
           jsonb_build_object('stem', '甲', 'branch', a.b), jsonb_build_object('stem', '甲', 'branch', b.b))
           , ',')
         is distinct from
         coalesce((select d.kinds from day_kinds d where d.x = a.b and d.y = b.b), '')),
  0, '지지 144 쌍의 관계 이름이 표와 같다');

-- ── 2. 카드 점수 ──────────────────────────────────────────────────────────────

/** 오행 개수 「木,火,土,金,水」 에서 오행 요약 한 벌 */
create or replace function pg_temp.summary(counts text)
returns jsonb
language sql
as $$
  with n as (select string_to_array(counts, ',')::int[] as c)
  select jsonb_build_object(
    'glyphCount', c[1] + c[2] + c[3] + c[4] + c[5],
    'counts', jsonb_build_object('木', c[1], '火', c[2], '土', c[3], '金', c[4], '水', c[5]),
    'ratios', jsonb_build_object(
      '木', c[1]::numeric / (c[1] + c[2] + c[3] + c[4] + c[5]),
      '火', c[2]::numeric / (c[1] + c[2] + c[3] + c[4] + c[5]),
      '土', c[3]::numeric / (c[1] + c[2] + c[3] + c[4] + c[5]),
      '金', c[4]::numeric / (c[1] + c[2] + c[3] + c[4] + c[5]),
      '水', c[5]::numeric / (c[1] + c[2] + c[3] + c[4] + c[5])))
  from n;
$$;

/** 일주 「甲子」 만 든 여덟 글자 — 셈이 읽는 것은 `day` 칸뿐이다 */
create or replace function pg_temp.chart(day text)
returns jsonb
language sql
as $$
  select jsonb_build_object('day', jsonb_build_object('stem', left(day, 1), 'branch', right(day, 1)));
$$;

/** 「水金」 → 억부 1순위 水 · 가장 무거운 金 */
create or replace function pg_temp.need(two text)
returns jsonb
language sql
as $$ select tests.need(left(two, 1), right(two, 1)); $$;

-- 표 시작: 카드 점수 (card-score-sql.test.ts 가 읽는다 — 줄 모양을 바꾸지 않는다)
create temporary table pairs (
  a_day text, a_counts text, a_need text, b_day text, b_counts text, b_need text,
  day_axis numeric, score integer);
insert into pairs values
  ('甲子', '2,1,2,2,1', '水金', '己丑', '1,2,3,1,1', '木土', 90, 76),
  ('甲子', '3,1,1,1,2', '金木', '庚午', '1,3,1,2,1', '水火', 25, 60),
  ('甲寅', '3,2,1,1,1', '金木', '己巳', '0,3,3,1,1', '水土', 45, 55),
  ('丙午', '1,4,1,1,1', '水火', '丙午', '1,4,1,1,1', '水火', 35, 40),
  ('乙巳', '2,2,2,1,1', '水土', '庚申', '0,1,2,4,1', '木金', 75, 69),
  ('丁丑', '1,2,3,1,1', '木土', '癸未', '1,1,3,1,2', '金土', 25, 39),
  ('戊辰', '0,1,4,1,2', '木土', '癸酉', '1,1,1,3,2', '火金', 90, 68),
  ('甲子', '2,2,1,1,2', '土木', '甲子', '2,2,1,1,2', '土木', 50, 49),
  ('壬子', '1,1,1,1,4', '火水', '丁未', '2,3,2,0,1', '水火', 50, 68),
  ('辛卯', '2,0,2,3,1', '火金', '丙戌', '1,2,3,1,1', '金土', 90, 82),
  ('甲寅', '4,1,1,1,1', '金木', '庚申', '1,1,1,4,1', '木金', 25, 57),
  ('己巳', '1,2,4,0,1', '金土', '甲申', '2,0,1,3,2', '火金', 75, 83),
  ('丙寅', '2,3,1,1,1', '水火', '辛亥', '1,1,1,2,3', '火水', 90, 86),
  ('乙丑', '2,1,3,1,1', '金土', '辛未', '1,2,3,2,0', '水土', 25, 46),
  ('甲申', '2,1,1,3,1', '火金', '己卯', '3,1,2,1,1', '金木', 60, 63),
  ('甲子', '2,1,1,1,3', '火水', '庚辰', '1,1,3,2,1', '木土', 57.5, 66),
  ('丙寅', '2,2,0,1,1', '金火', '壬午', '0,3,1,1,1', '水火', 57.5, 59),
  ('癸卯', '2,0,1,1,2', '火木', '戊戌', '0,1,4,1,0', '木土', 90, 82),
  ('乙亥', '1,3,0,2,2', '水火', '丙申', '2,1,0,1,2', '木水', 40, 53),
  ('壬戌', '1,0,2,0,3', '金土', '辛未', '0,0,3,1,2', '木土', 30, 42),
  ('甲子', '2,1,2,2,1', '水金', '庚午', '1,3,1,2,1', '水火', 25, 43),
  (null, null, null, null, null, null, null, null);
-- 표 끝: 카드 점수
delete from pairs where a_day is null;

select is((select count(*)::int from pairs), 21, '카드 점수 표는 스물한 쌍이다');

select is(
  (select count(*)::int from pairs
   where public.discovery_day_pillar_axis_v2(pg_temp.chart(a_day), pg_temp.chart(b_day)) <> day_axis),
  0, '일주 · 일지 축이 표와 같다');

select is(
  (select count(*)::int from pairs
   where public.discovery_day_pillar_axis_v2(pg_temp.chart(a_day), pg_temp.chart(b_day))
      <> public.discovery_day_pillar_axis_v2(pg_temp.chart(b_day), pg_temp.chart(a_day))),
  0, '일주 · 일지 축은 누가 앞이어도 같다');

select is(
  (select count(*)::int from pairs
   where round(public.discovery_preview_score_v2(
           pg_temp.chart(a_day), pg_temp.summary(a_counts), pg_temp.need(a_need),
           pg_temp.chart(b_day), pg_temp.summary(b_counts), pg_temp.need(b_need)))::int <> score),
  0, '카드 점수가 표와 같다 — TS 가 같은 표를 잰다');

select is(
  (select count(*)::int from pairs
   where round(public.discovery_preview_score_v2(
           pg_temp.chart(a_day), pg_temp.summary(a_counts), pg_temp.need(a_need),
           pg_temp.chart(b_day), pg_temp.summary(b_counts), pg_temp.need(b_need)))
      <> round(public.discovery_preview_score_v2(
           pg_temp.chart(b_day), pg_temp.summary(b_counts), pg_temp.need(b_need),
           pg_temp.chart(a_day), pg_temp.summary(a_counts), pg_temp.need(a_need)))),
  0, '카드 점수는 두 사람에게 같다');

-- ── 3. 없는 것은 50 이 아니다 ───────────────────────────────────────────────

-- 셈 이름 (card-score-sql.test.ts 가 이 줄을 읽어 TS 의 `NEED_SUMMARY_RULE` 과 견준다)
select is(public.discovery_need_rule(), 'eokbu-with-johu-reference-v5+month-x2-hidden-60-30-10-v1',
  '필요한 기운 요약의 지금 셈 이름은 억부 v5 + 월지 ×2 · 지장간 60:30:10 이다');

select is(
  public.discovery_preview_score_v2(
    pg_temp.chart('甲子'), pg_temp.summary('2,2,2,1,1'), null,
    pg_temp.chart('己丑'), pg_temp.summary('1,2,3,1,1'), pg_temp.need('木土')),
  null, '필요한 기운 요약이 없으면 점수가 없다 — 가운데 값으로 메우지 않는다');

select is(
  public.discovery_day_pillar_axis_v2(null, pg_temp.chart('己丑')),
  null, '여덟 글자가 없으면 일주 축이 없다 — 관계가 없는 50 과 다르다');

-- ── 4. 풀 · 목록 · 백필 ─────────────────────────────────────────────────────

create temporary table folks (who text, uid uuid);
grant select on folks to authenticated, service_role;
grant select on pairs to authenticated;

do $$
declare
  one record;
  u uuid;
begin
  for one in select * from (values
    ('viewer', '甲', '子', '2,1,2,2,1', '水金'),
    ('match', '己', '丑', '1,2,3,1,1', '木土'),
    ('clash', '庚', '午', '1,3,1,2,1', '水火'),
    ('noneed', '丙', '寅', '2,2,2,1,1', null)) as v(who, stem, branch, counts, need)
  loop
    u := tests.signup('card-v2-' || one.who || '@example.com');
    insert into folks values (one.who, u);
    perform set_config('request.jwt.claims', tests.claims(u), true);
    perform public.create_self_person('나', 'solar', '1990-05-15', '1990-05-15', '14:30', 'female', '서울', 'jo',
      'localMean',
      jsonb_build_object(
        'year', jsonb_build_object('stem', '甲', 'branch', '子'),
        'month', jsonb_build_object('stem', '乙', 'branch', '丑'),
        'day', jsonb_build_object('stem', one.stem, 'branch', one.branch),
        'hour', jsonb_build_object('stem', '丁', 'branch', '卯'),
        'dayMaster', one.stem),
      'chart-for-tests');
    perform public.save_my_profile(one.who, null);
    perform public.set_discovery_participation(true, pg_temp.summary(one.counts),
      case when one.need is null then null else pg_temp.need(one.need) end);
  end loop;
end;
$$;

-- 다른 시험이 남긴 참여자는 관심 밖이다 — 뽑는 함수는 definer 라 RLS 로 좁혀지지 않는다.
update public.discovery_profile set opted_in_at = null, opted_out_at = now()
where user_id not in (select uid from folks);

set local role authenticated;
select set_config('request.jwt.claims', tests.claims((select uid from folks where who = 'viewer')), true);

create temporary table board as select * from public.my_discovery_board();

select is(
  (select preview_score from board where candidate_user_id = (select uid from folks where who = 'match')),
  (select score from pairs where a_day = '甲子' and a_counts = '2,1,2,2,1' and b_day = '己丑'),
  '후보 목록의 점수가 표의 v2 점수다');
select is(
  (select preview_score from board where candidate_user_id = (select uid from folks where who = 'clash')),
  (select score from pairs where a_day = '甲子' and a_counts = '2,1,2,2,1' and b_day = '庚午'),
  '충이 겹친 후보도 표의 v2 점수다');
select is(
  (select count(*)::int from board where candidate_user_id = (select uid from folks where who = 'noneed')),
  0, '필요한 기운 요약이 없는 참여자는 풀에서 빠진다 — 낡은 오행 요약과 같은 규칙');

reset role;
select is(
  (select policy_version from public.discovery_candidate
   where user_id = (select uid from folks where who = 'viewer') order by seq desc limit 1),
  'v2-beta', '스냅샷은 v2-beta 정책을 기록한다');
select is(
  (select count(*)::int from public.discovery_impression
   where viewer_user_id = (select uid from folks where who = 'viewer') and policy_version <> 'v2-beta'),
  0, '노출 기록도 v2-beta 다');

-- 두 인자로 부르면(옛 앱) 있던 요약을 지우지 않는다
set local role authenticated;
select set_config('request.jwt.claims', tests.claims((select uid from folks where who = 'match')), true);
select public.ensure_discovery_participation(
  (select self_person_id from public.app_user where id = (select uid from folks where who = 'match')),
  pg_temp.summary('1,2,3,1,1'));
reset role;
select is(
  (select need_summary from public.discovery_profile where user_id = (select uid from folks where who = 'match')),
  pg_temp.need('木土'), '요약 없이 부른 참여 문은 있던 필요한 기운 요약을 그대로 둔다');

-- 내 요약이 없으면 목록이 선다 — 빈 목록으로 조용히 넘어가지 않는다
update public.discovery_profile set opted_in_at = now(), opted_out_at = null
where user_id = (select uid from folks where who = 'noneed');
set local role authenticated;
select set_config('request.jwt.claims', tests.claims((select uid from folks where who = 'noneed')), true);
select throws_ok('select * from public.my_discovery_board()', '55000', null,
  '내 필요한 기운 요약이 없으면 목록이 55000 으로 선다');

-- 백필의 문 둘
select throws_ok('select * from public.need_summary_backfill_targets()', '42501', null,
  '백필 대상은 로그인한 사람이 못 읽는다');
select ok(
  not has_function_privilege('anon', 'public.set_discovery_need_summary(uuid,jsonb,integer,text)', 'execute'),
  '백필 쓰기 문은 익명에게 닫혀 있다');

-- 옛 셈 이름으로 지은 요약은 낡은 요약이다 — 풀에서 빠진다
reset role;
update public.discovery_profile set need_summary = jsonb_set(need_summary, '{rule}', '"eokbu-with-johu-reference-v4+days-flat-v1"')
where user_id = (select uid from folks where who = 'clash');
select ok(
  not public.discovery_pair_eligible((select uid from folks where who = 'viewer'), (select uid from folks where who = 'clash')),
  '옛 셈 이름의 필요한 기운 요약을 든 사람은 풀에서 빠진다');

create temporary table fresh_need as select tests.need('水', '火') as need;
grant select on fresh_need to service_role;
create temporary table noneed_version as
select p.input_version as v from public.person p join public.app_user u on u.self_person_id = p.id
where u.id = (select uid from folks where who = 'noneed');
create temporary table clash_version as
select p.input_version as v from public.person p join public.app_user u on u.self_person_id = p.id
where u.id = (select uid from folks where who = 'clash');
grant select on noneed_version, clash_version to service_role;
set local role service_role;
select is(
  (select array_agg(t.user_id order by t.user_id) from public.need_summary_backfill_targets() t
   where t.user_id in (select uid from folks)),
  (select array_agg(uid order by uid) from folks where who in ('clash', 'noneed')),
  '백필 대상은 요약이 없거나 옛 셈 이름인 참여자뿐이다');
select is(
  public.set_discovery_need_summary((select uid from folks where who = 'noneed'), (select need from fresh_need),
    (select v - 1 from noneed_version), 'chart-for-tests'),
  false, '읽은 뒤 입력이 바뀌었으면 백필은 안 적는다');
select is(
  public.set_discovery_need_summary((select uid from folks where who = 'noneed'), (select need from fresh_need),
    (select v from noneed_version), 'chart-for-tests'),
  true, '지금 입력의 여덟 글자로 센 요약은 적는다');
select throws_ok(
  format('select public.set_discovery_need_summary(%L, %L, %s, %L)',
    (select uid from folks where who = 'clash'),
    '{"primary":"水","heaviest":"火","rule":"eokbu-with-johu-reference-v4+days-flat-v1"}',
    (select v from clash_version), 'chart-for-tests'),
  '22023', null, '옛 셈 이름으로 지은 요약은 백필이 적지 못한다');
select lives_ok(
  format('select public.set_discovery_need_summary(%L, %L, %s, %L)',
    (select uid from folks where who = 'clash'), (select need from fresh_need),
    (select v from clash_version), 'chart-for-tests'),
  '지금 셈 이름의 요약은 다시 적는다');
select is(
  (select count(*)::int from public.need_summary_backfill_targets() t where t.user_id in (select uid from folks)),
  0, '다 채우면 백필 대상이 없다 — 두 번 돌려도 같다');
reset role;

select ok(
  public.my_summary_is_current((select uid from folks where who = 'noneed')),
  '백필한 사람은 다시 목록에 설 수 있다');

select * from finish();
rollback;
