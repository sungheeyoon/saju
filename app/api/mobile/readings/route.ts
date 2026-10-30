import { answerOfThrown } from '@/app/db-error';

import { mobileSession, refusal } from '../session';
import { shelfViewFor } from '../reading/views';

/** **앱의 풀이 보관함**(ADR 0211) — 본문 없이 표지만 나간다(ADR 0033). 모델을 안 부른다 */
export async function GET(request: Request): Promise<Response> {
  const session = await mobileSession(request, { touches: true });
  if (!session.ok) return session.response;

  try {
    return Response.json(await shelfViewFor(session.client));
  } catch (thrown) {
    return refusal(500, { refused: 'unavailable', message: answerOfThrown(thrown, 'mobile readings') });
  }
}
