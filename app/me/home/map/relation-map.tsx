'use client';

/*
  **관계 지도 — 가운데 나, 한 궤도에 저장한 사람이 제 일간 오행의 방향으로 앉고, 그림이 저마다 숨 쉰다.**
  (2026-09-26 운영자가 시안 비교에서 「숨 쉬는 그림 · 제자리」를 골랐다. 매칭 「내 궤도로 다가오는 인연」 지도의 동생)

  - **그림**은 천간 열(`app/ui/stem-symbol.tsx`)이다 — 한자 대신 나무 · 덩굴 · 햇빛 · 등불 · 산 · 밭 · 강철 · 보석 · 바다 · 빗물.
    나 둘레의 오행 알은 없다 — 그림과 색이 이미 기운을 말하고, 알이 있으면 「내가 가진 기운」으로 읽혔다.
  - **거리는 아무것도 판정하지 않는다.** 모두 한 궤도, 자리는 기운의 방향일 뿐이다.
  - **가만있을 때**: 그림마다 제 숨(`living-stem.tsx`). 아주 작고 느리고, 박자가 흩어져 한꺼번에 움직이지 않는다.
  - **누르면**: 그 사람이 **제자리에서** 커지며 그림이 한 번 깨어난다. 나머지는 물러나 숨을 멈춘다.
  - **나와 본 궁합이 있으면 — 만남**: 거의 곧은 빛이 그어진 뒤 두 그림에서 작은 것(잎 · 빛 · 흙 알 · 반짝임 · 물방울)이
    하나씩 선을 타고 서로에게 건너가고, 닿으면 받은 쪽이 깨어난다. 어느 짝이든 같은 박자 · 같은 크기다 — 좋고 나쁨이
    아니라 「만났다」는 순간이다. 안 봤으면 선도 만남도 없다. 곡선을 크게 주면 어지러웠다(운영자) — 선은 살짝만 휜다.
  - **카드**: 이름 아래는 그림 이름 하나. 주인공은 나와의 궁합(점수 · 비유 · 주 단추 하나).

  자바스크립트가 없으면 사람 원은 아래 사람 타일로 간다(`tileHref`).
*/
import Link from 'next/link';
import { useRef, useState, type CSSProperties, type MouseEvent, type ReactNode } from 'react';

import { READING_STALE_LABEL } from '@/src/lib/reading/notes';
import type { Element } from '@/src/lib/saju';

import { BUTTON_PRIMARY_SMALL, BUTTON_TERTIARY } from '../../../ui/buttons';
import { elementScope } from '../../../ui/element-tone';
import { Icon } from '../../../ui/icons';
import { reducedMotion } from '../../../ui/motion';
import { DotsMark, ORBIT_GLOW, ORBIT_LABEL_PAD, ORBIT_NAME_TAG, ORBIT_RING, ThreadMark, round2 } from '../../../ui/orbit';
import { StemSymbol } from '../../../ui/stem-symbol';
import { STALE_CHIP, TYPE_META } from '../../../ui/surfaces';
import { LivingStem } from './living-stem';
import { linksOf, type MapModel, type MapPerson } from './model';
import { RADIUS, SIZE, curve, curveAway, phaseOf, pointAt, seatAngles, stepsAlong, type Point } from './orbit';
import styles from './relation-map.module.css';

const MOVE = 'transition-[left,top,opacity] duration-[520ms] ease-[cubic-bezier(.2,.8,.2,1)] motion-reduce:transition-none';

/** 누른 뒤의 박자(ms) — 커지며 깨어나고, 빛이 그어지고, 작은 것이 떠나 건너가 닿는다 */
const BEAT = { wake: 240, depart: 900, travel: 900 } as const;
const MEET = BEAT.depart + BEAT.travel - 60;
/** 나와 본 궁합의 빛 — 그 사람에게서 나에게로 휘는 정도 */
/* 나와의 선은 거의 곧게 — 곡선이 많으면 어지러웠다(운영자 2026-09-26) */
const BEND = 3;

const cqw = (value: number) => `${value}cqw`;
const delay = (ms: number): CSSProperties => ({ animationDelay: `${ms}ms` });
const seatDelay = (index: number, count: number) => 420 + index * Math.round(Math.min(70, 480 / Math.max(1, count)));

function keptOf(model: MapModel, chosenId: string | null): Set<string> | null {
  if (chosenId === null) return null;
  const kept = new Set([chosenId]);
  for (const link of model.links) {
    if (link.a === chosenId) kept.add(link.b);
    if (link.b === chosenId) kept.add(link.a);
  }
  return kept;
}

