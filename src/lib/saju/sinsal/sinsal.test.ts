import { describe, expect, it } from 'vitest';

import { computeSaju } from '@/src/lib/saju';
import {
  BRANCHES,
  SEXAGENARY,
  STEMS,
  findBranchSixCombination,
  pillarOf,
  type Branch,
  type Stem,
} from '@/src/lib/saju/constants';
import { PILLAR_POSITIONS } from '@/src/lib/saju/position';
import { findRelations } from '@/src/lib/saju/relations';
import { STEM_PROSPERITY } from '@/src/lib/saju/stages';
import {
  BAEKHO_PILLARS,
  CHEONEUL_BRANCHES,
  GOEGANG_PILLARS,
  GWANGWI_HAKGWAN_BRANCH,
  HYEONCHIM_GLYPHS,
  HYEONCHIM_MIN_HITS,
  SINSAL_POLICY,
  TAEGEUK_BRANCHES,
  TWELVE_SPIRITS,
  amrokBranchOf,
  analyzeSinsal,
  emptyBranchesOf,
  findEmptiness,
  findStars,
  findTwelveSpirits,
  geumyeoBranchOf,
  gwangwiHakgwanBranchOf,
  hakdangBranchOf,
  hongyeomBranchOf,
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
 * 공망 · 12신살 · 출처를 고정한 핵심 신살 테스트.
 *
 * 문창·금여·양인·암록은 록지에서 셌으므로 통설 표와의 대조가 본론이다.
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
// 핵심 신살 — 통설 표와의 대조
// ─────────────────────────────────────────────────────────────

describe('록지에서 유도한 네 신살이 통설 표와 맞는가', () => {
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
  const AMROK: Record<Stem, Branch> = {
    甲: '亥', 乙: '戌', 丙: '申', 丁: '未', 戊: '申',
    己: '未', 庚: '巳', 辛: '辰', 壬: '寅', 癸: '丑',
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

  it.each(STEMS)('%s 의 암록', (stem) => {
    expect(amrokBranchOf(stem)).toBe(AMROK[stem]);
  });

  /**
   * 암록의 정의 자체가 "건록과 육합하는 자리"다. 표를 옮겨 적은 것이 아니라
   * 그 정의로 계산한다는 사실을 못박아 둔다 — 육합 표가 바뀌면 여기서 걸린다.
   */
  it.each(STEMS)('%s 의 암록은 건록과 육합한다', (stem) => {
    expect(findBranchSixCombination(STEM_PROSPERITY[stem], amrokBranchOf(stem))).not.toBeNull();
  });

  /**
   * 홍염은 삼합국에서 유도되지 않아 표를 옮길 수밖에 없다. 옮긴 표가 맞는지와
   * 도화(연살)와 다른 자리를 가리키는지를 함께 본다 — 둘 다 매력으로 읽는
   * 신살이라 같은 것으로 뭉뚱그리기 쉽다.
   */
  it.each(STEMS)('%s 의 홍염살', (stem) => {
    const HONGYEOM: Record<Stem, Branch> = {
      甲: '午', 乙: '午', 丙: '寅', 丁: '未', 戊: '辰',
      己: '辰', 庚: '戌', 辛: '酉', 壬: '子', 癸: '申',
    };
    expect(hongyeomBranchOf(stem)).toBe(HONGYEOM[stem]);
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

describe('고전 기준을 고정한 신살 넷', () => {
  it.each([
    ['甲', '巳'], ['乙', '巳'], ['丙', '申'], ['丁', '申'], ['戊', '亥'],
    ['己', '亥'], ['庚', '寅'], ['辛', '寅'], ['壬', '申'], ['癸', '申'],
  ] as const)('%s 일간의 관귀학관은 %s', (stem, branch) => {
    expect(gwangwiHakgwanBranchOf(stem)).toBe(branch);
    expect(GWANGWI_HAKGWAN_BRANCH[stem]).toBe(branch);
  });

  it('관귀학관의 壬癸→申은 음양순역 12운성이 아니라 水土同生申에서 온다', () => {
    expect(gwangwiHakgwanBranchOf('壬')).toBe('申');
    expect(gwangwiHakgwanBranchOf('癸')).toBe('申');
  });

  it('현침은 甲辛卯午申 중 세 글자 이상일 때만 성립한다', () => {
    const fourHits = findStars(chart('甲午', '辛卯', '丙戌', '丁亥'));
    const twoHits = findStars(chart('甲子', '丙午', '戊辰', '庚戌'));

    expect(HYEONCHIM_GLYPHS).toEqual(['甲', '辛', '卯', '午', '申']);
    expect(HYEONCHIM_GLYPHS).not.toContain('未');
    expect(HYEONCHIM_MIN_HITS).toBe(3);
    expect(starOf(fourHits, 'hyeonchim')?.hits.map((hit) => hit.char)).toEqual([
      '甲', '午', '辛', '卯',
    ]);
    expect(starOf(twoHits, 'hyeonchim')).toBeUndefined();
  });

  it('천문성(天門)은 戌亥가 함께 있어야 성립한다', () => {
    const pair = findStars(chart('甲戌', '乙亥', '丙子', '丁酉'));
    const single = findStars(chart('甲戌', '丙寅', '戊辰', '庚午'));

    expect(starOf(pair, 'cheonmun')).toMatchObject({
      nature: 'neutral',
      hits: [
        { position: 'year', target: 'branch', char: '戌' },
        { position: 'month', target: 'branch', char: '亥' },
      ],
    });
    expect(starOf(single, 'cheonmun')).toBeUndefined();
  });

  it('태극귀인은 《연해자평》 표 전체와 년간 기준을 따른다', () => {
    expect(TAEGEUK_BRANCHES).toEqual({
      甲: ['子', '午'], 乙: ['子', '午'], 丙: ['卯', '酉'], 丁: ['卯', '酉'],
      戊: ['辰', '戌', '丑', '未'], 己: ['辰', '戌', '丑', '未'],
      庚: ['寅', '亥'], 辛: ['寅', '亥'], 壬: ['巳', '申'], 癸: ['巳', '申'],
    });

    const found = starOf(findStars(chart('甲子', '戊辰', '丙寅', '戊戌')), 'taegeukGwiin');
    expect(found).toMatchObject({
      basis: { label: '년간', char: '甲' },
      hits: [{ position: 'year', target: 'branch', char: '子' }],
    });
  });
});

describe('원국에서 신살 찾기', () => {
  it('걸린 신살만 낸다', () => {
    // 일간 甲 → 천을귀인 丑未, 월지 丑이 걸린다.
    // 월지 丑 → 천덕도 월덕도 庚인데, 년간이 庚이라 둘 다 년주에서 걸린다.
    // 월주 丁丑은 그 자체로 백호다.
    // 일지 子(申子辰) 기준으로 시지 寅이 역마라 그것도 함께 나온다.
    // 일간 甲 → 홍염 午, 년지가 午다. 암록 亥는 없어서 안 나온다.
    // 년지 午 · 월지 丑이 축오라 귀문·원진이 둘 다 걸린다(관계 표에서 옮겨 온 값).
    const stars = findStars(chart('庚午', '丁丑', '甲子', '丙寅'));

    expect(stars.map((s) => s.kind)).toEqual([
      'yeokma',
      'gwimun',
      'wonjin',
      'cheoneulGwiin',
      'cheondeokGwiin',
      'woldeokGwiin',
      'hongyeom',
      'baekho',
      'taegeukGwiin',
    ]);
    expect(starOf(stars, 'cheoneulGwiin')).toMatchObject({
      nature: 'auspicious',
      basis: { label: '일간', char: '甲' },
      hits: [{ position: 'month', target: 'branch', char: '丑' }],
    });
    expect(starOf(stars, 'cheondeokGwiin')).toMatchObject({
      basis: { label: '월지', char: '丑' },
      hits: [{ position: 'year', target: 'stem', char: '庚' }],
    });
    expect(starOf(stars, 'baekho')).toMatchObject({
      nature: 'inauspicious',
      basis: null,
      hits: [{ position: 'month', target: 'pillar', char: '丁丑' }],
    });
  });

  /**
   * 역마·도화·화개는 신살 목록에 적히지만 규칙은 12신살 하나뿐이다.
   * 옮겨 담기만 하므로 두 곳의 값이 갈라질 수 없어야 한다 — 갈라지면
   * 화면에서 같은 사주에 역마가 있다고도 없다고도 적히게 된다.
   */
  it('역마·도화·화개는 12신살과 언제나 같은 자리를 가리킨다', () => {
    const restated = { 驛馬殺: 'yeokma', 年殺: 'dohwa', 華蓋殺: 'hwagae' } as const;

    for (const { name: year } of SEXAGENARY) {
      const input = chart(year, '丁丑', '甲子', '丙寅');
      const stars = findStars(input);

      for (const spiritChart of findTwelveSpirits(input)) {
        for (const [spirit, kind] of Object.entries(restated)) {
          const expected = PILLAR_POSITIONS.filter(
            (position) => spiritChart.byPosition[position] === spirit,
          );
          const star = stars.find((s) => s.id === `${kind}:${spiritChart.basis}`);

          expect(star?.hits.map((hit) => hit.position) ?? [], `${year} ${spirit}`).toEqual(
            expected,
          );
          // 걸린 자리가 없으면 항목 자체가 나오지 않는다 — 다른 신살과 같은 규칙이다.
          if (expected.length === 0) expect(star).toBeUndefined();
        }
      }
    }
  });

  /**
   * 귀문·원진도 신살 목록에 적히지만 규칙은 관계 표 하나뿐이다. 옮겨 담기만
   * 하므로 두 카드의 값이 갈라질 수 없어야 한다 — 갈라지면 같은 사주에
   * 귀문이 있다고도 없다고도 적히게 된다.
   */
  it('귀문·원진은 관계 표와 언제나 같은 자리를 가리킨다', () => {
    const restated = [
      ['gwimun', 'branchGhostGate'],
      ['wonjin', 'branchResentment'],
    ] as const;

    for (const { name: day } of SEXAGENARY) {
      const input = chart('庚午', '丁丑', day, '丙寅');
      const stars = findStars(input);
      const relations = findRelations(input);

      for (const [kind, relationKind] of restated) {
        const expected = PILLAR_POSITIONS.filter((position) =>
          relations.some(
            (relation) =>
              relation.kind === relationKind &&
              relation.participants.some((participant) => participant.position === position),
          ),
        );
        const star = starOf(stars, kind);

        expect(star?.hits.map((hit) => hit.position) ?? [], `${day} ${kind}`).toEqual(expected);
        // 걸린 자리가 없으면 항목 자체가 나오지 않는다 — 다른 신살과 같은 규칙이다.
        if (expected.length === 0) expect(star).toBeUndefined();
      }
    }
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
      ruleSet: 'sourced-sinsal-v4',
      stemBasis: 'day-master',
      hakdang: 'from-twelve-stages',
      amrok: 'six-combination-of-prosperity',
      hongyeom: 'day-master-classic-table',
      loneliness: 'year-branch-both-genders',
      gwangwiHakgwan: 'day-master-classic-five-element-growth',
      hyeonchim: 'wuxing-jingji-five-glyphs-minimum-three',
      cheonmun: 'xu-hai-pair-heavenly-gate',
      taegeuk: 'year-stem-yuanhai-ziping',
      emptinessBasis: 'day-and-year',
      spiritBasis: 'year-and-day',
      travelPeachCanopy: 'restated-from-twelve-spirits',
      ghostGateResentment: 'restated-from-relations',
      yangin: 'yang-stems-only',
      goegang: 'classic-four',
      pillarStarScope: 'all-pillars',
    });
  });

  it('산출법이 갈리는 신살은 채택 계통을 밝힌다', () => {
    expect(SINSAL_POLICY.gwangwiHakgwan).toContain('classic-five-element');
    expect(SINSAL_POLICY.hyeonchim).toContain('minimum-three');
    expect(SINSAL_POLICY.cheonmun).toContain('pair');
    expect(SINSAL_POLICY.taegeuk).toContain('year-stem');
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
