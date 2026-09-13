'use client';

import { useEffect, useRef, useState } from 'react';

import { shareMyReading } from './share';

/**
 * 내 사주풀이를 **링크로 보낸다.**
 *
 * ## 왜 주소창을 복사하지 않나
 *
 * 지금 보고 있는 주소(`/me/readings/self`)는 **나만 열린다.** 그것을 복사해 주는
 * 버튼은 받은 사람에게 빈 화면을 보내는 버튼이다 — 같은 이유로 저장한 사람 화면에서
 * 「결과 링크 복사」를 걷은 적이 있다(`app/copy-link.tsx`). 그래서 누르는 순간 서버가
 * **로그인 없이 열리는 공유본**을 하나 내놓고, 그 주소를 보낸다.
 *
 * ## 누름 하나에 왕복이 하나 있다 — 그래서 걸음이 둘일 수 있다
 *
 * 시스템 공유창(`navigator.share`)은 **사용자가 방금 눌렀을 때만** 열린다. 그런데
 * 링크는 서버에서 나므로 그 사이에 `await` 가 하나 끼고, 브라우저에 따라 그 순간
 * 「방금 눌렀다」가 만료된다. 그때는 거절을 오류로 세우지 않고 **「공유하기」 버튼을
 * 한 번 더 세운다** — 그 누름은 기다릴 것이 없으니 곧바로 열린다.
 *
 * ## 취소는 실패가 아니다
 *
 * 공유창을 열었다가 닫는 것은 사용자가 정한 일이다(`AbortError`). 아무 말 없이
 * 처음 자리로 돌아간다 — 거기에 빨간 글씨를 세우면 사용자는 자기가 뭘 잘못한 줄 안다.
 *
 * ## 못 열면 복사하고, 복사도 못 하면 주소를 보여 준다
 *
 * 클립보드는 권한이나 출처 때문에 거절될 수 있다. 아무 일도 안 일어나는 버튼이 가장
 * 나쁘므로 그때는 주소를 그대로 세워 손으로 긁게 한다(`CopyText` 와 같은 규율).
 */

/** 공유창에 함께 실리는 말 — 닉네임도 풀이 문장도 안 싣는다 */
const SHARE_TITLE = '사주풀이가 도착했어요';
const SHARE_TEXT = '만세력에서 받은 사주풀이입니다.';

type Phase =
  /** 아직 안 눌렀다 */
  | 'idle'
  /** 서버가 링크를 내는 중 */
  | 'working'
  /** 링크는 났는데 공유창이 **한 번 더** 눌러 달라고 한다 */
  | 'ready'
  | 'copied'
  | 'failed';

