import { describe, expect, it } from 'vitest';

import { computeSaju } from '@/src/lib/saju';
import {
  BRANCH_CLASHES,
  BRANCH_DESTRUCTIONS,
  BRANCH_DIRECTIONAL_COMBINATIONS,
  BRANCH_HARMS,
  BRANCH_INFO,
  BRANCH_PUNISHMENTS,
  BRANCH_RESENTMENTS,
  BRANCH_SIX_COMBINATIONS,
  BRANCH_TRIPLE_COMBINATIONS,
  STEM_CLASHES,
  STEM_COMBINATIONS,
  STEM_INFO,
  pillarOf,
  type Branch,
  type RelationKind,
  type Stem,
} from '@/src/lib/saju/constants';
import { PILLAR_POSITIONS } from '@/src/lib/saju/position';
import {
  RELATION_KIND_KO,
  RELATION_POLICY,
  findRelations,
  formatRelation,
  type Relation,
  type RelationInput,
} from '@/src/lib/saju/relations';

/**
 * 원국 관계 연산 테스트.
 *
 * 이 연산이 틀리는 방식은 세 가지다 — 있는 관계를 못 찾거나, 없는 관계를
 * 만들어내거나, 찾긴 했는데 자리를 잘못 붙이거나. 표 전수 검사로 첫째를,
 * 정확 일치 검사로 둘째를, 자리·거리 검사로 셋째를 막는다.
 */

/** '甲子' 같은 표기 넷으로 원국을 세운다. 시주는 null 이면 시간 미상이다. */
function chart(year: string, month: string, day: string, hour: string | null): RelationInput {
  const parse = (name: string) => {
    const pillar = pillarOf(name[0] as Stem, name[1] as Branch);
    if (!pillar) throw new Error(`간지가 아니다: ${name}`);
    return pillar;
  };

  return {
    year: parse(year),
    month: parse(month),
    day: parse(day),
    hour: hour === null ? null : parse(hour),
  };
}

const kosOf = (relations: readonly Relation[]): string[] => relations.map((r) => r.ko);

/** 관계 하나를 '이름 (년주·월주)' 로 눌러 담아 통째로 비교한다 */
const linesOf = (relations: readonly Relation[]): string[] => relations.map(formatRelation);

/**
 * 실재하는 60갑자만 세운다 — 간지는 음양이 같은 것끼리만 짝지어진다.
 *
 * 戊寅·己丑 처럼 붙일 수 없는 조합으로 시험하면 실제로는 나올 수 없는 원국을
 * 검사하는 셈이라, 채움 글자도 음양을 맞춰 고른다.
 */
const neutralStem = (branch: Branch): Stem =>
  BRANCH_INFO[branch].yinYang === '陽' ? '戊' : '己';

/** 그 지지에 붙일 수 있는, 아무 천간 관계도 만들지 않는 간지 — 戊·己는 서로 무관하다 */
const neutral = (branch: Branch): string => `${neutralStem(branch)}${branch}`;

/** 지지만 놓고 보는 원국 — 천간에는 관계가 하나도 서지 않는다 */
const branchChart = (
  year: Branch,
  month: Branch,
  day: Branch,
  hour: Branch | null,
): RelationInput =>
  chart(neutral(year), neutral(month), neutral(day), hour === null ? null : neutral(hour));

/** 천간만 놓고 보는 원국 — 寅·丑은 서로도 자기들끼리도 관계가 없다 */
const stemChart = (a: Stem, b: Stem): RelationInput => {
  const withBranch = (stem: Stem): string =>
    `${stem}${STEM_INFO[stem].yinYang === '陽' ? '寅' : '丑'}`;

  return chart(withBranch(a), withBranch(b), withBranch('戊'), withBranch('己'));
};

