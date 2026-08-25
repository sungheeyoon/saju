import { readFileSync } from 'node:fs';

import { describe, expect, it } from 'vitest';

import { computeSaju } from '@/src/lib/saju';
import { checkReading, readingEvidenceOf, readingPromptOf } from '@/src/lib/reading';

/**
 * **진짜로 한 번 부르는 자리** — 평소에는 돌지 않는다.
 *
 * `npm test` 에 넣지 않는 이유는 셋이다: 느리고, 돈이 들고, 값이 매번 다르다. 그런데
 * 없으면 안 되는 검사이기도 하다 — 나머지 시험은 전부 모델을 부르지 않으므로,
 * **게이트웨이까지 실제로 닿는가**를 아무도 재지 않게 된다.
 *
 *   READING_LIVE=1 npx vitest run src/lib/reading/call.live.test.ts
 *
 * 재는 것은 글의 품질이 아니라 **파이프라인이 이어져 있는가**다. 품질은 사람이
 * 본다(PRD: 최종 출시 판단은 제품 담당자의 blind review).
 */

const live = process.env.READING_LIVE === '1';

/** 로컬에서 부를 때만 — 배포에서는 플랫폼이 환경을 준다 */
function loadLocalEnv(): void {
  try {
    for (const line of readFileSync('.env.development.local', 'utf8').split('\n')) {
      const [key, ...rest] = line.split('=');
      if (key && !key.startsWith('#') && rest.length > 0 && !process.env[key.trim()]) {
        process.env[key.trim()] = rest.join('=').trim();
      }
    }
  } catch {
    // 파일이 없으면 이미 환경에 있다고 본다. 없는 것을 지어 채우지 않는다.
  }
}

describe.skipIf(!live)('게이트웨이까지 실제로 닿는다', () => {
  it('자기 풀이 한 편이 나오고 검사를 지난다', { timeout: 300_000 }, async () => {
    loadLocalEnv();
    const { callModel } = await import('@/app/me/reading/model');

    const a = computeSaju({
      year: 1990, month: 5, day: 12, hour: 14, minute: 30, second: 0, gender: 'male',
    });
    const evidence = readingEvidenceOf('self', { a }, new Date());
    const called = await callModel(readingPromptOf(evidence));

    // 실패도 값으로 오므로 무엇이 막았는지 그대로 보인다.
    expect(called.ok ? '' : `${called.code}: ${called.detail}`).toBe('');
    if (!called.ok) return;

    const verdict = checkReading({
      kind: 'self',
      output: called.output,
      evidenceText: JSON.stringify(evidence.evidence),
      secrets: [
        { originalDate: '1990-05-12', solarDate: '1990-05-12', birthTime: '14:30:00', city: '서울' },
      ],
    });

    expect(verdict.ok ? [] : verdict.failures).toEqual([]);
  });
});
