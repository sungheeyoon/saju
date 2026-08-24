'use client';

import { createBrowserClient } from '@supabase/ssr';
import { supabaseEnv } from './config';

/**
 * 브라우저가 드는 Supabase — 세션을 쿠키에 둔다.
 *
 * `localStorage` 가 아니라 쿠키인 것이 핵심이다. 서버 컴포넌트도 같은 세션을 읽어야
 * 하는데 `localStorage` 는 서버가 못 본다. `@supabase/ssr` 이 그 쿠키를 양쪽이
 * 같은 규칙으로 읽고 쓰게 맞춰 준다.
 */
export function supabaseInBrowser() {
  const { url, publishableKey } = supabaseEnv();
  return createBrowserClient(url, publishableKey);
}
