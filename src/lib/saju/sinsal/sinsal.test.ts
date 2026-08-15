import { describe, expect, it } from 'vitest';

import { computeSaju } from '@/src/lib/saju';
import {
  BRANCHES,
  SEXAGENARY,
  STEMS,
  pillarOf,
  type Branch,
  type Stem,
} from '@/src/lib/saju/constants';
import {
  BAEKHO_PILLARS,
  CHEONEUL_BRANCHES,
  GOEGANG_PILLARS,
  SINSAL_POLICY,
  TWELVE_SPIRITS,
  analyzeSinsal,
  emptyBranchesOf,
  findEmptiness,
  findStars,
  findTwelveSpirits,
  geumyeoBranchOf,
  hakdangBranchOf,
  lonelinessBranchesOf,
  munchangBranchOf,
  twelveSpiritBranchesOf,
  twelveSpiritOf,
  woldeokStemOf,
  yanginBranchOf,
  type Star,
  type StarKind,
} from '@/src/lib/saju/sinsal';

/**
 * 공망 · 12신살 · 신살 여덟 테스트.
 *
 * 문창·금여·양인은 록지에서 셌으므로 통설 표와의 대조가 본론이다.
 * 공망과 12신살은 유도가 단순한 대신 시작점이 틀리면 열두 자리가 통째로
 * 한 칸씩 밀리므로, 각 국의 전체 배치를 못박는다.
 */

function chart(year: string, month: string, day: string, hour: string | null) {
  const parse = (name: string) => {
    const pillar = pillarOf(name[0] as Stem, name[1] as Branch);
    if (!pillar) throw new Error(`간지가 아니다: ${name}`);
    return pillar;
  };

  const day_ = parse(day);
  return {
    year: parse(year),
    month: parse(month),
    day: day_,
    hour: hour === null ? null : parse(hour),
    dayMaster: day_.stem,
  };
}

const starOf = (stars: readonly Star[], kind: StarKind) => stars.find((s) => s.kind === kind);

// ─────────────────────────────────────────────────────────────
// 공망
// ─────────────────────────────────────────────────────────────

describe('공망 — 여섯 순', () => {
  it.each([
    ['甲子', '戌', '亥'],
    ['甲戌', '申', '酉'],
    ['甲申', '午', '未'],
    ['甲午', '辰', '巳'],
    ['甲辰', '寅', '卯'],
    ['甲寅', '子', '丑'],
  ] as const)('%s 순의 공망은 %s%s', (name, first, second) => {
    const pillar = pillarOf(name[0] as Stem, name[1] as Branch)!;
    expect(emptyBranchesOf(pillar)).toEqual([first, second]);
  });

  it('한 순의 열 간지가 모두 같은 공망을 가리킨다', () => {
    const first = SEXAGENARY.slice(0, 10).map((p) => emptyBranchesOf(p));
    expect(new Set(first.map((b) => b.join(''))).size).toBe(1);
    expect(first[9]).toEqual(['戌', '亥']);
  });

  it('육십갑자 전체가 여섯 벌의 공망으로 나뉜다', () => {
    const all = new Set(SEXAGENARY.map((p) => emptyBranchesOf(p).join('')));
    expect(all.size).toBe(6);
  });

  it('기준이 된 기둥 자신은 공망이 될 수 없다', () => {
    // 같은 순 안에 있으니 짝이 있다 — 구조적으로 나올 수 없다.
    for (const pillar of SEXAGENARY) {
      expect(emptyBranchesOf(pillar)).not.toContain(pillar.branch);
    }
  });

  it('일주 기준과 년주 기준을 모두 낸다', () => {
    // 일주 甲子는 甲子순이라 공망 戌亥, 년주 庚申은 甲寅순이라 공망 子丑.
    // 순이 다르면 같은 사주에서 두 공망이 서로 다른 자리를 가리킨다.
    const found = findEmptiness(chart('庚申', '丁丑', '甲子', '丙寅'));

    expect(found.map((e) => e.basis)).toEqual(['day', 'year']);
    expect(found[0]).toMatchObject({ basisPillar: '甲子', branches: ['戌', '亥'] });
    expect(found[1]).toMatchObject({ basisPillar: '庚申', branches: ['子', '丑'] });

    // 년주 기준으로 보면 일지 子와 월지 丑이 공망이다.
    expect(found[0].positions).toEqual([]);
    expect(found[1].positions).toEqual(['month', 'day']);
  });

  it('걸린 자리를 짚어 준다', () => {
    // 일주 甲子 공망은 戌亥 — 월지 戌이 걸린다.
    const [byDay] = findEmptiness(chart('庚午', '甲戌', '甲子', '丙寅'));
    expect(byDay.positions).toEqual(['month']);
  });

  it('걸린 자리가 없으면 빈 배열이다', () => {
    const [byDay] = findEmptiness(chart('庚午', '丁丑', '甲子', '丙寅'));
    expect(byDay.positions).toEqual([]);
  });
});

