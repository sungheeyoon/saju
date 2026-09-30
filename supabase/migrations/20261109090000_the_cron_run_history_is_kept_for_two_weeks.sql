-- 크론 실행 이력은 14일만 남긴다 (ADR 0138)
--
-- **운영자 결정(2026-09-30): 크론 실행 이력만 14일로 지운다. 알림(`notification`) · 노출 기록(`discovery_impression`)은
-- 지우지 않는다 — 공개 출시 전에 법무 · 안전 정책과 함께 다시 정한다**(간극 대장 G-67).
--
-- ## 잰 것 (2026-09-30)
--
-- 운영(집계만, `db:remote`): `cron.job_run_details` **30,160줄 5 MB**(2026-09-10 부터 — 하루 약 1,500줄, 대부분 매분
-- 도는 복구기). 지우는 자리가 없었다(밤샘 감사 DB 11). 읽는 자리는 감시기(`watch_cron`, 지난 한 시간)와 runbook 의 점검
-- 질의(24시간)뿐이다. 사람이 아니라 잡의 기록이다.
--
-- 매일 한 번(04:37 UTC — 다른 잡과 안 겹친다), 여러 번 돌아도 안전하다. 실패는 `cron-watch` 가
-- `cron-failed:cron-run-retention-purge` 로 알린다.
--
-- 재는 자리는 `supabase/tests/76_cron_run_retention.test.sql`.

/** 크론 실행 이력을 남기는 기간 — 운영자 결정(2026-09-30, ADR 0138) */
create function retention.cron_run_period()
returns interval
language sql
immutable
set search_path = ''
as $$ select interval '14 days' $$;

/**
 * 기간이 지난 크론 실행 이력을 지운다.
 *
 * @returns 이번에 지운 수
 */
create function retention.purge_old_cron_runs()
returns integer
language plpgsql
set search_path = ''
as $$
declare
  gone integer;
begin
  with purged as (
    delete from cron.job_run_details d
    where coalesce(d.end_time, d.start_time) < now() - retention.cron_run_period()
    returning 1
  )
  select count(*)::integer into gone from purged;
  return gone;
end;
$$;

revoke execute on all functions in schema retention from public, anon, authenticated, service_role;

/** 이름으로 지우고 다시 건다 — 두 번 돌려도 일정이 하나다. 매일 04:37 UTC — 다른 잡(04:53 · 매시 7 · 23 · 47분 · 10분마다 · 매분)과 안 겹친다 */
select cron.unschedule('cron-run-retention-purge')
where exists (select 1 from cron.job where jobname = 'cron-run-retention-purge');

select cron.schedule('cron-run-retention-purge', '37 4 * * *', 'select retention.purge_old_cron_runs()');
