import { redirect } from 'next/navigation';

import { isBlocked } from '@/src/lib/account';
import { SURVEY_COPY } from '@/src/lib/survey';

import { supabaseOnServer } from '../../auth/server-client';
import { CARD } from '../../card';
import { AccountNotice } from '../account-notice';
import { readAccount } from '../account';
import { ConsentSwitch } from './consent-switch';
import { SurveyForm } from './form';
import { mySurvey, surveyContext } from './read';

export const metadata = {
  title: '서비스 설문 — 만세력',
  description: '지금까지 이용하면서 좋았던 점과 아쉬웠던 점을 알려주세요.',
};

/**
 * 서비스 설문 — **탭에서 언제든** (ADR 0062).
 *
 * 풀이 아래의 설문은 그 글 하나에 대한 답이라 그 글을 만든 시도에 매인다(ADR 0022).
 * 「무엇이 좋았나」·「얼마면 내겠나」는 매달릴 시도가 없어서 그 자리에 둘 수 없다.
 *
 * ## 띠를 안 세운다
 *
 * 「잔액이 0이 된 사람에게」·「종료 3일 전부터 모두에게」로 지으려 했다. 그러면 **답할
 * 사람을 우리가 고르는** 것이 되고 표본이 「다 써 본 사람」 쪽으로 기운다. 탭 하나를 열어
 * 두고 할 사람이 자기 때에 한다.
 *
 * ## 어느 문항이 서는지는 여기서 안 정한다
 *
 * `service_survey_context()` 가 답한다. 화면이 스스로 세면 저장하는 자리와 그리는 자리가
 * 다른 조건을 쓰게 되고, 그때 안 물어본 문항의 답이 저장된다.
 */
export default async function SurveyPage() {
  const supabase = await supabaseOnServer();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/auth');

  const { state } = await readAccount(supabase, 'status');
  if (isBlocked(state)) {
    return (
      <main className="app-shell flex flex-1 flex-col gap-6 py-9 sm:py-14">
        <AccountNotice state={state} />
      </main>
    );
  }

  const [context, given] = await Promise.all([surveyContext(), mySurvey()]);

  return (
    <main className="app-shell flex w-full flex-1 flex-col gap-5 py-9 sm:py-12">
      <header className="border-b border-border pb-6">
        <p className="eyebrow">{SURVEY_COPY.tab}</p>
        <h1 className="mt-1 text-3xl font-bold tracking-[-0.04em]">{SURVEY_COPY.title}</h1>
        <p className="mt-2 text-sm leading-6 text-secondary">{SURVEY_COPY.intro}</p>
        <p className="mt-1 text-xs text-muted">{SURVEY_COPY.editable}</p>
      </header>

      {context === null ? (
        <p role="alert" className={`${CARD} text-sm text-danger`}>
          설문을 열지 못했습니다. 잠시 뒤에 새로고침해 주세요.
        </p>
      ) : context.consented ? (
        <SurveyForm context={context} given={given} />
      ) : (
        /*
          **탭은 감추지 않는다.** 감추려면 헤더가 「이 사람이 동의했나」를 알아야 하는데,
          헤더는 브라우저에서 세션만 읽는다. 그 값을 물으려고 문을 하나 더 여는 대신,
          화면이 이유를 말하고 그 자리에서 켜게 한다.
        */
        <section className={`${CARD} flex flex-col gap-4`}>
          <div>
            <h2 className="text-base font-bold">먼저 동의가 필요합니다</h2>
            <p className="mt-1 text-sm leading-6 text-secondary">{SURVEY_COPY.consentNeeded}</p>
          </div>
          <ConsentSwitch />
        </section>
      )}
    </main>
  );
}
