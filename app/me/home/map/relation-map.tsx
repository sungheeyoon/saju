'use client';

import Link from 'next/link';
import { useRef, useState, type CSSProperties, type MouseEvent } from 'react';

import { READING_STALE_LABEL } from '@/src/lib/reading/notes';

import { elementScope } from '../../../ui/element-tone';
import { ICON_BUTTON } from '../../../ui/buttons';
import { Icon } from '../../../ui/icons';
import { STALE_CHIP, TYPE_META, TYPE_NAME, TYPE_SECTION } from '../../../ui/surfaces';
import { linksOf, type MapLink, type MapModel, type MapPerson } from './model';
import { arcBetween, placeOnOrbit, threadBetween, threadTo, type Point } from './placement';
import { reducedMotion } from '../../../ui/motion';
import styles from './relation-map.module.css';

/*
  **관계 지도 — 나를 가운데 두고 저장한 사람이 한 궤도에 앉는다.**

  이 그림이 말하는 것은 넷뿐이고, 그 넷만 눈에 띄게 한다.
  1. **가운데의 나가 가장 무겁다** — 가장 큰 원 · 가장 큰 글자 · 이름표만 먹색으로 채운다.
  2. **거리는 판정하지 않는다** — 저장한 사람은 모두 같은 궤도(진주알 점선 한 줄)에 앉는다. 안쪽 · 바깥으로
     나누면 누구나 「가깝다」로 읽었다 — 궤도가 둘일 때 그 뜻은 「풀이나 궁합을 봤는가」였고 아무도 못 읽었다.
  3. **선은 이미 본 궁합에만** — 나와의 궁합은 나에게서 그 사람으로 살짝 휘며 점점 커지는 점의 실 + 원 위의 점수
     딱지로 늘 선다(`placement.ts` 머리말). 곧은 먹선은 도면처럼 읽혀 걷었다(2026-09-26). 저장한 두 사람의 궁합(바깥으로
     휜 고른 점의 실 + 점수 알약, 누르면 그 글)은 **그 둘 중 하나를 눌렀을 때만** 선다 — 평소에는 나와의 실만 읽힌다.
     안 본 짝은 선도 권유도 없다(`model.ts`). 실은 조용하고 주인공은 점수와 사람 원이다.
  4. **색은 사람에게만 있다.** 판 · 궤도 · 실은 종이와 먹의 중립 토큰이고, 오행 파스텔은 사람 원(나 포함)
     안에만 든다 — 그래서 색이 곧 「그 사람의 일간」으로 읽힌다. 색만으로 말하지 않게 원에는 일간 글자가,
     보조기기에는 「일간 庚 쇠」가 선다.

  **움직임**(`relation-map.module.css`) — 들어올 때 나 → 궤도 → 사람들이 퍼져 앉고 → 실이 바깥으로 찍힌다. 누르면 그
  사람과 그 실, 그와 궁합을 본 사람만 남고 나머지는 물러나며, 사람끼리의 실이 누른 사람 쪽에서부터 찍히고 알약이
  뜬다. 닫으면 한 번에 옅어진다. 사람끼리의 실과 알약은 늘 그려 두고 `opacity` · `visibility` 로만 드나든다 — 붙였다
  떼면 닫을 때 뚝 끊긴다. 좌표는 전부 `placement.ts` 가 소수 둘째 자리로 낸 값이라 서버와 브라우저가 같다.

  **자바스크립트 없이도 길이 돈다.** 사람 원은 아래 그 사람의 타일로 가는 링크(`#person-…`)이고, 타일이
  모든 길을 든다. 자바스크립트가 돌면 같은 누름이 지도 아래에 그 사람의 작은 카드를 연다. 들어오는 움직임은
  CSS 라 서버 HTML 에서도 끝 모양으로 선다.
*/

/** 들어올 때의 차례 — 사람이 많을수록 사이를 좁혀 열 명이어도 1.1초 안팎에 끝난다 */
const SEAT_START = 180;
const seatDelay = (index: number, count: number) => SEAT_START + index * Math.round(Math.min(60, 360 / Math.max(1, count)));
/** 실은 사람이 반쯤 앉았을 때 나에게서 떠난다. 점 하나에 28ms */
const THREAD_AFTER = 220;
const BEAD_STEP = 28;
/** 사람끼리의 실은 누른 뒤 점 하나에 30ms */
const LINK_STEP = 30;

