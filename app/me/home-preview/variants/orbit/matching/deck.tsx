'use client';

import { useEffect, useRef, useState, type PointerEvent, type ReactNode, type RefObject } from 'react';

import type { Element } from '@/src/lib/saju';

import type { DeckCard } from '../../../../matching/matching-experience';
import { ELEMENT_TONE } from '../../../../../element-tone';
import { Arrow, BUTTON } from '../ui';
import { ApproachMap, Spark, type MapStatus } from './approach-map';
import { MATCHING_COPY as COPY } from './copy';
import { ElementBead, Face, MiniOrbit, isElement } from './orbit-art';

/*
  **카드 더미 · 지나친 인연 · 다가오는 지도 — 누름이 셋을 함께 움직인다.**

  실제 화면(`matching-experience.tsx`)의 흐름을 흉내만 낸다: 넘기면 지나친 인연에 쌓이고, 실행 취소와
  「다시 만나보기」가 같은 복원 길을 쓰고, 궁합 요청은 확인 창을 한 번 거친다. **요청은 나가지 않는다.**

  실제 화면과 다른 셋:
  1. 「지나친 인연」이 오른쪽 위의 서랍이 아니라 **카드와 같은 줄의 두 번째 탭**이다 — 서랍 단추는 11px 로
     작았고, 넘긴 사람이 어디로 갔는지 화면이 말하지 않았다. 여기서는 탭의 숫자가 넘길 때마다 오른다.
  2. 단추 줄의 위계를 모양으로 갈랐다 — 되돌리기(48 원) · 다음 인연(보조 판) · 궁합 요청(채운 판, 1.35배 폭).
  3. 카드 옆 지도가 같은 상태를 읽는다 — 넘긴 사람은 궤도 밖으로, 요청한 사람은 가운데로 사라진다.
*/

export type MeMark = {
  stem: string;
  element: Element;
  spoken: string;
  elements: { element: Element; ko: string; count: number; low: boolean }[];
};

type View = 'today' | 'passed';

const EXIT_MS = 420;

const photoOf = (card: DeckCard): string | null =>
  card.photoUrl ?? (card.hasPhoto ? `/me/photo/${card.candidateUserId}` : null);

const FOCUS =
  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-background';

