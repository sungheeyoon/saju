/**
 * 생년월일 · 출생 시각을 **숫자 한 줄로 적게 하는** 화면 전용 도움 — 폼(`birth-form.tsx`)이 부른다.
 *
 * 년 · 월 · 일 · 시 · 분 다섯 칸이던 동안 폰에서는 칸마다 손가락이 화면으로 돌아가 다음 칸을 짚어야 했다(숫자 자판에는
 * 「다음」 키가 없거나 멀다). 생년월일 한 칸 · 시각 한 칸이면 자판을 한 번 띄우고 숫자만 친다 — 「19900515」 · 「1430」.
 * 이 파일은 그 숫자열을 다루는 순수 함수만 든다: 보이는 글자로 꾸미기(`1990.05.15`), 치는 도중 앞에 0 채우기,
 * 붙여 넣은 글(`1990-5-15 오후 2:30`) 읽기. **판정은 여기서 하지 않는다** — 날짜가 되는지는 폼이 `limitsOf` 로,
 * 해의 범위는 `birthYearRefusal` 이, 날의 존재는 변환 · 엔진이 한다.
 *
 * 숫자열(`digits`)이 상태다. 날짜는 여덟 자리(YYYYMMDD) · 시각은 네 자리(HHMM)까지이고, 덜 찬 것은 덜 적은 것이다.
 */

import { birthYearRefusal, type Query } from '@/src/lib/input/query';

export const DATE_DIGITS = 8;
export const TIME_DIGITS = 4;

const onlyDigits = (text: string) => text.replace(/\D/g, '');

/** `19900515` → `1990.05.15` · 덜 찬 것은 찬 만큼(`19900` → `1990.0`) — 뒤에 점을 미리 달지 않는다(지우기가 점에 걸린다) */
export function dateText(digits: string): string {
  const parts = [digits.slice(0, 4), digits.slice(4, 6), digits.slice(6, 8)].filter((part) => part !== '');
  return parts.join('.');
}

/** `1430` → `14:30` */
export function timeText(digits: string): string {
  return digits.length <= 2 ? digits : `${digits.slice(0, 2)}:${digits.slice(2, 4)}`;
}

const pad = (part: string) => part.padStart(2, '0');

/**
 * 구분자가 든 날짜 글 — `1990-5-15` · `1990.05.15` · `1990/5/15` · `1990년 5월 15일`. 월 · 일이 한 자리여도 읽는다.
 * 숫자만 남기면 `1990515` 가 되어 5월 15일인지 51일인지 모른다 — 그래서 구분자가 있으면 구분자로 가른다.
 */
const SEPARATED_DATE = /(\d{4})\s*(?:[.\-/]|년)\s*(\d{1,2})\s*(?:[.\-/]|월)\s*(\d{1,2})(?!\d)\s*일?/;
/** 구분자가 든 시각 글 — `14:30` · `2:05` · `14시 30분` · `오후 2시` · `PM 2:30` */
const SEPARATED_TIME = /(오전|오후|AM|PM|am|pm)?\s*(\d{1,2})\s*(?::|시)\s*(\d{1,2})?\s*분?/;

/** 구분자로 적힌 날짜면 여덟 자리로, 아니면 `null` */
function separatedDate(text: string): { digits: string; rest: string } | null {
  const found = SEPARATED_DATE.exec(text);
  if (!found) return null;
  const [whole, year, month, day] = found;
  return { digits: `${year}${pad(month)}${pad(day)}`, rest: text.slice((found.index ?? 0) + whole.length) };
}

/** 구분자로 적힌 시각이면 네 자리로 — 오전 · 오후가 붙으면 24시간으로 옮긴다(「오후 12시」는 12시, 「오전 12시」는 0시) */
function separatedTime(text: string): string | null {
  const found = SEPARATED_TIME.exec(text);
  if (!found) return null;
  const [, half, hourText, minuteText] = found;
  let hour = Number(hourText);
  const afternoon = half !== undefined && /오후|pm/i.test(half);
  const morning = half !== undefined && /오전|am/i.test(half);
  if (afternoon && hour < 12) hour += 12;
  if (morning && hour === 12) hour = 0;
  return `${pad(String(hour))}${pad(minuteText ?? '0')}`;
}

/**
 * 붙여 넣은 글에서 날짜와 시각을 읽는다 — **날짜가 없으면 `null`**(그때는 칸이 평소대로 받는다).
 *
 * 읽는 모양: `19900515` · `199005151430` · `1990-05-15` · `1990.5.15 14:30` · `1990년 5월 15일 오후 2시 30분`.
 * 메신저에서 받은 생일 한 줄을 그대로 붙이면 두 칸이 함께 찬다.
 */
export function pastedBirth(text: string): { date: string; time: string | null } | null {
  const separated = separatedDate(text);
  if (separated !== null) {
    return { date: separated.digits, time: separatedTime(separated.rest) };
  }
  const compact = /^(\d{8})(\d{4})?$/.exec(text.replace(/\s/g, ''));
  if (compact === null) return null;
  return { date: compact[1], time: compact[2] ?? null };
}

