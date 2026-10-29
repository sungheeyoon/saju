import { checkoutRefundLine } from '@/src/lib/brand/refund';
import { CREDITS_AVAILABLE_LABEL, CREDITS_USAGE_NOTE } from '@/src/lib/reading/notes';

import { supabaseOnServer } from '../../auth/server-client';
import { signedInUser } from '../../auth/signed-in';
import { redirectToSignIn } from '../../auth/sign-in-redirect';
import { currentBusinessInfo } from '../../business-info';
import { FailureLine } from '../../ui/failure-line';
import { COLUMN, TYPE_META, TYPE_TITLE } from '../../ui/surfaces';
import { TopBar } from '../../ui/top-bar';
import { Checkout } from './checkout';
import { portoneCheckoutOf } from './payment';
import { readReadingCredits } from './remaining';
import { returnToOf } from './return-to';
import { mySaleIsOpen } from './sale';

export const metadata = {
  title: '풀이권 구매',
  description: '풀이권 묶음과 가격, 결제 전에 확인할 것을 적어 둡니다.',
};

/**
 * 풀이권 상품 화면 — 묶음 넷 · 동의 체크 · 「결제하기」 · 유의사항 (G-21, ADR 0171 · 0175).
 *
 * **판매는 닫혀 있다.** 결제 단추는 판매가 이 사람에게 열렸을 때(지금은 카드사 심사 계정만 — `reading_sale_reviewer`)와
 * 결제창 값(`PORTONE_STORE_ID` · `PORTONE_CHANNEL_KEY`)이 있는 배포에서만 선다. 둘 중 하나라도 아니면 결제창 값을 화면에
 * 넘기지 않는다. 풀이권 창(`useBuyCredits`)은 판매가 열린 계정에게만 이리 오는 단추를 세운다 — 주소로 연 사람은 누구나
 * 이 화면을 보고, 판매가 닫혔으면 「풀이권 판매 준비 중이에요.」가 선다.
 *
 * 제목 아래에 보유 수를 세운다 — 머리글 메뉴와 같은 이름이다(운영자 결정 2026-10-29). 못 읽으면 그 줄만 생략한다. 풀이권 창이
 * 실어 온 돌아갈 곳(`?back=`)은 결제창 · 환불정책 링크로 넘긴다(`return-to.ts`).
 *
 * 제목 위 ← 는 그 돌아갈 곳이고, 실어 온 곳이 없으면(머리글 · 주소로 연 사람) 「나」(`/me`)다(운영자 2026-10-29 「뒤로가기가 없는 게
 * 아쉽네」). 결제 뒤 「홈으로」가 `/me` 인 것과 같다.
 */
export default async function CreditsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const supabase = await supabaseOnServer();
  const user = await signedInUser(supabase);
  if (!user) return redirectToSignIn();

  const back = returnToOf((await searchParams).back);
  const [sale, credits] = await Promise.all([mySaleIsOpen(supabase), readReadingCredits(supabase)]);
  const available = credits.ok && credits.value ? credits.value.available : null;
  const checkout =
    sale.ok && sale.value
      ? portoneCheckoutOf({
          PORTONE_STORE_ID: process.env.PORTONE_STORE_ID,
          PORTONE_CHANNEL_KEY: process.env.PORTONE_CHANNEL_KEY,
        })
      : null;

  return (
    <main className={`app-shell flex w-full ${COLUMN} flex-1 flex-col gap-6 py-8 sm:py-12`}>
      <TopBar back={back ? { href: back.href, label: back.name } : { href: '/me', label: '나' }}>
        <header className="flex flex-col gap-1">
          <h1 className={TYPE_TITLE}>풀이권 구매</h1>
          <p className={TYPE_META}>{CREDITS_USAGE_NOTE}</p>
        </header>
      </TopBar>

      {available !== null && (
        <p className="flex items-baseline justify-between gap-4 rounded-card bg-cream px-5 py-4 text-body text-cream-ink">
          <span>{CREDITS_AVAILABLE_LABEL}</span>
          <span className="font-semibold tabular-nums">{available}장</span>
        </p>
      )}

      {!sale.ok && <FailureLine retry>결제할 수 있는지 확인하지 못했어요. {sale.reason}</FailureLine>}

      <Checkout checkout={checkout} refundLine={checkoutRefundLine(currentBusinessInfo())} back={back} />
    </main>
  );
}
