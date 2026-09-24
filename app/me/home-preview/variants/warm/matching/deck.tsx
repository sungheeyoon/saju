'use client';

import Image from 'next/image';
import Link from 'next/link';
import { useRef, useState, type PointerEvent, type ReactNode } from 'react';

import { MATCH_PILLARS_DISCLOSURE } from '@/src/lib/consent/notice';
import { DISCOVERY_EMPTY } from '@/src/lib/discovery';
import { activityText } from '@/src/lib/presence';
import { initialOf } from '@/src/lib/profile';
import { REQUEST_RESERVES_NOTE } from '@/src/lib/reading/notes';
import { ELEMENT_PICTURE_KO, ELEMENTS, type Element } from '@/src/lib/saju';

import type { DeckCard } from '../../../../matching/matching-experience';
import { previewHref } from '../../../shared/preview-href';
import { ON_TILE, PRIMARY, SECONDARY, TERTIARY } from '../buttons';
import { rounded } from '../fonts';
import { ELEMENT_CLASS, ElementSymbol, Icon, NONE_CLASS, type IconName } from '../symbols';

/*
  **덱 — 한 번에 한 사람.** 실제 화면(`matching-experience.tsx`)이 하는 일을 모양만 새로 그린다: 넘기기 · 궁합 요청(확인 창을
  거친다) · 실행 취소 · 지나친 인연에서 다시 만나보기. 서버는 부르지 않는다 — 미리보기 덱과 같은 약속이다.

  보기는 둘이다: 「오늘의 인연」 카드와 「지나친 인연」 모음. 실제 화면은 오른쪽 위 단추가 미닫이 패널을 여는데,
  여기서는 제목 아래 알약 둘로 나란히 세웠다 — 지나친 사람이 몇 명인지가 늘 보이고, 한 번 누르면 간다.
*/

const SWIPE_AT = 90;
const EXIT_MS = 320;

type View = 'today' | 'passed';

const elementOf = (card: DeckCard): Element | null =>
  ELEMENTS.find((element) => element === card.highlights[0]?.element) ?? null;

const toneOf = (card: DeckCard): string => {
  const element = elementOf(card);
  return element === null ? NONE_CLASS : ELEMENT_CLASS[element];
};

/** 예시면 그 파일 — 실제 후보는 우리 사진 라우트. 사진이 없으면 이름 첫 글자 */
const photoOf = (card: DeckCard): string | null =>
  card.photoUrl ?? (card.hasPhoto ? `/me/photo/${card.candidateUserId}` : null);

