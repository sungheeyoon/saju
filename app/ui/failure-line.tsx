'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useTransition, type ReactNode } from 'react';

import { signInFrom } from '@/src/lib/consent';
import { BUTTON_TERTIARY } from './buttons';
import { SIGN_IN_AGAIN_NOTE } from './sign-in-again';

/** 화면 안 실패 줄의 글자 모양 — 붉은 글씨 한 줄. 부품을 못 쓰는 자리(문장만 세우는 곳)도 이 상수를 든다 */
export const FAILURE_TEXT = 'text-sm leading-6 text-danger';

/**
 * **화면 안에서 한 자리만 못 읽었거나 못 했을 때 서는 줄** — 붉은 글씨 · `role="alert"` · 고를 수 있는 「다시 시도하기」.
 *
 * 화면 전체를 못 그리면 오류 경계(`app/error-screen.tsx`)가 서지만, 본체가 선 화면의 한 칸(받은 요청 · 지난 요청 · 소식)을
 * 못 읽으면 그 칸에 이 줄이 선다. 회색 글씨로 서던 때는 다른 안내와 구별이 안 됐고 화면 읽기에 알려지지 않았으며, 다시 읽을
 * 길이 새로고침뿐이었다.
 *
 * 「다시 시도하기」(`retry`)는 화면을 서버에서 다시 받아 그린다(`router.refresh()`) — 쓰던 입력과 스크롤은 그대로다. 누름이
 * 실패한 줄(폼의 저장 실패)에는 안 단다 — 다시 누를 단추가 이미 그 폼에 있다.
 *
 * 문이 이름 없이 막은 문장(`SIGN_IN_AGAIN_NOTE` — 「다시 로그인한 뒤 시도해 주세요」)이 들면 단추 대신 「다시 로그인」 링크가 선다 —
 * 지금 주소를 돌아올 곳으로 들고 로그인으로 간다(ADR 0128). 다시 받아 그려도 같은 거절이라 「다시 시도하기」는 안 단다(ADR 0164 「덧」).
 */
export function FailureLine({
  children,
  retry = false,
  id,
  className = '',
}: {
  children: ReactNode;
  /** 칸이 `aria-describedby` 로 이 줄을 가리킬 때 */
  id?: string;
  /** 서버에서 다시 받아 그리는 단추를 단다 — 읽기 실패의 자리에만 */
  retry?: boolean;
  className?: string;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const [refreshing, startRefreshing] = useTransition();
  const signedOut = textOf(children).includes(SIGN_IN_AGAIN_NOTE);

  return (
    <div id={id} role="alert" className={`flex flex-wrap items-center gap-x-3 gap-y-1 ${FAILURE_TEXT} ${className}`}>
      <p>{children}</p>
      {signedOut ? (
        <Link href={signInFrom(pathname)} className={BUTTON_TERTIARY}>
          다시 로그인
        </Link>
      ) : retry && (
        <button
          type="button"
          onClick={() => startRefreshing(() => router.refresh())}
          disabled={refreshing}
          className={BUTTON_TERTIARY}
        >
          다시 시도하기
        </button>
      )}
    </div>
  );
}

/** 줄에 든 글자 — 문장이 조각(`저장하지 못했어요. {failure}`)으로 와도 이어 붙여 본다 */
function textOf(node: ReactNode): string {
  if (typeof node === 'string' || typeof node === 'number') return String(node);
  if (Array.isArray(node)) return node.map(textOf).join('');
  return '';
}
