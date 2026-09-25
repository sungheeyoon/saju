'use client';

import { useEffect, useState, type RefObject } from 'react';

import { CandidatePhoto, photosOf, type DeckCard } from './matching-experience';

/*
  **오늘의 인연 카드의 사진들 — 넘겨 보되 글은 그대로다**(G-60, 운영자 2026-09-25 시안).

  사진 맨 위에 장 수만큼의 얇은 막대가 서고 지금 장이 흰색이다. 사진 왼쪽 반을 누르면 이전, 오른쪽 반은 다음.
  **끝에서는 돌지 않는다** — 끝 장에서 더 누르면 카드가 그쪽으로 살짝 튕기고 제자리에 선다(첫 장으로 안 간다).
  줄인 움직임이면 튕김도 빠지고 그냥 선다. 한 장이거나 없으면 막대도 누를 자리도 없다 — 대표 한 장(`CandidatePhoto`)이다.

  **장 번호는 이 안에만 산다.** 이름 · 점수 · 판정 · 기운 · 소개(`FaceText`)는 이 밖에 서서 장이 바뀌어도 그대로다.
  사람이 바뀌면 부모가 `key` 로 카드를 새로 세우므로 번호는 첫 장에서 다시 시작한다.

  막대는 단추다 — 키보드는 막대로 옮겨 다니며 장을 고른다. 보조기기 이름은 「사진 2 / 4」(승인 2026-09-25).
  왼쪽 · 오른쪽 반은 손가락의 길이라 보조기기에는 안 읽힌다 — 같은 일을 막대가 한다.
*/

const BOUNCE_PX = 14;
const BOUNCE_MS = 280;

const reducedMotion = () => typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

/** 막대가 서는 카드인가 — 서면 사진 위의 딱지 · ⓘ 가 막대 아래로 내려선다 */
export const pagesPhotos = (card: DeckCard): boolean => photosOf(card).length > 1;

/**
 * 카드 한 장의 사진 판. `bounce` 는 끝에서 튕길 카드 — 사진만이 아니라 카드 한 장이 움직인다.
 * `initialClass` 는 사진이 없을 때 첫 글자의 크기.
 */
export function CardPhotos({
  card,
  bounce,
  initialClass,
}: {
  card: DeckCard;
  bounce: RefObject<HTMLElement | null>;
  initialClass?: string;
}) {
  const photos = photosOf(card);
  const [at, setAt] = useState(0);

  /* 다음 장 하나만 미리 받는다 — 여섯 장을 한꺼번에 받지 않는다. 지나온 장은 이미 받았다 */
  const upcoming = photos[at + 1];
  useEffect(() => {
    if (upcoming === undefined) return;
    const image = new Image();
    image.src = upcoming;
  }, [upcoming]);

  if (photos.length < 2) return <CandidatePhoto card={card} initialClass={initialClass} />;

  /** 한 장 옮긴다 — 끝을 넘으면 옮기지 않고 그쪽으로 튕긴다 */
  const step = (dir: 1 | -1) => {
    const to = at + dir;
    if (to >= 0 && to < photos.length) {
      setAt(to);
      return;
    }
    if (bounce.current === null || reducedMotion()) return;
    bounce.current.animate(
      [{ transform: 'none' }, { transform: `translateX(${dir * BOUNCE_PX}px)` }, { transform: 'none' }],
      { duration: BOUNCE_MS, easing: 'cubic-bezier(.3,.7,.4,1)' },
    );
  };

  return (
    <div
      data-card-photos=""
      className="absolute inset-0"
      onClick={(event) => {
        const box = event.currentTarget.getBoundingClientRect();
        step(event.clientX - box.left < box.width / 2 ? -1 : 1);
      }}
    >
      <CandidatePhoto card={card} at={at} />
      {/* 막대 — 누르는 높이는 24px, 보이는 막대는 3px. 위쪽의 옅은 막이 흰 사진 위에서도 흰 막대를 세운다 */}
      <div className="absolute inset-x-0 top-0 flex gap-1 bg-gradient-to-b from-black/35 to-transparent px-3 pb-1 pt-1.5">
        {photos.map((photo, index) => (
          <button
            key={`${index}-${photo}`}
            type="button"
            aria-label={`사진 ${index + 1} / ${photos.length}`}
            aria-current={index === at ? 'true' : undefined}
            onClick={(event) => {
              event.stopPropagation();
              setAt(index);
            }}
            className="flex h-6 min-w-0 flex-1 items-start rounded-sm pt-1 focus-visible:outline-2 focus-visible:outline-offset-0 focus-visible:outline-white"
          >
            <span
              aria-hidden="true"
              className={`h-[3px] w-full rounded-full shadow-[0_0_2px_rgb(0_0_0/0.4)] ${index === at ? 'bg-white' : 'bg-white/40'}`}
            />
          </button>
        ))}
      </div>
    </div>
  );
}