export function Deck({ me, cards, explorationNote }: { me: MeMark; cards: readonly DeckCard[]; explorationNote: string | null }) {
  const [remaining, setRemaining] = useState<readonly DeckCard[]>(cards);
  const [passed, setPassed] = useState<readonly DeckCard[]>([]);
  const [requested, setRequested] = useState<readonly string[]>([]);
  /** 실행 취소로 되돌릴 수 있는 넘김 — 최근 것이 앞 */
  const [history, setHistory] = useState<readonly DeckCard[]>([]);
  const [exit, setExit] = useState<'left' | 'right' | null>(null);
  const [view, setView] = useState<View>('today');
  const [announcement, setAnnouncement] = useState('');
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const detail = useRef<HTMLDialogElement>(null);
  const confirming = useRef<HTMLDialogElement>(null);

  useEffect(() => () => {
    if (timer.current) clearTimeout(timer.current);
  }, []);

  const profile = remaining[0] ?? null;
  const index = cards.length - remaining.length;

  function leave(direction: 'left' | 'right', then: () => void, said: string) {
    setExit(direction);
    setAnnouncement(said);
    timer.current = setTimeout(() => {
      then();
      setExit(null);
      timer.current = null;
    }, EXIT_MS);
  }

  function pass() {
    if (profile === null || exit) return;
    const card = profile;
    leave(
      'left',
      () => {
        setRemaining((list) => list.filter((one) => one.candidateUserId !== card.candidateUserId));
        setPassed((list) => [card, ...list.filter((one) => one.candidateUserId !== card.candidateUserId)]);
        setHistory((list) => [card, ...list]);
      },
      COPY.passedSaid(card.nickname),
    );
  }

  function send() {
    if (profile === null || exit) return;
    const card = profile;
    leave(
      'right',
      () => {
        setRemaining((list) => list.filter((one) => one.candidateUserId !== card.candidateUserId));
        setRequested((list) => [...list, card.candidateUserId]);
      },
      COPY.sentPreview(card.nickname),
    );
  }

  /** 실행 취소와 「다시 만나보기」가 같은 길 — 보관함에서 빼고 카드 맨 앞으로 */
  function restore(card: DeckCard) {
    setPassed((list) => list.filter((one) => one.candidateUserId !== card.candidateUserId));
    setHistory((list) => list.filter((one) => one.candidateUserId !== card.candidateUserId));
    setRemaining((list) => [card, ...list.filter((one) => one.candidateUserId !== card.candidateUserId)]);
    setAnnouncement(COPY.restoredSaid(card.nickname));
    setView('today');
  }

  const statusOf = (card: DeckCard): MapStatus =>
    profile?.candidateUserId === card.candidateUserId
      ? 'current'
      : remaining.some((one) => one.candidateUserId === card.candidateUserId)
        ? 'waiting'
        : requested.includes(card.candidateUserId)
          ? 'requested'
          : 'passed';

  const undoable = history[0] ?? null;

  return (
    <>
      <header className="flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
        <div className="flex min-w-0 flex-col gap-2">
          <h2 className="text-[2rem] font-bold leading-[1.15] tracking-[-0.045em] sm:text-[2.5rem]">{COPY.title}</h2>
          <p className="text-[15px] leading-6 text-secondary">{COPY.lead}</p>
        </div>
        <ViewTabs view={view} onView={setView} today={remaining.length} passed={passed.length} />
      </header>

      <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,25rem)_minmax(0,1fr)] lg:gap-10">
        <section aria-label={view === 'today' ? COPY.deckHeader : COPY.tabPassed} className="mx-auto flex w-full min-w-0 max-w-[26rem] flex-col gap-4">
          {view === 'today' ? (
            <>
              {profile !== null ? (
                <CandidateCard
                  key={profile.candidateUserId}
                  card={profile}
                  me={me}
                  position={index + 1}
                  total={cards.length}
                  exit={exit}
                  onOpen={() => detail.current?.showModal()}
                  onPass={pass}
                  onLike={() => confirming.current?.showModal()}
                />
              ) : (
                <EmptyDeck
                  me={me}
                  title={cards.length === 0 ? COPY.emptyTitle : COPY.doneTitle}
                  line={cards.length === 0 ? COPY.emptyLine : COPY.doneLine}
                  passedCount={passed.length}
                  onPassed={() => setView('passed')}
                />
              )}

              {/* 넘길 사람도 되돌릴 사람도 없으면 단추 줄을 안 세운다 — 잠긴 단추 셋은 빈 자리를 시끄럽게 한다 */}
              {(profile !== null || undoable !== null) && (
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  aria-label={COPY.undoAria}
                  disabled={undoable === null || exit !== null}
                  onClick={() => undoable !== null && restore(undoable)}
                  className={`grid size-12 shrink-0 place-items-center rounded-full border border-border-strong bg-surface text-secondary transition hover:border-accent hover:text-accent active:scale-95 disabled:opacity-35 disabled:hover:border-border-strong disabled:hover:text-secondary ${FOCUS}`}
                >
                  <UndoIcon />
                </button>
                <button
                  type="button"
                  aria-label={COPY.passAria}
                  disabled={profile === null || exit !== null}
                  onClick={pass}
                  className={`${BUTTON.secondary} min-w-0 flex-1 gap-1.5 whitespace-nowrap px-2.5 disabled:opacity-40`}
                >
                  <CloseIcon /> {COPY.pass}
                </button>
                <button
                  type="button"
                  aria-label={COPY.requestAria}
                  disabled={profile === null || exit !== null}
                  onClick={() => confirming.current?.showModal()}
                  className={`${BUTTON.primary} min-w-0 flex-[1.35] gap-1.5 whitespace-nowrap px-2.5 disabled:opacity-40`}
                >
                  <HeartIcon /> {COPY.request}
                </button>
              </div>
              )}

              {undoable !== null && (
                <p className="flex min-h-12 items-center justify-between gap-3 rounded-2xl bg-foreground py-1.5 pl-4 pr-1.5 text-sm font-semibold text-background">
                  {COPY.undoBar}
                  <button
                    type="button"
                    onClick={() => restore(undoable)}
                    className={`min-h-11 shrink-0 rounded-xl px-3 font-bold underline underline-offset-4 active:opacity-70 ${FOCUS}`}
                  >
                    {COPY.undo}
                  </button>
                </p>
              )}
            </>
          ) : (
            <PassedView cards={passed} onRestore={restore} onContinue={() => setView('today')} />
          )}
          <p role="status" className="sr-only">
            {announcement}
          </p>
        </section>

        <aside aria-label={COPY.mapTitle} className="hidden min-w-0 flex-col gap-4 lg:flex">
          <div className="overflow-hidden rounded-[2rem] border border-border bg-surface shadow-[var(--shadow-card)]">
            <div className="flex items-baseline justify-between gap-3 px-6 pt-5">
              <h3 className="text-xl font-bold tracking-[-0.03em]">{COPY.mapTitle}</h3>
              {cards.length > 0 && (
                <span className="text-[13px] font-semibold tabular-nums text-muted">
                  {String(Math.min(index + 1, cards.length)).padStart(2, '0')} / {String(cards.length).padStart(2, '0')}
                </span>
              )}
            </div>
            <div className="mx-auto w-full max-w-[36rem] px-10 pb-8 pt-4">
              <ApproachMap me={me} cards={cards} statusOf={statusOf} copy={COPY} photoOf={photoOf} />
            </div>
            <p className="sr-only">{me.spoken}</p>
            <ul className="flex flex-wrap items-center gap-x-5 gap-y-2 border-t border-border px-6 py-3.5 text-xs font-medium text-secondary">
              <li className="flex items-center gap-2">
                <span aria-hidden="true" className="inline-block size-3 rounded-full border border-dashed border-border-strong" />
                {COPY.legendWaiting}
              </li>
              <li className="flex items-center gap-2">
                <span aria-hidden="true" className="inline-block w-5 border-t-2 border-dotted border-accent" />
                {COPY.legendSupply}
              </li>
              <li className="flex items-center gap-2">
                <span aria-hidden="true" className="inline-block size-3 rounded-full border border-border-strong bg-surface-soft" />
                {COPY.elementsTitle}
              </li>
            </ul>
          </div>
          <p className="px-1 text-[13px] leading-5 text-muted">{COPY.teaser}</p>
          {explorationNote !== null && (
            <p className="flex gap-2 px-1 text-[13px] leading-5 text-muted">
              <Spark className="mt-0.5 size-3.5 text-accent" />
              {explorationNote}
            </p>
          )}
        </aside>
      </div>

      <Detail dialog={detail} card={profile} onRequest={() => {
        detail.current?.close();
        confirming.current?.showModal();
      }} />

      <dialog
        ref={confirming}
        aria-labelledby="orbit-matching-confirm"
        className="m-auto w-[min(26rem,calc(100%-2rem))] rounded-[2rem] border border-border bg-surface p-6 text-foreground shadow-[var(--shadow-float)] backdrop:bg-black/50"
      >
        {profile !== null && (
          <div className="flex flex-col gap-4">
            <h2 id="orbit-matching-confirm" className="text-[22px] font-bold leading-snug tracking-[-0.03em]">
              {COPY.confirmTitle(profile.nickname)}
            </h2>
            {COPY.confirmNotes.map((note) => (
              <p key={note} className="text-sm leading-6 text-secondary">
                {note}
              </p>
            ))}
            <div className="mt-1 flex flex-col gap-2.5 sm:flex-row-reverse">
              <button
                type="button"
                className={`${BUTTON.primary} sm:flex-1`}
                onClick={() => {
                  confirming.current?.close();
                  send();
                }}
              >
                <HeartIcon /> {COPY.confirmSend}
              </button>
              <button type="button" className={`${BUTTON.secondary} sm:flex-1`} onClick={() => confirming.current?.close()}>
                {COPY.cancel}
              </button>
            </div>
          </div>
        )}
      </dialog>
    </>
  );
}

