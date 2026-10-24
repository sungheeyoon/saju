import Link from 'next/link';
import type { ReactNode } from 'react';

import { BUTTON_PRIMARY } from './buttons';
import { Icon, type IconName } from './icons';
import { PAPER_FACE, TYPE_SECTION } from './surfaces';

/**
 * **빈 상태 한 벌** — 그림 · 제목 · 한 줄 · 단추 하나(ADR 0109 추기 2026-10-24 「빈 상태」).
 *
 * 화면마다 달랐다 — 채팅은 크림 종이에 그림과 큰 제목, 인연 기록은 크림 종이에 제목과 단추, 소식은 점선 칸에 종 그림과 합니다체
 * 한 줄, 풀이 보관함은 크림 종이에 표지 셋, 저장한 사람은 점선 칸에 회색 문장 하나(2026-10-24 감사). 모양은 당근 SEED Result
 * Section 의 차례(그림 → 제목 → 설명 → 단추, 부모 안 가운데)를 크림 종이(`PAPER_FACE`) 위에 세운다(seed-design.io/components/result-section,
 * 2026-10-25 확인). SEED 는 단추를 둘까지 두지만 여기는 **하나**다 — 빈 화면에서 할 일은 그 자리를 채우는 길 하나로 말한다.
 *
 * - 그림은 그 자리의 아이콘(`icon`, 동그라미 안)이 기본이고, 그린 그림(`art`)이 있으면 그것이 선다 — 둘 다 꾸밈이라 보조기기에 안 읽힌다.
 * - 같은 화면에 이미 그 길(「사람 추가」)이 서 있으면 단추를 안 세운다 — 같은 길을 두 번 세우지 않는다(PRD §3.2).
 * - `panel` — 넓은 화면의 좁은 판(채팅의 21rem 목록) 안에 설 때. 넓은 화면에서 그림을 걷고 왼쪽으로 붙는다.
 */
export function EmptyState({
  icon,
  art,
  title,
  children,
  action,
  panel = false,
}: {
  icon?: IconName;
  /** 그린 그림 — 있으면 `icon` 대신 선다 */
  art?: ReactNode;
  title: ReactNode;
  /** 제목 아래 한 줄 — 무엇을 하면 채워지는지. 글자를 자식으로 둔다(문구 상수는 JSX 자식으로만 부른다, ADR 0159) */
  children?: ReactNode;
  /** 단추 하나 — 그 자리를 채우는 길. 그림은 글자 앞(`icon`)이나 뒤(`trailingIcon`)에 하나 */
  action?: { href: string; label: ReactNode; icon?: IconName; trailingIcon?: IconName };
  panel?: boolean;
}) {
  return (
    <section
      className={`${PAPER_FACE} flex flex-col items-center gap-5 px-6 py-10 text-center sm:px-8 sm:py-12 ${
        panel ? 'lg:mx-4 lg:mb-4 lg:mt-3 lg:items-start lg:gap-4 lg:p-5 lg:text-left' : ''
      }`}
    >
      <span aria-hidden="true" className={panel ? 'lg:hidden' : ''}>
        {art ?? (
          <span className="grid size-16 place-items-center rounded-full bg-surface text-cream-ink">
            <Icon name={icon ?? 'spark'} className="size-7" />
          </span>
        )}
      </span>
      <div className="flex max-w-md flex-col gap-2">
        <h2 className={TYPE_SECTION}>{title}</h2>
        {children !== undefined && <p className="text-body leading-6 text-secondary">{children}</p>}
      </div>
      {action !== undefined && (
        <Link href={action.href} className={BUTTON_PRIMARY}>
          {action.icon && <Icon name={action.icon} className="size-[18px]" />}
          {action.label}
          {action.trailingIcon && <Icon name={action.trailingIcon} className="size-4" />}
        </Link>
      )}
    </section>
  );
}