export function RelationMap({ model, addHref, canAdd }: { model: MapModel; addHref: string; canAdd: boolean }) {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const card = useRef<HTMLDivElement>(null);
  const angles = seatAngles(
    model.people.map((person) => ({
      id: person.id,
      element: person.day?.element ?? null,
    })),
  );
  const chosen = model.people.find((person) => person.id === selectedId) ?? null;
  const chosenId = chosen?.id ?? null;
  const kept = keptOf(model, chosenId);
  const empty = model.people.length === 0;
  const meeting = chosen !== null && chosen.day !== null && chosen.compat.seen;

  const choose = (event: MouseEvent<HTMLAnchorElement>, id: string) => {
    event.preventDefault();
    setSelectedId((now) => (now === id ? null : id));
    if (selectedId !== id) {
      requestAnimationFrame(() =>
        card.current?.scrollIntoView({
          block: 'nearest',
          behavior: reducedMotion() ? 'instant' : 'smooth',
        }),
      );
    }
  };

  const close = () => {
    setSelectedId(null);
    card.current?.closest('section')?.querySelector<HTMLAnchorElement>('a[aria-expanded="true"]')?.focus({ preventScroll: true });
  };

  return (
    <section aria-labelledby="home-orbit" className="relative flex h-full min-w-0 flex-col overflow-hidden rounded-[2rem] bg-cream">
      <header className="flex items-baseline justify-between gap-3 px-5 pt-5 sm:px-6 sm:pt-6">
        <h2 id="home-orbit" className="font-rounded text-[1.375rem] leading-8 text-foreground">
          관계 지도
        </h2>
        {!empty && (
          <p className="shrink-0 text-[13px] font-semibold text-secondary">
            저장한 사람 <span className="tabular-nums text-foreground">{model.people.length}</span>명
          </p>
        )}
      </header>

      <div className="grid flex-1 place-items-center px-[8%] py-[9%] sm:px-[10%]">
        <div className="@container relative aspect-square w-full max-w-[24rem]">
          <Glow element={chosen?.day?.element ?? null} lit={meeting} />
          <Lines model={model} angles={angles} chosen={chosen} meeting={meeting} />
          <Me self={model.self} meeting={meeting ? chosenId : null} />

          {model.people.map((person, index) => (
            <Seat
              key={person.id}
              person={person}
              angle={angles[person.id]}
              phase={phaseOf(index)}
              enter={seatDelay(index, model.people.length)}
              meeting={meeting}
              state={chosenId === person.id ? 'near' : kept === null ? 'still' : kept.has(person.id) ? 'linked' : 'receded'}
              onChoose={(event) => choose(event, person.id)}
            />
          ))}

          {empty && canAdd && <AddSeat href={addHref} />}
        </div>
      </div>

      {/*
        넓은 화면에서는 카드가 지도 위에 뜬다 — 흐름에 두면 판이 길어지고, 같은 줄의 내 사주 카드까지 따라 늘어났다(운영자
        2026-09-26). 늘 판 아래쪽에서 떠오른다 — 누른 자리에 따라 위 · 아래를 바꾸면 어색했다. 폰은 지도 아래 흐름이다.
      */}
      <div
        ref={card}
        id="home-orbit-card"
        className={`scroll-mt-4 scroll-mb-28 md:scroll-mb-4 lg:absolute lg:inset-x-0 lg:z-30 lg:bottom-0`}
        aria-live="polite"
      >
        {chosen !== null && <PersonCard key={chosen.id} person={chosen} links={linksOf(model, chosen.id)} onClose={close} />}
      </div>
      <Legend empty={empty} chosen={chosen !== null} />
    </section>
  );
}

function Glow({ element, lit }: { element: Element | null; lit: boolean }) {
  return (
    <div
      aria-hidden="true"
      className={`${elementScope(element)} pointer-events-none absolute inset-[6%] rounded-full transition-opacity duration-700 motion-reduce:transition-none ${
        lit ? 'opacity-100' : 'opacity-0'
      }`}
      style={{ background: ORBIT_GLOW }}
    />
  );
}

