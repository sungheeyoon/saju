'use client';

import { useEffect, useId, useLayoutEffect, useRef, useState, type ClipboardEvent, type KeyboardEvent, type RefObject } from 'react';

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
  HOUR_UNKNOWN_LABEL,
  NAME_MAX,
  TIME_BASES,
  TIME_BASIS,
  birthYearRangeOf,
  birthYearRefusal,
  type Query,
} from '@/src/lib/input/query';

import {
  DATE_DIGITS,
  TIME_DIGITS,
  caretAfterDigits,
  dateText,
  missingFieldOf,
  pastedBirth,
  timeText,
  typedDate,
  typedTime,
  type BirthField,
} from './birth-typing';
import { Icon } from './ui/icons';

/**
 * 생년월일시 입력 한 벌.
 *
 * 원국 화면과 궁합 화면이 같은 것을 묻는다. 두 곳에 같은 폼을 따로 두면 한쪽만
 * 고쳐져서 "같은 값을 넣었는데 다른 사주가 나오는" 상태가 만들어진다.
 *
 * 제출 버튼은 여기 없다. 원국은 폼 하나에 버튼 하나지만 궁합은 두 사람을 채운
 * 뒤 한 번 누르므로, 버튼의 자리와 문구는 쓰는 화면이 정한다.
 *
 * ## 폰 한 손으로 — 자판은 한 번 뜨고, 숫자는 두 칸에 친다 (모바일 시안, 2026-10-03)
 *
 * 묻는 것은 그대로이고 **적는 길**만 줄였다. 이름(글자 자판) → 「다음」 → 생년월일 여덟 자리(숫자 자판) → 다 차면 저절로
 * 출생 시각 네 자리 → 다 차면 자판이 내려간다. 그 아래 성별 · 출생지는 한 번 누르는 칸이다. 자판 바꿈은 한 번, 칸을 짚는
 * 손가락은 이름 한 번뿐이다(년 · 월 · 일 · 시 · 분 다섯 칸을 하나씩 짚던 때는 여섯 번이었다).
 *
 * - **고르는 것이 둘 · 셋인 칸은 펼치지 않고 다 보인다**(성별 · 달력). 펼침 줄은 「누르고 → 고르고」 두 번이고, 접힌 동안
 *   기본값(「여자」)이 회색 글자 하나로만 서서 안 고친 줄을 모른다.
 * - **출생지는 기기의 고르기 창이다**(`select`). iOS 는 아래에서 휠이, 안드로이드는 목록 창이 올라와 화면이 밀리지 않는다 —
 *   열 줄을 그 자리에 펼치면 단추가 화면 밖으로 480px 밀렸다.
 * - 계산 옵션(고급 설정)은 그대로 펼침 줄이다 — 드물게 열고, 고를 것마다 붙은 설명이 고르는 근거다.
 *
 * ## 왜 `<input type="date">`·`<input type="time">` 을 쓰지 않는가
 *
 * 네이티브 컨트롤은 **기기가 모양과 규칙을 정한다.** 같은 폼이 iOS 에서는 휠,
 * 안드로이드에서는 달력, 데스크톱에서는 칸 세 개로 뜨고, 시각은 로케일에 따라
 * 오전/오후로 갈린다. 여기서 묻는 것은 사주 계산에 쓰이는 **24시간 기준의 시·분**
 * 이라 오전/오후가 한 번 접히면 「오후 12시」가 0시인지 12시인지에서 갈린다.
 * 그리고 태어난 해는 대개 40~90년 전이라, 달력 위젯으로는 그만큼을 넘겨야 한다.
 * 하나 더 — **음력 날짜는 양력 달력이 못 담는다.** 음력 2월 30일은 있는 날이지만 `type="date"` 는 그 값을 거절한다.
 *
 * 그래서 숫자를 친다. 칸이 자리마다의 범위를 알아서, 폼이 반쪽 날짜를 들고 있을 수는 있어도 **없는 날짜를 내보내지는
 * 않는다**(아래 `DateField`).
 */

/**
 * 폼은 **설정 앱의 묶음 목록**이다(입력 폼 시안 n 「설정 목록」, ADR 0132).
 *
 * 흰 둥근 묶음 안에 줄마다 왼쪽 이름 · 오른쪽 값. 줄 하나에 이름과 값이 함께 서면 비어 있어도 무슨 칸인지 늘 보인다.
 * 줄 사이 선은 왼쪽 16px 을 들여 긋는다(묶음 `pl-4`, 줄 `pr-4`) — 한 묶음으로 읽힌다.
 */
const GROUP = 'overflow-hidden rounded-2xl bg-surface pl-4 shadow-card divide-y divide-border';

