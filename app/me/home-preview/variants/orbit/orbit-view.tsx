'use client';

import Link from 'next/link';
import { useRef, useState, type ReactNode } from 'react';

import { ELEMENT_TONE } from '../../../../element-tone';
import { arcBetween, placeOnOrbit } from './placement';
import type { OrbitLink, OrbitModel, OrbitPerson, OrbitSelf } from './model';
import { Arrow, BUTTON, BookIcon, EightGlyphs, PairIcon, Plus } from './ui';

/*
  **관계 지도 — 나를 가운데 두고 저장한 사람이 둘레를 돈다.**

  브라우저에서 도는 까닭은 「누구를 골랐나」 하나다. 고른 사람의 행동(자세히 · 풀이 · 나와 궁합)이 옆 판에
  열린다. 처음에는 **내가 골라져 있다** — 서버가 그린 첫 화면에 내 여덟 글자와 내 길이 이미 서 있고,
  자바스크립트가 없어도 지도 아래 목록(`people-list.tsx`)이 모든 사람의 길을 링크로 든다.

  문장은 서버가 넘긴다(`copy`) — 새 문구 표(`NOTES.md`)와 한 자리에서 대조되게. 여기 남은 한글은
  보조기기용 이름표(「나와 궁합 N점」)와 점수 알약뿐이다.
*/

export type OrbitCopy = {
  hourUnknown: string;
  noHourNote: string;
  elementsTitle: string;
  readingGet: string;
  readingGetSub: string;
  readingSee: string;
  readingSeeSub: string;
  oldChart: string;
  detail: string;
  compatWithMe: string;
  compat: string;
  registerTitle: string;
  registerBody: string;
  registerAction: string;
  me: string;
  legendInner: string;
  legendOuter: string;
  legendLine: string;
  addFirstBody: string;
  addPerson: string;
  selfEyebrow: string;
  personEyebrow: string;
  noReading: string;
};

type Selection = { kind: 'self' } | { kind: 'person'; id: string };

