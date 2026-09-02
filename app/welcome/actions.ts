'use server';

import { revalidatePath } from 'next/cache';

import { supabaseOnServer } from '../auth/server-client';

/**
 * 안내를 확인하고 선택 답을 남긴다.
 *
 * 판본과 **본 안내의 줄**을 화면이 들고 온다. 서버가 스스로 「지금 값」을 적으면, 사용자가
 * 읽은 것과 남은 기록이 갈릴 수 있다 — 읽은 것을 적어야 그 기록이 뜻이 있다.
 *
 * 그 사이에 운영자가 일정을 옮겼으면 DB 가 거절한다. 낡은 화면에 대고 누른 확인은
 * 지금 약속에 대한 확인이 아니다.
 */
export async function acknowledgeNotice(answer: {
  version: string;
  scheduleId: number;
  improvement: boolean;
  contact: boolean;
}): Promise<{ ok: true } | { ok: false; message: string }> {
  const supabase = await supabaseOnServer();

  const { error } = await supabase.rpc('acknowledge_notice', {
    p_version: answer.version,
    p_schedule_id: answer.scheduleId,
    p_improvement: answer.improvement,
    p_contact: answer.contact,
  });

  if (error) return { ok: false, message: error.message };

  revalidatePath('/me', 'layout');
  return { ok: true };
}
