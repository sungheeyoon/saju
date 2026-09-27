'use client';

import { useState, type CSSProperties, type MouseEvent } from 'react';

import { ELEMENTS, ELEMENT_PICTURE_KO, type Element } from '@/src/lib/saju';

import { elementScope } from '../../ui/element-tone';
import { ElementSymbol } from '../../ui/element-symbol';
import { DotsMark, ORBIT_GLOW, ORBIT_LABEL_PAD, ORBIT_NAME_TAG, ORBIT_RING, ThreadMark, round2 } from '../../ui/orbit';
import { StemSymbol } from '../../ui/stem-symbol';
import { CandidatePhoto } from './candidate-photo';
import { elementOf, supplyOf, type DeckCard } from './deck-card';
import type { MeMark } from './me-mark';
import motion from './orbit-motion.module.css';
import {
  COMPACT_ELEMENT_RING,
  GEOMETRY,
  PULL_TWIST,
  anglesOf,
  curveOf,
  departureOf,
  pointOf,
  queueOf,
  spiralOf,
  type Departure,
  type MapStatus,
  type Ring,
  type Shape,
} from './orbit-seats';

export type { MapStatus } from './orbit-seats';

/*
  **내 궤도로 다가오는 인연** — 덱과 한 상태를 읽는 지도.

  나는 가운데, 안쪽 궤도에 내 오행 다섯이 상생 차례(木 → 火 → 土 → 金 → 水)로 돌고, 여덟 글자의 20% 에 못 미치는
  기운은 점선의 빈 원이다(`me-mark.ts`). 오늘의 후보는 바깥 궤도에서 **자기가 채워 주는 오행의 각도**에 서서 기다리고,
  지금 보는 한 사람만 안으로 다가와 채워 주는 자리마다 휘어진 빛을 댄다 — 닿은 빈 원은 아래에서부터 그 파스텔로 차오른다.
  **거리는 관계다**(바깥 = 기다림, 안 = 다가옴, 가운데 = 나), **각도는 무엇을 채우는가다.** 색은 채워지는 자리에만 선다.
  누가 어디에 서는가(줄 · 각도 · 궤도)는 `orbit-seats.ts` 가 정한다.

  **움직임은 바뀌는 순간에만 선다**(2026-09-27, 시안 b 「모션 · 인터랙션」). 사람은 궤도 좌표로 움직여(`orbit-motion.module.css`)
  전환 넷이 서로 다른 몸짓이 된다 — 다음 사람은 제 자리에서 곧장 안으로 **다가와 살짝 넘었다 선다**, 넘기면 **돌며 밖으로
  풀려 나가고** 선이 그 사람 쪽으로 감긴다, 요청하면 **돌며 가운데로 빨려 들고** 선이 내 오행 쪽으로 스며든 뒤 나에게
  **한 번의 물결**이 선다. 떠난 길은 나선으로 한 번 그어지고 사라진다. 새로 지도에 서는 사람(첫 그림 · 덱이 뒤에 새 사람을
  붙이거나 줄이 당겨질 때)은 먼 궤도에서 제 자리로 들어온다. 차례는 고정이다: 얼굴이 닿고(640ms) → 선이 그어지고(520ms 부터)
  → 빈 알이 차오르고(1000ms 부터) → 한 번 퍼진다(1700ms). 평소엔 고요하다 — 끝없이 반복되는 움직임은 없다.

  **누르기** — 얼굴을 누르면 기다리던 사람이 **반 걸음 안으로 기운다**(거리 = 관계라서 「눈여겨봄」도 거리로 말한다). 채울
  자리로 점선이 옅게 서고, 지도가 조금 줄며 비운 아래에 짧은 카드(얼굴 · 이름 · 참고 점수 · 채우는 기운)가 선다. 같은 얼굴이나
  빈 곳을 다시 누르면, 또는 덱이 움직이면 제자리로 돌아간다. 누르는 자리는 손가락 전용이고 보조기기에는 지도 전체를 숨긴다 —
  같은 일을 카드와 그 단추가 한다. 줄인 움직임 설정이면 모든 전환이 끝 모습으로 바로 선다.
*/

