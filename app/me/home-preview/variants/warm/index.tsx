import Link from 'next/link';

import { WARNING_ACKNOWLEDGE_LABEL, WARNING_NOTICE_TITLE, warningNoticeLines, type WarningNotice } from '@/src/lib/account';
import { CHAT_TAB_LABEL } from '@/src/lib/chat';
import { ELEMENTS, type Element } from '@/src/lib/saju';

import type { VariantProps } from '..';
import type { ReadingEntry } from '../../../reading/current';
import { readingDate, readingHref, readingTitle } from '../../../reading/line';
import { PERSON_LIMIT, type FixturePerson } from '../../fixtures';
import { previewHref } from '../../shared/preview-href';
import { PRIMARY, ROUND_ICON, SECONDARY, TERTIARY } from './buttons';
import { rounded } from './fonts';
import { PersonTile } from './person-tile';
import { SelfCard } from './self-card';
import { ELEMENT_CLASS, ElementSymbol, Icon, ROOT_CLASS, type IconName } from './symbols';

/*
  **2차 · 라이프스타일 — 부드러움.** 「오늘」 아침에 여는 앱처럼 인사 한 줄 → 최근 풀이의 비유 한 문장 → 나 →
  사람들 차례로 내려온다. 오행은 파스텔 면과 다섯 상징(나무 · 불꽃 · 흙 · 쇠 · 물)으로, 사람마다 제 일간의 색을
  입은 2열 타일로 선다. 단추는 먹색 채움 · 흰 알약 · 밑줄 글자 세 층뿐이다(`buttons.ts`).
  메뉴는 폰에서 화면 맨 아래의 둥근 독(dock) 모형으로, 넓은 화면에서는 맨 위의 알약 탭으로 선다 — 둘 다 `fixed` 가 아니다.
*/
export default function Variant({ state }: VariantProps) {
  const { self, people } = state;
  const selfId = self?.personId ?? null;
  const quote = state.readings.find((entry) => entry.metaphor !== null) ?? null;
  const full = people.length >= PERSON_LIMIT;

  return (
    <div className={`${ROOT_CLASS} flex min-w-0 flex-col gap-8 break-keep sm:gap-12`}>
      <TopBar unread={state.unread} unreadChat={state.unreadChat} />

      <Greeting name={self?.label ?? null} />

      {(state.warning !== null || state.unread > 0) && (
        <div className="-mt-4 flex flex-col gap-3 sm:-mt-6">
          <Warning notice={state.warning} />
          <Unread count={state.unread} />
        </div>
      )}

      {self === null ? (
        <RegisterSelf />
      ) : (
        <div className="grid gap-4 lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)] lg:items-stretch lg:gap-6">
          {quote !== null && <Quote entry={quote} />}
          <div className={quote === null ? 'lg:col-span-2' : ''}>
            <SelfCard self={self} showMetaphor={quote?.kind !== 'self'} />
          </div>
        </div>
      )}

      <section aria-labelledby="warm-people" className="flex flex-col gap-4">
        <div className="flex flex-wrap items-end justify-between gap-x-4 gap-y-1">
          <h2 id="warm-people" className={`${rounded.className} flex items-baseline gap-2 text-[1.5rem] leading-8 text-foreground`}>
            저장한 사람
            <span className="font-sans text-[13px] font-semibold tabular-nums text-secondary">
              {people.length}/{PERSON_LIMIT}명
            </span>
          </h2>
          {people.length > 0 && (
            <Link href={previewHref('/me/people')} className={TERTIARY}>
              전체 관리
              <Icon name="arrow" className="size-4" />
            </Link>
          )}
        </div>

        {people.length === 0 ? (
          <AddFirst primary={self !== null} />
        ) : (
          <ul className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-4">
            {people.map((person) => (
              <PersonTile key={person.personId} person={person} selfPersonId={selfId} pair={pairOf(state.readings, selfId, person)} />
            ))}
            {!full && <AddTile count={people.length} />}
          </ul>
        )}
        {full && <p className="text-[13px] text-secondary">등록할 수 있는 10명을 다 채웠습니다.</p>}
      </section>

      <nav aria-label="더 해 보기" className="grid gap-2 sm:grid-cols-3 sm:gap-3">
        {MORE_LINKS.filter((link) => self !== null || link.href !== '/me/matching').map((link) => (
          <Link
            key={link.href}
            href={previewHref(link.href)}
            className={`${ELEMENT_CLASS[link.element]} group flex min-h-14 items-center gap-3 rounded-[1.25rem] border border-[var(--line)] bg-[var(--card)] px-4 py-3 text-[15px] font-semibold text-foreground hover:border-[color-mix(in_srgb,var(--ink)_40%,transparent)] active:scale-[0.98]`}
          >
            <span className="grid size-10 shrink-0 place-items-center rounded-full bg-[var(--tile)] text-[var(--ink)]">
              <Icon name={link.icon} />
            </span>
            <span className="min-w-0 flex-1">{link.label}</span>
            <Icon name="arrow" className="size-4 text-secondary group-hover:translate-x-0.5" />
          </Link>
        ))}
      </nav>

      <Dock unreadChat={state.unreadChat} />
    </div>
  );
}

