import type { ActivityBand } from '@/src/lib/presence';
import { ELEMENTS, type Element } from '@/src/lib/saju';

/**
 * 덱으로 내려오는 후보 한 장 — **`CandidateCard` 에서 증표만 뗀 것**이다.
 *
 * 칸을 늘리지 않는다. 카드가 무엇을 말할 수 있는지는 `candidates.ts` 가 정하고,
 * 여기서 더할 수 있으면 자르는 자리가 둘이 된다.
 */
export type DeckCard = {
  readonly candidateUserId: string;
  readonly nickname: string;
  readonly intro: string | null;
  readonly hasPhoto: boolean;
  /**
   * 기본 아바타의 색 — **그 사람 일간의 오행**(운영자 2026-09-24). 사진이 있거나 모르면 `null`(회색).
   * 아바타만 쓴다 — 카드 · 기운 칸 · 지도는 채워 주는 기운(`supplyOf`)을 입는다. 글자로는 말하지 않는다
   */
  readonly avatarElement: Element | null;
  /**
   * 사진 주소들 — 첫 장이 대표다(G-60, `/me/photo/{id}/{n}`). 사진이 없으면 빈 목록. 후보 · 지나친 인연은
   * `candidates.ts` 가 채우고, 예시 카드는 제 파일을 넣는다. 비워 두면 `hasPhoto` 로 대표 한 장을 짓는다
   */
  readonly photoUrls?: readonly string[];
  readonly exploration: boolean;
  /** 접속 상태의 구간 — 후보 목록의 카드에만 온다. 지나친 인연과 예시 카드는 비운다(PRD 「접속 상태」) */
  readonly activity?: ActivityBand | null;
  readonly previewScore: number;
  readonly verdict: string;
  readonly reason: string;
  readonly balanceLabel: string;
  readonly highlights: readonly { readonly element: string; readonly text: string }[];
};

/** 그 사람의 사진 전부, 대표가 먼저 — 목록이 없으면 `hasPhoto` 로 한 장. 비면 이름의 첫 글자가 선다 */
export const photosOf = (card: DeckCard): readonly string[] =>
  card.photoUrls ?? (card.hasPhoto ? [`/me/photo/${card.candidateUserId}`] : []);

/** 서버가 준 기운 이름 — 오행 다섯 중 하나면 그것, 아니면 `null`(모르는 기운의 회색) */
export const elementOf = (value: string | undefined): Element | null =>
  ELEMENTS.find((one) => one === value) ?? null;

/** 그 사람이 채워 주는 첫 기운 — 서버가 준 차례 그대로다(「가장 강한」이라고 읽지 않는다) */
export const supplyOf = (card: DeckCard): Element | null => elementOf(card.highlights[0]?.element);
