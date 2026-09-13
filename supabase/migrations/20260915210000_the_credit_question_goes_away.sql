-- 「남은 풀이권을 더 쓸 생각이 있나」를 뺀다
--
-- 하루도 안 서 보고 뺀다. **그 답으로 할 일이 없기 때문이다.**
--
--   · 잔액은 테스트 기간의 **인위적 한도**다. 「더 쓰겠다」도 「안 쓰겠다」도 제품의 무엇을
--     정하지 않는다 — 한도를 옮길지는 예산이 정하지 사용자의 의향이 정하지 않는다.
--   · 「앞으로 이용하고 싶은 것」(`wants`)이 **이미 같은 것을 묻는다.** 두 문항이 같은
--     자리를 재면 답한 사람은 같은 말을 두 번 하고, 우리는 어느 쪽을 읽을지 정해야 한다.
--
-- 답할 사람의 시간을 쓰는 문항은 **그 답이 무엇을 정하는지** 말할 수 있어야 한다.
--
-- ## 좁혀도 되는 까닭
--
-- 인자를 줄이는 것은 새 함수를 세우고 옛 것을 지우는 일이다. 보통은 넓히고 나중에
-- 좁히지만(`saju-expand-then-contract`), **여기서는 옛 서명을 부르는 앱이 어디에도 없다** —
-- 이 설문은 아직 배포되지 않았고 표에는 프로덕션 기준 한 줄도 없다. 창이 생길 자리가 없다.
--
-- `credits_left` 는 남긴다. 그것은 문항의 답이 아니라 **답할 때의 형편**이고, 다른 답을
-- 읽을 때 옆에 있어야 하는 값이다.

alter table public.service_survey
  drop column if exists credit_intent,
  drop column if exists credit_reasons;

/**
 * 내 답 한 줄 — 반환형에서도 두 칸이 빠진다.
 *
 * 반환형이 바뀌므로 `create or replace` 로는 안 되고 지웠다 다시 세운다. 이 함수를 부르는
 * 곳은 설문 화면 하나뿐이고 그 화면은 아직 배포되지 않았다.
 */
drop function if exists public.my_service_survey();

create function public.my_service_survey()
returns table (
  liked text[],
  unknown_features text[],
  improve text[],
  improve_text text,
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
    s.wants, s.wants_new,
    s.price_solo, s.price_pair, s.price_factors, s.free_text,
    s.saved_at, s.submitted_at, s.updated_at
  from public.service_survey s
  where s.user_id = (select auth.uid());
$$;

revoke execute on function public.my_service_survey() from anon, public, service_role;
grant execute on function public.my_service_survey() to authenticated;

drop function if exists public.save_service_survey(
  text[], text[], text[], text, text, text[], text[], text[], text, text, text[], text,
  text[], boolean);

/**
 * 답을 저장한다. `p_submit` 이 참이면 제출까지.
 *
 * 앞 판(`20260915180000`)에서 풀이권 문항 두 인자만 빠졌다. 나머지 규율은 그대로다 —
 * 숨은 문항은 **비우고**(그 사이에 상태가 바뀐 것이지 사용자 잘못이 아니다), 단독 항목과
 * 일반 항목이 함께 오는 것은 **화면이 깨졌다는 뜻이라 거절한다.**
 */
create or replace function public.save_service_survey(
  p_liked text[],
  p_unknown text[],
  p_improve text[],
  p_improve_text text,
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

  if public.survey_sole_conflict(p_liked, array['none', 'not_enough'])
     or public.survey_sole_conflict(p_unknown, array['all_known', 'not_sure'])
     or public.survey_sole_conflict(p_improve, array['none', 'unsure'])
     or public.survey_sole_conflict(p_wants, array['unsure', 'none_again'])
     or public.survey_sole_conflict(p_wants_new, array['none']) then
    raise exception '함께 고를 수 없는 답이 섞여 있습니다.' using errcode = 'check_violation';
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
           or coalesce(cardinality(p_wants), 0) > 0
           or coalesce(cardinality(p_wants_new), 0) > 0
           or solo is not null
           or pair is not null
           or cardinality(factors) > 0
           or more is not null;

  if p_submit and not anything then
    raise exception '답을 하나도 고르지 않으셨습니다.' using errcode = 'check_violation';
  end if;

  insert into public.service_survey as s (
    user_id, schedule_id, survey_version,
    liked, unknown_features, improve, improve_text,
    wants, wants_new,
    price_solo, price_pair, price_options, price_asked, price_factors, free_text,
    credits_left, usage, saved_at, submitted_at
  )
  values (
    actor, ctx.schedule_id, 'service-survey-v1',
    coalesce(p_liked, array[]::text[]),
    coalesce(p_unknown, array[]::text[]),
    coalesce(p_improve, array[]::text[]),
    said,
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
      submitted_at = coalesce(s.submitted_at, excluded.submitted_at),
      updated_at = case
        when p_submit and s.submitted_at is not null then now()
        else s.updated_at
      end
  returning s.submitted_at into when_submitted;

  return when_submitted;
end;
$$;

revoke execute on function public.save_service_survey(
  text[], text[], text[], text, text[], text[], text, text, text[], text, text[], boolean)
  from anon, public, service_role;
grant execute on function public.save_service_survey(
  text[], text[], text[], text, text[], text[], text, text, text[], text, text[], boolean)
  to authenticated;

/** 세는 자리에서도 그 두 문항이 빠진다 — 없는 열을 세면 함수가 그 자리에서 죽는다 */
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
    union all select 'wants', t from said, unnest(said.wants) t
    union all select 'wantsNew', t from said, unnest(said.wants_new) t
    union all select 'priceFactors', t from said, unnest(said.price_factors) t
    union all select 'priceSolo', said.price_solo from said where said.price_solo is not null
    union all select 'pricePair', said.price_pair from said where said.price_pair is not null
  )
  select spread.q, spread.c, count(*)::integer
  from spread
  group by spread.q, spread.c
  order by spread.q, count(*) desc, spread.c;
end;
$$;
