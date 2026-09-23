import { closedReasonOf, type ClosedReason } from '@/src/lib/chat';
import { activityBandOf, type ActivityBand } from '@/src/lib/presence';
import type { RpcRow } from '@/src/lib/db';

import { supabaseOnServer } from '../../auth/server-client';
import { dbFailure, type SkippableRead } from '../../db-error';
import { readUnreadChat } from './unread';

/**
 * 대화방 목록 — `my_chat_rooms` 하나가 내주는 것이 곧 화면이 보는 것이다(ADR 0091).
 *
 * 누가 어느 방을 보는가는 여기서 다시 판정하지 않는다. `chat_room_readable` 이 정책과 읽는 문
 * 양쪽에서 같은 답을 하고, 닫힌 방도 그 술어가 열어 준 것만 온다. 이 문은 칸 이름을 도메인
 * 말로 한 번 옮길 뿐이다.
 */

type RoomRow = RpcRow<'my_chat_rooms'>;

export type ChatRoom = {
  readonly matchId: string;
  readonly partnerUserId: string;
  readonly partnerNickname: string;
  readonly partnerHasPhoto: boolean;
  readonly openedAt: string;
  /** `null` 이면 열려 있다. 모르는 이유로 닫힌 방은 목록에서 그리지 않는다 */
  readonly closedReason: ClosedReason | null;
  readonly lastMessageAt: string | null;
  readonly lastMessageBody: string | null;
  readonly unread: number;
  /** 상대의 접속 상태 — 열린 방에만 온다. 닫힌 방과 모르는 값은 `null`(ADR 0092) */
  readonly partnerActivity: ActivityBand | null;
};

const roomOf = (row: RoomRow): ChatRoom | null => {
  const reason = row.closed_reason === null ? null : closedReasonOf(row.closed_reason);
  // 닫혔는데 이유를 모르면 무슨 말을 세울지 알 수 없다 — 그리지 않는다.
  if (row.closed_reason !== null && reason === null) return null;
  return {
    matchId: row.match_id,
    partnerUserId: row.partner_user_id,
    partnerNickname: row.partner_nickname ?? '',
    partnerHasPhoto: row.partner_has_photo === true,
    openedAt: row.opened_at,
    closedReason: reason,
    lastMessageAt: row.last_message_at,
    lastMessageBody: row.last_message_body,
    unread: row.unread_count ?? 0,
    partnerActivity: activityBandOf(row.partner_activity),
  };
};

export async function chatRoomsForViewer(): Promise<readonly ChatRoom[]> {
  const supabase = await supabaseOnServer();
  const { data, error } = await supabase.rpc('my_chat_rooms');
  /* 목록 화면의 본체다 — 못 읽으면 빈 목록이 아니라 실패다(ADR 0078) */
  if (error) throw dbFailure(error, 'my_chat_rooms');
  return (data ?? []).flatMap((row) => {
    const room = roomOf(row);
    return room === null ? [] : [room];
  });
}

/**
 * 방 하나 — 같은 문을 읽고 하나를 집는다. 방 목록의 문이 이미 「내가 볼 수 있는 방」만 내주므로
 * 없는 방과 남의 방은 여기서 `null` 이고, 화면은 그것을 404 로 세운다.
 */
export async function chatRoomForViewer(matchId: string): Promise<ChatRoom | null> {
  const rooms = await chatRoomsForViewer();
  return rooms.find((room) => room.matchId === matchId) ?? null;
}

/** 서버 쪽 — 같은 문(`./unread`)에 쿠키 클라이언트를 넘긴다 */
export async function unreadChatCount(): Promise<SkippableRead<number>> {
  return readUnreadChat(await supabaseOnServer());
}