// ─────────────────────────────────────────────────────────────
// 12신살
// ─────────────────────────────────────────────────────────────

describe('12신살 — 국마다 열두 자리', () => {
  /** 申子辰 수국 기준의 통설 배치 */
  const WATER_LOCALE: Record<string, Branch> = {
    劫殺: '巳',
    災殺: '午',
    天殺: '未',
    地殺: '申',
    年殺: '酉',
    月殺: '戌',
    亡身殺: '亥',
    將星殺: '子',
    攀鞍殺: '丑',
    驛馬殺: '寅',
    六害殺: '卯',
    華蓋殺: '辰',
  };

  it('申子辰 수국의 열두 자리', () => {
    expect(twelveSpiritBranchesOf('子')).toEqual(WATER_LOCALE);
  });

  it.each(['申', '子', '辰'] as const)('%s 어느 글자를 기준으로 삼아도 같은 국이다', (basis) => {
    expect(twelveSpiritBranchesOf(basis)).toEqual(WATER_LOCALE);
  });

  it.each([
    ['子', '巳'],
    ['卯', '申'],
    ['午', '亥'],
    ['酉', '寅'],
  ] as const)('%s 기준의 겁살은 %s — 묘지의 다음 자리다', (basis, robbery) => {
    expect(twelveSpiritBranchesOf(basis).劫殺).toBe(robbery);
  });

  it('생지가 지살, 왕지가 장성, 묘지가 화개로 떨어진다', () => {
    for (const [basis, birth, peak, grave] of [
      ['子', '申', '子', '辰'],
      ['卯', '亥', '卯', '未'],
      ['午', '寅', '午', '戌'],
      ['酉', '巳', '酉', '丑'],
    ] as const) {
      const map = twelveSpiritBranchesOf(basis);
      expect(map.地殺).toBe(birth);
      expect(map.將星殺).toBe(peak);
      expect(map.華蓋殺).toBe(grave);
    }
  });

  it('역마는 생지의 충이다', () => {
    // 申子辰의 생지 申, 그 충인 寅이 역마다.
    expect(twelveSpiritBranchesOf('子').驛馬殺).toBe('寅');
    expect(twelveSpiritBranchesOf('午').驛馬殺).toBe('申');
  });

  it('열두 이름이 열두 지지를 남김없이 덮는다', () => {
    for (const basis of BRANCHES) {
      const mapped = BRANCHES.map((b) => twelveSpiritOf(basis, b));
      expect(new Set(mapped).size).toBe(12);
    }
    expect(TWELVE_SPIRITS).toHaveLength(12);
  });

  it('년지 기준과 일지 기준을 모두 낸다', () => {
    const charts = findTwelveSpirits(chart('庚午', '丁丑', '甲子', '丙寅'));

    expect(charts.map((c) => c.basis)).toEqual(['year', 'day']);
    expect(charts[0].basisBranch).toBe('午');
    expect(charts[1].basisBranch).toBe('子');
    // 기준이 다르면 같은 지지에 다른 이름이 붙는다.
    expect(charts[0].byPosition.year).not.toBe(charts[1].byPosition.year);
  });

  it('시간 미상이면 시주 자리가 null 이다', () => {
    const [byYear] = findTwelveSpirits(chart('庚午', '丁丑', '甲子', null));
    expect(byYear.byPosition.hour).toBeNull();
    expect(byYear.byPosition.year).toBe('將星殺');
  });
});

