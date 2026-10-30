import type { SupabaseClient } from '@supabase/supabase-js';

import type { Database } from '@/src/lib/db';

import { recordDbFailure } from '../../db-error';
import type { ModelUsage } from './generator';

/**
 * 일감을 실패로 닫는 값 — 쓴 토큰(`usage`)은 떠나보낸 뒤의 실패에만 있고, 모르면 `null` 이다(ADR 0039). 회수가 쥔 일감을 닫으면
 * 그 임대 식별자(`leaseId`)를 함께 준다 — 그러면 지금 쥔 작업자일 때만 닫힌다(ADR 0201). 기한 · 제출 뒤 실패는 안 준다.
 */
export type JobFailure = { runId: string; code: string; detail: string; usage: ModelUsage | null; leaseId?: string };

/**
 * 시도를 **열쇠로** 실패로 닫는다(`fail_reading_job`, ADR 0120). 시도는 `running` 일 때만 닫힌다. 열쇠는 부르는 쪽이
 * 넘긴다 — 이 파일은 열쇠 클라이언트를 부르지 않는다(`KEY_HOLDERS`, ADR 0136).
 *
 * 못 닫아도 기한이 지나면 복구기 · 만료가 닫는다 — 그래서 던지지 않고 원문만 기록에 남긴다(ADR 0078).
 * 기록의 자리는 `<where>: fail_reading_job` 이다. 닫았는지(`true`)를 낸다 — 이미 끝났거나 · 남이 쥐었거나 · 못 부른 것은 `false`.
 * `signal` 을 주면 그때 끊는다(회수의 상한, `app/me/reading/lease.ts`).
 */
export async function failReadingJob(
  keyed: SupabaseClient<Database>,
  where: string,
  failure: JobFailure,
  signal?: AbortSignal,
): Promise<boolean> {
  const call = keyed.rpc('fail_reading_job', {
    p_run_id: failure.runId,
    p_failure_code: failure.code,
    p_failure_detail: failure.detail,
    p_usage: failure.usage,
    ...(failure.leaseId === undefined ? {} : { p_lease_id: failure.leaseId }),
  });
  const { data, error } = await (signal === undefined ? call : call.abortSignal(signal));
  if (error) recordDbFailure(error, `${where}: fail_reading_job`);
  return data === true;
}
