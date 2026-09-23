'use client';

import { useEffect, useId, useRef, useState } from 'react';

import { pickable, stepTo, type Step } from '@/src/lib/people/pick';

import { FIELD, SelectShell } from './birth-form';

/**
 * 저장한 사람을 **찾아 고르는 칸** — 궁합의 두 칸이 쓴다(ADR 0102).
 *
 * `select` 둘이던 자리다. 저장 한도 10 을 걷으면 스물 · 백이 들어오고, 그때 `select` 는
 * 한 줄에 한 이름을 끝없이 내리는 목록이 된다(ADR 0032 가 10 을 고른 까닭의 절반).
 * 그래서 쳐서 좁히고 키보드로 오르내리는 칸으로 바꿨다 — WAI-ARIA 의 combobox 에
 * listbox 를 단 모양이고, 초점은 늘 입력 칸에 있으며 오르내리는 자리는
 * `aria-activedescendant` 가 말한다.
 *
 * **부품을 들이지 않았다.** 의존성이 React 뿐인 저장소라 이 칸 하나에 UI 라이브러리를
 * 들이면 CSP(G-23 ②)와 번들을 새로 재야 한다. 판단(좁히기 · 옮기기)은
 * `src/lib/people/pick.ts` 에 있고 여기는 그리기와 키만 든다.
 *
 * 사람이 적을 때(한둘)도 `select` 처럼 읽힌다 — 누르면 전부가 서고, 치지 않아도 고른다.
 */

export type Choosable = { personId: string; label: string; isSelfPerson: boolean };

/** 목록과 칸에 서는 이름 — 자기 사주에는 「(나)」가 붙는다 */
const shownLabel = (one: Choosable): string =>
  one.isSelfPerson ? `${one.label} (나)` : one.label;

/**
 * 문구 둘 — 운영자가 2026-09-24 에 승인했다(#193). 사람 목록의 찾는 칸(`me/people/finder.tsx`)도
 * 같은 사실을 말하므로 이 둘을 그대로 쓴다 — 한 사실 한 표기.
 */
export const PLACEHOLDER = '이름으로 찾기';
export const NO_MATCH = '찾는 사람이 없습니다';

/**
 * 목록의 높이 — **다섯 줄과 여섯째의 반.** 한 줄이 `min-h-11`(44px), 목록 안 여백이 위 4px 라
 * 4 + 44 × 5.5 = 246px ≈ `15.5rem`(248px). 여섯째가 반쯤 걸쳐 있어야 더 있다는 것이 스크롤
 * 막대 없이도 보인다 — 딱 다섯에서 자르면 목록이 거기서 끝난 것처럼 읽힌다.
 */
const LIST_HEIGHT = 'max-h-[15.5rem]';

const KEY_STEP: Partial<Record<string, Step>> = { ArrowDown: 'next', ArrowUp: 'previous' };

