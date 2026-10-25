import Link from 'next/link';
import type { ReactNode } from 'react';

import { ICON_BUTTON_GHOST } from './buttons';
import { Icon } from './icons';

/**
 * **상단 바 한 벌** — ← 아이콘 한 줄, 그 아래 화면 제목(ADR 0109 추기 2026-10-24 「상단 바」).
 *
 * 뒤로 가기가 두 꼴이었다 — 「← 인연」 밑줄 글자(인연 기록 · 궁합 결과)와 글자 없는 ← 아이콘(인연 궁합 · 대화방). 아이콘 꼴로 모은다.
 * 가는 곳의 이름은 보조기기가 읽는다(`aria-label`) — 온 곳으로 간다(ADR 0134).
 *
 * **← 와 제목은 위아래로 선다**(2026-10-26). 한 줄에 세웠더니 제목이 ← 뒤 56px 에서 시작해, 같은 단의 다른 화면 제목(「풀이 보관함」 ·
 * 「소식」, 본문 왼끝 16px)과 왼쪽 축이 어긋났다. 토스 TDS 의 꼴이다 — 뒤로 가기는 위의 내비게이션 줄에, 큰 제목(`Top`)은 그 아래
 * 본문 왼끝에 선다(tossmini-docs.toss.im/tds-mobile/components/top, 확인 2026-10-26). 당근 SEED Top Navigation Standard 는 ← 옆에
 * 18px 제목을 두지만, 여기 제목은 화면 제목 한 단(`TYPE_TITLE`, ADR 0109 추기 「글자는 일곱 벌」)이라 그 옆에 서기에 크다.
 *
 * ← 의 누를 자리(44px)는 그림 칸(24px)보다 10px 씩 넓고, 화살 끝은 그림 칸 안 4px 에서 시작한다(`icons.tsx` 의 `back`, x=5.5 · 획 2).
 * 그 둘만큼 왼쪽을 내밀어(`-ml-3.5`) **화살 끝이 제목 · 본문 왼끝에 맞는다**(2026-10-26 1280px 에서 4px 안쪽에 섰다).
 * 위아래는 누를 자리의 여분만큼 거둬(`-my-2.5`) 줄의 높이가 그림 높이(24px)가 된다 — 그림 위 틈은 다른 화면의 제목 위 틈과 같고, 그림과 제목
 * 사이는 12px 다.
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
    <div className="flex flex-col items-start gap-3">
      <Link
        href={back.href}
        aria-label={back.label}
        className={`${ICON_BUTTON_GHOST} -my-2.5 -ml-3.5 ${backHiddenOnWide ? 'lg:hidden' : ''}`}
      >
        <Icon name="back" className="size-6" />
      </Link>
      <div className="w-full min-w-0">{children}</div>
    </div>
  );
}
