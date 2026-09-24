'use client';

import Link from 'next/link';
import { Fragment, useEffect, useRef, useState, type ReactNode } from 'react';

import type { Element } from '@/src/lib/saju';
import type { ActivityBand } from '@/src/lib/presence';

import { ELEMENT_TONE } from '../../../../../element-tone';
import { Arrow, BUTTON, PairIcon } from '../ui';

/*
  **채팅 — 궤도 띠 · 방 목록 · 방 안.**

  브라우저에서 도는 까닭은 셋이다: 어느 방을 골랐나, 폰에서 목록과 방 중 무엇을 보나, 방 안의 손잡이
  (신고할 메시지 고르기 · 차단 확인)가 열렸나. 보내기 · 신고 · 차단은 모양만이다 — 요청은 없다.

  데스크톱(lg)은 목록과 방이 나란히 서서 `view` 를 안 본다. 폰은 목록이 먼저이고, 방을 누르면 그 화면이
  방으로 바뀐다 — 방 머리의 「채팅」 단추가 목록으로 돌아간다.
*/

export type MessageView = {
  id: string;
  mine: boolean;
  body: string;
  at: string;
  day: string;
  time: string;
  /** 같은 사람이 이어 보낸 덩어리의 처음 · 끝 — 모서리와 시각이 여기서 갈린다 */
  runStart: boolean;
  runEnd: boolean;
  firstUnread: boolean;
  reportable: boolean;
};

export type RoomView = {
  id: string;
  name: string;
  heading: string;
  initial: string;
  photoUrl: string | null;
  activity: ActivityBand | null;
  /** 닫힌 까닭 한 줄 — 열린 방은 `null` */
  notice: string | null;
  line: string | null;
  at: string;
  unread: number;
  canBlock: boolean;
  matchHref: string | null;
  openedDay: string;
  messages: MessageView[];
};

export type ChatCopy = {
  title: string;
  stripTitle: string;
  me: string;
  activity: Record<ActivityBand, string>;
  closedGroup: string;
  back: string;
  together: string;
  more: string;
  pickReport: string;
  pickReportHint: string;
  block: string;
  blockNote: string;
  blockConfirm: string;
  cancel: string;
  reportNote: string;
  reportReason: string;
  reportReasons: string[];
  reportDetail: string;
  reportDetailMax: number;
  reportConfirm: string;
  reportDone: string;
  opened: string;
  newMessages: string;
  placeholder: string;
  send: string;
  maxLength: number;
  messagesLabel: string;
  emptyTitle: string;
  emptyDetail: string;
  toMatching: string;
  toRegister: string;
};

type SelfMark = { stem: string; element: Element; label: string; spoken: string };

const FOCUS =
  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-background';

export function ChatView({
  rooms,
  self,
  copy,
  hrefs,
}: {
  rooms: RoomView[];
  self: SelfMark | null;
  copy: ChatCopy;
  hrefs: { matching: string; register: string };
}) {
  const [selectedId, setSelectedId] = useState(rooms[0]?.id ?? '');
  const [view, setView] = useState<'list' | 'room'>('list');
  const top = useRef<HTMLDivElement>(null);

  if (rooms.length === 0) return <Empty self={self} copy={copy} hrefs={hrefs} />;

  const selected = rooms.find((room) => room.id === selectedId) ?? rooms[0];
  const open = rooms.filter((room) => room.notice === null);
  const closed = rooms.filter((room) => room.notice !== null);

  const choose = (id: string) => {
    setSelectedId(id);
    setView('room');
    /* 폰에서는 방이 목록 자리에 선다 — 방 머리부터 보이게 끌어올린다 */
    top.current?.scrollIntoView({ block: 'start', behavior: 'smooth' });
  };

  const onList = view === 'list' ? 'flex' : 'hidden lg:flex';
  const onRoom = view === 'room' ? 'flex' : 'hidden lg:flex';

  return (
    <div ref={top} className="flex min-w-0 scroll-mt-4 flex-col gap-5 sm:gap-6">
      <header className={`${onList} items-end justify-between gap-4`}>
        <h2 className="text-[2rem] font-bold leading-[1.15] tracking-[-0.045em] sm:text-[2.5rem]">{copy.title}</h2>
      </header>

      {open.length > 0 && (
        <div className={`${onList} flex-col`}>
          <OrbitStrip rooms={open} self={self} selectedId={selected.id} copy={copy} onChoose={choose} />
        </div>
      )}

      <div className="grid min-w-0 gap-4 lg:grid-cols-[minmax(19rem,22rem)_minmax(0,1fr)] lg:items-start lg:gap-5">
        <nav aria-label={copy.title} className={`${onList} min-w-0 flex-col gap-2`}>
          <ul className="flex flex-col gap-1.5">
            {open.map((room) => (
              <li key={room.id}>
                <RoomRow room={room} active={room.id === selected.id} copy={copy} onChoose={() => choose(room.id)} />
              </li>
            ))}
          </ul>
          {closed.length > 0 && (
            <>
              <p className="mt-3 flex items-center gap-3 px-2 text-xs font-bold text-muted">
                {copy.closedGroup}
                <span aria-hidden="true" className="h-px flex-1 bg-border" />
              </p>
              <ul className="flex flex-col gap-1.5">
                {closed.map((room) => (
                  <li key={room.id}>
                    <RoomRow room={room} active={room.id === selected.id} copy={copy} onChoose={() => choose(room.id)} />
                  </li>
                ))}
              </ul>
            </>
          )}
        </nav>

        <div className={`${onRoom} min-w-0 flex-col`}>
          {/* 방을 바꾸면 방 안의 손잡이(신고 고르기 · 차단 확인 · 적던 말)는 처음으로 돌아간다 */}
          <Room key={selected.id} room={selected} copy={copy} onBack={() => setView('list')} />
        </div>
      </div>
    </div>
  );
}