const delay = (ms: number): CSSProperties => ({ animationDelay: `${ms}ms` });

/** 누른 사람과 그와 이미 궁합을 본 사람들 — 이들만 또렷하게 남는다 */
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
  const placed = placeOnOrbit(model.people, model.links);
  const chosen = model.people.find((person) => person.id === selectedId) ?? null;
  const chosenId = chosen?.id ?? null;
  const kept = keptOf(model, chosenId);
  const empty = model.people.length === 0;

  const choose = (event: MouseEvent<HTMLAnchorElement>, id: string) => {
    event.preventDefault();
    setSelectedId((now) => (now === id ? null : id));
    /* 폰에서 카드는 지도 아래다 — 누른 결과가 화면 밖(하단 독 뒤)에서 일어나지 않게 끌어온다 */
    if (selectedId !== id) requestAnimationFrame(() => card.current?.scrollIntoView({
      block: 'nearest',
      behavior: reducedMotion() ? 'instant' : 'smooth',
    }));
  };

  return (
    <section
      aria-labelledby="home-map"
      className="flex h-full min-w-0 flex-col overflow-hidden rounded-[2rem] border border-border bg-surface shadow-card"
    >
      <header className="flex items-center justify-between gap-3 px-5 pt-5 sm:px-7 sm:pt-7">
        <h2 id="home-map" className={TYPE_SECTION}>
          관계 지도
        </h2>
        {!empty && <span className={`${TYPE_META} tabular-nums`}>저장한 사람 {model.people.length}명</span>}
      </header>

      {/* 판이 옆 카드보다 길어지면 지도가 가운데로 모인다 — 둘의 윗선 · 아랫선은 격자가 맞춘다 */}
      <div className="grid flex-1 place-items-center px-[5%] pb-8 pt-6 sm:px-[8%]">
        {/* `@container` — 사람이 가운데에서 퍼져 나오는 거리를 상자 폭(`cqw`)으로 잰다 */}
        <div className="@container relative aspect-square w-full max-w-[26rem]">
          <Threads model={model} placed={placed.at} radius={placed.radius} chosenId={chosenId} />

          <Center self={model.self} />

          {model.people.map((person, index) => {
            const point = placed.at[person.id];
            if (point === undefined) return null;
            return (
              <PersonDot
                key={person.id}
                person={person}
                at={point}
                enter={seatDelay(index, model.people.length)}
                active={chosenId === person.id}
                receded={kept !== null && !kept.has(person.id)}
                onChoose={(event) => choose(event, person.id)}
              />
            );
          })}

          {/* 점수 알약은 사람 원보다 뒤에 둔다 — 겹치면 알약이 위에 선다 */}
          {model.links.map((link) => (
            <LinkScore key={`${link.a}-${link.b}`} link={link} placed={placed.at} chosenId={chosenId} />
          ))}

          {empty && canAdd && <AddDot href={addHref} />}
        </div>
      </div>

      <div ref={card} id="home-map-card" className="scroll-mt-4 scroll-mb-28 md:scroll-mb-4" aria-live="polite">
        {chosen !== null ? (
          <PersonCard person={chosen} links={linksOf(model, chosen.id)} onClose={() => {
            setSelectedId(null);
            card.current?.closest('section')?.querySelector<HTMLAnchorElement>('a[aria-expanded="true"]')?.focus({ preventScroll: true });
          }} />
        ) : null}
        <Legend empty={empty} />
      </div>
    </section>
  );
}

const SETTLE = 'ease-[cubic-bezier(.2,.8,.2,1)]';

