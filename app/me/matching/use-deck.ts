'use client';

import { useEffect, useReducer, useRef, useState, useTransition } from 'react';

import { passCandidate, requestMatch, restorePassed } from '../discovery/actions';
import { outOfCreditsNow } from '../credits/asked-on-press';
import { useBuyCredits } from '../credits/buy-credits';
import { announceCreditsMoved, announceIfMoved } from '../credits/credits-signal';
import { reducedMotion } from '../../ui/motion';
import type { DeckCard } from './deck-card';
import { deckReducer, PASSED_LIMIT } from './deck-state';
import type { MapStatus } from './orbit-seats';

// 고른 것을 읽을 시간을 주고 나서 카드가 떠난다.
const CHOICE_HOLD_MS = 100;
const CARD_EXIT_MS = 360;
const FLASH_MS = 2000;
/** 요청 부름이 던졌다 — 서버가 받았는지 모른다. 보낸 요청은 인연 기록에 서므로 줄이 그리로 가는 링크를 단다(G-103) */
export const REQUEST_UNSURE = '요청이 갔는지 확인하지 못했어요. 인연 기록에서 확인해 주세요.';

/**
 * **오늘의 인연 덱의 상태와 누름 전부** — 화면(`matching-experience.tsx`)은 이것이 내준 값을 그리기만 한다.
 *
 * 넘기면 서버 보관함에 적고(`passCandidate` — 카드는 누르는 순간 떠나고 서버가 못 받으면 돌아온다), 요청은 확인 창을 지나야
 * 나가며(`requestMatch` — 서버가 받은 뒤에 떠난다), 되돌리기와 지나친 인연의 「다시 만나보기」는 같은 복원 경로를 쓴다
 * (`restorePassed`). 덱의 모양 바꾸기는 `deckReducer` 가, 떠나는 움직임의 박자와 알림 · 실패 줄은 여기가 든다.
 */
