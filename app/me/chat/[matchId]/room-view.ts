import type { PhotoFocus } from '@/src/lib/profile';
import type { ActivityBand } from '@/src/lib/presence';

import type { RoomTones } from '../tones';
import type { ShownMessage } from './bubbles';
import type { RoomCompat } from './room-compat';

/**
 * 방 안에서 사람이 서는 모양 — 서버가 다 지어서 넘긴다(시각 글자 · 묶음 · 닫힌 까닭).
 */
export type RoomView = {
  readonly matchId: string;
  /** `{닉네임} 님` · 떠났으면 「탈퇴한 사용자」 */
  readonly heading: string;
  readonly name: string;
  /** 상대가 떠났으면 `null` — 사진도 신고도 차단도 걸 사람이 없다(ADR 0094) */
  readonly partnerUserId: string | null;
  readonly partnerHasPhoto: boolean;
  /** 상대 대표 사진의 보일 자리(G-98) */
  readonly partnerPhotoFocus: PhotoFocus;
  /** 상대의 사진 전부 · 장마다의 자리 · 지금 소개 — 상대 프로필 시트가 쓴다(운영자 결정 2026-10-11) */
  readonly partnerPhotoUrls: readonly string[];
  readonly partnerPhotoFocuses: readonly PhotoFocus[];
  readonly partnerIntro: string | null;
  /** 닫힌 까닭 한 줄 — 열린 방은 `null` */
  readonly notice: string | null;
  /** 열린 방에만 온다(ADR 0092) */
  readonly activity: ActivityBand | null;
  readonly unread: number;
  /** 서버가 읽은 최근 200건 — 시각 글자를 붙여 넘긴다(`labelled`). 그 뒤는 방이 브라우저에서 합친다(ADR 0155) */
  readonly messages: readonly ShownMessage[];
  /** 읽는 문이 준 것이 방의 처음부터다(200건 아래) — 그때만 첫머리를 세운다 */
  readonly fromBeginning: boolean;
  /** 두 사람의 일간 — 인연 궁합이 연 값이 있을 때만(`roomTonesForViewer`). 없으면 중립 색이다 */
  readonly tones: RoomTones | null;
  /** 그 인연 궁합이 어디까지 왔나 — 궁합 단추가 든다. 열린 방에만 온다(닫힌 방에는 단추가 없다) */
  readonly compat: RoomCompat | null;
  /**
   * 나 — 상대가 이 방에서 내 얼굴을 누르면 보는 지금의 사진 · 소개(`me.ts`). 방 머리의 「⋯」 맨 위 「내 프로필」과 첫머리의
   * 「나」 카드가 같은 시트로 연다(2026-10-24). 사진을 못 읽었으면 `null` — 그 길이 안 선다
   */
  readonly me: RoomSelf | null;
};

export type RoomSelf = {
  readonly userId: string;
  readonly nickname: string;
  readonly intro: string | null;
  readonly photoUrls: readonly string[];
  readonly photoFocus: readonly PhotoFocus[];
};