/**
 * 상태가 바뀐 순간을 잡는다 — 직전 상태를 기억해 두고 「지금」이던 사람이 떠나면 그 한 사람을 적는다(렌더 중 비교, React 의
 * 「이전 값 저장」 방식). `tick` 은 떠날 때마다 올라 한 번만 그을 것(길 · 물결)의 `key` 가 된다. `signature` 는 줄의 모양이다 —
 * 누른 카드가 덱이 움직이면 닫히게 쓴다.
 */
function useDeparture(cards: readonly DeckCard[], statusOf: (card: DeckCard) => MapStatus) {
  const statuses: Record<string, MapStatus> = {};
  for (const card of cards) statuses[card.candidateUserId] = statusOf(card);
  const signature = cards.map((card) => `${card.candidateUserId}:${statuses[card.candidateUserId]}`).join('|');
  const [memory, setMemory] = useState<{ signature: string; statuses: Record<string, MapStatus>; departure: (Departure & { tick: number }) | null }>(
    () => ({ signature, statuses, departure: null }),
  );
  if (memory.signature === signature) return { departure: memory.departure, signature };
  const left = departureOf(memory.statuses, statuses);
  const departure = left !== null ? { ...left, tick: (memory.departure?.tick ?? 0) + 1 } : memory.departure;
  setMemory({ signature, statuses, departure });
  return { departure, signature };
}

type SeatStyle = CSSProperties & Record<`--${string}`, string | number>;

/**
 * 지도 한 장. 후보 점에 서는 얼굴은 덱 · 지나친 인연과 같은 `CandidatePhoto` 다.
 */
