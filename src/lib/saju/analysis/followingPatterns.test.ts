import { describe, expect, it } from 'vitest';

import { FOLLOWING_PATTERN_POLICY, followingCandidacyOf } from '@/src/lib/saju/analysis/followingPatterns';
import { elementDistributionOf } from '@/src/lib/saju/analysis/fiveElements';
import { rootednessOf } from '@/src/lib/saju/analysis/rootedness';
import { pillarOf, type Branch, type Stem } from '@/src/lib/saju/constants';

function candidacy(year: string, month: string, day: string, hour: string | null) {
  const parse = (name: string) => {
    const pillar = pillarOf(name[0] as Stem, name[1] as Branch);
    if (!pillar) throw new Error(`간지가 아니다: ${name}`);
    return pillar;
  };

  const parsedDay = parse(day);
  const pillars = {
    year: parse(year),
    month: parse(month),
    day: parsedDay,
    hour: hour === null ? null : parse(hour),
    dayMaster: parsedDay.stem,
  };

  return followingCandidacyOf(pillars, elementDistributionOf(pillars), rootednessOf(pillars));
}

describe('종격 후보 — 조건이 되는 사실', () => {
  /**
   * 종의 가장 앞 조건은 일간이 뿌리가 없다는 것이다. 판정을 미루더라도 이 사실은
   * 문턱과 무관하게 정해진다.
   */
  it('일간이 무근인지는 통근 계산에서 그대로 온다', () => {
    // 甲 일간에 木이 든 지지가 없다 — 무근.
    expect(candidacy('庚申', '乙酉', '甲申', '丁丑').dayMasterRootless).toBe(true);
    // 월지 寅에 통근한다.
    expect(candidacy('丙子', '庚寅', '甲午', '丙寅').dayMasterRootless).toBe(false);
  });

  it('가장 무거운 세력과 그 비중을 낸다', () => {
    // 金이 넷, 土가 둘 — 甲 일간에게 金은 관성이다.
    const found = candidacy('庚申', '乙酉', '甲申', '丁丑');

    expect(found.dominant.role).toBe('官星');
    expect(found.dominant.element).toBe('金');
    expect(found.dominant.ratio).toBeGreaterThan(0.35);
    // 세력 비중은 오행 분포를 그대로 쓴다 — 여기서 따로 세지 않는다.
    expect(found.dominant.ratio).toBeCloseTo(
      elementDistributionOf({
        year: pillarOf('庚', '申')!,
        month: pillarOf('乙', '酉')!,
        day: pillarOf('甲', '申')!,
        hour: pillarOf('丁', '丑')!,
      }).ratios['金'],
    );
  });

  it('월령을 그 세력이 잡았는지 짚는다', () => {
    // 월지 酉의 정기는 辛(金) — 가장 무거운 金과 같다.
    expect(candidacy('庚申', '乙酉', '甲申', '丁丑').monthCommandsDominant).toBe(true);
    // 월지 寅의 정기는 甲(木) — 여기서 가장 무거운 것은 木이 아니다.
    expect(candidacy('庚午', '壬午', '丙午', '甲午').monthCommandsDominant).toBe(true);
  });

  /**
   * 생부가 천간에 드러나 있으면 종이 어려워진다는 것이 계통 공통분모다. 다만
   * 몇 자까지 봐주는지가 가종 문턱이라 세기만 한다.
   */
  it('천간에 드러난 생부를 세되 일간 자신은 빼고 센다', () => {
    // 甲 일간, 년간 乙(비겁)·시간 癸(인성). 일간 자신은 목록에 없다.
    const found = candidacy('乙酉', '庚辰', '甲申', '癸酉');

    expect(found.supportStems.map((support) => [support.position, support.stem])).toEqual([
      ['year', '乙'],
      ['hour', '癸'],
    ]);
    expect(found.supportStems.map((support) => support.role)).toEqual(['比劫', '印星']);
  });

  it('생부가 하나도 드러나지 않으면 빈 배열이다', () => {
    expect(candidacy('庚申', '丙戌', '甲申', '戊辰').supportStems).toEqual([]);
  });

  /**
   * 판정을 하지 않는다는 것이 이 층의 계약이다. 값이 늘어나도 결론을 내는
   * 필드가 생기면 안 된다.
   */
  it('판정하지 않는다 — 성립 여부나 격 이름을 내지 않는다', () => {
    const found = candidacy('庚申', '乙酉', '甲申', '丁丑');

    expect(found.status).toBe('facts-only');
    expect(Object.keys(found).sort()).toEqual([
      'dayMasterRootless',
      'dominant',
      'monthCommandsDominant',
      'status',
      'supportRatio',
      'supportStems',
    ]);
    expect(FOLLOWING_PATTERN_POLICY.status).toBe('documented-not-evaluated');
    expect(FOLLOWING_PATTERN_POLICY.candidacy).toBe('facts-only-no-verdict');
    expect(FOLLOWING_PATTERN_POLICY.eokbuOverride).toBe('disabled');
  });
});
