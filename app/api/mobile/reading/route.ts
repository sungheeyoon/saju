import { answerOfThrown } from '@/app/db-error';
import { beginReadingAs } from '@/app/me/reading/pipeline';
import type { ReadingPress } from '@/src/lib/reading/door';
import { READING_UNEXPECTED_NOTE } from '@/src/lib/reading/notes';
import { isRequestKey, readingTargetOf } from '@/src/lib/reading/target';

import { mobileSession, refusal } from '../session';
import { readingViewFor } from './views';

/**
 * **앱의 풀이 문**(ADR 0211) — 웹의 `generateReading` 과 화면 읽기가 하는 일을 토큰으로 한다.
 *
 * - `POST` — 시도를 연다. 모델을 부르는 길은 이것 하나이고, 웹과 같은 `start_reading_run` 을 지난다.
 * - `GET` — 그 대상의 풀이 칸을 읽는다. 모델을 안 부른다.
 */

/** 만드는 일은 응답 뒤에 돈다(`after`) — 그 콜백은 이 라우트의 상한만큼 산다(`app/me/reading/boundary.test.ts`) */
export const maxDuration = 300;

export async function POST(request: Request): Promise<Response> {
  const session = await mobileSession(request, { touches: true });
  if (!session.ok) return session.response;

  const body: unknown = await request.json().catch(() => null);
  const { target: rawTarget, requestKey } = (typeof body === 'object' && body !== null ? body : {}) as Record<string, unknown>;
  const target = readingTargetOf(rawTarget);
  /* 열쇠가 없으면 재전송을 못 알아본다 — 앱은 누를 때마다 짓는다. 없는 것을 서버가 지어 주지 않는다 */
  if (target === null || !isRequestKey(requestKey)) return refusal(400, { refused: 'not-found' });

  try {
    const answer: ReadingPress = await beginReadingAs(session.client, target, requestKey);
    return Response.json(answer);
  } catch (thrown) {
    return refusal(500, { refused: 'unavailable', message: answerOfThrown(thrown, 'mobile reading', READING_UNEXPECTED_NOTE) });
  }
}

export async function GET(request: Request): Promise<Response> {
  const session = await mobileSession(request, { touches: true });
  if (!session.ok) return session.response;

  const target = readingTargetOf(Object.fromEntries(new URL(request.url).searchParams));
  if (target === null) return refusal(400, { refused: 'not-found' });

  try {
    const view = await readingViewFor(session.client, target);
    return view === null ? refusal(404, { refused: 'not-found' }) : Response.json(view);
  } catch (thrown) {
    return refusal(500, { refused: 'unavailable', message: answerOfThrown(thrown, 'mobile reading view') });
  }
}