export function ApproachMap({
  shape,
  me,
  cards,
  statusOf,
  compact = false,
  className = '',
}: {
  shape: Shape;
  me: MeMark | null;
  cards: readonly DeckCard[];
  statusOf: (card: DeckCard) => MapStatus;
  /** 빈 날 · 내 사주 없음의 작은 궤도 — 알이 작아지고 이름표가 빠진다 */
  compact?: boolean;
  className?: string;
}) {
  const base = GEOMETRY[shape];
  const geometry = compact ? { ...base, ring: { ...base.ring, element: COMPACT_ELEMENT_RING } } : base;
  const { center, aspect } = geometry;
  const arc = shape === 'arc';
  const small = arc || compact;
  const { departure, signature } = useDeparture(cards, statusOf);

  const { shown, overflow } = queueOf(cards, statusOf);
  const current = shown.find((card) => statusOf(card) === 'current') ?? null;
  /*
    떠나는 한 사람은 제 길을 다 갈 때까지 그리고, 자리 계산에도 넣어 둔다 — 나가는 동안 옆 사람이 그 자리로 미끄러지지 않게.
    다음에 누가 떠날 때 비로소 빠지므로 옆 사람의 자리 고침은 그 움직임에 섞인다.
  */
  const leavingCard = departure !== null ? (cards.find((card) => card.candidateUserId === departure.id) ?? null) : null;
  const leaving = leavingCard !== null && departure !== null && statusOf(leavingCard) === departure.kind ? departure : null;
  const seated = leaving !== null && leavingCard !== null ? [...shown, leavingCard] : shown;
  const angles = anglesOf(shape, seated);
  /*
    그리는 차례는 id 로 고정한다 — 줄의 차례로 그리면 React 가 떠나는 사람의 요소를 DOM 안에서 옮기고, 옮겨진 요소는 전환을
    잃어 끝 자리로 뛴다. 앞뒤 겹침은 `z-` 가 정한다.
  */
  const drawn = [...seated].sort((x, y) => (x.candidateUserId < y.candidateUserId ? -1 : 1));
  const queueIndex = (card: DeckCard) => shown.indexOf(card);

  /* 누른 사람 — 닫아도 이름은 남겨 두어 폰의 서랍이 접히는 동안 카드가 비지 않는다. 덱이 움직이면(`at` ≠ 지금 줄) 닫힌다 */
  const [picked, setPicked] = useState<{ id: string; open: boolean; at: string } | null>(null);
  const pickedCard = picked !== null ? (shown.find((card) => card.candidateUserId === picked.id) ?? null) : null;
  const open = pickedCard !== null && picked !== null && picked.open && picked.at === signature;
  const leaning = open && pickedCard !== null && statusOf(pickedCard) !== 'current' ? pickedCard : null;

  const suppliesOf = (card: DeckCard) =>
    card.highlights.map((highlight) => elementOf(highlight.element)).filter((element) => element !== null);
  const supplied = current !== null ? suppliesOf(current) : [];
  const hinted = leaning !== null ? suppliesOf(leaning) : [];
  const lit = supplied[0] ?? null;

  const ringOf = (card: DeckCard, status: MapStatus): Ring => {
    if (status === 'current') return geometry.ring.current;
    if (status === 'waiting' || status === 'kept') {
      return leaning?.candidateUserId === card.candidateUserId ? geometry.ring.peek : geometry.ring.waiting;
    }
    if (status === 'passed') return geometry.ring.far;
    return [0, 0];
  };

  /** 떠난 사람은 궤도를 더 돌아 선다 — 지나침은 바깥으로, 요청은 가운데로 */
  const angleOf = (card: DeckCard, status: MapStatus) => {
    const seat = angles[card.candidateUserId];
    if (status === 'passed') return seat + geometry.sweep;
    if (status === 'requested') return seat + PULL_TWIST;
    return seat;
  };

  const ellipse = (ring: Ring) => ({ cx: center.x * aspect, cy: center.y, rx: ring[0] * aspect, ry: ring[1] });

  const threadsOf = (card: DeckCard, elements: readonly Element[], from: Ring) =>
    elements.map((element) => ({
      element,
      d: curveOf(pointOf(center, angles[card.candidateUserId], from), pointOf(center, geometry.angle[element], geometry.ring.element), aspect),
    }));

  const toggle = (card: DeckCard) => (event: MouseEvent) => {
    event.stopPropagation();
    setPicked((was) =>
      was !== null && was.id === card.candidateUserId && was.open && was.at === signature
        ? { ...was, open: false }
        : { id: card.candidateUserId, open: true, at: signature },
    );
  };
  const close = () => setPicked((was) => (was !== null && was.open ? { ...was, open: false } : was));

  const map = (
    <div className="relative w-full" style={{ aspectRatio: String(aspect) }}>
      {/* 지금 후보가 채워 주는 기운의 빛 — 가운데에서 번진다 */}
      <div
        className={`${elementScope(lit)} pointer-events-none absolute rounded-full transition-opacity duration-700 motion-reduce:transition-none ${
          lit !== null ? 'opacity-100' : 'opacity-0'
        }`}
        style={{ left: '8%', width: '84%', top: arc ? '20%' : '8%', height: arc ? '160%' : '84%', background: ORBIT_GLOW }}
      />

      <svg viewBox={`0 0 ${100 * aspect} 100`} className="pointer-events-none absolute inset-0 size-full overflow-visible">
        {/* 안쪽 — 내 궤도. 옅은 먹 선 */}
        <ellipse
          {...ellipse(geometry.ring.element)}
          fill="none"
          stroke="color-mix(in srgb, var(--foreground) 16%, transparent)"
          strokeWidth={small ? 0.8 : 0.45}
        />
        {/* 바깥 — 기다리는 인연. 가만히 있는 진주알 점선(돌지 않는다) */}
        <ellipse
          {...ellipse(geometry.ring.waiting)}
          fill="none"
          stroke="color-mix(in srgb, var(--foreground) 24%, transparent)"
          strokeWidth={small ? 1.6 : 0.9}
          strokeDasharray={small ? '0.01 4.2' : '0.01 2.4'}
          strokeLinecap="round"
        />

        {/* 지금 후보가 지나온 길 — 바깥 제 자리에서 선 곳까지 옅은 점선. 도착한 뒤에 선다 */}
        {current !== null &&
          (() => {
            const from = pointOf(center, angles[current.candidateUserId], geometry.ring.waiting);
            const to = pointOf(center, angles[current.candidateUserId], geometry.ring.current);
            return (
              <line
                key={`trail-${current.candidateUserId}`}
                x1={from.x * aspect}
                y1={from.y}
                x2={to.x * aspect}
                y2={to.y}
                stroke="color-mix(in srgb, var(--foreground) 30%, transparent)"
                strokeWidth={arc ? 1.2 : 0.6}
                strokeDasharray={arc ? '0.01 3' : '0.01 1.8'}
                strokeLinecap="round"
                className={motion.late}
              />
            );
          })()}

        {/* 떠난 사람의 길 — 나선이 한 번 그어지고 사라진다 */}
        {leaving !== null && leavingCard !== null && (
          <path
            key={`wake-${leaving.tick}`}
            d={spiralOf(
              geometry,
              angles[leavingCard.candidateUserId],
              angleOf(leavingCard, leaving.kind),
              geometry.ring.current,
              leaving.kind === 'passed' ? geometry.ring.far : [0, 0],
            )}
            pathLength={1}
            fill="none"
            stroke="color-mix(in srgb, var(--foreground) 30%, transparent)"
            strokeWidth={arc ? 1.2 : 0.6}
            strokeLinecap="round"
            className={motion.wake}
          />
        )}

        {/* 떠난 사람의 선 — 지나침은 그 사람 쪽으로 감기고, 요청은 내 오행 쪽으로 스며든다 */}
        {leaving !== null &&
          leavingCard !== null &&
          threadsOf(leavingCard, suppliesOf(leavingCard), geometry.ring.current).map(({ element, d }) => (
            <path
              key={`leave-${leaving.tick}-${element}`}
              d={d}
              pathLength={1}
              fill="none"
              stroke="var(--ink)"
              strokeWidth={arc ? 1.5 : 0.8}
              strokeLinecap="round"
              className={`${elementScope(element)} ${leaving.kind === 'passed' ? motion.retractOut : motion.retractIn}`}
            />
          ))}

        {/* 지금 후보의 선 — 얼굴이 닿을 무렵부터 그어진다 */}
        {current !== null &&
          threadsOf(current, supplied, geometry.ring.current).map(({ element, d }) => (
            <g key={`${current.candidateUserId}-${element}`} className={elementScope(element)}>
              <path
                d={d}
                pathLength={1}
                fill="none"
                stroke="var(--mid)"
                strokeOpacity={0.4}
                strokeWidth={arc ? 5 : 3}
                strokeLinecap="round"
                className={`${motion.thread} blur-[3px]`}
              />
              <path d={d} pathLength={1} fill="none" stroke="var(--ink)" strokeWidth={arc ? 1.5 : 0.8} strokeLinecap="round" className={motion.thread} />
            </g>
          ))}

        {/* 기울인 사람이 채울 자리 — 아직 오지 않았으니 점선 */}
        {leaning !== null &&
          threadsOf(leaning, hinted, geometry.ring.peek).map(({ element, d }) => (
            <path
              key={`ghost-${leaning.candidateUserId}-${element}`}
              d={d}
              fill="none"
              stroke="var(--ink)"
              strokeOpacity={0.7}
              strokeWidth={arc ? 1.3 : 0.7}
              strokeDasharray={arc ? '0.01 3.2' : '0.01 1.9'}
              strokeLinecap="round"
              className={`${elementScope(element)} ${motion.ghost}`}
            />
          ))}
      </svg>

      <Me
        me={me}
        arc={arc}
        small={small}
        ripple={leaving?.kind === 'requested' && leavingCard !== null ? { tick: leaving.tick, element: supplyOf(leavingCard) } : null}
      />

      {/* 안쪽 궤도 — 내 오행 다섯. 적은 기운은 점선의 빈 원, 후보가 닿으면 그 파스텔로 차오른다 */}
      {ELEMENTS.map((element) => {
        const at = pointOf(center, geometry.angle[element], geometry.ring.element);
        const mine = me?.elements.find((one) => one.element === element) ?? null;
        return (
          <span
            key={element}
            className="pointer-events-none absolute flex -translate-x-1/2 -translate-y-1/2 flex-col items-center"
            style={{ left: `${at.x}%`, top: `${at.y}%` }}
          >
            <Bead
              element={element}
              settleKey={current?.candidateUserId ?? ''}
              low={mine === null || mine.low}
              lit={supplied.includes(element)}
              hinted={hinted.includes(element)}
              unknown={mine === null}
              small={small}
            />
            {mine !== null && !compact && (
              <span
                className={`${ORBIT_LABEL_PAD} absolute top-full whitespace-nowrap text-[12px] font-semibold tabular-nums text-secondary ${arc ? 'mt-0.5' : 'mt-1'}`}
              >
                {ELEMENT_PICTURE_KO[element]} {mine.count}
              </span>
            )}
          </span>
        );
      })}

      {/* 사람들 — 궤도 좌표로 선다. 자리는 덱의 상태가, 움직임의 곡선은 바뀐 쪽의 상태가 정한다 */}
      {drawn.map((card) => {
        const status = statusOf(card);
        const ring = ringOf(card, status);
        const angle = angleOf(card, status);
        const end = pointOf(center, angle, ring);
        const far = pointOf(center, angles[card.candidateUserId], geometry.ring.far);
        const supply = supplyOf(card);
        const gone = status === 'passed' || status === 'requested';
        const now = status === 'current';
        const leaned = leaning?.candidateUserId === card.candidateUserId;
        /* 위쪽 반에 선 사람은 이름표를 위에 단다 — 아래에 달면 안쪽 궤도의 오행 자리에 얹힌다 */
        const above = Math.sin((angles[card.candidateUserId] * Math.PI) / 180) < -0.3;
        const curve = now ? motion.arrive : status === 'passed' ? motion.pass : status === 'requested' ? motion.pull : motion.rest;
        const seat: SeatStyle = {
          '--orbit-cx': center.x,
          '--orbit-cy': center.y,
          '--orbit-rx': ring[0],
          '--orbit-ry': ring[1],
          '--orbit-a': `${round2(angle)}deg`,
          /* `sin()` 을 모르는 브라우저가 설 끝 자리와, 새로 선 사람이 들어오는 먼 자리 */
          '--orbit-x': end.x,
          '--orbit-y': end.y,
          '--orbit-far-x': far.x,
          '--orbit-far-y': far.y,
          /* 처음 그릴 때는 줄 차례대로 조금씩 늦게 모여들고, 뒤에 붙은 사람은 앞 사람이 떠난 뒤에 든다 */
          '--orbit-enter-delay': `${Math.max(0, queueIndex(card)) * 70}ms`,
          opacity: gone ? 0 : 1,
          scale: status === 'passed' ? '0.6' : status === 'requested' ? '0.3' : leaned ? '1.12' : '1',
        };
        return (
          <span
            key={card.candidateUserId}
            className={`${elementScope(supply)} ${motion.seat} ${motion.enter} ${curve} ${gone ? 'pointer-events-none' : ''} ${
              leaned ? 'z-20' : now ? 'z-10' : ''
            }`}
            style={seat}
          >
            <button
              type="button"
              tabIndex={-1}
              onClick={toggle(card)}
              className={`${motion.face} relative block cursor-pointer overflow-hidden rounded-full bg-[var(--tile)] ${
                now ? (arc ? 'size-12' : 'size-[4.25rem]') : `${small ? 'size-9' : 'size-12'} ${leaned ? '' : 'opacity-85 saturate-[.55]'}`
              }`}
              style={{ boxShadow: now || leaned ? ORBIT_RING.chosen : ORBIT_RING.resting }}
            >
              <CandidatePhoto card={card} />
            </button>
            {card.exploration && (
              <span className="pointer-events-none absolute -right-1 -top-1 grid size-5 place-items-center rounded-full bg-[var(--surface)] text-[var(--ink)] shadow-sm ring-1 ring-[var(--border)]">
                <Spark />
              </span>
            )}
            {!arc && !now && status === 'waiting' && (
              <span
                className={`${ORBIT_LABEL_PAD} pointer-events-none absolute left-1/2 -translate-x-1/2 whitespace-nowrap text-[12px] font-semibold text-secondary ${
                  above ? 'bottom-full mb-1' : 'top-full mt-1'
                }`}
              >
                {card.nickname}
              </span>
            )}
            {!arc && (now || status === 'kept') && (
              <span className={`${ORBIT_NAME_TAG} pointer-events-none ${above ? 'bottom-full mb-2' : 'top-full mt-2'}`} style={{ boxShadow: ORBIT_RING.tag }}>
                <span className="font-rounded text-[15px]">{card.nickname}</span>
                {now && <span className="ml-1.5 text-[13px] font-bold tabular-nums text-[var(--ink)]">{card.previewScore}</span>}
              </span>
            )}
          </span>
        );
      })}

      {/* 줄에서 아직 지도에 못 선 사람 수 — 궤도 밖(오른쪽 위 모서리)에 선다. 수가 바뀔 때 한 번 튄다 */}
      {overflow > 0 && (
        <span
          key={overflow}
          className={`${motion.count} pointer-events-none absolute right-[2%] top-[2%] rounded-full bg-[color-mix(in_srgb,var(--cream)_90%,transparent)] px-2 text-[12px] font-bold leading-6 tabular-nums text-secondary ring-1 ring-[color-mix(in_srgb,var(--foreground)_14%,transparent)]`}
        >
          +{overflow}
        </span>
      )}
    </div>
  );

  /*
    짧은 카드의 자리 — 넓은 화면(`round`)은 상자의 높이를 안 바꾼다: 지도가 위를 축으로 0.8 로 줄고 비운 아래 20% 에
    카드가 선다(오른쪽 칸의 범례 · 상세가 밀리지 않는다). 폰 띠(`arc`)는 납작해 비울 높이가 없으므로 지도 아래 서랍이 열린다.
  */
  if (arc) {
    return (
      <div aria-hidden="true" className={`w-full ${className}`} onClick={close}>
        {map}
        <div className={`${motion.drawer} grid`} style={{ gridTemplateRows: open ? '1fr' : '0fr' }}>
          <div className="min-h-0 overflow-hidden">
            {pickedCard !== null && (
              <div className="px-2 pb-3 pt-10">
                <PickedCard key={pickedCard.candidateUserId} card={pickedCard} now={statusOf(pickedCard) === 'current'} />
              </div>
            )}
          </div>
        </div>
      </div>
    );
  }
  return (
    <div aria-hidden="true" className={`relative w-full ${className}`} style={{ aspectRatio: String(aspect) }} onClick={close}>
      <div className={motion.layer} style={{ scale: open ? '0.8' : '1' }}>
        {map}
      </div>
      {open && pickedCard !== null && (
        <div className="absolute inset-x-[6%] bottom-0">
          <PickedCard key={pickedCard.candidateUserId} card={pickedCard} now={statusOf(pickedCard) === 'current'} />
        </div>
      )}
    </div>
  );
}

