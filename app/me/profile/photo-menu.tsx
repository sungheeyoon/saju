import type { ComponentProps, ReactNode } from 'react';

import { useDetailsMenu } from '../../ui/details-menu';
import { Icon, type IconName } from '../../ui/icons';
import { MENU_PANEL } from '../../ui/surfaces';

/** 사진 칸 메뉴의 한 줄 */
export type MenuChoice = { icon: IconName; label: string; tone?: 'danger'; run: () => void };

/**
 * 사진 칸 하나의 메뉴 — **사진 자체가 여는 자리다**(`<summary>`). 계정 메뉴 · 사람 관리 메뉴와 같은 `<details>` 한 벌이라
 * 바깥 누름 · Esc 로 닫히고 Esc 면 초점이 그 사진으로 돌아온다(`useDetailsMenu`). 고르면 먼저 닫고 그 일을 한다.
 */
export function PhotoMenu({
  summary,
  items,
  align,
  children,
}: {
  summary: Omit<ComponentProps<'summary'>, 'ref'> & { ref: (element: HTMLElement | null) => void };
  items: readonly MenuChoice[];
  align: string;
  children: ReactNode;
}) {
  const { menu, close } = useDetailsMenu();
  return (
    <details ref={menu} className="group relative h-full w-full">
      <summary {...summary}>{children}</summary>
      <div
        className={`${MENU_PANEL} absolute z-40 flex w-44 flex-col p-1.5 ${align}`}
      >
        {items.map((item) => (
          <button
            key={item.label}
            type="button"
            onClick={() => {
              close();
              item.run();
            }}
            className={`flex min-h-11 w-full items-center gap-2.5 rounded-2xl px-3 text-left text-body font-semibold hover:bg-surface-sunken ${
              item.tone === 'danger' ? 'text-danger' : 'text-foreground'
            }`}
          >
            <Icon name={item.icon} className="size-4.5" />
            {item.label}
          </button>
        ))}
      </div>
    </details>
  );
}
