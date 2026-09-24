import Link from 'next/link';
import type { ReactNode } from 'react';

import { ELEMENTS, ELEMENT_PICTURE_KO, type Element } from '@/src/lib/saju';

import { elementScope } from '../../element-tone';
import { BUTTON_SECONDARY_SMALL } from '../../ui/buttons';
import { ElementSymbol } from '../../ui/element-symbol';
import { Icon } from '../../ui/icon';
import { EMPTY_SLOT, PAPER, TYPE_SECTION } from '../../ui/surfaces';
import { Avatar } from '../avatar';
import { coverFace } from '../reading/essay';
import flow from '../reading/flow.module.css';
import type { InboxMatch } from '../requests/inbox';
import type { Book } from './book';
import { CoverLink } from './frame';
import type { DayMaster } from './subject';

/**
 * **책장** — 만든 글이 한 권씩 꽂힌다(시안 3차 warm).
 *
 * 한 편이 한 권이고, 표지는 그 글의 비유 한 줄, 색은 대상의 일간 오행이다. 표지는 **제 주소로 가는
 * 링크**다 — 한 사람 풀이는 `/me/readings/[subject]` 라 넓은 화면에서는 책장 옆 칸에 펼쳐지고(`frame.tsx`),
 * 궁합은 제 결과 화면으로 간다. 그 화면에는 두 사람의 명식 · 동의 · 차단처럼 글 밖의 것이 함께 서서
 * 책장 옆 칸에 담기지 않는다 — 표지 오른쪽 아래의 동그란 화살표가 「여기서 떠난다」는 차이를 말한다.
 *
 * 누를 자리는 표지 전체다. 표지 안에 단추를 따로 두면 한 권에 손잡이가 둘이 된다.
 */

const COVER =
  'group relative flex h-full min-h-[14rem] flex-col gap-3 overflow-hidden rounded-[0.5rem_1.5rem_1.5rem_0.5rem] py-4 pl-6 pr-4 text-left shadow-[0_10px_22px_-16px_rgba(60,48,30,0.55)] transition-transform hover:-translate-y-0.5 active:scale-[0.97]';

export function Shelf({ title, description, children }: { title: string; description: string; children: ReactNode }) {
  return (
    <section className="flex flex-col gap-4">
      <div>
        <h2 className={TYPE_SECTION}>{title}</h2>
        <p className="mt-0.5 text-[13px] leading-5 text-secondary">{description}</p>
      </div>
      <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-2">{children}</ul>
    </section>
  );
}

/** 한 사람 풀이 = 제 일간 색의 표지 한 권. 왼쪽 등(spine)이 상징색, 가운데가 비유 한 줄 */
export function SingleCover({ book }: { book: Book }) {
  const subject = book.subjects[0] ?? null;
  const face = coverFace([subject?.element ?? null]);
  return (
    <CoverLink href={book.href} className={`${elementScope(subject?.element ?? null)} ${COVER}`} style={{ background: face.background }}>
      <Spine background={face.spine} />
      <ElementSymbol
        element={subject?.element ?? null}
        className="pointer-events-none absolute -bottom-5 -right-5 size-24 opacity-15"
      />

      <span className="relative flex min-w-0 flex-col gap-1">
        <SubjectTag subject={subject} />
        <span className="truncate text-[15px] font-semibold text-foreground">{book.title}</span>
      </span>

      <Metaphor text={book.metaphor} lines="line-clamp-4" />

      <span className="relative flex flex-wrap items-center gap-1.5">
        {book.stale && <StaleChip />}
        <time dateTime={book.dateTime} className="text-[12px] tabular-nums text-secondary">
          {book.date}
        </time>
      </span>
    </CoverLink>
  );
}