function Lines({
  model,
  angles,
  chosen,
  meeting,
}: {
  model: MapModel;
  angles: Record<string, number>;
  chosen: MapPerson | null;
  meeting: boolean;
}) {
  const { self } = model;
  const near = chosen === null ? null : pointAt(angles[chosen.id], RADIUS);
  const center = { x: 50, y: 50 };
  const trimNear = SIZE.current / 2 + 1;
  const trimMe = SIZE.me / 2 + 1.5;
  return (
    <svg aria-hidden="true" viewBox="0 0 100 100" className="absolute inset-0 size-full overflow-visible">
      <circle
        cx="50"
        cy="50"
        r={RADIUS}
        fill="none"
        stroke="color-mix(in srgb, var(--foreground) 28%, transparent)"
        strokeWidth="2"
        strokeDasharray="0.01 7"
        strokeLinecap="round"
        vectorEffect="non-scaling-stroke"
        className={styles.drift}
      />

      {chosen !== null && near !== null && (
        <g key={chosen.id}>
          {/* 누른 때 — 그 사람 둘레에 물결 한 겹 */}
          <Ripple at={near} r={SIZE.current / 2 + 1} element={chosen.day?.element ?? null} start={BEAT.wake} />

          {model.links.flatMap((link) => {
            const otherId = link.a === chosen.id ? link.b : link.b === chosen.id ? link.a : null;
            if (otherId === null || angles[otherId] === undefined) return [];
            const other = pointAt(angles[otherId], RADIUS);
            return [
              <path
                key={otherId}
                d={curveAway(near, other, SIZE.current / 2 + 1.5, SIZE.person / 2 + 1.5)}
                fill="none"
                stroke="color-mix(in srgb, var(--foreground) 45%, transparent)"
                strokeWidth="1.1"
                strokeDasharray="0.01 2.6"
                strokeLinecap="round"
                className={styles.fade}
              />,
            ];
          })}

          {chosen.compat.seen && (
            <g className={elementScope(chosen.day?.element ?? null)}>
              {[
                {
                  stroke: 'var(--mid)',
                  width: 2.2,
                  extra: 'blur-[3px]',
                  opacity: 0.45,
                },
                { stroke: 'var(--ink)', width: 0.7, extra: '', opacity: 1 },
              ].map((one) => (
                <path
                  key={one.stroke}
                  d={curve(near, center, trimNear, trimMe, BEND)}
                  pathLength={1}
                  fill="none"
                  stroke={one.stroke}
                  strokeOpacity={one.opacity}
                  strokeWidth={one.width}
                  strokeLinecap="round"
                  className={`${styles.draw} ${one.extra}`}
                />
              ))}
            </g>
          )}

          {/* 만남 — 두 그림에서 작은 것이 하나씩 떠나 같은 선을 타고 엇갈려 건너간다. 어느 짝이든 같다 */}
          {meeting && chosen.day !== null && (
            <>
              <Token element={chosen.day.element} steps={stepsAlong(near, center, trimNear, trimMe, BEND)} />
              <Token element={self.element} steps={stepsAlong(near, center, trimNear, trimMe, BEND).reverse()} />
              <Ripple at={center} r={SIZE.me / 2 + 1} element={chosen.day.element} start={MEET} />
              <Ripple at={near} r={SIZE.current / 2 + 1} element={self.element} start={MEET} />
            </>
          )}
        </g>
      )}
    </svg>
  );
}

function Ripple({ at, r, element, start }: { at: Point; r: number; element: Element | null; start: number }) {
  return (
    <circle
      cx={at.x}
      cy={at.y}
      r={r}
      fill="none"
      stroke="var(--mid)"
      strokeWidth="0.8"
      className={`${elementScope(element)} ${styles.ripple}`}
      style={{ '--at': `${start}ms` } as CSSProperties}
    />
  );
}

/** 그 기운의 작은 것 — 木 잎 · 火 빛 · 土 흙 알 · 金 반짝임 · 水 물방울(24 칸에 그려 100 칸에 줄여 얹는다) */
const TOKEN: Record<Element, ReactNode> = {
  木: <path d="M12 4.5c4.4 2.8 4.4 12.2 0 15-4.4-2.8-4.4-12.2 0-15Z" fill="var(--mid)" stroke="var(--ink)" strokeWidth="1.8" />,
  火: (
    <>
      <circle cx="12" cy="12" r="9" fill="var(--mid)" opacity="0.35" />
      <circle cx="12" cy="12" r="4.6" fill="var(--mid)" stroke="var(--ink)" strokeWidth="1.8" />
    </>
  ),
  土: <path d="M12 5.5 18.5 12 12 18.5 5.5 12Z" fill="var(--mid)" stroke="var(--ink)" strokeWidth="1.8" strokeLinejoin="round" />,
  金: (
    <path
      d="M12 3c.8 5 4 8.2 9 9-5 .8-8.2 4-9 9-.8-5-4-8.2-9-9 5-.8 8.2-4 9-9Z"
      fill="var(--mid)"
      stroke="var(--ink)"
      strokeWidth="1.6"
      strokeLinejoin="round"
    />
  ),
  水: (
    <path
      d="M12 4c3.4 4 6 7.4 6 10.4a6 6 0 0 1-12 0c0-3 2.6-6.4 6-10.4Z"
      fill="var(--mid)"
      stroke="var(--ink)"
      strokeWidth="1.8"
    />
  ),
};

