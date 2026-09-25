'use client';

import Link from 'next/link';
import { useEffect, useReducer, useRef, useState, useTransition, type ReactNode } from 'react';

import { MATCH_PILLARS_DISCLOSURE } from '@/src/lib/consent/notice';
import { DISCOVERY_EMPTY } from '@/src/lib/discovery';
import { REQUEST_RESERVES_NOTE } from '@/src/lib/reading/notes';
import { ELEMENT_PICTURE_KO, type Element } from '@/src/lib/saju';

import { elementScope } from '../../element-tone';
import { BUTTON_PRIMARY, BUTTON_SECONDARY, BUTTON_TERTIARY } from '../../ui/buttons';
import { ElementSymbol } from '../../ui/element-symbol';
import { Icon, type IconName } from '../../ui/icons';
import { TYPE_DISPLAY, TYPE_META } from '../../ui/surfaces';
import { passCandidate, requestMatch, restorePassed } from '../discovery/actions';
import { RefreshBoard } from '../discovery/manage';
import { announceIfMoved } from '../reading/credits-signal';
import { CandidatePhoto } from './candidate-photo';
import { elementOf, supplyOf, type DeckCard } from './deck-card';
import { deckReducer, PASSED_LIMIT } from './deck-state';
import type { MeMark } from './me-mark';
import { reducedMotion } from './motion';
import { ApproachMap, Legend, QuietOrbit, type MapStatus } from './orbit-map';
import { PassedConnections, UndoIcon } from './passed-connections';
import { DeckButtons, DeckDots, DetailSheet, openSheet, TodayCard } from './today-card';


// 고른 것을 읽을 시간을 주고 나서 카드가 떠난다.
const CHOICE_HOLD_MS = 100;
const CARD_EXIT_MS = 360;
const FLASH_MS = 2000;
const EMPTY_CARDS: readonly DeckCard[] = [];
/** 이보다 긴 소개는 세 줄로 접어 두고 「더 보기」로 편다 — 소개가 카드를 늘어뜨리지 않게 */
const LETTER_FOLD_AT = 90;

type View = 'today' | 'passed';

