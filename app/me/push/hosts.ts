import 'server-only';

import { extraPushHostsOf, pushEndpointAllowed } from '@/src/lib/push';

/**
 * 이 배포가 받는 푸시 endpoint 인가 — 알려진 푸시 서비스 넷, 그리고 시험용으로 더 연 호스트(`WEB_PUSH_EXTRA_HOSTS`, 로컬의
 * 가짜 푸시 서비스만 — 운영에는 넣지 않는다). 구독을 남기는 두 자리와 배달 문이 같은 것을 묻는다(ADR 0156).
 */
export function endpointAllowedHere(endpoint: string): boolean {
  return pushEndpointAllowed(endpoint, extraPushHostsOf(process.env.WEB_PUSH_EXTRA_HOSTS));
}
