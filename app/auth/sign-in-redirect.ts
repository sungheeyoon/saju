import { headers } from 'next/headers';
import { redirect } from 'next/navigation';

import { RETURN_PATH_HEADER, withReturnPath } from '@/src/lib/consent';

/**
 * 로그인하지 않은 사람을 로그인으로 보낸다 — **지금 주소를 돌아올 곳으로 들고**(ADR 0128).
 *
 * 화면 열아홉이 `redirect('/auth')` 를 적고 있었다. 그래서 `/me/match/…` 를 열다 세션이 끊긴 사람이 로그인을
 * 마치면 `/me` 에 섰다. 주소는 관문(`proxy.ts`)이 머리글로 넘긴다 — 레이아웃은 쿼리도 동적 조각도 못 받으므로
 * 화면이 제 주소를 짓지 않는다. 머리글이 없으면(관문 밖) 돌아올 곳은 기본값(`/me`)이다.
 */
export async function redirectToSignIn(): Promise<never> {
  const location = (await headers()).get(RETURN_PATH_HEADER);
  redirect(withReturnPath('/auth', location));
}