/** 누른 사람의 짧은 카드 — 새 문구 없이 이미 있는 것만: 얼굴 · 이름 · 참고 점수 · 채우는 기운의 상징과 이름 */
function PickedCard({ card, now }: { card: DeckCard; now: boolean }) {
  const supply = supplyOf(card);
  return (
    <div
      className={`${elementScope(supply)} ${motion.card} mx-auto flex max-w-[20rem] items-center gap-3 rounded-full bg-[var(--surface)] py-1.5 pl-1.5 pr-4 ring-1 ring-[var(--border)]`}
      style={{ boxShadow: ORBIT_RING.tag }}
      onClick={(event) => event.stopPropagation()}
    >
      <span
        className="relative block size-10 shrink-0 overflow-hidden rounded-full bg-[var(--tile)]"
        style={{ boxShadow: now ? '0 0 0 2px var(--mid)' : undefined }}
      >
        <CandidatePhoto card={card} />
      </span>
      <span className="font-rounded min-w-0 truncate text-[15px] text-foreground">{card.nickname}</span>
      <span className="text-[13px] font-bold tabular-nums text-[var(--ink)]">{card.previewScore}</span>
      {supply !== null && (
        <span className="ml-auto flex shrink-0 items-center gap-1 text-[12px] font-semibold text-secondary">
          <ElementSymbol element={supply} className="size-4" />
          {ELEMENT_PICTURE_KO[supply]}
        </span>
      )}
    </div>
  );
}

