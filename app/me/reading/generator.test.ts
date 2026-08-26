import { describe, expect, it } from 'vitest';

import { CITY_LONGITUDES, computeSaju } from '@/src/lib/saju';
import { WITHHELD_PATHS } from '@/src/lib/saju/evidence/shared';

import { FakeReadingGenerator } from './fake-generator';
import { generateReadingArtifact } from './generator';

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

describe('Match 첫 세로 슬라이스의 생성 경계', () => {
  it('정확한 출생정보와 상대 원국 전체 판정은 Evidence·prompt·통과 응답에 없다', async () => {
    const fake = new FakeReadingGenerator({
      ok: true,
      output: { score: 68, markdown: SAFE_MARKDOWN },
    });

    const result = await generateReadingArtifact({
      kind: 'match',
      charts: { a: A, b: B },
      viewedAt: VIEWED_AT,
      secrets: SECRETS,
      generator: fake,
    });

    expect(result.ok).toBe(true);
    if (!result.ok) return;

    const { evidenceText, prompt, output } = result.artifact;
    for (const secret of ['1990-05-12', '14:30', '부산', '1993-11-03', '08:10', '대구']) {
      expect(evidenceText, `${secret} 이 Evidence에 샜다`).not.toContain(secret);
      expect(prompt, `${secret} 이 prompt에 샜다`).not.toContain(secret);
      expect(output.markdown, `${secret} 이 응답에 샜다`).not.toContain(secret);
    }

    const parsed = JSON.parse(evidenceText) as {
      charts: { a: Record<string, unknown>; b: Record<string, unknown> };
    };
    for (const path of Object.keys(WITHHELD_PATHS)) {
      expect(parsed.charts.a, `첫 원국의 ${path} 가 남았다`).not.toHaveProperty(path);
      expect(parsed.charts.b, `상대 원국의 ${path} 가 남았다`).not.toHaveProperty(path);
    }

    expect(fake.prompts).toEqual([prompt]);
  });

  it('fake provider가 출생 원문이나 범위 밖 원국 판정을 내면 응답 artifact를 만들지 않는다', async () => {
    for (const [markdown, code] of [
      [`${SAFE_MARKDOWN}\n상대는 1993-11-03 에 태어났습니다.`, 'birth-input-leaked'],
      [`${SAFE_MARKDOWN}\n상대 원국은 신약합니다.`, 'out-of-scope-judgment'],
    ] as const) {
      const fake = new FakeReadingGenerator({ ok: true, output: { score: 68, markdown } });
      const result = await generateReadingArtifact({
        kind: 'match',
        charts: { a: A, b: B },
        viewedAt: VIEWED_AT,
        secrets: SECRETS,
        generator: fake,
      });

      expect(result).toMatchObject({ ok: false, code });
      expect(result).not.toHaveProperty('artifact');
      expect(JSON.stringify(result)).not.toContain('1993-11-03');
    }
  });
});
