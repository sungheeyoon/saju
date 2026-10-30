import { answerOfThrown } from '@/app/db-error';
import { acceptedMatchIdOf, respondAndSend } from '@/app/me/requests/respond';
import type { DoorRespond } from '@/src/lib/reading/door';
import { isDoorId } from '@/src/lib/reading/target';

import { mobileSession, refusal } from '../../session';
import { bodyOf } from '../../me/writes';

/**
 * **앱이 받은 요청에 답하는 문**(ADR 0211) — 웹의 `respondToRequest` 와 같은 몸통이다. 수락이면 응답 뒤에 궁합풀이를 떠나보낸다.
 *
 * 제출만 하는 문은 일부러 없다 — 그 사람의 JWT 로 `respond_to_match_request` 가 `accepted` 라고 답해야만 열쇠의 제출이 돈다(`respond.ts`).
 */

/** 만드는 일은 응답 뒤에 돈다(`after`) — 그 콜백은 이 라우트의 상한만큼 산다(`app/me/reading/boundary.test.ts`) */
export const maxDuration = 300;

export async function POST(request: Request): Promise<Response> {
  const session = await mobileSession(request, { touches: true });
  if (!session.ok) return session.response;

  const { requestId, accept } = await bodyOf(request);
  if (!isDoorId(requestId) || typeof accept !== 'boolean') return refusal(400, { refused: 'not-found' });

  try {
    const answered = await respondAndSend(session.client, requestId, accept);
    if (!answered.ok || answered.status !== 'accepted') return Response.json(answered satisfies DoorRespond);

    const matchId = await acceptedMatchIdOf(requestId, session.client);
    return Response.json((matchId === null ? answered : { ...answered, matchId }) satisfies DoorRespond);
  } catch (thrown) {
    return refusal(500, { refused: 'unavailable', message: answerOfThrown(thrown, 'mobile respond') });
  }
}
