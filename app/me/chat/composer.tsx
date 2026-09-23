'use client';

import { useRouter } from 'next/navigation';
import { useEffect, useRef, useState, useTransition } from 'react';

import {
  CHAT_INPUT_PLACEHOLDER,
  CHAT_POLICY,
  CHAT_SEND_LABEL,
  RATE_LIMITED_TEXT,
  TOO_LONG_TEXT,
  checkBody,
} from '@/src/lib/chat';

import { markChatRead, sendChatMessage } from './actions';

const PRIMARY =
  'h-11 shrink-0 rounded-lg bg-accent px-4 text-sm font-medium text-on-accent disabled:opacity-60 sm:h-10';

/**
 * 입력 칸 — 보내고 나면 화면을 다시 읽는다. 실시간 갱신은 채팅 안전 베타에 없다(PRD §7.1).
 *
 * **거절은 누른 뒤에 말한다**(CONTEXT 「화면 문구 규칙」) — 버튼을 잠그지 않고, 못 보낸 그때
 * 무엇이 막았는지 한 줄로 말한다. 한도(`rate_limited`)와 닫힘(`closed`)은 값으로 오고, 나머지는
 * 문이 옮긴 문장이다(ADR 0078 · 0091). 빈 본문은 보내지 않는다 — 말할 것이 없다.
 */
export function Composer({ matchId }: { matchId: string }) {
  const router = useRouter();
  const [body, setBody] = useState('');
  const [failure, setFailure] = useState<string | null>(null);
  const [working, startWorking] = useTransition();
  const field = useRef<HTMLTextAreaElement>(null);

  const send = () => {
    const shape = checkBody(body);
    if (shape === 'blank') return;
    if (shape === 'too_long') {
      setFailure(TOO_LONG_TEXT);
      return;
    }

    setFailure(null);
    startWorking(async () => {
      const result = await sendChatMessage(matchId, body);
      if (!result.ok) {
        setFailure(result.message);
        return;
      }
      if (result.outcome === 'rate_limited') {
        setFailure(RATE_LIMITED_TEXT);
        return;
      }
      if (result.outcome === 'closed') {
        // 닫힌 까닭은 다시 읽어야 안다 — 방 화면이 입력 자리에 그 줄을 세운다.
        router.refresh();
        return;
      }
      setBody('');
      field.current?.focus();
      router.refresh();
    });
  };

  return (
    <form
      className="flex flex-col gap-2"
      onSubmit={(event) => {
        event.preventDefault();
        send();
      }}
    >
      <div className="flex items-end gap-2">
        <label className="flex min-w-0 flex-1 flex-col">
          <span className="sr-only">메시지</span>
          <textarea
            ref={field}
            value={body}
            onChange={(event) => setBody(event.target.value)}
            onKeyDown={(event) => {
              // Enter 는 보내고, Shift+Enter 는 줄을 바꾼다. 조합 중(한글 입력)에는 보내지 않는다.
              if (event.key === 'Enter' && !event.shiftKey && !event.nativeEvent.isComposing) {
                event.preventDefault();
                send();
              }
            }}
            placeholder={CHAT_INPUT_PLACEHOLDER}
            maxLength={CHAT_POLICY.maxLength}
            rows={2}
            disabled={working}
            className="min-h-11 w-full resize-none rounded-md border border-border bg-surface px-3 py-2.5 text-sm outline-none focus:border-accent focus:ring-2 focus:ring-accent-wash"
          />
        </label>
        <button type="submit" disabled={working} className={PRIMARY}>
          {working ? '보내는 중…' : CHAT_SEND_LABEL}
        </button>
      </div>
      {failure !== null && failure !== '' && (
        <p role="alert" className="text-sm text-danger">
          {failure}
        </p>
      )}
    </form>
  );
}

/**
 * 방에 들어오면 읽은 것으로 남긴다 — 소식 화면의 `ReadNotificationsOnVisit` 와 같은 모양.
 * 안 읽은 것이 없으면 부르지 않는다.
 */
export function ReadOnVisit({ matchId, unread }: { matchId: string; unread: number }) {
  const router = useRouter();
  const started = useRef(false);

  useEffect(() => {
    if (unread === 0) {
      started.current = false;
      return;
    }
    // 개발 모드의 이중 effect 와 같은 화면의 재렌더가 RPC 를 거듭 부르지 않게 한다.
    if (started.current) return;
    started.current = true;

    void (async () => {
      const result = await markChatRead(matchId);
      if (result.ok) router.refresh();
    })();
  }, [matchId, router, unread]);

  return null;
}
