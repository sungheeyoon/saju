import type { ComponentProps, ReactNode } from 'react';

/**
 * 사진 칸 하나 — **사진 자체가 여는 자리다**(단추). 누르면 그 장의 크게 보기(`PhotoViewer`)가 열리고, 할 일은 거기 「⋯」에 있다
 * (2026-10-24, 카카오톡 프로필 사진 보기 · iPhone 사진 앱과 같은 꼴). 길게 누르면 들려 옮겨진다(`usePhotoDrag`) — 탭은 열기,
 * 길게 누름은 옮기기로 갈린다(Google 포토의 탭 = 열기 · 길게 탭 = 고르기와 같은 가름).
 *
 * 여는 단추의 누름이 막혔으면(들었다 놓은 누름 · 처리하는 동안 — 부르는 쪽이 `preventDefault`) 보기를 안 연다.
 */
export function PhotoMenu({
  opener,
  onOpen,
  children,
}: {
  opener: Omit<ComponentProps<'button'>, 'ref' | 'type'> & { ref: (element: HTMLElement | null) => void };
  onOpen: () => void;
  children: ReactNode;
}) {
  const { onClick, ...rest } = opener;
  return (
    <button
      type="button"
      aria-haspopup="dialog"
      {...rest}
      onClick={(event) => {
        onClick?.(event);
        if (!event.defaultPrevented) onOpen();
      }}
    >
      {children}
    </button>
  );
}
