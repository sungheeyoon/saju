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
  tonggwanCandidacyOf(pillars, effectiveElementsOf(pillars));

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
    // 甲이 시간에 서 있으므로 이을 손은 드러나 있다.
    expect(tightest.bridgePresence).toBe('revealed');
    // 일간 丙은 극당하는 쪽이다 — 남의 대치가 아니라 자기가 낀 대치다.
    expect(tightest.dayMasterAt).toBe('controlled');
  });

  /**
   * **「없다」와 「숨어 있다」는 다른 사실이다.**
   *
   * 한동안 개수 하나로 참·거짓만 냈다. 그러면 지장간에만 있는 오행이 같은 칸에서
   * 「8.0%」와 「한 자도 없다」를 동시에 말한다 — 몫은 점수로, 존재는 글자로 재기
   * 때문이다. 둘 다 참인데 읽는 쪽은 어느 말을 믿을지 모른다.
   */
  it('드러난 것과 숨은 것과 없는 것을 가른다', () => {
    // 庚戌·庚辰·甲寅·乙丑 — 금목 대치의 사이인 水가 글자로는 없고 지장간(辰·丑)에만 있다.
    const hidden = candidacyOf(chart('庚戌', '庚辰', '甲寅', '乙丑')).pairs.find(
      (pair) => pair.controller === '金',
    )!;

    expect(hidden.bridge).toBe('水');
    expect(hidden.bridgePresence).toBe('hidden');
    // 숨어 있으면 몫은 0 이 아니다 — 이 둘이 어긋나 보이던 자리다.
    expect(hidden.shares.bridge).toBeGreaterThan(0);

    // 사주 여덟 글자에 수가 아예 없고 지장간에도 없는 자리를 찾는다.
    const absent = candidacyOf(chart('丙午', '甲午', '丙午', '甲午')).pairs.find(
      (pair) => pair.bridge === '水',
    )!;

    expect(absent.bridgePresence).toBe('absent');
    expect(absent.shares.bridge).toBe(0);
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

  /** 3000건짜리 보정값은 `calibration.test.ts` 가 한 바퀴로 다 잰다 — 세 번 돌지 않는다 */
});
