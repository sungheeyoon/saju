import type { DoorRefusal } from './door';

/** 문에 못 닿은 때 — 서버가 답하지 못한 자리라 웹의 계정 실패 줄과 같은 글자를 쓴다 */
export const UNREACHABLE_NOTE = '계정을 확인하지 못했어요.';

/**
 * 문의 답 — **값이거나 까닭이다.** 던지지 않는다.
 *
 * 부르는 화면은 `refused` 로 길을 고른다(`panel.tsx` 의 `followRefusal`) — 다시 로그인 · 가입 · 다시 시도.
 */
export type DoorAnswer<T> = { readonly ok: true; readonly value: T } | { readonly ok: false; readonly refused: DoorRefusal };

/**
 * 앱이 문을 부르는 차례 — 토큰을 읽고 보내고 본문을 옮긴다. **어느 걸음이 던져도 `unavailable` 이다**: 세션 저장소가 던진 날
 * 까닭 없이 거절되면 누른 단추가 기다림에 남는다.
 */
export async function askDoor<T>(readToken: () => Promise<string | undefined>, send: (token: string) => Promise<Response>): Promise<DoorAnswer<T>> {
  try {
    const token = await readToken();
    if (token === undefined) return { ok: false, refused: { refused: 'sign-in' } };
    const response = await send(token);
    const body: unknown = await response.json();
    return response.ok ? { ok: true, value: body as T } : { ok: false, refused: body as DoorRefusal };
  } catch {
    return { ok: false, refused: { refused: 'unavailable', message: UNREACHABLE_NOTE } };
  }
}
