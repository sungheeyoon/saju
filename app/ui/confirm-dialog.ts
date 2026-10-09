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
