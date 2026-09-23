-- Supabase 보안 advisor 가 운영에서 낸 경고에 답한다 (G-23 ⑪)
--
-- 2026-09-24 에 운영(`xgdeguyxgkillndraonc`)의 security advisor 를 불렀다 — WARN 87 · INFO 26.
-- 경고 열아홉(함수 열여덟)을 여기서 고치고, 남는 것은 까닭과 함께 runbook 「보안 advisor」에 적는다.
--
-- 1. **`search_path` 가 안 걸린 상수 함수 열다섯**(lint 0011). 전부 `language sql immutable` 로 수 하나를
--    내는 함수라 이름을 부르지 않는다 — 그래도 걸어 두면 advisor 가 조용해지고, 앞으로 여기에 이름을
--    부르는 몸이 들어와도 부르는 사람의 스키마를 따르지 않는다. 몸은 그대로다(`alter function`).
--    `create or replace` 로 다시 적으면 설정이 풀리므로 pgTAP `44_advisor_lints` 가 이름으로 잡는다.
--
-- 2. **아무도 밖에서 안 부르는 definer 셋의 문을 닫는다**(lint 0028 · 0029). 셋 다 다른 definer 안에서만
--    불리고(그 안에서는 소유자 권한이라 grant 가 필요 없다), 정책 · invoker 함수 · 앱은 안 부른다
--    — 로컬에서 `pg_policies` · `pg_proc.prosrc` 와 저장소를 다 뒤져 쟀다.
--    - `claimed_by(target_person)` — 아무 Person 의 id 를 넣으면 claim 한 계정이 나온다. 신탁이다.
--    - `may_edit_person_input(target_person, actor)` — `actor` 를 부르는 사람이 고른다. 남의 편집권을 묻는
--      신탁이다. 규칙은 여전히 한 자리(이 함수)에 있고, 부르는 두 RPC 는 definer 라 그대로 돈다.
--    - `beta_is_over()` — 로그인 앞의 화면은 `current_beta_schedule()` 을 읽는다. 이 함수는 가입 · 풀이 ·
--      설문 · `is_active_account` 안에서만 불린다.

alter function public.reading_rate_limit() set search_path = '';
alter function public.reading_run_timeout() set search_path = '';
alter function public.reading_job_deadline() set search_path = '';
alter function public.reading_job_prepare_deadline() set search_path = '';
alter function public.reading_credit_limit() set search_path = '';
alter function public.person_limit() set search_path = '';
alter function public.match_request_ttl() set search_path = '';
alter function public.chat_rate_limit() set search_path = '';
alter function public.chat_rate_window() set search_path = '';
alter function public.chat_message_max_length() set search_path = '';
alter function public.chat_snapshot_context() set search_path = '';
alter function public.chat_retention() set search_path = '';
alter function public.presence_now_window() set search_path = '';
alter function public.presence_write_window() set search_path = '';
alter function public.presence_day_window() set search_path = '';

revoke execute on function public.claimed_by(uuid) from anon, public, authenticated;
revoke execute on function public.may_edit_person_input(uuid, uuid) from anon, public, authenticated;
revoke execute on function public.beta_is_over() from anon, public, authenticated;
