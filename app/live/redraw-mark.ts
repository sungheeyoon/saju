/**
 * **앱이 스스로 다시 그리는 요청의 표지** — 활동으로 적지 않게(G-76, ADR 0155 「치르는 값」).
 *
 * 라이브 층의 `router.refresh()` 는 서버가 화면을 다시 그리는 GET 이라, 그대로면 화면이 그려질 때 적는 활동(ADR 0118)이
 * 된다 — 자리를 비운 사람에게 상대 메시지가 올 때마다, 채널이 내려간 동안은 30초 대체 조회마다 「지금 활동 중」이 이어진다.
 * `router.refresh()` 는 머리글을 실을 길이 없어 짧게 사는 쿠키 하나를 싣는다. 서버(`app/auth/signed-in.ts`)는 그것이 있으면
 * 활동을 적지 않는다.
 *
 * **한 번 쓰고 지운다.** 다시 그리기 직전에 세우고, 그 다시 그리기가 끝나면 걷는다. 끝을 못 들어도 몇 초 뒤 브라우저가
 * 버린다(`max-age`) — 그 사이 사람이 연 화면은 활동에서 빠지지만, 1분 안의 다음 요청이 다시 적는다(ADR 0092 의 1분 억제와
 * 같은 결). 사람이 이 쿠키를 손으로 세워 얻는 것은 제 활동을 숨기는 것뿐이다.
 */
export const LIVE_REDRAW_COOKIE = 'live-redraw';

/** 표지가 사는 최대 시간(초) — 다시 그리기 한 번이 넉넉히 끝나는 길이 */
const LIVE_REDRAW_SECONDS = 5;

/** 다시 그리기 직전에 — 브라우저에서만 부른다 */
export function markLiveRedraw(): void {
  document.cookie = `${LIVE_REDRAW_COOKIE}=1; path=/; max-age=${LIVE_REDRAW_SECONDS}; samesite=lax`;
}

/** 다시 그리기가 끝나면 — 브라우저에서만 부른다 */
export function clearLiveRedraw(): void {
  document.cookie = `${LIVE_REDRAW_COOKIE}=; path=/; max-age=0; samesite=lax`;
}
