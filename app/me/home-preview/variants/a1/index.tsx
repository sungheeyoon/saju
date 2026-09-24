import Link from 'next/link';

import type { VariantProps } from '..';
import { previewHref } from '../../shared/preview-href';
import { UnreadStrip } from '../../shared/unread-strip';
import { WarningBanner } from '../../shared/warning-banner';
import { PeopleGrid } from './people-grid';
import { ProposedMenu } from './proposed-menu';
import { SelfSummary } from './self-summary';

/*
  **A1 · 통합 홈 요약형** — 나는 요약 한 장, 사람은 작은 카드 격자, 그 밖의 길은 한 줄.

  답하려는 질문: 「홈 한 화면에 나와 저장한 사람이 함께 서려면, 내 자리를 얼마나 줄여야 하는가」.
  명식 표 · 오행 막대 · 출생 정보는 기존 상세(`/me/people/<내 id>`)로, 관리(수정 · 빼기 · 메모)는 기존
  `/me/people` 로 남기고 홈은 목차가 된다.
*/

const SECONDARY = [
  { href: '/', label: '다른 사람 사주 보기' },
  { href: '/compat', label: '궁합 보러 가기' },
  { href: '/me/matching', label: '매칭에서 오늘의 인연 만나기' },
] as const;

export default function Variant({ state }: VariantProps) {
  const { self } = state;

  return (
    <div className="flex min-w-0 flex-col gap-6">
      <ProposedMenu unread={state.unread} unreadChat={state.unreadChat} />

      <WarningBanner notice={state.warning} />

      <header className="flex flex-col gap-1 border-b border-border pb-5">
        <h2 className="text-3xl font-bold tracking-[-0.04em]">나의 사주와 인연</h2>
        <p className="text-sm text-secondary">저장한 사주를 확인하고 오늘의 인연을 만나보세요.</p>
      </header>

      <UnreadStrip count={state.unread} />

      {self === null ? <RegisterSelf /> : <SelfSummary self={self} />}

      <PeopleGrid people={state.people} selfId={self?.personId ?? null} />

      <nav aria-label="더 해 보기" className="flex flex-col gap-2 border-t border-border pt-5 sm:flex-row sm:flex-wrap">
        {SECONDARY.map((link) => (
          <Link
            key={link.href}
            href={previewHref(link.href)}
            className="inline-flex min-h-10 items-center justify-between gap-2 rounded-full border border-border-strong bg-surface px-4 py-2 text-sm font-semibold hover:border-accent hover:text-accent sm:justify-start"
          >
            {link.label} <span aria-hidden="true">→</span>
          </Link>
        ))}
      </nav>
    </div>
  );
}

/** 내 사주 전 — 기존 온보딩(`app/me/onboarding.tsx`)의 머리만 흉내 내고 폼은 그 화면에 둔다 */
function RegisterSelf() {
  return (
    <section className="flex flex-col gap-4 rounded-[1.75rem] border border-border bg-surface p-5 shadow-[var(--shadow-card)] sm:p-6">
      <header className="flex flex-col gap-1">
        <p className="eyebrow">내 사주</p>
        <h2 className="text-base font-semibold">내 사주 등록</h2>
        <p className="text-sm text-secondary">
          출생 정보를 입력해 주세요. 나중에 언제든 고칠 수 있고, 고치면 그때부터 새 입력으로 계산합니다.
        </p>
      </header>
      <Link
        href={previewHref('/me')}
        className="inline-flex h-11 items-center self-start rounded-lg bg-accent px-4 text-sm font-medium text-on-accent hover:bg-accent-strong sm:h-10"
      >
        내 명식 등록
      </Link>
    </section>
  );
}
