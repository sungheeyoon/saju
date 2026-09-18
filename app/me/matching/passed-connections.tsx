'use client';

import { useEffect, useRef, useState } from 'react';
import type { DeckCard } from './matching-experience';
import styles from './passed-connections.module.css';

function Symbol({ name }: { name: 'history' | 'close' | 'arrow' | 'back' | 'spark' }) {
  const paths = {
    history: <><path d="M3 10a9 9 0 1 1 2 8M3 4v6h6" /><path d="M12 7v5l3 2" /></>,
    close: <path d="m6 6 12 12M18 6 6 18" />,
    arrow: <path d="M5 12h14m-5-5 5 5-5 5" />,
    back: <path d="M19 12H5m5-5-5 5 5 5" />,
    spark: <path d="m12 3 2.5 6.5L21 12l-6.5 2.5L12 21l-2.5-6.5L3 12l6.5-2.5Z" />,
  };
  return <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">{paths[name]}</svg>;
}

/**
 * UI only. Examples are supplied only by the existing preview screen.
 * This component does not record passes, restore cards, or call matching actions.
 */
export function PassedConnections({ examples = [] }: { examples?: readonly DeckCard[] }) {
  const dialog = useRef<HTMLDialogElement>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const heading = useRef<HTMLHeadingElement>(null);
  const rows = useRef(new Map<string, HTMLButtonElement>());
  const lastRow = useRef<string | null>(null);
  const scroll = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const [closing, setClosing] = useState(false);
  const [selected, setSelected] = useState<DeckCard | null>(null);
  const [feedback, setFeedback] = useState('');

  useEffect(() => () => { if (timer.current) clearTimeout(timer.current); }, []);
  useEffect(() => {
    if (!open) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = previous; };
  }, [open]);
  useEffect(() => {
    if (selected) {
      if (scroll.current) scroll.current.scrollTop = 0;
      heading.current?.focus({ preventScroll: true });
    }
  }, [selected]);

  function show() {
    if (timer.current) clearTimeout(timer.current);
    setSelected(null);
    setFeedback('');
    setClosing(false);
    dialog.current?.showModal();
    setOpen(true);
    if (scroll.current) scroll.current.scrollTop = 0;
  }
  function close() {
    if (closing) return;
    setClosing(true);
    const duration = window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 0 : 240;
    timer.current = setTimeout(() => { dialog.current?.close(); setOpen(false); setClosing(false); }, duration);
  }
  function back() {
    setSelected(null);
    setFeedback('');
    requestAnimationFrame(() => { if (lastRow.current) rows.current.get(lastRow.current)?.focus(); });
  }

  return <>
    <button className={styles.trigger} onClick={show} aria-haspopup="dialog" aria-expanded={open} aria-controls="passed-connections-panel">
      <Symbol name="history" /><span>지나친 인연</span>
      {examples.length > 0 && <span className={styles.count} aria-label={`예시 ${examples.length}명`}>{examples.length}</span>}
    </button>
    <dialog id="passed-connections-panel" ref={dialog} className={`${styles.panel} ${closing ? styles.closing : ''}`} aria-labelledby="passed-title" onCancel={(event) => { event.preventDefault(); close(); }} onClose={() => setOpen(false)} onClick={(event) => { if (event.target === event.currentTarget) close(); }}>
      <div className={styles.sheet}>
        <div className={styles.handle} aria-hidden="true" />
        <header className={styles.header}>
          <div className={styles.overline}><span className={styles.dot} />{selected ? '다시, 알아가는 시간' : '스쳐간 인연을 다시 만나는 곳'}</div>
          <div className={styles.titleRow}><h2 id="passed-title">지나친 인연 <span>{examples.length > 0 ? examples.length : ''}</span></h2><button className={styles.close} onClick={close} aria-label="지나친 인연 닫기" autoFocus><Symbol name="close" /></button></div>
          {!selected && <p>잠깐 지나쳤어도, 다시 궁금해질 수 있으니까요.</p>}
        </header>

        <div ref={scroll} className={styles.scroll}>
          {selected ? <section className={styles.detail}>
            <button className={styles.back} onClick={back}><Symbol name="back" />목록으로</button>
            <div className={styles.portrait}>
              {selected.photoUrl ? <Photo src={selected.photoUrl} /> : <span className={styles.initial}>{selected.nickname.slice(0, 1)}</span>}
              <span className={styles.example}>예시 프로필</span>
              <h3 ref={heading} tabIndex={-1}>{selected.nickname}</h3>
            </div>
            <div className={styles.compatibility}>
              <p className={styles.scoreLabel}>나와의 예측 궁합 <span>예시 점수</span></p>
              <div className={styles.scoreRow}><p><strong>{selected.previewScore}</strong><span> / 100</span></p><span>{selected.verdict}</span></div>
              <p className={styles.reason}><Symbol name="spark" />{selected.highlights[0]?.text ?? selected.reason}</p>
            </div>
            <div className={styles.introduction}><h4>이런 사람이에요</h4><p>{selected.intro || '자기소개 없음'}</p></div>
            <p className={styles.gentle}>한 번 더 알아보고 싶은 마음,<br />그것도 인연의 시작일 수 있어요.</p>
          </section> : examples.length > 0 ? <>
            <div className={styles.listHeader}><span>최근 지나친 순</span><span className={styles.demoBadge}>예시 목록</span></div>
            <ul className={styles.list}>
              {examples.map((person, i) => <li key={person.candidateUserId} style={{ '--row-index': i } as React.CSSProperties}>
                <button ref={(node) => { if (node) rows.current.set(person.candidateUserId, node); else rows.current.delete(person.candidateUserId); }} className={styles.person} onClick={() => { lastRow.current = person.candidateUserId; setSelected(person); }} aria-label={`${person.nickname}, 예측 궁합 ${person.previewScore}점, 다시 살펴보기`}>
                  <span className={styles.thumbnail}>{person.photoUrl ? <Photo src={person.photoUrl} /> : <span className={styles.initial}>{person.nickname.slice(0, 1)}</span>}</span>
                  <span className={styles.personInfo}>
                    <span className={styles.personTop}><strong>{person.nickname}</strong><span className={styles.scorePill}>궁합 <b>{person.previewScore}</b><span>점</span></span></span>
                    <span className={styles.personReason}>{person.highlights[0]?.text ?? person.reason}</span>
                    <span className={styles.inspect}>다시 살펴보기 <Symbol name="arrow" /></span>
                  </span>
                </button>
              </li>)}
            </ul>
            <div className={styles.endnote}><span aria-hidden="true">緣</span><p>나에게 맞는 인연을 찾는 데<br />조금 더 시간이 걸려도 괜찮아요.</p></div>
          </> : <div className={styles.empty}>
            <span className={styles.emptyIcon}><Symbol name="history" /></span>
            <h3>지나친 인연이 여기에 모여요</h3>
            <p>다시 궁금해진 사람을 살펴보고,<br />한 번 더 알아갈 수 있는 자리예요.</p>
            <span className={styles.demoBadge}>목록 연결 준비 중</span>
          </div>}
        </div>

        <footer className={styles.footer}>
          {selected ? <>
            <button className={styles.primary} onClick={() => setFeedback('미리보기예요. 실제 카드 순서는 바뀌지 않아요.')}><Symbol name="history" />다시 만나보기<Symbol name="arrow" /></button>
            <p className={styles.feedback} role="status">{feedback || '카드 맨 앞으로 다시 가져오는 동작의 미리보기예요.'}</p>
          </> : <button className={styles.continue} onClick={close}>오늘의 인연 계속 보기 <Symbol name="arrow" /></button>}
          <p className={styles.disclaimer}>화면 미리보기 · 지나친 기록과 복원은 아직 연결되지 않았어요.</p>
        </footer>
      </div>
    </dialog>
  </>;
}

function Photo({ src }: { src: string }) {
  // eslint-disable-next-line @next/next/no-img-element -- Local preview assets only; no authenticated photo fetches.
  return <img src={src} alt="" draggable={false} />;
}
