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
   * 재어 본 값(2026-09-05): 72건 중 **63건 일치(87.5%)**. 처음 쟀을 때는 56건이었고,
   * 올린 것은 문턱이 아니라 **출처의 조항**이다 — 왕지 월령을 정기 하나로 보게 고쳤다
   * (`STRUCTURE_POLICY.peakMonth`). 그 근거는 이 성적이 아니라 원문 한 줄이다.
   */
  it('장별 일치를 고정한다', () => {
    const byChapter = new Map<string, [number, number]>();

    for (const testCase of scorable) {
      const [hit, total] = byChapter.get(testCase.claim.chapter) ?? [0, 0];
      byChapter.set(testCase.claim.chapter, [hit + (agrees(testCase) ? 1 : 0), total + 1]);
    }

    expect(Object.fromEntries(byChapter)).toEqual({
      論正官: [3, 5],
      論財: [10, 12],
      論印綬: [10, 11],
      論食神: [9, 9],
      論偏官: [6, 8],
      論傷官: [8, 10],
      論陽刃: [5, 5],
      論建祿月劫: [12, 12],
    });

    expect(scorable.filter(agrees)).toHaveLength(63);
  });

  /**
   * **남은 아홉은 한 무리다 — 그리고 규칙이 틀린 것이 아니다.**
   *
   * 처음 쟀을 때 어긋난 열여섯은 두 무리였다. 하나(왕지 월령의 여기 투출)는 출처가
   * 조항으로 답을 주어 고쳤다. 남은 아홉은 **정기가 투출하지 않은 자리**다.
   *
   * 여기서는 출처가 우리 편이다 — §108 은 「不透甲而透丙，則同知得以作主」로 **우리와 같은
   * 규칙**을 말한다. 그런데 예시에서는 본격을 함께 부른다. §144 가 그 까닭을 든다:
   * 「一透則一用，兼透則兼用」 — 둘이 투출하면 **둘 다 쓴다.** 이름이 둘인 자리를 우리
   * `kind` 가 하나로 접는 것이라, **규칙이 갈린 것이 아니라 값의 모양이 좁다.**
   *
   * 그래서 이 아홉은 규칙을 고쳐서 줄일 것이 아니다. 줄이려면 격이 겸격을 들 수 있어야
   * 하고, 그것은 격의 자료 구조를 바꾸는 별건이다.
   */
  it('남은 어긋남은 정기 미투출 한 무리다', () => {
    const missed = scorable.filter((testCase) => !agrees(testCase));

    expect(missed).toHaveLength(9);

    // 왕지 월령이 만들던 식신↔상관 뒤집힘은 이제 하나도 없다.
    const foodHurt = missed.filter((testCase) => {
      const engine = kindOf(testCase);
      const claimed = testCase.claim.kinds as readonly string[];
      return (
        (engine === '傷官格' && claimed.includes('食神格')) ||
        (engine === '食神格' && claimed.includes('傷官格'))
      );
    });

    expect(foodHurt).toHaveLength(0);
  });

  /**
   * **게이트는 여전히 닫혀 있다.**
   *
   * 87.5% 는 종격의 재현율(30건 중 17건)보다 높지만, 그것이 게이트를 여는 근거가 되지는
   * 않는다 — 계통이 **하나뿐**이라 이 성적이 말하는 것은 「자평 계열과 얼마나 맞는가」이고,
   * 남은 아홉이 **겸격을 한 이름으로 접는 데서** 오기 때문이다. 이름을 하나만 들 수
   * 있다는 것을 알면서 그 판정으로 억부를 뒤집을 수는 없다.
   */
  it('억부도 조후도 뒤집지 않는다', () => {
    expect(STRUCTURE_POLICY.yongsinOverride).toBe('disabled');
    expect(STRUCTURE_POLICY.externalCheck.passed).toBe(false);
    expect(STRUCTURE_POLICY.externalCheck.cases).toBe(STRUCTURE_EXTERNAL_CASES.length);
    expect(STRUCTURE_POLICY.externalCheck.scored).toBe(scorable.length);
    expect(STRUCTURE_POLICY.externalCheck.agreed).toBe(63);
    expect(STRUCTURE_POLICY.externalCheck.lineages).toBe(1);
  });
});
