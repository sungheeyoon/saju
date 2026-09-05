import Link from 'next/link';
import { redirect } from 'next/navigation';

import { supabaseOnServer } from '../auth/server-client';
import { CARD } from '../card';
import { SignOutLink } from './sign-out-link';
import {
  NOTICE_AGAIN_NOTE,
  NOTICE_NOT_READY,
  NOTICE_VERSION,
  betaIsOver,
  noticeFor,
  scheduleFrom,
} from '@/src/lib/consent';

import { SignupForm } from './form';

export const metadata = {
  title: '가입하기 — 만세력',
  description: '테스트 코드와 닉네임을 넣고, 무엇을 받고 언제까지 두는지 확인합니다.',
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
 * ## 절반은 펴고 절반은 접는다
 *
 * 처리방침 전문은 `/privacy` 에 있고 로그인 없이 열린다. 여기서도 **같은 자료**로 절마다
 * 세운다 — 따로 적으면 한쪽만 고쳐지고, 그때 사용자가 읽은 것과 우리가 지키는 것이 갈린다.
 *
 * 여덟 절을 다 편 채로 세우면 코드 칸과 확인 칸이 화면 밖으로 밀린다. 그래서 **가려지면
 * 안 되는 넷만** 편다.
 *
 * - **무엇을 받고 무엇에 쓰나요** — 무엇을 주는지 모르고 주는 일이 없게
 * - **언제까지 두나요** — 이 관문이 존재하는 이유 자체다(ADR 0024). 운영자가 날짜를
 *   옮겨 다시 묻는 자리에서 그 날짜가 접혀 있으면 다시 묻는 뜻이 없다
 * - **풀이를 만들 때 밖으로 나가는 것** — 자료가 국외 모델로 나가는 유일한 자리
 * - **인연 찾기에서 상대에게 보이는 것** — 읽지 않으면 켠 적 없는 참여가 생긴다
 *   (PRD §4.1, ADR 0037)
 *
 * 접는 넷은 위탁·국외이전·파기절차·권리 행사다. 길고, 읽는 사람이 필요할 때 찾아 읽는
 * 종류이고, `/privacy` 에 펼친 채로 서 있다.
 */

/** 접어 두는 절 — **여기 없는 것은 펴진다**(모르는 절이 생기면 펴지는 쪽이 안전하다) */
const FOLDED = new Set([
  '맡겨서 처리하는 곳',
  '국외로 나가는 것',
  '파기 절차와 방법',
  '권리와 행사 방법',
]);
export default async function SignupPage() {
  const supabase = await supabaseOnServer();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/auth');

  const [{ data: account }, notice] = await Promise.all([
    supabase
      .from('app_user')
      .select('status, signed_up_at, nickname, notice_version, notice_schedule_id')
      .maybeSingle(),
    scheduleFrom((name) => supabase.rpc(name)),
  ]);

  if (account === null) {
    return (
      <main className="app-shell flex w-full flex-1 flex-col gap-7 py-9 sm:py-12">
        <p className={`${CARD} text-sm leading-6`}>계정을 읽지 못했습니다. 다시 로그인해 주세요.</p>
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
          {again ? '처리방침이 바뀌었습니다' : '테스트 코드와 닉네임만 있으면 됩니다'}
        </h1>
        <p className="mt-1 text-sm leading-6 text-secondary">
          {again
            ? NOTICE_AGAIN_NOTE
            : '초대받은 분만 쓰는 비공개 베타입니다. 무엇을 받고 언제까지 두는지 아래에 적어 두었습니다.'}
        </p>
      </header>

      {notice === null ? (
        /*
          **날짜를 지어내지 않는다.** 「추후 종료 예정」으로 메우면 그 문장이 실제로
          지키는 것이 없고, 보유기간을 「목적 달성 시까지」로 적는 것과 같은 말이 된다.
        */
        <p className={`${CARD} text-sm leading-6`}>{NOTICE_NOT_READY}</p>
      ) : (
        <>
          <section className="flex flex-col gap-2">
            {noticeFor(notice.dates, notice.operator).map((section) => {
              const open = !FOLDED.has(section.title);

              return (
                <details
                  key={section.title}
                  open={open}
                  className="group rounded-2xl border border-border bg-surface"
                >
                  <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-5 py-3.5 text-sm font-bold hover:text-accent [&::-webkit-details-marker]:hidden">
                    {section.title}
                    <span className="shrink-0 text-xs font-medium text-muted">
                      <span className="group-open:hidden">펼치기</span>
                      <span className="hidden group-open:inline">접기</span>
                    </span>
                  </summary>
                  <ul className="flex flex-col gap-2 border-t border-border px-5 py-4">
                    {section.lines.map((line) => (
                      <li key={line} className="text-sm leading-6 text-secondary">
                        {line}
                      </li>
                    ))}
                  </ul>
                </details>
              );
            })}
          </section>

          <Link
            href="/privacy"
            className="self-start text-sm font-semibold text-accent underline underline-offset-4"
          >
            처리방침 전문 보기
          </Link>

          <section className={CARD}>
            <SignupForm
              needsCode={account.signed_up_at === null}
              needsName={account.nickname === null}
              version={NOTICE_VERSION}
              scheduleId={notice.scheduleId}
            />
          </section>
        </>
      )}

      {/*
        **나가는 길을 낸다.** 코드가 없는 사람은 여기서 할 수 있는 일이 없고, 다른 구글
        계정으로 들어와야 할 수도 있다. 길이 없으면 주소를 직접 쳐야 한다.
      */}
      <SignOutLink />
    </main>
  );
}
