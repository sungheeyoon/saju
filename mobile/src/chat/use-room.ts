import { labelled, type ShownMessage } from '@chat/room/bubbles';
import { MESSAGE_WINDOW, type ChatMessage } from '@chat/room/message';
import {
  UNREACHED,
  droppable,
  settlePending,
  withState,
  type Pending,
} from '@chat/room/pending';
import { startReadRetry, type ReadRetry } from '@chat/room/read-retry';
import { heard as heardBy, sendLine, type LineReport, type SendLine } from '@chat/room/send-line';
import { mergeMessages, needsNewer, newestSeq, oldestSeq, readNewer, readUpTo } from '@chat/room/thread';
import * as Crypto from 'expo-crypto';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AppState } from 'react-native';

import { listenLive } from './live';
import { markRead, readMessages, sendMessage } from './reads';

/** 새 메시지를 읽을 때 한 쪽의 크기 — 웹의 `use-thread.ts` 와 같다 */
const NEWER_PAGE = 50;
const CATCH_UP_RETRY_MS = [1_000, 3_000, 9_000] as const;

export type MergeKind = 'newer' | 'older';

/** 방이 든 메시지 — 합치는 규칙은 웹과 같은 `@chat/room/thread` 다(ADR 0155) */
export function useThread(
  matchId: string,
  initial: readonly ChatMessage[],
  fromBeginning: boolean,
  beforeMerge: (kind: MergeKind, incoming: readonly ShownMessage[]) => void,
) {
  const [messages, setMessages] = useState<readonly ShownMessage[]>(() => initial.map(labelled));
  const [reachedStart, setReachedStart] = useState(fromBeginning);
  const [loadingOlder, setLoadingOlder] = useState(false);

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

  /* 방을 다시 읽어 새 첫 200건이 오면 합친다 — 가진 것을 버리지 않는다 */
  useEffect(() => {
    merge('newer', initial.map(labelled));
  }, [initial, merge]);

  const reading = useRef(false);
  const again = useRef(false);
  const failures = useRef(0);
  const retryTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(
    () => () => {
      if (retryTimer.current !== null) clearTimeout(retryTimer.current);
    },
    [],
  );

  const catchUp = useCallback(
    function catchUpNow() {
      if (retryTimer.current !== null) {
        clearTimeout(retryTimer.current);
        retryTimer.current = null;
      }
      if (reading.current) {
        again.current = true;
        return;
      }
      reading.current = true;
      void (async () => {
        do {
          again.current = false;
          try {
            const fresh = await readNewer((page) => readMessages(matchId, page), newestSeq(held.current), NEWER_PAGE);
            merge('newer', fresh.map(labelled));
            failures.current = 0;
          } catch {
            /* 가진 것을 그대로 두고 조금 뒤 다시 읽는다 — 다 쓰면 다음 알림이나 다시 대조가 메운다 */
            const wait = CATCH_UP_RETRY_MS[failures.current];
            failures.current += 1;
            if (wait !== undefined && !again.current) retryTimer.current = setTimeout(catchUpNow, wait);
            else if (wait === undefined) failures.current = 0;
          }
        } while (again.current);
        reading.current = false;
      })();
    },
    [matchId, merge],
  );

  const loadOlder = useCallback(() => {
    const before = oldestSeq(held.current);
    if (before === null || loadingOlder) return;
    setLoadingOlder(true);
    void (async () => {
      try {
        const older = await readMessages(matchId, { before, limit: MESSAGE_WINDOW });
        merge('older', older.map(labelled));
        if (older.length < MESSAGE_WINDOW) setReachedStart(true);
      } catch {
        /* 단추가 그대로 남는다 — 다시 누르면 된다 */
      } finally {
        setLoadingOlder(false);
      }
    })();
  }, [matchId, merge, loadingOlder]);

  useEffect(
    () =>
      listenLive((signal) => {
        if (signal.kind === 'resync') {
          catchUp();
          return;
        }
        const { area, matchId: movedIn, seq } = signal.change;
        if (area !== 'chat' || (movedIn !== null && movedIn !== matchId)) return;
        if (needsNewer(held.current, seq)) catchUp();
      }),
    [matchId, catchUp],
  );

  return { messages, reachedStart, loadingOlder, catchUp, loadOlder };
}

/** 부름이 던져도 그 말풍선 하나가 실패로 선다 — 서버에 갔을 수 있어 「다시 보내기」만 선다 */
const transmitOf = (matchId: string) => (id: string, body: string) => sendMessage(matchId, body, id).catch(() => UNREACHED);

