import Image from 'next/image';

import { initialOf } from '@/src/lib/profile';
import { ELEMENTS, ELEMENT_PICTURE_KO, type Element } from '@/src/lib/saju';

import type { DeckCard } from '../../../../matching/matching-experience';
import { rounded } from '../fonts';
import { ELEMENT_CLASS, ElementSymbol, NONE_CLASS } from '../symbols';
import styles from './orbit.module.css';

/*
  **4차 · 내 궤도로 다가오는 인연 — 관계 지도(orbit)의 생각을 부드러움의 말투로 새로 그렸다.**

  가져온 생각(orbit/matching 의 `approach-map.tsx` · `orbit-art.tsx`): 나는 가운데, 안쪽 궤도에 내 오행 다섯이
  상생 차례(木 → 火 → 土 → 金 → 水)로 돌고, 여덟 글자의 20% 에 못 미치는 기운은 빈 자리다. 오늘의 후보는 바깥
  궤도에서 **자기가 채워 주는 오행의 각도**에 서서 기다리고, 지금 보는 한 사람만 안으로 다가와 그 자리에 선을 댄다.
  선은 자료에 있는 관계(「이 기운을 채워 준다」) 하나뿐이고, 후보의 명식은 안 보이므로 후보 점은 사진이다.

  부드러움으로 바꾼 것: 한자 딱지 대신 **파스텔 원 + 다섯 상징**, 적은 기운은 점선의 빈 원, 선은 직선 점선 대신
  **휘어진 빛 한 줄**(굵은 번짐 위에 가는 선), 후보가 닿으면 빈 원이 아래에서부터 **그 파스텔로 차오른다**. 차가운
  회색 궤도 대신 크림 종이 위의 옅은 먹 선과 진주알 같은 점 궤도. 움직임은 줄인 움직임 설정이면 끝 모습만 선다.

  모양은 둘이다. `round` 는 넓은 화면의 온 궤도(정사각), `arc` 는 폰의 **해돋이 띠** — 궤도의 위쪽 반만 가로로
  펴고, 나는 띠 아래 끝에 반쯤 떠오른 해처럼 선다. 좌표는 상자의 백분율이고 SVG 는 상자와 같은 비로 그려 선이
  찌그러지지 않는다.
*/

export type MeMark = {
  stem: string;
  element: Element;
  elements: readonly { element: Element; count: number; low: boolean }[];
};

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
    /** 같은 오행을 채우는 후보끼리 벌리는 각도 */
    spread: number;
    ring: Record<'element' | 'current' | 'waiting' | 'passed', Ring>;
  }
> = {
  round: {
    aspect: 1,
    center: { x: 50, y: 50 },
    angle: { 木: -90, 火: -18, 土: 54, 金: 126, 水: 198 },
    spare: [-54, 162, 90, 18],
    spread: 24,
    ring: { element: [19, 19], current: [41, 41], waiting: [45, 45], passed: [66, 66] },
  },
  arc: {
    aspect: 5 / 2,
    center: { x: 50, y: 100 },
    angle: { 木: -152, 火: -121, 土: -90, 金: -59, 水: -28 },
    spare: [-105, -75, -136, -44],
    spread: 13,
    ring: { element: [24, 52], current: [43, 86], waiting: [46.5, 87], passed: [70, 140] },
  },
};

const COMPACT_ELEMENT_RING: Ring = [31, 31];

const round2 = (value: number) => Math.round(value * 100) / 100;

function pointOf(shape: Shape, angle: number, [rx, ry]: Ring) {
  const { center } = GEOMETRY[shape];
  const rad = (angle * Math.PI) / 180;
  return { x: round2(center.x + rx * Math.cos(rad)), y: round2(center.y + ry * Math.sin(rad)) };
}

const isElement = (value: string | undefined): value is Element =>
  value !== undefined && (ELEMENTS as readonly string[]).includes(value);

export const supplyOf = (card: DeckCard): Element | null => {
  const element = card.highlights[0]?.element;
  return isElement(element) ? element : null;
};

/** 같은 오행을 채우는 후보가 겹치지 않게 좌우로 벌린다 — 자리는 덱이 바뀌어도 사람마다 같다 */
function anglesOf(shape: Shape, cards: readonly DeckCard[]): Record<string, number> {
  const { angle, spare, spread } = GEOMETRY[shape];
  const used = new Map<number, number>();
  const spares = [...spare];
  const out: Record<string, number> = {};
  for (const card of cards) {
    const supply = supplyOf(card);
    const base = supply !== null ? angle[supply] : (spares.shift() ?? angle.土);
    const seen = used.get(base) ?? 0;
    used.set(base, seen + 1);
    out[card.candidateUserId] = base + (seen === 0 ? 0 : (seen % 2 === 1 ? 1 : -1) * spread * Math.ceil(seen / 2));
  }
  return out;
}

