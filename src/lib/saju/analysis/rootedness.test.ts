import { describe, expect, it } from 'vitest';

import { HIDDEN_STEMS, STEM_INFO, pillarOf, type Branch, type Stem } from '@/src/lib/saju/constants';
import { ROOTEDNESS_POLICY, rootednessOf } from '@/src/lib/saju/analysis/rootedness';

function chart(year: string, month: string, day: string, hour: string | null) {
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
}

describe('통근 — 천간이 지지 속에 두는 뿌리', () => {
  /**
   * 甲은 寅의 정기 甲에 통근한다. 같은 글자이므로 `same-stem` 이고, 그 자리와
   * 사령 일수가 그대로 나와야 판정을 쓰는 쪽에서 무게를 정할 수 있다.
   */
  it('같은 글자에 둔 뿌리는 자리·역할·일수까지 낸다', () => {
    const { dayMaster } = rootednessOf(chart('丙子', '庚寅', '甲午', '丙寅'));
    const inMonth = dayMaster.roots.find((root) => root.position === 'month');

    expect(dayMaster.stem).toBe('甲');
    expect(dayMaster.rooted).toBe(true);
    expect(inMonth).toMatchObject({
      branch: '寅',
      stem: '甲',
      role: '正氣',
      kind: 'same-stem',
    });
    expect(inMonth?.days).toBe(HIDDEN_STEMS['寅'].find((h) => h.stem === '甲')?.days);
  });

  /**
   * 甲이 卯(乙)에 두는 뿌리를 인정할지가 계통 갈림이다. 여기서는 거르지 않고
   * `same-element` 로 표시만 한다 — 걸러 버리면 좁게 읽는 쪽이 되살릴 수 없다.
   */
  it('음양이 다른 뿌리는 버리지 않고 same-element 로 구분한다', () => {
    // 卯의 지장간은 甲(여기)·乙(정기)이라 甲 일간은 卯 한 자리에서 뿌리를 둘 얻는다.
    const { dayMaster } = rootednessOf(chart('丙子', '辛卯', '甲午', '丙寅'));
    const inMonth = dayMaster.roots.filter((root) => root.position === 'month');

    expect(inMonth.map((root) => [root.stem, root.kind])).toEqual([
      ['甲', 'same-stem'],
      ['乙', 'same-element'],
    ]);
    // 음양이 다른 뿌리를 안 치는 계통은 kind 로 거르면 된다 — 값이 사라지지 않는다.
    expect(dayMaster.roots.filter((root) => root.kind === 'same-element')).toHaveLength(1);
  });

  it('뿌리가 하나도 없으면 rooted 가 false 이고 일수 합이 0 이다', () => {
    // 甲 일간에 木이 든 지지가 하나도 없다 — 申酉는 金, 丑은 土·金·水다.
    const { dayMaster } = rootednessOf(chart('庚申', '乙酉', '甲申', '丁丑'));

    expect(dayMaster.roots).toEqual([]);
    expect(dayMaster.rooted).toBe(false);
    expect(dayMaster.totalDays).toBe(0);
  });

  /**
   * 고지(辰戌丑未)의 중기를 뿌리로 칠지, 충해야 열린다고 볼지가 갈린다.
   * 여기서는 같은 규칙으로 내고 role·days 를 남겨 판정을 미룬다.
   */
  it('고지의 중기도 같은 규칙으로 내고 묘고 판정은 하지 않는다', () => {
    // 辰의 중기는 癸 — 壬 일간이 여기에 뿌리를 둔다.
    const { dayMaster } = rootednessOf(chart('丙子', '庚寅', '壬辰', '丙午'));
    const inDay = dayMaster.roots.find((root) => root.branch === '辰');

    expect(inDay).toMatchObject({ stem: '癸', role: '中氣', kind: 'same-element' });
    expect(ROOTEDNESS_POLICY.storageBranch).toBe('no-special-case');
  });

  it('일수 합은 뿌리들의 사령 일수를 그대로 더한 값이다', () => {
    const { stems } = rootednessOf(chart('丙子', '庚寅', '甲午', '丙寅'));

    for (const rooting of stems) {
      expect(rooting.totalDays).toBe(
        rooting.roots.reduce((sum, root) => sum + root.days, 0),
      );
      expect(rooting.element).toBe(STEM_INFO[rooting.stem].element);
    }
  });

  it('시간 미상이면 시주를 아예 세지 않는다', () => {
    const known = rootednessOf(chart('丙子', '庚寅', '甲午', '丙寅'));
    const unknown = rootednessOf(chart('丙子', '庚寅', '甲午', null));

    expect(known.stems).toHaveLength(4);
    expect(unknown.stems).toHaveLength(3);
    // 시지 寅에 있던 뿌리가 빠졌다 — 없는 자리를 0 으로 채우지 않는다.
    expect(unknown.dayMaster.roots.every((root) => root.position !== 'hour')).toBe(true);
    expect(unknown.dayMaster.totalDays).toBeLessThan(known.dayMaster.totalDays);
  });
});

describe('투출 — 지장간이 천간에 드러난 것', () => {
  it('드러난 글자만 내고 어느 천간에서 드러났는지 짚는다', () => {
    // 월지 寅의 지장간은 戊丙甲. 그중 丙이 년간·시간에, 甲이 일간에 드러났다.
    const { emergences } = rootednessOf(chart('丙子', '庚寅', '甲午', '丙寅'));
    const fromMonth = emergences.filter((emergence) => emergence.position === 'month');

    expect(fromMonth.map((emergence) => emergence.stem).sort()).toEqual(['丙', '甲']);
    expect(fromMonth.find((emergence) => emergence.stem === '丙')?.revealedAt).toEqual([
      'year',
      'hour',
    ]);
    // 드러나지 않은 戊는 목록에 없다.
    expect(fromMonth.some((emergence) => emergence.stem === '戊')).toBe(false);
  });

  it('아무것도 드러나지 않으면 빈 배열이다', () => {
    // 천간이 모두 甲인데 子의 지장간은 壬·癸뿐이라 드러난 글자가 없다.
    expect(rootednessOf(chart('甲子', '甲子', '甲子', '甲子')).emergences).toEqual([]);
  });
});

describe('정책', () => {
  it('채택한 규칙 묶음을 결과 곁에 남긴다', () => {
    expect(ROOTEDNESS_POLICY).toEqual({
      ruleSet: 'rooting-facts-v1',
      rootKind: 'same-element-marked',
      storageBranch: 'no-special-case',
      combinationEffects: 'not-judged',
      quality: 'not-graded',
    });
  });
});
