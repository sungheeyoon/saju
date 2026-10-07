'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

import { supabaseInBrowser } from '../../../auth/browser-client';
import { CHAT_MOVED, chatMovedOf } from '../chat-signal';
import { labelled, type ShownMessage } from './bubbles';
import { MESSAGE_WINDOW, messagesForViewer } from './messages';
import { mergeMessages, needsNewer, newestSeq, oldestSeq, readNewer } from './thread';

/** 새 메시지를 읽을 때 한 쪽의 크기 — 대개 한두 건이다. 가득 차면 `readNewer` 가 앞을 더 읽는다 */
const NEWER_PAGE = 50;

export type MergeKind = 'newer' | 'older';

export type Thread = {
  readonly messages: readonly ShownMessage[];
  /** 방의 처음까지 다 가졌다 — 첫머리 카드가 선다 */
  readonly reachedStart: boolean;
  readonly loadingOlder: boolean;
  /** 가진 것 뒤의 새 메시지를 읽어 합친다 — 보낸 뒤에도 부른다 */
  readonly catchUp: () => void;
  /** 가진 것 앞의 200건을 읽어 합친다 */
  readonly loadOlder: () => void;
};

/**
 * 방이 든 메시지 — 서버가 그린 첫 200건에서 시작해 **브라우저가 합쳐 간다**(ADR 0156).
 *
 * - 채팅 신호(`CHAT_MOVED`)가 이 방의 가진 것보다 큰 차례를 알리거나 다시 대조(`matchId` 없음)를 알리면 뒤를 읽는다.
 * - 보낸 뒤에도 같은 길로 읽는다 — 화면을 다시 그리지 않으므로 입력 칸 · 초점 · 쓰던 글이 그대로다.
 * - 화면이 다시 그려져(`router.refresh()`) 새 첫 200건이 오면 그것도 합친다 — 가진 것을 버리지 않는다.
 *
 * 합치기 직전에 `beforeMerge` 를 부른다 — 방이 그때의 스크롤 자리를 재어 두고 그린 뒤에 지킨다.
 * 읽기가 실패하면 가진 것을 그대로 둔다 — 다음 알림이나 다시 대조가 메운다.
 */
export function useThread(
  matchId: string,
  initial: readonly ShownMessage[],
  fromBeginning: boolean,
  beforeMerge: (kind: MergeKind, incoming: readonly ShownMessage[]) => void,
): Thread {
  const [messages, setMessages] = useState<readonly ShownMessage[]>(initial);
  const [reachedStart, setReachedStart] = useState(fromBeginning);
  const [loadingOlder, setLoadingOlder] = useState(false);

  /* 비동기 읽기가 늘 지금 가진 것을 보게 — 상태는 그린 뒤에야 바뀐다 */
  const held = useRef(messages);
  const hook = useRef(beforeMerge);
  useEffect(() => {
    hook.current = beforeMerge;
  }, [beforeMerge]);

  const merge = useCallback((kind: MergeKind, incoming: readonly ShownMessage[]) => {
    const next = mergeMessages(held.current, incoming);
    if (next === held.current) return;
    hook.current(kind, incoming.filter((one) => !held.current.some((had) => had.messageId === one.messageId)));
    held.current = next;
    setMessages(next);
  }, []);

  /* 서버가 다시 그린 첫 200건 — 가진 것에 합친다 */
  useEffect(() => {
    merge('newer', initial);
  }, [initial, merge]);

  /* 한 번에 하나만 읽는다. 읽는 동안 또 알림이 오면 끝난 뒤 한 번 더 읽는다 */
  const reading = useRef(false);
  const again = useRef(false);

  const catchUp = useCallback(() => {
    if (reading.current) {
      again.current = true;
      return;
    }
    reading.current = true;
    void (async () => {
      do {
        again.current = false;
        try {
          const client = supabaseInBrowser();
          const fresh = await readNewer(
            (page) => messagesForViewer(client, matchId, page),
            newestSeq(held.current),
            NEWER_PAGE,
          );
          merge('newer', fresh.map(labelled));
        } catch {
          // 가진 것을 그대로 둔다 — 다음 알림이나 다시 대조가 메운다.
        }
      } while (again.current);
      reading.current = false;
    })();
  }, [matchId, merge]);

  const loadOlder = useCallback(() => {
    const before = oldestSeq(held.current);
    if (before === null || loadingOlder) return;
    setLoadingOlder(true);
    void (async () => {
      try {
        const older = await messagesForViewer(supabaseInBrowser(), matchId, { before, limit: MESSAGE_WINDOW });
        merge('older', older.map(labelled));
        if (older.length < MESSAGE_WINDOW) setReachedStart(true);
      } catch {
        // 단추가 그대로 남는다 — 다시 누르면 된다.
      } finally {
        setLoadingOlder(false);
      }
    })();
  }, [matchId, merge, loadingOlder]);

  useEffect(() => {
    const heard = (event: Event) => {
      const moved = chatMovedOf(event);
      if (moved.matchId !== null && moved.matchId !== matchId) return;
      if (needsNewer(held.current, moved.seq)) catchUp();
    };
    window.addEventListener(CHAT_MOVED, heard);
    return () => window.removeEventListener(CHAT_MOVED, heard);
  }, [matchId, catchUp]);

  return { messages, reachedStart, loadingOlder, catchUp, loadOlder };
}
