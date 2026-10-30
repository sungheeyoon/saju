import { answerOfThrown } from '@/app/db-error';
import { photoPositionOf } from '@/app/me/photo/photo-response';
import { photoUploadMode } from '@/app/me/profile/photo-upload-mode';
import { STORE_FAILED } from '@/app/me/profile/stored-photo';
import { addStoredPhotoAs, replaceStoredPhotoAs } from '@/app/me/profile/stored-photo-writes';
import { PHOTO_BODY_MAX_BYTES, VARIANTS_REFUSED } from '@/src/lib/profile';

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

/** 판본의 모양 — 마이크로초 정수(`profile_photo_version`) */
const VERSION = /^\d{1,16}$/;

/**
 * 본문을 읽기 전에 길이를 본다 — 웹의 서버 액션과 같은 상한이다. **길이를 안 밝힌 본문은 받지 않는다**: 읽어 봐야 크기를 아는 본문을 메모리에 올리지 않는다.
 * 읽기 전에 답하므로 거절이면 `Response`, 받았으면 폼이다. 폼이 아니어도 거절이다. 칸의 모양은 `checkVariants` 와 DB 가 본다.
 */
async function formOf(request: Request): Promise<FormData | Response> {
  const length = request.headers.get('content-length');
  if (length === null || !/^\d+$/.test(length)) return refusal(411, { refused: 'unavailable', message: STORE_FAILED });
  if (Number(length) > PHOTO_BODY_MAX_BYTES) return refusal(413, { refused: 'unavailable', message: VARIANTS_REFUSED });
  return (await request.formData().catch(() => null)) ?? refusal(400, { refused: 'not-found' });
}

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
  if (form instanceof Response) return form;

  return Response.json(await addStoredPhotoAs(session.client, form));
}

export async function PUT(request: Request): Promise<Response> {
  const session = await mobileSession(request, { touches: true, gatedAs: GATED_AS });
  if (!session.ok) return session.response;

  const form = await formOf(request);
  if (form instanceof Response) return form;

  /* 숫자가 아니면 저장소에 쓰기 전에 돌려보낸다 — 표와 하루 한도를 안 쓴다 */
  const position = form.get('position');
  const version = form.get('version');
  if (typeof position !== 'string' || photoPositionOf(position) === null || typeof version !== 'string' || !VERSION.test(version)) {
    return refusal(400, { refused: 'not-found' });
  }

  return Response.json(await replaceStoredPhotoAs(session.client, form));
}
