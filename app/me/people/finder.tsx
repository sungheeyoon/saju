'use client';

import { useId, useState, type ReactNode } from 'react';

import { findStatus, findsInList, pickable } from '@/src/lib/people/pick';

import { NO_MATCH, PLACEHOLDER } from '../../person-combobox';
import { Icon } from '../../ui/icons';

/**
 * 사람 목록 위의 **찾는 칸** — 이름(초성도)을 치면 목록이 그 사람들로 좁혀진다(ADR 0102, G-21).
 *
 * 2026-09-24 에 0 · 1 · 10 · 26 · 100 명을 넣고 쟀다. 카드가 커서(데스크톱 254px · 휴대폰 334px)
 * 첫 화면에 온전히 서는 카드는 수와 상관없이 하나였고, 끝의 사람에 닿으려면 휴대폰에서 스물여섯이면
 * 열세 번, 백이면 마흔여덟 번 화면을 내려야 했다. 서버 읽기는 수와 상관없이 같았다(자리 · 목록 · 풀이 ·
 * 사람 표를 한 번씩) — 모자란 것은 찾는 길이었다. 이 칸이 서면 칸을 누르고 이름 몇 글자를 치는 것으로 닿는다.
 *
 * **카드는 서버가 그린 그대로다.** 좁히기는 줄을 숨길 뿐(`hidden`) 카드를 다시 그리지 않는다 —
 * 열어 둔 관리 메뉴와 메모 칸이 치는 동안 닫히지 않게. 판단(좁히기 · 몇 명부터 칸이 서는가 ·
 * 무엇을 말하는가)은 궁합 칸과 같은 `src/lib/people/pick.ts` 에 있다.
 */

export type Findable = { personId: string; label: string; card: ReactNode };

export function PeopleFinder({ people }: { people: Findable[] }) {
  const base = useId();
  const inputId = `${base}-input`;
  const statusId = `${base}-status`;
  const [typed, setTyped] = useState('');

  /* 칸이 안 서는 목록은 좁히지도 않는다 — 여섯에서 치다가 다섯이 되어 칸이 사라져도 전부가 선다 */
  const finds = findsInList(people.length);
  const wanted = finds ? typed : '';
  const shown = new Set(pickable(people, wanted, null).map((one) => one.personId));
  const status = findStatus(wanted, shown.size);

  return (
    <div className="flex flex-col gap-4">
      {finds && (
        <div className="flex flex-col gap-1.5">
          <label htmlFor={inputId} className="sr-only">
            {PLACEHOLDER}
          </label>
          <div className="relative w-full sm:max-w-sm">
            <Icon name="search" className="pointer-events-none absolute left-4 top-1/2 size-[18px] -translate-y-1/2 text-secondary" />
            {/*
              **`outline-none` 을 안 단다** — 초점에 두르는 것이 옅은 `ring`(`accent-wash`)과 한 단계 짙은 테두리뿐이라
              그것만으로는 초점이 거의 안 보인다. 전역 초점 테두리(`globals.css` 의 `@layer base`)가 선다.
            */}
            <input
              id={inputId}
              type="search"
              enterKeyHint="search"
              autoComplete="off"
              autoCorrect="off"
              autoCapitalize="off"
              spellCheck={false}
              placeholder={PLACEHOLDER}
              aria-describedby={statusId}
              value={typed}
              onChange={(event) => setTyped(event.target.value)}
              className="h-12 w-full rounded-full border border-border bg-surface pl-11 pr-4 text-[15px] placeholder:text-secondary focus:border-border-strong focus:ring-2 focus:ring-accent-wash"
            />
          </div>
          {/*
            결과는 **늘 마운트된 칸**이 말한다 — 새로 붙은 live 영역은 화면낭독기가 흘려보내는 일이 있다.
            안 쳤으면 비어 있다.
          */}
          <p id={statusId} role="status" className={status.kind === 'idle' ? 'sr-only' : 'px-2 text-[13px] text-secondary'}>
            {status.kind === 'none' ? NO_MATCH : status.kind === 'some' ? `검색 결과 ${status.count}명` : ''}
          </p>
        </div>
      )}

      {/*
        폰은 한 줄에 한 장, 넓어지면 둘 · 셋. 관리 메뉴가 고치는 칸이나 메모 칸을 열면 그 한 장이 줄 전체로
        넓어진다(`data-panel`) — 폼이 타일 폭에 끼어 세로로 길어지지 않게.
      */}
      <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {people.map((one) => (
          <li key={one.personId} hidden={!shown.has(one.personId)} className="min-w-0 has-[[data-panel]]:col-span-full">
            {one.card}
          </li>
        ))}
      </ul>
    </div>
  );
}
