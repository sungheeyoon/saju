'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { actionAnswer } from '../../../ui/action-answer';
import { sendChatMessage } from '../actions';
import type { ChatMessage } from './messages';
import { UNREACHED, droppable, newClientId, settlePending, withState, type Pending } from './pending';
import { heard, sendLine, type LineReport, type SendLine } from './send-line';

export type Outbox = {
  /** 아직 읽혀 오지 않은 내 말 — 읽혀 온 것은 뺐다 */
  readonly pending: readonly Pending[];
  /** 마지막 실패에 서버가 말한 문장(한도 · 정지 등) — 다음 보내기에 걷힌다 */
  readonly said: string | null;
  readonly send: (body: string) => void;
  readonly retry: (id: string) => void;
  /** 「삭제」 — 서버에 간 적이 없다고 분명한 실패에만 듣는다(`droppable`) */
  readonly drop: (id: string) => void;
};

/**
 * 방의 보낼 말 — 누르는 순간 세우고, 보내기 줄(`send-line.ts`)의 답을 받아 상태를 바꾼다(`pending.ts`, ADR 0155 덧).
 *
 * **액션 부름이 던지거나 떠난 말이 시한을 넘겨도 실패로 받는다**(`actionAnswer`, ADR 0164). 네트워크가 끊겨도
 * 오류 경계(`app/error.tsx`)로 올라가 화면 전체가 바뀌지 않는다 — 그 말풍선 하나가 실패로 선다. 그런 실패는 서버에 남았을 수
 * 있어 「다시 보내기」만 선다.
 *
 * `onAccepted` — 서버가 받았다(방이 읽어 와 맞춘다). `onClosed` — 방이 닫혔다(방이 다시 그려져 닫힌 까닭을 세운다).
 */
export function useOutbox(
  matchId: string,
  messages: readonly ChatMessage[],
  onAccepted: () => void,
  onClosed: () => void,
): Outbox {
  const [held, setHeld] = useState<readonly Pending[]>([]);
  const [said, setSaid] = useState<string | null>(null);
  const pending = useMemo(() => settlePending(held, messages), [held, messages]);

  /* 비동기 답이 늘 지금 가진 것을 보게 — 걷힌 것은 다음에 바꿀 때 함께 비운다 */
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
      change((now) => heard(now, id, outcome));
      if (outcome.kind === 'accepted') onAccepted();
      else if (outcome.kind === 'closed') onClosed();
      else if (outcome.kind === 'failed' && outcome.message !== null) setSaid(outcome.message);
    };
  }, [change, onAccepted, onClosed]);

  /* 방마다 줄 하나 — 처음 보낼 때 선다. 방이 바뀌면 이 부품이 새로 선다(`page.tsx` 의 `key`) */
  const lineRef = useRef<SendLine | null>(null);
  const enqueue = useCallback(
    (id: string, body: string) => {
      lineRef.current ??= sendLine(
        (each, text) => actionAnswer(sendChatMessage(matchId, text, each), () => UNREACHED),
        (each, outcome) => listener.current(each, outcome),
      );
      lineRef.current.enqueue(id, body);
    },
    [matchId],
  );

  const send = useCallback(
    (body: string) => {
      const id = newClientId();
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