export function Deck({
  cards,
  teaser,
  explorationNote,
  heading,
}: {
  cards: readonly DeckCard[];
  teaser: string;
  explorationNote: string | null;
  heading: ReactNode;
}) {
  const [queue, setQueue] = useState<readonly DeckCard[]>(cards);
  const [passed, setPassed] = useState<readonly DeckCard[]>([]);
  const [done, setDone] = useState<Readonly<Record<string, 'passed' | 'sent'>>>({});
  const [lastPassed, setLastPassed] = useState<DeckCard | null>(null);
  const [view, setView] = useState<View>('today');
  const [offset, setOffset] = useState(0);
  const [dragging, setDragging] = useState(false);
  const [exit, setExit] = useState<'left' | 'right' | null>(null);
  const [said, setSaid] = useState('');
  const start = useRef<number | null>(null);
  const confirming = useRef<HTMLDialogElement>(null);

  const current = queue[0] ?? null;
  const upcoming = queue.slice(1, 3);

  function leave(direction: 'left' | 'right', card: DeckCard, announce: string) {
    setExit(direction);
    setOffset(direction === 'left' ? -520 : 520);
    setSaid(announce);
    window.setTimeout(() => {
      setQueue((before) => before.filter((one) => one.candidateUserId !== card.candidateUserId));
      setExit(null);
      setOffset(0);
    }, EXIT_MS);
  }

  function pass() {
    if (current === null || exit !== null) return;
    setPassed((before) => [current, ...before.filter((one) => one.candidateUserId !== current.candidateUserId)]);
    setDone((before) => ({ ...before, [current.candidateUserId]: 'passed' }));
    setLastPassed(current);
    leave('left', current, `${current.nickname} 님을 지나친 인연에 두었어요.`);
  }

  function send() {
    if (current === null || exit !== null) return;
    confirming.current?.close();
    setDone((before) => ({ ...before, [current.candidateUserId]: 'sent' }));
    setLastPassed(null);
    leave('right', current, `미리보기예요 — ${current.nickname} 님에게 요청은 전송되지 않았어요.`);
  }

  /** 지나친 인연에서 꺼낸 사람은 카드 맨 앞으로 — 보던 카드는 다음 차례로 남는다 */
  function restore(card: DeckCard) {
    setPassed((before) => before.filter((one) => one.candidateUserId !== card.candidateUserId));
    setQueue((before) => [card, ...before.filter((one) => one.candidateUserId !== card.candidateUserId)]);
    setDone((before) => {
      const next = { ...before };
      delete next[card.candidateUserId];
      return next;
    });
    setLastPassed(null);
    setView('today');
    setSaid(`${card.nickname} 님을 카드 맨 앞으로 가져왔어요.`);
  }

  function down(event: PointerEvent<HTMLDivElement>) {
    if (exit !== null || !event.isPrimary || event.button !== 0) return;
    start.current = event.clientX;
    setDragging(true);
    event.currentTarget.setPointerCapture(event.pointerId);
  }
  function move(event: PointerEvent<HTMLDivElement>) {
    if (start.current === null) return;
    setOffset(event.clientX - start.current);
  }
  function up() {
    setDragging(false);
    if (start.current === null) return;
    start.current = null;
    if (offset < -SWIPE_AT) return pass();
    setOffset(0);
    if (offset > SWIPE_AT) confirming.current?.showModal();
  }

  const total = cards.length;
  const seen = Object.keys(done).length;

  return (
    <>
      <div className="flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
        {heading}
        {total > 0 && (
          <div className="flex flex-col gap-2 sm:items-end">
            <p className="text-[13px] font-semibold text-secondary">
              나와 맞는 오늘의 인연{' '}
              <span className="tabular-nums text-foreground">
                {String(Math.min(seen + 1, total)).padStart(2, '0')} / {String(total).padStart(2, '0')}
              </span>
            </p>
            <Progress cards={cards} currentId={current?.candidateUserId ?? null} done={done} />
          </div>
        )}
      </div>

      <div role="group" aria-label="보기" className="-mt-1 grid grid-cols-2 gap-1 self-start rounded-full bg-[var(--card)] p-1 ring-1 ring-[var(--line)] sm:-mt-3">
        <ViewButton on={view === 'today'} onClick={() => setView('today')} icon="heart" label="오늘의 인연" count={queue.length} />
        <ViewButton on={view === 'passed'} onClick={() => setView('passed')} icon="undo" label="지나친 인연" count={passed.length} />
      </div>

      {view === 'passed' ? (
        <Passed cards={passed} onRestore={restore} onBack={() => setView('today')} />
      ) : total === 0 ? (
        <NoneToday />
      ) : current === null ? (
        <AllMet passedCount={passed.length} onPassed={() => setView('passed')} />
      ) : (
        <article
          key={current.candidateUserId}
          aria-label={`${current.nickname} 님`}
          className={`${toneOf(current)} grid gap-5 lg:grid-cols-[minmax(0,5fr)_minmax(0,6fr)] lg:gap-x-10 lg:gap-y-6`}
        >
          {/* 사진 — 뒤에 다음 사람들의 색이 한 장씩 비친다 */}
          <div className="relative order-1 px-2 pt-2 lg:order-none lg:col-start-1 lg:row-start-1 lg:row-span-5 lg:self-start lg:px-3 lg:pt-3">
            {upcoming.map((card, at) => (
              <span
                key={card.candidateUserId}
                aria-hidden="true"
                className={`${toneOf(card)} absolute inset-x-5 bottom-3 top-4 rounded-[2rem] bg-[var(--tile)] ring-1 ring-[var(--line)] ${
                  at === 0 ? 'translate-x-1.5 rotate-[4.5deg]' : '-translate-x-1 -rotate-[3.5deg]'
                }`}
              />
            ))}
            <div
              onPointerDown={down}
              onPointerMove={move}
              onPointerUp={up}
              onPointerCancel={() => {
                start.current = null;
                setDragging(false);
                setOffset(0);
              }}
              style={{
                transform: `translateX(${offset}px) rotate(${offset / 24}deg)`,
                transition: dragging ? 'none' : `transform ${EXIT_MS}ms cubic-bezier(.2,.7,.3,1), opacity ${EXIT_MS}ms`,
                opacity: exit === null ? 1 : 0,
              }}
              className="relative aspect-[4/5] cursor-grab touch-pan-y select-none overflow-hidden rounded-[2rem] bg-[var(--tile)] shadow-[0_24px_48px_-24px_rgba(60,48,30,0.55)] active:cursor-grabbing"
            >
              {photoOf(current) !== null ? (
                <Image
                  src={photoOf(current) ?? ''}
                  alt=""
                  fill
                  sizes="(min-width: 1024px) 460px, 100vw"
                  draggable={false}
                  className="object-cover"
                  loading="eager"
                />
              ) : (
                <span aria-hidden="true" className={`${rounded.className} absolute inset-0 grid place-items-center text-[7rem] text-[var(--ink)]`}>
                  {initialOf(current.nickname)}
                </span>
              )}

              {current.exploration && (
                <span className="absolute left-4 top-4 inline-flex min-h-8 items-center gap-1.5 rounded-full bg-[var(--card)] px-3 text-[13px] font-semibold text-foreground shadow-sm">
                  <Icon name="spark" className="size-4 text-[var(--ink)]" />
                  색다른 인연
                </span>
              )}

              <Stamp offset={offset} exit={exit} />

              {/* 폰에서는 이름이 사진 아래 끝에 선다 — 넓은 화면은 오른쪽 칸이 든다 */}
              <div className="absolute inset-x-0 bottom-0 flex items-end justify-between gap-3 bg-gradient-to-t from-black/65 via-black/25 to-transparent px-5 pb-5 pt-16 text-white lg:hidden">
                <div className="min-w-0">
                  <p className={`${rounded.className} truncate text-[2.25rem] leading-tight`}>{current.nickname}</p>
                  {current.activity != null && <p className="text-[13px] font-semibold text-white/85">{activityText(current.activity)}</p>}
                </div>
              </div>
            </div>
          </div>

          {/* 이름 — 넓은 화면에서만. 폰은 사진 위 */}
          <header className="hidden lg:col-start-2 lg:row-start-1 lg:flex lg:flex-col lg:gap-1 lg:pt-4">
            <h3 className={`${rounded.className} text-[3rem] leading-[1.1] tracking-[-0.02em] text-foreground`}>{current.nickname}</h3>
            {current.activity != null && <p className="text-[13px] font-semibold text-secondary">{activityText(current.activity)}</p>}
          </header>

          {/* 누를 것 — 폰에서는 사진 바로 아래, 넓은 화면은 칸의 맨 끝 */}
          <div className="order-2 flex flex-col gap-3 lg:order-none lg:col-start-2 lg:row-start-3">
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={() => confirming.current?.showModal()}
                disabled={exit !== null}
                className={`${PRIMARY} order-3 min-h-14 flex-1 text-[17px]`}
              >
                <Icon name="heart" className="size-[22px]" />
                궁합 요청
              </button>
              <button
                type="button"
                onClick={pass}
                disabled={exit !== null}
                aria-label="다음 인연으로 지나가기"
                className="order-2 grid size-14 shrink-0 place-items-center rounded-full bg-[var(--card)] text-foreground shadow-[0_6px_16px_-10px_rgba(60,48,30,0.6)] ring-1 ring-[var(--line)] hover:ring-[color-mix(in_srgb,var(--foreground)_35%,transparent)] active:scale-95 focus-visible:outline-[3px] focus-visible:outline-offset-2"
              >
                <CloseIcon />
              </button>
              <button
                type="button"
                onClick={() => lastPassed !== null && restore(lastPassed)}
                disabled={lastPassed === null || exit !== null}
                aria-label="이전 인연으로 되돌리기"
                className="order-1 grid size-11 shrink-0 place-items-center rounded-full text-secondary ring-1 ring-[var(--line)] hover:text-foreground active:scale-95 disabled:opacity-35 focus-visible:outline-[3px] focus-visible:outline-offset-2"
              >
                <UndoIcon />
              </button>
            </div>
            <p className="hidden text-center text-[12px] font-medium text-secondary sm:block lg:text-left">
              ← 다음 인연 · 상세 궁합이 궁금하다면 하트 →
            </p>
          </div>

          {/* 점수 — 숫자가 이 칸의 주인공 */}
          <section aria-label="나와의 예측 궁합 점수" className="order-3 flex flex-col gap-2 lg:order-none lg:col-start-2 lg:row-start-2">
            <p className="text-[13px] font-semibold text-secondary">나와의 예측 궁합 점수</p>
            <div className="flex flex-wrap items-end gap-x-4 gap-y-1">
              <p className="flex items-baseline gap-1 text-foreground">
                <strong className="text-[4rem] font-bold leading-none tracking-[-0.04em] tabular-nums">{current.previewScore}</strong>
                <span className="text-[15px] font-semibold text-secondary">/ 100</span>
              </p>
              <p className={`${rounded.className} pb-1.5 text-[1.375rem] leading-snug text-[var(--ink)]`}>{current.verdict}</p>
            </div>
            <p className="max-w-prose text-[12px] leading-5 text-secondary">{teaser}</p>
          </section>

          {/* 채워 주는 기운 — 상징 + 이름 + 문장. 색 혼자 말하지 않는다 */}
          <section aria-labelledby="warm-supply" className="order-4 flex flex-col gap-3 rounded-[1.75rem] bg-[var(--tile)] p-5 lg:order-none lg:col-start-2 lg:row-start-4">
            <h4 id="warm-supply" className="text-[13px] font-bold text-[var(--ink)]">
              이 사람이 채워 주는 기운
            </h4>
            {current.highlights.length > 0 ? (
              <ul className="flex flex-col gap-2">
                {current.highlights.map((highlight) => (
                  <Supply key={highlight.element} element={highlight.element} text={highlight.text} />
                ))}
              </ul>
            ) : (
              <p className="text-[15px] leading-6 text-foreground">{current.reason}</p>
            )}
            <p className="text-[13px] leading-5 text-secondary">{current.balanceLabel}</p>
            {current.exploration && explorationNote !== null && (
              <p className="flex gap-1.5 border-t border-[color-mix(in_srgb,var(--ink)_15%,transparent)] pt-3 text-[12px] leading-5 text-secondary">
                <Icon name="spark" className="mt-0.5 size-3.5 text-[var(--ink)]" />
                {explorationNote}
              </p>
            )}
          </section>

          {/* 소개 — 크림색 편지지. 비었으면 비었다고 말한다 */}
          <figure className="order-5 flex flex-col gap-3 rounded-[1.75rem] bg-[var(--cream)] p-6 lg:order-none lg:col-start-2 lg:row-start-5">
            <Icon name="quote" className="size-5 text-[var(--cream-ink)]" />
            {current.intro !== null ? (
              <blockquote className={`${rounded.className} text-[1.1875rem] leading-[1.75] text-foreground`}>{current.intro}</blockquote>
            ) : (
              <p className="text-[15px] font-medium text-secondary">자기소개 없음</p>
            )}
            <figcaption className={`${rounded.className} self-end text-[1.0625rem] text-[var(--cream-ink)]`}>— {current.nickname}</figcaption>
          </figure>
        </article>
      )}

      <Toast said={said} undo={lastPassed !== null && view === 'today' ? () => restore(lastPassed) : null} />

      <p className="text-center text-[12px] text-secondary">디자인 확인용 예시 프로필이며, 요청은 전송되지 않아요.</p>

      <dialog
        ref={confirming}
        aria-labelledby="warm-confirm"
        onClick={(event) => {
          if (event.target === event.currentTarget) confirming.current?.close();
        }}
        className="m-auto w-[min(100%-2rem,28rem)] rounded-[2rem] bg-[var(--card)] p-0 text-foreground shadow-[0_30px_60px_-20px_rgba(0,0,0,0.5)] backdrop:bg-black/40 max-sm:mb-4"
      >
        {current !== null && (
          <div className={`${toneOf(current)} flex flex-col gap-4 p-6`}>
            <div className="flex items-center gap-3">
              <span className="relative size-14 shrink-0 overflow-hidden rounded-full bg-[var(--tile)] ring-2 ring-[var(--tile)]">
                {photoOf(current) !== null && <Image src={photoOf(current) ?? ''} alt="" fill sizes="56px" className="object-cover" />}
              </span>
              <span className="grid size-10 place-items-center rounded-full bg-[var(--tile)]">
                <ElementSymbol element={elementOf(current)} className="size-6" />
              </span>
            </div>
            <h3 id="warm-confirm" className={`${rounded.className} text-[1.5rem] leading-[1.35]`}>
              {current.nickname} 님에게 상세 궁합을 요청할까요?
            </h3>
            <div className="flex flex-col gap-2 text-[14px] leading-6 text-secondary">
              <p>{REQUEST_RESERVES_NOTE}</p>
              <p>{MATCH_PILLARS_DISCLOSURE}</p>
            </div>
            <div className="mt-1 flex flex-col gap-2 sm:flex-row-reverse">
              <button type="button" onClick={send} className={`${PRIMARY} sm:flex-1`}>
                <Icon name="heart" className="size-[18px]" />
                요청 보내기
              </button>
              <button type="button" onClick={() => confirming.current?.close()} className={`${SECONDARY} sm:flex-1`}>
                취소
              </button>
            </div>
          </div>
        )}
      </dialog>
    </>
  );
}

