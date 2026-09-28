import type { NotificationKind, RequestDirection, RequestStatus } from './index';

/**
 * 머리글의 두 딱지가 **무엇을 세는가** — 같은 일을 두 자리에서 세지 않는다(ADR 0129).
 *
 * 받은 요청은 인연 탭 맨 위에 산다. 요청 하나가 오면 사건이 둘 생긴다 — 「요청이 왔다」는 소식 한 줄과, 내가 답할
 * 때까지 남는 요청 한 장. 둘을 다 세면 종과 인연 탭이 같은 요청 하나에 1 을 하나씩 켠다.
 *
 * - **인연 탭은 답할 일을 센다** — 받은 요청 중 아직 답하지 않은 것. 읽어도 안 줄고, 답해야 준다.
 * - **종은 지나간 일을 센다** — 안 읽은 소식 중 **요청이 왔다는 소식을 뺀** 것. 그 도착은 인연 탭이 이미 센다.
 *
 * 수락 · 거절 · 무효 · 만료처럼 **답이 난 뒤의 소식**은 종이 센다. 그때는 인연 탭에 답할 일이 없다.
 */

/** 종이 세지 않는 소식 — 인연 탭이 「답할 요청」으로 센다 */
export const COUNTED_BY_MATCHING_TAB: readonly NotificationKind[] = ['request_received'];

/** 종의 딱지 — 안 읽은 소식 중 인연 탭이 안 세는 것 */
export function bellCount(notifications: readonly { kind: string; unread: boolean }[]): number {
  return notifications.filter(
    (one) => one.unread && !COUNTED_BY_MATCHING_TAB.some((kind) => kind === one.kind),
  ).length;
}

/** 인연 탭의 딱지 — 받은 요청 중 아직 답하지 않은 것 */
export function answerCount(
  requests: readonly { direction: RequestDirection | string; status: RequestStatus | string }[],
): number {
  return requests.filter((one) => one.direction === 'received' && one.status === 'pending').length;
}
