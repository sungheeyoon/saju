'use client';

import Link from 'next/link';
import { useRef, useState } from 'react';

import { arcBetween, placeOnOrbit, type Point } from '../../orbit/placement';
import { ON_TILE, ON_TILE_PRIMARY, TERTIARY } from '../buttons';
import { rounded } from '../fonts';
import { ELEMENT_CLASS, ElementSymbol, Icon, NONE_CLASS } from '../symbols';
import { softCurve } from './curve';
import type { MapLink, MapModel, MapPerson } from './model';

/*
  **관계 지도 — 부드러움의 말투로 다시 그린 orbit 의 지도.**

  생각은 orbit 그대로다: 나는 가운데, 저장한 사람은 둘레의 두 궤도(안쪽 = 풀이나 궁합을 본 사람, 바깥 = 저장만
  한 사람), 선은 이미 본 궁합에만. 모양은 warm 이다 — 크림 종이 위에 궤도는 옅은 파스텔 띠(안쪽)와 동글동글한
  점선(바깥), 사람은 제 일간 오행의 파스텔 원에 상징과 글자, 선은 살짝 휜 연필 선.

  사람 원을 누르면 지도 아래에 그 사람의 작은 카드(자세히 · 풀이 · 나와 궁합)가 열린다. 자바스크립트가 없으면
  원은 아무것도 안 하지만, 바로 아래 사람 타일이 모든 길을 링크로 든다 — 지도는 한눈에 보는 그림이고 길은 타일이다.

  **폰에서 이름을 어떻게 세우나**: 원 아래 이름표를 4.5글자 폭에서 말줄임한다(「김수한무…」). 지도는 누가
  어디 있는지만 알리면 되고, 전체 이름은 누르면 열리는 카드와 아래 타일에 선다. orbit 은 이름표 폭 88px 을
  330px 판에 억지로 앉혀 잘렸다 — 여기서는 원을 44px 로 줄이고 이름표를 72px 에 묶어 이웃과 닿지 않게 했고, 나와의 궁합 점수는 원 위의 딱지가
  아니라 이름표 끝에 붙였다(딱지가 바깥 궤도 사람의 이름을 덮었다).
*/

export function RelationMap({ model, addHref, registerHref, canAdd }: { model: MapModel; addHref: string; registerHref: string; canAdd: boolean }) {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const card = useRef<HTMLDivElement>(null);
  const placed = placeOnOrbit(model.people, model.links);
  const chosen = model.people.find((person) => person.id === selectedId) ?? null;
  const empty = model.people.length === 0;

  const choose = (id: string) => {
    setSelectedId((now) => (now === id ? null : id));
    /* 폰에서 카드는 지도 아래다 — 누른 결과가 화면 밖에서 일어나지 않게 끌어온다 */
    requestAnimationFrame(() => card.current?.scrollIntoView({ block: 'nearest', behavior: 'smooth' }));
  };

  return (
    <section aria-labelledby="warm-map" className="relative flex flex-col overflow-hidden rounded-[2rem] bg-[var(--cream)]">
      <header className="flex items-center justify-between gap-3 px-5 pt-5 sm:px-7 sm:pt-7">
        <h2 id="warm-map" className={`${rounded.className} text-[1.5rem] leading-8 text-foreground`}>
          관계 지도
        </h2>
        {!empty && (
          <span className="text-[13px] font-semibold tabular-nums text-[var(--cream-ink)]">{model.people.length}명과 함께</span>
        )}
      </header>

      <div className="px-[7%] pb-10 pt-6 sm:pb-12">
        <div className="relative aspect-square w-full">
          <Paper model={model} placed={placed.at} radius={placed.radius} chosenId={chosen?.id ?? null} />

          <Center self={model.self} registerHref={registerHref} />

          {model.people.map((person) => {
            const point = placed.at[person.id];
            if (point === undefined) return null;
            return (
              <PersonDot
                key={person.id}
                person={person}
                at={point}
                active={chosen?.id === person.id}
                showScore={model.self !== null}
                onChoose={() => choose(person.id)}
              />
            );
          })}

          {model.links.map((link) => (
            <LinkScore key={`${link.a}-${link.b}`} link={link} placed={placed.at} />
          ))}

          {empty && canAdd && <AddDot href={addHref} />}
        </div>
      </div>

      <div ref={card} className="scroll-mt-4 px-3 pb-3 sm:px-4 sm:pb-4" aria-live="polite">
        {chosen !== null ? (
          <PersonCard person={chosen} hasSelf={model.self !== null} onClose={() => setSelectedId(null)} />
        ) : (
          <Legend model={model} empty={empty} />
        )}
      </div>
    </section>
  );
}