/* ───────────────────────── 궤도 띠 ───────────────────────── */

/**
 * 궤도 위 자리 — 최근에 말이 오간 방이 앞(아래 가운데)에 서고, 다음부터 좌우 · 뒤로 돈다.
 * 궤도 위치는 **대화의 순서일 뿐이다** — 누가 더 가깝다는 판정이 아니다(홈의 궤도와 같은 규율).
 */
const SEATS = [90, 162, 18, 222, 318, 270];

function seatOf(index: number): { x: number; y: number } {
  const angle = (SEATS[index % SEATS.length] * Math.PI) / 180;
  const x = 50 + 40 * Math.cos(angle);
  const y = 42 + 34 * Math.sin(angle);
  return { x: Math.min(86, Math.max(14, x)), y };
}

function OrbitStrip({
  rooms,
  self,
  selectedId,
  copy,
  onChoose,
}: {
  rooms: RoomView[];
  self: SelfMark | null;
  selectedId: string;
  copy: ChatCopy;
  onChoose: (id: string) => void;
}) {
  const tone = self === null ? null : ELEMENT_TONE[self.element];
  const seated = rooms.slice(0, SEATS.length).map((room, index) => ({ room, ...seatOf(index) }));

  return (
    <section
      aria-labelledby="orbit-chat-strip"
      className="relative grid overflow-hidden rounded-[2rem] border border-border bg-surface shadow-[var(--shadow-card)] lg:grid-cols-[15rem_minmax(0,1fr)]"
    >
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_60%_45%,var(--accent-wash)_0%,transparent_60%)] opacity-80"
      />
      <div className="relative flex flex-col gap-4 px-5 pt-5 lg:border-r lg:border-border lg:py-6">
        <h3 id="orbit-chat-strip" className="flex items-baseline gap-2 text-xl font-bold tracking-[-0.03em]">
          {copy.stripTitle}
          <span className="text-sm font-semibold tabular-nums text-muted">{rooms.length}</span>
        </h3>
        <ul className="hidden flex-col gap-2 text-xs font-medium text-secondary lg:flex">
          <Legend copy={copy} />
        </ul>
      </div>

      <div className="relative mx-auto h-[17rem] w-full max-w-[40rem] sm:h-[16rem]">
        <svg aria-hidden="true" viewBox="0 0 100 100" preserveAspectRatio="none" className="absolute inset-0 size-full">
          <ellipse cx="50" cy="42" rx="40" ry="34" vectorEffect="non-scaling-stroke" className="fill-none stroke-border-strong" strokeWidth="1" />
          {seated.map(({ room, x, y }) =>
            room.activity === 'now' ? (
              <line
                key={room.id}
                x1="50"
                y1="42"
                x2={x}
                y2={y}
                vectorEffect="non-scaling-stroke"
                className="stroke-accent"
                strokeWidth="2"
                strokeDasharray="2 5"
                strokeLinecap="round"
              />
            ) : null,
          )}
        </svg>

        <span
          role="img"
          aria-label={self === null ? copy.me : `${copy.me} ${self.label}, ${self.spoken}`}
          className={`absolute left-1/2 top-[42%] grid size-14 -translate-x-1/2 -translate-y-1/2 place-items-center rounded-full border-2 shadow-[0_10px_30px_-12px_rgba(0,0,0,0.35)] sm:size-16 ${
            tone === null ? 'border-dashed border-border-strong bg-surface' : `${tone.border} ${tone.surface}`
          }`}
        >
          {self === null ? (
            <span className="text-lg font-bold text-muted">{copy.me}</span>
          ) : (
            <span aria-hidden="true" className={`glyph text-[1.75rem] font-bold leading-none dark:brightness-[1.45] sm:text-[2rem] ${tone?.text ?? ''}`}>
              {self.stem}
            </span>
          )}
        </span>

        {seated.map(({ room, x, y }) => (
          <button
            key={room.id}
            type="button"
            onClick={() => onChoose(room.id)}
            aria-pressed={room.id === selectedId}
            aria-label={[room.heading, room.activity === null ? null : copy.activity[room.activity], room.unread > 0 ? `${room.unread}건 안 읽음` : null]
              .filter((part) => part !== null)
              .join(', ')}
            style={{ left: `${x}%`, top: `${y}%` }}
            className={`group absolute flex w-[5.5rem] -translate-x-1/2 -translate-y-[1.75rem] flex-col items-center gap-1 rounded-2xl pb-1 ${FOCUS}`}
          >
            <span className="relative transition group-active:scale-95">
              <Presence band={room.activity} size="lg" />
              <Face room={room} size={48} />
              {room.unread > 0 && (
                <span className="absolute -right-1.5 -top-1.5">
                  <Badge count={room.unread} />
                </span>
              )}
            </span>
            <span
              className={`max-w-full truncate rounded-full px-2 py-0.5 text-[13px] font-semibold ${
                room.id === selectedId ? 'bg-foreground text-background' : 'bg-surface/90 text-foreground'
              }`}
            >
              {room.name}
            </span>
          </button>
        ))}
      </div>

      <ul className="relative flex flex-wrap gap-x-4 gap-y-1.5 border-t border-border px-5 py-3 text-xs font-medium text-secondary lg:hidden">
        <Legend copy={copy} />
      </ul>
    </section>
  );
}

