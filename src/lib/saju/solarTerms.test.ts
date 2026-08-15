import { describe, expect, it } from 'vitest';
import { getSolarTerms } from '@/src/lib/saju/solarTerms';

const SAJU_YEAR = 2025;

const KST_OFFSET_MS = 9 * 60 * 60 * 1000;

/** UTC 절대 시각을 KST(UTC+9) 'YYYY-MM-DD HH:mm:ss' 문자열로 변환한다. */
function toKST(date: Date): string {
  const d = new Date(date.getTime() + KST_OFFSET_MS);
  const p = (n: number) => String(n).padStart(2, '0');
  return (
    `${d.getUTCFullYear()}-${p(d.getUTCMonth() + 1)}-${p(d.getUTCDate())} ` +
    `${p(d.getUTCHours())}:${p(d.getUTCMinutes())}:${p(d.getUTCSeconds())}`
  );
}

/**
 * 절기별 기대 시각 — KST(UTC+9) 기준 'YYYY-MM-DD HH:mm:ss'.
 *
 * 빈 문자열인 항목은 테스트가 skip 된다. 만세력 등에서 확인한 값을
 * 채워 넣으면 해당 절기부터 검증이 활성화된다.
 */
const EXPECTED_KST: Record<string, string> = {
  입춘: '',
  경칩: '',
  청명: '',
  입하: '',
  망종: '',
  소서: '',
  입추: '',
  백로: '',
  한로: '',
  입동: '',
  대설: '',
  소한: '',
};

describe(`getSolarTerms(${SAJU_YEAR})`, () => {
  const terms = getSolarTerms(SAJU_YEAR);

  it('12절을 반환한다', () => {
    expect(terms).toHaveLength(12);
  });

  it('입춘에서 시작해 소한으로 끝난다', () => {
    expect(terms[0].name).toBe('입춘');
    expect(terms[terms.length - 1].name).toBe('소한');
  });

  it('황경이 315°에서 30° 간격으로 증가한다', () => {
    expect(terms.map((t) => t.longitude)).toEqual([
      315, 345, 15, 45, 75, 105, 135, 165, 195, 225, 255, 285,
    ]);
  });

  it('월지가 寅부터 순서대로 배정된다', () => {
    expect(terms.map((t) => t.branch)).toEqual([
      '寅', '卯', '辰', '巳', '午', '未', '申', '酉', '戌', '亥', '子', '丑',
    ]);
  });

  it('시각이 오름차순이다', () => {
    const times = terms.map((t) => t.date.getTime());
    expect(times).toEqual([...times].sort((a, b) => a - b));
    expect(new Set(times).size).toBe(times.length);
  });

  it('입춘은 사주년 2월, 소한은 다음 해 1월이다', () => {
    const ipchun = new Date(terms[0].date.getTime() + KST_OFFSET_MS);
    expect(ipchun.getUTCFullYear()).toBe(SAJU_YEAR);
    expect(ipchun.getUTCMonth() + 1).toBe(2);

    const sohan = new Date(terms[11].date.getTime() + KST_OFFSET_MS);
    expect(sohan.getUTCFullYear()).toBe(SAJU_YEAR + 1);
    expect(sohan.getUTCMonth() + 1).toBe(1);
  });

  describe('절기별 시각 (KST)', () => {
    for (const term of terms) {
      const expected = EXPECTED_KST[term.name];

      it.skipIf(!expected)(`${term.name} (황경 ${term.longitude}°)`, () => {
        expect(toKST(term.date)).toBe(expected);
      });
    }
  });
});
