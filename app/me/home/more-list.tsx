'use client';

import { useState, type ReactNode } from 'react';

import { Icon } from '../../ui/icons';
import { HOME_LIST } from './home-list';

/** 접힌 목록 아래의 줄 글자 — 당근 · 카카오톡의 「더보기」 / 「접기」 */
const MORE = '더보기';
const LESS = '접기';

/**
 * **홈 목록의 「더보기」** — 줄이 많으면 앞의 몇 줄만 서고, 판 맨 아래 가운데 「더보기 ⌄」가 그 자리에서 나머지를 편다(2026-10-26 운영자).
 *
 * 당근페이 홈의 「진행 중인 거래」가 두 줄 아래 「전체보기 ⌄」로 같은 판을 펴고, 머리의 「>」는 따로 전체 화면으로 가는 것과 같은 짜임이다 —
 * 머리의 「모두 보기」(풀이 보관함) · 「관리」(사람 관리)는 그대로 넘어가는 길이고, 이 줄은 홈 안에서 펴는 일만 한다.
 *
 * 숨기는 것은 CSS 다(`collapsed` — 부르는 쪽이 「몇째 줄부터」를 글자 클래스로 준다). 줄은 서버가 다 그려 두고 자바스크립트가 없으면 접힌
 * 채로 선다 — 그때는 머리의 길이 전부를 든다.
 */
export function MoreList({
  listClass = '',
  collapsed,
  more,
  moreWide = more,
  children,
}: {
  /** `<ul>` 에 더할 클래스(넓은 화면 두 열 등) */
  listClass?: string;
  /** 접혔을 때 `<ul>` 에 붙는 클래스 — 숨길 줄을 고른다 */
  collapsed: string;
  /** 숨은 줄이 있나 — 없으면 「더보기」 줄이 안 선다 */
  more: boolean;
  /** 넓은 화면(lg)에서도 숨은 줄이 있나 — 없으면 그 폭에서는 「더보기」 줄을 숨긴다 */
  moreWide?: boolean;
  children: ReactNode;
}) {
  const [open, setOpen] = useState(false);
  return (
    <div className={HOME_LIST}>
      <ul className={`flex flex-col ${listClass} ${more && !open ? collapsed : ''}`}>{children}</ul>
      {more && (
        <button
          type="button"
          aria-expanded={open}
          onClick={() => setOpen((now) => !now)}
          className={`-mt-px flex min-h-12 items-center justify-center gap-1 border-t border-border text-small font-medium text-secondary hover:bg-surface-sunken ${moreWide ? '' : 'lg:hidden'}`}
        >
          {open ? LESS : MORE}
          <Icon name="chevron" className={`size-4 ${open ? '-rotate-90' : 'rotate-90'}`} />
        </button>
      )}
    </div>
  );
}
