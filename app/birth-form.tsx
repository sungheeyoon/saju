'use client';

import { useEffect, useId, useRef, useState } from 'react';

import {
  CALENDARS,
  CALENDAR_KO,
  CITY_LONGITUDES,
  GENDERS,
  GENDER_KO,
  SUPPORTED_YEAR_RANGE,
  type Calendar,
  type CityName,
  type LateNightRule,
} from '@/src/lib/saju';

import { solarDateOf } from '@/src/lib/input/chart';
import {
  DEFAULT_QUERY,
  HOUR_UNKNOWN_CHOICE,
  NAME_MAX,
  TIME_BASES,
  TIME_BASIS,
  birthYearRangeOf,
  birthYearRefusal,
  type Query,
} from '@/src/lib/input/query';

import { gapOf, isSettled, parseDateText, parseTimeText, type Gap } from './birth-entry';
import { Icon } from './ui/icons';
import { reducedMotion } from './ui/motion';

/**
 * 생년월일시 입력 한 벌.
 *
 * 원국 화면과 궁합 화면이 같은 것을 묻는다. 두 곳에 같은 폼을 따로 두면 한쪽만
 * 고쳐져서 "같은 값을 넣었는데 다른 사주가 나오는" 상태가 만들어진다.
 *
 * 제출 버튼은 여기 없다. 원국은 폼 하나에 버튼 하나지만 궁합은 두 사람을 채운
 * 뒤 한 번 누르므로, 버튼의 자리와 문구는 쓰는 화면이 정한다.
 *
 * ## 왜 `<input type="date">`·`<input type="time">` 을 쓰지 않는가
 *
 * 네이티브 컨트롤은 **기기가 모양과 규칙을 정한다.** 같은 폼이 iOS 에서는 휠,
 * 안드로이드에서는 달력, 데스크톱에서는 칸 세 개로 뜨고, 시각은 로케일에 따라
 * 오전/오후로 갈린다. 여기서 묻는 것은 사주 계산에 쓰이는 **24시간 기준의 시·분**
 * 이라 오전/오후가 한 번 접히면 「오후 12시」가 0시인지 12시인지에서 갈린다.
 * 그리고 태어난 해는 대개 40~90년 전이라, 달력 위젯으로는 그만큼을 넘겨야 한다.
 *
 * 그래서 년·월·일과 시·분을 각각 적게 한다. 대신 **칸을 옮기는 수고는 폼이 진다** — 다 적은 칸은 다음 칸으로
 * 넘어가고, 빈 칸에서 지우면 앞 칸으로 돌아가며, 「1990-05-15」 · 「14:30」을 붙여 넣으면 세 칸 · 두 칸에 나눠 든다
 * (폼 시안 · UX, 2026-10-03).
 *
 * ## 묶음 둘 — 답할 것과 정해 둔 것 (폼 시안 · UX)
 *
 * 한 판에 여덟 줄이 같은 무게로 서 있던 동안에는 **무엇을 꼭 답해야 하는지**가 안 보였다. 성별 「여자」 · 출생지
 * 「서울」 · 달력 「양력」이 접힌 줄의 회색 값으로 서서, 답한 줄과 기본값이 걸린 줄이 같은 얼굴이었다.
 *
 * - **첫 묶음은 사람이 답하는 것** — 이름 · 성별 · 생년월일 · 달력 · 출생 시각. 고를 것이 둘 · 셋뿐인 줄(성별 · 달력 ·
 *   시각을 아는가)은 접지 않고 **보기를 다 펴 둔다**(세그먼트). 미리 골라진 값도 반대쪽 보기와 나란히 서므로
 *   「여자로 골라져 있다」가 보이고, 고치는 데 한 번 누르면 된다(펼침 줄은 두 번이었다).
 * - **둘째 묶음은 정해 둔 계산 기준** — 출생지와 고급 설정. 대부분 손대지 않아도 되는 줄이라 첫 묶음과 떼어 둔다.
 *   출생지는 접지 않는다(운영자 2026-09-29 「출생지도 폼에 넣어야」) — 묶음만 옮겼다.
 *
 * ## 말하는 때 (폼 시안 · UX)
 *
 * **틀린 것은 그 자리에서 바로, 빠진 것은 누른 뒤에.** 「13월」은 다 적힌 순간 이미 틀렸으므로 그 줄 밑에 바로 말하고,
 * 빈 칸은 아직 안 적은 것이라 누르기 전에는 말하지 않는다. 누른 뒤에는 **첫 빈칸의 줄에** 문장이 서고 초점이 그 칸으로
 * 간다 — 단추 옆의 한 줄은 어느 칸인지 다시 찾게 했다(`attempt`).
 */

/** 흰 둥근 묶음 — 줄 사이 선은 왼쪽 16px 을 들여 긋는다(묶음 `pl-4`, 줄 `pr-4`, ADR 0132) */
const GROUP = 'overflow-hidden rounded-2xl bg-surface pl-4 shadow-card divide-y divide-border';

