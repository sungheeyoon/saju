import { REQUEST_STATUS_TEXT, type RequestStatus } from '@/src/lib/consent';

/**
 * **보낸 요청을 거둔 뒤 바닥(스낵바)에 서는 한 줄** — 서버가 답한 끝 그대로다.
 *
 * 거두는 문(`cancel_match_request`)은 이미 끝난 요청이면 거두지 않고 **그 끝**을 돌려준다 — 누르기 직전에 상대가 수락했거나 7일이 지나
 * 만료됐다. 그때 「거뒀어요」라 말하면 없는 일을 알린다(완료 안내는 그 일이 된 뒤에만, 대장 01). 그래서 끝마다 보낸 쪽의 말
 * (`REQUEST_STATUS_TEXT[끝].sent`)을 세운다. 아직 기다리는 중이라는 답은 거두지 못한 것이라 아무 말도 안 한다.
 */
export function cancelledNote(status: RequestStatus): string | null {
  if (status === 'pending') return null;
  return REQUEST_STATUS_TEXT[status].sent;
}