/** 궤도와 이미 본 궁합의 실 — 전부 중립색. 누를 것은 없다 */
function Threads({
  model,
  placed,
  radius,
  chosenId,
}: {
  model: MapModel;
  placed: Record<string, Point>;
  radius: number;
  chosenId: string | null;
}) {
  return (
    <svg aria-hidden="true" viewBox="0 0 100 100" className="absolute inset-0 size-full overflow-visible">
      {/* 궤도 — 로고와 같은 진주알 점선. 나에게서 번져 나와 아주 느리게 돈다 */}
      <g className={styles.orbit}>
        <circle
          cx="50"
          cy="50"
          r={radius}
          fill="none"
          stroke="color-mix(in srgb, var(--foreground) 30%, transparent)"
          strokeWidth="2"
          strokeDasharray="0.01 7"
          strokeLinecap="round"
          vectorEffect="non-scaling-stroke"
          className={styles.drift}
        />
      </g>

      {/* 나와 이미 본 궁합 — 나에게서 점점 커지는 점. 누른 사람의 실만 또렷해지고 나머지는 물러난다 */}
      {model.people.map((person, index) => {
        const point = placed[person.id];
        if (!person.compat.seen || point === undefined) return null;
        const lit = chosenId === person.id;
        const start = seatDelay(index, model.people.length) + THREAD_AFTER;
        return (
          <g
            key={person.id}
            fill="var(--foreground)"
            opacity={lit ? 0.9 : chosenId === null ? 0.42 : 0.1}
            className={`transition-opacity duration-300 ${SETTLE}`}
          >
            {threadTo(point).map((bead, step) => (
              <circle key={step} cx={bead.x} cy={bead.y} r={bead.r} className={styles.bead} style={delay(start + step * BEAD_STEP)} />
            ))}
          </g>
        );
      })}

      {/* 저장한 두 사람 사이의 궁합 — 바깥으로 휜 고른 점. 그 둘 중 하나를 눌렀을 때만, 누른 쪽에서부터 찍힌다 */}
      {model.links.map((link) => {
        const a = placed[link.a];
        const b = placed[link.b];
        if (a === undefined || b === undefined) return null;
        const on = touches(link, chosenId);
        const beads = threadBetween(a, b);
        return (
          <g key={`${link.a}-${link.b}`} fill="var(--text-secondary)">
            {beads.map((bead, step) => {
              const order = chosenId === link.b ? beads.length - 1 - step : step;
              return (
                <circle
                  key={step}
                  cx={bead.x}
                  cy={bead.y}
                  r={bead.r}
                  opacity={on ? 1 : 0}
                  className="transition-opacity duration-200 ease-out"
                  style={{ transitionDelay: on ? `${order * LINK_STEP}ms` : '0ms' }}
                />
              );
            })}
          </g>
        );
      })}
    </svg>
  );
}

/** 가운데의 나 — 누를 것이 아니다(내 사주 카드가 바로 옆 · 아래에 있다). 사람들 위에 선다 — 들어올 때 사람이 내 뒤에서 나온다 */
function Center({ self }: { self: MapModel['self'] }) {
  return (
    <div
      role="img"
      aria-label={`나 ${self.label}, 일간 ${self.stem} ${self.picture}`}
      className={`${elementScope(self.element)} ${styles.center} absolute z-[5] left-1/2 top-1/2 flex -translate-x-1/2 -translate-y-[2.125rem] flex-col items-center sm:-translate-y-[2.75rem]`}
    >
      <span className="relative grid size-[4.25rem] place-items-center rounded-full border-2 border-[color-mix(in_srgb,var(--ink)_30%,transparent)] bg-[var(--tile)] shadow-card sm:size-[5.5rem]">
        {/* 숨 — 원 둘레의 중립색 한 겹 */}
        <span aria-hidden="true" className={`${styles.breathe} pointer-events-none absolute -inset-0.5 rounded-full`} />
        <span aria-hidden="true" className="glyph relative text-[2.25rem] font-bold leading-none text-[var(--ink)] sm:text-[2.875rem]">
          {self.stem}
        </span>
      </span>
      {/* 이름표는 원의 아랫단에 걸친다 — 궤도의 사람(과 점수 딱지)에 닿지 않게 원 밖으로 덜 나온다 */}
      <span
        aria-hidden="true"
        className="relative -mt-3 flex max-w-[6.5rem] items-center gap-1 whitespace-nowrap rounded-full bg-foreground px-2.5 py-0.5 text-[12px] font-bold text-background"
      >
        나<span className="truncate font-semibold opacity-80">· {self.label}</span>
      </span>
    </div>
  );
}

