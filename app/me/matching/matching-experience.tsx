'use client';

import { useEffect, useRef, useState, useTransition, type CSSProperties, type PointerEvent } from 'react';
import { useRouter } from 'next/navigation';

import { MATCH_PILLARS_DISCLOSURE } from '@/src/lib/consent/notice';
import { DISCOVERY_EMPTY } from '@/src/lib/discovery';
import { initialOf } from '@/src/lib/profile';
import { REQUEST_RESERVES_NOTE } from '@/src/lib/reading/notes';

import { passCandidate, requestMatch, restorePassed } from '../discovery/actions';
import { RefreshBoard, UnhideAll } from '../discovery/manage';
import styles from './matching.module.css';
import { PassedConnections } from './passed-connections';

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
const photoOf = (card: DeckCard): string | null =>
  card.photoUrl ?? (card.hasPhoto ? `/me/photo/${card.candidateUserId}` : null);

// 고른 것을 읽을 시간을 주고 나서 카드가 떠난다 — CSS 도 같은 값을 쓴다.
const CHOICE_HOLD_MS = 700;
const CARD_EXIT_MS = 550;

export function MatchingExperience({
  cards,
  teaser,
  notice,
  explorationNote,
  hiddenCount,
  waitSeconds,
  passed: passedFromServer = [],
  preview = false,
}: {
  cards: readonly DeckCard[];
  /** 서버가 든 보관함 — 새로 고쳐도 남는다 */
  passed?: readonly DeckCard[];
  teaser: string;
  notice: string | null;
  explorationNote: string | null;
  hiddenCount: number;
  waitSeconds: number;
  /** 디자인 확인용 — **요청이 나가지 않고**, 목록을 건드리는 누름도 서지 않는다 */
  preview?: boolean;
}) {
  const router = useRouter();
  const [index, setIndex] = useState(0);
  const [offset, setOffset] = useState(0);
  const [dragging, setDragging] = useState(false);
  const [exit, setExit] = useState<'left' | 'right' | null>(null);
  const [leaving, setLeaving] = useState(false);
  const [announcement, setAnnouncement] = useState('');
  const [failure, setFailure] = useState<string | null>(null);
  const [hidden, setHidden] = useState<DeckCard | null>(null);
  /**
   * **지나친 사람이 쌓이는 자리.**
   *
   * 목록을 서버에서 다시 읽지 않는다 — 감춘 사람의 프로필을 읽을 권한이 없기 때문이다
   * (`UnhideAll` 이 「몇 명」까지만 말하는 이유와 같다). X 를 누른 그 순간 카드를 손에
   * 들고 있으므로, 그것을 그대로 쌓아 두면 이름도 사진도 점수도 다시 안 물어도 된다.
   * **새로 고치면 비는 목록**이라는 뜻이기도 하다 — 지나친 기록을 화면 밖에서도 남기려면
   * 표가 하나 더 있어야 한다.
   */
  const [passed, setPassed] = useState<DeckCard[]>([...passedFromServer]);
  const [working, startWorking] = useTransition();
  const start = useRef<{ x: number; y: number } | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const detail = useRef<HTMLDialogElement>(null);
  const confirming = useRef<HTMLDialogElement>(null);
  const profile = cards[index];
  const tone = styles[TONE[profile?.highlights[0]?.element ?? ''] ?? 'water'];

  useEffect(() => () => { if (timer.current) clearTimeout(timer.current); }, []);

  /** 카드를 떠나보낸다 — 지나가는 것은 **이 자리에서만** 없어진다(서버에 안 적는다) */
  function leave(direction: 'left' | 'right', said: string) {
    setExit(direction);
    setDragging(false);
    setOffset(direction === 'right' ? 12 : -12);
    setAnnouncement(said);
    timer.current = setTimeout(() => {
      setLeaving(true);
      timer.current = setTimeout(() => {
        setIndex((n) => n + 1);
        setExit(null);
        setLeaving(false);
        setOffset(0);
        start.current = null;
      }, CARD_EXIT_MS);
    }, CHOICE_HOLD_MS);
  }

  /**
   * **X 는 보관이다.** 그냥 넘기는 것이 아니라 「지나친 인연」에 쌓이고, 새 추천에
   * 다시 서지 않는다 — 저장은 「다시 보지 않기」와 같은 표를 쓴다(`discovery_hidden`).
   * 부담 없이 넘기고 나중에 다시 꺼내 보는 것이 이 누름의 뜻이다.
   *
   * **여기서 `router.refresh()` 를 안 부른다.** 부르면 그 사람이 서버 목록에서 빠지며
   * 뒤 카드의 자리가 당겨지고, 그러면 되돌리기가 엉뚱한 카드를 가리킨다.
   */
  /** 예약된 이동을 물린다 — 되돌릴 때 이 타이머가 살아 있으면 복원 직후 또 넘어간다 */
  function cancelLeave() {
    if (timer.current) clearTimeout(timer.current);
    timer.current = null;
    setExit(null);
    setLeaving(false);
    setOffset(0);
  }

  function pass() {
    // **저장 중에는 또 못 누른다** — 느린 응답에서 두 번 쌓이거나 다른 누름과 엉킨다.
    if (exit || working || !profile) return;
    const passing = profile;

    if (preview) {
      setPassed((list) => [passing, ...list.filter((card) => card.candidateUserId !== passing.candidateUserId)]);
      leave('left', `${passing.nickname} 님을 지나친 인연에 두었어요.`);
      return;
    }

    setFailure(null);
    startWorking(async () => {
      const result = await passCandidate(passing.candidateUserId);
      if (!result.ok) {
        setFailure(result.message);
        return;
      }
      // 같은 사람을 다시 넘겨도 겹쳐 쌓지 않고 가장 최근 자리로 옮긴다.
      setPassed((list) => [passing, ...list.filter((card) => card.candidateUserId !== passing.candidateUserId)]);
      setHidden(passing);
      leave('left', `${passing.nickname} 님을 지나친 인연에 두었어요.`);
    });
  }

  /**
   * **요청은 확인 창을 지나야 난다**(PRD §4.x). 풀이권 1회 예약과 여덟 글자 공개,
   * 그리고 아직 연락 기능이 없다는 것까지 읽은 뒤에 나간다 — 스와이프 한 번으로
   * 그 셋을 건너뛰게 두지 않는다.
   */
  function send() {
    if (!profile || working) return;
    if (preview) {
      leave('right', `미리보기예요 — ${profile.nickname} 님에게 요청은 전송되지 않았어요.`);
      return;
    }
    setFailure(null);
    startWorking(async () => {
      const result = await requestMatch(profile.candidateUserId);
      if (!result.ok) {
        setFailure(result.message);
        return;
      }
      leave('right', `${profile.nickname} 님에게 상세 궁합을 요청했어요.`);
      router.refresh();
    });
  }

  /** 방금 둔 것을 물린다 — 한 장 뒤로 돌아가고 보관도 함께 지운다 */
  function undoHide() {
    if (hidden === null) return;
    const back = hidden;
    setHidden(null);

    /**
     * **자리가 아니라 id 로 돌아간다.**
     *
     * 한 장 뒤로 세면 그 사이 목록이 바뀌었을 때 엉뚱한 사람이 선다. 그 사람이 덱에
     * 있으면 그 자리로 가고, 없으면(이미 지나간 목록이면) 맨 앞에 세운다.
     */
    const restore = () => {
      cancelLeave();
      setPassed((list) => list.filter((card) => card.candidateUserId !== back.candidateUserId));
      const at = cards.findIndex((card) => card.candidateUserId === back.candidateUserId);
      setIndex(at >= 0 ? at : 0);
      setOffset(0);
      setAnnouncement(`${back.nickname} 님을 다시 추천받아요.`);
    };

    if (preview) {
      restore();
      return;
    }
    startWorking(async () => {
      const result = await restorePassed(back.candidateUserId);
      if (!result.ok) {
        setFailure(result.message);
        return;
      }
      restore();
    });
  }

  /**
   * 되돌리기 — **방금 둔 사람이 있으면 그것부터 물린다.**
   *
   * 자리만 한 장 뒤로 옮기면 이미 보관된 사람이 다시 서고, 화면은 그 사람을 추천하는데
   * 표에는 「안 받겠다」가 적혀 있는 상태가 된다.
   */
  function undo() {
    if (exit) return;
    if (hidden !== null) {
      undoHide();
      return;
    }
    if (index === 0) return;
    setIndex((n) => n - 1);
    setOffset(0);
    setAnnouncement('이전 인연으로 돌아왔어요.');
  }

  function pointerDown(event: PointerEvent<HTMLElement>) {
    if (exit || !event.isPrimary || event.button !== 0 || (event.target as HTMLElement).closest('button')) return;
    setDragging(true);
    start.current = { x: event.clientX, y: event.clientY };
    event.currentTarget.setPointerCapture(event.pointerId);
  }
  function pointerMove(event: PointerEvent<HTMLElement>) {
    if (!start.current || exit) return;
    const x = event.clientX - start.current.x;
    const y = event.clientY - start.current.y;
    if (Math.abs(y) > Math.abs(x) && Math.abs(x) < 15) { start.current = null; setDragging(false); setOffset(0); return; }
    setOffset(x);
  }
  function pointerUp() {
    setDragging(false);
    if (!start.current) return;
    start.current = null;
    // 오른쪽으로 밀어도 **바로 안 나간다** — 확인 창이 먼저 선다.
    if (working) { setOffset(0); return; }
    if (offset > 85) { setOffset(0); confirming.current?.showModal(); return; }
    if (offset < -85) { pass(); return; }
    setOffset(0);
  }

  return <main className={`app-shell ${styles.page}`}>
    <div className={styles.topline}>
      <span><span className={styles.dot} /> 오늘의 인연</span>
      <PassedConnections examples={passed} />
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
          <span><b>{String(Math.min(index + 1, cards.length)).padStart(2, '0')}</b> / {String(cards.length).padStart(2, '0')}</span>
        </div>
        <div className={styles.deck}>
          {profile ? <>
            <div className={styles.backCard} aria-hidden="true" />
            <article
              key={profile.candidateUserId}
              className={`${styles.card} ${tone} ${exit ? styles[exit] : ''} ${leaving ? styles.leaving : ''}`}
              aria-busy={!!exit}
              style={{ '--swipe-start': `translateX(${offset}px) rotate(${offset / 22}deg)`, '--exit-duration': `${CARD_EXIT_MS}ms`, transform: `translateX(${offset}px) rotate(${offset / 22}deg)`, transition: dragging ? 'none' : undefined } as CSSProperties}
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
                  <div><h2>{profile.nickname}</h2></div>
                </div>
                <span className={`${styles.swipeStamp} ${offset < 0 || exit === 'left' ? styles.passStamp : ''}`} style={{ opacity: exit ? 1 : Math.min(Math.abs(offset) / 85, 1) }}>
                  {offset < 0 || exit === 'left' ? '다음 인연' : '궁합이 궁금해요'}
                </span>
              </div>
              <div className={styles.cardBody}>
                <button className={styles.compatibility} disabled={!!exit} onClick={() => detail.current?.showModal()} aria-label={`${profile.nickname} 님과의 예측 궁합 ${profile.previewScore}점, 추천 이유 보기`}>
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
                </button>
                {profile.intro !== null ? (
                  <p className={styles.cardIntro}>{profile.intro}</p>
                ) : (
                  <p className={`${styles.cardIntro} ${styles.introEmpty}`}>자기소개 없음</p>
                )}
                <button className={styles.more} disabled={!!exit} onClick={() => detail.current?.showModal()}><span>궁합의 이유 보기</span><Icon name="arrow" /></button>
              </div>
            </article>
          </> : (
            <div className={styles.empty}>
              <span className={styles.emptyArt}>緣</span>
              <h2>{cards.length === 0 ? DISCOVERY_EMPTY.title : '오늘의 인연을 모두 만났어요'}</h2>
              <p>{cards.length === 0 ? DISCOVERY_EMPTY.line : '하루가 지나면 새로운 인연을 만나볼 수 있어요.'}</p>
              {!preview && (
                <div className={styles.emptyActions}>
                  <RefreshBoard waitSeconds={waitSeconds} />
                  <UnhideAll count={hiddenCount} />
                </div>
              )}
            </div>
          )}
        </div>
        <div className={styles.controls}>
          <button className={styles.undo} aria-label="이전 인연으로 되돌리기" disabled={index === 0 || !!exit} onClick={undo}><Icon name="undo" /></button>
          <button className={styles.pass} aria-label="다음 인연으로 지나가기" disabled={!profile || !!exit} onClick={pass}><Icon name="close" /></button>
          <button className={styles.like} aria-label="상세 궁합 요청하기" disabled={!profile || !!exit || working} onClick={() => confirming.current?.showModal()}><Icon name="heart" /><span>궁합 요청</span></button>
        </div>
        <p className={styles.hint}>{profile ? '← 다음 인연 · 상세 궁합이 궁금하다면 하트 →' : '되돌리기로 이전 인연을 다시 볼 수 있어요'}</p>
        <div className={styles.progress} aria-label={`${cards.length}명 중 ${index}명 확인`}>
          {cards.map((card, i) => <span key={card.candidateUserId} className={i < index ? styles.seen : i === index ? styles.current : ''} />)}
        </div>
        <p className={styles.disclaimer}>{preview ? '디자인 확인용 예시 프로필이며, 요청은 전송되지 않아요.' : teaser}</p>
        {explorationNote !== null && <p className={styles.disclaimer}>{explorationNote}</p>}
        {hidden !== null && (
          <p className={styles.undoBar}>
            앞으로 추천하지 않아요
            <button type="button" onClick={undoHide} disabled={working}>실행 취소</button>
          </p>
        )}
        {failure !== null && <p className={styles.failure}>{failure}</p>}
        <p role="status" className={styles.status}>{announcement}</p>
      </section>
    </div>

    <dialog ref={detail} className={styles.dialog} onClick={(event) => { if (event.target === event.currentTarget) detail.current?.close(); }}>
      {profile && <>
        <div className={styles.dialogTop}><span className="eyebrow">나의 귀인을 알아가는 시간</span><button aria-label="닫기" onClick={() => detail.current?.close()}><Icon name="close" /></button></div>
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
        <div className={styles.detailPhoto}>
          {photoOf(profile) !== null ? (
            // eslint-disable-next-line @next/next/no-img-element -- 우리 라우트가 바이트를 낸다
            <img src={photoOf(profile)!} alt="" className={styles.profilePhoto} />
          ) : (
            <span className={styles.initial} aria-hidden="true">{initialOf(profile.nickname)}</span>
          )}
        </div>
        {profile.intro !== null && <p className={styles.dialogIntro}>{profile.intro}</p>}
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
