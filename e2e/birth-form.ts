import { expect, type Locator, type Page } from '@playwright/test';

import { HOUR_UNKNOWN_CHOICE } from '@/src/lib/input/query';
import { CALENDAR_KO, type Calendar } from '@/src/lib/saju';

/**
 * 생년월일시 폼을 채우는 한 벌 — **화면이 묻는 방식이 여기 한 곳에 적힌다.**
 *
 * 폼은 네 화면이 함께 쓰는데(원국·궁합·온보딩·판본 수정) 검사는 파일 셋에 흩어져
 * 있다. 칸 하나가 갈라지거나 합쳐질 때마다 호출부를 스무 곳 고치면 한 곳은 안
 * 고쳐지고, 그 한 곳이 「폼이 바뀌었다」가 아니라 「그 화면이 깨졌다」로 읽힌다.
 *
 * 날짜와 시각은 `<input type="date">`·`type="time">` 이 아니라 숫자 칸으로 서 있다
 * (`app/birth-form.tsx` 의 머리말). 그래서 검사도 **한 칸에 한 번 채우지 않고**
 * 년·월·일과 시·분을 각각 적는다. 성별 · 달력 · 출생 시각 · 자시 · 시간 기준은 그 자리에 다 보이는 라디오 셀이고,
 * 출생지만 펼침 줄이다(폼 디자인 C 「서식지 격자」, `app/ui/form-grid.ts`).
 */

type Scope = Page | Locator;

/** 폼이 아는 유일한 날짜 모양 — 주소창에 실리는 것과 같다 */
const DATE = /^(\d{4})-(\d{2})-(\d{2})$/;
const TIME = /^(\d{2}):(\d{2})$/;

/**
 * `YYYY-MM-DD` 한 벌을 년·월·일 세 칸에 나눠 **적는다.**
 *
 * 여섯 칸이 전부 숫자를 받는 칸이다(`app/birth-form.tsx`). 고르는 칸으로 두면 연도는
 * 백 줄이 넘고, 흔한 해를 미리 넣어 두면 손대지 않은 사람도 그 해를 고른 것이 된다.
 */
export async function fillBirthDate(scope: Scope, date: string): Promise<void> {
  const match = DATE.exec(date);
  if (!match) throw new Error(`YYYY-MM-DD 가 아니다: ${date}`);
  const [, year, month, day] = match;

  await scope.getByLabel('출생연도').fill(year);
  await scope.getByLabel('출생월').fill(month);
  await scope.getByLabel('출생일').fill(day);
}

/** 년·월·일 세 칸이 이 날짜를 들고 있는가 */
export async function expectBirthDate(scope: Scope, date: string): Promise<void> {
  const match = DATE.exec(date);
  if (!match) throw new Error(`YYYY-MM-DD 가 아니다: ${date}`);
  const [, year, month, day] = match;

  await expect(scope.getByLabel('출생연도')).toHaveValue(year);
  await expect(scope.getByLabel('출생월')).toHaveValue(month);
  await expect(scope.getByLabel('출생일')).toHaveValue(day);
}

/**
 * 한 줄에서 하나를 고른다. 보기가 그 자리에 다 보이는 줄이면 라디오를 바로 누르고, 펼침 줄(출생지 — 이름은 「줄 이름 +
 * 지금 값」)이면 펼친 뒤 누른다.
 *
 * 손으로 고르면 펼침이 접히므로(`birth-form.tsx` 의 `DiscloseRow`) `check()` 가 아니라 `click()` 이다 — `check()` 는
 * 누른 뒤 라디오가 켜져 있는지 다시 보는데, 그때 라디오는 이미 떼어졌다.
 */
export async function pickRow(scope: Scope, row: string, option: string): Promise<void> {
  const disclose = scope.getByRole('button', { name: new RegExp(`^${row} `) });
  if ((await disclose.count()) > 0) await disclose.click();
  await scope.getByRole('radio', { name: option, exact: true }).click();
}

/**
 * 시각을 아는 쪽(「직접 입력」)을 고르고 시·분을 적는다.
 *
 * 폼은 「직접 입력」에서 시작하므로 시각 줄은 이미 서 있다. 그래도 먼저 고른다 — 주소에서 온 입력은
 * `hourKnown` 이 `null` 이거나 `false` 일 수 있고, 그때는 시각 줄이 없다.
 */
export async function fillBirthTime(scope: Scope, time: string): Promise<void> {
  const match = TIME.exec(time);
  if (!match) throw new Error(`HH:MM 이 아니다: ${time}`);
  const [, hour, minute] = match;

  await pickRow(scope, '출생 시각', '직접 입력');
  await scope.getByLabel('출생 시', { exact: true }).fill(hour);
  await scope.getByLabel('출생 분', { exact: true }).fill(minute);
}

/** 시각을 모른다고 답한다 — 고르지 않은 것과 다르다 */
export async function chooseHourUnknown(scope: Scope): Promise<void> {
  await pickRow(scope, '출생 시각', HOUR_UNKNOWN_CHOICE);
}

/** 달력 기준 — 양력·음력·음력 윤달 셋 중 하나. 「음력」은 「음력 윤달」의 앞토막이라 라디오는 `exact` 로 찾는다 */
export async function chooseCalendar(scope: Scope, calendar: Calendar): Promise<void> {
  await pickRow(scope, '달력', CALENDAR_KO[calendar]);
}

/** 이름·생년월일·출생시각까지 한 벌 — 제출 조건을 다 채운다 */
export async function fillBirth(
  scope: Scope,
  { name, date, time }: { name?: string; date: string; time: string },
): Promise<void> {
  if (name !== undefined) await scope.getByLabel('이름', { exact: true }).fill(name);
  await fillBirthDate(scope, date);
  await fillBirthTime(scope, time);
}