/** 종이 위의 그림 — 궤도 띠 · 점선 · 연필 선. 누를 것은 없다 */
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
    <svg
      aria-hidden="true"
      viewBox="0 0 100 100"
      className={`${model.self === null ? NONE_CLASS : ELEMENT_CLASS[model.self.element]} absolute inset-0 size-full overflow-visible`}
    >
      {/* 가운데의 옅은 번짐 — 내 일간 색이 종이에 스민다 */}
      <circle cx="50" cy="50" r={radius.inner - 6} className="fill-[var(--tile)]" opacity="0.7" />
      {/* 안쪽 궤도 — 파스텔 띠 */}
      <circle
        cx="50"
        cy="50"
        r={radius.inner}
        className="fill-none stroke-[color-mix(in_srgb,var(--cream-ink)_10%,transparent)]"
        strokeWidth="8"
      />
      {/* 바깥 궤도 — 동글동글한 점선 */}
      <circle
        cx="50"
        cy="50"
        r={radius.outer}
        className="fill-none stroke-[color-mix(in_srgb,var(--cream-ink)_38%,transparent)]"
        strokeWidth="1.1"
        strokeDasharray="0 3"
        strokeLinecap="round"
      />

      {/* 나와 이미 본 궁합 — 연필 선 둘을 겹친다 */}
      {model.self !== null &&
        model.people.map((person, index) => {
          const point = placed[person.id];
          if (!person.compat.seen || point === undefined) return null;
          const bend = index % 2 === 0 ? 0.1 : -0.1;
          const lit = chosenId === person.id;
          return (
            <g key={person.id} className="fill-none stroke-[var(--cream-ink)]" strokeLinecap="round">
              <path d={softCurve(center, point, bend)} strokeWidth={lit ? 1.2 : 0.8} opacity={lit ? 0.9 : 0.65} />
              <path d={softCurve(center, point, bend * 1.5)} strokeWidth="0.4" opacity="0.35" />
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
            className="fill-none stroke-[color-mix(in_srgb,var(--cream-ink)_70%,transparent)]"
            strokeWidth="0.8"
            strokeDasharray="0 2.2"
            strokeLinecap="round"
          />
        );
      })}
    </svg>
  );
}

