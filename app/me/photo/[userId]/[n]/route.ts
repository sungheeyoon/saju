import { NextResponse } from 'next/server';

import { photoPositionOf, photoResponse } from '../../photo-response';

/**
 * 사진 한 장 — `n` 은 1부터 세는 자리다(1 = 대표 사진, G-60).
 *
 * 수가 아니거나 여섯 칸 밖이면 DB 에 묻지 않고 404 다 — 없는 자리와 같은 답이다.
 */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ userId: string; n: string }> },
) {
  const { userId, n } = await params;
  const position = photoPositionOf(n);
  if (position === null) return new NextResponse(null, { status: 404 });
  return photoResponse(userId, position);
}
