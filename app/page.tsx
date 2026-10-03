import { Suspense } from 'react';

import { CONTROL, selfSectionTexts } from '@/src/lib/reading';

import { HomeHero } from './home-hero';
import { LandingGuide } from './landing-guide';
import { SajuCalculator } from './saju-calculator';

/**
 * 로그인 전 결과의 잠긴 목차 — **본 풀이가 실제로 세우는 절 이름**(ADR 0131).
 *
 * 화면이 이름을 따로 적으면 절을 고친 날 목차만 옛 이름으로 남는다. 그래서 프롬프트가 시키는 절에서 이름만 떼어
 * 넘긴다 — 이 화면은 빌드 때 서버에서 그려지므로 여기서 한 번 짓고, 브라우저로는 이름 아홉만 간다. 프롬프트 원문은
 * 안 간다(`scripts/layers.test.ts` 가 `'use client'` 에서 `reading/index` · `prompt` 로 가는 길을 막는다).
 */
const READING_OUTLINE: readonly string[] = selfSectionTexts(CONTROL).map((text) => text.split('\n', 1)[0]);

/**
 * `/` — **한 주소가 두 사람을 받는다.**
 *
 * 로그인하지 않은 사람에게는 「점점」의 첫인상이고, 로그인한 사람에게는 홈의 「다른 사람
 * 사주 보기」가 데려오는 연장이다. 무엇을 세울지는 `HomeHero` 가 브라우저에서 가른다 — 이 화면은
 * **빌드 때 미리 그려지므로** 서버에서 세션을 물으면 방문마다 도는 화면이 된다
 * (`site-header.tsx` 가 같은 까닭으로 같은 일을 한다).
 *
 * 계산기는 **여기서 만든다.** 주소창의 `#` 뒤를 읽는데 이 화면은 미리 그려지고,
 * fragment 는 서버에 오지 않는다 — 그 기다림의 경계를 서버가 세워야 미리 그려진
 * HTML 이 그 자리를 들고 온다. 세션은 `HomeHero` 가 통로로 내려보낸다(`signed-in.tsx`).
 */
export default function Home() {
  return (
    <main className="app-shell flex flex-1 flex-col gap-8 py-9 sm:gap-10 sm:py-14">
      <HomeHero
        calculator={
          // 미리 그려진 HTML 은 현관이다 — 자리표시도 현관 종이의 아래 토막 모양이다(`PAPER_BOTTOM`, ADR 0132)
          <Suspense fallback={<div className="h-[26rem] rounded-b-[2rem] bg-cream" />}>
            <SajuCalculator outline={READING_OUTLINE} />
          </Suspense>
        }
      />
      <LandingGuide />
    </main>
  );
}
