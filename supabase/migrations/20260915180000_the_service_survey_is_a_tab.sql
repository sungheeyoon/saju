-- 서비스 설문 — **탭 하나에서 언제든 받는다** (ADR 0062)
--
-- 풀이 아래의 설문은 **그 글 하나**에 대한 답이라 그 글을 만든 시도에 매인다(ADR 0022).
-- 「무엇이 좋았나」·「얼마면 내겠나」는 매달릴 시도가 없어서 그 자리에 둘 수 없다.
--
-- ## 왜 띠가 아니라 탭인가
--
-- 「잔액이 0이 된 사람에게 띠를 세운다」·「종료 3일 전부터 모두에게」로 지으려 했다. 그러면
-- **답할 사람을 우리가 고르는** 것이 되고 표본이 「다 써 본 사람」 쪽으로 기운다. 탭을 열어
-- 두고 할 사람이 자기 때에 하게 한다.
--
-- ## 초안과 제출을 한 표에서 가른다
--
-- `submitted_at` 이 `null` 이면 초안이다. 운영자가 읽는 함수는 `submitted_at is not null`
-- 만 센다 — **화면의 약속이 아니라 함수의 조건으로 둔다.** 작성 도중의 문장을 제출한 의견
-- 처럼 읽으면 안 되고, 그것을 화면이 지키게 하면 집계 화면이 하나 더 생기는 날 새어 든다.
--
-- ## `schedule_id` 는 테스트 회차가 아니다
--
-- `beta_schedule` 은 쌓는 표라 종료일을 미루거나 운영자 정보만 바꿔도 새 줄이 생긴다
-- (프로덕션은 이미 `id = 2`). 그래서 **그때 어느 줄이었나를 기록만** 하고 회차로 쓰지
-- 않는다. 첫 저장 때만 적어서 답을 고쳐도 안 바뀐다. 2차 테스트를 실제로 열 때 회차 값을
-- 세우고 그때 PK 를 넓힌다 — 지금 없는 개념을 미리 짓지 않는다.

