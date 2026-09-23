'use client';

import { useId, useState, type ReactNode } from 'react';

import { findStatus, findsInList, pickable } from '@/src/lib/people/pick';

import { FIELD } from '../../birth-form';
import { NO_MATCH, PLACEHOLDER } from '../../person-combobox';

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
            className={`${FIELD} w-full sm:max-w-xs`}
          />
          {/*
            결과는 **늘 마운트된 칸**이 말한다 — 새로 붙은 live 영역은 화면낭독기가 흘려보내는 일이 있다.
            안 쳤으면 비어 있다.
          */}
          <p id={statusId} role="status" className={status.kind === 'idle' ? 'sr-only' : 'text-xs text-muted'}>
            {status.kind === 'none' ? NO_MATCH : status.kind === 'some' ? `${status.count}명` : ''}
          </p>
        </div>
      )}

      <ul className="flex flex-col gap-4">
        {people.map((one) => (
          <li key={one.personId} hidden={!shown.has(one.personId)}>
            {one.card}
          </li>
        ))}
      </ul>
    </div>
  );
}