function Token({ element, steps }: { element: Element; steps: Point[] }) {
  const vars: Record<string, string> = { '--at': `${BEAT.depart}ms` };
  steps.forEach((step, index) => {
    vars[`--x${index}`] = `${step.x}`;
    vars[`--y${index}`] = `${step.y}`;
  });
  return (
    <g className={`${elementScope(element)} ${styles.token}`} style={vars as CSSProperties}>
      <g transform="scale(0.17) translate(-12 -12)">{TOKEN[element]}</g>
    </g>
  );
}

/** 가운데의 나 — 만남이 있으면 건너온 것을 받고 한 번 깨어난다 */
function Me({ self, meeting }: { self: MapModel['self']; meeting: string | null }) {
  return (
    <span
      role="img"
      aria-label={`나 ${self.label}, 일간 ${self.stem} ${self.picture}`}
      className={`${elementScope(self.element)} ${styles.me} absolute left-1/2 top-1/2 z-[5] flex -translate-x-1/2 -translate-y-1/2 flex-col items-center justify-center rounded-full bg-[var(--tile)]`}
      style={{ width: cqw(SIZE.me), height: cqw(SIZE.me), boxShadow: ORBIT_RING.me }}
    >
      <span aria-hidden="true" className="leading-none" style={{ fontSize: cqw(9.5) }}>
        <LivingStem
          key={meeting ?? 'alone'}
          stem={self.stem}
          phase={-3.7}
          stir={meeting !== null ? [MEET] : []}
          className="size-[1.15em]"
        />
      </span>
      <span
        aria-hidden="true"
        className="mt-[0.8cqw] rounded-full bg-[var(--ink)] px-1.5 text-[11px] font-bold leading-4 text-[var(--tile)]"
      >
        나
      </span>
    </span>
  );
}

type SeatState = 'still' | 'near' | 'linked' | 'receded';