/** 접속 상태의 표 — 색만으로 말하지 않게 **테두리 모양**이 셋을 가른다: 빛나는 실선 · 실선 · 점선 */
function Legend({ copy }: { copy: ChatCopy }) {
  return (
    <>
      {(['now', 'day', 'earlier'] as const).map((band) => (
        <li key={band} className="flex items-center gap-2">
          <span aria-hidden="true" className="relative inline-grid size-4 place-items-center">
            <Presence band={band} size="sm" />
            <span className="size-2.5 rounded-full bg-surface-sunken" />
          </span>
          {copy.activity[band]}
        </li>
      ))}
    </>
  );
}

/** 얼굴을 두르는 고리 — 얼굴보다 먼저 그려 뒤에 선다 */
function Presence({ band, size }: { band: ActivityBand | null; size: 'sm' | 'md' | 'lg' }) {
  if (band === null) return null;
  const inset = size === 'lg' ? '-inset-[5px]' : size === 'md' ? '-inset-[4px]' : 'inset-0';
  if (band === 'now') {
    return (
      <>
        <span aria-hidden="true" className={`absolute ${inset} rounded-full bg-accent/25 motion-safe:animate-ping`} />
        <span aria-hidden="true" className={`absolute ${inset} rounded-full border-2 border-accent bg-accent/15 shadow-[0_0_14px_2px_var(--accent)]`} />
      </>
    );
  }
  return (
    <span
      aria-hidden="true"
      className={`absolute ${inset} rounded-full border-2 border-secondary/70 ${band === 'earlier' ? 'border-dashed opacity-80' : ''}`}
    />
  );
}

/* ───────────────────────── 목록 ───────────────────────── */

