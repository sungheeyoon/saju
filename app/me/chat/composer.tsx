'use client';

import { useRouter } from 'next/navigation';
import { useRef, useState, useTransition } from 'react';

import {
  CHAT_INPUT_PLACEHOLDER,
  CHAT_POLICY,
  CHAT_SEND_LABEL,
  RATE_LIMITED_TEXT,
  TOO_LONG_TEXT,
  checkBody,
} from '@/src/lib/chat';

import { sendChatMessage } from './actions';
import { Icon } from '../../ui/icons';

/** 글자 수는 한도에 가까워질 때만 선다 — 늘 서 있는 「0/1,000」은 읽을 것 없는 숫자다 */
const COUNT_FROM = Math.floor(CHAT_POLICY.maxLength * 0.9);

/**
 * 입력 칸 — 보내고 나면 방에 알린다(`onSent`). 방이 제 메시지를 읽는 문으로 읽어 합치므로 화면을 다시 그리지 않고,
 * 이 칸과 초점 · 쓰던 글은 방이 갱신되어도 다시 그려지지 않는다(ADR 0156).
 *
 * **거절은 누른 뒤에 말한다**(GLOSSARY 「화면 문구 규칙」) — 버튼을 잠그지 않고, 못 보낸 그때
 * 무엇이 막았는지 한 줄로 말한다. 한도(`rate_limited`)와 닫힘(`closed`)은 값으로 오고, 나머지는
 * 문이 옮긴 문장이다(ADR 0078 · 0091). 빈 본문은 보내지 않는다 — 말할 것이 없다.
 */
export function Composer({ matchId, onSent }: { matchId: string; onSent: () => void }) {
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
      onSent();
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
            disabled={working}
            className="field-sizing-content max-h-36 min-h-11 w-full resize-none bg-transparent py-2.5 text-[15px] leading-6 text-foreground outline-none placeholder:text-secondary"
          />
        </label>
        <button
          type="submit"
          disabled={working}
          aria-label={working ? '보내는 중…' : CHAT_SEND_LABEL}
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
