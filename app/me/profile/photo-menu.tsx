import { useState, type ComponentProps, type ReactNode } from 'react';

import { ActionSheet, type ActionChoice } from '../../ui/action-sheet';

/** 사진 칸 판의 한 줄 */
export type MenuChoice = ActionChoice;

/**
 * 사진 칸 하나와 그 칸의 고르기 판 — **사진 자체가 여는 자리다**(단추). 누르면 아래에서 판이 올라온다(`ActionSheet`,
 * 카카오톡 「프로필 사진 설정」과 같은 꼴, 2026-10-24). 사진 위에 뜨던 작은 메뉴(`<details>`)는 옆 장을 가리고 폰의 하단 독에
 * 끝 줄이 덮였다. Esc · 바깥 누름 · 「취소」로 닫히고 초점은 그 사진으로 돌아온다.
 *
 * 여는 단추의 누름이 막혔으면(들었다 놓은 누름 · 처리하는 동안 — 부르는 쪽이 `preventDefault`) 판을 안 연다.
 */
export function PhotoMenu({
  opener,
  choices,
  label,
  children,
}: {
  opener: Omit<ComponentProps<'button'>, 'ref' | 'type'> & { ref: (element: HTMLElement | null) => void };
  choices: readonly MenuChoice[];
  /** 판의 이름(보조기기) */
  label: string;
  children: ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const { onClick, ...rest } = opener;
  return (
    <>
      <button
        type="button"
        aria-haspopup="dialog"
        aria-expanded={open}
        {...rest}
        onClick={(event) => {
          onClick?.(event);
          if (!event.defaultPrevented) setOpen(true);
        }}
      >
        {children}
      </button>
      <ActionSheet open={open} onClose={() => setOpen(false)} label={label} choices={choices} />
    </>
  );
}
