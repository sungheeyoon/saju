import type { ReactNode } from 'react';

import { ELEMENTS, ELEMENT_PICTURE_KO, type Element } from '@/src/lib/saju';

import { elementScope } from '../../element-tone';
import { ElementSymbol } from '../../ui/element-symbol';
import type { DeckCard } from './matching-experience';
import type { MeMark } from './me-mark';
import styles from './orbit.module.css';

/*
  **내 궤도로 다가오는 인연** — 덱과 한 상태를 읽는 지도(시안 4차 warm 매칭의 `orbit-map.tsx` 를 제품 자리로 옮겼다).

  나는 가운데, 안쪽 궤도에 내 오행 다섯이 상생 차례(木 → 火 → 土 → 金 → 水)로 돌고, 여덟 글자의 20% 에 못 미치는
  기운은 점선의 빈 원이다(`me-mark.ts`). 오늘의 후보는 바깥 궤도에서 **자기가 채워 주는 오행의 각도**에 서서 기다리고,
  지금 보는 한 사람만 안으로 다가와 채워 주는 자리마다 휘어진 빛을 댄다 — 닿은 빈 원은 아래에서부터 그 파스텔로 차오른다.
  선은 자료에 있는 보완 기운만 나타내고, 후보의 명식은 안 보이므로 후보 점은 사진이다.

  그림의 문법은 둘이다. **거리는 관계다** — 바깥 궤도는 기다림, 안으로 들어온 자리는 다가옴, 가운데는 나. 그래서 지금
  후보는 바깥의 제 자리에서 안으로 들어와 서고(지나온 길이 옅은 점선으로 남는다), 넘기면 궤도 밖으로 날아가고, 요청하면
  가운데(나)로 빨려 든다. 사진을 끄는 만큼(`pull`) 미리 따라 움직인다. **각도는 무엇을 채우는가다** — 후보는 제가 채워
  주는 오행의 방향에 서므로, 기다리는 사람들의 자리만 봐도 내 어느 빈 곳으로 누가 오는지가 읽힌다. 색은 절제한다:
  채워지는 자리(선 · 차오르는 알 · 지금 후보의 테)에만 오행 색이 서고, 기다리는 얼굴은 채도를 낮춘다.
  모양은 둘이다: `round` 는 넓은 화면의 온 궤도, `arc` 는 폰의 **해돋이 띠**(궤도의 위쪽 반만 가로로 펴고 나는 띠 아래
  끝에 반쯤 떠오른 해처럼 선다). 좌표는 상자의 백분율이고 SVG 는 상자와 같은 비로 그려 선이 찌그러지지 않는다.

  누를 자리는 없다(보조기기에는 숨긴다) — 같은 일을 카드의 단추가 하고, 같은 뜻을 카드의 글이 말한다. 움직임은 줄인
  움직임 설정이면 끝 모습만 선다(`orbit.module.css` · `motion-reduce:` · 전역 `globals.css`).
*/

/** 지도 위 한 사람의 자리 — 지나친 인연 보기에서는 넘긴 사람이 `kept` 로 궤도에 남는다 */
export type MapStatus = 'current' | 'waiting' | 'passed' | 'requested' | 'kept';

type Shape = 'round' | 'arc';

type Ring = readonly [rx: number, ry: number];

const GEOMETRY: Record<
  Shape,
  {
    /** 상자의 가로 : 세로 — SVG viewBox 도 이 비로 선다 */
    aspect: number;
    center: { x: number; y: number };
    angle: Record<Element, number>;
    /** 보완 오행이 없는 후보가 설 빈 각도 */
    spare: readonly number[];
    /** 바깥 궤도에서 이웃한 두 후보가 떨어져 설 가장 좁은 각도 — 얼굴과 이름이 겹치지 않게 */
    gap: number;
    ring: Record<'element' | 'current' | 'waiting' | 'passed', Ring>;
  }
