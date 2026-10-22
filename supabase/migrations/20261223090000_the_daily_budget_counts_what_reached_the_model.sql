-- 하루 공용 상한은 모델에 닿았을 수 있는 시도를 센다 — 제출 전에 끝난 예약은 자리를 돌려준다 (ADR 0198, 결정 대기)
--
-- `reading_spend_today()` 는 오늘 연 `reading_run` 을 상태와 상관없이 셌다(`20260909090000` — 「성공도 실패도 다 센다」).
-- 시도를 여는 문(`start_reading_run`)은 `authenticated` 에 열려 있고, 모델에 보내는 걸음은 앱이 열쇠로 따로 밟는다
-- (`prepare_reading_job` → 제출, `app/me/reading/pipeline.ts` 의 `submitFrozen`). 문만 바로 부르면 모델에 한 번도 안
-- 가는 예약이 생기고, 그것은 복구기(`prepare-timeout`)나 같은 대상의 다음 누름(`expired`)이 닫는다 — 그래도 상한의
-- 자리를 그대로 차지했다. 계정 하나는 시간당 20(`reading_rate_limit`)이라 하루 500(`reading_daily_budget`)을 못 채우지만
-- 계정 여럿이면 채운다. 그러면 그날 모든 사람의 풀이가 막힌다 — 돈은 안 나가고 서비스가 선다.
--
-- ## 고친 것 — 「모델에 닿았을 수 있는가」로 센다
--
-- **실패를 통째로 빼지 않는다** — 모델이 토큰을 쓴 뒤 실패한 시도가 있다(`model-timeout` · `model-incomplete` · 검사
-- 실패). 그래서 가르는 금은 성공/실패가 아니라 **제출 직전 문을 지났는가**다.
--
-- 1. `reading_run.prepared_at` — 제출 직전 문(`prepare_reading_job`, 열쇠에만 열림)이 적는다. 모델에 보내는 길은 그 문
--    뒤의 하나뿐이다(`submitBackgroundReading` 의 부르는 자리는 `submitFrozen` 하나, 2026-10-22 에 쟀다). 사용자는 이 칸을
--    못 쓴다 — `reading_run` 에 쓰는 사용자 문이 없다.
-- 2. 센다 = 오늘 연 시도 가운데 **`prepared_at` 이 있거나, 아직 도는 예약**(`running` 이고 `reading_run_timeout()` 안 —
--    풀이권의 「잡고 있는 자리」와 같은 금, `reading_credits_used`). 도는 예약은 곧 제출될 수 있어 센다. 제출 전에 끝난
--    것만 빠진다.
-- 3. 이 마이그레이션 전의 시도는 모두 `prepared_at = created_at` 으로 채운다 — 옛 셈과 같게 센다(덜 세는 쪽으로 기울지 않는다).
--
-- 남는 것 — 도는 예약은 여전히 센다. 계정 하나가 동시에 잡는 예약은 풀이권 잔액 · 대상마다 하나 · 시간당 20 에 묶인다.
--
-- 서명은 그대로다. 몸은 운영의 살아 있는 정의에서 떴다(2026-10-22). 문은 시도 행을 먼저 잠근다 — 닫는 쪽과 같은 차례다.
--
-- 앱 한 줄 — 문이 거짓을 내면(시도가 이미 닫힘 · 작업이 이미 지나감) 제출하지 않는다(`app/me/reading/pipeline.ts` 의 `submitFrozen`).
-- 전에는 반환값을 버리고 보냈다 — 그 시도는 표시가 없어 상한에 안 잡힌 채 모델이 돈다. 서명이 그대로라 배포 순서에 안 걸린다.
--
-- 재는 자리는 `supabase/tests/99_reading_budget_counts_what_reached_the_model.test.sql` · `23_reading_budget.test.sql`.

alter table public.reading_run add column prepared_at timestamptz;

comment on column public.reading_run.prepared_at is
  '제출 직전 문(prepare_reading_job)을 지난 때 — 모델에 닿았을 수 있다. 하루 상한(reading_spend_today)은 이것이 있거나 아직 도는 예약만 센다 (ADR 0198).';