function ViewButton({ on, onClick, icon, label, count }: { on: boolean; onClick: () => void; icon: IconName | 'undo'; label: string; count: number }) {
  return (
    <button
      type="button"
      aria-pressed={on}
      onClick={onClick}
      className={`inline-flex min-h-11 items-center justify-center gap-2 rounded-full px-4 text-[15px] font-semibold active:scale-[0.97] ${
        on ? 'bg-[var(--btn)] text-[var(--on-btn)]' : 'text-secondary hover:bg-surface-soft hover:text-foreground'
      }`}
    >
      {icon === 'undo' ? <UndoIcon className="size-[18px]" /> : <Icon name={icon} className="size-[18px]" />}
      {label}
      <span
        className={`grid h-5 min-w-5 place-items-center rounded-full px-1.5 text-[11px] font-bold tabular-nums ${
          on ? 'bg-[color-mix(in_srgb,var(--on-btn)_20%,transparent)]' : 'bg-surface-soft text-foreground'
        }`}
      >
        {count}
        <span className="sr-only">명</span>
      </span>
    </button>
  );
}

/** 오늘 덱의 차례 — 얼굴 대신 그 사람이 채워 주는 기운의 상징으로. 지나간 사람은 흐려진다 */
function Progress({
  cards,
  currentId,
  done,
}: {
  cards: readonly DeckCard[];
  currentId: string | null;
  done: Readonly<Record<string, 'passed' | 'sent'>>;
}) {
  const seen = Object.keys(done).length;
  return (
    <ol aria-label={`${cards.length}명 중 ${seen}명 확인`} className="flex gap-1.5">
      {cards.map((card) => {
        const now = card.candidateUserId === currentId;
        const gone = done[card.candidateUserId] !== undefined;
        return (
          <li
            key={card.candidateUserId}
            className={`${toneOf(card)} grid size-8 place-items-center rounded-full bg-[var(--tile)] ${
              now ? 'ring-2 ring-foreground ring-offset-2 ring-offset-background' : ''
            } ${gone ? 'opacity-40' : ''}`}
          >
            <ElementSymbol element={elementOf(card)} className="size-[18px]" />
          </li>
        );
      })}
    </ol>
  );
}

