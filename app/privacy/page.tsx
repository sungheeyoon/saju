import { BUTTON_TERTIARY } from '../ui/buttons';
import { CARD, TYPE_NAME, TYPE_TITLE } from '../ui/surfaces';
import {
  NOTICE_NOT_READY,
  OPTIONAL_CONSENTS,
  OPTIONAL_CONSENT_NOTE,
  noticeFor,
} from '@/src/lib/consent';

import { supabaseOnServer } from '../auth/server-client';
import { currentSchedule } from '../beta-schedule';
import { HomeLink } from '../home-link';

/** 조항의 한 줄 — 앞에 작은 점을 찍는다. 목록이 길어도 줄의 머리가 보인다 */
const DOT_LINE =
  "relative pl-4 text-[15px] leading-7 text-secondary before:absolute before:left-0.5 before:top-[0.8rem] before:size-1.5 before:rounded-full before:bg-border-strong before:content-['']";

/** 자료(`noticeFor`) 밖에서 이 화면이 직접 세우는 두 조항의 제목 */
const OPTIONAL_TITLE = '선택 항목';
const RIGHTS_TITLE = '확인하고 고치고 지우는 방법';

export const metadata = {
  title: '개인정보 처리방침',
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
  const schedule = await currentSchedule(supabase);

  /*
    **둘 다 있어야 안내가 선다.** 날짜가 없으면 보유기간을 말할 수 없고, 처리자와
    연락처가 없으면 열람·정정·삭제를 어디에 요구하는지 말할 수 없다 — 어느 쪽이
    비어도 지키는 것이 없는 문장만 남는다.
  */
  const ready = schedule.ok ? schedule.value : null;
  const sections = ready === null ? [] : noticeFor(ready.dates, ready.operator);
  /* 목차와 조항 제목이 같은 글자를 쓴다 — 한쪽만 고쳐지면 목차가 없는 조항을 가리킨다 */
  const titles = [...sections.map((section) => section.title), OPTIONAL_TITLE, RIGHTS_TITLE];

  return (
    <main className="app-shell flex w-full max-w-3xl flex-1 flex-col gap-4 py-8 sm:py-12">
      {/*
        **읽는 모양만 5차의 것이다** — 글자는 고지한 판 그대로다. 줄이 길면 눈이 다음 줄 머리를 놓치므로
        글줄을 3xl(48rem)로 묶고, 조항마다 카드 한 장 · 둥근 제목 · 점 목록으로 선다.
      */}
      <header className="mb-2 rounded-[2rem] bg-cream px-6 py-7 sm:px-8">
        <p className="text-[13px] font-semibold text-cream-ink">처리방침</p>
        <h1 className={`mt-1 ${TYPE_TITLE}`}>개인정보 처리방침</h1>
        <p className="mt-2 text-[15px] leading-7 text-secondary">
          이 서비스는 초대받은 분만 쓰는 비공개 베타입니다.
        </p>
      </header>

      {!schedule.ok ? (
        /* 못 읽은 것은 아직 정하지 않은 것과 다르다(ADR 0078) — 문이 옮겨 온 까닭을 세운다 */
        <p className={`${CARD} text-[15px] leading-7`}>{schedule.reason}</p>
      ) : ready === null ? (
        /*
          **날짜를 지어내지 않는다.** 「추후 종료 예정」으로 메우면 그 문장이 실제로
          지키는 것이 없고, 보유기간을 「목적 달성 시까지」로 적는 것과 같은 말이 된다.
        */
        <p className={`${CARD} text-[15px] leading-7`}>{NOTICE_NOT_READY}</p>
      ) : (
        <>
          {/*
            **목차 — 조항으로 바로 간다.** 폰에서 이 화면은 화면 열 장이 넘는다. 「언제까지 두나」 하나를 찾는 사람이
            끝까지 내려야 했다. 이름은 조항의 제목 그대로라 고지한 판의 글자를 바꾸지 않는다.
          */}
          <nav aria-label="목차" className={`${CARD} flex flex-col gap-2`}>
            <p className="text-[13px] font-semibold text-secondary">목차</p>
            <ol className="flex flex-col">
              {titles.map((title, index) => (
                <li key={title}>
                  <a
                    href={`#privacy-${index + 1}`}
                    className="flex min-h-11 items-center gap-3 rounded-xl px-2 text-[15px] text-foreground hover:bg-surface-soft"
                  >
                    <span className="w-5 shrink-0 text-right text-[13px] font-semibold tabular-nums text-muted">{index + 1}</span>
                    {title}
                  </a>
                </li>
              ))}
            </ol>
          </nav>

          {sections.map((section, index) => (
            <section key={section.title} id={`privacy-${index + 1}`} className={`${CARD} flex scroll-mt-20 flex-col gap-3`}>
              <h2 className={TYPE_NAME}>{section.title}</h2>
              <ul className="flex flex-col gap-2">
                {section.lines.map((line) => (
                  <li key={line} className={DOT_LINE}>
                    {line}
                  </li>
                ))}
              </ul>
            </section>
          ))}

          <section id={`privacy-${sections.length + 1}`} className={`${CARD} flex scroll-mt-20 flex-col gap-3`}>
            <h2 className={TYPE_NAME}>{OPTIONAL_TITLE}</h2>
            <p className="text-[15px] leading-7 text-secondary">{OPTIONAL_CONSENT_NOTE}</p>
            <ul className="flex flex-col gap-3">
              {OPTIONAL_CONSENTS.map((one) => (
                <li key={one.key} className="rounded-[1.25rem] bg-surface-soft px-4 py-3">
                  <p className="text-[15px] font-semibold">{one.label}</p>
                  <p className="mt-1 text-[15px] leading-7 text-secondary">{one.detail}</p>
                  <p className="mt-0.5 text-[15px] leading-7 text-secondary">{one.erasure}</p>
                </li>
              ))}
            </ul>
          </section>

          <section id={`privacy-${sections.length + 2}`} className={`${CARD} flex scroll-mt-20 flex-col gap-3`}>
            <h2 className={TYPE_NAME}>{RIGHTS_TITLE}</h2>
            <ul className="flex flex-col gap-2">
              <li className={DOT_LINE}>저장된 출생 정보는 내 사주 화면에서 언제든 고칠 수 있습니다.</li>
              <li className={DOT_LINE}>선택 동의는 계정 관리 화면에서 켜고 끌 수 있습니다.</li>
              <li className={DOT_LINE}>
                계정과 저장된 정보의 삭제는 계정 관리 화면에서 요청하실 수 있습니다. 상세
                궁합이 열려 있던 상대가 있다면 그 결과는 양쪽 화면에서 함께 사라집니다.
              </li>
              <li className={DOT_LINE}>
                문의는 이 서비스를 초대해 드린 주소로 회신해 주시면 됩니다. 운영자가 직접
                답합니다.
              </li>
            </ul>
          </section>

          <p className="px-1 text-[13px] leading-6 text-secondary">
            비공개 베타 기간의 정보 파기 시점은 위 종료일을 기준으로 합니다(종료 후{' '}
            {ready.dates.purgeWithinDays}일 이내). 공개 전환 시에는 이 방침을 다시 씁니다.
          </p>
        </>
      )}

      <HomeLink className={`${BUTTON_TERTIARY} w-fit`}>
        처음으로
      </HomeLink>
    </main>
  );
}