describe('표 전수 검사 — 상수 표의 모든 항목이 검출된다', () => {
  it.each(STEM_COMBINATIONS)('천간합 $ko', ({ stems, ko, result }) => {
    const relations = findRelations(stemChart(stems[0], stems[1]));
    const found = relations.find((r) => r.ko === ko);

    expect(found).toBeDefined();
    expect(found?.kind).toBe('stemCombination');
    expect(found?.tier).toBe('stem');
    expect(found?.targetElement).toBe(result);
  });

  it.each(STEM_CLASHES)('천간충 $ko', ({ stems, ko }) => {
    const relations = findRelations(stemChart(stems[0], stems[1]));
    const found = relations.find((r) => r.ko === ko);

    expect(found).toBeDefined();
    expect(found?.kind).toBe('stemClash');
    expect(found?.targetElement).toBeNull();
  });

  it.each(BRANCH_SIX_COMBINATIONS)('지지육합 $ko', ({ branches, ko, result }) => {
    const relations = findRelations(branchChart(branches[0], branches[1], '子', '子'));
    const found = relations.find((r) => r.ko === ko);

    expect(found).toBeDefined();
    expect(found?.kind).toBe('branchSixCombination');
    expect(found?.targetElement).toBe(result);
  });

  it.each(BRANCH_CLASHES)('지지충 $ko', ({ branches, ko }) => {
    const relations = findRelations(branchChart(branches[0], branches[1], '子', '子'));
    expect(kosOf(relations)).toContain(ko);
  });

  it.each(BRANCH_HARMS)('해 $ko', ({ branches, ko }) => {
    const relations = findRelations(branchChart(branches[0], branches[1], '子', '子'));
    expect(kosOf(relations)).toContain(ko);
  });

  it.each(BRANCH_DESTRUCTIONS)('파 $ko', ({ branches, ko }) => {
    const relations = findRelations(branchChart(branches[0], branches[1], '子', '子'));
    expect(kosOf(relations)).toContain(ko);
  });

  it.each(BRANCH_RESENTMENTS)('원진 $ko', ({ branches, ko }) => {
    const relations = findRelations(branchChart(branches[0], branches[1], '子', '子'));
    expect(kosOf(relations)).toContain(ko);
  });

  it.each(BRANCH_TRIPLE_COMBINATIONS)('삼합 $ko', ({ branches, ko, result }) => {
    const relations = findRelations(branchChart(branches[0], branches[1], branches[2], '子'));
    const found = relations.find((r) => r.ko === ko);

    expect(found).toBeDefined();
    expect(found?.kind).toBe('branchTripleCombination');
    expect(found?.full).toBe(true);
    expect(found?.targetElement).toBe(result);
  });

  it.each(BRANCH_DIRECTIONAL_COMBINATIONS)('방합 $ko', ({ branches, ko, result }) => {
    const relations = findRelations(branchChart(branches[0], branches[1], branches[2], '子'));
    const found = relations.find((r) => r.ko === ko);

    expect(found).toBeDefined();
    expect(found?.kind).toBe('branchDirectionalCombination');
    expect(found?.full).toBe(true);
    expect(found?.targetElement).toBe(result);
  });

  it.each(BRANCH_PUNISHMENTS)('형 $ko', (punishment) => {
    const [year, month, day]: [Branch, Branch, Branch] =
      punishment.kind === 'triple'
        ? [punishment.branches[0], punishment.branches[1], punishment.branches[2]]
        : punishment.kind === 'mutual'
          ? [punishment.branches[0], punishment.branches[1], '子']
          : [punishment.branch, punishment.branch, '子'];

    const found = findRelations(branchChart(year, month, day, '子')).find(
      (r) => r.ko === punishment.ko,
    );

    expect(found).toBeDefined();
    expect(found?.kind).toBe('branchPunishment');
    expect(found?.name).toBe(punishment.name);
    expect(found?.full).toBe(true);
  });
});

describe('정확 일치 — 없는 관계를 만들어내지 않는다', () => {
  /**
   * 년 甲子 · 월 己丑 · 일 甲午 · 시 庚午.
   *
   * 손으로 세어 열셋이다. 하나라도 늘거나 줄면 구현이 표를 벗어난 것이다.
   */
  it('열세 개를 순서까지 그대로 낸다', () => {
    const relations = findRelations(chart('甲子', '己丑', '甲午', '庚午'));

    expect(linesOf(relations)).toEqual([
      '갑기합토 (년주·월주)',
      '갑기합토 (월주·일주)',
      '자축합토 (년주·월주)',
      '자축 반방합 (년주·월주)',
      '갑경충 (년주·시주)',
      '갑경충 (일주·시주)',
      '자오충 (년주·일주)',
      '자오충 (년주·시주)',
      '오오형 (일주·시주)',
      '축오해 (월주·일주)',
      '축오해 (월주·시주)',
      '축오원진 (월주·일주)',
      '축오원진 (월주·시주)',
    ]);
  });

  it('아무 관계도 없는 원국은 빈 배열이다', () => {
    expect(findRelations(chart('甲子', '甲子', '甲子', '甲子'))).toEqual([]);
  });
});

