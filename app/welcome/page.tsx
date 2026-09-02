import Link from 'next/link';
import { redirect } from 'next/navigation';

import { supabaseOnServer } from '../auth/server-client';
import { CARD } from '../card';
import { NOTICE_NOT_READY, NOTICE_VERSION, noticeFor, scheduleFrom } from '@/src/lib/consent';

import { ConsentForm } from './consent-form';

export const metadata = {
  title: '시작하기 전에 — 만세력',
  description: '무엇을 받고 언제까지 두는지 먼저 알려 드립니다.',
};

/**
 * 안내 화면 — **첫 입력보다 먼저 서는 자리.**
 *
 * `/me` 아래가 아니라 그 밖에 선다. 안에 두면 `/me` 의 관문이 이 화면 자신도 막아
 * 되돌이가 된다.
 *
 * ## 일정이 없으면 아무도 못 지나간다
 *
 * 보유기간을 말할 수 없는 안내는 안내가 아니다. 「추후 종료 예정」으로 메우면 그 문장이
 * 지키는 것이 없고, 그때 우리는 알린 적 없는 것을 알렸다고 여기게 된다. 그래서 날짜가
 * 없으면 **버튼이 아예 없다** — 못 지나가는 것이 이 값을 잊지 않게 하는 유일한 장치다.
 */
export default async function WelcomePage() {
  const supabase = await supabaseOnServer();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/auth');

  const { data: account } = await supabase
    .from('app_user')
    .select('notice_version')
    .maybeSingle();

  // 이미 이 판본을 확인했으면 여기 머물 이유가 없다.
  if (account?.notice_version === NOTICE_VERSION) redirect('/me');

  const dates = await scheduleFrom((name) => supabase.rpc(name));

  return (
    <main className="app-shell flex w-full flex-1 flex-col gap-7 py-9 sm:py-12">
      <header className="border-b border-border pb-6">
        <p className="eyebrow">시작하기 전에</p>
        <h1 className="mt-1 text-3xl font-bold tracking-[-0.04em]">
          무엇을 받고 언제까지 두는지 먼저 알려 드립니다
        </h1>
        <p className="mt-1 text-sm text-secondary">
          초대받은 분만 쓰는 비공개 베타입니다. 한 번만 확인하시면 됩니다.
        </p>
      </header>

      {dates === null ? (
        <p className={`${CARD} text-sm leading-6`}>{NOTICE_NOT_READY}</p>
      ) : (
        <>
          {noticeFor(dates).map((section) => (
            <section key={section.title} className={`${CARD} flex flex-col gap-3`}>
              <h2 className="text-base font-bold">{section.title}</h2>
              <ul className="flex flex-col gap-2">
                {section.lines.map((line) => (
                  <li key={line} className="text-sm leading-6 text-secondary">
                    {line}
                  </li>
                ))}
              </ul>
            </section>
          ))}

          <section className={`${CARD}`}>
            {/* 본 날짜를 함께 싣는다 — 그 사이에 일정이 바뀌었으면 DB 가 거절한다 */}
            <ConsentForm version={NOTICE_VERSION} endsOn={dates.endsOn} />
          </section>
        </>
      )}

      <Link
        href="/privacy"
        className="text-sm font-semibold text-accent underline underline-offset-4"
      >
        처리방침 전문 보기
      </Link>
    </main>
  );
}
