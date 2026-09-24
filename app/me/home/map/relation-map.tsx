'use client';

import Link from 'next/link';
import { useRef, useState, type MouseEvent } from 'react';

import { elementScope } from '../../../element-tone';
import { BUTTON_ON_TILE, BUTTON_ON_TILE_PRIMARY } from '../../../ui/buttons';
import { ElementSymbol } from '../../../ui/element-symbol';
import { Icon } from '../../../ui/icon';
import { TILE, TYPE_META, TYPE_NAME, TYPE_SECTION } from '../../../ui/surfaces';
import { softCurve } from './curve';
import type { MapLink, MapModel, MapPerson } from './model';
import { arcBetween, placeOnOrbit, type Point } from './placement';

/*
  **관계 지도 — 나를 가운데 두고 저장한 사람이 두 궤도에 앉는다.**

  안쪽 궤도는 풀이나 궁합을 본 사람, 바깥 궤도는 저장만 한 사람이다. 선은 이미 본 궁합에만 긋는다
  (`model.ts`). 사람 원을 누르면 지도 아래에 그 사람의 작은 카드(풀이 · 나와 궁합 · 자세히)가 열린다.

  **색은 화면의 한 벌 안에서만 쓴다.** 시안은 지도 판에 크림과 갈색 잉크를 섞은 띠를 깔았는데, 그 두 색이
  홈의 다른 어디에도 없어 지도만 딴 종이 위에 선 것처럼 보였다(2026-09-24 사용자 지적). 지금 판은 다른
  카드와 같은 종이(`--surface`)이고, 안쪽 궤도는 그 종이의 옅은 면(`--surface-soft`), 바깥 궤도와
  선은 테두리 · 보조 글자색이다. 색을 입는 것은 사람뿐이다 — 원이 아래 사람 타일과 같은 오행 파스텔이라
  지도와 타일이 한 벌로 읽힌다.

  **자바스크립트 없이도 길이 돈다.** 사람 원은 아래 그 사람의 타일로 가는 링크(`#person-…`)이고, 타일이
  모든 길을 든다. 자바스크립트가 돌면 같은 누름이 작은 카드를 연다.
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
    requestAnimationFrame(() => card.current?.scrollIntoView({ block: 'nearest', behavior: 'smooth' }));
  };

  return (
    <section
      aria-labelledby="home-map"
      className="flex h-full min-w-0 flex-col rounded-[2rem] border border-border bg-surface shadow-[var(--shadow-card)]"
    >
      <header className="flex items-center justify-between gap-3 px-5 pt-5 sm:px-7 sm:pt-7">
        <h2 id="home-map" className={TYPE_SECTION}>
          관계 지도
        </h2>
        {!empty && <span className={`${TYPE_META} tabular-nums`}>{model.people.length}명과 함께</span>}
      </header>

      {/* 판이 옆 카드보다 길어지면 지도가 가운데로 모인다 — 둘의 윗선 · 아랫선은 격자가 맞춘다 */}
      <div className="grid flex-1 place-items-center px-[7%] pb-9 pt-5">
        <div className="relative aspect-square w-full max-w-[26rem]">
          <Paper model={model} placed={placed.at} radius={placed.radius} chosenId={chosen?.id ?? null} />

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

          {model.links.map((link) => (
            <LinkScore key={`${link.a}-${link.b}`} link={link} placed={placed.at} />
          ))}

          {empty && canAdd && <AddDot href={addHref} />}
        </div>
      </div>

      <div ref={card} id="home-map-card" className="scroll-mt-4 scroll-mb-28 px-3 pb-3 sm:px-4 sm:pb-4 md:scroll-mb-4" aria-live="polite">
        {chosen !== null ? (
          <PersonCard person={chosen} onClose={() => setSelectedId(null)} />
        ) : (
          <Legend empty={empty} />
        )}
      </div>
    </section>
  );
}