export function OrbitView({
  model,
  copy,
  addHref,
  registerHref,
  canAdd,
}: {
  model: OrbitModel;
  copy: OrbitCopy;
  addHref: string;
  registerHref: string;
  canAdd: boolean;
}) {
  const [selected, setSelected] = useState<Selection>({ kind: 'self' });
  const panel = useRef<HTMLDivElement>(null);
  const placed = placeOnOrbit(model.people, model.links);
  const chosen = selected.kind === 'person' ? model.people.find((person) => person.id === selected.id) ?? null : null;

  const choose = (next: Selection) => {
    setSelected(next);
    /* 폰에서는 판이 지도 아래에 있다 — 누른 결과가 화면 밖에서 일어나지 않게 끌어온다 */
    panel.current?.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
  };

  return (
    <div className="grid gap-4 lg:grid-cols-[minmax(0,1.3fr)_minmax(20rem,1fr)] lg:items-start lg:gap-6">
      <div className="relative overflow-hidden rounded-[2rem] border border-border bg-surface shadow-[var(--shadow-card)]">
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_center,var(--accent-wash)_0%,transparent_62%)] opacity-80"
        />
        <div className="relative aspect-[1/1.03] w-full sm:aspect-[4/3]">
          {/* 궤도는 안쪽 판에 그린다 — 아래 9% 는 맨 아래 사람의 이름표 자리다 */}
          <div className="absolute inset-x-[3%] bottom-[9%] top-[4%]">
          <svg aria-hidden="true" viewBox="0 0 100 100" preserveAspectRatio="none" className="absolute inset-0 size-full overflow-visible">
            {(['inner', 'outer'] as const).map((ring) => (
              <ellipse
                key={ring}
                cx="50"
                cy="50"
                rx={placed.radius[ring]}
                ry={placed.radius[ring]}
                vectorEffect="non-scaling-stroke"
                className="fill-none stroke-border-strong"
                strokeWidth="1"
                strokeDasharray={ring === 'inner' ? '0' : '3 5'}
              />
            ))}
            {model.self !== null &&
              model.people.map((person) => {
                const point = placed.at[person.id];
                if (!person.compat.seen || point === undefined) return null;
                const lit = chosen?.id === person.id;
                return (
                  <line
                    key={person.id}
                    x1="50"
                    y1="50"
                    x2={point.x}
                    y2={point.y}
                    vectorEffect="non-scaling-stroke"
                    className="stroke-accent"
                    strokeWidth={lit ? 3 : 2}
                    strokeLinecap="round"
                  />
                );
              })}
            {model.links.map((link) => {
              const a = placed.at[link.a];
              const b = placed.at[link.b];
              if (a === undefined || b === undefined) return null;
              return (
                <path
                  key={`${link.a}-${link.b}`}
                  d={arcBetween(a, b).d}
                  vectorEffect="non-scaling-stroke"
                  className="fill-none stroke-secondary"
                  strokeWidth="1.5"
                  strokeDasharray="1 4"
                  strokeLinecap="round"
                />
              );
            })}
          </svg>

          <CenterNode self={model.self} active={selected.kind === 'self'} onChoose={() => choose({ kind: 'self' })} copy={copy} />

          {model.people.map((person) => {
            const point = placed.at[person.id];
            if (point === undefined) return null;
            return (
              <PersonNode
                key={person.id}
                person={person}
                x={point.x}
                y={point.y}
                active={chosen?.id === person.id}
                showScore={model.self !== null}
                onChoose={() => choose({ kind: 'person', id: person.id })}
              />
            );
          })}

          {/* 점수 알약은 사람 점보다 뒤에 둔다 — 겹치면 알약이 위에 선다 */}
          {model.links.map((link) => (
            <LinkScore key={`${link.a}-${link.b}`} link={link} placed={placed.at} />
          ))}
          </div>

          {model.people.length === 0 && (
            <div className="absolute inset-x-0 bottom-[4%] flex flex-col items-center gap-3 px-4 text-center">
              <p className="max-w-[18rem] text-sm leading-6 text-secondary">{copy.addFirstBody}</p>
            </div>
          )}
          {model.people.length === 0 && canAdd && (
            <Link
              href={addHref}
              className="group absolute left-1/2 top-[5%] flex -translate-x-1/2 flex-col items-center gap-1 rounded-2xl p-1 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
            >
              <span className="grid size-14 place-items-center rounded-full border-2 border-dashed border-accent bg-surface text-accent shadow-[var(--shadow-card)] transition group-hover:bg-accent-wash group-active:scale-95">
                <Plus className="size-6" />
              </span>
              <span className="rounded-full bg-surface/90 px-2 text-[13px] font-semibold text-accent">{copy.addPerson}</span>
            </Link>
          )}
        </div>

        {model.people.length > 0 && (
          <ul className="relative flex flex-wrap items-center gap-x-4 gap-y-1.5 border-t border-border px-5 py-3 text-xs font-medium text-secondary">
            <li className="flex items-center gap-2">
              <span aria-hidden="true" className="inline-block size-3 rounded-full border border-border-strong" />
              {copy.legendInner}
            </li>
            <li className="flex items-center gap-2">
              <span aria-hidden="true" className="inline-block size-3 rounded-full border border-dashed border-border-strong" />
              {copy.legendOuter}
            </li>
            {(model.self !== null || model.links.length > 0) && (
              <li className="flex items-center gap-2">
                <span aria-hidden="true" className="inline-block h-0.5 w-4 rounded-full bg-accent" />
                {copy.legendLine}
              </li>
            )}
          </ul>
        )}
      </div>

      {/* 내 사주가 없으면 등록이 유일한 주 행동이다 — 폰에서 판을 지도 위로 올린다 */}
      <div ref={panel} className={`scroll-mt-4 ${model.self === null ? 'order-first lg:order-none' : ''}`} aria-live="polite">
        {chosen !== null ? (
          <PersonPanel person={chosen} copy={copy} hasSelf={model.self !== null} />
        ) : model.self !== null ? (
          <SelfPanel self={model.self} copy={copy} readingFirst={model.people.length > 0} />
        ) : (
          <RegisterPanel copy={copy} registerHref={registerHref} />
        )}
      </div>
    </div>
  );
}

