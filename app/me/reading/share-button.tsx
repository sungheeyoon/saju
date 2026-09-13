'use client';

import { useEffect, useRef, useState } from 'react';

import { shareMyReading } from './share';

/**
 * 내 사주풀이를 **링크로 보낸다** — 누르면 주소가 클립보드에 들어간다.
 *
 * ## 왜 주소창을 복사하지 않나
 *
 * 지금 보고 있는 주소(`/me/readings/self`)는 **나만 열린다.** 그것을 복사해 주는
 * 버튼은 받은 사람에게 빈 화면을 보내는 버튼이다 — 같은 이유로 저장한 사람 화면에서
 * 「결과 링크 복사」를 걷은 적이 있다(`app/copy-link.tsx`). 그래서 누르는 순간 서버가
 * **로그인 없이 열리는 공유본**을 하나 내놓고, 그 주소를 복사한다.
 *
 * ## 시스템 공유창을 안 쓴다 — 실기기에서 링크가 깨졌다
 *
 * 처음에는 `navigator.share({ title, text, url })` 로 공유 시트를 열었다. 카카오톡에서
 * 실제로 보내 보니 이렇게 나왔다.
 *
 *     https://…/share/readings/d7ac56c1…만세력에서 받은 사주풀이입니다.
 *
 * **받는 앱이 `url` 과 `text` 를 구분자 없이 이어 붙인다.** 주소가 그 자리에서 깨지므로
 * 누를 수도 없고 미리보기도 안 뜬다 — 미리보기를 위해 지은 모든 것이 이 한 줄에서
 * 무너진다. 넘기는 값을 `url` 하나로 줄이면 그 앱에서는 낫지만, **어느 앱이 어떻게
 * 붙이는지는 앱마다 다르고 우리가 못 고친다.**
 *
 * 그래서 넘기지 않고 **복사한다.** 주소 한 줄만 클립보드에 들어가므로 어디에 붙여
 * 넣어도 그대로다. 되돌리려면 여기 한 곳만 고치면 된다.
 *
 * ## 누름이 만료되기 전에 클립보드를 잡는다
 *
 * 링크는 서버에서 나므로 누름과 복사 사이에 `await` 가 하나 낀다. Safari 는 그 사이에
 * 「방금 눌렀다」를 만료시키고 클립보드를 거절한다 — 아무 일도 안 일어나는 버튼이 된다.
 *
 * `ClipboardItem` 은 **값 대신 Promise 를 받는다.** 누른 그 자리에서 클립보드를 잡아
 * 두고 주소가 오면 채운다. 그 길이 없는 브라우저를 위해 평범한 `writeText` 를 뒤에
 * 두고, 둘 다 거절되면 주소를 그대로 세워 손으로 긁게 한다 — 아무 일도 안 일어나는
 * 버튼이 가장 나쁘다(`CopyText` 와 같은 규율).
 */

type Phase = 'idle' | 'working' | 'copied' | 'failed';

/** 클립보드에 실리는 것은 **주소 한 줄뿐이다.** 설명을 붙이면 붙여 넣는 자리에서 섞인다 */
const asText = (url: string) => new Blob([url], { type: 'text/plain' });

export function ShareReadingButton({ variant }: { variant: 'compact' | 'block' }) {
  const [phase, setPhase] = useState<Phase>('idle');
  const [link, setLink] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const address = useRef<HTMLInputElement>(null);

  /* 「복사했습니다」는 잠깐만 — 다음에 눌렀을 때 눌린 줄 알아야 한다 */
  useEffect(() => {
    if (phase !== 'copied') return;
    const timer = setTimeout(() => setPhase('idle'), 4000);
    return () => clearTimeout(timer);
  }, [phase]);

  const start = async () => {
    setPhase('working');
    setNotice(null);

    /**
     * **여기서 시작해 두고 기다리지 않는다.** 이 약속을 클립보드에 그대로 넘겨야
     * 누른 자리에서 잡을 수 있다.
     */
    const issued = shareMyReading().then((result) => {
      if (!result.ok) throw new Error(result.message);
      return new URL(result.path, window.location.origin).toString();
    });
    /* 아래에서 따로 받아 보므로, 여기서 안 잡으면 처리되지 않은 거절이 뜬다 */
    issued.catch(() => {});

    let held = false;
    if (typeof ClipboardItem === 'function' && navigator.clipboard?.write !== undefined) {
      try {
        await navigator.clipboard.write([
          new ClipboardItem({ 'text/plain': issued.then(asText) }),
        ]);
        held = true;
      } catch {
        /* 못 잡았으면 아래에서 평범한 길로 한 번 더 해 본다 */
      }
    }

    let url: string;
    try {
      url = await issued;
    } catch (failure) {
      setPhase('failed');
      setNotice(
        failure instanceof Error && failure.message !== ''
          ? failure.message
          : '공유 링크를 만들지 못했습니다. 잠시 뒤 다시 시도해 주세요.',
      );
      return;
    }

    setLink(url);

    if (held) {
      setPhase('copied');
      setNotice('링크를 복사했습니다');
      return;
    }

    try {
      await navigator.clipboard.writeText(url);
      setPhase('copied');
      setNotice('링크를 복사했습니다');
    } catch {
      setPhase('failed');
      setNotice('링크를 복사하지 못했습니다. 아래 주소를 직접 선택해 복사해 주세요.');
    }
  };

  /**
   * **버튼에 적힌 대로 일어난다.** 「공유하기」라고 적고 복사하면, 누른 사람은 공유
   * 시트를 기다리다 아무 일도 안 일어난 줄 안다(용어집: 한 사실에는 한 표기).
   */
  const label =
    phase === 'working'
      ? '링크 만드는 중…'
      : phase === 'copied'
        ? '링크를 복사했습니다'
        : '공유 링크 복사';

  const shape =
    variant === 'compact'
      ? 'inline-flex min-h-10 shrink-0 items-center gap-1.5 rounded-full border border-accent/25 bg-surface px-4 text-sm font-semibold text-accent shadow-sm hover:border-accent disabled:opacity-60'
      : 'inline-flex h-11 w-full shrink-0 items-center justify-center gap-1.5 rounded-xl bg-accent px-5 text-sm font-semibold text-on-accent shadow-sm hover:bg-accent-strong disabled:cursor-not-allowed disabled:opacity-60 sm:h-10 sm:w-auto';

  return (
    <div className={variant === 'block' ? 'flex flex-col gap-2' : 'flex flex-col items-end gap-2'}>
      <button type="button" onClick={start} disabled={phase === 'working'} className={shape}>
        <span aria-hidden="true">🔗</span>
        {label}
      </button>
      {notice !== null && (
        <p
          role={phase === 'failed' ? 'alert' : 'status'}
          className={`text-xs leading-5 ${phase === 'failed' ? 'text-danger' : 'text-muted'}`}
        >
          {notice}
        </p>
      )}
      {/* 복사가 거절됐을 때만 주소를 세운다 — 됐을 때 세우면 붙여 넣을 곳이 둘이 된다 */}
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
