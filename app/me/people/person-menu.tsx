'use client';

import { useState } from 'react';

import type { Query } from '@/src/lib/input/query';

import { ICON_BUTTON } from '../../ui/buttons';
import { useDetailsMenu } from '../../ui/details-menu';
import { Icon, type IconName } from '../../ui/icons';
import { EditInputForm } from '../edit-input';
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
 * Esc 로 닫는 자리를 단다(`useDetailsMenu`). 앱 안에서 화면이 갈리지 않는 자리라 주소를 보지는 않는다.
 *
 * **버튼은 카드 오른쪽 위 모서리에 떠 있고, 열린 칸은 흐름 안에 선다.** 아래 띠는 이제
 * 사주풀이가 쓰고, 손대는 자리는 읽는 것 위에 얹히지 않는 구석으로 물러난다.
 *
 * 타일은 통째로 상세로 가는 링크라(이름 링크의 `after:` 덮개) 여기 서는 것은 전부 그 덮개보다 **위**에
 * 뜬다(`z-*`). 고치는 칸 · 메모 칸은 `data-panel` 을 달아 목록이 그 타일을 줄 전체로 넓히게 한다(`finder.tsx`).
 */
type Panel = 'edit-input' | 'note' | 'remove';

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
  const { menu, close } = useDetailsMenu();
  const [panel, setPanel] = useState<Panel | null>(null);

  /** 고른 것을 다시 고르면 닫는다 — 메뉴는 열고 닫는 자리이지 상태를 쌓는 자리가 아니다 */
  const choose = (next: Panel) => {
    close();
    setPanel((now) => (now === next ? null : next));
  };

  return (
    <>
      <details ref={menu} className="absolute right-3 top-3 z-20 sm:right-4 sm:top-4">
        <summary
          className={`${ICON_BUTTON} list-none text-secondary hover:text-foreground [&::-webkit-details-marker]:hidden`}
          aria-label={`${label} 관리`}
        >
          <Icon name="manage" className="size-4.5" />
        </summary>

        <div className="absolute right-0 top-13 z-40 w-56 rounded-[1.25rem] border border-border bg-surface p-1.5 shadow-float">
          {current !== null && (
            <MenuItem icon="pencil" onClick={() => choose('edit-input')}>
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
        열린 칸은 카드 본문의 **마지막 줄**로 선다 — 여는 메뉴와 열리는 칸을 두
        컴포넌트로 가르지 않으려고 한 자리에 둔다.
      */}
      {panel !== null && (
        <div className="relative z-10 mt-1" data-panel={panel === 'remove' ? undefined : panel}>
          {panel === 'edit-input' && current !== null && (
            <EditInputForm
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
      className={`flex min-h-11 w-full items-center gap-2.5 rounded-2xl px-3 text-left text-[15px] font-semibold hover:bg-surface-sunken ${
        tone === 'danger' ? 'text-danger' : 'text-foreground'
      }`}
    >
      <Icon name={icon} className="size-4.5" />
      {children}
    </button>
  );
}
