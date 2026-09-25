import { describe, expect, it } from 'vitest';

import { computeSaju } from '..';
import { pillarOf, type Branch, type Stem } from '../constants';
import { COMPAT_POLICY } from '../compat';
import { randomInputs } from '../population';
import {
  NEED_COMPLEMENT_POLICY,
  needComplementOf,
  type ComplementBasis,
  type DirectionalNeedComplement,
  type ProviderChart,
} from './needComplement';
import { needProfileOf } from './needProfile';
import type { Grade } from './needProfileTypes';

/** 표본 6000 명식(3000 쌍)을 한 바퀴 돈다 — 기본 5초로는 모자란다 */
const POPULATION_TIMEOUT_MS = 60_000;

const GRADE_RANK: Record<Grade, number> = { low: 0, medium: 1, high: 2 };

/** 간지 넷으로 명식을 짓는다 — 반월을 안 보는 자리에서만 */
const chart = (year: string, month: string, day: string, hour: string | null): ProviderChart => {
  const parse = (name: string) => {
    const pillar = pillarOf(name[0] as Stem, name[1] as Branch);
    if (!pillar) throw new Error(`간지가 아니다: ${name}`);
    return pillar;
  };
  const parsedDay = parse(day);
  return {
    year: parse(year),
    month: parse(month),
    day: parsedDay,
    hour: hour === null ? null : parse(hour),
    dayMaster: parsedDay.stem,
  };
};

/**
 * 받는 쪽 둘 — 둘 다 억부 1순위가 水다.
 *
 * - `WATER_FOR_WOOD`(乙巳 辛巳 乙酉 癸未, 무작위 표본 201번) — 乙木 일간 · 巳월 신약. 가장 무거운 쪽은
 *   관성 金, 조후는 癸 하나(ADR 0111 시험의 그 명식).
 * - `BING_FOR_WOOD`(丁卯 丁丑 乙卯 丁亥) — 乙木 일간 · 丑월. 가장 무거운 쪽은 식상 火, 조후는 丙 하나.
 */
const WATER_FOR_WOOD = chart('乙巳', '辛巳', '乙酉', '癸未');
const BING_FOR_WOOD = chart('丁卯', '丁丑', '乙卯', '丁亥');

describe('주는 쪽의 자리 — 날것으로 든다', () => {
  /**
   * 주는 쪽 甲寅 丙寅 壬午 甲辰 은 일간이 壬水다. 받는 쪽이 바라는 水가 **일간 자신**에만 드러났고
   * 다른 천간에는 없다(辰의 중기 癸는 숨은 자리). 일간을 다른 천간과 한 칸으로 합치지 않는다 —
   * 상대의 일간이 내 필요 오행이라는 것과 상대의 월간이 그렇다는 것은 운영자가 따로 재어 볼 사실이다.
   */
  it('주는 쪽 일간이 받는 쪽 억부 1순위 오행이면 day-master 로 들고 other-stem 과 섞지 않는다', () => {
    const result = needComplementOf(needProfileOf(WATER_FOR_WOOD), chart('甲寅', '丙寅', '壬午', '甲辰'));

    expect(result.matched.eokbuPrimary).toEqual({
      element: '水',
      seats: {
        dayMaster: true,
        stemAt: [],
        branchMainAt: [],
        hiddenAt: ['hour'],
        presences: ['day-master', 'hidden-only'],
      },
    });
    expect(result.support).toBe('not-graded');
    expect(result.relationByBasis).toEqual({ any: 'supportive', visible: 'supportive', stems: 'supportive' });
  });

  /**
   * 주는 쪽 庚午 丙戌 戊午 丙辰 에서 水는 辰의 중기 癸 하나뿐이다. 받는 쪽 억부 1순위 水도, 조후 癸도
   * `hidden-only` 다. 받는 쪽의 무거운 金은 년간 庚에 드러났다. 그래서 관계가 기준마다 갈린다 —
   * 지장간까지 치면 둘 다 있어 `mixed`, 드러난 자리만 치면 무거운 쪽만 있어 `conflicting`.
   */
  it('숨은 자리에만 있으면 hidden-only 이고 관계는 기준마다 다르게 선다', () => {
    const result = needComplementOf(needProfileOf(WATER_FOR_WOOD), chart('庚午', '丙戌', '戊午', '丙辰'));

    expect(result.matched.eokbuPrimary.seats.presences).toEqual(['hidden-only']);
    expect(result.matched.eokbuPrimary.seats.hiddenAt).toEqual(['hour']);
    expect(result.matched.johuStems.map((match) => [match.stem, match.seats.presences])).toEqual([
      ['癸', ['hidden-only']],
    ]);
    expect(result.relationByBasis).toEqual({ any: 'mixed', visible: 'conflicting', stems: 'conflicting' });
  });
});

