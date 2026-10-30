import { answerOfThrown } from '@/app/db-error';
import { photoUploadMode } from '@/app/me/profile/photo-upload-mode';
import { addStoredPhotoAs, replaceStoredPhotoAs } from '@/app/me/profile/stored-photo-writes';

import { mobileSession, refusal } from '../../session';

/**
 * **앱이 저장소에 사진을 올리는 문**(ADR 0211 추기) — 몸통은 웹의 액션과 같다. 저장소 열쇠는 서버에만 있어 앱이 못 쓴다. 사람은 토큰의 답이고,
 * 한도 · 여섯 장 · 판본은 DB 의 문이 그 사람으로 본다. 웹의 `/me/profile` 과 같은 주소로 관문을 지난다.
 *
 * - `GET` — 화면이 보일 길(`db` · `s3` · `paused`). 이 배포의 저장소가 켜졌는지는 서버만 안다
 * - `POST` — 맨 뒤에 더한다. `multipart/form-data` 의 `card` · `large` · `focusX` · `focusY`
 * - `PUT` — 그 자리에서 바꾼다. 위에 더해 `position` · `version`
 */
const GATED_AS = '/me/profile';

/** 본문을 폼으로 — 폼이 아니면 `null` 이다. 칸의 모양은 `checkVariants` 와 DB 가 본다 */
const formOf = (request: Request): Promise<FormData | null> => request.formData().catch(() => null);

export async function GET(request: Request): Promise<Response> {
  const session = await mobileSession(request, { touches: true, gatedAs: GATED_AS });
  if (!session.ok) return session.response;

  try {
    return Response.json({ mode: await photoUploadMode(session.client) });
  } catch (thrown) {
    return refusal(500, { refused: 'unavailable', message: answerOfThrown(thrown, 'mobile photo mode') });
  }
}

export async function POST(request: Request): Promise<Response> {
  const session = await mobileSession(request, { touches: true, gatedAs: GATED_AS });
  if (!session.ok) return session.response;

  const form = await formOf(request);
  if (form === null) return refusal(400, { refused: 'not-found' });

  return Response.json(await addStoredPhotoAs(session.client, form));
}

export async function PUT(request: Request): Promise<Response> {
  const session = await mobileSession(request, { touches: true, gatedAs: GATED_AS });
  if (!session.ok) return session.response;

  const form = await formOf(request);
  if (form === null) return refusal(400, { refused: 'not-found' });

  return Response.json(await replaceStoredPhotoAs(session.client, form));
}
