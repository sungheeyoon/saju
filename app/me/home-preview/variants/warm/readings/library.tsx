'use client';

import Image from 'next/image';
import Link from 'next/link';
import { useRef, useState } from 'react';

import type { Element } from '@/src/lib/saju';

import { previewHref } from '../../../shared/preview-href';
import { PRIMARY, SECONDARY, TERTIARY } from '../buttons';
import { rounded } from '../fonts';
import { ELEMENT_CLASS, ElementSymbol, Icon, NONE_CLASS } from '../symbols';
import { essayOf, minutesOf } from './essays';
import styles from './readings.module.css';

/*
  **책장과 읽는 자리 — 한 화면 안의 두 보기.**

  넓은 화면(lg)은 왼쪽 책장 · 오른쪽 글의 두 칸이고, 폰은 같은 두 보기를 **화면 안에서 갈아 끼운다** — 표지를 누르면
  글이 서고 「만든 풀이 목록」으로 돌아온다. 주소는 안 바꾼다(`page.tsx` 는 못 고친다). 실제로 옮기면 폰의 글은
  `/me/readings/[subject]` 주소를 갖는 화면이고, 두 칸은 그 주소를 오른쪽에 끼운 레이아웃이 된다.

  한 사람 풀이만 이 자리에서 펼친다. 궁합은 결과 화면이 따로 있어(`/compat/result` · `/me/match/…`) 표지가 그리로 가는 링크다.
*/

export type Book = {
  key: string;
  /** 한 사람 풀이 — 이 화면에서 펼친다 */
  single: boolean;
  /** 목록에서 부르는 말(`readingTitle`) — 「내 사주」 · 「엄마 사주」 · 「서하 × 서진 궁합」 */
  title: string;
  /** 글 화면의 큰 이름 — 「내 사주」 · 「엄마」 */
  name: string;
  metaphor: string | null;
  date: string;
  score: number | null;
  stale: boolean;
  /** 대상의 일간 — 한 사람이면 하나, 궁합이면 둘. 못 읽은 명식은 `null` */
  subjects: readonly { dayMaster: string; element: Element; picture: string }[] | null;
  href: string;
  chartHref: string;
  essayKey: string;
};

export type Making = {
  matchId: string;
  nickname: string;
  photoUrl: string | null;
  supplied: { element: Element; picture: string } | null;
  balanceLabel: string | null;
};

const TONE: Record<Element, string> = { 木: 'wood', 火: 'fire', 土: 'earth', 金: 'metal', 水: 'water' };

export function Library({
  singles,
  pairs,
  making,
  hasSelf,
  staleNote,
}: {
  singles: readonly Book[];
  pairs: readonly Book[];
  making: readonly Making[];
  hasSelf: boolean;
  staleNote: string;
}) {
  const [openKey, setOpenKey] = useState<string | null>(singles[0]?.key ?? null);
  const [view, setView] = useState<'shelf' | 'reader'>('shelf');
  const readerRef = useRef<HTMLDivElement>(null);
  const shelfRef = useRef<HTMLDivElement>(null);

  const open = singles.find((book) => book.key === openKey) ?? null;
  const next = open === null ? null : singles[(singles.indexOf(open) + 1) % singles.length];

  const choose = (key: string) => {
    setOpenKey(key);
    setView('reader');
    /* 폰에서는 글이 책장 자리에 들어서므로 그 머리로 올린다. 두 칸에서도 오른쪽 글의 머리가 보이게 한다 */
    requestAnimationFrame(() => readerRef.current?.scrollIntoView({ block: 'start', behavior: 'smooth' }));
  };
  const back = () => {
    setView('shelf');
    requestAnimationFrame(() => shelfRef.current?.scrollIntoView({ block: 'start' }));
  };

  if (singles.length === 0 && pairs.length === 0 && making.length === 0) {
    return <Nothing hasSelf={hasSelf} />;
  }

  return (
    <div className="grid gap-10 lg:grid-cols-[minmax(0,24rem)_minmax(0,1fr)] lg:items-start lg:gap-12">
      <div ref={shelfRef} className={`${view === 'reader' ? 'hidden lg:flex' : 'flex'} scroll-mt-6 flex-col gap-10`}>
        <header className="flex flex-col gap-2">
          <h1 className={`${rounded.className} text-[2.25rem] leading-[1.2] tracking-[-0.02em] text-foreground sm:text-[2.5rem]`}>만든 풀이</h1>
          <p className="text-[13px] font-semibold tabular-nums text-secondary">
            사주풀이 {singles.length} · 궁합풀이 {pairs.length}
          </p>
        </header>

        {making.length > 0 && <MakingShelf making={making} />}

        <Shelf title="사주풀이" description="나와 저장한 사람을 한 사람씩 본 풀이입니다.">
          {!hasSelf && <BlankBook href={previewHref('/me')} element="木" label="내 명식 등록" />}
          {singles.map((book) => (
            <li key={book.key}>
              <SingleCover book={book} current={book.key === openKey} onOpen={() => choose(book.key)} />
            </li>
          ))}
        </Shelf>

        <Shelf title="궁합풀이" description="두 사람을 함께 맞대어 본 풀이입니다.">
          {pairs.map((book) => (
            <li key={book.key}>
              <PairCover book={book} />
            </li>
          ))}
          {pairs.length === 0 && <BlankBook href={previewHref('/compat')} element="火" label="궁합 보러 가기" />}
        </Shelf>
      </div>

      <div ref={readerRef} className={`${view === 'shelf' ? 'hidden lg:block' : 'block'} min-w-0 scroll-mt-6`}>
        {open === null ? (
          <EmptyReader />
        ) : (
          <Reader
            key={open.key}
            book={open}
            next={next !== null && next.key !== open.key ? next : null}
            staleNote={staleNote}
            onBack={back}
            onNext={(key) => choose(key)}
          />
        )}
      </div>
    </div>
  );
}

