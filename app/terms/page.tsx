import { SERVICE_NAME } from '@/src/lib/brand';
import { termsFor } from '@/src/lib/brand/terms';

import { currentBusinessInfo } from '../business-info';
import { HomeLink } from '../home-link';
import { LegalBody } from '../legal-body';
import { siteUrl } from '../site-url';
import { BUTTON_TERTIARY } from '../ui/buttons';
import { TYPE_TITLE } from '../ui/surfaces';

export const metadata = {
  title: '이용약관',
};

/**
 * 이용약관 — **로그인 없이 열린다**(`proxy.ts` 의 matcher 밖, 약관 제4조①).
 *
 * 게시는 판매 개시가 아니다(운영자 결정 2026-10-07, `docs/legal/README.md`) — 판매 스위치와 가입 동의 흐름은 G-20 · G-21 · G-25 가 든다.
 * 글자는 `src/lib/brand/terms.ts`, 사업자 빈칸은 환경변수(`app/business-info.ts`, ADR 0172)에서 온다.
 */
export default function TermsPage() {
  const terms = termsFor(currentBusinessInfo(), siteUrl().origin);
  return (
    <main className="app-shell flex w-full max-w-3xl flex-1 flex-col gap-4 py-8 sm:py-12">
      <header className="mb-2 rounded-paper bg-cream px-6 py-7 sm:px-8">
        <p className="text-small font-semibold text-cream-ink">이용약관</p>
        <h1 className={`mt-1 ${TYPE_TITLE}`}>{SERVICE_NAME} 이용약관</h1>
        {terms.effectiveDate ? (
          <p className="mt-2 text-body leading-7 text-secondary">시행일 {terms.effectiveDate}</p>
        ) : null}
      </header>

      <LegalBody document={terms} />

      <HomeLink className={`${BUTTON_TERTIARY} w-fit`}>처음으로</HomeLink>
    </main>
  );
}