export function ShareReadingButton({ variant }: { variant: 'compact' | 'block' }) {
  const [phase, setPhase] = useState<Phase>('idle');
  const [link, setLink] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const address = useRef<HTMLInputElement>(null);

  /* 「복사했습니다」는 잠깐만 — 다음에 눌렀을 때 눌린 줄 알아야 한다 */
  useEffect(() => {
    if (phase !== 'copied') return;
    const timer = setTimeout(() => setPhase('idle'), 3000);
    return () => clearTimeout(timer);
  }, [phase]);

  /**
   * 공유창을 연다.
   *
   * @returns 열렸거나 사용자가 닫았으면 `true`. **닫은 것은 실패가 아니다** —
   *   다음 수단(복사)으로 넘어가면 사용자가 그만둔 일을 우리가 계속하게 된다.
   *   활성화가 만료돼 거절당했으면 `false` 이고, 그때만 버튼을 한 번 더 세운다.
   */
  const openSheet = async (url: string): Promise<boolean> => {
    if (typeof navigator === 'undefined' || typeof navigator.share !== 'function') return false;

    try {
      await navigator.share({ title: SHARE_TITLE, text: SHARE_TEXT, url });
      return true;
    } catch (failure) {
      return failure instanceof DOMException && failure.name === 'AbortError';
    }
  };

  const copy = async (url: string) => {
    try {
      await navigator.clipboard.writeText(url);
      setPhase('copied');
      setNotice('링크를 복사했습니다');
    } catch {
      setPhase('failed');
      setNotice('링크를 복사하지 못했습니다. 아래 주소를 직접 선택해 복사해 주세요.');
    }
  };

  /** 이미 난 링크를 다시 쓴다 — 서버를 또 두드리지 않는다 */
  const shareAgain = async () => {
    if (link === null) return;
    if (await openSheet(link)) {
      setPhase('idle');
      setNotice(null);
      return;
    }
    await copy(link);
  };

  const start = async () => {
    setPhase('working');
    setNotice(null);

    let result: Awaited<ReturnType<typeof shareMyReading>>;
    try {
      result = await shareMyReading();
    } catch {
      setPhase('failed');
      setNotice('공유 링크를 만들지 못했습니다. 잠시 뒤 다시 시도해 주세요.');
      return;
    }

    if (!result.ok) {
      setPhase('failed');
      setNotice(result.message);
      return;
    }

    const url = new URL(result.path, window.location.origin).toString();
    setLink(url);

    /*
      공유창이 있는 브라우저면 곧바로 연다. 거절당하면(방금 누른 것이 만료됐다)
      **한 번 더 누를 자리**를 세우고, 아예 없는 브라우저면 복사로 간다.
    */
    if (typeof navigator !== 'undefined' && typeof navigator.share === 'function') {
      if (await openSheet(url)) {
        setPhase('idle');
        return;
      }
      setPhase('ready');
      setNotice('링크가 준비됐습니다');
      return;
    }

    await copy(url);
  };

  const label =
    phase === 'working' ? '링크 만드는 중…' : phase === 'copied' ? '링크를 복사했습니다' : '공유하기';

  const shape =
    variant === 'compact'
      ? 'inline-flex min-h-10 shrink-0 items-center gap-1.5 rounded-full border border-accent/25 bg-surface px-4 text-sm font-semibold text-accent shadow-sm hover:border-accent disabled:opacity-60'
      : 'inline-flex h-11 w-full shrink-0 items-center justify-center gap-1.5 rounded-xl bg-accent px-5 text-sm font-semibold text-on-accent shadow-sm hover:bg-accent-strong disabled:cursor-not-allowed disabled:opacity-60 sm:h-10 sm:w-auto';

  return (
    <div className={variant === 'block' ? 'flex flex-col gap-2' : 'flex flex-col items-end gap-2'}>
      <div className="flex flex-wrap items-center gap-2">
        <button type="button" onClick={start} disabled={phase === 'working'} className={shape}>
          <span aria-hidden="true">↗</span>
          {label}
        </button>
        {/*
          **한 번 더 누를 자리.** 여기서는 기다릴 것이 없어 공유창이 바로 열린다 —
          위 버튼과 달리 `await` 를 하나도 안 지나기 때문이다.
        */}
        {phase === 'ready' && (
          <button
            type="button"
            onClick={shareAgain}
            className="inline-flex min-h-10 items-center rounded-full bg-accent px-4 text-sm font-semibold text-on-accent shadow-sm hover:bg-accent-strong"
          >
            공유창 열기
          </button>
        )}
      </div>
      {notice !== null && (
        <p
          role={phase === 'failed' ? 'alert' : 'status'}
          className={`text-xs leading-5 ${phase === 'failed' ? 'text-danger' : 'text-muted'}`}
        >
          {notice}
        </p>
      )}
      {/*
        **주소를 세우는 자리는 하나다** — 복사가 거절됐을 때. 준비만 된 자리에는 안
        세운다. 거기서는 아직 옆의 버튼이 할 일이 있고, 주소가 먼저 서면 사용자가
        버튼 대신 그것을 긁게 된다.
      */}
      {phase === 'failed' && link !== null && (
        <input
          ref={address}
          readOnly
          value={link}
          aria-label="공유 주소"
          onFocus={() => address.current?.select()}
          className="w-full rounded-md border border-border bg-surface-sunken px-2 py-1.5 text-xs text-secondary"
        />
      )}
    </div>
  );
}
