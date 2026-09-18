'use client';

import Image from 'next/image';
import { previewSummaryFor } from '@/src/lib/discovery';
import { useEffect, useRef, useState, type CSSProperties, type PointerEvent } from 'react';
import styles from './matching.module.css';
import seoyeonPhoto from '../../../public/matching/seoyeon.webp';
import jiwooPhoto from '../../../public/matching/jiwoo.webp';
import harinPhoto from '../../../public/matching/harin.webp';

const profiles = [
  { previewScore: 79, suppliedElements: ['木'], balanceBand: 'even', highlight: '내게 적은 목(木) 기운을 보완해 줘요.', photo: seoyeonPhoto, name: '서연', age: 28, city: '서울 · 성동구', job: '브랜드 디자이너', element: '木', tone: 'wood', nature: '푸른 나무의 기운', intro: '좋아하는 것을 오래 좋아하는 사람이에요. 동네의 작은 카페, 밑줄이 많은 책, 그리고 편안한 대화를 좋아해요.', tags: ['동네 산책', '독립서점', '필름 사진'], question: '함께 보내고 싶은 주말은', answer: '늦은 아침 커피 한 잔, 목적지 없이 걷다가\n마음에 드는 작은 책방에 들르는 하루.', connection: '서로의 속도를 존중하는 만남', detail: '말이 많지 않아도 편안한 사이가 좋아요. 서로의 일상을 응원하면서, 작은 취향을 하나씩 알아가고 싶어요.' },
  { previewScore: 74, suppliedElements: ['火'], balanceBand: 'even', highlight: '내게 적은 화(火) 기운을 보완해 줘요.', photo: jiwooPhoto, name: '지우', age: 27, city: '서울 · 마포구', job: '공간 디자이너', element: '火', tone: 'fire', nature: '따뜻한 햇살의 기운', intro: '낯선 골목과 새로운 전시 앞에서 자주 멈춰요. 맛있는 한 끼를 함께 나눌 때 가장 행복한 사람이에요.', tags: ['전시 산책', '요리', '재즈'], question: '나를 웃게 하는 작은 일은', answer: '우연히 발견한 좋은 노래를\n좋아하는 사람에게 가장 먼저 들려주는 것.', connection: '일상에 따뜻함을 더하는 만남', detail: '호기심이 많고 마음을 표현하는 데 솔직한 편이에요. 거창한 계획보다 오늘의 재미있는 이야기를 나눌 수 있으면 좋겠어요.' },
  { previewScore: 68, suppliedElements: ['水'], balanceBand: 'mixed', highlight: '내게 적은 수(水) 기운을 보완해 줘요.', photo: harinPhoto, name: '하린', age: 29, city: '경기 · 수원시', job: '콘텐츠 에디터', element: '水', tone: 'water', nature: '잔잔한 물결의 기운', intro: '바쁜 날에도 나만의 작은 쉼을 챙겨요. 오래 걷고, 음악을 듣고, 마음에 남은 문장을 기록합니다.', tags: ['음악 감상', '러닝', '여행 기록'], question: '좋은 관계란 이런 것 같아요', answer: '각자의 하루를 보내고 돌아와\n아무 이야기나 꺼낼 수 있는 편안함.', connection: '깊은 대화로 이어지는 만남', detail: '잘 듣고 오래 기억하는 편이에요. 서로 다른 생각도 궁금해할 수 있는 사람, 함께 조용한 시간을 즐길 수 있는 사람을 만나고 싶어요.' },
] as const;

// Example values only. Reuse the existing discovery wording, without scoring or requesting a match.
const discoveryProfiles = profiles.map((profile) => ({ ...profile, ...previewSummaryFor(profile) }));

