import { describe, expect, it } from 'vitest';

import {
  TRANSFORMATION_POLICY,
  stemTransformationsOf,
} from '@/src/lib/saju/analysis/transformation';
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

describe('합화(合化)', () => {
  /**
   * 관계 열거는 「甲己가 만났다」까지만 말한다. 그것이 옳다 — 化는 조건 판정이라
   * 계통이 갈린다. 여기서는 그 갈림을 문턱이 아니라 등급으로 낸다.
   */
  it('묶인 것과 변한 것을 등급으로 가른다', () => {
    // 乙庚합금 — 년간 庚과 월간 乙이 붙었고, 월지 酉가 金이라 월령이 화신이다.
    const [transformed] = stemTransformationsOf(chart('庚子', '乙酉', '戊戌', '壬戌'));
    expect(transformed.ko).toBe('을경합금');
    expect(transformed.verdict).toBe('transformed');
    expect(transformed.blockers).toEqual([]);
  });

  it('월령이 화신이 아니면 化하지 않고 조건부로 남는다', () => {
    // 丙辛합수 — 월지 申은 水가 아니라 水를 생할 뿐이다. 나머지는 다 채웠다.
    const found = stemTransformationsOf(chart('辛亥', '丙申', '甲子', '庚午'));
    const combination = found.find((t) => t.ko === '병신합수')!;

    expect(combination.facts.monthCommandsTarget).toBe(false);
    expect(combination.blockers).toEqual(['monthDoesNotCommand']);
    expect(combination.verdict).toBe('conditional');
  });

  /**
   * 한 글자를 둘이 물면 어느 쪽도 변하지 못한다. 우리가 어느 쪽이 이겼는지
   * 판정하지 않는 것은 관계 연산이 쟁합의 승패를 가르지 않는 것과 같은 이유다.
   */
  it('쟁합이면 둘 다 化하지 못한다', () => {
    // 丁 하나를 壬 둘이 문다 — 《적천수천미》 假從 편의 명례다.
    const found = stemTransformationsOf(chart('丁丑', '壬寅', '丙申', '壬辰'));

    expect(found).toHaveLength(2);
    for (const combination of found) {
      expect(combination.ko).toBe('정임합목');
      expect(combination.blockers).toContain('contested');
      expect(combination.verdict).toBe('bound');
    }
  });

  it('떨어져 있으면 묶이기만 한다', () => {
    // 년간 甲 과 시간 己 — 두 칸 떨어져 있다.
    const [combination] = stemTransformationsOf(chart('甲戌', '癸酉', '丙辰', '己丑'));

    expect(combination.facts.adjacent).toBe(false);
    expect(combination.blockers).toContain('notAdjacent');
    expect(combination.verdict).toBe('bound');
    expect(TRANSFORMATION_POLICY.adjacencyRequired).toBe(true);
  });

  /**
   * 일간이 낀 합은 사실만 표시하고 판정을 더 얹지 않는다 — 일간이 化하면
   * 오행 자체가 바뀌어 십성이 통째로 다시 배정되는데, 그것은 화격(化格)이고
   * 아직 채택하지 않았다.
   */
  it('일간이 낀 합은 표시하고 통근 여부를 함께 낸다', () => {
    const [combination] = stemTransformationsOf(chart('丙子', '己亥', '甲戌', '乙丑'));

    expect(combination.involvesDayMaster).toBe(true);
    expect(combination.facts.dayMasterRooted).not.toBeNull();
  });

  it('천간합이 없으면 빈 목록이다', () => {
    expect(stemTransformationsOf(chart('庚申', '甲申', '丙申', '戊戌'))).toEqual([]);
  });
});