describe('조후는 글자대로', () => {
  /**
   * 받는 쪽은 조후 丙을 바란다. 주는 쪽 丁未 네 기둥에는 丙이 어디에도 없고(未의 지장간은 丁 · 乙 · 己)
   * 같은 불의 丁만 가득하다. 丁은 `sameElementOthers` 에 사실로만 서고 맞음으로 치지 않는다 — 억부 1순위
   * 水도 없고 받는 쪽의 무거운 火만 있으니 모든 기준에서 `conflicting` 이다.
   */
  it('같은 오행의 다른 천간은 사실로만 옆에 두고 맞음으로 치지 않는다', () => {
    const result = needComplementOf(needProfileOf(BING_FOR_WOOD), chart('丁未', '丁未', '丁未', '丁未'));
    const [bing] = result.matched.johuStems;

    expect(bing.stem).toBe('丙');
    expect(bing.receiverStemActive).toBe(true);
    expect(bing.seats.presences).toEqual(['absent']);
    expect(bing.sameElementOthers.map((other) => [other.stem, other.seats.presences])).toEqual([
      // 未의 본기는 己라 丁은 여기(餘氣) 자리다 — `branch-main` 이 아니다.
      ['丁', ['day-master', 'other-stem', 'hidden-only']],
    ]);
    expect(result.relationByBasis).toEqual({
      any: 'conflicting',
      visible: 'conflicting',
      stems: 'conflicting',
    });
  });
});

describe('무거운 쪽 — 감점이 아니라 신호 한 줄', () => {
  /**
   * 두 주는 쪽은 년주만 다르다 — 庚午(받는 쪽의 무거운 金이 드러남) · 甲午(金이 없다, 戌의 여기 辛뿐).
   * 맞음 사실(억부 · 조후 자리)은 한 글자도 다르지 않다. 달라지는 것은 `counterSignals` 의 자리와,
   * 그 자리를 치는 기준의 관계뿐이다.
   */
  it('주는 쪽이 받는 쪽의 가장 무거운 오행을 가지면 counterSignals 에만 들고 맞음 사실은 그대로다', () => {
    const receiver = needProfileOf(WATER_FOR_WOOD);
    const withGeng = needComplementOf(receiver, chart('庚午', '丙戌', '戊午', '丙辰'));
    const withJia = needComplementOf(receiver, chart('甲午', '丙戌', '戊午', '丙辰'));

    expect(withGeng.matched).toEqual(withJia.matched);
    expect(withGeng.confidence).toBe(withJia.confidence);
    expect(withGeng.unresolved).toEqual(withJia.unresolved);

    expect(withGeng.counterSignals.map((signal) => [signal.kind, signal.element, signal.seats.presences])).toEqual([
      ['supplies-heaviest', '金', ['other-stem', 'hidden-only']],
    ]);
    expect(withJia.counterSignals.map((signal) => [signal.element, signal.seats.presences])).toEqual([
      ['金', ['hidden-only']],
    ]);
    expect(withGeng.relationByBasis.stems).toBe('conflicting');
    expect(withJia.relationByBasis.stems).toBe('not-comparable');
  });
});

describe('시 미상', () => {
  /**
   * 주는 쪽 시를 지우면 甲辰 시주가 빠져 辰의 癸(水)를 못 본다 — 자리를 덜 센 것이지 없는 것이 아닐 수
   * 있어 그 사실을 `unresolved` 에 든다. 신뢰도는 시를 아는 쪽보다 높지 않다.
   */
  it('주는 쪽 시를 모르면 unresolved 에 들고 신뢰도는 시를 알 때보다 높지 않다', () => {
    const receiver = needProfileOf(WATER_FOR_WOOD);
    const known = needComplementOf(receiver, chart('甲寅', '丙寅', '壬午', '甲辰'));
    const hourless = needComplementOf(receiver, chart('甲寅', '丙寅', '壬午', null));

    expect(hourless.hour).toEqual({ receiverHourKnown: true, providerHourKnown: false });
    expect(hourless.unresolved).toContain('주는 쪽: 시 미상 — 여섯 글자만 보아 자리를 덜 셌을 수 있음');
    expect(known.unresolved).not.toContain('주는 쪽: 시 미상 — 여섯 글자만 보아 자리를 덜 셌을 수 있음');
    expect(GRADE_RANK[hourless.confidence]).toBeLessThanOrEqual(GRADE_RANK[known.confidence]);
    expect(hourless.matched.eokbuPrimary.seats.presences).toEqual(['day-master']);
  });

  it('받는 쪽 시를 모르면 hour 와 unresolved 에 따로 든다', () => {
    const hourless = needComplementOf(
      needProfileOf(chart('乙巳', '辛巳', '乙酉', null)),
      chart('甲寅', '丙寅', '壬午', '甲辰'),
    );

    expect(hourless.hour).toEqual({ receiverHourKnown: false, providerHourKnown: true });
    expect(hourless.unresolved.some((line) => line.startsWith('받는 쪽: 시 미상'))).toBe(true);
  });
});

