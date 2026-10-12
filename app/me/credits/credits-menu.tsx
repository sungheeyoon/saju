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
import { MENU_PANEL, TYPE_META } from '../../ui/surfaces';
import { useDetailsMenu } from '../../ui/details-menu';
import { saleIsOpenNow } from './asked-on-press';
import { CREDITS_PATH, saleShapeOf } from './buy-path';

/**
 * 상단 풀이권은 설정처럼 펼친다 — 잔액 · 사용처 · 구매 길(B안, 운영자 2026-10-12).
 *
 * **판은 설정 메뉴(`site-header.tsx` 의 톱니)와 한 벌이다** — 모서리 `1.25rem` · 그림자 `shadow-float` · 테 `ring-border` · 폭 `w-72` ·
 * 머리글 아래 같은 높이(62px)에 선다. 폰에서는 이 칸이 화면 오른쪽 끝이 아니라(종 · 톱니가 오른쪽에 있다) 단추 밑에 붙이면 판이 화면 왼쪽
 * 밖으로 나간다 — 그래서 화면에 붙여(`fixed`) 설정 판과 같은 오른쪽 끝(16px)에 세운다. 안쪽 여백은 설정 판의 글자 들여쓰기(판 8px + 줄
 * 12px)와 같은 20px 다. 글자는 앱의 단(`TYPE_META` 13px · 본문 15px · 큰 수는 홈의 수와 같은 2rem 굵게)이다.
 */
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
      {/* 랜드마크(`section` + 이름)로 세우지 않는다 — 설정 판처럼 여는 단추(`summary`)의 이름이 이 판의 이름이다 */}
      <div className={`${MENU_PANEL} fixed right-4 top-15.5 z-50 w-72 max-w-[calc(100vw-2rem)] p-5 sm:absolute sm:right-0 sm:top-12`}>
        <p className={TYPE_META}>{CREDITS_AVAILABLE_LABEL}</p>
        <p className="mt-2 flex items-baseline gap-1.5 text-[2rem] font-bold leading-none tabular-nums text-foreground">
          {available}<span className="text-[17px] font-semibold">개</span>
        </p>
        <p className="mt-4 text-[15px] leading-6 text-secondary">{CREDITS_USAGE_NOTE}</p>
        <p className={`mt-1 ${TYPE_META}`}>{CREDITS_USAGE_RATE}</p>
        {shape === 'closed' ? (
          <p className="mt-4 border-t border-border pt-4 text-[15px] leading-6 text-secondary">{SALE_CLOSED_NOTE}</p>
        ) : shape === 'open' ? (
          <Link href={CREDITS_PATH} onClick={close} className={`mt-5 w-full ${BUTTON_PRIMARY}`}>{BUY_CREDITS_LABEL}</Link>
        ) : (
          /*
            판매를 묻는 동안 — 잠그지 않는다(`disabled` 는 초점을 빼서 낭독기가 단추를 건너뛴다, ADR 0160). 「풀이권 구매」로 읽히고
            「흐리게 · 바쁨」이 함께 들리며, 눌러도 아무 일이 없다. 답이 오면 이 자리가 링크나 판매 준비 줄로 바뀐다
          */
          <button type="button" aria-disabled="true" aria-busy="true" className={`mt-5 w-full ${BUTTON_PRIMARY}`}>{BUY_CREDITS_LABEL}</button>
        )}
      </div>
    </details>
  );
}