describe('자리와 거리', () => {
  it('참여 글자를 년 → 시 순서로 담는다', () => {
    // 午가 일지, 子가 시지 — 표는 子午 순이지만 자리는 일주가 먼저다.
    const [clash] = findRelations(branchChart('寅', '寅', '午', '子')).filter(
      (r) => r.kind === 'branchClash',
    );

    expect(clash.participants).toEqual([
      { position: 'day', char: '午' },
      { position: 'hour', char: '子' },
    ]);
    // 이름은 자리가 아니라 표의 순서를 따른다.
    expect(clash.ko).toBe('자오충');
  });

  it('거리는 기둥 사이의 칸 수다', () => {
    const relations = findRelations(branchChart('子', '寅', '寅', '午'));
    const clash = relations.find((r) => r.ko === '자오충');

    expect(clash?.distance).toBe(3);
    expect(clash?.adjacent).toBe(false);
  });

  it('붙어 있으면 adjacent 다', () => {
    const relations = findRelations(branchChart('寅', '子', '午', '寅'));
    const clash = relations.find((r) => r.ko === '자오충');

    expect(clash?.distance).toBe(1);
    expect(clash?.adjacent).toBe(true);
  });

  it('세 글자 관계는 세 자리가 연달아야 붙은 것이다', () => {
    const straight = findRelations(branchChart('申', '子', '辰', '寅'));
    const gapped = findRelations(branchChart('申', '子', '寅', '辰'));

    expect(straight.find((r) => r.ko === '신자진 수국')).toMatchObject({
      distance: 2,
      adjacent: true,
    });
    expect(gapped.find((r) => r.ko === '신자진 수국')).toMatchObject({
      distance: 3,
      adjacent: false,
    });
  });
});

describe('반쪽만 모인 것 — full: false', () => {
  it('삼합 반합은 왕지를 껴야 성립한다', () => {
    const withPeak = findRelations(branchChart('子', '辰', '寅', null));
    const withoutPeak = findRelations(branchChart('申', '辰', '寅', null));

    expect(withPeak.find((r) => r.ko === '자진 반합')).toMatchObject({
      kind: 'branchTripleCombination',
      full: false,
      targetElement: '水',
    });
    expect(
      withoutPeak.filter((r) => r.kind === 'branchTripleCombination'),
    ).toEqual([]);
  });

  it('방합도 계절 한가운데 글자를 요구한다', () => {
    const withPeak = findRelations(branchChart('卯', '辰', '子', null));
    const withoutPeak = findRelations(branchChart('寅', '辰', '子', null));

    expect(withPeak.find((r) => r.kind === 'branchDirectionalCombination')).toMatchObject({
      ko: '묘진 반방합',
      full: false,
      targetElement: '木',
    });
    expect(
      withoutPeak.filter((r) => r.kind === 'branchDirectionalCombination'),
    ).toEqual([]);
  });

  it('두 글자만 모인 삼형도 낸다 — 어느 삼형 조각인지 이름으로 남긴다', () => {
    const found = findRelations(branchChart('寅', '巳', '子', null)).find(
      (r) => r.kind === 'branchPunishment',
    );

    expect(found).toMatchObject({ ko: '인사형', name: '무은지형', full: false });
  });

  it('세 글자가 다 모이면 그 안의 반쪽은 따로 세지 않는다', () => {
    const relations = findRelations(branchChart('申', '子', '辰', null)).filter(
      (r) => r.kind === 'branchTripleCombination',
    );

    expect(relations).toHaveLength(1);
    expect(relations[0].full).toBe(true);
  });

  it('자리가 다르면 다른 반합이다', () => {
    // 시지의 子 는 년지 申 과 따로 반합한다 — 월지 子 와 겹치는 사실이 아니다.
    const halves = findRelations(branchChart('申', '子', '午', '子')).filter(
      (r) => r.kind === 'branchTripleCombination',
    );

    expect(halves).toHaveLength(2);
    expect(halves.every((r) => !r.full && r.ko === '신자 반합')).toBe(true);
    expect(halves.map((r) => r.participants[1].position)).toEqual(['month', 'hour']);
  });
});

