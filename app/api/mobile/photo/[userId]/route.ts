import { NextResponse } from 'next/server';

import { UUID } from '@/app/uuid';
import { photoPositionOf, photoResponse, photoVariantOf } from '@/app/me/photo/photo-response';

import { photoClientOf } from '../../session';

/**
 * **앱이 사진 한 장을 받는 문**(ADR 0211) — 웹의 `/me/photo/{id}` 와 같은 `photoResponse` 다. 다른 것은 사람을 알아보는 자리뿐이다.
 *
 * 볼 수 있는가는 `photo_at`(`may_see_photo`)이 그 토큰의 사람으로 답한다. 관문을 안 지나는 웹 사진 주소(ADR 0200)와 같아서 `mobileSession` 을
 * 안 부른다 — 목록의 사진마다 Auth 와 계정 · 일정을 묻지 않는다. 토큰이 없으면 없는 사람과 같은 404 다. `?n=` 은 자리, `?s=card` 는 작은 벌이다.
 */
export async function GET(request: Request, { params }: { params: Promise<{ userId: string }> }): Promise<Response> {
  const client = photoClientOf(request);
  if (client === null) return new NextResponse(null, { status: 404 });

  const { userId } = await params;
  if (!UUID.test(userId)) return new NextResponse(null, { status: 404 });

  const position = photoPositionOf(new URL(request.url).searchParams.get('n') ?? '1');
  if (position === null) return new NextResponse(null, { status: 404 });

  return photoResponse(request, userId, position, photoVariantOf(request), client);
}
