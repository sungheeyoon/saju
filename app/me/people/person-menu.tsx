'use client';

import { useEffect, useRef, useState } from 'react';

import type { Query } from '@/src/lib/input/query';

import { ReviseForm } from '../revise';
import { NoteEditor, RemoveConfirm } from './manage';

/**
 * 카드 하나를 손대는 **한 자리.**
 *
 * 「출생 정보 수정 · 목록에서 빼기 · 메모 넣기」가 밑줄 친 글자 셋으로 카드 아래에
 * 나란히 서 있었다. 셋 다 가끔 쓰는 것인데 늘 자리를 차지했고, 카드마다 그 줄이
 * 반복되면서 목록 전체가 링크밭이 됐다.
 *
 * **자주 쓰는 하나만 버튼으로 남고 나머지는 메뉴 안으로 들어간다.** 카드에서 늘 하는
 * 일은 그 사람의 사주를 여는 것이고, 나머지 셋은 그 사람을 「관리」하는 일이다.
 *
 * 여는 방식은 계정 메뉴와 **같다**(`site-header.tsx`) — `<details>` 하나에 바깥 누름과
 * Esc 로 닫는 자리를 단다. 앱 안에서 화면이 갈리지 않는 자리라 주소를 보지는 않는다.
 */
type Panel = 'revise' | 'note' | 'remove';

export function PersonActions({
  personId,
  label,
  note,
  current,
}: {
  personId: string;
  label: string;
  note: string;
  /** 못 읽는 판본이면 `null` — 그때는 고치는 줄이 메뉴에 없다(빈 폼이 새 판본으로 굳는다) */
  current: Query | null;
}) {
  const menu = useRef<HTMLDetailsElement>(null);
  const [panel, setPanel] = useState<Panel | null>(null);

  const close = () => {
    if (menu.current !== null) menu.current.open = false;
  };

  useEffect(() => {
    const outside = (event: MouseEvent) => {
      if (menu.current !== null && !menu.current.contains(event.target as Node)) close();
    };
    const escape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') close();
    };

    document.addEventListener('mousedown', outside);
    document.addEventListener('keydown', escape);
    return () => {
      document.removeEventListener('mousedown', outside);
      document.removeEventListener('keydown', escape);
    };
  }, []);

  /** 고른 것을 다시 고르면 닫는다 — 메뉴는 열고 닫는 자리이지 상태를 쌓는 자리가 아니다 */
  const choose = (next: Panel) => {
    close();
    setPanel((now) => (now === next ? null : next));
  };

  return (
    <>
      <details ref={menu} className="relative ml-auto shrink-0">
        <summary
          className="grid size-10 cursor-pointer list-none place-items-center rounded-full border border-border bg-surface text-secondary hover:border-accent hover:text-accent [&::-webkit-details-marker]:hidden"
          aria-label={`${label} 관리`}
        >
          <Icon name="manage" />
        </summary>

        {/*
          **위로 연다.** 이 줄은 카드의 맨 아래라, 아래로 열면 다음 카드를 덮는다.
        */}
        <div className="absolute bottom-12 right-0 z-40 w-56 rounded-2xl border border-border bg-surface p-2 shadow-[var(--shadow-float)]">
          {current !== null && (
            <MenuItem icon="pencil" onClick={() => choose('revise')}>
              출생 정보 수정
            </MenuItem>
          )}
          <MenuItem icon="note" onClick={() => choose('note')}>
            {note.trim() === '' ? '메모 넣기' : '메모 고치기'}
          </MenuItem>
          <MenuItem icon="remove" tone="danger" onClick={() => choose('remove')}>
            목록에서 빼기
          </MenuItem>
        </div>
      </details>

      {/*
        `w-full` 이라 줄바꿈해서 제 줄에 선다 — 버튼들이 선 줄 아래다. 패널을 줄 밖에
        따로 두면 여는 메뉴와 열리는 칸이 두 컴포넌트로 갈린다.
      */}
      {panel !== null && (
        <div className="w-full pt-1">
          {panel === 'revise' && current !== null && (
            <ReviseForm
              personId={personId}
              current={current}
              onDone={() => setPanel(null)}
              onCancel={() => setPanel(null)}
            />
          )}
          {panel === 'note' && (
            <NoteEditor
              personId={personId}
              note={note}
              onDone={() => setPanel(null)}
              onCancel={() => setPanel(null)}
            />
          )}
          {panel === 'remove' && (
            <RemoveConfirm personId={personId} label={label} onCancel={() => setPanel(null)} />
          )}
        </div>
      )}
    </>
  );
}

function MenuItem({
  icon,
  tone = 'plain',
  onClick,
  children,
}: {
  icon: IconName;
  tone?: 'plain' | 'danger';
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex w-full items-center gap-2.5 rounded-xl px-3 py-2.5 text-left text-sm font-semibold hover:bg-surface-soft ${
        tone === 'danger' ? 'text-danger' : 'text-foreground'
      }`}
    >
      <Icon name={icon} />
      {children}
    </button>
  );
}

type IconName = 'manage' | 'pencil' | 'note' | 'remove';

function Icon({ name }: { name: IconName }) {
  const paths = {
    /** 연필과 점 셋 — 「고칠 것들이 여기 있다」 */
    manage: (
      <>
        <path d="M4 16.2 14.1 6.1a1.9 1.9 0 0 1 2.7 2.7L6.7 18.9l-3.2.5Z" />
        <path d="M20 15.5h.01M20 19h.01" strokeWidth="2.4" strokeLinecap="round" />
      </>
    ),
    pencil: <path d="M4 16.2 14.1 6.1a1.9 1.9 0 0 1 2.7 2.7L6.7 18.9l-3.2.5Z" />,
    note: (
      <>
        <path d="M5 4.5h14v15H5Z" />
        <path d="M8.5 9h7M8.5 12.5h7M8.5 16h4" strokeLinecap="round" />
      </>
    ),
    remove: (
      <>
        <path d="M5 7h14M9.5 7V4.8h5V7M7 7l.9 12.2h8.2L17 7" />
        <path d="M10.5 10.5v6M13.5 10.5v6" strokeLinecap="round" />
      </>
    ),
  } as const;

  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 24 24"
      className="size-4.5 shrink-0 fill-none stroke-current"
      strokeWidth="1.7"
      strokeLinejoin="round"
    >
      {paths[name]}
    </svg>
  );
}