function CenterNode({
  self,
  active,
  onChoose,
  copy,
}: {
  self: OrbitSelf | null;
  active: boolean;
  onChoose: () => void;
  copy: OrbitCopy;
}) {
  const tone = self === null ? null : ELEMENT_TONE[self.day.element];
  return (
    <button
      type="button"
      onClick={onChoose}
      aria-pressed={active}
      aria-label={self === null ? copy.registerTitle : `${copy.me} ${self.label}, ${self.day.spoken}`}
      className="group absolute left-1/2 top-1/2 flex -translate-x-1/2 -translate-y-1/2 flex-col items-center gap-1.5 rounded-3xl p-1 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
    >
      <span
        className={`relative grid size-[4.25rem] place-items-center rounded-full border-2 bg-surface shadow-[0_10px_30px_-12px_rgba(0,0,0,0.35)] transition group-active:scale-95 sm:size-[5.5rem] ${
          tone === null ? 'border-dashed border-border-strong' : `${tone.border} ${tone.surface}`
        } ${active ? 'ring-4 ring-accent/30' : ''}`}
      >
        {self === null ? (
          <span className="text-xl font-bold text-muted">{copy.me}</span>
        ) : (
          <span aria-hidden="true" className={`glyph text-[2.25rem] font-bold leading-none dark:brightness-[1.45] sm:text-[2.875rem] ${tone?.text ?? ''}`}>
            {self.day.stem}
          </span>
        )}
      </span>
      {self !== null && (
        <span className="flex items-center gap-1 rounded-full bg-foreground px-2.5 py-0.5 text-xs font-bold text-background">
          {copy.me}
          <span className="max-w-[5em] truncate font-semibold opacity-80">· {self.label}</span>
        </span>
      )}
    </button>
  );
}

function PersonNode({
  person,
  x,
  y,
  active,
  showScore,
  onChoose,
}: {
  person: OrbitPerson;
  x: number;
  y: number;
  active: boolean;
  showScore: boolean;
  onChoose: () => void;
}) {
  const tone = person.day === null ? null : ELEMENT_TONE[person.day.element];
  return (
    <button
      type="button"
      onClick={onChoose}
      aria-pressed={active}
      aria-label={`${person.label}${person.day === null ? '' : `, ${person.day.spoken}`}${
        person.compat.score !== null ? `, 나와 궁합 ${person.compat.score}점` : ''
      }`}
      style={{ left: `${x}%`, top: `${y}%` }}
      className="group absolute flex w-[5.5rem] -translate-x-1/2 -translate-y-[1.5rem] sm:w-[6.5rem] sm:-translate-y-[1.75rem] flex-col items-center gap-1 rounded-2xl pb-1 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
    >
      <span
        className={`relative grid size-12 place-items-center rounded-full border-2 bg-surface transition sm:size-14 group-hover:-translate-y-0.5 group-active:scale-95 ${
          tone === null ? 'border-dashed border-border-strong bg-surface-sunken' : `${tone.border} ${tone.surface}`
        } ${active ? 'shadow-[0_0_0_4px_var(--accent)]' : 'shadow-[0_6px_16px_-8px_rgba(0,0,0,0.35)]'}`}
      >
        {person.day === null ? (
          <span aria-hidden="true" className="text-lg font-bold text-muted">?</span>
        ) : (
          <span aria-hidden="true" className={`glyph text-[1.4rem] font-bold leading-none dark:brightness-[1.45] sm:text-[1.6rem] ${tone?.text ?? ''}`}>
            {person.day.stem}
          </span>
        )}
        {showScore && person.compat.score !== null && (
          <span className="absolute -right-3 -top-2 rounded-full bg-accent px-1.5 py-0.5 text-[11px] font-bold tabular-nums leading-none text-on-accent shadow-sm">
            {person.compat.score}
          </span>
        )}
      </span>
      <span
        className={`max-w-full truncate rounded-full px-2 py-0.5 text-[13px] font-semibold leading-tight ${
          active ? 'bg-accent text-on-accent' : 'bg-surface/90 text-foreground'
        }`}
      >
        {person.label}
      </span>
    </button>
  );
}

