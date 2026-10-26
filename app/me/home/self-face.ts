import type { supabaseOnServer } from '../../auth/server-client';
import { read, unread, type SkippableRead } from '../../db-error';
import { myRoomFaceOf, type MyRoomFace } from '../chat/[matchId]/me';

type ServerClient = Awaited<ReturnType<typeof supabaseOnServer>>;

/**
 * **홈의 내 얼굴** — 내 사주 카드 머리의 동그란 프로필과, 그것을 누르면 올라오는 「내 프로필」 시트의 사진들(2026-10-26 운영자
 * 「홈에서는 보통 「나」라는 프로필이 동그랗게 있다」 · 「누르면 카톡 내 프로필처럼 시트」).
 *
 * 대화방의 「내 프로필」(`chat/[matchId]/me.ts`)과 같은 문(`my_photos`) · 같은 셈(`myRoomFaceOf`)이다 — 사진 주소에 판본이 붙어
 * 바꾼 뒤 옛 장이 서지 않는다. 바이트는 싣지 않는다.
 *
 * **꾸밈이다** — 못 읽으면 홈은 그대로 서고 사진 없는 나(일간 그림)로 선다(ADR 0078).
 */
export type HomeFace = MyRoomFace;

export const NO_FACE: HomeFace = { photoUrls: [], photoFocus: [] };

export async function myHomeFace(supabase: ServerClient, userId: string): Promise<SkippableRead<HomeFace>> {
  const { data, error } = await supabase.rpc('my_photos');
  if (error) return unread(error, 'my_photos');
  return read(myRoomFaceOf(userId, data ?? []));
}
