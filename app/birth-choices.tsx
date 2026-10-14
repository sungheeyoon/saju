'use client';

import { useId, useRef } from 'react';

import { Icon } from './ui/icons';
import styles from './birth-form.module.css';

/*
  출생 정보 폼(`birth-form.tsx`)의 칸 모양 셋 — 고르는 칸 · 펼치는 칸 · 숫자 칸 한 줄. 글자를 받는 칸(이름 · 숫자 · 세운
  연도)은 폼 쪽에 남는다 — 입력 칸 글자 크기 시험(`app/ui/fields.test.ts`)이 CSS 모듈로 꾸민 칸을 같은 이름의 모듈에서 본다.
*/

export type Option<T extends string> = { value: T; label: string; hint?: string };

/** 여러 클래스를 잇는다 — 빈 것은 뺀다 */
export const cx = (...names: (string | false | undefined)[]) => names.filter(Boolean).join(' ');

/**
 * 고르는 칸 — **선택지가 다 보이는 진짜 라디오 묶음**이다.
 *
 * 단추에 `role="radio"` 를 달면 화살표 이동과 한 번에 하나라는 규칙을 우리가 다시 짜야 한다 — 라디오는 브라우저가 그것을
 * 이미 안다. 라디오는 보이지 않게 칸 전체를 덮고(눌리는 것도 초점을 받는 것도 라디오다), 초점 고리는 칸이 대신 두른다.
 *
 * 이름표의 자리는 셋이다 — 칸 위(성별), 눈에는 안 보이고 낭독기만 읽음(달력 — 날짜 바로 밑이라 다시 세우지 않는다),
 * 왼쪽 이름표 단(출생 시각).
 */
export function ChoiceField<T extends string>({
  label,
  name = label,
  options,
  value,
  onPick,
  labelAt = 'above',
  groupStart = false,
}: {
  label: string;
  /** 낭독기가 부르는 묶음 이름 — 보이는 이름이 짧을 때(「달력」 → 「달력 기준」) */
  name?: string;
  options: readonly Option<T>[];
  /** 빈 문자열이면 아직 안 골랐다 — 켜진 선택지가 없다 */
  value: T | '';
  onPick: (value: T) => void;
  labelAt?: 'above' | 'hidden' | 'rail';
  /** 묶음이 새로 시작하는 자리인가 — 위를 20px 띄운다 */
  groupStart?: boolean;
}) {
  const id = useId();
  const current = options.find((option) => option.value === value);

  return (
    <fieldset
      className={cx(
        styles.choice,
        labelAt === 'hidden' && styles.attached,
        labelAt === 'rail' && styles.railed,
        groupStart && styles.groupStart,
      )}
    >
      <legend className={styles.label}>{label}</legend>
      <div role="radiogroup" aria-label={name} className={styles.options}>
        {options.map((option) => (
          <label key={option.value} className={styles.option}>
            <input
              type="radio"
              name={id}
              aria-label={option.label}
              checked={option.value === value}
              onChange={() => onPick(option.value)}
            />
            <span>{option.label}</span>
          </label>
        ))}
      </div>
      {current?.hint && <p className={styles.choiceHint}>{current.hint}</p>}
    </fieldset>
  );
}

/**
 * 펼치는 칸 — 누르면 그 자리에서 아래로 목록이 펼쳐지고, 고른 항목에 체크(✓), 고르면 접힌다.
 *
 * 칸은 `button` + `aria-expanded` 이고(이름은 「칸 이름 + 지금 값」), 펼친 목록은 고르는 칸과 같은 **진짜 라디오 묶음**이다.
 * 꺾쇠는 닫힘 아래 · 열림 위.
 *
 * **손으로 고르면 접히고 키보드로 옮기면 안 접힌다.** 화살표는 고르면서 옮기므로, 옮길 때마다 접으면 두 번째 항목에
 * 닿을 수 없다. 키보드로는 Enter 로 접는다 — 접히면 초점은 칸으로 돌아간다.
 */
export function SelectField<T extends string>({
  label,
  name = label,
  options,
  value,
  open,
  onToggle,
  onPick,
  disabled = false,
}: {
  label: string;
  /** 낭독기가 부르는 묶음 이름 — 보이는 이름이 짧을 때(「자시」 → 「자시 규칙」) */
  name?: string;
  options: readonly Option<T>[];
  value: T;
  open: boolean;
  onToggle: () => void;
  onPick: (value: T) => void;
  disabled?: boolean;
}) {
  const id = useId();
  const toggle = useRef<HTMLButtonElement>(null);
  const current = options.find((option) => option.value === value);

  const close = () => {
    onToggle();
    toggle.current?.focus();
  };

  return (
    <div className={styles.select}>
      <button
        ref={toggle}
        type="button"
        aria-expanded={open}
        aria-controls={id}
        disabled={disabled}
        onClick={onToggle}
        className={styles.selectButton}
      >
        <span className={styles.rail}>{label}</span>
        <span className={styles.selectBox}>
          <span className={styles.selectValue}>{current?.label ?? '–'}</span>
          <Icon name="chevron" className={`${styles.chevron} ${open ? '-rotate-90' : 'rotate-90'}`} />
        </span>
      </button>

      {open && (
        <div id={id} role="radiogroup" aria-label={name} className={styles.menu}>
          {options.map((option) => {
            const checked = option.value === value;
            return (
              <label key={option.value} className={styles.menuItem}>
                <input
                  type="radio"
                  name={id}
                  aria-label={option.label}
                  checked={checked}
                  onChange={() => onPick(option.value)}
                  onClick={(event) => {
                    // 손(마우스 · 터치)의 누름만 `detail` 이 1 이상이다 — 화살표로 옮긴 것은 0 이라 안 접는다
                    if (event.detail > 0) close();
                  }}
                  onKeyDown={(event) => {
                    if (event.key !== 'Enter') return;
                    event.preventDefault();
                    onPick(option.value);
                    close();
                  }}
                />
                <span className={checked ? styles.menuChecked : undefined}>{option.label}</span>
                {option.hint && <span className={styles.menuHint}>{option.hint}</span>}
                <span className={styles.menuCheck}>{checked && <Icon name="check" className="size-4 stroke-3" />}</span>
              </label>
            );
          })}
        </div>
      )}
    </div>
  );
}

/**
 * 숫자 칸 한 줄 — 이름표 아래(생년월일)나 왼쪽 이름표 단 옆(시각)에 칸들이 폭을 나눠 선다.
 */
export function DigitsField({
  label,
  hint,
  rail = false,
  groupStart = false,
  children,
}: {
  label: string;
  /** 이름표의 덧말(「24시간」) */
  hint?: string;
  /** 이름표가 왼쪽 이름표 단에 서는가 */
  rail?: boolean;
  groupStart?: boolean;
  children: React.ReactNode;
}) {
  const id = useId();
  return (
    <div role="group" aria-labelledby={id} className={cx(styles.digits, rail && styles.railed, groupStart && styles.groupStart)}>
      <span id={id} className={styles.label}>
        {label}
        {hint && <span className={styles.labelHint}>{hint}</span>}
      </span>
      <div className={styles.digitInputs}>{children}</div>
    </div>
  );
}