describe('방향', () => {
  const a = WATER_FOR_WOOD;
  const b = BING_FOR_WOOD;
  const pairOf = (x: ProviderChart, y: ProviderChart) => [
    needComplementOf(needProfileOf(x), y),
    needComplementOf(needProfileOf(y), x),
  ];

  /**
   * A 는 水 · 癸를 바라고 金이 무겁다. B 는 水 · 丙을 바라고 火가 무겁다. B 는 丁 셋으로 火가 가득하고
   * A 에게는 金(辛 · 酉)과 水(癸)가 있어 두 방향이 같을 까닭이 없다.
   */
  it('A→B 와 B→A 는 다를 수 있다', () => {
    const [aFromB, bFromA] = pairOf(a, b);

    expect(aFromB.relationByBasis).not.toEqual(bFromA.relationByBasis);
  });

  it('쌍을 어느 쪽부터 계산해도 두 방향의 값은 같다', () => {
    const [aFromB, bFromA] = pairOf(a, b);
    const [bFromA2, aFromB2] = pairOf(b, a);

    expect(aFromB).toEqual(aFromB2);
    expect(bFromA).toEqual(bFromA2);
  });
});

describe('무작위 3000쌍 (시드 20260821, 6000 명식을 둘씩 짝)', () => {
  /**
   * 등급을 매길 때 볼 분포를 잠근다 — 움직이면 규칙이나 엔진이 바뀐 것이다. 수의 뜻은
   * `docs/notes/2026-09-25-need-complement-distribution.md`.
   */
  it(
    '세 기준의 관계 분포 · 억부 1순위의 가장 센 자리 · 방향이 갈리는 쌍의 수가 잠긴 값이다',
    () => {
      const charts = randomInputs(6000).map((input) => {
        const saju = computeSaju(input);
        return { pillars: saju.pillars, profile: needProfileOf(saju.pillars, { instant: saju.meta.instant }) };
      });

      const relations: Record<ComplementBasis, Record<string, number>> = { any: {}, visible: {}, stems: {} };
      const primarySeat: Record<string, number> = {};
      const differ: Record<ComplementBasis, number> = { any: 0, visible: 0, stems: 0 };
      let counterSignals = 0;

      const tally = (result: DirectionalNeedComplement) => {
        for (const basis of NEED_COMPLEMENT_POLICY.bases) {
          const relation = result.relationByBasis[basis];
          relations[basis][relation] = (relations[basis][relation] ?? 0) + 1;
        }
        const strongest = result.matched.eokbuPrimary.seats.presences[0];
        primarySeat[strongest] = (primarySeat[strongest] ?? 0) + 1;
        if (result.counterSignals.length > 0) counterSignals += 1;
        expect(result.support).toBe('not-graded');
      };

      for (let pair = 0; pair < 3000; pair += 1) {
        const a = charts[2 * pair];
        const b = charts[2 * pair + 1];
        const aFromB = needComplementOf(a.profile, b.pillars);
        const bFromA = needComplementOf(b.profile, a.pillars);
        tally(aFromB);
        tally(bFromA);
        for (const basis of NEED_COMPLEMENT_POLICY.bases) {
          if (aFromB.relationByBasis[basis] !== bFromA.relationByBasis[basis]) differ[basis] += 1;
        }
      }

      expect(relations).toEqual({
        any: { mixed: 5786, supportive: 198, conflicting: 16 },
        visible: { mixed: 4780, supportive: 991, conflicting: 202, 'not-comparable': 27 },
        stems: { mixed: 2924, supportive: 2148, conflicting: 631, 'not-comparable': 297 },
      });
      expect(primarySeat).toEqual({
        'day-master': 1212,
        'other-stem': 2317,
        'branch-main': 1426,
        'hidden-only': 798,
        absent: 247,
      });
      expect(differ).toEqual({ any: 200, visible: 966, stems: 1748 });
      expect(counterSignals).toBe(5802);
    },
    POPULATION_TIMEOUT_MS,
  );
});

/** 보완은 점수가 아니다 — 궁합 계산의 정책이 이 일로 움직이지 않았다 */
it('궁합은 여전히 점수를 내지 않는다', () => {
  expect(COMPAT_POLICY.scoring).toBe('not-scored');
  expect(NEED_COMPLEMENT_POLICY.scoring).toBe(COMPAT_POLICY.scoring);
});