create table if not exists public.service_survey (
  /** **사람 하나에 한 줄.** 답을 고치는 것이지 새로 쌓는 것이 아니다 */
  user_id uuid primary key references public.app_user (id) on delete cascade,

  /**
   * 그때 안내가 어느 줄이었나 — **첫 저장 때만 적는다.**
   *
   * **FK 를 안 건다.** 이 값은 가리키는 것이 아니라 **찍어 두는 것**이다. 매어 두면 답 한
   * 줄이 운영자가 일정 줄을 지우는 것을 막고(검사가 일정을 비웠다 채웠다 하는 자리가
   * 이미 있다), 그 줄이 사라져도 「그때 2번 줄이었다」는 여전히 참이다.
   */
  schedule_id bigint not null,
  survey_version text not null,

  /** Q1 — 직접 이용해 본 것 중 좋았던 것 */
  liked text[] not null default array[]::text[]
    constraint liked_is_known check (liked <@ array[
      'self_reading', 'person_reading', 'pair_reading', 'discovery', 'match_reading',
      'none', 'not_enough']::text[]),

  /** Q1b — **발견 여부는 따로 물어야 얻는다.** 목록을 다 세우는 것으로는 안 나온다 */
  unknown_features text[] not null default array[]::text[]
    constraint unknown_is_known check (unknown_features <@ array[
      'self_reading', 'person_reading', 'pair_reading', 'discovery', 'match_reading',
      'all_known', 'not_sure']::text[]),

  /** Q2 */
  improve text[] not null default array[]::text[]
    constraint improve_is_known check (improve <@ array[
      'content', 'birth_input', 'picking', 'waiting', 'layout', 'discovery',
      'errors', 'missing', 'none', 'unsure', 'other']::text[]),
  improve_text text check (length(improve_text) between 1 and 500),

  /**
   * Q3 — **의향을 먼저 묻는다.** 「왜 안 썼나」는 첫날 답하는 사람에게 성립하지 않는다.
   * 잔액이 0이면 이 문항이 아예 안 서므로 두 칸이 비어 있다.
   */
  credit_intent text check (credit_intent in ('will_use', 'undecided', 'not_for_now')),
  credit_reasons text[] not null default array[]::text[]
    constraint credit_reasons_are_known check (credit_reasons <@ array[
      'enough', 'no_target', 'below_expectation', 'no_birth_info',
      'troublesome', 'error', 'no_time', 'other']::text[]),

  /** Q4 — 있는 것 */
  wants text[] not null default array[]::text[]
    constraint wants_are_known check (wants <@ array[
      'self_deeper', 'person_reading', 'pair_reading', 'discovery', 'refresh_luck',
      'unsure', 'none_again']::text[]),
  /** Q4 — **아직 없는 것.** 섞어 세우면 곧 나온다고 읽힌다 */
  wants_new text[] not null default array[]::text[]
    constraint wants_new_are_known check (wants_new <@ array[
      'followup_question', 'compare_readings', 'chat', 'luck_notice', 'none']::text[]),

  /**
   * Q5 — **읽어 본 종류만 묻는다.** 안 써 본 것의 값은 값이 아니라 인상이다.
   *
   * 고른 값과 함께 **그때 보여 준 금액 목록**을 남긴다. 나중에 후보를 옮기는 날
   * 「9,900원」만 남은 줄은 어느 목록에 대한 답인지 말할 수 없다.
   */
  price_solo text check (price_solo in (
    'free', '990', '1990', '4900', '9900', '12000', 'over_12000', 'unsure')),
  price_pair text check (price_pair in (
    'free', '990', '1990', '4900', '9900', '12000', 'over_12000', 'unsure')),
  price_options text[] not null default array[]::text[],
  /** 어느 상품을 물었나 — 안 물어본 것과 안 고른 것이 갈린다 */
  price_asked text[] not null default array[]::text[]
    constraint price_asked_is_known check (price_asked <@ array['solo', 'pair']::text[]),
  price_factors text[] not null default array[]::text[]
    constraint price_factors_are_known check (price_factors <@ array[
      'depth', 'answered', 'trust', 'fun', 'difference', 'free_alternatives',
      'budget', 'future_need', 'willingness', 'other']::text[]),

  /** Q6 */
  free_text text check (length(free_text) between 1 and 1000),

  /**
   * 저장 시점의 남은 풀이권과 이용 현황 — **보조 자료다.**
   *
   * 생성 기록이 없다는 이유로 이용하지 않았다고 단정하지 않는다. 공유 결과처럼 기록
   * 범위 밖의 이용이 있고, 그래서 이 값은 답을 **거르는 데 쓰지 않고 읽는 데만** 쓴다.
   */
  credits_left integer,
  usage jsonb not null default '{}'::jsonb,

  /** 마지막 저장 — 초안도 포함한다 */
  saved_at timestamptz not null default now(),
  /** **처음 제출한 때.** `null` 이면 아직 초안이다 */
  submitted_at timestamptz,
  /** 제출한 뒤에 답을 바꾼 때 */
  updated_at timestamptz
);

comment on table public.service_survey is
  '서비스 설문 — 사람 하나에 한 줄. submitted_at 이 null 이면 초안이고 집계에 안 든다 (ADR 0062).';

alter table public.service_survey enable row level security;
revoke all on public.service_survey from anon, authenticated, service_role;

/** 제출된 것만 세는 자리가 여럿이라 그 갈래에 인덱스를 둔다 */
create index if not exists service_survey_submitted
  on public.service_survey (submitted_at) where submitted_at is not null;

/**
 * 단독 항목과 일반 항목이 함께 왔나 — **화면이 이미 막는 것을 서버도 지킨다.**
 *
 * 「없어요」·「모르겠어요」는 다른 답과 양립하지 않는다. 조용히 다듬지 않고 **거절한다** —
 * 다듬으면 화면이 깨진 날 그 고장이 자료 속으로 사라진다.
 */
create or replace function public.survey_sole_conflict(p_picked text[], p_sole text[])
returns boolean
language sql
immutable
set search_path = ''
as $$
  select cardinality(coalesce(p_picked, array[]::text[])) > 1
     and coalesce(p_picked, array[]::text[]) && p_sole;
$$;

revoke execute on function public.survey_sole_conflict(text[], text[])
  from anon, public, authenticated, service_role;