function RoomRow({ room, active, copy, onChoose }: { room: RoomView; active: boolean; copy: ChatCopy; onChoose: () => void }) {
  const closed = room.notice !== null;
  const unread = room.unread > 0;
  return (
    <button
      type="button"
      onClick={onChoose}
      aria-current={active ? 'true' : undefined}
      className={`relative flex min-h-[4.75rem] w-full items-center gap-3.5 rounded-2xl border px-3.5 py-3 text-left transition active:translate-y-px ${FOCUS} ${
        active
          ? 'border-accent/40 bg-accent-wash'
          : closed
            ? 'border-transparent bg-surface-sunken/60 hover:border-border-strong'
            : 'border-transparent hover:border-border-strong hover:bg-surface'
      }`}
    >
      {active && <span aria-hidden="true" className="absolute inset-y-3 left-0 w-1 rounded-full bg-accent" />}
      <span className="relative shrink-0 p-1">
        <span className="relative block">
          <Presence band={room.activity} size="md" />
          <Face room={room} size={48} dim={closed} />
        </span>
      </span>
      <span className="flex min-w-0 flex-1 flex-col gap-0.5">
        <span className="flex items-baseline justify-between gap-3">
          <span className={`truncate text-[17px] font-bold tracking-[-0.02em] ${closed ? 'text-secondary' : 'text-foreground'}`}>
            {room.name}
          </span>
          <span className={`shrink-0 text-xs tabular-nums ${unread ? 'font-bold text-accent' : 'text-muted'}`}>{room.at}</span>
        </span>
        <span className="flex items-center gap-2">
          <span
            className={`flex min-w-0 flex-1 items-center gap-1.5 text-sm ${
              closed ? 'text-muted' : unread ? 'font-semibold text-foreground' : 'text-secondary'
            }`}
          >
            {closed && <Lock className="size-3.5" />}
            <span className="truncate">{room.line ?? (room.activity === null ? '' : copy.activity[room.activity])}</span>
          </span>
          {unread && <Badge count={room.unread} />}
        </span>
      </span>
    </button>
  );
}

/* ───────────────────────── 방 안 ───────────────────────── */

type Tool = 'none' | 'report' | 'block';