/** 나 × 그 사람의 궁합풀이 — 최근 것이 앞이라 처음 만난 것이 가장 최근이다 */
function pairOf(readings: readonly ReadingEntry[], selfId: string | null, person: FixturePerson): ReadingEntry | null {
  if (selfId === null) return null;
  return (
    readings.find(
      (entry) =>
        entry.kind === 'private' &&
        ((entry.personA === selfId && entry.personB === person.personId) ||
          (entry.personB === selfId && entry.personA === person.personId)),
    ) ?? null
  );
}

const MORE_LINKS: readonly { href: string; label: string; icon: IconName; element: Element }[] = [
  { href: '/', label: '다른 사람 사주 보기', icon: 'search', element: '水' },
  { href: '/compat', label: '궁합 보러 가기', icon: 'heart', element: '火' },
  { href: '/me/matching', label: '매칭에서 오늘의 인연 만나기', icon: 'people', element: '木' },
];

const TABS = [
  { href: '/me', label: '홈', icon: 'home' },
  { href: '/me/matching', label: '매칭', icon: 'people' },
  { href: '/me/readings', label: '풀이', icon: 'reading' },
  { href: '/me/chat', label: CHAT_TAB_LABEL, icon: 'chat' },
] as const satisfies readonly { href: string; label: string; icon: IconName }[];

const GEAR_LINKS = [
  { href: '/me/profile', label: '프로필' },
  { href: '/me/settings', label: '계정 관리' },
  { href: '/me/survey', label: '서비스 설문' },
] as const;

