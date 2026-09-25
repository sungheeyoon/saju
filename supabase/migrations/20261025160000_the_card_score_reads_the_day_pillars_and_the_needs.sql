-- 후보 카드의 예측 궁합 점수가 `v2-beta` 연인용이 된다 (ADR 0113)
--
-- `discovery-v1`(오행 균형과 개수 보완)은 조사 결과 근거가 잘못됐다고 확인됐다(ADR 0113). 후보 카드는
-- 언제나 **연인용** 정책이다 — 일주 · 일지 관계 40 · 필요한 기운 보완 40 · 오행 균형 20. 셈은 TS 의
-- `src/lib/discovery/compat-axes.ts`(`dayPillarAxisOf` · `needComplementSymmetric`)와 `element-axes.ts`
-- (`combinedCountBalanceOf`)를 **한 줄씩 옮긴 것**이고, 두 언어가 같은 수를 내는지는
-- `supabase/tests/60_card_score_v2.test.sql` 과 `scripts/card-score-sql.test.ts` 가 **같은 표**를 읽어 잰다.
--
-- ## 무엇이 새로 드나
--
-- 1. **일주 · 일지 관계** — 서버가 이미 든 여덟 글자(`person.current_chart`, ADR 0071)의 일주 두 글자로 잰다.
--    두 일간끼리 · 두 일지끼리의 관계 이름을 표로 찾고(`discovery_day_relation_kinds_v2`), 이름마다 점수를 더한다.
--    **글자는 어디로도 안 나간다** — 점수 하나로만 나온다. 표는 엔진의 `findCompatRelations` 가 두 일주에서
--    낸 것을 그대로 옮겼다(천간은 방향 둘을 다 적은 18 줄, 지지는 한 방향만 적은 45 쌍을 양쪽으로 찾는다).
--    표를 고치면 시험 둘이 함께 깨진다.
-- 2. **필요한 기운 요약** — `discovery_profile.need_summary`(`{"primary": 오행, "heaviest": 오행, "rule": 셈 이름}`). 억부가 엔진에만
--    있어 앱이 만들어 넣는다(`src/lib/discovery/need-summary.ts`). 판정을 저장하지 않는다는 약속(ADR 0001)의
--    예외이고 ADR 0113 이 적었다. 오행 요약처럼 **입력 판본을 함께 든다**(`need_input_version` ·
--    `need_chart_engine_version`), 그리고 **엔진 셈의 이름**(`rule` — 억부 규칙 + 오행 무게, ADR 0114)을 든다.
--    지금 이름은 `discovery_need_rule()` 이다. 주는 쪽의 드러난 몫은 오행 요약의 `counts` 가 이미 들어 여기에 안 싣는다.
-- 3. **오행 균형** — `discovery_count_balance_v1` 그대로.
--
-- ## 요약이 없는 사람 — 가운데 값을 넣지 않는다 (ADR 0113 개정 3b)
--
-- 「모름」을 50 으로 메우면 「평균적인 보완」이 된다. 그래서 **낡은 오행 요약과 같은 규칙**을 따른다:
-- 필요한 기운 요약이 없거나 지금 입력 · 지금 엔진 · 지금 셈 이름의 것이 아니면 **풀에서 빠진다**
-- (`discovery_pair_eligible`), 내 것이 그러면 목록 · 요청이 `55000` 으로 선다(`my_summary_is_current`).
-- 점수 함수는 입력 하나라도 비면 `null` 이다 — 50 으로 번지는 길이 없다.
--
-- 기존 참여자는 전환 전에 **일괄 백필**한다(`scripts/backfill-need-summary.ts` — `current_chart` 의 네 기둥에서
-- 만든다). 그 스크립트가 쓰는 문 둘(`need_summary_backfill_targets` · `set_discovery_need_summary`)은
-- `service_role` 에만 열린다. 백필이 끝나면 좁히는 마이그레이션으로 닫는다(ADR 0071 의 넓히기 → 앱 → 좁히기).
--
-- ## 문
--
-- - `ensure_discovery_participation` · `set_discovery_participation` 이 `p_need` 를 더 받는다(기본 `null`).
--   `null` 이면 **있던 요약을 그대로 둔다** — 옛 앱이 두 인자로 불러도 백필한 요약을 지우지 않는다. 입력이
--   바뀌었으면 그 요약은 판본이 어긋나 저절로 빠진다. 참여를 끄면 함께 지운다.
-- - `my_discovery_board` · `my_passed_connections` 의 `preview_score` 가 v2 다. **반환형은 그대로다.**
-- - `refresh_discovery_snapshot_for` 가 같은 점수로 줄을 세우고 스냅샷 · 노출 기록에 `v2-beta` 를 적는다.
--   노출 기록의 `complement` 칸은 이제 **필요한 기운 보완**이다(`policy_version` 으로 가른다).
-- - `restore_passed_connection` 의 노출 기록도 같다.
--
-- 권한은 앞과 같다 — 사용자 문은 `authenticated` 만, 셈 함수는 아무에게도 안 연다.
--
-- **배포 순서: 이 마이그레이션 → 백필 → 앱.** 앱이 먼저 가면 새 인자(`p_need`)를 옛 DB 가 모른다.

-- ---------------------------------------------------------------------------
-- 1. 필요한 기운 요약 — 칸과 모양
-- ---------------------------------------------------------------------------

create function public.is_need_summary(summary jsonb)
returns boolean
language sql
immutable
set search_path = ''
as $$
  select summary is not null
     and jsonb_typeof(summary) = 'object'
     and (select count(*) from jsonb_object_keys(summary)) = 3
     and summary ->> 'primary' in ('木', '火', '土', '金', '水')
     and summary ->> 'heaviest' in ('木', '火', '土', '金', '水')
     and jsonb_typeof(summary -> 'rule') = 'string'
     and btrim(summary ->> 'rule') <> '';
