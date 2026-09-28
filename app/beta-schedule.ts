import type { SupabaseClient } from '@supabase/supabase-js';

import { scheduleOf, type BetaSchedule } from '@/src/lib/consent';
import type { Database } from '@/src/lib/db';

import { read, unread, type SkippableRead } from './db-error';

/**
 * **지금 베타 일정을 읽는 문** — 관문(`proxy.ts`)과 세 화면(`/signup` · `/privacy` · `/closed`)이
 * 같은 문을 지난다.
 *
 * 2026-09-25 까지는 `src/lib/consent` 가 부를 문을 콜백으로 받아 이름(`current_beta_schedule`)과
 * snake_case 를 직접 들었고, 세 화면은 그 콜백을 넘기려고 `.rpc()` 를 `.tsx` 안에 적었다.
 * 이제 이름과 모양은 여기서 한 번 옮기고, lib 은 옮겨진 줄에 규칙 하나만 건다(`scheduleOf`).
 *
 * 클라이언트를 **받기만** 한다. 관문은 요청의 쿠키로 만든 것을, 화면은 `supabaseOnServer()` 를
 * 넘긴다 — 여기서 서버 클라이언트를 들면 관문이 `next/headers` 를 끌고 간다.
 *
 * 로그인 없이도 읽힌다 — 처리방침은 초대 메일에 실리므로 그래야 한다. 내주는 것은
 * 날짜 둘뿐이고 그 둘은 처리방침이 이미 공개하는 값이다.
 *
 * @returns 못 읽었으면 `{ ok: false }` — 까닭은 사용자에게 보일 말로 옮겨 싣고 원문은 기록에 남긴다.
 *   읽었는데 줄이 없거나 운영자 칸이 비었으면 `{ ok: true, value: null }`.
 *
 *   **못 읽은 것과 없는 것을 가른다**(ADR 0078). 한 `null` 로 합쳤을 때는 관문이 그 `null` 을
 *   「일정 없음」으로 읽어, 이 문 한 번이 실패하면 가입을 마친 사람 전원의 `/me` 아래 요청이
 *   `/signup` 으로 튕겼다. 관문은 못 읽었으면 아무 데도 안 보내고(계정을 못 읽었을 때와 같다),
 *   화면은 폼이나 전문 대신 그 까닭을 세운다.
 */
export async function currentSchedule(
  client: SupabaseClient<Database>,
): Promise<SkippableRead<BetaSchedule | null>> {
  const { data, error } = await client.rpc('current_beta_schedule');
  if (error) return unread(error, 'current_beta_schedule');

  const row = (data ?? [])[0];
  if (row === undefined) return read(null);

  return read(
    scheduleOf({
      scheduleId: row.schedule_id,
      endsOn: row.ends_on,
      purgeBy: row.purge_by,
      purgeWithinDays: row.purge_within_days,
      operatorName: row.operator_name,
      operatorOfficer: row.operator_officer,
      operatorContact: row.operator_contact,
    }),
  );
}
