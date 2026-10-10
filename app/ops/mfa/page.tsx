import { redirect } from 'next/navigation';

import { supabaseOnServer } from '../../auth/server-client';
import { signedInUser } from '../../auth/signed-in';
import { redirectToSignIn } from '../../auth/sign-in-redirect';
import { CARD } from '../../ui/surfaces';
import { opsReturnPath, secondFactorOf } from '../second-factor';
import { SECOND_FACTOR_COPY as COPY } from './copy';
import { SecondFactorForm } from './form';
import { FailureLine } from '../../ui/failure-line';

export const metadata = {
  title: COPY.title,
};

/**
 * **운영 화면 앞의 2단계 인증** (ADR 0123).
 *
 * 운영 화면(`/ops/reports` · `/ops/survey`)은 세션이 aal2 가 아니면 운영자 문을 안 부른다. 등록한 인증 앱이 있으면
 * 그 화면이 여기로 보내고, 없으면 운영자가 아닌 사람과 같은 404 다 — 그래서 **처음 등록은 운영자가 이 주소로 직접
 * 온다**(`docs/ops/runbook/operators.md` 「운영자 2단계 인증」).
 *
 * 「나는 운영자인가」를 여기서도 안 묻는다. 누구든 제 계정에 인증 앱을 등록할 수 있고, 그것으로 열리는 운영자 문은
 * 없다 — 문은 DB 가 판정한다. 이미 aal2 면 돌아갈 자리로 곧장 보낸다.
 */
export default async function SecondFactorPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const supabase = await supabaseOnServer();

  const user = await signedInUser(supabase);
  if (!user) return redirectToSignIn();

  const next = opsReturnPath((await searchParams).next);
  const factor = await secondFactorOf(supabase);
  if (factor === 'passed') redirect(next);

  return (
    <main className="app-shell flex w-full flex-1 flex-col gap-6 py-9 sm:py-12">
      <header className="border-b border-border pb-6">
        <p className="eyebrow">운영</p>
        <h1 className="mt-1 text-3xl font-bold tracking-[-0.04em]">{COPY.title}</h1>
      </header>

      {factor === 'unread' ? (
        <FailureLine retry className={CARD}>
          {COPY.unread}
        </FailureLine>
      ) : (
        <SecondFactorForm enrolled={factor === 'challenge'} next={next} />
      )}
    </main>
  );
}