/**
 * 지금 후보는 제 오행의 바로 바깥이 아니라 **한 걸음 옆**에 선다 — 바로 바깥이면 선이 사진과 알 사이에 묻혀
 * 안 보였다(orbit 의 약점 1). 옆으로 비켜 서면 선이 휘어 들어가는 길이가 생긴다. 띠에서는 가장자리 쪽으로 비킨다.
 */
const stepAside = (shape: Shape, angle: number) => (shape === 'round' ? angle + 30 : angle + (angle < -90 ? -14 : 14));

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

const MOVE = 'transition-[left,top,opacity,transform] duration-700 ease-[cubic-bezier(.2,.8,.2,1)] motion-reduce:transition-none';

/**
 * 지도 한 장. 누를 자리는 없다(보조기기에는 숨긴다) — 같은 일을 카드와 단추가 하고, 같은 뜻을 카드의 글이 말한다.
 *
 * `pull` 은 사진을 끄는 만큼(-1 ~ 1): 왼쪽으로 끌면 지금 후보가 궤도 밖으로 물러나고, 오른쪽으로 끌면 나에게로 다가온다.
 */
export function ApproachMap({
  shape,
  me,
  cards,
  statusOf,
  photoOf,
  pull = 0,
  dragging = false,
  compact = false,
  className = '',
}: {
  shape: Shape;
  me: MeMark | null;
  cards: readonly DeckCard[];
  statusOf: (card: DeckCard) => MapStatus;
  photoOf: (card: DeckCard) => string | null;
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
  const angles = anglesOf(shape, cards);
  const current = cards.find((card) => statusOf(card) === 'current') ?? null;
  const lit = current !== null ? supplyOf(current) : null;

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

  const angleOf = (card: DeckCard, status: MapStatus) =>
    status === 'current' ? stepAside(shape, angles[card.candidateUserId]) : angles[card.candidateUserId];

  const curve =
    current !== null && lit !== null
      ? curveOf(
          pointOf(shape, angleOf(current, 'current'), ringOf('current')),
          pointOf(shape, geometry.angle[lit], geometry.ring.element),
          geometry.aspect,
        )
      : null;

  return (
    <div aria-hidden="true" className={`relative w-full ${className}`} style={{ aspectRatio: String(geometry.aspect) }}>
      {/* 지금 후보가 채워 주는 기운의 빛 — 가운데에서 번진다 */}
      <div
        className={`${lit !== null ? ELEMENT_CLASS[lit] : NONE_CLASS} pointer-events-none absolute rounded-full transition-opacity duration-700 motion-reduce:transition-none ${
          lit !== null ? 'opacity-100' : 'opacity-0'
        }`}
        style={{
          left: '8%',
          width: '84%',
          top: arc ? '20%' : '8%',
          height: arc ? '160%' : '84%',
          background: 'radial-gradient(closest-side, color-mix(in srgb, var(--tile) 95%, transparent), transparent)',
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
        {current !== null && lit !== null && curve !== null && (
          <g key={current.candidateUserId} className={ELEMENT_CLASS[lit]}>
            <path
              d={curve}
             
              fill="none"
              stroke="var(--mid)"
              strokeOpacity={0.5}
              strokeWidth={arc ? 7 : 4}
              strokeLinecap="round"
              className={`${styles.draw} blur-[3px]`}
            />
            <path d={curve} fill="none" stroke="var(--ink)" strokeWidth={arc ? 1.5 : 0.8} strokeLinecap="round" className={styles.draw} />
          </g>
        )}
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
            <Bead element={element} low={mine === null || mine.low} lit={lit === element} unknown={mine === null} small={small} />
            {mine !== null && !compact && (
              <span
                className={`absolute top-full whitespace-nowrap font-semibold tabular-nums text-secondary ${arc ? 'mt-0.5 text-[10px]' : 'mt-1 text-[12px]'}`}
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
        const at = pointOf(shape, angleOf(card, status), ringOf(status));
        const supply = supplyOf(card);
        const gone = status === 'passed' || status === 'requested';
        const now = status === 'current';
        /* 위쪽 반에 선 사람은 이름표를 위에 단다 — 아래에 달면 안쪽 궤도의 오행 자리에 얹힌다 */
        const above = Math.sin((angleOf(card, status) * Math.PI) / 180) < -0.3;
        return (
          <span
            key={card.candidateUserId}
            className={`${supply !== null ? ELEMENT_CLASS[supply] : NONE_CLASS} absolute -translate-x-1/2 -translate-y-1/2 ${dragging && now ? '' : MOVE} ${
              gone ? 'scale-50 opacity-0' : 'scale-100 opacity-100'
            } ${now ? 'z-10' : ''}`}
            style={{ left: `${at.x}%`, top: `${at.y}%` }}
          >
            <span
              className={`relative block overflow-hidden rounded-full bg-[var(--tile)] transition-[width,height,box-shadow,filter,opacity] duration-700 motion-reduce:transition-none ${
                now
                  ? `${arc ? 'size-12' : 'size-[4.75rem]'} shadow-[0_0_0_3px_var(--card),0_0_0_7px_var(--mid),0_14px_30px_-10px_rgba(60,48,30,0.55)]`
                  : `${small ? 'size-9' : 'size-12'} opacity-85 saturate-[.55] shadow-[0_0_0_2.5px_var(--card),0_6px_14px_-8px_rgba(60,48,30,0.5)]`
              }`}
            >
              <Face src={photoOf(card)} name={card.nickname} sizes={arc ? '48px' : '76px'} />
            </span>
            {card.exploration && (
              <span className="absolute -right-1 -top-1 grid size-5 place-items-center rounded-full bg-[var(--card)] text-[var(--ink)] shadow-sm ring-1 ring-[var(--line)]">
                <Spark />
              </span>
            )}
            {!arc && (now || status === 'kept') && (
              <span
                className={`absolute left-1/2 -translate-x-1/2 whitespace-nowrap rounded-full bg-[var(--card)] px-3 leading-7 text-foreground shadow-[0_6px_14px_-8px_rgba(60,48,30,0.5)] ring-1 ring-[var(--line)] ${
                  above ? 'bottom-full mb-2' : 'top-full mt-2'
                }`}
              >
                <span className={`${rounded.className} text-[15px]`}>{card.nickname}</span>
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
  if (me === null) {
    return (
      <span
        className={`${place} absolute grid -translate-x-1/2 -translate-y-1/2 place-items-center rounded-full border-2 border-dashed border-[color-mix(in_srgb,var(--foreground)_30%,transparent)] bg-[var(--card)]`}
      >
        <span className={`${rounded.className} ${arc ? '-translate-y-3 text-[15px]' : 'text-[17px]'} text-secondary`}>나</span>
      </span>
    );
  }
  return (
    <span
      className={`${ELEMENT_CLASS[me.element]} ${place} absolute flex -translate-x-1/2 -translate-y-1/2 flex-col items-center rounded-full bg-[var(--tile)] shadow-[0_0_0_4px_var(--card),0_16px_30px_-14px_rgba(60,48,30,0.55)] ${
        arc ? 'justify-start pt-2' : 'justify-center'
      }`}
    >
      <span className={`glyph font-bold leading-none text-[var(--ink)] ${small ? 'text-[1.35rem]' : 'text-[2.25rem]'}`}>{me.stem}</span>
      {!arc && <span className="mt-1 rounded-full bg-[var(--ink)] px-1.5 text-[10px] font-bold leading-4 text-[var(--tile)]">나</span>}
    </span>
  );
}

/** 오행 한 알 — 상징이 늘 함께 서서 색만으로 말하지 않는다 */
function Bead({ element, low, lit, unknown, small }: { element: Element; low: boolean; lit: boolean; unknown: boolean; small: boolean }) {
  return (
    <span
      className={`${ELEMENT_CLASS[element]} ${small ? 'size-9' : 'size-[3.25rem]'} relative grid place-items-center rounded-full transition-transform duration-700 motion-reduce:transition-none ${
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

/** 후보 사진 — 없으면 이름 첫 글자 */
function Face({ src, name, sizes }: { src: string | null; name: string; sizes: string }) {
  return src !== null ? (
    <Image src={src} alt="" fill sizes={sizes} draggable={false} className="object-cover" />
  ) : (
    <span aria-hidden="true" className={`${rounded.className} grid size-full place-items-center text-[1.2em] text-[var(--ink)]`}>
      {initialOf(name)}
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
      <li className={`${ELEMENT_CLASS['土']} flex items-center gap-1.5`}>
        <span aria-hidden="true" className="inline-block size-3.5 rounded-full bg-[var(--tile)] ring-1 ring-[color-mix(in_srgb,var(--ink)_30%,transparent)]" />
        오행 분포
      </li>
      <li className={`${ELEMENT_CLASS['木']} flex items-center gap-1.5`}>
        <span aria-hidden="true" className="inline-block size-3.5 rounded-full border-[1.5px] border-dashed border-[color-mix(in_srgb,var(--ink)_60%,transparent)]" />
        적은 기운
      </li>
      <li className={`${ELEMENT_CLASS['木']} flex items-center gap-1.5`}>
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
