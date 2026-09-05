import { describe, expect, it } from 'vitest';

import { CONTROLS, ELEMENTS, GENERATES, pillarOf, type Branch, type Stem } from '../constants';
import { computeSaju } from '../index';
import { randomInputs } from '../population';
import { effectiveElementsOf } from './effectiveElements';
import { TONGGWAN_POLICY, tonggwanCandidacyOf } from './tonggwan';

const chart = (year: string, month: string, day: string, hour: string) => {
  const parse = (name: string) => {
    const pillar = pillarOf(name[0] as Stem, name[1] as Branch);
    if (!pillar) throw new Error(`간지가 아니다: ${name}`);
    return pillar;
  };
  const dayPillar = parse(day);

  return {
    year: parse(year),
    month: parse(month),
    day: dayPillar,
    hour: parse(hour),
    dayMaster: dayPillar.stem,
  };
};

const candidacyOf = (pillars: ReturnType<typeof chart>) =>
  tonggwanCandidacyOf(pillars, effectiveElementsOf(pillars).distribution);

describe('통관 후보의 재료', () => {
  /**
   * **잇는 오행은 우리가 고른 것이 아니다.** 극하는 쪽이 낳는 것이 곧 극당하는 쪽을
   * 낳는다 — 이 항등이 깨지면 「사이를 잇는다」는 말 자체가 성립하지 않는다.
   */
  it('통관신은 다섯 쌍 모두에서 상생 고리로 이어진다', () => {
    const { pairs } = candidacyOf(chart('甲子', '丙寅', '戊辰', '庚申'));

    expect(pairs).toHaveLength(5);
    for (const pair of pairs) {
      expect(CONTROLS[pair.controller]).toBe(pair.controlled);
      expect(GENERATES[pair.controller]).toBe(pair.bridge);
      expect(GENERATES[pair.bridge]).toBe(pair.controlled);
    }
  });

  it('다섯 극 관계를 하나도 빼지 않는다 — 고르는 자리가 곧 문턱이다', () => {
    const { pairs } = candidacyOf(chart('甲子', '丙寅', '戊辰', '庚申'));

    expect(new Set(pairs.map((pair) => pair.controller))).toEqual(new Set(ELEMENTS));
  });

  /**
   * 대치의 크기는 **가벼운 쪽**이 정한다. 금이 아무리 무거워도 목이 없으면 맞선
   * 것이 아니라 한쪽만 있는 것이다.
   */
  it('가벼운 쪽이 무거운 순으로 세운다', () => {
    const { pairs } = candidacyOf(chart('庚申', '庚辰', '甲寅', '乙亥'));
    const facings = pairs.map((pair) => pair.facing);

    expect([...facings].sort((a, b) => b - a)).toEqual(facings);
    expect(pairs[0].facing).toBeGreaterThan(0);
  });

  /** 같은 명식을 두 번 부르면 같은 순서가 나와야 한다 — 화면이 흔들리지 않는다 */
  it('같은 입력에서 순서가 흔들리지 않는다', () => {
    const pillars = chart('壬子', '壬子', '丙午', '甲午');
    const once = candidacyOf(pillars).pairs.map((pair) => pair.controller);
    const twice = candidacyOf(pillars).pairs.map((pair) => pair.controller);

    expect(once).toEqual(twice);
  });

  /**
   * 수와 화가 맞선 명식 — 사이를 잇는 것은 목이다(水生木, 木生火).
   *
   * 壬子·壬子·丙午·甲午 는 수 넷과 화 셋이 정면으로 서 있다. 억부는 이 자리에서도
   * 「무엇이 가장 무거운가」로 한쪽을 고르지만, 통관의 재료는 **둘이 맞서 있다는
   * 사실과 그 사이에 무엇이 서는가**다.
   */
  it('맞선 두 세력과 그 사이를 짚는다', () => {
    const { tightest } = candidacyOf(chart('壬子', '壬子', '丙午', '甲午'));

    expect(new Set([tightest.controller, tightest.controlled])).toEqual(new Set(['水', '火']));
    expect(tightest.bridge).toBe('木');
    // 甲이 시간에 서 있으므로 이을 손은 있다.
    expect(tightest.bridgePresent).toBe(true);
    // 일간 丙은 극당하는 쪽이다 — 남의 대치가 아니라 자기가 낀 대치다.
    expect(tightest.dayMasterAt).toBe('controlled');
  });

  it('잇는 오행이 원국에 없으면 없다고 적는다', () => {
    // 금과 목이 맞서는데 사이의 수가 글자로 한 자도 없다.
    const { pairs } = candidacyOf(chart('庚戌', '庚辰', '甲寅', '乙丑'));
    const metalWood = pairs.find((pair) => pair.controller === '金')!;

    expect(metalWood.bridge).toBe('水');
    expect(metalWood.bridgePresent).toBe(false);
  });

  /**
   * **판정하지 않는다.** 「이 명식은 통관이 필요하다」는 문턱을 고르는 일이고, 그
   * 문턱은 계통마다 갈린다(`followingPatterns.ts` 가 먼저 겪은 자리다).
   */
  it('대치인지 아닌지를 말하지 않는다', () => {
    const candidacy = candidacyOf(chart('甲子', '丙寅', '戊辰', '庚申'));

    expect(candidacy.status).toBe('facts-only');
    expect(TONGGWAN_POLICY.verdict).toBe('none');
    expect(TONGGWAN_POLICY.eokbuOverride).toBe('disabled');
    expect(TONGGWAN_POLICY.externalCheck.cases).toBe(0);
    expect(Object.keys(candidacy)).toEqual(['status', 'pairs', 'tightest']);
  });

  /**
   * 모집단에서 어떤 값이 나오는지 재어 둔다 — **문턱을 고를 때 쓸 바탕이다.**
   *
   * 지금은 아무 선도 긋지 않지만, 나중에 계통을 채택하는 사람이 「0.3 이면 몇
   * 퍼센트가 걸리는가」를 물을 것이다. 그때 표본을 새로 만들면 여기 적힌 숫자와
   * 비교할 수 없으므로, 같은 모집단(`population.ts`)에서 지금 재어 남긴다.
   */
  it('무작위 3000건에서 가장 팽팽한 쌍의 분포를 재어 둔다', () => {
    const tightest = randomInputs(3000).map(
      (input) => computeSaju(input).analysis.tonggwan.tightest,
    );
    const round = (value: number) => Math.round(value * 1000) / 1000;
    const share = (floor: number) =>
      round(tightest.filter((pair) => pair.facing >= floor).length / 3000);

    // 다섯 쌍 중 가장 팽팽한 것이라 언제나 하나는 나온다 — 「없음」이 없는 층이다.
    expect(tightest).toHaveLength(3000);

    /**
     * **정책이 적어 둔 숫자와 같은 표본에서 같은 값이 나오는지 잠근다.**
     *
     * 계약이 죽은 값을 들고 있으면 그 값은 검증되지 않는다 — 이 저장소가 여러 번
     * 겪은 자리다. 분포를 바꾸는 변경(가중치·국·합화)이 들어오면 여기서 먼저 걸리고,
     * 그때 고칠 것은 시험이 아니라 `TONGGWAN_POLICY.calibration` 이다.
     */
    const measured = TONGGWAN_POLICY.calibration;
    for (const [floor, expected] of Object.entries(measured.facingAtLeast)) {
      expect(share(Number(floor)), `facing ≥ ${floor}`).toBe(expected);
    }
    expect(round(tightest.filter((pair) => !pair.bridgePresent).length / 3000)).toBe(
      measured.bridgeAbsent,
    );
  });
});
