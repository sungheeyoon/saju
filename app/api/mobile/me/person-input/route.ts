import { answerOfThrown } from '@/app/db-error';
import { editPersonInputAs } from '@/app/me/person-writes';
import { readingTargetOf } from '@/src/lib/reading/target';

import { mobileSession, refusal } from '../../session';
import { bodyOf, chartWriterOf, queryOf } from '../writes';

/** **저장된 입력을 고친다**(ADR 0211) — 웹의 `editPersonInput` 과 같다. 남의 사람인지는 DB 가 본다 */
export async function POST(request: Request): Promise<Response> {
  const session = await mobileSession(request, { touches: true });
  if (!session.ok) return session.response;

  const body = await bodyOf(request);
  const query = queryOf(body.query);
  const person = readingTargetOf({ kind: 'person', personId: body.personId });
  if (query === null || person?.kind !== 'person') return refusal(400, { refused: 'not-found' });

  try {
    return Response.json(await editPersonInputAs(chartWriterOf(session), person.personId, query));
  } catch (thrown) {
    return refusal(500, { refused: 'unavailable', message: answerOfThrown(thrown, 'mobile person input') });
  }
}
