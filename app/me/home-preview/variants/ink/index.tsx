import Link from 'next/link';

import { WARNING_ACKNOWLEDGE_LABEL, WARNING_NOTICE_TITLE, warningNoticeLines, type WarningNotice } from '@/src/lib/account';

import type { VariantProps } from '..';
import { previewHref } from '../../shared/preview-href';
import { hanjaFont, titleFont } from './fonts';
import { InkIcon } from './icons';
import { Count, InkMenu } from './ink-menu';
import s from './ink.module.css';
import { PeopleLedger } from './people-ledger';
import { EmptyPlate, SelfPlate } from './self-plate';

/*
  **2 · 동양 현대 — 먹과 인장.**

  한지 바탕에 먹의 농담 셋(짙은 · 중간 · 옅은)과 주칠 하나. 카드 · 둥근 모서리 · 그림자를 버리고
  괘선(먹 1.5px · 옅은 먹 1px)으로 영역을 가른다. 가장 먼저 읽히는 것은 세로로 선 네 기둥의 한자(44~60px),
  두 번째가 이름(36px 고운바탕), 그 다음이 섹션 제목(24px). 주칠은 「나」 인장 · 주 단추 · 일주 테 · 안 읽은
  수에만 든다 — 화면 한 영역에 주칠 단추는 하나.
*/
export default function Variant({ state }: VariantProps) {
  const { self, people } = state;

  return (
    <div
      className={`${s.root} ${titleFont.variable} ${hanjaFont.variable} -mx-4 flex min-w-0 flex-col gap-10 px-4 pb-10 pt-5 sm:mx-0 sm:gap-12 sm:px-8 sm:pb-14 sm:pt-6 lg:px-12`}
    >
      <InkMenu unread={state.unread} unreadChat={state.unreadChat} />

      {(state.warning !== null || state.unread > 0) && (
        <div className="-mt-4 flex flex-col gap-3 sm:-mt-6">
          <Warning notice={state.warning} />
          <Unread count={state.unread} />
        </div>
      )}

      <div className="flex flex-col gap-6">
        <h2 className={`${s.title} text-[1.5rem] font-bold leading-tight`}>나의 사주와 인연</h2>
        {self === null ? <EmptyPlate /> : <SelfPlate self={self} />}
      </div>

      <PeopleLedger people={people} readings={state.readings} selfId={self?.personId ?? null} />

      <More registered={self !== null} />
    </div>
  );
}

/** 경고 안내 — 승인된 문구 그대로(ADR 0108). 확인 단추는 모양만 선다 */
function Warning({ notice }: { notice: WarningNotice | null }) {
  if (notice === null) return null;
  return (
    <section
      aria-label={WARNING_NOTICE_TITLE}
      className="flex flex-col gap-4 border-l-4 border-(--shu) bg-(--shu-wash) py-5 pl-5 pr-4 sm:flex-row sm:items-end sm:justify-between sm:pr-5"
    >
      <div className="flex min-w-0 flex-col gap-2">
        <h2 className={`${s.title} text-[1.25rem] font-bold text-(--shu)`}>{WARNING_NOTICE_TITLE}</h2>
        <div className="flex flex-col gap-1 text-[15px] leading-6 text-(--ink)">
          {warningNoticeLines(notice).map((line) => (
            <p key={line}>{line}</p>
          ))}
        </div>
      </div>
      <span className={`${s.btn} ${s.primary} shrink-0 self-stretch sm:self-auto`}>{WARNING_ACKNOWLEDGE_LABEL}</span>
    </section>
  );
}

/** 새 소식 — 먹 테 한 줄. 수는 주칠 인장 */
function Unread({ count }: { count: number }) {
  if (count === 0) return null;
  return (
    <Link
      href={previewHref('/me/requests')}
      className={`${s.rowLink} flex min-h-13 items-center gap-3 border border-(--ink) px-4 text-[15px] font-semibold`}
    >
      <Count count={count} />
      <span className="min-w-0 flex-1">아직 확인하지 않은 새 소식이 있습니다.</span>
      <InkIcon name="arrow" className="size-4" />
    </Link>
  );
}

/** 더 해 보기 — 셋째 위계. 괘선 사이의 글자 줄 */
function More({ registered }: { registered: boolean }) {
  const links = [
    { href: '/', label: '다른 사람 사주 보기' },
    { href: '/compat', label: '궁합 보러 가기' },
    ...(registered ? [{ href: '/me/matching', label: '매칭에서 오늘의 인연 만나기' }] : []),
  ];
  return (
    <nav aria-label="더 해 보기" className="grid border-t border-(--rule-strong) sm:grid-cols-3">
      {links.map((link, index) => (
        <Link
          key={link.href}
          href={previewHref(link.href)}
          className={`${s.rowLink} group flex min-h-14 items-center justify-between gap-3 border-b border-(--rule) px-1 text-[15px] font-semibold sm:border-b-0 sm:px-4 ${
            index > 0 ? 'sm:border-l' : ''
          }`}
        >
          <span className={`${s.rowName} min-w-0`}>{link.label}</span>
          <InkIcon name="arrow" className="size-4 text-(--ink-3) group-hover:text-(--shu)" />
        </Link>
      ))}
    </nav>
  );
}
