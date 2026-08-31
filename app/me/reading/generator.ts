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

export type ModelCall =
  | { ok: true; output: ReadingOutput }
  | { ok: false; code: string; detail: string };

/**
 * 교체 가능한 생성 경계.
 *
 * 파이프라인은 SDK나 특정 provider를 알지 않고 이 계약만 부른다. 실제 게이트웨이와
 * 테스트 fake가 같은 모양을 쓰므로 provider 교체가 redaction·prompt·검사를 우회하지 않는다.
 */
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
