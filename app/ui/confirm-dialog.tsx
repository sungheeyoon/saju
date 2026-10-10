'use client';

import { useEffect, useId, useRef, type MouseEvent, type ReactNode } from 'react';

import { BUTTON_DANGER, BUTTON_PRIMARY, BUTTON_SECONDARY } from './buttons';
import { DIALOG, DIALOG_ACTIONS, TYPE_NAME } from './surfaces';

/**
 * **확인 창을 연다 — 되돌릴 수 없는 창이면 첫 초점은 「취소」다**(2026-10-10 화면 점검 B5).
 *
 * `showModal()` 은 창 안의 첫 단추에 초점을 준다. 확인 창은 누르는 쪽이 먼저 서므로(`DIALOG_ACTIONS` — 좁은 화면에서 위)
 * 첫 초점이 「다시 받기」 · 「목록에서 빼기」였고, 키보드로 연 사람이 Enter 한 번에 되돌릴 수 없는 일을 했다. 단추의 차례는
 * 그대로 두고 초점만 옮긴다 — 창 안에서 `CONFIRM_FIRST_FOCUS` 를 단 단추가 받는다. 단 단추가 없으면 브라우저 기본이다.
 *
 * React 의 `autoFocus` 는 그리는 순간에 `focus()` 를 부를 뿐 속성을 안 남겨, 닫힌 채 실려 오는 `<dialog>` 에서는 듣지 않는다.
 */
export const CONFIRM_FIRST_FOCUS = { 'data-first-focus': '' } as const;

export function openConfirmDialog(dialog: HTMLDialogElement | null): void {
  if (dialog === null || dialog.open) return;
  dialog.showModal();
  dialog.querySelector<HTMLElement>('[data-first-focus]')?.focus();
}

/**
 * 창 바깥(어두운 면)을 눌렀나 — 창이 여백을 든 판(`DIALOG`)이라 「누른 것이 창 자신이냐」로는 못 가른다. 창의 테두리 밖인지를 잰다.
 * 키보드로 누른 단추는 대상이 단추라 여기 안 걸린다.
 */
export function pressedOutside(event: MouseEvent<HTMLDialogElement>): boolean {
  if (event.target !== event.currentTarget) return false;
  const box = event.currentTarget.getBoundingClientRect();
  return event.clientX < box.left || event.clientX > box.right || event.clientY < box.top || event.clientY > box.bottom;
}

/**
 * **확인 창 한 벌** — 되돌리기 어려운 누름 앞에서 한 번 묻는 창은 모두 이 부품이다(ADR 0166).
 *
 * 모양 · 몸짓이 창마다 갈렸다 — 단추 차례(차단은 확인이 왼쪽), 바깥 누름(닫히는 창 · 안 닫히는 창), 첫 초점(실행 단추에
 * 선 창 셋). 여기서 한 벌로 묶는다:
 *
 * - 단추는 `DIALOG_ACTIONS` — 실행이 오른쪽(좁은 화면에서 위), 「취소」가 그 옆. 닫는 X 는 없다 — 닫는 것은 「취소」다(대장 01).
 * - **첫 초점은 「취소」다** — Enter 한 번에 되돌릴 수 없는 일이 나지 않게. 풀이권 처음 받기처럼 잃을 것이 없는 창만
 *   `firstFocus="confirm"` 이다.
 * - Esc · 바깥 누름 · 「취소」는 같은 일(닫기)이다. 보내는 동안(`busy`)은 셋 다 안 닫는다.
 *
 * 열림은 부르는 쪽의 값(`open`)이 정하고, 창이 닫히면(어느 길로든) `onClose` 를 부른다 — 부르는 쪽은 거기서 값을 내린다.
 */
export function ConfirmDialog({
  open,
  onClose,
  title,
  children,
  lead,
  confirmLabel,
  onConfirm,
  danger = false,
  busy = false,
  failure = null,
  firstFocus = 'cancel',
  cancelLabel = '취소',
  className,
}: {
  open: boolean;
  onClose: () => void;
  title: ReactNode;
  /** 제목 아래 본문 — 문단 하나 이상 */
  children?: ReactNode;
  /** 제목 위에 서는 그림(아이콘 · 사진) */
  lead?: ReactNode;
  confirmLabel: ReactNode;
  onConfirm: () => void;
  /** 되돌릴 수 없는 실행이면 위험 색 */
  danger?: boolean;
  busy?: boolean;
  /** 실행이 거절됐을 때의 한 줄 — 창은 열린 채 선다 */
  failure?: ReactNode;
  firstFocus?: 'cancel' | 'confirm';
  cancelLabel?: string;
  /** 판에 덧붙이는 것 — 오행 색(`elementScope`) · 자리 */
  className?: string;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const titleId = useId();

  useEffect(() => {
    const node = dialog.current;
    if (node === null) return;
    if (open) openConfirmDialog(node);
    else if (node.open) node.close();
  }, [open]);

  return (
    <dialog
      ref={dialog}
      aria-labelledby={titleId}
      /*
        닫힘 · Esc 는 React 가 부모 쪽으로 다시 흘린다 — 창이 시트 안에 서면(받은 요청 시트의 거절 · 차단) Esc 한 번에 시트까지
        닫혔다. 이 창에서 멈춘다
      */
      onClose={(event) => {
        event.stopPropagation();
        onClose();
      }}
      onCancel={(event) => {
        event.stopPropagation();
        if (busy) event.preventDefault();
      }}
      onClick={(event) => {
        /* 창 안의 누름이 뒤의 판(시트 · 카드)으로 번지지 않게 */
        event.stopPropagation();
        if (!busy && pressedOutside(event)) dialog.current?.close();
      }}
      className={className === undefined ? DIALOG : `${DIALOG} ${className}`}
    >
      {lead}
      <h2 id={titleId} className={lead === undefined ? TYPE_NAME : `mt-4 ${TYPE_NAME}`}>
        {title}
      </h2>
      {children !== undefined && <div className="mt-2 flex flex-col gap-2 text-[15px] leading-6 text-secondary">{children}</div>}
      {failure !== null && failure !== undefined && (
        <p role="alert" className="mt-3 text-sm text-danger">
          {failure}
        </p>
      )}
      <div className={DIALOG_ACTIONS}>
        <button
          type="button"
          onClick={onConfirm}
          disabled={busy}
          className={danger ? BUTTON_DANGER : BUTTON_PRIMARY}
          {...(firstFocus === 'confirm' ? CONFIRM_FIRST_FOCUS : {})}
        >
          {confirmLabel}
        </button>
        <button
          type="button"
          onClick={() => dialog.current?.close()}
          disabled={busy}
          className={BUTTON_SECONDARY}
          {...(firstFocus === 'cancel' ? CONFIRM_FIRST_FOCUS : {})}
        >
          {cancelLabel}
        </button>
      </div>
    </dialog>
  );
}