-- ---------------------------------------------------------------------------
-- 화면이 무엇을 세울지 — **문항의 조건은 서버가 답한다**
-- ---------------------------------------------------------------------------

/**
 * 이 사람에게 어느 문항이 서나.
 *
 * 화면이 스스로 세면 저장하는 자리와 그리는 자리가 다른 조건을 쓰게 되고, 그때 「안 물어본
 * 문항의 답」이 저장된다. 조건을 한 자리에서 내주고 화면은 그것을 읽는다.
 */
create or replace function public.service_survey_context()
returns table (
  schedule_id bigint,
  credits_left integer,
  read_solo boolean,
  read_pair boolean,
  consented boolean,
  beta_over boolean
)
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  actor uuid := (select auth.uid());
  counted record;
begin
  if actor is null then
    raise exception '로그인이 필요합니다.' using errcode = '28000';
  end if;

  select * into counted from public.reading_credits_used(actor);

  return query
  select
    (select s.schedule_id from public.current_beta_schedule() s),
    greatest(0, public.reading_credit_limit_for(actor)
                - counted.used - counted.reserved - counted.requested),
    exists (
      select 1 from public.reading r
      where r.owner_user_id = actor and r.kind in ('self', 'person')),
    exists (
      select 1 from public.reading r
      where (r.owner_user_id = actor and r.kind = 'private')
         or (r.kind = 'match' and r.match_id in (
               select m.id from public.match m
               where m.user_low = actor or m.user_high = actor))),
    coalesce((select u.improvement_consent from public.app_user u where u.id = actor), false),
    public.beta_is_over();
end;
$$;

revoke execute on function public.service_survey_context() from anon, public, service_role;
grant execute on function public.service_survey_context() to authenticated;

/**
 * 내 답 한 줄 — **초안도 함께 내려온다.**
 *
 * 「답했는가」만 내려주면 고치는 화면이 빈 칸으로 열리고, 거기서 다시 보내면 적어 두었던
 * 글이 지워진다. 풀이 설문이 이미 한 번 겪은 자리다.
 */
create or replace function public.my_service_survey()
returns table (
  liked text[],
  unknown_features text[],
  improve text[],
  improve_text text,
  credit_intent text,
  credit_reasons text[],
  wants text[],
  wants_new text[],
  price_solo text,
  price_pair text,
  price_factors text[],
  free_text text,
  saved_at timestamptz,
  submitted_at timestamptz,
  updated_at timestamptz
)
language sql
stable
security definer
set search_path = ''
as $$
  select
    s.liked, s.unknown_features, s.improve, s.improve_text,
    s.credit_intent, s.credit_reasons, s.wants, s.wants_new,
    s.price_solo, s.price_pair, s.price_factors, s.free_text,
    s.saved_at, s.submitted_at, s.updated_at
  from public.service_survey s
  where s.user_id = (select auth.uid());
$$;

revoke execute on function public.my_service_survey() from anon, public, service_role;
grant execute on function public.my_service_survey() to authenticated;

-- ---------------------------------------------------------------------------
-- 저장 — 초안과 제출이 **한 문을 지난다**
-- ---------------------------------------------------------------------------

/**
 * 답을 저장한다. `p_submit` 이 참이면 제출까지.
 *
 * 문을 둘로 나누지 않는 것은 검사가 두 벌이 되기 때문이다. 초안이라고 아무 값이나 받으면
 * 제출로 바꾸는 순간 검사에 걸리는 줄이 이미 저장돼 있게 된다.
 *
 * ## 숨은 문항은 **비우고, 안 다듬는 것은 거절한다**
 *
 * 잔액이 0이 되었거나 안 읽은 종류의 값이 실려 오면 **서버가 비운다** — 화면을 열어 둔
 * 사이에 상태가 바뀐 것이지 사용자가 잘못 누른 것이 아니다. 반대로 단독 항목과 일반
 * 항목이 함께 오는 것은 **화면이 깨졌다는 뜻**이라 거절한다.
 */
