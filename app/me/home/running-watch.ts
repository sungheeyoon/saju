import type { RunningLine } from './running-line';

/**
 * 홈의 「만드는 중」 줄이 **다시 물은 답으로 무엇을 하나**(ADR 0157) — 판단만 든다. 언제 묻는가는 `watchRun` 이 든다.
 *
 * - **못 읽었으면**(`null`) 앞서 본 줄을 그대로 두고 계속 묻는다 — 한 번 끊긴 것으로 줄을 지우지 않는다.
 * - **줄이 하나라도 사라졌으면** 홈 전체를 한 번 다시 그린다 — 그 풀이가 끝났다(완성 · 실패 · 만료). 카드의 단추 · 받은 사주풀이 ·
 *   안 읽은 소식 띠가 바뀐다.
 * - **줄이 비면 멈춘다** — 더 물을 것이 없다. 만료가 지난 시도는 서버가 이미 거르므로(`my_running_readings`) 만료 시각에도 비어 멈춘다.
 */
export type RunningAnswer = {
  readonly lines: readonly RunningLine[];
  readonly redraw: boolean;
  readonly stop: boolean;
};

export function afterRunningAnswer(before: readonly RunningLine[], answer: readonly RunningLine[] | null): RunningAnswer {
  if (answer === null) return { lines: before, redraw: false, stop: false };
  const now = new Set(answer.map((line) => line.key));
  const ended = before.some((line) => !now.has(line.key));
  return { lines: answer, redraw: ended, stop: answer.length === 0 };
}

/** 묻는 간격 — 절 하나가 서는 데 수십 초가 걸린다. 풀이 화면(3초)보다 느슨하게 둔다 */
export const RUNNING_ASK_EVERY_MS = 5000;
