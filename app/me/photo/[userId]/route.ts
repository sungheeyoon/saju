import { photoResponse } from '../photo-response';

/**
 * 대표 사진 — `/me/photo/{id}/1` 의 다른 이름이다(G-60).
 *
 * 아바타(채팅 · 요청 · 보관함)와 옛 앱이 이 주소를 연다. 사진이 여러 장이 되어도 얼굴 하나를
 * 세우는 자리는 대표 한 장이면 된다.
 */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ userId: string }> },
) {
  const { userId } = await params;
  return photoResponse(userId, 1);
}