create or replace function public.save_service_survey(
  p_liked text[],
  p_unknown text[],
  p_improve text[],
  p_improve_text text,
  p_credit_intent text,
  p_credit_reasons text[],
  p_wants text[],
  p_wants_new text[],
  p_price_solo text,
  p_price_pair text,
  p_price_factors text[],
  p_free_text text,
  p_price_options text[],
  p_submit boolean default false
)
returns timestamptz
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor uuid := (select auth.uid());
  ctx record;
  intent text := nullif(btrim(p_credit_intent), '');
  reasons text[] := coalesce(p_credit_reasons, array[]::text[]);
  solo text := nullif(btrim(p_price_solo), '');
  pair text := nullif(btrim(p_price_pair), '');
  factors text[] := coalesce(p_price_factors, array[]::text[]);
  said text := nullif(btrim(p_improve_text), '');
  more text := nullif(btrim(p_free_text), '');
  asked text[];
  anything boolean;
  when_submitted timestamptz;
begin
  if actor is null then
    raise exception '로그인이 필요합니다.' using errcode = '28000';
  end if;

  if not public.is_active_account() then
    raise exception '중지된 계정입니다.' using errcode = '42501';
  end if;

  /* 끝난 서비스가 새 자료를 받지 않는다 — 풀이 설문과 같은 규율이다 */
  if public.beta_is_over() then
    raise exception '비공개 테스트가 끝났습니다.' using errcode = 'check_violation';
  end if;

  select * into ctx from public.service_survey_context();

  if not ctx.consented then
    raise exception '설문은 풀이 개선에 활용하는 데 동의하신 뒤에 받을 수 있습니다.'
      using errcode = 'check_violation';
  end if;

  if ctx.schedule_id is null then
    raise exception '아직 시작하지 않았습니다.' using errcode = 'check_violation';
  end if;

  -- ── 화면이 깨진 것은 거절한다 ────────────────────────────────────────────
  if public.survey_sole_conflict(p_liked, array['none', 'not_enough'])
     or public.survey_sole_conflict(p_unknown, array['all_known', 'not_sure'])
     or public.survey_sole_conflict(p_improve, array['none', 'unsure'])
     or public.survey_sole_conflict(p_wants, array['unsure', 'none_again'])
     or public.survey_sole_conflict(p_wants_new, array['none']) then
    raise exception '함께 고를 수 없는 답이 섞여 있습니다.' using errcode = 'check_violation';
  end if;

  -- ── 안 물어본 문항의 답은 안 받는다 ──────────────────────────────────────
  if ctx.credits_left = 0 then
    intent := null;
  end if;
  if intent is null or intent = 'will_use' then
    reasons := array[]::text[];
  end if;
  if not ctx.read_solo then solo := null; end if;
  if not ctx.read_pair then pair := null; end if;
  if not (ctx.read_solo or ctx.read_pair) then factors := array[]::text[]; end if;

  asked := array(select s from unnest(array['solo', 'pair']) s
                 where (s = 'solo' and ctx.read_solo) or (s = 'pair' and ctx.read_pair));

  anything := coalesce(cardinality(p_liked), 0) > 0
           or coalesce(cardinality(p_unknown), 0) > 0
           or coalesce(cardinality(p_improve), 0) > 0
           or said is not null
           or intent is not null
           or cardinality(reasons) > 0
           or coalesce(cardinality(p_wants), 0) > 0
           or coalesce(cardinality(p_wants_new), 0) > 0
           or solo is not null
           or pair is not null
           or cardinality(factors) > 0
           or more is not null;

  /**
   * **빈 줄은 제출로 안 받는다.** 아무 말도 없는 줄이 참여로 세어지면 그 줄은 나중에
   * 「불만이 없다」로 잘못 읽힌다. 초안은 비어도 된다 — 지우는 중일 수 있다.
   */
  if p_submit and not anything then
    raise exception '답을 하나도 고르지 않으셨습니다.' using errcode = 'check_violation';
  end if;

  insert into public.service_survey as s (
    user_id, schedule_id, survey_version,
    liked, unknown_features, improve, improve_text,
    credit_intent, credit_reasons, wants, wants_new,
    price_solo, price_pair, price_options, price_asked, price_factors, free_text,
    credits_left, usage, saved_at, submitted_at
  )
  values (
    actor, ctx.schedule_id, 'service-survey-v1',
    coalesce(p_liked, array[]::text[]),
    coalesce(p_unknown, array[]::text[]),
    coalesce(p_improve, array[]::text[]),
    said,
    intent, reasons,
    coalesce(p_wants, array[]::text[]),
    coalesce(p_wants_new, array[]::text[]),
    solo, pair, coalesce(p_price_options, array[]::text[]), asked, factors, more,
    ctx.credits_left,
    jsonb_build_object(
      'readSolo', ctx.read_solo,
      'readPair', ctx.read_pair,
      'creditsLeft', ctx.credits_left,
      'readings', (select count(*) from public.reading r
                   where r.owner_user_id = actor
                      or (r.kind = 'match' and r.match_id in (
                            select m.id from public.match m
                            where m.user_low = actor or m.user_high = actor))),
      'matches', (select count(*) from public.match m
                  where m.user_low = actor or m.user_high = actor),
      'discovery', exists (select 1 from public.discovery_profile p
                           where p.user_id = actor and p.opted_in_at is not null)),
    now(),
    case when p_submit then now() end
  )
  on conflict (user_id) do update
  set liked = excluded.liked,
      unknown_features = excluded.unknown_features,
      improve = excluded.improve,
      improve_text = excluded.improve_text,
      credit_intent = excluded.credit_intent,
      credit_reasons = excluded.credit_reasons,
      wants = excluded.wants,
      wants_new = excluded.wants_new,
      price_solo = excluded.price_solo,
      price_pair = excluded.price_pair,
      price_options = excluded.price_options,
      price_asked = excluded.price_asked,
      price_factors = excluded.price_factors,
      free_text = excluded.free_text,
      credits_left = excluded.credits_left,
      usage = excluded.usage,
      survey_version = excluded.survey_version,
      saved_at = now(),
      /* **처음 제출한 때는 안 움직인다** — 답이 언제 들어왔나가 그 값이다 */
      submitted_at = coalesce(s.submitted_at, excluded.submitted_at),
      /* 제출한 뒤에 답을 바꾼 때 */
      updated_at = case
        when p_submit and s.submitted_at is not null then now()
        else s.updated_at
      end
      /* `schedule_id` 는 여기 없다 — 첫 저장 때만 적어서 답을 고쳐도 안 바뀐다 */
  returning s.submitted_at into when_submitted;

  return when_submitted;