/** 줄 — 높이 48px 이상. 이름은 왼쪽, 값은 오른쪽 */
const ROW = 'flex min-h-12 items-center gap-3 pr-4';
const ROW_LABEL = 'shrink-0 text-[15px] text-foreground';
/** 첫 빈칸 · 범위 밖인 줄의 이름 — 붉은 글자(색만으로 말하지 않는다: 줄 밑에 문장이 선다) */
const ROW_LABEL_INVALID = 'shrink-0 text-[15px] text-danger';

/** 줄 안 오른쪽 숫자 칸 — 움푹한 작은 칸, 오른쪽 정렬 */
const DIGIT =
  'h-11 min-w-0 rounded-lg bg-surface-sunken px-1.5 text-right text-base tabular-nums text-foreground outline-none placeholder:text-sm placeholder:text-muted focus:ring-2 focus:ring-accent-soft disabled:cursor-not-allowed disabled:opacity-40';

const CITIES = Object.keys(CITY_LONGITUDES) as CityName[];

const pad2 = (n: number) => String(n).padStart(2, '0');

type Option<T extends string> = { value: T; label: string; hint?: string };

/**
 * 줄 밑의 한 줄 — 빈칸의 거절이거나(누른 뒤, `alert`), 다 적힌 값이 범위를 벗어났다는 말이다(적는 동안, `status`).
 *
 * 같은 줄에 둘이 함께 서지 않는다 — 범위 밖의 말이 있으면 그것이 더 구체적인 이유다.
 */
function RowNote({ id, text, urgent }: { id: string; text: string; urgent: boolean }) {
  return (
    <p
      id={id}
      role={urgent ? 'alert' : 'status'}
      className="flex items-start gap-1.5 pb-3 pr-4 text-[13px] font-medium leading-5 text-danger"
    >
      <Icon name="alert" className="mt-0.5 size-3.5 shrink-0" />
      {text}
    </p>
  );
}

/**
 * 보기가 다 펴진 줄 — 둘 · 셋 중 하나를 그 자리에서 고른다(성별 · 달력 · 출생 시각).
 *
 * 펼침 줄(`PickRow`)은 지금 값 하나만 회색으로 보여서, 기본값이 걸린 줄이 「이미 답한 줄」처럼 읽혔다. 보기가 다
 * 서 있으면 무엇이 골라져 있는지와 다른 보기가 무엇인지가 함께 보인다. 진짜 라디오 묶음이라 화살표 이동과
 * 「한 번에 하나」는 브라우저가 든다. 라디오는 알약 전체를 덮어 누를 자리가 44px 이다.
 */
function ChoiceRow<T extends string>({
  label,
  name = label,
  options,
  value,
  onPick,
  invalid = false,
}: {
  label: string;
  /** 낭독기가 부르는 묶음 이름 — 보이는 이름이 짧을 때(「달력」 → 「달력 기준」) */
  name?: string;
  options: readonly Option<T>[];
  /** 빈 문자열이면 아직 안 골랐다 — 어느 알약도 안 켜진다 */
  value: T | '';
  onPick: (value: T) => void;
  invalid?: boolean;
}) {
  const id = useId();
  return (
    <div className={`${ROW} flex-wrap py-1.5`}>
      <span id={id} className={invalid ? ROW_LABEL_INVALID : ROW_LABEL}>
        {label}
      </span>
      <div
        role="radiogroup"
        aria-label={name}
        aria-invalid={invalid || undefined}
        className="ml-auto flex shrink-0 gap-0.5 rounded-full bg-surface-sunken p-0.5 aria-invalid:ring-2 aria-invalid:ring-danger"
      >
        {options.map((option) => {
          const checked = option.value === value;
          return (
            <label
              key={option.value}
              className={`relative flex min-h-10 cursor-pointer items-center rounded-full px-3.5 text-[14px] has-[:focus-visible]:outline has-[:focus-visible]:outline-3 has-[:focus-visible]:outline-accent-soft ${
                checked
                  ? 'bg-surface font-semibold text-foreground shadow-soft ring-1 ring-border'
                  : 'font-medium text-secondary hover:text-foreground'
              }`}
            >
              <input
                type="radio"
                name={id}
                aria-label={option.label}
                checked={checked}
                onChange={() => onPick(option.value)}
                // 알약은 40px 이고 라디오는 위아래로 2px 씩 더 덮는다 — 누를 자리 44px
                className="absolute -inset-y-0.5 inset-x-0 cursor-pointer appearance-none opacity-0"
              />
              {option.label}
            </label>
          );
        })}
      </div>
    </div>
  );
}

/**
 * 누르면 그 자리에서 아래로 펼쳐지는 줄 — 보기가 많아 다 펴 두면 묶음이 길어지는 것만(출생지 열 곳 · 자시 · 시간 기준).
 *
 * 줄은 `button` + `aria-expanded` 이고, 펼친 목록은 **진짜 라디오 묶음**이다. **손으로 고르면 접히고 키보드로 옮기면
 * 안 접힌다** — 화살표는 고르면서 옮기므로, 옮길 때마다 접으면 두 번째 항목에 닿을 수 없다. 키보드로는 Enter 로 접는다.
 */
