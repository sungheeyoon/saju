import { Suspense } from 'react';
import Link from 'next/link';

import { CompatEntry } from './compat-entry';
import { HOUR_UNKNOWN_CHOICE } from '@/src/lib/input/query';
import { SajuCalculator } from './saju-calculator';

export default function Home() {
  return (
    <main className="app-shell flex flex-1 flex-col gap-8 py-9 sm:gap-10 sm:py-14">
      <header className="relative overflow-hidden rounded-[1.75rem] border border-border bg-surface shadow-[var(--shadow-card)]">
        <div className="absolute -right-12 -top-16 size-64 rounded-full bg-wood-soft blur-3xl" aria-hidden="true" />
        <div className="relative grid gap-8 px-6 py-8 sm:px-10 sm:py-12 lg:grid-cols-[1.15fr_1fr] lg:gap-12">
          <div>
            <p className="eyebrow">나의 사주, 우리의 궁합</p>
            <h1 className="mt-4 text-[2rem] font-bold leading-[1.3] tracking-[-0.045em] sm:text-[2.75rem]">
              나는 어떤 사람일까.<br />우리는 왜 끌릴까.
            </h1>
            <p className="mt-4 max-w-md text-[0.95rem] leading-7 text-secondary">
              타고난 성향부터 일과 연애, 지금의 운까지.<br />
              사주의 여덟 글자를 내 이야기로 읽어보세요.
            </p>
            <div className="mt-6 grid grid-cols-2 items-stretch gap-2 sm:flex sm:flex-wrap sm:gap-3">
              <a href="#calculator" className="flex min-h-11 items-center justify-center rounded-full bg-accent px-3 py-2.5 text-center text-[0.8125rem] font-semibold leading-5 text-on-accent hover:bg-accent-strong sm:px-5 sm:text-sm">
                출생 정보 입력하기
              </a>
              <CompatEntry />
            </div>
            <p className="mt-3 text-xs leading-5 text-secondary">기본 명식은 로그인 없이 · 사주풀이와 궁합은 로그인 후</p>
          </div>
          <div className="rounded-2xl border border-border bg-background/80 p-5 sm:p-6">
            <p className="text-xs font-semibold tracking-wide text-accent">사주풀이에서 만날 이야기</p>
            <div className="mt-4 divide-y divide-border">
              {[
                ['01', '나답게 잘하는 일은 뭘까?', '타고난 성향과 강점, 일과 돈의 흐름'],
                ['02', '연애할 때 나는 어떤 모습일까?', '관계에서 드러나는 내 성향과 조심할 점'],
                ['03', '지금은 어떤 시기를 지나고 있을까?', '내 사주와 함께 읽는 대운·세운·월운'],
              ].map(([number, title, description]) => (
                <div key={number} className="flex gap-3 py-3 first:pt-0 last:pb-0">
                  <span className="pt-0.5 text-xs text-accent" aria-hidden="true">{number}</span>
                  <div><p className="text-sm font-semibold sm:text-base">{title}</p><p className="mt-1 text-xs leading-5 text-secondary">{description}</p></div>
                </div>
              ))}
            </div>
            <p className="mt-4 border-t border-border pt-3 text-xs leading-5 text-muted">풀이 주제 안내입니다. 실제 풀이는 출생 정보를 바탕으로 생성돼요.</p>
          </div>
        </div>
        <div className="border-t border-border bg-accent-wash px-6 py-4 text-sm leading-6 sm:px-10">
          <strong className="font-semibold text-accent">테스트 코드를 받으셨나요?</strong>{' '}
          <span className="text-secondary">로그인 후 코드를 입력하고, 지급된 풀이권으로 사주풀이와 궁합을 이용해 보세요.</span>
          <Link href="/auth" className="mt-2 flex min-h-11 w-fit items-center font-semibold text-accent underline underline-offset-4">테스트 코드로 시작하기 →</Link>
        </div>
      </header>

      <section id="calculator" className="scroll-mt-24">
        <div className="mb-5">
          <p className="eyebrow">첫 단계 · 기본 명식 확인</p>
          <h2 className="mt-1 text-xl font-bold tracking-tight sm:text-2xl">출생 정보를 입력해 주세요</h2>
          <p className="mt-2 text-sm leading-6 text-secondary">
            먼저 사주의 기본 구조를 확인하고, 사주풀이로 이어갈 수 있어요.<br />
            출생 시각을 모르면 「{HOUR_UNKNOWN_CHOICE}」을 고르세요.
          </p>
        </div>
        <Suspense fallback={<div className="h-56 rounded-[1.75rem] border border-border bg-surface shadow-[var(--shadow-card)]" />}>
          <SajuCalculator />
        </Suspense>
      </section>
    </main>
  );
}