// ─────────────────────────────────────────────────────────────
// 신살 여덟 — 통설 표와의 대조
// ─────────────────────────────────────────────────────────────

describe('록지에서 유도한 세 신살이 통설 표와 맞는가', () => {
  const MUNCHANG: Record<Stem, Branch> = {
    甲: '巳', 乙: '午', 丙: '申', 丁: '酉', 戊: '申',
    己: '酉', 庚: '亥', 辛: '子', 壬: '寅', 癸: '卯',
  };
  const GEUMYEO: Record<Stem, Branch> = {
    甲: '辰', 乙: '巳', 丙: '未', 丁: '申', 戊: '未',
    己: '申', 庚: '戌', 辛: '亥', 壬: '丑', 癸: '寅',
  };
  const YANGIN: Partial<Record<Stem, Branch>> = {
    甲: '卯', 丙: '午', 戊: '午', 庚: '酉', 壬: '子',
  };

  it.each(STEMS)('%s 의 문창귀인', (stem) => {
    expect(munchangBranchOf(stem)).toBe(MUNCHANG[stem]);
  });

  it.each(STEMS)('%s 의 금여', (stem) => {
    expect(geumyeoBranchOf(stem)).toBe(GEUMYEO[stem]);
  });

  it.each(Object.keys(YANGIN) as Stem[])('%s 의 양인', (stem) => {
    expect(yanginBranchOf(stem)).toBe(YANGIN[stem]);
  });

  it('천을귀인은 열 천간 모두 두 지지씩이다', () => {
    for (const stem of STEMS) {
      expect(CHEONEUL_BRANCHES[stem]).toHaveLength(2);
    }
    // 甲戊庚牛羊 — 소와 양은 丑未
    expect(CHEONEUL_BRANCHES['甲']).toEqual(['丑', '未']);
    expect(CHEONEUL_BRANCHES['戊']).toEqual(['丑', '未']);
    expect(CHEONEUL_BRANCHES['庚']).toEqual(['丑', '未']);
    // 六辛逢馬虎 — 辛만 말과 호랑이
    expect(CHEONEUL_BRANCHES['辛']).toEqual(['寅', '午']);
  });

  it.each([
    ['寅', '丙'],
    ['午', '丙'],
    ['戌', '丙'],
    ['申', '壬'],
    ['子', '壬'],
    ['辰', '壬'],
    ['亥', '甲'],
    ['卯', '甲'],
    ['未', '甲'],
    ['巳', '庚'],
    ['酉', '庚'],
    ['丑', '庚'],
  ] as const)('%s월의 월덕귀인은 %s', (month, stem) => {
    expect(woldeokStemOf(month)).toBe(stem);
  });

  it.each([
    ['甲', '亥'], ['乙', '午'], ['丙', '寅'], ['丁', '酉'], ['戊', '寅'],
    ['己', '酉'], ['庚', '巳'], ['辛', '子'], ['壬', '申'], ['癸', '卯'],
  ] as const)('%s 의 학당귀인은 장생지 %s', (stem, branch) => {
    expect(hakdangBranchOf(stem)).toBe(branch);
  });

  it.each([
    ['亥', '寅', '戌'], ['子', '寅', '戌'], ['丑', '寅', '戌'],
    ['寅', '巳', '丑'], ['卯', '巳', '丑'], ['辰', '巳', '丑'],
    ['巳', '申', '辰'], ['午', '申', '辰'], ['未', '申', '辰'],
    ['申', '亥', '未'], ['酉', '亥', '未'], ['戌', '亥', '未'],
  ] as const)('%s년의 고신은 %s, 과숙은 %s', (year, gosin, gwasuk) => {
    expect(lonelinessBranchesOf(year)).toEqual({ gosin, gwasuk });
  });

  it('고신과 과숙은 언제나 다른 글자다', () => {
    for (const branch of BRANCHES) {
      const { gosin, gwasuk } = lonelinessBranchesOf(branch);
      expect(gosin).not.toBe(gwasuk);
    }
  });

  it('괴강은 좁은 넷, 백호는 일곱이다', () => {
    expect(GOEGANG_PILLARS).toEqual(['壬辰', '庚辰', '庚戌', '戊戌']);
    expect(BAEKHO_PILLARS).toHaveLength(7);
    // 전부 실재하는 간지여야 한다.
    for (const name of [...GOEGANG_PILLARS, ...BAEKHO_PILLARS]) {
      expect(SEXAGENARY.some((p) => p.name === name)).toBe(true);
    }
  });
});

