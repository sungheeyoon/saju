'use client';

import { useEffect, useState } from 'react';

/**
 * 지금 보고 있는 결과의 주소를 복사한다.
 *
 * 주소가 곧 결과라는 것을 만든 뒤에도 화면이 그 사실을 말해 주지 않아서,
 * 사용자는 주소창을 긁어 복사할 생각을 못 한다. 버튼 하나가 그 간극을 메운다.
 *
 * **결과가 있을 때만 낸다.** 빈 폼의 주소를 복사해 주면 받는 사람은 빈 화면을
 * 본다. 쓰는 쪽에서 결과가 있을 때만 그리도록 두고, 여기서는 판단하지 않는다.
 *
 * 클립보드는 실패할 수 있다(권한 거부, 안전하지 않은 출처). 실패를 삼키지 않고
 * 주소를 그대로 보여줘서 손으로 복사할 수 있게 한다 — 아무 일도 일어나지 않는
 * 버튼이 가장 나쁘다.
 *
 * **링크에 무엇이 실리는지 말한다.** 입력은 주소의 `#` 뒤에 있어 서버로는 가지 않지만,
 * 링크를 받은 사람은 당연히 다 본다. 그게 기능이므로 막지 않고 적는다 — 누르기 전에.
 */
export function CopyLinkButton() {
  const [state, setState] = useState<'idle' | 'copied' | 'failed'>('idle');
  const [href, setHref] = useState('');

  // 복사됨 표시는 잠깐만 — 다음에 눌렀을 때 눌렸는지 알 수 있어야 한다.
  useEffect(() => {
    if (state === 'idle') return;
    const timer = setTimeout(() => setState('idle'), 3000);
    return () => clearTimeout(timer);
  }, [state]);

  const copy = async () => {
    const url = window.location.href;
    try {
      await navigator.clipboard.writeText(url);
      setState('copied');
    } catch {
      setHref(url);
      setState('failed');
    }
  };

  return (
    <div className="flex flex-wrap items-center gap-2">
      <button
        type="button"
        onClick={copy}
        className="h-9 rounded-md border border-border px-3 text-xs text-secondary transition-colors hover:border-border-strong hover:text-foreground"
      >
        {state === 'copied' ? '복사했습니다' : '결과 링크 복사'}
      </button>
      <span className="text-xs text-muted">
        {state === 'failed'
          ? '복사에 실패했습니다. 주소창의 주소를 그대로 쓰세요.'
          : '이 주소를 열면 같은 결과가 그대로 나옵니다'}
      </span>
      <p className="w-full text-xs text-muted">
        링크에는 입력한 생년월일시·성별·출생지가 담깁니다. 서버로는 전송되지 않지만 링크를
        받은 사람은 볼 수 있으니, 이름 칸에는 별명을 쓰기를 권합니다.
      </p>
      {state === 'failed' && (
        <code className="w-full overflow-x-auto rounded-sm bg-surface-sunken px-2 py-1 text-[10px] text-secondary">
          {href}
        </code>
      )}
    </div>
  );
}
