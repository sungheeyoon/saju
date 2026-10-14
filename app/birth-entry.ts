import type { Calendar } from '@/src/lib/saju';

import { dateRefusal, solarDateOf } from '@/src/lib/input/chart';
import { birthYearRangeOf, dateEntryRefusal, type Query } from '@/src/lib/input/query';

/**
 * 출생 정보 폼(`birth-form.tsx`)의 숫자 칸이 값이 되는 규칙 — React 를 모르는 순수 함수다.
 *
 * 칸은 문자열 조각(년 · 월 · 일 · 시 · 분)을 들고, 폼은 `Query` 의 `date`(`YYYY-MM-DD`) · `time`(`HH:MM`)을 낸다. 그 사이의
 * 쪼개기 · 잇기 · 범위 판정이 여기 산다. 거절의 문장은 여기서 짓지 않는다 — `dateRefusal` · `dateEntryRefusal` 의 일이다.
 */

export const pad2 = (n: number) => String(n).padStart(2, '0');

/**
 * 음력 입력 아래에 적을 한 줄 — 바뀐 양력이거나, 못 바꾼 이유다.
 *
 * 못 바꾼 이유를 「변환할 수 없습니다」로 뭉개지 않는다. 표 밖·없는 윤달·없는 날은
 * 사용자가 할 일이 서로 다르다 — 그 말은 칸을 붉히는 것과 같은 `dateRefusal` 이 짓는다.
 */
export function convertedLine(value: Query): { ok: boolean; text: string } | null {
  if (value.calendar === 'solar' || value.date === '') return null;

  /*
    받지 않기로 한 해 · 없는 달은 **변환해 볼 것도 없다.**

    음력 표는 2100년까지 덮지만 태어난 해로는 그보다 좁게 받는다. 두 범위가 다르므로
    범위 밖의 해에서는 두 문장이 동시에 설 수 있다 — 「음력 1912~2100년만 변환합니다」와
    「1912~2030년에 태어난 분만 계산할 수 있어요」. 나란히 두면 사용자는 자기가 무엇을 어겼는지
    고르게 된다. 거절의 이유는 하나여야 하고, 그 하나는 버튼 곁의 문장이다(`dateEntryRefusal`).
  */
  if (dateEntryRefusal(value) !== null) return null;

  const refused = dateRefusal(value);
  if (refused !== null) return { ok: false, text: refused.message };

  const { year, month, day } = solarDateOf(value);
  return { ok: true, text: `양력 ${year}년 ${month}월 ${day}일로 계산해요` };
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
export function limitsOf(calendar: Calendar, year: string, month: string) {
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
 * 세 칸의 숫자를 날짜 한 벌로 — **다 적혔으면 범위를 따지지 않고 낸다.**
 *
 * 해가 네 자리이고 달 · 날이 비어 있지 않으면 날짜다. 「1990-02-30」도 그대로 낸다 — 거절은 무엇이 틀렸는지 말하는
 * 한 자리(`dateEntryRefusal`)의 일이고, 여기서 빈 값으로 삼키면 다 적은 사람이 「생년월일을 입력해 주세요」를 듣는다.
 * 달력은 보지 않는다 — 그래서 달력을 바꿔도 날짜가 그대로고 칸의 숫자도 그대로 선다.
 */
export function dateOfParts(parts: { year: string; month: string; day: string }): string {
  if (!isFullYear(parts.year) || parts.month === '' || parts.day === '') return '';
  return `${parts.year}-${pad2(Number(parts.month))}-${pad2(Number(parts.day))}`;
}

/**
 * 숫자 한 칸이 제 범위를 벗어났는가.
 *
 * 다 적힌 값만 판정한다. 「1」을 치는 도중에 「1~12 아님」이라고 붉히면, 사용자는
 * 12월을 적으려다 자기가 틀렸다는 말을 먼저 듣는다. 자릿수가 덜 찬 것은 아직
 * 틀린 것이 아니라 **덜 적은 것**이다.
 */
export function digitOutOfRange(value: string, digits: number, min: number, max: number): boolean {
  const settled = value !== '' && (value.length === digits || Number(value) * 10 > max);
  return settled && (Number(value) < min || Number(value) > max);
}

/** 다 적힌 숫자가 범위 안인가 — 반쪽인 값은 아직 날짜가 아니다 */
const within = (value: string, min: number, max: number) =>
  value !== '' && Number(value) >= min && Number(value) <= max;

/** 두 칸이 다 제 범위 안이어야 시각이 된다 — 「25:70」을 실어 보내지 않는다 */
export const timeOfParts = (from: { hour: string; minute: string }) =>
  within(from.hour, 0, 23) && within(from.minute, 0, 59)
    ? `${pad2(Number(from.hour))}:${pad2(Number(from.minute))}`
    : '';

export function splitDate(date: string) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(date);
  return match ? { year: match[1], month: match[2], day: match[3] } : { year: '', month: '', day: '' };
}

export function splitTime(time: string) {
  const match = /^(\d{2}):(\d{2})$/.exec(time);
  return match ? { hour: match[1], minute: match[2] } : { hour: '', minute: '' };
}