/** 맨 위 — 넓은 화면은 탭 알약 + 종 · 톱니, 폰은 종 · 톱니만(탭은 맨 아래 독이 든다) */
function TopBar({ unread, unreadChat }: { unread: number; unreadChat: number }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <nav aria-label="제안 메뉴" className="hidden sm:block">
        <ul className="flex items-center gap-1 rounded-full bg-[var(--card)] p-1 ring-1 ring-[var(--line)]">
          {TABS.map((tab) => {
            const active = tab.href === '/me';
            return (
              <li key={tab.href}>
                <Link
                  href={previewHref(tab.href)}
                  aria-current={active ? 'page' : undefined}
                  className={`inline-flex min-h-11 items-center gap-2 rounded-full px-4 text-[15px] font-semibold active:scale-[0.97] ${
                    active ? 'bg-[var(--btn)] text-[var(--on-btn)]' : 'text-secondary hover:bg-surface-soft hover:text-foreground'
                  }`}
                >
                  <Icon name={tab.icon} className="size-[18px]" />
                  {tab.label}
                  {tab.href === '/me/chat' && <Badge count={unreadChat} />}
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>
      <p className="text-[13px] font-semibold text-secondary sm:hidden">제안 메뉴</p>

      <div className="flex items-center gap-2">
        <Link href={previewHref('/me/requests')} aria-label="소식" className={ROUND_ICON}>
          <Icon name="bell" />
          {unread > 0 && (
            <span className="absolute -right-0.5 -top-0.5">
              <Badge count={unread} />
            </span>
          )}
        </Link>
        <details className="relative">
          <summary aria-label="설정 메뉴" className={`${ROUND_ICON} list-none [&::-webkit-details-marker]:hidden`}>
            <Icon name="gear" />
          </summary>
          <div className="absolute right-0 top-13 z-20 w-52 rounded-[1.25rem] bg-[var(--card)] p-2 shadow-[var(--shadow-float)] ring-1 ring-[var(--line)]">
            {GEAR_LINKS.map((link) => (
              <Link
                key={link.href}
                href={previewHref(link.href)}
                className="flex min-h-11 items-center rounded-xl px-3 text-[15px] font-semibold hover:bg-surface-soft active:bg-surface-sunken"
              >
                {link.label}
              </Link>
            ))}
          </div>
        </details>
      </div>
    </div>
  );
}

/** 폰의 하단 메뉴 모형 — 제자리에 선다. 켜진 탭은 아이콘 뒤에 알약이 깔린다 */
function Dock({ unreadChat }: { unreadChat: number }) {
  return (
    <nav aria-label="제안 메뉴 · 하단" className="sm:hidden">
      <ul className="grid grid-cols-4 rounded-[1.75rem] bg-[var(--card)] p-1.5 shadow-[0_10px_30px_-12px_rgba(60,48,30,0.35)] ring-1 ring-[var(--line)]">
        {TABS.map((tab) => {
          const active = tab.href === '/me';
          return (
            <li key={tab.href}>
              <Link
                href={previewHref(tab.href)}
                aria-current={active ? 'page' : undefined}
                className={`relative flex min-h-14 flex-col items-center justify-center gap-1 rounded-[1.25rem] text-[12px] font-semibold active:scale-95 ${
                  active ? 'text-foreground' : 'text-secondary'
                }`}
              >
                <span className={`grid h-8 w-14 place-items-center rounded-full ${active ? 'bg-[var(--wood-bg)] text-[var(--wood-ink)]' : ''}`}>
                  <Icon name={tab.icon} />
                </span>
                {tab.label}
                {tab.href === '/me/chat' && unreadChat > 0 && (
                  <span className="absolute right-[calc(50%-1.5rem)] top-0.5">
                    <Badge count={unreadChat} />
                  </span>
                )}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}

function Badge({ count }: { count: number }) {
  if (count === 0) return null;
  return (
    <span className="grid h-5 min-w-5 place-items-center rounded-full bg-fire px-1 text-[11px] font-bold leading-none text-white tabular-nums">
      {count}
      <span className="sr-only">건 안 읽음</span>
    </span>
  );
}

/** 인사 한 줄 — 이 화면에서 가장 먼저 읽히는 글자 */
function Greeting({ name }: { name: string | null }) {
  const today = new Date().toLocaleDateString('ko-KR', { month: 'long', day: 'numeric', weekday: 'long' });
  return (
    <header className="flex flex-col gap-1">
      <p className="text-[13px] font-semibold text-secondary">{today}</p>
      <h2 className={`${rounded.className} text-[1.75rem] leading-[1.3] tracking-[-0.02em] text-foreground sm:text-[2.25rem]`}>
        {name === null ? '반가워요' : `${name}님, 오늘도 반가워요`}
      </h2>
    </header>
  );
}

/** 최근 풀이의 비유 — 인용구처럼 크게. 누르면 그 글로 간다 */
function Quote({ entry }: { entry: ReadingEntry }) {
  return (
    <figure className="relative flex flex-col justify-between gap-6 overflow-hidden rounded-[2rem] bg-[var(--cream)] p-6 sm:p-8">
      <div className="relative flex flex-col gap-3">
        <div className="flex items-center justify-between gap-3">
          <p className="flex items-center gap-1.5 text-[13px] font-semibold text-[var(--cream-ink)]">
            <Icon name="quote" className="size-4" />
            최근 풀이
          </p>
          <span aria-hidden="true" className="flex -space-x-1.5">
            {ELEMENTS.map((element) => (
              <span key={element} className={`${ELEMENT_CLASS[element]} grid size-7 place-items-center rounded-full bg-[var(--tile)] ring-2 ring-[var(--cream)]`}>
                <ElementSymbol element={element} className="size-4" />
              </span>
            ))}
          </span>
        </div>
        <blockquote className={`${rounded.className} text-[1.625rem] leading-[1.45] tracking-[-0.02em] text-foreground sm:text-[2rem] lg:text-[2.375rem]`}>
          {entry.metaphor}
        </blockquote>
      </div>
      <figcaption className="relative flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
        <span className="flex flex-col">
          <span className="text-[15px] font-semibold text-foreground">
            {readingTitle(entry)}
            {entry.score !== null && <span className="ml-1.5 tabular-nums text-[var(--cream-ink)]">{entry.score}점</span>}
          </span>
          <span className="text-[13px] text-secondary">{readingDate(entry.createdAt)}</span>
        </span>
        <Link href={previewHref(readingHref(entry))} className={TERTIARY}>
          이어서 읽기
          <Icon name="arrow" className="size-4" />
        </Link>
      </figcaption>
    </figure>
  );
}

/** 경고 — 승인된 문구 그대로. 「확인했습니다」는 원본에서 서버 액션이라 여기서는 모양만 선다 */
function Warning({ notice }: { notice: WarningNotice | null }) {
  if (notice === null) return null;
  return (
    <section aria-label={WARNING_NOTICE_TITLE} className="flex gap-3 rounded-[1.5rem] bg-danger-wash p-5 ring-1 ring-danger/40 sm:gap-4 sm:p-6">
      <span className="grid size-10 shrink-0 place-items-center rounded-full bg-[var(--card)] text-danger">
        <Icon name="alert" />
      </span>
      <div className="flex min-w-0 flex-col gap-3">
        <h2 className="text-[17px] font-bold text-danger">{WARNING_NOTICE_TITLE}</h2>
        <div className="flex flex-col gap-1 text-[15px] leading-6 text-foreground">
          {warningNoticeLines(notice).map((line) => (
            <p key={line}>{line}</p>
          ))}
        </div>
        <span className={`${PRIMARY} self-start`}>{WARNING_ACKNOWLEDGE_LABEL}</span>
      </div>
    </section>
  );
}

function Unread({ count }: { count: number }) {
  if (count === 0) return null;
  return (
    <Link
      href={previewHref('/me/requests')}
      className="flex min-h-14 items-center gap-3 rounded-[1.25rem] bg-[var(--card)] px-4 py-3 text-[14px] font-semibold sm:text-[15px] text-foreground ring-1 ring-[var(--line)] hover:ring-[color-mix(in_srgb,var(--foreground)_30%,transparent)] active:scale-[0.99]"
    >
      <span className="relative grid size-9 shrink-0 place-items-center rounded-full bg-fire-soft text-fire">
        <Icon name="bell" className="size-[18px]" />
      </span>
      <span className="min-w-0 flex-1">아직 확인하지 않은 새 소식이 있습니다.</span>
      <Badge count={count} />
      <Icon name="arrow" className="size-4 text-secondary" />
    </Link>
  );
}

/** 내 사주 전 — 할 일이 이것 하나라 주 단추 하나만 선다 */
function RegisterSelf() {
  return (
    <section className="relative flex flex-col gap-5 overflow-hidden rounded-[2rem] bg-[var(--cream)] p-6 sm:p-8">
      <span aria-hidden="true" className="flex gap-2">
        {ELEMENTS.map((element) => (
          <span key={element} className={`${ELEMENT_CLASS[element]} grid size-12 place-items-center rounded-full bg-[var(--tile)]`}>
            <ElementSymbol element={element} className="size-7" />
          </span>
        ))}
      </span>
      <div className="flex flex-col gap-2">
        <h2 className={`${rounded.className} text-[1.75rem] leading-[1.3] text-foreground`}>내 사주 등록</h2>
        <p className="max-w-prose text-[15px] leading-6 text-secondary">
          출생 정보를 입력해 주세요. 나중에 언제든 고칠 수 있고, 고치면 그때부터 새 입력으로 계산합니다.
        </p>
      </div>
      <Link href={previewHref('/me')} className={`${PRIMARY} self-start`}>
        내 명식 등록
        <Icon name="arrow" className="size-4" />
      </Link>
    </section>
  );
}

/** 사람 0명 — 내 사주가 있으면 이것이 주 행동, 없으면 등록 다음이라 보조로 선다 */
function AddFirst({ primary }: { primary: boolean }) {
  return (
    <div className="flex flex-col items-start gap-4 rounded-[1.75rem] border-2 border-dashed border-[var(--line)] p-6">
      <p className="text-[15px] leading-6 text-secondary">가족이나 친구의 출생 정보를 저장하고 관리하세요.</p>
      <Link href={previewHref('/me/people')} className={primary ? PRIMARY : SECONDARY}>
        <Icon name="plus" className="size-[18px]" />
        사람 추가
      </Link>
    </div>
  );
}

/** 목록 끝의 빈 타일 — 다른 타일과 같은 크기라 「한 자리 더」로 읽힌다 */
function AddTile({ count }: { count: number }) {
  return (
    <li>
      <Link
        href={previewHref('/me/people')}
        className="flex h-full min-h-44 flex-col items-center justify-center gap-2 rounded-[1.5rem] border-2 border-dashed border-[var(--line)] p-4 text-center text-foreground hover:border-[color-mix(in_srgb,var(--foreground)_30%,transparent)] hover:bg-[var(--card)] active:scale-[0.98]"
      >
        <span className="grid size-12 place-items-center rounded-full bg-[var(--btn)] text-[var(--on-btn)]">
          <Icon name="plus" />
        </span>
        <span className="text-[15px] font-semibold">사람 추가</span>
        <span className="text-[12px] tabular-nums text-secondary">
          {count}/{PERSON_LIMIT}명
        </span>
      </Link>
    </li>
  );
}
