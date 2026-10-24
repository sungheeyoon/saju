import Link from 'next/link';
import type { ReactNode } from 'react';

import { ICON_BUTTON_GHOST } from './buttons';
import { Icon } from './icons';

/**
 * **상단 바 한 벌** — ← 아이콘과 제목이 한 줄에 선다(ADR 0109 추기 2026-10-24 「상단 바」).
 *
 * 뒤로 가기가 두 꼴이었다 — 「← 인연」 밑줄 글자(인연 기록 · 궁합 결과)와 글자 없는 ← 아이콘(인연 궁합 · 대화방). 아이콘 꼴로 모은다 —
 * 당근 SEED Top Navigation 의 Standard(왼쪽 뒤로 · 그 옆 제목, seed-design.io/components/top-navigation, 2026-10-25 확인)와 이미 선
 * 인연 궁합 머리(`app/me/match/screen.tsx`)가 같은 꼴이다. 가는 곳의 이름은 보조기기가 읽는다(`aria-label`) — 온 곳으로 간다(ADR 0134).
 *
 * SEED 는 제목을 18px 굵게 · 고정 바(56px)로 세우지만 여기는 **화면 제목(`TYPE_TITLE`)을 그대로** 둔다 — 화면의 이름은 한 단이다
 * (ADR 0109 추기 「글자는 일곱 벌」). ← 의 누를 자리(44px)가 제목 줄보다 높아 왼쪽을 칸 반쯤 내민다(`-ml-2.5`) — 그림의 왼끝이 본문
 * 왼끝에 맞는다.
 */
export function TopBar({
  back,
  children,
  backHiddenOnWide = false,
}: {
  /** 돌아갈 곳 — `label` 은 그 화면의 이름(「인연」)이고 보조기기가 읽는다 */
  back: { href: string; label: string };
  /** 제목 — 그 화면의 머리(`h1` 이나 판 안의 `h2`)를 부르는 쪽이 세운다 */
  children: ReactNode;
  /** 넓은 화면에서 ← 를 걷는다 — 돌아갈 목록이 이미 옆에 서 있을 때(보관함의 책장) */
  backHiddenOnWide?: boolean;
}) {
  return (
    <div className={`-ml-2.5 flex items-center gap-1.5 ${backHiddenOnWide ? 'lg:ml-0' : ''}`}>
      <Link href={back.href} aria-label={back.label} className={`${ICON_BUTTON_GHOST} ${backHiddenOnWide ? 'lg:hidden' : ''}`}>
        <Icon name="back" className="size-6" />
      </Link>
      <div className="min-w-0 flex-1">{children}</div>
    </div>
  );
}
