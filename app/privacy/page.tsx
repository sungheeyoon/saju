import Link from 'next/link';

import { CARD } from '../card';
import {
  NOTICE_EDITION,
  NOTICE_NOT_READY,
  OPTIONAL_CONSENTS,
  OPTIONAL_CONSENT_NOTE,
  asKoreanDay,
  noticeFor,
  scheduleFrom,
} from '@/src/lib/consent';

import { supabaseOnServer } from '../auth/server-client';

export const metadata = {
  title: '개인정보 처리방침 — 만세력',
  description: '무엇을 받고, 무엇에 쓰고, 언제까지 두는지 적어 둡니다.',
};

/**
 * 처리방침 — **로그인 없이 열린다.**
 *
 * 초대 메일에 이 주소를 싣는다. 로그인해야 읽을 수 있으면 「가입하기 전에 무엇을 주는지
 * 알고 정한다」가 성립하지 않는다.
 *
 * **안내 화면과 같은 자료를 쓴다**(`src/lib/consent/notice.ts`). 따로 적으면 한쪽만
 * 고쳐지고, 그때 사용자가 읽은 것과 우리가 지키는 것이 갈린다.
 */
/*
  **정적이 아니다.** 일정이 표에 있으므로 요청마다 읽는다 — 그래야 운영자가 날짜를
  옮긴 순간부터 이 화면이 새 날짜를 말한다.
*/
export default async function PrivacyPage() {
  const supabase = await supabaseOnServer();
  const notice = await scheduleFrom((name) => supabase.rpc(name));

  /*
    **둘 다 있어야 안내가 선다.** 날짜가 없으면 보유기간을 말할 수 없고, 처리자와
    연락처가 없으면 열람·정정·삭제를 어디에 요구하는지 말할 수 없다 — 어느 쪽이
    비어도 지키는 것이 없는 문장만 남는다.
  */
  const ready = notice;

  return (
    <main className="app-shell flex w-full flex-1 flex-col gap-7 py-9 sm:py-12">
      <header className="border-b border-border pb-6">
        <p className="eyebrow">처리방침</p>
        <h1 className="mt-1 text-3xl font-bold tracking-[-0.04em]">개인정보 처리방침</h1>
        <p className="mt-1 text-sm text-secondary">
          이 서비스는 초대받은 분만 쓰는 비공개 베타입니다. {NOTICE_EDITION.name} ·{' '}
          {asKoreanDay(NOTICE_EDITION.effectiveFrom)} 시행.
        </p>
      </header>

      {ready === null ? (
        /*
          **날짜를 지어내지 않는다.** 「추후 종료 예정」으로 메우면 그 문장이 실제로
          지키는 것이 없고, 보유기간을 「목적 달성 시까지」로 적는 것과 같은 말이 된다.
        */
        <p className={`${CARD} text-sm leading-6`}>{NOTICE_NOT_READY}</p>
      ) : (
        <>
          {noticeFor(ready.dates, ready.operator).map((section) => (
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

          <section className={`${CARD} flex flex-col gap-3`}>
            <h2 className="text-base font-bold">고르실 수 있는 것</h2>
            <p className="text-sm leading-6 text-secondary">{OPTIONAL_CONSENT_NOTE}</p>
            <ul className="flex flex-col gap-3">
              {OPTIONAL_CONSENTS.map((one) => (
                <li key={one.key}>
                  <p className="text-sm font-semibold">{one.label}</p>
                  <p className="mt-0.5 text-sm leading-6 text-secondary">{one.detail}</p>
                </li>
              ))}
            </ul>
          </section>

          <section className={`${CARD} flex flex-col gap-3`}>
            <h2 className="text-base font-bold">확인하고 고치고 지우는 방법</h2>
            <ul className="flex flex-col gap-2 text-sm leading-6 text-secondary">
              <li>저장된 출생 정보는 내 사주 화면에서 언제든 고칠 수 있습니다.</li>
              <li>선택 동의는 계정 관리 화면에서 켜고 끌 수 있습니다.</li>
              <li>
                계정과 저장된 정보의 삭제는 계정 관리 화면에서 요청하실 수 있습니다. 상세
                궁합이 열려 있던 상대가 있다면 그 결과는 양쪽 화면에서 함께 사라집니다.
              </li>
              <li>
                문의는 이 서비스를 초대해 드린 주소로 회신해 주시면 됩니다. 운영자가 직접
                답합니다.
              </li>
            </ul>
          </section>

          <p className="text-xs leading-5 text-muted">
            비공개 베타 기간에는 파기 시점이 위 종료일에 매여 있습니다(종료 후{' '}
            {ready.dates.purgeWithinDays}일 이내). 공개 전환 시에는 이 방침을 다시 씁니다.
          </p>
        </>
      )}

      <Link href="/" className="text-sm font-semibold text-accent underline underline-offset-4">
        처음으로
      </Link>
    </main>
  );
}
