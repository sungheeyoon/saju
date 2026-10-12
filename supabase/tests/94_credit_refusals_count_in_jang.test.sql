-- 풀이권 거절 문장 — 풀이권은 「장」, 풀이의 횟수는 「회」 (`20261209090000`, 운영자 결정 2026-10-12, 문구 대장 all-02)
--
-- 앱은 DB 가 던진 문장을 그대로 화면에 세운다(`app/db-error.ts`). 살아 있는 정의(`pg_proc.prosrc`)를 센다 — 새
-- 함수가 옛 마이그레이션에서 본문을 베껴 오면 여기서 빨개진다. 부르면 무엇이 서는지는 제 시험이 잰다 —
-- 인연 요청은 `10_match_request`, 다 쓴 풀이는 `16_reading_credits`.
--
-- 앞머리(「풀이권을 다 쓰셨습니다」 · 「풀이권이 없어 요청할 수 없습니다」)는 앱이 풀이권 창을 여는 열쇠라 그대로다
-- (`app/me/credits/refusal.ts`) — 셋째 · 넷째 줄이 그것도 함께 잰다.
begin;
select plan(4);

select is(
  (select count(*)::int
     from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.prosrc like '%풀이권 한 번을 잡고%'),
  0,
  '1. 「풀이권 한 번을 잡고」를 던지는 함수는 없다');

select is(
  (select count(*)::int
     from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.prosrc like '%테스트 기간에는 \%번까지%'),
  0,
  '1. 「테스트 기간에는 %번까지」를 던지는 함수는 없다');

select is(
  (select array_agg(p.proname::text order by p.proname)
     from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.prosrc like '%''풀이권이 없어 요청할 수 없습니다. 요청 한 건이 풀이권 한 장을 잡고, 동의가 나면 그 한 장으로 궁합 풀이가 만들어집니다.''%'),
  array['request_match'],
  '2. 인연 요청은 풀이권을 「장」으로 센다');

select is(
  (select array_agg(p.proname::text order by p.proname)
     from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.prosrc like '%''풀이권을 다 쓰셨습니다. 테스트 기간에는 \%회까지 만들 수 있어요.''%'),
  array['start_reading_run_for'],
  '2. 다 쓴 풀이는 만들 수 있는 횟수를 「회」로 센다');

select * from finish();
rollback;
