'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';

import { supabaseInBrowser } from './auth/browser-client';

/**
 * 공개 사주 화면에서 궁합으로 가는 길 — **「로그인 필요」는 로그인 안 한 사람에게만 참이다.**
 *
 * 이 꼬리표는 붙박이 글자였다. 그래서 로그인한 사람이 남의 생년월일시를 한 번 계산해
 * 보려고 `/` 에 오면, 지금 그대로 눌리는 버튼이 자기에게 「로그인 필요」라고 말하고
 * 있었다 — 화면이 사용자의 세션이 풀렸다고 거짓말하는 셈이다. **늘 참이 아닌 문장은
 * 참인 사람에게만 세운다.**
 *
 * 세션은 헤더와 같은 방법으로, 같은 까닭에서 브라우저에서 읽는다(`site-header.tsx`).
 * `/` 는 빌드 때 미리 그려지므로, 이 한 낱말 때문에 서버에서 읽으면 세션도 없는
 * 방문마다 Supabase 를 두드리는 화면이 된다.
 *
 * **모르는 동안에는 자리만 잡아 둔다.** 먼저 세우면 로그인한 사람이 한 번 깜빡이는
 * 거짓말을 보고, 아예 안 세우면 로그인 안 한 사람 쪽이 같은 깜빡임을 본다. 자리를
 * 비워 두면 글자가 늦게 오는 것으로 끝난다.
 */
export function CompatEntry() {
  const [signedIn, setSignedIn] = useState<boolean | null>(null);

  useEffect(() => {
    const supabase = supabaseInBrowser();
    let watching = true;

    void supabase.auth.getSession().then(({ data }) => {
      if (watching) setSignedIn(data.session !== null);
    });

    const { data } = supabase.auth.onAuthStateChange((_event, next) => {
      setSignedIn(next !== null);
    });

    return () => {
      watching = false;
      data.subscription.unsubscribe();
    };
  }, []);

  return (
    <Link
      href="/compat"
      className="rounded-full border border-border-strong bg-surface px-5 py-2.5 text-sm font-semibold hover:border-accent hover:text-accent"
    >
      궁합 보기
      {signedIn !== true && (
        <span className={`text-xs opacity-75${signedIn === null ? ' invisible' : ''}`}> · 로그인 필요</span>
      )}
    </Link>
  );
}