function Room({ room, copy, onBack }: { room: RoomView; copy: ChatCopy; onBack: () => void }) {
  const [tool, setTool] = useState<Tool>('none');
  const [reporting, setReporting] = useState<MessageView | null>(null);
  const [reported, setReported] = useState(false);
  const menu = useRef<HTMLDetailsElement>(null);
  const closed = room.notice !== null;
  const canReport = room.messages.some((one) => one.reportable);

  const pick = (next: Tool) => {
    setTool(next);
    setReporting(null);
    setReported(false);
    if (menu.current !== null) menu.current.open = false;
  };

  return (
    <section
      aria-label={room.heading}
      className="flex min-w-0 flex-col overflow-hidden rounded-[2rem] border border-border bg-surface shadow-[var(--shadow-card)] lg:h-[46rem]"
    >
      <header className="flex items-center gap-2 border-b border-border px-3 py-3 sm:gap-3 sm:px-5">
        <button
          type="button"
          onClick={onBack}
          className={`inline-flex min-h-11 min-w-11 shrink-0 items-center justify-center gap-1 rounded-xl pl-1.5 pr-2.5 text-sm font-semibold text-secondary transition hover:text-foreground active:bg-surface-sunken lg:hidden ${FOCUS}`}
        >
          <Arrow className="size-4 rotate-180" />
          <span className="max-[400px]:sr-only">{copy.back}</span>
        </button>
        <span className="relative shrink-0 p-1">
          <span className="relative block">
            <Presence band={room.activity} size="md" />
            <Face room={room} size={44} dim={closed} />
          </span>
        </span>
        <div className="min-w-0 flex-1">
          <h3 className="truncate text-[22px] font-bold leading-tight tracking-[-0.04em]">{room.heading}</h3>
          {room.activity !== null && (
            <p className={`mt-0.5 flex items-center gap-1.5 whitespace-nowrap text-[13px] font-semibold ${room.activity === 'now' ? 'text-accent' : 'text-secondary'}`}>
              {room.activity === 'now' && <span aria-hidden="true" className="size-2 rounded-full bg-accent shadow-[0_0_8px_var(--accent)]" />}
              {copy.activity[room.activity]}
            </p>
          )}
        </div>
        {room.matchHref !== null && (
          <Link href={room.matchHref} aria-label={copy.together} className={`${BUTTON.compact} max-sm:w-11 max-sm:px-0`}>
            <PairIcon className="size-5 text-accent" />
            <span className="max-sm:hidden">{copy.together}</span>
          </Link>
        )}
        {(canReport || room.canBlock) && (
          <details ref={menu} className="relative shrink-0">
            <summary
              aria-label={copy.more}
              className={`grid size-11 cursor-pointer list-none place-items-center rounded-xl border border-border-strong bg-surface text-foreground transition hover:border-accent active:scale-95 [&::-webkit-details-marker]:hidden ${FOCUS}`}
            >
              <svg aria-hidden="true" viewBox="0 0 24 24" className="size-5 fill-current">
                <circle cx="5" cy="12" r="1.8" />
                <circle cx="12" cy="12" r="1.8" />
                <circle cx="19" cy="12" r="1.8" />
              </svg>
            </summary>
            <div className="absolute right-0 top-13 z-10 w-60 rounded-2xl border border-border bg-surface p-1.5 shadow-[var(--shadow-float)]">
              {canReport && (
                <button type="button" onClick={() => pick('report')} className={`flex min-h-11 w-full items-center gap-2.5 rounded-xl px-3 text-left text-[15px] font-semibold hover:bg-surface-soft active:bg-surface-sunken ${FOCUS}`}>
                  <Flag />
                  {copy.pickReport}
                </button>
              )}
              {room.canBlock && (
                <button type="button" onClick={() => pick('block')} className={`flex min-h-11 w-full items-center gap-2.5 rounded-xl px-3 text-left text-[15px] font-semibold text-danger hover:bg-danger-wash active:bg-danger-wash ${FOCUS}`}>
                  <BlockIcon />
                  {copy.block}
                </button>
              )}
            </div>
          </details>
        )}
      </header>

      {tool === 'block' && (
        <div role="alertdialog" aria-label={copy.block} className="flex flex-col gap-3 border-b border-danger/30 bg-danger-wash px-5 py-4">
          <p className="text-sm leading-6 text-foreground">{copy.blockNote}</p>
          <div className="flex flex-wrap items-center gap-2">
            <button type="button" className={`inline-flex min-h-11 items-center rounded-xl border border-danger bg-surface px-4 text-sm font-bold text-danger transition active:translate-y-px ${FOCUS}`}>
              {copy.blockConfirm}
            </button>
            <button type="button" onClick={() => pick('none')} className={BUTTON.tertiary}>
              {copy.cancel}
            </button>
          </div>
        </div>
      )}
      {tool === 'report' && reporting === null && !reported && (
        <div role="status" className="flex items-center justify-between gap-3 border-b border-warning/40 bg-warning-wash px-5 py-2">
          <p className="flex items-center gap-2 text-sm font-semibold text-foreground">
            <Flag />
            {copy.pickReportHint}
          </p>
          <button type="button" onClick={() => pick('none')} className={BUTTON.tertiary}>
            {copy.cancel}
          </button>
        </div>
      )}

      <Messages
        room={room}
        copy={copy}
        picking={tool === 'report' && reporting === null && !reported}
        picked={reporting?.id ?? null}
        onPick={setReporting}
      />

      {closed ? (
        <p role="status" className="m-3 flex items-start gap-2.5 rounded-2xl bg-surface-sunken px-4 py-3.5 text-[15px] leading-6 text-secondary sm:m-4">
          <Lock className="mt-1 size-4" />
          {room.notice}
        </p>
      ) : tool === 'report' && (reporting !== null || reported) ? (
        <ReportSheet
          message={reporting}
          done={reported}
          copy={copy}
          onSend={() => {
            setReported(true);
            setReporting(null);
          }}
          onCancel={() => pick('none')}
        />
      ) : (
        <Composer copy={copy} />
      )}
    </section>
  );
}

