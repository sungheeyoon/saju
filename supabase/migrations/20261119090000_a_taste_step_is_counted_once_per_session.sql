-- 로그인 전 맛보기의 퍼널 단계를 **세션당 한 번만** 센다 — 넓히기 (ADR 0143 의 8, `20261118090000` 위에)
--
-- `20261118090000` 의 `count_taste_step(p_step)` 은 날짜와 단계만 받아 부를 때마다 하나를 더한다. 읽기 전용 검토
-- (2026-10-03)가 두 가지를 쟀다.
--
-- 1. **같은 사람이 여러 번 센다.** 「더보기」 · 가입 시작을 누를 때마다, 쿠키를 지운 브라우저가 귀속을 다시 할 때마다
--    하나씩 늘어 퍼널이 사람 수가 아니라 누름 수가 된다. 그리고 이 문은 세션을 안 받으므로 서버 액션을 직접 두드리면
--    아무 세션 없이도 센다.
-- 2. **`signup_completed` 의 뜻이 「귀속 성공」으로 좁았다.** 앱은 귀속이 `claimed` 일 때만 셌다 — 가입을 마치고 돌아왔는데
--    입력을 바꿔 지문이 다르면(`discarded`) 가입 완료로 안 셌다.
--
-- 조율자가 정한 뜻(2026-10-03):
--
-- - 앱이 세는 단계(`more_clicked` · `signup_started` · `signup_completed`)는 **세션 하나에 단계 하나씩 한 번**이다. 세션 id 와
--   서버가 지은 브라우저 HMAC 이 함께 맞아야 센다 — `taste_session_view` 와 같은 열쇠다.
-- - `signup_completed` 는 **가입을 마친 뒤 그 세션을 들고 돌아온 것**이다 — 귀속의 결과가 `claimed` · `discarded` ·
--   `expired` · `not_ready` 어느 것이든 센다(`not_found` · `taken` 은 이 브라우저의 세션이 아니라서 안 센다). 그 가름은 앱이
--   한다 — 이 문은 세션 · HMAC 이 맞는지와 한 번인지만 본다.
-- - `reading_succeeded` 는 여기서 안 받는다 — 풀이 회수(webhook · 크론)가 시도 하나에 한 번 저장한 뒤 세고, 그 길에는 브라우저가
--   없다. 그대로 옛 `count_taste_step` 이 센다.
--
-- 옛 `count_taste_step` 은 그대로 둔다 — `reading_succeeded` 를 아직 그 문이 세고, 옛 앱은 나머지 셋도 그 문으로 센다(이것만
-- 먼저 올라가도 아무것도 안 바뀐다, ADR 0071). 앱이 셋을 새 문으로 옮긴 뒤 옛 문이 그 셋을 거절하게 좁히는 것은 나중이다.
--
-- ## 세었다는 표 — `taste_session_step`
--
-- (세션, 단계) 한 줄이 「이 세션의 이 단계는 이미 셌다」이다. 개인을 가리키는 칸이 없고(세션 id · 단계 · 시각뿐), 세션이
-- 지워지면 함께 지워진다(`on delete cascade`) — 미귀속 세션은 24시간 정리(`retention.sweep_taste`)가, 귀속된 세션은 탈퇴가
-- 지운다. 보존 기간이 세션과 같아 새 보존 규칙이 없다. 표는 문으로만 만진다.
--
-- 재는 자리는 `supabase/tests/81_taste_step_once.test.sql`.

create table public.taste_session_step (
  session_id uuid not null references public.taste_session (id) on delete cascade,
  step text not null check (step in ('more_clicked', 'signup_started', 'signup_completed')),
  counted_at timestamptz not null default now(),
  primary key (session_id, step)
);

comment on table public.taste_session_step is
  '맛보기 퍼널 단계를 세션마다 한 번 셌다는 표 — 세션 id · 단계 · 시각뿐. 세션과 함께 지워진다. 문으로만 만진다.';

alter table public.taste_session_step enable row level security;

-- 정책을 하나도 안 만든다 — 문으로만 만진다
revoke all on table public.taste_session_step from public, anon, authenticated, service_role;

/**
 * 퍼널의 한 단계를 **세션당 한 번** 오늘의 수에 더한다. 세션 id 와 브라우저 HMAC 이 함께 맞아야 센다 — 없는 세션 · 다른
 * 브라우저 · 이미 센 단계는 아무것도 안 늘린다.
 *
 * 받는 단계는 앱이 브라우저와 함께 보는 셋이다 — `more_clicked`(「더보기」) · `signup_started`(가입으로 가는 누름) ·
 * `signup_completed`(가입을 마치고 그 세션을 들고 돌아옴). 어느 귀속 결과를 「돌아옴」으로 볼지는 앱이 가른다.
 *
 * @returns 이번에 셌는가
 * @throws 22023 모르는 단계 · 모양이 틀린 브라우저 HMAC · 세션 id 없음
 */
create function public.count_taste_step_once(p_session_id uuid, p_browser_hmac text, p_step text)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  counted integer;
begin
  if p_step is null or p_step not in ('more_clicked', 'signup_started', 'signup_completed') then
    raise exception 'taste: step is one of more_clicked, signup_started, signup_completed'
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

revoke execute on function public.count_taste_step_once(uuid, text, text) from public, anon, authenticated, service_role;
grant execute on function public.count_taste_step_once(uuid, text, text) to service_role;
