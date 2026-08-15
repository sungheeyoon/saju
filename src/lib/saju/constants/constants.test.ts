import { describe, expect, it } from 'vitest';
import {
  BRANCHES,
  BRANCHES_BY_MONTH_ORDER,
  BRANCH_CLASHES,
  BRANCH_DESTRUCTIONS,
  BRANCH_DIRECTIONAL_COMBINATIONS,
  BRANCH_HARMS,
  BRANCH_INFO,
  BRANCH_PUNISHMENTS,
  BRANCH_RESENTMENTS,
  BRANCH_SIX_COMBINATIONS,
  BRANCH_TRIPLE_COMBINATIONS,
  CONTROLLED_BY,
  CONTROLS,
  ELEMENTS,
  GENERATED_BY,
  GENERATES,
  HIDDEN_STEMS,
  HIDDEN_STEM_TOTAL_DAYS,
  SEXAGENARY,
  STEMS,
  STEM_CLASHES,
  STEM_COMBINATIONS,
  STEM_INFO,
  branchAt,
  elementRelation,
  findPunishments,
  findTripleCombinations,
  pillarAt,
  pillarIndexOf,
  pillarOf,
  principalStem,
  stemAt,
  type Branch,
  type Element,
} from '@/src/lib/saju/constants';

/** 지지 쌍이 12지지 전체를 정확히 한 번씩 덮는지 확인한다. */
function coversAllBranchesOnce(pairs: ReadonlyArray<{ branches: readonly Branch[] }>) {
  const seen = pairs.flatMap((p) => [...p.branches]);
  expect(seen).toHaveLength(12);
  expect(new Set(seen).size).toBe(12);
}

describe('오행(elements)', () => {
  it('상생·상극 테이블이 서로의 역방향과 일치한다', () => {
    for (const e of ELEMENTS) {
      expect(GENERATED_BY[GENERATES[e]]).toBe(e);
      expect(CONTROLLED_BY[CONTROLS[e]]).toBe(e);
    }
  });

  it('상생은 5개 오행을 한 바퀴 도는 순환이다', () => {
    let current: Element = '木';
    const visited = new Set<Element>();
    for (let i = 0; i < ELEMENTS.length; i += 1) {
      visited.add(current);
      current = GENERATES[current];
    }
    expect(visited.size).toBe(5);
    expect(current).toBe('木');
  });

  it('상극도 5개 오행을 한 바퀴 도는 순환이다', () => {
    let current: Element = '木';
    const visited = new Set<Element>();
    for (let i = 0; i < ELEMENTS.length; i += 1) {
      visited.add(current);
      current = CONTROLS[current];
    }
    expect(visited.size).toBe(5);
    expect(current).toBe('木');
  });

  it('elementRelation 이 25쌍 모두를 하나의 관계로 분류한다', () => {
    const counts: Record<string, number> = {};
    for (const self of ELEMENTS) {
      for (const other of ELEMENTS) {
        const relation = elementRelation(self, other);
        counts[relation] = (counts[relation] ?? 0) + 1;
      }
    }
    // 오행마다 비겁·식상·재성·관성·인성이 정확히 하나씩
    expect(counts).toEqual({
      same: 5,
      generates: 5,
      controls: 5,
      controlledBy: 5,
      generatedBy: 5,
    });
  });
});

describe('천간(stems)', () => {
  it('10개이고 인덱스가 배열 위치와 일치한다', () => {
    expect(STEMS).toHaveLength(10);
    STEMS.forEach((stem, i) => {
      expect(STEM_INFO[stem].index).toBe(i);
      expect(STEM_INFO[stem].char).toBe(stem);
    });
  });

  it('짝수 인덱스가 양간, 홀수 인덱스가 음간이다', () => {
    STEMS.forEach((stem, i) => {
      expect(STEM_INFO[stem].yinYang).toBe(i % 2 === 0 ? '陽' : '陰');
    });
  });

  it('오행마다 양간·음간이 하나씩 있다', () => {
    for (const element of ELEMENTS) {
      const of = STEMS.filter((s) => STEM_INFO[s].element === element);
      expect(of).toHaveLength(2);
      expect(of.map((s) => STEM_INFO[s].yinYang)).toEqual(['陽', '陰']);
    }
  });

  it('stemAt 이 음수와 10 이상을 순환시킨다', () => {
    expect(stemAt(0)).toBe('甲');
    expect(stemAt(10)).toBe('甲');
    expect(stemAt(-1)).toBe('癸');
    expect(stemAt(-11)).toBe('癸');
  });
});