function PersonDot({
  person,
  at,
  enter,
  active,
  receded,
  onChoose,
}: {
  person: MapPerson;
  at: Point;
  /** 들어올 때 이 사람이 떠나는 때(ms) */
  enter: number;
  active: boolean;
  /** 다른 사람을 눌러 이 사람이 물러난 때 */
  receded: boolean;
  onChoose: (event: MouseEvent<HTMLAnchorElement>) => void;
}) {
  const score = person.compat.score;
  /* 제 자리에서 가운데까지 — 들어올 때 여기서 출발한다. 상자가 정사각이라 세로도 `cqw` 다 */
  const seat = {
    left: `${at.x}%`,
    top: `${at.y}%`,
    '--dx': `${Math.round((50 - at.x) * 100) / 100}cqw`,
    '--dy': `${Math.round((50 - at.y) * 100) / 100}cqw`,
    ...delay(enter),
  } as CSSProperties;
  return (
    <a
      href={person.tileHref}
      onClick={onChoose}
      aria-expanded={active}
      aria-controls="home-map-card"
      aria-label={`${person.label}${person.day === null ? '' : `, 일간 ${person.day.stem} ${person.day.picture}`}${
        score !== null ? `, 나와 궁합 ${score}점` : ''
      }`}
      style={seat}
      className={`${elementScope(person.day?.element ?? null)} ${styles.seat} group absolute flex w-[4.5rem] -translate-x-1/2 -translate-y-[1.5rem] flex-col items-center gap-1 rounded-2xl pb-1 transition-opacity duration-300 ${SETTLE} sm:w-[5.75rem] sm:-translate-y-[1.75rem] ${
        receded ? 'opacity-40' : 'opacity-100'
      } ${active ? 'z-10' : ''}`}
    >
      <span
        className={`relative grid size-12 place-items-center rounded-full border-2 transition duration-300 ${SETTLE} group-hover:-translate-y-0.5 group-active:scale-95 sm:size-14 ${
          person.day === null
            ? 'border-dashed border-border-strong bg-surface-sunken'
            : 'border-[color-mix(in_srgb,var(--ink)_30%,transparent)] bg-[var(--tile)]'
        } ${active ? 'scale-[1.08] shadow-[0_0_0_3px_var(--surface),0_0_0_5px_var(--foreground)]' : 'shadow-card'}`}
      >
        <span
          aria-hidden="true"
          className={`glyph font-bold leading-none ${person.day === null ? 'text-lg text-muted' : 'text-[1.4rem] text-[var(--ink)] sm:text-[1.6rem]'}`}
        >
          {person.day?.stem ?? '?'}
        </span>
        {/* 점수 딱지는 원의 위, 가운데에서 먼 쪽 모서리에 — 나의 이름표 · 실 쪽으로 붙지 않고 아래 이름표와도 안 겹친다.
            실이 다 찍힌 뒤에 뜬다 */}
        {score !== null && (
          <span
            aria-hidden="true"
            style={delay(enter + THREAD_AFTER + 6 * BEAD_STEP + 120)}
            className={`${styles.pop} absolute ${at.x < 50 ? '-left-2.5' : '-right-2.5'} -top-1.5 rounded-full bg-foreground px-1.5 py-0.5 text-[11px] font-bold leading-none tabular-nums text-background`}
          >
            {score}
          </span>
        )}
      </span>
      {/* 이름표 — 폭에서 말줄임한다. 전체 이름은 카드와 아래 타일이 든다 */}
      <span
        aria-hidden="true"
        className={`max-w-full truncate rounded-full px-2 py-0.5 text-[12px] font-semibold leading-tight transition-colors duration-300 sm:text-[13px] ${
          active ? 'bg-foreground text-background' : 'bg-surface text-foreground'
        }`}
      >
        {person.label}
      </span>
    </a>
  );
}

const touches = (link: MapLink, chosenId: string | null) => chosenId === link.a || chosenId === link.b;