/** 줄 — 높이 48px 이상. 이름은 왼쪽, 값은 오른쪽 */
const ROW = 'flex min-h-12 items-center gap-3 pr-4';
const ROW_LABEL = 'shrink-0 text-[15px] text-foreground';

/**
 * 줄 안 오른쪽의 적는 칸 — 움푹한 칸, 오른쪽 정렬, 글자 16px(iOS 가 초점에서 화면을 키우지 않는 크기).
 *
 * **초점은 진하게 두른다**(`ring-accent`). 옅은 `accent-soft` 였던 동안 폰 햇빛 아래에서는 어느 칸에 자판이 붙었는지
 * 안 보였다. 비어 있을 때 보이는 예시(placeholder)는 옅은 회색이라 적은 값과 헷갈리지 않는다.
 */
const FIELD =
  'h-11 min-w-0 rounded-lg bg-surface-sunken px-2.5 text-right text-base tabular-nums text-foreground outline-none placeholder:text-muted focus:bg-surface focus:ring-2 focus:ring-accent aria-invalid:bg-danger-wash aria-invalid:text-danger aria-invalid:ring-2 aria-invalid:ring-danger';

/** 짧은 선택지가 나란히 선 칸의 바탕(궁합의 「저장한 사람 · 직접 입력」과 같은 몸) */
const SEGMENTS = 'flex min-w-0 flex-1 gap-1 rounded-full bg-surface-sunken p-1';
const SEGMENT =
  'relative flex min-h-9 flex-1 cursor-pointer items-center justify-center rounded-full px-2 text-[14px] has-[:focus-visible]:outline has-[:focus-visible]:outline-3 has-[:focus-visible]:outline-offset-1 has-[:focus-visible]:outline-accent-soft';
const SEGMENT_ON = 'bg-surface font-semibold text-foreground shadow-soft ring-1 ring-border';
const SEGMENT_OFF = 'font-medium text-secondary';

const CITIES = Object.keys(CITY_LONGITUDES) as CityName[];

const pad2 = (n: number) => String(n).padStart(2, '0');

type Option<T extends string> = {
  value: T;
  label: string;
  hint?: string;
  /** 낭독기가 부르는 온 이름 — 보이는 글자가 줄었을 때(「윤달」 → 「음력 윤달」) */
  spoken?: string;
};

/**
 * 누르면 그 자리에서 아래로 펼쳐지는 줄 — 고른 항목에 체크(✓), 고르면 접힌다.
 *
 * 줄은 `button` + `aria-expanded` 이고, 펼친 목록은 **진짜 라디오 묶음**이다. 단추에 `role="radio"` 를 달면 화살표
 * 이동과 한 번에 하나라는 규칙을 우리가 다시 짜야 한다 — 라디오는 브라우저가 그것을 이미 안다. 라디오는 보이지 않게
 * 줄 전체를 덮고(눌리는 것도 초점을 받는 것도 라디오다), 초점 테두리는 줄이 대신 두른다.
 *
 * **손으로 고르면 접히고 키보드로 옮기면 안 접힌다.** 화살표는 고르면서 옮기므로, 옮길 때마다 접으면 두 번째 항목에
 * 닿을 수 없다. 키보드로는 Enter 로 접는다 — 접히면 초점은 줄로 돌아간다.
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
  /** 낭독기가 부르는 묶음 이름 — 보이는 이름이 짧을 때(「달력」 → 「달력 기준」) */
  name?: string;
  options: readonly Option<T>[];
  /** 빈 문자열이면 아직 안 골랐다 — 값 자리에 「–」가 선다 */
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
 * 음력 입력 아래에 적을 한 줄 — 바뀐 양력이거나, 못 바꾼 이유다.
 *
 * 못 바꾼 이유를 「변환할 수 없습니다」로 뭉개지 않는다. 표 밖·없는 윤달·없는 날은
 * 사용자가 할 일이 서로 다르고, 그 말을 이미 변환 모듈이 들고 있다.
 */