/*
  **오늘의 인연 — 한 사람을 한 장의 편지처럼**(부드러움, ADR 0109).

  **카드 한 장은 폰과 넓은 화면이 같다**(`today-card.tsx`, 운영자 2026-09-25) — 사진이 주인공이고 그 위에 이름 · 점수 ·
  판정 · 채워 주는 기운 · 소개 한 줄, 사진 아래에 글자 단추 줄. 끌어서 넘기지 않는다.

  **폰은 한 화면에 그 한 장이다.** 페이지는 위아래로 안 움직이고, 까닭 · 기운의 문장 · 소개 전문 · 궤도 · 「참고 점수」
  고지는 ⓘ 시트가 든다. **넓은 화면은 두 열이다** — 왼쪽에 같은 카드, 오른쪽에 「내 궤도로 다가오는 인연」 지도와 폰의
  시트가 들던 것을 펼쳐 둔다. 참고 점수 고지는 넓은 화면에서는 목록 머리 한 줄이다.

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
  const [exit, setExit] = useState<'left' | 'right' | null>(null);
  const [leaving, setLeaving] = useState(false);
  const [announcement, setAnnouncement] = useState('');
  /**
   * 눈에 잠깐 서는 한 줄 — 되돌려 온 일 · 요청을 보낸 일. **2초 뒤 걷힌다**(운영자 2026-09-25). 넘긴 일은 눈에 안 띄운다 —
   * 카드가 빠지는 것이 이미 말하고, 되돌릴 길은 카드 아래 ↶ 다. 보조기기에는 `announcement` 가 늘 읽힌다.
   */
  const [flash, setFlash] = useState('');
  useEffect(() => {
    if (flash === '') return;
    const clear = setTimeout(() => setFlash(''), FLASH_MS);
    return () => clearTimeout(clear);
  }, [flash]);
  const [failure, setFailure] = useState<string | null>(null);
  const [working, startWorking] = useTransition();
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const confirming = useRef<HTMLDialogElement>(null);
  const sheet = useRef<HTMLDialogElement>(null);
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
    if (direction === 'right') setFlash(said);
    const reduced = reducedMotion();
    setAnnouncement(said);
    timer.current = setTimeout(() => {
      setLeaving(true);
      timer.current = setTimeout(() => {
        dispatch({ type: 'leave', id });
        timer.current = null;
        setExit(null);
        setLeaving(false);
      }, reduced ? 0 : CARD_EXIT_MS);
    }, reduced ? 0 : CHOICE_HOLD_MS);
  }

  /** 예약된 이동을 물린다 — 되돌릴 때 이 타이머가 살아 있으면 복원 직후 또 넘어간다 */
  function cancelLeave() {
    if (timer.current) clearTimeout(timer.current);
    timer.current = null;
    setExit(null);
    setLeaving(false);
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
        setFlash(`${back.nickname} 님을 카드 맨 앞으로 가져왔어요.`);
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
  const counter = `${String(Math.min(index + 1, total)).padStart(2, '0')} / ${String(total).padStart(2, '0')}`;

  /** 되돌릴 한 줄 · 실패 · 방금 한 일 — 한 화면에 한 자리에만 선다 */
  const feedback = (
    <Feedback
      undo={hidden !== null ? undo : null}
      working={working}
      failure={failure}
      announcement={announcement}
      flash={flash}
    />
  );

  /** 카드 위 — 되돌리기 줄이 없다(카드 아래 ↶ 가 같은 일을 한다). 줄은 덱이 비었을 때만 선다 */
  const cardFeedback = (
    <Feedback
      undo={null}
      working={working}
      failure={failure}
      announcement={announcement}
      flash={flash}
    />
  );

  /** 폰의 ⓘ 시트와 넓은 화면의 옆 열이 함께 드는 것 — 판정의 까닭 · 채워 주는 기운의 문장 · 소개 전문 */
  const details = profile && (
    <>
      <div className="flex flex-col gap-1">
        <p className="font-rounded text-[1.25rem] leading-snug text-[var(--ink)]">{profile.verdict}</p>
        <p className="max-w-prose text-[14px] leading-6 text-foreground">{profile.reason}</p>
      </div>
      <div className="flex flex-col gap-2 rounded-[1.5rem] bg-surface p-4 ring-1 ring-border">
        <SupplyBody card={profile} explorationNote={explorationNote} />
      </div>
      <Letter key={profile.candidateUserId} nickname={profile.nickname} intro={profile.intro} />
    </>
  );

  return (
    <main className="app-shell flex min-w-0 flex-1 flex-col gap-5 py-6 sm:gap-7 sm:py-10">
      {/*
        **폰에서는 제목과 보기 전환이 한 줄에 선다**(2026-09-25). 두 칸짜리 토글이 폰에서 한 줄을 통째로 썼다 — 폰에는
        「지금 아닌 쪽」으로 가는 알약 하나와, 그 위에 덱 순번 점이 선다. 지나친 인연은 가끔 여는 보관함이라 오늘의 인연과
        같은 무게일 까닭이 없다.
      */}
      <header className="flex flex-row items-end justify-between gap-3">
        <div className="flex min-w-0 flex-col gap-1">
          <p className={TYPE_META} suppressHydrationWarning>{todayLabel()}</p>
          <h1 className={TYPE_DISPLAY}>오늘의 인연</h1>
        </div>
        <div className="flex shrink-0 flex-col items-end gap-2 sm:hidden">
          {view === 'today' && profile !== undefined && <DeckDots at={index} total={total} counter={counter} />}
          <button
            type="button"
            onClick={() => setView(view === 'today' ? 'passed' : 'today')}
            className="inline-flex min-h-11 items-center gap-1.5 rounded-full bg-surface px-3.5 text-[13px] font-semibold text-foreground ring-1 ring-border hover:ring-border-strong active:scale-[0.97]"
          >
            {view === 'today' ? <UndoIcon className="size-4" /> : <Icon name="heart" className="size-4" />}
            {view === 'today' ? '지나친 인연' : '오늘의 인연'}
            <span className="tabular-nums text-secondary">
              {view === 'today' ? passed.length : deck.remaining.length}
              <span className="sr-only">명</span>
            </span>
          </button>
        </div>
        <div role="group" aria-label="보기" className="hidden grid-cols-2 gap-1 rounded-full bg-surface p-1 ring-1 ring-border sm:grid">
          <ViewButton on={view === 'today'} onClick={() => setView('today')} icon="heart" label="오늘의 인연" count={deck.remaining.length} />
          <ViewButton on={view === 'passed'} onClick={() => setView('passed')} icon="undo" label="지나친 인연" count={passed.length} />
        </div>
      </header>

      {/*
        목록 머리 — 참고 점수라는 사실과(PRD §6.1) 목록이 비슷한 까닭. 카드마다 되풀이하지 않는다.
        **폰은 이 줄을 ⓘ 시트가 든다** — 한 화면을 그 사람에게 준다(2026-09-25).
      */}
      {view === 'today' && profile !== undefined && (
        <div className="-mt-4 hidden max-w-3xl flex-col gap-1 lg:flex">
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
          map={
            passed.length > 0 ? (
              <ApproachMap
                shape="arc"
                me={me}
                cards={passed.slice(0, 6)}
                statusOf={() => 'kept'}
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
        <section
          aria-label="인연 카드"
          className="flex min-h-0 flex-1 flex-col lg:grid lg:flex-none lg:grid-cols-[minmax(0,25rem)_minmax(0,1fr)] lg:items-start lg:gap-8 xl:grid-cols-[minmax(0,26rem)_minmax(0,1fr)]"
        >
          {/* 그 사람 한 장 — 폰은 남는 높이를 다 쓰고, 넓은 화면은 4:5 */}
          <article
            aria-label={`${profile.nickname} 님`}
            aria-busy={!!exit || working}
            className="flex min-h-0 w-full min-w-0 flex-1 flex-col gap-3 lg:flex-none lg:gap-4"
          >
            <TodayCard
              profile={profile}
              next={deck.remaining[1]}
              exit={exit}
              leaving={leaving}
              feedback={cardFeedback}
              onInfo={() => openSheet(sheet.current)}
            />
            <DeckButtons
              actions={{
                undo,
                pass,
                request: () => confirming.current?.showModal(),
                canUndo: !!hidden && !working && exit !== 'right',
                busy: !!exit || working,
              }}
            />
          </article>

          {/*
            오른쪽(넓은 화면) — 「내 궤도로 다가오는 인연」과, 폰에서 ⓘ 시트가 들던 것. 그림이 주인공이고 색은 채워지는 한
            자리에만 선다.
          */}
          <div className="hidden min-w-0 flex-col gap-4 lg:flex">
            <section aria-labelledby="matching-map" className="flex flex-col overflow-hidden rounded-[2rem] bg-cream">
              <div className="flex items-baseline justify-between gap-3 px-6 pt-6">
                <h2 id="matching-map" className="font-rounded text-[1.375rem] leading-8 text-foreground">
                  내 궤도로 다가오는 인연
                </h2>
                <p className="shrink-0 text-[13px] font-semibold text-secondary">
                  나와 맞는 오늘의 인연 <span className="tabular-nums text-foreground">{counter}</span>
                </p>
              </div>
              <div className="flex items-center px-8 py-4">
                <ApproachMap shape="round" me={me} cards={mapCards} statusOf={statusOf} className="mx-auto max-w-[32rem]" />
              </div>
              <Legend className="px-6 pb-4" />
            </section>
            <div key={profile.candidateUserId} className={`${elementScope(supplyOf(profile))} flex flex-col gap-4`}>
              {details}
            </div>
          </div>
        </section>
      )}

      {/* 폰의 ⓘ — 사진 위에 못 둔 것 전부와 궤도 · 참고 점수 고지 */}
      {profile && (
        <DetailSheet sheet={sheet} nickname={profile.nickname}>
          <div className={`${elementScope(supplyOf(profile))} flex flex-col gap-4`}>
            {details}
            <div className="overflow-hidden rounded-[1.75rem] bg-cream px-2 pt-3">
              <ApproachMap shape="arc" me={me} cards={mapCards} statusOf={statusOf} className="mx-auto max-w-[28rem]" />
            </div>
            <p className="text-[12px] leading-5 text-secondary">{teaser}</p>
            {notice !== null && <p className={TYPE_META}>{notice}</p>}
          </div>
        </DetailSheet>
      )}

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
          <div className={`${elementScope(supplyOf(profile))} flex flex-col gap-4 p-6`}>
            <div className="flex items-center gap-3">
              <span className="relative size-14 shrink-0 overflow-hidden rounded-full bg-[var(--tile)] text-[1.5rem] ring-2 ring-[var(--tile)]">
                <CandidatePhoto card={profile} />
              </span>
              <span className="grid size-10 place-items-center rounded-full bg-[var(--tile)]">
                <ElementSymbol element={supplyOf(profile)} className="size-6" />
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
  const known = elementOf(element);
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

/**
 * 누른 뒤의 한 줄 — 되돌릴 길(덱이 빈 뒤 · 지나친 인연), 실패, 방금 한 일(2초). 확인 창을 띄우지 않고 둔 다음에 알린다.
 * 한 화면에 한 자리에만 선다(카드 위 · 빈 날 · 지나친 인연).
 */
function Feedback({
  undo,
  working,
  failure,
  announcement,
  flash,
}: {
  undo: (() => void) | null;
  working: boolean;
  failure: string | null;
  announcement: string;
  flash: string;
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
      {/* 한 줄이 둘을 한다 — 보조기기에는 늘 읽히고, 눈에는 잠깐(`flash`)만 선다 */}
      <p
        role="status"
        className={
          flash !== '' && flash === announcement
            ? 'self-center rounded-full bg-surface px-3 py-1.5 text-center text-[13px] font-medium text-foreground ring-1 ring-border'
            : 'sr-only'
        }
      >
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
