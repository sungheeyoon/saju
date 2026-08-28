import Link from 'next/link';
import { redirect } from 'next/navigation';
import { Suspense } from 'react';

import { supabaseOnServer } from '../auth/server-client';
import { CompatCalculator } from '../compat-calculator';
import { CompatModeNav } from '../compat-mode-nav';

export const metadata = {
  title: '궁합 — 만세력',
  description: '두 원국 사이에 성립하는 관계와 오행 보완을 사실 그대로 봅니다.',
};

export default async function CompatPage() {
  const supabase = await supabaseOnServer();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/auth?next=%2Fcompat');

  return (
    <main className="app-shell flex flex-1 flex-col gap-8 py-9 sm:py-14">
      <header className="relative overflow-hidden rounded-[2rem] border border-border bg-surface px-6 py-9 shadow-[var(--shadow-card)] sm:px-10 sm:py-11">
        <div className="absolute -right-12 -top-20 size-64 rounded-full bg-fire-soft blur-3xl" aria-hidden="true" />
        <div className="relative max-w-3xl">
          <p className="eyebrow">궁합</p>
          <h1 className="mt-2 text-[2rem] font-bold leading-tight tracking-[-0.045em] sm:text-[2.75rem]">두 사람의 궁합 보기</h1>
          <p className="mt-4 max-w-2xl text-[0.95rem] leading-7 text-secondary">
            두 명식을 나란히 놓고 서로에게 생기는 관계와 오행의 보완을 살펴봅니다. 숫자로 좋고 나쁨을 단정하지 않고, 어떤 관계가 왜 보이는지 근거부터 설명합니다.
          </p>
          <Link href="/me" className="mt-6 inline-flex rounded-full border border-border-strong bg-surface px-4 py-2 text-sm font-semibold hover:border-accent hover:text-accent">
            내 사주로 돌아가기
          </Link>
        </div>
      </header>

      <CompatModeNav mode="direct" />

      {/*
        원국 화면과 같은 이유로 Suspense 아래에 둔다 — 주소창의 `#` 뒤를 읽는데
        이 페이지는 빌드 때 미리 그려지고, fragment 는 서버에 오지 않는다.
      */}
      <Suspense fallback={<div className="h-72 rounded-xl border border-border bg-surface" />}>
        <CompatCalculator />
      </Suspense>

      <footer className="border-t border-border py-6 text-xs leading-6 text-muted">
        직접 입력한 정보는 저장되지 않으며 브라우저에서 계산됩니다. 결과 링크를 복사하면
        두 사람의 입력도 주소의 <code>#</code> 뒤에 함께 담깁니다.
      </footer>
    </main>
  );
}
