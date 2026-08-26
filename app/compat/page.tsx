import Link from 'next/link';
import { Suspense } from 'react';

import { CompatCalculator } from '../compat-calculator';

export const metadata = {
  title: '궁합 — 만세력',
  description: '두 원국 사이에 성립하는 관계와 오행 보완을 사실 그대로 봅니다.',
};

export default function CompatPage() {
  return (
    <main className="app-shell flex flex-1 flex-col gap-8 py-9 sm:py-14">
      <header className="relative overflow-hidden rounded-[2rem] border border-border bg-surface px-6 py-9 shadow-[var(--shadow-card)] sm:px-10 sm:py-11">
        <div className="absolute -right-12 -top-20 size-64 rounded-full bg-fire-soft blur-3xl" aria-hidden="true" />
        <div className="relative max-w-3xl">
          <p className="eyebrow">Between Two People</p>
          <h1 className="mt-2 text-[2rem] font-bold leading-tight tracking-[-0.045em] sm:text-[2.75rem]">두 사람 사이의 흐름</h1>
          <p className="mt-4 max-w-2xl text-[0.95rem] leading-7 text-secondary">
            두 명식을 나란히 놓고 서로에게 생기는 관계와 오행의 보완을 살펴봅니다. 숫자로 좋고 나쁨을 단정하지 않고, 어떤 관계가 왜 보이는지 근거부터 설명합니다.
          </p>
          <Link href="/" className="mt-6 inline-flex rounded-full border border-border-strong bg-surface px-4 py-2 text-sm font-semibold hover:border-accent hover:text-accent">
            한 사람 명식으로 돌아가기
          </Link>
        </div>
      </header>

      {/*
        원국 화면과 같은 이유로 Suspense 아래에 둔다 — 주소창의 `#` 뒤를 읽는데
        이 페이지는 빌드 때 미리 그려지고, fragment 는 서버에 오지 않는다.
      */}
      <Suspense fallback={<div className="h-72 rounded-xl border border-border bg-surface" />}>
        <CompatCalculator />
      </Suspense>

      <footer className="border-t border-border py-6 text-xs leading-6 text-muted">
        계산은 전부 브라우저에서 실행됩니다. 두 사람의 입력은 주소의 <code>#</code> 뒤에
        담기므로 결과 화면을 그대로 링크로 줄 수 있고, 그 값은 서버로 전송되지 않습니다.
      </footer>
    </main>
  );
}
