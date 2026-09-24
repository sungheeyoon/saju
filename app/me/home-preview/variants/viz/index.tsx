import Link from 'next/link';

import { WARNING_ACKNOWLEDGE_LABEL, WARNING_NOTICE_TITLE, warningNoticeLines, type WarningNotice } from '@/src/lib/account';

import type { VariantProps } from '..';
import { previewHref } from '../../shared/preview-href';
import { scaleOf } from './element-chart';
import { serif } from './fonts';
import { Menu } from './menu';
import { PeopleTable } from './people-table';
import { RegisterSelf, SelfPanel } from './self-panel';
import { CountBadge, Icon, SECONDARY, type IconName } from './ui';
import styles from './viz.module.css';

/*
  **2차 · 정보 디자인 — 한눈 비교.** 뉴욕타임스 그래픽 · 애플 건강의 데이터 화면을 기준으로 삼았다.

  이 홈의 가치를 「나와 사람들을 같은 눈금으로 견준다」 하나로 좁혔다. 그래서 화면은 두 덩어리다:
  1. **나** — 여덟 글자(명조 44px)가 주인공이고 오행 개수가 가로 칸 막대로 선다.
  2. **비교 표** — 사람마다 한 줄, 오행 다섯 칸이 세로로 정렬되고 내 개수가 선으로 겹친다.
  두 차트는 **같은 눈금**(`scaleOf` — 화면에 선 모두의 최댓값)을 쓴다. 값은 `counts` 뿐이다 — 새 판정은 없다.
*/
export default function Variant({ state }: VariantProps) {
  const { self, people } = state;
  const max = scaleOf([
    ...(self === null ? [] : [self.saju.analysis.elements.counts]),
    ...people.flatMap((person) => (person.chart.ok ? [person.chart.saju.analysis.elements.counts] : [])),
  ]);

  return (
    <div className={`${serif.variable} ${styles.root} flex min-w-0 flex-col gap-8 sm:gap-12`}>
      <Menu unread={state.unread} unreadChat={state.unreadChat} />

      <div className="flex flex-col gap-4">
        <Warning notice={state.warning} />
        <Unread count={state.unread} />
        <header className="flex flex-col gap-1">
          <h2 className="text-[28px] font-bold leading-tight tracking-[-0.04em] sm:text-[32px]">나의 사주와 인연</h2>
          <p className="text-sm text-secondary">저장한 사주를 확인하고 오늘의 인연을 만나보세요.</p>
        </header>
      </div>

      {self === null ? <RegisterSelf /> : <SelfPanel self={self} max={max} />}

      <PeopleTable self={self} people={people} readings={state.readings} max={max} />

      <More hasSelf={self !== null} />
    </div>
  );
}

/** 경고 안내 — 승인된 문구 그대로(ADR 0108). 단추는 모양만 선다(여기 것은 가짜 경고다) */
function Warning({ notice }: { notice: WarningNotice | null }) {
  if (notice === null) return null;
  return (
    <section
      aria-label={WARNING_NOTICE_TITLE}
      className="flex flex-col gap-4 rounded-2xl border border-danger/40 border-l-4 border-l-danger bg-danger-wash p-5 sm:flex-row sm:items-end sm:justify-between sm:p-6"
    >
      <div className="flex flex-col gap-2">
        <h2 className="text-base font-bold text-danger">{WARNING_NOTICE_TITLE}</h2>
        <div className="flex flex-col gap-1 text-sm leading-6 text-foreground">
          {warningNoticeLines(notice).map((line) => (
            <p key={line}>{line}</p>
          ))}
        </div>
      </div>
      <span className="inline-flex min-h-11 shrink-0 items-center self-start rounded-xl bg-danger px-4 text-sm font-semibold text-danger-wash sm:self-auto">
        {WARNING_ACKNOWLEDGE_LABEL}
      </span>
    </section>
  );
}

/** 새 소식 — 종 아이콘 · 문장 · 수 · 화살표. 한 줄 전체가 단추다(테두리와 화살표가 그것을 말한다) */
function Unread({ count }: { count: number }) {
  if (count === 0) return null;
  return (
    <Link
      href={previewHref('/me/requests')}
      className="flex min-h-12 items-center gap-3 rounded-xl border border-accent/40 bg-accent-wash px-4 text-sm font-semibold text-foreground shadow-[0_1px_0_var(--border-strong)] hover:border-accent active:translate-y-px focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
    >
      <Icon name="news" className="size-5 text-accent" />
      <span className="min-w-0 flex-1">아직 확인하지 않은 새 소식이 있습니다.</span>
      <CountBadge count={count} />
      <Icon name="arrow" className="size-4 text-accent" />
    </Link>
  );
}

/** 더 해 보기 — 보조 단추 셋, 아이콘이 무엇을 여는지 먼저 말한다 */
function More({ hasSelf }: { hasSelf: boolean }) {
  const links: { href: string; label: string; icon: IconName }[] = [
    { href: '/', label: '다른 사람 사주 보기', icon: 'search' },
    { href: '/compat', label: '궁합 보러 가기', icon: 'compat' },
    ...(hasSelf ? [{ href: '/me/matching', label: '매칭에서 오늘의 인연 만나기', icon: 'people' as const }] : []),
  ];
  return (
    <nav aria-label="더 해 보기" className="flex flex-col gap-3 border-t border-border pt-6">
      <h2 className="text-[13px] font-semibold text-secondary">더 해 보기</h2>
      <ul className="grid gap-2 sm:grid-cols-3">
        {links.map((link) => (
          <li key={link.href}>
            <Link href={previewHref(link.href)} className={`${SECONDARY} w-full justify-start`}>
              <Icon name={link.icon} className="size-5 text-muted" />
              <span className="min-w-0 flex-1 truncate text-left">{link.label}</span>
              <Icon name="arrow" className="size-4 text-muted" />
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  );
}
