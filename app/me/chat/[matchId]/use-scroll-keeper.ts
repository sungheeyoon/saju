'use client';

import { useCallback, useLayoutEffect, useRef, useState } from 'react';

import type { ShownMessage } from './bubbles';
import type { MergeKind } from './use-thread';

/** 맨 아래에서 이만큼 안이면 「맨 아래에 있다」 — 새 메시지가 오면 그대로 따라 내려간다 */
const NEAR_BOTTOM_PX = 48;

/** 말풍선 줄이 메시지를 가리키는 자리 — 스크롤 자리를 지킬 때 같은 줄을 다시 찾는다 */
export const MESSAGE_ID = 'data-message-id';

/**
 * 대화 칸의 스크롤 자리를 지킨다 — **과거를 읽는 사람의 눈 앞이 움직이지 않는다**(ADR 0155).
 *
 * 대화 칸은 거꾸로 쌓여(`flex-col-reverse`) 스크롤의 0 이 맨 아래다. 맨 아래에 있으면 새 말이 붙어도 그대로 맨 아래다.
 * 위에서 읽는 중이면 합치기 직전에 맨 위에 보이는 말풍선과 그 높이를 재어 두고, 그린 뒤 그 말풍선이 같은 높이에 오게
 * 스크롤을 옮긴다 — 아래에 새 말이 붙든 위에 이전 말이 붙든 같은 규칙이다. 브라우저의 스크롤 고정이 이미 지켰으면
 * 옮길 것이 0 이다.
 */
export function useScrollKeeper(messages: readonly ShownMessage[]) {
  const log = useRef<HTMLDivElement>(null);
  const anchor = useRef<{ id: string; top: number } | null>(null);
  /** 위에서 읽는 동안 상대의 새 말이 왔다 — 「새 메시지」 단추가 선다 */
  const [fresh, setFresh] = useState(false);

  const atBottom = useCallback(() => {
    const element = log.current;
    return element === null || Math.abs(element.scrollTop) < NEAR_BOTTOM_PX;
  }, []);

  const beforeMerge = useCallback(
    (kind: MergeKind, incoming: readonly ShownMessage[]) => {
      const element = log.current;
      anchor.current = null;
      if (element === null) return;
      if (kind === 'newer' && atBottom()) return;
      const top = element.getBoundingClientRect().top;
      for (const row of element.querySelectorAll(`[${MESSAGE_ID}]`)) {
        const box = row.getBoundingClientRect();
        if (box.bottom > top) {
          anchor.current = { id: row.getAttribute(MESSAGE_ID) ?? '', top: box.top };
          break;
        }
      }
      if (kind === 'newer' && incoming.some((message) => !message.mine)) setFresh(true);
    },
    [atBottom],
  );

  /* 그린 뒤 — 재어 둔 말풍선이 같은 높이에 오게 스크롤을 옮긴다 */
  useLayoutEffect(() => {
    const keep = anchor.current;
    anchor.current = null;
    const element = log.current;
    if (keep === null || element === null) return;
    const row = element.querySelector(`[${MESSAGE_ID}="${CSS.escape(keep.id)}"]`);
    if (row === null) return;
    const moved = row.getBoundingClientRect().top - keep.top;
    if (moved !== 0) element.scrollTop += moved;
  }, [messages]);

  const toBottom = useCallback(() => {
    log.current?.scrollTo({ top: 0 });
    setFresh(false);
  }, []);

  const onScroll = useCallback(() => {
    if (atBottom()) setFresh(false);
  }, [atBottom]);

  return { log, fresh, beforeMerge, toBottom, onScroll };
}