type IconName = 'heart' | 'close' | 'undo' | 'arrow' | 'spark' | 'pin';
function Icon({ name }: { name: IconName }) {
  const paths: Record<IconName, React.ReactNode> = {
    heart: <path d="M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.7l-1.1-1.1a5.5 5.5 0 0 0-7.8 7.8L12 21l8.8-8.6a5.5 5.5 0 0 0 0-7.8Z" />,
    close: <path d="m6 6 12 12M18 6 6 18" />,
    undo: <><path d="M4 10a8 8 0 1 1 1 8M4 4v6h6" /></>,
    arrow: <path d="M5 12h14m-5-5 5 5-5 5" />,
    spark: <path d="m12 3 2.5 6.5L21 12l-6.5 2.5L12 21l-2.5-6.5L3 12l6.5-2.5Z" />,
    pin: <><path d="M19 10c0 5-7 11-7 11S5 15 5 10a7 7 0 1 1 14 0Z" /><circle cx="12" cy="10" r="2" /></>,
  };
  return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{paths[name]}</svg>;
}

// Let the choice be read before the card leaves; CSS uses this same travel duration.
const CHOICE_HOLD_MS = 700;
const CARD_EXIT_MS = 550;

export function MatchingExperience() {
  const [index, setIndex] = useState(0);
  const [offset, setOffset] = useState(0);
  const [dragging, setDragging] = useState(false);
  const [exit, setExit] = useState<'left' | 'right' | null>(null);
  const [leaving, setLeaving] = useState(false);
  const [announcement, setAnnouncement] = useState('');
  const start = useRef<{ x: number; y: number } | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const dialog = useRef<HTMLDialogElement>(null);
  const profile = discoveryProfiles[index];
  useEffect(() => () => { if (timer.current) clearTimeout(timer.current); }, []);

  function choose(direction: 'left' | 'right') {
    if (exit || !profile) return;
    setExit(direction);
    setDragging(false);
    // Bring a dragged card back within reading distance during confirmation.
    setOffset(direction === 'right' ? 12 : -12);
    setAnnouncement(direction === 'right' ? `${profile.name}님과의 상세 궁합을 선택했어요. 예시 화면으로 요청은 전송되지 않아요.` : `${profile.name}님을 지나쳤어요.`);
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
  function undo() {
    if (exit || index === 0) return;
    setIndex((n) => n - 1); setOffset(0); setAnnouncement('이전 인연으로 돌아왔어요.');
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
    if (Math.abs(offset) > 85) choose(offset > 0 ? 'right' : 'left');
    else setOffset(0);
  }

  return <main className={`app-shell ${styles.page}`}>
    <div className={styles.topline}><span><span className={styles.dot} /> 오늘의 인연</span><span className={styles.preview}>미리보기 · 예시 프로필</span></div>
    <div className={styles.layout}>
      <section className={styles.intro}>
        <p className="eyebrow">FIND YOUR PERSON</p>
        <h1>내 귀인은,<br />{' '}<em>내가 찾는다.</em></h1>
        <p className={styles.lead}>나의 사주를 바탕으로, 나와 맞는 사람을 발견하세요.<br />서로의 기운을 채워 줄 인연, 그 시작은 나의 선택입니다.</p>
        <div className={styles.editorial}><span className={styles.orbit} aria-hidden="true">緣</span><div><span className={styles.smallLabel}>나에게 맞는 사람을 찾는 기준</span><p>궁합으로 발견하고,<br />마음으로 선택하세요.</p></div></div>
        <ol className={styles.journey}>
          <li><span>01</span><div><strong>나와의 궁합을 먼저 보고</strong><p>두 사람의 오행으로 살펴본 예측 궁합 점수</p></div></li>
          <li><span>02</span><div><strong>왜 잘 맞는지 알아보고</strong><p>내게 적은 기운과 상대가 보완해 주는 부분</p></div></li>
          <li><span>03</span><div><strong>궁금한 인연에게 한 걸음</strong><p>서로 동의하면 열리는 두 사람의 상세 궁합</p></div></li>
        </ol>
        <div className={styles.instructions}><span>← 다음 인연</span><span>상세 궁합 요청 →</span></div>
      </section>
      <section className={styles.experience} aria-label="인연 카드">
        <div className={styles.deckHeader}><span>나와 맞는 오늘의 인연</span><span><b>{String(Math.min(index + 1, profiles.length)).padStart(2, '0')}</b> / {String(profiles.length).padStart(2, '0')}</span></div>
        <div className={styles.deck}>
          {profile ? <>
            <div className={styles.backCard} aria-hidden="true" />
            <article key={index} className={`${styles.card} ${styles[profile.tone]} ${exit ? styles[exit] : ''} ${leaving ? styles.leaving : ''}`} aria-busy={!!exit} style={{ '--swipe-start': `translateX(${offset}px) rotate(${offset / 22}deg)`, '--exit-duration': `${CARD_EXIT_MS}ms`, transform: `translateX(${offset}px) rotate(${offset / 22}deg)`, transition: dragging ? 'none' : undefined } as CSSProperties} onPointerDown={pointerDown} onPointerMove={pointerMove} onPointerUp={pointerUp} onPointerCancel={() => { start.current = null; setDragging(false); setOffset(0); }} onLostPointerCapture={() => { start.current = null; setDragging(false); if (!exit) setOffset(0); }}>
              <div className={styles.visual}>
                <Image src={profile.photo} placeholder="blur" alt={`${profile.name}님의 AI 생성 예시 프로필 사진`} fill sizes="(max-width: 760px) 100vw, 440px" className={styles.profilePhoto} loading="eager" draggable={false} />
                <div className={styles.visualTop}><span className={styles.photoLabel}>AI 예시 사진</span><span className={styles.serial}>緣 · {String(index + 1).padStart(2, '0')}</span></div>
                <div className={styles.photoBottom}>
                  <div><h2>{profile.name} <span>{profile.age}</span></h2><p>{profile.job} · {profile.city}</p></div>
                  <span className={styles.elementBadge}>{profile.element} <span>{profile.nature}</span></span>
                </div>
                <span className={`${styles.swipeStamp} ${offset < 0 || exit === 'left' ? styles.passStamp : ''}`} style={{ opacity: exit ? 1 : Math.min(Math.abs(offset) / 85, 1) }}>{offset < 0 || exit === 'left' ? '다음 인연' : '궁합이 궁금해요'}</span>
              </div>
              <div className={styles.cardBody}>
                <button className={styles.compatibility} disabled={!!exit} onClick={() => dialog.current?.showModal()} aria-label={`${profile.name}님과의 예측 궁합 ${profile.previewScore}점, 추천 이유 보기`}>
                  <div className={styles.scoreHeading}><span>나와의 예측 궁합 점수</span><span className={styles.sampleScore}>예시 점수</span></div>
                  <div className={styles.scoreRow}><p className={styles.score}><strong>{profile.previewScore}</strong><span> / 100</span></p><div className={styles.verdict}><Icon name="spark" /><strong>{profile.verdict}</strong></div></div>
                  <p className={styles.highlight}><span>{profile.element}</span>{profile.highlight}<Icon name="arrow" /></p>
                </button>
                <p className={styles.cardIntro}>{profile.intro}</p>
                <div className={styles.tags}>{profile.tags.map((tag) => <span key={tag}>{tag}</span>)}</div>
                <button className={styles.more} disabled={!!exit} onClick={() => dialog.current?.showModal()}><span>궁합의 이유와 프로필 보기</span><Icon name="arrow" /></button>
              </div>
            </article>
          </> : <div className={styles.empty}><span className={styles.emptyArt}>緣</span><p className="eyebrow">UNTIL WE MEET AGAIN</p><h2>오늘의 인연을 모두 만났어요.</h2><p>나와 맞는 기운, 마음이 가는 사람.<br />나의 귀인이 될 인연을 찾으셨나요?</p><button onClick={() => { setIndex(0); setAnnouncement('첫 번째 인연부터 다시 만나요.'); }}>처음부터 다시 보기 <Icon name="undo" /></button></div>}
        </div>
        <div className={styles.controls}>
          <button className={styles.undo} aria-label="이전 인연으로 되돌리기" disabled={index === 0 || !!exit} onClick={undo}><Icon name="undo" /></button>
          <button className={styles.pass} aria-label="다음 인연으로 지나가기" disabled={!profile || !!exit} onClick={() => choose('left')}><Icon name="close" /></button>
          <button className={styles.like} aria-label="상세 궁합 요청하기" disabled={!profile || !!exit} onClick={() => choose('right')}><Icon name="heart" /><span>궁합 요청</span></button>
        </div>
        <p className={styles.hint}>{profile ? '← 다음 인연 · 상세 궁합이 궁금하다면 하트 →' : '되돌리기로 이전 인연을 다시 볼 수 있어요'}</p>
        <div className={styles.progress} aria-label={`${profiles.length}명 중 ${index}명 확인`}>{profiles.map((p, i) => <span key={p.name} className={i < index ? styles.seen : i === index ? styles.current : ''} />)}</div>
        <p className={styles.disclaimer}>오행 구성을 바탕으로 살펴보는 참고 점수예요.
현재 프로필·점수는 예시이며, 요청은 전송되지 않아요.</p>
        <p role="status" className={styles.status}>{announcement}</p>
      </section>
    </div>
    <dialog ref={dialog} className={styles.dialog} onClick={(event) => { if (event.target === event.currentTarget) dialog.current?.close(); }}>
      {profile && <>
        <div className={styles.dialogTop}><span className="eyebrow">나의 귀인을 알아가는 시간</span><button aria-label="프로필 상세 닫기" onClick={() => dialog.current?.close()}><Icon name="close" /></button></div>
        <h2>왜 나와 잘 맞을까요?</h2>
        <section className={styles.detailCompatibility} aria-label="예측 궁합의 이유">
          <div className={styles.scoreHeading}><span>나 × {profile.name} · 예측 궁합</span><span className={styles.sampleScore}>예시 점수</span></div>
          <p className={styles.score}><strong>{profile.previewScore}</strong><span> / 100</span></p>
          <h3>{profile.verdict}</h3>
          <div className={styles.elementConnection}><span>나에게 적은 기운</span><span className={styles.elementPair}>{profile.element}<span>←</span>{profile.element}</span><span>{profile.name}님이 가진 기운</span></div>
          <strong className={styles.detailHighlight}>{profile.highlight}</strong>
          <p>{profile.reason}</p>
          <p className={styles.scoreNote}>두 사람의 오행 구성으로 살펴본 참고 점수이며, 관계의 결과를 보장하지 않아요.</p>
        </section>
        <div className={styles.nextStep}><Icon name="heart" /><div><strong>더 깊은 궁합은, 서로의 선택 다음에</strong><p>상세 궁합을 요청하고 상대가 동의하면 두 사람의 궁합을 더 자세히 알아볼 수 있어요.</p></div></div>
        <h3 className={styles.profileHeading}>{profile.name}님은 이런 사람이에요</h3>
        <div className={styles.detailPhoto}><Image src={profile.photo} placeholder="blur" alt={`${profile.name}님의 AI 생성 예시 프로필 사진`} fill sizes="400px" className={styles.profilePhoto} /></div>
        <p className={styles.dialogIntro}>{profile.intro}</p><p className={styles.dialogIntro}>{profile.detail}</p>
        <div className={styles.prompt}><Icon name="spark" /><p>{profile.question}</p><blockquote>{profile.answer}</blockquote></div>
        <p className={styles.disclaimer}>프로필과 점수는 예시이며, 실제 궁합 요청은 전송되지 않아요.</p>
        <button className={styles.dialogDone} onClick={() => { dialog.current?.close(); choose('right'); }}>상세 궁합 요청해 보기 <span>· 미리보기</span></button>
      </>}

    </dialog>
  </main>;
}
