/**
 * 「안 읽은 소식 수가 움직였다」 — 소식을 읽음으로 바꾼 뒤 머리글의 종이 다시 세게 한다.
 *
 * 머리글은 화면을 옮길 때 다시 세는데, 소식 화면 안에서 읽음으로 바꾸는 것은 주소가 안 바뀐다 —
 * `router.refresh()` 는 서버 컴포넌트만 다시 그리고 머리글의 effect 는 안 돈다. 채팅(`chat/unread-signal`)과
 * 같은 모양으로 창에 알린다.
 */
export const NOTIFICATIONS_UNREAD_MOVED = 'notifications-unread-moved';

export function announceNotificationsUnreadMoved(): void {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(new Event(NOTIFICATIONS_UNREAD_MOVED));
}
