import { describe, expect, it } from 'vitest';

import { pillarOf, type Branch, type Stem } from '../constants';
import { hourPillarOf } from '../pillars/hour';
import { monthPillarOf } from '../pillars/month';
import { effectiveElementsOf } from './effectiveElements';
import { STRUCTURE_POLICY, structureOf } from './structure';
import { STRUCTURE_EXTERNAL_CASES } from './validation/structureExternalCases';

/**
 * 격국 외부 대조 — **처음 재 본다.**
 *
 * `STRUCTURE_POLICY.externalCheck` 가 여태 `{ dataset: null, cases: 0 }` 이었다. 그런데
 * 상한 표는 격국을 종격과 **같은 `candidate` 칸**에 앉혀 두었다 — 종격은 서른다섯 건을
 * 놓고 게이트를 못 열었고 격국은 아직 재 본 적이 없는데, 사다리에 그 둘을 가르는 칸이
 * 없어서 그렇게 됐다. 이제 잰다.
 *
 * ## 채점하는 것은 격의 종류 하나다
 *
 * 성패(成敗)는 안 센다. 이 책은 「貴格」·「破格」을 산문으로 말하고 조건을 여럿 든 뒤에야
 * 결론을 내는데, 우리 `outcome` 은 조건 목록에서 나온 세 값이다. 두 눈금이 달라서
 * 맞춰 세면 **계통이 아니라 눈금을 채점하게 된다** — 억부 자료가 「논리가 다른 열넷을
 * 따로 센다」고 한 것과 같은 자리다.
 */

function chartOf(pillars: (typeof STRUCTURE_EXTERNAL_CASES)[number]['pillars']) {
  const parse = (name: string) => {
    const pillar = pillarOf(name[0] as Stem, name[1] as Branch);
    if (!pillar) throw new Error(`간지가 아니다: ${name}`);
    return pillar;
  };
  const day = parse(pillars.day);

  return {
    year: parse(pillars.year),
    month: parse(pillars.month),
    day,
    hour: parse(pillars.hour),
    dayMaster: day.stem,
  };
}

const kindOf = (testCase: (typeof STRUCTURE_EXTERNAL_CASES)[number]) => {
  const chart = chartOf(testCase.pillars);
  return structureOf(chart, effectiveElementsOf(chart).distribution).kind;
};

const scorable = STRUCTURE_EXTERNAL_CASES.filter(
  (testCase) => testCase.chartConstruction === 'consistent',
);

const agrees = (testCase: (typeof STRUCTURE_EXTERNAL_CASES)[number]) =>
  (testCase.claim.kinds as readonly string[]).includes(kindOf(testCase));

