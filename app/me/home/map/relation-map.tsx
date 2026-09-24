'use client';

import Link from 'next/link';
import { useRef, useState, type MouseEvent } from 'react';

import { elementScope } from '../../../element-tone';
import { ICON_BUTTON } from '../../../ui/buttons';
import { Icon } from '../../../ui/icons';
import { TYPE_META, TYPE_NAME, TYPE_SECTION } from '../../../ui/surfaces';
import type { MapLink, MapModel, MapPerson } from './model';
import { arcBetween, placeOnOrbit, type Point } from './placement';

/*
  **관계 지도 — 나를 가운데 두고 저장한 사람이 두 궤도에 앉는다.**

  이 그림이 말하는 것은 넷뿐이고, 그 넷만 눈에 띄게 한다.
  1. **가운데의 나가 가장 무겁다** — 가장 큰 원 · 가장 큰 글자 · 이름표만 먹색으로 채운다.
  2. **두 궤도는 사용자가 한 일의 기록이다** — 안쪽 실선은 「풀이나 궁합을 본 사람」, 바깥 점선은 「저장만
     한 사람」. 가깝다는 판정이 아니므로 궤도는 가는 중립 선 한 줄이다(면 · 띠를 깔지 않는다).
  3. **선은 이미 본 궁합에만** — 나와의 궁합은 가운데서 뻗는 곧은 먹선 + 점 위의 점수 딱지, 저장한 두
     사람의 궁합은 바깥으로 휜 점선 + 점수 알약(누르면 그 글). 없는 관계를 지어내지 않는다(`model.ts`).
  4. **색은 사람에게만 있다.** 판 · 궤도 · 선은 종이와 먹의 중립 토큰이고, 오행 파스텔은 사람 원(나 포함)
     안에만 든다 — 그래서 색이 곧 「그 사람의 일간」으로 읽힌다. 색만으로 말하지 않게 원에는 일간 글자가,
     보조기기에는 「일간 庚 쇠」가 선다.

  **자바스크립트 없이도 길이 돈다.** 사람 원은 아래 그 사람의 타일로 가는 링크(`#person-…`)이고, 타일이
  모든 길을 든다. 자바스크립트가 돌면 같은 누름이 지도 아래에 그 사람의 작은 카드를 연다.
*/

export function RelationMap({ model, addHref, canAdd }: { model: MapModel; addHref: string; canAdd: boolean }) {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const card = useRef<HTMLDivElement>(null);
  const placed = placeOnOrbit(model.people, model.links);
  const chosen = model.people.find((person) => person.id === selectedId) ?? null;
  const empty = model.people.length === 0;

  const choose = (event: MouseEvent<HTMLAnchorElement>, id: string) => {
    event.preventDefault();
    setSelectedId((now) => (now === id ? null : id));
    /* 폰에서 카드는 지도 아래다 — 누른 결과가 화면 밖(하단 독 뒤)에서 일어나지 않게 끌어온다 */
    if (selectedId !== id) requestAnimationFrame(() => card.current?.scrollIntoView({
      block: 'nearest',
      behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'instant' : 'smooth',
    }));
  };

  return (
    <section
      aria-labelledby="home-map"
      className="flex h-full min-w-0 flex-col overflow-hidden rounded-[2rem] border border-border bg-surface shadow-[var(--shadow-card)]"
    >
      <header className="flex items-center justify-between gap-3 px-5 pt-5 sm:px-7 sm:pt-7">
        <h2 id="home-map" className={TYPE_SECTION}>
          관계 지도
        </h2>
        {!empty && <span className={`${TYPE_META} tabular-nums`}>{model.people.length}명과 함께</span>}
      </header>

      {/* 판이 옆 카드보다 길어지면 지도가 가운데로 모인다 — 둘의 윗선 · 아랫선은 격자가 맞춘다 */}
      <div className="grid flex-1 place-items-center px-[5%] pb-8 pt-6 sm:px-[8%]">
        <div className="relative aspect-square w-full max-w-[26rem]">
          <Orbits model={model} placed={placed.at} radius={placed.radius} chosenId={chosen?.id ?? null} />

          <Center self={model.self} />

          {model.people.map((person) => {
            const point = placed.at[person.id];
            if (point === undefined) return null;
            return (
              <PersonDot
                key={person.id}
                person={person}
                at={point}
                active={chosen?.id === person.id}
                onChoose={(event) => choose(event, person.id)}
              />
            );
          })}

          {/* 점수 알약은 사람 원보다 뒤에 둔다 — 겹치면 알약이 위에 선다 */}
          {model.links.map((link) => (
            <LinkScore key={`${link.a}-${link.b}`} link={link} placed={placed.at} chosenId={chosen?.id ?? null} />
          ))}

          {empty && canAdd && <AddDot href={addHref} />}
        </div>
      </div>

      <div ref={card} id="home-map-card" className="scroll-mt-4 scroll-mb-28 md:scroll-mb-4" aria-live="polite">
        {chosen !== null ? (
          <PersonCard person={chosen} onClose={() => {
            setSelectedId(null);
            card.current?.closest('section')?.querySelector<HTMLAnchorElement>('a[aria-expanded="true"]')?.focus({ preventScroll: true });
          }} />
        ) : null}
        <Legend empty={empty} />
      </div>
    </section>
  );
}

