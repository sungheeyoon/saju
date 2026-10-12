'use client';

import { useRouter } from 'next/navigation';
import { useRef, useState, type ReactNode } from 'react';

import {
  BUY_CREDITS_LABEL,
  CREDITS_DIALOG_CLOSE,
  creditsHeldTitle,
  SALE_CLOSED_NOTE,
  SALE_CLOSED_OK,
} from '@/src/lib/reading/notes';

import { ConfirmDialog } from '../../ui/confirm-dialog';
import { Icon } from '../../ui/icons';
import { saleIsOpenNow } from './asked-on-press';
import { CREDITS_PATH, saleShapeOf } from './buy-path';

/**
 * **풀이권 창 한 벌** — 머리글의 풀이권 칸과 풀이권 0개일 때의 누름(풀이 · 궁합풀이 · 인연 요청)이 같이 연다(운영자 결정 2026-10-12,
 * ADR 0171 「덧」). 누르면 곧장 옮기지 않고 창 하나가 선다 — 제목은 보유 수(「보유 풀이권 N개」).
 *
 * - 판매가 이 계정에게 열렸으면(지금은 카드사 심사 계정) 「풀이권 구매」(→ `/me/credits`) · 「닫기」. 결제 내역 링크는 두지 않는다(ADR 0171 「덧」).
 * - 닫혔으면 한 줄(「지금은 비공개 베타라 …」)과 「확인」 하나(ADR 0166 「덧」).
 *
 * 판매 열림은 **누를 때** 묻는다(`my_reading_sale_is_open()`, `sale.ts`) — 머리글은 모든 화면에 서므로 그릴 때 물으면 화면마다 문
 * 하나가 더 불린다. 못 물었으면 열린 꼴이다(`saleShapeOf`). `/me/credits` 를 주소로 연 사람은 그 화면이 제 판정을 한다.
 *
 * `notice` 는 부르는 쪽이 제 자리에 그린다 — 창은 `<dialog>` 라 어디에 서도 화면 가운데에 뜬다.
 */
export function useBuyCredits(): { offer: (available: number) => void; checking: boolean; notice: ReactNode } {
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
      title={creditsHeldTitle(shown?.available ?? 0)}
      confirmLabel={open ? BUY_CREDITS_LABEL : SALE_CLOSED_OK}
      onConfirm={() => {
        close();
        if (open) router.push(CREDITS_PATH);
      }}
      firstFocus="confirm"
      cancelLabel={open ? CREDITS_DIALOG_CLOSE : null}
    >
      {open ? undefined : <p>{SALE_CLOSED_NOTE}</p>}
    </ConfirmDialog>
  );

  return { offer, checking, notice };
}