/**
 * 저장한 두 사람의 궁합 점수 — 누르면 그 글. 보이는 알약은 작아도 누를 자리는 44px 이다. 누른 사람의 것만 선다 —
 * 늘 그려 두고 `visibility` 로 감추므로 감춘 동안은 초점도 보조기기도 안 닿는다. 실이 다 찍힌 뒤에 뜬다.
 */
function LinkScore({ link, placed, chosenId }: { link: MapLink; placed: Record<string, Point>; chosenId: string | null }) {
  const a = placed[link.a];
  const b = placed[link.b];
  if (a === undefined || b === undefined) return null;
  const on = touches(link, chosenId);
  const { mid } = arcBetween(a, b);
  const after = Math.round(threadBetween(a, b).length * LINK_STEP * 0.6);
  return (
    <Link
      href={link.href}
      aria-label={`${link.label} 궁합${link.score === null ? '' : ` ${link.score}점`}`}
      style={{ left: `${mid.x}%`, top: `${mid.y}%`, transitionDelay: on ? `${after}ms` : '0ms' }}
      className={`group absolute grid min-h-11 min-w-11 -translate-x-1/2 -translate-y-1/2 place-items-center rounded-full transition-[opacity,scale,visibility] duration-300 ${SETTLE} ${
        on ? 'visible scale-100 opacity-100' : 'invisible scale-75 opacity-0'
      }`}
    >
      <span className="rounded-full border border-border-strong bg-surface px-2 py-0.5 text-[12px] font-bold tabular-nums text-secondary shadow-card group-hover:border-foreground group-hover:text-foreground group-active:scale-95">
        {link.score === null ? '궁합' : `${link.score}점`}
      </span>
    </Link>
  );
}

/** 0명 — 궤도 꼭대기의 점선 원 하나가 「한 자리 더」를 말한다 */
function AddDot({ href }: { href: string }) {
  return (
    <Link
      href={href}
      style={{ left: '50%', top: '9%' }}
      className="group absolute flex -translate-x-1/2 -translate-y-[1.5rem] flex-col items-center gap-1 rounded-2xl sm:-translate-y-[1.75rem]"
    >
      <span className="grid size-12 place-items-center rounded-full border-2 border-dashed border-border-strong bg-surface text-foreground group-hover:bg-surface-soft group-active:scale-95 sm:size-14">
        <Icon name="plus" />
      </span>
      <span className="whitespace-nowrap rounded-full bg-surface px-2 py-0.5 text-[13px] font-semibold text-foreground">사람 추가</span>
    </Link>
  );
}

/** 아무도 안 눌렀을 때 — 선의 뜻과 누르면 무엇이 열리는가. 판 바닥에 가는 띠 하나로 물러난다 */
function Legend({ empty }: { empty: boolean }) {
  return (
    <div className="border-t border-border px-5 py-3.5 sm:px-7">
      {empty ? (
        <p className="text-[13px] leading-5 text-secondary">사람을 저장하면 이 둘레에 나타나요</p>
      ) : (
        <ul className="flex flex-col gap-1.5 text-[12px] font-medium text-secondary">
          <li className="flex items-center gap-2">
            {/* 지도의 실을 작게 — 점점 커지는 점 셋 */}
            <svg aria-hidden="true" viewBox="0 0 16 6" className="h-1.5 w-4 shrink-0 fill-foreground opacity-60">
              <circle cx="2" cy="3" r="1" />
              <circle cx="7.5" cy="3" r="1.4" />
              <circle cx="13.5" cy="3" r="2" />
            </svg>
            선은 이미 본 궁합, 숫자는 점수예요
          </li>
          <li>사람을 누르면 그 사람의 풀이와 궁합을 볼 수 있어요</li>
        </ul>
      )}
    </div>
  );
}

/* 카드 안 단추 셋 — 한 줄 셋이 360px 에 서도록 옆 여백을 줄인 작은 단추(누를 자리 44px) */
const CARD_BUTTON = 'inline-flex min-h-11 min-w-0 items-center justify-center gap-1 rounded-full px-2 text-[13px] font-semibold active:scale-[0.96]';
const CARD_PRIMARY = `${CARD_BUTTON} bg-accent text-on-accent hover:bg-accent-strong`;
const CARD_SECONDARY = `${CARD_BUTTON} border border-border-strong bg-surface text-foreground hover:border-foreground`;