function PickRow<T extends string>({
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
  name?: string;
  options: readonly Option<T>[];
  value: T | '';
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
    <div>
      <button
        ref={toggle}
        type="button"
        aria-expanded={open}
        aria-controls={id}
        disabled={disabled}
        onClick={onToggle}
        className={`${ROW} w-full text-left active:bg-surface-sunken disabled:cursor-not-allowed disabled:opacity-40`}
      >
        <span className={ROW_LABEL}>{label}</span>
        <span className={`min-w-0 flex-1 truncate text-right text-[15px] ${open ? 'text-foreground' : 'text-secondary'}`}>
          {current?.label ?? '–'}
        </span>
        <Icon name="chevron" className={`size-4 stroke-[2.6] text-muted transition-transform ${open ? '-rotate-90' : 'rotate-90'}`} />
      </button>

      {open && (
        <div id={id} role="radiogroup" aria-label={name} className="mb-2 mr-4 overflow-hidden rounded-xl bg-surface-sunken">
          {options.map((option) => {
            const checked = option.value === value;
            return (
              <label
                key={option.value}
                className="relative flex min-h-12 cursor-pointer items-center gap-2 border-t border-border px-3 first:border-t-0 has-[:focus-visible]:outline has-[:focus-visible]:outline-3 has-[:focus-visible]:-outline-offset-2 has-[:focus-visible]:outline-accent-soft"
              >
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
                  className="absolute inset-0 cursor-pointer appearance-none opacity-0"
                />
                <span className={`text-[15px] text-foreground ${checked ? 'font-semibold' : ''}`}>{option.label}</span>
                {option.hint && <span className="text-[13px] text-secondary">{option.hint}</span>}
                <span className="ml-auto">{checked && <Icon name="check" className="size-4 stroke-3 text-foreground" />}</span>
              </label>
            );
          })}
        </div>
      )}
    </div>
  );
}

/**
 * 숫자 칸이 오른쪽에 서는 줄. **좁으면 칸들이 이름 아래로 꺾인다**(`flex-wrap`) — 폰 360px 의 로그인 뒤 카드 안에서
 * 「생년월일」과 칸 셋 · 단위가 한 줄에 안 들었다(2026-09-29 잼).
 */
function DigitsRow({
  label,
  hint,
  invalid = false,
  children,
}: {
  label: string;
  hint?: string;
  invalid?: boolean;
  children: React.ReactNode;
}) {
  const id = useId();
  return (
    <div role="group" aria-labelledby={id} className="flex min-h-12 flex-wrap items-center gap-x-3 gap-y-1 py-1 pr-4">
      <span id={id} className={`flex shrink-0 flex-col text-[15px] leading-5 ${invalid ? 'text-danger' : 'text-foreground'}`}>
        {label}
        {hint && <span className="text-xs text-secondary">{hint}</span>}
      </span>
      <div className="ml-auto flex min-w-0 items-center justify-end gap-2">{children}</div>
    </div>
  );
}

/**
 * 음력 입력 아래에 적을 한 줄 — 바뀐 양력이거나, 못 바꾼 이유다.
 *
 * 못 바꾼 이유를 「변환할 수 없습니다」로 뭉개지 않는다. 표 밖·없는 윤달·없는 날은
 * 사용자가 할 일이 서로 다르고, 그 말을 이미 변환 모듈이 들고 있다.
 */
function convertedLine(value: Query): { ok: boolean; text: string } | null {
  if (value.calendar === 'solar' || value.date === '') return null;

  /*
    받지 않기로 한 해는 **변환해 볼 것도 없다.** 거절의 이유는 하나여야 하고, 그 하나는 우리가 받기로 한
    범위다(`birthYearRefusal` 이 생년월일 줄 밑에 선다).
  */
  if (birthYearRefusal(value) !== null) return null;

  try {
    const { year, month, day } = solarDateOf(value);
    return { ok: true, text: `양력 ${year}년 ${month}월 ${day}일로 계산해요` };
  } catch (error) {
    return { ok: false, text: error instanceof Error ? error.message : '양력으로 바꾸지 못했어요. 날짜를 다시 확인해 주세요.' };
  }
}

/** 네 자리로 다 적힌 해인가 — 타이핑 중인 「19」로는 달 길이를 셀 수 없다 */
const isFullYear = (year: string) => /^\d{4}$/.test(year);

/**
 * 달력이 정하는 날짜의 한계. 해의 범위는 `birthYearRangeOf` 가 든다 — 폼이 자기 범위를 따로 적으면 받는 칸과
 * 거절하는 자리가 갈린다. 음력은 상한 30까지만 열고 **없는 날은 변환이 이유를 붙여 거절한다**(`convertedLine`).
 */
