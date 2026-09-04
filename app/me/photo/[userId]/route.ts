import { NextResponse } from 'next/server';

import { supabaseOnServer } from '../../../auth/server-client';

/**
 * 사진 한 장을 내주는 자리 — **판정은 여기 없다.**
 *
 * `photo_of` 가 「이 사람의 사진을 볼 수 있나」를 답하고(`may_see_photo`), 못 보면 행이
 * 안 나온다. 여기서 조건을 다시 적으면 답하는 자리가 둘이 되고, 둘은 언젠가 어긋난다.
 *
 * ## 왜 `<img src>` 로 나가나
 *
 * 바이트를 화면에 직접 실을 수도 있다(data URI). 그러면 후보 카드 여덟 장이 한 HTML 에
 * 통째로 들어가 첫 화면이 몇 배로 무거워진다. 주소로 내주면 브라우저가 필요한 것만
 * 받아 가고 캐시도 브라우저가 든다.
 *
 * ## 캐시는 **사람마다** 든다
 *
 * `private` 이다. 중간 캐시가 한 사람에게 내준 얼굴을 다음 사람에게 주면, 「볼 수 있는
 * 사람에게만」이 캐시 한 겹으로 무너진다. 짧게 잡는 것은 사진을 바꾸거나 상대를 감췄을
 * 때 그만큼만 늦게 반영되게 하려는 것이다.
 */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ userId: string }> },
) {
  const { userId } = await params;

  const supabase = await supabaseOnServer();
  const { data, error } = await supabase.rpc('photo_of', { p_user_id: userId });

  /*
    **못 여는 것과 고장 난 것을 가른다.**

    로그인하지 않은 사람에게는 이 문 자체가 닫혀 있어 함수가 「권한이 없다」로 거절한다
    (`28000` · `42501`). 그것을 500 으로 내보내면 「우리가 고장 났다」는 말이 되고, 실제로
    고장 났을 때 그 말이 아무것도 못 가리킨다. 못 보는 사람은 **없는 사람과 같은 답**을
    받는다 — 갈라서 말하면 사람을 세는 문이 된다.
  */
  if (error) {
    const denied = error.code === '42501' || error.code === '28000';
    return new NextResponse(null, { status: denied ? 404 : 500 });
  }

  const row = (data ?? [])[0] as { content_type: string; base64: string } | undefined;
  if (row === undefined) return new NextResponse(null, { status: 404 });

  return new NextResponse(Buffer.from(row.base64, 'base64') as unknown as BodyInit, {
    headers: {
      'Content-Type': row.content_type,
      'Cache-Control': 'private, max-age=60',
    },
  });
}
