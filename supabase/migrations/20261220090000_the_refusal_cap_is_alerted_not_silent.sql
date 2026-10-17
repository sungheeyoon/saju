-- 거절된 운영자 쓰기의 시간당 빗장에 닿으면 조용히 끝나지 않고 장애 알림을 하루 한 번 보낸다 (G-111 R-4, ADR 0191)
--
-- `note_operator_refusal`(`20261219090000`)은 한 사람이 한 시간에 서른 줄을 적으면 그 뒤를 **조용히** 버렸다 — 버린 줄이 있다는
-- 것조차 남지 않았다. 몸은 그 판 그대로이고, 빗장에 닿은 자리에서 `notify_ops` 한 줄을 보낸 뒤 끝나는 것만 다르다:
--
-- - 종류 `operator-refusal-cap:<운영자 id>` — `ops_alert` 의 `(kind, day)` 로 **한 운영자에 하루 한 번**이다. 같은 날 다시 닿아도
--   새 줄이 서지 않는다.
-- - 내용은 운영자 id 와 수(한 시간 빗장 30)뿐이다 — 동작 · 대상 · 코드는 싣지 않는다.
-- - 버린 줄은 여전히 버린다(접속기록에 서지 않는다). 알림은 「버리기 시작했다」를 말할 뿐이다.
--
-- 재는 자리는 `supabase/tests/99_operator_write_refusals.test.sql` 「한 시간에 서른 줄」.

/**
 * 운영자의 쓰기가 거절됐다고 한 줄 적는다 — 앱의 쓰기 액션이 거절을 받은 뒤 부른다. 거절한 트랜잭션의 기록은 되감기므로 따로다.
 *
 * 운영자가 아니면 아무것도 안 적는다(그 거절은 `note_operator_denial` 이 `denied` 로 적는다). 대상은 id 만 — 신고는 신고 id 칸,
 * 계정 · 주문은 거른 조건 칸(`user=<id>` · `order=<id>`)이고, 끝에 `refused=<SQLSTATE>`(모르는 코드면 `other`). 메모 · 판단 근거 ·
 * 오류 문장은 받지 않는다. 한 사람이 한 시간에 서른 줄을 넘게 적지 못한다 — 넘으면 그 줄은 버리고 장애 알림
 * `operator-refusal-cap:<운영자 id>` 를 하루 한 번 보낸다(운영자 id 와 수만).
 *
 * @param p_code 거절의 SQLSTATE(`55000` · `23514` · `22023` · `P0002` …) 또는 `other`
 */
create or replace function public.note_operator_refusal(
  p_action text,
  p_code text,
  p_report_id uuid default null,
  p_user_id uuid default null,
  p_order_id uuid default null)
returns void
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  actor uuid := (select auth.uid());
begin
  if actor is null or not public.is_operator() then
    return;
  end if;

  if p_action is null
     or p_action not in ('reports.review', 'members.suspend', 'members.unsuspend', 'credits.grant', 'credits.revoke',
                         'credits.refund_hold', 'credits.refund_book', 'credits.refund_release') then
    raise exception 'operator: unknown write' using errcode = '22023';
  end if;

  if p_code is null or p_code !~ '^([0-9A-Z]{5}|other)$' or p_code = '42501' then
    raise exception 'operator: a refusal code is a SQLSTATE other than 42501' using errcode = '22023';
  end if;

  perform pg_advisory_xact_lock(hashtextextended('audit:refusal:' || actor::text, 0));

  if (select count(*) from audit.operator_access a
      where a.actor_user_id = actor and a.outcome = 'refused'
        and a.at > clock_timestamp() - interval '1 hour') >= 30 then
    -- 버린다는 것을 알린다 — `(kind, day)` 라 같은 운영자는 하루 한 번
    perform public.notify_ops(
      'operator-refusal-cap:' || actor::text,
      format('운영자 %s 의 거절된 쓰기 기록이 한 시간 %s줄에 닿아 그 뒤를 접속기록에 적지 않는다', actor, 30));
    return;
  end if;

  perform audit.note_app_access(
    p_action, p_report_id,
    concat_ws(' ', 'user=' || p_user_id::text, 'order=' || p_order_id::text, 'refused=' || p_code),
    'refused');
end;
$$;

revoke execute on function public.note_operator_refusal(text, text, uuid, uuid, uuid) from anon, public, service_role;
grant execute on function public.note_operator_refusal(text, text, uuid, uuid, uuid) to authenticated;