function limitsOf(calendar: Calendar, year: string, month: string) {
  const years = birthYearRangeOf(calendar);

  const maxDay =
    calendar === 'solar' && isFullYear(year) && month !== ''
      ? new Date(Number(year), Number(month), 0).getDate()
      : calendar === 'solar'
        ? 31
        : 30;

  return { years, maxDay };
}

/**
 * 이 날짜를 그 달력으로 고를 수 있는가.
 *
 * 달력을 바꾸는 순간 **고를 수 있는 것 자체가 달라진다** — 음력은 1912년부터고 하루는
 * 30일까지다. 판정만 하고 고치지는 않는다. 고치는 것은 **달력을 바꾼 그 자리**의 일이다(`BirthFields`).
 */
export function fitsCalendar(date: string, calendar: Calendar): boolean {
  const { year, month, day } = splitDate(date);
  if (year === '') return true;

  const { years, maxDay } = limitsOf(calendar, year, month);
  return Number(year) >= years.min && Number(year) <= years.max && Number(day) <= maxDay;
}

/** 폼 안의 숫자 칸을 차례로 — 다 적으면 다음 칸, 빈 칸에서 지우면 앞 칸 */
const DIGIT_MARK = 'data-birth-digit';

function stepFrom(input: HTMLInputElement, step: 1 | -1) {
  const form = input.closest('[data-birth-form]');
  if (form === null) return;
  const all = [...form.querySelectorAll<HTMLInputElement>(`input[${DIGIT_MARK}]:not(:disabled)`)];
  const next = all[all.indexOf(input) + step];
  if (next === undefined) return;
  next.focus();
  if (step === 1) next.select();
}

/**
 * 숫자 한 칸 — **적는 칸이면서 범위를 아는 칸.**
 *
 * 다섯 칸(년·월·일·시·분)이 같은 일을 한다: 숫자만 받고, 자릿수를 넘기지 않고, 다 적힌 값이 제 범위를 벗어나면
 * 스스로 붉어진다. 덜 적은 것은 틀린 것이 아니다(`isSettled`). 다 적으면 다음 칸으로 넘어간다 — 그 기준도 같은 함수다.
 */
function NumberField({
  label,
  suffix,
  value,
  onChange,
  onPaste,
  digits,
  min,
  max,
  width,
  placeholder,
  disabled = false,
  autoComplete,
  missing = false,
}: {
  label: string;
  /** 칸 뒤에 서는 우리말 — 「년」·「월」·「시」. 이것이 있어 자리 이름을 안 물어도 된다 */
  suffix: string;
  value: string;
  onChange: (next: string) => void;
  /** 붙여 넣은 글을 줄 전체로 읽었으면 `true` — 그때는 칸 하나에 넣지 않는다 */
  onPaste?: (text: string) => boolean;
  digits: number;
  min: number;
  max: number;
  width: string;
  placeholder: string;
  disabled?: boolean;
  autoComplete?: string;
  /** 누른 뒤 빈칸으로 남은 칸 — 범위 밖과 같은 붉은 테를 두른다 */
  missing?: boolean;
}) {
  const outOfRange = isSettled(value, digits, max) && (Number(value) < min || Number(value) > max);

  return (
    <label className="flex shrink-0 items-center gap-1">
      <input
        type="text"
        inputMode="numeric"
        autoComplete={autoComplete}
        aria-label={label}
        aria-invalid={outOfRange || (missing && value === '') || undefined}
        {...{ [DIGIT_MARK]: '' }}
        placeholder={placeholder}
        value={value}
        disabled={disabled}
        onChange={(event) => {
          const next = event.target.value.replace(/\D/g, '').slice(0, digits);
          onChange(next);
          // 적어서 길어졌고 다 적혔으면 다음 칸으로 — 고치려고 지우는 중에는 안 넘긴다
          if (next.length > value.length && isSettled(next, digits, max)) stepFrom(event.target, 1);
        }}
        onKeyDown={(event) => {
          if (event.key === 'Backspace' && value === '') {
            event.preventDefault();
            stepFrom(event.currentTarget, -1);
          }
        }}
        onPaste={(event) => {
          if (onPaste === undefined) return;
          if (onPaste(event.clipboardData.getData('text'))) event.preventDefault();
        }}
        // `aria-invalid` 를 셀렉터로 쓴다 — 클래스를 덧붙이면 `DIGIT` 의 바탕과
        // 같은 무게라 어느 쪽이 이길지 정해지지 않는다. 변종 셀렉터는 한 겹 더 무겁다.
        className={`${DIGIT} ${width} aria-invalid:bg-danger-wash aria-invalid:text-danger aria-invalid:ring-2 aria-invalid:ring-danger`}
      />
      <span aria-hidden="true" className={`text-sm text-secondary ${disabled ? 'opacity-40' : ''}`}>
        {suffix}
      </span>
    </label>
  );
}