function LinkScore({ link, placed }: { link: OrbitLink; placed: Record<string, { x: number; y: number }> }) {
  const a = placed[link.a];
  const b = placed[link.b];
  if (a === undefined || b === undefined) return null;
  const { mid } = arcBetween(a, b);
  return (
    <Link
      href={link.href}
      aria-label={`${link.label} 궁합${link.score === null ? '' : ` ${link.score}점`}`}
      style={{ left: `${mid.x}%`, top: `${mid.y}%` }}
      className="absolute -translate-x-1/2 -translate-y-1/2 rounded-full border border-border-strong bg-surface px-2 py-1 text-xs font-bold tabular-nums text-secondary shadow-sm transition hover:border-accent hover:text-accent active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
    >
      {link.score === null ? '궁합' : `${link.score}점`}
    </Link>
  );
}

function PanelShell({ children }: { children: ReactNode }) {
  return (
    <section className="flex flex-col gap-5 rounded-[2rem] border border-border bg-surface p-5 shadow-[var(--shadow-card)] sm:p-6">
      {children}
    </section>
  );
}

/** `readingFirst` — 사람이 0명이면 이 화면의 주 행동은 사람 추가라서 풀이 단추가 테두리로 물러난다 */
function SelfPanel({ self, copy, readingFirst }: { self: OrbitSelf; copy: OrbitCopy; readingFirst: boolean }) {
  const total = self.elements.reduce((sum, item) => sum + item.count, 0) || 1;
  return (
    <PanelShell>
      <header className="flex flex-col gap-1">
        <p className="text-[11px] font-bold uppercase tracking-[0.04em] text-accent">{copy.selfEyebrow}</p>
        <h3 className="text-[1.75rem] font-bold leading-tight tracking-[-0.04em]">{self.label}</h3>
        <p className="text-[13px] tabular-nums text-muted">{self.birth}</p>
      </header>

      <EightGlyphs cells={self.cells} size="hero" hourUnknown={copy.hourUnknown} />

      <div className="flex flex-col gap-2">
        <div className="flex items-baseline justify-between">
          <span className="text-[13px] font-semibold text-secondary">{copy.elementsTitle}</span>
          {self.glyphCount !== 8 && <span className="text-xs text-muted">{copy.noHourNote}</span>}
        </div>
        <div aria-hidden="true" className="flex h-2 overflow-hidden rounded-full bg-track">
          {self.elements.map((item) =>
            item.count === 0 ? null : (
              <span key={item.element} className={ELEMENT_TONE[item.element].bar} style={{ width: `${(item.count / total) * 100}%` }} />
            ),
          )}
        </div>
        <ul className="grid grid-cols-5 gap-1 text-center">
          {self.elements.map((item) => (
            <li key={item.element} className="flex flex-col items-center">
              <span className={`glyph text-base font-bold ${item.count === 0 ? 'text-muted' : ELEMENT_TONE[item.element].text}`}>
                {item.element}
                <span className="ml-0.5 text-xs font-medium text-muted">{item.ko}</span>
              </span>
              <span className={`text-sm tabular-nums ${item.count === 0 ? 'text-muted' : 'font-bold'}`}>{item.count}</span>
            </li>
          ))}
        </ul>
      </div>

      <ReadingAction reading={self.reading} href={self.readingHref} copy={copy} primary={readingFirst} />
      <Link href={self.detailHref} className={`${BUTTON.tertiary} self-start`}>
        {copy.detail} <Arrow />
      </Link>
    </PanelShell>
  );
}

