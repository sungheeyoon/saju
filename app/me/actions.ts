'use server';

import { revalidatePath } from 'next/cache';

import { supabaseOnServer } from '../auth/server-client';
import { missingAnswer, type Query } from '../query';
import { revisionArgs, selfPersonArgs, unsupportedForSaving } from '../revision';

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

/**
 * 고친 출생정보를 새 판본으로 쌓는다.
 *
 * 두 가지가 함께 일어나지만 **같은 종류가 아니다.**
 *
 * - 부를 이름은 엣지를 고친다. 여덟 글자를 바꾸지 않으므로 판본이 되지 않는다.
 * - 나머지는 판본을 쌓는다. 하나라도 다르면 새것이고, 다 같으면 아무것도 안 쌓인다.
 *
 * 아무것도 안 쌓였는지는 DB 가 정한다(`add_person_revision` 이 지문으로 판정한다).
 * 여기서 미리 걸러 보내지 않는 이유는, 화면이 든 「지금 값」이 그 사이에 다른 기기에서
 * 바뀌었을 수 있기 때문이다 — 판정은 값을 들고 있는 쪽이 한다.
 */
export async function reviseSelfPerson(personId: string, query: Query): Promise<SaveResult> {
  const missing = missingAnswer(query);
  if (missing !== null) return { ok: false, message: missing };

  const unsupported = unsupportedForSaving(query);
  if (unsupported !== null) return { ok: false, message: unsupported };

  const supabase = await supabaseOnServer();

  // 정책이 자기 행만 열어 주므로 `user_id` 를 적지 않는다.
  const { error: labelError } = await supabase
    .from('user_person_access')
    .update({ local_label: query.name.trim() })
    .eq('person_id', personId);
  if (labelError) return { ok: false, message: labelError.message };

  const { error } = await supabase.rpc('add_person_revision', revisionArgs(personId, query));
  if (error) return { ok: false, message: error.message };

  revalidatePath('/me');
  return { ok: true };
}
