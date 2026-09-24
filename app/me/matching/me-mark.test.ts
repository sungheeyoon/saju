import { describe, expect, it } from 'vitest';

import { meMarkOf } from './me-mark';

const summary = { glyphCount: 8, counts: { 木: 0, 火: 1, 土: 2, 金: 4, 水: 1 } } as const;

describe('meMarkOf — 지도의 나', () => {
  it('여덟 글자의 20% 에 못 미치는 기운만 빈 자리로 선다', () => {
    const mark = meMarkOf('戊', summary);
    expect(mark.elements.filter((one) => one.low).map((one) => one.element)).toEqual(['木', '火', '水']);
  });

  it('일간 글자가 가운데의 색을 정한다', () => {
    expect(meMarkOf('戊', summary)).toMatchObject({ stem: '戊', element: '土' });
  });

  it('일간을 모르면 가운데는 비고 다섯 알은 그대로 선다', () => {
    const mark = meMarkOf(null, summary);
    expect(mark).toMatchObject({ stem: null, element: null });
    expect(mark.elements).toHaveLength(5);
    expect(meMarkOf('모름', summary).stem).toBeNull();
  });

  it('센 글자가 없으면 어느 것도 비었다고 말하지 않는다', () => {
    const mark = meMarkOf('甲', { glyphCount: 0, counts: { 木: 0, 火: 0, 土: 0, 金: 0, 水: 0 } });
    expect(mark.elements.some((one) => one.low)).toBe(false);
  });
});
