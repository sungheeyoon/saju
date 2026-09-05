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

/**
 * 본격까지 세는 채점 — **더 약한 증거다.**
 *
 * 이름을 둘 내고 그중 하나가 맞으면 맞다고 세는 것이라, 하나를 내고 맞힌 것과 같은
 * 무게일 수 없다. 그래서 **두 수를 다 고정한다** — 하나로 줄이면 어느 쪽으로 잰 것인지가
 * 사라지고, 나중에 이 수를 근거로 게이트를 여는 사람이 그 차이를 못 본다.
 */
const agreesWithNative = (testCase: (typeof STRUCTURE_EXTERNAL_CASES)[number]) => {
  if (agrees(testCase)) return true;

  const chart = chartOf(testCase.pillars);
  const { principalKind } = structureOf(chart, effectiveElementsOf(chart).distribution);
  return principalKind !== null && (testCase.claim.kinds as readonly string[]).includes(principalKind);
};

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
   * **본격을 함께 들면 일흔둘 중 일흔이 덮인다.**
   *
   * 남은 아홉 중 일곱이 「변격은 우리 답, 본격은 저쪽 답」인 자리였다 — 출처가 §112
   * 「又有變之而不失本格者」로 남겨 둔 그 자리다. 우리가 본격을 안 들고 있어서 자료로는
   * 그 문장이 어디서 왔는지 알 수가 없었다.
   *
   * **투출 겸격은 값을 못 냈다.** §144 의 「兼透則兼用」을 따라 투출한 다른 후보까지
   * 세어 봤지만 한 건도 더 안 잡힌다 — 이 자료에서 이름을 가르는 것은 투출이 아니라
   * 본격이다. 그래서 겸격을 배열로 넓히지 않고 본격 한 칸만 든다.
   */
  it('본격까지 세면 일흔 — 다만 이름을 둘 내고 맞힌 것이다', () => {
    expect(scorable.filter(agreesWithNative)).toHaveLength(70);

    const missed = scorable.filter((testCase) => !agreesWithNative(testCase));

    /*
      남은 둘은 **묘고(墓庫)의 잡기**를 쓰는 자리다 — 未庫의 甲을 재로 보고(cai-7),
      辰中의 암장 살을 격으로 본다(pianguan-2). 그 논리는 다른 장(論雜氣如何取用)에
      있고, 우리는 그 장을 아직 안 읽었다. 여기서 규칙을 늘리지 않는다.
    */
    expect(missed.map((testCase) => testCase.id)).toEqual(['zpzq-cai-7', 'zpzq-pianguan-2']);
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
   * 그래서 이 아홉은 규칙을 고쳐서 줄인 것이 아니다. **격이 본격을 함께 들게** 했고
   * (`principalKind`), 그러면 일곱이 덮인다 — 아래 시험이 그 수를 따로 든다.
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
   * 87.5%(정확) · 97.2%(본격 포함) 는 종격의 재현율(30건 중 17건)보다 높다. 그래도 안
   * 연다 — 계통이 **하나뿐**이고, 뒤의 수는 **이름을 둘 내고 맞힌 것**이라 하나를 내고
   * 맞힌 것과 같은 무게가 아니기 때문이다. 게다가 우리는 둘 중 어느 쪽이 이 명식의
   * 격인지를 **판정하지 않기로 했다**(`nativeKind`). 고르지 않은 답으로 억부를 뒤집을
   * 수는 없다.
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
