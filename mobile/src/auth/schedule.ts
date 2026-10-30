import { scheduleOf, type BetaSchedule } from '@consent/schedule';
import { userFacingDbMessage } from '@db-error';

import { supabase } from './client';

export type ScheduleRead = { ok: true; value: BetaSchedule | null } | { ok: false; reason: string };

/**
 * 지금 베타 일정 — 웹의 `app/beta-schedule.ts` 와 같은 문이다. 로그인 없이 읽힌다(처리방침).
 * 못 읽은 것과 없는 것을 가른다(ADR 0078). 연결이 없는 빌드는 일정이 없는 것으로 친다 — 날짜를 지어내지 않는다.
 */
export async function readSchedule(): Promise<ScheduleRead> {
  if (supabase === null) return { ok: true, value: null };

  const { data, error } = await supabase.rpc('current_beta_schedule');
  if (error !== null) return { ok: false, reason: userFacingDbMessage(error, 'current_beta_schedule') };

  const row = (data ?? [])[0];
  if (row === undefined) return { ok: true, value: null };
  return {
    ok: true,
    value: scheduleOf({
      scheduleId: row.schedule_id,
      endsOn: row.ends_on,
      purgeBy: row.purge_by,
      purgeWithinDays: row.purge_within_days,
      operatorName: row.operator_name,
      operatorOfficer: row.operator_officer,
      operatorContact: row.operator_contact,
    }),
  };
}
