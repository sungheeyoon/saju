import 'server-only';

import { openai } from '@ai-sdk/openai';
import OpenAI from 'openai';
import { NoOutputGeneratedError, Output, generateText, jsonSchema, type JSONSchema7 } from 'ai';

import { READING_POLICY, type ReadingOutput } from '@/src/lib/reading';
import { CONTINUATION_ANSWER_PROPERTY } from '@/src/lib/reading/continuation';

import { GENERATION } from './generation';

import type { ModelCall, ModelRetrieval, ModelSubmission, ModelUsage } from './generator';

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
    metaphor: {
      type: 'string',
      description:
        '비유나 형세 표현 없이, 이 사람 또는 두 사람의 핵심 작동 방식을 직접 설명한 한 줄 요약',
    },
    markdown: { type: 'string', description: '사용자가 읽을 본문. Markdown 원문' },
  },
  required: ['score', 'metaphor', 'markdown'],
  additionalProperties: false,
} satisfies JSONSchema7;

/**
 * **본문을 먼저, 한 줄 요약을 마지막에** — 두 궁합의 읽는 법 4판이 쓴다(ADR 0067, `writesSummaryLast`).
 *
 * 운영 모양은 `score · metaphor · markdown` 차례라 요약이 본문보다 먼저 지어진다. 구조화 출력은 속성 차례대로
 * 짓으므로, 요약을 본문의 핵심으로 쓰게 하려면 차례를 바꿔야 한다. 필드와 뜻은 같다.
 */
const SUMMARY_LAST_SHAPE = {
  ...OUTPUT_SHAPE,
  properties: {
    markdown: OUTPUT_SHAPE.properties.markdown,
    score: OUTPUT_SHAPE.properties.score,
    metaphor: OUTPUT_SHAPE.properties.metaphor,
  },
  required: ['markdown', 'score', 'metaphor'],
} satisfies JSONSchema7;

/**
 * **이어쓰기 답을 맨 앞에** — 맛보기를 읽고 가입한 사람의 자기 풀이 실험이 쓴다(`continuationBlockOf`,
 * `docs/notes/2026-10-03-taste-run-experiment.md`). 구조화 출력은 속성 차례대로 지으므로, 답을 본문보다 먼저 쓰게 하려면
 * 차례가 앞이어야 한다. 나머지 셋은 운영 모양 그대로다. 운영 제출(`submitBackgroundReading`)은 이어진 세션이 있을 때만
 * 이 모양으로 낸다(ADR 0143).
 */
const CONTINUATION_SHAPE = {
  ...OUTPUT_SHAPE,
  properties: {
    continuationAnswer: CONTINUATION_ANSWER_PROPERTY,
    ...OUTPUT_SHAPE.properties,
  },
  required: ['continuationAnswer', ...OUTPUT_SHAPE.required],
} satisfies JSONSchema7;

/** 실험이 견주는 추론 세기 — provider 가 받는 값 가운데 우리가 부르는 넷 */
export type ReasoningEffort = 'none' | 'low' | 'medium' | 'high';

/**
 * 기다리는 길의 선택값 — **안 넘기면 지금까지와 같다.**
 *
 * 맛보기 실험(`taste-run.live.test.ts`)이 모양 · 추론 세기 · 출력 상한 · 시간 상한을 바꿔 부르려고 넓혔다. 모델을 부르는
 * 자리가 하나여야 하므로(ADR 0047) 실험용 래퍼를 따로 세우지 않고 여기에 선택 인자로 더했다. 기본값은 그대로다 —
 * 모양은 운영 모양, 추론 세기는 안 보냄(provider 기본, 공식 문서상 `medium`), 출력 상한 없음, 시간 상한은
 * `GENERATION.settings.timeout`.
 */
type CallOptions = {
  /** 한 줄 요약을 본문 뒤에 받는가 — 운영 제출과 같은 규칙(`writesSummaryLast`)으로 넘긴다 */
  summaryLast?: boolean;
  /** 이어쓰기 답(`continuationAnswer`)을 맨 앞 칸으로 받는가 */
  continuation?: boolean;
  /** 모양을 통째로 갈아 끼운다 — 맛보기(`tasteRunShapeOf`). 주면 위 둘은 안 본다 */
  shape?: JSONSchema7;
  /**
   * 추론 세기 — `@ai-sdk/openai` 의 Responses 선택값 `reasoningEffort`(그 패키지 안의 문서 03-openai.mdx 「Responses」 절: GPT-5.6 은
   * `none` · `low` · `medium` · `high` · `xhigh` · `max`). 안 넘기면 보내지 않는다.
   */
  reasoningEffort?: ReasoningEffort;
  /** 출력 토큰 상한 — 추론 토큰을 포함한다(Responses `max_output_tokens`) */
  maxOutputTokens?: number;
  /** 기다리다 마는 시각(ms) — 안 넘기면 `GENERATION.settings.timeout` */
  timeoutMs?: number;
};

const shapeOf = (options: CallOptions): JSONSchema7 => {
  if (options.shape !== undefined) return options.shape;
  if (options.continuation === true) return CONTINUATION_SHAPE;
  return options.summaryLast === true ? SUMMARY_LAST_SHAPE : OUTPUT_SHAPE;
};

