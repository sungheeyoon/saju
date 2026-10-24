import { focusOf, type PhotoFocus } from '@/src/lib/profile';

import type { supabaseOnServer } from '../../../auth/server-client';
import { read, unread, type SkippableRead } from '../../../db-error';

type ServerClient = Awaited<ReturnType<typeof supabaseOnServer>>;

/**
 * **방에서 보는 내 모습** — 상대가 이 방에서 내 얼굴을 누르면 보는 것과 같은 판(`PartnerSheet`)에 실을 내 사진 · 소개다
 * (카카오톡 채팅방 서랍의 「대화상대 — 나」, 2026-10-24).
 *
 * 닉네임 · 소개는 방이 이미 읽는 계정 줄(`readAccount`)에서 오고, 여기서는 사진의 자리와 판본만 묻는다(`my_photos`). 바이트는
 * 싣지 않는다 — 그림은 주소로 받아 간다. 주소에 판본(`?v=`)을 붙이는 것은 프로필 화면의 편집 칸과 같다 — 사진을 바꾼 뒤에
 * 옛 장이 서지 않는다.
 *
 * **꾸밈이다** — 못 읽으면 방은 그대로 열리고 「내 프로필」만 안 선다(ADR 0078). 사진이 없다고 그리면 거짓이다.
 */
export type MyRoomFace = {
  readonly photoUrls: readonly string[];
  readonly photoFocus: readonly PhotoFocus[];
};

export async function myRoomFace(supabase: ServerClient, userId: string): Promise<SkippableRead<MyRoomFace>> {
  const { data, error } = await supabase.rpc('my_photos');
  if (error) return unread(error, 'my_photos');
  return read(myRoomFaceOf(userId, data ?? []));
}

/** 문의 줄 → 사진 주소 · 자리(시험이 부른다). 줄은 자리 순서로 온다 — 1 이 대표다 */
export function myRoomFaceOf(
  userId: string,
  rows: readonly { position: number; version: number; focus_x: unknown; focus_y: unknown }[],
): MyRoomFace {
  const sorted = [...rows].sort((a, b) => a.position - b.position);
  return {
    photoUrls: sorted.map((row) => `/me/photo/${userId}/${row.position}?v=${row.version}`),
    photoFocus: sorted.map((row) => focusOf(row.focus_x, row.focus_y)),
  };
}