/** 다 적힌 숫자가 범위 안인가 — 반쪽인 값은 아직 날짜가 아니다 */
const within = (value: string, min: number, max: number) =>
  value !== '' && Number(value) >= min && Number(value) <= max;

/** 다 적혔는데 범위 밖인가 — 적는 동안 그 줄 밑에서 바로 말할 것 */
const settledOut = (value: string, digits: number, min: number, max: number) =>
  isSettled(value, digits, max) && (Number(value) < min || Number(value) > max);

/**
 * 년·월·일 세 칸 — **전부 적는 칸이다.**
 *
 * 고르는 칸으로 두면 연도는 백 줄이 넘는 목록이 되고, 흔한 해를 미리 넣어 두면 연도를 손대지 않은 사람도 그 해를
 * 고른 것이 된다. 「고르지 않은 것을 골랐다고 치지 않는다」가 이 폼 전체의 규율이다(`hourKnown` 이 셋인 이유).
 * 해의 자리표시도 같은 까닭으로 숫자를 안 쓴다 — 「2000」이 흐리게 서 있으면 이미 적힌 값처럼 읽혔다.
 *
 * 자리마다의 범위(월 1~12, 일 1~그 달의 마지막 날)를 벗어나면 날짜를 **내보내지 않는다** — `date` 가 빈 문자열로
 * 남고 제출은 `missingAnswer` 가 막는다. 날짜의 존재(없는 윤달 등)는 변환과 엔진이 이유를 붙여 거절한다.
 *
 * 폼이 자기 조각을 따로 들고 있으므로 **밖에서 값이 바뀐 것과 자기가 방금 낸 것을 구별한다**(뒤로가기·링크로 들어옴).
 */
function DateFields({
  value,
  onDate,
  gap,
  attempted,
}: {
  value: Query;
  onDate: (date: string) => void;
  /** 누른 뒤 이 줄이 첫 빈칸이면 그 문장 */
  gap: string | null;
  attempted: boolean;
}) {
  const noteId = useId();
  const [parts, setParts] = useState(() => splitDate(value.date));
  const lastEmitted = useRef(value.date);

  useEffect(() => {
    if (value.date === lastEmitted.current) return;
    setParts(splitDate(value.date));
    lastEmitted.current = value.date;
  }, [value.date]);

  const { years, maxDay } = limitsOf(value.calendar, parts.year, parts.month);

  const emit = (changed: typeof parts) => {
    setParts(changed);

    // 자리마다의 범위를 다 지켜야 날짜가 된다. 하나라도 어긋나면 내보내지 않는다 —
    // 「1990-13-05」를 실어 보내면 그 값을 판정하는 자리가 하나 더 생긴다.
    const limit = limitsOf(value.calendar, changed.year, changed.month).maxDay;
    const whole =
      isFullYear(changed.year) && within(changed.month, 1, 12) && within(changed.day, 1, limit);

    const date = whole ? `${changed.year}-${pad2(Number(changed.month))}-${pad2(Number(changed.day))}` : '';
    lastEmitted.current = date;
    onDate(date);
  };

  /** 「1990-05-15」 · 「1990년 5월 15일」을 어느 칸에 붙여 넣어도 세 칸에 나눠 든다 */
  const paste = (text: string) => {
    const read = parseDateText(text);
    if (read === null) return false;
    emit(read);
    return true;
  };

  /*
    **적는 동안 바로 말할 것** — 다 적힌 해 · 월 · 일이 범위 밖이다. 해는 계산이 거절하는 문장을 그대로 빌린다
    (`birthYearRefusal`) — 같은 사실을 두 문장으로 말하지 않는다.
  */
  const yearRefusal = isFullYear(parts.year)
    ? birthYearRefusal({ ...DEFAULT_QUERY, calendar: value.calendar, date: `${parts.year}-01-01` })
    : null;
  const live =
    yearRefusal ??
    (settledOut(parts.month, 2, 1, 12)
      ? '월은 1~12 사이로 입력해 주세요.'
      : settledOut(parts.day, 2, 1, maxDay)
        ? `일은 1~${maxDay} 사이로 입력해 주세요.`
        : null);

  const note = gap !== null ? (live ?? gap) : live;
  const missing = attempted && gap !== null;

  return (
    <div data-field="date">
      <DigitsRow label="생년월일" invalid={note !== null}>
        <NumberField
          label="출생연도"
          suffix="년"
          value={parts.year}
          onChange={(next) => emit({ ...parts, year: next })}
          onPaste={paste}
          digits={4}
          min={years.min}
          max={years.max}
          width="w-[3.75rem]"
          placeholder="4자리"
          autoComplete="bday-year"
          missing={missing}
        />
        <NumberField
          label="출생월"
          suffix="월"
          value={parts.month}
          onChange={(next) => emit({ ...parts, month: next })}
          onPaste={paste}
          digits={2}
          min={1}
          max={12}
          width="w-12"
          placeholder="1~12"
          autoComplete="bday-month"
          missing={missing}
        />
        <NumberField
          label="출생일"
          suffix="일"
          value={parts.day}
          onChange={(next) => emit({ ...parts, day: next })}
          onPaste={paste}
          digits={2}
          min={1}
          max={maxDay}
          width="w-12"
          placeholder={`1~${maxDay}`}
          autoComplete="bday-day"
          missing={missing}
        />
      </DigitsRow>
      {note !== null && <RowNote id={noteId} text={note} urgent={gap !== null} />}
    </div>
  );
}

