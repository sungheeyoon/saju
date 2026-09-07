'use client';

import { useState } from 'react';


export type PillarDetailTab = {
  readonly key: string;
  readonly label: string;
  readonly panel: React.ReactNode;
};


/**
 * 원국을 보는 렌즈 — 네 기둥은 그대로 두고, 아래의 보조 정보만 바꾼다.
 *
 * 계산은 서버에 남는다. 이 컴포넌트가 브라우저에서 하는 일은 이미 그려진 네 판 중
 * 하나를 고르는 것뿐이다. 네 버튼은 320px 화면에서도 한 줄에 서고, 화살표 키로도
 * 옮겨 다닐 수 있다.
 */
export function PillarDetails({ tabs }: { readonly tabs: readonly PillarDetailTab[] }) {
  const [view, setView] = useState(tabs[0].key);
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
    <div className="mt-5 border-t border-border pt-5 sm:mx-auto sm:max-w-3xl">
      <div
        role="tablist"
        aria-label="사주팔자 상세 정보"
        className="grid grid-cols-4 rounded-xl bg-surface-sunken p-1"
      >
        {tabs.map((tab, index) => {
          const selected = shown.key === tab.key;
          return (
            <button
              key={tab.key}
              id={`pillar-detail-tab-${tab.key}`}
              type="button"
              role="tab"
              aria-selected={selected}
              aria-controls="pillar-detail-panel"
              tabIndex={selected ? 0 : -1}
              onClick={() => setView(tab.key)}
              onKeyDown={(event) => selectByKeyboard(event, index)}
              className={`min-h-11 rounded-lg px-1 text-xs font-medium focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-accent sm:px-3 sm:text-sm ${
                selected
                  ? 'bg-surface text-foreground shadow-sm'
                  : 'text-muted hover:text-foreground'
              }`}
            >
              {tab.label}
            </button>
          );
        })}
      </div>

      <div
        id="pillar-detail-panel"
        role="tabpanel"
        aria-labelledby={`pillar-detail-tab-${shown.key}`}
        className="pt-4"
      >
        {shown.panel}
      </div>
    </div>
  );
}
