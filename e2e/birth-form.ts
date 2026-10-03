import { expect, type Locator, type Page } from '@playwright/test';

import { HOUR_UNKNOWN_LABEL } from '@/src/lib/input/query';
import { CALENDAR_KO, type Calendar } from '@/src/lib/saju';

/**
 * 생년월일시 폼을 채우는 한 벌 — **화면이 묻는 방식이 여기 한 곳에 적힌다.**
 *
 * 폼은 네 화면이 함께 쓰는데(원국·궁합·온보딩·판본 수정) 검사는 파일 셋에 흩어져
 * 있다. 칸 하나가 갈라지거나 합쳐질 때마다 호출부를 스무 곳 고치면 한 곳은 안
 * 고쳐지고, 그 한 곳이 「폼이 바뀌었다」가 아니라 「그 화면이 깨졌다」로 읽힌다.
 *
 * 날짜와 시각은 `<input type="date">`·`type="time">` 이 아니라 숫자를 치는 칸 둘이다
 * (`app/birth-form.tsx` 의 머리말) — 생년월일 여덟 자리 · 출생 시각 네 자리. 칸이 점 · 쌍점을 넣으므로 검사는
 * **숫자만 친다.** 성별 · 달력은 나란히 선 라디오, 출생지는 고르기 창(`select`), 시각 모름은 칸 옆 단추다.
 * 고급 설정의 두 줄(자시 · 시간 기준)만 펼침 줄이다(ADR 0132).
 */

type Scope = Page | Locator;

/** 폼이 아는 유일한 날짜 모양 — 주소창에 실리는 것과 같다 */
const DATE = /^(\d{4})-(\d{2})-(\d{2})$/;
const TIME = /^(\d{2}):(\d{2})$/;

/** 생년월일 한 칸 — 이름이 같은 「출생 시각 모름」 단추와 갈리게 `exact` 로 찾는다 */
export const birthDateField = (scope: Scope) => scope.getByLabel('생년월일', { exact: true });
export const birthTimeField = (scope: Scope) => scope.getByLabel('출생 시각', { exact: true });

/**
 * `YYYY-MM-DD` 한 벌을 생년월일 칸에 **숫자로 친다** — 사람이 치는 것처럼 한 자리씩(점은 칸이 넣는다).
 *
 * 다 차면 초점이 시각 칸으로 넘어간다(`birth-form.tsx` 의 `DateField`). 그래서 `fill` 이 아니라 한 자리씩 친다 —
 * `fill` 은 한 번에 넣어 붙여넣기로 읽히고, 그 길은 따로 잰다.
 */
export async function fillBirthDate(scope: Scope, date: string): Promise<void> {
  const match = DATE.exec(date);
  if (!match) throw new Error(`YYYY-MM-DD 가 아니다: ${date}`);
  const field = birthDateField(scope);
  await field.fill('');
  await field.pressSequentially(match.slice(1).join(''));
}

/** 생년월일 칸이 이 날짜를 들고 있는가 */
export async function expectBirthDate(scope: Scope, date: string): Promise<void> {
  const match = DATE.exec(date);
  if (!match) throw new Error(`YYYY-MM-DD 가 아니다: ${date}`);
  await expect(birthDateField(scope)).toHaveValue(match.slice(1).join('.'));
}

/**
 * 고급 설정의 펼침 줄에서 하나를 고른다 — 줄(`button`, 이름은 「줄 이름 + 지금 값」)을 눌러 펼치고 라디오를 누른다.
 *
 * 손으로 고르면 목록이 접히므로(`birth-form.tsx` 의 `PickRow`) `check()` 가 아니라 `click()` 이다 — `check()` 는
 * 누른 뒤 라디오가 켜져 있는지 다시 보는데, 그때 라디오는 이미 떼어졌다.
 */
export async function pickRow(scope: Scope, row: string, option: string): Promise<void> {
  await scope.getByRole('button', { name: new RegExp(`^${row} `) }).click();
  await scope.getByRole('radio', { name: option, exact: true }).click();
}

/**
 * 시각을 적는다 — 칸에 숫자를 치면 그것이 「시각을 안다」는 답이다. 「모름」이 눌려 있었어도 치는 순간 풀린다.
 */
export async function fillBirthTime(scope: Scope, time: string): Promise<void> {
  const match = TIME.exec(time);
  if (!match) throw new Error(`HH:MM 이 아니다: ${time}`);
  const field = birthTimeField(scope);
  await field.fill('');
  await field.pressSequentially(`${match[1]}${match[2]}`);
}

/** 시각을 모른다고 답한다 — 고르지 않은 것과 다르다. 이미 눌려 있으면 그대로 둔다 */
export async function chooseHourUnknown(scope: Scope): Promise<void> {
  const unknown = scope.getByRole('button', { name: HOUR_UNKNOWN_LABEL, exact: true });
  if ((await unknown.getAttribute('aria-pressed')) !== 'true') await unknown.click();
}

/** 달력 기준 — 양력·음력·음력 윤달 셋 중 하나. 「음력」은 「음력 윤달」의 앞토막이라 라디오는 `exact` 로 찾는다 */
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
