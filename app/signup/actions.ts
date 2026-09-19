'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';

import { supabaseOnServer } from '../auth/server-client';
import { userFacingDbMessage } from '../db-error';

/**
 * 가입을 끝낸다 — **성공하면 안 돌아온다.**
 *
 * 코드·이름·안내 확인이 **한 번에** 나간다(`complete_signup`). 갈라 보내면 「코드는
 * 썼는데 이름이 없는」 계정이 생기고, 관문이 그런 사람을 어디로 보낼지 다시 정해야
 * 한다 — 그 자리를 없애려고 폼을 하나로 합친 것이다(ADR 0042).
 *
 * 판본과 **본 안내의 줄**을 화면이 들고 온다. 서버가 스스로 「지금 값」을 적으면 사용자가
 * 읽은 것과 남는 기록이 갈린다 — 읽은 것을 적어야 그 기록이 뜻이 있다. 그 사이에
 * 운영자가 일정을 옮겼으면 DB 가 거절한다.
 *
 * ## 갈 곳을 **여기서** 정한다
 *
 * 화면이 `/me` 로 보내고 거기서 관문이 한 번 더 튕기게 두면, 그 두 번째 튕김에서 화면이
 * 빈다(커밋 `2cbb31f`). 튕김이 하나면 그 자리가 없다.
 */
export async function completeSignup(answer: {
  resumeReading?: boolean;
  code: string;
  nickname: string;
  version: string;
  scheduleId: number;
  improvement: boolean;
  contact: boolean;
}): Promise<{ ok: false; message: string }> {
  const supabase = await supabaseOnServer();

  const { error } = await supabase.rpc('complete_signup', {
    /*
      **빈 칸은 `null` 로 보낸다.** 이미 이름이나 코드를 가진 사람은 그 칸을 안 보므로
      빈 문자열이 온다 — DB 가 그것을 「짓겠다」로 읽으면 2자 미만이라고 거절한다.
    */
    p_code: answer.code.trim() || null,
    p_nickname: answer.nickname.trim() || null,
    p_version: answer.version,
    p_schedule_id: answer.scheduleId,
    p_improvement: answer.improvement,
    p_contact: answer.contact,
  });

  if (error) return { ok: false, message: userFacingDbMessage(error, 'complete_signup') };

  revalidatePath('/me', 'layout');

  /* `redirect` 는 던진다 — try 안에 두지 않는다(Next 문서). 여기가 이 함수의 끝이다 */
  redirect(answer.resumeReading === true ? '/#resume-reading' : '/me');
}
