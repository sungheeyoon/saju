import { answerOfThrown } from '@/app/db-error';
import { lastReadingRun } from '@/app/me/reading/current';
import type { RunView } from '@/src/lib/reading/door';
import { readingTargetOf } from '@/src/lib/reading/target';

import { mobileSession, refusal } from '../../session';

/**
 * **기다리는 앱이 묻는 문**(ADR 0211) — 웹의 `readingRunState` 와 같은 값이다. 읽기만 한다.
 *
 * 웹의 그 액션이 더 하는 두 일은 앱에 없다. 화면을 무르는 일은 받는 쪽이 RSC 가 아니라 없고, 귀속 표는 쿠키라 없다(`beginReadingAs`).
 * 끝난 것을 본 앱은 풀이 칸(`GET /api/mobile/reading`)을 한 번 더 읽는다.
 */
export async function GET(request: Request): Promise<Response> {
  const session = await mobileSession(request, { touches: false });
  if (!session.ok) return session.response;

  const target = readingTargetOf(Object.fromEntries(new URL(request.url).searchParams));
  if (target === null) return refusal(400, { refused: 'not-found' });

  try {
    const view: RunView = { run: await lastReadingRun(target, session.client) };
    return Response.json(view);
  } catch (thrown) {
    return refusal(500, { refused: 'unavailable', message: answerOfThrown(thrown, 'mobile reading run') });
  }
}
