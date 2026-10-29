import Link from 'next/link';

import { SERVICE_NAME } from '@/src/lib/brand';
import { REFUND_TERMS_POINTER, refundPolicyFor } from '@/src/lib/brand/refund';

import { currentBusinessInfo } from '../business-info';
import { HomeLink } from '../home-link';
import { LegalBody } from '../legal-body';
import { returnToOf, withReturnTo } from '../me/credits/return-to';
import { BUTTON_TERTIARY } from '../ui/buttons';
import { COLUMN, TYPE_TITLE } from '../ui/surfaces';

export const metadata = {
  title: '환불정책',
};

/**
 * 환불정책 — **로그인 없이 열린다**(`proxy.ts` 의 matcher 밖). 약관 제12조 ~ 제17조의2 를 쉬운 말로 옮긴 글이라 새 규칙을 만들지
 * 않는다 — 끝 줄이 약관(`/terms`)을 가리킨다.
 *
 * 게시는 판매 개시가 아니다(운영자 결정 2026-10-07). 글자는 `src/lib/brand/refund.ts`, 사업자 빈칸은 환경변수(ADR 0172)에서 온다.
 *
 * 풀이권 구매 화면의 「자세히 알아보기」로 왔으면(`?from=credits`) 끝 단추가 그 화면으로 돌아간다(운영자 결정 2026-10-29) — 실어 온
 * 돌아갈 곳(`?back=`)도 다시 싣는다. 바닥글 · 주소로 왔으면 「처음으로」다.
 */
export default async function RefundPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const fromCredits = params.from === 'credits';
  const policy = refundPolicyFor(currentBusinessInfo());
  return (
    <main className={`app-shell flex w-full ${COLUMN} flex-1 flex-col gap-4 py-8 sm:py-12`}>
      <header className="mb-2 rounded-card bg-cream px-6 py-7 sm:px-8">
        <p className="text-small font-semibold text-cream-ink">환불정책</p>
        <h1 className={`mt-1 ${TYPE_TITLE}`}>{SERVICE_NAME} 환불정책</h1>
        {policy.effectiveDate ? (
          <p className="mt-2 text-body leading-7 text-secondary">시행일 {policy.effectiveDate}</p>
        ) : null}
      </header>

      <LegalBody document={policy}>
        <p className="px-1 text-small leading-6 text-secondary">
          {REFUND_TERMS_POINTER.before}
          <Link href="/terms" className="font-semibold text-foreground underline underline-offset-2">
            {REFUND_TERMS_POINTER.link}
          </Link>
          {REFUND_TERMS_POINTER.after}
        </p>
      </LegalBody>

      {fromCredits ? (
        <Link href={withReturnTo('/me/credits', returnToOf(params.back))} className={`${BUTTON_TERTIARY} w-fit`}>
          풀이권 구매로 돌아가기
        </Link>
      ) : (
        <HomeLink className={`${BUTTON_TERTIARY} w-fit`}>처음으로</HomeLink>
      )}
    </main>
  );
}