/** 궤도 둘과 이미 본 궁합의 선 — 전부 중립색. 누를 것은 없다 */
function Orbits({
  model,
  placed,
  radius,
  chosenId,
}: {
  model: MapModel;
  placed: Record<string, Point>;
  radius: { inner: number; outer: number };
  chosenId: string | null;
}) {
  return (
    <svg aria-hidden="true" viewBox="0 0 100 100" className="absolute inset-0 size-full overflow-visible">
      <circle cx="50" cy="50" r={radius.inner} fill="none" stroke="var(--border-strong)" strokeWidth="1" vectorEffect="non-scaling-stroke" />
      <circle
        cx="50"
        cy="50"
        r={radius.outer}
        fill="none"
        stroke="var(--border-strong)"
        strokeWidth="1"
        strokeDasharray="3 5"
        vectorEffect="non-scaling-stroke"
      />

      {/* 나와 이미 본 궁합 — 가운데서 곧게 뻗는 먹선. 고른 사람의 선만 굵어진다 */}
      {model.people.map((person) => {
        const point = placed[person.id];
        if (!person.compat.seen || point === undefined) return null;
        const lit = chosenId === person.id;
        return (
          <line
            key={person.id}
            x1="50"
            y1="50"
            x2={point.x}
            y2={point.y}
            stroke="var(--foreground)"
            strokeWidth={lit ? 2.5 : 1.5}
            strokeLinecap="round"
            opacity={lit ? 1 : chosenId === null ? 0.55 : 0.16}
            vectorEffect="non-scaling-stroke"
          />
        );
      })}

      {/* 저장한 두 사람 사이의 궁합 — 바깥으로 휜 점선 */}
      {model.links.map((link) => {
        const a = placed[link.a];
        const b = placed[link.b];
        if (a === undefined || b === undefined) return null;
        return (
          <path
            key={`${link.a}-${link.b}`}
            d={arcBetween(a, b).d}
            fill="none"
            stroke="var(--text-secondary)"
            strokeWidth={chosenId === link.a || chosenId === link.b ? 2 : 1.5}
            opacity={chosenId === null || chosenId === link.a || chosenId === link.b ? 1 : 0.2}
            strokeDasharray="1 4"
            strokeLinecap="round"
            vectorEffect="non-scaling-stroke"
          />
        );
      })}
    </svg>
  );
}

/** 가운데의 나 — 누를 것이 아니다(내 사주 카드가 바로 옆 · 아래에 있다) */
function Center({ self }: { self: MapModel['self'] }) {
  return (
    <div
      role="img"
      aria-label={`나 ${self.label}, 일간 ${self.stem} ${self.picture}`}
      className={`${elementScope(self.element)} absolute left-1/2 top-1/2 flex -translate-x-1/2 -translate-y-[2.125rem] flex-col items-center sm:-translate-y-[2.75rem]`}
    >
      <span className="grid size-[4.25rem] place-items-center rounded-full border-2 border-[color-mix(in_srgb,var(--ink)_30%,transparent)] bg-[var(--tile)] shadow-[var(--shadow-card)] sm:size-[5.5rem]">
        <span aria-hidden="true" className="glyph text-[2.25rem] font-bold leading-none text-[var(--ink)] sm:text-[2.875rem]">
          {self.stem}
        </span>
      </span>
      {/* 이름표는 원의 아랫단에 걸친다 — 안쪽 궤도의 사람(과 점수 딱지)에 닿지 않게 원 밖으로 덜 나온다 */}
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
  active,
  onChoose,
}: {
  person: MapPerson;
  at: Point;
  active: boolean;
  onChoose: (event: MouseEvent<HTMLAnchorElement>) => void;
}) {
  const score = person.compat.score;
  return (
    <a
      href={person.tileHref}
      onClick={onChoose}
      aria-expanded={active}
      aria-controls="home-map-card"
      aria-label={`${person.label}${person.day === null ? '' : `, 일간 ${person.day.stem} ${person.day.picture}`}${
        score !== null ? `, 나와 궁합 ${score}점` : ''
      }`}
      style={{ left: `${at.x}%`, top: `${at.y}%` }}
      className={`${elementScope(person.day?.element ?? null)} group absolute flex w-[4.5rem] -translate-x-1/2 -translate-y-[1.5rem] flex-col items-center gap-1 rounded-2xl pb-1 sm:w-[5.75rem] sm:-translate-y-[1.75rem]`}
    >
      <span
        className={`relative grid size-12 place-items-center rounded-full border-2 transition group-hover:-translate-y-0.5 group-active:scale-95 sm:size-14 ${
          person.day === null
            ? 'border-dashed border-border-strong bg-surface-sunken'
            : 'border-[color-mix(in_srgb,var(--ink)_30%,transparent)] bg-[var(--tile)]'
        } ${active ? 'shadow-[0_0_0_3px_var(--foreground)]' : 'shadow-[var(--shadow-card)]'}`}
      >
        <span
          aria-hidden="true"
          className={`glyph font-bold leading-none ${person.day === null ? 'text-lg text-muted' : 'text-[1.4rem] text-[var(--ink)] sm:text-[1.6rem]'}`}
        >
          {person.day?.stem ?? '?'}
        </span>
        {/* 점수 딱지는 원의 위, 가운데에서 먼 쪽 모서리에 — 나의 이름표 · 선 쪽으로 붙지 않고 아래 이름표와도 안 겹친다 */}
        {score !== null && (
          <span
            aria-hidden="true"
            className={`absolute ${at.x < 50 ? '-left-2.5' : '-right-2.5'} -top-1.5 rounded-full bg-foreground px-1.5 py-0.5 text-[11px] font-bold leading-none tabular-nums text-background`}
          >
            {score}
          </span>
        )}
      </span>
      {/* 이름표 — 폭에서 말줄임한다. 전체 이름은 카드와 아래 타일이 든다 */}
      <span
        aria-hidden="true"
        className={`max-w-full truncate rounded-full px-2 py-0.5 text-[12px] font-semibold leading-tight sm:text-[13px] ${
          active ? 'bg-foreground text-background' : 'bg-surface text-foreground'
        }`}
      >
        {person.label}
      </span>
    </a>
  );
}

