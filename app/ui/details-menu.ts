'use client';

import { useCallback, useEffect, useRef } from 'react';

import { reducedMotion } from './motion';

/**
 * **`<details>` 로 여는 작은 메뉴의 닫는 자리** — 바깥을 누르거나 Esc 를 누르면 닫는다.
 *
 * `<details>` 는 안의 링크 · 단추를 눌러도 스스로 안 닫히고, 바깥 누름과 Esc 도 모른다. 계정 메뉴(`site-header.tsx`)와
 * 사람 관리 메뉴(`app/me/people/person-menu.tsx`)가 같은 두 듣기를 글자까지 같게 따로 들고 있었다(2026-09-26).
 * 대화방 머리의 「⋯」(`app/me/chat/[matchId]/room.tsx`)도 손으로 짠 듣기를 걷고 이것을 쓴다(2026-10-01) — 그 판은
 * Esc 로 닫을 때 초점을 돌려놓지 않았다.
 *
 * Esc 로 닫을 때 초점이 판 안에 있었으면 여는 단추(`<summary>`)로 돌려놓는다 — 닫힌 판 안의 단추에 초점이 남으면
 * 키보드로 쓰는 사람은 화면 어디에 있는지 잃는다.
 *
 * **열린 판은 보이는 자리에 다 선다**(ADR 0168). 폰의 하단 독(`site-header.tsx`)은 화면 바닥에 떠 있어서, 바닥 가까이에서
 * 연 판의 끝 줄을 덮었다 — 프로필 사진 아래 줄의 「삭제」 · 저장한 사람 마지막 카드의 메뉴(2026-10-11). 열 때 판의 끝이 보이는
 * 자리 아래로 나가면 화면을 그만큼만 올린다. 보이는 자리의 바닥은 문서의 `scroll-padding-bottom`(독이 서는 폭에서 독의 높이,
 * `app/globals.css`)을 뺀 곳이고, 올리는 일은 `scrollIntoView` 가 그 여백을 지켜 한다. 위로 여는 판(대화방의 못 보낸 말)과
 * 이미 다 보이는 판은 움직이지 않는다.
 */
export function useDetailsMenu() {
  const menu = useRef<HTMLDetailsElement>(null);

  const close = useCallback(() => {
    if (menu.current !== null) menu.current.open = false;
  }, []);

  useEffect(() => {
    const outside = (event: MouseEvent) => {
      if (menu.current !== null && !menu.current.contains(event.target as Node)) close();
    };
    const escape = (event: KeyboardEvent) => {
      const details = menu.current;
      if (event.key !== 'Escape' || details === null || !details.open) return;
      const focusInside = details.contains(document.activeElement);
      close();
      if (focusInside) details.querySelector('summary')?.focus();
    };

    const details = menu.current;
    const reveal = () => {
      if (details === null || !details.open) return;
      const panel = Array.from(details.children).find((child) => child.tagName !== 'SUMMARY');
      if (panel === undefined) return;
      const reserved = parseFloat(getComputedStyle(document.documentElement).scrollPaddingBottom) || 0;
      if (panel.getBoundingClientRect().bottom <= window.innerHeight - reserved) return;
      panel.scrollIntoView({ block: 'nearest', behavior: reducedMotion() ? 'instant' : 'smooth' });
    };

    document.addEventListener('mousedown', outside);
    document.addEventListener('keydown', escape);
    details?.addEventListener('toggle', reveal);
    return () => {
      document.removeEventListener('mousedown', outside);
      document.removeEventListener('keydown', escape);
      details?.removeEventListener('toggle', reveal);
    };
  }, [close]);

  return { menu, close };
}
