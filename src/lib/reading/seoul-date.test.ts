import { describe, expect, it } from 'vitest';

import { seoulDateOf } from './seoul-date';

describe('서울 날짜', () => {
  it('UTC 14:59:59 는 그날, 15:00 은 서울의 다음 날이다', () => {
    expect(seoulDateOf(new Date('2026-10-03T14:59:59.999Z'))).toBe('2026-10-03');
    expect(seoulDateOf(new Date('2026-10-03T15:00:00.000Z'))).toBe('2026-10-04');
  });

  it('UTC 자정은 서울로는 이미 아홉 시 — 날이 바뀌지 않는다', () => {
    expect(seoulDateOf(new Date('2026-10-04T00:00:00.000Z'))).toBe('2026-10-04');
  });

  it('해 · 윤달의 끝에서도 서울 자정에 넘어간다', () => {
    expect(seoulDateOf(new Date('2026-12-31T15:00:00.000Z'))).toBe('2027-01-01');
    expect(seoulDateOf(new Date('2028-02-28T15:00:00.000Z'))).toBe('2028-02-29');
  });

  it('2020 ~ 2060 년의 매시 정각과 그 1ms 앞이 Intl 의 Asia/Seoul 날짜와 같다', () => {
    const intl = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Seoul' });
    const wrong: string[] = [];
    for (let t = Date.UTC(2020, 0, 1); t < Date.UTC(2060, 0, 1); t += 60 * 60 * 1000) {
      for (const at of [new Date(t), new Date(t - 1)]) {
        if (seoulDateOf(at) !== intl.format(at)) wrong.push(at.toISOString());
      }
    }
    expect(wrong).toEqual([]);
  });
});