/**
 * 가운데의 나 — 내 천간 그림(`app/ui/stem-symbol.tsx`)과 「나」가 제 오행의 파스텔 위에. 내 사주가 없으면 점선으로 빈다.
 * 요청한 사람이 닿는 순간 그 기운의 색으로 한 번 물결이 선다.
 */
function Me({ me, arc, small, ripple }: { me: MeMark | null; arc: boolean; small: boolean; ripple: { tick: number; element: Element | null } | null }) {
  const place = arc ? 'left-1/2 top-full size-[4.25rem]' : small ? 'left-1/2 top-1/2 size-16' : 'left-1/2 top-1/2 size-[5.25rem]';
  const wave =
    ripple !== null ? (
      <span
        key={`ripple-${ripple.tick}`}
        className={`${elementScope(ripple.element)} ${motion.ripple} ${place} pointer-events-none absolute -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-[var(--mid)]`}
      />
    ) : null;
  if (me === null || me.stem === null) {
    return (
      <>
        {wave}
        <span
          className={`${place} pointer-events-none absolute grid -translate-x-1/2 -translate-y-1/2 place-items-center rounded-full border-2 border-dashed border-[color-mix(in_srgb,var(--foreground)_30%,transparent)] bg-[var(--surface)]`}
        >
          <span className={`font-rounded ${arc ? '-translate-y-3 text-[15px]' : 'text-[17px]'} text-secondary`}>나</span>
        </span>
      </>
    );
  }
  return (
    <>
      {wave}
      <span
        className={`${elementScope(me.element)} ${place} pointer-events-none absolute flex -translate-x-1/2 -translate-y-1/2 flex-col items-center rounded-full bg-[var(--tile)] ${
          arc ? 'justify-start pt-2' : 'justify-center'
        }`}
        style={{ boxShadow: ORBIT_RING.me }}
      >
        <StemSymbol stem={me.stem} className={arc ? 'size-9' : small ? 'size-7' : 'size-11'} />
        {/* 홈의 관계 지도와 같은 얼굴 — 천간 그림 아래 「나」. 작은 궤도(빈 날)에서도 선다 */}
        {!arc && (
          <span
            className={`rounded-full bg-[var(--ink)] px-1.5 font-bold text-[var(--tile)] ${small ? 'mt-0.5 text-[10px] leading-[14px]' : 'mt-1 text-[11px] leading-4'}`}
          >
            나
          </span>
        )}
      </span>
    </>
  );
}

