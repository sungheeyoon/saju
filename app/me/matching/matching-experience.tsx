'use client';

import Link from 'next/link';
import { useEffect, useReducer, useRef, useState, useTransition, type PointerEvent, type ReactNode } from 'react';

import { MATCH_PILLARS_DISCLOSURE } from '@/src/lib/consent/notice';
import { DISCOVERY_EMPTY } from '@/src/lib/discovery';
import { activityText, type ActivityBand } from '@/src/lib/presence';
import { initialOf } from '@/src/lib/profile';
import { REQUEST_RESERVES_NOTE } from '@/src/lib/reading/notes';
import { ELEMENT_PICTURE_KO, ELEMENTS, type Element } from '@/src/lib/saju';

import { elementScope } from '../../element-tone';
import { BUTTON_PRIMARY, BUTTON_SECONDARY, BUTTON_TERTIARY } from '../../ui/buttons';
import { ElementSymbol } from '../../ui/element-symbol';
import { Icon, type IconName } from '../../ui/icon';
import { TYPE_DISPLAY, TYPE_META } from '../../ui/surfaces';
import { passCandidate, requestMatch, restorePassed } from '../discovery/actions';
import { RefreshBoard } from '../discovery/manage';
import { announceIfMoved } from '../reading/credits-signal';
import { deckReducer, PASSED_LIMIT } from './deck-state';
import type { MeMark } from './me-mark';
import styles from './orbit.module.css';
import { ApproachMap, Legend, QuietOrbit, supplyOf, type MapStatus } from './orbit-map';
import { PassedConnections, UndoIcon } from './passed-connections';

/**
 * 덱으로 내려오는 후보 한 장 — **`CandidateCard` 에서 증표만 뗀 것**이다.
 *
 * 칸을 늘리지 않는다. 카드가 무엇을 말할 수 있는지는 `candidates.ts` 가 정하고,
 * 여기서 더할 수 있으면 자르는 자리가 둘이 된다.
 */
export type DeckCard = {
  readonly candidateUserId: string;
  readonly nickname: string;
  readonly intro: string | null;
  readonly hasPhoto: boolean;
  /** 예시 카드만 쓴다 — 실제 후보는 비워 두고 `/me/photo/{id}` 로 받는다 */
  readonly photoUrl?: string | null;
  readonly exploration: boolean;
  /** 접속 상태의 구간 — 후보 목록의 카드에만 온다. 지나친 인연과 예시 카드는 비운다(PRD §7.2) */
  readonly activity?: ActivityBand | null;
  readonly previewScore: number;
  readonly verdict: string;
  readonly reason: string;
  readonly balanceLabel: string;
  readonly highlights: readonly { readonly element: string; readonly text: string }[];
};

/** 예시면 그 파일, 아니면 우리 라우트 — 사진이 없으면 이름의 첫 글자가 선다 */
export const photoOf = (card: DeckCard): string | null =>
  card.photoUrl ?? (card.hasPhoto ? `/me/photo/${card.candidateUserId}` : null);

/**
 * 후보의 얼굴 한 자리 — 덱 · 지도 · 확인 창 · 지나친 인연이 모두 이것을 쓴다.
 *
 * **사진은 선택이다**(§5.1). 안 올린 사람 자리에는 이름의 첫 글자가 선다 — 빈 자리가 아니라 그 사람의 자리로
 * 보이게. 부모가 크기와 모양을 정하고, 이것은 그 안을 채운다.
 */
export function CandidatePhoto({ card, initialClass = 'text-[1.2em]' }: { card: DeckCard; initialClass?: string }) {
  const src = photoOf(card);
  if (src === null) {
    return (
      <span aria-hidden="true" className={`font-rounded absolute inset-0 grid place-items-center text-[var(--ink)] ${initialClass}`}>
        {initialOf(card.nickname)}
      </span>
    );
  }
  return (
    // eslint-disable-next-line @next/next/no-img-element -- 우리 라우트가 로그인한 사람에게만 바이트를 내주므로 최적화기가 받아 갈 원본이 없다
    <img src={src} alt="" draggable={false} className="pointer-events-none absolute inset-0 size-full object-cover object-[50%_28%]" />
  );
}

const faceOf = (card: DeckCard) => <CandidatePhoto card={card} />;

const elementOf = (card: DeckCard): Element | null => supplyOf(card);

// 고른 것을 읽을 시간을 주고 나서 카드가 떠난다.
const CHOICE_HOLD_MS = 700;
const CARD_EXIT_MS = 550;
const SWIPE_AT = 85;
const EMPTY_CARDS: readonly DeckCard[] = [];
/** 사진 · 단추의 그림자 — 새 색을 짓지 않고 글자색을 옅게 쓴다 */
const SOFT_SHADOW = 'color-mix(in srgb, var(--foreground) 45%, transparent)';
/** 이보다 긴 소개는 세 줄로 접어 두고 「더 보기」로 편다 — 소개가 카드를 늘어뜨리지 않게 */
const LETTER_FOLD_AT = 90;

