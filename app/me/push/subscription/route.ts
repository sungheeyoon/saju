import { pushSubscriptionShapeOk } from '@/src/lib/push';

import { supabaseOnServer } from '../../../auth/server-client';
import { recordDbFailure } from '../../../db-error';
import { endpointAllowedHere } from '../hosts';

/** 토큰은 있는데 DB 가 사람을 못 읽었다(`28000`) — 로그인이 없는 것과 같은 답이다 */
const NOT_SIGNED_IN = '28000';

const signedOut = () => new Response('sign in first', { status: 401 });

/**
 * **브라우저가 구독을 바꿨을 때 서비스 워커가 부르는 자리**(`pushsubscriptionchange`, `public/sw.js`).
 *
 * 서비스 워커에는 서버 액션이 없어 주소 하나를 둔다. 같은 출처의 `fetch` 라 로그인 쿠키가 실린다 — 누구의 구독인지는
 * DB 가 그 세션으로 정한다(`save_push_subscription`). 로그아웃 상태면 DB 가 거절하고(401 — DB 실패로 적지 않는다) 그 기기는
 * 「꺼짐」으로 남는다. 사람이 낸 요청이 아니라 관문이 활동으로 적지 않는다(`proxy.ts`).
 *
 * 옛 endpoint 를 먼저 지운다. 새 endpoint 는 다른 값이라 두지 않으면 옛 줄이 끝까지 남아 보낼 때마다 410 을 받는다.
 */
export async function POST(request: Request): Promise<Response> {
  /*
    남의 사이트가 이 주소로 제 endpoint 를 실어 보내면 그 사람의 메시지 통보를 가로챌 수 있다. 쿠키(`SameSite=Lax`)가
    교차 출처 POST 에 안 실리지만, 출처 머리도 본다 — 서비스 워커의 `fetch` 는 늘 제 출처를 싣는다.
  */
  if (request.headers.get('origin') !== new URL(request.url).origin) {
    return new Response('forbidden', { status: 403 });
  }

  let body: { oldEndpoint?: unknown; endpoint?: unknown; p256dh?: unknown; auth?: unknown };
  try {
    body = await request.json();
  } catch {
    return new Response('bad request', { status: 400 });
  }

  const { oldEndpoint, endpoint, p256dh, auth } = body;
  if (typeof endpoint !== 'string' || typeof p256dh !== 'string' || typeof auth !== 'string') {
    return new Response('bad request', { status: 400 });
  }
  const keys = { endpoint, p256dh, auth };
  if (!pushSubscriptionShapeOk(keys) || !endpointAllowedHere(keys.endpoint)) {
    return new Response('bad request', { status: 400 });
  }

  const supabase = await supabaseOnServer();

  /*
    로그인이 없으면 DB 에 가기 전에 401 이다 — 세션이 끝난 기기의 워커가 부르는 흔한 경우다. 그대로 부르면 익명 역할에는 문이
    닫혀 있어(`42501`) DB 실패로 적힌다. 서명만 본다 — 활동은 적지 않는다(`signedInUser` 를 안 부른다).
  */
  const { data: claims } = await supabase.auth.getClaims();
  if (claims === null) return signedOut();

  if (typeof oldEndpoint === 'string' && oldEndpoint !== endpoint) {
    const { error } = await supabase.rpc('remove_push_subscription', { p_endpoint: oldEndpoint });
    if (error?.code === NOT_SIGNED_IN) return signedOut();
    if (error) {
      recordDbFailure(error, 'push resubscribe: remove_push_subscription');
      return new Response('could not remove', { status: 503 });
    }
  }

  const { error } = await supabase.rpc('save_push_subscription', {
    p_endpoint: keys.endpoint,
    p_p256dh: keys.p256dh,
    p_auth: keys.auth,
  });
  if (error?.code === NOT_SIGNED_IN) return signedOut();
  if (error) {
    recordDbFailure(error, 'push resubscribe: save_push_subscription');
    return new Response('could not save', { status: 503 });
  }
  return new Response(null, { status: 204 });
}