function convertedLine(value: Query): { ok: boolean; text: string } | null {
  if (value.calendar === 'solar' || value.date === '') return null;

  /*
    받지 않기로 한 해는 **변환해 볼 것도 없다.**

    음력 표는 2100년까지 덮지만 태어난 해로는 2020년까지만 받는다. 두 범위가 다르므로
    범위 밖의 해에서는 두 문장이 동시에 설 수 있다 — 「음력 1912~2100년만 변환합니다」와
    「1912~2020년에 태어난 분만 계산합니다」. 나란히 두면 사용자는 자기가 무엇을 어겼는지
    고르게 된다. 거절의 이유는 하나여야 하고, 그 하나는 우리가 받기로 한 범위다.
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
 * 달력이 정하는 날짜의 한계.
 *
 * 해의 범위는 여기서 정하지 않는다 — `birthYearRangeOf` 가 든다. 폼이 자기 범위를
 * 따로 적으면 **받는 칸과 거절하는 자리가 갈린다.**
 *
 * 일수는 양력만 실제 달 길이를 안다. 음력은 그 달이 29일인지 30일인지가 표
 * 안에 있고 윤달까지 걸려서, 여기서는 상한 30까지만 열고 **없는 날은 변환이
 * 이유를 붙여 거절한다**(`convertedLine`). 폼이 표를 흉내 내면 판정하는 자리가
 * 둘이 된다.
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
 * 30일까지다. 밀려난 값을 그대로 들고 있으면 화면에는 서 있는데 변환이 거절하는,
 * 사용자가 무엇을 고쳐야 할지 알 수 없는 상태가 된다.
 *
 * 판정만 하고 고치지는 않는다. 고치는 것은 **달력을 바꾼 그 자리**의 일이다
 * (`BirthFields`) — 날짜 칸은 자기가 밖에서 지워졌다는 것만 알면 된다.
 */
export function fitsCalendar(date: string, calendar: Calendar): boolean {
  const { year, month, day } = splitDate(date);
  if (year === '') return true;

  const { years, maxDay } = limitsOf(calendar, year, month);
  return Number(year) >= years.min && Number(year) <= years.max && Number(day) <= maxDay;
}


/** 다 적힌 숫자가 범위 안인가 — 반쪽인 값은 아직 날짜가 아니다 */
const within = (value: string, min: number, max: number) =>
  value !== '' && Number(value) >= min && Number(value) <= max;

/**
 * 짧은 선택지가 나란히 선 줄 — **한 번 누르면 끝난다**(성별 · 달력).
 *
 * 진짜 라디오 묶음이다 — 화살표 이동과 한 번에 하나는 브라우저가 이미 안다. 라디오는 보이지 않게 칸 전체를 덮고(눌리는
 * 것도 초점을 받는 것도 라디오다), 고른 칸은 흰 면 · 굵은 글자로 선다. 칸 높이는 보이는 36px + 바탕 4px 위아래로
 * 누르는 자리가 44px 다.
 */
function Segments<T extends string>({
  label,
  name = label,
  options,
  value,
  onPick,
}: {
  label: string;
  /** 낭독기가 부르는 묶음 이름 — 보이는 이름이 짧을 때(「달력」 → 「달력 기준」) */
  name?: string;
  options: readonly Option<T>[];
  value: T;
  onPick: (value: T) => void;
}) {
  const id = useId();
  return (
    <div className={`${ROW} py-1`}>
      <span aria-hidden="true" className={ROW_LABEL}>
        {label}
      </span>
      <div role="radiogroup" aria-label={name} className={`${SEGMENTS} ml-auto max-w-[16rem]`}>
        {options.map((option) => {
          const checked = option.value === value;
          return (
            <label key={option.value} className={`${SEGMENT} ${checked ? SEGMENT_ON : SEGMENT_OFF}`}>
              <input
                type="radio"
                name={id}
                aria-label={option.spoken}
                checked={checked}
                onChange={() => onPick(option.value)}
                className="absolute inset-0 cursor-pointer appearance-none opacity-0"
              />
              <span className="whitespace-nowrap">{option.label}</span>
            </label>
          );
        })}
      </div>
    </div>
  );
}

function splitDate(date: string) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(date);
  return match ? { year: match[1], month: match[2], day: match[3] } : { year: '', month: '', day: '' };
}

/** 날짜 · 시각을 쪼갠 숫자열로 — 밖에서 온 값(주소 · 저장된 판본)을 칸에 세울 때 */
const dateDigitsOf = (date: string) => (/^\d{4}-\d{2}-\d{2}$/.test(date) ? date.replaceAll('-', '') : '');
const timeDigitsOf = (time: string) => (/^\d{2}:\d{2}$/.test(time) ? time.replace(':', '') : '');

/**
 * 숫자열이 그 달력의 날짜가 되면 `YYYY-MM-DD`, 아니면 빈 글.
 *
 * 자리마다의 범위(월 1~12, 일 1~그 달의 마지막 날)를 다 지켜야 날짜가 된다. 하나라도 어긋나면 내보내지 않는다 —
 * 「1990-13-05」를 실어 보내면 그 값을 판정하는 자리가 하나 더 생긴다. 해의 범위는 여기서 거르지 않는다 —
 * `birthYearRefusal` 이 이유를 붙여 거절한다(받는 칸과 거절하는 자리가 갈리지 않게).
 */
