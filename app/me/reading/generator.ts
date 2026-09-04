import type { Saju } from '@/src/lib/saju';
import {
  CONTROL,
  ReadingEvidenceError,
  checkReading,
  readingEvidenceOf,
  readingPromptOf,
  type BirthSecret,
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
 * 교체 가능한 생성 경계.
 *
 * 파이프라인은 SDK나 특정 provider를 알지 않고 이 계약만 부른다. 실제 게이트웨이와
 * 테스트 fake가 같은 모양을 쓰므로 provider 교체가 redaction·prompt·검사를 우회하지 않는다.
 */
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

export interface ReadingGenerator {
  readonly generation: ReadingGeneration;
  generate(prompt: string): Promise<ModelCall>;
}

export type ReadingArtifact = {
  readonly output: ReadingOutput;
  /** 실제 모델에 보낸 Evidence 직렬화 그대로 */
  readonly evidenceText: string;
  /** 실제 모델에 보낸 versioned prompt 그대로 */
  readonly prompt: string;
};

/**
 * **쓴 토큰은 실패에도 실린다.**
 *
 * 모델이 다 돌고 나서 우리 검사가 무는 자리가 있다 — 그때 글은 없지만 돈은 나갔다.
 * 여기서 안 들고 나오면 그 지출을 적을 자리가 영영 없다(ADR 0039).
 *
 * 모델을 부르기도 전에 끝난 갈래는 `null` 이다. 0 이 아니다 — 「안 썼다」와 「못 셌다」는
 * 다른 사실이고, 0 으로 적으면 그 둘이 같은 값이 된다.
 */
export type ArtifactResult =
  | { ok: true; artifact: ReadingArtifact; usage: ModelUsage | null }
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
 *
 * `generateReadingArtifact` 가 이것을 그대로 쓴다 — **한 벌이어야** 옛 길과 새 길이
 * 같은 프롬프트를 보낸다.
 */
export function readingInputOf({
  kind,
  charts,
  viewedAt,
  about,
}: {
  kind: ReadingKind;
  charts: { a: Saju; b?: Saju };
  viewedAt: Date;
  about?: ReadingAbout;
}): InputResult {
  let evidence;
  try {
    evidence = readingEvidenceOf(kind, charts, viewedAt);
  } catch (failure) {
    if (failure instanceof ReadingEvidenceError) {
      return { ok: false, code: 'evidence-incomplete', detail: failure.message };
    }
    throw failure;
  }

  return {
    ok: true,
    input: {
      prompt: readingPromptOf(evidence, CONTROL, about ?? NOTHING_KNOWN),
      evidenceText: JSON.stringify(evidence.evidence),
    },
  };
}

/**
 * 세 kind가 함께 쓰는 생성 코어: 자르기 → prompt → provider → 출력 검사.
 *
 * DB 접근과 현재 Reading 교체는 바깥 파이프라인의 일이다. 이 함수에는 kind별 분기가
 * 근거 범위 외에는 없으므로 self/private도 같은 경계에 연결할 준비가 되어 있다.
 */
export async function generateReadingArtifact({
  kind,
  charts,
  viewedAt,
  secrets,
  about,
  generator,
}: {
  kind: ReadingKind;
  charts: { a: Saju; b?: Saju };
  viewedAt: Date;
  secrets: readonly BirthSecret[];
  /**
   * 부르는 말과 무슨 사이인가 — **근거가 아니라 프롬프트에 실린다.**
   *
   * `readingEvidenceOf` 에 넣지 않는 것이 요점이다. 이름이나 관계가 근거에 들어가면
   * 그 값으로 판정하는 길이 열리고(「가족이라 78점」), 저장된 근거에도 남는다.
   * 부르는 말도 사이도 부르는 자리에만 선다.
   */
  about?: ReadingAbout;
  generator: ReadingGenerator;
}): Promise<ArtifactResult> {
  const made = readingInputOf({ kind, charts, viewedAt, about });
  // 보내기도 전에 끝났다 — 쓴 것이 없다.
  if (!made.ok) return { ...made, usage: null };

  const { prompt, evidenceText } = made.input;
  const called = await generator.generate(prompt);
  // 부르다 실패했다. provider 가 쓴 양을 알려 주지 않는 갈래다.
  if (!called.ok) return { ...called, usage: null };

  const verdict = checkReading({ kind, output: called.output, evidenceText, secrets });
  if (!verdict.ok) {
    return {
      ok: false,
      code: verdict.failures[0].code,
      detail: verdict.failures.map((one) => `${one.code}: ${one.detail}`).join(' · '),
      // **여기가 돈이 나간 실패다.** 모델은 다 돌았고 우리 검사가 물었다.
      usage: called.usage,
    };
  }

  return { ok: true, artifact: { output: called.output, evidenceText, prompt }, usage: called.usage };
}
