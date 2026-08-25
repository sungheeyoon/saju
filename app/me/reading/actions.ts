'use server';

import { revalidatePath } from 'next/cache';

import { requestReading, type ReadingRequest, type ReadingTarget } from './pipeline';

/**
 * **사용자가 누른 그 순간에만 도는 문.**
 *
 * 화면 조회에는 이 길이 없다. 그래서 배포도, 새로고침도, 정책 변경도 현재 결과를
 * 바꾸지 못한다 — 바꾸는 것은 이 액션이 성공했을 때뿐이다(PRD).
 */
export async function generateReading(
  target: ReadingTarget,
  /** 누름 하나를 가리키는 값 — 브라우저가 짓는다(`pipeline.ts` 가 이유를 든다) */
  requestKey?: string,
): Promise<ReadingRequest> {
  const result = await requestReading(target, requestKey);

  /**
   * 성공했을 때만 다시 그린다. 실패한 요청은 아무것도 바꾸지 않았으므로 다시 그릴
   * 것도 없고, 실패 문장은 액션의 반환값으로 그 자리에 선다.
   */
  if (result.ok && result.replaced) {
    if (target.kind === 'match') revalidatePath(`/me/match/${target.matchId}`);
    if (target.kind === 'self') revalidatePath('/me');
    if (target.kind === 'private') revalidatePath('/me/compat');
  }

  return result;
}