function dateOfDigits(digits: string, calendar: Calendar): string {
  const year = digits.slice(0, 4);
  const month = digits.slice(4, 6);
  const day = digits.slice(6, 8);
  const { maxDay } = limitsOf(calendar, year, month);
  const whole = digits.length === DATE_DIGITS && within(month, 1, 12) && within(day, 1, maxDay);
  return whole ? `${year}-${pad2(Number(month))}-${pad2(Number(day))}` : '';
}

/** 다 적었는데 없는 월 · 일인가 — 덜 적은 것은 아직 틀린 것이 아니다 */
function impossibleDate(digits: string, calendar: Calendar): boolean {
  const month = digits.slice(4, 6);
  const day = digits.slice(6, 8);
  if (month.length === 2 && !within(month, 1, 12)) return true;
  if (day.length === 2 && !within(day, 1, limitsOf(calendar, digits.slice(0, 4), month).maxDay)) return true;
  return false;
}

/** 네 자리가 다 적혔는데 받는 범위 밖의 해인가 — 칸만 붉힌다. 문장은 날짜가 다 차면 `birthYearRefusal` 이 세운다 */
function yearOutOfRange(digits: string, calendar: Calendar): boolean {
  if (digits.length < 4) return false;
  const { years } = limitsOf(calendar, digits.slice(0, 4), '');
  const year = Number(digits.slice(0, 4));
  return year < years.min || year > years.max;
}

const timeOfDigits = (digits: string) =>
  digits.length === TIME_DIGITS && within(digits.slice(0, 2), 0, 23) && within(digits.slice(2), 0, 59)
    ? `${digits.slice(0, 2)}:${digits.slice(2)}`
    : '';

const impossibleTime = (digits: string) =>
  (digits.length >= 2 && !within(digits.slice(0, 2), 0, 23)) || (digits.length === 4 && !within(digits.slice(2), 0, 59));

/**
 * 꾸민 글(점 · 쌍점)을 그리는 칸의 커서 — **가운데를 고치면 그 자리에 남는다.**
 *
 * 값을 다시 꾸미면 브라우저는 커서를 끝으로 보낸다. 끝에서 치는 동안은 그것이 맞고, 가운데 한 자리를 고칠 때만 그
 * 자리의 숫자 수를 세어 둔 뒤 다시 놓는다.
 */
function useDigitCaret(input: RefObject<HTMLInputElement | null>, text: string) {
  const pending = useRef<number | null>(null);
  useLayoutEffect(() => {
    if (pending.current === null || input.current === null || document.activeElement !== input.current) return;
    const at = caretAfterDigits(text, pending.current);
    input.current.setSelectionRange(at, at);
    pending.current = null;
  }, [input, text]);

  /** 바뀐 글과 커서에서 「커서 앞 숫자 수」를 적어 둔다 — 커서가 끝이면 비워 둔다(브라우저가 알아서 끝에 둔다) */
  return (raw: string, caret: number | null) => {
    pending.current = caret === null || caret >= raw.length ? null : raw.slice(0, caret).replace(/\D/g, '').length;
  };
}

/**
 * 생년월일 한 칸 — **숫자 여덟 자리를 치면 점은 칸이 넣는다**(`1990.05.15`).
 *
 * 년 · 월 · 일 세 칸이던 동안 폰에서는 칸마다 손가락이 화면으로 돌아왔고, 「1~12」 같은 예시가 칸마다 서서 적은 값처럼
 * 보였다(연도 칸의 예시 「2000」은 실제로 적힌 해로 읽혔다). 한 칸이면 자판이 한 번 뜨고 숫자만 친다.
 *
 * - 첫 자리로 두 자리가 될 수 없는 월 · 일(2~9월, 4~9일)은 앞에 0 을 채운다(`birth-typing.ts`) — 「1990」 「5」 「15」.
 * - 다 차서 날짜가 되면 시각 칸으로 넘어간다(`onFilled`). 숫자 자판에는 「다음」 키가 없거나 멀다.
 * - 생일 한 줄을 붙여 넣으면(`1990.5.15 14:30`) 날짜 · 시각이 함께 찬다(`onPasted`).
 *
 * 폼이 자기 숫자열을 따로 들고 있으므로 **밖에서 값이 바뀐 것과 자기가 방금 낸 것을 구별한다**(뒤로가기 · 링크로
 * 들어옴 · 달력을 바꿔 날짜가 비워짐). 마지막으로 올려 보낸 값을 기억해 두고 그것과 다를 때만 다시 세운다.
 */