describe('격국 외부 대조 데이터셋', () => {
  it('한 책에서 왔고 자리마다 출처를 든다', () => {
    expect(new Set(STRUCTURE_EXTERNAL_CASES.map(({ id }) => id)).size).toBe(
      STRUCTURE_EXTERNAL_CASES.length,
    );

    for (const testCase of STRUCTURE_EXTERNAL_CASES) {
      expect(Object.values(testCase.pillars)).toHaveLength(4);
      expect(testCase.source.locator.length).toBeGreaterThan(0);
      expect(testCase.claim.kinds.length).toBeGreaterThan(0);
      expect(testCase.lineage).toBe('classical-chinese');
    }
  });

  /**
   * 월간은 연간에서(오호둔), 시간은 일간에서(오자둔) 정해진다. **고전이라고 이 검사에서
   * 면제되지 않는다** — 종격 자료에서 판본 오배를 한 건 잡았고, 여기서도 두 건 잡힌다.
   */
  it('네 기둥이 실재할 수 있는지 저장소 규칙으로 다시 센다', () => {
    for (const testCase of STRUCTURE_EXTERNAL_CASES) {
      const { year, month, day, hour } = testCase.pillars;
      const derivedMonth = monthPillarOf(year[0] as Stem, month[1] as Branch);
      const derivedHour = hourPillarOf(day[0] as Stem, hour[1] as Branch);
      const realizable =
        `${derivedMonth.stem}${derivedMonth.branch}` === month &&
        `${derivedHour.stem}${derivedHour.branch}` === hour;

      expect(testCase.chartConstruction, testCase.id).toBe(
        realizable ? 'consistent' : 'unrealizable',
      );
    }

    expect(scorable).toHaveLength(72);
  });

  /**
   * **성적을 행렬로 고정한다.** 규칙을 만지면 어느 칸이 움직이는지 여기서 보인다.
   *
   * 재어 본 값(2026-09-05): 72건 중 **56건 일치(77.8%)**.
   */
  it('장별 일치를 고정한다', () => {
    const byChapter = new Map<string, [number, number]>();

    for (const testCase of scorable) {
      const [hit, total] = byChapter.get(testCase.claim.chapter) ?? [0, 0];
      byChapter.set(testCase.claim.chapter, [hit + (agrees(testCase) ? 1 : 0), total + 1]);
    }

    expect(Object.fromEntries(byChapter)).toEqual({
      論正官: [2, 5],
      論財: [10, 12],
      論印綬: [10, 11],
      論食神: [6, 9],
      論偏官: [5, 8],
      論傷官: [6, 10],
      論陽刃: [5, 5],
      論建祿月劫: [12, 12],
    });

    expect(scorable.filter(agrees)).toHaveLength(56);
  });

  /**
   * **어긋난 열여섯은 흩어져 있지 않다.** 두 무리로 모인다.
   *
   * 1. **왕지 월령에서 여기가 투출한 자리.** 卯의 지장간에 甲이 있고 그 甲이 천간에 서
   *    있으면 우리는 상관격으로 잡는데, 이 책은 정기 乙로 보아 식신격이라 한다. 자평
   *    계열은 子午卯酉를 **정기 하나로** 보는 관행이 있고 우리 표는 여기를 함께 든다.
   * 2. **정기가 투출하지 않은 자리.** 申월에 庚이 안 나오고 戊가 나오면 우리는 재격으로
   *    내려가는데, 이 책은 「乙用申官」처럼 정기를 격으로 부른다.
   *
   * **둘 다 규칙을 고치면 성적이 오른다. 그래서 지금 안 고친다** — 자료에 맞춰 규칙을
   * 만지면 이 대조는 채점이 아니라 자기 답안지가 된다. 고칠 근거는 원문의 규칙 조항이지
   * 이 성적이어야 하고, 그것은 별건이다.
   */
  it('어긋난 자리가 두 무리로 모인다 — 규칙 차이지 흩어진 오차가 아니다', () => {
    const missed = scorable.filter((testCase) => !agrees(testCase));

    expect(missed).toHaveLength(16);

    // 식신↔상관이 서로 뒤집힌 것 — 왕지 월령의 여기 투출이 만드는 무리다.
    const foodHurt = missed.filter((testCase) => {
      const engine = kindOf(testCase);
      const claimed = testCase.claim.kinds as readonly string[];
      return (
        (engine === '傷官格' && claimed.includes('食神格')) ||
        (engine === '食神格' && claimed.includes('傷官格'))
      );
    });

    expect(foodHurt.length).toBeGreaterThanOrEqual(5);
  });

  /**
   * **게이트는 여전히 닫혀 있다.**
   *
   * 77.8% 는 종격의 재현율(30건 중 17건)보다 높지만, 그것이 게이트를 여는 근거가 되지는
   * 않는다 — 계통이 **하나뿐**이라 이 성적이 말하는 것은 「자평 계열과 얼마나 맞는가」이고,
   * 어긋난 열여섯이 흩어진 오차가 아니라 **규칙 차이 두 무리**이기 때문이다. 규칙이 갈리는
   * 것을 알면서 그 판정으로 억부를 뒤집을 수는 없다.
   */
  it('억부도 조후도 뒤집지 않는다', () => {
    expect(STRUCTURE_POLICY.yongsinOverride).toBe('disabled');
    expect(STRUCTURE_POLICY.externalCheck.passed).toBe(false);
    expect(STRUCTURE_POLICY.externalCheck.cases).toBe(STRUCTURE_EXTERNAL_CASES.length);
    expect(STRUCTURE_POLICY.externalCheck.scored).toBe(scorable.length);
    expect(STRUCTURE_POLICY.externalCheck.agreed).toBe(56);
    expect(STRUCTURE_POLICY.externalCheck.lineages).toBe(1);
  });
});
