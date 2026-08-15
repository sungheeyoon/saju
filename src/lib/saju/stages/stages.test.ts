import { describe, expect, it } from 'vitest';

import { computeSaju } from '@/src/lib/saju';
import { STEMS, pillarOf, type Branch, type Stem } from '@/src/lib/saju/constants';
import {
  STEM_PROSPERITY,
  TWELVE_STAGES,
  twelveStageBranchesOf,
  twelveStageOf,
  twelveStagesOf,
} from '@/src/lib/saju/stages';

/**
 * 12운성 테스트.
 *
 * 장생지를 표로 박지 않고 록지에서 유도했으므로, 통설 표와의 대조가 이
 * 파일의 본론이다. 유도가 틀리면 열 천간 중 어딘가에서 반드시 어긋난다.
 */

/** 통설의 장생지와 진행 방향 — 유도와 독립된 기대값이다 */
const CLASSIC_ORIGIN: Record<Stem, { start: Branch; forward: boolean }> = {
  甲: { start: '亥', forward: true },
  乙: { start: '午', forward: false },
  丙: { start: '寅', forward: true },
  丁: { start: '酉', forward: false },
  戊: { start: '寅', forward: true },
  己: { start: '酉', forward: false },
  庚: { start: '巳', forward: true },
  辛: { start: '子', forward: false },
  壬: { start: '申', forward: true },
  癸: { start: '卯', forward: false },
};

/** 통설의 제왕지 — 록의 바로 다음(순행) 또는 바로 앞(역행) */
const CLASSIC_PEAK: Record<Stem, Branch> = {
  甲: '卯',
  乙: '寅',
  丙: '午',
  丁: '巳',
  戊: '午',
  己: '巳',
  庚: '酉',
  辛: '申',
  壬: '子',
  癸: '亥',
};

/** 통설의 묘지(墓庫) — 언제나 辰戌丑未 넷 중 하나다 */
const CLASSIC_GRAVE: Record<Stem, Branch> = {
  甲: '未',
  乙: '戌',
  丙: '戌',
  丁: '丑',
  戊: '戌',
  己: '丑',
  庚: '丑',
  辛: '辰',
  壬: '辰',
  癸: '未',
};

describe('통설 표와의 대조 — 록지에서 유도한 값이 맞는가', () => {
  it.each(STEMS)('%s 의 장생지', (stem) => {
    expect(twelveStageBranchesOf(stem).長生).toBe(CLASSIC_ORIGIN[stem].start);
  });

  it.each(STEMS)('%s 의 건록은 록지 그 자리다', (stem) => {
    expect(twelveStageBranchesOf(stem).建祿).toBe(STEM_PROSPERITY[stem]);
  });

  it.each(STEMS)('%s 의 제왕지', (stem) => {
    expect(twelveStageBranchesOf(stem).帝旺).toBe(CLASSIC_PEAK[stem]);
  });

  it.each(STEMS)('%s 의 묘지는 辰戌丑未 중 하나다', (stem) => {
    const grave = twelveStageBranchesOf(stem).墓;

    expect(grave).toBe(CLASSIC_GRAVE[stem]);
    expect(['辰', '戌', '丑', '未']).toContain(grave);
  });

  it.each(STEMS)('%s 의 열두 자리가 열두 지지를 남김없이 덮는다', (stem) => {
    const branches = Object.values(twelveStageBranchesOf(stem));

    expect(branches).toHaveLength(12);
    expect(new Set(branches).size).toBe(12);
  });

  it('열두 이름의 순서가 장생에서 시작해 양으로 끝난다', () => {
    expect(TWELVE_STAGES[0]).toBe('長生');
    expect(TWELVE_STAGES[11]).toBe('養');
    expect(TWELVE_STAGES).toHaveLength(12);
  });
});