function DateField({
  value,
  onDate,
  onPasted,
  onFilled,
  input,
  missing,
  describedBy,
  self,
  onImpossible,
}: {
  value: Query;
  onDate: (date: string) => void;
  /** 다 적었는데 없는 월 · 일이 됐다 · 풀렸다 — 묶음 아래 문장을 세운다 */
  onImpossible: (impossible: boolean) => void;
  /** 붙여 넣은 글에 시각까지 있었다 — 날짜와 시각을 한 번에 올린다 */
  onPasted: (date: string, time: string) => void;
  /** 날짜가 다 찼다 · 「다음」을 눌렀다 — 다음 칸으로 */
  onFilled: () => void;
  input: RefObject<HTMLInputElement | null>;
  /** 제출이 이 칸에서 막혔다 */
  missing: boolean;
  describedBy?: string;
  self: boolean;
}) {
  const [digits, setDigits] = useState(() => dateDigitsOf(value.date));
  const lastEmitted = useRef(value.date);
  const text = dateText(digits);
  const remember = useDigitCaret(input, text);

  useEffect(() => {
    if (value.date === lastEmitted.current) return;
    setDigits(dateDigitsOf(value.date));
    lastEmitted.current = value.date;
  }, [value.date]);

  const take = (next: string) => {
    setDigits(next);
    const date = dateOfDigits(next, value.calendar);
    lastEmitted.current = date;
    onDate(date);
    return date;
  };

  const paste = (event: ClipboardEvent<HTMLInputElement>) => {
    const pasted = pastedBirth(event.clipboardData.getData('text'));
    if (pasted === null) return;
    event.preventDefault();
    setDigits(pasted.date);
    const date = dateOfDigits(pasted.date, value.calendar);
    lastEmitted.current = date;
    const time = pasted.time === null ? '' : timeOfDigits(pasted.time);
    if (time !== '') onPasted(date, time);
    else onDate(date);
    if (date !== '' && time === '') onFilled();
    else if (date !== '') input.current?.blur();
  };

  const impossible = impossibleDate(digits, value.calendar);
  useEffect(() => onImpossible(impossible), [impossible, onImpossible]);
  const invalid = impossible || yearOutOfRange(digits, value.calendar) || (missing && digits.length < DATE_DIGITS);

  return (
    <label className={`${ROW} py-1`}>
      <span className={ROW_LABEL}>생년월일</span>
      <input
        ref={input}
        data-birth-field="date"
        type="text"
        inputMode="numeric"
        pattern="[0-9.]*"
        enterKeyHint="next"
        autoComplete={self ? 'bday' : 'off'}
        aria-label="생년월일"
        aria-invalid={invalid || undefined}
        aria-describedby={describedBy}
        placeholder="YYYY.MM.DD"
        value={text}
        maxLength={DATE_DIGITS + 4}
        onPaste={paste}
        onChange={(event) => {
          const raw = event.target.value;
          const next = typedDate(digits, raw, (year, month) => limitsOf(value.calendar, year, month).maxDay);
          remember(raw, event.target.selectionStart);
          const date = take(next);
          // 끝에서 마지막 자리를 친 누름만 넘어간다 — 가운데를 고치는 손을 끌고 가지 않는다
          if (date !== '' && next.length > digits.length && event.target.selectionStart === raw.length) onFilled();
        }}
        onKeyDown={(event: KeyboardEvent<HTMLInputElement>) => {
          if (event.key !== 'Enter') return;
          event.preventDefault();
          onFilled();
        }}
        className={`${FIELD} ml-auto w-[8.75rem]`}
      />
    </label>
  );
}

/**
 * 출생 시각 — **24시간 네 자리 한 칸과 「모름」 하나.**
 *
 * 오전·오후를 따로 고르게 하면 「오후 12시 30분」이 0시 30분인지 12시 30분인지에서
 * 갈리고, 그 한 칸이 시주를 통째로 바꾼다. 자시 규칙(조자시 23:00 경계)도 23시가
 * 23시로 적혀 있을 때만 사람이 대조할 수 있다. 그래서 칸 이름 아래에 「24시간」을 둔다.
 *
 * 시각을 아는가는 `hourKnown` 이 `null`·`false`·`true` 셋이다 — **고르지 않은 것을 고른 것으로 치지 않는다.** 폼은
 * 「적으라는 요구」(`true`)에서 시작하고, 「모름」을 누르면 `false`, 칸에 숫자를 치면 다시 `true` 다. 주소에서 온
 * `null` 이면 칸은 비고 「모름」도 안 눌린 채 서서, 둘 중 하나를 해야 제출이 된다(`missingAnswer`).
 *
 * 「모름」은 펼침 줄의 답이던 것을 칸 옆 단추로 옮겼다 — 「누르고 → 고르고」 두 번이 한 번이 된다. 누르면 적어 둔 시각도
 * 지운다. 남겨 두면 "모름인데 14:30" 이 상태로 남고, 다시 적는 순간 사용자가 지웠다고 생각한 값으로 계산된다.
 *
 * **다 차면 자판을 내린다.** iOS 의 숫자 자판에는 닫는 키가 없어서, 마지막 칸을 다 적은 손이 자판을 내리려고 빈 곳을
 * 짚어야 했다 — 그 아래의 성별 · 출생지 · 단추가 자판에 가려 있었다.
 */
