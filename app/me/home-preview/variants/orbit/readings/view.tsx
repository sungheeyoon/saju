'use client';

import Link from 'next/link';
import { useEffect, useRef, useState, type ReactNode } from 'react';

import { ELEMENT_TONE } from '../../../../../element-tone';
import { previewHref } from '../../../shared/preview-href';
import { arcBetween, type Point } from '../placement';
import { Arrow, BUTTON, BookIcon, PairIcon } from '../ui';
import { SAMPLE_BODY } from './body';
import { COPY } from './copy';
import { SELF_ID, type Entry, type Node, type ReadingsModel } from './model';

/*
  **풀이 — 「누구와 누구의 글인가」가 먼저 보이는 목록과, 읽기 좋은 글 칸.**

  홈 지도의 문법을 그대로 잇는다: 한 점 = 한 사람, 두 점과 실선 = 이미 본 궁합(점수), 점선 = 아직 만드는 중.
  1. 맨 위 「함께 보는 궁합」 — 나와 상대 사이의 점선이 지금 만드는 중이라는 것을 모양으로 말한다.
  2. 「글이 있는 관계」 — 글이 하나라도 있는 사람만 앉힌 작은 궤도. 점을 누르면 아래 목록이 그 사람의 글로 좁혀진다.
  3. 두 구역의 줄마다 앞에 같은 표식(한 점 / 두 점과 선)이 선다 — 제목을 읽기 전에 몇 사람의 글인지 보인다.
  4. 글 칸 — 데스크톱은 목록 옆 두 번째 칸, 폰은 목록 자리를 바꿔 끼운다(뒤로 가면 누른 줄로 돌아온다).

  고르는 것은 브라우저 상태뿐이다. 주소를 바꾸지 않는다 — `page.tsx` 는 이 시안이 못 고친다.
*/

type View = 'list' | 'reader';

export function ReadingsView({ model, hasSelf }: { model: ReadingsModel; hasSelf: boolean }) {
  const entries = [...model.singles, ...model.pairs];
  const [focus, setFocus] = useState<string | null>(null);
  const [openKey, setOpenKey] = useState<string | null>(entries[0]?.key ?? null);
  const [view, setView] = useState<View>('list');
  const reader = useRef<HTMLDivElement>(null);
  const cameFrom = useRef<string | null>(null);

  const open = entries.find((entry) => entry.key === openKey) ?? null;
  const has = (entry: Entry) => focus === null || entry.subjects.includes(focus);
  const singles = model.singles.filter(has);
  const pairs = model.pairs.filter(has);
  const making = model.making.filter((one) => focus === null || focus === SELF_ID || focus === one.id);
  const nothing = entries.length === 0 && model.making.length === 0;

  const choose = (key: string) => {
    setOpenKey(key);
    setView('reader');
    cameFrom.current = key;
    /* 글 칸 머리가 화면 밖이면 끌어온다 — 폰은 목록이 사라지니 늘 맨 위로 */
    requestAnimationFrame(() => {
      const top = reader.current?.getBoundingClientRect().top ?? 0;
      if (top < 0 || top > window.innerHeight * 0.6) reader.current?.scrollIntoView({ block: 'start', behavior: 'smooth' });
    });
  };

  const back = () => setView('list');

  /* 폰에서 목록으로 돌아오면 방금 연 줄에 선다 */
  useEffect(() => {
    if (view !== 'list' || cameFrom.current === null) return;
    document.getElementById(rowId(cameFrom.current))?.scrollIntoView({ block: 'center' });
  }, [view]);

  return (
    <div
      className={`grid min-w-0 gap-8 ${nothing || entries.length === 0 ? '' : 'lg:grid-cols-[minmax(0,25rem)_minmax(0,1fr)] lg:items-start lg:gap-10'}`}
    >
      <div className={`min-w-0 flex-col gap-8 ${view === 'reader' && open !== null ? 'hidden lg:flex' : 'flex'}`}>
        <header className="flex flex-col gap-2">
          <p className="text-[11px] font-bold uppercase tracking-[0.04em] text-accent">{COPY.eyebrow}</p>
          <h2 className="text-[2rem] font-bold leading-[1.15] tracking-[-0.045em] sm:text-[2.5rem]">{COPY.title}</h2>
          <p className="text-[15px] leading-6 text-secondary">{COPY.lead}</p>
        </header>

        {model.making.length > 0 && <MakingStrip model={model} making={making} />}

        {/* 둘레에 앉을 사람이 없으면 지도가 할 말이 없다 — 빈 궤도를 세우지 않는다 */}
        {model.orbit.length > 0 && (
          <RelationMap model={model} focus={focus} onFocus={(id) => setFocus((now) => (now === id ? null : id))} />
        )}

        {focus !== null && (
          <div className="-mt-4 flex items-center justify-between gap-3 rounded-2xl border border-accent/30 bg-accent-wash py-1.5 pl-4 pr-1.5">
            <p aria-live="polite" className="min-w-0 truncate text-[15px] font-semibold text-accent">
              {COPY.focusOf(focus === SELF_ID ? COPY.me : model.nodes[focus]?.label ?? '', singles.length + pairs.length + making.length)}
            </p>
            <button type="button" onClick={() => setFocus(null)} className={BUTTON.compact}>
              {COPY.focusAll}
            </button>
          </div>
        )}

        {nothing ? (
          <Nothing hasSelf={hasSelf} />
        ) : (
          <>
            <Group title={COPY.singles} lead={COPY.singlesLead} entries={singles} total={model.singles.length}>
              {singles.map((entry) => (
                <Row key={entry.key} entry={entry} nodes={model.nodes} active={entry.key === openKey} onOpen={choose} anchor />
              ))}
            </Group>
            <Group title={COPY.pairs} lead={COPY.pairsLead} entries={pairs} total={model.pairs.length}>
              {pairs.map((entry) => (
                <Row key={entry.key} entry={entry} nodes={model.nodes} active={entry.key === openKey} onOpen={choose} anchor />
              ))}
            </Group>
          </>
        )}
      </div>

      {open !== null && (
        <div ref={reader} className={`min-w-0 scroll-mt-4 ${view === 'reader' ? 'block' : 'hidden lg:block'}`}>
          <button type="button" onClick={back} className={`${BUTTON.tertiary} mb-4 no-underline lg:hidden`}>
            <Arrow className="size-4 rotate-180" /> {COPY.back}
          </button>
          {open.shape === 'single' ? (
            <SingleReader entry={open} model={model} onOpen={choose} />
          ) : (
            <PairReader entry={open} model={model} onOpen={choose} />
          )}
        </div>
      )}
    </div>
  );
}