/** 가운데의 나 — 누를 것이 아니다(내 카드가 바로 아래에 있다). 내 사주가 없으면 빈 원이 등록으로 이끈다 */
function Center({ self, registerHref }: { self: MapModel['self']; registerHref: string }) {
  if (self === null) {
    return (
      <Link
        href={registerHref}
        className="group absolute left-1/2 top-1/2 flex -translate-x-1/2 -translate-y-[2rem] flex-col items-center rounded-3xl focus-visible:outline-[3px] focus-visible:outline-offset-4 focus-visible:outline-[color-mix(in_srgb,var(--btn)_45%,transparent)] sm:-translate-y-[2.75rem]"
      >
        <span className="grid size-16 place-items-center rounded-full border-2 border-dashed border-[color-mix(in_srgb,var(--cream-ink)_45%,transparent)] bg-[var(--card)] text-[var(--cream-ink)] group-hover:bg-[var(--cream)] group-active:scale-95 sm:size-[5.5rem]">
          <Icon name="plus" className="size-7" />
        </span>
        <span className="relative -mt-2.5 whitespace-nowrap rounded-full bg-[var(--btn)] px-2.5 py-0.5 text-[12px] font-bold text-[var(--on-btn)] sm:text-[13px]">
          내 명식 등록
        </span>
      </Link>
    );
  }

  return (
    <div
      role="img"
      aria-label={`나 ${self.label}, 일간 ${self.stem} ${self.picture}`}
      className={`${ELEMENT_CLASS[self.element]} absolute left-1/2 top-1/2 flex -translate-x-1/2 -translate-y-[2rem] flex-col items-center sm:-translate-y-[2.75rem]`}
    >
      <span className="relative grid size-16 place-items-center rounded-full bg-[var(--tile)] shadow-[0_10px_24px_-12px_rgba(60,48,30,0.55)] ring-4 ring-[var(--card)] sm:size-[5.5rem]">
        <span aria-hidden="true" className="glyph text-[1.8rem] font-bold leading-none text-[var(--ink)] sm:text-[2.5rem]">
          {self.stem}
        </span>
        <span className="absolute -right-1.5 -top-1 grid size-7 place-items-center rounded-full bg-[var(--card)] ring-2 ring-[var(--tile)] sm:size-8">
          <ElementSymbol element={self.element} className="size-5 sm:size-6" />
        </span>
      </span>
      <span
        aria-hidden="true"
        className="relative -mt-2.5 flex max-w-[7rem] items-center gap-1 whitespace-nowrap rounded-full bg-[var(--btn)] px-2.5 py-0.5 text-[12px] font-bold text-[var(--on-btn)]"
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
  showScore,
  onChoose,
}: {
  person: MapPerson;
  at: Point;
  active: boolean;
  showScore: boolean;
  onChoose: () => void;
}) {
  const tone = person.day === null ? NONE_CLASS : ELEMENT_CLASS[person.day.element];
  const score = showScore && person.compat.score !== null ? person.compat.score : null;
  return (
    <button
      type="button"
      onClick={onChoose}
      aria-pressed={active}
      aria-label={`${person.label}${person.day === null ? '' : `, 일간 ${person.day.stem} ${person.day.picture}`}${
        score !== null ? `, 나와 궁합 ${score}점` : ''
      }`}
      style={{ left: `${at.x}%`, top: `${at.y}%` }}
      className={`${tone} group absolute flex w-[4.5rem] -translate-x-1/2 -translate-y-[1.375rem] flex-col items-center gap-1 rounded-2xl pb-1 focus-visible:outline-[3px] focus-visible:outline-offset-2 focus-visible:outline-[color-mix(in_srgb,var(--btn)_45%,transparent)] sm:w-[5.25rem] sm:-translate-y-[1.625rem]`}
    >
      <span
        className={`relative grid size-11 place-items-center rounded-full bg-[var(--tile)] transition group-hover:-translate-y-0.5 group-active:scale-95 sm:size-[3.25rem] ${
          person.day === null ? 'border-2 border-dashed border-[color-mix(in_srgb,var(--ink)_35%,transparent)]' : ''
        } ${
          active
            ? 'ring-[3px] ring-[var(--btn)] ring-offset-2 ring-offset-[var(--cream)]'
            : 'shadow-[0_6px_14px_-8px_rgba(60,48,30,0.6)] ring-2 ring-[var(--card)]'
        }`}
      >
        {person.day === null ? (
          <ElementSymbol element={null} className="size-6" />
        ) : (
          <>
            <span aria-hidden="true" className="glyph text-[1.3rem] font-bold leading-none text-[var(--ink)] sm:text-[1.5rem]">
              {person.day.stem}
            </span>
            <span className="absolute -bottom-1 -left-1 grid size-5 place-items-center rounded-full bg-[var(--card)] ring-1 ring-[var(--tile)]">
              <ElementSymbol element={person.day.element} className="size-3.5" />
            </span>
          </>
        )}
      </span>
      {/* 이름표 — 이름은 폭에서 말줄임하고 점수는 늘 선다(orbit 은 점수 딱지가 이웃의 이름을 덮었다) */}
      <span
        aria-hidden="true"
        className={`flex max-w-full items-center gap-1 rounded-full px-2 py-0.5 text-[12px] font-semibold leading-tight sm:text-[13px] ${
          active ? 'bg-[var(--btn)] text-[var(--on-btn)]' : 'bg-[color-mix(in_srgb,var(--card)_88%,transparent)] text-foreground'
        }`}
      >
        <span className="min-w-0 truncate">{person.label}</span>
        {score !== null && (
          <span className="flex shrink-0 items-center gap-px tabular-nums">
            <Icon name="heart" className={`size-3 ${active ? '' : 'text-[var(--fire-ink)]'}`} />
            {score}
          </span>
        )}
      </span>
    </button>
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
      className="group absolute grid min-h-11 min-w-11 -translate-x-1/2 -translate-y-1/2 place-items-center rounded-full focus-visible:outline-[3px] focus-visible:outline-[color-mix(in_srgb,var(--btn)_45%,transparent)]"
    >
      <span className="flex items-center gap-0.5 rounded-full bg-[var(--card)] py-1 pl-1.5 pr-2 text-[12px] font-bold tabular-nums text-foreground shadow-sm ring-1 ring-[color-mix(in_srgb,var(--cream-ink)_35%,transparent)] group-hover:ring-[var(--cream-ink)] group-active:scale-95">
        <Icon name="heart" className="size-3 text-[var(--fire-ink)]" />
        {link.score === null ? '궁합' : link.score}
      </span>
    </Link>
  );
}

