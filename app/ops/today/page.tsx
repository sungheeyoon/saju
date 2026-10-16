import { notFound } from 'next/navigation';

import { supabaseOnServer } from '../../auth/server-client';
import { signedInUser } from '../../auth/signed-in';
import { redirectToSignIn } from '../../auth/sign-in-redirect';
import { DENIED, operatorTodayFigures } from './read';
import { TodayView } from './today-view';

export const metadata = {
  title: '오늘의 숫자',
  description: '오늘 · 이번 주의 가입 · 풀이 · 주문 · 매출 · 환불 수를 봅니다.',
};

/**
 * **운영자가 오늘 · 이번 주의 숫자를 보는 자리** (G-110 ①, ADR 0183).
 *
 * 무엇을 세는가는 DB 의 `operator_today_figures` 가 정하고, 이 화면은 그 두 줄을 그리기만 한다. 운영자인지는 묻지 않는다 —
 * 자료를 청해 거절당하면 없는 화면이 된다(`notFound`, ADR 0103). 열 때마다 접속기록에 한 줄이 남는다(ADR 0105).
 */
export default async function OperatorTodayPage() {
  const supabase = await supabaseOnServer();

  const user = await signedInUser(supabase);
  if (!user) return redirectToSignIn();

  const figures = await operatorTodayFigures();
  if (figures === DENIED) notFound();

  return <TodayView figures={figures} />;
}