const rowId = (key: string) => `orbit-reading-${key.replace(/[^a-z0-9-]/gi, '-')}`;

/* ─────────────────────────── 점 하나 ─────────────────────────── */

const DOT = {
  xs: { box: 'size-8', glyph: 'text-[15px]' },
  sm: { box: 'size-10', glyph: 'text-lg' },
  md: { box: 'size-11', glyph: 'text-xl' },
  lg: { box: 'size-16', glyph: 'text-[2rem]' },
  xl: { box: 'size-[4.5rem]', glyph: 'text-[2.25rem]' },
} as const;

/** 한 사람의 점 — 일간 글자가 서고, 인연 상대는 사진, 못 읽는 명식은 「?」 */
function Dot({ node, size, className = '' }: { node: Node | undefined; size: keyof typeof DOT; className?: string }) {
  const tone = node?.element ? ELEMENT_TONE[node.element] : null;
  const { box, glyph } = DOT[size];
  const ring = node?.isSelf ? 'ring-2 ring-accent ring-offset-2 ring-offset-surface' : '';
  if (node?.photoUrl) {
    return (
      /* 예시 사진은 장식이다(이름이 옆에 선다) — 배경으로 깔아 `<img>` 규칙의 예외를 늘리지 않는다 */
      <span
        aria-hidden="true"
        style={{ backgroundImage: `url(${node.photoUrl})` }}
        className={`${box} shrink-0 rounded-full border-2 border-surface bg-surface-sunken bg-cover bg-center shadow-sm ${className}`}
      />
    );
  }
  return (
    <span
      aria-hidden="true"
      className={`${box} grid shrink-0 place-items-center rounded-full border-2 ${
        tone === null
          ? 'border-dashed border-border-strong bg-surface-sunken text-muted'
          : `${tone.border} ${tone.surface} ${tone.text}`
      } ${ring} ${className}`}
    >
      <span className={`glyph font-bold leading-none dark:brightness-[1.45] ${glyph}`}>
        {node === undefined ? COPY.me : node.stem ?? (node.id.startsWith('match:') ? node.label.slice(0, 1) : '?')}
      </span>
    </span>
  );
}

