import { answerOfThrown } from '@/app/db-error';
import { saveSelfPersonAs } from '@/app/me/person-writes';

import { mobileSession, refusal } from '../../session';
import { bodyOf, chartWriterOf, queryOf } from '../writes';

/** **내 사주를 저장한다**(ADR 0211) — 웹의 `saveSelfPerson` 과 같은 판정 · 같은 열쇠 문이다. 여덟 글자는 서버가 입력에서 센다 */
export async function POST(request: Request): Promise<Response> {
  const session = await mobileSession(request, { touches: true });
  if (!session.ok) return session.response;

  const query = queryOf((await bodyOf(request)).query);
  if (query === null) return refusal(400, { refused: 'not-found' });

  try {
    return Response.json(await saveSelfPersonAs(chartWriterOf(session), query));
  } catch (thrown) {
    return refusal(500, { refused: 'unavailable', message: answerOfThrown(thrown, 'mobile self person') });
  }
}
