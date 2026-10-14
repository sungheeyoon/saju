/**
 * 풀이권이 움직였다고 헤더에 알리는 **한 마디.**
 *
 * 헤더는 서버를 안 읽는다 — `/` 와 `/compat` 이 정적으로 미리 그려지는데 헤더 하나
 * 때문에 요청마다 도는 화면이 되면, 세션도 없는 방문마다 Supabase 를 두드리게 된다
 * (`site-header.tsx` 가 세션을 브라우저에서 읽는 것과 같은 까닭이다).
 *
 * 그래서 잔액도 브라우저에서 읽고, 그러면 `router.refresh()` 가 그 값을 안 데려온다 —
 * 서버가 다시 그리는 것은 서버 컴포넌트뿐이고 헤더의 `useEffect` 는 다시 돌지 않는다.
 * 잔액이 움직이는 자리에서 **한 마디 외치고**, 헤더가 그 소리를 듣는다.
 *
 * 값을 싣지 않는다. 실으면 외치는 쪽이 잔액을 계산하게 되고, 그러면 빼는 자리가 둘이
 * 된다 — 그것을 피하려고 `my_reading_credits()` 가 `available` 까지 내주고 있다.
 * 여기서 말하는 것은 「다시 물어봐라」뿐이다.
 */
export const READING_CREDITS_MOVED = 'reading-credits-moved';

/** 잔액이 움직였을 수 있다 — 서버가 답을 안다 */
export function announceCreditsMoved(): void {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(new Event(READING_CREDITS_MOVED));
}

/**
 * 액션이 「움직였다」고 말했으면 외친다 — **규칙이 한 자리에 있다.**
 *
 * 호출부는 결과를 이 함수에 넘기기만 한다. 무엇이 잔액을 움직이는가는 액션(서버)이
 * 알고 있고, 그 판단이 결과에 실려 온다(ADR 0078).
 */
export function announceIfMoved(result: { ok: boolean; credits?: 'moved' }): void {
  if (result.ok && result.credits === 'moved') announceCreditsMoved();
}