/** 방의 보낼 말 — 웹의 `use-outbox.ts` 와 같은 줄 · 같은 갈래다(ADR 0155 덧) */
export function useOutbox(matchId: string, messages: readonly ChatMessage[], onAccepted: () => void, onClosed: () => void) {
  const [held, setHeld] = useState<readonly Pending[]>([]);
  const [said, setSaid] = useState<string | null>(null);
  const pending = useMemo(() => settlePending(held, messages), [held, messages]);

  const latest = useRef(messages);
  const listener = useRef<(id: string, outcome: LineReport) => void>(() => {});
  const change = useCallback((next: (now: readonly Pending[]) => readonly Pending[]) => {
    setHeld((now) => next(settlePending(now, latest.current)));
  }, []);
  useEffect(() => {
    latest.current = messages;
  }, [messages]);
  useEffect(() => {
    listener.current = (id, outcome) => {
      change((now) => heardBy(now, id, outcome));
      if (outcome.kind === 'accepted') onAccepted();
      else if (outcome.kind === 'closed') onClosed();
      else if (outcome.kind === 'failed' && outcome.message !== null) setSaid(outcome.message);
    };
  }, [change, onAccepted, onClosed]);

  const lineRef = useRef<SendLine | null>(null);
  const enqueue = useCallback(
    (id: string, body: string) => {
      lineRef.current ??= sendLine(transmitOf(matchId), (each, outcome) => listener.current(each, outcome));
      lineRef.current.enqueue(id, body);
    },
    [matchId],
  );

  const send = useCallback(
    (body: string) => {
      /* 앱에는 `crypto` 전역이 없을 수 있어 기기의 안전한 난수로 짓는다 — 같은 uuid v4 다 */
      const id = Crypto.randomUUID();
      setSaid(null);
      change((now) => [...now, { id, body, sentAt: new Date().toISOString(), state: 'sending', mightBeKept: false }]);
      enqueue(id, body);
    },
    [change, enqueue],
  );

  const retry = useCallback(
    (id: string) => {
      const one = held.find((each) => each.id === id);
      if (one === undefined || one.state !== 'failed') return;
      setSaid(null);
      change((now) => withState(now, id, 'sending'));
      enqueue(id, one.body);
    },
    [held, change, enqueue],
  );

  const drop = useCallback((id: string) => change((now) => now.filter((one) => one.id !== id || !droppable(one))), [change]);

  return { pending, said, send, retry, drop };
}

/**
 * **읽음은 본 데까지만**(ADR 0155) — 앱이 앞에 있고 말풍선이 대화 칸에 들어온(`seen`) 가장 큰 차례까지 남긴다. 못 남겼으면 복구 신호(앱이 돌아옴 ·
 * 다시 대조)와 제한된 뒤물림에 다시 부른다(`@chat/room/read-retry`).
 */
export function useReadMarker(matchId: string, already: number, enabled: boolean) {
  const seen = useRef<ReadonlySet<number>>(new Set());
  const marked = useRef(already);
  const busy = useRef(false);
  const retry = useRef<ReadRetry | null>(null);
  const tryMark = useRef(() => {});

  useEffect(() => {
    tryMark.current = () => {
      if (!enabled || busy.current) return;
      const upTo = readUpTo(seen.current, AppState.currentState === 'active', marked.current);
      if (upTo === null) return;
      busy.current = true;
      void markRead(matchId, upTo)
        .catch(() => false)
        .then((done) => {
          busy.current = false;
          if (!done) {
            retry.current?.failed();
            return;
          }
          retry.current?.succeeded();
          marked.current = Math.max(marked.current, upTo);
          tryMark.current();
        });
    };
    /* 창 · 시트를 닫으면 그때 화면에 든 것으로 다시 잰다 */
    tryMark.current();
  }, [enabled, matchId]);

  useEffect(() => {
    const again = startReadRetry({ attempt: () => tryMark.current(), visible: () => AppState.currentState === 'active' });
    retry.current = again;
    const appState = AppState.addEventListener('change', () => {
      again.recovered();
      tryMark.current();
    });
    const unlisten = listenLive((signal) => {
      if (signal.kind === 'resync') again.recovered();
    });
    return () => {
      again.stop();
      retry.current = null;
      appState.remove();
      unlisten();
    };
  }, []);

  return useCallback((seqs: ReadonlySet<number>) => {
    seen.current = seqs;
    tryMark.current();
  }, []);
}