function Seat({
  person,
  angle,
  phase,
  enter,
  meeting,
  state,
  onChoose,
}: {
  person: MapPerson;
  angle: number;
  phase: number;
  enter: number;
  meeting: boolean;
  state: SeatState;
  onChoose: (event: MouseEvent<HTMLAnchorElement>) => void;
}) {
  const near = state === 'near';
  const at = pointAt(angle, RADIUS);
  const above = Math.sin((angle * Math.PI) / 180) < -0.3;
  const score = person.compat.seen ? person.compat.score : null;
  const size = near ? SIZE.current : SIZE.person;
  const unread = person.day === null;
  /* 누르면 커지며 한 번, 만남이 있으면 건너온 것을 받고 또 한 번 */
  const stir = near ? (meeting ? [BEAT.wake, MEET] : [BEAT.wake]) : [];

  return (
    <a
      href={person.tileHref}
      onClick={onChoose}
      aria-expanded={near}
      aria-controls="home-orbit-card"
      aria-label={`${person.label}${person.day === null ? '' : `, 일간 ${person.day.stem} ${person.day.picture}`}${
        score !== null ? `, 나와 본 궁합 ${score}점` : ''
      }`}
      className={`${elementScope(person.day?.element ?? null)} ${styles.seat} group absolute -translate-x-1/2 -translate-y-1/2 ${MOVE} ${
        near ? 'z-10' : ''
      } ${state === 'receded' ? 'opacity-35' : 'opacity-100'}`}
      style={
        {
          left: `${at.x}%`,
          top: `${at.y}%`,
          '--dx': cqw(round2(50 - at.x)),
          '--dy': cqw(round2(50 - at.y)),
          ...delay(enter),
        } as CSSProperties
      }
    >
      <span aria-hidden="true" className="absolute -inset-2 rounded-full" />
      <span
        aria-hidden="true"
        className={`relative grid place-items-center rounded-full transition-[width,height,box-shadow,filter] duration-[520ms] ease-[cubic-bezier(.2,.8,.2,1)] group-active:scale-95 motion-reduce:transition-none ${
          unread
            ? 'border-2 border-dashed border-border-strong bg-[var(--surface)]'
            : `bg-[var(--tile)] ${state === 'receded' ? 'saturate-[.6]' : ''}`
        }`}
        style={{
          width: cqw(size),
          height: cqw(size),
          boxShadow: near
            ? ORBIT_RING.chosen
            : state === 'linked'
              ? `0 0 0 2.5px var(--surface), 0 0 0 5px color-mix(in srgb, var(--mid) 70%, transparent)`
              : ORBIT_RING.resting,
        }}
      >
        <span
          className={`glyph font-bold leading-none transition-[font-size] duration-[520ms] motion-reduce:transition-none ${
            unread ? 'text-secondary' : 'text-[var(--ink)]'
          }`}
          style={{ fontSize: cqw(near ? 8.6 : 6) }}
        >
          {person.day ? (
            <LivingStem
              key={near ? 'near' : 'rest'}
              stem={person.day.stem}
              phase={phase}
              stir={stir}
              hush={state === 'receded'}
              className="size-[1.15em]"
            />
          ) : (
            '?'
          )}
        </span>
      </span>

      {near ? (
        <span
          aria-hidden="true"
          className={`${ORBIT_NAME_TAG} ${above ? 'bottom-full mb-2.5' : 'top-full mt-2.5'}`}
          style={{ boxShadow: ORBIT_RING.tag }}
        >
          <span className="font-rounded text-[15px]">{person.label}</span>
          {score !== null && <span className="ml-1.5 text-[13px] font-bold tabular-nums text-[var(--ink)]">{score}</span>}
        </span>
      ) : (
        <span
          aria-hidden="true"
          className={`${ORBIT_LABEL_PAD} absolute left-1/2 flex max-w-[4.75rem] -translate-x-1/2 items-baseline gap-1 whitespace-nowrap text-[12px] font-semibold text-secondary ${
            above ? 'bottom-full mb-1' : 'top-full mt-1'
          }`}
        >
          <span className="truncate">{person.label}</span>
          {score !== null && <span className="shrink-0 font-bold tabular-nums text-[var(--ink)]">{score}</span>}
        </span>
      )}
    </a>
  );
}

function AddSeat({ href }: { href: string }) {
  const at = pointAt(-90, RADIUS);
  return (
    <Link
      href={href}
      className="group absolute flex -translate-x-1/2 -translate-y-1/2 items-center justify-center"
      style={{ left: `${at.x}%`, top: `${at.y}%` }}
    >
      <span
        className="grid min-h-11 min-w-11 place-items-center rounded-full border-2 border-dashed border-border-strong bg-[var(--surface)] text-foreground group-hover:border-foreground group-active:scale-95"
        style={{ width: cqw(SIZE.person), height: cqw(SIZE.person) }}
      >
        <Icon name="plus" />
      </span>
      <span className={`${ORBIT_LABEL_PAD} absolute bottom-full mb-1 whitespace-nowrap text-[13px] font-semibold text-foreground`}>
        사람 추가
      </span>
    </Link>
  );
}

function Legend({ empty, chosen }: { empty: boolean; chosen: boolean }) {
  if (empty) {
    return (
      <p className="px-5 pb-5 text-[13px] leading-5 text-secondary sm:px-6">사람을 저장하면 그 사람의 기운 쪽 궤도에 앉아요</p>
    );
  }
  return (
    <div className="flex flex-col gap-2 px-5 pb-5 pt-1 sm:px-6">
      <ul className="flex flex-wrap items-center gap-x-4 gap-y-2 text-[12px] font-medium text-secondary">
        <li className={`${elementScope('木')} flex items-center gap-1.5`}>
          <ThreadMark />
          나와 본 궁합
        </li>
        <li className="flex items-center gap-1.5">
          <DotsMark />
          사람끼리 본 궁합
        </li>
      </ul>
      {!chosen && <p className={TYPE_META}>누르면 나와의 궁합을 볼 수 있어요. 궁합을 본 사람이면 두 그림이 서로 만나요</p>}
    </div>
  );
}

const LINK_CHIP =
  'inline-flex min-h-11 min-w-0 max-w-full items-center gap-1.5 rounded-full border border-border bg-surface px-3 text-[13px] font-semibold text-foreground hover:border-border-strong active:scale-[0.96]';