/** 한 번에 두 글자 넘게 들어왔나 — 붙여넣기 · 자동완성 */
const inserted = (previous: string, raw: string, text: (digits: string) => string) => raw.length > text(previous).length + 1;

/**
 * 날짜 칸에 친 글을 숫자열로 — **한 자리를 끝에 더한 누름이면 앞에 0 을 채운다.**
 *
 * 월의 첫 자리가 2~9 면 두 자리 월이 될 수 없으므로 `0` 을 앞에 붙인다(「19905」 → `199005`). 일의 첫 자리가 그 달의
 * 마지막 날의 십의 자리보다 크면 같다(5월에 「4」 → `04`). 「1」(1월 · 10~12월)과 「3」(3일 · 30일)은 기다린다.
 *
 * 한 자리 더하기가 아닌 바뀜(붙여넣기 · 자동완성 · 가운데 고치기)에는 채우지 않는다 — 구분자가 들었으면 그것으로 가르고,
 * 아니면 숫자만 남긴다. 점 하나를 지운 누름(숫자는 그대로인데 글이 짧아짐)은 그 앞 숫자를 지운 것으로 읽는다.
 */
export function typedDate(previous: string, raw: string, maxDayOf: (year: string, month: string) => number): string {
  // 여러 글자가 한 번에 들어온 때만 구분자로 가른다 — 한 자리씩 치거나 지우는 동안의 「1990.05.1」을 5월 1일로 읽으면 안 된다
  const separated = inserted(previous, raw, dateText) ? separatedDate(raw) : null;
  if (separated !== null) return separated.digits;

  let digits = onlyDigits(raw).slice(0, DATE_DIGITS);
  if (digits === previous && raw.length < dateText(previous).length) return previous.slice(0, -1);

  const appended = digits.length === previous.length + 1 && digits.startsWith(previous);
  if (appended) {
    const last = Number(digits.at(-1));
    if (digits.length === 5 && last >= 2) digits = `${previous}0${last}`;
    else if (digits.length === 7 && last * 10 > maxDayOf(digits.slice(0, 4), digits.slice(4, 6))) {
      digits = `${previous}0${last}`;
    }
  }
  return digits.slice(0, DATE_DIGITS);
}

/** 시각 칸 — 시의 첫 자리가 3~9 면 `0` 을, 분의 첫 자리가 6~9 면 `0` 을 앞에 붙인다(「7」 → `07`, 「145」 → … 는 기다린다) */
export function typedTime(previous: string, raw: string): string {
  const separated = inserted(previous, raw, timeText) ? /^\s*(\d{1,2})\s*[:시.]\s*(\d{1,2})?\s*분?\s*$/.exec(raw) : null;
  if (separated !== null) {
    return `${pad(separated[1])}${separated[2] === undefined ? '' : pad(separated[2])}`.slice(0, TIME_DIGITS);
  }

  let digits = onlyDigits(raw).slice(0, TIME_DIGITS);
  if (digits === previous && raw.length < timeText(previous).length) return previous.slice(0, -1);

  const appended = digits.length === previous.length + 1 && digits.startsWith(previous);
  if (appended) {
    const last = Number(digits.at(-1));
    if (digits.length === 1 && last >= 3) digits = `0${last}`;
    else if (digits.length === 3 && last >= 6) digits = `${previous}0${last}`;
  }
  return digits.slice(0, TIME_DIGITS);
}

/**
 * 꾸민 글에서 숫자 `n` 개 뒤의 자리 — 가운데를 고친 뒤 커서가 끝으로 튀지 않게 한다.
 * 0 이면 맨 앞, 숫자가 모자라면 끝이다.
 */
export function caretAfterDigits(text: string, count: number): number {
  if (count <= 0) return 0;
  let seen = 0;
  for (let index = 0; index < text.length; index += 1) {
    if (/\d/.test(text[index])) seen += 1;
    if (seen === count) return index + 1;
  }
  return text.length;
}

/** 폼의 칸 셋 — 이름 · 생년월일 · 출생 시각. 나머지 칸은 기본값이 있어 비지 않는다 */
export type BirthField = 'name' | 'date' | 'time';

/**
 * 제출을 막은 칸이 어느 것인가 — **`missingAnswer` 와 같은 차례로 본다**(이름 → 날짜 · 해의 범위 → 시각).
 *
 * 거절의 문장은 `missingAnswer` 가 그대로 세우고, 이것은 그 문장이 가리키는 칸에 초점을 옮기고 붉히는 데만 쓴다.
 * 문장을 쪼개 칸을 찾지 않는다 — 문장이 바뀌는 날 칸 찾기가 조용히 빗나간다. 둘이 어긋나지 않는지는 시험이 잰다.
 */
export function missingFieldOf(query: Query): BirthField | null {
  if (query.name.trim() === '') return 'name';
  if (query.date === '' || birthYearRefusal(query) !== null) return 'date';
  if (query.hourKnown === null || (query.hourKnown && query.time === '')) return 'time';
  return null;
}
