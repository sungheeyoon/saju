import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';

import { describe, expect, it } from 'vitest';

import { computeSaju } from '@/src/lib/saju';
import {
  CONTROL,
  PROMPT_VARIANTS,
  checkReading,
  measureMarkdown,
  readingEvidenceOf,
  readingPromptOf,
  outputDeviations,
  type OutputDeviation,
} from '@/src/lib/reading';

/**
 * **진짜로 한 번 부르는 자리** — 평소에는 돌지 않는다.
 *
 * `npm test` 에 넣지 않는 이유는 셋이다: 느리고, 돈이 들고, 값이 매번 다르다. 그런데
 * 없으면 안 되는 검사이기도 하다 — 나머지 시험은 전부 모델을 부르지 않으므로,
 * **OpenAI API 까지 실제로 닿는가**를 아무도 재지 않게 된다.
 *
 *   READING_LIVE=1 npx vitest run src/lib/reading/call.live.test.ts
 *   READING_VARIANTS_LIVE=1 npx vitest run src/lib/reading/call.live.test.ts
 *
 * 재는 것은 글의 품질이 아니라 **파이프라인이 이어져 있는가**다. 품질은 사람이
 * 본다(PRD: 최종 출시 판단은 제품 담당자의 blind review).
 */

/**
 * 돈을 낸 원문이 떨어지는 자리 — `.gitignore` 에 있다.
 *
 * **실행마다 따로 쌓는다.** 변형 id 만 파일 이름으로 쓰면 다음 실행이 지난 것을 덮고,
 * 그러면 **변동성을 재려고 여러 번 부른 기록이 마지막 하나만 남는다.** 실제로 기준판을
 * 세 번 불렀는데 파일에는 마지막 것만 남아 있었다 — 회차 사이의 차이가 이 라운드의
 * 근거인데 그 근거가 산출물에 없었다.
 */
const OUTPUT_ROOT = '.reading-live';

const live = process.env.READING_LIVE === '1';
const variantsLive = process.env.READING_VARIANTS_LIVE === '1';

/**
 * 변형끼리 견줄 때의 **고정 기준 시각.**
 *
 * 운은 부르는 순간으로 짚으므로, 안 고정하면 어제 부른 것과 오늘 부른 것이 **다른
 * 운을 읽는다.** 변형을 견주려는 자리에서 그것은 잡음이 아니라 다른 실험이다.
 */
const VARIANTS_VIEWED_AT = '2026-08-26T04:00:00.000Z';

const INPUT = {
  year: 1990,
  month: 5,
  day: 12,
  hour: 14,
  minute: 30,
  second: 0,
  gender: 'male',
} as const;

const SECRETS = [
  { originalDate: '1990-05-12', solarDate: '1990-05-12', birthTime: '14:30:00', city: '서울' },
] as const;

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

describe.skipIf(!live)('OpenAI API 까지 실제로 닿는다', () => {
  it('자기 풀이 한 편이 나오고 검사를 지난다', { timeout: 300_000 }, async () => {
    loadLocalEnv();
    const { callModel } = await import('@/app/me/reading/model');

    const a = computeSaju(INPUT);
    const evidence = readingEvidenceOf('self', { a }, new Date());
    const called = await callModel(readingPromptOf(evidence));

    // 실패도 값으로 오므로 무엇이 막았는지 그대로 보인다.
    expect(called.ok ? '' : `${called.code}: ${called.detail}`).toBe('');
    if (!called.ok) return;

    const verdict = checkReading({
      kind: 'self',
      output: called.output,
      evidenceText: JSON.stringify(evidence.evidence),
      secrets: SECRETS,
    });

    expect(verdict.ok ? [] : verdict.failures).toEqual([]);

    /** 프롬프트만 바뀌고 모델이 예전 네 절을 내면 실제 증상은 그대로다. */
    expect(outputDeviations(measureMarkdown(called.output.markdown), CONTROL)).toEqual([]);
  });
});

