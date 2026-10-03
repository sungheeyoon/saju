'use client';

import Link from 'next/link';

import { useBrowserSession } from './auth/browser-session';

/**
 * 「홈으로」 — **로그인한 사람의 홈은 `/me` 다.**
 *
 * 없는 주소와 오류 화면의 「홈으로」는 늘 `/` 로 갔다. 로그인한 사람에게 `/` 는 홈이 아니라 「다른 사람 사주 보기」
 * 계산기라, 홈으로 간다고 누른 사람이 입력 폼 앞에 섰다 — 머리글의 로고는 이미 `/me` 로 가는데(`site-header.tsx`) 이
 * 단추만 달랐다. 세션은 머리글과 같은 자리(`useBrowserSession`)에서 읽고, 모르는 동안은 `/` 다.
 */
export function HomeLink({ className }: { className: string }) {
  const { session } = useBrowserSession();
  return (
    <Link href={session === 'in' ? '/me' : '/'} className={className}>
      홈으로
    </Link>
  );
}
