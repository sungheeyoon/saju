-- 기록 셋은 끝없이 쌓이지 않는다 — 노출 기록 180일 · 소식 90일 · 크론 실행 이력 14일 (ADR 0138, **결정 대기**)
--
-- **이 마이그레이션의 기간은 제안이다.** 보존 기간은 결정 점검표의 「데이터의 보존 · 삭제 · 보관 기간」이라 운영자가
-- 답한 뒤에 머지한다. 기간을 바꾸면 아래 `retention.*_period()` 한 줄씩이다.
--
-- ## 잰 것 (2026-09-30)
--
-- 운영(집계만, `db:remote`): `discovery_impression` 241줄 384 kB(가장 오래된 줄 09-11) · `notification` 10줄 ·
-- `cron.job_run_details` **30,160줄 5 MB**(09-10 부터 — 하루 약 1,500줄, 대부분 매분 도는 복구기). 계정 15.
-- 셋 다 지우는 자리가 없다(밤샘 감사 DB 5 · 7 · 11). 지금 자라는 것은 크론 이력이고, 노출 기록은 사람이 넘길 때마다
-- 한 줄이라 사람 수에 비례해 자란다(로컬 1만 명 풀에서 덱 하나 = 여섯 줄).
--
-- ## 무엇을 지우나
--
-- - **크론 실행 이력 — 14일.** 감시기(`watch_cron`)는 지난 한 시간을, runbook 의 점검 질의는 24시간을 본다. 사람이
--   아니라 잡의 기록이다.
-- - **소식 — 90일.** 종은 최근 50줄만 그린다(ADR 0130 「치르는 값」). 90일이 지난 소식은 그 뒤의 요청 · 풀이로 이미
--   밀려났을 것이 대부분이다 — 소식이 적은 사람에게는 옛 줄이 종에서 사라진다(대가).
-- - **노출 기록 — 180일, 단 지금 덱에 선 카드의 줄은 남긴다.** 노출 기록은 넷이 읽는다:
--   1. `request_match` — **내가 본 그 카드**(지금 요약이 같은 가장 최근 줄)를 찾는다. 덱은 이어지므로 카드가 몇 달 서
--      있을 수 있다 → 지금 덱에 선 사람의 줄은 안 지운다
--   2. `discovery_shown_to_me` — 넘김(`discovery_passed`)의 정책. 넘기는 카드는 덱에 서 있다 → 같다
--   3. `restore_passed_connection` — 되돌리면 새 줄을 적는다. 옛 줄이 없어도 된다
--   4. `report_user` — 「신고할 수 있는 사람」의 근거 하나(내게 선 적이 있다 · 요청이 오갔다 · Match). **180일이 지나고
--      요청 · Match 도 없는 사람은 더는 신고할 수 없다**(대가 — 결정 점검표의 「누가 무엇을 할 수 있는가」에도 걸린다)
--   `match_request.impression_id` 는 `on delete set null` 이다 — 요청은 남고 「어느 카드에서 왔나」만 비는다.
--
-- 매일 한 번(04:37 UTC — 다른 잡과 안 겹친다), 여러 번 돌아도 안전하다. 실패는 `cron-watch` 가
-- `cron-failed:log-retention-purge` 로 알린다. **베타 동안은 종료 뒤 파기(처리방침)가 먼저 온다** — 이 기간은 공개
-- 출시 뒤에 뜻이 있다. 기간을 줄이는 것이라 처리방침의 「베타 종료 후 파기 시점까지」와 어긋나지 않는다.
--
-- 재는 자리는 `supabase/tests/75_log_retention.test.sql`.

/** 노출 기록을 남기는 기간 — 제안(ADR 0138, 결정 대기) */
create function retention.impression_period()
returns interval
language sql
immutable
set search_path = ''
as $$ select interval '180 days' $$;

/** 소식을 남기는 기간 — 제안(ADR 0138, 결정 대기) */
create function retention.notification_period()
returns interval
language sql
immutable
set search_path = ''
as $$ select interval '90 days' $$;

/** 크론 실행 이력을 남기는 기간 — 제안(ADR 0138, 결정 대기) */
create function retention.cron_run_period()
returns interval
language sql
immutable
set search_path = ''
as $$ select interval '14 days' $$;

-- 날짜로 지우는 둘에 시각 색인 — 없으면 매일 표 전체를 훑는다
create index discovery_impression_by_time on public.discovery_impression (shown_at);
create index notification_by_time on public.notification (created_at);

/**
 * 기간이 지난 기록 셋을 지운다. 노출 기록은 **지금 덱에 선 카드의 줄**을 남긴다(머리말).
 *
 * @returns 지운 수 — `{"impression": n, "notification": n, "cron_run": n}`
 */
create function retention.purge_old_logs()
returns jsonb
language plpgsql
set search_path = ''
as $$
declare
  gone_impressions integer;
  gone_notifications integer;
  gone_runs integer;
begin
  with purged as (
    delete from public.discovery_impression i
    where i.shown_at < now() - retention.impression_period()
      and not exists (
        select 1
        from public.discovery_candidate deck
        join public.discovery_candidate_slot seat on seat.snapshot_id = deck.id
        where deck.user_id = i.viewer_user_id
          and seat.candidate_user_id = i.candidate_user_id
      )
    returning 1
  )
  select count(*)::integer into gone_impressions from purged;

  with purged as (
    delete from public.notification n
    where n.created_at < now() - retention.notification_period()
    returning 1
  )
  select count(*)::integer into gone_notifications from purged;

  with purged as (
    delete from cron.job_run_details d
    where coalesce(d.end_time, d.start_time) < now() - retention.cron_run_period()
    returning 1
  )
  select count(*)::integer into gone_runs from purged;

  return jsonb_build_object(
    'impression', gone_impressions, 'notification', gone_notifications, 'cron_run', gone_runs);
end;
$$;

revoke execute on all functions in schema retention from public, anon, authenticated, service_role;

/** 이름으로 지우고 다시 건다 — 두 번 돌려도 일정이 하나다. 매일 04:37 UTC — 다른 잡(04:53 · 매시 7 · 23 · 47분 · 10분마다 · 매분)과 안 겹친다 */
select cron.unschedule('log-retention-purge')
where exists (select 1 from cron.job where jobname = 'log-retention-purge');

select cron.schedule('log-retention-purge', '37 4 * * *', 'select retention.purge_old_logs()');