function Supply({ element, text }: { element: string; text: string }) {
  const known = ELEMENTS.find((one) => one === element) ?? null;
  return (
    <li className="flex items-center gap-3 rounded-[1.25rem] bg-[color-mix(in_srgb,var(--card)_72%,transparent)] p-3">
      <span className="grid size-12 shrink-0 place-items-center rounded-full bg-[var(--tile)] ring-1 ring-[color-mix(in_srgb,var(--ink)_20%,transparent)]">
        <ElementSymbol element={known} className="size-7" />
      </span>
      <span className="flex min-w-0 flex-col">
        {known !== null && <span className={`${rounded.className} text-[1.25rem] leading-tight text-[var(--ink)]`}>{ELEMENT_PICTURE_KO[known]}</span>}
        <span className="text-[14px] leading-5 text-foreground">{text}</span>
      </span>
    </li>
  );
}

/** 끄는 동안 사진 위에 뜨는 말 — 실제 화면과 같은 두 마디 */
function Stamp({ offset, exit }: { offset: number; exit: 'left' | 'right' | null }) {
  const left = offset < 0 || exit === 'left';
  const strength = exit !== null ? 1 : Math.min(Math.abs(offset) / SWIPE_AT, 1);
  if (strength === 0) return null;
  return (
    <span
      aria-hidden="true"
      style={{ opacity: strength }}
      className={`absolute top-6 rounded-full px-4 py-2 text-[15px] font-bold shadow-lg ${
        left ? 'right-5 rotate-[8deg] bg-[var(--card)] text-foreground' : 'left-5 -rotate-[8deg] bg-[var(--btn)] text-[var(--on-btn)]'
      }`}
    >
      {left ? '다음 인연' : '궁합이 궁금해요'}
    </span>
  );
}

