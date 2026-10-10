-- 로그인 전 사주 문단의 퍼널을 다섯 단계로 줄인다 — 「더보기」(`more_clicked`)를 걷는다 (G-85, ADR 0143 「2026-10-09 덧」)
--
-- 2026-10-09 에 로그인 전 결과의 「더보기」를 걷었고(#565), 운영자가 퍼널을 다섯 단계로 줄이기로 했다(2026-10-10).
-- 퍼널은 `preview_shown` → `signup_started` → `signup_completed` · `session_claimed` → `reading_started` → `reading_succeeded` 다.
--
-- 옛 앱에 안전한가를 쟀다(2026-10-10, `npm run db:remote` 집계 · 저장소의 배포된 코드):
--
-- - **쓰기** — 운영 앱(#565 뒤)의 화면은 `more_clicked` 를 부르지 않는다. 서버 액션 `noteTasteStep` 은 그 글자를 아직 받아
--   `count_taste_step_once` 로 넘기지만 부르는 화면이 없고, 넘어와도 이 문이 22023 으로 거절하면 액션은 기록만 남기고
--   삼킨다(「세지 못해도 누름은 그대로다」). 운영 DB 에 `funnel:more_clicked` 줄과 `more_clicked` 단계 줄은 **한 번도 없다**(0 · 0).
-- - **읽기** — 앱은 `taste_daily` 를 안 읽는다. 사람이 `db:remote` 로만 본다(뷰는 `service_role` 에도 닫혀 있다).
-- - **인자** — 두 문의 서명은 그대로다(`p_step text`). 받는 값만 좁힌다(`docs/ops/runbook/deploy.md` 「규약 넷」 3 의 위험은 인자다).
--
-- 그래서 넓히기 → 앱 → 좁히기를 한 번에 둔다. 정의는 운영의 살아 있는 정의와 해시가 같은 것을 확인한 `20261118090000` ·
-- `20261119090000` 에서 떴다 — 바꾼 것은 단계 목록뿐이다.

-- 1. 세었다는 표 — 단계는 둘
alter table public.taste_session_step drop constraint taste_session_step_step_check;
alter table public.taste_session_step add constraint taste_session_step_step_check
  check (step in ('signup_started', 'signup_completed'));

-- 2. 세션당 한 번 세는 문 — 받는 단계는 둘
/**
 * 퍼널의 한 단계를 **세션당 한 번** 오늘의 수에 더한다. 세션 id 와 브라우저 HMAC 이 함께 맞아야 센다 — 없는 세션 · 다른
 * 브라우저 · 이미 센 단계는 아무것도 안 늘린다.
 *
 * 받는 단계는 앱이 브라우저와 함께 보는 둘이다 — `signup_started`(가입으로 가는 누름) · `signup_completed`(가입을 마치고 그
 * 세션을 들고 돌아옴). 어느 귀속 결과를 「돌아옴」으로 볼지는 앱이 가른다. `more_clicked` 는 G-85 가 걷었다.
 *
 * @returns 이번에 셌는가
 * @throws 22023 모르는 단계 · 모양이 틀린 브라우저 HMAC · 세션 id 없음
 */
create or replace function public.count_taste_step_once(p_session_id uuid, p_browser_hmac text, p_step text)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  counted integer;
begin
  if p_step is null or p_step not in ('signup_started', 'signup_completed') then
    raise exception 'taste: step is one of signup_started, signup_completed'
      using errcode = '22023';
  end if;

  if p_session_id is null or not public.taste_is_hex64(p_browser_hmac) then
    raise exception 'taste: session and browser hmac are required' using errcode = '22023';
  end if;

  /* 세션 · HMAC 이 맞는 행이 있을 때만 표를 세운다 — 같은 (세션, 단계)는 두 번째부터 아무것도 안 넣는다 */
  with marked as (
    insert into public.taste_session_step (session_id, step)
    select s.id, p_step
    from public.taste_session s
    where s.id = p_session_id and s.browser_hmac = p_browser_hmac
    on conflict (session_id, step) do nothing
    returning 1
  )
  select count(*)::integer into counted from marked;

  if counted = 0 then
    return false;
  end if;

  perform public.taste_tally('funnel:' || p_step);
  return true;
end;
$$;

-- 3. 날짜와 단계만 세는 옛 문 — `more_clicked` 를 뺀다(회수가 `reading_succeeded` 를 센다)
/**
 * 퍼널의 한 단계를 오늘의 수에 하나 더한다 — **앱이 보는 단계만** 받는다. 날짜와 단계뿐이고 누구인지는 안 받는다.
 *
 * - `signup_started` — 가입을 시작했다
 * - `signup_completed` — 가입을 마쳤다
 * - `reading_succeeded` — 이어 쓴 전체 풀이가 성공했다
 *
 * DB 가 스스로 세는 단계는 안 받는다 — 두 번 세지 않게. `preview_shown`(세션이 글을 처음 받음) · `session_claimed`(귀속) ·
 * `reading_started`(풀이 시도에 이음). `more_clicked` 는 G-85 가 걷었다.
 *
 * @throws 22023 모르는 단계
 */
create or replace function public.count_taste_step(p_step text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if p_step is null or p_step not in ('signup_started', 'signup_completed', 'reading_succeeded') then
    raise exception 'taste: step is one of signup_started, signup_completed, reading_succeeded'
      using errcode = '22023';
  end if;

  perform public.taste_tally('funnel:' || p_step);
end;
$$;

-- 4. 날짜별 한 줄 — `more_clicked` 칸을 뺀다. 칸을 빼는 것은 `create or replace view` 가 못 하므로 다시 세운다
drop view public.taste_daily;

/**
 * 맛보기의 날짜별 한 줄 — 운영자가 `select * from public.taste_daily order by day desc` 한 줄로 본다. 개인이 없다.
 *
 * 비용은 토큰까지다 — 금액은 단가를 아는 앱 · runbook 이 곱한다. 응답 시간 평균은 결과가 온 호출(늦게 온 것 포함)의 평균이다.
 */
create view public.taste_daily with (security_invoker = true) as
select
  c.day,
  coalesce(max(c.value) filter (where c.metric = 'model_calls'), 0) as model_calls,
  coalesce(max(c.value) filter (where c.metric = 'reserve:call_model'), 0) as call_model,
  coalesce(max(c.value) filter (where c.metric = 'reserve:reuse_succeeded'), 0) as reuse_succeeded,
  coalesce(max(c.value) filter (where c.metric = 'reserve:wait_running'), 0) as wait_running,
  coalesce(max(c.value) filter (where c.metric = 'reserve:retries_exhausted'), 0) as retries_exhausted,
  coalesce(max(c.value) filter (where c.metric = 'reserve:limited_request'), 0) as limited_request,
  coalesce(max(c.value) filter (where c.metric = 'reserve:limited_browser'), 0) as limited_browser,
  coalesce(max(c.value) filter (where c.metric = 'reserve:limited_ip'), 0) as limited_ip,
  coalesce(max(c.value) filter (where c.metric = 'reserve:limited_global'), 0) as limited_global,
  coalesce(max(c.value) filter (where c.metric = 'call:succeeded'), 0) as calls_succeeded,
  coalesce(max(c.value) filter (where c.metric = 'call:failed'), 0) as calls_failed,
  coalesce(max(c.value) filter (where c.metric = 'call:timeout'), 0) as calls_timed_out,
  coalesce(max(c.value) filter (where c.metric = 'call:late'), 0) as calls_late,
  coalesce(max(c.value) filter (where c.metric = 'tokens:input'), 0) as input_tokens,
  coalesce(max(c.value) filter (where c.metric = 'tokens:cache_read'), 0) as cache_read_tokens,
  coalesce(max(c.value) filter (where c.metric = 'tokens:cache_write'), 0) as cache_write_tokens,
  coalesce(max(c.value) filter (where c.metric = 'tokens:output'), 0) as output_tokens,
  coalesce(max(c.value) filter (where c.metric = 'tokens:reasoning'), 0) as reasoning_tokens,
  round(max(c.value) filter (where c.metric = 'ms:sum')::numeric
        / nullif(max(c.value) filter (where c.metric = 'ms:count'), 0)) as avg_response_ms,
  max(c.value) filter (where c.metric = 'ms:max') as max_response_ms,
  coalesce(max(c.value) filter (where c.metric = 'funnel:preview_shown'), 0) as preview_shown,
  coalesce(max(c.value) filter (where c.metric = 'funnel:signup_started'), 0) as signup_started,
  coalesce(max(c.value) filter (where c.metric = 'funnel:signup_completed'), 0) as signup_completed,
  coalesce(max(c.value) filter (where c.metric = 'funnel:session_claimed'), 0) as session_claimed,
  coalesce(max(c.value) filter (where c.metric = 'funnel:reading_started'), 0) as reading_started,
  coalesce(max(c.value) filter (where c.metric = 'funnel:reading_succeeded'), 0) as reading_succeeded
from public.taste_daily_count c
group by c.day;

comment on view public.taste_daily is
  '맛보기의 날짜별 수 — 예산 · 갈래 · 실패 · 토큰 · 응답 시간 · 퍼널. 개인 없음. 금액은 단가를 곱해 따로 낸다.';

revoke all on public.taste_daily from public, anon, authenticated, service_role;
