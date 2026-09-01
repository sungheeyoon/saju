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
  | { ok: false; code: string; detail: string };

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

export type ArtifactResult =
  | { ok: true; artifact: ReadingArtifact }
  | { ok: false; code: string; detail: string };

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
  let evidence;
  try {
    evidence = readingEvidenceOf(kind, charts, viewedAt);
  } catch (failure) {
    if (failure instanceof ReadingEvidenceError) {
      return { ok: false, code: 'evidence-incomplete', detail: failure.message };
    }
    throw failure;
  }

  const prompt = readingPromptOf(evidence, CONTROL, about ?? NOTHING_KNOWN);
  const called = await generator.generate(prompt);
  if (!called.ok) return called;

  const evidenceText = JSON.stringify(evidence.evidence);
  const verdict = checkReading({ kind, output: called.output, evidenceText, secrets });
  if (!verdict.ok) {
    return {
      ok: false,
      code: verdict.failures[0].code,
      detail: verdict.failures.map((one) => `${one.code}: ${one.detail}`).join(' · '),
    };
  }

  return { ok: true, artifact: { output: called.output, evidenceText, prompt } };
}
