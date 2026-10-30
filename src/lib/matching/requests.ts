import { REQUEST_STATUS_TEXT, type RequestStatus } from '../consent';

import type { InboxRequest } from './inbox';

/**
 * 요청 화면이 함께 쓰는 판정과 짧은 값 — 웹과 앱이 같은 답을 낸다.
 */

/** 요청 부름이 던졌다 — 서버가 받았는지 모른다. 보낸 요청은 인연 기록에 서므로 줄이 그리로 가는 링크를 단다(G-103) */
export const REQUEST_UNSURE = '요청이 갔는지 확인하지 못했어요. 인연 기록에서 확인해 주세요.';

export const receivedOf = (requests: readonly InboxRequest[]) =>
  requests.filter((request) => request.direction === 'received' && request.status === 'pending');

/**
 * 요청 · 소식 · 풀이의 시각 — **한국 시간으로.** 서버(UTC)가 먼저 그리는 칸이라 시간대를 안 적으면 아홉 시간 이르게 서고,
 * 브라우저가 이어받는 칸(풀이 판)은 한국의 브라우저가 다른 글자를 그려 하이드레이션이 어긋났다.
 */
export function when(iso: string): string {
  return new Date(iso).toLocaleString('ko-KR', { timeZone: 'Asia/Seoul', dateStyle: 'medium', timeStyle: 'short' });
}

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

/**
 * **풀이권이 없어서 막힌 거절인가** — 풀이를 여는 문(`start_reading_run`)과 인연 요청(`request_match`)이 잔액으로 막으면 이 문장으로 던진다.
 *
 * 화면은 누르기 전에 잔액을 보지만(`outOfCredits`), 그 사이 다른 탭에서 마지막 풀이권을 쓰면 서버가 막는다. 그때는 오류 줄 대신
 * 풀이권 창(보유 0장 + 필요 수량)을 연다(ADR 0171 「덧」).
 *
 * errcode 는 `check_violation`(23514)인데 그 코드는 다른 거절(차단 · 정지 · 보낸 요청이 잡은 몫 …)도 같이 쓴다 — 그래서 문장 앞머리로
 * 가른다. 문장은 DB 가 쓰고 시험이 마이그레이션에 그 앞머리가 있는지 잰다(`app/me/credits/refusal.test.ts`). 「남은 풀이권이 보낸 인연 요청에 걸려 있어요」는
 * 여기 안 든다 — 그 사람이 할 일은 사기가 아니라 요청을 취소하거나(용어로는 거둠) 기다리기다.
 *
 * 앞머리에는 수를 세는 말(번 · 회 · 개 · 장)을 넣지 않는다 — 꼬리의 단위는 바뀐다(2026-10-12 「장 · 회」, `20261209090000`).
 * 앞머리만 견주므로 그 마이그레이션이 운영 DB 에 오르기 전후 어느 쪽 앱이 떠 있어도 같은 창이 열린다.
 */
export const OUT_OF_CREDITS_REFUSALS = ['풀이권을 다 쓰셨습니다', '풀이권이 없어 요청할 수 없습니다'] as const;

export function refusedForCredits(error: { code?: string | null; message?: string | null }): boolean {
  const message = error.message ?? '';
  return error.code === '23514' && OUT_OF_CREDITS_REFUSALS.some((lead) => message.startsWith(lead));
}

/**
 * **풀이권이 0개인가** — 남은 것도 만드는 중인 것도 없다. 만드는 중이면(`reserved > 0`) 끝나기를 기다리는 자리라 풀이권 창이 아니다.
 * 보낸 요청이 잡은 몫(`requested`)은 `available` 에서 이미 빠져 있다. 못 물었으면(`null`) 0개라고 하지 않는다 — DB 가 판정한다.
 */
export function outOfCredits(credits: { available: number; reserved: number } | null): boolean {
  return credits !== null && credits.available === 0 && credits.reserved === 0;
}
