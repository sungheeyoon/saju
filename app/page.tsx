import { Suspense } from 'react';

import { HomeHero } from './home-hero';
import { SajuCalculator } from './saju-calculator';

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
          <Suspense fallback={<div className="h-56 rounded-[1.75rem] border border-border bg-surface shadow-[var(--shadow-card)]" />}>
            <SajuCalculator />
          </Suspense>
        }
      />
    </main>
  );
}
