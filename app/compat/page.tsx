import { redirect } from 'next/navigation';
import { Suspense } from 'react';

import { supabaseOnServer } from '../auth/server-client';
import { CompatCalculator } from '../compat-calculator';
import { CompatHero } from '../compat-hero';

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
      <CompatHero mode="direct" />

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
