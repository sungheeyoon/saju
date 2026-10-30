'use client';

import { useRef, useState, useSyncExternalStore } from 'react';

import { CHAT_POLICY, TOO_LONG_TEXT, checkBody } from '@/src/lib/chat';
import { CHAT_INPUT_PLACEHOLDER, CHAT_SEND_LABEL } from '@/src/lib/chat/copy';

import { Icon } from '../../ui/icons';
import { readDraft, writeDraft } from '@/src/lib/chat/room/draft';

/** 글자 수는 한도에 가까워질 때만 선다 — 늘 서 있는 「0/1,000」은 읽을 것 없는 숫자다 */
const COUNT_FROM = Math.floor(CHAT_POLICY.maxLength * 0.9);

/**
 * 손가락으로만 쓰는 기기 — 화면 자판에는 Shift 가 없어 Enter 가 줄바꿈이고, 보내기는 단추로만 한다(카카오톡과 같다). 가리키는
 * 기기가 함께 붙은 태블릿(올려 볼 수 있다 — `hover`)은 하드웨어 자판으로 여겨 Enter 가 보낸다.
 */
const TOUCH_QUERY = '(pointer: coarse) and (hover: none)';

/** 적어 둔 글은 이 칸만 바꾼다 — 다른 데서 오는 바뀜을 들을 것이 없다 */
const noSubscription = () => () => {};

/**
 * 입력 칸 — **누르는 순간 칸을 비우고 방에 맡긴다**(`onSend`). 방이 그 말을 곧장 세우고 보낸다 — 못 보냈으면 그 말풍선이
 * 제자리에 실패로 남는다(`[matchId]/pending.ts`, ADR 0155 덧). 칸은 보내는 동안에도 잠그지 않는다 — 이어서 쓸 수 있다.
 *
 * **거절은 누른 뒤에 말한다**(GLOSSARY 「화면 문구 규칙」) — 버튼을 잠그지 않는다. 너무 긴 글은 여기서 막고, 서버가 문장으로
 * 거절한 것(한도 · 정지 등)은 방이 `said` 로 넘긴다. 빈 본문은 보내지 않는다 — 말할 것이 없다.
 *
 * Enter — 키보드가 있는 기기는 보내고 Shift+Enter 가 줄을 바꾼다. 손가락으로만 쓰는 기기(`TOUCH_QUERY`)는 줄을 바꾼다.
 * 조합 중(한글 입력)에는 보내지 않는다.
 *
 * **쓰던 글은 방마다 탭에 남는다**(`draft.ts`) — 신고 · 차단 판이 이 칸을 내렸다 다시 세워도, 다른 방에 다녀와도 그대로다.
 * 첫 그림은 서버와 같은 빈 칸이고, 수화 뒤에 적어 둔 글이 선다 — 손으로 고치기 전까지는 적어 둔 글이 칸의 값이다.
 */
export function Composer({ matchId, onSend, said }: { matchId: string; onSend: (body: string) => void; said: string | null }) {
  const stored = useSyncExternalStore(noSubscription, () => readDraft(() => sessionStorage, matchId), () => '');
  const [typed, setTyped] = useState<string | null>(null);
  const body = typed ?? stored;
  const [tooLong, setTooLong] = useState(false);
  const field = useRef<HTMLTextAreaElement>(null);
  const failure = tooLong ? TOO_LONG_TEXT : said;

  const change = (next: string) => {
    setTyped(next);
    writeDraft(() => sessionStorage, matchId, next);
  };

  const send = () => {
    const shape = checkBody(body);
    if (shape === 'blank') return;
    if (shape === 'too_long') {
      setTooLong(true);
      return;
    }
    setTooLong(false);
    change('');
    field.current?.focus();
    onSend(body);
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
      <div className="flex items-end gap-2 rounded-card bg-surface-soft p-1.5 pl-4 ring-1 ring-border focus-within:ring-2 focus-within:ring-[color-mix(in_srgb,var(--accent)_55%,transparent)]">
        <label className="flex min-w-0 flex-1">
          <span className="sr-only">메시지</span>
          <textarea
            ref={field}
            value={body}
            onChange={(event) => change(event.target.value)}
            onKeyDown={(event) => {
              if (event.key !== 'Enter' || event.shiftKey || event.nativeEvent.isComposing) return;
              if (window.matchMedia(TOUCH_QUERY).matches) return;
              event.preventDefault();
              send();
            }}
            placeholder={CHAT_INPUT_PLACEHOLDER}
            maxLength={CHAT_POLICY.maxLength}
            rows={1}
            className="field-sizing-content max-h-36 min-h-11 w-full resize-none bg-transparent py-2.5 text-field leading-6 text-foreground outline-none placeholder:text-secondary"
          />
        </label>
        <button
          type="submit"
          aria-label={CHAT_SEND_LABEL}
          className="inline-flex min-h-11 min-w-11 shrink-0 items-center justify-center gap-1.5 rounded-full bg-accent px-3 text-body font-semibold text-on-accent hover:bg-accent-strong active:scale-95 disabled:opacity-55 sm:px-4"
        >
          <Icon name="send" className="size-[18px]" />
          <span aria-hidden="true" className="hidden sm:inline">
            {CHAT_SEND_LABEL}
          </span>
        </button>
      </div>
      {(body.length >= COUNT_FROM || failure !== null) && (
        <p className="flex items-start justify-between gap-3 px-4 text-small">
          {failure !== null ? (
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
