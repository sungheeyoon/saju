import Link from 'next/link';
import { Suspense } from 'react';

import { SajuCalculator } from './saju-calculator';

export default function Home() {
  return (
    <main className="app-shell flex flex-1 flex-col gap-8 py-9 sm:gap-10 sm:py-14">
      <header className="relative overflow-hidden rounded-[2rem] border border-border bg-surface px-6 py-9 shadow-[var(--shadow-card)] sm:px-10 sm:py-12">
        <div className="absolute -right-12 -top-16 size-64 rounded-full bg-wood-soft blur-3xl" aria-hidden="true" />
        <div className="relative max-w-3xl">
          <p className="eyebrow">My Saju</p>
          <h1 className="mt-3 text-[2rem] font-bold leading-[1.25] tracking-[-0.045em] sm:text-[3rem]">
            나를 이루는 흐름을<br className="hidden sm:block" /> 차분하게 읽어보세요
          </h1>
          <p className="mt-4 max-w-2xl text-[0.95rem] leading-7 text-secondary sm:text-base">
            생년월일시에서 명식을 계산하고, 결과가 나온 근거와 해석의 한계까지 함께 보여드립니다.
            입력은 이 브라우저 안에서만 계산되며 서버에 저장되지 않습니다.
          </p>
          <div className="mt-6 flex flex-wrap items-center gap-3">
            <a href="#calculator" className="rounded-full bg-accent px-5 py-2.5 text-sm font-semibold text-on-accent shadow-sm hover:-translate-y-0.5 hover:bg-accent-strong">
              내 명식 입력하기
            </a>
            <Link href="/compat" className="rounded-full border border-border-strong bg-surface px-5 py-2.5 text-sm font-semibold hover:border-accent hover:text-accent">
              두 사람 궁합 보기
            </Link>
          </div>
        </div>
        <div className="relative mt-8 flex flex-wrap gap-2" aria-label="오행">
          {[
            ['목', 'bg-wood-soft text-wood'], ['화', 'bg-fire-soft text-fire'],
            ['토', 'bg-earth-soft text-earth'], ['금', 'bg-metal-soft text-metal'],
            ['수', 'bg-water-soft text-water'],
          ].map(([name, tone]) => <span key={name} className={`grid size-9 place-items-center rounded-full text-xs font-bold ${tone}`}>{name}</span>)}
        </div>
      </header>

      {/*
        계산기는 주소창의 `#` 뒤를 읽는다(`app/hash-query.ts`). 이 페이지는 빌드 때 미리
        그려지고 fragment 는 서버에 오지도 않으므로, 그 값은 브라우저에서만 알 수 있다.
        폴백은 폼 자리를 차지할 만큼의 빈 상자다 — 결과가 들어오며 화면이 튀지 않게.
      */}
      <section id="calculator" className="scroll-mt-24">
        <div className="mb-5">
          <p className="eyebrow">Birth Information</p>
          <h2 className="mt-1 text-xl font-bold tracking-tight sm:text-2xl">출생 정보를 알려주세요</h2>
          <p className="mt-1 text-sm text-secondary">시간을 모르면 비워도 괜찮습니다. 확인 가능한 범위만 계산합니다.</p>
        </div>
        <Suspense fallback={<div className="h-56 rounded-2xl border border-border bg-surface shadow-[var(--shadow-card)]" />}>
          <SajuCalculator />
        </Suspense>
      </section>

      <footer className="border-t border-border py-6 text-xs leading-6 text-muted">
        절기는 천문 계산(태양 황경), 표준시 이력은 IANA tz 데이터에서 생성했습니다. 계산은
        전부 브라우저에서 실행됩니다.
      </footer>
    </main>
  );
}