/** 0명 — 바깥 궤도 꼭대기에 점선 원 하나가 「한 자리 더」를 말한다 */
function AddDot({ href }: { href: string }) {
  return (
    <Link
      href={href}
      style={{ left: '50%', top: '6%' }}
      className="group absolute flex -translate-x-1/2 -translate-y-[1.375rem] flex-col items-center gap-1 rounded-2xl focus-visible:outline-[3px] focus-visible:outline-offset-2 focus-visible:outline-[color-mix(in_srgb,var(--btn)_45%,transparent)] sm:-translate-y-[1.625rem]"
    >
      <span className="grid size-11 place-items-center rounded-full border-2 border-dashed border-[color-mix(in_srgb,var(--cream-ink)_50%,transparent)] bg-[var(--card)] text-[var(--cream-ink)] group-hover:bg-[var(--cream)] group-active:scale-95 sm:size-[3.25rem]">
        <Icon name="plus" />
      </span>
      <span className="whitespace-nowrap rounded-full bg-[var(--card)] px-2 py-0.5 text-[13px] font-semibold text-foreground">사람 추가</span>
    </Link>
  );
}

/** 아무도 안 눌렀을 때 — 궤도의 뜻과 최근 풀이 한 줄 */
function Legend({ model, empty }: { model: MapModel; empty: boolean }) {
  return (
    <div className="flex flex-col gap-3 rounded-[1.5rem] bg-[color-mix(in_srgb,var(--card)_70%,transparent)] px-4 py-3.5">
      {empty ? (
        <p className="text-[13px] leading-5 text-secondary">저장한 사람이 이 둘레에 앉아요.</p>
      ) : (
        <>
          <ul className="flex flex-wrap gap-x-4 gap-y-1.5 text-[12px] font-medium text-secondary">
            <li className="flex items-center gap-2">
              <span aria-hidden="true" className="h-2.5 w-5 rounded-full bg-[color-mix(in_srgb,var(--cream-ink)_16%,transparent)]" />
              풀이나 궁합을 본 사람
            </li>
            <li className="flex items-center gap-2">
              <svg aria-hidden="true" viewBox="0 0 20 4" className="h-1 w-5">
                <path d="M2 2h16" className="stroke-[var(--cream-ink)]" strokeWidth="2" strokeDasharray="0 4" strokeLinecap="round" />
              </svg>
              저장만 한 사람
            </li>
            {(model.self !== null || model.links.length > 0) && (
              <li className="flex items-center gap-2">
                <svg aria-hidden="true" viewBox="0 0 20 8" className="h-2 w-5">
                  <path d="M1 6Q10 0 19 4" className="fill-none stroke-[var(--cream-ink)]" strokeWidth="1.5" strokeLinecap="round" />
                </svg>
                이미 본 궁합과 점수
              </li>
            )}
          </ul>
          <p className="text-[13px] leading-5 text-foreground">사람을 누르면 갈 수 있는 곳이 열려요.</p>
        </>
      )}
      {model.recent !== null && (
        <div className="flex flex-wrap items-center justify-between gap-x-3 border-t border-[var(--line)] pt-2">
          <span className="min-w-0 text-[13px] text-secondary">
            최근 풀이 · <span className="font-semibold text-foreground">{model.recent.title}</span>
            {model.recent.score !== null && <span className="ml-1 tabular-nums text-[var(--cream-ink)]">{model.recent.score}점</span>}
          </span>
          <Link href={model.recent.href} className={TERTIARY}>
            이어서 읽기
            <Icon name="arrow" className="size-4" />
          </Link>
        </div>
      )}
    </div>
  );
}

