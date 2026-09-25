import { initialOf } from '@/src/lib/profile';

import { elementScope } from '../../ui/element-tone';
import { photosOf, type DeckCard } from './deck-card';

/**
 * 후보의 얼굴 한 자리 — 덱 · 지도 · 확인 창 · 지나친 인연이 모두 이것을 쓴다.
 *
 * **사진은 선택이다**(§5.1). 안 올린 사람 자리에는 이름의 첫 글자가 선다 — 빈 자리가 아니라 그 사람의 자리로
 * 보이게. 부모가 크기와 모양을 정하고, 이것은 그 안을 채운다. 첫 글자의 판은 **제 색**(`avatarElement` — 그 사람 일간의 오행)을 스스로 입는다 —
 * 부모의 판(채워 주는 기운)을 물려받지 않는다. 색만 말하고, 일간 · 오행의 이름은 어디에도 적지 않는다.
 * `at` 은 몇째 장인가(0 = 대표) — 오늘의 인연 카드가 넘길 때만 쓴다(`CardPhotos`).
 */
export function CandidatePhoto({ card, initialClass = 'text-[1.2em]', at = 0 }: { card: DeckCard; initialClass?: string; at?: number }) {
  const src = photosOf(card)[at] ?? null;
  if (src === null) {
    return (
      <span
        aria-hidden="true"
        className={`${elementScope(card.avatarElement)} font-rounded absolute inset-0 grid place-items-center bg-[var(--tile)] text-[var(--ink)] ${initialClass}`}
      >
        {initialOf(card.nickname)}
      </span>
    );
  }
  return (
    // eslint-disable-next-line @next/next/no-img-element -- 우리 라우트가 로그인한 사람에게만 바이트를 내주므로 최적화기가 받아 갈 원본이 없다
    <img src={src} alt="" draggable={false} className="pointer-events-none absolute inset-0 size-full object-cover object-[50%_28%]" />
  );
}
