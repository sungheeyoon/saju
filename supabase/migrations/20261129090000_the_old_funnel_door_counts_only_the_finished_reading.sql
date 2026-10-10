-- 옛 퍼널 문 `count_taste_step(p_step)` 이 `reading_succeeded` 하나만 받는다 — 좁히기 (G-91, ADR 0143 · ADR 0071)
--
-- `20261119090000` 이 가입 시작 · 가입 완료를 세션당 한 번 세는 문 `count_taste_step_once` 를 세우면서 옛 문이 그 둘을
-- 거절하게 좁히는 것을 「앱이 옮긴 뒤 나중」으로 남겼다(넓히기). `20261128090000` 은 `more_clicked` 만 뺐다. 앱은 #443
-- (`48acc882`, 2026-10-02)부터 그 둘을 새 문으로 세고, 옛 문에는 회수(webhook · 크론)가 `reading_succeeded` 만 넘긴다
-- (`app/me/reading/collect.ts` → `app/keyed-taste.ts` `countTasteStep`, 받는 꼴이 `TasteStep = 'reading_succeeded'` 하나다).
--
-- 좁혀도 되는 근거는 잰 값이다(2026-10-10, `npm run db:remote` 집계 — 개수 · 단계만, 행 내용 없음):
--
-- - `pg_stat_statements`(마지막 초기화 2026-10-04 19:16 서울, 축출 `dealloc` 0)에 옛 문이든 새 문이든 **부르는 문이 한
--   줄도 없다** — 잡힌 것은 마이그레이션의 `create` · `revoke` 뿐이다. 같은 집계에서 PostgREST 의 다른 호출은 잡힌다
--   (G-77 의 `20261127090000` 이 같은 길로 쟀다).
-- - 날짜별 카운터 `taste_daily_count` 의 `funnel:*` 은 2026-10-03 의 `funnel:preview_shown` 2 하나뿐이다 —
--   `funnel:signup_started` · `funnel:signup_completed` 는 **어느 날에도 없다**(0 · 0). 옛 문이 그 둘을 받았다면 이
--   카운터가 늘었다.
-- - 세션당 단계 표 `taste_session_step` 은 비었다(0).
--
-- 서명(`p_step text` → `void`)은 그대로다 — 받는 값만 좁힌다(`docs/ops/runbook/deploy.md` 「규약 넷」 3 의 위험은 인자다).
-- `create or replace` 라 권한(ACL)도 그대로다. 정의는 `20261128090000` 에서 떴다 — 바꾼 것은 단계 목록과 주석뿐이다.

/**
 * 퍼널의 끝 하나를 오늘의 수에 하나 더한다 — **회수만 부른다.** 날짜와 단계뿐이고 누구인지는 안 받는다.
 *
 * - `reading_succeeded` — 이어 쓴 전체 풀이가 성공했다. 브라우저가 없는 길(webhook · 크론)이 시도 하나에 한 번 저장한 뒤 센다
 *
 * 가입 시작 · 가입 완료(`signup_started` · `signup_completed`)는 세션당 한 번 세는 `count_taste_step_once` 가 받는다(G-91).
 * DB 가 스스로 세는 단계(`preview_shown` · `session_claimed` · `reading_started`)도 안 받는다 — 두 번 세지 않게.
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
  if p_step is null or p_step <> 'reading_succeeded' then
    raise exception 'taste: step is reading_succeeded'
      using errcode = '22023';
  end if;

  perform public.taste_tally('funnel:' || p_step);
end;
$$;
