'use client';

import { useEffect, useRef, type RefObject } from 'react';

import { markChatRead } from '../actions';
import { announceChatUnreadMoved } from '../unread-signal';
import { readUpTo } from './thread';

/** 말풍선이 이만큼 화면에 들어와야 「본 것」이다 — 화면보다 긴 말풍선은 이만큼의 높이가 들어오면 본 것이다 */
const SEEN_RATIO = 0.6;
const SEEN_HEIGHT_PX = 120;

/** 상대 말풍선이 차례를 싣는 자리 — 방이 `li` 에 단다 */
export const THEIR_SEQ = 'data-their-seq';

/**
 * **읽음은 본 데까지만**(ADR 0155) — 문서가 보이고 상대 말풍선이 대화 칸에 들어온(IntersectionObserver) 가장 큰 차례까지
 * `mark_chat_read` 로 남긴다. 숨은 탭에서는 부르지 않고, 다시 보이면 그때 화면에 든 것으로 잰다. 남기고 나면 머리글의
 * 딱지가 다시 세게 알린다.
 *
 * `already` 는 들어올 때 이미 읽은 차례다(`readAlready`) — 안 읽은 것이 없던 방은 부르지 않는다.
 */
export function useReadMarker(
  log: RefObject<HTMLElement | null>,
  matchId: string,
  already: number,
  enabled: boolean,
  /** 말풍선 목록이 바뀔 때마다 새로 지켜본다 — 그 목록의 정체가 바뀌는 값 */
  bubbles: unknown,
): void {
  const seen = useRef(new Map<Element, number>());
  const marked = useRef(already);
  const busy = useRef(false);

  const tryMark = useRef(() => {});
  useEffect(() => {
    tryMark.current = () => {
      if (!enabled || busy.current) return;
      const upTo = readUpTo(seen.current.values(), document.visibilityState === 'visible', marked.current);
      if (upTo === null) return;
      busy.current = true;
      void (async () => {
        const result = await markChatRead(matchId, upTo);
        busy.current = false;
        if (!result.ok) return;
        marked.current = Math.max(marked.current, upTo);
        // 주소가 안 바뀌므로 머리글이 스스로 다시 세지 않는다 — 알린다.
        announceChatUnreadMoved();
        // 부르는 사이 더 본 것이 있으면 이어서 남긴다.
        tryMark.current();
      })();
    };
  }, [enabled, matchId]);

  useEffect(() => {
    const root = log.current;
    if (root === null || !enabled) return;
    const watching = seen.current;

    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          const seq = Number(entry.target.getAttribute(THEIR_SEQ));
          const enough = entry.intersectionRatio >= SEEN_RATIO || entry.intersectionRect.height >= SEEN_HEIGHT_PX;
          if (entry.isIntersecting && enough && Number.isFinite(seq)) {
            watching.set(entry.target, seq);
          } else {
            watching.delete(entry.target);
          }
        }
        tryMark.current();
      },
      { root, threshold: [0, 0.25, SEEN_RATIO, 1] },
    );
    for (const bubble of root.querySelectorAll(`[${THEIR_SEQ}]`)) observer.observe(bubble);

    return () => {
      observer.disconnect();
      watching.clear();
    };
  }, [log, enabled, bubbles]);

  useEffect(() => {
    const onVisibility = () => tryMark.current();
    document.addEventListener('visibilitychange', onVisibility);
    return () => document.removeEventListener('visibilitychange', onVisibility);
  }, []);
}
