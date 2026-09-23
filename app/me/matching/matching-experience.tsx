'use client';

import { useEffect, useReducer, useRef, useState, useTransition, type CSSProperties, type PointerEvent } from 'react';
import { activityText, type ActivityBand } from '@/src/lib/presence';

import { MATCH_PILLARS_DISCLOSURE } from '@/src/lib/consent/notice';
import { DISCOVERY_EMPTY } from '@/src/lib/discovery';
import { initialOf } from '@/src/lib/profile';
import { REQUEST_RESERVES_NOTE } from '@/src/lib/reading/notes';

import { passCandidate, requestMatch, restorePassed } from '../discovery/actions';
import { RefreshBoard } from '../discovery/manage';
import styles from './matching.module.css';
import { deckReducer, PASSED_LIMIT } from './deck-state';
import { PassedConnections } from './passed-connections';
import { announceIfMoved } from '../reading/credits-signal';

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

/** 오행 하나가 카드에서 입는 색 — 토큰 이름은 모듈 CSS 가 든다 */
const TONE: Record<string, string> = {
  木: 'wood',
  火: 'fire',
  土: 'earth',
  金: 'metal',
  水: 'water',
};

type IconName = 'heart' | 'close' | 'undo' | 'arrow' | 'spark';
function Icon({ name }: { name: IconName }) {
  const paths: Record<IconName, React.ReactNode> = {
    heart: <path d="M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.7l-1.1-1.1a5.5 5.5 0 0 0-7.8 7.8L12 21l8.8-8.6a5.5 5.5 0 0 0 0-7.8Z" />,
    close: <path d="m6 6 12 12M18 6 6 18" />,
    undo: <path d="M4 10a8 8 0 1 1 1 8M4 4v6h6" />,
    arrow: <path d="M5 12h14m-5-5 5 5-5 5" />,
    spark: <path d="m12 3 2.5 6.5L21 12l-6.5 2.5L12 21l-2.5-6.5L3 12l6.5-2.5Z" />,
  };
  return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{paths[name]}</svg>;
}

/** 예시면 그 파일, 아니면 우리 라우트 — 사진이 없으면 이름의 첫 글자가 선다 */
export const photoOf = (card: DeckCard): string | null =>
  card.photoUrl ?? (card.hasPhoto ? `/me/photo/${card.candidateUserId}` : null);

// 고른 것을 읽을 시간을 주고 나서 카드가 떠난다 — CSS 도 같은 값을 쓴다.
const CHOICE_HOLD_MS = 700;
const CARD_EXIT_MS = 550;
const EMPTY_CARDS: readonly DeckCard[] = [];