> = {
  round: {
    aspect: 1,
    center: { x: 50, y: 50 },
    angle: { 木: -90, 火: -18, 土: 54, 金: 126, 水: 198 },
    spare: [-54, 162, 90, 18],
    gap: 22,
    ring: { element: [19, 19], current: [36, 36], waiting: [45, 45], passed: [66, 66] },
  },
  arc: {
    aspect: 2.15,
    center: { x: 50, y: 100 },
    angle: { 木: -152, 火: -121, 土: -90, 金: -59, 水: -28 },
    spare: [-105, -75, -136, -44],
    gap: 13,
    ring: { element: [24, 52], current: [42, 80], waiting: [46.5, 87], passed: [70, 140] },
  },
};

const COMPACT_ELEMENT_RING: Ring = [31, 31];

/** 그림자 — 새 색을 짓지 않고 글자색을 옅게 쓴다 */
const SHADOW_SOFT = 'color-mix(in srgb, var(--foreground) 45%, transparent)';

const round2 = (value: number) => Math.round(value * 100) / 100;

function pointOf(shape: Shape, angle: number, [rx, ry]: Ring) {
  const { center } = GEOMETRY[shape];
  const rad = (angle * Math.PI) / 180;
  return { x: round2(center.x + rx * Math.cos(rad)), y: round2(center.y + ry * Math.sin(rad)) };
}

const isElement = (value: string | undefined): value is Element =>
  value !== undefined && (ELEMENTS as readonly string[]).includes(value);

/** 그 사람이 채워 주는 첫 기운 — 서버가 준 차례 그대로다(「가장 강한」이라고 읽지 않는다) */
export const supplyOf = (card: DeckCard): Element | null => {
  const element = card.highlights[0]?.element;
  return isElement(element) ? element : null;
};

/**
 * 바깥 궤도의 자리 — 저마다 **자기가 채워 주는 오행의 각도**를 원하고, 이웃과 `gap` 보다 가까우면 서로 밀어 벌린다.
 *
 * 지금 후보는 제 각도를 유지하며 안쪽으로 들어온다. 기다리는 이웃 사이에 빈 자기 자리를 남겨 얼굴이 겹치지 않는다.
 * 후보가 바뀌어도 바깥의 자리는 그대로다 — 한 사람이 다가올 때 나머지 사람까지 움직이지 않는다.
 * 보완 오행이 없는 후보는 오행 사이의 빈 각도를 원한다.
 */
function anglesOf(shape: Shape, cards: readonly DeckCard[]): Record<string, number> {
  const { angle, spare, gap } = GEOMETRY[shape];
  const spares = [...spare];
  const circular = shape === 'round';
  const seats = cards.map((card) => {
    const supply = supplyOf(card);
    const want = supply !== null ? angle[supply] : (spares.shift() ?? angle.土);
    return { id: card.candidateUserId, at: want };
  });
  for (let round = 0; round < 40; round += 1) {
    seats.sort((x, y) => x.at - y.at);
    let moved = false;
    const pairs = seats.length > 1 ? seats.length - (circular ? 0 : 1) : 0;
    for (let i = 0; i < pairs; i += 1) {
      const left = seats[i];
      const right = seats[(i + 1) % seats.length];
      const between = (right.at - left.at + (i + 1 === seats.length ? 360 : 0));
      if (between >= gap - 0.01) continue;
      const push = gap - between;
      moved = true;
      left.at -= push / 2;
      right.at += push / 2;
    }
    if (!moved) break;
  }
  const out: Record<string, number> = {};
  for (const seat of seats) out[seat.id] = seat.at;
  return out;
}

const mix = (a: Ring, b: Ring, t: number): Ring => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t];