describe('형의 방향 — 삼형은 순환한다', () => {
  const punishmentOf = (a: Branch, b: Branch) =>
    findRelations(branchChart(a, b, '子', null)).find((r) => r.kind === 'branchPunishment');

  /** 寅刑巳, 巳刑申, 申刑寅 — 마지막 짝만 표 순서와 반대다 */
  it.each([
    ['寅', '巳', '인사형', '寅', '巳'],
    ['巳', '申', '사신형', '巳', '申'],
    ['寅', '申', '신인형', '申', '寅'],
  ] as const)('%s %s → %s', (a, b, ko, from, to) => {
    const found = punishmentOf(a, b);

    expect(found?.ko).toBe(ko);
    expect(found?.direction?.from.char).toBe(from);
    expect(found?.direction?.to.char).toBe(to);
  });

  /** 丑刑戌, 戌刑未, 未刑丑 */
  it.each([
    ['丑', '戌', '축술형', '丑', '戌'],
    ['戌', '未', '술미형', '戌', '未'],
    ['丑', '未', '미축형', '未', '丑'],
  ] as const)('%s %s → %s', (a, b, ko, from, to) => {
    const found = punishmentOf(a, b);

    expect(found?.ko).toBe(ko);
    expect(found?.direction?.from.char).toBe(from);
    expect(found?.direction?.to.char).toBe(to);
  });

  it('방향은 자리도 함께 가리킨다', () => {
    // 시지 申이 년지 寅을 형한다 — 자리가 뒤바뀌면 뜻이 달라진다.
    const found = findRelations(branchChart('寅', '子', '子', '申')).find(
      (r) => r.kind === 'branchPunishment',
    );

    expect(found?.direction).toEqual({
      from: { position: 'hour', char: '申' },
      to: { position: 'year', char: '寅' },
    });
  });

  it('세 글자가 다 모인 삼형은 순환이라 방향이 없다', () => {
    const found = findRelations(branchChart('寅', '巳', '申', null)).find(
      (r) => r.kind === 'branchPunishment',
    );

    expect(found?.full).toBe(true);
    expect(found?.direction).toBeNull();
  });

  it('상형과 자형에는 방향이 없다', () => {
    const mutual = findRelations(branchChart('子', '卯', '寅', null)).find(
      (r) => r.ko === '자묘형',
    );
    const self = findRelations(branchChart('辰', '辰', '寅', null)).find(
      (r) => r.ko === '진진형',
    );

    expect(mutual?.direction).toBeNull();
    expect(self?.direction).toBeNull();
  });

  it('형이 아닌 관계에는 방향이 없다', () => {
    const relations = findRelations(chart('甲子', '己丑', '甲午', '庚午'));

    expect(
      relations.filter((r) => r.kind !== 'branchPunishment').every((r) => r.direction === null),
    ).toBe(true);
  });
});

describe('자형 — 같은 글자가 둘 이상일 때만', () => {
  it('한 번만 나오면 형이 아니다', () => {
    const relations = findRelations(branchChart('辰', '子', '寅', null));
    expect(relations.filter((r) => r.kind === 'branchPunishment')).toEqual([]);
  });

  it('겹치면 자형이다', () => {
    const relations = findRelations(branchChart('辰', '辰', '子', null));
    expect(relations.filter((r) => r.ko === '진진형')).toHaveLength(1);
  });

  it('자형이 없는 글자는 겹쳐도 형이 아니다', () => {
    // 자형은 辰午酉亥 넷뿐이다. 子子는 아무것도 아니다.
    const relations = findRelations(branchChart('子', '子', '寅', null));
    expect(relations.filter((r) => r.kind === 'branchPunishment')).toEqual([]);
  });
});

