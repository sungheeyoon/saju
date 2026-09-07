'use client';

import { useState } from 'react';

import { CARD } from '../card';

/**
 * 한 카드 안에서 **한 판씩 골라 보는 자리.**
 *
 * 운 흐름이 먼저 이 모양이었고, 용신이 같은 문제를 갖고 왔다 — 한 주제 아래 서로
 * 다른 관점이 넷·다섯이고, 전부 펴 두면 카드 하나가 화면 두 개 높이가 된다.
 *
 * **판은 이미 그려진 채로 받는다.** 이 파일이 브라우저로 가야 하는 까닭은 「어느 판을
 * 볼까」 하나뿐이다. 판을 자식으로 부르면 그 안의 표와 계산이 전부 따라간다 — 지금은
 * 공개 화면에서 브라우저로 가는 것이 이 파일 하나다.
 */
export type CardTab = {
  readonly key: string;
  readonly label: string;
  readonly panel: React.ReactNode;
};

export function CardTabs({
  id,
  title,
  note,
  tablistLabel,
  tabs,
  initial,
  anchorId,
  footnote,
}: {
  /** 탭과 판의 id 앞머리 — 한 화면에 이 칸이 둘일 수 있다 */
  readonly id: string;
  readonly title: string;
  readonly note?: string;
  readonly tablistLabel: string;
  readonly tabs: readonly CardTab[];
  readonly initial: string;
  /** 바로가기가 짚는 자리 — 없으면 안 건다 */
  readonly anchorId?: string;
  /** 판이 바뀌어도 그대로 서는 줄 — 판마다 되풀이되면 각주가 아니라 본문이 된다 */
  readonly footnote?: React.ReactNode;
}) {
  const [view, setView] = useState(initial);
  const shown = tabs.find((tab) => tab.key === view) ?? tabs[0];

  const selectByKeyboard = (event: React.KeyboardEvent<HTMLButtonElement>, index: number) => {
    let nextIndex = index;
    if (event.key === 'ArrowRight') nextIndex = (index + 1) % tabs.length;
    else if (event.key === 'ArrowLeft') nextIndex = (index - 1 + tabs.length) % tabs.length;
    else if (event.key === 'Home') nextIndex = 0;
    else if (event.key === 'End') nextIndex = tabs.length - 1;
    else return;

    event.preventDefault();
    setView(tabs[nextIndex].key);
    event.currentTarget
      .closest('[role="tablist"]')
      ?.querySelectorAll<HTMLButtonElement>('[role="tab"]')
      [nextIndex]?.focus();
  };

  return (
    <section
      id={anchorId}
      className={`${CARD} flex flex-col gap-5 ${anchorId === undefined ? '' : 'scroll-mt-20'}`}
    >
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-base font-semibold">{title}</h2>
          {note !== undefined && <p className="mt-0.5 text-xs text-secondary">{note}</p>}
        </div>
        <div
          role="tablist"
          aria-label={tablistLabel}
          className="grid min-h-11 auto-cols-fr grid-flow-col rounded-lg bg-surface-sunken p-1"
        >
          {tabs.map((tab, index) => {
            const selected = shown.key === tab.key;
            return (
              <button
                key={tab.key}
                id={`${id}-tab-${tab.key}`}
                type="button"
                role="tab"
                aria-selected={selected}
                aria-controls={`${id}-panel`}
                tabIndex={selected ? 0 : -1}
                onClick={() => setView(tab.key)}
                onKeyDown={(event) => selectByKeyboard(event, index)}
                className={`min-h-9 rounded-md px-4 text-sm font-medium focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent ${
                  selected
                    ? 'bg-surface text-foreground shadow-sm'
                    : 'text-secondary hover:text-foreground'
                }`}
              >
                {tab.label}
              </button>
            );
          })}
        </div>
      </div>

      <div
        id={`${id}-panel`}
        role="tabpanel"
        aria-labelledby={`${id}-tab-${shown.key}`}
        className="border-t border-border pt-5"
      >
        {shown.panel}
      </div>

      {footnote !== undefined && (
        <div className="border-t border-border pt-4 text-xs text-muted">{footnote}</div>
      )}
    </section>
  );
}