describe('원국에서 신살 찾기', () => {
  it('걸린 신살만 낸다', () => {
    // 일간 甲 → 천을귀인 丑未, 월지 丑이 걸린다.
    // 월지 丑 → 천덕도 월덕도 庚인데, 년간이 庚이라 둘 다 년주에서 걸린다.
    // 월주 丁丑은 그 자체로 백호다.
    const stars = findStars(chart('庚午', '丁丑', '甲子', '丙寅'));

    expect(stars.map((s) => s.kind)).toEqual([
      'cheoneulGwiin',
      'cheondeokGwiin',
      'woldeokGwiin',
      'baekho',
    ]);
    expect(starOf(stars, 'cheoneulGwiin')).toMatchObject({
      auspicious: true,
      basis: { label: '일간', char: '甲' },
      hits: [{ position: 'month', target: 'branch', char: '丑' }],
    });
    expect(starOf(stars, 'cheondeokGwiin')).toMatchObject({
      basis: { label: '월지', char: '丑' },
      hits: [{ position: 'year', target: 'stem', char: '庚' }],
    });
    expect(starOf(stars, 'baekho')).toMatchObject({
      auspicious: false,
      basis: null,
      hits: [{ position: 'month', target: 'pillar', char: '丁丑' }],
    });
  });

  it('한 신살이 여러 자리에 걸린다', () => {
    // 일간 庚 → 양인 酉. 년지와 월지 둘 다 酉다.
    const stars = findStars(chart('乙酉', '乙酉', '庚午', '丙子'));

    expect(starOf(stars, 'yangin')?.hits.map((h) => h.position)).toEqual(['year', 'month']);
  });

  it('천덕·월덕은 천간에서도 지지에서도 걸린다', () => {
    // 월지 酉 → 월덕 庚. 일간 庚이 곧 일주 천간이라 일주에서 걸린다.
    const stars = findStars(chart('乙酉', '乙酉', '庚午', '丙子'));

    expect(starOf(stars, 'woldeokGwiin')?.hits).toEqual([
      { position: 'day', target: 'stem', char: '庚' },
    ]);
  });

  it('고신·과숙은 년지 기준으로 붙는다', () => {
    // 년지 申(가을) → 고신 亥, 과숙 未.
    const stars = findStars(chart('庚申', '丁亥', '甲子', '辛未'));

    expect(starOf(stars, 'gosin')).toMatchObject({
      basis: { label: '년지', char: '申' },
      hits: [{ position: 'month', target: 'branch', char: '亥' }],
    });
    expect(starOf(stars, 'gwasuk')?.hits).toEqual([
      { position: 'hour', target: 'branch', char: '未' },
    ]);
  });

  it('아무것도 안 걸리면 빈 배열이다', () => {
    const stars = findStars(chart('甲子', '甲子', '甲子', '甲子'));
    expect(stars).toEqual([]);
  });

  it('시간 미상이면 시주에서 신살을 찾지 않는다', () => {
    const known = findStars(chart('庚午', '丁丑', '甲子', '乙丑'));
    const unknown = findStars(chart('庚午', '丁丑', '甲子', null));

    expect(starOf(known, 'cheoneulGwiin')?.hits).toHaveLength(2);
    expect(starOf(unknown, 'cheoneulGwiin')?.hits).toHaveLength(1);
  });
});