/**
 * 누른 사람의 작은 카드 — 판 바닥의 범례 자리에 선다. 카드는 중립 면이고 색은 머리의 일간 원에만 있다
 * (지도의 원과 같은 모양이라 「방금 누른 그 사람」으로 읽힌다).
 */
function PersonCard({
  person,
  links,
  onClose,
}: {
  person: MapPerson;
  links: ReturnType<typeof linksOf>;
  onClose: () => void;
}) {
  const score = person.compat.score;
  return (
    <article className="flex flex-col gap-3 border-t border-border bg-surface-soft px-4 py-4 sm:px-6">
      <div className="flex items-start gap-3">
        <span
          aria-hidden="true"
          className={`${elementScope(person.day?.element ?? null)} grid size-12 shrink-0 place-items-center rounded-full border-2 ${
            person.day === null
              ? 'border-dashed border-border-strong bg-surface-sunken text-muted'
              : 'border-[color-mix(in_srgb,var(--ink)_30%,transparent)] bg-[var(--tile)] text-[var(--ink)]'
          }`}
        >
          <span className="glyph text-[1.4rem] font-bold leading-none">{person.day?.stem ?? '?'}</span>
        </span>
        <div className="min-w-0 flex-1">
          <h3 className={`${TYPE_NAME} break-all`}>{person.label}</h3>
          <p className="truncate text-[13px] leading-5 text-secondary">
            {person.day !== null && (
              <span>
                일간 <span className="glyph">{person.day.stem}</span> {person.day.picture}
              </span>
            )}
            {person.day !== null && person.note !== null && ' · '}
            {person.note}
          </p>
        </div>
        <button type="button" onClick={onClose} aria-label="닫기" className={ICON_BUTTON}>
          <Icon name="close" className="size-5" />
        </button>
      </div>

      <p className="line-clamp-2 text-[13px] leading-5">
        {person.unreadable !== null ? (
          <span className="text-secondary">{person.unreadable}</span>
        ) : person.reading === null ? (
          <span className="text-secondary">풀이 없음</span>
        ) : (
          <>
            {!person.reading.current && (
              <span className={`mr-1 ${STALE_CHIP}`}>{READING_STALE_LABEL}</span>
            )}
            <span className="text-foreground">{person.reading.metaphor ?? '만들어 둔 풀이를 이어서 읽어보세요'}</span>
          </>
        )}
      </p>

      {person.unreadable !== null ? (
        <Link href={person.detailHref} className={`${CARD_SECONDARY} self-start px-4`}>
          자세히
        </Link>
      ) : (
        <div className="grid grid-cols-3 gap-1.5">
          <Link href={person.readingHref} className={CARD_PRIMARY}>
            {person.reading === null ? '풀이 받기' : '풀이 보기'}
          </Link>
          <Link href={person.compat.href} className={CARD_SECONDARY} aria-label={score !== null ? `나와 궁합 ${score}점` : '나와 궁합'}>
            <Icon name="heart" className="size-4 shrink-0" />
            {score !== null ? <span className="tabular-nums">{score}점</span> : <span className="truncate">나와 궁합</span>}
          </Link>
          <Link href={person.detailHref} className={CARD_SECONDARY}>
            자세히
          </Link>
        </div>
      )}

      {/* 이미 본 다른 사람과의 궁합만 — 안 본 짝은 권하지 않는다 */}
      {links.length > 0 && (
        <div className="flex flex-col gap-1.5">
          <h4 className={TYPE_META}>다른 사람과의 궁합</h4>
          <ul className="flex flex-wrap gap-1.5">
            {links.map((link) => (
              <li key={link.href} className="min-w-0">
                <Link
                  href={link.href}
                  aria-label={`${person.label} · ${link.otherLabel} 궁합${link.score === null ? '' : ` ${link.score}점`}`}
                  className={`${CARD_SECONDARY} max-w-full px-3`}
                >
                  <span className="truncate">{link.otherLabel}</span>
                  {link.score !== null && <span className="shrink-0 tabular-nums">{link.score}점</span>}
                </Link>
              </li>
            ))}
          </ul>
        </div>
      )}
    </article>
  );
}