function splitDate(date: string) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(date);
  return match ? { year: match[1], month: match[2], day: match[3] } : { year: '', month: '', day: '' };
}

function splitTime(time: string) {
  const match = /^(\d{2}):(\d{2})$/.exec(time);
  return match ? { hour: match[1], minute: match[2] } : { hour: '', minute: '' };
}

/**
 * 출생시각 — **24시간으로만 묻는다.**
 *
 * 오전·오후를 따로 고르게 하면 「오후 12시 30분」이 0시 30분인지 12시 30분인지에서 갈리고, 그 한 칸이 시주를 통째로
 * 바꾼다. 시각을 아는가는 「직접 입력 · 모름」 두 보기가 다 펴진 줄이다. 체크박스는 **꺼진 상태가 답처럼 보이지
 * 않아서** 쓰지 않는다(`hourKnown` 이 `null`·`false`·`true` 셋인 이유). 주소에서 온 `null` 이면 어느 알약도 안 켜지고
 * 시각 줄은 서지 않는다.
 *
 * 「모름」을 고르면 적어 둔 시각도 지운다. 남겨 두면 "모름인데 14:30" 이 상태로 남는다.
 */
function TimeFields({
  value,
  onChange,
  gap,
  attempted,
}: {
  value: Query;
  onChange: (next: Query) => void;
  gap: string | null;
  attempted: boolean;
}) {
  const noteId = useId();
  const [parts, setParts] = useState(() => splitTime(value.time));
  const lastEmitted = useRef(value.time);

  useEffect(() => {
    if (value.time === lastEmitted.current) return;
    setParts(splitTime(value.time));
    lastEmitted.current = value.time;
  }, [value.time]);

  /** 두 칸이 다 제 범위 안이어야 시각이 된다 — 「25:70」을 실어 보내지 않는다 */
  const timeOf = (from: typeof parts) =>
    within(from.hour, 0, 23) && within(from.minute, 0, 59)
      ? `${pad2(Number(from.hour))}:${pad2(Number(from.minute))}`
      : '';

  const emit = (changed: typeof parts) => {
    setParts(changed);
    const time = timeOf(changed);
    lastEmitted.current = time;
    onChange({ ...value, hourKnown: true, time });
  };

  /** 「14:30」 · 「1430」을 어느 칸에 붙여 넣어도 두 칸에 나눠 든다 */
  const paste = (text: string) => {
    const read = parseTimeText(text);
    if (read === null) return false;
    emit(read);
    return true;
  };

  const choose = (known: boolean) => {
    if (!known) {
      setParts({ hour: '', minute: '' });
      lastEmitted.current = '';
      onChange({ ...value, hourKnown: false, time: '' });
      return;
    }
    const time = timeOf(parts);
    lastEmitted.current = time;
    onChange({ ...value, hourKnown: true, time });
  };

  const known = value.hourKnown === true;
  const live = settledOut(parts.hour, 2, 0, 23)
    ? '시는 0~23 사이로 입력해 주세요.'
    : settledOut(parts.minute, 2, 0, 59)
      ? '분은 0~59 사이로 입력해 주세요.'
      : null;
  const note = gap !== null ? (live ?? gap) : known ? live : null;
  const missing = attempted && gap !== null;

  return (
    <div data-field="time" className="divide-y divide-border">
      <ChoiceRow
        label="출생 시각"
        value={value.hourKnown === null ? '' : value.hourKnown ? 'known' : 'unknown'}
        onPick={(next) => choose(next === 'known')}
        invalid={missing && value.hourKnown === null}
        options={[
          { value: 'known', label: '직접 입력' },
          { value: 'unknown', label: HOUR_UNKNOWN_CHOICE },
        ]}
      />
      {/*
        시·분도 **적는 칸**이다. 24시간이라 시는 스물넷, 분은 예순 줄짜리 목록이 되는데, 두 자리를 치는 편이
        어느 쪽이든 빠르다. 「직접 입력」일 때만 선다.
      */}
      {known && (
        <DigitsRow label="시각" hint="24시간" invalid={note !== null}>
          <NumberField
            label="출생 시"
            suffix="시"
            value={parts.hour}
            onChange={(next) => emit({ ...parts, hour: next })}
            onPaste={paste}
            digits={2}
            min={0}
            max={23}
            width="w-12"
            placeholder="0~23"
            missing={missing}
          />
          <NumberField
            label="출생 분"
            suffix="분"
            value={parts.minute}
            onChange={(next) => emit({ ...parts, minute: next })}
            onPaste={paste}
            digits={2}
            min={0}
            max={59}
            width="w-12"
            placeholder="0~59"
            missing={missing}
          />
        </DigitsRow>
      )}
      {/* 「모름」을 고른 뒤에야 그 답이 무엇을 바꾸는지 말한다 — 펼침 목록의 곁말이던 문장(대장 #338) */}
      {value.hourKnown === false && <p className="py-2.5 pr-4 text-[13px] leading-5 text-secondary">출생 시각 없이 풀이해요</p>}
      {note !== null && <RowNote id={noteId} text={note} urgent={gap !== null} />}
    </div>
  );
}

