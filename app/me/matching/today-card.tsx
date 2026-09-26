'use client';

import { useEffect, useRef, useState, type CSSProperties, type ReactNode, type RefObject } from 'react';

import { activityText } from '@/src/lib/presence';
import { ELEMENT_PICTURE_KO } from '@/src/lib/saju';

import { elementScope } from '../../ui/element-tone';
import { BUTTON_PRIMARY, BUTTON_SECONDARY } from '../../ui/buttons';
import { ElementSymbol } from '../../ui/element-symbol';
import { Icon } from '../../ui/icons';
import { CardPhotos, pagesPhotos } from './card-photos';
import { CandidatePhoto } from './candidate-photo';
import { elementOf, supplyOf, type DeckCard } from './deck-card';
import { reducedMotion } from '../../ui/motion';
import styles from './orbit.module.css';

/*
  **오늘의 인연 한 장 — 사진이 주인공이고, 넘기는 일은 단추가 한다**(운영자 2026-09-25, 시안 A · 기운 1안 · 끌기 없음).

  사진 위에는 **고르는 데 필요한 것만** 선다 — 이름 · 접속 · 점수 · 판정 · 채워 주는 기운 · 소개 한 줄. 까닭 · 기운의 문장 ·
  소개 전문 · 궤도 · 참고 점수 고지는 폰에서는 ⓘ 시트(`DetailSheet`)가, 넓은 화면에서는 옆 열이 든다.

  **끌지 않는다.** 요청 하나가 풀이권을 예약하고 여덟 글자를 여는 일이라 손맛보다 분명한 누름이 맞다 — 그래서 단추가 이
  화면의 주인공이다: 사진 **아래** 따로 서서(사진마다 대비가 갈리지 않게) 글자로 말하고, 「궁합 요청」이 채운 주 단추다.
  누르면 카드가 누른 쪽으로 옅게 빠지고 뒤에서 **진짜 다음 사람**이 커지며 올라온다. 되돌리면 떠난 쪽에서 다시 들어온다.
  줄인 움직임이면 움직임은 빠지고 끝 모습만 선다.

  **폰은 한 화면에 이 한 장이다** — `data-deck-fit` 이 서 있는 동안 문서가 뷰포트에 묶인다(`globals.css`).
*/

const EXIT_MS = 360;

/** 사진 없는 카드의 첫 글자 — 카드가 낮은 폰(375×667)에서도 이름 · 점수 줄에 안 얹히게 높이를 따라 줄고, 글 판 위쪽에 선다 */
const INITIAL_ON_CARD = 'pb-[min(55%,50dvh-8rem)] text-[min(9rem,18dvh)] lg:pb-[45%] lg:text-[9rem]';

type DeckActions = { undo: () => void; pass: () => void; request: () => void; canUndo: boolean; busy: boolean };

/**
 * 사진 판 — 지금 사람과 그 뒤에서 기다리는 다음 사람. `exit` 은 누른 쪽(`left` 넘김 · `right` 요청), `leaving` 은 빠지는 중.
 * `onInfo` 가 있으면 ⓘ 가 선다(폰만 — 넓은 화면은 옆 열이 같은 것을 든다).
 */
