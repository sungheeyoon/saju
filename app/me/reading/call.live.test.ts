import { appendFileSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';

import { describe, expect, it } from 'vitest';

import { loadLocalEnv } from '@/src/lib/local-env';
import { computeSaju, type Saju } from '@/src/lib/saju';
import {
  CONTROL,
  MATCH_INPUT_FIELDS,
  MATCH_INPUT_VARIANTS,
  PAIR_VARIANTS,
  PROMPT_VARIANTS,
  READING_POLICY,
  checkReading,
  isScored,
  measureMarkdown,
  pairOutputDeviations,
  readingEvidenceOf,
  readingPromptOf,
  outputDeviations,
  positionSlips,
  promptVersionOf,
  writesSummaryLast,
  type OutputDeviation,
} from '@/src/lib/reading';

/**
 * **진짜로 한 번 부르는 자리** — 평소에는 돌지 않는다.
 *
 * `npm test` 에 넣지 않는 이유는 셋이다: 느리고, 돈이 들고, 값이 매번 다르다. 그런데
 * 없으면 안 되는 검사이기도 하다 — 나머지 시험은 전부 모델을 부르지 않으므로,
 * **OpenAI API 까지 실제로 닿는가**를 아무도 재지 않게 된다.
 *
 *   READING_LIVE=1 npx vitest run app/me/reading/call.live.test.ts
 *   READING_VARIANTS_LIVE=1 npx vitest run app/me/reading/call.live.test.ts
 *   READING_PAIR_LIVE=1 npx vitest run app/me/reading/call.live.test.ts
 *
 * 재는 것은 글의 품질이 아니라 **파이프라인이 이어져 있는가**다. 품질은 사람이
 * 본다(`prd-archive`: 최종 출시 판단은 제품 담당자의 blind review).
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

/**
 * 파일 · 폴더 이름에 붙는 시각 토막 — **시각만으로는 겹친다.**
 *
 * 같은 시험을 셋 동시에 돌렸더니 두 편이 같은 밀리초에 떨어져 하나가 다른 것을 덮었다(#190).
 * 프로세스 id 와 무작위 토막을 붙여 같은 시각에 지어도 이름이 갈리게 한다.
 */
const runStamp = (at: Date): string =>
  `${at.toISOString().replace(/[:.]/g, '-')}-${process.pid}-${Math.random().toString(36).slice(2, 8)}`;

describe('실호출 원문의 이름은 같은 시각에 지어도 겹치지 않는다', () => {
  it('같은 viewedAt 으로 두 번 지으면 서로 다른 이름이 나온다', () => {
    const at = new Date('2026-09-23T10:44:09.912Z');

    expect(runStamp(at)).not.toBe(runStamp(at));
    expect(runStamp(at)).toMatch(/^2026-09-23T10-44-09-912Z-/);
  });
});

const live = process.env.READING_LIVE === '1';
const variantsLive = process.env.READING_VARIANTS_LIVE === '1';
/** 비공개 궁합 P0/P1 만 부른다 — 위 둘과 재는 축이 달라 문도 따로다 */
const pairLive = process.env.READING_PAIR_LIVE === '1';
/** 인연 궁합 입력 A/B — `READING_MATCH_DRY=1` 이면 부르지 않고 프롬프트만 떨군다 */
const matchInputLive = process.env.READING_MATCH_INPUT_LIVE === '1';

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

/**
 * 두 사람짜리 kind 를 부를 때의 상대 — 궁합에는 두 명식이 있어야 한다.
 *
 * **아무 명식이나 쓰면 안 되는 자리가 됐다.** P0/P1 이 재려는 것은 「판정이 갈릴 때
 * 서열을 읽히면 달라지는가」인데, 갈리지 않는 명식으로 부르면 **P1 의 지시가 한 번도
 * 발동하지 않는다** — 그러면 두 판의 차이는 프롬프트 효과가 아니라 생성 변동성이고,
 * 그것을 읽고 「P1 이 낫다/못하다」로 적는 순간 이 라운드는 거짓을 남긴다.
 *
 * 앞 상대(1992-08-20 09:00)는 `disagrees` 가 한 줄도 참이 아니었다. 지시가
 * `charts.a` 와 `charts.b` 를 **둘 다** 부르는데 b 쪽 절반이 무효인 표본이었다 —
 * 「각각 보라」가 실제로 두 사람에게 걸리는지를 잴 수 없다.
 *
 * 지금 짝은 **둘 다 갈린다.** 그것을 부르기 전에 시험이 잠근다(아래).
 */
const OTHER = {
  year: 1993,
  month: 11,
  day: 3,
  hour: 8,
  minute: 10,
  second: 0,
  gender: 'female',
} as const;

const PAIR_SECRETS = [
  ...SECRETS,
  { originalDate: '1993-11-03', solarDate: '1993-11-03', birthTime: '08:10:00', city: '부산' },
] as const;

/** 이 사람의 판정이 실제로 갈리는가 — `null` 은 「안 갈린다」가 아니라 **견줄 수 없다**다 */
const disagreeingJudgements = (saju: ReturnType<typeof computeSaju>): readonly string[] =>
  saju.analysis.precedence.rows.filter((row) => row.disagrees === true).map((row) => row.ko);

/**
 * **표본이 실험을 겨누는가 — 돈을 쓰지 않고 잰다.**
 *
 * 이 블록만 `skipIf` 가 없다. `npm test` 에서 늘 돌기 때문에, 표본이 무뎌지는 날
 * **실호출을 하기도 전에** 빨간불이 난다. 실호출 안에서만 재면 그 사실은 돈을 쓴 뒤에야
 * 드러나고, 무엇보다 **아무도 그 문을 안 여는 동안에는 영영 안 드러난다.**
 *
 * 엔진이 자라면 표본의 성질이 조용히 바뀐다 — 판정 하나가 서열 표에 들어오거나
 * 정책 스위치가 뒤집히면 갈리던 명식이 안 갈리게 된다. 그때 이 시험이 말한다.
 * 손으로 적은 목록은 엔진이 자랄 때 안 따라오지만, **재는 시험은 따라온다.**
 */
describe('P0/P1 표본은 실제로 갈리는 명식이다', () => {
  it.each([
    { who: 'a', input: INPUT },
    { who: 'b', input: OTHER },
  ])('$who 의 판정이 억부와 어긋나는 줄을 하나 이상 든다', ({ who, input }) => {
    const disagreeing = disagreeingJudgements(computeSaju(input));

    expect(
      disagreeing,
      `${who} 가 한 줄도 안 갈린다 — 이 표본으로 P0/P1 을 부르면 프롬프트 효과가 아니라 생성 변동성을 읽게 된다`,
    ).not.toHaveLength(0);
  });
});

/**
 * **네 kind 를 다 부른다** — 하나만 불러 놓고 「배선이 이어져 있다」고 말하지 않는다.
 *
 * `self` 하나만 돌던 동안 나머지 셋은 **한 번도 모델에 닿은 적이 없었다.** 시험이
 * 초록인 것은 프롬프트가 조립되는 것까지이고, 그 뒤는 아무도 안 봤다.
 *
 * 셋의 위험이 서로 다르다.
 *
 * - `person` — `self` 와 몸통이 같다. 갈리는 것은 접근 판정 하나뿐이라 여기서 새로
 *   드러날 것은 적다. 그래도 부른다: **「같을 것이다」와 「같았다」는 다르다.**
 * - `private` — 두 원국을 통째로 들고 절이 열하나다. 자료가 가장 크다.
 * - `match` — **가장 다르다.** 범위 절이 하나 더 서고(`MATCH_SCOPE`), 근거는 한 번 더
 *   잘려 있고(`shareEvidence`), 절 목록도 짧고, 점수가 붙는다. 그리고 이 kind 에만
 *   동의 범위 낱말 검사가 걸린다 — **모델이 시키지도 않은 신살·운 이름을 쓰면 그때 처음
 *   드러난다.** 조립만 재는 시험으로는 영영 안 잡히는 자리다.
 */
const kinds = [
  { kind: 'self', pair: false, hourless: false },
  { kind: 'person', pair: false, hourless: false },
  { kind: 'private', pair: true, hourless: false },
  { kind: 'match', pair: true, hourless: false },
  /**
   * **시간 미상 한 편** — 9/1 실험의 hard 실패 하나가 「시간 미상의 반방합을 단정한 것」이었다(ADR 0099).
   * 일부만 선 합이 있는 명식이라야 그 자리가 발동한다 — `position-check.test.ts` 가 같은 명식을 잰다.
   */
  { kind: 'self', pair: false, hourless: true },
] as const;

/** 시간 미상 표본 — 일부만 선 합(반방합 · 반합)이 서는 명식 */
const HOURLESS = { year: 1991, month: 6, day: 2, hour: null, gender: 'female' } as const;
const HOURLESS_SECRETS = [
  { originalDate: '1991-06-02', solarDate: '1991-06-02', birthTime: null, city: '서울' },
] as const;

describe.skipIf(!live)('OpenAI API 까지 실제로 닿는다', () => {
  it.each(kinds)(
    '$kind (시간 미상 $hourless) — 한 편이 나오고 검사를 지난다',
    { timeout: 300_000 },
    async ({ kind, pair, hourless }) => {
      loadLocalEnv();
      const { callModel } = await import('@/app/me/reading/model');

      const charts = pair
        ? { a: computeSaju(INPUT), b: computeSaju(OTHER) }
        : { a: computeSaju(hourless ? HOURLESS : INPUT) };
      const viewedAt = new Date();
      const evidence = readingEvidenceOf(kind, charts, viewedAt);
      const called = await callModel(readingPromptOf(evidence));

      // 실패도 값으로 오므로 무엇이 막았는지 그대로 보인다.
      expect(called.ok ? '' : `${called.code}: ${called.detail}`).toBe('');
      if (!called.ok) return;

      /**
       * **부른 값을 먼저 떨군다.** 판정하다 던지면 돈을 낸 원문이 사라지고, 무엇이
       * 어긋났는지 보려고 같은 호출을 다시 하게 된다(변형 쪽과 같은 규율).
       */
      const dir = `${OUTPUT_ROOT}/kinds`;
      mkdirSync(dir, { recursive: true });

      /**
       * **무엇으로 만든 것인지 원문 옆에 적는다.**
       *
       * 이 파일은 `kind` 와 나온 글만 들고 있었다. 그래서 나중에 「이 글이 어느 판본에서
       * 났나」를 물으면 답이 없었다 — 실제로 `legacy-v1` 을 지울지 판단하면서 「이 판을
       * 돌린 적이 있나」를 이 파일들로 답하려다 못 했다.
       *
       * 저장되는 Reading 은 이미 적고 있고(`reading.prompt_version`·`generation`),
       * 변형 실행도 적는다(`variant`). **여기만 안 적었다.**
       *
       * 프롬프트를 통째로 적지는 않는다 — 판본 이름이 그것을 되짚는 값이고
       * (`READING_POLICY.version`), 원문은 그 판본으로 언제든 다시 짓는다.
       */
      const { GENERATION } = await import('@/app/me/reading/generation');

      /** 자리 검사(G-33) — 원문과 함께 떨군 뒤 판정한다 */
      const slips = positionSlips(called.output.markdown, evidence.evidence);

      writeFileSync(
        `${dir}/${kind}${hourless ? '-hourless' : ''}-${runStamp(viewedAt)}.json`,
        JSON.stringify(
          {
            kind,
            /** 기준판으로 부른다 — 변형을 견주는 것은 `READING_VARIANTS_LIVE` 쪽이다 */
            variant: 'control',
            /** 궁합은 판본 칸이 따로다 — 저장되는 Reading 과 같은 함수로 고른다 */
            promptVersion: promptVersionOf(kind),
            positionSlips: slips,
            /** 운은 부르는 순간으로 짚는다 — 그 시각이 없으면 같은 입력도 다른 글이 난다 */
            viewedAt: viewedAt.toISOString(),
            generation: GENERATION,
            ...called,
          },
          null,
          2,
        ),
      );

      const verdict = checkReading({
        kind,
        output: called.output,
        evidenceText: JSON.stringify(evidence.evidence),
        secrets: pair ? PAIR_SECRETS : hourless ? HOURLESS_SECRETS : SECRETS,
      });

      expect(verdict.ok ? [] : verdict.failures).toEqual([]);
      expect(slips).toEqual([]);

      /**
       * **점수는 있어야 할 때 있고 없어야 할 때 없다** — 구조화 출력 스키마가 그 자리를
       * 열어 두므로 모델이 자기 풀이에 숫자를 붙여 낼 수 있다. `checkReading` 이 이미
       * 그것을 보지만, 여기서 한 번 더 눈에 보이게 적는다.
       */
      expect(called.output.score === null).toBe(!isScored(kind));

      /** 한 사람짜리만 절 수 계약이 있다 — 궁합 절 목록은 kind 가 정한다 */
      if (!pair) {
        expect(outputDeviations(measureMarkdown(called.output.markdown), CONTROL)).toEqual([]);
      }
    },
  );
});

/**
 * 돈이 드는 내부 1차 선별 — **품질 우열이 아니라** 변형들이 모두 자기 계약을 지키는지만 본다.
 *
 * 여기서 초록인 것은 「배선이 이어져 있고 변형이 시킨 대로 낸다」까지다. 우열은 사람이
 * 원문을 나란히 읽고 본다. 검산 화면의 「실험용 변형」 자리는 2026-09-23 에 걷혔다(G-32) —
 * 운영판처럼 읽혔다.
 *
 * 목록을 여기 다시 적지 않는다. `PROMPT_VARIANTS` 가 정하므로 손으로 옮겨 적으면
 * 목록과 여기서 부르는 것이 갈리는 날이 온다 — 그날 「같은 것을 재고
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
    const at = runStamp(new Date());
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

/**
 * **비공개 궁합 P0 vs P1** — 10절의 각자 읽기가 안정되는가.
 *
 *   READING_PAIR_LIVE=1 npx vitest run app/me/reading/call.live.test.ts
 *
 * 위 변형 실행과 갈라 둔 까닭은 `PAIR_VARIANTS` 주석에 있다 — 자기 풀이 변형들은 궁합
 * 프롬프트를 한 글자도 안 바꾸므로, 한 목록으로 묶으면 돈을 내고 같은 글을 두 번 받으면서
 * 「변형을 쟀다」고 적히는 자리가 생긴다.
 *
 * ## 여기서 판정하는 것은 계약뿐이다
 *
 * 초록인 것은 「두 판 다 막는 계약을 지난다」까지다. **어느 쪽이 나은지는 여기서 안
 * 정한다** — 그것은 사람이 두 원문을 나란히 읽고 정한다(`PAIR_VARIANTS` 가 무엇을 볼지
 * 넷으로 적어 두었다). 기계가 재는 것과 사람이 정하는 것을 한 자리에 섞으면, 초록불이
 * 「좋다」로 읽힌다.
 *
 * ## 자료는 한 번 지어 둘이 나눠 쓴다
 *
 * 변형마다 근거를 새로 지으면 운을 짚은 시각이 갈리고, 그때 견주는 것은 프롬프트가
 * 아니라 시각이다. 그래서 기준 시각도 고정한다(`VARIANTS_VIEWED_AT`).
 */
describe.skipIf(!pairLive)('비공개 궁합 두 판이 같은 자료에서 실제 출력을 낸다', () => {
  it('P0 와 P1 이 나란히 나오고 둘 다 계약을 지난다', { timeout: 300_000 }, async () => {
    loadLocalEnv();
    const { callModel } = await import('@/app/me/reading/model');
    const a = computeSaju(INPUT);
    const b = computeSaju(OTHER);
    const evidence = readingEvidenceOf('private', { a, b }, new Date(VARIANTS_VIEWED_AT));

    /**
     * **부르기 전에 표본을 잠근다.**
     *
     * P1 의 지시는 판정이 서로 다른 방향을 가리킬 때만 발동한다. 안 갈리는 명식으로
     * 부르면 두 판의 차이는 프롬프트 효과가 아니라 **생성 변동성**이고, 그것을 읽고
     * 「P1 이 낫다」로 적으면 이 라운드는 거짓을 남긴다. 돈을 쓰기 **전에** 멈춘다.
     *
     * 둘 다 요구하는 것은 지시가 `charts.a` 와 `charts.b` 를 **각각** 부르기 때문이다.
     * 한쪽만 갈리면 그 절반이 무효인 채로 초록불이 난다.
     */
    const disagreeing = { a: disagreeingJudgements(a), b: disagreeingJudgements(b) };

    expect(
      disagreeing.a.length,
      'a 의 판정이 하나도 안 갈린다 — 이 표본으로는 P1 이 발동하지 않는다',
    ).toBeGreaterThan(0);
    expect(
      disagreeing.b.length,
      'b 의 판정이 하나도 안 갈린다 — 지시의 `charts.b` 절반이 무효인 표본이다',
    ).toBeGreaterThan(0);

    const called = await Promise.all(
      PAIR_VARIANTS.map(async (variant) => ({
        variant,
        result: await callModel(readingPromptOf(evidence, variant.assembly)),
      })),
    );

    /** 먼저 적고 나서 판정한다 — 판정하다 던지면 값을 치른 원문이 사라진다 */
    const at = runStamp(new Date());
    const dir = `${OUTPUT_ROOT}/pair-${at}`;
    mkdirSync(dir, { recursive: true });

    const { GENERATION } = await import('@/app/me/reading/generation');

    for (const { variant, result } of called) {
      writeFileSync(
        `${dir}/${variant.id}.json`,
        JSON.stringify(
          {
            at,
            kind: 'private',
            variant: variant.id,
            changes: variant.changes,
            promptVersion: READING_POLICY.version,
            viewedAt: VARIANTS_VIEWED_AT,
            generation: GENERATION,
            /** **이 표본이 무엇을 겨눴는지 산출물이 말한다** — 갈림이 없으면 읽을 것도 없다 */
            disagreeing,
            ...result,
          },
          null,
          2,
        ),
      );
    }

    /**
     * **10절만 따로 떼어 나란히 적는다.** 이 라운드가 재는 자리가 거기 하나인데, 두
     * 원문을 통째로 열어 눈으로 찾으면 **읽는 사람마다 다른 자리를 견주게 된다.**
     */
    writeFileSync(
      `${dir}/section-10.md`,
      called
        .map(({ variant, result }) => {
          const body = result.ok ? result.output.markdown : `(호출 실패: ${result.code})`;
          const ten = body.split(/^## /m).find((part) => part.startsWith('10.'));

          return `# ${variant.id} — ${variant.label}\n\n${ten ? `## ${ten}` : '(10절을 못 찾음)'}`;
        })
        .join('\n\n---\n\n'),
    );

    /**
     * **저장 계약만으로는 밴드를 못 잰다.**
     *
     * `checkReading` 이 보는 것은 400~12000자 하나뿐이다. `PAIR_VARIANTS` 가 「분량이
     * 계약 안에 남는가」를 볼 것 넷 중 하나로 적어 두었는데, 그 3500~5500 을 아무도
     * 안 재면 **적어 둔 잣대가 산출물 어디에도 안 남는다** — 자기 풀이 쪽에서 이미
     * 겪은 자리다(그래서 `outputDeviations` 가 있다).
     *
     * 막지는 않는다. 3500~5500 은 모델에 대고 검증한 적이 없는 숫자라 `target` 이다.
     */
    const verdicts = called.map(({ variant, result }) => {
      if (!result.ok) {
        return { id: variant.id, blocking: [`${result.code}: ${result.detail}`], noted: [] };
      }

      const failures = checkReading({
        kind: 'private',
        output: result.output,
        evidenceText: JSON.stringify(evidence.evidence),
        secrets: PAIR_SECRETS,
      });

      /** 화면·자기 풀이와 **같은 자**로 잰다 — 두 자리에서 세면 언젠가 갈린다 */
      const deviations = pairOutputDeviations(
        'private',
        measureMarkdown(result.output.markdown),
        variant.assembly,
      );
      const said = (kind: OutputDeviation['kind']) =>
        deviations.filter((one) => one.kind === kind).map((one) => `${one.code}: ${one.detail}`);

      return {
        id: variant.id,
        blocking: [
          ...(failures.ok ? [] : failures.failures.map((one) => `${one.code}: ${one.detail}`)),
          ...said('contract'),
        ],
        /** 분량과 새어 나온 이름은 적기만 한다 — 문턱을 슬쩍 옮기지도, 지우지도 않는다 */
        noted: said('target'),
      };
    });

    writeFileSync(`${dir}/verdicts.json`, JSON.stringify(verdicts, null, 2));

    for (const { id, noted } of verdicts) {
      for (const one of noted) console.info(`[기록] ${id} — ${one}`);
    }
    console.info(`[나란히 읽을 자리] ${dir}/section-10.md`);

    expect(verdicts.map(({ id, blocking }) => `${id}: ${blocking.join(' · ') || 'ok'}`)).toEqual(
      called.map(({ variant }) => `${variant.id}: ok`),
    );
  });
});

/**
 * **인연 궁합 입력 두 판(A 제한형 · B 확장형)을 같은 조건으로 부른다**(ADR 0067).
 *
 *   # 먼저 부르지 않고 프롬프트만 — 호출 수·입력 크기·반영 여부를 본다
 *   READING_MATCH_INPUT_LIVE=1 READING_MATCH_DRY=1 npx vitest run app/me/reading/call.live.test.ts
 *   # 소규모 — 표본 하나 × 두 판 × 1회 = 2콜
 *   READING_MATCH_INPUT_LIVE=1 READING_MATCH_REPEAT=1 READING_MATCH_FIXTURES=internal-rival npx vitest run app/me/reading/call.live.test.ts
 *   # 같은 실행에 판마다 2회 더 — 프롬프트가 한 글자라도 다르면 부르기 전에 멈춘다
 *   READING_MATCH_INPUT_LIVE=1 READING_MATCH_REPEAT=2 READING_MATCH_RUN_DIR=.reading-live/match-input-… npx vitest run …
 *   # 저장된 명식 한 쌍(Git 밖 파일)으로
 *   READING_MATCH_INPUT_LIVE=1 READING_MATCH_PAIR_FILE=.reading-live/private/my-pair.json READING_MATCH_REPEAT=1 npx vitest run …
 *
 * **같게 두는 것**: 명식·기준 시각·모델·생성 설정·분량·기준점·조정 상한·재량 폭·사이. **다른 것**은
 * 자료 범위와 그에 따라 바뀐 지시 둘이고, 둘 다 `manifest.json` 에 적는다.
 *
 * ## 세 갈래를 섞지 않는다 — `verdicts.json`
 *
 * 1. **호출** — 모델까지 닿아 구조화 출력이 왔는가. **하나라도 실패하면 이 시험이 빨간불이다.**
 *    기록 수가 맞는 것은 성공이 아니다. 실패 원문은 `runs.jsonl` 에 남는다.
 * 2. **출력 계약** — 저장 검사(`checkReading`)가 막는 것과 분량 밖 같은 계약 어긋남. 실험 결과로
 *    적고 시험을 떨구지 않는다 — 그러나 `status` 가 `complete` 로 서지 않는다.
 * 3. **사람이 확인할 것** — 근거 오류 후보·자리 문장·이탈 지표. 자동 판정이 아니다.
 *
 * 이 결과는 AI 설명 품질의 비교이지 실제 관계가 잘 되는지의 검증이 아니다.
 */
/** 세워진 명식을 집는다 — 못 읽는 입력으로는 실험을 시작하지 않는다 */
function sajuOf(result: { ok: true; saju: Saju } | { ok: false; message: string }): Saju {
  if (!result.ok) throw new Error(`저장된 입력을 읽지 못했다: ${result.message}`);
  return result.saju;
}

describe.skipIf(!matchInputLive)('인연 궁합 입력 A/B 를 같은 조건으로 부른다', () => {
  it('두 판을 같은 조건으로 부르고 호출·계약·사람 확인을 갈라 떨군다', { timeout: 3_600_000 }, async () => {
    const { existsSync } = await import('node:fs');
    const { createHash } = await import('node:crypto');
    const { MATCH_INPUT_FIXTURES, aggregateMatchRuns, blindPacket, chartsOf, measureMatchRun, secretsOf } =
      await import('@/src/lib/reading/match-input-eval');
    const { storedChartOf } = await import('@/src/lib/input/stored');
    const { relationSentence, RELATIONS } = await import('@/src/lib/people');

    const dry = process.env.READING_MATCH_DRY === '1';
    const repeat = Number(process.env.READING_MATCH_REPEAT ?? '3');
    const maxCalls = Number(process.env.READING_MATCH_MAX_CALLS ?? '24');
    const concurrency = Number(process.env.READING_MATCH_CONCURRENCY ?? '2');
    const pairFile = process.env.READING_MATCH_PAIR_FILE;
    const variants = MATCH_INPUT_VARIANTS;
    const { guideFor } = await import('@/src/lib/reading/match-reading-guide');
    const appendTo = process.env.READING_MATCH_RUN_DIR;

    type Subject = {
      id: string;
      asks: string;
      charts: ReturnType<typeof chartsOf>;
      secrets: ReturnType<typeof secretsOf>;
      about: { names: null; relation: (typeof RELATIONS)[number] | null };
      /** 기록에 남길 출처 — 출생 원문은 안 적는다 */
      source: Record<string, unknown>;
    };

    const subjects: Subject[] = [];
    if (pairFile) {
      const pair = JSON.parse(readFileSync(pairFile, 'utf8'));
      if (pair.relation !== null && !(RELATIONS as readonly string[]).includes(pair.relation)) {
        throw new Error(`모르는 사이: ${pair.relation}`);
      }
      subjects.push({
        id: pair.id,
        asks: '저장된 명식 한 쌍 — 사람 이름 대신 A·B 로 부른다',
        charts: {
          a: sajuOf(storedChartOf(pair.a.revision, 'A')),
          b: sajuOf(storedChartOf(pair.b.revision, 'B')),
        },
        secrets: [pair.a.revision, pair.b.revision].map((revision) => ({
          originalDate: revision.original_date,
          solarDate: revision.solar_date,
          birthTime: revision.birth_time,
          city: revision.city,
        })),
        about: { names: null, relation: pair.relation },
        source: {
          kind: 'pair-file',
          personIds: [pair.a.personId, pair.b.personId],
          revisionIds: [pair.a.revisionId, pair.b.revisionId],
        },
      });
    } else {
      const wanted = process.env.READING_MATCH_FIXTURES?.split(',').map((id) => id.trim());
      const fixtures = MATCH_INPUT_FIXTURES.filter((fixture) => !wanted || wanted.includes(fixture.id));
      if (wanted && fixtures.length !== wanted.length) throw new Error(`모르는 표본: ${wanted.join(',')}`);
      for (const fixture of fixtures) {
        subjects.push({
          id: fixture.id,
          asks: fixture.asks,
          charts: chartsOf(fixture),
          secrets: secretsOf(fixture),
          about: { names: null, relation: null },
          source: { kind: 'fixture' },
        });
      }
    }

    const built = new Map(
      subjects.flatMap((subject) =>
        variants.map((variant) => {
          const reading = readingEvidenceOf('match', subject.charts, new Date(VARIANTS_VIEWED_AT), variant.assembly.matchInput);
          if (reading.kind !== 'match') throw new Error('인연 궁합이 아니다');
          const prompt = readingPromptOf(reading, variant.assembly, subject.about);
          const hash = createHash('sha256').update(prompt).digest('hex').slice(0, 16);
          return [`${subject.id}|${variant.id}` as string, { subject, variant, reading, prompt, hash }] as const;
        }),
      ),
    );

    /**
     * **부르기 전에 잰다** — 사이와 판이 실제 최종 프롬프트에 실렸는가. 안 실렸는데 부르면
     * 돈을 내고 다른 실험을 한다.
     */
    for (const [key, { subject, variant, reading, prompt }] of built) {
      const [head] = prompt.split('\n## 자료 (');
      const json = JSON.stringify(reading.evidence);
      const extended = variant.assembly.matchInput === 'extended-v1';
      if (subject.about.relation !== null && !head.includes(relationSentence(subject.about.relation))) {
        throw new Error(`${key}: 사이 문장이 프롬프트에 없다`);
      }
      if (reading.evidence.contract.matchInput !== variant.assembly.matchInput) throw new Error(`${key}: 자료의 판이 다르다`);
      /* 읽는 법을 싣는 판이면 그 경로가 전부 이 자료에 있어야 한다 — 없는 경로를 설명하지 않는다 */
      const guided = variant.assembly.pairReading !== 'plain-v1';
      if (head.includes('## 이 자료를 읽는 법') !== guided) throw new Error(`${key}: 읽는 법이 판과 어긋난다`);
      if (guided) {
        for (const entry of guideFor(variant.assembly.matchInput)) {
          const leaf = entry.path.split('.').pop()!.replace('[]', '');
          if (!json.includes(`"${leaf}"`)) throw new Error(`${key}: 읽는 법의 ${entry.path} 가 자료에 없다`);
        }
      }
      /* 점수표의 억부 줄은 v17 에서 걷었다 — 기준점이 이미 담는다(ADR 0113) */
      if (json.includes('"eokbuMatch"') !== extended || head.includes('용신을 상대가 가졌다')) {
        throw new Error(`${key}: 억부 근거와 점수표가 판과 어긋난다`);
      }
      /* 계약의 `withheld` 는 뺀 자리의 이름을 든다 — 값이 실렸는지는 계약 밖에서 본다 */
      const values = JSON.stringify({ ...reading.evidence, contract: null });
      if (values.includes('"gender"') || values.includes('lateNightRule')) throw new Error(`${key}: 입력 메타가 실렸다`);
    }
    for (const subject of subjects) {
      const baselines = new Set(variants.map((v) => built.get(`${subject.id}|${v.id}`)!.reading.baseline));
      if (baselines.size !== 1) throw new Error(`${subject.id}: 두 판의 기준점이 다르다`);
    }

    loadLocalEnv();
    const { GENERATION } = await import('@/app/me/reading/generation');
    const at = runStamp(new Date());
    const dir = appendTo ?? `${OUTPUT_ROOT}/match-input-${dry ? 'dry-' : ''}${subjects.length === 1 ? `${subjects[0].id}-` : ''}${at}`;
    const hashes = Object.fromEntries([...built].map(([key, { hash }]) => [key, hash]));

    type Line = import('@/src/lib/reading/match-input-eval').MatchRunRecord & {
      baseline: number;
      usage: unknown;
      output: { markdown: string; score: number | null; metaphor: string } | null;
      contractDeviations: readonly string[];
      targetDeviations: readonly string[];
    };
    let previous: Line[] = [];
    let seed = Math.floor(Math.random() * 1_000_000);

    if (appendTo) {
      if (!existsSync(`${dir}/manifest.json`)) throw new Error(`이어 붙일 실행이 없다: ${dir}`);
      const manifest = JSON.parse(readFileSync(`${dir}/manifest.json`, 'utf8'));
      if (JSON.stringify(manifest.promptHashes) !== JSON.stringify(hashes)) {
        throw new Error('이어 붙일 실행과 프롬프트가 다르다 — 같은 조건이 아니므로 부르지 않는다');
      }
      if (JSON.stringify(manifest.generation) !== JSON.stringify(GENERATION)) throw new Error('생성 설정이 다르다');
      seed = manifest.seed;
      previous = existsSync(`${dir}/runs.jsonl`)
        ? readFileSync(`${dir}/runs.jsonl`, 'utf8').trim().split('\n').filter(Boolean).map((line) => JSON.parse(line))
        : [];
    }

    const planned = [...built.values()].flatMap(({ subject, variant }) => {
      const done = previous.filter((line) => line.fixture === subject.id && line.variant === variant.id);
      const from = done.reduce((max, line) => Math.max(max, line.rep), 0);
      return Array.from({ length: repeat }, (_, index) => ({ key: `${subject.id}|${variant.id}`, rep: from + index + 1 }));
    });
    if (!dry && planned.length > maxCalls) {
      throw new Error(`계획 ${planned.length}콜이 상한 ${maxCalls}콜을 넘는다 — READING_MATCH_MAX_CALLS 로 올린다`);
    }

    mkdirSync(dir, { recursive: true });
    if (!appendTo) {
      writeFileSync(
        `${dir}/manifest.json`,
        JSON.stringify(
          {
            at,
            dry,
            purpose: 'AI 설명 품질 비교 — 실제 관계 성공률 검증이 아니다',
            promptVersion: READING_POLICY.version,
            generation: GENERATION,
            viewedAt: VARIANTS_VIEWED_AT,
            seed,
            maxCalls,
            scoreAdjustment: READING_POLICY.scoreAdjustment,
            scoreDiscretion: READING_POLICY.scoreDiscretion,
            subjects: subjects.map(({ id, asks, about, source }) => ({
              id,
              asks,
              relation: about.relation,
              source,
              baseline: built.get(`${id}|${variants[0].id}`)!.reading.baseline,
            })),
            variants: variants.map(({ id, label, addedEvidence, promptChanges, assembly }) => ({
              id,
              label,
              matchInput: assembly.matchInput,
              pairReading: assembly.pairReading,
              fields: MATCH_INPUT_FIELDS[assembly.matchInput],
              addedEvidence,
              promptChanges,
            })),
            promptHashes: hashes,
            promptChars: Object.fromEntries([...built].map(([key, { prompt }]) => [key, prompt.length])),
          },
          null,
          2,
        ),
      );
    }

    if (dry) {
      for (const [key, { prompt }] of built) writeFileSync(`${dir}/${key.replace('|', '--')}.prompt.md`, prompt);
      return;
    }

    const { callModel } = await import('@/app/me/reading/model');
    const fresh: Line[] = [];
    let cursor = 0;

    /** **다시 부르지 않는다** — 실패도 한 번의 결과다 */
    const worker = async () => {
      while (cursor < planned.length) {
        const { key, rep } = planned[cursor++];
        const { subject, variant, reading, prompt } = built.get(key)!;
        // 운영 파이프라인과 같은 규칙으로 요약 차례를 정한다
        const summaryLast = writesSummaryLast('match', variant.assembly);
        const called = await callModel(prompt, { summaryLast });

        const line: Line = called.ok
          ? (() => {
              const deviations = pairOutputDeviations('match', measureMarkdown(called.output.markdown), variant.assembly);
              return {
                fixture: subject.id,
                variant: variant.id,
                rep,
                ok: true,
                baseline: reading.baseline,
                usage: called.usage,
                output: called.output,
                metrics: measureMatchRun({
                  evidence: reading.evidence,
                  output: called.output,
                  baseline: reading.baseline,
                  secrets: subject.secrets,
                }),
                contractDeviations: deviations.filter((d) => d.kind === 'contract').map((d) => `${d.code}: ${d.detail}`),
                targetDeviations: deviations.filter((d) => d.kind === 'target').map((d) => `${d.code}: ${d.detail}`),
              };
            })()
          : {
              fixture: subject.id,
              variant: variant.id,
              rep,
              ok: false,
              failure: `${called.code}: ${called.detail}`,
              baseline: reading.baseline,
              /** 실패 응답은 사용량을 안 들고 온다 — 0 으로 채우지 않는다 */
              usage: null,
              output: null,
              contractDeviations: [],
              targetDeviations: [],
            };

        fresh.push(line);
        appendFileSync(`${dir}/runs.jsonl`, `${JSON.stringify({ ...line, calledAt: new Date().toISOString() })}\n`);
      }
    };
    await Promise.all(Array.from({ length: Math.max(1, concurrency) }, worker));

    const all = [...previous, ...fresh];
    const sum = (lines: Line[], field: 'inputTokens' | 'outputTokens' | 'totalTokens') =>
      lines.reduce((total, line) => total + (((line.usage ?? {}) as Record<string, number | null>)[field] ?? 0), 0);
    const usageOf = (lines: Line[]) => ({
      calls: lines.length,
      withUsage: lines.filter((line) => line.usage !== null).length,
      inputTokens: sum(lines, 'inputTokens'),
      outputTokens: sum(lines, 'outputTokens'),
      totalTokens: sum(lines, 'totalTokens'),
    });

    const failures = all.filter((line) => !line.ok);
    const contract = all
      .filter((line) => line.ok && ((line.metrics?.blocking.length ?? 0) > 0 || line.contractDeviations.length > 0))
      .map((line) => ({ fixture: line.fixture, variant: line.variant, rep: line.rep, blocking: line.metrics!.blocking, contractDeviations: line.contractDeviations }));

    writeFileSync(
      `${dir}/verdicts.json`,
      JSON.stringify(
        {
          status: failures.length > 0 ? 'calls-failed' : contract.length > 0 ? 'complete-with-contract-violations' : 'complete',
          calls: {
            thisRun: { planned: planned.length, ok: fresh.filter((l) => l.ok).length, failed: fresh.filter((l) => !l.ok).length },
            total: { ok: all.filter((l) => l.ok).length, failed: failures.length },
            failures: failures.map(({ fixture, variant, rep, failure }) => ({ fixture, variant, rep, failure })),
          },
          contract,
          humanReview: all
            .filter((line) => line.ok)
            .map((line) => ({
              fixture: line.fixture,
              variant: line.variant,
              rep: line.rep,
              unknownRelations: line.metrics!.unknownRelations,
              absentPaths: line.metrics!.absentPaths,
              relationCoverage: line.metrics!.relationCoverage,
              seatSentences: line.metrics!.seatSentences,
              personalDrift: line.metrics!.personalDrift,
              reviewCandidates: line.metrics!.reviewCandidates ?? {},
              targetDeviations: line.targetDeviations,
            })),
          usage: { thisRun: usageOf(fresh), total: usageOf(all) },
        },
        null,
        2,
      ),
    );
    writeFileSync(`${dir}/aggregate.json`, JSON.stringify(aggregateMatchRuns(all), null, 2));

    const packet = blindPacket(
      all.filter((line) => line.ok).map((line) => ({ fixture: line.fixture, variant: line.variant, rep: line.rep, ...line.output! })),
      seed,
    );
    writeFileSync(`${dir}/blind.md`, packet.markdown);
    writeFileSync(`${dir}/key.json`, JSON.stringify(packet.key, null, 2));

    /** 호출이 하나라도 실패했으면 이 실험은 성공이 아니다 */
    expect(fresh.filter((line) => !line.ok).map((line) => `${line.fixture}/${line.variant}/${line.rep} ${line.failure}`), dir).toEqual([]);
    expect(fresh).toHaveLength(planned.length);
  });
});
