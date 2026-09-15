import type { Saju } from '@/src/lib/saju';
import {
  CONTROL,
  ReadingEvidenceError,
  readingEvidenceOf,
  type PromptAssembly,
  readingPromptOf,
  type ReadingKind,
  NOTHING_KNOWN,
  type ReadingAbout,
  type ReadingOutput,
} from '@/src/lib/reading';

/** 저장된 Reading 하나를 재현할 수 있는 생성기 설정. */
export type ReadingGeneration = {
  readonly model: string;
  readonly provider: string;
  readonly settings: Readonly<Record<string, unknown>>;
};

/**
 * 한 번의 호출이 무엇을 썼는가 — **비용을 세려면 이것이 결과와 함께 와야 한다.**
 *
 * 칸마다 `null` 을 허용한다. provider 가 안 주는 자리가 실제로 있고, 그때
 * 「0 을 썼다」로 적으면 비용 계산이 조용히 틀린다 — 「없다」와 「못 셌다」는
 * 값 옆에 있어야 한다. 세는 쪽은 `null` 을 만나면 계산을 포기하고 멈춘다.
 */
export type ModelUsage = {
  inputTokens: number | null;
  /**
   * 입력을 셋으로 가른다 — **단가가 서로 다르기 때문이다.**
   *
   * `inputTokens` 는 셋을 합친 값이라, 그것만 들고 캐시 단가를 곱하면 값이 틀린다.
   */
  noCacheTokens: number | null;
  cacheReadTokens: number | null;
  cacheWriteTokens: number | null;
  outputTokens: number | null;
  totalTokens: number | null;
};

export type ModelCall =
  | {
      ok: true;
      output: ReadingOutput;
      /** 못 받았으면 `null`. 지어내지 않는다 */
      usage: ModelUsage | null;
      /** provider 가 실제로 답한 모델 — 우리가 **요청한** 이름과 다를 수 있다 */
      modelId: string | null;
    }
  | { ok: false; code: string; detail: string };

/**
 * 제출 결과 — **떠나보냈다는 사실까지다.**
 *
 * 여기서 글은 안 온다. 오는 것은 그 작업을 나중에 다시 찾을 이름표뿐이다.
 */
export type ModelSubmission =
  | { ok: true; responseId: string }
  | { ok: false; code: string; detail: string };

/**
 * 회수 결과 — **아직 안 끝났을 수 있다.**
 *
 * `pending` 을 실패로 접으면 복구기가 그때마다 시도를 닫아 버린다. 「못 가져왔다」와
 * 「아직 안 됐다」는 다른 말이고, 뒤엣것은 기다리면 된다.
 */
export type ModelRetrieval =
  | {
      ok: true;
      output: ReadingOutput;
      usage: ModelUsage | null;
      modelId: string | null;
      /** 우리가 실어 보낸 이름표. 이름표로 일감을 못 찾았을 때 이것으로 되찾는다 */
      runId: string | null;
    }
  | { ok: 'pending' }
  /** **실패도 쓴 양을 들고 온다** — 다 돌고 나서 끝난 갈래가 있다(ADR 0039) */
  | { ok: false; code: string; detail: string; usage: ModelUsage | null };

/** 자르고 프롬프트를 지은 것까지 — **모델은 안 부른다** */
export type ReadingInput = { prompt: string; evidenceText: string };

export type InputResult =
  | { ok: true; input: ReadingInput }
  | { ok: false; code: string; detail: string };

/**
 * 자르기와 프롬프트 짓기 — **여기까지가 보내기 전이다.**
 *
 * 만드는 일이 요청을 떠나면서(ADR 0020) 이 앞부분만 따로 필요해졌다. 보낼 것을 짓고,
 * 그 지은 것을 얼려 두고, 떠나보낸다. 완성본은 한참 뒤에 다른 길로 온다.
 */
export function readingInputOf({
  kind,
  charts,
  viewedAt,
  about,
  assembly = CONTROL,
}: {
  kind: ReadingKind;
  charts: { a: Saju; b?: Saju };
  viewedAt: Date;
  about?: ReadingAbout;
  /**
   * **자료와 지시가 같은 조립에서 나온다.** 인연 궁합 자료의 판(`matchInput`)을 여기서 따로 기본값으로
   * 고르면, 원복하려고 `CONTROL` 만 바꾼 날 자료와 지시가 갈려 생성이 멈춘다(ADR 0067).
   */
  assembly?: PromptAssembly;
}): InputResult {
  let evidence;
  try {
    evidence = readingEvidenceOf(kind, charts, viewedAt, assembly.matchInput);
  } catch (failure) {
    if (failure instanceof ReadingEvidenceError) {
      return { ok: false, code: 'evidence-incomplete', detail: failure.message };
    }
    throw failure;
  }

  return {
    ok: true,
    input: {
      prompt: readingPromptOf(evidence, assembly, about ?? NOTHING_KNOWN),
      evidenceText: JSON.stringify(evidence.evidence),
    },
  };
}