$$;

/**
 * 요약을 만든 **지금 엔진 셈의 이름** — TS 의 `NEED_SUMMARY_RULE`(억부 규칙 + 오행 무게, ADR 0114).
 *
 * 입력 판과 여덟 글자의 판이 같아도 억부의 셈이 바뀌면 1순위가 바뀐다(월지 ×2 · 지장간 60:30:10 이 기본이 된 날
 * 약 14%). 이 이름과 다른 요약은 낡은 요약처럼 풀에서 빠진다. 엔진이 규칙을 올리면 이 함수를 올리는 마이그레이션과
 * 백필이 함께 간다 — 두 이름이 같은지는 `60_card_score_v2` 와 `scripts/card-score-sql.test.ts` 가 잰다.
 */
create function public.discovery_need_rule()
returns text
language sql
immutable
set search_path = ''
as $$ select 'eokbu-with-johu-reference-v5+month-x2-hidden-60-30-10-v1'::text $$;

revoke execute on function public.discovery_need_rule() from anon, authenticated, public;

revoke execute on function public.is_need_summary(jsonb) from anon, public;
grant execute on function public.is_need_summary(jsonb) to authenticated;

alter table public.discovery_profile
  add column need_summary jsonb,
  add column need_input_version integer,
  add column need_chart_engine_version text,
  add constraint discovery_profile_need_summary_shape
    check (need_summary is null or public.is_need_summary(need_summary)),
  add constraint discovery_profile_need_summary_versioned
    check ((need_summary is null) = (need_input_version is null));

-- ---------------------------------------------------------------------------
-- 2. 셈 — 일주 · 일지 관계
-- ---------------------------------------------------------------------------

/**
 * 두 일주 사이의 관계 이름들 — `dayPillarRelationKinds` 를 옮긴 것.
 *
 * 인자는 여덟 글자의 `day` 칸(`{"stem": …, "branch": …}`). 천간 표와 지지 표를 따로 찾아 합친다 —
 * 두 일주만 보므로 세 글자 구조(온전한 삼합 · 방합 · 삼형)는 설 수 없고, 두 글자 조각(반합 ·
 * 반방합 · 두 글자 형)만 선다. 관계는 대칭이라 지지 표는 한 방향만 적고 양쪽으로 찾는다.
 */
create function public.discovery_day_relation_kinds_v2(a jsonb, b jsonb)
returns text[]
language sql
immutable
set search_path = ''
as $$
  with stem_pairs(x, y, kinds) as (values
    ('甲', '己', 'stemCombination'), ('己', '甲', 'stemCombination'),
    ('乙', '庚', 'stemCombination'), ('庚', '乙', 'stemCombination'),
    ('丙', '辛', 'stemCombination'), ('辛', '丙', 'stemCombination'),
    ('丁', '壬', 'stemCombination'), ('壬', '丁', 'stemCombination'),
    ('戊', '癸', 'stemCombination'), ('癸', '戊', 'stemCombination'),
    ('甲', '庚', 'stemClash'), ('庚', '甲', 'stemClash'),
    ('乙', '辛', 'stemClash'), ('辛', '乙', 'stemClash'),
    ('丙', '壬', 'stemClash'), ('壬', '丙', 'stemClash'),
    ('丁', '癸', 'stemClash'), ('癸', '丁', 'stemClash')
  ),
  branch_pairs(x, y, kinds) as (values
    ('子', '丑', 'branchDirectionalCombination,branchSixCombination'),
    ('子', '卯', 'branchPunishment'),
    ('子', '辰', 'branchTripleCombination'),
    ('子', '午', 'branchClash'),
    ('子', '未', 'branchHarm,branchResentment'),
    ('子', '申', 'branchTripleCombination'),
    ('子', '酉', 'branchDestruction,branchGhostGate'),
    ('子', '亥', 'branchDirectionalCombination'),
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
    ('卯', '辰', 'branchDirectionalCombination,branchHarm'),
    ('卯', '午', 'branchDestruction'),
    ('卯', '未', 'branchTripleCombination'),
    ('卯', '申', 'branchGhostGate,branchResentment'),
    ('卯', '酉', 'branchClash'),
    ('卯', '戌', 'branchSixCombination'),
    ('卯', '亥', 'branchTripleCombination'),
    ('辰', '辰', 'branchPunishment'),
    ('辰', '酉', 'branchSixCombination'),
    ('辰', '戌', 'branchClash'),
    ('辰', '亥', 'branchGhostGate,branchResentment'),
    ('巳', '午', 'branchDirectionalCombination'),
    ('巳', '申', 'branchDestruction,branchPunishment,branchSixCombination'),
    ('巳', '酉', 'branchTripleCombination'),
    ('巳', '戌', 'branchGhostGate,branchResentment'),
    ('巳', '亥', 'branchClash'),
    ('午', '午', 'branchPunishment'),
    ('午', '未', 'branchDirectionalCombination,branchSixCombination'),
    ('午', '戌', 'branchTripleCombination'),
    ('未', '戌', 'branchDestruction,branchPunishment'),
    ('申', '酉', 'branchDirectionalCombination'),
    ('申', '亥', 'branchHarm'),
    ('酉', '酉', 'branchPunishment'),
    ('酉', '戌', 'branchDirectionalCombination,branchHarm'),
    ('亥', '亥', 'branchPunishment')
  ),
  found as (
    select string_to_array(s.kinds, ',') as kinds from stem_pairs s
    where s.x = a ->> 'stem' and s.y = b ->> 'stem'
    union all
    select string_to_array(p.kinds, ',') from branch_pairs p
    where (p.x = a ->> 'branch' and p.y = b ->> 'branch')
       or (p.x = b ->> 'branch' and p.y = a ->> 'branch' and p.x <> p.y)
  )
  select coalesce(array_agg(k order by k), array[]::text[])
  from found, unnest(found.kinds) as k
  where a is not null and b is not null;