describe('지지(branches)', () => {
  it('12개이고 인덱스가 배열 위치와 일치한다', () => {
    expect(BRANCHES).toHaveLength(12);
    BRANCHES.forEach((branch, i) => {
      expect(BRANCH_INFO[branch].index).toBe(i);
      expect(BRANCH_INFO[branch].char).toBe(branch);
    });
  });

  it('오행 분포가 목2 화2 금2 수2 토4 이다', () => {
    const counts = BRANCHES.reduce<Record<string, number>>((acc, b) => {
      const e = BRANCH_INFO[b].element;
      acc[e] = (acc[e] ?? 0) + 1;
      return acc;
    }, {});
    expect(counts).toEqual({ 木: 2, 火: 2, 金: 2, 水: 2, 土: 4 });
  });

  it('계절마다 지지가 3개씩 배속된다', () => {
    const counts = BRANCHES.reduce<Record<string, number>>((acc, b) => {
      const s = BRANCH_INFO[b].season;
      acc[s] = (acc[s] ?? 0) + 1;
      return acc;
    }, {});
    expect(counts).toEqual({ 春: 3, 夏: 3, 秋: 3, 冬: 3 });
  });

  it('monthOrder 가 1~12의 순열이고 寅이 1월이다', () => {
    const orders = BRANCHES.map((b) => BRANCH_INFO[b].monthOrder).sort((a, b) => a - b);
    expect(orders).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12]);
    expect(BRANCH_INFO['寅'].monthOrder).toBe(1);
    expect(BRANCH_INFO['丑'].monthOrder).toBe(12);
  });

  it('BRANCHES_BY_MONTH_ORDER 가 monthOrder 와 일치한다', () => {
    BRANCHES_BY_MONTH_ORDER.forEach((branch, i) => {
      expect(BRANCH_INFO[branch].monthOrder).toBe(i + 1);
    });
  });

  it('branchAt 이 음수와 12 이상을 순환시킨다', () => {
    expect(branchAt(0)).toBe('子');
    expect(branchAt(12)).toBe('子');
    expect(branchAt(-1)).toBe('亥');
  });
});

describe('지장간(hiddenStems)', () => {
  it('지지마다 일수 합계가 30이다', () => {
    for (const branch of BRANCHES) {
      const total = HIDDEN_STEMS[branch].reduce((sum, h) => sum + h.days, 0);
      expect(total, `${branch}의 지장간 일수`).toBe(HIDDEN_STEM_TOTAL_DAYS);
    }
  });

  it('지지마다 정기가 정확히 하나이고 여기→중기→정기 순서다', () => {
    for (const branch of BRANCHES) {
      const roles = HIDDEN_STEMS[branch].map((h) => h.role);
      expect(roles.filter((r) => r === '正氣'), `${branch}의 정기`).toHaveLength(1);
      expect(roles.filter((r) => r === '餘氣')).toHaveLength(1);
      expect(roles[0]).toBe('餘氣');
      expect(roles[roles.length - 1]).toBe('正氣');
    }
  });

  it('정기의 오행이 그 지지의 오행과 같다', () => {
    for (const branch of BRANCHES) {
      const stem = principalStem(branch);
      expect(STEM_INFO[stem].element, `${branch}의 정기 ${stem}`).toBe(
        BRANCH_INFO[branch].element,
      );
    }
  });

  it('생지·묘지의 중기가 그 지지가 속한 삼합국의 오행과 같다', () => {
    // 午(왕지)만 예외로 己土를 중기로 갖는다. 나머지 왕지 子卯酉는 중기가 없다.
    for (const combination of BRANCH_TRIPLE_COMBINATIONS) {
      for (const branch of combination.branches) {
        if (branch === combination.peak) continue;

        const middle = HIDDEN_STEMS[branch].find((h) => h.role === '中氣');
        expect(middle, `${branch}의 중기`).toBeDefined();
        expect(STEM_INFO[middle!.stem].element, `${branch}의 중기`).toBe(combination.result);
      }
    }
  });

  it('왕지 중 子卯酉는 중기가 없고 午만 己土를 갖는다', () => {
    for (const branch of ['子', '卯', '酉'] as const) {
      expect(HIDDEN_STEMS[branch].some((h) => h.role === '中氣')).toBe(false);
    }
    const middle = HIDDEN_STEMS['午'].find((h) => h.role === '中氣');
    expect(middle?.stem).toBe('己');
  });
});

