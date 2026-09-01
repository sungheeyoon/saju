-- ---------------------------------------------------------------------------
-- 영수증에 「집었다」를 적는다 (ADR 0020)
-- ---------------------------------------------------------------------------

/**
 * `processed_at` 열을 만들고 인덱스까지 걸어 놓고 **채우는 자리를 안 썼다.**
 *
 * 첫 실호출에서 드러났다 — webhook 이 제대로 도착하고 결과도 1초 만에 저장됐는데 영수증은
 * `processed_at: null` 로 남았다. 멱등은 `event_id` PK 가 들고 있어서 재전송은 그대로
 * 막히지만, **「받았는데 못 집은 사건」을 셀 수가 없다.** 그게 이 열이 있는 이유였다.
 *
 * 그리고 시험이 그것을 못 잡았다. 열을 만드는 것과 채우는 것은 다른 일인데, 만든 것만
 * 재고 있었다.
 */
create or replace function public.mark_reading_webhook_processed(p_event_id text)
returns void
language sql
security definer
set search_path = ''
as $$
  update public.reading_webhook_event e
  set processed_at = now()
  where e.event_id = p_event_id and e.processed_at is null;
$$;

revoke execute on function public.mark_reading_webhook_processed(text)
  from anon, public, authenticated;
grant execute on function public.mark_reading_webhook_processed(text) to service_role;

/**
 * **안 적힌 것은 「아직 볼 것이 남았다」다.**
 *
 * 회수가 「아직 도는 중」으로 끝나면 적지 않는다. 그 사건에 대해 할 일이 남아 있기
 * 때문이다. 저장·실패·건너뜀은 그 사건으로 할 수 있는 일이 끝난 것이라 적는다.
 *
 * 다만 **안 적힌 영수증을 훑는 자리는 없다.** 일감은 복구기가 `reading_job` 쪽에서 줍고,
 * 그것으로 충분하다 — 사건과 일감이 같은 것을 두 번 줍게 하면 회수가 두 번 돈다.
 * 여기 안 적힌 것은 **진단용**이다: 이 수가 늘면 `after` 가 자주 죽고 있다는 뜻이다.
 */