$$;

/**
 * 두 일주의 관계, 0~100 — `dayPillarAxisOf` · `DAY_PILLAR_AXIS` 를 옮긴 것.
 *
 * 가운데 50 에서 이름마다 점수를 더한다. 합(천간합 · 육합 · 반쪽 삼합)이 하나라도 서면 충(천간충 · 지지충)의
 * 감점을 절반만 든다. 25 ~ 90 안에 머문다. 여덟 글자가 없으면 `null` 이다 — 관계가 없는 50 과 다르다.
 */
create function public.discovery_day_pillar_axis_v2(a_chart jsonb, b_chart jsonb)
returns numeric
language sql
immutable
set search_path = ''
as $$
  with kinds as (
    select unnest(public.discovery_day_relation_kinds_v2(a_chart -> 'day', b_chart -> 'day')) as kind
  ),
  resolved as (
    select exists (
      select 1 from kinds
      where kind in ('stemCombination', 'branchSixCombination', 'branchTripleCombination')
    ) as yes
  ),
  points as (
    select
      case kind
        when 'stemCombination' then 20
        when 'branchSixCombination' then 25
        when 'branchTripleCombination' then 15
        when 'branchDirectionalCombination' then 0
        when 'stemClash' then -15
        when 'branchClash' then -25
        when 'branchPunishment' then -15
        when 'branchHarm' then -10
        when 'branchResentment' then -10
        when 'branchDestruction' then -5
        when 'branchGhostGate' then 0
      end::numeric
      * case when kind in ('stemClash', 'branchClash') and resolved.yes then 0.5 else 1 end as point
    from kinds, resolved
  )
  select case
    when a_chart -> 'day' is null or b_chart -> 'day' is null then null
    else greatest(25, least(90, 50 + coalesce((select sum(point) from points), 0)))
  end;
$$;

-- ---------------------------------------------------------------------------
-- 3. 셈 — 필요한 기운 보완
-- ---------------------------------------------------------------------------

/**
 * 한 방향(받는 쪽 ← 주는 쪽)의 보완, 0~100 — `needComplementDirectional` · `NEED_COMPLEMENT_AXIS` 를 옮긴 것.
 *
 * 주는 쪽의 **드러난 몫**(오행 요약의 `counts` / `glyphCount`)이 받는 쪽의 억부 1순위에 닿는 정도를 20% 에서
 * 포화시켜 재고, 받는 쪽의 가장 무거운 기운을 가졌으면 같은 포화로 재어 0.3 만큼 뺀다. 요약이 없으면 `null`.
 */
create function public.discovery_need_direction_v2(receiver_need jsonb, provider_summary jsonb)
returns numeric
language sql
immutable
set search_path = ''
as $$
  with share as (
    select
      case when (provider_summary ->> 'glyphCount')::numeric > 0
        then (provider_summary -> 'counts' ->> (receiver_need ->> 'primary'))::numeric
             / (provider_summary ->> 'glyphCount')::numeric
        else 0 end as primary_share,
      case when (provider_summary ->> 'glyphCount')::numeric > 0
        then (provider_summary -> 'counts' ->> (receiver_need ->> 'heaviest'))::numeric
             / (provider_summary ->> 'glyphCount')::numeric
        else 0 end as heaviest_share
  )
  select case
    when receiver_need is null or provider_summary is null then null
    else greatest(0, least(100,
      100 * (least(1, share.primary_share / 0.2) - 0.3 * least(1, share.heaviest_share / 0.2))))
  end
  from share;
$$;

/** 두 방향의 평균 — `needComplementSymmetric`. 두 사람에게 같은 수를 낸다 */
create function public.discovery_need_complement_v2(
  a_need jsonb, a_summary jsonb, b_need jsonb, b_summary jsonb)
returns numeric
language sql
immutable
set search_path = ''
as $$
  select (public.discovery_need_direction_v2(a_need, b_summary)
          + public.discovery_need_direction_v2(b_need, a_summary)) / 2;
$$;

-- ---------------------------------------------------------------------------
-- 4. 셈 — 후보 카드의 점수 (연인용 40 · 40 · 20, 반올림 전)
-- ---------------------------------------------------------------------------

/**
 * 후보 카드의 예측 궁합 점수, 반올림 전 — ADR 0113 의 **연인용** 정책.
 *
 * 입력 하나라도 비면 `null` 이다. 비는 사람은 자격(`discovery_pair_eligible`)이 먼저 걸러 여기 오지 않는다 —
 * 오더라도 점수가 50 쪽으로 메워지지 않는다.
 */
create function public.discovery_preview_score_v2(
  a_chart jsonb, a_summary jsonb, a_need jsonb,
  b_chart jsonb, b_summary jsonb, b_need jsonb)
returns numeric
language sql
immutable
set search_path = ''
as $$
  select 0.4 * public.discovery_day_pillar_axis_v2(a_chart, b_chart)
       + 0.4 * public.discovery_need_complement_v2(a_need, a_summary, b_need, b_summary)
       + 0.2 * public.discovery_count_balance_v1(a_summary, b_summary);
$$;

revoke execute on function public.discovery_day_relation_kinds_v2(jsonb, jsonb) from anon, authenticated, public;
revoke execute on function public.discovery_day_pillar_axis_v2(jsonb, jsonb) from anon, authenticated, public;
revoke execute on function public.discovery_need_direction_v2(jsonb, jsonb) from anon, authenticated, public;
revoke execute on function public.discovery_need_complement_v2(jsonb, jsonb, jsonb, jsonb) from anon, authenticated, public;
revoke execute on function public.discovery_preview_score_v2(jsonb, jsonb, jsonb, jsonb, jsonb, jsonb) from anon, authenticated, public;