describe('60갑자(sexagenary)', () => {
  it('60개이고 중복이 없다', () => {
    expect(SEXAGENARY).toHaveLength(60);
    expect(new Set(SEXAGENARY.map((p) => p.name)).size).toBe(60);
  });

  it('갑자로 시작해 계해로 끝난다', () => {
    expect(SEXAGENARY[0].name).toBe('甲子');
    expect(SEXAGENARY[0].ko).toBe('갑자');
    expect(SEXAGENARY[59].name).toBe('癸亥');
    expect(SEXAGENARY[59].ko).toBe('계해');
  });

  it('천간·지지가 각각 10·12 주기로 돈다', () => {
    SEXAGENARY.forEach((pillar, i) => {
      expect(pillar.stem).toBe(stemAt(i));
      expect(pillar.branch).toBe(branchAt(i));
    });
  });

  it('pillarIndexOf 가 60개 전부를 왕복 변환한다', () => {
    for (const pillar of SEXAGENARY) {
      expect(pillarIndexOf(pillar.stem, pillar.branch)).toBe(pillar.index);
    }
  });

  it('홀짝이 어긋난 조합은 성립하지 않는다', () => {
    // 甲(양간)과 丑(음지) — 60갑자에 없는 조합
    expect(pillarIndexOf('甲', '丑')).toBeNull();
    expect(pillarOf('甲', '丑')).toBeNull();

    let valid = 0;
    for (const stem of STEMS) {
      for (const branch of BRANCHES) {
        if (pillarIndexOf(stem, branch) !== null) valid += 1;
      }
    }
    expect(valid).toBe(60);
  });

  it('pillarAt 이 음수와 60 이상을 순환시킨다', () => {
    expect(pillarAt(60).name).toBe('甲子');
    expect(pillarAt(-1).name).toBe('癸亥');
  });
});

describe('관계(relations) — 천간', () => {
  it('천간합은 5개이고 인덱스가 5 떨어진 짝이다', () => {
    expect(STEM_COMBINATIONS).toHaveLength(5);
    for (const { stems } of STEM_COMBINATIONS) {
      const [a, b] = stems;
      expect(Math.abs(STEM_INFO[a].index - STEM_INFO[b].index)).toBe(5);
    }
  });

  it('천간합은 10천간 전부를 한 번씩 쓴다', () => {
    const used = STEM_COMBINATIONS.flatMap((c) => [...c.stems]);
    expect(new Set(used).size).toBe(10);
  });

  it('천간충은 인덱스가 6 떨어지고 음양이 같으며 서로 극한다', () => {
    expect(STEM_CLASHES).toHaveLength(4);
    for (const { stems } of STEM_CLASHES) {
      const [a, b] = stems;
      expect(Math.abs(STEM_INFO[a].index - STEM_INFO[b].index)).toBe(6);
      expect(STEM_INFO[a].yinYang).toBe(STEM_INFO[b].yinYang);

      const ea = STEM_INFO[a].element;
      const eb = STEM_INFO[b].element;
      expect(CONTROLS[ea] === eb || CONTROLS[eb] === ea).toBe(true);
    }
  });
});