/** 누른 사람의 작은 카드 — 그 사람의 오행 색을 입고 행동 셋을 든다 */
function PersonCard({ person, hasSelf, onClose }: { person: MapPerson; hasSelf: boolean; onClose: () => void }) {
  const tone = person.day === null ? NONE_CLASS : ELEMENT_CLASS[person.day.element];
  const score = person.compat.score;
  return (
    <article className={`${tone} relative flex flex-col gap-3 overflow-hidden rounded-[1.5rem] bg-[var(--tile)] p-4`}>
      <ElementSymbol element={person.day?.element ?? null} className="pointer-events-none absolute -right-3 -top-3 size-20 opacity-20" />
      <div className="relative flex items-start gap-3">
        <div className="min-w-0 flex-1">
          {person.day !== null && (
            <span className="mb-1.5 inline-flex items-center gap-1 rounded-full bg-[color-mix(in_srgb,var(--card)_70%,transparent)] py-1 pl-1 pr-2.5 text-[12px] font-semibold text-[var(--ink)]">
              <ElementSymbol element={person.day.element} className="size-5" />
              <span className="glyph text-[15px] font-bold leading-none">{person.day.stem}</span>
              {person.day.picture}
            </span>
          )}
          <h3 className={`${rounded.className} break-all text-[1.3rem] leading-7 text-foreground`}>{person.label}</h3>
          {person.note !== null && <p className="mt-0.5 truncate text-[12px] text-secondary">{person.note}</p>}
        </div>
        <button
          type="button"
          onClick={onClose}
          aria-label="닫기"
          className="grid size-11 shrink-0 place-items-center rounded-full bg-[color-mix(in_srgb,var(--card)_78%,transparent)] text-[var(--ink)] hover:bg-[var(--card)] active:scale-95 focus-visible:outline-[3px] focus-visible:outline-[color-mix(in_srgb,var(--btn)_45%,transparent)]"
        >
          <Icon name="plus" className="size-5 rotate-45" />
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
        <Link href={person.detailHref} className={`${ON_TILE} relative`}>
          자세히
        </Link>
      ) : (
        <div className="relative grid grid-cols-3 gap-1.5">
          <Link href={person.readingHref} className={person.reading === null ? ON_TILE_PRIMARY : ON_TILE}>
            {person.reading === null ? '풀이 받기' : '풀이 보기'}
          </Link>
          <Link href={person.compat.href} className={ON_TILE} aria-label={score !== null ? `나와 궁합 ${score}점` : hasSelf ? '나와 궁합' : '궁합'}>
            <Icon name="heart" className="size-4" />
            {score !== null ? <span className="tabular-nums">{score}점</span> : hasSelf ? '나와 궁합' : '궁합'}
          </Link>
          <Link href={person.detailHref} className={ON_TILE}>
            자세히
          </Link>
        </div>
      )}
    </article>
  );
}
