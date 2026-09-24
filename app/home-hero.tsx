'use client';

import Link from 'next/link';
import { useEffect, useState, type ReactNode } from 'react';

import { SERVICE_TAGLINE } from '@/src/lib/brand';
import { HOUR_UNKNOWN_CHOICE } from '@/src/lib/input/query';
import type { Element } from '@/src/lib/saju';

import { supabaseInBrowser } from './auth/browser-client';
import { CompatEntry } from './compat-entry';
import { ELEMENT_TONE } from './element-tone';
import { HomeMap } from './home-map';
import { SignedInProvider } from './signed-in';
import { SajuCompatTabs } from './segmented-nav';
import {
  TAB_ACTION_PRIMARY,
  TAB_HERO_CARD,
  TabActions,
  TabHeroBody,
  TabHeroGlow,
} from './tab-hero';
import { ElementSymbol } from './ui/element-symbol';
import { Icon } from './ui/icon';
import { BrandMark } from './ui/logo';
import { TYPE_META, TYPE_SECTION } from './ui/surfaces';

/**
 * `/` 의 얼굴 — **처음 온 사람과 이미 들어온 사람에게 다른 것을 세운다.**
 *
 * 이 화면은 두 사람이 함께 쓴다. 로그인하지 않은 사람에게는 **현관**이다: 여기서
 * 제품이 무엇인지 알고, 코드를 넣고, 들어온다. 로그인한 사람에게는 홈의 「다른
 * 사람 사주 보기」가 데려오는 **연장**이다: 저장하지 않은 남의 생년월일시를 한 번
 * 계산해 보고, 궁합을 시작한다(메뉴에서 「사주·궁합」 탭은 5차에 빠졌다).
 *
 * 한 벌로 쓰던 동안 회원이 읽던 것은 이랬다 — 「사주풀이와 궁합은 로그인 후」(이미
 * 했다), 「사주풀이에서 만날 이야기」(이미 만났다), 「테스트 코드를 받으셨나요?」
 * (가입 관문이라 다시 지날 수 없다. `signup/form.tsx`). **셋 다 참이 아닌 문장이고,
 * 현관에서만 참이다.**
 *
 * ## 모르는 동안에는 현관을 세운다
 *
 * 헤더와 「궁합 보기」는 아직 모르는 동안 자리만 잡아 둔다 — 거기서 비는 것은 낱말
 * 하나 폭이라 값이 싸다. 여기서 같은 것을 하면 **화면의 첫 반쪽이 빈 칸으로 뜬다.**
 * 그리고 그 대가를 치르는 쪽이 하필 현관이 필요한 사람이다: 로그인하지 않은 사람은
 * 이 주소로 바로 들어오고, 회원은 앱 안에서 걸어온다.
 *
 * 그래서 **미리 그려진 HTML 이 곧 현관**이고, 세션을 알고 나서 회원 쪽으로 갈린다.
 * 회원이 한 틱 동안 현관을 보는 것은 맞바꾼 값이다 — 빈 화면과 달리, 그동안 보이는
 * 것은 틀린 화면이 아니라 **덜 맞는 화면**이다.
 *
 * ## 세션을 한 번만 읽는다
 *
 * 「궁합 보기」가 스스로 읽던 것을 여기서 읽어 넘긴다. 둘이 따로 읽으면 잠깐 서로
 * 다른 답을 들 수 있고, 그러면 **회원의 화면에 「로그인 필요」가 한 번 깜빡인다** —
 * 그 파일이 없애려던 바로 그 거짓말이다.
 */
type Session = 'unknown' | 'in' | 'out';

export function HomeHero({ calculator }: { calculator: ReactNode }) {
  const [session, setSession] = useState<Session>('unknown');

  useEffect(() => {
    const supabase = supabaseInBrowser();
    let watching = true;

    void supabase.auth.getSession().then(({ data }) => {
      if (watching) setSession(data.session === null ? 'out' : 'in');
    });

    /* 이 화면에서 로그아웃하면(계정 메뉴) 현관으로 되돌아온다 */
    const { data } = supabase.auth.onAuthStateChange((_event, next) => {
      setSession(next === null ? 'out' : 'in');
    });

    return () => {
      watching = false;
      data.subscription.unsubscribe();
    };
  }, []);

  const member = session === 'in';

  return (
    <>
      {/*
        **자리에 서는 부품의 종류를 안 바꾼다.** 여기가 `{member ? <MemberHero/> :
        <VisitorHero/>}` 였다. 종류가 갈리면 세션이 풀리는 순간 React 가 머리 전체를
        **뜯고 다시 세운다** — 화면이 한 번 튀고, 그 순간에 손이 이미 폼에 가 있던
        사람은 자기가 친 글자를 잃을 수 있다. 얼굴 하나가 안에서 갈리면 자리는
        그대로고 글자만 바뀐다.
      */}
      <Hero member={member} signedIn={session === 'unknown' ? null : member} />

      {!member && <Stories />}

      <section id="calculator" className="scroll-mt-24">
        <div className="mb-5">
          {/*
            **제목은 둘이 같다.** 묻는 것이 같기 때문이다 — 가르는 것은 이 입력이
            그 사람에게 무엇이냐는 쪽이지 무엇을 묻느냐가 아니다.
          */}
          <p className="text-[13px] font-semibold text-cream-ink">{member ? '직접 입력' : '첫 단계 · 사주 확인'}</p>
          <h2 className={`mt-1 ${TYPE_SECTION}`}>출생 정보를 입력해 주세요</h2>
          <p className="mt-2 text-sm leading-6 text-secondary">
            {!member && (
              <>
                먼저 사주의 기본 구조를 확인하고, 사주풀이로 이어갈 수 있어요.
                <br />
              </>
            )}
            출생 시각을 모르면 「{HOUR_UNKNOWN_CHOICE}」을 고르세요.
          </p>
        </div>
        {/*
          **계산기도 이 값으로 갈린다** — 버튼이 「내 사주」와 「이 사람」으로 나뉜다.
          그런데 계산기를 여기서 만들지는 않는다: `Suspense` 경계는 서버가 세운 것을
          그대로 쓰고(`page.tsx`), 값만 통로로 내려보낸다(`signed-in.tsx`).
        */}
        <SignedInProvider value={member}>{calculator}</SignedInProvider>
      </section>
    </>
  );
}

