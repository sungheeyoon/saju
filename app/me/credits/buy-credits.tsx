'use client';

import { useRouter } from 'next/navigation';
import { useRef, useState, type ReactNode } from 'react';

import {
  BUY_CREDITS_LABEL,
  CREDITS_SHORTAGE_TITLE,
  CREDITS_AVAILABLE_LABEL,
  CREDITS_REQUIRED_LABEL,
  CREDITS_DIALOG_CLOSE,
  SALE_CLOSED_NOTE,
  SALE_CLOSED_OK,
} from '@/src/lib/reading/notes';

import { ConfirmDialog } from '../../ui/confirm-dialog';
import { Icon } from '../../ui/icons';
import { saleIsOpenNow } from './asked-on-press';
import { saleShapeOf } from './buy-path';
import { creditsPathFrom } from './return-to';

/**
 * 풀이 · 궁합풀이 · 인연 요청에 풀이권이 부족하면 보유 수와 필요 수를 함께 보여준다(B안, 운영자 2026-10-12). 머리글은 이 창을 열지 않는다 —
 * 머리글은 펼침 메뉴다(`credits-menu.tsx`).
 */
export function useBuyCredits(): {
  offer: (available: number) => void;
  checking: boolean;
  notice: ReactNode;
} {
  const router = useRouter();
  const [checking, setChecking] = useState(false);
  const [shown, setShown] = useState<{ available: number; shape: 'closed' | 'open' } | null>(null);
  const asking = useRef(false);

  const offer = (available: number) => {
    if (asking.current) return;
    asking.current = true;
    setChecking(true);
    void (async () => {
      let shape: 'closed' | 'open' = 'open';
      try {
        shape = saleShapeOf(await saleIsOpenNow());
      } catch {
        /* 부름이 던졌다(망) — 열린 꼴이다. 상품 화면이 다시 묻고 실패를 말한다 */
      } finally {
        asking.current = false;
        setChecking(false);
      }
      setShown({ available, shape });
    })();
  };

  const close = () => setShown(null);
  const open = shown?.shape === 'open';

  const notice = (
    <ConfirmDialog
      open={shown !== null}
      onClose={close}
      lead={
        <span aria-hidden="true" className="grid size-11 place-items-center rounded-full bg-cream text-cream-ink">
          <Icon name="ticket" className="size-5" />
        </span>
      }
      title={CREDITS_SHORTAGE_TITLE}
      confirmLabel={open ? BUY_CREDITS_LABEL : SALE_CLOSED_OK}
      onConfirm={() => {
        close();
        /* 결제 뒤 이 화면으로 돌아오게 지금 주소를 싣는다(`return-to.ts`) */
        if (open) router.push(creditsPathFrom(`${window.location.pathname}${window.location.search}`));
      }}
      firstFocus="confirm"
      cancelLabel={open ? CREDITS_DIALOG_CLOSE : null}
    >
      <dl className="space-y-2">
        <div className="flex justify-between gap-4"><dt>{CREDITS_AVAILABLE_LABEL}</dt><dd className="font-semibold tabular-nums">{shown?.available ?? 0}장</dd></div>
        <div className="flex justify-between gap-4"><dt>{CREDITS_REQUIRED_LABEL}</dt><dd className="font-semibold tabular-nums">1장</dd></div>
      </dl>
      {!open && <p>{SALE_CLOSED_NOTE}</p>}
    </ConfirmDialog>
  );

  return { offer, checking, notice };
}
