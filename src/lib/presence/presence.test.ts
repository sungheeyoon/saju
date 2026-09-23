import { describe, expect, it } from 'vitest';

import {
  ACTIVITY_BANDS,
  ACTIVITY_PRIVACY_LINE,
  PRESENCE_POLICY,
  activityBandOf,
  activityText,
} from '.';

describe('구간 셋은 저마다 다른 말을 하고, 모르는 구간은 그리지 않는다', () => {
  it('세 구간이 세 문장이고 서로 다르다(PRD §7.2)', () => {
    const texts = ACTIVITY_BANDS.map(activityText);
    expect(new Set(texts).size).toBe(3);
  });

  it('어느 문장도 시각을 들지 않는다 — 나가는 것은 구간뿐이다', () => {
    for (const band of ACTIVITY_BANDS) expect(activityText(band)).not.toMatch(/\d{1,2}:\d{2}/);
  });

  it('DB 가 내는 셋만 받고 나머지는 null 이다', () => {
    expect(activityBandOf('now')).toBe('now');
    expect(activityBandOf('earlier')).toBe('earlier');
    expect(activityBandOf('online')).toBeNull();
    expect(activityBandOf(null)).toBeNull();
  });

  it('처리방침의 한 줄이 세 구간의 말을 그대로 든다 — 화면과 방침이 갈리지 않는다', () => {
    for (const band of ACTIVITY_BANDS) expect(ACTIVITY_PRIVACY_LINE).toContain(activityText(band));
  });
});

describe('수는 DB 의 사본이다 — 억제 창이 「지금」 창보다 짧다', () => {
  it('1분 안에 다시 안 적어도 구간이 5분 창보다 늦게 바뀌지 않는다(ADR 0092)', () => {
    expect(PRESENCE_POLICY.writeWindowSeconds).toBeLessThan(PRESENCE_POLICY.nowWindowSeconds);
    expect(PRESENCE_POLICY.nowWindowSeconds).toBeLessThan(PRESENCE_POLICY.dayWindowSeconds);
  });
});
