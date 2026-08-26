'use client';

import { useEffect, useState } from 'react';

/**
 * 긴 글 한 덩어리를 클립보드로 — **내부 테스트 화면의 손잡이.**
 *
 * 프롬프트는 긁어서 복사하기에는 길고, `<pre>` 안에서 스크롤까지 하면 끝을 놓친다.
 * 게이트웨이가 붙기 전의 실험은 **여기서 복사해 다른 곳에 붙이는 것**이라, 이 버튼이
 * 곧 그 실험의 첫 단추다.
 *
 * 실패를 삼키지 않는다(`CopyLinkButton` 과 같은 규율). 클립보드는 권한이나 출처
 * 때문에 거절될 수 있고, 그때 아무 일도 안 일어나는 버튼이 가장 나쁘다 — 아래
 * `<pre>` 에 원문이 그대로 있으니 손으로 긁으라고 말한다.
 */
export function CopyText({ text, label }: { text: string; label: string }) {
  const [state, setState] = useState<'idle' | 'copied' | 'failed'>('idle');

  useEffect(() => {
    if (state === 'idle') return;
    const timer = setTimeout(() => setState('idle'), 3000);
    return () => clearTimeout(timer);
  }, [state]);

  return (
    <button
      type="button"
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(text);
          setState('copied');
        } catch {
          setState('failed');
        }
      }}
      className="h-8 shrink-0 rounded-md border border-border px-2.5 text-xs text-secondary transition-colors hover:border-border-strong hover:text-foreground"
    >
      {state === 'copied' ? '복사했습니다' : state === 'failed' ? '복사 실패 — 아래에서 긁어 주세요' : label}
    </button>
  );
}
