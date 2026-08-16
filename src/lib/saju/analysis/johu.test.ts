import { describe, expect, it } from 'vitest';

import { computeSaju } from '@/src/lib/saju';
import {
  BRANCHES_BY_MONTH_ORDER,
  SEXAGENARY,
  STEMS,
  pillarOf,
  type Stem,
} from '@/src/lib/saju/constants';
import {
  JOHU_POLICY,
  JOHU_TABLE,
  johuAssessmentOf,
} from '@/src/lib/saju/analysis/johu';

/** 寅월부터 丑월까지. 120칸 모두를 원문 대조 순서로 고정한다. */
const EXPECTED: Record<Stem, readonly string[]> = {
  甲: ['丙癸', '庚丙丁戊己', '庚丁壬', '癸庚丁', '癸庚丁', '癸庚丁', '庚丁壬', '庚丁丙', '庚甲丁壬癸', '庚丁丙戊', '丁庚丙', '丁庚丙'],
  乙: ['丙癸', '丙癸', '癸丙戊', '癸', '癸丙', '癸丙', '丙癸己', '癸丙丁', '癸辛', '丙戊', '丙', '丙'],
  丙: ['壬庚', '壬己', '壬甲', '壬癸庚', '壬庚', '壬庚', '壬戊', '壬癸', '甲壬', '甲戊庚壬', '壬戊己', '壬甲'],
  丁: ['甲庚', '庚甲', '甲庚', '甲庚', '壬庚癸', '甲壬庚', '甲庚丙戊', '甲庚丙戊', '甲庚戊', '甲庚', '甲庚', '甲庚'],
  戊: ['丙甲癸', '丙甲癸', '甲丙癸', '甲丙癸', '壬甲丙', '癸丙甲', '丙癸甲', '丙癸', '甲丙癸', '甲丙', '丙甲', '丙甲'],
  己: ['丙庚甲', '甲癸丙', '丙癸甲', '癸丙', '癸丙', '癸丙', '丙癸', '丙癸', '甲丙癸', '丙甲戊', '丙甲戊', '丙甲戊'],
  庚: ['戊甲壬丙丁', '丁甲庚丙', '甲丁壬癸', '壬戊丙丁', '壬癸', '丁甲', '丁甲', '丁甲丙', '甲壬', '丁丙', '丁甲丙', '丙丁甲'],
  辛: ['己壬庚', '壬甲', '壬甲', '壬甲癸', '壬己癸', '壬庚甲', '壬甲戊', '壬甲丁', '壬甲', '壬丙', '丙戊壬甲', '丙壬戊己'],
  壬: ['庚丙戊', '戊辛庚', '甲庚丙', '壬辛庚癸', '癸庚辛', '辛甲', '戊丁', '甲庚', '甲丙', '戊丙庚', '戊丙', '丙丁甲'],
  癸: ['辛丙', '庚辛', '丙辛甲', '辛', '庚辛壬癸', '庚辛壬癸', '丁', '辛丙', '辛甲壬癸', '庚辛戊丁', '丙辛', '丙丁'],
};

describe('조후용신 — 《궁통보감》 120조합 참고표', () => {
  it('열 일간 × 열두 월지의 후보 천간을 전부 고정한다', () => {
    for (const stem of STEMS) {
      expect(
        BRANCHES_BY_MONTH_ORDER.map((branch) => JOHU_TABLE[stem][branch].stems.join('')),
        `${stem} 일간`,
      ).toEqual(EXPECTED[stem]);
    }
  });

  it('120칸 모두 조건 설명이 있고 유효한 천간만 담는다', () => {
    const allStems = new Set(STEMS);
    let count = 0;

    for (const stem of STEMS) {
      for (const branch of BRANCHES_BY_MONTH_ORDER) {
        const found = JOHU_TABLE[stem][branch];
        count += 1;
        expect(found.stems.length).toBeGreaterThan(0);
        expect(found.stems.every((candidate) => allStems.has(candidate))).toBe(true);
        expect(found.note.length).toBeGreaterThan(10);
      }
    }

    expect(count).toBe(120);
  });

  it('겨울 丁火는 단순히 火를 보태지 않고 甲庚을 검토한다', () => {
    for (const branch of ['亥', '子', '丑'] as const) {
      expect(JOHU_TABLE.丁[branch].stems).toEqual(['甲', '庚']);
    }
  });

  it('결과가 월지와 일간, 참고표 상태를 함께 남긴다', () => {
    const month = SEXAGENARY.find((pillar) => pillar.branch === '子')!;
    const found = johuAssessmentOf({ dayMaster: '丁', month });

    expect(found).toMatchObject({
      status: 'reference',
      dayMaster: '丁',
      monthBranch: '子',
      stems: ['甲', '庚'],
    });
    expect(JOHU_POLICY.conditionEvaluation).toBe('half-month-only');
  });
});

