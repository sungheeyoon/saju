-- 요청 만료가 1분 안에 상대 화면에 선다 — 크론 `match-request-expiry` 를 매시 7분에서 1분마다로 (ADR 0155)
--
-- 앱은 계정마다 비공개 채널 하나로 「바뀌었다」를 듣고(`20261120090000_the_app_hears_what_changed_on_one_private_channel.sql`),
-- 요청의 만료도 `match_request` 의 update 트리거가 알린다. 다만 만료를 적는 것이 이 크론이라 한 시간에 한 번이면
-- `expires_at` 이 지나고 최대 한 시간 동안 아무 이벤트도 없다. 1분마다 돌려 그 늦음을 1분 안으로 줄인다.
--
-- ## 1분마다 돌아도 싼가 (2026-10-08, 로컬에서 잼)
--
-- - **색인** — `expire_match_requests()` 의 찾기는 `status = 'pending' and expires_at <= now()` 이고, 부분 색인
--   `match_request_pending_expiry (expires_at) where status = 'pending'` 이 그대로 받는다. 대기 중인 요청만 든 색인이라
--   표가 커져도 찾기는 그 몇 줄이다.
-- - **쓰기 없음** — 접을 것이 없으면 `update` 가 0행이고 `notification` 의 `insert` 도 0행이다. `updated_at` 같은 것을
--   덮어쓰는 자리가 없어 함수는 고치지 않는다. 문장 트리거(`for each statement`)는 0행에도 불리지만 전이 표가 비어
--   `tell_changed` 를 한 번도 안 부른다 — 빈 이벤트가 매분 나지 않는다. 시험 `82_live_channel` 이 잰다.
-- - **잠금** — 0행 `update` 가 잡는 것은 표의 `RowExclusiveLock` 뿐이라 요청 · 수락 · 거절의 쓰기와 서로 막지 않는다.
-- - **크론 실패 알림** — `watch_cron()`(`20261005090000_the_cron_that_fails_is_told.sql`)은 이름을 적어 두지 않고 `cron.job` 에
--   등록된 잡 **전부**를 `jobid` 로 이어 본다. 다시 걸어 `jobid` 가 바뀌어도 새 잡을 그대로 본다.
-- - **기록** — `cron.job_run_details` 에 하루 1440줄이 더 쌓인다. 2주 지난 것은 `cron-run-retention-purge` 가 걷는다
--   (`20261109090000_the_cron_run_history_is_kept_for_two_weeks.sql`). `reading-recovery` 가 이미 1분마다다.
--
-- 이름으로 지우고 다시 건다 — 두 번 돌려도 일정이 둘이 되지 않게(`20260907210000_the_credit_is_reserved_at_the_request.sql` 와 같다).

select cron.unschedule('match-request-expiry')
where exists (select 1 from cron.job where jobname = 'match-request-expiry');

select cron.schedule('match-request-expiry', '* * * * *', 'select public.expire_match_requests()');
