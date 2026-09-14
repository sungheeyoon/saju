import { describe, expect, it } from 'vitest';

import { baselineIn, checkReading } from '@/src/lib/reading';
import { CITY_LONGITUDES, computeSaju } from '@/src/lib/saju';
import { WITHHELD_PATHS } from '@/src/lib/saju/evidence/shared';

import { readingInputOf } from './generator';

const VIEWED_AT = new Date('2026-08-26T09:00:00+09:00');
const A = computeSaju(
  { year: 1990, month: 5, day: 12, hour: 14, minute: 30, second: 0, gender: 'male' },
  { longitude: CITY_LONGITUDES.부산, useLongitude: true },
);
const B = computeSaju(
  { year: 1993, month: 11, day: 3, hour: 8, minute: 10, second: 0, gender: 'female' },
  { longitude: CITY_LONGITUDES.대구, useLongitude: true },
);

const SECRETS = [
  { originalDate: '1990-05-12', solarDate: '1990-05-12', birthTime: '14:30:00', city: '부산' },
  { originalDate: '1993-11-03', solarDate: '1993-11-03', birthTime: '08:10:00', city: '대구' },
] as const;

const SAFE_MARKDOWN = `## 두 사람 사이\n${'서로의 속도를 확인하고 합의한 규칙을 분명히 하면 좋습니다. '.repeat(20)}`;

/**
 * **보내기 전의 경계** — 자르기·프롬프트(`readingInputOf`)와, 돌아온 글을 무는 검사.
 *
 * 누름은 이 둘 사이에서 떠나보내고 완성본은 다른 길로 온다(ADR 0020). 그래서 둘을 한
 * 함수로 이어 재지 않고, 보낸 것과 막는 것을 따로 잰다.
 */
describe('Match 첫 세로 슬라이스의 생성 경계', () => {
  const made = readingInputOf({ kind: 'match', charts: { a: A, b: B }, viewedAt: VIEWED_AT });

  it('정확한 출생 정보와 상대 원국 전체 판정은 Evidence·prompt 에 없다', () => {
    expect(made.ok).toBe(true);
    if (!made.ok) return;

    const { evidenceText, prompt } = made.input;
    for (const secret of ['1990-05-12', '14:30', '부산', '1993-11-03', '08:10', '대구']) {
      expect(evidenceText, `${secret} 이 Evidence에 샜다`).not.toContain(secret);
      expect(prompt, `${secret} 이 prompt에 샜다`).not.toContain(secret);
    }

    const parsed = JSON.parse(evidenceText) as {
      charts: { a: Record<string, unknown>; b: Record<string, unknown> };
    };
    for (const path of Object.keys(WITHHELD_PATHS)) {
      expect(parsed.charts.a, `첫 원국의 ${path} 가 남았다`).not.toHaveProperty(path);
      expect(parsed.charts.b, `상대 원국의 ${path} 가 남았다`).not.toHaveProperty(path);
    }
  });

  it('모델이 출생 원문이나 범위 밖 원국 판정을 내면 검사가 문다', () => {
    if (!made.ok) throw new Error(made.detail);

    for (const [markdown, code] of [
      [`${SAFE_MARKDOWN}\n상대는 1993-11-03 에 태어났습니다.`, 'birth-input-leaked'],
      [`${SAFE_MARKDOWN}\n상대 원국은 신약합니다.`, 'out-of-scope-judgment'],
    ] as const) {
      const verdict = checkReading({
        kind: 'match',
        output: { metaphor: '두 사람이 같은 속도로 걷는 사이입니다.', score: 68, markdown },
        evidenceText: made.input.evidenceText,
        secrets: SECRETS,
        baseline: baselineIn(made.input.prompt) ?? undefined,
      });

      expect(verdict.ok, code).toBe(false);
      if (verdict.ok) continue;
      expect(verdict.failures.map((one) => one.code)).toContain(code);
    }
  });
});