export function BirthFields({
  value,
  onChange,
  namePlaceholder,
  showName = true,
  attempt = 0,
}: {
  value: Query;
  onChange: (next: Query) => void;
  /** 이름 칸이 비었을 때 대신 보일 말 */
  namePlaceholder?: string;
  /** 본인은 계정 닉네임으로 부르므로 출생 정보에서 이름을 다시 묻지 않는다 */
  showName?: boolean;
  /**
   * 쓰는 화면이 제출을 눌렀다가 빈칸에 막힌 횟수 — 0 이면 아직 안 눌렀다.
   *
   * 1 이상이면 첫 빈칸의 줄에 문장이 서고, 값이 바뀔 때마다(다시 막힐 때마다) 초점이 그 칸으로 간다. 판정은
   * `missingAnswer` 그대로라(`gapOf`) 단추를 막는 쪽과 줄을 붉히는 쪽이 갈리지 않는다. 넘기지 않는 화면은 전과 같다.
   */
  attempt?: number;
}) {
  const set = <K extends keyof Query>(key: K, next: Query[K]) => onChange({ ...value, [key]: next });
  const root = useRef<HTMLDivElement>(null);

  /** 둘째 묶음에서 펼침은 하나만 열린다 — 다른 줄을 누르면 앞의 것이 접힌다 */
  const [open, setOpen] = useState<RowKey | null>(null);
  const toggle = (key: RowKey) => () => setOpen((current) => (current === key ? null : key));
  const pick = <K extends keyof Query>(key: K) => (next: Query[K]) => set(key, next);

  /**
   * 고급 설정을 편 채인가. **기본값이 아닌 값이 숨어 있으면 늘 펴져 있다** — 주소로 들어온 입력이나 고쳐 온
   * 판본이 진태양시가 아닐 때, 무엇으로 세운 명식인지가 접힘 뒤에 가린다.
   */
  const [advanced, setAdvanced] = useState(false);
  const advancedShown = advanced || value.basis !== DEFAULT_QUERY.basis;

  const attempted = attempt > 0;
  const gap: Gap | null = attempted ? gapOf(value) : null;
  const gapAt = (field: Gap['field']) => (gap?.field === field ? gap.message : null);

  /*
    **막힌 그 순간 첫 빈칸으로 데려간다.** 폰에서는 빈칸이 단추보다 한참 위라 문장이 서도 안 보인다. 비어 있거나
    붉어진 첫 칸, 없으면 그 줄의 첫 칸에 초점을 둔다.
  */
  /** 막힌 순간의 값 — 초점은 막힐 때마다 한 번만 옮기고, 값이 바뀔 때마다 빼앗지 않는다 */
  const latest = useRef(value);
  useEffect(() => {
    latest.current = value;
  });

  useEffect(() => {
    if (attempt === 0) return;
    const field = gapOf(latest.current)?.field;
    if (field === undefined) return;
    const row = root.current?.querySelector<HTMLElement>(`[data-field="${field}"]`);
    const target =
      row?.querySelector<HTMLInputElement>('input[aria-invalid="true"]') ??
      [...(row?.querySelectorAll<HTMLInputElement>('input') ?? [])].find(
        (input) => input.type !== 'radio' && input.value === '',
      ) ??
      row?.querySelector<HTMLInputElement>('input');
    target?.focus({ preventScroll: true });
    row?.scrollIntoView({ block: 'center', behavior: reducedMotion() ? 'instant' : 'smooth' });
  }, [attempt]);

  /**
   * 달력을 바꾸면 **못 고르게 된 날짜는 비운다.** 남겨 두면 화면에는 서 있는데 변환이 거절하는 값이 된다.
   */
  const chooseCalendar = (calendar: Calendar) =>
    onChange({
      ...value,
      calendar,
      date: fitsCalendar(value.date, calendar) ? value.date : '',
    });

  // 미리보기도 계산과 **같은 함수**를 부른다. 폼이 따로 변환하면 화면에 보인
  // 양력과 계산에 들어간 양력이 갈릴 수 있다.
  const converted = convertedLine(value);
  const nameGap = gapAt('name');
  const nameNote = useId();

  return (
    <div ref={root} data-birth-form="" className="flex flex-col gap-3">
      {/* 첫 묶음 — 사람이 답하는 것: 누구인가(이름 · 성별) → 언제(생년월일 · 달력 · 시각) */}
      <div className={GROUP}>
        {showName && (
          <div data-field="name">
            <label className={ROW}>
              <span className={nameGap !== null ? ROW_LABEL_INVALID : ROW_LABEL}>이름</span>
              <input
                type="text"
                value={value.name}
                onChange={(event) => set('name', event.target.value.slice(0, NAME_MAX))}
                placeholder={namePlaceholder}
                maxLength={NAME_MAX}
                aria-invalid={nameGap !== null || undefined}
                aria-describedby={nameGap !== null ? nameNote : undefined}
                enterKeyHint="next"
                className="h-11 min-w-0 flex-1 bg-transparent text-right text-base text-foreground outline-none placeholder:text-muted"
              />
            </label>
            {nameGap !== null && <RowNote id={nameNote} text={nameGap} urgent />}
          </div>
        )}

        <ChoiceRow
          label="성별"
          value={value.gender}
          onPick={pick('gender')}
          options={GENDERS.map((gender) => ({ value: gender, label: GENDER_KO[gender] }))}
        />

        <DateFields value={value} onDate={(date) => set('date', date)} gap={gapAt('date')} attempted={attempted} />

        {/*
          **달력은 날짜 바로 아래다.** 「1984-10-05」는 양력인지 음력인지가 정해져야 비로소 하루를 가리킨다. 세 보기가
          다 펴져 있어야 음력으로 아는 사람이 양력 칸에 그대로 적고 지나가지 않는다(ADR 0002).
        */}
        <div>
          <ChoiceRow
            label="달력"
            name="달력 기준"
            value={value.calendar}
            onPick={chooseCalendar}
            options={CALENDARS.map((calendar) => ({ value: calendar, label: CALENDAR_KO[calendar] }))}
          />
          {/* 달력과 날짜는 **함께 읽어야 뜻이 생긴다** — 무엇을 양력으로 잡았는지 계산 전에 그 줄 밑에서 말한다 */}
          {converted !== null && (
            <p
              role={converted.ok ? undefined : 'alert'}
              className={`pb-3 pr-4 text-[13px] leading-5 ${converted.ok ? 'text-secondary' : 'font-medium text-danger'}`}
            >
              {converted.text}
            </p>
          )}
        </div>

        <TimeFields value={value} onChange={onChange} gap={gapAt('time')} attempted={attempted} />
      </div>

      {/* 둘째 묶음 — 정해 둔 계산 기준. 손대지 않아도 되는 줄이라 답할 것과 떼어 둔다 */}
      <div className={GROUP}>
        <PickRow
          label="출생지"
          value={value.city}
          open={open === 'city'}
          onToggle={toggle('city')}
          onPick={pick('city')}
          options={CITIES.map((city) => ({ value: city, label: city }))}
        />

        <button
          type="button"
          aria-expanded={advancedShown}
          onClick={() => setAdvanced(!advancedShown)}
          className={`${ROW} w-full text-left active:bg-surface-sunken`}
        >
          <span className={ROW_LABEL}>고급 설정</span>
          <span className="min-w-0 flex-1 truncate text-right text-[13px] text-secondary">자시 · 시간 기준 · 세운</span>
          <Icon name="chevron" className={`size-4 stroke-[2.6] text-muted transition-transform ${advancedShown ? 'rotate-90' : 'rotate-0'}`} />
        </button>

        {advancedShown && (
          <>
            {/* 시간을 모르면 자시 경계에 걸릴 일이 없어 선택이 무의미하다 */}
            <PickRow
              label="자시"
              name="자시 규칙"
              value={value.rule}
              open={open === 'rule'}
              onToggle={toggle('rule')}
              onPick={pick('rule')}
              disabled={value.hourKnown === false}
              options={[
                { value: 'jo' as LateNightRule, label: '조자시', hint: '경계 23:00' },
                { value: 'ya' as LateNightRule, label: '야자시', hint: '경계 자정' },
              ]}
            />
            <PickRow
              label="시간 기준"
              value={value.basis}
              open={open === 'basis'}
              onToggle={toggle('basis')}
              onPick={pick('basis')}
              options={TIME_BASES.map((basis) => ({ value: basis, label: TIME_BASIS[basis].label, hint: TIME_BASIS[basis].hint }))}
            />
            <label className={ROW}>
              <span className={ROW_LABEL}>세운 연도</span>
              <input
                type="number"
                aria-label="세운 시작"
                value={value.saeunFrom}
                min={SUPPORTED_YEAR_RANGE.min}
                max={SUPPORTED_YEAR_RANGE.max}
                onChange={(event) => set('saeunFrom', Number(event.target.value))}
                className={`${DIGIT} ml-auto w-[4.5rem]`}
              />
            </label>
          </>
        )}
      </div>
    </div>
  );
}

type RowKey = 'city' | 'rule' | 'basis';