function Toast({ said, undo }: { said: string; undo: (() => void) | null }) {
  return (
    <div role="status" className="min-h-0 empty:hidden">
      {said !== '' && (
        <p className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1 rounded-[1.25rem] bg-[var(--card)] px-4 py-2 text-[14px] font-medium text-foreground ring-1 ring-[var(--line)]">
          <span className="py-2">{undo !== null ? '지나친 인연에 보관했어요' : said}</span>
          {undo !== null && (
            <button type="button" onClick={undo} className={TERTIARY}>
              실행 취소
            </button>
          )}
        </p>
      )}
    </div>
  );
}

/** 지나친 인연 — 사진 · 이름 · 점수 · 채워 주는 기운. 누르면 카드 맨 앞으로 */
function Passed({ cards, onRestore, onBack }: { cards: readonly DeckCard[]; onRestore: (card: DeckCard) => void; onBack: () => void }) {
  return (
    <section aria-labelledby="warm-passed" className="flex flex-col gap-5">
      <div className="flex flex-col gap-1">
        <h3 id="warm-passed" className={`${rounded.className} flex items-baseline gap-2 text-[1.5rem] leading-8 text-foreground`}>
          지나친 인연
          {cards.length > 0 && <span className="font-sans text-[13px] font-semibold tabular-nums text-secondary">{cards.length} / 20</span>}
        </h3>
        {cards.length > 0 && <p className="text-[15px] text-secondary">잠깐 지나쳤어도, 다시 궁금해질 수 있으니까요.</p>}
      </div>

      {cards.length === 0 ? (
        <div className="flex flex-col items-start gap-3 rounded-[1.75rem] border-2 border-dashed border-[var(--line)] p-6">
          <span className="grid size-12 place-items-center rounded-full bg-[var(--cream)] text-[var(--cream-ink)]">
            <UndoIcon />
          </span>
          <h4 className={`${rounded.className} text-[1.25rem] text-foreground`}>지나친 인연이 여기에 모여요</h4>
          <p className="text-[15px] leading-6 text-secondary">다시 궁금해진 사람을 살펴보고, 한 번 더 알아갈 수 있는 자리예요.</p>
        </div>
      ) : (
        <ul className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-4">
          {cards.map((card) => (
            <li key={card.candidateUserId} className={`${toneOf(card)} flex flex-col overflow-hidden rounded-[1.5rem] bg-[var(--tile)]`}>
              <span className="relative aspect-square">
                {photoOf(card) !== null ? (
                  <Image src={photoOf(card) ?? ''} alt="" fill sizes="(min-width: 1024px) 240px, 50vw" className="object-cover" />
                ) : (
                  <span aria-hidden="true" className={`${rounded.className} absolute inset-0 grid place-items-center text-[3rem] text-[var(--ink)]`}>
                    {initialOf(card.nickname)}
                  </span>
                )}
                <span className="absolute bottom-2 left-2 grid size-9 place-items-center rounded-full bg-[var(--tile)] ring-2 ring-[var(--card)]">
                  <ElementSymbol element={elementOf(card)} className="size-5" />
                </span>
              </span>
              <span className="flex flex-1 flex-col gap-2 p-3">
                <span className="flex items-baseline justify-between gap-2">
                  <span className={`${rounded.className} truncate text-[1.25rem] text-foreground`}>{card.nickname}</span>
                  <span className="shrink-0 text-[13px] font-bold tabular-nums text-[var(--ink)]">궁합 {card.previewScore}점</span>
                </span>
                <span className="line-clamp-2 text-[13px] leading-5 text-secondary">{card.highlights[0]?.text ?? card.reason}</span>
                <button type="button" onClick={() => onRestore(card)} className={`${ON_TILE} mt-auto w-full`}>
                  <UndoIcon className="size-4" />
                  다시 만나보기
                </button>
              </span>
            </li>
          ))}
        </ul>
      )}

      <div className="flex flex-col items-start gap-1">
        <button type="button" onClick={onBack} className={TERTIARY}>
          오늘의 인연 계속 보기
          <Icon name="arrow" className="size-4" />
        </button>
        <p className="text-[12px] text-secondary">미리보기에서는 실제 보관 기록을 바꾸지 않아요.</p>
      </div>
    </section>
  );
}

