import { focusOf, type PhotoFocus } from '@/src/lib/profile';

import type { supabaseOnServer } from '../../auth/server-client';
import { read, unread, type SkippableRead } from '../../db-error';

type ServerClient = Awaited<ReturnType<typeof supabaseOnServer>>;

/**
 * **홈의 내 얼굴** — 내 사주 카드 머리의 동그란 프로필(2026-10-26 운영자 「홈에서는 보통 「나」라는 프로필이 동그랗게 있다」).
 * 카카오톡 친구 탭 맨 위 「내 프로필」 줄 · 토스 전체 탭의 내 이름 줄처럼 이름 왼쪽에 동그라미 하나다.
 *
 * 대표 사진(자리 1)이 있는지와 그 장의 보일 자리만 묻는다(`my_photos`) — 바이트는 주소(`/me/photo/{나}`)로 받아 간다. 사진이 없으면
 * 카드가 일간 그림을 그 원에 세운다.
 *
 * **꾸밈이다** — 못 읽으면 홈은 그대로 서고 사진 없는 나로 선다(ADR 0078). 대화방의 「내 프로필」(`chat/[matchId]/me.ts`)과 같은 문이다.
 */
export type HomeFace = {
  readonly hasPhoto: boolean;
  /** 대표 사진의 보일 자리 — 사진이 없으면 가운데 */
  readonly focus: PhotoFocus | undefined;
};

export const NO_FACE: HomeFace = { hasPhoto: false, focus: undefined };

export async function myHomeFace(supabase: ServerClient): Promise<SkippableRead<HomeFace>> {
  const { data, error } = await supabase.rpc('my_photos');
  if (error) return unread(error, 'my_photos');
  return read(homeFaceOf(data ?? []));
}

/** 문의 줄 → 대표 사진(시험이 부른다). 자리 1 이 대표다 — 줄의 차례에 기대지 않는다 */
export function homeFaceOf(rows: readonly { position: number; focus_x: unknown; focus_y: unknown }[]): HomeFace {
  const first = rows.find((row) => row.position === 1) ?? null;
  return first === null ? NO_FACE : { hasPhoto: true, focus: focusOf(first.focus_x, first.focus_y) };
}
