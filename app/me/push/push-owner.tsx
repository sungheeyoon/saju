'use client';

import { useEffect } from 'react';

import { supabaseInBrowser } from '../../auth/browser-client';
import { useBrowserSession } from '../../auth/browser-session';
import { releaseOthersPush } from './owner';

/**
 * 로그인한 계정이 서면(바뀌면) 한 번, 이 브라우저의 푸시 구독이 그 계정의 것인지 본다(`owner.ts`). 그리는 것은 없다.
 */
export function PushOwnerCheck() {
  const { userId } = useBrowserSession();

  useEffect(() => {
    if (userId === null) return;
    void releaseOthersPush(supabaseInBrowser()).catch(() => false);
  }, [userId]);

  return null;
}
