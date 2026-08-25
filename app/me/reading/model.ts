import { NoOutputGeneratedError, Output, generateText, jsonSchema } from 'ai';

import { READING_POLICY, type ReadingOutput } from '@/src/lib/reading';

/**
 * **모델을 부르는 유일한 자리.**
 *
 * 어느 모델을 어떻게 부르는지가 여기 하나로 모여 있어야, 저장된 결과가 무엇으로
 * 만들어졌는지 되짚을 때 볼 곳이 하나다. 부르는 쪽은 프롬프트만 넘긴다.
 *
 * ## 게이트웨이를 지난다
 *
 * 모델 이름을 문자열로 적으면 Vercel AI Gateway 를 지난다. 그래서 저장소가 provider
 * 열쇠를 직접 들지 않고, **모델을 바꾸는 일이 문자열 한 줄**이 된다 — 9단계가 실험
 * 인프라라는 말이 코드에서도 참이려면 그 자리가 싸야 한다.
 */

/**
 * 지금 쓰는 모델과 **우리가 정한 생성 설정.**
 *
 * `settings` 에는 **우리가 정한 것만** 적는다. 온도를 안 적은 것은 값이다 — 그 값은
 * provider 기본값이라는 뜻이고, 안 정한 것을 정한 척 적어 두면 나중에 그 숫자를 근거로
 * 결과를 견주게 된다.
 */
export const GENERATION = {
  model: 'openai/gpt-5.6-luna',
  provider: 'vercel-ai-gateway',
  settings: {
    /**
     * **기다리다 마는 자리를 우리가 정한다.**
     *
     * 안 정하면 플랫폼이 요청을 끊는 순간이 상한이 되고, 그때는 실패를 기록할 코드가
     * 아예 안 돈다 — 시도가 `running` 인 채로 남는다. DB 가 그 행을 만료로 닫아 주지만
     * (`reading_run_timeout`), 그 전에 **우리 손으로 끝내고 실패를 적는 것**이 맞다.
     * 이 값은 그 만료보다 짧아야 뜻이 있다.
     */
    timeout: 240_000,
  },
} as const;

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

export type ModelCall =
  | { ok: true; output: ReadingOutput }
  | { ok: false; code: string; detail: string };

/**
 * 프롬프트 하나를 보내고 결과를 받는다.
 *
 * **던지지 않는다.** 실패도 값으로 낸다 — 부르는 쪽은 실패를 기록하고 직전 성공
 * 결과를 그대로 두어야 하므로, 예외로 빠져나가면 그 기록이 남지 않는다.
 */
export async function callModel(prompt: string): Promise<ModelCall> {
  try {
    const { output } = await generateText({
      model: GENERATION.model,
      output: Output.object({ schema: SCHEMA }),
      prompt,
      timeout: GENERATION.settings.timeout,
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
