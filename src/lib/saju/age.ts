import { toCivil, type CivilDate, type CivilDateTime } from './civilTime';
import { zoneIntervalAt } from './timeCorrection/zoneHistory';

/**
 * 절대 시각 → 그 시각의 한국 달력 날짜, 그리고 만 나이.
 *
 * 세운이 먼저 필요해서 `saeun/` 안에 있던 두 함수를 꺼냈다. 꺼낸 이유는 현재운이
 * 같은 것을 세야 하기 때문이다 — 대운이 어느 칸인지는 만 나이로 갈리고, 그 나이를
 * 여기서 다시 세면 세운 칸의 나이와 어긋나는 날이 온다. 12신살을 두 곳에서 계산하지
 * 않고 옮겨 담기만 한 것과 같은 판단이다.
 *
 * 만 나이인 것은 대운이 만 나이로 적히기 때문이다(삼명통회 근거, `DaeunEntry`).
 * 세는나이로 바꾸면 대운수 0 을 1 로 올리는 관행까지 함께 따라와야 한다.
 */

/**
 * 그 절대 시각에 한국에서 보이던 달력 시각.
 *
 * 고정 오프셋으로 읽지 않는다 — 1954~1961 년 자오선 전환과 1948~1951·1955~1960·
 * 1987·1988 서머타임을 지나면 같은 절대 시각이 다른 날짜로 보인다. 그 표는
 * `zoneHistory` 가 들고 있고 tzdb 판본까지 기록한다.
 *
 * **시·분까지 돌려준다.** 한동안 반환 타입이 `CivilDate` 였는데 `toCivil` 은 늘
 * 시·분·초를 함께 담아 왔다 — 타입이 값보다 좁게 적혀 있었을 뿐이다. 나이를 셀
 * 때는 날짜만 보지만(`ageOnDate`), 현재운은 **절입일에 그 시각이 달을 가르므로**
 * 시·분이 필요하다. 좁혀서 버렸다면 그 자리에서 다시 만들어야 했다.
 */
export function koreaDateOf(instant: Date): CivilDateTime {
  return toCivil(instant, zoneIntervalAt(instant).totalOffsetMinutes);
}

/**
 * 두 달력 날짜 사이의 만 나이 — 생일이 지났는가로 한 해가 갈린다.
 *
 * 절대 시각의 차이를 365.25 로 나누지 않는다. 그렇게 세면 생일 당일에 나이가
 * 하루 늦게 오르거나 일찍 오르는 자리가 생기고, 그 하루가 대운 경계에 걸리면
 * 어느 대운 안에 있는지가 뒤집힌다.
 */
export function ageOnDate(birth: CivilDate, date: CivilDate): number {
  const birthdayPassed =
    date.month > birth.month || (date.month === birth.month && date.day >= birth.day);

  return date.year - birth.year - (birthdayPassed ? 0 : 1);
}