describe('상·하반월 판정', () => {
  const at = (year: number, month: number, day: number, hour = 12) =>
    computeSaju({ year, month, day, hour, minute: 0, second: 0, gender: 'female' }).analysis.johu;

  /**
   * 경계는 날짜를 반으로 가른 것이 아니라 **중기**다. 절이 30° 간격이고 중기는
   * 그 정확히 +15° 지점이라 천문으로 정해진다 — 지어낸 문턱이 아니다.
   */
  it('경계는 중기이고 그 이름과 시각을 함께 낸다', () => {
    // 2025 소서(7/7) ~ 입추(8/7) 의 중기는 대서(7/22 무렵).
    const johu = at(2025, 7, 10);

    expect(johu.midTerm?.name).toBe('대서');
    expect(johu.half).toBe('first');
    expect(at(2025, 7, 30).half).toBe('second');
    expect(at(2025, 7, 30).midTerm?.name).toBe('대서');
  });

  it('중기를 넘기면 절반이 바뀐다', () => {
    const before = at(2025, 7, 22, 0);
    const after = at(2025, 7, 23, 23);

    expect(before.midTerm?.date.getTime()).toBe(after.midTerm?.date.getTime());
    expect(before.half).toBe('first');
    expect(after.half).toBe('second');
  });

  /**
   * 120칸 중 여섯만 상·하반월로 갈린다. 갈리는 칸에서만 그 절반의 후보를 내고,
   * 나머지는 `halfStems` 가 null 이라 `stems` 를 그대로 읽으면 된다.
   */
  it('갈리는 칸에서만 절반의 후보를 낸다', () => {
    // 癸 일간 · 未월(소서~입추) — 상반월은 午월과 같고 하반월은 금만으로도 쓴다.
    const first = computeSaju({
      year: 2025, month: 7, day: 10, hour: 12, minute: 0, second: 0, gender: 'female',
    }).analysis.johu;

    if (first.dayMaster === '癸' && first.monthBranch === '未') {
      expect(first.halfStems).toEqual(['庚', '辛', '壬', '癸']);
    }

    // 갈리지 않는 칸은 절반을 알아도 halfStems 가 없다.
    const plain = at(2025, 3, 10);
    expect(plain.halfMonth).toBeUndefined();
    expect(plain.halfStems).toBeNull();
    expect(plain.half).not.toBeNull();
  });

  it('절대 시각 없이 부르면 절반을 지어내지 않는다', () => {
    const found = johuAssessmentOf({
      dayMaster: '癸',
      month: pillarOf('癸', '未')!,
    });

    expect(found.half).toBeNull();
    expect(found.midTerm).toBeNull();
    expect(found.halfStems).toBeNull();
    // 표 조회는 그대로 된다.
    expect(found.stems.length).toBeGreaterThan(0);
  });

  it('세력 조건은 여전히 판정하지 않는다', () => {
    expect(JOHU_POLICY.conditionEvaluation).toBe('half-month-only');
    expect(JOHU_POLICY.halfMonthBoundary).toBe('mid-term-longitude-plus-15');
    expect(JOHU_POLICY.status).toBe('reference');
  });
});