type View = 'today' | 'passed';

/*
  **오늘의 인연 — 한 사람을 한 장의 편지처럼**(부드러움, ADR 0109).

  넓은 화면은 두 열이다. **왼쪽 = 그 사람**: 4:5 세로 사진(이름은 사진 아래 끝) → 큰 점수와 판정 → 누를 것 → 이유 한 줄 →
  접힌 편지. **오른쪽 = 「내 궤도로 다가오는 인연」**: 지도와, 그 사람이 채워 주는 기운을 글로 말하는 띠. 글을 짧게 두어
  사진의 비율이 카드를 정하고, 두 열의 윗선 · 아랫선이 맞는다.

  폰은 한 열이다 — 6:5 사진(이름 · 점수 숫자) → 누를 것 → 해돋이 띠 → 판정 · 이유 → 기운 → 편지. 사진 · 점수 ·
  「궁합 요청」이 첫 화면 안에 든다. 「참고 점수」라는 고지는 카드마다 되풀이하지 않고 목록 머리 한 줄이 든다(PRD §6.1).

  동작은 옛 덱 그대로다: 넘기면 서버 보관함에 적고(`passCandidate`), 요청은 확인 창을 지나야 나가며(`requestMatch`),
  되돌리기와 지나친 인연의 「다시 만나보기」는 같은 복원 경로를 쓴다(`restorePassed`). 미리보기(`preview`)는 셋 다
  서버를 부르지 않는다.
*/
export function MatchingExperience({
  cards,
  me,
  teaser,
  notice,
  explorationNote,
  waitSeconds,
  passed: passedFromServer = EMPTY_CARDS,
  preview = false,
}: {
  cards: readonly DeckCard[];
  /** 지도의 가운데 — 내 일간과 오행 다섯 */
  me: MeMark;
  /** 서버가 든 보관함 — 새로 고쳐도 남는다 */
  passed?: readonly DeckCard[];
  teaser: string;
  notice: string | null;
  explorationNote: string | null;
  waitSeconds: number;
  /** 디자인 확인용 — **요청이 나가지 않고**, 목록을 건드리는 누름도 서지 않는다 */
  preview?: boolean;
}) {
  const [deck, dispatch] = useReducer(deckReducer, {
    remaining: cards, passed: passedFromServer.slice(0, PASSED_LIMIT), history: [], seen: [],
  });
  const index = deck.seen.length;
  const total = index + deck.remaining.length;
  const passed = deck.passed;
  const hidden = deck.history[0] ?? null;
  const busy = useRef(false);
  const [view, setView] = useState<View>('today');
  const [offset, setOffset] = useState(0);
  const [dragging, setDragging] = useState(false);
  const [exit, setExit] = useState<'left' | 'right' | null>(null);
  const [leaving, setLeaving] = useState(false);
  const [announcement, setAnnouncement] = useState('');
  const [failure, setFailure] = useState<string | null>(null);
  const [working, startWorking] = useTransition();
  const start = useRef<{ x: number; y: number } | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const confirming = useRef<HTMLDialogElement>(null);
  const profile = deck.remaining[0];

  useEffect(() => () => { if (timer.current) clearTimeout(timer.current); }, []);
  const received = useRef({ cards, passed: passedFromServer });
  useEffect(() => {
    // 재검증 응답은 이동이 끝난 뒤 합친다. 같은 스냅샷의 숨김 해제도 새 카드로 반영한다.
    if (working || exit || busy.current) return;
    if (received.current.cards === cards && received.current.passed === passedFromServer) return;
    received.current = { cards, passed: passedFromServer };
    dispatch({ type: 'sync', cards, passed: passedFromServer });
  }, [cards, passedFromServer, working, exit]);

  /** 카드를 떠나보낸다 — 지나가는 것은 **이 자리에서만** 없어진다(서버에 안 적는다) */
  function leave(direction: 'left' | 'right', said: string, id: string) {
    setExit(direction);
    setDragging(false);
    setOffset(direction === 'right' ? 12 : -12);
    setAnnouncement(said);
    timer.current = setTimeout(() => {
      setLeaving(true);
      timer.current = setTimeout(() => {
        dispatch({ type: 'leave', id });
        timer.current = null;
        setExit(null);
        setLeaving(false);
        setOffset(0);
        start.current = null;
      }, CARD_EXIT_MS);
    }, CHOICE_HOLD_MS);
  }

  /** 예약된 이동을 물린다 — 되돌릴 때 이 타이머가 살아 있으면 복원 직후 또 넘어간다 */
  function cancelLeave() {
    if (timer.current) clearTimeout(timer.current);
    timer.current = null;
    setExit(null);
    setLeaving(false);
    setOffset(0);
  }

  function pass() {
    if (exit || busy.current || !profile) return;
    const passing = profile;
    setFailure(null);
    const finish = () => {
      dispatch({ type: 'pass', card: passing });
      leave('left', `${passing.nickname} 님을 지나친 인연에 두었어요.`, passing.candidateUserId);
    };
    if (preview) { finish(); return; }
    busy.current = true;
    startWorking(async () => {
      try {
        const result = await passCandidate(passing.candidateUserId);
        if (!result.ok) { setFailure(result.message); return; }
        finish();
      } catch {
        setFailure('저장하지 못했습니다. 잠시 뒤 다시 시도해 주세요.');
      } finally { busy.current = false; }
    });
  }

  /** 하트와 오른쪽 스와이프 모두 확인 창을 거친 뒤에 요청한다. */
  function send() {
    if (!profile || busy.current || exit) return;
    const sending = profile;
    const finish = () => leave('right', preview
      ? `미리보기예요 — ${sending.nickname} 님에게 요청은 전송되지 않았어요.`
      : `${sending.nickname} 님에게 상세 궁합을 요청했어요.`, sending.candidateUserId);
    if (preview) { finish(); return; }
    setFailure(null);
    busy.current = true;
    startWorking(async () => {
      try {
        const result = await requestMatch(sending.candidateUserId);
        announceIfMoved(result);
        if (!result.ok) { setFailure(result.message); return; }
        finish();
      } catch {
        setFailure('요청 결과를 확인하지 못했습니다. 소식에서 확인해 주세요.');
      } finally { busy.current = false; }
    });
  }

  /** 보관함과 실행 취소가 같은 복원 경로를 사용한다. 실패하면 이력도 그대로 둔다. */
  async function restoreCard(back: DeckCard): Promise<string | null> {
    if (busy.current || exit === 'right') return '처리 중입니다. 잠시 뒤 다시 시도해 주세요.';
    busy.current = true;
    setFailure(null);
    let message: string | null = null;
    await new Promise<void>((resolve) => startWorking(async () => {
      try {
        const result = preview ? { ok: true as const, card: back, passed: undefined } : await restorePassed(back.candidateUserId);
        if (!result.ok) { message = result.message; setFailure(message); return; }
        cancelLeave();
        dispatch({ type: 'restore', card: result.card, passed: result.passed });
        setAnnouncement(`${back.nickname} 님을 카드 맨 앞으로 가져왔어요.`);
      } catch {
        message = '복원하지 못했습니다. 잠시 뒤 다시 시도해 주세요.';
        setFailure(message);
      } finally { busy.current = false; resolve(); }
    }));
    return message;
  }

  function undo() {
    if (hidden) void restoreCard(hidden);
  }

  function pointerDown(event: PointerEvent<HTMLElement>) {
    if (exit || busy.current || !event.isPrimary || event.button !== 0) return;
    setDragging(true);
    start.current = { x: event.clientX, y: event.clientY };
    event.currentTarget.setPointerCapture(event.pointerId);
  }
  function pointerMove(event: PointerEvent<HTMLElement>) {
    if (!start.current || exit) return;
    const x = event.clientX - start.current.x;
    const y = event.clientY - start.current.y;
    // 세로로 먼저 움직이면 화면을 내리는 손짓이다 — 카드를 놓아준다.
    if (Math.abs(y) > Math.abs(x) && Math.abs(x) < 15) { start.current = null; setDragging(false); setOffset(0); return; }
    setOffset(x);
  }
  function pointerUp() {
    setDragging(false);
    if (!start.current) return;
    start.current = null;
    // 오른쪽으로 밀어도 **바로 안 나간다** — 확인 창이 먼저 선다.
    if (busy.current || exit) { setOffset(0); return; }
    if (offset > SWIPE_AT) { setOffset(0); confirming.current?.showModal(); return; }
    if (offset < -SWIPE_AT) { pass(); return; }
    setOffset(0);
  }

  /*
    **지도는 덱과 같은 상태를 읽는다.** 오늘 받은 사람에 되돌려 온 사람을 더한 것이 궤도 위의 사람이고,
    떠나는 중인 카드는 이미 떠난 쪽으로 움직인다.
  */
  const mapCards = [...cards, ...deck.remaining.filter((card) => !cards.some((one) => one.candidateUserId === card.candidateUserId))];
  const statusOf = (card: DeckCard): MapStatus => {
    if (card.candidateUserId === profile?.candidateUserId) {
      return exit === 'left' ? 'passed' : exit === 'right' ? 'requested' : 'current';
    }
    if (deck.remaining.some((one) => one.candidateUserId === card.candidateUserId)) return 'waiting';
    return passed.some((one) => one.candidateUserId === card.candidateUserId) ? 'passed' : 'requested';
  };
  const pull = exit === null ? Math.max(-1, Math.min(1, offset / SWIPE_AT)) : 0;
  const counter = `${String(Math.min(index + 1, total)).padStart(2, '0')} / ${String(total).padStart(2, '0')}`;

  /** 되돌릴 한 줄 · 실패 · 방금 한 일 — 한 화면에 한 자리에만 선다 */
  const feedback = (
    <Feedback
      undo={hidden !== null ? undo : null}
      working={working}
      failure={failure}
      announcement={announcement}
    />
  );

  return (
    <main className="app-shell flex min-w-0 flex-1 flex-col gap-5 py-6 sm:gap-7 sm:py-10">
      <header className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div className="flex flex-col gap-1">
          <p className={TYPE_META} suppressHydrationWarning>{todayLabel()}</p>
          <h1 className={TYPE_DISPLAY}>오늘의 인연</h1>
        </div>
        <div role="group" aria-label="보기" className="grid grid-cols-2 gap-1 self-start rounded-full bg-surface p-1 ring-1 ring-border sm:self-auto">
          <ViewButton on={view === 'today'} onClick={() => setView('today')} icon="heart" label="오늘의 인연" count={deck.remaining.length} />
          <ViewButton on={view === 'passed'} onClick={() => setView('passed')} icon="undo" label="지나친 인연" count={passed.length} />
        </div>
      </header>

      {/* 목록 머리 — 참고 점수라는 사실과(PRD §6.1) 목록이 비슷한 까닭. 카드마다 되풀이하지 않는다 */}
      {view === 'today' && profile !== undefined && (
        <div className="-mt-2 flex max-w-3xl flex-col gap-1 sm:-mt-4">
          <p className="text-[12px] leading-5 text-secondary">{teaser}</p>
          {notice !== null && <p className={TYPE_META}>{notice}</p>}
        </div>
      )}
      {view === 'today' && profile === undefined && notice !== null && <p className={`${TYPE_META} -mt-2 max-w-prose`}>{notice}</p>}

      {view === 'passed' ? (
        <PassedConnections
          cards={passed}
          preview={preview}
          working={working || exit === 'right'}
          onRestore={async (card) => {
            const message = await restoreCard(card);
            if (message === null) setView('today');
            return message;
          }}
          onBack={() => setView('today')}
          faceOf={faceOf}
          map={
            passed.length > 0 ? (
              <ApproachMap
                shape="arc"
                me={me}
                cards={passed.slice(0, 6)}
                statusOf={() => 'kept'}
                faceOf={faceOf}
                className="mx-auto max-w-[28rem]"
              />
            ) : null
          }
          feedback={feedback}
        />
      ) : profile === undefined ? (
        <EmptyDeck
          me={me}
          kind={cards.length === 0 && total === 0 ? 'none' : 'all-met'}
          refresh={preview ? null : <RefreshBoard waitSeconds={waitSeconds} />}
          feedback={feedback}
        />
      ) : (
        <section aria-label="인연 카드" className="grid gap-5 lg:grid-cols-[minmax(0,25rem)_minmax(0,1fr)] lg:items-stretch lg:gap-8 xl:grid-cols-[minmax(0,26rem)_minmax(0,1fr)]">
          {/*
            왼쪽(넓은 화면) — 그 사람 한 장. 폰에서는 이 한 장이 화면 전부이고, 너무 넓어지지 않게 가운데 선다.
            읽는 차례는 사진 위 이름 → 큰 점수와 판정 → 누를 것 → 이유 → 소개다. 글은 짧게 두어 사진의 비율이 카드를 정한다.
          */}
          <article
            aria-label={`${profile.nickname} 님`}
            aria-busy={!!exit || working}
            className={`${elementScope(elementOf(profile))} mx-auto flex w-full min-w-0 max-w-[34rem] flex-col gap-4 lg:mx-0 lg:max-w-none`}
          >
            <div className="relative px-1.5 pt-1.5">
              {/* 뒤에 다음 사람들의 색이 한 장씩 비친다 — 「아직 더 있다」 */}
              {deck.remaining.slice(1, 3).map((card, at) => (
                <span
                  key={card.candidateUserId}
                  aria-hidden="true"
                  className={`${elementScope(elementOf(card))} absolute inset-x-4 bottom-2 top-3 rounded-[2rem] bg-[var(--tile)] ring-1 ring-border ${
                    at === 0 ? 'translate-x-1.5 rotate-[3.5deg]' : '-translate-x-1 -rotate-[2.5deg]'
                  }`}
                />
              ))}
              {/* 사진 — 폰은 6:5(점수 · 요청이 첫 화면에 들도록), 넓은 화면은 4:5 세로 사진 */}
              <div
                key={profile.candidateUserId}
                onPointerDown={pointerDown}
                onPointerMove={pointerMove}
                onPointerUp={pointerUp}
                onPointerCancel={() => { start.current = null; setDragging(false); setOffset(0); }}
                onLostPointerCapture={() => { start.current = null; setDragging(false); if (!exit) setOffset(0); }}
                style={{
                  transform: leaving
                    ? `translateX(${exit === 'right' ? 115 : -115}%) rotate(${exit === 'right' ? 12 : -12}deg)`
                    : `translateX(${offset}px) rotate(${offset / 24}deg)`,
                  transition: dragging ? 'none' : `transform ${CARD_EXIT_MS}ms cubic-bezier(.2,.7,.3,1), opacity ${CARD_EXIT_MS}ms`,
                  opacity: leaving ? 0 : 1,
                  boxShadow: `0 24px 48px -24px ${SOFT_SHADOW}`,
                }}
                className={`${styles.arrive} relative aspect-[6/5] cursor-grab touch-pan-y select-none overflow-hidden rounded-[2rem] bg-[var(--tile)] active:cursor-grabbing lg:aspect-[4/5]`}
              >
                <CandidatePhoto card={profile} initialClass="text-[7rem]" />

                {profile.exploration && (
                  <span className="absolute left-4 top-4 inline-flex min-h-8 items-center gap-1.5 rounded-full bg-surface px-3 text-[13px] font-semibold text-foreground shadow-sm">
                    <Icon name="spark" className="size-4 text-[var(--ink)]" />
                    색다른 인연
                  </span>
                )}

                <Stamp offset={offset} exit={exit} />

                {/* 사진 아래 끝 — 이름. 폰은 점수 숫자도 여기 선다(넓은 화면은 사진 아래 큰 숫자) */}
                <div className="absolute inset-x-0 bottom-0 flex items-end justify-between gap-3 bg-gradient-to-t from-black/65 via-black/25 to-transparent px-5 pb-4 pt-14 text-white lg:px-6 lg:pb-5">
                  <div className="min-w-0">
                    <h2 className="font-rounded truncate text-[2.25rem] leading-tight lg:text-[2.625rem]">{profile.nickname}</h2>
                    {profile.activity != null && <p className="text-[13px] font-semibold text-white/90">{activityText(profile.activity)}</p>}
                  </div>
                  <p className="flex shrink-0 items-baseline lg:hidden">
                    <span className="sr-only">나와의 예측 궁합 점수 </span>
                    <strong className="text-[3rem] font-bold leading-none tracking-[-0.04em] tabular-nums">{profile.previewScore}</strong>
                    <span className="ml-1 text-[14px] font-semibold text-white/90"> / 100</span>
                  </p>
                </div>
              </div>
            </div>

            {/* 넓은 화면 — 사진 아래 큰 점수와 판정 한 줄. 이름(사진 위) 다음 위계다 */}
            <div className="hidden flex-col gap-1 px-1 lg:flex">
              <p className="text-[13px] font-semibold text-secondary">나와의 예측 궁합 점수</p>
              <p className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
                <span className="flex items-baseline">
                  <strong className="text-[4rem] font-bold leading-none tracking-[-0.04em] text-foreground tabular-nums">{profile.previewScore}</strong>
                  <span className="ml-1 text-[15px] font-semibold text-secondary"> / 100</span>
                </span>
                <span className="font-rounded text-[1.375rem] leading-snug text-[var(--ink)]">{profile.verdict}</span>
              </p>
            </div>

            {/* 누를 것 — 한 화면에 채움 단추는 「궁합 요청」 하나 */}
            <div className="flex flex-col gap-2 px-1">
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  aria-label="이전 인연으로 되돌리기"
                  disabled={!hidden || working || exit === 'right'}
                  onClick={undo}
                  className="grid size-11 shrink-0 place-items-center rounded-full bg-surface text-secondary ring-1 ring-border hover:text-foreground active:scale-95 disabled:opacity-40"
                >
                  <UndoIcon />
                </button>
                <button
                  type="button"
                  aria-label="다음 인연으로 지나가기"
                  disabled={!!exit || working}
                  onClick={pass}
                  className="grid size-14 shrink-0 place-items-center rounded-full bg-surface text-foreground ring-1 ring-border hover:ring-border-strong active:scale-95 disabled:opacity-55"
                  style={{ boxShadow: `0 6px 16px -10px ${SOFT_SHADOW}` }}
                >
                  <Icon name="close" className="size-6" />
                </button>
                <button
                  type="button"
                  aria-label="상세 궁합 요청하기"
                  disabled={!!exit || working}
                  onClick={() => confirming.current?.showModal()}
                  className={`${BUTTON_PRIMARY} min-h-14 flex-1 text-[17px]`}
                >
                  <Icon name="heart" className="size-[22px]" />
                  궁합 요청
                </button>
              </div>
              <p className="hidden text-center text-[12px] font-medium text-secondary sm:block">← 다음 인연 · 상세 궁합이 궁금하다면 하트 →</p>
              {feedback}
            </div>

            <div key={profile.candidateUserId} className={`flex flex-col gap-4 transition-opacity duration-500 ${leaving ? 'opacity-40' : ''}`}>
              {/* 폰 — 해돋이 띠. 넘김 · 요청 · 되돌리기의 움직임이 폰에서도 보인다 */}
              <div className="relative overflow-hidden rounded-[1.75rem] bg-cream px-2 pt-3 lg:hidden">
                <p className="absolute right-4 top-3 text-[12px] font-semibold tabular-nums text-secondary">
                  <span className="sr-only">나와 맞는 오늘의 인연 </span>
                  {counter}
                </p>
                <ApproachMap
                  shape="arc"
                  me={me}
                  cards={mapCards}
                  statusOf={statusOf}
                  faceOf={faceOf}
                  pull={pull}
                  dragging={dragging}
                  className="mx-auto max-w-[28rem]"
                />
              </div>

              {/* 판정(폰) · 이유 — 점수의 말과 그 까닭 한 줄 */}
              <div className="flex flex-col gap-1.5 px-1">
                <p className="font-rounded text-[1.375rem] leading-snug text-[var(--ink)] lg:hidden">{profile.verdict}</p>
                <p className="max-w-prose text-[14px] leading-6 text-foreground">{profile.reason}</p>
              </div>

              {/* 폰 — 채워 주는 기운. 넓은 화면은 지도 아래가 든다 */}
              <div className="flex flex-col gap-2 rounded-[1.5rem] bg-surface p-4 ring-1 ring-border lg:hidden">
                <SupplyBody card={profile} explorationNote={explorationNote} />
              </div>

              <Letter key={profile.candidateUserId} nickname={profile.nickname} intro={profile.intro} />
            </div>
          </article>

          {/*
            오른쪽(넓은 화면) — 「내 궤도로 다가오는 인연」. 그림이 주인공이고 색은 채워지는 한 자리에만 선다.
            아래 띠가 같은 뜻을 글로 말한다(누가 · 어느 빈 자리를).
          */}
          <section
            aria-labelledby="matching-map"
            className="hidden min-w-0 flex-col overflow-hidden rounded-[2rem] bg-cream lg:flex"
          >
            <div className="flex items-baseline justify-between gap-3 px-6 pt-6">
              <h2 id="matching-map" className="font-rounded text-[1.375rem] leading-8 text-foreground">
                내 궤도로 다가오는 인연
              </h2>
              <p className="shrink-0 text-[13px] font-semibold text-secondary">
                나와 맞는 오늘의 인연 <span className="tabular-nums text-foreground">{counter}</span>
              </p>
            </div>
            <div className="flex flex-1 items-center px-8 py-4">
              <ApproachMap
                shape="round"
                me={me}
                cards={mapCards}
                statusOf={statusOf}
                faceOf={faceOf}
                pull={pull}
                dragging={dragging}
                className="mx-auto max-w-[37rem]"
              />
            </div>
            <Legend className="px-6 pb-4" />
            <div key={profile.candidateUserId} className="flex flex-col gap-2 border-t border-border bg-surface/70 px-6 py-5">
              <SupplyBody card={profile} explorationNote={explorationNote} />
            </div>
          </section>
        </section>
      )}

      {preview && <p className="text-center text-[12px] text-secondary">디자인 확인용 예시 프로필이며, 요청은 전송되지 않아요.</p>}

      {/*
        **요청 확인 창은 목록과 같은 말을 한다.** 문구가 화면마다 갈리면 어느 쪽이
        실제로 나가는 약속인지 알 수 없다 — 둘 다 정책이 지어 온 문장이다. 「채팅은 아직 없다」는
        제한문은 채팅이 선 뒤(ADR 0091) 걷었다 — 대화방은 수락하는 순간 열린다(#147).
      */}
      <dialog
        ref={confirming}
        aria-labelledby="matching-confirm"
        onClick={(event) => { if (event.target === event.currentTarget) confirming.current?.close(); }}
        className="m-auto w-[min(100%-2rem,28rem)] rounded-[2rem] bg-surface p-0 text-foreground shadow-2xl backdrop:bg-black/40"
      >
        {profile && (
          <div className={`${elementScope(elementOf(profile))} flex flex-col gap-4 p-6`}>
            <div className="flex items-center gap-3">
              <span className="relative size-14 shrink-0 overflow-hidden rounded-full bg-[var(--tile)] text-[1.5rem] ring-2 ring-[var(--tile)]">
                <CandidatePhoto card={profile} />
              </span>
              <span className="grid size-10 place-items-center rounded-full bg-[var(--tile)]">
                <ElementSymbol element={elementOf(profile)} className="size-6" />
              </span>
            </div>
            <h2 id="matching-confirm" className="font-rounded text-[1.5rem] leading-[1.35]">
              {profile.nickname} 님에게 상세 궁합을 요청할까요?
            </h2>
            <div className="flex flex-col gap-2 text-[14px] leading-6 text-secondary">
              <p>{REQUEST_RESERVES_NOTE}</p>
              <p>{MATCH_PILLARS_DISCLOSURE}</p>
            </div>
            <div className="mt-1 flex flex-col gap-2 sm:flex-row-reverse">
              <button type="button" disabled={working} onClick={() => { confirming.current?.close(); send(); }} className={`${BUTTON_PRIMARY} sm:flex-1`}>
                <Icon name="heart" className="size-[18px]" />
                요청 보내기
              </button>
              <button type="button" disabled={working} onClick={() => confirming.current?.close()} className={`${BUTTON_SECONDARY} sm:flex-1`}>
                취소
              </button>
            </div>
          </div>
        )}
      </dialog>
    </main>
  );
}