export function TodayCard({
  profile,
  next,
  exit,
  leaving,
  feedback,
  onInfo,
}: {
  profile: DeckCard;
  next: DeckCard | undefined;
  exit: 'left' | 'right' | null;
  leaving: boolean;
  feedback: ReactNode;
  onInfo: () => void;
}) {
  const panel = useRef<HTMLDivElement>(null);
  /** 방금 떠난 카드와 방향 — 되돌려 오면 그쪽에서 들어온다 */
  const lastExit = useRef<{ id: string; dir: 1 | -1 } | null>(null);

  useEffect(() => {
    if (exit !== null) lastExit.current = { id: profile.candidateUserId, dir: exit === 'right' ? 1 : -1 };
  }, [exit, profile.candidateUserId]);

  useEffect(() => {
    const back = lastExit.current;
    if (back === null || back.id !== profile.candidateUserId || panel.current === null || reducedMotion()) return;
    lastExit.current = null;
    panel.current.animate(
      [{ transform: `translateX(${back.dir * 10}%) scale(.96)`, opacity: 0 }, { transform: 'none', opacity: 1 }],
      { duration: 420, easing: 'cubic-bezier(.2,.8,.2,1)' },
    );
  }, [profile.candidateUserId]);

  const dir = exit === 'right' ? 1 : -1;
  /** 사진 막대가 서면 딱지 · ⓘ 가 그 아래로 내려선다 */
  const belowBars = pagesPhotos(profile);
  const cardStyle: CSSProperties = leaving
    ? { transform: `translateX(${dir * 10}%) scale(.96)`, opacity: 0, transition: `transform ${EXIT_MS}ms cubic-bezier(.4,0,.2,1), opacity 300ms ease` }
    : exit !== null
      ? { transform: 'scale(.985)', transition: 'transform 100ms ease-out' }
      : { transform: 'none' };
  const rise = leaving ? 1 : 0;
  const nextStyle: CSSProperties = {
    transform: `scale(${0.93 + 0.07 * rise})`,
    opacity: rise,
    transition: `transform ${EXIT_MS}ms cubic-bezier(.2,.8,.2,1), opacity ${EXIT_MS}ms ease`,
  };

  return (
    <div data-deck-fit="" className="relative min-h-0 flex-1 lg:aspect-[4/5] lg:flex-none">
      {next !== undefined && (
        <div
          key={next.candidateUserId}
          aria-hidden="true"
          inert
          style={nextStyle}
          className={`${elementScope(supplyOf(next))} absolute inset-0 overflow-hidden rounded-[2rem] bg-[var(--tile)] motion-reduce:transition-none`}
        >
          <CandidatePhoto card={next} initialClass={INITIAL_ON_CARD} />
          <FaceText card={next} />
        </div>
      )}

      <div
        key={profile.candidateUserId}
        ref={panel}
        style={cardStyle}
        className={`${elementScope(supplyOf(profile))} ${styles.arrive} absolute inset-0 select-none overflow-hidden rounded-[2rem] bg-[var(--tile)] shadow-[0_24px_48px_-24px_rgba(0,0,0,0.45)] motion-reduce:transition-none`}
      >
        <CardPhotos card={profile} bounce={panel} initialClass={INITIAL_ON_CARD} />

        {profile.exploration && (
          <span className={`${belowBars ? 'top-8' : 'top-4'} absolute left-4 inline-flex min-h-8 items-center gap-1.5 rounded-full bg-surface/95 px-3 text-[13px] font-semibold text-foreground shadow-sm`}>
            <Icon name="spark" className="size-4 text-[var(--ink)]" />
            색다른 인연
          </span>
        )}

        <button
          type="button"
          aria-label="자세히 보기"
          onClick={onInfo}
          className={`${belowBars ? 'top-8' : 'top-3'} absolute right-3 grid size-11 place-items-center rounded-full bg-black/50 text-white shadow-[0_2px_8px_rgb(0_0_0/0.25)] ring-1 ring-white/30 backdrop-blur-sm lg:hidden`}
        >
          <span aria-hidden="true" className="font-serif text-[1.2rem] font-bold italic">i</span>
        </button>

        <FaceText card={profile} />
      </div>

      {/*
        실패 · 잠깐 서는 안내 — 흐름 밖, 카드 위쪽에 뜬다. 흐름 안에 두면 폰에서 카드 아래로 삐져나와 한 화면이 깨진다
      */}
      <div className="pointer-events-none absolute inset-x-3 top-16 z-20 flex flex-col items-stretch gap-2 *:pointer-events-auto *:shadow-lg">
        {feedback}
      </div>
    </div>
  );
}

/**
 * 글 밑의 어둠막 — **흰 사진 위에서도 흰 글자가 읽히게**(2026-09-25). 막이 글보다 한참 위에서 옅게 시작해 글이 서는 자리에서는
 * 이미 짙다: 이름 줄 뒤가 검정 55% 이상이라 새하얀 사진이어도 큰 글자의 대비(3:1)를 넘고, 판정 · 소개 줄 뒤는 70~85% 다.
 * 멈춤이 여럿인 것은 막의 윗끝이 띠처럼 보이지 않게 하려는 것이다. 틴더 · 머티리얼의 「글 보호막」과 같은 방법이고,
 * 글자마다 옅은 그림자(`FACE_SHADOW`)를 한 겹 더 둔다 — 막이 얇은 윗줄의 가장자리를 세운다.
 */
const FACE_SCRIM =
  'linear-gradient(to top, rgb(0 0 0 / .86) 0%, rgb(0 0 0 / .78) 30%, rgb(0 0 0 / .62) 55%, rgb(0 0 0 / .38) 72%, rgb(0 0 0 / .14) 86%, transparent 100%)';
const FACE_SHADOW = '[text-shadow:0_1px_2px_rgb(0_0_0/0.45),0_0_14px_rgb(0_0_0/0.3)]';

/**
 * 사진 아래 끝의 글 — 이름 · 접속 · 점수, 판정, 채워 주는 기운, 소개 한 줄. 누름은 뒤의 사진으로 흘려보낸다 —
 * 글 위를 눌러도 사진이 넘어간다(`CardPhotos`). 글은 사진의 장 번호를 모른다
 */