end;
$$;

revoke execute on function public.save_service_survey(
  text[], text[], text[], text, text, text[], text[], text[], text, text, text[], text,
  text[], boolean) from anon, public, service_role;
grant execute on function public.save_service_survey(
  text[], text[], text[], text, text, text[], text[], text[], text, text, text[], text,
  text[], boolean) to authenticated;

-- ---------------------------------------------------------------------------
-- 철회하면 함께 지운다
-- ---------------------------------------------------------------------------

/**
 * 개선 활용 동의를 끄면 **이 줄도 함께 지운다** — `reading_feedback` 과 같은 규율이다.
 *
 * 지금 프로덕션에 있는 정의를 그대로 받아 적고 줄 하나를 더했다. 손으로 옮겨 적으면 그
 * 사이에 바뀐 것을 되돌리게 되므로(이 저장소가 이미 한 번 겪은 자리다) 살아 있는 정의에서
 * 생성했다.
 */
CREATE OR REPLACE FUNCTION public.set_improvement_consent(p_consent boolean)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
begin
  if p_consent is null then
    raise exception '동의 여부를 정해 주세요.' using errcode = 'check_violation';
  end if;

  update public.app_user u
  set improvement_consent = p_consent
  where u.id = (select auth.uid()) and u.status = 'active';

  if not found then
    raise exception '계정을 찾지 못했습니다.' using errcode = 'no_data_found';
  end if;

  if p_consent = false then
    delete from public.reading_feedback f
    where f.respondent_user_id = (select auth.uid());

    /* 서비스 설문도 같은 열쇠 뒤에 있다 — 값만 꺼 두면 근거 없이 남는 답이 생긴다 */
    delete from public.service_survey s
    where s.user_id = (select auth.uid());
  end if;
end;
$function$
;

