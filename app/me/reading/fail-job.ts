import type { SupabaseClient } from '@supabase/supabase-js';

import type { Database } from '@/src/lib/db';

import { recordDbFailure } from '../../db-error';
import type { ModelUsage } from './generator';

/** 일감을 실패로 닫는 값 — 쓴 토큰(`usage`)은 떠나보낸 뒤의 실패에만 있고, 모르면 `null` 이다(ADR 0039) */
export type JobFailure = { runId: string; code: string; detail: string; usage: ModelUsage | null };

/**
 * 시도를 **열쇠로** 실패로 닫는다(`fail_reading_job`, ADR 0120). 시도는 `running` 일 때만 닫힌다. 열쇠는 부르는 쪽이
 * 넘긴다 — 이 파일은 열쇠 클라이언트를 부르지 않는다(`KEY_HOLDERS`, ADR 0136).
 *
 * 못 닫아도 기한이 지나면 복구기 · 만료가 닫는다 — 그래서 던지지 않고 원문만 기록에 남긴다(ADR 0078).
 * 기록의 자리는 `<where>: fail_reading_job` 이다.
 */
export async function failReadingJob(keyed: SupabaseClient<Database>, where: string, failure: JobFailure): Promise<void> {
  const { error } = await keyed.rpc('fail_reading_job', {
    p_run_id: failure.runId,
    p_failure_code: failure.code,
    p_failure_detail: failure.detail,
    p_usage: failure.usage,
  });
  if (error) recordDbFailure(error, `${where}: fail_reading_job`);
}
