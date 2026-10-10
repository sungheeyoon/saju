import type { SupabaseClient } from '@supabase/supabase-js';

import type { Database, RpcRow } from '@/src/lib/db';

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

type MessageRow = RpcRow<'my_chat_messages'>;

/** 한 번에 읽는 메시지 수 — 함수의 상한과 같다. 이보다 적게 왔으면 그 앞은 없다 */
export const MESSAGE_WINDOW = 200;

export type ChatMessage = {
  readonly messageId: string;
  readonly seq: number;
  readonly mine: boolean;
  /**
   * 보낸 사람이 떠났다 — 보낸 사람 칸이 비었다(ADR 0094). 그 줄에는 신고가 안 선다 — 신고당할
   * 계정이 없고, DB 도 받지 않는다.
   */
  readonly fromLeftPartner: boolean;
  readonly body: string;
  readonly createdAt: string;
  /**
   * 보낸 사람이 전송마다 지은 id — **내 말에만** 온다(상대의 말 · 옛 말은 `null`). 방은 보내는 중인 말과 읽혀 온 말을 이것으로
   * 짝짓고, 서버는 같은 id 를 두 번 남기지 않는다(`20261201090000`, ADR 0155 덧).
   */
  readonly clientId: string | null;
};

const messageOf = (row: MessageRow): ChatMessage => ({
  messageId: row.message_id,
  seq: row.seq,
  mine: row.mine === true,
  fromLeftPartner: row.mine !== true && row.sender_user_id === null,
  body: row.body,
  createdAt: row.created_at,
  // 생성 타입은 반환 칸을 `string` 으로 적지만 남의 말 · 옛 말은 비어 온다.
  clientId: row.client_id ?? null,
});

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
  return (data ?? []).map(messageOf).sort((a, b) => a.seq - b.seq);
}