/** 후보 → 채워 줄 오행 자리. 곧은 선 대신 한쪽으로 살짝 휜 곡선 — 중점을 수직으로 민다 */
function curveOf(from: { x: number; y: number }, to: { x: number; y: number }, aspect: number) {
  const a = { x: from.x * aspect, y: from.y };
  const b = { x: to.x * aspect, y: to.y };
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const length = Math.hypot(dx, dy) || 1;
  const bend = Math.min(10, length * 0.35);
  const c = { x: (a.x + b.x) / 2 - (dy / length) * bend, y: (a.y + b.y) / 2 + (dx / length) * bend };
  return `M ${round2(a.x)} ${round2(a.y)} Q ${round2(c.x)} ${round2(c.y)} ${round2(b.x)} ${round2(b.y)}`;
}

const MOVE = 'transition-[left,top,opacity,transform] duration-[460ms] ease-[cubic-bezier(.2,.8,.2,1)] motion-reduce:transition-none';

/**
 * 지도 한 장. `pull` 은 사진을 끄는 만큼(-1 ~ 1): 왼쪽으로 끌면 지금 후보가 궤도 밖으로 물러나고, 오른쪽으로 끌면
 * 나에게로 다가온다. `faceOf` 는 후보 점에 설 얼굴 — 사진은 덱이 한 자리에서 그린다(`CandidatePhoto`).
 */
