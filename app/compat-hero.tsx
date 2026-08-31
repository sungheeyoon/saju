import Link from 'next/link';

import { CompatModeNav } from './compat-mode-nav';

/**
 * 궁합 화면의 머리 — **두 입력 방법이 같은 머리를 쓴다.**
 *
 * 익명 화면과 로그인 화면이 서로 다른 머리를 이고 있었다. 한쪽은 둥근 히어로에
 * 「내 사주로 돌아가기」가 있었고 다른 쪽은 작은 제목 줄 하나였다. **같은 일을 하는
 * 두 화면이 다르게 생기면 사용자는 자기가 다른 제품에 온 줄 안다** — 실제로 두 화면을
 * 오가는 길(`CompatModeNav`)이 그 안에 있으므로, 오갈 때마다 화면이 통째로 바뀐다.
 *
 * 갈리는 것은 **입력을 어디서 받는가 하나**여야 한다(ADR 0007 「이행」). 그 하나는
 * 아래의 나눔 탭이 이미 말하고 있다.
 */
export function CompatHero({ mode }: { mode: 'direct' | 'saved' }) {
  return (
    <>
      <header className="relative overflow-hidden rounded-[2rem] border border-border bg-surface px-6 py-9 shadow-[var(--shadow-card)] sm:px-10 sm:py-11">
        <div
          className="absolute -right-12 -top-20 size-64 rounded-full bg-fire-soft blur-3xl"
          aria-hidden="true"
        />
        <div className="relative max-w-3xl">
          <p className="eyebrow">궁합</p>
          <h1 className="mt-2 text-[2rem] font-bold leading-tight tracking-[-0.045em] sm:text-[2.75rem]">
            두 사람의 궁합 보기
          </h1>
          <p className="mt-4 max-w-2xl text-[0.95rem] leading-7 text-secondary">
            두 명식을 나란히 놓고 서로에게 생기는 관계와 오행의 보완을 살펴봅니다. 숫자로
            좋고 나쁨을 단정하지 않고, 어떤 관계가 왜 보이는지 근거부터 설명합니다.
          </p>
          <Link
            href="/me"
            className="mt-6 inline-flex rounded-full border border-border-strong bg-surface px-4 py-2 text-sm font-semibold hover:border-accent hover:text-accent"
          >
            내 사주로 돌아가기
          </Link>
        </div>
      </header>

      <CompatModeNav mode={mode} />
    </>
  );
}
