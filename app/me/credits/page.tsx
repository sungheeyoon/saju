import { refundRequestLine } from '@/src/lib/brand/refund';

import { supabaseOnServer } from '../../auth/server-client';
import { signedInUser } from '../../auth/signed-in';
import { redirectToSignIn } from '../../auth/sign-in-redirect';
import { currentBusinessInfo } from '../../business-info';
import { FailureLine } from '../../ui/failure-line';
import { COLUMN, TYPE_META, TYPE_TITLE } from '../../ui/surfaces';
import { Checkout } from './checkout';
import { portoneCheckoutOf } from './payment';
import { mySaleIsOpen } from './sale';

export const metadata = {
  title: '풀이권 구매',
  description: '풀이권 묶음과 가격, 결제 전에 확인할 것을 적어 둡니다.',
};

/**
 * 풀이권 상품 화면 — 묶음 넷 · 결제 전 고지 · 「결제하기」 (G-21, ADR 0171).
 *
 * **판매는 닫혀 있다.** 결제 단추는 판매가 이 사람에게 열렸을 때(지금은 카드사 심사 계정만 — `reading_sale_reviewer`)와
 * 결제창 값(`PORTONE_STORE_ID` · `PORTONE_CHANNEL_KEY`)이 있는 배포에서만 선다. 둘 중 하나라도 아니면 결제창 값을 화면에
 * 넘기지 않는다. 이 화면으로 오는 메뉴는 아직 없다 — 심사 계정에게는 주소를 건넨다.
 */
export default async function CreditsPage() {
  const supabase = await supabaseOnServer();
  const user = await signedInUser(supabase);
  if (!user) return redirectToSignIn();

  const sale = await mySaleIsOpen(supabase);
  const checkout =
    sale.ok && sale.value
      ? portoneCheckoutOf({
          PORTONE_STORE_ID: process.env.PORTONE_STORE_ID,
          PORTONE_CHANNEL_KEY: process.env.PORTONE_CHANNEL_KEY,
        })
      : null;

  return (
    <main className={`app-shell flex w-full ${COLUMN} flex-1 flex-col gap-6 py-8 sm:py-12`}>
      <header className="flex flex-col gap-1">
        <h1 className={TYPE_TITLE}>풀이권 구매</h1>
        <p className={TYPE_META}>사주풀이와 궁합풀이를 받을 때 써요.</p>
      </header>

      {!sale.ok && <FailureLine retry>결제할 수 있는지 확인하지 못했어요. {sale.reason}</FailureLine>}

      <Checkout checkout={checkout} refundLine={refundRequestLine(currentBusinessInfo())} />
    </main>
  );
}
