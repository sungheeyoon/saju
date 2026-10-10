'use client';

import { useRouter } from 'next/navigation';
import { useTransition, type ReactNode } from 'react';

import { BUTTON_TERTIARY } from './buttons';

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
 */
export function FailureLine({
  children,
  retry = false,
  className = '',
}: {
  children: ReactNode;
  /** 서버에서 다시 받아 그리는 단추를 단다 — 읽기 실패의 자리에만 */
  retry?: boolean;
  className?: string;
}) {
  const router = useRouter();
  const [refreshing, startRefreshing] = useTransition();

  return (
    <div role="alert" className={`flex flex-wrap items-center gap-x-3 gap-y-1 ${FAILURE_TEXT} ${className}`}>
      <p>{children}</p>
      {retry && (
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
