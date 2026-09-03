import Link from 'next/link';
import { Suspense } from 'react';

import { EvidenceView } from './view';

export const metadata = {
  title: '넘길 자료 보기 — 만세력',
  description: '모델에 넘기는 근거 자료와 프롬프트, 그리고 상한 표를 봅니다.',
  /** 걸어 두지 않은 주소다 — 색인까지 되면 걸어 둔 것과 같아진다 */
  robots: { index: false, follow: false },
};

export default function EvidencePage() {
  return (
    <main className="app-shell flex flex-1 flex-col gap-8 py-9 sm:py-14">
      <header className="flex flex-col gap-2">
        <p className="eyebrow">내부 검증</p>
        <h1 className="text-3xl font-bold tracking-[-0.04em]">넘길 자료 보기</h1>
        <p className="max-w-prose text-sm leading-6 text-secondary">
          모델에 넘길 근거 자료와 프롬프트, 그리고 값마다 어디까지 말해도 되는지 적은 상한
          표입니다. 사용자 화면에는 서지 않습니다. 결과 화면에서 복사한 주소의{' '}
          <code>#</code> 뒤를 그대로 붙여 넣으면 같은 명식으로 섭니다.
        </p>
      </header>

      {/*
        결과 화면과 같은 이유로 Suspense 아래에 둔다 — 주소창의 `#` 뒤를 읽는데 이
        페이지는 빌드 때 미리 그려지고, fragment 는 서버에 오지 않는다.
      */}
      <Suspense fallback={<div className="h-72 rounded-xl border border-border bg-surface" />}>
        <EvidenceView />
      </Suspense>

      <footer className="flex flex-wrap gap-4 border-t border-border py-6 text-xs leading-6 text-muted">
        <span>
          입력은 주소의 <code>#</code> 뒤에만 있고 서버로 가지 않습니다. 계산도 자료 조립도
          이 브라우저에서 합니다.
        </span>
        <Link href="/me/reading/inspect" className="text-accent underline underline-offset-2">
          실제로 보낸 프롬프트 보기 →
        </Link>
      </footer>
    </main>
  );
}
