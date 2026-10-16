import { notFound } from 'next/navigation';

import { readingOrderIdOf } from '@/src/lib/reading/bundle';

import { signedInUser } from '../../auth/signed-in';
import { redirectToSignIn } from '../../auth/sign-in-redirect';
import { supabaseOnServer } from '../../auth/server-client';
import { BUTTON_SECONDARY_SMALL } from '../../ui/buttons';
import { FailureLine } from '../../ui/failure-line';
import { FIELD } from '../../ui/fields';
import { CARD } from '../../ui/surfaces';
import { Asked, Departed, Others } from './order-view';
import { DENIED, NO_ORDER, refundBasis } from './read';

export const metadata = {
  title: '주문',
  description: '주문 번호로 주문을 찾아 환불 금액을 셈하고 장부에 적습니다.',
};

/**
 * **운영자가 주문을 찾아 환불을 적는 자리** (G-110 ②, ADR 0184).
 *
 * 신고 · 설문 화면과 같은 경계다 — 「나는 운영자인가」를 안 묻고 자료를 청해 **거절당하면 없는 화면이 된다**(`notFound`).
 * 주문 번호 없이 열어도 문을 한 번 두드린다(`NO_ORDER`).
 *
 * 찾는 것은 주문 번호(`rdo_…`)뿐이다 — 이메일로 주문을 찾지 않는다(런북 「수동 환불」). 찾은 주문과 같은 계정의 다른 주문이
 * 함께 서지만 그 계정이 누구인지는 안 보인다.
 *
 * 환불은 세 걸음이다 — 화면에서 준비(회차를 잠그고 금액을 확정) → PortOne 콘솔에서 취소 → 취소 번호로 장부에 확정. 화면은 PG
 * 취소를 부르지 않는다.
 */
export default async function OperatorOrdersPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const supabase = await supabaseOnServer();

  const user = await signedInUser(supabase);
  if (!user) return redirectToSignIn();

  const raw = (await searchParams).order;
  const typed = typeof raw === 'string' ? raw.trim() : '';
  const orderId = typed === '' ? null : readingOrderIdOf(typed);

  const found = await refundBasis(orderId ?? NO_ORDER);
  if (found === DENIED) notFound();

  return (
    <main className="app-shell flex w-full flex-1 flex-col gap-6 py-9 sm:py-12">
      <header className="border-b border-border pb-6">
        <p className="eyebrow">운영</p>
        <h1 className="mt-1 text-3xl font-bold tracking-[-0.04em]">주문</h1>
        <p className="mt-1 text-sm text-secondary">주문 번호로 주문을 찾아 환불 금액을 셈하고 장부에 적습니다.</p>
      </header>

      <form action="/ops/orders" className={`${CARD} flex flex-col gap-2 sm:flex-row sm:items-center sm:gap-3`}>
        <label htmlFor="order-number" className="shrink-0 text-xs font-semibold text-muted sm:w-20">
          주문 번호
        </label>
        <input
          id="order-number"
          name="order"
          defaultValue={typed}
          placeholder="rdo_…"
          autoComplete="off"
          spellCheck={false}
          className={`${FIELD} w-full font-mono`}
        />
        <button type="submit" className={`${BUTTON_SECONDARY_SMALL} shrink-0`}>
          찾기
        </button>
      </form>

      {typed === '' ? null : orderId === null ? (
        <p className={`${CARD} text-sm text-secondary`}>주문 번호는 rdo_ 로 시작하는 36자입니다.</p>
      ) : !found.ok ? (
        <FailureLine retry className={CARD}>
          주문을 읽지 못했습니다.
        </FailureLine>
      ) : found.value === null ? (
        <p className={`${CARD} text-sm text-secondary`}>이 번호의 주문이 없습니다.</p>
      ) : (
        <>
          {found.value.asked !== null ? (
            <Asked line={found.value.asked} hold={found.value.hold} />
          ) : (
            found.value.hold !== null && orderId !== null && <Departed orderId={orderId} hold={found.value.hold} />
          )}
          {found.value.others.length > 0 && <Others lines={found.value.others} />}
        </>
      )}
    </main>
  );
}
