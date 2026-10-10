'use client';

import { useEffect, type RefObject } from 'react';

/** 방이 화면 전체인 폭 — `room.module.css` 의 폰 규칙과 같은 경계다 */
const PHONE_QUERY = '(max-width: 767.98px)';

/**
 * **폰에서 화면 자판이 올라오면 방의 높이를 보이는 자리에 맞춘다**(G-89).
 *
 * Android Chrome 은 방 페이지 viewport 의 `interactive-widget=resizes-content`(`page.tsx`)로 자판만큼 `100dvh` 가 줄어 방 머리와
 * 입력칸이 제자리에 남는다. iOS Safari 는 그 값을 모른다 — 자판이 올라와도 `100dvh` 는 그대로이고 페이지를 밀어 올려 입력칸을
 * 보이므로 방 머리가 화면 밖으로 나간다. 그래서 보이는 자리(`visualViewport`)의 높이를 `--room-height` 로 방에 주고, 밀려
 * 올라간 페이지를 맨 위로 되돌린다 — 방이 보이는 자리와 같은 높이라 입력칸은 자판 바로 위에 선다.
 *
 * 넓은 화면에서는 아무것도 안 한다(방의 높이를 두 칸 틀이 정한다).
 */
export function useRoomHeight(room: RefObject<HTMLElement | null>) {
  useEffect(() => {
    const viewport = window.visualViewport;
    const element = room.current;
    if (viewport === null || element === null) return;
    const phone = window.matchMedia(PHONE_QUERY);

    const fit = () => {
      if (!phone.matches) {
        element.style.removeProperty('--room-height');
        return;
      }
      element.style.setProperty('--room-height', `${Math.round(viewport.height)}px`);
      if (viewport.offsetTop > 0 || window.scrollY > 0) window.scrollTo(0, 0);
    };

    fit();
    viewport.addEventListener('resize', fit);
    viewport.addEventListener('scroll', fit);
    phone.addEventListener('change', fit);
    return () => {
      viewport.removeEventListener('resize', fit);
      viewport.removeEventListener('scroll', fit);
      phone.removeEventListener('change', fit);
      element.style.removeProperty('--room-height');
    };
  }, [room]);
}
