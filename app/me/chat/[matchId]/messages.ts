import type { SupabaseClient } from '@supabase/supabase-js';

import { MESSAGE_WINDOW, messagesOf, type ChatMessage } from '@/src/lib/chat/room/message';
import type { Database } from '@/src/lib/db';

import { dbFailure } from '../../../db-error';

/**
 * 방 안의 메시지 — `my_chat_messages` 가 내주는 것이 곧 화면이 보는 것이다(ADR 0091).
 *
 * 서버(방의 첫 그리기)와 브라우저(새 메시지 · 이전 메시지 더 보기, ADR 0155)가 같은 문을 쓴다 — 그래서 클라이언트를
 * **받기만** 한다(`readUnreadChat` 과 같은 모양). 서버 클라이언트를 여기서 들면 방의 클라이언트 부품이
 * `next/headers` 를 브라우저로 끌고 간다.
 *
 * 함수는 최신순으로 한 번에 최대 200건을 내준다. 화면은 오래된 것이 위에 서므로 차례(`seq`)로 세운다. `seq` 는 방마다
 * 이어지는 번호가 아니라 표 전체의 차례다 — 두 메시지 사이가 비어 있어도 빠진 것이 아니다.
 */

/**
 * 한 방의 메시지 한 쪽 — `before` 를 주면 그 차례 **앞**의 것, 안 주면 가장 최근 것부터 `limit` 건. 오래된 것이 먼저다.
 *
 * 방 화면의 본체다 — 못 읽으면 빈 방이 아니라 실패다(ADR 0078). 브라우저에서 부른 자리는 그 실패를 받아 가진 것을
 * 그대로 두고, 다음 다시 대조가 메운다.
 */
export async function messagesForViewer(
  client: SupabaseClient<Database>,
  matchId: string,
  page: { readonly before?: number; readonly limit?: number } = {},
): Promise<readonly ChatMessage[]> {
  const { data, error } = await client.rpc('my_chat_messages', {
    p_match_id: matchId,
    p_limit: page.limit ?? MESSAGE_WINDOW,
    ...(page.before === undefined ? {} : { p_before_seq: page.before }),
  });
  if (error) throw dbFailure(error, 'my_chat_messages');
  return messagesOf(data ?? []);
}

export { MESSAGE_WINDOW };
export type { ChatMessage };
