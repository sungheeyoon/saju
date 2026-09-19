'use server';

import { supabaseOnServer } from './auth/server-client';
import { userFacingDbMessage } from './db-error';

/**
 * 이 이름을 쓸 수 있나 — **참·거짓 하나만 돌려받는다.**
 *
 * 누가 쓰고 있는지도, 비슷한 이름도, 대신 쓸 이름도 안 묻는다. 대안을 추천하려면 남들이
 * 쓰는 이름을 훑어야 하고, 그것은 이 문이 아니다.
 *
 * 가입 화면(`/signup`)과 프로필 화면(`/me/profile`)이 함께 부른다. 두 화면의 액션에
 * 한 벌씩 적혀 있었는데 부르는 RPC 도 돌려주는 모양도 같았다 — 한쪽만 고쳐지는 날을 없앤다.
 */
export async function checkNickname(
  nickname: string,
): Promise<{ ok: true; available: boolean } | { ok: false; message: string }> {
  const supabase = await supabaseOnServer();

  const { data, error } = await supabase.rpc('nickname_is_available', {
    p_nickname: nickname.trim(),
  });

  if (error) return { ok: false, message: userFacingDbMessage(error, 'nickname_is_available') };
  return { ok: true, available: data === true };
}