describe('쟁합·투합', () => {
  it('한 글자를 둘이 물면 양쪽에 표시한다', () => {
    const combinations = findRelations(chart('甲寅', '己丑', '甲寅', '戊寅')).filter(
      (r) => r.kind === 'stemCombination',
    );

    expect(combinations).toHaveLength(2);
    expect(combinations[0].contested).toEqual([
      { over: { position: 'month', char: '己' }, rivals: [{ position: 'day', char: '甲' }] },
    ]);
    expect(combinations[1].contested).toEqual([
      { over: { position: 'month', char: '己' }, rivals: [{ position: 'year', char: '甲' }] },
    ]);
  });

  it('지지육합도 같은 기준으로 본다', () => {
    const combinations = findRelations(branchChart('子', '丑', '子', '寅')).filter(
      (r) => r.kind === 'branchSixCombination',
    );

    expect(combinations).toHaveLength(2);
    expect(combinations.every((r) => r.contested.length === 1)).toBe(true);
  });

  it('다툼이 없으면 빈 배열이다', () => {
    const [combination] = findRelations(chart('甲寅', '己丑', '戊寅', '戊寅')).filter(
      (r) => r.kind === 'stemCombination',
    );

    expect(combination.contested).toEqual([]);
  });

  it('합이 아닌 관계에는 쟁합을 붙이지 않는다', () => {
    // 甲庚충이 셋이지만 충은 다툼의 대상이 아니다.
    const clashes = findRelations(chart('甲寅', '庚寅', '甲寅', '戊寅')).filter(
      (r) => r.kind === 'stemClash',
    );

    expect(clashes.length).toBeGreaterThan(1);
    expect(clashes.every((r) => r.contested.length === 0)).toBe(true);
  });
});

describe('시간 미상', () => {
  it('시주가 없으면 시주가 걸린 관계도 없다', () => {
    const known = findRelations(branchChart('子', '寅', '寅', '午'));
    const unknown = findRelations(branchChart('子', '寅', '寅', null));

    expect(kosOf(known)).toContain('자오충');
    expect(unknown.every((r) => r.participants.every((p) => p.position !== 'hour'))).toBe(true);
    expect(kosOf(unknown)).not.toContain('자오충');
  });
});

describe('출력 계약', () => {
  it('순서는 결정적이다', () => {
    const input = chart('甲子', '己丑', '甲午', '庚午');
    expect(linesOf(findRelations(input))).toEqual(linesOf(findRelations(input)));
  });

  it('합이 먼저, 그다음 충·형·해·파·원진 순이다', () => {
    const kinds = findRelations(chart('甲子', '己丑', '甲午', '庚午')).map((r) => r.kind);
    const firstIndex = (kind: RelationKind) => kinds.indexOf(kind);

    expect(firstIndex('stemCombination')).toBeLessThan(firstIndex('stemClash'));
    expect(firstIndex('branchClash')).toBeLessThan(firstIndex('branchHarm'));
    expect(firstIndex('branchHarm')).toBeLessThan(firstIndex('branchResentment'));
  });

  it('두 글자의 자리를 맞바꿔도 같은 관계다', () => {
    const forward = findRelations(branchChart('子', '午', '寅', null));
    const swapped = findRelations(branchChart('午', '子', '寅', null));

    expect(kosOf(swapped)).toEqual(kosOf(forward));
  });

  it('같은 종류·이름·자리 조합이 두 번 나오지 않는다', () => {
    // 같은 글자가 겹쳐도 자리가 다르면 다른 관계다. 자리까지 같으면 중복이다.
    const relations = findRelations(chart('甲子', '己丑', '甲午', '庚午'));
    const keys = relations.map(
      (r) => `${r.kind}:${r.ko}:${r.participants.map((p) => p.position).join('-')}`,
    );

    expect(new Set(keys).size).toBe(keys.length);
  });

  it('채택한 규칙 묶음을 결과 곁에 남긴다', () => {
    expect(RELATION_POLICY).toEqual({
      ruleSet: 'visible-relations-v1',
      distantRelations: 'detect-all',
      partialStructures: 'peak-required',
      interactionResolution: 'contest-only',
      hiddenStemRelations: 'disabled',
    });
  });

  it('모든 관계 종류에 한글 이름이 있다', () => {
    expect(Object.keys(RELATION_KIND_KO)).toHaveLength(10);
    expect(PILLAR_POSITIONS).toEqual(['year', 'month', 'day', 'hour']);
  });
});

describe('computeSaju 와의 연결', () => {
  it('사주에 관계가 함께 나온다', () => {
    const saju = computeSaju({
      year: 1988,
      month: 7,
      day: 15,
      hour: 14,
      minute: 30,
      second: 0,
      gender: 'male',
    });

    expect(saju.relations).toEqual(findRelations(saju.pillars));
  });

  it('시간 미상이면 시주가 빠진 채로 나온다', () => {
    const saju = computeSaju({
      year: 1988,
      month: 7,
      day: 15,
      hour: null,
      gender: 'female',
    });

    expect(saju.pillars.hour).toBeNull();
    expect(
      saju.relations.every((r) => r.participants.every((p) => p.position !== 'hour')),
    ).toBe(true);
  });
});
