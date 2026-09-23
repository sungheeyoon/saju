/**
 * 「안 읽은 수가 움직였다」 — 방에서 읽음 처리가 끝나면 헤더의 배지가 다시 세게 한다.
 *
 * 헤더는 화면을 옮길 때 다시 세는데, 방 안에서 읽는 것은 주소가 안 바뀐다 — `router.refresh()` 는
 * 서버 컴포넌트만 다시 그리고 헤더의 effect 는 안 돈다. 그래서 풀이권(`credits-signal`)과 같은
 * 모양으로 창에 알린다.
 */
export const CHAT_UNREAD_MOVED = 'chat-unread-moved';

export function announceChatUnreadMoved(): void {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(new Event(CHAT_UNREAD_MOVED));
}