/** 덱을 다 넘긴 날 — 실제 화면의 두 문장 */
function AllMet({ passedCount, onPassed }: { passedCount: number; onPassed: () => void }) {
  return (
    <section className="flex flex-col items-start gap-4 rounded-[2rem] bg-[var(--cream)] p-6 sm:p-10">
      <FiveSymbols />
      <h3 className={`${rounded.className} text-[1.625rem] leading-[1.35] text-foreground sm:text-[2rem]`}>오늘의 인연을 모두 만났어요</h3>
      <p className="max-w-prose text-[15px] leading-6 text-secondary">지나친 인연을 다시 살펴보거나, 나중에 새로운 인연을 확인해 보세요.</p>
      {passedCount > 0 && (
        <button type="button" onClick={onPassed} className={SECONDARY}>
          <UndoIcon className="size-[18px]" />
          지나친 인연
        </button>
      )}
    </section>
  );
}

/** 오늘 소개할 사람이 없다 — 이유 한 줄, 그동안 할 수 있는 것 둘 */
function NoneToday() {
  return (
    <section className="flex flex-col gap-6 rounded-[2rem] bg-[var(--cream)] p-6 sm:p-10">
      <FiveSymbols />
      <div className="flex flex-col gap-2">
        <h3 className={`${rounded.className} text-[1.625rem] leading-[1.35] text-foreground sm:text-[2rem]`}>{DISCOVERY_EMPTY.title}</h3>
        <p className="text-[15px] leading-6 text-secondary">{DISCOVERY_EMPTY.line}</p>
      </div>
      <nav aria-label="더 해 보기" className="grid gap-2 sm:grid-cols-2">
        {MEANWHILE.map((link) => (
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
    </section>
  );
}

const MEANWHILE: readonly { href: string; label: string; icon: IconName; element: Element }[] = [
  { href: '/', label: '다른 사람 사주 보기', icon: 'search', element: '水' },
  { href: '/compat', label: '궁합 보러 가기', icon: 'heart', element: '火' },
];

function FiveSymbols() {
  return (
    <span aria-hidden="true" className="flex -space-x-2">
      {ELEMENTS.map((element) => (
        <span key={element} className={`${ELEMENT_CLASS[element]} grid size-11 place-items-center rounded-full bg-[var(--tile)] ring-[3px] ring-[var(--cream)]`}>
          <ElementSymbol element={element} className="size-6" />
        </span>
      ))}
    </span>
  );
}

function CloseIcon() {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24" className="size-6 fill-none stroke-current" strokeWidth="2.2" strokeLinecap="round">
      <path d="m6.5 6.5 11 11M17.5 6.5l-11 11" />
    </svg>
  );
}

function UndoIcon({ className = 'size-5' }: { className?: string }) {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24" className={`${className} shrink-0 fill-none stroke-current`} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M9 14 4.5 9.5 9 5" />
      <path d="M4.5 9.5H14a5.5 5.5 0 0 1 0 11h-3" />
    </svg>
  );
}
