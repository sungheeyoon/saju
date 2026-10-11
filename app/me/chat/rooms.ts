import { closedReasonOf, type ClosedReason } from '@/src/lib/chat';
import { activityBandOf, type ActivityBand } from '@/src/lib/presence';
import type { RpcRow } from '@/src/lib/db';
import { leadFocusOf, type PhotoFocus } from '@/src/lib/profile';

import { supabaseOnServer } from '../../auth/server-client';
import { photosFromFocus } from '../candidates';
import { dbFailure } from '../../db-error';

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
  /** 상대가 떠났으면 `null` — 사진도 차단도 걸 사람이 없다(ADR 0094) */
  readonly partnerUserId: string | null;
  readonly partnerNickname: string;
  /**
   * 상대가 **탈퇴**했다 — 처분이 떠난 쪽의 자리를 비웠다(ADR 0094). 화면은 이 칸 하나로 닉네임
   * 대신 「탈퇴한 사용자」를, 닫힌 까닭 대신 넷째 줄을 세운다(`partnerNameOf` · `roomNoticeOf`).
   */
  readonly partnerLeft: boolean;
  readonly partnerHasPhoto: boolean;
  /** 상대 대표 사진의 보일 자리(G-98) */
  readonly partnerPhotoFocus: PhotoFocus;
  /**
   * 상대의 사진 전부와 장마다의 자리 — 상대 프로필 시트가 넘긴다(운영자 결정 2026-10-11). 같은 문이 이미 낸 초점의 짝 수가
   * 장 수라(`photosFromFocus`) 더 묻지 않는다
   */
  readonly partnerPhotoUrls: readonly string[];
  readonly partnerPhotoFocuses: readonly PhotoFocus[];
  readonly openedAt: string;
  /** `null` 이면 열려 있다. 모르는 이유로 닫힌 방은 목록에서 그리지 않는다 */
  readonly closedReason: ClosedReason | null;
  readonly lastMessageAt: string | null;
  readonly lastMessageBody: string | null;
  readonly unread: number;
  /** 상대의 접속 상태 — 열린 방에만 온다. 닫힌 방과 모르는 값은 `null`(ADR 0092) */
  readonly partnerActivity: ActivityBand | null;
};

/** 문의 한 줄 → 방 하나(시험이 부른다) */
export const roomOf = (row: RoomRow): ChatRoom | null => {
  const reason = row.closed_reason === null ? null : closedReasonOf(row.closed_reason);
  // 닫혔는데 이유를 모르면 무슨 말을 세울지 알 수 없다 — 그리지 않는다.
  if (row.closed_reason !== null && reason === null) return null;
  /*
    닫힌 방(차단 · 정지 · 탈퇴 · 떠난 상대)에는 시트가 없다 — 상대의 장 수 · 보일 자리를 브라우저로 싣지 않는다. 머리 · 목록의
    얼굴(대표 한 장, `partnerHasPhoto` · `partnerPhotoFocus`)은 그대로다
  */
  const open = reason === null && row.partner_left !== true;
  const photos = open
    ? photosFromFocus(row.partner_user_id ?? '', row.partner_photo_focus, row.partner_has_photo === true)
    : { photoUrls: [], photoFocus: [] };
  return {
    matchId: row.match_id,
    partnerUserId: row.partner_user_id ?? null,
    partnerNickname: row.partner_nickname ?? '',
    partnerLeft: row.partner_left === true,
    partnerHasPhoto: row.partner_has_photo === true,
    partnerPhotoFocus: leadFocusOf(row.partner_photo_focus),
    partnerPhotoUrls: photos.photoUrls,
    partnerPhotoFocuses: photos.photoFocus,
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