/** 두 번째 줄 탭 — 오늘의 인연 / 지나친 인연. 숫자가 탭 안에 선다 */
function ViewTabs({ view, onView, today, passed }: { view: View; onView: (view: View) => void; today: number; passed: number }) {
  const tabs = [
    { key: 'today' as const, label: COPY.tabToday, count: today },
    { key: 'passed' as const, label: COPY.tabPassed, count: passed },
  ];
  return (
    <div className="grid shrink-0 grid-cols-2 gap-1 rounded-full border border-border bg-surface-sunken p-1 sm:inline-grid">
      {tabs.map((tab) => {
        const on = view === tab.key;
        return (
          <button
            key={tab.key}
            type="button"
            aria-pressed={on}
            onClick={() => onView(tab.key)}
            className={`inline-flex min-h-11 items-center justify-center gap-2 whitespace-nowrap rounded-full px-4 text-[15px] font-semibold transition active:scale-[0.97] ${FOCUS} ${
              on ? 'bg-surface text-foreground shadow-[0_1px_2px_rgba(0,0,0,0.08),0_4px_12px_-4px_rgba(0,0,0,0.12)]' : 'text-secondary hover:text-foreground'
            }`}
          >
            {tab.key === 'passed' && <HistoryIcon className={on ? 'text-accent' : ''} />}
            {tab.label}
            <span
              className={`grid min-w-6 place-items-center rounded-full px-1.5 text-xs font-bold tabular-nums leading-6 ${
                on ? 'bg-accent text-on-accent' : 'bg-surface text-muted'
              }`}
            >
              {tab.count}
            </span>
          </button>
        );
      })}
    </div>
  );
}

