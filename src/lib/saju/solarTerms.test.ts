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
 * 절기별 외부 기대 시각 — KST(UTC+9) 기준 'YYYY-MM-DD HH:mm'.
 *
 * 출처는 한국천문연구원(KASI) 역서의 2025년 절기 절입시각이고, 두 번째
 * 자료(uncle.tools 만세력, NASA DE441 기반)로 교차 확인했다. 두 자료는
 * 초 단위 처리(반올림 ↔ 버림)만 달라 최대 1분 차이로 일치한다.
 *
 * 사주년 2025는 입춘(2025-02-03)에서 시작해 소한(**2026**-01-05)으로 끝난다.
 * 마지막 줄의 연도가 2026인 것은 오타가 아니다.
 *
 * 발표값이 분 단위이므로 허용 오차도 1분이다. 그보다 크게 어긋나면 역법
 * 계산이 실제로 밀린 것이다 — 그것이 이 테스트가 잡으려는 회귀다.
 */
const EXPECTED_KST: Record<string, string> = {
  입춘: '2025-02-03 23:10',
  경칩: '2025-03-05 17:07',
  청명: '2025-04-04 21:49',
  입하: '2025-05-05 14:57',
  망종: '2025-06-05 18:57',
  소서: '2025-07-07 05:05',
  입추: '2025-08-07 14:52',
  백로: '2025-09-07 17:52',
  한로: '2025-10-08 09:41',
  입동: '2025-11-07 13:04',
  대설: '2025-12-07 06:05',
  소한: '2026-01-05 17:23',
};

/** 발표값이 분 단위라 이보다 좁게 요구할 수 없다. */
const TOLERANCE_SECONDS = 60;

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

  describe('절기별 시각 — 외부 발표값 대조 (KST)', () => {
    it('12절 모두 기대값이 채워져 있다', () => {
      // 값을 비우면 테스트가 조용히 사라진다. 그 구멍을 막는다.
      for (const term of terms) {
        expect(EXPECTED_KST[term.name], term.name).toMatch(
          /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}$/,
        );
      }
    });

    for (const term of terms) {
      it(`${term.name} (황경 ${term.longitude}°)`, () => {
        const expected = EXPECTED_KST[term.name];
        const actual = toKST(term.date);

        // 날짜와 분까지 같거나, 최대 1분 차이여야 한다.
        const gapSeconds =
          Math.abs(
            new Date(`${actual.replace(' ', 'T')}Z`).getTime() -
              new Date(`${expected.replace(' ', 'T')}:00Z`).getTime(),
          ) / 1000;

        expect(gapSeconds, `발표 ${expected} ↔ 엔진 ${actual}`).toBeLessThanOrEqual(
          TOLERANCE_SECONDS,
        );
      });
    }
  });
});