/**
 * 돈이 드는 내부 1차 선별 — **품질 우열이 아니라** 변형들이 모두 자기 계약을 지키는지만 본다.
 *
 * 여기서 초록인 것은 「배선이 이어져 있고 변형이 시킨 대로 낸다」까지다. 우열은 사람이
 * 화면에서 본다 — 자기 명식으로, `/me/reading/inspect` 의 「실험용 변형」 자리에서.
 *
 * 목록을 여기 다시 적지 않는다. `PROMPT_VARIANTS` 가 정하므로 손으로 옮겨 적으면
 * 화면이 세우는 것과 여기서 부르는 것이 갈리는 날이 온다 — 그날 「같은 것을 재고
 * 있다」가 거짓이 된다.
 *
 * ## 저장 계약만으로는 좁아졌는지 못 잰다
 *
 * `checkReading` 의 문턱은 kind 하나에 하나뿐이다(400~12000자). 그것만 보면 「지금만」이
 * 여덟 절 1500자를 내도 초록이고, 그러면 **좁힌 출력이 품질을 지키는가**를 보려고 세운
 * 변형이 좁아졌는지조차 안 재고 채점대에 오른다. 그래서 변형마다 **자기 조립이 계약한
 * 분량과 절 수**를 함께 잰다(`assemblyBreaches`).
 */
describe.skipIf(!variantsLive)('변형들이 같은 Evidence 에서 실제 출력을 낸다', () => {
  it('막는 계약을 다 지나고 분량 목표는 값으로 남는다', { timeout: 300_000 }, async () => {
    loadLocalEnv();
    const { callModel } = await import('@/app/me/reading/model');
    const evidence = readingEvidenceOf(
      'self',
      { a: computeSaju(INPUT) },
      new Date(VARIANTS_VIEWED_AT),
    );

    const called = await Promise.all(
      PROMPT_VARIANTS.map(async (variant) => ({
        variant,
        result: await callModel(readingPromptOf(evidence, variant.assembly)),
      })),
    );

    /**
     * **먼저 적고 나서 판정한다.** 호출은 돈이 들었고, 판정하다 던지면 그 원문이
     * 사라진다 — 무엇이 어긋났는지 보려고 값을 치른 호출을 다시 하게 된다.
     */
    const at = new Date().toISOString().replace(/[:.]/g, '-');
    const dir = `${OUTPUT_ROOT}/${at}`;
    mkdirSync(dir, { recursive: true });

    /** 설정을 **원문 옆에** 적는다 — 나중에 「무엇으로 만든 것인가」를 파일 하나로 답한다 */
    const { GENERATION } = await import('@/app/me/reading/generation');

    for (const { variant, result } of called) {
      writeFileSync(
        `${dir}/${variant.id}.json`,
        JSON.stringify({ at, variant: variant.id, generation: GENERATION, ...result }, null, 2),
      );
    }

    /**
     * **전부 판정하고 나서 한 번에 말한다.**
     *
     * 변형마다 그 자리에서 던지면 첫 변형이 어긋나는 순간 나머지의 판정을 못 본다 —
     * 이미 부른 뒤인데도. 어디서 어긋나는지는 **나란히 놓아야** 보인다.
     */
    const verdicts = called.map(({ variant, result }) => {
      if (!result.ok) {
        return { id: variant.id, blocking: [`${result.code}: ${result.detail}`], noted: [] };
      }

      const failures = checkReading({
        kind: 'self',
        output: result.output,
        evidenceText: JSON.stringify(evidence.evidence),
        secrets: SECRETS,
      });

      /**
       * 화면이 세는 것과 **같은 자**로 잰다. 두 자리에서 세면 언젠가 갈리고, 갈리면
       * 시험이 통과시킨 글을 화면이 계약 위반으로 보이게 된다.
       */
      const deviations = outputDeviations(measureMarkdown(result.output.markdown), variant.assembly);
      const said = (kind: OutputDeviation['kind']) =>
        deviations.filter((one) => one.kind === kind).map((one) => `${one.code}: ${one.detail}`);

      /**
       * **무엇이 막는 것인지 여기서 다시 정하지 않는다** — 값이 들고 온다(`kind`).
       * 코드 이름으로 갈라 적으면 새 어긋남이 생겼을 때 이 자리가 조용히 안 고쳐진다.
       */
      return {
        id: variant.id,
        blocking: [
          ...(failures.ok ? [] : failures.failures.map((one) => `${one.code}: ${one.detail}`)),
          ...said('contract'),
        ],
        /** 분량은 적기만 하고 막지 않는다 — 지우지도, 문턱을 슬쩍 옮기지도 않는다 */
        noted: said('target'),
      };
    });

    writeFileSync(`${dir}/verdicts.json`, JSON.stringify(verdicts, null, 2));

    for (const { id, noted } of verdicts) {
      for (const one of noted) console.info(`[분량 기록] ${id} — ${one}`);
    }

    expect(verdicts.map(({ id, blocking }) => `${id}: ${blocking.join(' · ') || 'ok'}`)).toEqual(
      called.map(({ variant }) => `${variant.id}: ok`),
    );
  });
});
