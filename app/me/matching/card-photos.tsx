'use client';

import { useEffect, useRef, useState, type RefObject } from 'react';

import { CandidatePhoto } from './candidate-photo';
import { photosOf, type DeckCard, type PhotoFace } from './deck-card';
import { ICON_BUTTON_ON_PHOTO_FACE } from '../../ui/buttons';
import { Icon } from '../../ui/icons';
import { reducedMotion } from '../../ui/motion';

/*
  **오늘의 인연 카드의 사진들 — 넘겨 보되 글은 그대로다**(G-60, 운영자 2026-09-25 시안).

  사진 맨 위에 장 수만큼의 얇은 막대가 서고 지금 장이 흰색이다. 사진 왼쪽 반을 누르면 이전, 오른쪽 반은 다음.
  **끝에서는 돌지 않는다** — 끝 장에서 더 누르면 카드가 그쪽으로 살짝 튕기고 제자리에 선다(첫 장으로 안 간다).
  줄인 움직임이면 튕김도 빠지고 그냥 선다. 한 장이거나 없으면 막대도 누를 자리도 없다 — 대표 한 장(`CandidatePhoto`)이다.

  **장 번호는 이 안에만 산다.** 이름 · 점수 · 판정 · 기운 · 소개(`FaceText`)는 이 밖에 서서 장이 바뀌어도 그대로다.
  사람이 바뀌면 부모가 `key` 로 카드를 새로 세우므로 번호는 첫 장에서 다시 시작한다.

  막대는 단추다 — 키보드는 막대로 옮겨 다니며 장을 고른다. 보조기기 이름은 「사진 2 / 4」(승인 2026-09-25).
  왼쪽 · 오른쪽 반은 손가락의 길이라 보조기기에는 안 읽힌다 — 같은 일을 막대가 한다.

  **가로로 쓸어도 넘어가고, 넓은 화면(lg)에는 좌우 화살표가 선다**(운영자 결정 2026-10-11, 상대 프로필 시트와 한 벌). 쓸기는
  가로로 40px 넘게 · 세로보다 크게 움직였을 때만이다 — 세로는 화면 · 시트의 스크롤로 그대로 간다(`touch-action: pan-y`).
  쓸고 난 뒤 따라오는 누름은 버린다(한 번에 두 장 넘지 않게). 화살표는 넘어갈 쪽이 있을 때만 서고, 막대와 같은 일을 하는
  마우스의 길이라 보조기기 · 키보드에는 막대만 읽힌다(새 이름을 짓지 않는다).
*/

const BOUNCE_PX = 14;
const BOUNCE_MS = 280;
/** 이만큼 넘게 가로로 쓸어야 넘긴다 — 누르며 살짝 밀린 손가락은 누름이다 */
const SWIPE_PX = 40;

/** 사진 위의 화살표 — 카드의 ⓘ 와 한 벌인 반투명 검정 동그라미(`ICON_BUTTON_ON_PHOTO_FACE`). 넓은 화면에만 선다 */
const ARROW = `${ICON_BUTTON_ON_PHOTO_FACE} absolute top-1/2 z-[1] hidden -translate-y-1/2 hover:bg-black/60 active:scale-95 lg:grid`;

/** 막대가 서는 카드인가 — 서면 사진 위의 딱지 · ⓘ 가 막대 아래로 내려선다 */
export const pagesPhotos = (card: PhotoFace | DeckCard): boolean => photosOf(card).length > 1;

/**
 * 카드 한 장의 사진 판. `bounce` 는 끝에서 튕길 카드 — 사진만이 아니라 카드 한 장이 움직인다.
 * `initialClass` 는 사진이 없을 때 첫 글자의 크기.
 */
export function CardPhotos({
  card,
  bounce,
  initialClass,
}: {
  card: PhotoFace;
  bounce: RefObject<HTMLElement | null>;
  initialClass?: string;
}) {
  const photos = photosOf(card);
  const [at, setAt] = useState(0);
  /** 쓸기가 시작된 자리 — 누름과 가른다 */
  const press = useRef<{ x: number; y: number } | null>(null);
  /** 방금 쓸어 넘겼다 — 뒤따르는 누름(click)은 버린다 */
  const swiped = useRef(false);

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
      className="absolute inset-0 touch-pan-y"
      onPointerDown={(event) => {
        /* 새 누름이다 — 앞의 쓸기 뒤에 누름(click)이 안 왔어도(터치) 그 표시가 이 누름을 버리지 않게 */
        swiped.current = false;
        press.current = { x: event.clientX, y: event.clientY };
      }}
      onPointerUp={(event) => {
        const start = press.current;
        press.current = null;
        if (start === null) return;
        const dx = event.clientX - start.x;
        const dy = event.clientY - start.y;
        if (Math.abs(dx) < SWIPE_PX || Math.abs(dx) <= Math.abs(dy)) return;
        swiped.current = true;
        step(dx < 0 ? 1 : -1);
      }}
      onPointerCancel={() => {
        press.current = null;
      }}
      onClick={(event) => {
        if (swiped.current) {
          swiped.current = false;
          return;
        }
        const box = event.currentTarget.getBoundingClientRect();
        step(event.clientX - box.left < box.width / 2 ? -1 : 1);
      }}
    >
      <CandidatePhoto card={card} at={at} />
      {at > 0 && (
        <button
          type="button"
          data-photo-prev=""
          aria-hidden="true"
          tabIndex={-1}
          onClick={(event) => {
            event.stopPropagation();
            step(-1);
          }}
          className={`${ARROW} left-3`}
        >
          <Icon name="chevron" className="size-5 rotate-180" />
        </button>
      )}
      {at < photos.length - 1 && (
        <button
          type="button"
          data-photo-next=""
          aria-hidden="true"
          tabIndex={-1}
          onClick={(event) => {
            event.stopPropagation();
            step(1);
          }}
          className={`${ARROW} right-3`}
        >
          <Icon name="chevron" className="size-5" />
        </button>
      )}
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
            className="flex h-6 min-w-0 flex-1 items-start rounded-cell pt-1 focus-visible:outline-2 focus-visible:outline-offset-0 focus-visible:outline-white"
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
