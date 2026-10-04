import type { ReactNode } from 'react';

import { TYPE_TITLE } from './ui/surfaces';

/**
 * 로그인한 사람의 계산 자리(`/saju`)의 머리 껍데기 — 크림 카드와 번짐(`saju-hero.tsx`, ADR 0144). 입력칸이 같은 화면에
 * 있으므로 머리에는 버튼을 안 세운다 — 시작하는 누름은 그 칸 안에 하나뿐이다.
 */
export const TAB_HERO_CARD = 'relative overflow-hidden rounded-[2rem] bg-cream';

/**
 * 카드 오른쪽 위의 번짐 — 두 화면이 같은 색을 쓴다(전에는 목/화로 갈려 있었다).
 *
 * 부드러움(5차)에서는 크림 종이 위에 나무의 파스텔이 스민다 — 관계 지도의 가운데가 내 일간 색으로 번지는 것과
 * 같은 말투다. 흐림을 걸지 않고 면 두 겹으로 둔다: `blur-3xl` 은 폰에서 스크롤마다 다시 그려 무거웠다.
 */
export function TabHeroGlow() {
  return (
    <div aria-hidden="true" className="pointer-events-none absolute -right-16 -top-20">
      <div className="size-64 rounded-full bg-wood-soft opacity-80" />
      <div className="absolute left-10 top-16 size-40 rounded-full bg-water-soft opacity-70" />
    </div>
  );
}

/** 머리의 속 — 눈썹 · 제목 · 설명 · 버튼 줄 */
export function TabHeroBody({
  eyebrow,
  title,
  lede,
  actions,
}: {
  eyebrow: string;
  title: ReactNode;
  lede: ReactNode;
  /** 버튼 줄 — **없을 수 있다.** 시작하는 자리가 곧 이 화면이면 세울 길이 없다 */
  actions?: ReactNode;
}) {
  return (
    <div className="relative flex flex-col gap-6 px-6 py-7 sm:flex-row sm:items-end sm:justify-between sm:gap-8 sm:px-10 sm:py-9">
      <div className="min-w-0">
        <p className="text-[13px] font-semibold text-cream-ink">{eyebrow}</p>
        <h1 className={`mt-2 ${TYPE_TITLE}`}>{title}</h1>
        {/*
          **문단이 여럿일 수 있다.** 궁합 쪽은 「무엇을 보는가」와 「어떻게 말하는가」를
          따로 적는다 — 한 덩어리로 붙이면 둘째 문장이 첫째의 꼬리처럼 읽힌다.
          그래서 `<p>` 가 아니라 칸이고, 부르는 쪽이 문단을 넣는다.
        */}
        <div className="mt-3 flex max-w-lg flex-col gap-2 text-[15px] leading-7 text-secondary">
          {lede}
        </div>
      </div>
      {actions ?? null}
    </div>
  );
}