/** 줄 앞의 표식 — 사주풀이는 점 하나, 궁합풀이는 두 점과 선. 폭이 같아 제목이 한 줄로 선다 */
function Mark({ entry, nodes }: { entry: Entry; nodes: Record<string, Node> }) {
  if (entry.shape === 'single') {
    return (
      <span className="relative flex w-[4.5rem] shrink-0 items-center justify-center">
        <Dot node={nodes[entry.subjects[0]]} size="md" />
      </span>
    );
  }
  const [a, b] = entry.subjects;
  return (
    <span className="relative flex w-[4.5rem] shrink-0 items-center justify-between">
      <span aria-hidden="true" className="absolute inset-x-4 top-1/2 h-0.5 -translate-y-1/2 rounded-full bg-accent" />
      <Dot node={nodes[a]} size="xs" className="relative" />
      <Dot node={nodes[b]} size="xs" className="relative" />
    </span>
  );
}

/* ─────────────────────────── 함께 보는 궁합 ─────────────────────────── */

function MakingStrip({ model, making }: { model: ReadingsModel; making: ReadingsModel['making'] }) {
  if (making.length === 0) return null;
  return (
    <section aria-labelledby="orbit-making" className="flex flex-col gap-3">
      <div>
        <h3 id="orbit-making" className="text-xl font-bold tracking-[-0.03em]">
          {COPY.making}
        </h3>
        <p className="mt-0.5 text-[13px] text-muted">{COPY.makingLead}</p>
      </div>
      <ul className="flex flex-col gap-2">
        {making.map((one) => (
          <li
            key={one.id}
            className="flex flex-wrap items-center gap-x-4 gap-y-3 rounded-[1.5rem] border border-accent/30 bg-accent-wash p-3 pl-4"
          >
            <span className="relative flex w-[5.5rem] shrink-0 items-center justify-between" aria-hidden="true">
              <svg viewBox="0 0 88 4" preserveAspectRatio="none" className="absolute inset-x-5 top-1/2 h-1 w-[calc(100%-2.5rem)] -translate-y-1/2 overflow-visible">
                <line x1="0" y1="2" x2="88" y2="2" className="stroke-accent" strokeWidth="2" strokeDasharray="4 5" strokeLinecap="round" vectorEffect="non-scaling-stroke" />
              </svg>
              <Dot node={model.self ?? undefined} size="sm" className="relative" />
              <Dot node={model.nodes[one.id]} size="sm" className="relative" />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block truncate text-base font-semibold">{one.nickname} 님과의 궁합풀이</span>
              <span className="mt-0.5 flex items-center gap-1.5 text-[13px] text-accent">
                <span aria-hidden="true" className="size-1.5 animate-pulse rounded-full bg-accent motion-reduce:animate-none" />
                {COPY.makingState}
              </span>
            </span>
            <Link href={one.href} className={`${BUTTON.primary} min-h-11 max-sm:w-full`}>
              {COPY.makingAction} <Arrow />
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}

/* ─────────────────────────── 글이 있는 관계 ─────────────────────────── */

/** 둘레 자리 — 가로로 긴 판이라 타원이다. 위 가운데를 비워 두는 것은 가운데 「나」 이름표와 겹치지 않게 */
function around(count: number): Point[] {
  const start = -Math.PI / 2 + Math.PI / Math.max(count, 1);
  return Array.from({ length: count }, (_, index) => {
    const angle = start + (index * 2 * Math.PI) / count;
    return { x: round(50 + 39 * Math.cos(angle)), y: round(50 + 40 * Math.sin(angle)) };
  });
}

const round = (value: number) => Math.round(value * 100) / 100;

function RelationMap({
  model,
  focus,
  onFocus,
}: {
  model: ReadingsModel;
  focus: string | null;
  onFocus: (id: string) => void;
}) {
  const points = around(model.orbit.length);
  const at: Record<string, Point> = { [SELF_ID]: { x: 50, y: 50 } };
  model.orbit.forEach((id, index) => {
    at[id] = points[index];
  });
  const entries = [...model.singles, ...model.pairs];
  const countOf = (id: string) =>
    entries.filter((entry) => entry.subjects.includes(id)).length +
    model.making.filter((one) => id === SELF_ID || one.id === id).length;
  const lit = (ids: string[]) => focus === null || ids.includes(focus);
  const hasSingle = (id: string) => model.singles.some((entry) => entry.subjects[0] === id);
  const pairLines = model.pairs.filter((entry) => entry.subjects.every((id) => id in at));
  const empty = model.orbit.length === 0 && entries.length === 0;

  return (
    <section aria-labelledby="orbit-map" className="flex flex-col gap-3">
      <div className="flex items-baseline justify-between gap-3">
        <h3 id="orbit-map" className="text-xl font-bold tracking-[-0.03em]">
          {COPY.mapTitle}
        </h3>
        {!empty && <span className="text-[13px] font-semibold tabular-nums text-muted">{COPY.count(entries.length)}</span>}
      </div>
      <div className="relative overflow-hidden rounded-[2rem] border border-border bg-surface shadow-[var(--shadow-card)]">
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_center,var(--accent-wash)_0%,transparent_65%)] opacity-80"
        />
        <div className="relative aspect-[5/4] w-full sm:aspect-[2/1] lg:aspect-[5/4]">
          <div className="absolute inset-x-[8%] bottom-[13%] top-[9%]">
            <svg aria-hidden="true" viewBox="0 0 100 100" preserveAspectRatio="none" className="absolute inset-0 size-full overflow-visible">
              <ellipse cx="50" cy="50" rx="39" ry="40" vectorEffect="non-scaling-stroke" className="fill-none stroke-border-strong" strokeWidth="1" strokeDasharray="3 5" />
              {pairLines.map((entry) => {
                const [a, b] = entry.subjects.map((id) => at[id]);
                const on = lit(entry.subjects);
                const withMe = entry.subjects.includes(SELF_ID);
                return withMe ? (
                  <line
                    key={entry.key}
                    x1={a.x}
                    y1={a.y}
                    x2={b.x}
                    y2={b.y}
                    vectorEffect="non-scaling-stroke"
                    className={`stroke-accent transition-opacity ${on ? '' : 'opacity-20'}`}
                    strokeWidth={focus !== null && on ? 3 : 2}
                    strokeLinecap="round"
                  />
                ) : (
                  <path
                    key={entry.key}
                    d={arcBetween(a, b).d}
                    vectorEffect="non-scaling-stroke"
                    className={`fill-none stroke-accent transition-opacity ${on ? '' : 'opacity-20'}`}
                    strokeWidth="2"
                    strokeLinecap="round"
                  />
                );
              })}
              {model.making.map((one) =>
                at[one.id] === undefined ? null : (
                  <line
                    key={one.id}
                    x1="50"
                    y1="50"
                    x2={at[one.id].x}
                    y2={at[one.id].y}
                    vectorEffect="non-scaling-stroke"
                    className={`stroke-accent transition-opacity ${lit([SELF_ID, one.id]) ? '' : 'opacity-20'}`}
                    strokeWidth="2"
                    strokeDasharray="4 5"
                    strokeLinecap="round"
                  />
                ),
              )}
            </svg>

            <MapDot
              node={model.self ?? undefined}
              at={at[SELF_ID]}
              center
              count={countOf(SELF_ID)}
              book={hasSingle(SELF_ID)}
              active={focus === SELF_ID}
              dim={focus !== null && focus !== SELF_ID}
              onPress={model.self === null ? undefined : () => onFocus(SELF_ID)}
            />
            {model.orbit.map((id) => (
              <MapDot
                key={id}
                node={model.nodes[id]}
                at={at[id]}
                count={countOf(id)}
                book={hasSingle(id)}
                active={focus === id}
                dim={focus !== null && focus !== id && !entries.some((entry) => entry.subjects.includes(focus) && entry.subjects.includes(id)) && !(focus === SELF_ID && id.startsWith('match:'))}
                onPress={() => onFocus(id)}
              />
            ))}
            {pairLines.map((entry) => {
              const [a, b] = entry.subjects.map((id) => at[id]);
              const mid = entry.subjects.includes(SELF_ID)
                ? { x: round(a.x + (b.x - a.x) * 0.55), y: round(a.y + (b.y - a.y) * 0.55) }
                : arcBetween(a, b).mid;
              return (
                <span
                  key={entry.key}
                  aria-hidden="true"
                  style={{ left: `${mid.x}%`, top: `${mid.y}%` }}
                  className={`absolute -translate-x-1/2 -translate-y-1/2 rounded-full bg-accent px-1.5 py-0.5 text-[11px] font-bold tabular-nums leading-none text-on-accent shadow-sm transition-opacity ${
                    lit(entry.subjects) ? '' : 'opacity-25'
                  }`}
                >
                  {entry.score ?? '·'}
                </span>
              );
            })}
          </div>
        </div>

        <div className="relative flex flex-col gap-2 border-t border-border px-5 py-3">
          <ul className="flex flex-wrap items-center gap-x-4 gap-y-1.5 text-xs font-medium text-secondary">
            <li className="flex items-center gap-2">
              <span aria-hidden="true" className="grid size-4 place-items-center rounded-full bg-accent text-on-accent">
                <BookIcon className="size-2.5" />
              </span>
              {COPY.legendSingle}
            </li>
            <li className="flex items-center gap-2">
              <span aria-hidden="true" className="inline-block h-0.5 w-4 rounded-full bg-accent" />
              {COPY.legendPair}
            </li>
            {model.making.length > 0 && (
              <li className="flex items-center gap-2">
                <span aria-hidden="true" className="inline-block w-4 border-t-2 border-dashed border-accent" />
                {COPY.legendMaking}
              </li>
            )}
          </ul>
          {!empty && <p className="text-xs text-muted">{COPY.mapHint}</p>}
        </div>
      </div>
    </section>
  );
}

function MapDot({
  node,
  at,
  center = false,
  count,
  book,
  active,
  dim,
  onPress,
}: {
  node: Node | undefined;
  at: Point;
  center?: boolean;
  count: number;
  book: boolean;
  active: boolean;
  dim: boolean;
  onPress?: () => void;
}) {
  const label = center ? COPY.me : node?.label ?? '';
  const spoken = `${center && node ? `${COPY.me} ${node.label}` : label}${node?.spoken ? `, ${node.spoken}` : ''}, ${COPY.count(count)}`;
  const body = (
    <>
      <span className={`relative transition group-active:scale-95 ${active ? 'rounded-full shadow-[0_0_0_4px_var(--accent)]' : ''}`}>
        <Dot node={node} size={center ? 'lg' : 'md'} className={center ? 'shadow-[0_10px_30px_-12px_rgba(0,0,0,0.35)]' : 'shadow-[0_6px_16px_-8px_rgba(0,0,0,0.35)]'} />
        {book && (
          <span aria-hidden="true" className="absolute -right-1 -top-0.5 grid size-5 place-items-center rounded-full bg-accent text-on-accent ring-2 ring-surface">
            <BookIcon className="size-3" />
          </span>
        )}
      </span>
      <span
        className={`max-w-full truncate rounded-full px-2 py-0.5 text-[13px] font-semibold leading-tight ${
          center ? 'bg-foreground text-background' : active ? 'bg-accent text-on-accent' : 'bg-surface/90 text-foreground'
        }`}
      >
        {label}
      </span>
    </>
  );
  const place = `group absolute flex -translate-x-1/2 flex-col items-center gap-1 rounded-2xl pb-1 transition-opacity focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent ${
    center ? 'w-[5.5rem] -translate-y-[2.25rem]' : 'w-[4.75rem] -translate-y-[1.5rem]'
  } ${dim ? 'opacity-35' : ''}`;
  const style = { left: `${at.x}%`, top: `${at.y}%` };

  if (onPress === undefined) {
    return (
      <span style={style} className={place}>
        {body}
      </span>
    );
  }
  return (
    <button type="button" onClick={onPress} aria-pressed={active} aria-label={spoken} style={style} className={place}>
      {body}
    </button>
  );
}

/* ─────────────────────────── 목록 ─────────────────────────── */

function Group({
  title,
  lead,
  entries,
  total,
  children,
}: {
  title: string;
  lead: string;
  entries: Entry[];
  total: number;
  children: ReactNode;
}) {
  if (entries.length === 0) return null;
  return (
    <section className="flex flex-col gap-3">
      <div>
        <h3 className="flex items-baseline gap-2 text-xl font-bold tracking-[-0.03em]">
          {title}
          <span className="text-[13px] font-semibold tabular-nums text-muted">
            {entries.length === total ? COPY.count(total) : `${entries.length}/${COPY.count(total)}`}
          </span>
        </h3>
        <p className="mt-0.5 text-[13px] text-muted">{lead}</p>
      </div>
      <ol className="flex flex-col overflow-hidden rounded-[1.5rem] border border-border bg-surface">{children}</ol>
    </section>
  );
}

function Row({
  entry,
  nodes,
  active,
  onOpen,
  anchor = false,
}: {
  entry: Entry;
  nodes: Record<string, Node>;
  active: boolean;
  onOpen: (key: string) => void;
  /** 목록의 줄만 — 폰에서 돌아올 자리다. 글 칸 아래 「이어진 글」의 같은 줄과 id 가 겹치지 않게 */
  anchor?: boolean;
}) {
  return (
    <li className="border-b border-border last:border-b-0">
      <button
        type="button"
        id={anchor ? rowId(entry.key) : undefined}
        onClick={() => onOpen(entry.key)}
        aria-current={active ? 'true' : undefined}
        className={`group relative flex min-h-[4.5rem] w-full items-center gap-2 py-3 pl-1 pr-4 text-left transition active:bg-surface-sunken focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-accent ${
          active ? 'lg:bg-accent-wash' : 'hover:bg-surface-soft'
        }`}
      >
        {active && <span aria-hidden="true" className="absolute inset-y-2 left-0 hidden w-1 rounded-r-full bg-accent lg:block" />}
        <Mark entry={entry} nodes={nodes} />
        <span className="flex min-w-0 flex-1 flex-col gap-0.5">
          <span className="truncate text-base font-semibold leading-snug">{entry.title}</span>
          {entry.metaphor !== null && <span className="truncate text-[13px] leading-5 text-secondary">{entry.metaphor}</span>}
          <span className="flex items-center gap-1.5 text-xs text-muted">
            <time>{entry.date}</time>
            {!entry.current && (
              <span className="rounded-full bg-warning-wash px-1.5 py-px text-[11px] font-bold text-warning">{COPY.oldChart}</span>
            )}
          </span>
        </span>
        {entry.score !== null ? (
          <span className="shrink-0 text-right">
            <span className="text-2xl font-bold tabular-nums tracking-[-0.03em] text-accent">{entry.score}</span>
            <span className="ml-0.5 text-xs text-muted">{COPY.scoreUnit}</span>
          </span>
        ) : (
          <Arrow className="size-4 shrink-0 text-muted transition group-hover:translate-x-0.5 group-hover:text-accent" />
        )}
      </button>
    </li>
  );
}

function Nothing({ hasSelf }: { hasSelf: boolean }) {
  const inline = 'rounded font-semibold text-accent underline decoration-accent/40 underline-offset-4 hover:decoration-accent';
  return (
    <section className="flex flex-col gap-4 rounded-[2rem] border border-border bg-surface p-5 shadow-[var(--shadow-card)] sm:p-6">
      <h3 className="text-[1.375rem] font-bold tracking-[-0.03em]">{COPY.nothingTitle}</h3>
      <p className="text-[15px] leading-7 text-secondary">
        <Link href={previewHref('/me/readings/self')} className={inline}>
          내 사주
        </Link>{' '}
        에서 내 풀이를 만들 수 있습니다. 저장한 사람의 풀이는{' '}
        <Link href={previewHref('/me/people')} className={inline}>
          사람
        </Link>{' '}
        에서, 두 사람의 궁합은{' '}
        <Link href={previewHref('/compat')} className={inline}>
          궁합
        </Link>{' '}
        에서 시작할 수 있습니다.
      </p>
      <Link href={previewHref(hasSelf ? '/me/readings/self' : '/me')} className={`${BUTTON.primary} self-stretch sm:self-start`}>
        {hasSelf ? <BookIcon /> : null}
        {hasSelf ? COPY.readingGet : COPY.register} <Arrow />
      </Link>
    </section>
  );
}

/* ─────────────────────────── 글 칸 ─────────────────────────── */

function Tabs({ chartHref, name }: { chartHref: string; name: string }) {
  const base = 'inline-flex min-h-11 flex-1 items-center justify-center rounded-full px-5 text-[15px] font-semibold transition sm:flex-none';
  return (
    <nav aria-label={`${name}의 사주와 사주풀이`} className="inline-flex self-start rounded-full border border-border bg-surface-sunken p-1 max-sm:self-stretch">
      <Link href={chartHref} className={`${base} text-secondary hover:bg-surface/60 hover:text-foreground active:scale-[0.97] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent`}>
        {COPY.chartTab}
      </Link>
      <span aria-current="page" className={`${base} bg-surface text-foreground shadow-[0_1px_2px_rgba(0,0,0,0.08),0_4px_12px_-4px_rgba(0,0,0,0.12)]`}>
        <BookIcon className="mr-1.5 size-4 text-accent" />
        {COPY.readingTab}
      </span>
    </nav>
  );
}

function Stale() {
  return (
    <div className="flex flex-col gap-3 rounded-2xl border border-warning/30 bg-warning-wash p-4 sm:flex-row sm:items-center sm:justify-between">
      <div className="flex flex-col items-start gap-2">
        <span className="whitespace-nowrap rounded-full bg-warning px-2 py-0.5 text-[11px] font-bold leading-4 text-surface">{COPY.oldChart}</span>
        <p className="break-keep text-[15px] leading-6 text-foreground">{COPY.stale}</p>
      </div>
      <span className={`${BUTTON.primary} shrink-0`}>{COPY.remake}</span>
    </div>
  );
}

function SingleReader({ entry, model, onOpen }: { entry: Entry; model: ReadingsModel; onOpen: (key: string) => void }) {
  const node = model.nodes[entry.subjects[0]];
  const related = model.pairs.filter((pair) => pair.subjects.includes(entry.subjects[0]));
  return (
    <article className="flex flex-col gap-6" aria-labelledby="orbit-reader-name">
      <header className="flex items-center gap-4">
        <Dot node={node} size="lg" />
        <div className="min-w-0">
          <p className="text-[11px] font-bold uppercase tracking-[0.04em] text-accent">{COPY.readingTab}</p>
          <h2 id="orbit-reader-name" className="break-keep text-[1.75rem] font-bold leading-tight tracking-[-0.04em] sm:text-[2rem]">
            {entry.name}
          </h2>
        </div>
      </header>

      <Tabs chartHref={entry.chartHref ?? '#'} name={entry.name} />

      <div className="flex flex-col gap-8 rounded-[2rem] border border-border bg-surface p-5 shadow-[var(--shadow-card)] sm:p-9">
        {!entry.current && <Stale />}

        <div className="flex flex-col gap-4">
          <p className="text-[15px] font-semibold text-secondary">{entry.heading}</p>
          {entry.metaphor !== null && (
            <p className="relative max-w-[22em] break-keep border-l-4 border-accent pl-4 text-[1.625rem] font-bold leading-[1.35] tracking-[-0.035em] sm:pl-5 sm:text-[2rem]">
              {entry.metaphor}
            </p>
          )}
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-[13px] tabular-nums text-muted">
              {entry.made} {COPY.madeSuffix}
            </p>
            <div className="grid grid-cols-2 gap-2 sm:flex">
              <span className={BUTTON.compact}>{COPY.share}</span>
              {entry.current && <span className={BUTTON.compact}>{COPY.remake}</span>}
            </div>
          </div>
        </div>

        <nav aria-label={COPY.contents} className="flex flex-col gap-2 rounded-2xl bg-surface-soft p-4">
          <p className="text-xs font-bold text-muted">{COPY.contents}</p>
          <ol className="flex flex-col">
            {SAMPLE_BODY.sections.map((section, index) => (
              <li key={section.heading}>
                <a
                  href={`#orbit-sec-${index}`}
                  className="flex min-h-11 items-center gap-3 rounded-lg px-1 text-[15px] font-semibold text-foreground hover:text-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
                >
                  <span className="w-5 shrink-0 text-right text-[13px] tabular-nums text-accent">{index + 1}</span>
                  <span className="min-w-0 truncate">{section.heading}</span>
                </a>
              </li>
            ))}
          </ol>
        </nav>

        <div className="flex max-w-[34em] flex-col gap-10 text-base leading-[1.85] text-foreground sm:text-[17px]">
          {SAMPLE_BODY.sections.map((section, index) => (
            <section key={section.heading} id={`orbit-sec-${index}`} className="flex scroll-mt-6 flex-col gap-4">
              <h3 className="flex items-start gap-3 break-keep text-[1.25rem] font-bold leading-snug tracking-[-0.03em] sm:text-[1.375rem]">
                <span aria-hidden="true" className="mt-[0.45em] size-2.5 shrink-0 rounded-full bg-accent" />
                {section.heading}
              </h3>
              {section.paragraphs.map((paragraph) => (
                <p key={paragraph} className="break-keep">
                  {inline(paragraph)}
                </p>
              ))}
              {section.bullets && (
                <ul className="flex flex-col gap-2 rounded-2xl border border-border p-4 pl-5">
                  {section.bullets.map((bullet) => (
                    <li key={bullet} className="relative break-keep pl-4 before:absolute before:left-0 before:top-[0.8em] before:size-1.5 before:rounded-full before:bg-accent">
                      {bullet}
                    </li>
                  ))}
                </ul>
              )}
            </section>
          ))}
          <p className="break-keep border-t border-border pt-6 text-[15px] leading-7 text-secondary">{SAMPLE_BODY.closing}</p>
        </div>
      </div>

      {related.length > 0 && (
        <section className="flex flex-col gap-3">
          <h3 className="text-lg font-bold tracking-[-0.03em]">{COPY.related}</h3>
          <ol className="flex flex-col overflow-hidden rounded-[1.5rem] border border-border bg-surface">
            {related.map((pair) => (
              <Row key={pair.key} entry={pair} nodes={model.nodes} active={false} onOpen={onOpen} />
            ))}
          </ol>
        </section>
      )}
    </article>
  );
}

function PairReader({ entry, model, onOpen }: { entry: Entry; model: ReadingsModel; onOpen: (key: string) => void }) {
  const [a, b] = entry.subjects.map((id) => model.nodes[id]);
  const each = model.singles.filter((single) => entry.subjects.includes(single.subjects[0]));
  return (
    <article className="flex flex-col gap-6" aria-labelledby="orbit-reader-name">
      <div className="flex flex-col gap-7 rounded-[2rem] border border-border bg-surface p-5 shadow-[var(--shadow-card)] sm:p-9">
        <p className="text-[11px] font-bold uppercase tracking-[0.04em] text-accent">{COPY.pairs}</p>

        <div className="relative flex items-start justify-between gap-2 px-1 sm:px-6">
          <span aria-hidden="true" className="absolute inset-x-[3.5rem] top-9 h-0.5 rounded-full bg-accent sm:inset-x-[5.5rem]" />
          {[a, b].map((node, index) => (
            <span key={node?.id ?? index} className="relative flex w-24 flex-col items-center gap-2">
              <Dot node={node} size="xl" />
              <span className="max-w-full truncate text-[15px] font-semibold">
                {node?.isSelf ? `${COPY.me} · ${node.label}` : node?.label}
              </span>
            </span>
          ))}
          {entry.score !== null && (
            <span className="absolute left-1/2 top-9 -translate-x-1/2 -translate-y-1/2 rounded-3xl border border-border bg-surface px-4 py-1.5 text-center shadow-[var(--shadow-card)]">
              <span className="text-[2.5rem] font-bold leading-none tabular-nums tracking-[-0.04em] text-accent">{entry.score}</span>
              <span className="ml-0.5 text-sm text-muted">{COPY.scoreUnit}</span>
            </span>
          )}
        </div>

        <div className="flex flex-col gap-3">
          <h2 id="orbit-reader-name" className="break-keep text-[1.75rem] font-bold leading-tight tracking-[-0.04em]">
            {entry.title}
          </h2>
          {entry.metaphor !== null && (
            <p className="max-w-[24em] break-keep border-l-4 border-accent pl-4 text-xl font-semibold leading-[1.45] tracking-[-0.02em]">
              {entry.metaphor}
            </p>
          )}
          <p className="text-[13px] tabular-nums text-muted">
            {entry.made} {COPY.madeSuffix}
          </p>
        </div>

        {!entry.current && <Stale />}

        <div className="flex flex-col gap-2">
          <Link href={entry.href} className={`${BUTTON.primary} self-stretch sm:self-start`}>
            <PairIcon /> {COPY.pairOpen} <Arrow />
          </Link>
          <p className="text-[13px] text-muted">{COPY.pairWhere}</p>
        </div>
      </div>

      {each.length > 0 && (
        <section className="flex flex-col gap-3">
          <h3 className="text-lg font-bold tracking-[-0.03em]">{COPY.eachReading}</h3>
          <ol className="flex flex-col overflow-hidden rounded-[1.5rem] border border-border bg-surface">
            {each.map((single) => (
              <Row key={single.key} entry={single} nodes={model.nodes} active={false} onOpen={onOpen} />
            ))}
          </ol>
        </section>
      )}
    </article>
  );
}

/** `**굵게**` 만 — 실제 `markdown.tsx` 의 인라인 범위 */
function inline(text: string): ReactNode[] {
  return text.split(/\*\*([^*]+)\*\*/g).map((part, index) =>
    index % 2 === 1 ? (
      <strong key={index} className="font-bold">
        {part}
      </strong>
    ) : (
      part
    ),
  );
}