export function useDeck({ cards, passedFromServer }: { cards: readonly DeckCard[]; passedFromServer: readonly DeckCard[] }) {
  const [deck, dispatch] = useReducer(deckReducer, {
    remaining: cards, passed: passedFromServer.slice(0, PASSED_LIMIT), history: [], seen: [],
  });
  /*
    **순번은 덱 안의 자리다** — 덱은 떠난 만큼 채워지므로 「지금까지 본 수 / 전체」가 끝없이 자란다. 지금 사람이 첫
    자리(`01`)이고 덱에 선 사람이 전체다.
  */
  const total = deck.remaining.length;
  const passed = deck.passed;
  const hidden = deck.history[0] ?? null;
  const busy = useRef(false);
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
  /** 요청 확인 창이 열렸나 */
  const [asking, setAsking] = useState(false);
  const buy = useBuyCredits();
  const [checkingCredits, setCheckingCredits] = useState(false);

  /**
   * 궁합 요청 단추 — **풀이권이 0개면 요청 확인 창 대신 풀이권 창이다**(`useBuyCredits`). 요청 한 건이 풀이권 한 번을 잡으므로(ADR 0038) 0개인
   * 사람의 요청은 DB 가 거절한다 — 그 거절을 받으러 확인 창을 지나게 하지 않는다. 잔액은 누를 때 머리글과 같은 문으로 묻는다 —
   * 화면을 그릴 때 묻지 않는다. 못 물었으면 확인 창이고 DB 가 판정한다.
   */
  function askToRequest() {
    if (checkingCredits) return;
    setCheckingCredits(true);
    void (async () => {
      let spent = false;
      try {
        spent = await outOfCreditsNow();
      } catch {
        /* 부름이 던졌다(망) — 확인 창으로 간다. 요청을 보내면 DB 가 판정한다 */
      } finally {
        setCheckingCredits(false);
      }
      if (spent) buy.offer(0);
      else setAsking(true);
    })();
  }
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

  /**
   * 카드를 화면에서 떠나보낸다 — 움직임과 알림만 맡는다. 서버에 적는 일은 부르는 쪽이 맡는다 — 요청은 `requestMatch` 가
   * 끝난 뒤에 부르고, 지나침은 `passCandidate` 를 보내며 함께 부른다(`pass`)
   */
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

  /**
   * **지나침은 누르는 순간 카드를 넘긴다**(ADR 0115 「2026-10-08 덧」, 운영자 2026-10-08). 서버가 받기를 기다리면 저장과 후보를
   * 다시 그리는 왕복이 끝나야 카드가 움직였다. 서버가 못 받으면 `unpass` 로 그 사람을 맨 앞에 되세우고 실패를 알린다 —
   * 아직 돌던 이동 타이머도 걷는다(`cancelLeave`). 그러지 않으면 되세운 카드가 타이머에 다시 떠난다.
   *
   * **저장이 끝날 때까지 다음 누름은 막는다** — 또 지나치기 · 되돌리기(`restoreCard`) · 다시 만나보기 · 요청 모두
   * (`busy`, 단추는 `working`). Next 는 서버 액션을 차례로 보내니 순서는 서버에서 지켜지지만, 되돌릴 화면이 꼬인다:
   * 아직 확인 안 된 지나침 위에 되돌리기가 얹히면 그 지나침이 실패했을 때 되돌리기는 보관함에 없는 사람을 꺼내러 가고,
   * 지나침이 둘 겹치면 앞의 것이 실패했을 때 뒤의 사람과 차례를 다시 맞춰야 한다. 막으면 실패가 되돌릴 것은 늘 한 사람
   * 몫(`unpass`)이다. 카드가 떠나는 데 0.46초가 들어 연달아 누르는 빠르기는 어차피 그만큼에 묶인다.
   */
  function pass() {
    if (exit || busy.current || !profile) return;
    const passing = profile;
    setFailure(null);
    busy.current = true;
    /* 꽉 찬 보관함에서는 지나침이 끝 사람을 밀어낸다 — 실패하면 그 사람까지 되세우게 지나치기 전 목록을 든다 */
    const before = { passed: deck.passed, history: deck.history };
    dispatch({ type: 'pass', card: passing });
    leave('left', `${passing.nickname} 님을 지나친 인연에 두었어요.`, passing.candidateUserId);
    const putBack = (message: string) => {
      cancelLeave();
      dispatch({ type: 'unpass', card: passing, before });
      setAnnouncement('');
      setFailure(message);
    };
    startWorking(async () => {
      try {
        const result = await passCandidate(passing.candidateUserId);
        if (!result.ok) putBack(result.message);
      } catch {
        putBack('지나친 인연으로 옮기지 못했어요. 잠시 뒤 다시 시도해 주세요.');
      } finally { busy.current = false; }
    });
  }

  /** 궁합 요청 단추와 오른쪽 스와이프 모두 확인 창을 거친 뒤에 요청한다. */
  function send() {
    if (!profile || busy.current || exit) return;
    const sending = profile;
    const finish = () => leave('right', `${sending.nickname} 님에게 상세 궁합을 요청했어요.`, sending.candidateUserId);
    setFailure(null);
    busy.current = true;
    startWorking(async () => {
      try {
        const result = await requestMatch(sending.candidateUserId);
        announceIfMoved(result);
        /* 잔액을 본 뒤 그 사이 다른 탭에서 마지막 풀이권을 썼다 — 오류 줄 대신 풀이권 창(ADR 0171 「덧」) */
        if (!result.ok && 'outOfCredits' in result) { announceCreditsMoved(); buy.offer(0); return; }
        if (!result.ok) { setFailure(result.message); return; }
        finish();
      } catch {
        setFailure(REQUEST_UNSURE);
      } finally { busy.current = false; }
    });
  }

  /** 보관함과 실행 취소가 같은 복원 경로를 사용한다. 실패하면 이력도 그대로 둔다. */
  async function restoreCard(back: DeckCard): Promise<string | null> {
    if (busy.current || exit === 'right') return '앞의 작업을 처리하고 있어요. 잠시 뒤 다시 눌러 주세요.';
    busy.current = true;
    setFailure(null);
    let message: string | null = null;
    await new Promise<void>((resolve) => startWorking(async () => {
      try {
        const result = await restorePassed(back.candidateUserId);
        if (!result.ok) { message = result.message; setFailure(message); return; }
        cancelLeave();
        dispatch({ type: 'restore', card: result.card, passed: result.passed });
        setAnnouncement(`${back.nickname} 님을 카드 맨 앞으로 가져왔어요.`);
        setFlash(`${back.nickname} 님을 카드 맨 앞으로 가져왔어요.`);
      } catch {
        message = '카드를 되돌리지 못했어요. 잠시 뒤 다시 시도해 주세요.';
        setFailure(message);
      } finally { busy.current = false; resolve(); }
    }));
    return message;
  }

  function undo() {
    if (hidden) void restoreCard(hidden);
  }

  /**
   * 카드의 「⋯」로 차단했다 — 그 사람을 덱에서 뺀다(`leave` 는 `seen` 에도 적어 뒤에 오는 서버 목록이 다시 세우지 않는다).
   * 서버도 차단한 사람을 후보에서 거르고 응답이 이 화면을 다시 그리지만, 그때까지 그 얼굴이 서 있으면 안 된다.
   * 열려 있던 ⓘ 시트는 화면이 먼저 닫는다.
   */
  function blocked(card: DeckCard) {
    dispatch({ type: 'leave', id: card.candidateUserId });
    const said = `${card.nickname} 님을 차단했어요.`;
    setAnnouncement(said);
    setFlash(said);
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
  const counter = `${String(Math.min(1, total)).padStart(2, '0')} / ${String(total).padStart(2, '0')}`;

  return {
    /** 지금 사람 — 덱이 비면 `undefined` */
    profile,
    /** 지금 사람 다음 — 카드 뒤에 겹쳐 선다 */
    next: deck.remaining[1],
    remaining: deck.remaining,
    passed,
    /** 되돌릴 수 있는 마지막 지나침 */
    hidden,
    total,
    counter,
    exit,
    leaving,
    announcement,
    flash,
    failure,
    working,
    asking,
    setAsking,
    buy,
    mapCards,
    statusOf,
    askToRequest,
    pass,
    send,
    restoreCard,
    undo,
    blocked,
  };
}
