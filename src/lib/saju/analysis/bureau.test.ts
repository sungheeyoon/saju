import { describe, expect, it } from 'vitest';

import { BUREAU_POLICY, bureausOf } from '@/src/lib/saju/analysis/bureau';
import { effectiveElementsOf } from '@/src/lib/saju/analysis/effectiveElements';
import { elementDistributionOf } from '@/src/lib/saju/analysis/fiveElements';
import { pillarOf, type Branch, type Stem } from '@/src/lib/saju/constants';

const chart = (year: string, month: string, day: string, hour: string | null) => {
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

describe('국(局)', () => {
  it('삼합이 다 모이면 국이 서고 반합은 그 절반이다', () => {
    const [full] = bureausOf(chart('壬申', '壬子', '丙辰', '戊子'));
    expect(full.kind).toBe('tripleCombination');
    expect(full.element).toBe('水');
    expect(full.pull).toBe(BUREAU_POLICY.pull.full);

    const [half] = bureausOf(chart('壬申', '壬子', '丙寅', '庚寅'));
    expect(half.kind).toBe('halfTriple');
    expect(half.pull).toBe(BUREAU_POLICY.pull.half);
  });

  /**
   * **공협(拱)은 관계 표가 일부러 내지 않는 것이다.** 申辰을 관계라고 부르면
   * 어느 계통에서도 관계로 치지 않는 것을 관계라고 하게 된다. 그러나 세력을
   * 잴 때는 사정이 달라서, 여기서만 무게로 낸다.
   */
  it('왕지가 빠진 두 글자는 붙어 있을 때만 센다', () => {
    const [span] = bureausOf(chart('丙申', '壬辰', '丙寅', '庚寅'));
    expect(span.kind).toBe('spanTriple');
    expect(span.hasPeak).toBe(false);
    expect(span.element).toBe('水');

    // 같은 두 글자가 떨어져 있으면 사이를 낄 것이 없다.
    expect(bureausOf(chart('丙申', '庚寅', '丙寅', '壬辰'))).toEqual([]);
    expect(BUREAU_POLICY.spanRequiresAdjacency).toBe(true);
  });

  it('한 오행에 등급이 여럿이면 가장 무거운 하나만 남는다', () => {
    // 申子辰이 다 모였으니 申子·子辰 반합을 따로 세면 같은 세력을 두 번 센다.
    const water = bureausOf(chart('壬申', '壬子', '丙辰', '戊子')).filter((b) => b.element === '水');
    expect(water).toHaveLength(1);
  });

  it('국의 이름은 자리 순서가 아니라 생·왕·묘 차례로 읽는다', () => {
    // 辰이 년지, 子가 월지라도 「자진 반합」이지 「진자 반합」이 아니다.
    const [half] = bureausOf(chart('戊辰', '甲子', '丙寅', '庚寅'));
    expect(half.ko).toBe('자진 반합');
  });

  /**
   * 국은 글자를 바꾸지 않고 무게만 기울인다. 辰이 水局에 들어도 辰中戊土가
   * 0 이 되지는 않는다 — 고전도 그것을 지우지는 않는다.
   */
  it('국은 무게를 옮길 뿐 글자를 바꾸지 않는다', () => {
    const input = chart('壬申', '壬子', '丙辰', '戊子');
    const base = elementDistributionOf(input);
    const effective = effectiveElementsOf(input);

    expect(effective.distribution.ratios['水']).toBeGreaterThan(base.ratios['水']);
    expect(effective.distribution.ratios['土']).toBeGreaterThan(0);
    // 글자 수는 그대로다 — 옮긴 것은 무게다.
    expect(effective.distribution.counts).toEqual(base.counts);

    // 옮긴 몫의 합이 곧 두 분포의 차이다.
    const moved = effective.shifts.reduce((sum, shift) => sum + shift.amount, 0);
    expect(moved).toBeGreaterThan(0);
    const total = (Object.values(effective.distribution.scores) as number[]).reduce(
      (a, b) => a + b,
      0,
    );
    expect(total).toBeCloseTo(
      (Object.values(base.scores) as number[]).reduce((a, b) => a + b, 0),
    );
  });

  it('일간이 낀 합은 무게를 옮기지 않는다 — 화격은 아직 판정하지 않는다', () => {
    // 일간 甲과 시간 己의 갑기합토. 붙어 있고 월령도 土지만 옮기지 않는다.
    const input = chart('戊戌', '壬戌', '甲戌', '己巳');
    const effective = effectiveElementsOf(input);

    const combination = effective.transformations.find((t) => t.involvesDayMaster);
    expect(combination).toBeDefined();
    expect(effective.shifts.some((shift) => shift.cause === combination!.ko)).toBe(false);
  });
});