/* ───────────────────────── 책장 ───────────────────────── */

function Shelf({ title, description, children }: { title: string; description: string; children: React.ReactNode }) {
  return (
    <section className="flex flex-col gap-4">
      <div>
        <h2 className={`${rounded.className} text-[1.5rem] leading-8 text-foreground`}>{title}</h2>
        <p className="mt-0.5 text-[13px] text-secondary">{description}</p>
      </div>
      <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-2">{children}</ul>
    </section>
  );
}

/** 한 사람 풀이 = 제 일간 색의 표지 한 권. 왼쪽 등(spine)이 상징색, 가운데가 비유 한 줄 */
function SingleCover({ book, current, onOpen }: { book: Book; current: boolean; onOpen: () => void }) {
  const subject = book.subjects?.[0] ?? null;
  return (
    <button
      type="button"
      onClick={onOpen}
      aria-current={current ? 'true' : undefined}
      className={`${subject === null ? NONE_CLASS : ELEMENT_CLASS[subject.element]} group relative flex h-full min-h-[14rem] w-full flex-col gap-3 overflow-hidden rounded-[0.5rem_1.5rem_1.5rem_0.5rem] bg-[var(--tile)] py-4 pl-6 pr-4 text-left shadow-[0_10px_22px_-16px_rgba(60,48,30,0.55)] transition-transform hover:-translate-y-0.5 active:scale-[0.97] focus-visible:outline-[3px] focus-visible:outline-offset-2 focus-visible:outline-[color-mix(in_srgb,var(--btn)_45%,transparent)] ${
        current ? 'ring-[3px] ring-[var(--btn)] ring-offset-2 ring-offset-background' : ''
      }`}
    >
      <Spine />
      <ElementSymbol element={subject?.element ?? null} className="pointer-events-none absolute -bottom-5 -right-5 size-24 opacity-15" />

      <span className="relative flex min-w-0 flex-col gap-1">
        <SubjectTag subject={subject} />
        <span className="truncate text-[15px] font-semibold text-foreground">{book.title}</span>
      </span>

      <span className={`${rounded.className} relative line-clamp-4 flex-1 text-[1.0625rem] leading-[1.5] text-foreground`}>
        {book.metaphor === null ? (
          <span className="font-sans text-[13px] text-secondary">만들어 둔 풀이를 이어서 읽어보세요</span>
        ) : (
          <>
            <span aria-hidden="true" className="text-[var(--ink)]">“</span>
            {book.metaphor}
            <span aria-hidden="true" className="text-[var(--ink)]">”</span>
          </>
        )}
      </span>

      <span className="relative flex flex-wrap items-center gap-1.5">
        {book.stale && <StaleChip />}
        <span className="text-[12px] tabular-nums text-secondary">{book.date}</span>
      </span>
    </button>
  );
}