export function PersonCombobox({
  label,
  people,
  taken,
  chosenId,
  onChoose,
}: {
  label: string;
  people: Choosable[];
  /** 다른 칸에서 고른 사람 — 여기서는 안 선다 */
  taken: string | null;
  chosenId: string;
  onChoose: (personId: string) => void;
}) {
  const base = useId();
  const inputId = `${base}-input`;
  const listId = `${base}-list`;
  const statusId = `${base}-status`;
  const optionId = (index: number) => `${base}-option-${index}`;

  const [open, setOpen] = useState(false);
  /** 치는 중인 글자 — `null` 이면 안 치고 있고, 칸에는 고른 사람의 이름이 선다 */
  const [typed, setTyped] = useState<string | null>(null);
  const [active, setActive] = useState(-1);
  const list = useRef<HTMLUListElement>(null);

  const choices = pickable(people, typed ?? '', taken);
  const chosen = people.find((one) => one.personId === chosenId);
  const current = active < choices.length ? active : -1;
  /* 옵션이 보일 때만 펼친 것이다 — 결과 없음은 펼친 것이 아니다(APG 자동완성 combobox) */
  const listed = open && choices.length > 0;
  /* 친 것이 있는데 맞는 사람이 없을 때만 「없다」고 말한다 — 치지 않았는데 없다고 하면 무엇을 잘못했는지 찾는다 */
  const nothing = open && choices.length === 0 && (typed ?? '').trim() !== '';

  /*
    펼치면 목록 전체가 화면 안에 서게 — 칸이 화면 아래쪽이면 목록의 끝이 화면 밖으로 잘린다.
    휴대폰 폭에서는 아래 고정 메뉴(`site-header.tsx`)에 가리지 않게 그만큼 띄운다(`scroll-mb-24`).
  */
  useEffect(() => {
    if (listed) list.current?.scrollIntoView({ block: 'nearest' });
  }, [listed]);

  /* 오르내린 자리가 목록 밖으로 밀려 있으면 보이게 끌어온다 — 백 명이면 곧 밖이다 */
  useEffect(() => {
    if (!listed || current < 0) return;
    list.current?.querySelector(`[data-index="${current}"]`)?.scrollIntoView({ block: 'nearest' });
  }, [listed, current]);

  const close = () => {
    setOpen(false);
    setTyped(null);
    setActive(-1);
  };

  const choose = (one: Choosable) => {
    onChoose(one.personId);
    close();
  };

  /** 열 때는 고른 사람에 선다 — 없으면 아래로는 처음, 위로는 끝 */
  const openAt = (step: Step) => {
    const at = choices.findIndex((one) => one.personId === chosenId);
    setOpen(true);
    setActive(at >= 0 ? at : stepTo(-1, choices.length, step));
  };

  const onKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
    const step = KEY_STEP[event.key];
    if (step !== undefined) {
      event.preventDefault();
      if (!open) openAt(step);
      else setActive(stepTo(current, choices.length, step));
      return;
    }

    if (event.key === 'Enter' && listed && current >= 0) {
      event.preventDefault();
      choose(choices[current]);
      return;
    }

    if (event.key === 'Escape' && open) {
      event.preventDefault();
      close();
    }
  };

  return (
    <div className="flex min-w-0 flex-col gap-1.5">
      <label htmlFor={inputId} className="text-xs font-semibold text-secondary">
        {label}
      </label>
      <SelectShell>
        <input
          id={inputId}
          type="text"
          role="combobox"
          aria-autocomplete="list"
          aria-expanded={listed}
          aria-controls={listId}
          aria-activedescendant={listed && current >= 0 ? optionId(current) : undefined}
          autoComplete="off"
          autoCorrect="off"
          autoCapitalize="off"
          spellCheck={false}
          placeholder={PLACEHOLDER}
          value={typed ?? (chosen === undefined ? '' : shownLabel(chosen))}
          onFocus={(event) => event.currentTarget.select()}
          onClick={(event) => {
            /* 누른 뒤 다시 한 번 — 마우스를 떼는 순간 커서가 서며 포커스 때의 선택이 풀린다 */
            if (typed === null) event.currentTarget.select();
            if (!open) openAt('next');
          }}
          onChange={(event) => {
            setTyped(event.target.value);
            setOpen(true);
            setActive(event.target.value.trim() === '' ? -1 : 0);
          }}
          onKeyDown={onKeyDown}
          onBlur={close}
          className={`${FIELD} w-full pr-8`}
        />

        {/*
          listbox 는 **늘 DOM 에 있다** — `aria-controls` 가 없는 id 를 가리키지 않게. 옵션이 없으면 숨긴다.
        */}
        <ul
          ref={list}
          id={listId}
          role="listbox"
          aria-label={label}
          hidden={!listed}
          className={`absolute inset-x-0 top-full z-20 mt-1 ${LIST_HEIGHT} scroll-mb-24 overflow-y-auto sm:scroll-mb-2 overscroll-contain rounded-xl border border-border bg-surface p-1 shadow-lg`}
        >
          {listed &&
            choices.map((one, index) => (
              <li
                key={one.personId}
                id={optionId(index)}
                role="option"
                aria-selected={index === current}
                data-index={index}
                /* 누르는 동안 입력 칸이 초점을 잃지 않게 — 잃으면 닫히며 누름이 사라진다 */
                onMouseDown={(event) => event.preventDefault()}
                onClick={() => choose(one)}
                className={`flex min-h-11 cursor-pointer items-center justify-between gap-2 rounded-lg px-3 text-sm ${
                  index === current ? 'bg-accent-wash text-foreground' : 'text-foreground hover:bg-surface-sunken'
                }`}
              >
                <span className="min-w-0 truncate">{shownLabel(one)}</span>
                {one.personId === chosenId && (
                  <svg viewBox="0 0 12 12" aria-hidden="true" className="size-3 shrink-0 text-accent">
                    <path d="M2.5 6.2 5 8.5l4.5-5" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                )}
              </li>
            ))}
        </ul>

        {/*
          결과 없음은 listbox 와 **다른 칸**이 말한다. 이 칸은 늘 마운트해 두고 글자만 바꾼다 —
          새로 붙은 live 영역은 화면낭독기가 흘려보내는 일이 있어서다. 보이는 상자는 없을 때만 선다.
        */}
        <p
          id={statusId}
          role="status"
          className={
            nothing
              ? 'absolute inset-x-0 top-full z-20 mt-1 rounded-xl border border-border bg-surface px-3 py-2.5 text-sm text-muted shadow-lg'
              : 'sr-only'
          }
        >
          {nothing ? NO_MATCH : ''}
        </p>
      </SelectShell>
    </div>
  );
}
