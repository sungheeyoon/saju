import { GENERATION, generationSummary } from './generation';

/**
 * 채점 화면이 **기억하는 것**의 규칙 — 그리는 일과 갈라 둔다.
 *
 * 저장·복원·설정 비교가 `'use client'` 안에 있으면 시험이 한 줄도 안 닿는다. 30건을
 * 넣기 전에 브라우저에서 처음 도는 계산이 남아 있으면, **한 시간 채점한 것이 사라지는
 * 자리를 채점하면서 발견하게 된다.** 측정을 `measure.ts` 로 뺀 것과 같은 이유다.
 */

/** 회차 하나에 매기는 것 — **회차마다 따로 매긴다** */
export type RunScore = {
  /** 모델이 낸 것 그대로 — 여기서 길이·`score`·소제목 수가 나온다 */
  output: string;
  /** 자동으로 못 세는 것 — 소제목 이름이 프롬프트와 다를 수 있다 */
  missingSections: string;
  /** hard fail 이나 근거 밖 주장 */
  hardFail: string;
  concreteness: string;
  grounding: string;
  usefulness: string;
  /** 이번 라운드에만 붙는 축 — 게이트 축이 아니다 */
  answerUpFront: string;
  note: string;
};

export type Score = { runs: RunScore[] };

export const EMPTY_RUN: RunScore = {
  output: '',
  missingSections: '',
  hardFail: '',
  concreteness: '',
  grounding: '',
  usefulness: '',
  answerUpFront: '',
  note: '',
};

/**
 * 없는 칸을 `EMPTY_RUN` 으로 메워 받는다 — **형식이 한 번 더 바뀌어도 던지지 않는다.**
 *
 * 자리 이름에 판본을 박아 옛 기록이 아예 안 보이게 해 두었지만, 그것만 믿지 않는다.
 * 복원하다 던지면 화면이 통째로 안 서고, 그 상태에서 한 칸이라도 적으면 빈 것으로
 * 덮인다.
 */
export function scoresFrom(saved: string | null): Record<string, Score> {
  if (saved === null) return {};

  try {
    const parsed = JSON.parse(saved) as Record<string, { runs?: Partial<RunScore>[] }>;
    if (parsed === null || typeof parsed !== 'object') return {};

    return Object.fromEntries(
      Object.entries(parsed).map(([blind, score]) => [
        blind,
        { runs: (score?.runs ?? []).map((run) => ({ ...EMPTY_RUN, ...run })) },
      ]),
    );
  } catch {
    return {};
  }
}

/** 그 칸의 회차들 — 저장된 것이 모자라면 빈 회차로 채워 **늘 `runsPerCell` 개**를 낸다 */
export function runsOf(
  scores: Record<string, Score>,
  blind: string,
  runsPerCell: number,
): RunScore[] {
  const saved = scores[blind]?.runs ?? [];

  return Array.from({ length: runsPerCell }, (_, at) => saved[at] ?? EMPTY_RUN);
}

/** 한 회차만 고쳐 넣는다 — 나머지 회차와 다른 칸은 그대로 */
export function withRun(
  scores: Record<string, Score>,
  blind: string,
  at: number,
  patch: Partial<RunScore>,
  runsPerCell: number,
): Record<string, Score> {
  const runs = runsOf(scores, blind, runsPerCell).map((run, index) =>
    index === at ? { ...run, ...patch } : run,
  );

  return { ...scores, [blind]: { runs } };
}

/**
 * 라운드를 **언제 돌렸고 무엇으로 돌렸는가.**
 *
 * 설정 셋은 코드에 값으로 있다(`GENERATION`). 사람이 적는 것은 코드가 모르는 것
 * 하나뿐이다 — run id.
 */
export type Generation = { model: string; provider: string; settings: string };
export type RunRecord = { id: string } & Generation;

export const nowGeneration = (): Generation => ({
  model: GENERATION.model,
  provider: GENERATION.provider,
  settings: generationSummary(),
});

export const sameGeneration = (one: Generation, other: Generation): boolean =>
  one.model === other.model && one.provider === other.provider && one.settings === other.settings;

/** 옛 형식이거나 반쯤 적힌 것은 **없는 것으로 본다** — 반쪽 설정으로 기록을 짓지 않는다 */
export function runRecordFrom(saved: string | null): RunRecord | null {
  if (saved === null) return null;

  try {
    const parsed = JSON.parse(saved) as Partial<RunRecord> | null;
    if (parsed === null || typeof parsed !== 'object') return null;

    const { id, model, provider, settings } = parsed;
    if (typeof id !== 'string' || id.trim() === '') return null;
    if (typeof model !== 'string' || typeof provider !== 'string' || typeof settings !== 'string') {
      return null;
    }

    return { id, model, provider, settings };
  } catch {
    return null;
  }
}

/**
 * 계약을 얼마나 벗어났는가 — **안 벗어났으면 `null`.**
 *
 * 0% 라고 적지 않는다. 「안 벗어났다」와 「0만큼 벗어났다」를 같은 칸에 적으면 나중에
 * 그 줄을 세는 쪽이 둘을 못 가른다.
 */
export function overLength(
  length: number,
  { min, max }: { min: number; max: number },
): string | null {
  if (length < min) return `${Math.round(((min - length) / min) * 100)}% 모자람`;
  if (length > max) return `${Math.round(((length - max) / max) * 100)}% 초과`;

  return null;
}