describe('양인은 양간만 (기본 정책)', () => {
  it('음간 일간에는 붙지 않는다', () => {
    // 乙의 양인 자리는 辰이지만 기본값에서는 세지 않는다.
    const input = chart('戊辰', '戊辰', '乙丑', '丙子');

    expect(starOf(findStars(input), 'yangin')).toBeUndefined();
    expect(starOf(findStars(input, { yinYangin: true }), 'yangin')?.hits).toHaveLength(2);
  });

  it('양간 일간은 옵션과 무관하게 붙는다', () => {
    const input = chart('乙酉', '乙酉', '庚午', '丙子');

    expect(starOf(findStars(input), 'yangin')?.hits).toHaveLength(2);
    expect(starOf(findStars(input, { yinYangin: true }), 'yangin')?.hits).toHaveLength(2);
  });
});

describe('묶음과 정책', () => {
  it('공망·12신살·신살을 한 번에 낸다', () => {
    const sinsal = analyzeSinsal(chart('庚午', '丁丑', '甲子', '丙寅'));

    expect(sinsal.emptiness).toHaveLength(2);
    expect(sinsal.twelveSpirits).toHaveLength(2);
    expect(sinsal.stars.length).toBeGreaterThan(0);
  });

  it('채택한 규칙 묶음을 결과 곁에 남긴다', () => {
    expect(SINSAL_POLICY).toEqual({
      ruleSet: 'core-sinsal-v1',
      stemBasis: 'day-master',
      hakdang: 'from-twelve-stages',
      loneliness: 'year-branch-both-genders',
      omitted: 'gwangwi-hakgwan, hyeonchim, cheonmun, taegeuk',
      emptinessBasis: 'day-and-year',
      spiritBasis: 'year-and-day',
      travelPeachCanopy: 'from-twelve-spirits',
      yangin: 'yang-stems-only',
      goegang: 'classic-four',
      pillarStarScope: 'all-pillars',
    });
  });

  it('산출법이 갈리는 신살은 넣지 않았다고 밝힌다', () => {
    expect(SINSAL_POLICY.omitted).toContain('gwangwi-hakgwan');
    expect(SINSAL_POLICY.hakdang).toBe('from-twelve-stages');
    expect(SINSAL_POLICY.loneliness).toBe('year-branch-both-genders');
  });

  it('역마·도화·화개를 신살에서 따로 뽑지 않는다', () => {
    // 12신살에 이미 있으므로 중복 계산하지 않는다는 정책이 코드와 맞는지 본다.
    const stars = findStars(chart('庚午', '丁丑', '甲子', '丙寅'));
    expect(stars.map((s) => s.ko)).not.toContain('역마');
    expect(stars.map((s) => s.ko)).not.toContain('도화');
    expect(stars.map((s) => s.ko)).not.toContain('화개');
  });
});

describe('computeSaju 와의 연결', () => {
  it('사주에 신살이 함께 나온다', () => {
    const saju = computeSaju({
      year: 1988,
      month: 7,
      day: 15,
      hour: 14,
      minute: 30,
      second: 0,
      gender: 'male',
    });

    expect(saju.sinsal.emptiness[0].basis).toBe('day');
    expect(saju.sinsal.twelveSpirits[0].basis).toBe('year');
    expect(saju.sinsal).toEqual(analyzeSinsal(saju.pillars));
  });
});
