import type { ReactNode } from 'react';

/**
 * 「사주·궁합」 탭의 머리 — **한 탭이면 한 얼굴이다.**
 *
 * 이 탭에는 화면이 둘 있다. 한 사람의 명식(`/`)과 두 사람의 궁합(`/compat`·`/me/compat`).
 * 머리글이 둘을 같은 줄로 묶는데(`site-header.tsx` 의 `isNavigationActive`), 정작 두
 * 화면의 머리는 여백도 글자 크기도 발광색도 서로 달랐다 — **같은 곳이라고 말해 놓고
 * 다른 곳처럼 생긴 것**이다. 껍데기를 여기 한 벌만 두어 그럴 자리를 없앤다.
 *
 * ## 길은 짝을 이룬다
 *
 * 더 나빴던 것은 오가는 길이었다. `/` 에는 「궁합 보기」가 있어 옆으로 갔는데,
 * `/compat` 의 유일한 길은 「내 사주로 돌아가기」로 **`/me` 즉 다른 탭**이었다. 한쪽은
 * 탭 안에서 움직이고 다른 쪽은 탭을 떠나는 것이라, 두 화면이 형제라는 말이 화면에서만
 * 거짓이 됐다.
 *
 * 그래서 두 머리의 버튼 줄이 같은 모양을 쓴다: **이 화면에서 시작하는 길**(진한 버튼)과
 * **이 탭의 나머지 반쪽**(테두리 버튼). 어느 쪽에 서 있든 다른 반쪽이 같은 자리에 있다.
 */
export const TAB_HERO_CARD =
  'relative overflow-hidden rounded-[1.75rem] border border-border bg-surface shadow-[var(--shadow-card)]';

/** 카드 오른쪽 위의 번짐 — 두 화면이 같은 색을 쓴다(전에는 목/화로 갈려 있었다) */
export function TabHeroGlow() {
  return (
    <div
      className="absolute -right-12 -top-16 size-64 rounded-full bg-wood-soft blur-3xl"
      aria-hidden="true"
    />
  );
}

/**
 * 머리의 속 — 눈썹·제목·설명·버튼 줄.
 *
 * 껍데기를 따로 내주는 것은 `/` 때문이다. 거기서는 로그인 안 한 사람에게 아주 다른
 * 속이 서는데(`home-hero.tsx` 의 `VisitorFace`), **자리에 서는 부품 종류가 바뀌면**
 * 세션이 풀리는 순간 머리가 통째로 뜯겨 화면이 한 번 튄다. 껍데기는 늘 같은 것이
 * 서 있고 속만 갈린다.
 */
export function TabHeroBody({
  eyebrow,
  title,
  lede,
  actions,
}: {
  eyebrow: string;
  title: ReactNode;
  lede: ReactNode;
  actions: ReactNode;
}) {
  return (
    <div className="relative flex flex-col gap-6 px-6 py-7 sm:flex-row sm:items-end sm:justify-between sm:gap-8 sm:px-10 sm:py-9">
      <div className="min-w-0">
        <p className="eyebrow">{eyebrow}</p>
        <h1 className="mt-2 text-2xl font-bold leading-[1.35] tracking-[-0.04em] sm:text-[1.875rem]">
          {title}
        </h1>
        {/*
          **문단이 여럿일 수 있다.** 궁합 쪽은 「무엇을 보는가」와 「어떻게 말하는가」를
          따로 적는다 — 한 덩어리로 붙이면 둘째 문장이 첫째의 꼬리처럼 읽힌다.
          그래서 `<p>` 가 아니라 칸이고, 부르는 쪽이 문단을 넣는다.
        */}
        <div className="mt-2.5 flex max-w-lg flex-col gap-2 text-sm leading-6 text-secondary sm:text-[0.95rem] sm:leading-7">
          {lede}
        </div>
      </div>
      {actions}
    </div>
  );
}

/** 껍데기와 속을 한 번에 — 속이 안 갈리는 화면(`/compat`)은 이걸 쓴다 */
export function TabHero(props: Parameters<typeof TabHeroBody>[0]) {
  return (
    <header className={TAB_HERO_CARD}>
      <TabHeroGlow />
      <TabHeroBody {...props} />
    </header>
  );
}

/**
 * 버튼 줄 — **좁은 화면에서 둘이 한 줄을 나눠 쓰고 높이가 같다.**
 *
 * `flex-1` 이라 하나만 설 때도 자리가 비지 않는다. 칸을 `grid-cols-2` 로 고정하면
 * 버튼 하나짜리 화면(막힌 계정의 궁합 머리)에서 반쪽이 빈 채로 선다.
 */
export function TabActions({ children }: { children: ReactNode }) {
  return (
    <div className="flex flex-wrap items-stretch gap-2 sm:shrink-0 sm:gap-3">{children}</div>
  );
}

const ACTION =
  'flex min-h-11 flex-1 items-center justify-center rounded-full px-3 py-2.5 text-center text-[0.8125rem] font-semibold leading-5 sm:flex-none sm:px-5 sm:text-sm';

/** 이 화면에서 시작하는 길 */
export const TAB_ACTION_PRIMARY = `${ACTION} bg-accent text-on-accent hover:bg-accent-strong`;

/** 이 탭의 나머지 반쪽으로 가는 길 — 「로그인 필요」가 붙을 수 있어 세로로 쌓는다 */
export const TAB_ACTION_SECONDARY = `${ACTION} flex-col border border-border-strong bg-surface hover:border-accent hover:text-accent`;
