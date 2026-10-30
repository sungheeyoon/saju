export { OUT_OF_CREDITS_REFUSALS, refusedForCredits } from '@/src/lib/matching/requests';

/** 풀이권이 없어 막힌 실패 — 문장은 그대로 들고(화면이 창을 못 열 때의 말), 화면은 이 표를 보고 풀이권 창을 연다 */
export type OutOfCreditsRefusal = { readonly ok: false; readonly message: string; readonly outOfCredits: true };
