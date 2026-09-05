'use client';

import { useEffect, useRef, useState } from 'react';

import {
  CALENDARS,
  CALENDAR_KO,
  CITY_LONGITUDES,
  GENDERS,
  GENDER_KO,
  SUPPORTED_YEAR_RANGE,
  type Calendar,
  type CityName,
  type Gender,
  type LateNightRule,
} from '@/src/lib/saju';

import { solarDateOf } from './chart';
import {
  HOUR_UNKNOWN_CHOICE,
  HOUR_UNKNOWN_LABEL,
  NAME_MAX,
  TIME_BASES,
  TIME_BASIS,
  birthYearRangeOf,
  birthYearRefusal,
  type Query,
  type TimeBasis,
} from './query';

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
 * 그래서 년·월·일과 시·분을 각각 고르게 한다. 고르는 것만 허용하므로 폼이 반쪽
 * 날짜를 들고 있을 수는 있어도 **없는 날짜를 들 수는 없다.**
 */

export const FIELD =
  'h-11 rounded-xl border border-border bg-surface px-3 text-sm outline-none focus:border-accent focus:ring-2 focus:ring-accent-wash';

/**
 * 세그먼트 하나 — 라디오 둘·셋이 한 줄에 서는 자리.
 *
 * 라디오를 `sr-only` 로 숨기지 않는다. 숨기면 **글자만 누를 수 있는 칸**이 되고,
 * 라벨을 못 짚는 손(자동화·보조기기 일부)에는 누를 것이 없는 칸이 된다. 대신
 * 라벨을 덮게 깔아 두고 투명하게 만든다 — 눌리는 것도 초점을 받는 것도 라디오
 * 자신이고, 칸 전체가 그 라디오다.
 *
 * 투명해진 만큼 초점 테두리도 안 보이므로 라벨이 대신 두른다(`has-[:focus-visible]`).
 */
const SEGMENT = 'grid rounded-xl bg-surface-sunken p-1';
const SEGMENT_ITEM =
  'relative cursor-pointer rounded-lg px-2 py-2 text-center text-sm font-medium transition-colors' +
  ' has-[:focus-visible]:outline has-[:focus-visible]:outline-3' +
  ' has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-accent-soft';
/** 칸 전체를 덮는 라디오 — 보이지는 않지만 이것이 눌린다 */
const SEGMENT_INPUT = 'absolute inset-0 cursor-pointer appearance-none opacity-0';

const CITIES = Object.keys(CITY_LONGITUDES) as CityName[];

const pad2 = (n: number) => String(n).padStart(2, '0');

export function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="flex min-w-0 flex-col gap-1.5">
      <span className="text-xs font-semibold text-secondary">{label}</span>
      {children}
    </label>
  );
}

/**
 * `Field` 와 같아 보이지만 **label 이 아니다.**
 *
 * 라디오는 저마다 제 label 을 달아야 하는데 `Field` 안에 넣으면 label 이
 * 중첩돼 클릭이 엉뚱한 곳으로 간다. 묶음 제목이 필요하지만 클릭 대상은 아닌
 * 자리에 쓴다.
 */
function Group({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex min-w-0 flex-col gap-1.5">
      <span className="text-xs font-semibold text-secondary">{label}</span>
      {children}
    </div>
  );
}

/** 시간 기준 하나를 고르는 라디오. 세 개가 한 그룹이라 조합이 생기지 않는다. */
export function BasisRadio({
  name,
  basis,
  checked,
  onChange,
}: {
  /** 라디오 그룹 이름 — 궁합 화면에는 그룹이 둘이라 서로 달라야 한다 */
  name: string;
  basis: TimeBasis;
  checked: boolean;
  onChange: () => void;
}) {
  const { label, hint } = TIME_BASIS[basis];

  return (
    <label className="flex cursor-pointer items-center gap-1.5">
      <input
        type="radio"
        name={name}
        value={basis}
        checked={checked}
        onChange={onChange}
        className="accent-accent"
      />
      <span>{label}</span>
      <span className="text-xs text-muted">{hint}</span>
    </label>
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
    return { ok: true, text: `양력 ${year}년 ${month}월 ${day}일로 계산합니다` };
  } catch (error) {
    return { ok: false, text: error instanceof Error ? error.message : '양력으로 바꾸지 못했습니다.' };
  }
}

