'use client';

import Link from 'next/link';
import { useState, type ReactNode } from 'react';

import { withReturnPath } from '@/src/lib/consent';

/**
 * **입력을 들고 로그인으로 가는 누름** — 출생 정보는 주소에 안 싣고 탭의 `sessionStorage` 에 둔다(ADR 0007 · 0128).
 *
 * 사주 이어 보기(`save-for-reading.tsx`) · 첫 화면의 로그인 전 사주 문단(`taste.tsx`) · 로그인 전 궁합 결과(`pair-taste.tsx`)가 같은 누름을
 * 쓴다. `next` 는 `#` 뒤 낱말 하나(`/saju#resume-reading` · `/compat#resume-pair`)이고, 돌아온 화면이 그 낱말로 입력을
 * 되찾는다(`app/hash-query.ts`). 저장소가 막힌 창이면 가지 않고 그 자리에서 까닭을 말한다 — 가면 입력 없이 도착한다.
 */
export function SignInCarrying({
  draftKey,
  draft,
  next,
  className,
  children,
  carry,
  onFollow,
}: {
  draftKey: string;
  /** 돌아온 화면이 주소 `#` 뒤에서 읽는 모양 그대로 */
  draft: string;
  next: string;
  className: string;
  children: ReactNode;
  /** 함께 들고 갈 값 하나 — 로그인 전 사주 문단의 세션 id(`TASTE_SESSION_KEY`). 없으면 지난 값을 지운다 */
  carry?: { key: string; value: string | null };
  /** 들고 떠날 때 한 번 — 퍼널 세기처럼 답을 안 기다리는 일 */
  onFollow?: () => void;
}) {
  const [failure, setFailure] = useState<string | null>(null);

  return (
    <>
      <Link
        href={withReturnPath('/auth', next)}
        prefetch={false}
        onClick={(event) => {
          try {
            sessionStorage.setItem(draftKey, draft);
            if (carry !== undefined) {
              if (carry.value === null) sessionStorage.removeItem(carry.key);
              else sessionStorage.setItem(carry.key, carry.value);
            }
            setFailure(null);
            onFollow?.();
          } catch {
            event.preventDefault();
            setFailure('입력을 임시로 저장하지 못했어요. 저장 공간 설정을 확인하고 다시 시도해 주세요.');
          }
        }}
        className={className}
      >
        {children}
      </Link>
      {failure !== null && <p role="alert" className="text-sm text-danger">{failure}</p>}
    </>
  );
}
