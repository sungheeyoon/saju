import { openai } from '@ai-sdk/openai';
import OpenAI from 'openai';
import { NoOutputGeneratedError, Output, generateText, jsonSchema, type JSONSchema7 } from 'ai';

import { READING_POLICY, type ReadingOutput } from '@/src/lib/reading';

import { GENERATION } from './generation';

import type { ModelCall, ModelRetrieval, ModelSubmission, ReadingGenerator } from './generator';

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
/**
 * **한 벌이다.** AI SDK 쪽과 Responses API 쪽이 같은 것을 문다 — 복사하면 두 벌이 되고,
 * 어긋난 날 어느 쪽이 진짜인지 알 수 없다.
 */
const OUTPUT_SHAPE = {
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
} satisfies JSONSchema7;

const SCHEMA = jsonSchema<ReadingOutput>(OUTPUT_SHAPE);

/** provider 의 오류 문장. 출생 원문이 실릴 자리가 아니다 — 프롬프트에 그 값이 없다 */
const messageOf = (failure: unknown): string =>
  failure instanceof Error ? failure.message : String(failure);

/**
 * 프롬프트 하나를 보내고 결과를 받는다.
 *
 * **던지지 않는다.** 실패도 값으로 낸다 — 부르는 쪽은 실패를 기록하고 직전 성공
 * 결과를 그대로 두어야 하므로, 예외로 빠져나가면 그 기록이 남지 않는다.
 */
export async function callModel(prompt: string): Promise<ModelCall> {
  try {
    const { output, usage, response } = await generateText({
      model: openai(GENERATION.model),
      output: Output.object({ schema: SCHEMA }),
      prompt,
      timeout: GENERATION.settings.timeout,
      providerOptions: {
        openai: { store: GENERATION.settings.store },
      },
    });

    /**
     * 쓴 양과 **실제로 답한 모델**을 함께 낸다.
     *
     * 요청한 이름(`GENERATION.model`)과 응답한 이름이 다를 수 있다 — 별칭이
     * 어느 판으로 풀렸는지는 응답만 안다. 되짚을 때 볼 곳이 하나여야 하므로
     * 둘 중 응답 쪽을 남긴다.
     *
     * 못 받은 자리는 `null` 이다. 0 으로 채우면 비용이 조용히 0 이 된다.
     */
    return {
      ok: true,
      output,
      usage: {
        inputTokens: usage?.inputTokens ?? null,
        noCacheTokens: usage?.inputTokenDetails?.noCacheTokens ?? null,
        cacheReadTokens: usage?.inputTokenDetails?.cacheReadTokens ?? null,
        cacheWriteTokens: usage?.inputTokenDetails?.cacheWriteTokens ?? null,
        outputTokens: usage?.outputTokens ?? null,
        totalTokens: usage?.totalTokens ?? null,
      },
      modelId: response?.modelId ?? null,
    };
  } catch (failure) {
    if (NoOutputGeneratedError.isInstance(failure)) {
      return { ok: false, code: 'model-no-output', detail: '모델이 계약한 모양으로 내지 않았습니다' };
    }

    const detail = messageOf(failure);

    /**
     * **시간 초과는 따로 부른다.**
     *
     * 한 덩어리로 두었더니 「모델이 못 냈다」와 「우리가 기다리다 끊었다」가 같은
     * 코드로 남았다. 둘은 손댈 곳이 다르다 — 앞은 프롬프트나 스키마이고, 뒤는
     * 분량이나 문턱(`GENERATION.settings.timeout`)이다. 알림 문구도 갈려야 한다.
     */
    if (/timeout|aborted|abort/i.test(detail)) {
      return { ok: false, code: 'model-timeout', detail };
    }

    /**
     * 메시지를 그대로 남긴다. 여기 오는 것은 provider 의 오류 문장이고 출생 원문이
     * 실릴 자리가 아니다 — 프롬프트에 그 값이 없기 때문이다(ADR 0008).
     */
    return { ok: false, code: 'model-call-failed', detail };
  }
}

/** 실제 배포에서 쓰는 구현. 파이프라인은 이 객체의 계약만 안다. */
export const openAIReadingGenerator: ReadingGenerator = {
  generation: GENERATION,
  generate: callModel,
};

