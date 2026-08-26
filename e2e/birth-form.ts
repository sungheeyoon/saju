import { expect, type Locator, type Page } from '@playwright/test';

import { CALENDAR_KO, type Calendar } from '@/src/lib/saju';

/**
 * 생년월일시 폼을 채우는 한 벌 — **화면이 묻는 방식이 여기 한 곳에 적힌다.**
 *
 * 폼은 네 화면이 함께 쓰는데(원국·궁합·온보딩·판본 수정) 검사는 파일 셋에 흩어져
 * 있다. 칸 하나가 갈라지거나 합쳐질 때마다 호출부를 스무 곳 고치면 한 곳은 안
 * 고쳐지고, 그 한 곳이 「폼이 바뀌었다」가 아니라 「그 화면이 깨졌다」로 읽힌다.
 *
 * 날짜와 시각은 `<input type="date">`·`type="time">` 이 아니라 고르는 칸으로 서 있다
 * (`app/birth-form.tsx` 의 머리말). 그래서 검사도 **한 칸에 한 번 채우지 않고**
 * 년·월·일과 시·분을 각각 고른다.
 */

type Scope = Page | Locator;

/** 폼이 아는 유일한 날짜 모양 — 주소창에 실리는 것과 같다 */
const DATE = /^(\d{4})-(\d{2})-(\d{2})$/;
const TIME = /^(\d{2}):(\d{2})$/;

/**
 * `YYYY-MM-DD` 한 벌을 년·월·일 세 칸에 나눠 넣는다.
 *
 * 연도만 **적는 칸**이고 월·일은 고르는 칸이다(`app/birth-form.tsx`). 연도를 목록으로
 * 두면 백 줄을 스크롤해야 하고, 흔한 해를 미리 넣어 두면 손대지 않은 사람도 그 해를
 * 고른 것이 되기 때문이다.
 */
export async function fillBirthDate(scope: Scope, date: string): Promise<void> {
  const match = DATE.exec(date);
  if (!match) throw new Error(`YYYY-MM-DD 가 아니다: ${date}`);
  const [, year, month, day] = match;

  await scope.getByLabel('출생연도').fill(year);
  await scope.getByLabel('출생월').selectOption(month);
  await scope.getByLabel('출생일').selectOption(day);
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
 * 시각을 아는 쪽을 고르고 시·분을 넣는다.
 *
 * 고르는 줄이 먼저다. 아무것도 고르지 않은 상태(`hourKnown: null`)에서는 두 칸이
 * 잠겨 있다 — 고르지 않은 것을 골랐다고 치지 않기로 한 결정의 결과다.
 */
export async function fillBirthTime(scope: Scope, time: string): Promise<void> {
  const match = TIME.exec(time);
  if (!match) throw new Error(`HH:MM 이 아니다: ${time}`);
  const [, hour, minute] = match;

  await scope.getByRole('radio', { name: '시간 입력', exact: true }).check();
  await scope.getByLabel('출생 시').selectOption(hour);
  await scope.getByLabel('출생 분').selectOption(minute);
}

/** 시각을 모른다고 답한다 — 고르지 않은 것과 다르다 */
export async function chooseHourUnknown(scope: Scope): Promise<void> {
  await scope.getByRole('radio', { name: '시간 모름', exact: true }).check();
}

/** 달력 기준 — 양력·음력 평달·음력 윤달 셋 중 하나 */
export async function chooseCalendar(scope: Scope, calendar: Calendar): Promise<void> {
  await scope.getByRole('radio', { name: CALENDAR_KO[calendar], exact: true }).check();
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
