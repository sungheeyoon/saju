import type { SupabaseClient } from '@supabase/supabase-js';

import type { Database } from '@/src/lib/db';

import { userFacingDbMessage } from '../../../db-error';
import type { SaveResult } from '../../../save-result';

/**
 * 읽음 — **본 데까지만** 남긴다(ADR 0155). 방이 화면에 들어온 상대 말의 가장 큰 차례를 넘긴다. 함수는 그 방에 실제로 있는
 * 차례까지만, 앞으로만 움직인다.
 *
 * **브라우저 클라이언트로 곧장 부른다** — 서버 액션이 아니다. 말풍선이 화면에 들어올 때 저절로 부르는 쓰기라 사람이 누른
 * 것이 아니다. 서버 액션은 관문(`proxy.ts`)을 지나 활동으로 적히므로, 그 길로 가면 자리를 비운 사람에게 상대 메시지가 올 때마다
 * 「지금 활동 중」이 이어진다(G-76, ADR 0155 「치르는 값」). 권한은 같다 — 같은 세션 토큰으로 같은 문을 부른다.
 *
 * 클라이언트를 받기만 한다 — `unread.ts` 와 같은 모양.
 */
export async function markChatReadUpTo(
  client: SupabaseClient<Database>,
  matchId: string,
  upToSeq: number,
): Promise<SaveResult> {
  const { error } = await client.rpc('mark_chat_read', { p_match_id: matchId, p_up_to_seq: upToSeq });
  if (error) return { ok: false, message: userFacingDbMessage(error, 'mark_chat_read') };
  return { ok: true };
}
