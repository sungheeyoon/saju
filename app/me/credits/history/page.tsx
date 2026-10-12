import { refundRequestLine } from '@/src/lib/brand/refund';

import { supabaseOnServer } from '../../../auth/server-client';
import { signedInUser } from '../../../auth/signed-in';
import { redirectToSignIn } from '../../../auth/sign-in-redirect';
import { currentBusinessInfo } from '../../../business-info';
import { HistoryView } from './history-view';
import { myPaidOrders } from './orders';

export const metadata = {
  title: '결제 내역',
  description: '산 풀이권 묶음과 환불 신청 방법을 다시 봅니다.',
};

/**
 * **결제 내역** (G-21, ADR 0174) — 산 묶음마다 주문 번호 · 상품 · 금액 · 결제 시각 · 유효기간 끝나는 날 · 남은 회차 · 상태와
 * 환불 신청 방법을 다시 본다. 전자상거래법 제13조② 의 계약내용을 산 사람이 다시 볼 자리다(리디 「충전내역」의 꼴).
 *
 * 화면 안에서 결제를 취소하는 단추는 없다 — 환불은 운영자가 PG 에서 돌려주고 적는다(`docs/ops/runbook/credits.md`). 이 화면은 그
 * 신청에 드는 주문 번호와 길을 보인다. 결제 뒤 화면(`/me/credits/done`)의 완료 상태가 여기로 온다.
 */
export default async function CreditsHistoryPage() {
  const supabase = await supabaseOnServer();
  const user = await signedInUser(supabase);
  if (!user) return redirectToSignIn();

  const orders = await myPaidOrders(supabase);
  return <HistoryView orders={orders} refundLine={refundRequestLine(currentBusinessInfo())} />;
}