/** 제목 위 날짜 — 홈의 인사와 같은 형식. 서버와 브라우저의 시간대가 달라도 한국 날짜로 선다 */
function todayLabel(): string {
  return new Date().toLocaleDateString('ko-KR', { month: 'long', day: 'numeric', weekday: 'long', timeZone: 'Asia/Seoul' });
}

/** 채워 주는 기운 — 상징 + 이름 + 문장. 색 혼자 말하지 않고, 색은 상징의 동그라미에만 둔다 */
function SupplyBody({ card, explorationNote }: { card: DeckCard; explorationNote: string | null }) {
  return (
    <>
      <p className="text-[13px] font-bold text-foreground">이 사람이 채워 주는 기운</p>
      {card.highlights.length > 0 ? (
        <ul className="flex flex-col gap-2.5">
          {card.highlights.map((highlight) => (
            <Supply key={highlight.element} element={highlight.element} text={highlight.text} />
          ))}
        </ul>
      ) : (
        <p className="text-[14px] leading-6 text-foreground">{card.reason}</p>
      )}
      <p className="text-[13px] leading-5 text-secondary">{card.balanceLabel}</p>
      {card.exploration && explorationNote !== null && (
        <p className="flex gap-1.5 border-t border-border pt-3 text-[12px] leading-5 text-secondary">
          <Icon name="spark" className="mt-0.5 size-3.5 shrink-0 text-foreground" />
          {explorationNote}
        </p>
      )}
    </>
  );
}