/** 종이 위의 그림 — 궤도 · 선. 누를 것은 없다 */
function Paper({
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
  const center = { x: 50, y: 50 };
  return (
    <svg aria-hidden="true" viewBox="0 0 100 100" className={`${elementScope(model.self.element)} absolute inset-0 size-full overflow-visible`}>
      {/* 가운데 — 내 일간의 파스텔이 종이에 스민다(내 사주 카드와 같은 색) */}
      <circle cx="50" cy="50" r={radius.inner - 6} fill="var(--tile)" />
      {/* 안쪽 궤도 — 종이의 옅은 면으로 그은 띠(어두운 화면에서도 판보다 한 단 밝다) */}
      <circle cx="50" cy="50" r={radius.inner} fill="none" stroke="var(--surface-soft)" strokeWidth="8" />
      {/* 바깥 궤도 — 동글동글한 점선 */}
      <circle
        cx="50"
        cy="50"
        r={radius.outer}
        fill="none"
        stroke="var(--border-strong)"
        strokeWidth="1.1"
        strokeDasharray="0 3"
        strokeLinecap="round"
      />

      {/* 나와 이미 본 궁합 — 연필 선 둘을 겹친다 */}
      {model.people.map((person, index) => {
        const point = placed[person.id];
        if (!person.compat.seen || point === undefined) return null;
        const bend = index % 2 === 0 ? 0.1 : -0.1;
        const lit = chosenId === person.id;
        return (
          <g key={person.id} fill="none" strokeLinecap="round" stroke={lit ? 'var(--foreground)' : 'var(--text-secondary)'}>
            <path d={softCurve(center, point, bend)} strokeWidth={lit ? 1.2 : 0.8} opacity={lit ? 0.9 : 0.6} />
            <path d={softCurve(center, point, bend * 1.5)} strokeWidth="0.4" opacity="0.3" />
          </g>
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
            strokeWidth="0.8"
            strokeDasharray="0 2.2"
            strokeLinecap="round"
            opacity="0.8"
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
      className={`${elementScope(self.element)} absolute left-1/2 top-1/2 flex -translate-x-1/2 -translate-y-[2rem] flex-col items-center sm:-translate-y-[2.75rem]`}
    >
      <span className="relative grid size-16 place-items-center rounded-full bg-[var(--tile)] shadow-[var(--shadow-card)] ring-4 ring-surface sm:size-[5.5rem]">
        <span aria-hidden="true" className="glyph text-[1.8rem] font-bold leading-none text-[var(--ink)] sm:text-[2.5rem]">
          {self.stem}
        </span>
        <span className="absolute -right-1.5 -top-1 grid size-7 place-items-center rounded-full bg-surface ring-2 ring-[var(--tile)] sm:size-8">
          <ElementSymbol element={self.element} className="size-5 sm:size-6" />
        </span>
      </span>
      <span
        aria-hidden="true"
        className="relative -mt-2.5 flex max-w-[7rem] items-center gap-1 whitespace-nowrap rounded-full bg-accent px-2.5 py-0.5 text-[12px] font-bold text-on-accent"
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
      className={`${elementScope(person.day?.element ?? null)} group absolute flex w-[4.5rem] -translate-x-1/2 -translate-y-[1.375rem] flex-col items-center gap-1 rounded-2xl pb-1 sm:w-[5.25rem] sm:-translate-y-[1.625rem]`}
    >
      <span
        className={`relative grid size-11 place-items-center rounded-full bg-[var(--tile)] transition group-hover:-translate-y-0.5 group-active:scale-95 sm:size-[3.25rem] ${
          person.day === null ? 'border-2 border-dashed border-[color-mix(in_srgb,var(--ink)_35%,transparent)]' : ''
        } ${active ? 'ring-[3px] ring-accent ring-offset-2 ring-offset-surface' : 'shadow-[var(--shadow-card)] ring-2 ring-surface'}`}
      >
        {person.day === null ? (
          <ElementSymbol element={null} className="size-6" />
        ) : (
          <>
            <span aria-hidden="true" className="glyph text-[1.3rem] font-bold leading-none text-[var(--ink)] sm:text-[1.5rem]">
              {person.day.stem}
            </span>
            <span className="absolute -bottom-1 -left-1 grid size-5 place-items-center rounded-full bg-surface ring-1 ring-[var(--tile)]">
              <ElementSymbol element={person.day.element} className="size-3.5" />
            </span>
          </>
        )}
      </span>
      {/* 이름표 — 이름은 폭에서 말줄임하고 점수는 늘 선다. 전체 이름은 카드와 아래 타일이 든다 */}
      <span
        aria-hidden="true"
        className={`flex max-w-full items-center gap-1 rounded-full px-2 py-0.5 text-[12px] font-semibold leading-tight sm:text-[13px] ${
          active ? 'bg-accent text-on-accent' : 'bg-surface text-foreground ring-1 ring-border'
        }`}
      >
        <span className="min-w-0 truncate">{person.label}</span>
        {score !== null && (
          <span className="flex shrink-0 items-center gap-px tabular-nums">
            <Icon name="heart" className={`size-3 ${active ? '' : 'text-fire'}`} />
            {score}
          </span>
        )}
      </span>
    </a>
  );
}

/** 저장한 두 사람의 궁합 점수 — 누르면 그 글. 보이는 알약은 작아도 누를 자리는 44px 이다 */
function LinkScore({ link, placed }: { link: MapLink; placed: Record<string, Point> }) {
  const a = placed[link.a];
  const b = placed[link.b];
  if (a === undefined || b === undefined) return null;
  const { mid } = arcBetween(a, b);
  return (
    <Link
      href={link.href}
      aria-label={`${link.label} 궁합${link.score === null ? '' : ` ${link.score}점`}`}
      style={{ left: `${mid.x}%`, top: `${mid.y}%` }}
      className="group absolute grid min-h-11 min-w-11 -translate-x-1/2 -translate-y-1/2 place-items-center rounded-full"
    >
      <span className="flex items-center gap-0.5 rounded-full bg-surface py-1 pl-1.5 pr-2 text-[12px] font-bold tabular-nums text-foreground shadow-sm ring-1 ring-border-strong group-hover:ring-foreground group-active:scale-95">
        <Icon name="heart" className="size-3 text-fire" />
        {link.score === null ? '궁합' : link.score}
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
      className="group absolute flex -translate-x-1/2 -translate-y-[1.375rem] flex-col items-center gap-1 rounded-2xl sm:-translate-y-[1.625rem]"
    >
      <span className="grid size-11 place-items-center rounded-full border-2 border-dashed border-border-strong bg-surface text-foreground group-hover:bg-surface-soft group-active:scale-95 sm:size-[3.25rem]">
        <Icon name="plus" />
      </span>
      <span className="whitespace-nowrap rounded-full bg-surface px-2 py-0.5 text-[13px] font-semibold text-foreground ring-1 ring-border">
        사람 추가
      </span>
    </Link>
  );
}

/** 아무도 안 눌렀을 때 — 궤도의 뜻 */
function Legend({ empty }: { empty: boolean }) {
  return (
    <div className="flex flex-col gap-3 rounded-[1.5rem] bg-surface-soft px-4 py-3.5">
      {empty ? (
        <p className="text-[13px] leading-5 text-secondary">저장한 사람이 이 둘레에 앉아요.</p>
      ) : (
        <>
          <ul className="flex flex-wrap gap-x-4 gap-y-1.5 text-[13px] font-medium text-secondary">
            <li className="flex items-center gap-2">
              <span aria-hidden="true" className="h-2.5 w-5 rounded-full bg-surface-soft ring-1 ring-border-strong" />
              풀이나 궁합을 본 사람
            </li>
            <li className="flex items-center gap-2">
              <svg aria-hidden="true" viewBox="0 0 20 4" className="h-1 w-5">
                <path d="M2 2h16" stroke="var(--text-secondary)" strokeWidth="2" strokeDasharray="0 4" strokeLinecap="round" />
              </svg>
              저장만 한 사람
            </li>
            <li className="flex items-center gap-2">
              <svg aria-hidden="true" viewBox="0 0 20 8" className="h-2 w-5">
                <path d="M1 6Q10 0 19 4" fill="none" stroke="var(--text-secondary)" strokeWidth="1.5" strokeLinecap="round" />
              </svg>
              이미 본 궁합과 점수
            </li>
          </ul>
          <p className="text-[13px] leading-5 text-foreground">사람을 누르면 갈 수 있는 곳이 열려요.</p>
        </>
      )}
    </div>
  );
}

/** 누른 사람의 작은 카드 — 그 사람의 오행 색을 입고 행동 셋을 든다 */
function PersonCard({ person, onClose }: { person: MapPerson; onClose: () => void }) {
  const score = person.compat.score;
  return (
    <article className={`${elementScope(person.day?.element ?? null)} ${TILE} relative flex flex-col gap-3 overflow-hidden`}>
      <ElementSymbol element={person.day?.element ?? null} className="pointer-events-none absolute -right-3 -top-3 size-20 opacity-20" />
      <div className="relative flex items-start gap-3">
        <div className="min-w-0 flex-1">
          {person.day !== null && (
            <span className="mb-1.5 inline-flex items-center gap-1 rounded-full bg-[color-mix(in_srgb,var(--surface)_70%,transparent)] py-1 pl-1 pr-2.5 text-[12px] font-semibold text-[var(--ink)]">
              <ElementSymbol element={person.day.element} className="size-5" />
              <span className="glyph text-[15px] font-bold leading-none">{person.day.stem}</span>
              {person.day.picture}
            </span>
          )}
          <h3 className={`${TYPE_NAME} break-all`}>{person.label}</h3>
          {person.note !== null && <p className="mt-0.5 truncate text-[12px] text-secondary">{person.note}</p>}
        </div>
        <button
          type="button"
          onClick={onClose}
          aria-label="닫기"
          className="grid size-11 shrink-0 place-items-center rounded-full bg-[color-mix(in_srgb,var(--surface)_78%,transparent)] text-[var(--ink)] hover:bg-surface active:scale-95"
        >
          <Icon name="close" className="size-5" />
        </button>
      </div>

      <p className="relative line-clamp-2 text-[13px] leading-5">
        {person.unreadable !== null ? (
          <span className="text-secondary">{person.unreadable}</span>
        ) : person.reading === null ? (
          <span className="text-secondary">풀이 없음</span>
        ) : (
          <>
            {!person.reading.current && (
              <span className="mr-1 rounded-full bg-warning-wash px-1.5 py-0.5 text-[11px] font-semibold text-warning">이전 명식</span>
            )}
            <span className="text-foreground">{person.reading.metaphor ?? '만들어 둔 풀이를 이어서 읽어보세요'}</span>
          </>
        )}
      </p>

      {person.unreadable !== null ? (
        <Link href={person.detailHref} className={`${BUTTON_ON_TILE} relative`}>
          자세히
        </Link>
      ) : (
        <div className="relative grid grid-cols-3 gap-1.5">
          <Link href={person.readingHref} className={person.reading === null ? BUTTON_ON_TILE_PRIMARY : BUTTON_ON_TILE}>
            {person.reading === null ? '풀이 받기' : '풀이 보기'}
          </Link>
          <Link href={person.compat.href} className={BUTTON_ON_TILE} aria-label={score !== null ? `나와 궁합 ${score}점` : '나와 궁합'}>
            <Icon name="heart" className="size-4" />
            {score !== null ? <span className="tabular-nums">{score}점</span> : '나와 궁합'}
          </Link>
          <Link href={person.detailHref} className={BUTTON_ON_TILE}>
            자세히
          </Link>
        </div>
      )}
    </article>
  );
}
