'use client';

import { useRef, type ReactNode } from 'react';

import { Icon } from '../../ui/icons';
import { DetailSheet, openSheet } from './today-card';

/**
 * 인연 탭 맨 위의 **「받은 요청 N」 띠 한 줄**(운영자 답 2026-09-29 u2, 시안 u).
 *
 * 받은 요청 카드는 한 장이 동의 문장 · 두 단추 · 차단 · 신고까지 들어 폰에서 한 장이 300px 을 넘는다 — 둘만 와도 덱을 화면
 * 밖으로 밀었다. 그래서 탭 첫 화면에는 띠 한 줄(수 · 보낸 사람 · 무엇이 열리는지)만 서고, 누르면 **그 자리에서** 아래에서 시트가
 * 올라와 카드가 전처럼 선다 — 다른 화면으로 옮기지 않는다. 시트는 ⓘ 시트(`DetailSheet`)와 같은 부품이라 제 안에서 스크롤하고
 * 문서를 뷰포트에 묶은 덱(`globals.css` 의 `data-deck-fit`)을 건드리지 않는다.
 *
 * **동의는 시트 안의 카드가 받는다**(ADR 0038) — 띠는 수락 단추를 들지 않는다. 동의 문장은 카드가 열릴 때부터 단추 위에 선다.
 *
 * 카드 마크업은 서버가 그려 `children` 으로 온다 — 시트가 닫혀 있어도 문서 안에 있다. 흐름 검사(`scripts/check-match.mjs`)가
 * 이 요소(`#requests-lead`)의 마크업으로 요청이 내주는 글자를 잰다.
 */
export function RequestsBand({ count, names, children }: { count: number; names: string; children: ReactNode }) {
  const sheet = useRef<HTMLDialogElement>(null);

  return (
    <div id="requests-lead" className="shrink-0">
      <button
        type="button"
        aria-haspopup="dialog"
        onClick={() => openSheet(sheet.current)}
        className="flex min-h-12 w-full shrink-0 items-center gap-3 rounded-[1.25rem] bg-accent px-4 py-2 text-left text-on-accent active:scale-[0.99]"
      >
        <span className="min-w-0 flex-1">
          <span className="block text-[15px] font-bold leading-5">받은 요청 {count}</span>
          <span className="block truncate text-[13px] leading-[18px] opacity-90">{names} — 수락하면 인연 궁합이 열려요</span>
        </span>
        <Icon name="chevron" className="size-4 shrink-0" />
      </button>
      <DetailSheet sheet={sheet} nickname="받은 요청" label="받은 요청">
        <div className="mx-auto flex w-full max-w-2xl flex-col gap-4">{children}</div>
      </DetailSheet>
    </div>
  );
}
