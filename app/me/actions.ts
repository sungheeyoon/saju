'use server';

import { revalidatePath } from 'next/cache';

import { supabaseOnServer } from '../auth/server-client';
import { missingAnswer, type Query } from '../query';
import { selfPersonArgs, unsupportedForSaving } from '../revision';

export type SaveResult = { ok: true } | { ok: false; message: string };

/**
 * 자기 사주를 저장한다.
 *
 * **여기서 권한을 판정하지 않는다.** 서버 액션은 주소가 알려지면 누구나 부를 수 있는
 * 자리이지만, 판정은 RPC 안에 있다 — 로그인했는가, 계정이 살아 있는가, 이미 등록했는가.
 * 그 셋을 여기서 다시 물으면 답하는 자리가 둘이 되고, 둘은 언젠가 어긋난다. 그리고
 * 어긋났을 때 열려 있는 쪽은 언제나 더 바깥이다.
 *
 * 여기서 보는 것은 **모양**뿐이다. 사람이 읽을 수 있는 말로 돌려주려는 것이고,
 * 그마저도 DB 가 한 번 더 본다.
 */
export async function saveSelfPerson(query: Query): Promise<SaveResult> {
  const missing = missingAnswer(query);
  if (missing !== null) return { ok: false, message: missing };

  const unsupported = unsupportedForSaving(query);
  if (unsupported !== null) return { ok: false, message: unsupported };

  const supabase = await supabaseOnServer();
  const { error } = await supabase.rpc('create_self_person', selfPersonArgs(query));

  if (error) {
    /**
     * 「이미 등록했다」는 실패가 아니라 상태다.
     *
     * 두 번 눌렸거나 뒤로 갔다 다시 왔을 때 나온다. RPC 가 조용히 덮어쓰지 않고
     * 거절하도록 만들어 뒀으므로(첫 번째가 어디로 갔는지 모르게 되니까), 화면은
     * 그냥 새로 그려서 저장된 것을 보여주면 된다.
     */
    if (error.code === '23505') {
      revalidatePath('/me');
      return { ok: true };
    }
    return { ok: false, message: error.message };
  }

  revalidatePath('/me');
  return { ok: true };
}