function TimeField({
  value,
  onChange,
  input,
  missing,
  describedBy,
  onImpossible,
}: {
  value: Query;
  onChange: (next: Query) => void;
  input: RefObject<HTMLInputElement | null>;
  missing: boolean;
  describedBy?: string;
  /** 없는 시 · 분이 됐다 · 풀렸다 */
  onImpossible: (impossible: boolean) => void;
}) {
  const [digits, setDigits] = useState(() => timeDigitsOf(value.time));
  const lastEmitted = useRef(value.time);
  const text = timeText(digits);
  const remember = useDigitCaret(input, text);
  const hintId = useId();

  useEffect(() => {
    if (value.time === lastEmitted.current) return;
    setDigits(timeDigitsOf(value.time));
    lastEmitted.current = value.time;
  }, [value.time]);

  const unknown = value.hourKnown === false;

  const toggleUnknown = () => {
    if (unknown) {
      onChange({ ...value, hourKnown: true });
      input.current?.focus();
      return;
    }
    setDigits('');
    lastEmitted.current = '';
    onChange({ ...value, hourKnown: false, time: '' });
  };

  const impossible = impossibleTime(digits);
  useEffect(() => onImpossible(impossible), [impossible, onImpossible]);
  const invalid = impossible || (missing && !unknown && digits.length < TIME_DIGITS);

  return (
    <div className={`${ROW} py-1`}>
      <label htmlFor={`${hintId}-time`} className="flex shrink-0 flex-col text-[15px] leading-5 text-foreground">
        출생 시각
        <span id={hintId} className="text-xs text-secondary">
          24시간
        </span>
      </label>
      <div className="ml-auto flex min-w-0 items-center gap-2">
        <input
          ref={input}
          id={`${hintId}-time`}
          data-birth-field="time"
          type="text"
          inputMode="numeric"
          pattern="[0-9:]*"
          enterKeyHint="done"
          autoComplete="off"
          aria-label="출생 시각"
          aria-invalid={invalid || undefined}
          aria-describedby={[hintId, describedBy].filter(Boolean).join(' ')}
          placeholder={unknown ? '–' : 'HH:MM'}
          value={text}
          maxLength={TIME_DIGITS + 1}
          onChange={(event) => {
            const raw = event.target.value;
            const next = typedTime(digits, raw);
            remember(raw, event.target.selectionStart);
            setDigits(next);
            const time = timeOfDigits(next);
            lastEmitted.current = time;
            onChange({ ...value, hourKnown: true, time });
            if (time !== '' && next.length > digits.length && event.target.selectionStart === raw.length) {
              event.target.blur();
            }
          }}
          className={`${FIELD} w-[5.25rem] ${unknown ? 'opacity-60' : ''}`}
        />
        <button
          type="button"
          aria-pressed={unknown}
          aria-label={HOUR_UNKNOWN_LABEL}
          onClick={toggleUnknown}
          className={`inline-flex min-h-11 shrink-0 items-center gap-1 rounded-full px-3 text-[14px] ring-1 ${
            unknown ? 'bg-accent-wash font-semibold text-foreground ring-border-strong' : 'bg-surface font-medium text-secondary ring-border'
          }`}
        >
          {unknown && <Icon name="check" className="size-3 stroke-[3.6]" />}
          {HOUR_UNKNOWN_CHOICE}
        </button>
      </div>
    </div>
  );
}

/**
 * 제출이 막힌 칸으로 초점을 옮긴다 — 거절의 문장(`missingAnswer`)은 단추 곁에 서고, 손가락은 고칠 칸에 바로 닿는다.
 * 폰에서는 칸으로 화면이 굴러가고 자판이 그 칸에 붙는다.
 */
export function focusMissingField(root: ParentNode | null, query: Query): void {
  const field = missingFieldOf(query);
  if (field === null || root === null) return;
  root.querySelector<HTMLElement>(`[data-birth-field="${field}"]`)?.focus();
}

