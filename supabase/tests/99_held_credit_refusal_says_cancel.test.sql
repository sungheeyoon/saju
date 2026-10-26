-- 보낸 요청이 풀이권을 잡아 막힌 풀이의 거절 문장 — 화면 글자는 「취소」 (`20261231090000`, 운영자 결정 2026-10-26)
--
-- 앱은 DB 가 던진 문장을 그대로 화면에 세운다(`app/db-error.ts`). 화면에서 「거두다」를 걷었으므로(#839) DB 문장도 따른다.
-- 살아 있는 정의(`pg_proc.prosrc`)를 센다 — 새 함수가 옛 마이그레이션에서 본문을 베껴 오면 여기서 빨개진다
-- (전례 `94_credit_refusals_count_in_jang`).
begin;
select plan(2);

select is(
  (select count(*)::int
     from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.prosrc like '%요청을 거두거나%'),
  0,
  '1. 「요청을 거두거나」를 던지는 함수는 없다');

select is(
  (select array_agg(p.proname::text order by p.proname)
     from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.prosrc like '%''남은 풀이권이 보낸 인연 요청에 걸려 있어요. 요청을 취소하거나 상대의 답을 기다려 주세요.''%'),
  array['start_reading_run_for'],
  '2. 보낸 요청이 잡은 몫은 「요청을 취소하거나 기다려 달라」고 말한다');

select * from finish();
rollback;
