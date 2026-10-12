import Link from 'next/link';

import { supabaseOnServer } from '../../../auth/server-client';
import { signedInUser } from '../../../auth/signed-in';
import { redirectToSignIn } from '../../../auth/sign-in-redirect';
import { BUTTON_PRIMARY, BUTTON_SECONDARY } from '../../../ui/buttons';
import { CARD, COLUMN, TYPE_META, TYPE_TITLE } from '../../../ui/surfaces';
import { paymentOutcomeOf, paymentReturnOf, type PaymentOutcome } from '../payment';
import { myOrder } from '../sale';
import { WaitForApproval } from './wait';

export const metadata = {
  title: '결제 결과',
  description: '풀이권 결제가 어떻게 됐는지 알려 드립니다.',
};

/** 결제 뒤 화면의 갈래 넷 — 제목 · 한 줄 · 단추. 산 회차는 주문이 든다 */
type Outcome = { title: string; line: (credits: number) => string; wait?: boolean; again?: boolean };

const OUTCOMES: Record<PaymentOutcome, Outcome> = {
  failed: { title: '결제를 마치지 못했어요', line: () => '다시 시도해 주세요.', again: true },
  missing: { title: '주문을 찾지 못했어요', line: () => '풀이권을 다시 골라 주세요.', again: true },
  paid: { title: '결제가 완료됐어요', line: (credits) => `풀이권 ${credits}회가 추가됐어요.` },
  waiting: { title: '결제를 확인하고 있어요', line: () => '잠시만 기다려 주세요.', wait: true },
};

/**
 * **결제 뒤 화면** (G-21, ADR 0171) — 결제창이 돌려보낸 주소(`?paymentId=…`, 실패면 `code` 가 붙는다)를 받는다.
 *
 * 결제가 됐는지는 결제창의 답이 아니라 **주문의 상태**가 말한다. 웹훅이 PortOne 에서 결제를 다시 받아 승인해야 묶음이 서므로,
 * 결제창이 먼저 돌아오면 주문은 아직 대기다 — 그동안은 화면이 스스로 다시 묻는다(`WaitForApproval`).
 */
export default async function CreditsDonePage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const supabase = await supabaseOnServer();
  const user = await signedInUser(supabase);
  if (!user) return redirectToSignIn();

  const returned = paymentReturnOf(await searchParams);
  const order = returned.kind === 'order' ? await myOrder(supabase, returned.orderId) : null;
  const outcome = OUTCOMES[paymentOutcomeOf(returned, order)];

  return (
    <main className={`app-shell flex w-full ${COLUMN} flex-1 flex-col gap-6 py-8 sm:py-12`}>
      <section className={`${CARD} flex flex-col gap-4`} aria-live="polite">
        <h1 className={TYPE_TITLE}>{outcome.title}</h1>
        <p className={TYPE_META}>{outcome.line(order?.credits ?? 0)}</p>
        <div className="flex flex-col gap-2 sm:flex-row">
          {outcome.again ? (
            <Link href="/me/credits" className={BUTTON_PRIMARY}>
              풀이권 다시 고르기
            </Link>
          ) : (
            <Link href="/me" className={outcome.wait ? BUTTON_SECONDARY : BUTTON_PRIMARY}>
              홈으로
            </Link>
          )}
        </div>
      </section>
      {outcome.wait && <WaitForApproval />}
    </main>
  );
}
