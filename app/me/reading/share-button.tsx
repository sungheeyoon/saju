'use client';

import { useEffect, useRef, useState } from 'react';

import { BUTTON_PRIMARY, BUTTON_SECONDARY } from '../../ui/buttons';
import { shareMyReading } from './share';
import type { ReadingTarget } from './target';

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

/**
 * 평소에 적혀 있는 말 — **그리고 이 버튼의 폭을 정하는 말.**
 *
 * 누르면 글자가 바뀌는데, 바뀐 글자가 더 길면 버튼이 늘어나고 옆에 선 것들이 따라
 * 움직인다. 한동안 가장 긴 글자에 맞춰 `min-w` 를 박아 뒀더니 **평소에 여백만 남았다** —
 * 자리는 안 흔들렸지만 버튼이 제 크기가 아니었다.
 *
 * 그래서 **바뀌는 글자를 이것보다 짧게** 두고(「만드는 중…」·「복사했습니다」), 폭은
 * 이 말이 정하게 한다. 숫자를 안 적으므로 글자를 고치면 폭도 따라온다.
 */
const IDLE = '공유 링크 복사';

export function ShareReadingButton({
  target,
  emphasis,
}: {
  /** 무엇을 보내는가 — 글은 서버가 이 대상으로 다시 읽는다 */
  target: ReadingTarget;
  /**
   * 주 단추인가 보조인가 — 곁의 「다시 받기」와 짝을 이룬다. 평소엔 보내기가 주이고, 이전 명식으로 만든
   * 글이면 다시 받기가 주로 올라온다(`panel.tsx`). 한 영역에 주 단추는 하나다.
   */
  emphasis: 'primary' | 'secondary';
}) {
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
    const issued = shareMyReading(target).then((result) => {
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
      return;
    }

    try {
      await navigator.clipboard.writeText(url);
      setPhase('copied');
    } catch {
      setPhase('failed');
      setNotice('링크를 복사하지 못했습니다. 아래 주소를 직접 선택해 복사해 주세요.');
    }
  };

  /**
   * **버튼에 적힌 대로 일어난다.** 「공유하기」라고 적고 복사하면, 누른 사람은 공유
   * 시트를 기다리다 아무 일도 안 일어난 줄 안다(용어집: 한 사실에는 한 표기).
   *
   * 그리고 **된 것은 버튼이 혼자 말한다.** 한동안 버튼 아래에 「링크를 복사했습니다」가
   * 한 줄 더 섰는데, 그 줄이 생기면서 아래 있던 것들이 통째로 밀렸다 — 잘 된 일이
   * 화면을 흔드는 것은 고장처럼 보인다. 같은 말이 두 자리에 있을 이유도 없다.
   */
  const label = phase === 'working' ? '만드는 중…' : phase === 'copied' ? '복사했습니다' : IDLE;

  return (
    /*
      **담긴 칸을 채운다.** 좁은 화면에서 옆의 「다시 받기」와 **반반으로** 서기 때문이다(`panel.tsx` 의
      머리가 격자로 나눈다). 폭을 스스로 정하지 않으므로 그 칸이 정한다.
    */
    <div className="flex w-full flex-col items-stretch gap-2 sm:w-auto">
      <button
        type="button"
        onClick={start}
        disabled={phase === 'working'}
        className={`${emphasis === 'primary' ? BUTTON_PRIMARY : BUTTON_SECONDARY} w-full px-3 sm:px-5`}
      >
        <svg
          aria-hidden="true"
          viewBox="0 0 24 24"
          className="size-[18px] shrink-0 fill-none stroke-current"
          strokeWidth="1.8"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1.2 1.2M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1.2-1.2" />
        </svg>
        {/*
          **안 보이는 한 벌이 폭을 잡는다.** 두 글자를 같은 칸에 겹쳐 놓고 아래 것을
          숨기면, 칸의 너비는 늘 평소의 말이 정하고 위의 글자만 갈린다.

          `invisible` 은 `visibility: hidden` 이라 보조기기의 이름 계산에서도 빠진다 —
          `display: none` 과 달리 **자리는 차지하고** 읽히지는 않는다. 그 둘이 다 필요하다.
        */}
        <span className="grid">
          <span aria-hidden="true" className="invisible col-start-1 row-start-1 whitespace-nowrap">
            {IDLE}
          </span>
          <span className="col-start-1 row-start-1 place-self-center whitespace-nowrap">
            {label}
          </span>
        </span>
      </button>
      {/*
        **말이 서는 것은 실패했을 때뿐이다.** 그때는 화면이 밀려도 된다 — 읽어야 하는
        말이고, 읽으라고 자리를 만드는 것이다. 잘 된 일은 버튼이 혼자 말한다.
      */}
      {phase === 'failed' && notice !== null && (
        <p role="alert" className="text-[13px] leading-5 text-danger">
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
          className="min-h-11 w-full rounded-xl border border-border bg-surface-sunken px-3 text-[13px] text-secondary"
        />
      )}
    </div>
  );
}
