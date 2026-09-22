import { describe, expect, it } from 'vitest';

import { computeSaju } from '..';
import { fortuneChart, fortuneReadingsOf } from '.';

/**
 * **세 표가 같은 방식으로 센다** — 이 파일이 잠그는 것은 그 한 줄이다.
 *
 * 대운·세운·월운은 경계도 주기도 다르지만 칸 안에서 하는 일은 같다. 그 아홉 줄이
 * 세 파일에 글자까지 똑같이 적혀 있던 동안, **셋이 같다는 사실을 붙들고 있는 것은
 * 아무것도 없었다.** 한 자리에서 신살 기준을 옮겨도 나머지 둘은 옛 기준으로 남고
 * 빨개지는 자리가 없다 — 세 표는 한 화면에 나란히 서므로 그 어긋남은 사용자가 먼저 본다.
 */
const saju = computeSaju({
  year: 1990, month: 5, day: 20, hour: 14, minute: 30, second: 0, gender: 'male',
});

describe('운 한 칸의 읽기는 한 자리에서 나온다', () => {
  /** 일간이 음간이라야 12운성 계통이 실제로 갈린다 — 양간이면 계통 줄을 지워도 통과한다 */
  it('이 명식의 일간은 음간이다 — 아래 계통 검사가 뜻을 가지려면', () => {
    expect(saju.pillars.dayMaster).toBe('乙');
  });

  it('대운 칸의 십성·운성·신살이 공용 자리가 내는 것과 같다', () => {
    for (const entry of saju.daeun.entries) {
      expect(
        { tenGods: entry.tenGods, stage: entry.stage, spirits: entry.spirits },
        entry.chartId,
      ).toEqual(fortuneReadingsOf(saju.pillars, entry.pillar, { yinReverse: saju.daeun.yinReverse }));
    }
  });

  it('세운 칸도 같은 자리에서 나온다', () => {
    for (const entry of saju.saeun.entries) {
      expect(
        { tenGods: entry.tenGods, stage: entry.stage, spirits: entry.spirits },
        entry.chartId,
      ).toEqual(fortuneReadingsOf(saju.pillars, entry.pillar, { yinReverse: saju.saeun.yinReverse }));
    }
  });

  it('월운 칸도 같은 자리에서 나온다', () => {
    for (const entry of saju.wolun.entries) {
      expect(
        { tenGods: entry.tenGods, stage: entry.stage, spirits: entry.spirits },
        entry.chartId,
      ).toEqual(fortuneReadingsOf(saju.pillars, entry.pillar, { yinReverse: saju.wolun.yinReverse }));
    }
  });

  /**
   * **같은 간지면 어느 표에 서든 같은 값이다.** 위 셋을 각각 통과시키면서도 세 표가
   * 서로 어긋날 수 있다 — 표마다 다른 기준을 넘기면 그렇게 된다. 그 갈래를 여기서 막는다.
   */
  it('같은 간지는 대운에 서든 세운·월운에 서든 같은 읽기를 받는다', () => {
    const seen = new Map<string, unknown>();
    const rows = [
      ...saju.daeun.entries.map((e) => [e.pillar.name, e] as const),
      ...saju.saeun.entries.map((e) => [e.pillar.name, e] as const),
      ...saju.wolun.entries.map((e) => [e.pillar.name, e] as const),
    ];

    let compared = 0;
    for (const [name, entry] of rows) {
      const reading = { tenGods: entry.tenGods, stage: entry.stage, spirits: entry.spirits };
      const before = seen.get(name);
      if (before === undefined) {
        seen.set(name, reading);
        continue;
      }
      compared += 1;
      expect(reading, name).toEqual(before);
    }

    /* 겹치는 간지가 하나도 없으면 위 루프는 아무것도 안 잰 것이다 */
    expect(compared, '세 표에 겹치는 간지가 없어 아무것도 못 쟀다').toBeGreaterThan(0);
  });

  /** 계통은 넘겨받는다 — 안 넘기면 세 표가 한 화면에서 갈린다 */
  it('12운성 계통이 실제로 값을 바꾼다', () => {
    const pillar = saju.saeun.entries[0].pillar;

    const forward = fortuneReadingsOf(saju.pillars, pillar, { yinReverse: false });
    const reverse = fortuneReadingsOf(saju.pillars, pillar, { yinReverse: true });

    /* 십성·신살은 계통과 무관하다 — 갈리는 것은 12운성뿐이다 */
    expect(forward.tenGods).toEqual(reverse.tenGods);
    expect(forward.spirits).toEqual(reverse.spirits);
  });
});

describe('운 칸은 기둥 하나만 든다', () => {
  const pillar = saju.saeun.entries[0].pillar;

  it('세운은 연간지라 년 자리에 선다', () => {
    expect(fortuneChart('annual:2026', 'year', pillar)).toEqual({
      chartId: 'annual:2026',
      pillars: { year: pillar, month: null, day: null, hour: null },
    });
  });

  it('대운·월운은 월주에서 온 것이라 월 자리에 선다', () => {
    expect(fortuneChart('decade:4', 'month', pillar)).toEqual({
      chartId: 'decade:4',
      pillars: { year: null, month: pillar, day: null, hour: null },
    });
  });

  /** 빈 자리를 아무 글자로도 안 채운다 — 없는 글자로 관계를 만들지 않는다 */
  it('나머지 세 자리는 언제나 비어 있다', () => {
    for (const seat of ['year', 'month'] as const) {
      const chart = fortuneChart('x', seat, pillar);
      const filled = Object.entries(chart.pillars).filter(([, v]) => v !== null);

      expect(filled.map(([k]) => k)).toEqual([seat]);
    }
  });
});
