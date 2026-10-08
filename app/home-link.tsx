'use client';

import Link from 'next/link';
import type { ReactNode } from 'react';

import { useBrowserSession } from './auth/browser-session';

/**
 * **처음으로 가는 링크** — 로그인 전이면 `/`, 회원이면 곧장 홈(`/me`)이다.
 *
 * 회원이 `/` 에 오면 현관이 홈으로 옮긴다(ADR 0144). 옮기기 전 한 틱 동안 로그인 전 첫 화면이 보이는데, 화면 안 링크를
 * 눌러 오면 dev 서버에서 230~450ms 였다(2026-10-08 잼). 머리글 로고가 이미 하는 일을 화면 안 링크도 한다 — 도착지는 같고
 * 그 틱만 건너뛴다. 세션을 모르는 동안은 `/` 다(미리 그린 HTML 에서도 그렇다) — 거기서 현관이 옮긴다.
 */
export function HomeLink({ className, children }: { className?: string; children: ReactNode }) {
  const { session } = useBrowserSession();
  return (
    <Link href={session === 'in' ? '/me' : '/'} className={className}>
      {children}
    </Link>
  );
}