function Supply({ element, text }: { element: string; text: string }) {
  const known = ELEMENTS.find((one) => one === element) ?? null;
  return (
    <li className={`${elementScope(known)} flex items-center gap-3`}>
      <span className="grid size-10 shrink-0 place-items-center rounded-full bg-[var(--tile)] ring-1 ring-[color-mix(in_srgb,var(--ink)_20%,transparent)]">
        <ElementSymbol element={known} className="size-6" />
      </span>
      <span className="flex min-w-0 flex-col">
        {known !== null && <span className="font-rounded text-[1.125rem] leading-tight text-[var(--ink)]">{ELEMENT_PICTURE_KO[known]}</span>}
        <span className="text-[14px] leading-5 text-foreground">{text}</span>
      </span>
    </li>
  );
}

/**
 * 소개 — 편지지 한 장. 길면 세 줄로 접어 두고 펴는 단추를 준다(소개가 카드를 늘어뜨리지 않게). 비었으면 비었다고 말한다.
 * 접혀 있어도 글은 그대로 문서에 있다 — 보조기기는 끝까지 읽는다.
 */
function Letter({ nickname, intro }: { nickname: string; intro: string | null }) {
  const [open, setOpen] = useState(false);
  const long = intro !== null && intro.length > LETTER_FOLD_AT;
  return (
    <figure className="flex flex-col gap-2 rounded-[1.5rem] bg-surface px-5 py-4 ring-1 ring-border">
      {intro !== null ? (
        <blockquote className={`font-rounded text-[1rem] leading-7 text-foreground ${long && !open ? 'line-clamp-3' : ''}`}>
          <Icon name="quote" className="mr-1.5 inline size-4 -translate-y-0.5 text-cream-ink" />
          {intro}
        </blockquote>
      ) : (
        <p className="text-[14px] font-medium text-secondary">자기소개 없음</p>
      )}
      <div className="flex items-center justify-between gap-3">
        {long ? (
          <button type="button" aria-expanded={open} onClick={() => setOpen((was) => !was)} className={BUTTON_TERTIARY}>
            {open ? '접기' : '더 보기'}
          </button>
        ) : (
          <span />
        )}
        <figcaption className="font-rounded text-[0.9375rem] text-cream-ink">— {nickname}</figcaption>
      </div>
    </figure>
  );
}