/** provider 의 오류 문장. 출생 원문이 실릴 자리가 아니다 — 프롬프트에 그 값이 없다 */
const messageOf = (failure: unknown): string =>
  failure instanceof Error ? failure.message : String(failure);

/**
 * 응답이 든 토큰 수를 우리 모양으로 — **한 자리에서만 옮긴다.**
 *
 * 성공과 실패가 각자 이 셈을 적으면 언젠가 한쪽만 고쳐지고, 그때 실패 쪽 지출이
 * 조용히 다른 값이 된다.
 */
const usageOf = (response: {
  usage?: {
    input_tokens?: number;
    output_tokens?: number;
    total_tokens?: number;
    input_tokens_details?: { cached_tokens?: number };
  } | null;
}): ModelUsage => ({
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
});

/**
 * 프롬프트 하나를 보내고 결과를 **그 자리에서** 받는다.
 *
 * **화면은 이 길로 오지 않는다** — 누름은 `submitBackgroundReading` 으로 떠나보내고
 * 완성본은 webhook 이나 복구기가 가져온다(ADR 0020). 이 함수를 부르는 것은 운영자가 손으로 돌리는
 * 실호출 시험 셋(`app/me/reading/call.live.test.ts` · `app/me/reading/taste.live.test.ts` ·
 * `app/me/reading/taste-run.live.test.ts`)뿐이다. 프롬프트를 고친 뒤 기다리는 길로 한 번에 재 보는 자리라 남긴다.
 * 선택 인자(`CallOptions`)를 안 넘기면 모양 · 세기 · 상한이 지금까지와 같다.
 *
 * **던지지 않는다.** 실패도 값으로 낸다 — 부르는 쪽은 실패를 기록하고 직전 성공
 * 결과를 그대로 두어야 하므로, 예외로 빠져나가면 그 기록이 남지 않는다.
 */
