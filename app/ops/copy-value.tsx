'use client';

import { useEffect, useState } from 'react';

import { BUTTON_SECONDARY_SMALL } from '../ui/buttons';

/**
 * 운영자가 CLI 에 붙일 값(신고 id 등)을 클립보드로. **자료를 바꾸는 누름이 아니다** — 화면은 그대로 읽기 전용이다.
 *
 * 실패를 삼키지 않는다(`CopyLinkButton` 과 같은 규율) — 값은 화면에 글자로 함께 서 있으니 손으로 긁으라고 말한다.
 */
export function CopyValue({ value, label }: { value: string; label: string }) {
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
          await navigator.clipboard.writeText(value);
          setState('copied');
        } catch {
          setState('failed');
        }
      }}
      className={`${BUTTON_SECONDARY_SMALL} shrink-0`}
    >
      {state === 'copied' ? '복사했습니다' : state === 'failed' ? '복사하지 못했습니다 — 옆의 값을 긁어 주세요' : label}
    </button>
  );
}
