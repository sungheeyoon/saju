'use client';

import { useId, useState, type ReactNode } from 'react';

import { Icon } from '../../ui/icons';

/**
 * 거르기 판 — **폰에서는 접히고 넓은 화면에서는 늘 펼쳐진다.**
 *
 * 폰에서는 판이 첫 화면을 다 먹어 신고가 스크롤 한 번 뒤에야 섰다. 접힌 머리에는 지금 거른 것(`summary`)이 서서
 * 열지 않아도 무엇을 보고 있는지 안다. 무엇이든 거른 채로 들어오면 펼친 채 선다 — 방금 고른 칸을 다시 숨기지 않는다.
 * `<details>` 가 아니라 단추인 까닭: 닫힌 `<details>` 의 속은 CSS 로 넓은 화면에서만 펼 수 없다.
 */
export function FilterPanel({
  initiallyOpen,
  summary,
  children,
}: {
  initiallyOpen: boolean;
  summary: string;
  children: ReactNode;
}) {
  const [open, setOpen] = useState(initiallyOpen);
  const panel = useId();

  return (
    <div className="flex flex-col gap-3">
      <button
        type="button"
        aria-expanded={open}
        aria-controls={panel}
        onClick={() => setOpen((was) => !was)}
        className="flex min-h-11 items-center justify-between gap-3 rounded-full border border-border bg-surface px-4 text-sm sm:hidden"
      >
        <span className="min-w-0 truncate">
          <span className="font-semibold">거르기</span>
          <span className="ml-2 text-secondary">{summary}</span>
        </span>
        <Icon name="chevron" className={`size-4 shrink-0 ${open ? '-rotate-90' : 'rotate-90'}`} />
      </button>
      <div id={panel} className={open ? 'block' : 'hidden sm:block'}>
        {children}
      </div>
    </div>
  );
}