export async function callModel<Produced = ReadingOutput>(
  prompt: string,
  options: CallOptions = {},
): Promise<ModelCall<Produced>> {
  try {
    const { output, usage, response } = await generateText({
      model: openai(GENERATION.model),
      output: Output.object({ schema: jsonSchema<Produced>(shapeOf(options)) }),
      prompt,
      timeout: options.timeoutMs ?? GENERATION.settings.timeout,
      ...(options.maxOutputTokens === undefined ? {} : { maxOutputTokens: options.maxOutputTokens }),
      providerOptions: {
        openai: {
          store: GENERATION.settings.store,
          /**
           * 세기를 넘길 때만 싣는다. `none` 이 아니면 provider 가 추론 요약을 `detailed` 로 켜는데(같은 문서), 운영 길은
           * 요약을 안 받으므로 `null` 로 꺼서 견주는 값이 요약 몫으로 흔들리지 않게 한다.
           */
          ...(options.reasoningEffort === undefined
            ? {}
            : { reasoningEffort: options.reasoningEffort, reasoningSummary: null }),
        },
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
      reasoningTokens: usage?.outputTokenDetails?.reasoningTokens ?? null,
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
 *
 * ## 스트림으로 떠나보낸다 (ADR 0127)
 *
 * `background` 응답은 **만들 때 `stream: true` 가 아니면 나중에 스트림으로 못 읽는다**(OpenAI 문서). 그래서 제출
 * 자체를 스트림으로 하고, 첫 사건(`response.created`)에서 이름표를 받아 곧바로 돌아온다. 남은 사건은 `written` 이
 * 본문 조각(JSON 글자 그대로)만 골라 흘려 준다 — 받는 쪽은 절 머리만 세고 글은 한 자도 안 남긴다. 완성본은 지금처럼
 * webhook · 복구기가 가져와 검사한다.
 *
 * **따라 읽기를 그만둬도 만들던 것은 안 멈춘다** — background 응답은 연결이 끊겨도 provider 쪽에서 끝까지 돈다.
 * `written` 을 끝까지 안 읽으면 연결만 닫는다.
 */
export async function submitBackgroundReading(
  prompt: string,
  runId: string,
  /**
   * 한 줄 요약을 본문 뒤에 받는가 — **두 궁합의 4판만**(`writesSummaryLast`, ADR 0067). 필드와 뜻은 같고
   * 차례만 다르다. 안 넘기면 운영 차례 그대로다.
   */
  options: {
    summaryLast?: boolean;
    /**
     * 이어쓰기 답(`continuationAnswer`)을 맨 앞 칸으로 받는가 — 귀속된 맛보기가 이 시도에 이어졌을 때만(ADR 0143). 안 넘기면
     * 운영 모양 그대로다. 자기 풀이에만 오므로 두 궁합의 차례(`summaryLast`)와 함께 오지 않는다.
     */
    continuation?: boolean;
  } = {},
): Promise<ModelSubmission> {
  try {
    const stream = await client().responses.create({
      model: GENERATION.model,
      input: prompt,
      background: true,
      stream: true,
      store: GENERATION.settings.store,
      metadata: { reading_run_id: runId },
      text: {
        format: {
          type: 'json_schema',
          name: 'reading',
          strict: true,
          schema: options.continuation ? CONTINUATION_SHAPE : options.summaryLast ? SUMMARY_LAST_SHAPE : OUTPUT_SHAPE,
        },
      },
    });

    const events = stream[Symbol.asyncIterator]();
    for (;;) {
      const next = await events.next();
      if (next.done === true) {
        return { ok: false, code: 'model-submit-failed', detail: '이름표를 받기 전에 스트림이 끝났습니다' };
      }
      const event = next.value;
      if (event.type === 'error') {
        stream.controller.abort();
        return { ok: false, code: 'model-submit-failed', detail: event.message };
      }
      if ('response' in event && typeof event.response?.id === 'string') {
        return { ok: true, responseId: event.response.id, written: textOf(events, stream.controller) };
      }
    }
  } catch (failure) {
    return { ok: false, code: 'model-submit-failed', detail: messageOf(failure) };
  }
}

/**
 * 남은 사건에서 **본문 조각만** 흘린다 — 끝나는 사건이 오면 멈춘다.
 *
 * 받는 쪽이 도중에 그만두면(`return`) 연결을 닫는다. 붙들고 있으면 함수가 그만큼 더 산다.
 */
async function* textOf(
  events: AsyncIterator<OpenAI.Responses.ResponseStreamEvent>,
  controller: AbortController,
): AsyncGenerator<string, void, undefined> {
  try {
    for (;;) {
      const next = await events.next();
      if (next.done === true) return;
      const event = next.value;
      if (event.type === 'response.output_text.delta') {
        yield event.delta;
        continue;
      }
      if (
        event.type === 'response.completed' ||
        event.type === 'response.failed' ||
        event.type === 'response.incomplete' ||
        event.type === 'error'
      ) {
        return;
      }
    }
  } finally {
    controller.abort();
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

    /**
     * **끝난 것은 실패여도 쓴 양을 들고 온다.**
     *
     * `incomplete` 는 모델이 다 돌다가 상한에 걸린 것이라 토큰이 이미 나갔다. 여기서
     * 안 실으면 그 지출이 어디에도 안 남는다(ADR 0039).
     */
    if (response.status !== 'completed') {
      return {
        ok: false,
        // 시도 상태를 그대로 코드로 쓴다 — 우리가 이름을 새로 지으면 provider 의
        // 갈래가 늘었을 때 어디로 접혔는지 알 수 없다.
        code: `model-${response.status ?? 'unknown'}`,
        detail: response.incomplete_details?.reason ?? response.error?.message ?? '',
        usage: usageOf(response),
      };
    }

    const text = response.output_text;
    if (typeof text !== 'string' || text === '') {
      return {
        ok: false,
        code: 'model-no-output',
        detail: '모델이 계약한 모양으로 내지 않았습니다',
        usage: usageOf(response),
      };
    }

    /**
     * **여기서 던지지 않는다.** 스키마가 strict 라도 파싱은 우리 몫이고, 못 읽은 것은
     * 실패로 값이 되어야 시도가 닫힌다.
     */
    let output: ReadingOutput & { continuationAnswer?: string };
    try {
      output = JSON.parse(text) as ReadingOutput & { continuationAnswer?: string };
    } catch {
      return { ok: false, code: 'model-no-output', detail: '결과를 읽지 못했습니다', usage: usageOf(response) };
    }

    return {
      ok: true,
      output,
      usage: usageOf(response),
      modelId: response.model ?? null,
      runId: (response.metadata?.reading_run_id as string | undefined) ?? null,
    };
  } catch (failure) {
    // 회수 자체가 안 됐다. 무엇을 썼는지 물어볼 데가 없다 — 0 이 아니라 `null` 이다.
    return { ok: false, code: 'model-retrieve-failed', detail: messageOf(failure), usage: null };
  }
}

/**
 * 이 요청이 정말 provider 가 보낸 것인가.
 *
 * **던지지 않는다.** 서명이 안 맞는 것은 흔한 일이고(누가 그 주소를 두드릴 수 있다)
 * 예외로 빠져나가면 라우트가 500 을 낸다 — 500 은 재전송을 부르는데, 서명이 안 맞는
 * 요청은 다시 와도 똑같이 안 맞는다.
 */
export async function verifyReadingWebhook(
  payload: string,
  headers: Headers,
): Promise<
  | { ok: true; id: string; responseId: string; type: string }
  | { ok: false; detail: string }
> {
  try {
    const event = await client().webhooks.unwrap(payload, headers);

    /**
     * 우리가 아는 것은 response 사건뿐이다. 다른 것이 오면 **적지 않고 지나간다** —
     * 영수증에 우리가 처리하지도 않을 사건이 쌓이면 「안 집힌 것」을 세는 자리가 흐려진다.
     */
    if (!event.type.startsWith('response.')) {
      return { ok: false, detail: `다루지 않는 사건입니다: ${event.type}` };
    }

    return {
      ok: true,
      id: event.id,
      responseId: (event.data as { id: string }).id,
      type: event.type,
    };
  } catch (failure) {
    return { ok: false, detail: messageOf(failure) };
  }
}
