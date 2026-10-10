'use client';

import { useEffect } from 'react';

/**
 * **적다 만 글이 있으면 탭을 닫거나 새로고침하기 전에 브라우저가 한 번 묻는다**(`beforeunload`, ADR 0166).
 *
 * 저장한 사람의 메모 · 신고 사유처럼 다시 적기 아까운 글에만 단다 — 바뀐 것이 있을 때만 듣고, 저장하거나 그만두면 걷는다.
 * 늘 듣고 있으면 아무것도 안 적은 사람도 떠날 때마다 묻는 창을 받는다. 앱 안의 링크 이동(Next 의 클라이언트 이동)은 이 사건을
 * 안 낸다 — 묻는 것은 탭을 닫거나 새로고침 · 주소창으로 떠날 때뿐이다. 묻는 문장은 브라우저가 정한다.
 */
export function useLeaveGuard(dirty: boolean): void {
  useEffect(() => {
    if (!dirty) return;
    const hold = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      /* 옛 브라우저는 값이 있어야 묻는다 */
      event.returnValue = '';
    };
    window.addEventListener('beforeunload', hold);
    return () => window.removeEventListener('beforeunload', hold);
  }, [dirty]);
}