/**
 * 로그인하지 않은 사람의 현관 — **미리 그려진 그대로다.**
 *
 * `signedIn` 을 그대로 넘긴다. 아직 모르는 동안에도 이 얼굴이 서 있으므로, 「궁합
 * 보기」의 꼬리표는 여기서도 **알고 나서** 붙어야 한다.
 */
function Hero({ member, signedIn }: { member: boolean; signedIn: boolean | null }) {
  return (
    <header className={TAB_HERO_CARD}>
      <TabHeroGlow />
      {/*
        **껍데기는 안 갈린다.** 자리에 서는 부품 종류가 바뀌면 세션이 풀리는 순간
        React 가 머리를 통째로 뜯고 다시 세워 화면이 한 번 튄다. 속만 갈린다.
      */}
      {member ? (
        <TabHeroBody
          eyebrow="사주"
          title="궁금한 사람의 사주를 바로 봅니다."
          lede={
            <p>
              생년월일시를 입력하면 여덟 글자를 확인할 수 있습니다.<br />
              저장하지 않고도 바로 볼 수 있습니다.
            </p>
          }
          /*
            **회원의 머리에는 토글 하나다.**

            버튼 둘이 서 있었다 — 「출생 정보 입력하기」(`#calculator`)와 「궁합 보러
            가기」. 앞엣것은 **바로 아래 보이는 폼으로 스크롤만 하는 누름**이고(`/compat`
            에서 같은 이유로 걷었다), 뒤엣것은 나란한 짝으로 가는 길인데 버튼 모양이라
            위아래 관계처럼 보였다.

            지금은 사주와 궁합이 **한 덩이 토글**로 선다. 지금 어디에 있는지와 다른
            반쪽으로 가는 길을 한 부품이 함께 말한다 — 한 사람의 사주와 풀이가 이미
            같은 모양이다(`SegmentedNav`).
          */
          actions={<SajuCompatTabs current="saju" />}
        />
      ) : (
        <VisitorFace signedIn={signedIn} />
      )}
    </header>
  );
}

/**
 * 계산기로 내려가는 누름 — **주소의 `#` 을 건드리지 않는다.**
 *
 * `#` 뒤는 이 화면의 입력이다(`app/hash-query.ts`). `href="#calculator"` 를 그대로 따라가면 주소가 그 낱말로
 * 바뀌고, 계산기는 그것을 빈 입력으로 읽어 이미 선 결과를 걷는다. 그래서 눌리면 스크롤만 하고, 자바스크립트가
 * 없을 때만 링크가 제 일을 한다(그때는 걷힐 결과도 없다).
 */
function scrollToCalculator(event: React.MouseEvent<HTMLAnchorElement>) {
  const target = document.getElementById('calculator');
  if (target === null) return;
  event.preventDefault();
  target.scrollIntoView({ behavior: 'smooth', block: 'start' });
  target.querySelector<HTMLInputElement>('input')?.focus({ preventScroll: true });
}

/**
 * 현관의 속 — 카드 껍데기는 `Hero` 가 든다.
 *
 * 첫인상은 넷이 한 판에 선다: 로고와 이름, 한 줄 소개(`SERVICE_TAGLINE`), 점으로 이루어지는 관계의 그림
 * (`HomeMap`), 바로 아래의 계산기로 가는 먹색 단추. 이름은 상수에서 오고(G-58) 로고가 곁에 선다.
 */
