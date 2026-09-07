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
 * **링크에 무엇이 실리는지는 복사한 뒤에 말한다.** 입력은 주소의 `#` 뒤에 있어 서버로는
 * 가지 않지만, 링크를 받은 사람은 당연히 다 본다. 그게 기능이므로 막지 않고 적는다.
 *
 * 여태는 그 문장이 버튼 옆에 **늘** 서 있었고, 옆에는 「이 주소를 열면 같은 결과가 그대로
 * 나옵니다」가 함께 있었다. 뒤엣것은 이 버튼이 있는 한 한 번도 틀린 적이 없는 말이고
 * (「늘 참인 문장은 늘 세우지 않는다」), 앞엣것은 **아직 복사도 안 한 사람에게 링크를
 * 조심하라고** 하는 말이었다. 남길 자리는 복사한 다음이다 — 그때가 실제로 어딘가에
 * 붙여 넣기 직전이다(ADR 0028).
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
      {state !== 'idle' && (
        <span className="text-xs text-muted">
          {state === 'failed'
            ? '복사에 실패했습니다. 주소창의 주소를 그대로 쓰세요.'
            : '링크에 입력한 출생 정보가 담겨 있습니다 — 받은 사람은 볼 수 있습니다.'}
        </span>
      )}
      {state === 'failed' && (
        <code className="w-full overflow-x-auto rounded-sm bg-surface-sunken px-2 py-1 text-[10px] text-secondary">
          {href}
        </code>
      )}
    </div>
  );
}
