'use server';

import { revalidatePath } from 'next/cache';

import { beginReading, type ReadingStart, type ReadingTarget } from './pipeline';
import { lastReadingRun, type LastRun } from './current';

/**
 * **사용자가 누른 그 순간에만 도는 문.**
 *
 * 화면 조회에는 이 길이 없다. 그래서 배포도, 새로고침도, 정책 변경도 현재 결과를
 * 바꾸지 못한다 — 바꾸는 것은 이 액션이 성공했을 때뿐이다(PRD).
 *
 * **결과를 기다리지 않는다.** 시도를 열고 곧바로 답한다. 만드는 일은 응답 뒤에
 * 돌고(`beginReading`), 화면은 `readingRunState` 로 그 시도를 지켜본다.
 */
export async function generateReading(
  target: ReadingTarget,
  /** 누름 하나를 가리키는 값 — 브라우저가 짓는다(`pipeline.ts` 가 이유를 든다) */
  requestKey?: string,
): Promise<ReadingStart> {
  return beginReading(target, requestKey);
}

/**
 * 그 대상의 시도가 지금 어떤가 — **화면이 기다리며 묻는 자리.**
 *
 * 읽기만 한다. 이 문을 두드리는 것으로는 모델이 불리지 않고 현재 결과도 안 바뀐다.
 *
 * 다시 그리는 일도 여기서 한다. 끝난 것을 본 화면이 스스로 `router.refresh()` 를
 * 부르지만, 그 왕복이 캐시된 화면을 받으면 **끝난 줄 알면서 옛 글을 세운다.**
 * 끝난 것을 확인한 자리에서 무르게 하는 것이 한 자리다.
 */
export async function readingRunState(target: ReadingTarget): Promise<LastRun | null> {
  const run = await lastReadingRun(target);

  if (run !== null && run.status !== 'running') {
    if (target.kind === 'match') revalidatePath(`/me/match/${target.matchId}`);
    if (target.kind === 'self') revalidatePath('/me');
    if (target.kind === 'private') revalidatePath('/me/compat');
  }

  return run;
}
