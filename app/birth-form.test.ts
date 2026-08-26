import { describe, expect, it } from 'vitest';

import { fitsCalendar } from './birth-form';

/**
 * 달력을 바꾸면 **고를 수 있는 것 자체가 달라진다.**
 *
 * 폼이 표를 흉내 내지는 않는다 — 없는 윤달·없는 날은 변환이 이유를 붙여 거절한다.
 * 여기서 잠그는 것은 그보다 앞의 것이다: 어느 달력으로도 **애초에 고를 수 없었을**
 * 값을 화면이 들고 있지 않은가. 들고 있으면 `select` 가 제 목록에 없는 값을 물고
 * 빈칸처럼 서고, 사용자는 자기가 방금 고른 것을 잃었다고 읽는다.
 */
describe('달력이 바뀌면 못 고르게 된 날짜는 남지 않는다', () => {
  it('음력 표 밖의 해는 음력으로 옮길 때 버려진다', () => {
    // 절기·표준시는 1900년까지 닿지만 음력 표는 1912년부터다.
    expect(fitsCalendar('1908-03-01', 'solar')).toBe(true);
    expect(fitsCalendar('1908-03-01', 'lunar')).toBe(false);
    expect(fitsCalendar('1912-03-01', 'lunar')).toBe(true);
  });

  it('음력에 31일은 없다', () => {
    expect(fitsCalendar('1990-01-31', 'solar')).toBe(true);
    expect(fitsCalendar('1990-01-31', 'lunar')).toBe(false);
    // 30일까지는 연다. 그 달이 29일까지인지는 표가 알고, 변환이 이유를 붙여 거절한다.
    expect(fitsCalendar('1990-01-30', 'lunar')).toBe(true);
  });

  it('양력은 그 달에 없는 날을 들지 않는다', () => {
    expect(fitsCalendar('1990-02-30', 'solar')).toBe(false);
    expect(fitsCalendar('2024-02-29', 'solar')).toBe(true);
    expect(fitsCalendar('2023-02-29', 'solar')).toBe(false);
  });

  /** 반쪽으로 적힌 날짜는 아직 아무것도 어기지 않았다 — 지울 이유가 없다 */
  it('비어 있는 날짜는 어느 달력으로도 옮겨진다', () => {
    expect(fitsCalendar('', 'lunar')).toBe(true);
    expect(fitsCalendar('', 'solar')).toBe(true);
  });
});