function CandidateCard({
  card,
  me,
  position,
  total,
  exit,
  onOpen,
  onPass,
  onLike,
}: {
  card: DeckCard;
  me: MeMark;
  position: number;
  total: number;
  exit: 'left' | 'right' | null;
  onOpen: () => void;
  onPass: () => void;
  onLike: () => void;
}) {
  const [offset, setOffset] = useState(0);
  const [dragging, setDragging] = useState(false);
  const start = useRef<number | null>(null);
  /* 끌고 나서 손을 떼면 click 이 한 번 더 온다 — 그 한 번만 삼킨다 */
  const moved = useRef(false);
  const supply = card.highlights[0];
  const supplyElement = isElement(supply?.element) ? supply.element : null;

  const shift = exit === 'left' ? -420 : exit === 'right' ? 420 : offset;
  const stamp = exit ?? (offset < -12 ? 'left' : offset > 12 ? 'right' : null);

  function down(event: PointerEvent<HTMLElement>) {
    if (exit || !event.isPrimary || event.button !== 0) return;
    moved.current = false;
    start.current = event.clientX;
    setDragging(true);
    event.currentTarget.setPointerCapture(event.pointerId);
  }
  function move(event: PointerEvent<HTMLElement>) {
    if (start.current === null) return;
    const x = event.clientX - start.current;
    if (Math.abs(x) > 8) moved.current = true;
    setOffset(x);
  }
  function up() {
    setDragging(false);
    if (start.current === null) return;
    start.current = null;
    if (offset < -85) onPass();
    else if (offset > 85) onLike();
    setOffset(0);
  }

  return (
    <article
      aria-busy={exit !== null}
      onClick={() => {
        if (moved.current) {
          moved.current = false;
          return;
        }
        if (!exit) onOpen();
      }}
      onPointerDown={down}
      onPointerMove={move}
      onPointerUp={up}
      onPointerCancel={() => {
        start.current = null;
        setDragging(false);
        setOffset(0);
      }}
      style={{
        transform: `translateX(${shift}px) rotate(${shift / 24}deg)`,
        transition: dragging ? 'none' : `transform ${exit ? 420 : 260}ms cubic-bezier(.2,.8,.2,1), opacity 420ms`,
        opacity: exit ? 0 : 1,
      }}
      className="relative cursor-grab touch-pan-y select-none overflow-hidden rounded-[2rem] border border-border bg-surface shadow-[var(--shadow-float)] active:cursor-grabbing"
    >
      <div className="relative aspect-[4/5] w-full sm:aspect-[5/6]">
        <Face src={photoOf(card)} name={card.nickname} sizes="(min-width: 640px) 26rem, 100vw" className="absolute inset-0 text-[4rem]" />
        <div aria-hidden="true" className="absolute inset-x-0 bottom-0 h-1/2 bg-gradient-to-t from-black/70 via-black/25 to-transparent" />

        <div className="absolute inset-x-4 top-4 flex items-start justify-between gap-2">
          {card.exploration ? (
            <span className="inline-flex min-h-8 items-center gap-1.5 rounded-full bg-surface/95 px-3 text-[13px] font-bold text-accent shadow-sm">
              <Spark className="size-3.5" /> {COPY.exploration}
            </span>
          ) : (
            <span />
          )}
          <span className="rounded-full bg-black/45 px-2.5 text-[12px] font-semibold leading-7 tabular-nums text-white backdrop-blur-sm">
            {String(position).padStart(2, '0')} / {String(total).padStart(2, '0')}
          </span>
        </div>

        <h3 className="absolute bottom-4 left-5 right-5 truncate text-[2.25rem] font-bold leading-none tracking-[-0.04em] text-white [text-shadow:0_2px_12px_rgba(0,0,0,0.35)]">
          {card.nickname}
        </h3>

        {stamp !== null && (
          <span
            aria-hidden="true"
            style={{ opacity: exit ? 1 : Math.min(Math.abs(offset) / 85, 1) }}
            className={`absolute top-16 rounded-xl border-[3px] px-3 py-1 text-lg font-bold tracking-[-0.02em] ${
              stamp === 'left'
                ? 'right-5 rotate-6 border-white bg-black/35 text-white'
                : 'left-5 -rotate-6 border-accent bg-surface/90 text-accent'
            }`}
          >
            {stamp === 'left' ? COPY.stampPass : COPY.stampLike}
          </span>
        )}
      </div>

      <div className="flex flex-col gap-4 p-5">
        <div className="flex items-start justify-between gap-3">
          <div className="flex min-w-0 flex-col gap-1">
            <span className="text-[12px] font-semibold text-secondary">{COPY.scoreLabel}</span>
            <p className="flex items-baseline gap-1">
              <strong className="text-[3.25rem] font-bold leading-none tracking-[-0.05em] tabular-nums text-accent">{card.previewScore}</strong>
              <span className="whitespace-nowrap text-[15px] font-semibold text-muted">/ 100</span>
            </p>
            <p className="mt-1 text-[17px] font-bold leading-snug tracking-[-0.02em]">{card.verdict}</p>
            <span className="mt-1 self-start rounded-lg bg-surface-soft px-2.5 py-1 text-[12px] font-semibold leading-[1.45] text-secondary">
              {card.balanceLabel}
            </span>
          </div>
          <div className="lg:hidden">
            <MiniOrbit meStem={me.stem} meElement={me.element} supply={supplyElement} face={photoOf(card)} name={card.nickname} />
          </div>
        </div>

        {supply !== undefined && supplyElement !== null ? (
          <SupplyLine element={supplyElement}>{supply.text}</SupplyLine>
        ) : (
          <p className="text-[15px] leading-6 text-foreground">{card.reason}</p>
        )}

        {card.intro !== null ? (
          <p className="line-clamp-3 text-[15px] leading-[1.6] text-secondary">{card.intro}</p>
        ) : (
          <p className="text-[15px] text-muted">{COPY.noIntro}</p>
        )}
      </div>

      {/* 카드를 누르면 열린다 — 이 보이지 않는 단추는 키보드와 화면 낭독기의 몫이다 */}
      <button
        type="button"
        aria-label={`${card.nickname} 님과의 예측 궁합 자세히 보기`}
        disabled={exit !== null}
        className="absolute inset-0 -z-10 focus-visible:z-10 focus-visible:rounded-[2rem] focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-accent"
      />
    </article>
  );
}