/**
 * 오행 한 알 — 상징이 늘 함께 서서 색만으로 말하지 않는다. 차오른 뒤 한 번 퍼지고 멈춘다 — 그 한 번이 사람마다 다시 서도록
 * 퍼지는 테만 `key` 를 바꾼다(알 전체를 다시 세우면 차오름의 전환이 끊긴다). 기울인 사람이 채울 자리는 점선 테가 한 겹 더 선다.
 */
function Bead({
  element,
  settleKey,
  low,
  lit,
  hinted,
  unknown,
  small,
}: {
  element: Element;
  settleKey: string;
  low: boolean;
  lit: boolean;
  hinted: boolean;
  unknown: boolean;
  small: boolean;
}) {
  /* 채워진 알의 테 — 그 기운의 옅은 빛 한 겹. 틀 안의 그림자(`shadow-`)로 둬야 `ring-` 과 함께 겹친다 */
  const shadow = low
    ? lit
      ? 'shadow-[0_0_0_5px_color-mix(in_srgb,var(--mid)_30%,transparent)]'
      : ''
    : lit
      ? 'shadow-[0_0_0_2px_var(--surface),0_0_0_6px_color-mix(in_srgb,var(--mid)_30%,transparent)]'
      : 'shadow-[0_0_0_2px_var(--surface)]';
  return (
    <span
      className={`${elementScope(element)} ${small ? 'size-9' : 'size-[3.25rem]'} ${shadow} relative grid place-items-center rounded-full transition-[scale,box-shadow,border-color] duration-700 motion-reduce:transition-none ${
        lit ? 'scale-110' : ''
      } ${
        low
          ? `border-2 bg-[var(--surface)] ${lit ? 'border-solid border-[var(--ink)]' : 'border-dashed border-[color-mix(in_srgb,var(--ink)_60%,transparent)]'}`
          : 'bg-[var(--tile)] ring-1 ring-[color-mix(in_srgb,var(--ink)_22%,transparent)]'
      }`}
    >
      {lit && <span key={settleKey} className={`${motion.settle} absolute inset-0 rounded-full`} />}
      {hinted && !lit && <span className={`${motion.ghost} absolute -inset-1.5 rounded-full border-[1.5px] border-dashed border-[var(--ink)]`} />}
      {low && (
        <span
          className="absolute inset-0 rounded-full bg-[color-mix(in_srgb,var(--mid)_55%,var(--tile))] transition-[clip-path] duration-[900ms] ease-[cubic-bezier(.3,.7,.2,1)] motion-reduce:transition-none"
          style={{ clipPath: lit ? 'inset(0 0 0 0)' : 'inset(100% 0 0 0)', transitionDelay: lit ? '1000ms' : '0ms' }}
        />
      )}
      <ElementSymbol
        element={element}
        className={`${small ? 'size-5' : 'size-7'} relative transition-opacity duration-700 ${low && !lit ? (unknown ? 'opacity-35' : 'opacity-55') : 'opacity-100'}`}
      />
    </span>
  );
}