export function ApproachMap({
  shape,
  me,
  cards,
  statusOf,
  faceOf,
  pull = 0,
  dragging = false,
  compact = false,
  className = '',
}: {
  shape: Shape;
  me: MeMark | null;
  cards: readonly DeckCard[];
  statusOf: (card: DeckCard) => MapStatus;
  faceOf: (card: DeckCard) => ReactNode;
  pull?: number;
  dragging?: boolean;
  /** 빈 날 · 내 사주 없음의 작은 궤도 — 알이 작아지고 이름표가 빠진다 */
  compact?: boolean;
  className?: string;
}) {
  const base = GEOMETRY[shape];
  /* 작은 궤도는 가운데 원이 상자에 비해 커서, 오행 알이 나에게 얹히지 않게 안쪽 궤도를 넓힌다 */
  const geometry = compact ? { ...base, ring: { ...base.ring, element: COMPACT_ELEMENT_RING } } : base;
  const arc = shape === 'arc';
  const small = arc || compact;
  const current = cards.find((card) => statusOf(card) === 'current') ?? null;
  const angles = anglesOf(shape, cards);
  const supplied = current?.highlights.map((highlight) => highlight.element).filter(isElement) ?? [];
  const lit = supplied[0] ?? null;

  const ringOf = (status: MapStatus): Ring => {
    const { ring } = geometry;
    if (status === 'current') {
      if (pull > 0) return mix(ring.current, [ring.element[0] * 0.6, ring.element[1] * 0.6], pull * 0.5);
      if (pull < 0) return mix(ring.current, ring.passed, -pull * 0.35);
      return ring.current;
    }
    if (status === 'waiting' || status === 'kept') return ring.waiting;
    if (status === 'passed') return ring.passed;
    return [0, 0];
  };

  const ellipse = (ring: Ring) => ({
    cx: geometry.center.x * geometry.aspect,
    cy: geometry.center.y,
    rx: ring[0] * geometry.aspect,
    ry: ring[1],
  });

  const angleOf = (card: DeckCard) => angles[card.candidateUserId];


  /*
    지금 후보가 **어디서 왔는가** — 바깥 궤도의 제 자리에서 지금 선 곳까지 옅은 점선 한 줄. 궤도의 거리가 곧 관계의
    거리라서(밖 = 기다림, 안 = 다가옴, 가운데 = 나), 이 한 줄이 「다가오고 있다」를 멈춘 그림에서도 말한다.
  */
  const trail =
    current !== null
      ? {
          from: pointOf(shape, angles[current.candidateUserId], geometry.ring.waiting),
          to: pointOf(shape, angleOf(current), ringOf('current')),
        }
      : null;

  return (
    <div aria-hidden="true" className={`relative w-full ${className}`} style={{ aspectRatio: String(geometry.aspect) }}>
      {/* 지금 후보가 채워 주는 기운의 빛 — 가운데에서 번진다 */}
      <div
        className={`${elementScope(lit)} pointer-events-none absolute rounded-full transition-opacity duration-700 motion-reduce:transition-none ${
          lit !== null ? 'opacity-100' : 'opacity-0'
        }`}
        style={{
          left: '8%',
          width: '84%',
          top: arc ? '20%' : '8%',
          height: arc ? '160%' : '84%',
          background: 'radial-gradient(closest-side, color-mix(in srgb, var(--tile) 70%, transparent), transparent)',
        }}
      />

      <svg viewBox={`0 0 ${100 * geometry.aspect} 100`} className="absolute inset-0 size-full overflow-visible">
        {/* 안쪽 — 내 궤도. 옅은 먹 선 */}
        <ellipse
          {...ellipse(geometry.ring.element)}
          fill="none"
          stroke="color-mix(in srgb, var(--foreground) 16%, transparent)"
          strokeWidth={small ? 0.8 : 0.45}
        />
        {/* 바깥 — 기다리는 인연. 진주알처럼 둥근 점 */}
        <ellipse
          {...ellipse(geometry.ring.waiting)}
          fill="none"
          stroke="color-mix(in srgb, var(--foreground) 28%, transparent)"
          strokeWidth={small ? 1.6 : 0.9}
          strokeDasharray={small ? '0.01 4.2' : '0.01 2.4'}
          strokeLinecap="round"
        />
        {trail !== null && (
          <line
            key={`trail-${current?.candidateUserId}`}
            x1={trail.from.x * geometry.aspect}
            y1={trail.from.y}
            x2={trail.to.x * geometry.aspect}
            y2={trail.to.y}
            stroke="color-mix(in srgb, var(--foreground) 30%, transparent)"
            strokeWidth={arc ? 1.2 : 0.6}
            strokeDasharray={arc ? '0.01 3' : '0.01 1.8'}
            strokeLinecap="round"
            className={dragging ? 'opacity-0' : 'opacity-100 transition-opacity duration-700'}
          />
        )}
        {current !== null && supplied.map((element) => {
          const curve = curveOf(
            pointOf(shape, angleOf(current), ringOf('current')),
            pointOf(shape, geometry.angle[element], geometry.ring.element),
            geometry.aspect,
          );
          return (
            <g key={`${current.candidateUserId}-${element}`} className={elementScope(element)}>
              <path d={curve} fill="none" stroke="var(--mid)" strokeOpacity={0.4} strokeWidth={arc ? 5 : 3} strokeLinecap="round" className={`${styles.draw} blur-[3px]`} />
              <path d={curve} fill="none" stroke="var(--ink)" strokeWidth={arc ? 1.5 : 0.8} strokeLinecap="round" className={styles.draw} />
            </g>
          );
        })}
      </svg>

      <Me me={me} arc={arc} small={small} />

      {/* 안쪽 궤도 — 내 오행 다섯. 적은 기운은 점선의 빈 원, 후보가 닿으면 그 파스텔로 차오른다 */}
      {ELEMENTS.map((element) => {
        const at = pointOf(shape, geometry.angle[element], geometry.ring.element);
        const mine = me?.elements.find((one) => one.element === element) ?? null;
        return (
          <span
            key={element}
            className="absolute flex -translate-x-1/2 -translate-y-1/2 flex-col items-center"
            style={{ left: `${at.x}%`, top: `${at.y}%` }}
          >
            <Bead element={element} low={mine === null || mine.low} lit={supplied.includes(element)} unknown={mine === null} small={small} />
            {mine !== null && !compact && (
              <span
                className={`absolute top-full whitespace-nowrap font-semibold tabular-nums text-secondary ${arc ? 'mt-0.5 text-[12px]' : 'mt-1 text-[12px]'}`}
              >
                {ELEMENT_PICTURE_KO[element]} {mine.count}
              </span>
            )}
          </span>
        );
      })}

      {/* 바깥 — 오늘의 후보. 자리는 덱의 상태가 정한다 */}
      {cards.map((card) => {
        const status = statusOf(card);
        const at = pointOf(shape, angleOf(card), ringOf(status));
        const supply = supplyOf(card);
        const gone = status === 'passed' || status === 'requested';
        const now = status === 'current';
        /* 위쪽 반에 선 사람은 이름표를 위에 단다 — 아래에 달면 안쪽 궤도의 오행 자리에 얹힌다 */
        const above = Math.sin((angleOf(card) * Math.PI) / 180) < -0.3;
        return (
          <span
            key={card.candidateUserId}
            className={`${elementScope(supply)} absolute -translate-x-1/2 -translate-y-1/2 ${dragging && now ? '' : MOVE} ${
              gone ? 'scale-50 opacity-0' : 'scale-100 opacity-100'
            } ${now ? 'z-10' : ''}`}
            style={{ left: `${at.x}%`, top: `${at.y}%` }}
          >
            <span
              className={`relative block overflow-hidden rounded-full bg-[var(--tile)] transition-[width,height,box-shadow,filter,opacity] duration-700 motion-reduce:transition-none ${
                now ? (arc ? 'size-12' : 'size-[4.25rem]') : `${small ? 'size-9' : 'size-12'} opacity-85 saturate-[.55]`
              }`}
              style={{
                boxShadow: now
                  ? `0 0 0 3px var(--card), 0 0 0 7px var(--mid), 0 14px 30px -10px ${SHADOW_SOFT}`
                  : `0 0 0 2.5px var(--card), 0 6px 14px -8px ${SHADOW_SOFT}`,
              }}
            >
              {faceOf(card)}
            </span>
            {card.exploration && (
              <span className="absolute -right-1 -top-1 grid size-5 place-items-center rounded-full bg-[var(--card)] text-[var(--ink)] shadow-sm ring-1 ring-[var(--line)]">
                <Spark />
              </span>
            )}
            {!arc && !now && status === 'waiting' && (
              <span
                className={`absolute left-1/2 -translate-x-1/2 whitespace-nowrap text-[12px] font-semibold text-secondary ${above ? 'bottom-full mb-1' : 'top-full mt-1'}`}
              >
                {card.nickname}
              </span>
            )}
            {!arc && (now || status === 'kept') && (
              <span
                className={`absolute left-1/2 -translate-x-1/2 whitespace-nowrap rounded-full bg-[var(--card)] px-3 leading-7 text-foreground ring-1 ring-[var(--line)] ${
                  above ? 'bottom-full mb-2' : 'top-full mt-2'
                }`}
                style={{ boxShadow: `0 6px 14px -8px ${SHADOW_SOFT}` }}
              >
                <span className="font-rounded text-[15px]">{card.nickname}</span>
                {now && <span className="ml-1.5 text-[13px] font-bold tabular-nums text-[var(--ink)]">{card.previewScore}</span>}
              </span>
            )}
          </span>
        );
      })}
    </div>
  );
}

