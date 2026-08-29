import { openai } from '@ai-sdk/openai';
import { NoOutputGeneratedError, Output, generateText, jsonSchema } from 'ai';

import { READING_POLICY, type ReadingOutput } from '@/src/lib/reading';

import { GENERATION } from './generation';

import type { ModelCall, ReadingGenerator } from './generator';

/**
 * **모델을 부르는 유일한 자리.**
 *
 * 어느 모델을 어떻게 부르는지가 여기 하나로 모여 있어야, 저장된 결과가 무엇으로
 * 만들어졌는지 되짚을 때 볼 곳이 하나다. 부르는 쪽은 프롬프트만 넘긴다.
 *
 * ## OpenAI Responses API 를 직접 부른다
 *
 * `@ai-sdk/openai` 의 provider 가 서버 환경의 `OPENAI_API_KEY` 를 읽는다. 키를 코드나
 * 브라우저에 싣지 않고도 **모델을 바꾸는 일은 문자열 한 줄**로 남는다 — 9단계가 실험
 * 인프라라는 말이 코드에서도 참이려면 그 자리가 싸야 한다. Responses API 의 원격 저장은
 * 끈다. 현재 Reading 을 우리 DB 에 보존하는 규율과 provider 쪽 보존을 섞지 않기 위해서다.
 *
 * 모델 이름과 설정은 `generation.ts` 가 든다 — 결과 옆에 「무엇으로 만든 것인가」를
 * 함께 남기는 자리들이 그 값을 읽어야 하는데, 여기서 읽어 가면 provider SDK 가 딸려 온다.
 */


/**
 * 모델이 낼 것의 **모양.**
 *
 * 점수를 `null` 이 될 수 있게 열어 둔다. kind 마다 있어야 하는지 아닌지는 스키마가
 * 아니라 **검사**가 판정한다(`checkReading`) — 스키마로 막아 버리면 모델이 규칙을
 * 어겼을 때 그것을 잡는 검사가 한 번도 안 서고, 그 검사가 실제로 무는지 알 수 없다.
 */
const SCHEMA = jsonSchema<ReadingOutput>({
  type: 'object',
  properties: {
    score: {
      type: ['integer', 'null'],
      minimum: READING_POLICY.scoreRange.min,
      maximum: READING_POLICY.scoreRange.max,
      description: '궁합 결과일 때만 채운다. 한 사람의 풀이에는 null',
    },
    markdown: { type: 'string', description: '사용자가 읽을 본문. Markdown 원문' },
  },
  required: ['score', 'markdown'],
  additionalProperties: false,
});

/**
 * 프롬프트 하나를 보내고 결과를 받는다.
 *
 * **던지지 않는다.** 실패도 값으로 낸다 — 부르는 쪽은 실패를 기록하고 직전 성공
 * 결과를 그대로 두어야 하므로, 예외로 빠져나가면 그 기록이 남지 않는다.
 */
export async function callModel(prompt: string): Promise<ModelCall> {
  try {
    const { output } = await generateText({
      model: openai(GENERATION.model),
      output: Output.object({ schema: SCHEMA }),
      prompt,
      timeout: GENERATION.settings.timeout,
      providerOptions: {
        openai: { store: GENERATION.settings.store },
      },
    });

    return { ok: true, output };
  } catch (failure) {
    if (NoOutputGeneratedError.isInstance(failure)) {
      return { ok: false, code: 'model-no-output', detail: '모델이 계약한 모양으로 내지 않았습니다' };
    }

    /**
     * 메시지를 그대로 남긴다. 여기 오는 것은 provider 의 오류 문장이고 출생 원문이
     * 실릴 자리가 아니다 — 프롬프트에 그 값이 없기 때문이다(ADR 0008).
     */
    return {
      ok: false,
      code: 'model-call-failed',
      detail: failure instanceof Error ? failure.message : String(failure),
    };
  }
}

/** 실제 배포에서 쓰는 구현. 파이프라인은 이 객체의 계약만 안다. */
export const openAIReadingGenerator: ReadingGenerator = {
  generation: GENERATION,
  generate: callModel,
};