function Spark() {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24" className="size-3 fill-none stroke-current" strokeWidth="2" strokeLinejoin="round">
      <path d="M12 3.5 13.9 10l6.6 2-6.6 2L12 20.5 10.1 14l-6.6-2 6.6-2Z" />
    </svg>
  );
}

/** 지도 아래 범례 — 그림의 네 가지를 말로 */
export function Legend({ className = '' }: { className?: string }) {
  return (
    <ul className={`flex flex-wrap items-center gap-x-4 gap-y-2 text-[12px] font-medium text-secondary ${className}`}>
      <li className={`${elementScope('土')} flex items-center gap-1.5`}>
        <span aria-hidden="true" className="inline-block size-3.5 rounded-full bg-[var(--tile)] ring-1 ring-[color-mix(in_srgb,var(--ink)_30%,transparent)]" />
        오행 분포
      </li>
      <li className={`${elementScope('木')} flex items-center gap-1.5`}>
        <span aria-hidden="true" className="inline-block size-3.5 rounded-full border-[1.5px] border-dashed border-[color-mix(in_srgb,var(--ink)_60%,transparent)]" />
        적은 기운
      </li>
      <li className={`${elementScope('木')} flex items-center gap-1.5`}>
        <ThreadMark />
        채워 주는 기운
      </li>
      <li className="flex items-center gap-1.5">
        <DotsMark />
        기다리는 인연
      </li>
    </ul>
  );
}

/**
 * 아무도 다가오지 않는 궤도 — 빈 날 · 다 만난 날 · 쉬는 중 · 내 사주 없음. 나와 내 오행 다섯만 서고 바깥 궤도는 빈다.
 * 내 사주가 없으면 가운데가 점선으로 비고, 다섯 자리도 아직 모른다(모두 빈 원). 누를 사람이 없으니 움직임도 없다.
 */
export function QuietOrbit({ me }: { me: MeMark | null }) {
  return (
    <div className="mx-auto w-full max-w-[13rem] sm:max-w-[14rem]">
      <ApproachMap shape="round" me={me} cards={[]} statusOf={() => 'waiting'} compact />
    </div>
  );
}
