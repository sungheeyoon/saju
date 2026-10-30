import { answerOfThrown, userFacingDbMessage } from '@/app/db-error';
import { selfPersonIdOf } from '@/src/lib/account';
import { storedChartOf } from '@/src/lib/input/stored';

import { readAccount } from '@/app/me/account';
import { myDiscoveryProfile } from '@/app/me/discovery/discovery-profile';
import { selfToOpen } from '@/app/me/discovery/self-to-open';
import { myEdge } from '@/app/me/home/circle';
import { openParticipation, setParticipation } from '@/app/me/keyed-chart-writes';
import { storedInputOf } from '@/app/me/person-input';
import { PARTICIPATION_NO_SELF_NOTE } from '@/app/me/person-writes';

import { mobileSession, refusal } from '../../session';
import { bodyOf, chartWriterOf } from '../writes';

/**
 * **매칭 참여**(ADR 0211) — 요약은 서버가 그 사람의 저장된 입력에서 짓는다. 앱이 보낼 수 있는 값은 켜고 끄는 것뿐이다.
 *
 * - `POST { on }` — 켜고 끈다(웹의 `setDiscoveryParticipation`)
 * - `PUT` — 홈이 열릴 때 참여를 연다(웹의 `openDiscoveryParticipation`). 끈 사람은 안 열고, 못 세웠어도 실패가 아니다
 */
export async function POST(request: Request): Promise<Response> {
  const session = await mobileSession(request, { touches: true });
  if (!session.ok) return session.response;

  const { on } = await bodyOf(request);
  if (typeof on !== 'boolean') return refusal(400, { refused: 'not-found' });

  try {
    const written = await setParticipation(chartWriterOf(session), on);
    if ('noSelf' in written) return Response.json({ ok: false, message: PARTICIPATION_NO_SELF_NOTE });
    return Response.json(
      written.error
        ? { ok: false, message: userFacingDbMessage(written.error, 'set_discovery_participation') }
        : { ok: true },
    );
  } catch (thrown) {
    return refusal(500, { refused: 'unavailable', message: answerOfThrown(thrown, 'mobile participation') });
  }
}

export async function PUT(request: Request): Promise<Response> {
  const session = await mobileSession(request, { touches: false });
  if (!session.ok) return session.response;

  try {
    const { state } = await readAccount(session.client);
    const selfPersonId = selfPersonIdOf(state);
    if (selfPersonId === null) return Response.json({ ok: true });

    const [profile, person, edge] = await Promise.all([
      myDiscoveryProfile(session.client),
      storedInputOf(session.client, selfPersonId),
      myEdge(session.client, selfPersonId),
    ]);
    const stood = person === null || edge === null ? null : storedChartOf(person.input, edge.label);
    const self = selfToOpen(profile, selfPersonId, stood, person?.versions ?? null);
    if (self === null) return Response.json({ ok: true });

    const { error } = await openParticipation(chartWriterOf(session), self);
    return Response.json(error ? { ok: false, message: userFacingDbMessage(error, 'ensure_discovery_participation') } : { ok: true });
  } catch (thrown) {
    return refusal(500, { refused: 'unavailable', message: answerOfThrown(thrown, 'mobile participation open') });
  }
}