export function MatchingExperience({
  cards,
  teaser,
  notice,
  explorationNote,
  waitSeconds,
  passed: passedFromServer = EMPTY_CARDS,
  preview = false,
}: {
  cards: readonly DeckCard[];
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
  const [offset, setOffset] = useState(0);
  const [dragging, setDragging] = useState(false);
  const [exit, setExit] = useState<'left' | 'right' | null>(null);
  const [leaving, setLeaving] = useState(false);
  const [announcement, setAnnouncement] = useState('');
  const [failure, setFailure] = useState<string | null>(null);
  const [working, startWorking] = useTransition();
  const start = useRef<{ x: number; y: number } | null>(null);
  // 끌고 나서 손을 떼면 click 이 한 번 더 온다 — 그 한 번만 삼킨다.
  const moved = useRef(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const detail = useRef<HTMLDialogElement>(null);
  const confirming = useRef<HTMLDialogElement>(null);
  const profile = deck.remaining[0];
  const tone = styles[TONE[profile?.highlights[0]?.element ?? ''] ?? 'water'];

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
    /*
      **카드 전체가 스와이프 면이다.** 예전에는 버튼 위에서 시작한 누름을 그냥 돌려보냈고,
      카드 아래쪽이 통째로 버튼이라 사진 위에서만 끌리는 화면이 됐다. 이제는 어디서
      시작하든 끌리고, 실제로 움직였을 때만 누름을 취소한다(`moved`).
    */
    moved.current = false;
    setDragging(true);
    start.current = { x: event.clientX, y: event.clientY };
    event.currentTarget.setPointerCapture(event.pointerId);
  }
  function pointerMove(event: PointerEvent<HTMLElement>) {
    if (!start.current || exit) return;
    const x = event.clientX - start.current.x;
    const y = event.clientY - start.current.y;
    if (Math.abs(y) > Math.abs(x) && Math.abs(x) < 15) { start.current = null; setDragging(false); setOffset(0); return; }
    if (Math.abs(x) > 8) moved.current = true;
    setOffset(x);
  }
  function pointerUp() {
    setDragging(false);
    if (!start.current) return;
    start.current = null;
    // 오른쪽으로 밀어도 **바로 안 나간다** — 확인 창이 먼저 선다.
    if (busy.current || exit) { setOffset(0); return; }
    if (offset > 85) { setOffset(0); confirming.current?.showModal(); return; }
    if (offset < -85) { pass(); return; }
    setOffset(0);
  }

  return <main className={`app-shell ${styles.page}`}>
    <div className={styles.topline}>
      <span><span className={styles.dot} /> 오늘의 인연</span>
      <PassedConnections cards={passed} preview={preview} working={working || exit === 'right'} onRestore={restoreCard} />
    </div>
    <div className={styles.layout}>
      <section className={styles.intro}>
        <p className="eyebrow">FIND YOUR PERSON</p>
        <h1>내 귀인은,<br />{' '}<em>내가 찾는다.</em></h1>
        <p className={styles.lead}>{teaser}</p>
        <div className={styles.editorial}><span className={styles.orbit} aria-hidden="true">緣</span><div><span className={styles.smallLabel}>나에게 맞는 사람을 찾는 기준</span><p>궁합으로 발견하고,<br />마음으로 선택하세요.</p></div></div>
        {notice !== null && <p className={styles.note}>{notice}</p>}
        <div className={styles.instructions}><span>← 다음 인연</span><span>상세 궁합 요청 →</span></div>
      </section>
      <section className={styles.experience} aria-label="인연 카드">
        <div className={styles.deckHeader}>
          <span>나와 맞는 오늘의 인연</span>
          <span><b>{String(Math.min(index + 1, total)).padStart(2, '0')}</b> / {String(total).padStart(2, '0')}</span>
        </div>
        <div className={styles.deck}>
          {profile ? <>
            <div className={styles.backCard} aria-hidden="true" />
            <article
              key={profile.candidateUserId}
              className={`${styles.card} ${tone} ${exit ? styles[exit] : ''} ${leaving ? styles.leaving : ''}`}
              aria-busy={!!exit || working}
              style={{ '--swipe-start': `translateX(${offset}px) rotate(${offset / 22}deg)`, '--exit-duration': `${CARD_EXIT_MS}ms`, transform: `translateX(${offset}px) rotate(${offset / 22}deg)`, transition: dragging ? 'none' : undefined } as CSSProperties}
              onClick={() => {
                // 끌어서 넘긴 손짓이 창을 열지 않게 한다.
                if (moved.current) { moved.current = false; return; }
                if (!exit) detail.current?.showModal();
              }}
              onPointerDown={pointerDown}
              onPointerMove={pointerMove}
              onPointerUp={pointerUp}
              onPointerCancel={() => { start.current = null; setDragging(false); setOffset(0); }}
              onLostPointerCapture={() => { start.current = null; setDragging(false); if (!exit) setOffset(0); }}
            >
              <div className={styles.visual}>
                {/*
                  **사진은 선택이다**(§5.1). 안 올린 사람 자리에는 이름의 첫 글자가 선다 —
                  빈 자리가 아니라 그 사람의 자리로 보이게. 바이트는 우리 라우트가 낸다.
                */}
                {photoOf(profile) !== null ? (
                  // eslint-disable-next-line @next/next/no-img-element -- 우리 라우트가 바이트를 내주므로 최적화기가 받아 갈 원본이 없다
                  <img src={photoOf(profile)!} alt="" className={styles.profilePhoto} draggable={false} />
                ) : (
                  <span className={styles.initial} aria-hidden="true">{initialOf(profile.nickname)}</span>
                )}
                <div className={styles.visualTop}>
                  {profile.exploration && <span className={styles.photoLabel}>색다른 인연</span>}
                  <span className={styles.serial}>緣 · {String(index + 1).padStart(2, '0')}</span>
                </div>
                <div className={styles.photoBottom}>
                  <div>
                    <h2>{profile.nickname}</h2>
                    {profile.activity != null && (
                      <p className={styles.activity}>{activityText(profile.activity)}</p>
                    )}
                  </div>
                </div>
                <span className={`${styles.swipeStamp} ${offset < 0 || exit === 'left' ? styles.passStamp : ''}`} style={{ opacity: exit ? 1 : Math.min(Math.abs(offset) / 85, 1) }}>
                  {offset < 0 || exit === 'left' ? '다음 인연' : '궁합이 궁금해요'}
                </span>
              </div>
              <div className={styles.cardBody}>
                <div className={styles.compatibility}>
                  <div className={styles.scoreHeading}><span>나와의 예측 궁합 점수</span><span className={styles.sampleScore}>{profile.balanceLabel}</span></div>
                  <div className={styles.scoreRow}>
                    <p className={styles.score}><strong>{profile.previewScore}</strong><span> / 100</span></p>
                    <div className={styles.verdict}><Icon name="spark" /><strong>{profile.verdict}</strong></div>
                  </div>
                  {/*
                    **첫 항목 하나만 선다.** 서버가 준 차례를 그대로 쓰고 「가장 강한
                    보완」이라고 읽지 않는다 — 그런 판정은 자료에 없다. 나머지를 세어
                    보이지는 않는다(「외 1개」는 카드에서 군더더기였다) — 상세를 열면
                    전부 있다.

                    **보완 오행이 없으면 `reason` 이 그 자리를 든다.** 없는 자리를 비워
                    두면 왜 이 사람인지가 카드에서 사라지고, 긍정적인 보완 문장을 지어
                    넣으면 자료에 없는 말을 하게 된다.
                  */}
                  {profile.highlights[0] !== undefined ? (
                    <p className={styles.highlight}>
                      <span>{profile.highlights[0].element}</span>
                      {profile.highlights[0].text}
                    </p>
                  ) : (
                    <p className={styles.cardReason}>{profile.reason}</p>
                  )}
                </div>
                {profile.intro !== null ? (
                  <p className={styles.cardIntro}>{profile.intro}</p>
                ) : (
                  <p className={`${styles.cardIntro} ${styles.introEmpty}`}>자기소개 없음</p>
                )}
              </div>
              {/*
                카드를 누르면 열린다 — 누르는 자리를 글자 한 줄로 좁히지 않는다. 보이지
                않는 이 단추는 **키보드와 화면 낭독기의 몫**이고, 눌린 것은 카드의
                `onClick` 이 받는다(한 번만 열리게).
              */}
              <button type="button" className={styles.tapTarget} disabled={!!exit} aria-label={`${profile.nickname} 님과의 예측 궁합 자세히 보기`} />
            </article>
          </> : (
            <div className={styles.empty}>
              <span className={styles.emptyArt}>緣</span>
              <h2>{cards.length === 0 ? DISCOVERY_EMPTY.title : '오늘의 인연을 모두 만났어요'}</h2>
              <p>{cards.length === 0 ? DISCOVERY_EMPTY.line : '지나친 인연을 다시 살펴보거나, 나중에 새로운 인연을 확인해 보세요.'}</p>
              {!preview && (
                <div className={styles.emptyActions}>
                  <RefreshBoard waitSeconds={waitSeconds} />
                </div>
              )}
            </div>
          )}
        </div>
        <div className={styles.controls}>
          <button className={styles.undo} aria-label="이전 인연으로 되돌리기" disabled={!hidden || working || exit === 'right'} onClick={undo}><Icon name="undo" /></button>
          <button className={styles.pass} aria-label="다음 인연으로 지나가기" disabled={!profile || !!exit || working} onClick={pass}><Icon name="close" /></button>
          <button className={styles.like} aria-label="상세 궁합 요청하기" disabled={!profile || !!exit || working} onClick={() => confirming.current?.showModal()}><Icon name="heart" /><span>궁합 요청</span></button>
        </div>
        <p className={styles.hint}>{profile ? '← 다음 인연 · 상세 궁합이 궁금하다면 하트 →' : '되돌리기로 이전 인연을 다시 볼 수 있어요'}</p>
        <div className={styles.progress} aria-label={`${total}명 중 ${index}명 확인`}>
          {[...deck.seen, ...deck.remaining.map((card) => card.candidateUserId)].map((id, i) => <span key={id} className={i < index ? styles.seen : i === index ? styles.current : ''} />)}
        </div>
        {/*
          **참고 점수라는 사실은 지우지 않고 자리를 옮긴다.** 좁은 화면에서는 이 줄을
          접고 상세 창이 든다(`scoreNote`) — 문구 자체는 그대로 서 있어서 본문을 읽는
          검사도 같은 것을 본다. 미리보기 안내는 접지 않는다: 그 화면에서만 서는 말이고,
          요청이 안 나간다는 사실은 화면에 보여야 한다.
        */}
        {preview ? (
          <p className={styles.disclaimer}>디자인 확인용 예시 프로필이며, 요청은 전송되지 않아요.</p>
        ) : (
          <p className={`${styles.disclaimer} ${styles.teaserLine}`}>{teaser}</p>
        )}
        {explorationNote !== null && <p className={`${styles.disclaimer} ${styles.explorationLine}`}>{explorationNote}</p>}
        {hidden !== null && (
          <p className={styles.undoBar}>
            지나친 인연에 보관했어요
            <button type="button" onClick={undo} disabled={working}>실행 취소</button>
          </p>
        )}
        {failure !== null && <p role="alert" className={styles.failure}>{failure}</p>}
        <p role="status" className={styles.status}>{announcement}</p>
      </section>
    </div>

    <dialog ref={detail} className={`${styles.dialog} ${tone}`} onClick={(event) => { if (event.target === event.currentTarget) detail.current?.close(); }}>
      {profile && <>
        {/* **사람이 먼저다.** 얼굴을 맨 위에 두고 그 아래에서 왜 이 사람인지를 읽는다. */}
        <div className={styles.detailPhoto}>
          {photoOf(profile) !== null ? (
            // eslint-disable-next-line @next/next/no-img-element -- 우리 라우트가 바이트를 낸다
            <img src={photoOf(profile)!} alt="" className={styles.profilePhoto} />
          ) : (
            <span className={styles.initial} aria-hidden="true">{initialOf(profile.nickname)}</span>
          )}
          <strong className={styles.detailName}>{profile.nickname}</strong>
          <button className={styles.detailClose} aria-label="닫기" onClick={() => detail.current?.close()}><Icon name="close" /></button>
        </div>
        <p className={`eyebrow ${styles.detailEyebrow}`}>나의 귀인을 알아가는 시간</p>
        <h2>왜 나와 잘 맞을까요?</h2>
        <section className={styles.detailCompatibility} aria-label="예측 궁합의 이유">
          <div className={styles.scoreHeading}><span>나 × {profile.nickname} · 예측 궁합</span><span className={styles.sampleScore}>{profile.balanceLabel}</span></div>
          <p className={styles.score}><strong>{profile.previewScore}</strong><span> / 100</span></p>
          <h3>{profile.verdict}</h3>
          {profile.highlights.map((highlight) => (
            <strong key={highlight.element} className={styles.detailHighlight}>{highlight.element} {highlight.text}</strong>
          ))}
          <p>{profile.reason}</p>
          <p className={styles.scoreNote}>{teaser}</p>
        </section>
        <p className={styles.dialogIntro}>{profile.intro || '자기소개 없음'}</p>
        <button className={styles.dialogDone} onClick={() => { detail.current?.close(); confirming.current?.showModal(); }}>상세 궁합 요청하기</button>

      </>}
    </dialog>

    {/*
      **요청 확인 창은 목록과 같은 말을 한다.** 문구가 화면마다 갈리면 어느 쪽이
      실제로 나가는 약속인지 알 수 없다 — 셋 다 정책이 지어 온 문장이다.
    */}
    <dialog ref={confirming} className={styles.dialog} aria-labelledby="matching-confirm">
      {profile && <>
        <h2 id="matching-confirm">{profile.nickname} 님에게 상세 궁합을 요청할까요?</h2>
        <p className={styles.dialogIntro}>{REQUEST_RESERVES_NOTE}</p>
        <p className={styles.dialogIntro}>{MATCH_PILLARS_DISCLOSURE}</p>
        <p className={styles.confirmNote}>
          현재는 두 사람이 궁합풀이를 함께 보는 기능까지만 제공됩니다. 채팅이나 연락처
          교환 등 상대와 연락할 수 있는 기능은 아직 지원하지 않습니다.
        </p>
        <div className={styles.confirmActions}>
          <button className={styles.dialogDone} disabled={working} onClick={() => { confirming.current?.close(); send(); }}>요청 보내기</button>
          <button className={styles.confirmCancel} disabled={working} onClick={() => confirming.current?.close()}>취소</button>
        </div>
      </>}
    </dialog>
  </main>;
}
