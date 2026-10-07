import 'server-only';

import { createHash, timingSafeEqual } from 'node:crypto';

/**
 * **크론 주소의 자격 — `Authorization: Bearer <CRON_SECRET>` 인가.**
 *
 * `/api` 는 `proxy.ts` 를 지나지 않아 아무나 두드린다. 두드리는 쪽이 둘(Supabase `pg_cron` · Vercel
 * Cron)이고 둘 다 같은 값을 든다(`app/api/cron/reading/route.ts`).
 *
 * **글자 비교(`!==`)를 쓰지 않는다.** 문자열 비교는 처음 어긋난 글자에서 멈춰서, 답이 걸린 시간으로
 * 앞에서부터 몇 글자가 맞았는지를 잴 수 있다. 머리 전체와 기대한 머리를 각각 SHA-256 으로 눌러
 * **같은 길이**로 만든 뒤 `timingSafeEqual` 로 견준다 — 길이가 달라도 던지지 않고, 길이도 시간으로
 * 새지 않는다.
 *
 * 서버의 비밀이 없거나 빈 문자열이면 어떤 머리든 닫는다 — 없는 비밀은 `Bearer undefined` 나
 * `Bearer` 같은 글자와 맞춰질 수 있다.
 */
export function cronAuthorized(request: Request): boolean {
  return bearerAuthorized(request, process.env.CRON_SECRET);
}

/**
 * 같은 비교를 다른 비밀로 — 웹 푸시의 배달 문(`app/api/push/dispatch/route.ts`)이 제 비밀(`PUSH_DISPATCH_SECRET`)로
 * 부른다. 비밀을 나눠 쓰지 않는 것은 한쪽이 새도 다른 쪽 문이 닫혀 있게다.
 */
export function bearerAuthorized(request: Request, secret: string | undefined): boolean {
  if (!secret) return false;

  const given = request.headers.get('authorization');
  if (given === null) return false;

  return timingSafeEqual(digest(given), digest(`Bearer ${secret}`));
}

const digest = (text: string) => createHash('sha256').update(text, 'utf8').digest();