/** 궁합 = 두 사람의 색이 비스듬히 만나는 표지. 결과 화면이 따로 있어 링크다 */
function PairCover({ book }: { book: Book }) {
  const [a, b] = book.subjects ?? [];
  const tone = (one: { element: Element } | undefined) => (one === undefined ? 'none' : TONE[one.element]);
  return (
    <Link
      href={book.href}
      className="group relative flex h-full min-h-[14rem] flex-col gap-3 overflow-hidden rounded-[0.5rem_1.5rem_1.5rem_0.5rem] py-4 pl-6 pr-4 shadow-[0_10px_22px_-16px_rgba(60,48,30,0.55)] transition-transform hover:-translate-y-0.5 active:scale-[0.97] focus-visible:outline-[3px] focus-visible:outline-offset-2 focus-visible:outline-[color-mix(in_srgb,var(--btn)_45%,transparent)]"
      style={{
        background: `linear-gradient(150deg, var(--${tone(a)}-bg) 0 52%, var(--${tone(b)}-bg) 52% 100%)`,
      }}
    >
      <span
        aria-hidden="true"
        className="absolute inset-y-0 left-0 w-2.5"
        style={{ background: `linear-gradient(180deg, var(--${tone(a)}-mid) 0 50%, var(--${tone(b)}-mid) 50% 100%)` }}
      />

      <span className="relative flex items-center justify-between gap-2">
        <span className="flex -space-x-2">
          {[a, b].map((one, index) => (
            <span
              key={index}
              className={`${one === undefined ? NONE_CLASS : ELEMENT_CLASS[one.element]} grid size-8 place-items-center rounded-full bg-[var(--card)] ring-2 ring-[var(--tile)]`}
            >
              <ElementSymbol element={one?.element ?? null} className="size-5" />
            </span>
          ))}
          <span className="sr-only">{[a, b].map((one) => one?.picture ?? '').join(' · ')}</span>
        </span>
        {book.score !== null && (
          <span className="flex items-baseline gap-0.5 text-foreground">
            <span className="text-[1.75rem] font-bold leading-none tabular-nums">{book.score}</span>
            <span className="text-[12px] font-semibold text-secondary">점</span>
          </span>
        )}
      </span>

      <span className="relative truncate text-[15px] font-semibold text-foreground">{book.title}</span>

      <span className={`${rounded.className} relative line-clamp-3 flex-1 text-[1.0625rem] leading-[1.5] text-foreground`}>
        {book.metaphor !== null && (
          <>
            <span aria-hidden="true">“</span>
            {book.metaphor}
            <span aria-hidden="true">”</span>
          </>
        )}
      </span>

      <span className="relative flex items-center justify-between gap-2">
        <span className="flex flex-wrap items-center gap-1.5">
          {book.stale && <StaleChip />}
          <span className="text-[12px] tabular-nums text-secondary">{book.date}</span>
        </span>
        <span className="grid size-8 shrink-0 place-items-center rounded-full bg-[color-mix(in_srgb,var(--card)_80%,transparent)] text-foreground group-hover:translate-x-0.5">
          <Icon name="arrow" className="size-4" />
        </span>
      </span>
    </Link>
  );
}

/** 빈 자리 한 권 — 같은 크기의 점선 표지라 「한 권 더」로 읽힌다 */
function BlankBook({ href, element, label }: { href: string; element: Element; label: string }) {
  return (
    <li>
      <Link
        href={href}
        className={`${ELEMENT_CLASS[element]} flex h-full min-h-[14rem] flex-col items-center justify-center gap-3 rounded-[0.5rem_1.5rem_1.5rem_0.5rem] border-2 border-dashed border-[color-mix(in_srgb,var(--ink)_28%,transparent)] p-4 text-center hover:bg-[var(--card)] active:scale-[0.98] focus-visible:outline-[3px] focus-visible:outline-offset-2 focus-visible:outline-[color-mix(in_srgb,var(--btn)_45%,transparent)]`}
      >
        <span className="grid size-12 place-items-center rounded-full bg-[var(--tile)]">
          <ElementSymbol element={element} className="size-7" />
        </span>
        <span className="text-[15px] font-semibold text-foreground">{label}</span>
      </Link>
    </li>
  );
}

function Spine() {
  return (
    <>
      <span aria-hidden="true" className="absolute inset-y-0 left-0 w-2.5 bg-[var(--mid)]" />
      <span aria-hidden="true" className="absolute inset-y-0 left-2.5 w-px bg-[color-mix(in_srgb,var(--ink)_22%,transparent)]" />
    </>
  );
}

