'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';

import { supabaseOnServer } from '../auth/server-client';

/**
 * 안내를 확인하고 선택 답을 남긴다 — **성공하면 안 돌아온다.**
 *
 * 판본과 **본 안내의 줄**을 화면이 들고 온다. 서버가 스스로 「지금 값」을 적으면, 사용자가
 * 읽은 것과 남은 기록이 갈릴 수 있다 — 읽은 것을 적어야 그 기록이 뜻이 있다.
 *
 * 그 사이에 운영자가 일정을 옮겼으면 DB 가 거절한다. 낡은 화면에 대고 누른 확인은
 * 지금 약속에 대한 확인이 아니다.
 *
 * ## 갈 곳을 **여기서** 정한다
 *
 * 화면이 `/me` 로 보내고 거기서 관문이 한 번 더 튕기게 두었었다. 그 두 번째 튕김에서
 * **화면이 비었다** — 레이아웃이 `redirect` 를 던지면 브라우저는 주소만 `/me/profile` 로
 * 옮기고 그 화면의 조각을 끝없이 다시 받는다. 사람이 직접 새로고침해야 나왔다.
 *
 * 튕김이 하나면 그 자리가 없다. 그리고 다음에 어디로 가야 하는지는 **방금 계정을 고친
 * 이 자리가 가장 잘 안다** — 안내 다음이 이름이고(§5.1), 이름이 있으면 내 사주다.
 */
export async function acknowledgeNotice(answer: {
  version: string;
  scheduleId: number;
  improvement: boolean;
  contact: boolean;
}): Promise<{ ok: false; message: string }> {
  const supabase = await supabaseOnServer();

  const { error } = await supabase.rpc('acknowledge_notice', {
    p_version: answer.version,
    p_schedule_id: answer.scheduleId,
    p_improvement: answer.improvement,
    p_contact: answer.contact,
  });

  if (error) return { ok: false, message: error.message };

  const { data: account } = await supabase.from('app_user').select('nickname').maybeSingle();

  revalidatePath('/me', 'layout');

  /* `redirect` 는 던진다 — try 안에 두지 않는다(Next 문서). 여기가 이 함수의 끝이다 */
  redirect(account?.nickname == null ? '/me/profile' : '/me');
}