-- ---------------------------------------------------------------------------
-- 운영자가 읽는 자리 — **제출한 것만** (ADR 0061)
-- ---------------------------------------------------------------------------

create or replace function public.operator_service_survey_overview()
returns table (
  submitted integer,
  drafts integer,
  priced_solo integer,
  priced_pair integer,
  updated integer
)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if not public.is_operator() then
    raise exception '운영자만 읽는 자리입니다.' using errcode = '42501';
  end if;

  return query
  select
    count(*) filter (where s.submitted_at is not null)::integer,
    count(*) filter (where s.submitted_at is null)::integer,
    count(*) filter (where s.submitted_at is not null and s.price_solo is not null)::integer,
    count(*) filter (where s.submitted_at is not null and s.price_pair is not null)::integer,
    count(*) filter (where s.updated_at is not null)::integer
  from public.service_survey s;
end;
$$;

/**
 * 문항별 선택지 개수 — **한 표로 편다.**
 *
 * 문항마다 함수를 두면 화면이 열 번 묻게 되고, 새 문항이 늘 때마다 함수가 하나씩 는다.
 * 이름(`question`)은 화면이 말로 옮긴다 — 그 말은 코드가 들고 있다(`src/lib/survey`).
 */
create or replace function public.operator_service_survey_counts()
returns table (
  question text,
  choice text,
  answers integer
)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if not public.is_operator() then
    raise exception '운영자만 읽는 자리입니다.' using errcode = '42501';
  end if;

  return query
  with said as (
    select * from public.service_survey s where s.submitted_at is not null
  ),
  spread as (
    select 'liked'::text as q, t as c from said, unnest(said.liked) t
    union all select 'unknown', t from said, unnest(said.unknown_features) t
    union all select 'improve', t from said, unnest(said.improve) t
    union all select 'creditReasons', t from said, unnest(said.credit_reasons) t
    union all select 'wants', t from said, unnest(said.wants) t
    union all select 'wantsNew', t from said, unnest(said.wants_new) t
    union all select 'priceFactors', t from said, unnest(said.price_factors) t
    union all select 'creditIntent', said.credit_intent from said
              where said.credit_intent is not null
    union all select 'priceSolo', said.price_solo from said where said.price_solo is not null
    union all select 'pricePair', said.price_pair from said where said.price_pair is not null
  )
  select spread.q, spread.c, count(*)::integer
  from spread
  group by spread.q, spread.c
  order by spread.q, count(*) desc, spread.c;
end;
$$;

/**
 * 적어 주신 글 — **누가 썼는지는 안 낸다.**
 *
 * 풀이 설문의 같은 자리와 한 규율이다(ADR 0061). 답한 사람에게 되묻는 일이 없으므로
 * 사람이 실릴 까닭이 없고, 실리는 순간 이 화면은 「누가 뭐라고 했나」가 된다.
 */
create or replace function public.operator_service_survey_texts()
returns table (
  improve_text text,
  free_text text,
  price_solo text,
  price_pair text,
  submitted_at timestamptz
)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if not public.is_operator() then
    raise exception '운영자만 읽는 자리입니다.' using errcode = '42501';
  end if;

  return query
  select s.improve_text, s.free_text, s.price_solo, s.price_pair, s.submitted_at
  from public.service_survey s
  where s.submitted_at is not null
    and (s.improve_text is not null or s.free_text is not null)
  order by s.submitted_at desc;
end;
$$;

revoke execute on function public.operator_service_survey_overview() from anon, public, service_role;
revoke execute on function public.operator_service_survey_counts() from anon, public, service_role;
revoke execute on function public.operator_service_survey_texts() from anon, public, service_role;

grant execute on function public.operator_service_survey_overview() to authenticated;
grant execute on function public.operator_service_survey_counts() to authenticated;
grant execute on function public.operator_service_survey_texts() to authenticated;

-- ---------------------------------------------------------------------------
-- 지우기 — **열쇠를 따라간다** (ADR 0023)
-- ---------------------------------------------------------------------------

/*
  계정이 사라지면 `on delete cascade` 로 따라간다. 베타 파기도 계정을 지우는 일이라
  같은 길로 사라진다 — **그래서 파기 전에 합계를 뽑는다**(`docs/ops/runbook.md`).
*/
