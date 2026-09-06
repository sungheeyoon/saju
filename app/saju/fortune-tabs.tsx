'use client';

import { useState } from 'react';

import { CARD } from '../card';

export function FortuneTabs({
  daeun,
  saeun,
  wolun,
}: {
  /**
   * **이미 그려진 표를 받는다.**
   *
   * 이 칸이 브라우저로 가야 하는 까닭은 「어느 표를 볼까」 하나뿐이다. 표를 자식으로
   * 부르면 표 셋의 코드(430여 줄)가 그 하나 때문에 따라간다 — 서버 화면에서는 표가
   * 이미 그려진 채로 실려 오면 되고, 그러면 브라우저로 가는 것은 이 파일뿐이다.
   */
  readonly daeun: React.ReactNode;
  readonly saeun: React.ReactNode;
  readonly wolun: React.ReactNode;
}) {
  /**
   * 고르는 자리를 **여기 둔다.**
   *
   * 위에 두면 그 화면이 클라이언트가 되고, 그 아래 스물넷이 통째로 따라간다.
   * 이 값을 위에서 쓰는 곳은 한 군데도 없었다.
   */
  const [view, setView] = useState<'daeun' | 'saeun' | 'wolun'>('saeun');
  const onChange = setView;

  const panels = { daeun, saeun, wolun };
  const tabs = [
    { key: 'daeun', label: '대운' },
    { key: 'saeun', label: '세운' },
    { key: 'wolun', label: '월운' },
  ] as const;

  const selectByKeyboard = (event: React.KeyboardEvent<HTMLButtonElement>, index: number) => {
    let nextIndex = index;
    if (event.key === 'ArrowRight') nextIndex = (index + 1) % tabs.length;
    else if (event.key === 'ArrowLeft') nextIndex = (index - 1 + tabs.length) % tabs.length;
    else if (event.key === 'Home') nextIndex = 0;
    else if (event.key === 'End') nextIndex = tabs.length - 1;
    else return;

    event.preventDefault();
    onChange(tabs[nextIndex].key);
    event.currentTarget
      .closest('[role="tablist"]')
      ?.querySelectorAll<HTMLButtonElement>('[role="tab"]')
      [nextIndex]?.focus();
  };

  return (
    // `id="fortune"` 은 위의 `NowFortune` 이 든다 — 바로가기가 '운' 을 가리킬 때
    // 먼저 보여야 하는 것은 지금이고, 표는 그 아래에서 둘러보는 것이다.
    <section className={`${CARD} flex flex-col gap-5`}>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-base font-semibold">운 흐름</h2>
          <p className="mt-0.5 text-xs text-secondary">
            다른 시점을 골라 한 표씩 집중해서 봅니다.
          </p>
        </div>
        <div
          role="tablist"
          aria-label="운 종류"
          className="grid min-h-11 grid-cols-3 rounded-lg bg-surface-sunken p-1"
        >
          {tabs.map((tab, index) => {
            const selected = view === tab.key;
            return (
              <button
                key={tab.key}
                id={`fortune-tab-${tab.key}`}
                type="button"
                role="tab"
                aria-selected={selected}
                aria-controls="fortune-panel"
                tabIndex={selected ? 0 : -1}
                onClick={() => onChange(tab.key)}
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
        id="fortune-panel"
        role="tabpanel"
        aria-labelledby={`fortune-tab-${view}`}
        className="border-t border-border pt-5"
      >
        {panels[view]}
      </div>
    </section>
  );
}