/** 화살표를 얹은 select 껍데기 — `appearance-none` 으로 지운 기본 화살표를 대신한다 */
function SelectShell({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={`relative min-w-0 ${className}`}>
      {children}
      <svg
        viewBox="0 0 12 12"
        aria-hidden="true"
        className="pointer-events-none absolute right-2.5 top-1/2 size-3 -translate-y-1/2 text-muted"
      >
        <path d="M2.5 4.5 6 8l3.5-3.5" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    </div>
  );
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

/**
 * 숫자 한 칸 — **적는 칸이면서 범위를 아는 칸.**
 *
 * 여섯 칸(년·월·일·시·분)이 같은 일을 한다: 숫자만 받고, 자릿수를 넘기지 않고,
 * 제 범위를 벗어나면 스스로 붉어진다. 한 벌로 두지 않으면 어느 칸 하나가
 * 「25시」를 조용히 받아들이는 날이 온다.
 *
 * **판정은 여기서 끝나지 않는다.** 이 칸이 아는 것은 자기 범위뿐이라 「2월 30일」이
 * 나 「없는 윤달」은 못 본다 — 그것은 날짜 한 벌이 다 모여야 알 수 있고, 모인 뒤에도
 * 폼이 아니라 변환·엔진이 판정한다(`convertedLine`).
 */
function NumberField({
  label,
  suffix,
  value,
  onChange,
  digits,
  min,
  max,
  width,
  placeholder,
  disabled = false,
  autoComplete,
}: {
  label: string;
  /** 칸 뒤에 서는 우리말 — 「년」·「월」·「시」. 이것이 있어 자리 이름을 안 물어도 된다 */
  suffix: string;
  value: string;
  onChange: (next: string) => void;
  digits: number;
  min: number;
  max: number;
  width: string;
  placeholder: string;
  disabled?: boolean;
  autoComplete?: string;
}) {
  /**
   * 다 적힌 값만 판정한다. 「1」을 치는 도중에 「1~12 아님」이라고 붉히면, 사용자는
   * 12월을 적으려다 자기가 틀렸다는 말을 먼저 듣는다. 자릿수가 덜 찬 것은 아직
   * 틀린 것이 아니라 **덜 적은 것**이다.
   */
  const settled = value !== '' && (value.length === digits || Number(value) * 10 > max);
  const outOfRange = settled && (Number(value) < min || Number(value) > max);

  return (
    <div className="flex items-center gap-1.5">
      <input
        type="text"
        inputMode="numeric"
        autoComplete={autoComplete}
        aria-label={label}
        aria-invalid={outOfRange || undefined}
        placeholder={placeholder}
        value={value}
        disabled={disabled}
        onChange={(event) => onChange(event.target.value.replace(/\D/g, '').slice(0, digits))}
        // `aria-invalid` 를 셀렉터로 쓴다 — 클래스를 덧붙이면 `FIELD` 의 테두리 색과
        // 같은 무게라 어느 쪽이 이길지 정해지지 않는다. 변종 셀렉터는 한 겹 더 무겁다.
        className={`${FIELD} ${width} text-center tabular-nums disabled:cursor-not-allowed disabled:opacity-40 aria-invalid:border-danger aria-invalid:focus:border-danger aria-invalid:focus:ring-danger-wash`}
      />
      <span className="text-sm font-medium text-secondary">{suffix}</span>
    </div>
  );
}

/** 다 적힌 숫자가 범위 안인가 — 반쪽인 값은 아직 날짜가 아니다 */
const within = (value: string, min: number, max: number) =>
  value !== '' && Number(value) >= min && Number(value) <= max;

/**
 * 년·월·일 세 칸 — **전부 적는 칸이다.**
 *
 * 고르는 칸으로 두면 연도는 백 줄이 넘는 목록이 되고, 그렇다고 흔한 해를 미리 넣어
 * 두면 연도를 손대지 않은 사람도 그 해를 고른 것이 된다 — 월·일만 채운 순간 **틀린
 * 해로 계산된 사주**가 나온다. 「고르지 않은 것을 골랐다고 치지 않는다」가 이 폼
 * 전체의 규율이다(`hourKnown` 이 셋인 이유). 숫자를 치는 것이 그 둘을 다 피한다.
 *
 * ## 대신 없는 날짜가 들어올 수 있다
 *
 * 고르는 칸이던 동안에는 「2월 30일」이 **만들어질 수가 없었다.** 적는 칸은 그
 * 보호막을 내주므로, 막는 자리를 대신 세워야 한다. 두 층으로 나눈다.
 *
 * 1. **자리마다의 범위**(월 1~12, 일 1~그 달의 마지막 날)는 여기가 안다. 벗어나면
 *    날짜를 **내보내지 않는다** — 그래서 `date` 가 빈 문자열로 남고, 버튼은
 *    `missingAnswer` 가 이미 잠근다. 판정하는 자리를 새로 만들지 않는다.
 * 2. **날짜의 존재**(없는 윤달, 29일까지인 음력 달의 30일)는 여기가 모른다. 그것은
 *    변환과 엔진이 이유를 붙여 거절하고, 화면은 그 문장을 그대로 세운다.
 *
 * 폼이 자기 조각을 따로 들고 있으므로 **밖에서 값이 바뀐 것과 자기가 방금 낸
 * 것을 구별해야 한다**(뒤로가기·링크로 들어옴). 마지막으로 올려 보낸 값을
 * 기억해 두고 그것과 다를 때만 조각을 다시 쪼갠다.
 */
function DateFields({
  value,
  onDate,
  onCalendar,
  idPrefix,
}: {
  value: Query;
  onDate: (date: string) => void;
  onCalendar: (calendar: Calendar) => void;
  /** 한 화면에 폼이 둘일 때 라디오 그룹이 섞이지 않게 하는 이름 */
  idPrefix: string;
}) {
  const [parts, setParts] = useState(() => splitDate(value.date));
  const lastEmitted = useRef(value.date);

  useEffect(() => {
    if (value.date === lastEmitted.current) return;
    setParts(splitDate(value.date));
    lastEmitted.current = value.date;
  }, [value.date]);

  const { years, maxDay } = limitsOf(value.calendar, parts.year, parts.month);

  const update = (key: keyof typeof parts, next: string) => {
    const changed = { ...parts, [key]: next };
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

  return (
    <Group label="생년월일">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
        {/*
          **달력은 날짜의 일부다.** 한동안 이 셋은 이름 칸 옆에서 폭을 반이나 차지하고
          서 있었다 — 자기가 무엇을 바꾸는지에서 두 줄 떨어진 자리였다. 「1984-10-05」는
          양력인지 음력인지가 정해져야 비로소 하루를 가리키므로, 고르는 자리도 그 숫자
          바로 옆이어야 한다. 무엇을 고르든 날짜가 다시 판정되는 것(`chooseCalendar`)도
          여기 붙어 있을 때 눈에 보인다.

          `Group` 의 제목은 label 이 아니라 그냥 글자다. 이 셋은 라디오 묶음이라 제
          이름을 따로 가져야 하므로 `fieldset` 으로 싸고 legend 는 화면에서만 감춘다 —
          「생년월일」 아래에 「달력 기준」을 또 세우면 줄만 늘고, 낭독기는 이름을 잃는다.
        */}
        {/* 좁은 화면에서는 한 줄을 다 쓴다 — 안 그러면 「년」 칸만 옆에 붙어 따라온다 */}
        <fieldset className="min-w-0 basis-full sm:basis-auto">
          <legend className="sr-only">달력 기준</legend>
          <div className={`${SEGMENT} grid-flow-col`}>
            {CALENDARS.map((calendar) => (
              <label
                key={calendar}
                className={`${SEGMENT_ITEM} whitespace-nowrap ${
                  value.calendar === calendar ? 'bg-surface text-foreground shadow-sm' : 'text-muted'
                }`}
              >
                <input
                  type="radio"
                  name={`${idPrefix}-calendar`}
                  value={calendar}
                  checked={value.calendar === calendar}
                  onChange={() => onCalendar(calendar)}
                  className={SEGMENT_INPUT}
                />
                {CALENDAR_KO[calendar]}
              </label>
            ))}
          </div>
        </fieldset>

        <NumberField
          label="출생연도"
          suffix="년"
          value={parts.year}
          onChange={(next) => update('year', next)}
          digits={4}
          min={years.min}
          max={years.max}
          width="w-24"
          placeholder={String(years.max - 30)}
          autoComplete="bday-year"
        />
        <NumberField
          label="출생월"
          suffix="월"
          value={parts.month}
          onChange={(next) => update('month', next)}
          digits={2}
          min={1}
          max={12}
          width="w-16"
          placeholder="1~12"
          autoComplete="bday-month"
        />
        <NumberField
          label="출생일"
          suffix="일"
          value={parts.day}
          onChange={(next) => update('day', next)}
          digits={2}
          min={1}
          max={maxDay}
          width="w-16"
          placeholder={`1~${maxDay}`}
          autoComplete="bday-day"
        />
      </div>
    </Group>
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
 * 오전·오후를 따로 고르게 하면 「오후 12시 30분」이 0시 30분인지 12시 30분인지에서
 * 갈리고, 그 한 칸이 시주를 통째로 바꾼다. 자시 규칙(조자시 23:00 경계)도 23시가
 * 23시로 적혀 있을 때만 사람이 대조할 수 있다.
 *
 * 「출생 시각 모름」은 라디오다. 체크박스는 **꺼진 상태가 답처럼 보이지 않아서**, 시각을
 * 안 넣고 체크도 안 한 사람이 자기가 아직 아무것도 고르지 않았다는 것을 모른다
 * (`hourKnown` 이 `null`·`false`·`true` 셋인 이유). 세그먼트로 세워 두면 고르기
 * 전에는 어느 쪽도 켜져 있지 않은 것이 눈에 보인다.
 *
 * '모름' 을 고르면 적어 둔 시각도 지운다. 남겨 두면 "모름인데 14:30" 이 상태로
 * 남고, 다시 「출생 시각 입력」을 고르는 순간 사용자가 지웠다고 생각한 값으로 계산된다.
 */
function TimeFields({
  value,
  onChange,
  idPrefix,
}: {
  value: Query;
  onChange: (next: Query) => void;
  idPrefix: string;
}) {
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

  const update = (key: keyof typeof parts, next: string) => {
    const changed = { ...parts, [key]: next };
    setParts(changed);
    const time = timeOf(changed);
    lastEmitted.current = time;
    onChange({ ...value, hourKnown: true, time });
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

  return (
    <fieldset className="flex min-w-0 flex-col gap-2 sm:col-span-2">
      <legend className="text-xs font-semibold text-secondary">출생 시각</legend>

      <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
        <div className={`${SEGMENT} grid-cols-2`}>
          {[
            /*
              **보이는 글자와 불리는 이름이 다르다.**

              한동안 두 칸이 「출생 시각 입력」·「출생 시각 모름」이었다. 바로 위
              legend 가 「출생 시각」이라, 한 뼘 안에서 같은 말이 세 번 났다.
              무엇의 시각인지는 제목이 이미 말하므로 **보이는 쪽은 답만 한다.**

              그래도 온전한 이름은 남긴다(`aria-label`). 낭독기는 고른 칸 하나만
              읽어 주는 때가 있고, 그때 「입력」 두 글자로는 무엇의 입력인지 모른다.
              보이는 글자가 불리는 이름 안에 그대로 들어 있으므로, 화면을 보며 말로
              누르는 사람에게도 둘이 어긋나지 않는다.
            */
            { known: true, label: '시각 입력', name: '출생 시각 입력' },
            { known: false, label: HOUR_UNKNOWN_CHOICE, name: HOUR_UNKNOWN_LABEL },
          ].map((option) => (
            <label
              key={option.label}
              className={`${SEGMENT_ITEM} whitespace-nowrap ${
                value.hourKnown === option.known ? 'bg-surface text-foreground shadow-sm' : 'text-muted'
              }`}
            >
              <input
                type="radio"
                name={`${idPrefix}-hour`}
                aria-label={option.name}
                checked={value.hourKnown === option.known}
                onChange={() => choose(option.known)}
                className={SEGMENT_INPUT}
              />
              {option.label}
            </label>
          ))}
        </div>

        {/*
          시·분도 **적는 칸**이다. 24시간이라 시는 스물넷, 분은 예순 줄짜리 목록이
          되는데, 두 자리를 치는 편이 어느 쪽이든 빠르다. 범위를 벗어나면 시각을
          내보내지 않으므로 「25:70」이 계산으로 흘러가지 않는다.
        */}
        <div className="flex items-center gap-3">
          <NumberField
            label="출생 시"
            suffix="시"
            value={parts.hour}
            onChange={(next) => update('hour', next)}
            digits={2}
            min={0}
            max={23}
            width="w-16"
            placeholder="0~23"
            disabled={!known}
          />
          <NumberField
            label="출생 분"
            suffix="분"
            value={parts.minute}
            onChange={(next) => update('minute', next)}
            digits={2}
            min={0}
            max={59}
            width="w-16"
            placeholder="0~59"
            disabled={!known}
          />
        </div>
      </div>

      <p className="text-xs leading-5 text-muted">
        {value.hourKnown === false
          ? '시각을 모르면 시주를 뽑지 않습니다. 나머지 세 기둥은 그대로 계산합니다.'
          : `24시간으로 적습니다 — 오후 2시 30분은 14시 30분입니다. 모르면 「${HOUR_UNKNOWN_CHOICE}」을 고르세요.`}
      </p>
    </fieldset>
  );
}

export function BirthFields({
  value,
  onChange,
  idPrefix,
  namePlaceholder,
}: {
  value: Query;
  onChange: (next: Query) => void;
  /** 한 화면에 폼이 둘일 때 라디오 그룹이 섞이지 않게 하는 이름 */
  idPrefix: string;
  /** 이름 칸이 비었을 때 대신 보일 말 */
  namePlaceholder?: string;
}) {
  const set = <K extends keyof Query>(key: K, next: Query[K]) => onChange({ ...value, [key]: next });

  /**
   * 달력을 바꾸면 **못 고르게 된 날짜는 비운다.**
   *
   * 양력 1908년을 고른 사람이 음력으로 옮기면 그 해는 표 밖이다(1912~). 남겨 두면
   * `select` 가 자기 목록에 없는 값을 들고 빈칸처럼 서 있고, 그때 화면은 사용자가
   * 방금 고른 것을 잃어버린 것처럼 보인다. 지우는 이유를 변환 줄이 바로 아래에서
   * 말하므로(`convertedLine`), 지운 자리는 침묵하지 않는다.
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

  return (
    <>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="이름">
          <input
            type="text"
            value={value.name}
            onChange={(event) => set('name', event.target.value.slice(0, NAME_MAX))}
            placeholder={namePlaceholder}
            maxLength={NAME_MAX}
            className={`${FIELD} w-full max-w-56`}
          />
        </Field>

        {/*
          **이름 옆은 성별이다.** 달력이 여기 서 있던 동안 이 줄은 「이름 · 달력 기준」
          이었다 — 사람을 묻다 말고 날짜 형식을 묻고, 다시 아래에서 날짜를 물었다.
          묻는 것을 성질끼리 모은다: 누구인가(이름 · 성별) → 언제(생년월일 · 시각) →
          어디서(출생지).
        */}
        <Field label="성별">
          <SelectShell className="max-w-56">
            <select
              value={value.gender}
              onChange={(event) => set('gender', event.target.value as Gender)}
              className={`${FIELD} w-full appearance-none pr-8`}
            >
              {GENDERS.map((gender) => (
                <option key={gender} value={gender}>
                  {GENDER_KO[gender]}
                </option>
              ))}
            </select>
          </SelectShell>
        </Field>

        {/*
          달력 형식과 날짜는 **함께 읽어야 뜻이 생긴다.** 「1984-10-05」 하나로는
          양력인지 음력인지 알 수 없고, 음력이면 평달인지 윤달인지에 따라 실제
          날이 한 달 떨어진다. 그래서 변환 결과를 바로 밑에 적는다 — **저장이나
          계산 전에.** 사용자가 아는 것은 음력 날짜뿐인데, 우리가 무엇을 양력으로
          잡았는지 못 보면 잘못 골랐다는 것을 결과 화면에 가서야 알게 된다.
        */}
        <div className="flex flex-col gap-1.5 sm:col-span-2">
          <DateFields
            value={value}
            onDate={(date) => set('date', date)}
            onCalendar={chooseCalendar}
            idPrefix={idPrefix}
          />
          {converted !== null && (
            <p
              role={converted.ok ? undefined : 'alert'}
              // 색으로만 가르지 않는다 — 못 바꾼 줄은 문장 자체가 이유를 말한다.
              className={`text-xs ${converted.ok ? 'text-secondary' : 'font-medium text-danger'}`}
            >
              {converted.text}
            </p>
          )}
        </div>

        <TimeFields value={value} onChange={onChange} idPrefix={idPrefix} />

        <Field label="출생지">
          <SelectShell className="max-w-72">
            <select
              value={value.city}
              onChange={(event) => set('city', event.target.value as CityName)}
              className={`${FIELD} w-full appearance-none pr-8`}
            >
              {CITIES.map((city) => (
                <option key={city} value={city}>
                  {city} ({CITY_LONGITUDES[city].toFixed(2)}°E)
                </option>
              ))}
            </select>
          </SelectShell>
        </Field>
      </div>

      <details className="border-t border-border pt-3" open={TIME_BASIS[value.basis].advanced}>
        <summary className="flex min-h-10 cursor-pointer items-center text-sm font-medium text-secondary">
          고급 설정
          <span className="ml-2 text-xs font-normal text-muted">자시 · 시간 기준 · 세운 연도</span>
        </summary>

        <div className="mt-3 flex flex-wrap items-end gap-3">
          <Field label="자시 규칙">
            {/* 시간을 모르면 자시 경계에 걸릴 일이 없어 선택이 무의미하다 */}
            <select
              value={value.rule}
              onChange={(event) => set('rule', event.target.value as LateNightRule)}
              disabled={value.hourKnown === false}
              className={`${FIELD} disabled:opacity-40`}
            >
              <option value="jo">조자시 · 경계 23:00</option>
              <option value="ya">야자시 · 경계 자정</option>
            </select>
          </Field>

          <Field label="세운 시작">
            <input
              type="number"
              value={value.saeunFrom}
              min={SUPPORTED_YEAR_RANGE.min}
              max={SUPPORTED_YEAR_RANGE.max}
              onChange={(event) => set('saeunFrom', Number(event.target.value))}
              className={`${FIELD} w-28`}
            />
          </Field>
        </div>

        <fieldset className="mt-4">
          <legend className="text-xs uppercase tracking-wide text-muted">시간 기준</legend>
          <div className="mt-2 flex flex-col gap-2 text-sm sm:flex-row sm:flex-wrap sm:gap-x-5">
            {TIME_BASES.map((basis) => (
              <BasisRadio
                key={basis}
                name={`${idPrefix}-time-basis`}
                basis={basis}
                checked={value.basis === basis}
                onChange={() => set('basis', basis)}
              />
            ))}
          </div>
        </fieldset>
      </details>
    </>
  );
}