/**
 * 누른 사람의 카드 — 이름 아래에는 그 사람의 그림 이름 하나만 선다.
 * 맨 아래 글자 단추는 여는 곳을 말한다(「○○ 사주 보기」).
 */
function PersonCard({ person, links, onClose }: { person: MapPerson; links: ReturnType<typeof linksOf>; onClose: () => void }) {
  const { compat } = person;
  return (
    <article
      aria-labelledby="home-orbit-card-name"
      className={`${elementScope(person.day?.element ?? null)} ${styles.arrive} mx-3 mb-3 flex flex-col gap-4 rounded-[1.5rem] bg-surface p-4 ring-1 ring-border sm:mx-4 sm:p-5 lg:shadow-card`}
    >
      <div className="flex items-center gap-3">
        <span
          aria-hidden="true"
          className={`grid size-12 shrink-0 place-items-center rounded-full ${
            person.day === null ? 'border-2 border-dashed border-border-strong' : 'bg-[var(--tile)]'
          }`}
          style={{
            boxShadow: '0 0 0 2px var(--surface), 0 0 0 4px var(--mid)',
          }}
        >
          <span
            className={`glyph text-[1.4rem] font-bold leading-none ${person.day === null ? 'text-secondary' : 'text-[var(--ink)]'}`}
          >
            {person.day ? <StemSymbol stem={person.day.stem} className="size-[1.15em]" /> : '?'}
          </span>
        </span>
        <div className="min-w-0 flex-1">
          <h3 id="home-orbit-card-name" className="truncate font-rounded text-[1.3rem] leading-7 text-foreground">
            {person.label}
          </h3>
          <p className="truncate text-[13px] leading-5 text-secondary">
            {/* 그림 이름 하나만 — 일간 · 한자 · 메모는 걷었다(운영자 2026-09-26) */}
            {person.day?.picture}
          </p>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="min-h-11 shrink-0 rounded-full px-3 text-[14px] font-semibold text-secondary hover:text-foreground"
        >
          닫기
        </button>
      </div>

      {person.unreadable !== null ? (
        <p className="text-[14px] leading-6 text-secondary">{person.unreadable}</p>
      ) : (
        <>
          <div className="flex flex-col gap-1.5">
            <p className="flex items-center gap-2">
              <span className={TYPE_META}>나와의 궁합</span>
              {compat.seen && !compat.current && <span className={STALE_CHIP}>{READING_STALE_LABEL}</span>}
            </p>
            {compat.seen ? (
              <>
                {compat.score !== null && (
                  <p className="font-rounded text-[2rem] leading-10 tabular-nums text-[var(--ink)]">
                    {compat.score}
                    <span className="ml-1 text-[15px] text-secondary">점</span>
                  </p>
                )}
                {compat.metaphor !== null && (
                  <p className="font-rounded text-[1.125rem] leading-snug text-foreground">{compat.metaphor}</p>
                )}
              </>
            ) : (
              <p className="font-rounded text-[1.125rem] leading-snug text-[var(--ink)]">아직 둘의 궁합을 보지 않았어요</p>
            )}
          </div>

          <Link href={compat.href} className={`${BUTTON_PRIMARY_SMALL} w-full`}>
            <Icon name={compat.seen ? 'reading' : 'heart'} className="size-4" />
            {compat.seen ? '궁합풀이 보기' : '궁합 보러 가기'}
          </Link>

          {links.length > 0 && (
            <section aria-labelledby="home-orbit-card-links" className="flex flex-col gap-1.5">
              <h4 id="home-orbit-card-links" className={TYPE_META}>
                다른 사람과 본 궁합
              </h4>
              <ul className="flex flex-wrap gap-1.5">
                {links.map((link) => (
                  <li key={link.href} className="min-w-0">
                    <Link
                      href={link.href}
                      aria-label={`${person.label} · ${link.otherLabel} 궁합${link.score === null ? '' : ` ${link.score}점`}`}
                      className={LINK_CHIP}
                    >
                      <span className="truncate">{link.otherLabel}</span>
                      {link.score !== null && <span className="shrink-0 tabular-nums text-secondary">{link.score}점</span>}
                    </Link>
                  </li>
                ))}
              </ul>
            </section>
          )}

          <Link href={person.detailHref} className={`${BUTTON_TERTIARY} self-start`}>
            {person.label} 사주 보기
            <Icon name="arrow" className="size-4" />
          </Link>
        </>
      )}
    </article>
  );
}