/** 저장한 두 사람의 궁합 점수 — 누르면 그 글. 보이는 알약은 작아도 누를 자리는 44px 이다 */
function LinkScore({ link, placed, chosenId }: { link: MapLink; placed: Record<string, Point>; chosenId: string | null }) {
  const a = placed[link.a];
  const b = placed[link.b];
  if (a === undefined || b === undefined) return null;
  const { mid } = arcBetween(a, b);
  return (
    <Link
      href={link.href}
      aria-label={`${link.label} 궁합${link.score === null ? '' : ` ${link.score}점`}`}
      style={{ left: `${mid.x}%`, top: `${mid.y}%` }}
      className={`group absolute grid min-h-11 min-w-11 -translate-x-1/2 -translate-y-1/2 place-items-center rounded-full transition-opacity ${chosenId !== null && chosenId !== link.a && chosenId !== link.b ? 'opacity-35 hover:opacity-100 focus-visible:opacity-100' : 'opacity-100'}`}
    >
      <span className="rounded-full border border-border-strong bg-surface px-2 py-0.5 text-[12px] font-bold tabular-nums text-secondary group-hover:border-foreground group-hover:text-foreground group-active:scale-95">
        {link.score === null ? '궁합' : `${link.score}점`}
      </span>
    </Link>
  );
}

/** 0명 — 바깥 궤도 꼭대기의 점선 원 하나가 「한 자리 더」를 말한다 */
function AddDot({ href }: { href: string }) {
  return (
    <Link
      href={href}
      style={{ left: '50%', top: '6%' }}
      className="group absolute flex -translate-x-1/2 -translate-y-[1.5rem] flex-col items-center gap-1 rounded-2xl sm:-translate-y-[1.75rem]"
    >
      <span className="grid size-12 place-items-center rounded-full border-2 border-dashed border-border-strong bg-surface text-foreground group-hover:bg-surface-soft group-active:scale-95 sm:size-14">
        <Icon name="plus" />
      </span>
      <span className="whitespace-nowrap rounded-full bg-surface px-2 py-0.5 text-[13px] font-semibold text-foreground">사람 추가</span>
    </Link>
  );
}

/** 아무도 안 눌렀을 때 — 궤도와 선의 뜻. 판 바닥에 가는 띠 하나로 물러난다 */
function Legend({ empty }: { empty: boolean }) {
  return (
    <div className="border-t border-border px-5 py-3.5 sm:px-7">
      {empty ? (
        <p className="text-[13px] leading-5 text-secondary">저장한 사람이 이 둘레에 앉아요.</p>
      ) : (
        <ul className="flex flex-wrap gap-x-4 gap-y-1.5 text-[12px] font-medium text-secondary">
          <li className="flex items-center gap-2">
            <span aria-hidden="true" className="inline-block size-3 rounded-full border border-border-strong" />
            풀이나 궁합을 본 사람
          </li>
          <li className="flex items-center gap-2">
            <span aria-hidden="true" className="inline-block size-3 rounded-full border border-dashed border-border-strong" />
            저장만 한 사람
          </li>
          <li className="flex items-center gap-2">
            <span aria-hidden="true" className="inline-block h-0.5 w-4 rounded-full bg-foreground opacity-70" />
            이미 본 궁합과 점수
          </li>
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
function PersonCard({ person, onClose }: { person: MapPerson; onClose: () => void }) {
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
              <span className="mr-1 rounded-full bg-warning-wash px-1.5 py-0.5 text-[11px] font-semibold text-warning">수정 전</span>
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
    </article>
  );
}
