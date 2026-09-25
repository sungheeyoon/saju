'use client';

import { useCallback, useEffect, useRef } from 'react';

/**
 * **`<details>` 로 여는 작은 메뉴의 닫는 자리** — 바깥을 누르거나 Esc 를 누르면 닫는다.
 *
 * `<details>` 는 안의 링크 · 단추를 눌러도 스스로 안 닫히고, 바깥 누름과 Esc 도 모른다. 계정 메뉴(`site-header.tsx`)와
 * 사람 관리 메뉴(`app/me/people/person-menu.tsx`)가 같은 두 듣기를 글자까지 같게 따로 들고 있었다(2026-09-26).
 *
 * Esc 로 닫을 때 초점이 판 안에 있었으면 여는 단추(`<summary>`)로 돌려놓는다 — 닫힌 판 안의 단추에 초점이 남으면
 * 키보드로 쓰는 사람은 화면 어디에 있는지 잃는다.
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

    document.addEventListener('mousedown', outside);
    document.addEventListener('keydown', escape);
    return () => {
      document.removeEventListener('mousedown', outside);
      document.removeEventListener('keydown', escape);
    };
  }, [close]);

  return { menu, close };
}
