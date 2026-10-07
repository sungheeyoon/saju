/**
 * 「대화가 움직였다」 — 방과 목록이 듣는 창 신호. 실은 것은 방(`matchId`)과 차례(`seq`)뿐이다(ADR 0156).
 *
 * 라이브 층(`app/live/`)이 채널에서 받은 `chat` 한 건을 이 신호로 옮긴다. 방은 제 방의 차례가 가진 것보다 크면
 * 메시지를 다시 읽고, 다시 대조(`matchId` 가 `null`)면 무조건 다시 읽는다. 머리글의 딱지는 이것이 아니라
 * `CHAT_UNREAD_MOVED` 를 듣는다 — 셋을 섞지 않는다.
 */
export const CHAT_MOVED = 'chat-moved';

export type ChatMoved = {
  /** `null` 이면 다시 대조 — 어느 방이든 다시 읽는다 */
  readonly matchId: string | null;
  /** 새 메시지의 차례. 읽음 · 방 상태가 바뀐 것이면 `null` */
  readonly seq: number | null;
};

export function announceChatMoved(moved: ChatMoved): void {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(new CustomEvent<ChatMoved>(CHAT_MOVED, { detail: moved }));
}

/** 받은 사건에서 실은 것을 꺼낸다 — 모르는 모양이면 다시 대조로 읽는다(더 읽는 쪽이 안전하다) */
export function chatMovedOf(event: Event): ChatMoved {
  const detail = (event as CustomEvent<Partial<ChatMoved> | null>).detail;
  return {
    matchId: typeof detail?.matchId === 'string' ? detail.matchId : null,
    seq: typeof detail?.seq === 'number' ? detail.seq : null,
  };
}