function Messages({
  room,
  copy,
  picking,
  picked,
  onPick,
}: {
  room: RoomView;
  copy: ChatCopy;
  picking: boolean;
  picked: string | null;
  onPick: (message: MessageView) => void;
}) {
  const list = useRef<HTMLOListElement>(null);
  /* 방은 마지막 말에서 열린다 — 데스크톱의 방은 높이가 정해져 안에서 흐르므로 끝으로 내린다 */
  useEffect(() => {
    if (list.current !== null) list.current.scrollTop = list.current.scrollHeight;
  }, [room.id]);

  const days = new Set<string>();
  const divider = (day: string) => {
    if (days.has(day)) return null;
    days.add(day);
    return <DayRule key={`day-${day}`} day={day} />;
  };

  return (
    <ol ref={list} aria-label={copy.messagesLabel} className="flex min-h-[16rem] flex-1 flex-col px-3 py-4 sm:px-5 lg:overflow-y-auto">
      {divider(room.openedDay)}
      <li className="flex justify-center pb-3">
        <span className="rounded-full bg-surface-soft px-3 py-1 text-xs font-medium text-muted">{copy.opened}</span>
      </li>
      {room.messages.map((message) => (
        <Fragment key={message.id}>
          {divider(message.day)}
          {message.firstUnread && (
            <li className="my-3 flex items-center gap-3 text-xs font-bold text-accent">
              <span aria-hidden="true" className="h-px flex-1 bg-accent/40" />
              {copy.newMessages}
              <span aria-hidden="true" className="h-px flex-1 bg-accent/40" />
            </li>
          )}
          <Bubble
            room={room}
            message={message}
            picking={picking && message.reportable}
            picked={picked === message.id}
            onPick={() => onPick(message)}
          />
        </Fragment>
      ))}
    </ol>
  );
}

function DayRule({ day }: { day: string }) {
  return (
    <li className="my-3 flex items-center gap-3 first:mt-0">
      <span aria-hidden="true" className="h-px flex-1 bg-border" />
      <span className="rounded-full border border-border bg-surface px-3 py-1 text-xs font-semibold tabular-nums text-secondary">{day}</span>
      <span aria-hidden="true" className="h-px flex-1 bg-border" />
    </li>
  );
}

function Bubble({
  room,
  message,
  picking,
  picked,
  onPick,
}: {
  room: RoomView;
  message: MessageView;
  picking: boolean;
  picked: boolean;
  onPick: () => void;
}) {
  const { mine, runStart, runEnd } = message;
  /* 덩어리 안에서 맞닿는 모서리만 줄인다 — 한 사람이 이어 말한 것이 한 덩어리로 읽힌다 */
  const corner = mine ? `rounded-tr-md ${runEnd ? '' : 'rounded-br-md'}` : `rounded-tl-md ${runEnd ? '' : 'rounded-bl-md'}`;
  const body = (
    <span
      className={`block whitespace-pre-wrap break-keep [overflow-wrap:anywhere] rounded-[20px] ${corner} px-4 py-2.5 text-left text-[15px] leading-6 ${
        mine ? 'bg-accent text-on-accent' : 'border border-border bg-surface-soft text-foreground'
      } ${picking ? 'ring-2 ring-warning ring-offset-2 ring-offset-surface' : ''} ${picked ? 'ring-2 ring-danger ring-offset-2 ring-offset-surface' : ''}`}
    >
      {message.body}
    </span>
  );

  return (
    <li className={`flex gap-2 ${mine ? 'justify-end' : 'justify-start'} ${runStart ? 'mt-3' : 'mt-1'} first:mt-0`}>
      {!mine && (
        <span className="w-8 shrink-0">
          {runStart && <Face room={room} size={32} />}
        </span>
      )}
      <span className={`flex max-w-[78%] items-end gap-2 sm:max-w-[70%] ${mine ? 'flex-row-reverse' : ''}`}>
        {picking ? (
          <button type="button" onClick={onPick} className={`min-w-0 rounded-[20px] ${FOCUS}`}>
            {body}
          </button>
        ) : (
          <span className="min-w-0">{body}</span>
        )}
        {runEnd && (
          <time dateTime={message.at} className="shrink-0 pb-0.5 text-xs tabular-nums text-muted">
            {message.time}
          </time>
        )}
      </span>
    </li>
  );
}

