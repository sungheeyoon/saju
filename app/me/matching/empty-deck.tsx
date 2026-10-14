import Link from 'next/link';
import type { ReactNode } from 'react';

import { SAJU_PATH } from '@/src/lib/consent';
import { DISCOVERY_EMPTY } from '@/src/lib/discovery/copy';
import type { Element } from '@/src/lib/saju';

import { elementScope } from '../../ui/element-tone';
import { Icon, type IconName } from '../../ui/icons';
import type { MeMark } from './me-mark';
import { QuietOrbit } from './orbit-map';

/**
 * 소개할 사람이 없다 — 아무도 다가오지 않는 작은 궤도.
 *
 * 덱은 떠난 만큼 채워지므로(ADR 0115) 비는 것은 **풀에 더 올 사람이 없을 때뿐**이다. 「다 만났다」와 새로고침 단추는
 * 걷었다 — 기다려서 받을 새 목록이 따로 없다.
 */
export function EmptyDeck({ me, feedback }: { me: MeMark; feedback: ReactNode }) {
  /*
    **넓은 화면에서는 카드 한 장 높이를 지킨다**(화면 점검 2026-10-09 C9) — 카드(4:5)와 단추 줄을 합친 약 37rem 이다. 뼈대
    (`loading.tsx`)는 카드 모양이라, 판이 300px 로 접히면 불러오는 순간 화면이 반으로 줄었다. 사람이 적은 베타에서는 빈 쪽이 흔하다.
    내용은 그 높이의 가운데 선다. 폰은 판의 내용이 이미 카드 자리를 거의 채운다.
  */
  return (
    <section className="grid items-center gap-6 rounded-paper bg-cream p-6 sm:grid-cols-[minmax(0,14rem)_minmax(0,1fr)] sm:gap-10 sm:p-10 lg:min-h-[37rem]">
      <QuietOrbit me={me} />
      <div className="flex min-w-0 flex-col items-start gap-5">
        <div className="flex flex-col gap-2">
          <h2 className="font-rounded text-[1.625rem] leading-[1.35] text-foreground sm:text-headline">
            {DISCOVERY_EMPTY.title}
          </h2>
          <p className="max-w-prose text-body leading-6 text-secondary">{DISCOVERY_EMPTY.line}</p>
        </div>
        <nav aria-label="바로가기" className="grid w-full gap-2 sm:grid-cols-2">
          {MEANWHILE.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className={`${elementScope(link.element)} group flex min-h-14 items-center gap-3 rounded-row border border-border bg-surface px-4 py-3 text-body font-semibold text-foreground hover:border-border-strong active:scale-[0.98]`}
            >
              <span className="grid size-10 shrink-0 place-items-center rounded-full bg-[var(--tile)] text-[var(--ink)]">
                <Icon name={link.icon} />
              </span>
              <span className="min-w-0 flex-1">{link.label}</span>
              <Icon name="arrow" className="size-4 text-secondary group-hover:translate-x-0.5" />
            </Link>
          ))}
        </nav>
        <div className="flex w-full flex-col gap-2">{feedback}</div>
      </div>
    </section>
  );
}

const MEANWHILE: readonly { href: string; label: string; icon: IconName; element: Element }[] = [
  { href: SAJU_PATH, label: '다른 사람 사주 보기', icon: 'search', element: '水' },
  { href: '/compat', label: '궁합 보러 가기', icon: 'taiji', element: '火' },
];