function ViewButton({ on, onClick, icon, label, count }: { on: boolean; onClick: () => void; icon: IconName | 'undo'; label: string; count: number }) {
  return (
    <button
      type="button"
      aria-pressed={on}
      onClick={onClick}
      className={`inline-flex min-h-11 items-center justify-center gap-2 rounded-full px-4 text-[15px] font-semibold active:scale-[0.97] ${
        on ? 'bg-accent text-on-accent' : 'text-secondary hover:bg-surface-soft hover:text-foreground'
      }`}
    >
      {icon === 'undo' ? <UndoIcon className="size-[18px]" /> : <Icon name={icon} className="size-[18px]" />}
      {label}
      <span
        className={`grid h-5 min-w-5 place-items-center rounded-full px-1.5 text-[11px] font-bold tabular-nums ${
          on ? 'bg-[color-mix(in_srgb,var(--on-accent)_20%,transparent)]' : 'bg-surface-soft text-foreground'
        }`}
      >
        {count}
        <span className="sr-only">명</span>
      </span>
    </button>
  );
}

/** 끄는 동안 사진 위에 뜨는 말 — 고른 뒤 떠나기 전에도 그대로 서서 무엇을 골랐는지 읽힌다 */
function Stamp({ offset, exit }: { offset: number; exit: 'left' | 'right' | null }) {
  const left = offset < 0 || exit === 'left';
  const strength = exit !== null ? 1 : Math.min(Math.abs(offset) / SWIPE_AT, 1);
  if (strength === 0) return null;
  return (
    <span
      aria-hidden="true"
      style={{ opacity: strength }}
      className={`absolute top-6 rounded-full px-4 py-2 text-[15px] font-bold shadow-lg ${
        left ? 'right-5 rotate-[8deg] bg-surface text-foreground' : 'left-5 -rotate-[8deg] bg-accent text-on-accent'
      }`}
    >
      {left ? '다음 인연' : '궁합이 궁금해요'}
    </span>
  );
}

