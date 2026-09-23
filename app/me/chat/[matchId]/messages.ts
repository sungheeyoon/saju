import type { RpcRow } from '@/src/lib/db';

import { supabaseOnServer } from '../../../auth/server-client';
import { dbFailure } from '../../../db-error';

/**
 * 방 안의 메시지 — `my_chat_messages` 가 내주는 것이 곧 화면이 보는 것이다(ADR 0091).
 *
 * 함수는 최신순으로 최대 200건을 내준다. 화면은 오래된 것이 위에 서므로 여기서 뒤집는다 —
 * 더 오래된 것을 더 읽는 길(`p_before_seq`)은 채팅 안전 베타에 없다. 방 하나에 200건이 넘는
 * 사람이 생기면 그때 잰다.
 */

type MessageRow = RpcRow<'my_chat_messages'>;

export type ChatMessage = {
  readonly messageId: string;
  readonly seq: number;
  readonly mine: boolean;
  readonly body: string;
  readonly createdAt: string;
};

const messageOf = (row: MessageRow): ChatMessage => ({
  messageId: row.message_id,
  seq: row.seq,
  mine: row.mine === true,
  body: row.body,
  createdAt: row.created_at,
});

export async function messagesForViewer(matchId: string): Promise<readonly ChatMessage[]> {
  const supabase = await supabaseOnServer();
  const { data, error } = await supabase.rpc('my_chat_messages', {
    p_match_id: matchId,
    p_limit: 200,
  });
  /* 방 화면의 본체다 — 못 읽으면 빈 방이 아니라 실패다(ADR 0078) */
  if (error) throw dbFailure(error, 'my_chat_messages');
  return (data ?? []).map(messageOf).sort((a, b) => a.seq - b.seq);
}