/** 가운데의 나 — 내 일간 글자가 제 오행의 파스텔 위에. 내 사주가 없으면 점선으로 빈다 */
function Me({ me, arc, small }: { me: MeMark | null; arc: boolean; small: boolean }) {
  const place = arc ? 'left-1/2 top-full size-[4.25rem]' : small ? 'left-1/2 top-1/2 size-16' : 'left-1/2 top-1/2 size-[5.25rem]';
  if (me === null || me.stem === null) {
    return (
      <span
        className={`${place} absolute grid -translate-x-1/2 -translate-y-1/2 place-items-center rounded-full border-2 border-dashed border-[color-mix(in_srgb,var(--foreground)_30%,transparent)] bg-[var(--card)]`}
      >
        <span className={`font-rounded ${arc ? '-translate-y-3 text-[15px]' : 'text-[17px]'} text-secondary`}>나</span>
      </span>
    );
  }
  return (
    <span
      className={`${elementScope(me.element)} ${place} absolute flex -translate-x-1/2 -translate-y-1/2 flex-col items-center rounded-full bg-[var(--tile)] ${
        arc ? 'justify-start pt-2' : 'justify-center'
      }`}
      style={{ boxShadow: `0 0 0 4px var(--card), 0 16px 30px -14px ${SHADOW_SOFT}` }}
    >
      <span className={`glyph font-bold leading-none text-[var(--ink)] ${small ? 'text-[1.35rem]' : 'text-[2.25rem]'}`}>{me.stem}</span>
      {!arc && !small && <span className="mt-1 rounded-full bg-[var(--ink)] px-1.5 text-[11px] font-bold leading-4 text-[var(--tile)]">나</span>}
    </span>
  );
}

