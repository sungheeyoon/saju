-- 처리자와 연락처를 정한다 — **이 값이 없어 안내가 안 서고 있었다**
--
-- 종료일은 정했지만 처리방침에 「누구에게 무엇을 요구하나」가 없었다. 열람·정정·삭제·
-- 처리정지를 적어 두고 닿을 곳이 없으면 그 문장들은 지키는 것이 없다.
--
-- **연락처는 이메일 하나다.** 법이 요구하는 것은 실제로 닿는 창구이고 이메일 하나면
-- 그 요건을 채운다. `/privacy` 는 로그인 없이 열려 검색엔진도 읽으므로, 굳이 더 실을
-- 이유가 없는 값은 안 싣는다 — 한 번 색인되면 되돌리기 어렵다.
--
-- 새 줄이므로 **이미 확인한 사람은 안내를 다시 본다**(`notice_schedule_id`). 처리방침
-- 본문이 크게 바뀌었으니 그것이 맞다.
--
-- 옮기려면 새 줄을 넣는다(runbook 「테스트 시작하기」). 이 파일은 첫 값을 남길 뿐이다.
insert into public.beta_schedule (
  ends_on, purge_within_days, note,
  operator_name, operator_officer, operator_contact)
select
  '2026-10-31'::date, 30, '고정 종료일 — 초대 시점과 무관하다',
  '성희윤', '성희윤', 'torushy@gmail.com'
where not exists (
  select 1 from public.beta_schedule where operator_contact is not null
);