function Composer({ copy }: { copy: ChatCopy }) {
  const [body, setBody] = useState('');
  const near = body.length >= copy.maxLength * 0.9;
  return (
    <form
      className="sticky bottom-0 flex items-end gap-2 border-t border-border bg-surface p-3 sm:gap-3 sm:p-4"
      onSubmit={(event) => event.preventDefault()}
    >
      <label className="relative flex min-w-0 flex-1 flex-col rounded-2xl border border-border-strong bg-surface-soft transition focus-within:border-accent focus-within:ring-2 focus-within:ring-accent-wash">
        <span className="sr-only">{copy.messagesLabel}</span>
        <textarea
          value={body}
          onChange={(event) => setBody(event.target.value)}
          placeholder={copy.placeholder}
          maxLength={copy.maxLength}
          rows={2}
          className="min-h-12 w-full resize-none bg-transparent px-4 pb-1 pt-3 text-[15px] leading-6 outline-none placeholder:text-muted"
        />
        <span aria-live="polite" className={`self-end px-3 pb-1.5 text-xs tabular-nums ${near ? 'font-bold text-danger' : 'text-muted'}`}>
          {body.length.toLocaleString('ko-KR')} / {copy.maxLength.toLocaleString('ko-KR')}
        </span>
      </label>
      <button type="submit" className={`${BUTTON.primary} shrink-0 max-sm:w-12 max-sm:px-0 sm:px-5`}>
        <SendIcon />
        <span className="max-sm:sr-only">{copy.send}</span>
      </button>
    </form>
  );
}

function ReportSheet({
  message,
  done,
  copy,
  onSend,
  onCancel,
}: {
  message: MessageView | null;
  done: boolean;
  copy: ChatCopy;
  onSend: () => void;
  onCancel: () => void;
}) {
  const [detail, setDetail] = useState('');
  if (done || message === null) {
    return (
      <div role="status" className="flex items-center justify-between gap-3 border-t border-border bg-surface-soft p-4">
        <p className="text-sm font-semibold text-foreground">{copy.reportDone}</p>
        <button type="button" onClick={onCancel} className={BUTTON.tertiary}>
          {copy.cancel}
        </button>
      </div>
    );
  }
  return (
    <div className="flex flex-col gap-3 border-t border-warning/40 bg-surface p-4 sm:p-5">
      <blockquote className="line-clamp-2 border-l-4 border-danger/60 pl-3 text-sm leading-6 text-secondary">{message.body}</blockquote>
      <p className="text-[13px] leading-5 text-secondary">{copy.reportNote}</p>
      <label className="flex flex-col gap-1.5">
        <span className="text-[13px] font-semibold text-secondary">{copy.reportReason}</span>
        <select className="min-h-11 rounded-xl border border-border-strong bg-surface px-3 text-[15px] outline-none focus:border-accent focus:ring-2 focus:ring-accent-wash">
          {copy.reportReasons.map((reason) => (
            <option key={reason}>{reason}</option>
          ))}
        </select>
      </label>
      <label className="flex flex-col gap-1.5">
        <span className="text-[13px] font-semibold text-secondary">{copy.reportDetail}</span>
        <textarea
          value={detail}
          onChange={(event) => setDetail(event.target.value)}
          maxLength={copy.reportDetailMax}
          rows={2}
          className="rounded-xl border border-border-strong bg-surface px-3 py-2 text-[15px] outline-none focus:border-accent focus:ring-2 focus:ring-accent-wash"
        />
      </label>
      <div className="flex flex-wrap items-center gap-2">
        <button type="button" onClick={onSend} className={`inline-flex min-h-11 items-center rounded-xl border border-danger bg-surface px-4 text-sm font-bold text-danger transition active:translate-y-px ${FOCUS}`}>
          {copy.reportConfirm}
        </button>
        <button type="button" onClick={onCancel} className={BUTTON.tertiary}>
          {copy.cancel}
        </button>
      </div>
    </div>
  );
}

/* ───────────────────────── 빈 상태 ───────────────────────── */

