'use client';

import { useRouter } from 'next/navigation';
import { useRef, useState, type ReactNode } from 'react';

import {
  BUY_CREDITS_LABEL,
  CREDITS_SHORTAGE_TITLE,
  CREDITS_AVAILABLE_LABEL,
  CREDITS_REQUIRED_LABEL,
  CREDITS_DIALOG_CLOSE,
  creditsHeldTitle,
  SALE_CLOSED_NOTE,
  SALE_CLOSED_OK,
} from '@/src/lib/reading/notes';

import { ConfirmDialog } from '../../ui/confirm-dialog';
import { Icon } from '../../ui/icons';
import { saleIsOpenNow } from './asked-on-press';
import { CREDITS_PATH, saleShapeOf } from './buy-path';

/** 풀이 · 궁합풀이 · 인연 요청에 풀이권이 부족하면 보유 수와 필요 수를 함께 보여준다(B안, 운영자 2026-10-12). */
export type CreditsNeed = 'reading' | 'request';

export function useBuyCredits(): {
  offer: (available: number, need?: CreditsNeed) => void;
  checking: boolean;
  notice: ReactNode;
} {
  const router = useRouter();
  const [checking, setChecking] = useState(false);
  const [shown, setShown] = useState<{ available: number; shape: 'closed' | 'open'; need: CreditsNeed | null } | null>(null);
  const asking = useRef(false);

  const offer = (available: number, need?: CreditsNeed) => {
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
      setShown({ available, shape, need: need ?? null });
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
      title={shown?.need == null ? creditsHeldTitle(shown?.available ?? 0) : CREDITS_SHORTAGE_TITLE}
      confirmLabel={open ? BUY_CREDITS_LABEL : SALE_CLOSED_OK}
      onConfirm={() => {
        close();
        if (open) router.push(CREDITS_PATH);
      }}
      firstFocus="confirm"
      cancelLabel={open ? CREDITS_DIALOG_CLOSE : null}
    >
      {shown?.need == null && open ? undefined : (
        <>
          {shown?.need != null && (
            <dl className="space-y-2">
              <div className="flex justify-between gap-4"><dt>{CREDITS_AVAILABLE_LABEL}</dt><dd className="font-semibold tabular-nums">{shown.available}개</dd></div>
              <div className="flex justify-between gap-4"><dt>{CREDITS_REQUIRED_LABEL}</dt><dd className="font-semibold tabular-nums">1개</dd></div>
            </dl>
          )}
          {!open && <p>{SALE_CLOSED_NOTE}</p>}
        </>
      )}
    </ConfirmDialog>
  );

  return { offer, checking, notice };
}
