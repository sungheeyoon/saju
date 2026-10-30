import Link from 'next/link';

import { HELP_GROUPS } from '@/src/lib/brand/guide';

import { BUTTON_SECONDARY } from '../ui/buttons';
import { Icon } from '../ui/icons';
import { OpenHashed } from './open-hashed';
import { CARD, COLUMN, DISCLOSURE_SUMMARY_FACE, TYPE_SECTION, TYPE_TITLE } from '../ui/surfaces';

export const metadata = {
  title: '자주 묻는 질문',
  description: '테스트 코드 · 풀이권 · 궁합 · 공유 링크 · 탈퇴에 대해 답해 드려요.',
};

/**
 * 자주 묻는 질문 — **화면이 한 번도 설명하지 않던 낱말을 답하는 자리.**
 *
 * 머리글에는 「풀이권 N장」가 늘 서는데, 그것이 무엇이고 언제 줄고 언제 돌아오는지는 확인 창이 열릴 때에야
 * 한 줄씩 보였다. 테스트 코드 · 궁합 · 공유 링크 · 인연 찾기 쉬기 · 탈퇴도 같다 — 저마다 제 화면 안에서만 답한다.
 * 여기는 그 답을 한 장에 모은다.
 *
 * **「입력한 생년월일시는 저장되나요?」는 세우지 않는다** — 로그인 전 입력이 서버로 오고 OpenAI 로 가는 일(ADR 0143)은
 * 처리방침 `notice-v8`(ADR 0180)이 적는다. 이 자리에 물음을 세울지는 따로 정한다.
 *
 * **정적이다.** 답은 PRD 「자원」 · 「사주풀이를 링크로 보낸다」 · 「들어오는 문」이 말하는 것만 적고, 이미 화면에 선 글자는
 * 그대로 옮긴다. 수(풀이권 · 저장 자리)는 바뀌므로 적지 않고 그 수가 서는 자리를 가리킨다.
 * 각 물음은 `id` 를 들어 다른 화면이 바로 가리킬 수 있다(`/help#credits` 처럼).
 */
export default function HelpPage() {
  return (
    <main className={`app-shell flex w-full ${COLUMN} flex-1 flex-col gap-8 py-8 sm:py-12`}>
      <OpenHashed />
      <header className="flex flex-col gap-2">
        <h1 className={TYPE_TITLE}>자주 묻는 질문</h1>
        <p className="text-body leading-7 text-secondary">궁금한 물음을 누르면 답이 펼쳐져요.</p>
      </header>

      {/* 묶음으로 바로 가는 줄 — 긴 목록에서 「풀이권」만 찾는 사람이 끝까지 내리지 않게 */}
      <nav aria-label="묶음">
        <ul className="flex flex-wrap gap-2">
          {HELP_GROUPS.map((group) => (
            <li key={group.title}>
              <a
                href={`#${group.items[0].id}`}
                className="inline-flex min-h-11 items-center rounded-full border border-border bg-surface px-4 text-sm font-semibold text-foreground hover:border-border-strong"
              >
                {group.title}
              </a>
            </li>
          ))}
        </ul>
      </nav>

      {HELP_GROUPS.map((group) => (
        <section key={group.title} className="flex flex-col gap-3">
          <h2 className={TYPE_SECTION}>{group.title}</h2>
          <ul className={`flex flex-col divide-y divide-border !py-1 ${CARD}`}>
            {group.items.map((item) => (
              <li key={item.id} id={item.id} className="scroll-mt-24">
                <details className="group py-1">
                  <summary className={`${DISCLOSURE_SUMMARY_FACE} py-2 text-body font-semibold`}>
                    {item.q}
                    <Icon name="chevron" className="size-4 shrink-0 text-secondary transition-transform group-open:rotate-90" />
                  </summary>
                  <div className="flex flex-col gap-2 pb-3">
                    {item.a.map((line) => (
                      <p key={line} className="text-body leading-7 text-secondary">
                        {line}
                      </p>
                    ))}
                    {item.link && (
                      <Link href={item.link.href} className="w-fit text-small font-semibold leading-5 text-foreground hover:opacity-70">
                        {item.link.label} →
                      </Link>
                    )}
                  </div>
                </details>
              </li>
            ))}
          </ul>
        </section>
      ))}

      <p>
        <Link href="/about" className={BUTTON_SECONDARY}>
          서비스 소개
        </Link>
      </p>
    </main>
  );
}