function Empty({ self, copy, hrefs }: { self: SelfMark | null; copy: ChatCopy; hrefs: { matching: string; register: string } }) {
  const tone = self === null ? null : ELEMENT_TONE[self.element];
  return (
    <div className="flex flex-col gap-5 sm:gap-6">
      <h2 className="text-[2rem] font-bold leading-[1.15] tracking-[-0.045em] sm:text-[2.5rem]">{copy.title}</h2>
      <section className="relative grid overflow-hidden rounded-[2rem] border border-border bg-surface shadow-[var(--shadow-card)] sm:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)] sm:items-center">
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_30%_50%,var(--accent-wash)_0%,transparent_60%)] opacity-80"
        />
        <div aria-hidden="true" className="relative mx-auto aspect-square w-full max-w-[17rem] p-6">
          <svg viewBox="0 0 100 100" className="absolute inset-6 size-[calc(100%-3rem)] overflow-visible">
            <circle cx="50" cy="50" r="44" className="fill-none stroke-border-strong" strokeWidth="0.8" strokeDasharray="2 3" />
            <circle cx="50" cy="6" r="7" className="fill-surface stroke-accent" strokeWidth="0.8" strokeDasharray="2 2" />
          </svg>
          <span
            className={`absolute left-1/2 top-1/2 grid size-16 -translate-x-1/2 -translate-y-1/2 place-items-center rounded-full border-2 ${
              tone === null ? 'border-dashed border-border-strong bg-surface' : `${tone.border} ${tone.surface}`
            }`}
          >
            {self === null ? (
              <span className="text-lg font-bold text-muted">{copy.me}</span>
            ) : (
              <span className={`glyph text-[2rem] font-bold leading-none dark:brightness-[1.45] ${tone?.text ?? ''}`}>{self.stem}</span>
            )}
          </span>
        </div>
        <div className="relative flex flex-col gap-3 px-6 pb-7 sm:py-10 sm:pr-10">
          <h3 className="text-[28px] font-bold leading-[1.2] tracking-[-0.04em]">{copy.emptyTitle}</h3>
          <p className="text-[15px] leading-6 text-secondary">{copy.emptyDetail}</p>
          <Link href={self === null ? hrefs.register : hrefs.matching} className={`${BUTTON.primary} mt-2 self-start`}>
            {self === null ? copy.toRegister : copy.toMatching}
            <Arrow />
          </Link>
        </div>
      </section>
    </div>
  );
}

/* ───────────────────────── 조각 ───────────────────────── */

function Face({ room, size, dim = false }: { room: RoomView; size: number; dim?: boolean }) {
  const box = { width: `${size}px`, height: `${size}px`, fontSize: `${Math.round(size * 0.4)}px` };
  return (
    <span
      aria-hidden="true"
      style={box}
      className={`relative grid shrink-0 place-items-center overflow-hidden rounded-full bg-surface-sunken font-semibold text-secondary ring-2 ring-surface ${dim ? 'grayscale' : ''}`}
    >
      {room.photoUrl !== null ? (
        /* 예시 얼굴은 같은 출처의 정적 파일이다 — 장식이라 배경으로 깐다(이름은 옆 글자가 든다) */
        <span className={`size-full bg-cover bg-center ${dim ? 'opacity-60' : ''}`} style={{ backgroundImage: `url(${room.photoUrl})` }} />
      ) : room.initial !== '' ? (
        room.initial
      ) : (
        <svg viewBox="0 0 24 24" className="size-1/2 fill-none stroke-current" strokeWidth="1.8" strokeLinecap="round">
          <circle cx="12" cy="8.5" r="3.5" />
          <path d="M5 20c.6-3.8 3.2-5.5 7-5.5s6.4 1.7 7 5.5" />
        </svg>
      )}
    </span>
  );
}

function Badge({ count }: { count: number }) {
  return (
    <span className="grid h-5 min-w-5 shrink-0 place-items-center rounded-full bg-fire px-1.5 text-[11px] font-bold leading-none text-white ring-2 ring-surface">
      {count}
      <span className="sr-only">건 안 읽음</span>
    </span>
  );
}

function Icon({ children, className = 'size-4' }: { children: ReactNode; className?: string }) {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24" className={`${className} shrink-0 fill-none stroke-current`} strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
      {children}
    </svg>
  );
}

function Lock({ className }: { className?: string }) {
  return (
    <Icon className={className}>
      <rect x="5" y="10.5" width="14" height="9.5" rx="2" />
      <path d="M8.5 10.5V8a3.5 3.5 0 0 1 7 0v2.5" />
    </Icon>
  );
}

function Flag() {
  return (
    <Icon className="size-4 text-warning">
      <path d="M5 21V4M5 4h11l-2 4 2 4H5" />
    </Icon>
  );
}

function BlockIcon() {
  return (
    <Icon>
      <circle cx="12" cy="12" r="8" />
      <path d="m6.5 6.5 11 11" />
    </Icon>
  );
}

function SendIcon() {
  return (
    <Icon className="size-5">
      <path d="M12 19V5M6 11l6-6 6 6" />
    </Icon>
  );
}
