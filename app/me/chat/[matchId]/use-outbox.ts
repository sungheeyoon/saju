'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { actionAnswer } from '../../../ui/action-answer';
import { sendChatMessage } from '../actions';
import type { ChatMessage } from './messages';
import { newClientId, settlePending, verdictOf, withState, withinDeadline, type Pending, type SendResult, type SendVerdict } from './pending';

/** 부름이 닿지 못했다는 표지 — 실패 줄 문장 대신 말풍선의 실패 단추만 선다 */
const UNREACHED: SendResult = { ok: false, message: '' };

export type Outbox = {
  /** 아직 읽혀 오지 않은 내 말 — 읽혀 온 것은 뺐다 */
  readonly pending: readonly Pending[];
  /** 마지막 실패에 서버가 말한 문장(한도 · 정지 등) — 다음 보내기에 걷힌다 */
  readonly said: string | null;
  readonly send: (body: string) => void;
  readonly retry: (id: string) => void;
  readonly drop: (id: string) => void;
};

/**
 * 방의 보낼 말 — 누르는 순간 세우고, 답을 받아 상태를 바꾼다(`pending.ts`, ADR 0155 덧).
 *
 * **액션 부름이 던지거나 시한(`SEND_DEADLINE_MS`)을 넘겨도 실패로 받는다**(`actionAnswer`, ADR 0164). 네트워크가 끊겨도
 * 오류 경계(`app/error.tsx`)로 올라가 화면 전체가 바뀌지 않는다 — 그 말풍선 하나가 실패로 선다.
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
  useEffect(() => {
    latest.current = messages;
  }, [messages]);
  const change = useCallback((next: (now: readonly Pending[]) => readonly Pending[]) => {
    setHeld((now) => next(settlePending(now, latest.current)));
  }, []);

  const deliver = useCallback(
    async (id: string, body: string) => {
      let verdict: SendVerdict;
      try {
        // 부름이 던지면(망 · 배포 직후) `actionAnswer` 가 실패 값으로 접는다 — 무엇이 막았는지 할 말이 없어 문장은 안 세운다.
        const answer = await withinDeadline(actionAnswer(sendChatMessage(matchId, body, id), () => UNREACHED));
        verdict = answer === UNREACHED ? { kind: 'failed', message: null } : verdictOf(answer);
      } catch {
        // 시한을 넘겼다 — 말풍선의 실패 단추가 말한다.
        verdict = { kind: 'failed', message: null };
      }
      if (verdict.kind === 'accepted') {
        change((now) => withState(now, id, 'accepted'));
        onAccepted();
        return;
      }
      change((now) => withState(now, id, 'failed'));
      if (verdict.kind === 'closed') onClosed();
      else if (verdict.message !== null) setSaid(verdict.message);
    },
    [matchId, change, onAccepted, onClosed],
  );

  const send = useCallback(
    (body: string) => {
      const id = newClientId();
      setSaid(null);
      change((now) => [...now, { id, body, sentAt: new Date().toISOString(), state: 'sending' }]);
      void deliver(id, body);
    },
    [change, deliver],
  );

  const retry = useCallback(
    (id: string) => {
      const one = held.find((each) => each.id === id);
      if (one === undefined || one.state !== 'failed') return;
      setSaid(null);
      change((now) => withState(now, id, 'sending'));
      void deliver(id, one.body);
    },
    [held, change, deliver],
  );

  const drop = useCallback((id: string) => change((now) => now.filter((one) => one.id !== id)), [change]);

  return { pending, said, send, retry, drop };
}
