import Link from 'next/link';
import { Suspense } from 'react';

import { CompatCalculator } from '../compat-calculator';

export const metadata = {
  title: '궁합 — 만세력',
  description: '두 원국 사이에 성립하는 관계와 오행 보완을 사실 그대로 봅니다.',
};

export default function CompatPage() {
  return (
    <main className="mx-auto flex w-full max-w-5xl flex-col gap-6 px-5 py-10 sm:px-6 sm:py-14">
      <header className="flex flex-col gap-1.5">
        <h1 className="text-2xl font-semibold tracking-tight">궁합</h1>
        <p className="max-w-2xl text-sm text-secondary">
          두 사람의 원국을 나란히 놓고 <strong className="font-medium">사이에</strong> 성립하는
          형충회합만 셉니다. 각자의 원국 안에서 닫힌 관계는 각자의 명식이 이미 보여주므로
          여기서 또 세지 않습니다. 사주 엔진은 점수를 내지 않고, 센 사실 아래에 그 사실만
          입력으로 쓰는 베타 매칭 지표를 따로 붙입니다.
        </p>
        <p className="text-sm">
          <Link href="/" className="text-accent underline underline-offset-2">
            한 사람 명식 보기
          </Link>
        </p>
      </header>

      {/*
        원국 화면과 같은 이유로 Suspense 아래에 둔다 — 주소창의 `#` 뒤를 읽는데
        이 페이지는 빌드 때 미리 그려지고, fragment 는 서버에 오지 않는다.
      */}
      <Suspense fallback={<div className="h-72 rounded-xl border border-border bg-surface" />}>
        <CompatCalculator />
      </Suspense>

      <footer className="mt-2 text-xs text-muted">
        계산은 전부 브라우저에서 실행됩니다. 두 사람의 입력은 주소의 <code>#</code> 뒤에
        담기므로 결과 화면을 그대로 링크로 줄 수 있고, 그 값은 서버로 전송되지 않습니다.
      </footer>
    </main>
  );
}