function VisitorFace({ signedIn }: { signedIn: boolean | null }) {
  return (
    <>
      <div className="relative grid items-center gap-6 px-5 pb-7 pt-6 sm:px-10 sm:pb-10 sm:pt-9 lg:grid-cols-[1.1fr_1fr] lg:gap-10">
        <div className="min-w-0">
          <BrandMark className="[&_svg]:size-9" nameClassName="!text-[1.6rem]" />
          <p className="mt-5 text-[15px] font-semibold text-cream-ink">{SERVICE_TAGLINE}</p>
          <h1 className="mt-2 font-rounded text-[2rem] leading-[1.3] tracking-[-0.02em] text-foreground sm:text-[2.75rem] sm:leading-[1.25]">
            나는 어떤 사람일까.<br />우리는 왜 끌릴까.
          </h1>
          <p className="mt-4 max-w-md text-[15px] leading-7 text-secondary">
            타고난 성향부터 일과 연애, 지금의 운까지.<br />
            사주의 여덟 글자를 내 이야기로 읽어보세요.
          </p>
          <div className="mt-6">
            <TabActions>
              <a href="#calculator" onClick={scrollToCalculator} className={TAB_ACTION_PRIMARY}>
                출생 정보 입력하기
              </a>
              <CompatEntry signedIn={signedIn} />
            </TabActions>
          </div>
          <p className={`mt-3 ${TYPE_META}`}>사주는 로그인 없이 · 사주풀이와 궁합은 로그인 후</p>
        </div>
        {/*
          그림은 넓은 화면에서 오른쪽 반을, 폰에서는 제목 아래 가운데를 차지한다. 폰에서 너무 크면 계산기가
          두 화면 아래로 밀리므로 폭을 묶는다.
        */}
        <HomeMap className="mx-auto max-w-[17rem] sm:max-w-[22rem] lg:max-w-[26rem]" />
      </div>
      {/*
        **가입 관문은 현관에만 선다.** 코드는 가입할 때 한 번 쓰고 그 뒤로는 쓸 자리가
        없다(`signup/form.tsx`). 회원에게 세우면 눌러도 다시 지날 수 없는 길이다.
      */}
      <div className="relative mx-3 mb-3 flex flex-col gap-1 rounded-[1.5rem] bg-surface px-5 py-4 text-sm leading-6 sm:mx-4 sm:mb-4 sm:flex-row sm:items-center sm:justify-between sm:gap-6 sm:px-6">
        <div className="flex min-w-0 gap-3">
          <Icon name="ticket" className="mt-0.5 size-5 text-cream-ink" />
          <p className="min-w-0">
            <strong className="font-semibold text-foreground">테스트 코드를 받으셨나요?</strong>{' '}
            <span className="text-secondary">로그인 후 코드를 입력하고, 지급된 풀이권으로 사주풀이와 궁합을 이용해 보세요.</span>
          </p>
        </div>
        <Link
          href="/auth"
          className="ml-8 inline-flex min-h-11 w-fit shrink-0 items-center gap-1 font-semibold text-foreground underline decoration-[color-mix(in_srgb,var(--foreground)_25%,transparent)] decoration-2 underline-offset-[6px] hover:decoration-foreground sm:ml-0"
        >
          테스트 코드로 시작하기 →
        </Link>
      </div>
    </>
  );
}

/**
 * 사주풀이에서 만날 이야기 셋 — **현관에만 선다.** 회원은 이미 만났다(파일 머리말).
 *
 * 한 줄마다 오행 파스텔 하나를 입힌다. 색은 뜻을 지지 않는다 — 세 이야기의 차례를 눈으로 가르는 장식이라
 * 상징도 `aria-hidden` 이고, 오행 이름을 곁에 적지 않는다(적으면 이야기가 그 오행의 것처럼 읽힌다).
 */
const STORIES: readonly (readonly [Element, string, string])[] = [
  ['木', '나답게 잘하는 일은 뭘까?', '타고난 성향과 강점, 일과 돈의 흐름'],
  ['火', '연애할 때 나는 어떤 모습일까?', '관계에서 드러나는 내 성향과 조심할 점'],
  ['水', '지금은 어떤 시기를 지나고 있을까?', '내 사주와 함께 읽는 대운·세운·월운'],
];

function Stories() {
  return (
    <section aria-labelledby="stories" className="flex flex-col gap-3">
      <h2 id="stories" className="text-[13px] font-semibold text-cream-ink">사주풀이에서 만날 이야기</h2>
      <ul className="grid gap-3 sm:grid-cols-3">
        {STORIES.map(([element, title, description]) => (
          <li
            key={title}
            className={`${ELEMENT_TONE[element].scope} flex items-start gap-3 rounded-[1.5rem] bg-[var(--tile)] p-4 sm:flex-col sm:gap-4 sm:p-5`}
          >
            <span className="grid size-11 shrink-0 place-items-center rounded-full bg-surface">
              <ElementSymbol element={element} className="size-6" />
            </span>
            <div className="min-w-0">
              <p className="text-[15px] font-semibold leading-6 text-foreground">{title}</p>
              <p className="mt-1 text-[13px] leading-5 text-secondary">{description}</p>
            </div>
          </li>
        ))}
      </ul>
      <p className={TYPE_META}>풀이 주제 안내입니다. 실제 풀이는 출생 정보를 바탕으로 생성돼요.</p>
    </section>
  );
}
