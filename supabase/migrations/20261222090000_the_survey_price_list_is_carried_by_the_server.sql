-- 설문의 「보여 준 금액 목록」은 서버가 싣는다 — 보낸 쪽이 고칠 수 있는 기록은 기록이 아니다 (2026-10-22 읽기 감사)
--
-- `save_service_survey` 는 `p_price_options` 를 그대로 `service_survey.price_options` 에 적었다(`20261105090000` 까지). 다른 배열
-- 칸은 `<@` 검사가 모르는 값을 막지만 이 칸만 검사가 없다(`20260915180000`). 서버 액션(`app/me/survey/actions.ts`)은 상수
-- `PRICE_OPTIONS` 를 보냈지만 문은 `authenticated` 에 열려 있어, 로그인한 사람이 RPC 를 바로 불러 아무 목록이나 남길 수 있었다 —
-- 결제 금액이 아니라 설문 근거 데이터(「그 답이 어느 목록에 대한 답인가」)의 오염이다.
--
-- 고친 것 — 문이 판본(`service-survey-v1`)의 목록을 스스로 싣고 `p_price_options` 는 읽지 않는다. 인자는 지우지 않고 기본값
-- (`null`)만 더한다 — 서명이 그대로라 옛 앱(인자를 보낸다)도 새 앱(안 보낸다)도 이 DB 에서 돈다(`docs/ops/runbook/deploy.md`
-- 규약 넷의 2 · 3). 몸은 운영의 살아 있는 정의(`20261105090000` 과 같다 — 2026-10-22 에 견줘 봤다)에서 떴고 세 줄만 다르다.
-- grant 는 `create or replace` 가 그대로 둔다.
--
-- 재는 자리는 `supabase/tests/27_service_survey.test.sql` 이다.

CREATE OR REPLACE FUNCTION public.save_service_survey(p_liked text[], p_unknown text[], p_improve text[], p_improve_text text, p_wants text[], p_wants_new text[], p_price_solo text, p_price_pair text, p_price_factors text[], p_free_text text, p_price_options text[] DEFAULT NULL::text[], p_submit boolean DEFAULT false)
 RETURNS timestamp with time zone
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  actor uuid := (select auth.uid());
  ctx record;
  solo text := nullif(btrim(p_price_solo), '');
  pair text := nullif(btrim(p_price_pair), '');
  factors text[] := coalesce(p_price_factors, array[]::text[]);
  said text := nullif(btrim(p_improve_text), '');
  more text := nullif(btrim(p_free_text), '');
  /*
    그 판본의 화면이 보여 준 금액 목록 — **서버가 싣는다.** `p_price_options` 는 받기만 하고 읽지 않는다(옛 앱이 아직 보낸다).
    화면의 목록은 `src/lib/survey/index.ts` 의 `PRICE_OPTIONS` 이고, 판본을 올리는 날 이 줄과 그 상수를 함께 고친다.
  */
  shown text[] := array['free', '990', '1990', '4900', '9900', '12000', 'over_12000', 'unsure']::text[];
  asked text[];
  anything boolean;
  when_submitted timestamptz;
begin
  if actor is null then
    raise exception '로그인이 필요해요. 로그인한 뒤 다시 시도해 주세요.' using errcode = '28000';
  end if;

  if not public.is_active_account() then
    raise exception '이용이 정지된 계정입니다.' using errcode = '42501';
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
    solo, pair, shown, asked, factors, more,
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
$function$;
