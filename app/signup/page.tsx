import { redirect } from 'next/navigation';

import { supabaseOnServer } from '../auth/server-client';
import { readAccount } from '../me/account';
import { AccountNotice } from '../me/account-notice';
import { CARD } from '../card';
import { SignOutLink } from './sign-out-link';
import {
  NOTICE_AGAIN_NOTE,
  NOTICE_NOT_READY,
  NOTICE_VERSION,
  betaIsOver,
  scheduleFrom,
} from '@/src/lib/consent';

import { SignupForm } from './form';

export const metadata = {
  title: '가입하기 — 만세력',
  description: '테스트 코드와 닉네임을 입력하고 만세력을 시작합니다.',
};

/**
 * 가입 — **한 화면, 한 폼** (ADR 0042).
 *
 * 전에는 `/welcome`(안내 확인)과 `/me/profile`(이름 짓기)이 각자 관문이었다. 구글
 * 로그인부터 사주 등록까지 화면 넷을 지나야 했고, 그 사이마다 튕김이 있었다 — 튕김이
 * 둘 겹치면 화면이 비는 고장을 실제로 만났다(커밋 `2cbb31f`).
 *
 * 이제 문은 여기 하나다. 코드로 들어오고, 이름을 짓고, 안내를 확인하는 일이 한 번의
 * 누름으로 끝난다.
 *
 * ## `/me` 밖에 선다
 *
 * `/closed` 와 같은 까닭이다. 안에 두면 관문이 이 화면 자신도 막아 되돌이가 된다.
 *
 * ## 일정이 없으면 아무도 못 지나간다
 *
 * 보유기간을 말할 수 없는 안내는 안내가 아니다. 「추후 종료 예정」으로 메우면 그 문장이
 * 지키는 것이 없고, 그때 우리는 알린 적 없는 것을 알렸다고 여기게 된다. 그래서 날짜가
 * 없으면 **폼이 아예 없다**(ADR 0024).
 *
 * ## 전문을 되풀이하지 않는다
 *
 * 처리방침 전문은 `/privacy` 에 로그인 없이 열린다. 가입 화면까지 전문을 복제하면 사용자가
 * 해야 할 코드·이름 입력이 문서 뒤로 밀리고, 두 화면의 역할도 흐려진다. 여기에는 가입 전에
 * 놓치면 안 되는 세 사실만 둔다: 어떤 정보를 쓰는지, 언제 파기하는지, 사주 저장 뒤 인연
 * 찾기에 참여한다는 것. 위탁·국외이전·파기 방법·권리 행사는 전문에서 읽는다.
 */
export default async function SignupPage() {
  const supabase = await supabaseOnServer();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/auth');

  /**
   * **문은 여기 것이고 문구만 같은 자리에서 가져온다.**
   *
   * 이 화면이 묻는 것은 가입이 끝났는가이지 자기 사주가 있는가가 아니라, `/me` 의 상태
   * 모형(ADR 0048)을 그대로 쓰지 않는다. 다만 **계정을 못 읽었을 때 하는 말**은 같아야
   * 하고, 그 말은 못 읽은 까닭에 따라 갈린다 — DB 가 잠긴 사람에게 「다시 로그인해
   * 주세요」는 들어올 곳이 없는 데로 보내는 말이다.
   */
  const [{ state, row: account }, notice] = await Promise.all([
    readAccount<{
      status: string;
      signed_up_at: string | null;
      nickname: string | null;
      notice_version: string | null;
      notice_schedule_id: number | null;
    }>(supabase, 'status, signed_up_at, nickname, notice_version, notice_schedule_id'),
    scheduleFrom((name) => supabase.rpc(name)),
  ]);

  if (account === null) {
    return (
      <main className="app-shell flex w-full flex-1 flex-col gap-7 py-9 sm:py-12">
        <div className={`${CARD} text-sm leading-6`}>
          <AccountNotice state={state} />
        </div>
      </main>
    );
  }

  /*
    **끝났으면 여기서 아무도 가입하지 않는다.** 안 막으면 종료일 다음 날에 들어온 사람이
    「10월 31일에 끝납니다」를 읽고 확인을 남긴다 — 이미 지난 날짜에 대고 하는 확인이다.
  */
  if (notice !== null && betaIsOver(notice.dates, new Date())) redirect('/closed');

  /**
   * **관문과 같은 것을 본다.**
   *
   * 판본과 그 줄까지 견주지 않으면, 일정을 옮기는 순간 이 화면과 관문이 서로에게 공을
   * 넘긴다 — 관문은 여기로 보내고 여기는 돌려보낸다. 답을 한 모양으로 맞춘다(`gateFor`).
   */
  const done =
    account.signed_up_at !== null &&
    notice !== null &&
    account.notice_version === NOTICE_VERSION &&
    account.notice_schedule_id === notice.scheduleId;

  if (done) redirect('/me');

  const again = account.signed_up_at !== null;

  return (
    <main className="app-shell flex w-full max-w-2xl flex-1 flex-col gap-7 py-9 sm:py-12">
      <header className="border-b border-border pb-6">
        <p className="eyebrow">{again ? '한 번 더 확인해 주세요' : '가입하기'}</p>
        <h1 className="mt-1 text-3xl font-bold tracking-[-0.04em]">
          {again ? '개인정보 처리방침이 바뀌었습니다' : '테스트 코드와 닉네임을 입력해 주세요'}
        </h1>
        <p className="mt-1 text-sm leading-6 text-secondary">
          {again
            ? NOTICE_AGAIN_NOTE
            : '초대받은 분만 이용할 수 있는 비공개 베타입니다. 가입에 필요한 정보만 간단히 확인해 주세요.'}
        </p>
      </header>

      {notice === null ? (
        /*
          **날짜를 지어내지 않는다.** 「추후 종료 예정」으로 메우면 그 문장이 실제로
          지키는 것이 없고, 보유기간을 「목적 달성 시까지」로 적는 것과 같은 말이 된다.
        */
        <p className={`${CARD} text-sm leading-6`}>{NOTICE_NOT_READY}</p>
      ) : (
        <section className={CARD}>
          <SignupForm
            needsCode={account.signed_up_at === null}
            needsName={account.nickname === null}
            version={NOTICE_VERSION}
            scheduleId={notice.scheduleId}
            endsOn={notice.dates.endsOn}
            purgeBy={notice.dates.purgeBy}
          />
        </section>
      )}

      {/*
        **나가는 길을 낸다.** 코드가 없는 사람은 여기서 할 수 있는 일이 없고, 다른 구글
        계정으로 들어와야 할 수도 있다. 길이 없으면 주소를 직접 쳐야 한다.
      */}
      <SignOutLink />
    </main>
  );
}