/** 보완 기운 한 줄 — 오행 알 + 한글 이름 + 서버가 지은 문장. 색만으로 말하지 않는다 */
function SupplyLine({ element, children }: { element: Element; children: ReactNode }) {
  return (
    <p className={`flex items-center gap-3 rounded-2xl border px-3 py-2.5 ${ELEMENT_TONE[element].border}`}>
      <ElementBead element={element} className="size-9 shrink-0 text-lg" />
      <span className="text-[15px] font-semibold leading-6 text-foreground">{children}</span>
    </p>
  );
}

function EmptyDeck({
  me,
  title,
  line,
  passedCount,
  onPassed,
}: {
  me: MeMark;
  title: string;
  line: string;
  passedCount: number;
  onPassed: () => void;
}) {
  return (
    <div className="flex flex-col items-center gap-4 rounded-[2rem] border border-border bg-surface px-6 py-10 text-center shadow-[var(--shadow-card)]">
      <div aria-hidden="true" className="relative size-40">
        <svg viewBox="0 0 100 100" className="absolute inset-0 size-full">
          <circle cx="50" cy="50" r="47" className="fill-none stroke-border-strong" strokeWidth="1" strokeDasharray="2.5 4" />
          <circle cx="50" cy="50" r="28" className="fill-none stroke-border-strong" strokeWidth="1" />
        </svg>
        <span className={`absolute left-1/2 top-1/2 grid size-14 -translate-x-1/2 -translate-y-1/2 place-items-center rounded-full border-2 bg-surface ${ELEMENT_TONE[me.element].border}`}>
          <span className={`glyph text-[1.8rem] font-bold leading-none dark:brightness-[1.45] ${ELEMENT_TONE[me.element].text}`}>{me.stem}</span>
        </span>
      </div>
      <h3 className="text-[1.5rem] font-bold leading-tight tracking-[-0.04em]">{title}</h3>
      <p className="max-w-[18rem] text-[15px] leading-6 text-secondary">{line}</p>
      {passedCount > 0 && (
        <button type="button" onClick={onPassed} className={`${BUTTON.secondary} mt-1`}>
          <HistoryIcon /> {COPY.tabPassed} {passedCount} <Arrow />
        </button>
      )}
    </div>
  );
}