export function BirthFields({
  value,
  onChange,
  namePlaceholder,
  showName = true,
  self = false,
  tried = false,
}: {
  value: Query;
  onChange: (next: Query) => void;
  /** 이름 칸이 비었을 때 대신 보일 말 */
  namePlaceholder?: string;
  /** 본인은 계정 닉네임으로 부르므로 출생 정보에서 이름을 다시 묻지 않는다 */
  showName?: boolean;
  /**
   * 적는 사람 자신의 출생 정보인가 — **기기의 자동완성(이름 · 생일)은 이때만 연다.** 남의 사주를 적는 칸에 내 생일이
   * 제안되면 한 번 잘못 누른 것이 그 사람의 사주가 된다.
   */
  self?: boolean;
  /** 제출을 눌렀는데 막혔다 — 막은 칸을 붉힌다(문장은 쓰는 화면이 단추 곁에 세운다) */
  tried?: boolean;
}) {
  const set = <K extends keyof Query>(key: K, next: Query[K]) => onChange({ ...value, [key]: next });

  const dateInput = useRef<HTMLInputElement>(null);
  const timeInput = useRef<HTMLInputElement>(null);
  const notesId = useId();

  /** 칸이 아는 「없는 날짜 · 없는 시각」 — 숫자열은 칸이 들고 있으므로 칸이 알려 준다 */
  const [impossibleDay, setImpossibleDay] = useState(false);
  const [impossibleHour, setImpossibleHour] = useState(false);

  /** 한 묶음에서 펼침은 하나만 열린다 — 고급 설정의 두 줄 */
  const [open, setOpen] = useState<RowKey | null>(null);
  const toggle = (key: RowKey) => () => setOpen((current) => (current === key ? null : key));
  const pick = <K extends keyof Query>(key: K) => (next: Query[K]) => set(key, next);

  /**
   * 고급 설정을 편 채인가. **기본값이 아닌 값이 숨어 있으면 늘 펴져 있다** — 주소로 들어온 입력이나 고쳐 온
   * 판본이 진태양시가 아닐 때, 무엇으로 세운 명식인지가 접힘 뒤에 가린다. 기본값을 옮겨도 이 규칙은 따라온다.
   */
  const [advanced, setAdvanced] = useState(false);
  const advancedShown = advanced || value.basis !== DEFAULT_QUERY.basis;

  /**
   * 달력을 바꾸면 **못 고르게 된 날짜는 비운다.**
   *
   * 양력 1908년을 고른 사람이 음력으로 옮기면 그 해는 표 밖이다(1912~). 남겨 두면
   * 화면에는 서 있는데 변환이 거절하는 값이 되고, 그때 화면은 사용자가 방금 고른 것을
   * 잃어버린 것처럼 보인다. 지우는 이유를 변환 줄이 바로 아래에서 말하므로
   * (`convertedLine`), 지운 자리는 침묵하지 않는다.
   */
  const chooseCalendar = (calendar: Calendar) =>
    onChange({
      ...value,
      calendar,
      date: fitsCalendar(value.date, calendar) ? value.date : '',
    });

  /** 날짜가 다 찼다 — 시각을 적을 차례면 시각 칸으로, 「모름」이면 자판을 내린다 */
  const afterDate = () => {
    if (value.hourKnown === false) dateInput.current?.blur();
    else timeInput.current?.focus();
  };

  // 미리보기도 계산과 **같은 함수**를 부른다. 폼이 따로 변환하면 화면에 보인
  // 양력과 계산에 들어간 양력이 갈릴 수 있다.
  const converted = convertedLine(value);
  const yearRefusal = birthYearRefusal(value);
  const missing: BirthField | null = tried ? missingFieldOf(value) : null;

  return (
    /*
      **묻는 차례는 손이 가는 차례다** — 적는 칸(이름 → 생년월일 → 출생 시각)이 위에서 이어지고, 자판이 내려간 뒤 한 번
      누르는 칸(성별 · 출생지)이 단추 쪽으로 이어진다. 달력은 날짜 바로 아래다 — 「1984-10-05」는 양력인지 음력인지가
      정해져야 비로소 하루를 가리킨다. 계산 옵션은 따로 떨어진 묶음이다(시안 n, ADR 0132).
    */
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-1.5">
        <div className={GROUP}>
          {showName && (
            <label className={`${ROW} py-1`}>
              <span className={ROW_LABEL}>이름</span>
              <input
                type="text"
                data-birth-field="name"
                value={value.name}
                onChange={(event) => set('name', event.target.value.slice(0, NAME_MAX))}
                onKeyDown={(event) => {
                  // 자판의 「다음」 — 이름 다음은 생년월일이다. 한글 조합 중의 Enter 는 조합을 끝내는 누름이라 넘기지 않는다
                  if (event.key !== 'Enter' || event.nativeEvent.isComposing) return;
                  event.preventDefault();
                  dateInput.current?.focus();
                }}
                enterKeyHint="next"
                autoComplete={self ? 'name' : 'off'}
                aria-invalid={missing === 'name' || undefined}
                placeholder={namePlaceholder}
                maxLength={NAME_MAX}
                className={`${FIELD} ml-auto w-full max-w-[12rem] text-right`}
              />
            </label>
          )}

          <DateField
            value={value}
            onDate={(date) => set('date', date)}
            onPasted={(date, time) => onChange({ ...value, date, hourKnown: true, time })}
            onFilled={afterDate}
            input={dateInput}
            missing={missing === 'date'}
            describedBy={notesId}
            self={self}
            onImpossible={setImpossibleDay}
          />

          <Segments
            label="달력"
            name="달력 기준"
            value={value.calendar}
            onPick={chooseCalendar}
            options={CALENDARS.map((calendar) => ({
              value: calendar,
              // 좁은 칸에는 「윤달」만 — 「음력」이 바로 옆에 있어 무엇의 윤달인지 읽힌다. 낭독기는 온 이름을 듣는다
              label: calendar === 'lunar_leap' ? '윤달' : CALENDAR_KO[calendar],
              spoken: CALENDAR_KO[calendar],
            }))}
          />

          <TimeField
            value={value}
            onChange={onChange}
            input={timeInput}
            missing={missing === 'time'}
            describedBy={notesId}
            onImpossible={setImpossibleHour}
          />

          <Segments
            label="성별"
            value={value.gender}
            onPick={pick('gender')}
            options={GENDERS.map((gender) => ({ value: gender, label: GENDER_KO[gender] }))}
          />

          {/*
            **출생지는 폼 안에 선다** — 진태양시의 경도라 계산에 들고(운영자 2026-09-29 「출생지도 폼에 넣어야」),
            서울이 아닌 사람이 접힌 칸을 열어 볼 까닭이 없다. 기기의 고르기 창이라 줄 전체가 누르는 자리다.
          */}
          <label className={`${ROW} relative`}>
            <span className={ROW_LABEL}>출생지</span>
            <select
              value={value.city}
              onChange={(event) => set('city', event.target.value as CityName)}
              className="h-12 min-w-0 flex-1 cursor-pointer appearance-none bg-transparent pr-6 text-right text-[15px] text-secondary outline-none [text-align-last:right] focus-visible:text-foreground"
            >
              {CITIES.map((city) => (
                <option key={city} value={city}>
                  {city}
                </option>
              ))}
            </select>
            <Icon
              name="chevron"
              className="pointer-events-none absolute right-4 size-4 rotate-90 stroke-[2.6] text-muted"
            />
          </label>
        </div>

        {/*
          달력 형식과 날짜는 **함께 읽어야 뜻이 생긴다.** 그래서 변환 결과를 묶음 바로 밑에 적는다 — **저장이나
          계산 전에.** 사용자가 아는 것은 음력 날짜뿐인데, 우리가 무엇을 양력으로 잡았는지 못 보면 잘못 골랐다는
          것을 결과 화면에 가서야 알게 된다. 받지 않는 해 · 없는 날짜 · 없는 시각도 여기서 바로 말한다 — 칸이 붉어지기만
          하면 무엇이 틀렸는지 화면 읽기로는 알 수 없다.
        */}
        <div id={notesId} aria-live="polite" className="flex flex-col gap-1 px-4 empty:hidden">
          {converted !== null && (
            // 색으로만 가르지 않는다 — 못 바꾼 줄은 문장 자체가 이유를 말한다.
            <p
              role={converted.ok ? undefined : 'alert'}
              className={`text-xs ${converted.ok ? 'text-secondary' : 'font-medium text-danger'}`}
            >
              {converted.text}
            </p>
          )}
          {/* 눌러 본 뒤에는 같은 문장이 단추 곁에 선다(쓰는 화면의 거절) — 두 번 세우지 않는다 */}
          {yearRefusal !== null && !tried && <p className="text-xs font-medium text-danger">{yearRefusal}</p>}
          {impossibleDay && <p className="text-xs font-medium text-danger">없는 날짜예요. 월과 일을 확인해 주세요.</p>}
          {impossibleHour && (
            <p className="text-xs font-medium text-danger">없는 시각이에요. 00:00~23:59 사이로 적어 주세요.</p>
          )}
        </div>
      </div>

      <div className={GROUP}>
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
                className={`${FIELD} ml-auto w-[4.5rem]`}
              />
            </label>
          </>
        )}
      </div>
    </div>
  );
}

type RowKey = 'rule' | 'basis';