function SubjectTag({ subject }: { subject: { dayMaster: string; element: Element; picture: string } | null }) {
  if (subject === null) return null;
  return (
    <span
      className="flex items-center gap-1 text-[12px] font-semibold text-[var(--ink)]"
      aria-label={`일간 ${subject.dayMaster}, ${subject.picture}`}
    >
      <ElementSymbol element={subject.element} className="size-4" />
      <span aria-hidden="true" className="glyph font-bold">
        {subject.dayMaster}
      </span>
      <span aria-hidden="true">{subject.picture}</span>
    </span>
  );
}

function StaleChip() {
  return <span className="rounded-full bg-warning-wash px-1.5 py-0.5 text-[11px] font-semibold text-warning">이전 명식</span>;
}

/* ───────────────────────── 함께 보는 궁합 ───────────────────────── */

function MakingShelf({ making }: { making: readonly Making[] }) {
  return (
    <section className="flex flex-col gap-3">
      <div>
        <h2 className={`${rounded.className} text-[1.5rem] leading-8 text-foreground`}>함께 보는 궁합</h2>
        <p className="mt-0.5 text-[13px] text-secondary">서로 동의한 궁합풀이를 만들고 있습니다.</p>
      </div>
      <ul className="flex flex-col gap-3">
        {making.map((one) => (
          <li
            key={one.matchId}
            className="relative flex flex-col gap-4 overflow-hidden rounded-[1.75rem] bg-[var(--cream)] p-5"
          >
            <div className="flex items-center gap-3.5">
              <Avatar nickname={one.nickname} photoUrl={one.photoUrl} />
              <div className="min-w-0 flex-1">
                <p className="truncate text-[17px] font-semibold text-foreground">{one.nickname} 님과의 궁합풀이</p>
                {one.supplied !== null && one.balanceLabel !== null && (
                  <p className={`${ELEMENT_CLASS[one.supplied.element]} mt-0.5 flex items-center gap-1 text-[13px] text-secondary`}>
                    <ElementSymbol element={one.supplied.element} className="size-4 shrink-0" />
                    <span className="truncate">{one.balanceLabel}</span>
                  </p>
                )}
              </div>
            </div>

            <div className="flex flex-col gap-2" role="status">
              <div
                aria-hidden="true"
                className="h-2 overflow-hidden rounded-full bg-[color-mix(in_srgb,var(--cream-ink)_14%,transparent)]"
              >
                <div className={`${styles.flow} h-full w-full rounded-full`} />
              </div>
              <p className="text-[13px] font-semibold text-[var(--cream-ink)]">궁합풀이 만드는 중…</p>
            </div>

            <Link href={previewHref(`/me/match/${one.matchId}`)} className={`${SECONDARY} self-start`}>
              함께 보기
              <Icon name="arrow" className="size-4" />
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}

function Avatar({ nickname, photoUrl }: { nickname: string; photoUrl: string | null }) {
  if (photoUrl === null) {
    return (
      <span className="grid size-14 shrink-0 place-items-center rounded-full bg-[var(--card)] text-[1.25rem] font-bold text-[var(--cream-ink)]">
        {nickname.slice(0, 1)}
      </span>
    );
  }
  /* 시안의 가짜 사진이다(같은 출처 정적 파일). 실제 화면은 `Avatar` 가 든다 */
  return (
    <Image src={photoUrl} alt="" width={56} height={56} className="size-14 shrink-0 rounded-full object-cover ring-2 ring-[var(--card)]" />
  );
}

/* ───────────────────────── 읽는 자리 ───────────────────────── */

function Reader({
  book,
  next,
  staleNote,
  onBack,
  onNext,
}: {
  book: Book;
  next: Book | null;
  staleNote: string;
  onBack: () => void;
  onNext: (key: string) => void;
}) {
  const subject = book.subjects?.[0] ?? null;
  const essay = essayOf(book.essayKey);
  const minutes = minutesOf(essay);
  const tone = subject === null ? NONE_CLASS : ELEMENT_CLASS[subject.element];

  return (
    <article aria-labelledby="warm-reading-title" className="flex flex-col gap-6">
      <button type="button" onClick={onBack} className={`${TERTIARY} self-start lg:hidden`}>
        <Icon name="arrow" className="size-4 rotate-180" />
        만든 풀이 목록
      </button>

      <header className="flex flex-wrap items-end justify-between gap-x-6 gap-y-4">
        <div className="min-w-0">
          <p className="text-[13px] font-semibold text-secondary">사주풀이</p>
          <h2 id="warm-reading-title" className={`${rounded.className} mt-1 text-[2rem] leading-[1.2] tracking-[-0.02em] text-foreground sm:text-[2.5rem]`}>
            {book.name}
          </h2>
        </div>
        <nav aria-label={`${book.name}의 사주와 사주풀이`}>
          <ul className="flex rounded-full bg-[var(--card)] p-1 ring-1 ring-[var(--line)]">
            <li>
              <Link
                href={book.chartHref}
                className="inline-flex min-h-11 items-center rounded-full px-5 text-[15px] font-semibold text-secondary hover:text-foreground active:scale-[0.97]"
              >
                사주
              </Link>
            </li>
            <li>
              <span
                aria-current="page"
                className="inline-flex min-h-11 items-center rounded-full bg-[var(--btn)] px-5 text-[15px] font-semibold text-[var(--on-btn)]"
              >
                사주풀이
              </span>
            </li>
          </ul>
        </nav>
      </header>

      {/* 표지 — 비유 한 줄이 이 글의 제목이다. 가장 크게 세운다 */}
      <figure className={`${tone} relative overflow-hidden rounded-[2rem] bg-[var(--tile)] px-6 pb-6 pt-8 sm:px-10 sm:pb-8 sm:pt-12`}>
        <ElementSymbol element={subject?.element ?? null} className="pointer-events-none absolute -right-10 -top-10 size-48 opacity-20 sm:size-64" />
        <span aria-hidden="true" className={`${rounded.className} relative block h-10 text-[5rem] leading-none text-[var(--ink)] opacity-70`}>
          “
        </span>
        <blockquote
          className={`${rounded.className} relative mt-2max-w-[18em] text-pretty text-[1.875rem] leading-[1.4] tracking-[-0.02em] text-foreground sm:text-[2.5rem]`}
        >
          {book.metaphor ?? `${book.name}의 사주풀이`}
        </blockquote>
        <figcaption className="relative mt-8 flex flex-wrap items-center gap-x-3 gap-y-2 border-t border-[color-mix(in_srgb,var(--ink)_15%,transparent)] pt-4 text-[13px] text-secondary">
          {subject !== null && (
            <span className="rounded-full bg-[color-mix(in_srgb,var(--card)_70%,transparent)] py-1 pl-1 pr-2.5">
              <SubjectTag subject={subject} />
            </span>
          )}
          <span className="tabular-nums">{book.date} 생성</span>
          <span aria-hidden="true">·</span>
          <span>읽는 데 약 {minutes}분</span>
        </figcaption>
      </figure>

      {book.stale && (
        <p className="flex gap-2.5 rounded-[1.25rem] bg-warning-wash px-4 py-3.5 text-[14px] leading-6 text-foreground">
          <Icon name="alert" className="mt-0.5 size-5 text-warning" />
          <span>
            <span className="mr-1.5 font-semibold text-warning">이전 명식</span>
            {staleNote}
          </span>
        </p>
      )}

      {/* 글을 다 읽은 사람이 하는 일 둘 — 반반으로 나란히(원본 `panel.tsx` 의 머리와 같은 규율). 낡은 글이면 다시 받기가 주 단추 */}
      <div className="grid grid-cols-1 gap-2 min-[400px]:grid-cols-2 sm:flex sm:flex-wrap">
        <span className={`${book.stale ? SECONDARY : PRIMARY} px-3 sm:px-5`}>
          <ShareIcon />
          공유 링크 복사
        </span>
        <span className={`${book.stale ? PRIMARY : SECONDARY} px-3 sm:px-5`}>
          <Icon name="spark" className="size-[18px]" />
          사주풀이 다시 받기
        </span>
      </div>

      <div className="mt-4 flex max-w-[36rem] flex-col text-foreground">
        <p className="text-[1.1875rem] font-medium leading-[1.75] tracking-[-0.01em]">{essay.lead}</p>
        {essay.sections.map((section) => (
          <section key={section.heading} className="mt-12">
            <h3 className={`${rounded.className} flex items-center gap-2.5 text-[1.5rem] leading-[1.35] text-foreground`}>
              <span aria-hidden="true" className={`${tone} h-6 w-1.5 shrink-0 rounded-full bg-[var(--mid)]`} />
              {section.heading}
            </h3>
            {section.paragraphs.map((paragraph) => (
              <p key={paragraph.slice(0, 24)} className="mt-5 text-[17px] leading-[1.85]">
                {paragraph}
              </p>
            ))}
          </section>
        ))}

        <span aria-hidden="true" className="mt-14 flex justify-center gap-3 opacity-80">
          {(['木', '火', '土', '金', '水'] as const).map((element) => (
            <span key={element} className={ELEMENT_CLASS[element]}>
              <ElementSymbol element={element} className="size-5" />
            </span>
          ))}
        </span>
      </div>

      {next !== null && (
        <button
          type="button"
          onClick={() => onNext(next.key)}
          className={`${next.subjects === null ? NONE_CLASS : ELEMENT_CLASS[next.subjects[0].element]} group mt-6 flex max-w-[36rem] items-center gap-4 rounded-[1.5rem] border border-[var(--line)] bg-[var(--card)] p-4 text-left hover:border-[color-mix(in_srgb,var(--ink)_40%,transparent)] active:scale-[0.99] focus-visible:outline-[3px] focus-visible:outline-offset-2 focus-visible:outline-[color-mix(in_srgb,var(--btn)_45%,transparent)]`}
        >
          <span className="grid size-12 shrink-0 place-items-center rounded-2xl bg-[var(--tile)]">
            <ElementSymbol element={next.subjects?.[0].element ?? null} className="size-7" />
          </span>
          <span className="flex min-w-0 flex-1 flex-col gap-0.5">
            <span className="text-[12px] font-semibold text-secondary">다음 풀이</span>
            <span className="truncate text-[15px] font-semibold text-foreground">{next.title}</span>
            {next.metaphor !== null && <span className="truncate text-[13px] text-secondary">{next.metaphor}</span>}
          </span>
          <Icon name="arrow" className="size-5 text-foreground group-hover:translate-x-0.5" />
        </button>
      )}
    </article>
  );
}

function EmptyReader() {
  return (
    <div className="grid min-h-80 place-items-center rounded-[2rem] border-2 border-dashed border-[var(--line)] p-8 text-center">
      <p className="text-[15px] text-secondary">표지를 누르면 여기에 풀이가 펼쳐집니다.</p>
    </div>
  );
}

/** 아직 한 권도 없을 때 — 어디서 만드는지를 빈 표지 세 권으로 말한다(원본 「아직 만든 풀이가 없습니다」) */
function Nothing({ hasSelf }: { hasSelf: boolean }) {
  const slots = [
    { href: hasSelf ? '/me/readings/self' : '/me', label: '내 사주', element: '木' },
    { href: '/me/people', label: '사람', element: '土' },
    { href: '/compat', label: '궁합', element: '火' },
  ] as const;
  return (
    <section className="flex flex-col gap-8">
      <header className="flex flex-col gap-2">
        <h1 className={`${rounded.className} text-[2.25rem] leading-[1.2] tracking-[-0.02em] text-foreground sm:text-[2.5rem]`}>만든 풀이</h1>
      </header>
      <div className="flex flex-col gap-6 rounded-[2rem] bg-[var(--cream)] p-6 sm:p-10">
        <div className="flex max-w-[34rem] flex-col gap-2">
          <h2 className={`${rounded.className} text-[1.75rem] leading-[1.3] text-foreground`}>아직 만든 풀이가 없습니다</h2>
          <p className="text-[15px] leading-7 text-secondary">
            내 사주 에서 내 풀이를 만들 수 있습니다. 저장한 사람의 풀이는 사람 에서, 두 사람의 궁합은 궁합 에서 시작할 수
            있습니다.
          </p>
        </div>
        <ul className="grid grid-cols-3 gap-3 sm:max-w-[34rem]">
          {slots.map((slot) => (
            <li key={slot.href}>
              <Link
                href={previewHref(slot.href)}
                className={`${ELEMENT_CLASS[slot.element]} relative flex min-h-36 flex-col items-center justify-center gap-3 overflow-hidden rounded-[0.5rem_1.25rem_1.25rem_0.5rem] bg-[var(--tile)] p-3 pl-5 text-center shadow-[0_10px_22px_-16px_rgba(60,48,30,0.55)] hover:-translate-y-0.5 active:scale-[0.97] focus-visible:outline-[3px] focus-visible:outline-offset-2 focus-visible:outline-[color-mix(in_srgb,var(--btn)_45%,transparent)]`}
              >
                <Spine />
                <ElementSymbol element={slot.element} className="size-9" />
                <span className="flex items-center gap-1 text-[15px] font-semibold text-foreground">
                  {slot.label}
                  <Icon name="arrow" className="size-4" />
                </span>
              </Link>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}

function ShareIcon() {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24" className="size-[18px] shrink-0 fill-none stroke-current" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1.2 1.2M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1.2-1.2" />
    </svg>
  );
}
