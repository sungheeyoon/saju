import Link from 'next/link';
import type { ReactNode } from 'react';

import { BUTTON_PRIMARY_SMALL } from './buttons';
import { Icon, type IconName } from './icons';
import { TYPE_SECTION } from './surfaces';

/**
 * **빈 상태 한 벌** — 그림 · 제목 · 한 줄 · 단추 하나(ADR 0109 추기 2026-10-24 「빈 상태」).
 *
 * 화면마다 달랐다 — 채팅은 크림 종이에 그림과 큰 제목, 인연 기록은 크림 종이에 제목과 단추, 소식은 점선 칸에 종 그림과 합니다체
 * 한 줄, 풀이 보관함은 크림 종이에 표지 셋, 저장한 사람은 점선 칸에 회색 문장 하나(2026-10-24 감사).
 *
 * **판도 테도 없이 그 자리 가운데에 선다**(2026-10-26). 당근 SEED Result Section 은 「컴포넌트 자체에는 배경색이 지정되어 있지
 * 않」고 부모 안에서 가운데 정렬한다(seed-design.io/components/result-section, 확인 2026-10-26). 토스 TDS `Result` 도 판 없이
 * 그림 → 제목 → 설명(4px 아래) → 작은 단추다(tossmini-docs.toss.im/tds-mobile/components/result, 확인 2026-10-26). 크림 종이를 깔면
 * 빈 자리가 「누를 수 있는 카드」처럼 읽혔다.
 *
 * - 틈은 토스 `Result` 의 차례를 이 앱의 글자 단에 옮겼다 — 그림 → 16px → 제목 → 6px → 한 줄 → 24px → 단추.
 * - 단추는 작은 주 단추(`BUTTON_PRIMARY_SMALL`)다 — 두 레퍼런스 모두 빈 화면 안의 단추는 화면 아래 CTA 보다 작다(SEED 「Contained
 *   Button」, 토스 `Result.Button` 38px). SEED 는 단추를 둘까지 두지만 여기는 **하나**다 — 빈 화면에서 할 일은 그 자리를 채우는 길
 *   하나로 말한다.
 * - 한 줄은 낱말 가운데서 꺾지 않고(`break-keep`) 두 줄이면 길이를 고르게(`text-balance`) — 가운데 정렬에서 한 줄만 길게 남으면
 *   축이 기울어 보인다.
 * - 그림은 그 자리의 아이콘(`icon`, 가라앉은 면 동그라미 안 — 판이 없으니 바탕보다 한 단 짙어야 보인다)이 기본이고, 그린 그림(`art`)이 있으면 그것이 선다 — 둘 다 꾸밈이라
 *   보조기기에 안 읽힌다.
 * - 같은 화면에 이미 그 길(「사람 추가」)이 서 있으면 단추를 안 세운다 — 같은 길을 두 번 세우지 않는다(PRD §3.2).
 * - `panel` — 넓은 화면의 좁은 판(채팅의 21rem 목록) 안에 설 때. 넓은 화면에서 그림을 걷고 왼쪽으로 붙는다 — 왼끝은 판 제목과
 *   같은 24px(`lg:px-6`, `app/me/chat/room-list.tsx` 의 제목)다.
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
      className={`flex flex-col items-center px-4 py-12 text-center ${
        panel ? 'lg:items-start lg:px-6 lg:pb-6 lg:pt-4 lg:text-left' : ''
      }`}
    >
      <span aria-hidden="true" className={`mb-4 ${panel ? 'lg:hidden' : ''}`}>
        {art ?? (
          <span className="grid size-16 place-items-center rounded-full bg-surface-sunken text-cream-ink">
            <Icon name={icon ?? 'spark'} className="size-7" />
          </span>
        )}
      </span>
      <h2 className={TYPE_SECTION}>{title}</h2>
      {children !== undefined && (
        <p className="mt-1.5 max-w-sm text-body leading-6 text-balance break-keep text-secondary">{children}</p>
      )}
      {action !== undefined && (
        <Link href={action.href} className={`${BUTTON_PRIMARY_SMALL} mt-6`}>
          {action.icon && <Icon name={action.icon} className="size-4" />}
          {action.label}
          {action.trailingIcon && <Icon name={action.trailingIcon} className="size-4" />}
        </Link>
      )}
    </section>
  );
}