-- 상태는 안 바뀌므로 상태를 보는 트리거(`tell_match_reading_settled` · 작업 닫기)는 아무것도 안 보낸다
update public.reading_run set prepared_at = created_at where prepared_at is null;

CREATE OR REPLACE FUNCTION public.reading_spend_today()
 RETURNS integer
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
  select count(*)::integer
  from public.reading_run r
  where r.created_at >= (date_trunc('day', now() at time zone 'Asia/Seoul') at time zone 'Asia/Seoul')
    and (
      r.prepared_at is not null
      or (r.status = 'running' and r.created_at > now() - public.reading_run_timeout())
    );
$function$;

CREATE OR REPLACE FUNCTION public.prepare_reading_job(p_run_id uuid, p_prompt text, p_evidence text, p_prompt_version text, p_requested_model text, p_generation jsonb, p_viewed_at timestamp with time zone, p_score_baseline smallint DEFAULT NULL::smallint, p_score_version text DEFAULT NULL::text, p_score_relation text DEFAULT NULL::text)
 RETURNS boolean
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
begin
  /*
    시도 행을 먼저 잠근다 — 닫는 쪽(`fail_reading_job` · 만료)은 시도 행 → (트리거로) 작업 행 차례다. 이 문이 작업 행 → 시도 행
    차례로 잡으면 둘이 엇갈려 교착할 수 있다. 같은 차례로 맞춘다.
  */
  perform 1 from public.reading_run r where r.id = p_run_id for update;

  update public.reading_job j
  set prompt = p_prompt,
      evidence = p_evidence,
      prompt_version = p_prompt_version,
      requested_model = p_requested_model,
      generation = coalesce(p_generation, '{}'::jsonb),
      viewed_at = p_viewed_at,
      score_baseline = p_score_baseline,
      score_version = p_score_version,
      score_relation = p_score_relation,
      status = 'submitting'
  where j.run_id = p_run_id
    and j.status in ('frozen', 'preparing')
    and exists (
      select 1 from public.reading_run r where r.id = j.run_id and r.status = 'running');

  if not found then
    return false;
  end if;

  /* 이 문 뒤에서만 모델에 보낸다 — 하루 상한이 이 표시를 센다(ADR 0198) */
  update public.reading_run r
  set prepared_at = coalesce(r.prepared_at, now())
  where r.id = p_run_id;

  return true;
end;
$function$;

/**
 * 지출 표 — **끝에 칸 하나를 더한다**(`budget_counted`). 앞 칸은 `20261003090000` 그대로다(`create or replace view` 는 끝에만
 * 붙인다). `attempts` 는 여전히 연 시도 전부이고, 하루 상한이 보는 수는 이제 `budget_counted` 다 — 오늘 줄의 그 칸이
 * `reading_spend_today()` 와 같다.
 */
create or replace view public.reading_spend_daily as
select
  (r.created_at at time zone 'Asia/Seoul')::date as day,
  r.kind,
  count(*)::integer as attempts,
  count(*) filter (where r.status = 'succeeded')::integer as succeeded,
  count(*) filter (where r.status = 'failed')::integer as failed,
  count(*) filter (where r.usage is null)::integer as usage_unknown,
  sum((r.usage ->> 'inputTokens')::bigint) as input_tokens,
  sum((r.usage ->> 'outputTokens')::bigint) as output_tokens,
  sum((r.usage ->> 'totalTokens')::bigint) as total_tokens,
  count(*) filter (where v.user_id is not null)::integer as verification_attempts,
  count(*) filter (where v.user_id is not null and r.status = 'succeeded')::integer
    as verification_succeeded,
  count(*) filter (where v.user_id is not null and r.status = 'failed')::integer
    as verification_failed,
  sum((r.usage ->> 'totalTokens')::bigint) filter (where v.user_id is not null)
    as verification_total_tokens,
  count(*) filter (
    where r.prepared_at is not null
       or (r.status = 'running' and r.created_at > now() - public.reading_run_timeout()))::integer
    as budget_counted
from public.reading_run r
left join public.verification_account v on v.user_id = r.user_id
group by 1, 2;

revoke all on public.reading_spend_daily from anon, authenticated;
