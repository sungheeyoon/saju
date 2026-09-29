'use client';

import Link from 'next/link';
import type { ComponentProps, MouseEvent } from 'react';

import { writeParams } from './hash-query';

/**
 * **궁합 화면의 두 칸을 채우는 링크** — 같은 화면 안에서 누르면 주소의 `#` 뒤만 갈아 끼운다(ADR 0129 「2026-09-29 e+」).
 *
 * 궁합 탭의 관계 지도 · 사람 타일은 「나와 궁합」을 `/compat#a.person=…&b.person=…` 로 잇는다. 다른 화면에서 누르면 평소의
 * 이동이다. 그런데 **같은 `/compat` 안에서 누르면 칸이 안 채워졌다** — Next 는 `#` 만 바뀐 이동을 `history.pushState` 로
 * 적고, 그것은 `popstate` 도 `hashchange` 도 일으키지 않아 고르는 칸의 구독(`hash-query.ts`)이 모른다. 그래서 같은
 * 화면이면 이동을 멈추고 `writeParams` 로 적는다 — 그 문은 구독자에게 알린다. 새 탭으로 여는 누름은 건드리지 않는다.
 */
export function CompatFillLink({ href, ...rest }: Omit<ComponentProps<typeof Link>, 'href' | 'onClick'> & { href: string }) {
  const fill = (event: MouseEvent<HTMLAnchorElement>) => {
    if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
    const url = new URL(href, window.location.href);
    if (url.pathname !== window.location.pathname || url.hash === '') return;
    event.preventDefault();
    writeParams(url.hash.slice(1), 'push');
  };

  return <Link href={href} onClick={fill} {...rest} />;
}