describe('관계(relations) — 지지', () => {
  it('육합은 6개이고 인덱스 합이 1 또는 13이다', () => {
    expect(BRANCH_SIX_COMBINATIONS).toHaveLength(6);
    for (const { branches } of BRANCH_SIX_COMBINATIONS) {
      const sum = BRANCH_INFO[branches[0]].index + BRANCH_INFO[branches[1]].index;
      expect([1, 13]).toContain(sum);
    }
    coversAllBranchesOnce(BRANCH_SIX_COMBINATIONS);
  });

  it('충은 6개이고 인덱스가 정확히 6 떨어진다', () => {
    expect(BRANCH_CLASHES).toHaveLength(6);
    for (const { branches } of BRANCH_CLASHES) {
      const diff = Math.abs(BRANCH_INFO[branches[0]].index - BRANCH_INFO[branches[1]].index);
      expect(diff).toBe(6);
    }
    coversAllBranchesOnce(BRANCH_CLASHES);
  });

  it('삼합 4국이 12지지를 한 번씩 쓰고 왕지 오행이 국의 오행과 같다', () => {
    expect(BRANCH_TRIPLE_COMBINATIONS).toHaveLength(4);
    const used = BRANCH_TRIPLE_COMBINATIONS.flatMap((c) => [...c.branches]);
    expect(new Set(used).size).toBe(12);

    for (const c of BRANCH_TRIPLE_COMBINATIONS) {
      expect(c.branches).toContain(c.peak);
      expect(BRANCH_INFO[c.peak].element, c.ko).toBe(c.result);
      // 삼합은 인덱스가 4씩 떨어진 세 지지
      const indices = c.branches.map((b) => BRANCH_INFO[b].index).sort((x, y) => x - y);
      expect(indices[1] - indices[0]).toBe(4);
      expect(indices[2] - indices[1]).toBe(4);
    }
  });

  it('방합 4개가 각 계절의 연속된 세 지지다', () => {
    expect(BRANCH_DIRECTIONAL_COMBINATIONS).toHaveLength(4);
    const used = BRANCH_DIRECTIONAL_COMBINATIONS.flatMap((c) => [...c.branches]);
    expect(new Set(used).size).toBe(12);

    for (const c of BRANCH_DIRECTIONAL_COMBINATIONS) {
      for (const b of c.branches) {
        expect(BRANCH_INFO[b].season, `${c.ko}의 ${b}`).toBe(c.season);
      }
    }
  });

  it('해·파·원진이 각각 6쌍이고 12지지를 한 번씩 덮는다', () => {
    for (const pairs of [BRANCH_HARMS, BRANCH_DESTRUCTIONS, BRANCH_RESENTMENTS]) {
      expect(pairs).toHaveLength(6);
      coversAllBranchesOnce(pairs);
    }
  });

  it('형은 삼형 2조 · 상형 1조 · 자형 4개다', () => {
    const byKind = BRANCH_PUNISHMENTS.reduce<Record<string, number>>((acc, p) => {
      acc[p.kind] = (acc[p.kind] ?? 0) + 1;
      return acc;
    }, {});
    expect(byKind).toEqual({ triple: 2, mutual: 1, self: 4 });
  });
});

describe('관계 조회 헬퍼', () => {
  it('삼합은 완전 성립만, partial 옵션에서만 반합을 찾는다', () => {
    const full = findTripleCombinations(['申', '子', '辰', '寅']);
    expect(full).toHaveLength(1);
    expect(full[0].combination.result).toBe('水');
    expect(full[0].full).toBe(true);

    // 왕지 子를 포함한 두 지지 → 반합
    expect(findTripleCombinations(['申', '子'])).toHaveLength(0);
    const half = findTripleCombinations(['申', '子'], { partial: true });
    expect(half).toHaveLength(1);
    expect(half[0].full).toBe(false);

    // 왕지가 빠진 두 지지는 반합이 아니다
    expect(findTripleCombinations(['申', '辰'], { partial: true })).toHaveLength(0);
  });

  it('자형은 같은 지지가 둘 이상일 때만 성립한다', () => {
    expect(findPunishments(['辰'])).toHaveLength(0);
    expect(findPunishments(['辰', '辰'])).toHaveLength(1);
    expect(findPunishments(['寅', '巳', '申'])).toHaveLength(1);
  });
});