/** 궁합 = 두 사람의 색이 비스듬히 만나는 표지. 점수가 크게 선다 */
export function PairCover({ book }: { book: Book }) {
  const [a = null, b = null] = book.subjects;
  const face = coverFace([a?.element ?? null, b?.element ?? null]);
  return (
    <Link href={book.href} className={COVER} style={{ background: face.background }}>
      <Spine background={face.spine} />

      <span className="relative flex items-center justify-between gap-2">
        <span className="flex -space-x-2">
          {[a, b].map((one, index) => (
            <span
              key={index}
              className={`${elementScope(one?.element ?? null)} grid size-8 place-items-center rounded-full bg-surface ring-2 ring-[var(--tile)]`}
            >
              <ElementSymbol element={one?.element ?? null} className="size-5" />
            </span>
          ))}
        </span>
        {book.score !== null && (
          <span className="flex items-baseline gap-0.5 text-foreground">
            <span className="text-[1.75rem] font-bold leading-none tabular-nums">{book.score}</span>
            <span className="text-[12px] font-semibold text-secondary">점</span>
          </span>
        )}
      </span>

      <span className="relative truncate text-[15px] font-semibold text-foreground">{book.title}</span>

      <Metaphor text={book.metaphor} lines="line-clamp-3" />

      <span className="relative flex items-center justify-between gap-2">
        <span className="flex flex-wrap items-center gap-1.5">
          {book.stale && <StaleChip />}
          <time dateTime={book.dateTime} className="text-[12px] tabular-nums text-secondary">
            {book.date}
          </time>
        </span>
        <span
          aria-hidden="true"
          className="grid size-8 shrink-0 place-items-center rounded-full bg-[color-mix(in_srgb,var(--surface)_80%,transparent)] text-foreground transition-transform group-hover:translate-x-0.5"
        >
          <Icon name="arrow" className="size-4" />
        </span>
      </span>
    </Link>
  );
}

/** 빈 자리 한 권 — 같은 크기의 점선 표지라 「한 권 더」로 읽힌다 */
export function BlankBook({ href, element, label }: { href: string; element: Element; label: string }) {
  return (
    <li>
      <CoverLink
        href={href}
        className={`${elementScope(element)} flex h-full min-h-[14rem] flex-col items-center justify-center gap-3 rounded-[0.5rem_1.5rem_1.5rem_0.5rem] border-2 border-dashed border-[color-mix(in_srgb,var(--ink)_28%,transparent)] p-4 text-center hover:bg-surface active:scale-[0.98]`}
      >
        <span className="grid size-12 place-items-center rounded-full bg-[var(--tile)]">
          <ElementSymbol element={element} className="size-7" />
        </span>
        <span className="text-[15px] font-semibold text-foreground">{label}</span>
      </CoverLink>
    </li>
  );
}

/**
 * 「함께 보는 궁합」 — 동의가 만들고 있는 글 한 장.
 *
 * 크림 편지 한 장이 통째로 결과 화면으로 가는 링크다. 「함께 보기」는 그 링크의 모양일 뿐 따로 눌리는
 * 단추가 아니다(한 장에 손잡이 하나).
 */
export function MakingShelf({ matches }: { matches: readonly InboxMatch[] }) {
  return (
    <section className="flex flex-col gap-4">
      <div>
        <h2 className={TYPE_SECTION}>함께 보는 궁합</h2>
        <p className="mt-0.5 text-[13px] leading-5 text-secondary">서로 동의한 궁합풀이를 만들고 있습니다.</p>
      </div>
      <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-1">
        {matches.map((match) => {
          const supplied = ELEMENTS.find((one) => one === match.suppliedToMe) ?? null;
          return (
            <li key={match.matchId}>
              <Link
                href={`/me/match/${match.matchId}`}
                className="group flex h-full flex-col gap-4 rounded-[1.75rem] bg-cream p-5 transition-transform hover:-translate-y-0.5 active:scale-[0.99]"
              >
                <span className="flex items-center gap-3.5">
                  <Avatar userId={match.partnerUserId} nickname={match.nickname} hasPhoto={match.hasPhoto} size={56} />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[17px] font-semibold text-foreground">
                      {match.nickname} 님과의 궁합풀이
                    </span>
                    {supplied !== null && (
                      <span className="mt-0.5 flex items-center gap-1 text-[13px] text-cream-ink">
                        <ElementSymbol element={supplied} className="size-4" />
                        <span className="truncate">{match.balanceLabel}</span>
                      </span>
                    )}
                  </span>
                </span>

                <span className="flex flex-col gap-2">
                  <span
                    aria-hidden="true"
                    className="block h-2 overflow-hidden rounded-full bg-[color-mix(in_srgb,var(--cream-ink)_14%,transparent)]"
                  >
                    <span className={`${flow.flow} block h-full w-full rounded-full`} />
                  </span>
                  <span className="text-[13px] font-semibold text-cream-ink">궁합풀이 만드는 중…</span>
                </span>

                <span className={`${BUTTON_SECONDARY_SMALL} self-start`}>
                  함께 보기
                  <Icon name="arrow" className="size-4 transition-transform group-hover:translate-x-0.5" />
                </span>
              </Link>
            </li>
          );
        })}
      </ul>
    </section>
  );
}

