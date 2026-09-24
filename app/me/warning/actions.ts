'use server';

import { supabaseOnServer } from '../../auth/server-client';
import { userFacingDbMessage } from '../../db-error';
import { refresh } from '../../refresh';
import type { SaveResult } from '../../save-result';

/**
 * 「확인했습니다」 — 그 경고에 확인한 시각을 적는다(ADR 0108).
 *
 * 문이 `false` 를 내는 것(이미 확인했거나 내 번호가 아니다)도 성공으로 읽는다 — 어느 쪽이든 이 안내는 다시 안 서야 하고,
 * 둘을 가르는 것은 남의 번호가 있는지를 알려 주는 일이다. 실패는 DB 가 못 받은 것뿐이다.
 */
export async function acknowledgeWarning(ref: string): Promise<SaveResult> {
  const supabase = await supabaseOnServer();
  const { error } = await supabase.rpc('acknowledge_warning', { p_ref: ref });
  if (error) return { ok: false, message: userFacingDbMessage(error, 'acknowledge_warning') };

  refresh('warning-acknowledged');
  return { ok: true };
}