-- ---------------------------------------------------------------------------
-- 5. 자격 — 필요한 기운 요약과 여덟 글자도 지금 것이어야 한다
-- ---------------------------------------------------------------------------

create or replace function public.discovery_pair_eligible(viewer uuid, other uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
  select viewer is not null
     and other is not null
     and viewer <> other
     and not public.discovery_unavailable(viewer, other)
     and exists (
       select 1
       from public.discovery_profile mine
       join public.app_user mu on mu.id = mine.user_id
       join public.person mp on mp.id = mu.self_person_id
       join public.discovery_profile theirs on theirs.user_id = other
       join public.app_user tu on tu.id = theirs.user_id
       join public.person tp on tp.id = tu.self_person_id
       where mine.user_id = viewer
         -- 둘 다 참여 중이어야 한다. 내놓지 않고 보기만 하는 길은 없다.
         and mine.opted_in_at is not null
         and theirs.opted_in_at is not null
         -- 둘 다 살아 있는 계정이어야 한다.
         and mu.status = 'active'
         and tu.status = 'active'
         /**
          * 둘 다 요약이 **지금 입력과 지금 엔진**의 것이어야 한다. 낡은 값으로 줄
          * 세우지 않는다 — 카드가 말하는 오행이 이미 그 사람의 것이 아니기 때문이다.
          */
         and mine.element_input_version is not distinct from mp.input_version
         and theirs.element_input_version is not distinct from tp.input_version
         and mine.element_chart_engine_version is not distinct from mp.chart_engine_version
         and theirs.element_chart_engine_version is not distinct from tp.chart_engine_version
         /**
          * **필요한 기운 요약도 같은 규칙이다**(ADR 0113 개정 3b). 없거나 낡았으면 빠진다 — 가운데 값으로
          * 메우지 않는다. 일주 축이 읽는 여덟 글자도 있어야 한다.
          */
         and mine.need_summary is not null
         and theirs.need_summary is not null
         and mine.need_input_version is not distinct from mp.input_version
         and theirs.need_input_version is not distinct from tp.input_version
         and mine.need_chart_engine_version is not distinct from mp.chart_engine_version
         and theirs.need_chart_engine_version is not distinct from tp.chart_engine_version
         and mine.need_summary ->> 'rule' = public.discovery_need_rule()
         and theirs.need_summary ->> 'rule' = public.discovery_need_rule()
         and mp.current_chart is not null
         and tp.current_chart is not null
         -- 양쪽이 직접 설정한 조건을 **둘 다** 본다.
         and (mine.prefer_gender = 'any' or tp.gender = mine.prefer_gender)
         and (theirs.prefer_gender = 'any' or mp.gender = theirs.prefer_gender)
     );
$function$;

create or replace function public.my_summary_is_current(p_actor uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
  select exists (
    select 1
    from public.discovery_profile d
    join public.app_user u on u.id = d.user_id
    join public.person p on p.id = u.self_person_id
    where d.user_id = p_actor
      and d.element_summary is not null
      and d.element_input_version is not distinct from p.input_version
      and d.element_chart_engine_version is not distinct from p.chart_engine_version
      -- 필요한 기운 요약(지금 셈 이름의 것)과 여덟 글자도 — 카드 점수가 셋을 다 읽는다(ADR 0113 · 0114)
      and d.need_summary is not null
      and d.need_input_version is not distinct from p.input_version
      and d.need_chart_engine_version is not distinct from p.chart_engine_version
      and d.need_summary ->> 'rule' = public.discovery_need_rule()
      and p.current_chart is not null
  );
$function$;

-- ---------------------------------------------------------------------------
-- 6. 참여의 두 문 — `p_need` 를 더 받는다
-- ---------------------------------------------------------------------------

drop function public.ensure_discovery_participation(uuid, jsonb);

create function public.ensure_discovery_participation(
  p_person_id uuid, p_summary jsonb, p_need jsonb default null)
 RETURNS boolean
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  actor uuid := (select auth.uid());
  account public.app_user;
  mine public.person;
  opted_out timestamptz;
begin
  if actor is null then
    raise exception '로그인이 필요합니다.' using errcode = '28000';
  end if;

  if not public.is_active_account() then
    raise exception '이용이 정지된 계정입니다.' using errcode = '42501';
  end if;

  /*
    **여기서는 행을 안 잠근다.** 이 함수는 홈을 열 때마다 도는 자리이고, 잠그면 한 사람의
    두 탭이 서로를 기다린다. 겹쳐 들어와도 마지막 쓰기가 같은 값을 쓴다.
  */
  select * into account from public.app_user where id = actor;

  -- 내 사주가 아니면 아무 일도 아니다. 가족·친구를 고쳤다고 내 노출이 바뀌지 않는다.
  if account.self_person_id is null or account.self_person_id is distinct from p_person_id then
    return false;
  end if;

  if account.nickname is null then
    return false;
  end if;

  select opted_out_at into opted_out from public.discovery_profile where user_id = actor;
  if opted_out is not null then
    return false;
  end if;

  -- 필요한 기운 요약의 모양도 같은 거절이다 — 앱만 짓는 값이라 사용자가 고칠 것이 따로 없다
  if not public.is_element_summary(p_summary)
     or (p_need is not null and not public.is_need_summary(p_need)) then
    raise exception '오행 요약의 모양이 맞지 않습니다.' using errcode = '22023';
  end if;

  select * into mine from public.person where id = account.self_person_id;

  if mine.calendar is null then
    return false;
  end if;

  /*
    `p_need` 가 비면 **있던 필요한 기운 요약을 그대로 둔다** — 옛 앱이 두 인자로 불러도 백필한 값을
    지우지 않는다. 그 사이 입력이 바뀌었으면 요약의 판본이 어긋나 자격에서 저절로 빠진다.
  */
  insert into public.discovery_profile (
    user_id, opted_in_at, element_summary,
    element_input_version, element_chart_engine_version,
    need_summary, need_input_version, need_chart_engine_version)
  values (
    actor, now(), p_summary,
    mine.input_version, mine.chart_engine_version,
    p_need,
    case when p_need is null then null else mine.input_version end,
    case when p_need is null then null else mine.chart_engine_version end)
  on conflict (user_id) do update
    set opted_in_at = coalesce(public.discovery_profile.opted_in_at, now()),
        element_summary = excluded.element_summary,
        element_input_version = excluded.element_input_version,
        element_chart_engine_version = excluded.element_chart_engine_version,
        need_summary = coalesce(excluded.need_summary, public.discovery_profile.need_summary),
        need_input_version = case when excluded.need_summary is null
          then public.discovery_profile.need_input_version else excluded.need_input_version end,
        need_chart_engine_version = case when excluded.need_summary is null
          then public.discovery_profile.need_chart_engine_version else excluded.need_chart_engine_version end;

  return true;
end;
$function$;

revoke execute on function public.ensure_discovery_participation(uuid, jsonb, jsonb) from anon, public;
grant execute on function public.ensure_discovery_participation(uuid, jsonb, jsonb) to authenticated;

drop function public.set_discovery_participation(boolean, jsonb);

create function public.set_discovery_participation(
  p_on boolean, p_summary jsonb, p_need jsonb default null)
 RETURNS boolean
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  actor uuid := (select auth.uid());
  account public.app_user;
  mine public.person;
begin
  if actor is null then
    raise exception '로그인이 필요합니다.' using errcode = '28000';
  end if;

  select * into account from public.app_user where id = actor for update;

  if account.status <> 'active' then
    raise exception '이용이 정지된 계정입니다.' using errcode = '42501';
  end if;

  if not p_on then
    insert into public.discovery_profile (user_id, opted_out_at)
    values (actor, now())
    on conflict (user_id) do update
      set opted_in_at = null,
          opted_out_at = now(),
          element_summary = null,
          element_input_version = null,
          element_chart_engine_version = null,
          need_summary = null,
          need_input_version = null,
          need_chart_engine_version = null;
    return false;
  end if;

  if account.self_person_id is null then
    raise exception '먼저 내 사주를 등록해 주세요.' using errcode = '23502';
  end if;

  if account.nickname is null then
    raise exception '먼저 닉네임을 정해 주세요.' using errcode = '23502';
  end if;

  select * into mine from public.person where id = account.self_person_id;

  if mine.calendar is null then
    raise exception '저장된 출생정보를 찾지 못했습니다.' using errcode = '23502';
  end if;

  if not public.is_element_summary(p_summary)
     or (p_need is not null and not public.is_need_summary(p_need)) then
    raise exception '오행 요약의 모양이 맞지 않습니다.' using errcode = '22023';
  end if;

  insert into public.discovery_profile (
    user_id, opted_in_at, element_summary,
    element_input_version, element_chart_engine_version,
    need_summary, need_input_version, need_chart_engine_version)
  values (
    actor, now(), p_summary,
    mine.input_version, mine.chart_engine_version,
    p_need,
    case when p_need is null then null else mine.input_version end,
    case when p_need is null then null else mine.chart_engine_version end)
  on conflict (user_id) do update
    set opted_in_at = coalesce(public.discovery_profile.opted_in_at, now()),
        opted_out_at = null,
        element_summary = excluded.element_summary,
        element_input_version = excluded.element_input_version,
        element_chart_engine_version = excluded.element_chart_engine_version,
        need_summary = coalesce(excluded.need_summary, public.discovery_profile.need_summary),
        need_input_version = case when excluded.need_summary is null
          then public.discovery_profile.need_input_version else excluded.need_input_version end,
        need_chart_engine_version = case when excluded.need_summary is null
          then public.discovery_profile.need_chart_engine_version else excluded.need_chart_engine_version end;

  return true;
end;
$function$;

revoke execute on function public.set_discovery_participation(boolean, jsonb, jsonb) from anon, public;
grant execute on function public.set_discovery_participation(boolean, jsonb, jsonb) to authenticated;

-- ---------------------------------------------------------------------------
-- 7. 전환 백필의 문 둘 — `service_role` 에만 (백필 뒤 닫는다)
-- ---------------------------------------------------------------------------

/**
 * 필요한 기운 요약을 채워야 하는 참여자 — **없거나 지금 입력 · 엔진 · 셈 이름의 것이 아닌 사람만.** 다 채운 뒤에
 * 다시 부르면 여덟 글자가 없는 사람만 남는다(멱등성의 절반).
 *
 * 여덟 글자를 내준다 — 억부를 셀 재료가 그것뿐이다. 출생 입력(생년월일시 · 출생지)은 안 내준다.
 */
create function public.need_summary_backfill_targets()
returns table(user_id uuid, chart jsonb, input_version integer, chart_engine_version text)
language sql
stable
security definer
set search_path = ''
as $$
  select d.user_id, p.current_chart, p.input_version, p.chart_engine_version
  from public.discovery_profile d
  join public.app_user u on u.id = d.user_id
  join public.person p on p.id = u.self_person_id
  where d.opted_in_at is not null
    and (d.need_summary is null
         or d.need_input_version is distinct from p.input_version
         or d.need_chart_engine_version is distinct from p.chart_engine_version
         or d.need_summary ->> 'rule' is distinct from public.discovery_need_rule())
  order by d.user_id;
$$;

/**
 * 한 사람의 필요한 기운 요약을 적는다 — **셈에 쓴 여덟 글자가 아직 그 사람의 것일 때만.**
 *
 * 읽은 뒤 그 사람이 입력을 고쳤으면(`input_version` · `chart_engine_version` 이 달라졌으면) 안 적고
 * `false` 다 — 낡은 명식으로 센 값을 새 입력 옆에 두지 않는다. 그 사람은 다음에 앱을 열 때 채운다.
 */
create function public.set_discovery_need_summary(
  p_user_id uuid, p_need jsonb, p_input_version integer, p_chart_engine_version text)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  written integer;
begin
  -- 옛 셈으로 지은 요약은 적지 않는다 — 적어도 자격에서 빠지므로, 스크립트가 낡은 빌드인 것을 여기서 알린다
  if not public.is_need_summary(p_need) or p_need ->> 'rule' <> public.discovery_need_rule() then
    raise exception 'need summary shape or rule' using errcode = '22023';
  end if;

  update public.discovery_profile d
     set need_summary = p_need,
         need_input_version = p_input_version,
         need_chart_engine_version = p_chart_engine_version
    from public.app_user u
    join public.person p on p.id = u.self_person_id
   where d.user_id = p_user_id
     and u.id = d.user_id
     and d.opted_in_at is not null
     and p.current_chart is not null
     and p.input_version = p_input_version
     and p.chart_engine_version is not distinct from p_chart_engine_version;

  get diagnostics written = row_count;
  return written = 1;
end;
$$;

revoke execute on function public.need_summary_backfill_targets() from anon, authenticated, public;
revoke execute on function public.set_discovery_need_summary(uuid, jsonb, integer, text) from anon, authenticated, public;
grant execute on function public.need_summary_backfill_targets() to service_role;
grant execute on function public.set_discovery_need_summary(uuid, jsonb, integer, text) to service_role;

-- ---------------------------------------------------------------------------
-- 8. 줄 세우기 — v2 점수, 스냅샷 · 노출 기록은 `v2-beta`
-- ---------------------------------------------------------------------------

create or replace function public.refresh_discovery_snapshot_for(p_actor uuid, p_seed text)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  my_summary jsonb;
  my_need jsonb;
  my_chart jsonb;
  opted timestamptz;
  previous uuid;
  made uuid;
  written integer;
begin
  if p_actor is null then
    raise exception '로그인이 필요합니다.' using errcode = '28000';
  end if;

  if not exists (
    select 1 from public.app_user u where u.id = p_actor and u.status = 'active'
  ) then
    raise exception '이용이 정지된 계정입니다.' using errcode = '42501';
  end if;

  select p.element_summary, p.need_summary, p.opted_in_at
    into my_summary, my_need, opted
  from public.discovery_profile p where p.user_id = p_actor;

  if opted is null then
    raise exception '매칭 참여를 먼저 켜 주세요.' using errcode = '42501';
  end if;

  if not public.my_summary_is_current(p_actor) then
    raise exception '내 오행 요약이 지금 입력의 것이 아닙니다.' using errcode = '55000';
  end if;

  select pe.current_chart into my_chart
  from public.app_user u join public.person pe on pe.id = u.self_person_id
  where u.id = p_actor;

  select s.id into previous
  from public.discovery_candidate s
  where s.user_id = p_actor
  order by s.seq desc
  limit 1;

  insert into public.discovery_candidate (user_id, policy_version, viewer_summary)
  values (p_actor, 'v2-beta', my_summary)
  returning id into made;

  with eligible as (
    select
      other.user_id,
      public.discovery_need_complement_v2(my_need, my_summary, other.need_summary, other.element_summary)
        as complement,
      public.discovery_count_balance_v1(my_summary, other.element_summary) as balance,
      public.discovery_supplied_elements_v1(my_summary, other.element_summary) as supplied,
      public.discovery_preview_score_v2(
        my_chart, my_summary, my_need, tp.current_chart, other.element_summary, other.need_summary) as score,
      other.element_summary as summary,
      exists (
        select 1 from public.discovery_candidate_slot s
        where s.snapshot_id = previous and s.candidate_user_id = other.user_id
      ) as shown_before
    from public.discovery_profile other
    join public.app_user tu on tu.id = other.user_id
    join public.person tp on tp.id = tu.self_person_id
    where public.discovery_eligible(p_actor, other.user_id)
  ),
  scored as (
    select e.*, public.discovery_seeded_unit(p_seed, e.user_id) as u
    from eligible e
  ),
  fresh as (
    select s.* from scored s where not s.shown_before
  ),
  sizes as (
    select count(*)::int as n from fresh
  ),
  keep as (
    select case when sizes.n < 20 then sizes.n else ceil(sizes.n * 0.2)::int end as k
    from sizes
  ),
  ranked as (
    select f.*, row_number() over (order by f.score desc, f.user_id) as rnk from fresh f
  ),
  tops as (
    select r.*, false as exploration
    from ranked r, keep
    where r.rnk <= keep.k
    order by power(r.u, 1.0 / greatest(r.score, 0.0001)) desc, r.user_id
    limit 8
  ),
  explorers as (
    select r.*, true as exploration
    from ranked r, keep
    where r.rnk > keep.k
    order by r.u, r.user_id
    limit 2
  ),
  picked as (
    select user_id, supplied, summary, complement, balance, score, u, exploration from tops
    union all
    select user_id, supplied, summary, complement, balance, score, u, exploration from explorers
  ),
  filler as (
    select s.user_id, s.supplied, s.summary, s.complement, s.balance, s.score, s.u,
      false as exploration
    from scored s
    where not exists (select 1 from picked p where p.user_id = s.user_id)
    order by s.shown_before, power(s.u, 1.0 / greatest(s.score, 0.0001)) desc, s.user_id
    limit (select greatest(0, 10 - (select count(*)::int from picked)))
  ),
  chosen as (
    select * from picked
    union all
    select * from filler
  ),
  counts as (
    select count(*)::int as wanted,
      count(*) filter (where exploration)::int as explorers
    from chosen
  ),
  sorted as (
    select c.*, row_number() over (
      order by power(c.u, 1.0 / greatest(c.score, 0.0001)) desc, c.user_id
    ) as ti
    from chosen c where not c.exploration
  ),
  wandering as (
    select c.*, row_number() over (order by c.u, c.user_id) as ei
    from chosen c where c.exploration
  ),
  slots as (
    select i as ei,
      (floor((i * counts.wanted)::numeric / (counts.explorers + 1))::int - 1) as at
    from counts, generate_series(1, counts.explorers) as i
  ),
  seats as (
    select s.idx, slots.ei, (slots.ei is not null) as is_exploration,
      sum(case when slots.ei is null then 1 else 0 end)
        over (order by s.idx rows between unbounded preceding and current row) as top_index
    from counts, generate_series(0, counts.wanted - 1) as s(idx)
    left join slots on slots.at = s.idx
  ),
  placed as (
    select seats.idx, seats.is_exploration,
      coalesce(w.user_id, t.user_id) as user_id,
      coalesce(w.supplied, t.supplied) as supplied,
      coalesce(w.summary, t.summary) as summary,
      coalesce(w.complement, t.complement) as complement,
      coalesce(w.balance, t.balance) as balance
    from seats
    left join wandering w on seats.is_exploration and w.ei = seats.ei
    left join sorted t on not seats.is_exploration and t.ti = seats.top_index
  ),
  kept as (
    insert into public.discovery_candidate_slot (
      snapshot_id, position, candidate_user_id, candidate_summary,
      exploration, supplied_elements, balance_band
    )
    select made, placed.idx, placed.user_id, placed.summary, placed.is_exploration,
      placed.supplied, public.discovery_balance_band(placed.balance)
    from placed
    returning 1
  ),
  logged as (
    insert into public.discovery_impression (
      viewer_user_id, candidate_user_id, policy_version, position, exploration,
      viewer_summary, candidate_summary, supplied_elements, complement, combined_balance
    )
    select p_actor, placed.user_id, 'v2-beta', placed.idx, placed.is_exploration,
      my_summary, placed.summary, placed.supplied, placed.complement, placed.balance
    from placed
    returning 1
  )
  select count(*) into written from kept;

  delete from public.discovery_candidate s
  where s.user_id = p_actor
    and s.id not in (
      select g.id from (
        select d.id, row_number() over (order by d.seq desc) as gen
        from public.discovery_candidate d where d.user_id = p_actor
      ) g where g.gen <= 2
    );

  return made;
end;
$function$;

-- ---------------------------------------------------------------------------
-- 9. 후보 목록 · 지나친 인연 — `preview_score` 가 v2 (반환형 그대로)
-- ---------------------------------------------------------------------------

create or replace function public.my_discovery_board()
 RETURNS TABLE(candidate_user_id uuid, nickname text, intro text, has_photo boolean, seat integer, exploration boolean, supplied_elements text[], balance_band text, preview_score integer, activity text, avatar_element text)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
#variable_conflict use_column
declare
  actor uuid := (select auth.uid());
  my_summary jsonb;
  my_need jsonb;
  my_chart jsonb;
  opted timestamptz;
  snap uuid;
  made_at timestamptz;
  snap_summary jsonb;
  snap_policy text;
begin
  if actor is null then
    raise exception '로그인이 필요합니다.' using errcode = '28000';
  end if;

  if not public.is_active_account() then
    raise exception '이용이 정지된 계정입니다.' using errcode = '42501';
  end if;

  select p.element_summary, p.need_summary, p.opted_in_at
    into my_summary, my_need, opted
  from public.discovery_profile p where p.user_id = actor;

  if opted is null then
    raise exception '매칭 참여를 먼저 켜 주세요.' using errcode = '42501';
  end if;

  if not public.my_summary_is_current(actor) then
    raise exception '내 오행 요약이 지금 입력의 것이 아닙니다.' using errcode = '55000';
  end if;

  select pe.current_chart into my_chart
  from public.app_user u join public.person pe on pe.id = u.self_person_id
  where u.id = actor;

  select s.id, s.generated_at, s.viewer_summary, s.policy_version
    into snap, made_at, snap_summary, snap_policy
  from public.discovery_candidate s
  where s.user_id = actor
  order by s.seq desc
  limit 1;

  if snap is null
     or made_at < now() - interval '24 hours'
     or snap_summary is distinct from my_summary
     or snap_policy is distinct from 'v2-beta' then
    snap := public.refresh_discovery_snapshot_for(actor, gen_random_uuid()::text);
  end if;

  return query
  select
    slot.candidate_user_id,
    who.nickname,
    who.intro,
    photo.present,
    slot.position,
    slot.exploration,
    slot.supplied_elements,
    slot.balance_band,
    least(100, greatest(0, round(public.discovery_preview_score_v2(
      my_chart, my_summary, my_need, tp.current_chart, theirs.element_summary, theirs.need_summary))))::integer,
    public.activity_band_of(slot.candidate_user_id),
    case when photo.present then null
         else public.day_master_element_of(slot.candidate_user_id) end
  from public.discovery_candidate_slot slot
  join public.app_user who on who.id = slot.candidate_user_id
  join public.person tp on tp.id = who.self_person_id
  join public.discovery_profile theirs on theirs.user_id = slot.candidate_user_id
  cross join lateral (
    select exists (select 1 from public.profile_photo f where f.user_id = slot.candidate_user_id) as present
  ) photo
  where slot.snapshot_id = snap
    and public.discovery_eligible(actor, slot.candidate_user_id)
    and theirs.element_summary = slot.candidate_summary
  order by slot.position;
end;
$function$;

create or replace function public.my_passed_connections()
 RETURNS TABLE(candidate_user_id uuid, nickname text, intro text, has_photo boolean, passed_at timestamp with time zone, supplied_elements text[], balance_band text, preview_score integer, avatar_element text)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
#variable_conflict use_column
declare
  actor uuid := (select auth.uid());
  my_summary jsonb;
  my_need jsonb;
  my_chart jsonb;
begin
  if actor is null then
    raise exception '로그인이 필요합니다.' using errcode = '28000';
  end if;

  if not public.is_active_account() then
    raise exception '이용이 정지된 계정입니다.' using errcode = '42501';
  end if;

  select p.element_summary, p.need_summary into my_summary, my_need
  from public.discovery_profile p where p.user_id = actor;

  if my_summary is null then
    return;
  end if;

  select pe.current_chart into my_chart
  from public.app_user u join public.person pe on pe.id = u.self_person_id
  where u.id = actor;

  return query
  select
    p.passed_user_id,
    who.nickname,
    who.intro,
    photo.present,
    p.passed_at,
    public.discovery_supplied_elements_v1(my_summary, theirs.element_summary),
    public.discovery_balance_band(
      public.discovery_count_balance_v1(my_summary, theirs.element_summary)
    ),
    least(100, greatest(0, round(public.discovery_preview_score_v2(
      my_chart, my_summary, my_need, tp.current_chart, theirs.element_summary, theirs.need_summary))))::integer,
    case when photo.present then null
         else public.day_master_element_of(p.passed_user_id) end
  from public.discovery_passed p
  join public.app_user who on who.id = p.passed_user_id
  join public.person tp on tp.id = who.self_person_id
  join public.discovery_profile theirs on theirs.user_id = p.passed_user_id
  cross join lateral (
    select exists (select 1 from public.profile_photo f where f.user_id = p.passed_user_id) as present
  ) photo
  where p.user_id = actor
    and public.discovery_passed_kept(actor, p.passed_user_id)
    and public.discovery_pair_eligible(actor, p.passed_user_id)
  order by p.passed_at desc, p.passed_user_id desc
  limit 20;
end;
$function$;

-- ---------------------------------------------------------------------------
-- 10. 되살린 인연의 노출 기록 — `v2-beta`
-- ---------------------------------------------------------------------------

create or replace function public.restore_passed_connection(p_candidate_user_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  actor uuid := (select auth.uid());
  snap uuid;
  mine jsonb;
  my_need jsonb;
  theirs jsonb;
  their_need jsonb;
  supplied text[];
  slot record;
begin
  if actor is null then
    raise exception '로그인이 필요합니다.' using errcode = '28000';
  end if;
  -- 같은 계정의 복원들을 직렬화한다.
  perform 1 from public.app_user where id = actor for update;
  if not public.discovery_pair_eligible(actor, p_candidate_user_id) then
    raise exception '지금은 이 인연을 다시 만나볼 수 없습니다. 목록을 새로 열어 주세요.' using errcode = '42501';
  end if;
  if not exists (select 1 from public.discovery_passed p
                 where p.user_id = actor and p.passed_user_id = p_candidate_user_id) then
    raise exception '이미 복원되었거나 보관 중인 인연이 아닙니다. 목록을 새로 열어 주세요.' using errcode = '42501';
  end if;

  -- 지나침을 해제하기 전에 현재 스냅샷을 준비한다. 자동 추천으로 먼저 끼어들지 않는다.
  perform 1 from public.my_discovery_board();
  select s.id into snap from public.discovery_candidate s
    where s.user_id = actor order by s.seq desc limit 1 for update;
  select p.element_summary, p.need_summary into mine, my_need
    from public.discovery_profile p where p.user_id = actor;
  select p.element_summary, p.need_summary into theirs, their_need
    from public.discovery_profile p where p.user_id = p_candidate_user_id;
  supplied := public.discovery_supplied_elements_v1(mine, theirs);

  delete from public.discovery_candidate_slot s
    where s.snapshot_id = snap and s.candidate_user_id = p_candidate_user_id;
  -- 높은 자리부터 옮겨 즉시 검사되는 복합 기본키와 충돌하지 않는다.
  for slot in select s.position from public.discovery_candidate_slot s
              where s.snapshot_id = snap order by s.position desc loop
    update public.discovery_candidate_slot set position = slot.position + 1
      where snapshot_id = snap and position = slot.position;
  end loop;
  insert into public.discovery_candidate_slot
    (snapshot_id, position, candidate_user_id, candidate_summary, exploration, supplied_elements, balance_band)
  values (snap, 0, p_candidate_user_id, theirs, false, supplied,
          public.discovery_balance_band(public.discovery_count_balance_v1(mine, theirs)));
  insert into public.discovery_impression
    (viewer_user_id, candidate_user_id, policy_version, position, exploration,
     viewer_summary, candidate_summary, supplied_elements, complement, combined_balance)
  values (actor, p_candidate_user_id, 'v2-beta', 0, false, mine, theirs, supplied,
          public.discovery_need_complement_v2(my_need, mine, their_need, theirs),
          public.discovery_count_balance_v1(mine, theirs));
  delete from public.discovery_passed p
    where p.user_id = actor and p.passed_user_id = p_candidate_user_id;
  return jsonb_build_object(
    'card', (select to_jsonb(c) from public.my_discovery_board() c where c.candidate_user_id = p_candidate_user_id),
    'passed', (select coalesce(jsonb_agg(p), '[]'::jsonb) from public.my_passed_connections() p)
  );
end;
$function$;