function FaceText({ card }: { card: DeckCard }) {
  return (
    <div style={{ backgroundImage: FACE_SCRIM }} className={`${FACE_SHADOW} pointer-events-none absolute inset-x-0 bottom-0 flex flex-col gap-2.5 px-5 pb-5 pt-32 text-white`}>
      <div className="flex items-end justify-between gap-3">
        <div className="min-w-0">
          <h2 className="font-rounded truncate text-[2.25rem] leading-tight">{card.nickname}</h2>
          {card.activity != null && <p className="text-[13px] font-semibold text-white/85">{activityText(card.activity)}</p>}
        </div>
        <p className="flex shrink-0 items-baseline">
          <span className="sr-only">나와의 예측 궁합 점수 </span>
          <strong className="text-[2.75rem] font-bold leading-none tracking-[-0.04em] tabular-nums">{card.previewScore}</strong>
          <span className="ml-1 text-[13px] font-semibold text-white/85"> / 100</span>
        </p>
      </div>
      <p className="font-rounded text-[1.0625rem] leading-snug text-white/95">{card.verdict}</p>
      <SupplyOnPhoto card={card} />
      {card.intro !== null && <p className="line-clamp-1 text-[14px] leading-5 text-white/85">{card.intro}</p>}
    </div>
  );
}

/**
 * 사진 위의 「채워 주는 기운」 — 기운 칸(`Supply`)의 동그란 알을 사진 위로 옮긴 것. 색은 알에만 두고 글은 흰 글자,
 * 이름은 둥근 서체. 둘이면 알이 동전처럼 포개지고 이름은 「나무 · 불」. 알의 테는 궤도 지도 위 얼굴처럼 판 색 한 겹이다.
 * 보조기기는 기운 칸의 문장을 그대로 읽는다.
 */
function SupplyOnPhoto({ card }: { card: DeckCard }) {
  if (card.highlights.length === 0) return null;
  const names = card.highlights.map((highlight) => {
    const known = elementOf(highlight.element);
    return known !== null ? ELEMENT_PICTURE_KO[known] : highlight.element;
  });
  return (
    <div className="flex items-center gap-3">
      <span aria-hidden="true" className="flex shrink-0 -space-x-2.5 pl-1">
        {card.highlights.map((highlight) => {
          const known = elementOf(highlight.element);
          return (
            <span key={highlight.element} className={`${elementScope(known)} ${styles.breathe} grid size-11 place-items-center rounded-full`}>
              <span className="grid size-full place-items-center rounded-full bg-[var(--tile)]" style={{ boxShadow: '0 0 0 2px var(--surface)' }}>
                <ElementSymbol element={known} className="size-6" />
              </span>
            </span>
          );
        })}
      </span>
      <p className="flex min-w-0 flex-col">
        <span className="text-[12px] font-semibold leading-4 text-white/75">이 사람이 채워 주는 기운</span>
        <span className="font-rounded truncate text-[1.25rem] leading-7 text-white">{names.join(' · ')}</span>
        <span className="sr-only">
          {card.highlights.map((highlight) => (
            <span key={highlight.element}>{highlight.text} </span>
          ))}
        </span>
      </p>
    </div>
  );
}

/**
 * 단추 줄 — **사진 아래, 이 화면의 주인공.** 앱의 단추 단을 그대로 쓴다: 「궁합 요청」이 채운 주 단추로 가장 넓고,
 * 「다음 인연」은 흰 보조 단추, 되돌리기는 작은 동그라미. 셋 다 56px — 엄지 한 번에 닿는다. 보조기기 이름은 하는 일을
 * 끝까지 말하고(`다음 인연으로 지나가기`), 눈에 보이는 글자를 그 안에 품는다.
 */
export function DeckButtons({ actions }: { actions: DeckActions }) {
  return (
    <div className="flex shrink-0 items-center gap-2">
      <button
        type="button"
        aria-label="이전 인연으로 되돌리기"
        disabled={!actions.canUndo}
        onClick={actions.undo}
        className="grid size-14 shrink-0 place-items-center rounded-full bg-surface text-foreground ring-1 ring-border active:scale-95 disabled:text-muted disabled:opacity-60"
      >
        <Icon name="undo" />
      </button>
      <button
        type="button"
        aria-label="다음 인연으로 지나가기"
        disabled={actions.busy}
        onClick={actions.pass}
        className={`${BUTTON_SECONDARY} min-h-14! flex-1 whitespace-nowrap px-3!`}
      >
        <Icon name="close" className="size-5" />
        다음 인연
      </button>
      <button
        type="button"
        aria-label="상세 궁합 요청하기"
        disabled={actions.busy}
        onClick={actions.request}
        className={`${BUTTON_PRIMARY} min-h-14! flex-[1.3] whitespace-nowrap px-3!`}
      >
        <Icon name="heart" className="size-5" />
        궁합 요청
      </button>
    </div>
  );
}