function PersonPanel({ person, copy, hasSelf }: { person: OrbitPerson; copy: OrbitCopy; hasSelf: boolean }) {
  const tone = person.day === null ? null : ELEMENT_TONE[person.day.element];
  return (
    <PanelShell>
      <header className="flex items-start gap-3">
        <span
          aria-hidden="true"
          className={`grid size-14 shrink-0 place-items-center rounded-2xl border-2 ${
            tone === null ? 'border-dashed border-border-strong bg-surface-sunken text-muted' : `${tone.border} ${tone.surface} ${tone.text}`
          }`}
        >
          <span className="glyph text-[1.75rem] font-bold leading-none dark:brightness-[1.45]">{person.day?.stem ?? '?'}</span>
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-[11px] font-bold uppercase tracking-[0.04em] text-accent">{copy.personEyebrow}</p>
          <h3 className="break-keep text-[1.375rem] font-bold leading-tight tracking-[-0.03em]">{person.label}</h3>
          {person.note !== null && <p className="mt-1 line-clamp-2 text-[13px] leading-5 text-muted">{person.note}</p>}
        </div>
      </header>

      {person.cells !== null ? (
        <EightGlyphs cells={person.cells} size="panel" hourUnknown={copy.hourUnknown} />
      ) : (
        <p className="rounded-2xl bg-surface-sunken px-4 py-3 text-sm text-secondary">{person.unreadable}</p>
      )}

      {person.cells !== null && (
        <div className="flex flex-col gap-2.5">
          <Link href={person.compat.href} className={hasSelf ? BUTTON.primary : BUTTON.secondary}>
            <PairIcon />
            <span>{hasSelf ? copy.compatWithMe : copy.compat}</span>
            {person.compat.score !== null && (
              <span className={`rounded-full px-2 py-0.5 text-sm font-bold tabular-nums ${hasSelf ? 'bg-on-accent/15' : 'bg-accent-wash text-accent'}`}>
                {person.compat.score}점
              </span>
            )}
            <Arrow className="ml-auto size-4" />
          </Link>
          <ReadingAction reading={person.reading} href={person.readingHref} copy={copy} primary={false} />
        </div>
      )}

      <Link href={person.detailHref} className={`${BUTTON.tertiary} self-start`}>
        {copy.detail} <Arrow />
      </Link>
    </PanelShell>
  );
}

/** 사주풀이 — 있으면 비유 한 줄이 단추의 둘째 줄이 된다 */
function ReadingAction({
  reading,
  href,
  copy,
  primary,
}: {
  reading: OrbitSelf['reading'];
  href: string;
  copy: OrbitCopy;
  primary: boolean;
}) {
  const filled = primary;
  return (
    <Link
      href={href}
      className={`group flex min-h-16 items-center gap-3 rounded-2xl px-4 py-3 text-left transition active:translate-y-px focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 ${
        filled
          ? 'bg-accent text-on-accent shadow-[0_8px_20px_-10px_var(--accent)] hover:brightness-110'
          : 'border border-border-strong bg-surface hover:border-accent'
      }`}
    >
      <span className={`grid size-10 shrink-0 place-items-center rounded-xl ${filled ? 'bg-on-accent/15' : 'bg-accent-wash text-accent'}`}>
        <BookIcon />
      </span>
      <span className="min-w-0 flex-1">
        <span className="flex flex-wrap items-center gap-1.5">
          <span className="text-[15px] font-semibold">{reading === null ? copy.readingGet : copy.readingSee}</span>
          {reading !== null && !reading.current && (
            <span className="rounded-full bg-warning-wash px-2 py-0.5 text-[11px] font-bold text-warning">{copy.oldChart}</span>
          )}
        </span>
        <span className={`mt-0.5 block truncate text-[13px] ${filled ? 'text-on-accent/80' : 'text-secondary'}`}>
          {reading === null ? copy.readingGetSub : reading.metaphor ?? copy.readingSeeSub}
        </span>
      </span>
      <Arrow className="size-4 shrink-0 opacity-80" />
    </Link>
  );
}

function RegisterPanel({ copy, registerHref }: { copy: OrbitCopy; registerHref: string }) {
  return (
    <PanelShell>
      <header className="flex flex-col gap-2">
        <p className="text-[11px] font-bold uppercase tracking-[0.04em] text-accent">{copy.selfEyebrow}</p>
        <h3 className="text-[1.75rem] font-bold leading-tight tracking-[-0.04em]">{copy.registerTitle}</h3>
        <p className="text-[15px] leading-6 text-secondary">{copy.registerBody}</p>
      </header>
      <Link href={registerHref} className={`${BUTTON.primary} self-stretch sm:self-start`}>
        {copy.registerAction} <Arrow />
      </Link>
    </PanelShell>
  );
}
