import { describe, expect, it } from 'vitest';

import { bureausOf } from '@/src/lib/saju/analysis/bureau';
import { rootednessOf } from '@/src/lib/saju/analysis/rootedness';
import {
  EFFECTIVE_ROOT_FLOOR,
  ROOT_QUALITY_POLICY,
  rootQualityOf,
} from '@/src/lib/saju/analysis/rootQuality';
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

const grade = (year: string, month: string, day: string, hour: string | null) => {
  const pillars = chart(year, month, day, hour);
  return rootQualityOf(rootednessOf(pillars), pillars, bureausOf(pillars)).dayMaster;
};

describe('뿌리의 질', () => {
  /**
   * 사실 층은 「지장간에 같은 오행이 있는가」를 세고 여기서는 「그래서 쓸 것이
   * 남았는가」를 잰다. 두 층을 한 파일에 두지 않은 것은 `rootedness.ts` 가
   * 「질은 매기지 않는다」를 정책으로 못박고 있기 때문이다.
   */
  it('같은 뿌리 하나라도 걸린 자리에 따라 무게가 다르다', () => {
    // 甲이 卯의 정기 乙(왕지)에 걸린 것과 未의 중기 乙(고지)에 걸린 것.
    const peak = grade('乙卯', '戊寅', '甲申', '丙寅');
    const storage = grade('乙未', '戊寅', '甲申', '丙寅');

    expect(peak.strength).toBeGreaterThan(storage.strength);
    expect(peak.roots.some((g) => g.branchClass === 'peak')).toBe(true);
    expect(storage.roots.some((g) => g.branchClass === 'storage')).toBe(true);
  });

  it('월지의 뿌리가 시지의 뿌리보다 무겁다', () => {
    const inMonth = grade('庚申', '丙寅', '甲申', '戊辰');
    const inHour = grade('庚申', '戊子', '甲申', '丙寅');

    const monthRoot = inMonth.roots.find((g) => g.root.position === 'month')!;
    const hourRoot = inHour.roots.find((g) => g.root.position === 'hour')!;
    expect(monthRoot.strength).toBeGreaterThan(hourRoot.strength);
    expect(ROOT_QUALITY_POLICY.position.month).toBeGreaterThan(
      ROOT_QUALITY_POLICY.position.hour,
    );
  });

  /**
   * 《적천수천미》가 「丙火之根已拔」이라 적은 명조. 사실 층은 「寅에 통근함」이라
   * 세고, 판정 층은 그 寅이 申 셋에게 충을 맞은 것을 본다.
   */
  it('충을 맞은 지지의 뿌리는 얕아진다', () => {
    const clashed = grade('戊寅', '庚申', '丙申', '丙申');
    const intact = grade('戊寅', '己未', '丙午', '甲午');

    const of = (found: typeof clashed) => found.roots.find((g) => g.root.branch === '寅')!;
    expect(of(clashed).clashed).toBe(true);
    expect(of(intact).clashed).toBe(false);
    // 같은 자리의 같은 뿌리다. 달라지는 것은 충뿐이다.
    expect(of(clashed).strength).toBeCloseTo(of(intact).strength * ROOT_QUALITY_POLICY.clashed);
  });

  /**
   * 亥卯未가 木局을 이루면 未를 土로 논하지 않는다는 말을 뿌리에도 적용한다.
   * 국이 가져간 몫(`Bureau.pull`)을 그대로 빼므로 배수를 따로 고르지 않는다.
   */
  it('국에 끌려간 지지는 그만큼 제 오행의 뿌리 노릇을 못 한다', () => {
    // 己土의 뿌리는 월지 未의 정기 己 하나인데, 亥卯未가 木局을 이룬다.
    const pulled = grade('乙亥', '辛未', '己卯', '乙亥');
    const root = pulled.roots.find((g) => g.root.branch === '未')!;

    expect(root.defected).toBeGreaterThan(0);
    expect(root.detail).toContain('국에');
  });

  it('남은 것이 바닥 아래면 세어져도 뿌리가 아니다', () => {
    const found = grade('乙未', '辛丑', '甲申', '丙寅');
    const shallow = found.roots.find((g) => g.root.branch === '未')!;

    // 고지의 중기에 같은 오행으로 걸렸는데 축미충까지 맞았다.
    expect(shallow.strength).toBeLessThan(EFFECTIVE_ROOT_FLOOR);
  });

  it('뿌리가 하나도 없으면 0 이고 남은 것도 없다', () => {
    const found = grade('庚申', '己丑', '甲申', '壬申');
    expect(found.roots).toEqual([]);
    expect(found.strength).toBe(0);
    expect(found.effectivelyRootless).toBe(true);
  });
});