/** 오행 한 알 — 상징이 늘 함께 서서 색만으로 말하지 않는다 */
function Bead({ element, low, lit, unknown, small }: { element: Element; low: boolean; lit: boolean; unknown: boolean; small: boolean }) {
  return (
    <span
      className={`${elementScope(element)} ${small ? 'size-9' : 'size-[3.25rem]'} relative grid place-items-center rounded-full transition-transform duration-700 motion-reduce:transition-none ${
        lit ? `${styles.breathe} scale-110` : ''
      } ${
        low
          ? `border-2 bg-[var(--card)] transition-[border-color] duration-700 ${lit ? 'border-solid border-[var(--ink)]' : 'border-dashed border-[color-mix(in_srgb,var(--ink)_60%,transparent)]'}`
          : 'bg-[var(--tile)] shadow-[0_0_0_2px_var(--card)] ring-1 ring-[color-mix(in_srgb,var(--ink)_22%,transparent)]'
      }`}
    >
      {low && (
        <span
          className="absolute inset-0 rounded-full bg-[color-mix(in_srgb,var(--mid)_55%,var(--tile))] transition-[clip-path] duration-[1100ms] ease-[cubic-bezier(.3,.7,.2,1)] motion-reduce:transition-none"
          style={{ clipPath: lit ? 'inset(0 0 0 0)' : 'inset(100% 0 0 0)', transitionDelay: lit ? '650ms' : '0ms' }}
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
        <svg aria-hidden="true" viewBox="0 0 22 10" className="h-2.5 w-[22px] overflow-visible">
          <path d="M1 8 Q 11 -2 21 6" fill="none" stroke="var(--mid)" strokeWidth="4" strokeOpacity="0.5" strokeLinecap="round" />
          <path d="M1 8 Q 11 -2 21 6" fill="none" stroke="var(--ink)" strokeWidth="1.4" strokeLinecap="round" />
        </svg>
        채워 주는 기운
      </li>
      <li className="flex items-center gap-1.5">
        <svg aria-hidden="true" viewBox="0 0 22 10" className="h-2.5 w-[22px] overflow-visible">
          <path d="M1 5 H 21" fill="none" stroke="currentColor" strokeWidth="2.2" strokeDasharray="0.01 4.5" strokeLinecap="round" />
        </svg>
        기다리는 인연
      </li>
    </ul>
  );
}

/**
 * 아무도 다가오지 않는 궤도 — 빈 날 · 다 만난 날 · 쉬는 중 · 내 사주 없음. 나와 내 오행 다섯만 서고 바깥 궤도는 빈다.
 * 내 사주가 없으면 가운데가 점선으로 비고, 다섯 자리도 아직 모른다(모두 빈 원).
 */
export function QuietOrbit({ me }: { me: MeMark | null }) {
  return (
    <div className="mx-auto w-full max-w-[13rem] sm:max-w-[14rem]">
      <ApproachMap shape="round" me={me} cards={[]} statusOf={() => 'waiting'} faceOf={() => null} compact />
    </div>
  );
}
