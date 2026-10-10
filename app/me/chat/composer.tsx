'use client';

import { useRouter } from 'next/navigation';
import { useRef, useState, useTransition } from 'react';

import { CHAT_POLICY, RATE_LIMITED_TEXT, TOO_LONG_TEXT, checkBody } from '@/src/lib/chat';
import { CHAT_INPUT_PLACEHOLDER, CHAT_SEND_LABEL } from '@/src/lib/chat/copy';

import { sendChatMessage } from './actions';
import { Icon } from '../../ui/icons';

/** 글자 수는 한도에 가까워질 때만 선다 — 늘 서 있는 「0/1,000」은 읽을 것 없는 숫자다 */
const COUNT_FROM = Math.floor(CHAT_POLICY.maxLength * 0.9);

/**
 * 입력 칸 — **누르는 순간 칸을 비우고 방에 맡긴다**(`onPending`). 방은 그 말을 흐린 말풍선으로 곧장 세우고, 서버가 받으면
 * (`onSettled(…, true)`) 제 메시지를 읽는 문으로 읽어 그 자리를 진짜 말로 잇는다(`pending.ts`, ADR 0155). 칸은 보내는 동안에도
 * 잠그지 않는다 — 이어서 쓸 수 있다. 서버 액션은 브라우저가 하나씩 차례로 보내므로 순서가 지켜진다.
 *
 * 앞 판은 서버 액션과 다시 읽기가 끝날 때까지 칸을 잠그고 글자를 남겨 두었다 — 「입력하고 좀 있다 뜬다」(운영자 2026-10-08).
 *
 * **거절은 누른 뒤에 말한다**(GLOSSARY 「화면 문구 규칙」) — 버튼을 잠그지 않고, 못 보낸 그때
 * 무엇이 막았는지 한 줄로 말한다. 한도(`rate_limited`)와 닫힘(`closed`)은 값으로 오고, 나머지는
 * 문이 옮긴 문장이다(ADR 0078 · 0091). 빈 본문은 보내지 않는다 — 말할 것이 없다.
 */
export function Composer({
  matchId,
  onPending,
  onSettled,
}: {
  matchId: string;
  /** 보내는 말을 방에 맡긴다 — 방이 흐린 말풍선으로 세우고 그 이름을 돌려준다 */
  onPending: (body: string) => string;
  /** 서버가 받았는가 — 받았으면 방이 읽어 맞추고, 아니면 흐린 말풍선을 걷는다 */
  onSettled: (pendingId: string, sent: boolean) => void;
}) {
  const router = useRouter();
  const [body, setBody] = useState('');
  const [failure, setFailure] = useState<string | null>(null);
  const [, startWorking] = useTransition();
  const field = useRef<HTMLTextAreaElement>(null);

  const send = () => {
    const shape = checkBody(body);
    if (shape === 'blank') return;
    if (shape === 'too_long') {
      setFailure(TOO_LONG_TEXT);
      return;
    }

    const text = body;
    setFailure(null);
    setBody('');
    field.current?.focus();
    const pendingId = onPending(text);

    /* 못 보냈으면 흐린 말풍선을 걷고 쓰던 글을 칸에 돌려놓는다 — 그새 새로 쓰기 시작했으면 그 글을 덮지 않는다 */
    const giveBack = (message: string | null) => {
      onSettled(pendingId, false);
      setBody((now) => (now === '' ? text : now));
      if (message !== null) setFailure(message);
    };

    startWorking(async () => {
      const result = await sendChatMessage(matchId, text);
      if (!result.ok) {
        giveBack(result.message);
        return;
      }
      if (result.outcome === 'rate_limited') {
        giveBack(RATE_LIMITED_TEXT);
        return;
      }
      if (result.outcome === 'closed') {
        // 닫힌 까닭은 다시 읽어야 안다 — 방 화면이 입력 자리에 그 줄을 세운다.
        giveBack(null);
        router.refresh();
        return;
      }
      onSettled(pendingId, true);
    });
  };

  return (
    <form
      className="flex flex-col gap-1.5"
      onSubmit={(event) => {
        event.preventDefault();
        send();
      }}
    >
      {/* 둥근 알약 하나 — 칸과 보내기가 한 몸이라 엄지가 닿는 자리에 둘이 함께 선다 */}
      <div className="flex items-end gap-2 rounded-[1.75rem] bg-surface-soft p-1.5 pl-4 ring-1 ring-border focus-within:ring-2 focus-within:ring-[color-mix(in_srgb,var(--accent)_45%,transparent)]">
        <label className="flex min-w-0 flex-1">
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
            rows={1}
            className="field-sizing-content max-h-36 min-h-11 w-full resize-none bg-transparent py-2.5 text-[16px] leading-6 text-foreground outline-none placeholder:text-secondary"
          />
        </label>
        <button
          type="submit"
          aria-label={CHAT_SEND_LABEL}
          className="inline-flex min-h-11 min-w-11 shrink-0 items-center justify-center gap-1.5 rounded-full bg-accent px-3 text-[15px] font-semibold text-on-accent hover:bg-accent-strong active:scale-95 disabled:opacity-55 sm:px-4"
        >
          <Icon name="send" className="size-[18px]" />
          <span aria-hidden="true" className="hidden sm:inline">
            {CHAT_SEND_LABEL}
          </span>
        </button>
      </div>
      {(body.length >= COUNT_FROM || (failure !== null && failure !== '')) && (
        <p className="flex items-start justify-between gap-3 px-4 text-[13px]">
          {failure !== null && failure !== '' ? (
            <span role="alert" className="text-danger">
              {failure}
            </span>
          ) : (
            <span />
          )}
          {body.length >= COUNT_FROM && (
            <span className="shrink-0 tabular-nums text-secondary">
              {body.length.toLocaleString('ko-KR')}/{CHAT_POLICY.maxLength.toLocaleString('ko-KR')}
            </span>
          )}
        </p>
      )}
    </form>
  );
}
