import { describe, expect, it } from 'vitest';

import { checkEndsOn } from './beta-dates.mjs';

/**
 * 검사의 종료일은 **오늘에서 센다** — 날짜를 적어 두면 그날 흐름 검사와 로그인 e2e 가
 * 거의 전부 붉어진다(2026-09-28 감사). 여기서는 그 날짜가 늘 앞에 있고, 서울 날짜로
 * 세며, 자정마다 흔들리지 않는지를 잰다.
 */
describe('checkEndsOn', () => {
  it('운영의 종료일이 지난 뒤에도 앞에 있다', () => {
    expect(checkEndsOn(new Date('2026-11-01T09:00:00+09:00'))).toBe('2027-01-01');
    expect(checkEndsOn(new Date('2027-06-15T12:00:00+09:00'))).toBe('2027-08-01');
  });

  it('4주가 넘게 남는다 — 가장 짧은 자리인 1월의 마지막 날에도', () => {
    const now = new Date('2027-01-31T23:59:00+09:00');
    expect(checkEndsOn(now)).toBe('2027-03-01');
    const ends = new Date(`${checkEndsOn(now)}T00:00:00+09:00`);
    expect((ends.getTime() - now.getTime()) / 86_400_000).toBeGreaterThan(28);
  });

  it('서울 날짜로 센다 — UTC 로는 아직 전달이어도', () => {
    /* UTC 로는 10월 31일 15시, 서울로는 11월 1일 0시 */
    expect(checkEndsOn(new Date('2026-10-31T15:00:00Z'))).toBe('2027-01-01');
    expect(checkEndsOn(new Date('2026-10-31T14:59:00Z'))).toBe('2026-12-01');
  });

  it('한 달 안에서는 자정을 걸쳐도 안 바뀐다', () => {
    expect(checkEndsOn(new Date('2026-09-28T23:59:00+09:00'))).toBe(
      checkEndsOn(new Date('2026-09-29T00:01:00+09:00')),
    );
  });

  it('미룬 날은 그보다 늦다', () => {
    const now = new Date('2026-12-10T12:00:00+09:00');
    expect(checkEndsOn(now, 3) > checkEndsOn(now)).toBe(true);
    expect(checkEndsOn(now, 3)).toBe('2027-03-01');
  });
});
