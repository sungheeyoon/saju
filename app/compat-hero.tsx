import Link from 'next/link';

/**
 * 궁합 화면의 머리.
 *
 * **아래에 있던 나눔 탭을 걷었다**(ADR 0054). 「두 사람 직접 입력」과 「저장한 사람
 * 선택」이 화면 둘로 갈려 있었는데, 나뉜 것은 사람이 아니라 **한 칸의 입력 방법**이라
 * 지금은 칸마다 고른다. 오갈 화면이 없으니 오가는 길도 없다.
 */
export function CompatHero() {
  return (
    <>
      <header className="relative overflow-hidden rounded-[1.75rem] border border-border bg-surface px-6 py-9 shadow-[var(--shadow-card)] sm:px-10 sm:py-11">
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
    </>
  );
}