// ---------------------------------------------------------------------------
// 요청 수명 밖에서 도는 길 — 제출과 회수 (ADR 0020)
// ---------------------------------------------------------------------------

/**
 * **같은 경계 안에 둔다.**
 *
 * 제출과 회수가 갈린다고 자리를 나누면 provider SDK 가 파이프라인 전체로 번진다.
 * 「모델을 부르는 유일한 자리」는 그대로이고, 달라지는 것은 그 자리가 **기다리지
 * 않는다**는 것뿐이다.
 */
const client = () => new OpenAI();

/**
 * 일을 떠나보낸다. **완성본을 기다리지 않는다.**
 *
 * `metadata.reading_run_id` 를 함께 싣는 것이 이 함수에서 가장 중요한 한 줄이다.
 * 제출은 됐는데 우리 쪽에 `response_id` 를 적기 전에 끊기면 그 작업은 주인을 잃는다 —
 * 돈은 나가고 결과는 아무 데도 안 붙는다. **이름표를 결과에 붙여 보내는 것이 우리 쪽
 * 기록보다 먼저다**(ADR 0020).
 */
export async function submitBackgroundReading(
  prompt: string,
  runId: string,
): Promise<ModelSubmission> {
  try {
    const response = await client().responses.create({
      model: GENERATION.model,
      input: prompt,
      background: true,
      store: GENERATION.settings.store,
      metadata: { reading_run_id: runId },
      text: {
        format: {
          type: 'json_schema',
          name: 'reading',
          strict: true,
          schema: OUTPUT_SHAPE,
        },
      },
    });

    return { ok: true, responseId: response.id };
  } catch (failure) {
    return { ok: false, code: 'model-submit-failed', detail: messageOf(failure) };
  }
}

/**
 * 떠나보낸 것을 가져온다.
 *
 * **끝나는 길이 넷이다** — `completed` 는 글을 들고 오고, `failed`·`cancelled`·
 * `incomplete` 는 이유를 들고 온다. 나머지(`queued`·`in_progress`)는 아직 도는 중이라
 * 실패가 아니다.
 */
export async function retrieveBackgroundReading(responseId: string): Promise<ModelRetrieval> {
  try {
    const response = await client().responses.retrieve(responseId);

    if (response.status === 'queued' || response.status === 'in_progress') {
      return { ok: 'pending' };
    }

    if (response.status !== 'completed') {
      return {
        ok: false,
        // 시도 상태를 그대로 코드로 쓴다 — 우리가 이름을 새로 지으면 provider 의
        // 갈래가 늘었을 때 어디로 접혔는지 알 수 없다.
        code: `model-${response.status ?? 'unknown'}`,
        detail: response.incomplete_details?.reason ?? response.error?.message ?? '',
      };
    }

    const text = response.output_text;
    if (typeof text !== 'string' || text === '') {
      return { ok: false, code: 'model-no-output', detail: '모델이 계약한 모양으로 내지 않았습니다' };
    }

    /**
     * **여기서 던지지 않는다.** 스키마가 strict 라도 파싱은 우리 몫이고, 못 읽은 것은
     * 실패로 값이 되어야 시도가 닫힌다.
     */
    let output: ReadingOutput;
    try {
      output = JSON.parse(text) as ReadingOutput;
    } catch {
      return { ok: false, code: 'model-no-output', detail: '결과를 읽지 못했습니다' };
    }

    return {
      ok: true,
      output,
      usage: {
        inputTokens: response.usage?.input_tokens ?? null,
        noCacheTokens:
          response.usage?.input_tokens === undefined
            ? null
            : response.usage.input_tokens - (response.usage.input_tokens_details?.cached_tokens ?? 0),
        cacheReadTokens: response.usage?.input_tokens_details?.cached_tokens ?? null,
        // Responses API 는 캐시 쓰기를 따로 세지 않는다. 0 이 아니라 「못 셌다」다.
        cacheWriteTokens: null,
        outputTokens: response.usage?.output_tokens ?? null,
        totalTokens: response.usage?.total_tokens ?? null,
      },
      modelId: response.model ?? null,
    };
  } catch (failure) {
    return { ok: false, code: 'model-retrieve-failed', detail: messageOf(failure) };
  }
}