function PassedView({
  cards,
  onRestore,
  onContinue,
}: {
  cards: readonly DeckCard[];
  onRestore: (card: DeckCard) => void;
  onContinue: () => void;
}) {
  const [selected, setSelected] = useState<DeckCard | null>(null);

  if (selected !== null) {
    const supply = selected.highlights[0];
    const element = isElement(supply?.element) ? supply.element : null;
    return (
      <div className="flex flex-col gap-4 overflow-hidden rounded-[2rem] border border-border bg-surface shadow-[var(--shadow-card)]">
        <div className="relative aspect-[16/11] w-full">
          <Face src={photoOf(selected)} name={selected.nickname} sizes="26rem" className="absolute inset-0 text-[3rem]" />
          <div aria-hidden="true" className="absolute inset-x-0 bottom-0 h-2/3 bg-gradient-to-t from-black/70 to-transparent" />
          <button
            type="button"
            onClick={() => setSelected(null)}
            className={`absolute left-3 top-3 inline-flex min-h-11 items-center gap-1.5 rounded-full bg-surface/95 px-3.5 text-sm font-semibold text-foreground shadow-sm active:scale-95 ${FOCUS}`}
          >
            <BackIcon /> {COPY.passedBack}
          </button>
          <div className="absolute bottom-4 left-5 right-5">
            <p className="text-[11px] font-bold tracking-[0.08em] text-white/85">{COPY.passedDetailOverline}</p>
            <h3 className="mt-1 truncate text-[2rem] font-bold leading-none tracking-[-0.04em] text-white">{selected.nickname}</h3>
          </div>
        </div>
        <div className="flex flex-col gap-4 px-5 pb-5">
          <div className="flex items-baseline gap-3">
            <strong className="text-[2.5rem] font-bold leading-none tracking-[-0.05em] tabular-nums text-accent">{selected.previewScore}</strong>
            <span className="text-[17px] font-bold">{selected.verdict}</span>
          </div>
          {element !== null && supply !== undefined ? <SupplyLine element={element}>{supply.text}</SupplyLine> : <p className="text-[15px] leading-6">{selected.reason}</p>}
          <div className="flex flex-col gap-1">
            <h4 className="text-[13px] font-bold text-muted">{COPY.passedIntroTitle}</h4>
            <p className="text-[15px] leading-[1.6] text-secondary">{selected.intro ?? COPY.noIntro}</p>
          </div>
          <button type="button" onClick={() => onRestore(selected)} className={BUTTON.primary}>
            <HistoryIcon /> {COPY.passedRestore} <Arrow />
          </button>
          <p className="-mt-1 text-center text-[13px] text-muted">{COPY.passedRestoreNote}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4 rounded-[2rem] border border-border bg-surface p-5 shadow-[var(--shadow-card)]">
      <div className="flex flex-col gap-1">
        <p className="text-[11px] font-bold tracking-[0.08em] text-accent">{COPY.passedOverline}</p>
        <h3 className="text-[1.75rem] font-bold leading-tight tracking-[-0.04em]">{COPY.tabPassed}</h3>
        <p className="text-[15px] leading-6 text-secondary">{COPY.passedLead}</p>
      </div>

      {cards.length > 0 ? (
        <>
          <p className="flex items-center justify-between text-[12px] font-semibold text-muted">
            <span>{COPY.passedOrder}</span>
            <span className="tabular-nums">{cards.length} / 20</span>
          </p>
          <ul className="flex flex-col gap-2">
            {cards.map((card) => (
              <li key={card.candidateUserId}>
                <button
                  type="button"
                  onClick={() => setSelected(card)}
                  aria-label={`${card.nickname}, 예측 궁합 ${card.previewScore}점, ${COPY.passedInspect}`}
                  className={`flex w-full items-center gap-3.5 rounded-2xl border border-border bg-surface p-2.5 text-left transition hover:border-accent active:translate-y-px active:bg-surface-sunken ${FOCUS}`}
                >
                  <Face src={photoOf(card)} name={card.nickname} sizes="56px" className="relative size-14 shrink-0 rounded-xl" />
                  <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                    <span className="flex items-center justify-between gap-2">
                      <strong className="truncate text-[17px] font-bold">{card.nickname}</strong>
                      <span className="shrink-0 rounded-full bg-accent-wash px-2 text-[12px] font-bold leading-6 text-accent">
                        {COPY.compatScore} {card.previewScore}점
                      </span>
                    </span>
                    <span className="truncate text-[13px] text-secondary">{card.highlights[0]?.text ?? card.reason}</span>
                    <span className="inline-flex items-center gap-1 text-[13px] font-semibold text-accent">
                      {COPY.passedInspect} <Arrow className="size-3.5" />
                    </span>
                  </span>
                </button>
              </li>
            ))}
          </ul>
        </>
      ) : (
        <div className="flex flex-col items-center gap-2 rounded-2xl bg-surface-soft px-5 py-8 text-center">
          <span className="grid size-12 place-items-center rounded-full border border-dashed border-border-strong text-muted">
            <HistoryIcon />
          </span>
          <h4 className="mt-1 text-[17px] font-bold">{COPY.passedEmptyTitle}</h4>
          <p className="max-w-[17rem] text-sm leading-6 text-secondary">{COPY.passedEmptyLine}</p>
        </div>
      )}

      <button type="button" onClick={onContinue} className={BUTTON.secondary}>
        {COPY.passedContinue} <Arrow />
      </button>
      <p className="text-[12px] leading-5 text-muted">{COPY.passedKeep}</p>
    </div>
  );
}

/** 상세 창 — 사진이 맨 위, 그 아래에서 점수와 이유를 읽는다(PRD §6.1.1) */
function Detail({
  dialog,
  card,
  onRequest,
}: {
  dialog: RefObject<HTMLDialogElement | null>;
  card: DeckCard | null;
  onRequest: () => void;
}) {
  return (
    <dialog
      ref={dialog}
      aria-label={COPY.detailTitle}
      onClick={(event) => {
        if (event.target === event.currentTarget) dialog.current?.close();
      }}
      className="m-auto max-h-[calc(100dvh-2rem)] w-[min(28rem,calc(100%-2rem))] overflow-y-auto rounded-[2rem] border border-border bg-surface p-0 text-foreground shadow-[var(--shadow-float)] backdrop:bg-black/55"
    >
      {card !== null && (
        <>
          <div className="relative aspect-[16/10] w-full">
            <Face src={photoOf(card)} name={card.nickname} sizes="28rem" className="absolute inset-0 text-[3rem]" />
            <div aria-hidden="true" className="absolute inset-x-0 bottom-0 h-2/3 bg-gradient-to-t from-black/70 to-transparent" />
            <strong className="absolute bottom-4 left-5 text-[2rem] font-bold leading-none tracking-[-0.04em] text-white">{card.nickname}</strong>
            <button
              type="button"
              aria-label={COPY.close}
              onClick={() => dialog.current?.close()}
              className={`absolute right-3 top-3 grid size-11 place-items-center rounded-full bg-surface/95 text-foreground shadow-sm active:scale-95 ${FOCUS}`}
            >
              <CloseIcon />
            </button>
          </div>
          <div className="flex flex-col gap-4 p-6">
            <div>
              <p className="text-[11px] font-bold tracking-[0.08em] text-accent">{COPY.detailEyebrow}</p>
              <h2 className="mt-1 text-[1.75rem] font-bold leading-tight tracking-[-0.04em]">{COPY.detailTitle}</h2>
            </div>
            <div className="flex flex-col items-start gap-3 rounded-2xl bg-surface-soft p-4">
              <div>
                <p className="text-[12px] font-semibold text-secondary">나 × {card.nickname} · 예측 궁합</p>
                <p className="mt-1 flex items-baseline gap-1">
                  <strong className="text-[2.75rem] font-bold leading-none tracking-[-0.05em] tabular-nums text-accent">{card.previewScore}</strong>
                  <span className="whitespace-nowrap text-[15px] font-semibold text-muted">/ 100</span>
                </p>
              </div>
              <span className="rounded-lg bg-surface px-2.5 py-1 text-[12px] font-semibold leading-[1.45] text-secondary">{card.balanceLabel}</span>
            </div>
            <h3 className="text-[19px] font-bold leading-snug">{card.verdict}</h3>
            {card.highlights.map((highlight) =>
              isElement(highlight.element) ? (
                <SupplyLine key={highlight.element} element={highlight.element}>
                  {highlight.text}
                </SupplyLine>
              ) : null,
            )}
            <p className="text-[15px] leading-[1.6] text-foreground">{card.reason}</p>
            <p className="text-[13px] leading-5 text-muted">{COPY.teaser}</p>
            <p className="border-t border-border pt-4 text-[15px] leading-[1.6] text-secondary">{card.intro ?? COPY.noIntro}</p>
            <button type="button" onClick={onRequest} className={BUTTON.primary}>
              <HeartIcon /> {COPY.detailRequest}
            </button>
          </div>
        </>
      )}
    </dialog>
  );
}

function Svg({ children, className = 'size-5' }: { children: ReactNode; className?: string }) {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24" className={`${className} shrink-0 fill-none stroke-current`} strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
      {children}
    </svg>
  );
}

const HeartIcon = () => (
  <Svg>
    <path d="M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.7l-1.1-1.1a5.5 5.5 0 0 0-7.8 7.8L12 21l8.8-8.6a5.5 5.5 0 0 0 0-7.8Z" />
  </Svg>
);
const CloseIcon = () => (
  <Svg>
    <path d="m6 6 12 12M18 6 6 18" />
  </Svg>
);
const UndoIcon = () => (
  <Svg>
    <path d="M4 10a8 8 0 1 1 1 8M4 4v6h6" />
  </Svg>
);
const BackIcon = () => (
  <Svg className="size-4">
    <path d="M19 12H5m5-5-5 5 5 5" />
  </Svg>
);
const HistoryIcon = ({ className = '' }: { className?: string }) => (
  <Svg className={`size-[1.1rem] ${className}`}>
    <path d="M3 10a9 9 0 1 1 2 8M3 4v6h6" />
    <path d="M12 7v5l3 2" />
  </Svg>
);