/**
 * 아직 한 권도 없을 때 — **어디서 만드는지를 말한다.** 빈 화면만 남으면 고장으로 읽힌다.
 *
 * 만드는 자리는 모두 홈에서 닿는다(메뉴가 홈 · 매칭 · 풀이 · 채팅이 된 뒤로 「내 사주」 · 「사람」 탭은
 * 없다). 그래도 표지 셋은 그 자리로 **곧장** 간다 — 홈을 한 번 더 지나게 하지 않는다.
 */
export function Nothing({ hasSelf }: { hasSelf: boolean }) {
  const slots = [
    hasSelf
      ? { href: '/me/readings/self', label: '내 사주풀이', element: '木' as const }
      : { href: '/me', label: '내 사주 등록', element: '木' as const },
    { href: '/me/people', label: '저장한 사람', element: '土' as const },
    { href: '/compat', label: '궁합 보러 가기', element: '火' as const },
  ];
  return (
    <section className={`${PAPER} flex flex-col gap-6`}>
      <div className="flex max-w-[34rem] flex-col gap-2">
        <h2 className={TYPE_SECTION}>아직 만든 풀이가 없습니다</h2>
        <p className="text-[15px] leading-7 text-secondary">
          내 사주풀이와 저장한 사람의 풀이, 두 사람의 궁합은 모두 홈에서 시작할 수 있습니다.
        </p>
      </div>
      <ul className="grid grid-cols-3 gap-2.5 sm:max-w-[34rem] sm:gap-3">
        {slots.map((slot) => (
          <li key={slot.href}>
            <Link
              href={slot.href}
              className={`${elementScope(slot.element)} relative flex h-full min-h-36 flex-col items-center justify-center gap-3 overflow-hidden rounded-[0.5rem_1.25rem_1.25rem_0.5rem] bg-[var(--tile)] py-3 pl-4 pr-2 text-center shadow-[0_10px_22px_-16px_rgba(60,48,30,0.55)] transition-transform hover:-translate-y-0.5 active:scale-[0.97]`}
            >
              <Spine background="var(--mid)" />
              <ElementSymbol element={slot.element} className="size-9" />
              <span className="text-[14px] font-semibold leading-5 text-foreground sm:text-[15px]">{slot.label}</span>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}

function Spine({ background }: { background: string }) {
  return (
    <>
      <span aria-hidden="true" className="absolute inset-y-0 left-0 w-2.5" style={{ background }} />
      <span aria-hidden="true" className="absolute inset-y-0 left-2.5 w-px bg-[color-mix(in_srgb,var(--foreground)_14%,transparent)]" />
    </>
  );
}

function Metaphor({ text, lines }: { text: string | null; lines: string }) {
  return (
    <span className={`font-rounded relative ${lines} flex-1 text-[1.0625rem] leading-[1.5] text-foreground`}>
      {text === null ? (
        <span className="font-sans text-[13px] text-secondary">만들어 둔 풀이를 이어서 읽어보세요</span>
      ) : (
        <>
          <span aria-hidden="true">“</span>
          {text}
          <span aria-hidden="true">”</span>
        </>
      )}
    </span>
  );
}

/** 일간 딱지 — 상징 + 일간 글자 + 「나무」. 색만으로 말하지 않는다 */
export function SubjectTag({ subject }: { subject: DayMaster | null }) {
  if (subject === null) return null;
  return (
    <span className={`${elementScope(subject.element)} flex items-center gap-1 text-[12px] font-semibold text-[var(--ink)]`}>
      <ElementSymbol element={subject.element} className="size-4" />
      <span className="glyph font-bold">{subject.stem}</span>
      <span>{ELEMENT_PICTURE_KO[subject.element]}</span>
    </span>
  );
}

function StaleChip() {
  return <span className="rounded-full bg-warning-wash px-1.5 py-0.5 text-[11px] font-semibold text-warning">이전 명식</span>;
}

/**
 * 넓은 화면에서 목록 주소만 열었고 펼칠 한 사람 풀이가 없을 때의 오른쪽 칸 — 비워 두면 고장으로 읽힌다.
 * 한 사람 풀이가 있으면 이 칸은 잠깐만 선다(`frame.tsx` 가 가장 최근 글로 옮긴다).
 */
export function EmptyReader() {
  return (
    <div className={`${EMPTY_SLOT} grid min-h-80 place-items-center p-8 text-center`}>
      <p className="text-[15px] leading-6 text-secondary">표지를 누르면 여기에 풀이가 펼쳐집니다.</p>
    </div>
  );
}
