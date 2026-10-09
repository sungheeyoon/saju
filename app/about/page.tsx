import Link from 'next/link';

import { SERVICE_NAME, SERVICE_NAME_TOPIC, SERVICE_TAGLINE } from '@/src/lib/brand';
import { BETA_SIGNUP_CODE_NOTE } from '@/src/lib/account/copy';

import { BUTTON_PRIMARY, BUTTON_SECONDARY } from '../ui/buttons';
import { SERVICE_FEATURES } from '../service-features';
import { Icon } from '../ui/icons';
import { Logo } from '../ui/logo';
import { CARD, PAPER, TYPE_META, TYPE_NAME, TYPE_SECTION, TYPE_TITLE } from '../ui/surfaces';
import { HomeLink } from '../home-link';

export const metadata = {
  title: '서비스 소개',
  description: `${SERVICE_NAME}에서 할 수 있는 것과 시작하는 차례를 알려 드려요.`,
};

/**
 * 서비스 소개 — **처음 온 사람이 「이게 뭐 하는 곳인가」를 묻는 자리.**
 *
 * 앞 판의 첫 화면은 입력 폼 하나였다. 폼은 「사주를 본다」만 말하고, 그 뒤에 무엇이 이어지는지(사주풀이 · 궁합 · 인연 ·
 * 채팅)는 로그인한 뒤에야 탭으로 보였다. 이 화면은 그 넷을 가입 전에 한 장으로 보여 준다.
 *
 * **정적이다** — 세션도 DB 도 안 읽는다. 사실은 PRD 「화면」 · 「자원」 절이 말하는 것만 적는다 — 수(풀이권 · 저장 자리)는
 * 운영 중에 바뀌므로 여기 적지 않고 그 수가 서는 자리를 가리킨다.
 */
const STEPS: readonly { title: string; body: string }[] = [
  { title: '사주 보기', body: '첫 화면에서 생년월일시를 넣고 내 사주를 봐요.' },
  { title: '로그인 · 가입', body: '구글로 로그인하고, 테스트 코드와 닉네임으로 가입해요.' },
  { title: '내 사주 저장', body: '내 출생 정보를 저장하면 홈에 내 사주 카드가 서요.' },
  { title: '풀이 받기', body: '사주풀이 · 궁합 · 인연 중 마음 가는 것부터 시작해요.' },
];

export default function AboutPage() {
  return (
    <main className="app-shell flex w-full max-w-3xl flex-1 flex-col gap-10 py-9 sm:py-14">
      <header className={`flex flex-col gap-3 ${PAPER}`}>
        <Logo className="size-11" />
        <p className={TYPE_META}>{SERVICE_TAGLINE}</p>
        <h1 className={TYPE_TITLE}>{SERVICE_NAME_TOPIC} 이런 곳이에요</h1>
        {/* 운영자가 고른 두 문장(2026-10-09) — 넓은 화면은 문장마다 줄을 나누고, 폰은 폭대로 흐른다 */}
        <p className="text-[15px] leading-7 text-cream-ink">
          내 사주를 읽고, 궁금한 사람과의 궁합을 살펴보세요.{' '}
          <br className="max-sm:hidden" />
          새로운 인연에게 궁합을 요청하고, 서로 동의하면 대화를 시작할 수 있어요.
        </p>
      </header>

      <section aria-labelledby="about-features" className="flex flex-col gap-4">
        <h2 id="about-features" className={TYPE_SECTION}>
          할 수 있는 것
        </h2>
        <ul className="grid gap-3 sm:grid-cols-2">
          {SERVICE_FEATURES.map((feature) => (
            <li key={feature.title} className={`flex flex-col gap-2 ${CARD}`}>
              <span className="grid size-10 place-items-center rounded-full bg-surface-soft text-foreground">
                <Icon name={feature.icon} />
              </span>
              <h3 className={TYPE_NAME}>{feature.title}</h3>
              <p className="text-[15px] leading-6 text-secondary">{feature.body}</p>
              <p className={TYPE_META}>{feature.note}</p>
            </li>
          ))}
        </ul>
      </section>

      <section aria-labelledby="about-steps" className="flex flex-col gap-4">
        <h2 id="about-steps" className={TYPE_SECTION}>
          시작하는 차례
        </h2>
        <ol className="flex flex-col gap-2">
          {STEPS.map((step, index) => (
            <li key={step.title} className="flex gap-4 rounded-[1.25rem] border border-border bg-surface px-4 py-4">
              <span className="grid size-8 shrink-0 place-items-center rounded-full bg-accent text-sm font-bold text-on-accent tabular-nums">
                {index + 1}
              </span>
              <span className="flex flex-col gap-0.5">
                <span className="text-[15px] font-semibold text-foreground">{step.title}</span>
                <span className="text-sm leading-6 text-secondary">{step.body}</span>
              </span>
            </li>
          ))}
        </ol>
        <p className="text-sm leading-6 text-secondary">
          {BETA_SIGNUP_CODE_NOTE}
        </p>
      </section>

      <p className="flex flex-col gap-2 sm:flex-row">
        <HomeLink className={BUTTON_PRIMARY}>
          무료로 내 사주 보기
        </HomeLink>
        <Link href="/help" className={BUTTON_SECONDARY}>
          자주 묻는 질문
        </Link>
      </p>
    </main>
  );
}
