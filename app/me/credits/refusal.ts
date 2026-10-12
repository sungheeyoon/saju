/**
 * **풀이권이 없어서 막힌 거절인가** — 풀이를 여는 문(`start_reading_run`)과 인연 요청(`request_match`)이 잔액으로 막으면 이 문장으로 던진다.
 *
 * 화면은 누르기 전에 잔액을 보지만(`outOfCredits`), 그 사이 다른 탭에서 마지막 풀이권을 쓰면 서버가 막는다. 그때는 오류 줄 대신
 * 풀이권 창(보유 0장 + 필요 수량)을 연다(ADR 0171 「덧」).
 *
 * errcode 는 `check_violation`(23514)인데 그 코드는 다른 거절(차단 · 정지 · 보낸 요청이 잡은 몫 …)도 같이 쓴다 — 그래서 문장 앞머리로
 * 가른다. 문장은 DB 가 쓰고 시험이 마이그레이션에 그 앞머리가 있는지 잰다(`refusal.test.ts`). 「보낸 인연 요청이 풀이권을 잡고 있어요」는
 * 여기 안 든다 — 그 사람이 할 일은 사기가 아니라 요청을 거두거나 기다리기다.
 *
 * 앞머리에는 수를 세는 말(번 · 회 · 개 · 장)을 넣지 않는다 — 꼬리의 단위는 바뀐다(2026-10-12 「장 · 회」, `20261209090000`).
 * 앞머리만 견주므로 그 마이그레이션이 운영 DB 에 오르기 전후 어느 쪽 앱이 떠 있어도 같은 창이 열린다.
 */
export const OUT_OF_CREDITS_REFUSALS = ['풀이권을 다 쓰셨습니다', '풀이권이 없어 요청할 수 없습니다'] as const;

export function refusedForCredits(error: { code?: string | null; message?: string | null }): boolean {
  const message = error.message ?? '';
  return error.code === '23514' && OUT_OF_CREDITS_REFUSALS.some((lead) => message.startsWith(lead));
}

/** 풀이권이 없어 막힌 실패 — 문장은 그대로 들고(화면이 창을 못 열 때의 말), 화면은 이 표를 보고 풀이권 창을 연다 */
export type OutOfCreditsRefusal = { readonly ok: false; readonly message: string; readonly outOfCredits: true };
