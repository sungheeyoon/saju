import { Suspense } from 'react';

import { SajuCalculator } from '../saju-calculator';
import { SajuHero } from '../saju-hero';

/**
 * `/saju` — 로그인한 사람이 저장하지 않은 생년월일시로 한 사람의 사주를 본다(ADR 0144). 로그인 전에는 `/` 가 같은 일을 한다.
 *
 * **미리 그려진다.** 세션은 브라우저가 읽고(`SajuHero`), 입력은 주소창의 `#` 뒤에 있어 서버에 오지 않는다(ADR 0007). 계산기의
 * 기다림 경계는 서버가 세워야 미리 그려진 HTML 이 그 자리를 들고 온다(`signed-in.tsx`).
 *
 * 잠긴 목차는 로그인 전 결과에만 서므로 회원의 계산기에는 빈 목록을 넘긴다.
 */
export default function SajuPage() {
  return (
    <main className="app-shell flex flex-1 flex-col gap-8 py-8 sm:gap-10 sm:py-12 [&>*]:mx-auto [&>*]:w-full [&>*]:max-w-[42rem]">
      <SajuHero
        calculator={
          <Suspense fallback={<div className="h-[34rem]" />}>
            <SajuCalculator outline={[]} />
          </Suspense>
        }
      />
    </main>
  );
}
