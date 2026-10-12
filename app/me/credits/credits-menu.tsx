'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useRef, useState, type ReactNode } from 'react';

import {
  BUY_CREDITS_LABEL,
  CREDITS_AVAILABLE_LABEL,
  CREDITS_USAGE_NOTE,
  CREDITS_USAGE_RATE,
  SALE_CLOSED_NOTE,
} from '@/src/lib/reading/notes';

import { BUTTON_PRIMARY } from '../../ui/buttons';
import { useDetailsMenu } from '../../ui/details-menu';
import { saleIsOpenNow } from './asked-on-press';
import { CREDITS_PATH, saleShapeOf } from './buy-path';

/** 상단 풀이권은 설정처럼 펼친다 — 잔액 · 사용처 · 구매 길(B안, 운영자 2026-10-12). */
export function CreditsMenu({ available, label, children, className }: {
  available: number;
  label: string;
  children: ReactNode;
  className: string;
}) {
  const pathname = usePathname();
  const { menu, close } = useDetailsMenu();
  const [shape, setShape] = useState<'open' | 'closed' | null>(null);
  const request = useRef(0);
  const shownAt = useRef(pathname);

  useEffect(() => {
    if (shownAt.current === pathname) return;
    shownAt.current = pathname;
    close();
  }, [pathname, close]);

  useEffect(() => () => { request.current += 1; }, []);

  const checkSale = async () => {
    const turn = ++request.current;
    if (!menu.current?.open) return;
    setShape(null);
    let next: 'open' | 'closed' = 'open';
    try {
      next = saleShapeOf(await saleIsOpenNow());
    } catch {
      // 못 물었으면 상품 화면이 다시 확인한다(ADR 0171).
    }
    if (turn === request.current && menu.current?.open) setShape(next);
  };

  return (
    <details ref={menu} onToggle={() => { void checkSale(); }} className="relative shrink-0">
      <summary aria-label={label} className={`${className} list-none [&::-webkit-details-marker]:hidden`}>
        {children}
      </summary>
      <section aria-label={label} className="fixed inset-x-4 top-20 z-50 rounded-[1.5rem] bg-surface p-6 shadow-float ring-1 ring-border sm:absolute sm:inset-x-auto sm:right-0 sm:top-13 sm:w-80">
        <p className="text-[13px] text-muted">{CREDITS_AVAILABLE_LABEL}</p>
        <p className="mt-2 flex items-baseline gap-2 text-[30px] font-semibold tabular-nums leading-tight">
          {available}<span className="text-[17px] font-normal">개</span>
        </p>
        <p className="mt-5 text-sm leading-6 text-secondary">{CREDITS_USAGE_NOTE}</p>
        <p className="mt-2 text-[13px] leading-5 text-secondary">{CREDITS_USAGE_RATE}</p>
        {shape === 'closed' ? (
          <p className="mt-5 border-t border-border pt-4 text-sm leading-6 text-secondary">{SALE_CLOSED_NOTE}</p>
        ) : shape === 'open' ? (
          <Link href={CREDITS_PATH} onClick={close} className={`mt-6 w-full ${BUTTON_PRIMARY}`}>{BUY_CREDITS_LABEL}</Link>
        ) : (
          <button type="button" disabled aria-busy="true" className={`mt-6 w-full ${BUTTON_PRIMARY}`}>{BUY_CREDITS_LABEL}</button>
        )}
      </section>
    </details>
  );
}
