import { describe, expect, it } from 'vitest';

import {
  HIDDEN_RELATION_POLICY,
  hiddenCombinationsOf,
} from '@/src/lib/saju/analysis/hiddenRelations';
import { GOLDEN_CASES } from '@/src/lib/saju/golden/cases';
import { findRelations } from '@/src/lib/saju/relations';
import { computeSaju } from '@/src/lib/saju';
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

describe('암합', () => {
  /**
   * 卯申암합·午亥암합 같은 표를 따로 두지 않는다. 그 표는 지장간과 천간합에서
   * 유도된 것이고, 유도할 수 있는 것을 표로 적으면 두 벌이 되어 어긋난 쪽을
   * 알 수 없게 된다.
   */
  it('지지끼리의 암합을 표 없이 지장간에서 유도한다', () => {
    // 卯(甲乙) 와 申(戊壬庚) — 乙庚합이 지장간끼리 맺힌다.
    const found = hiddenCombinationsOf(chart('丁卯', '戊申', '丙子', '己丑'));
    const across = found.filter(
      (combination) =>
        combination.kind === 'hiddenToHidden' &&
        combination.participants.every((p) => p.hidden !== null) &&
        combination.participants.map((p) => p.hidden!.branch).sort().join('') === '卯申',
    );

    expect(across.some((combination) => combination.ko === '을경합금')).toBe(true);
    expect(HIDDEN_RELATION_POLICY.derivation).toBe(
      'hidden-stems-times-stem-combination-table',
    );
  });

  it('드러난 천간과 다른 자리의 지장간이 맺으면 명암합이다', () => {
    // 일간 丁과 亥 속 壬.
    const found = hiddenCombinationsOf(chart('乙亥', '戊子', '丁卯', '庚戌'));
    const bright = found.filter((combination) => combination.kind === 'revealedToHidden');

    expect(
      bright.some(
        (combination) =>
          combination.ko === '정임합목' &&
          combination.participants.some((p) => p.hidden === null && p.stem === '丁'),
      ),
    ).toBe(true);
  });

  /**
   * 한 몸인 자리는 만난 것이 아니다. 년간 甲과 년지 寅 속 己까지 세면 거의 모든
   * 명식이 암합 몇 개씩을 달게 된다.
   */
  it('같은 기둥 안의 천간과 제 지지는 세지 않는다', () => {
    const found = hiddenCombinationsOf(chart('甲寅', '丙寅', '戊辰', '壬戌'));

    for (const combination of found) {
      const [a, b] = combination.participants;
      expect(a.position).not.toBe(b.position);
    }
    expect(HIDDEN_RELATION_POLICY.withinSamePillar).toBe('excluded');
  });

  /**
   * **관계 표에 섞지 않는다.** 드러난 관계가 숨은 관계에 파묻히면 「이 명식의
   * 관계」라는 말이 뜻을 잃는다.
   */
  it('드러난 천간끼리의 합은 여기서 내지 않는다 — 관계 표의 몫이다', () => {
    const pillars = chart('甲子', '己巳', '丙午', '辛卯');

    const hidden = hiddenCombinationsOf(pillars);
    // 낸 것은 전부 한쪽 이상이 숨어 있다 — 드러난 것끼리는 하나도 없다.
    expect(hidden.length).toBeGreaterThan(0);
    for (const combination of hidden) {
      expect(combination.participants.some((p) => p.hidden !== null)).toBe(true);
    }

    // 甲己합은 관계 표가 낸다.
    expect(findRelations(pillars).some((relation) => relation.ko === '갑기합토')).toBe(true);
    expect(HIDDEN_RELATION_POLICY.mergedIntoRelations).toBe(false);
  });

  it('성립 여부를 판정하지 않는다', () => {
    const found = hiddenCombinationsOf(chart('丁卯', '戊申', '丙子', '己丑'));

    for (const combination of found) {
      expect(combination.status).toBe('facts-only');
      // 「무엇이 되었다」가 아니라 「성사되면 무엇이 되는가」다.
      expect(combination.targetElement).toBeTruthy();
    }
    expect(HIDDEN_RELATION_POLICY.status).toBe('facts-only');
  });
});

describe('암합의 개수', () => {
  /**
   * 관계 표에 섞지 않는 이유가 이 숫자다. 손으로 적어 두면 낡으므로 센다.
   */
  it('정책에 적힌 건수 범위를 골든 명식으로 다시 센다', () => {
    const counts = GOLDEN_CASES.map(
      (golden) => computeSaju(golden.input, golden.options).analysis.hiddenCombinations.length,
    );

    const [low, high] = HIDDEN_RELATION_POLICY.observedPerChart.split('-').map(Number);
    expect(Math.min(...counts)).toBe(low);
    expect(Math.max(...counts)).toBe(high);
  });
});