/**
 * 누른 뒤의 한 줄 — 넘긴 직후 되돌릴 길, 실패, 방금 한 일. 확인 창을 띄우지 않고 둔 다음에 알린다.
 * 한 화면에 한 자리에만 선다(카드 아래 · 빈 날 · 지나친 인연).
 */
function Feedback({
  undo,
  working,
  failure,
  announcement,
}: {
  undo: (() => void) | null;
  working: boolean;
  failure: string | null;
  announcement: string;
}) {
  return (
    <>
      {undo !== null && (
        <p className="flex flex-wrap items-center justify-between gap-x-4 rounded-[1.25rem] bg-surface px-4 py-1 text-[14px] font-medium text-foreground ring-1 ring-border">
          <span className="py-2">지나친 인연에 보관했어요</span>
          <button type="button" onClick={undo} disabled={working} className={BUTTON_TERTIARY}>
            실행 취소
          </button>
        </p>
      )}
      {failure !== null && <p role="alert" className="rounded-[1.25rem] bg-surface px-4 py-3 text-[14px] font-medium text-danger ring-1 ring-border">{failure}</p>}
      <p role="status" className={undo === null && announcement !== '' ? 'text-center text-[13px] font-medium text-secondary' : 'sr-only'}>
        {announcement}
      </p>
    </>
  );
}