describe('음간은 역행한다 (기본 정책)', () => {
  it('甲은 亥에서 순행, 乙은 午에서 역행', () => {
    expect(twelveStageOf('甲', '亥')).toBe('長生');
    expect(twelveStageOf('甲', '子')).toBe('沐浴');

    expect(twelveStageOf('乙', '午')).toBe('長生');
    expect(twelveStageOf('乙', '巳')).toBe('沐浴');
  });

  it('같은 오행이라도 음양에 따라 장생지가 정반대다', () => {
    expect(twelveStageBranchesOf('甲').長生).toBe('亥');
    expect(twelveStageBranchesOf('乙').長生).toBe('午');
  });

  it('음간의 제왕은 록의 앞자리다', () => {
    // 乙의 록은 卯, 역행하므로 제왕은 寅이다.
    expect(twelveStageOf('乙', '寅')).toBe('帝旺');
  });
});

describe('양포태 — yinReverse: false', () => {
  it.each([
    ['乙', '甲'],
    ['丁', '丙'],
    ['己', '戊'],
    ['辛', '庚'],
    ['癸', '壬'],
  ] as const)('%s 가 %s 와 같아진다', (yin, yang) => {
    expect(twelveStageBranchesOf(yin, { yinReverse: false })).toEqual(
      twelveStageBranchesOf(yang),
    );
  });

  it('양간은 옵션에 영향받지 않는다', () => {
    expect(twelveStageBranchesOf('甲', { yinReverse: false })).toEqual(
      twelveStageBranchesOf('甲'),
    );
  });

  it('선택한 규칙을 결과에 남긴다', () => {
    const chart = { ...pillarsOf('甲子', '甲子', '甲子', '甲子'), dayMaster: '甲' as Stem };

    expect(twelveStagesOf(chart).yinReverse).toBe(true);
    expect(twelveStagesOf(chart, { yinReverse: false }).yinReverse).toBe(false);
  });
});

function pillarsOf(year: string, month: string, day: string, hour: string | null) {
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

describe('원국에 붙이기', () => {
  const chart = { ...pillarsOf('庚午', '丙戌', '甲子', '丙寅'), dayMaster: '甲' as Stem };

  it('일간 기준은 일간이 네 지지에서 어떤 상태인가', () => {
    // 甲은 亥 장생 순행 — 午는 사, 戌은 양, 子는 목욕, 寅은 건록이다.
    expect(twelveStagesOf(chart).byDayMaster).toEqual({
      year: '死',
      month: '養',
      day: '沐浴',
      hour: '建祿',
    });
  });

  it('좌하 기준은 그 기둥의 천간이 제 지지에서 어떤 상태인가', () => {
    // 庚午 목욕 / 丙戌 묘 / 甲子 목욕 / 丙寅 장생
    expect(twelveStagesOf(chart).bySelf).toEqual({
      year: '沐浴',
      month: '墓',
      day: '沐浴',
      hour: '長生',
    });
  });

  it('일주 자리는 두 기준이 언제나 같다', () => {
    // 일주의 천간이 곧 일간이므로 같은 계산이다.
    const stages = twelveStagesOf(chart);
    expect(stages.byDayMaster.day).toBe(stages.bySelf.day);
  });

  it('시간 미상이면 시주 자리가 null 이다', () => {
    const unknown = { ...pillarsOf('庚午', '丙戌', '甲子', null), dayMaster: '甲' as Stem };
    const stages = twelveStagesOf(unknown);

    expect(stages.byDayMaster.hour).toBeNull();
    expect(stages.bySelf.hour).toBeNull();
    expect(stages.byDayMaster.day).toBe('沐浴');
  });
});

describe('computeSaju 와의 연결', () => {
  it('사주에 12운성이 함께 나온다', () => {
    const saju = computeSaju({
      year: 1988,
      month: 7,
      day: 15,
      hour: 14,
      minute: 30,
      second: 0,
      gender: 'male',
    });

    expect(saju.stages.byDayMaster.day).toBe(
      twelveStageOf(saju.pillars.dayMaster, saju.pillars.day.branch),
    );
    expect(saju.stages.yinReverse).toBe(true);
  });

  it('옵션이 엔진 입구까지 이어진다', () => {
    const input = {
      year: 1988,
      month: 7,
      day: 15,
      hour: 14,
      minute: 30,
      second: 0,
      gender: 'male',
    } as const;

    expect(computeSaju(input, { stages: { yinReverse: false } }).stages.yinReverse).toBe(false);
  });
});