/**
 * ⓘ 시트 — 폰에서 사진 위에 못 둔 것(까닭 · 기운의 문장 · 소개 전문 · 궤도 · 참고 점수 고지)을 아래에서 올려 보인다.
 * 제 안에서 스크롤하고, 손잡이를 아래로 끌거나 바깥을 누르거나 Esc 로 닫힌다. 넓은 화면은 같은 것을 옆 열이 든다.
 */
export function DetailSheet({ sheet, nickname, children }: { sheet: RefObject<HTMLDialogElement | null>; nickname: string; children: ReactNode }) {
  const press = useRef<number | null>(null);
  /** 손잡이를 아래로 끈 만큼(px) */
  const [drag, setDrag] = useState(0);

  const close = () => {
    const dialog = sheet.current;
    if (dialog === null || !dialog.open) return;
    const settle = () => { dialog.close(); setDrag(0); };
    if (reducedMotion()) { settle(); return; }
    dialog.animate([{ transform: `translateY(${drag}px)` }, { transform: 'translateY(100%)' }], { duration: 240, easing: 'cubic-bezier(.4,0,1,1)' }).onfinish = settle;
  };

  return (
    <dialog
      ref={sheet}
      aria-label={`${nickname} 님 자세히`}
      onClick={(event) => { if (event.target === event.currentTarget) close(); }}
      onCancel={(event) => { event.preventDefault(); close(); }}
      style={drag > 0 ? { transform: `translateY(${drag}px)` } : undefined}
      className="mb-0 mt-auto max-h-[85dvh] w-full max-w-none overflow-y-auto overscroll-contain rounded-t-[2rem] bg-background p-0 text-foreground backdrop:bg-black/40"
    >
      <div className="flex flex-col gap-4 px-5 pb-10">
        <div
          className="sticky top-0 z-10 -mx-5 flex touch-none select-none flex-col gap-2 bg-background px-5 pb-1 pt-3"
          onPointerDown={(event) => { press.current = event.clientY; event.currentTarget.setPointerCapture(event.pointerId); }}
          onPointerMove={(event) => { if (press.current !== null) setDrag(Math.max(0, event.clientY - press.current)); }}
          onPointerUp={() => {
            press.current = null;
            if (drag > 90) close();
            else setDrag(0);
          }}
          onPointerCancel={() => { press.current = null; setDrag(0); }}
        >
          <span aria-hidden="true" className="mx-auto h-1.5 w-10 rounded-full bg-border-strong" />
          <div className="flex items-center justify-between gap-3">
            <h2 className="font-rounded text-[1.5rem]">{nickname}</h2>
            <button type="button" onPointerDown={(event) => event.stopPropagation()} onClick={close} className="min-h-11 rounded-full px-3 text-[14px] font-semibold text-secondary">
              닫기
            </button>
          </div>
        </div>
        {children}
      </div>
    </dialog>
  );
}

/** 시트를 연다 — 아래에서 올라온다 */
export function openSheet(sheet: HTMLDialogElement | null) {
  if (sheet === null || sheet.open) return;
  sheet.showModal();
  if (!reducedMotion()) sheet.animate([{ transform: 'translateY(100%)' }, { transform: 'translateY(0)' }], { duration: 320, easing: 'cubic-bezier(.2,.8,.2,1)' });
}

/**
 * 덱 순번(폰) — 사진 위의 「01 / 03」이 사진 장 수로 읽혀(운영자 2026-09-25) 제목 줄의 점으로 옮겼다. 지금 사람이 긴 점,
 * 지나온 사람은 진한 점, 남은 사람은 옅은 점. 글로는 보조기기에만 순번을 읽힌다.
 */
export function DeckDots({ at, total, counter }: { at: number; total: number; counter: string }) {
  if (total < 2) return null;
  return (
    <p className="flex items-center gap-1 pr-1">
      <span className="sr-only">나와 맞는 오늘의 인연 {counter}</span>
      {Array.from({ length: total }, (_, index) => (
        <span
          key={index}
          aria-hidden="true"
          className={`h-1.5 rounded-full transition-[width] ${index === at ? 'w-4 bg-foreground' : index < at ? 'w-1.5 bg-[color-mix(in_srgb,var(--foreground)_45%,transparent)]' : 'w-1.5 bg-border-strong'}`}
        />
      ))}
    </p>
  );
}