/** 오늘 소개할 사람이 없거나(`none`) 오늘의 인연을 다 만났다(`all-met`) — 아무도 다가오지 않는 작은 궤도 */
function EmptyDeck({
  me,
  kind,
  refresh,
  feedback,
}: {
  me: MeMark;
  kind: 'none' | 'all-met';
  refresh: ReactNode;
  feedback: ReactNode;
}) {
  return (
    <section className="grid items-center gap-6 rounded-[2rem] bg-cream p-6 sm:grid-cols-[minmax(0,14rem)_minmax(0,1fr)] sm:gap-10 sm:p-10">
      <QuietOrbit me={me} />
      <div className="flex min-w-0 flex-col items-start gap-5">
        <div className="flex flex-col gap-2">
          <h2 className="font-rounded text-[1.625rem] leading-[1.35] text-foreground sm:text-[2rem]">
            {kind === 'none' ? DISCOVERY_EMPTY.title : '오늘의 인연을 모두 만났어요'}
          </h2>
          <p className="max-w-prose text-[15px] leading-6 text-secondary">
            {kind === 'none' ? DISCOVERY_EMPTY.line : '지나친 인연을 다시 살펴보거나, 나중에 새로운 인연을 확인해 보세요.'}
          </p>
        </div>
        {refresh}
        {kind === 'none' && (
          <nav aria-label="더 해 보기" className="grid w-full gap-2 sm:grid-cols-2">
            {MEANWHILE.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className={`${elementScope(link.element)} group flex min-h-14 items-center gap-3 rounded-[1.25rem] border border-border bg-surface px-4 py-3 text-[15px] font-semibold text-foreground hover:border-border-strong active:scale-[0.98]`}
              >
                <span className="grid size-10 shrink-0 place-items-center rounded-full bg-[var(--tile)] text-[var(--ink)]">
                  <Icon name={link.icon} />
                </span>
                <span className="min-w-0 flex-1">{link.label}</span>
                <Icon name="arrow" className="size-4 text-secondary group-hover:translate-x-0.5" />
              </Link>
            ))}
          </nav>
        )}
        <div className="flex w-full flex-col gap-2">{feedback}</div>
      </div>
    </section>
  );
}

const MEANWHILE: readonly { href: string; label: string; icon: IconName; element: Element }[] = [
  { href: '/', label: '다른 사람 사주 보기', icon: 'search', element: '水' },
  { href: '/compat', label: '궁합 보러 가기', icon: 'heart', element: '火' },
];
