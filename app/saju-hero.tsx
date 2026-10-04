'use client';

import { useRouter } from 'next/navigation';
import { useEffect, type ReactNode } from 'react';

import { HOUR_UNKNOWN_CHOICE } from '@/src/lib/input/query';

import { useBrowserSession } from './auth/browser-session';
import { visitorLandingOf } from './saju-landing';
import { SignedInProvider } from './signed-in';
import { TAB_HERO_CARD, TabHeroBody, TabHeroGlow } from './tab-hero';
import { Bone } from './ui/skeleton';
import { TYPE_SECTION } from './ui/surfaces';

/**
 * `/saju` 의 얼굴 — **로그인한 사람이 저장하지 않고 한 사람의 사주를 보는 자리**(ADR 0144). 홈 탭의 한 화면이다.
 *
 * 이 화면도 미리 그려지고 세션을 브라우저에서 읽는다(`/` 와 같은 까닭 — 서버가 방문마다 세션을 묻지 않게). 머리는 세션과
 * 상관없는 글자라 미리 그려진 채 서고, **계산기는 로그인한 것을 안 뒤에만 선다** — 모르는 동안 세우면 로그인 전 폼의 모양과
 * 단추가 한 번 깜빡이고, 로그인하지 않은 사람에게는 곧 떠날 화면에 폼을 세우는 셈이다. 그동안 그 자리는 뼈대다.
 * 로그인하지 않은 사람은 같은 입력을 들고 첫 화면(`/`)으로 옮긴다(`saju-landing.ts`).
 */
export function SajuHero({ calculator }: { calculator: ReactNode }) {
  const { session } = useBrowserSession();
  const router = useRouter();

  useEffect(() => {
    if (session !== 'out') return;
    router.replace(visitorLandingOf(window.location));
  }, [session, router]);

  return (
    <>
      <header className={TAB_HERO_CARD}>
        <TabHeroGlow />
        <TabHeroBody
          eyebrow="사주"
          title="궁금한 사람의 사주를 바로 봅니다."
          lede={
            <p>
              생년월일시를 입력하면 여덟 글자를 확인할 수 있어요.<br />
              저장하지 않아도 볼 수 있어요.
            </p>
          }
        />
      </header>

      <section id="calculator" className="scroll-mt-24">
        <div className="mb-5">
          <p className="text-[13px] font-semibold text-cream-ink">직접 입력</p>
          <h2 className={`mt-1 ${TYPE_SECTION}`}>출생 정보를 입력해 주세요</h2>
          <p className="mt-2 text-sm leading-6 text-secondary">출생 시각을 모르면 「{HOUR_UNKNOWN_CHOICE}」을 고르세요.</p>
        </div>
        {/*
          계산기를 여기서 만들지 않는다 — `Suspense` 경계는 서버가 세운 것을 그대로 쓰고(`saju/page.tsx`), 값만 통로로
          내려보낸다(`signed-in.tsx`). 로그인한 것을 안 뒤에 처음 서므로 첫 그림부터 회원의 폼이다.
        */}
        {session === 'in' ? (
          <SignedInProvider value={session}>{calculator}</SignedInProvider>
        ) : (
          <Bone className="h-[34rem] rounded-[1.75rem]" />
        )}
      </section>
    </>
  );
}
