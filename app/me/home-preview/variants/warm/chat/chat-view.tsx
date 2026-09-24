'use client';

import Link from 'next/link';
import { useRef, useState } from 'react';

import { REPORT_DETAIL_MAX, REPORT_NOTE, REPORT_REASONS, type ReportReason } from '@/src/lib/account';
import { CHAT_INPUT_PLACEHOLDER, CHAT_POLICY, CHAT_SEND_LABEL, TOO_LONG_TEXT } from '@/src/lib/chat';
import { BLOCK_NOTE } from '@/src/lib/consent';
import type { Element } from '@/src/lib/saju';

import { previewHref } from '../../../shared/preview-href';
import { PRIMARY, ROUND_ICON, SECONDARY } from '../buttons';
import { rounded } from '../fonts';
import { ELEMENT_CLASS, ElementSymbol, Icon, NONE_CLASS } from '../symbols';
import type { BubbleGroup, Compat, RoomView } from './model';
import { ChatIcon, RoomAvatar } from './parts';

/*
  **목록과 방 — 넓은 화면은 두 칸, 폰은 한 칸 안에서 갈아 끼운다.**

  주소는 안 바꾼다(`page.tsx` 는 못 고친다) — 고른 방은 이 컴포넌트의 상태다. 폰에서 아무 방도 안 골랐으면 목록만,
  고르면 방만 선다. 넓은 화면은 늘 둘 다 서고, 아무것도 안 골랐으면 첫 방이 열려 있다.

  말풍선 색이 곧 두 사람이다: **내 말은 내 일간 색의 잉크로 채우고, 상대 말은 상대 파스텔**을 입는다(홈의
  타일 규칙을 대화로 옮겼다). 내 사주가 없으면 내 말은 먹색이다.
*/
export function ChatView({ rooms, selfElement }: { rooms: RoomView[]; selfElement: Element | null }) {
  const [openId, setOpenId] = useState<string | null>(null);
  const shown = rooms.find((room) => room.matchId === openId) ?? rooms[0];
  const pane = useRef<HTMLDivElement>(null);

  const open = (matchId: string) => {
    setOpenId(matchId);
    /* 폰에서는 목록이 사라지고 방이 그 자리에 선다 — 방의 머리로 올린다 */
    requestAnimationFrame(() => pane.current?.scrollIntoView({ block: 'start' }));
  };

  return (
    <div className="grid min-w-0 gap-4 lg:h-[min(46rem,calc(100dvh-10rem))] lg:grid-cols-[22rem_minmax(0,1fr)] lg:gap-5">
      <section
        aria-label="대화방 목록"
        className={`${openId === null ? 'flex' : 'hidden lg:flex'} min-h-0 flex-col overflow-hidden rounded-[2rem] bg-[var(--card)] ring-1 ring-[var(--line)]`}
      >
        <ul className="flex min-h-0 flex-col overflow-y-auto p-2">
          {rooms.map((room) => (
            <li key={room.matchId}>
              <RoomRow room={room} active={room.matchId === shown.matchId} opened={openId !== null} onOpen={() => open(room.matchId)} />
            </li>
          ))}
        </ul>
      </section>

      <div ref={pane} className={`${openId === null ? 'hidden lg:flex' : 'flex'} min-h-0 min-w-0 scroll-mt-4 flex-col`}>
        <Room key={shown.matchId} room={shown} selfElement={selfElement} onBack={() => setOpenId(null)} />
      </div>
    </div>
  );
}

function RoomRow({ room, active, opened, onOpen }: { room: RoomView; active: boolean; opened: boolean; onOpen: () => void }) {
  const closed = room.notice !== null;
  /* 넓은 화면에서 지금 열린 방은 그 사람의 파스텔이 깔린다. 폰에서 아직 아무 방도 안 열었으면 표시하지 않는다 */
  const tone = room.element === null ? NONE_CLASS : ELEMENT_CLASS[room.element];
  return (
    <button
      type="button"
      onClick={onOpen}
      aria-current={active ? 'true' : undefined}
      className={`${tone} group flex w-full min-w-0 items-center gap-3 rounded-[1.5rem] p-3 text-left active:scale-[0.99] ${
        active && opened ? 'bg-[var(--tile)]' : active ? 'hover:bg-surface-soft lg:bg-[var(--tile)]' : 'hover:bg-surface-soft'
      } focus-visible:outline-[3px] focus-visible:outline-offset-[-3px] focus-visible:outline-[color-mix(in_srgb,var(--btn)_45%,transparent)]`}
    >
      <RoomAvatar
        photoUrl={room.photoUrl}
        initial={room.initial}
        element={room.element}
        size="lg"
        activity={closed ? null : room.activity}
        activityLabel={room.activityLabel}
        closed={closed}
      />
      <span className="flex min-w-0 flex-1 flex-col gap-1">
        <span className="flex items-baseline justify-between gap-2">
          <span className={`${rounded.className} truncate text-[1.125rem] leading-6 ${closed ? 'text-secondary' : 'text-foreground'}`}>
            {room.name}
          </span>
          <span className={`shrink-0 text-[12px] tabular-nums ${room.unread > 0 ? 'font-semibold text-foreground' : 'text-secondary'}`}>
            {room.listTime}
          </span>
        </span>
        <span className="flex items-center gap-2">
          {closed && <ChatIcon name="lock" className="size-3.5 text-secondary" />}
          <span
            className={`min-w-0 flex-1 truncate text-[14px] leading-5 ${
              closed ? 'text-secondary' : room.unread > 0 ? 'font-medium text-foreground' : 'text-secondary'
            }`}
          >
            {room.lastLine === '' ? <span className="sr-only">메시지 없음</span> : room.lastLine}
          </span>
          {room.unread > 0 && (
            <span className="grid h-5 min-w-5 shrink-0 place-items-center rounded-full bg-fire px-1.5 text-[11px] font-bold leading-none text-white tabular-nums">
              {room.unread}
              <span className="sr-only">건 안 읽음</span>
            </span>
          )}
        </span>
      </span>
    </button>
  );
}

type Slot = { kind: 'compose' } | { kind: 'block' } | { kind: 'report'; messageId: string | null };

function Room({ room, selfElement, onBack }: { room: RoomView; selfElement: Element | null; onBack: () => void }) {
  const [slot, setSlot] = useState<Slot>({ kind: 'compose' });
  const [menu, setMenu] = useState(false);
  const [reported, setReported] = useState(false);
  const closed = room.notice !== null;
  const reporting = slot.kind === 'report';

  const empty = room.days.length === 0;
  const mineTone = selfElement === null ? null : ELEMENT_CLASS[selfElement];
  const theirTone = room.element === null ? NONE_CLASS : ELEMENT_CLASS[room.element];

  return (
    <section
      aria-label={room.heading}
      className="flex min-h-[32rem] min-w-0 flex-1 flex-col overflow-hidden rounded-[2rem] bg-[var(--card)] ring-1 ring-[var(--line)] lg:min-h-0"
    >
      <header className="flex items-center gap-2 border-b border-[var(--line)] px-3 py-3 sm:gap-3 sm:px-5">
        <button type="button" onClick={onBack} aria-label="대화방 목록" className={`${ROUND_ICON} lg:hidden`}>
          <ChatIcon name="back" />
        </button>
        <RoomAvatar
          photoUrl={room.photoUrl}
          initial={room.initial}
          element={room.element}
          size="md"
          activity={closed ? null : room.activity}
          activityLabel={null}
          closed={closed}
        />
        <div className="min-w-0 flex-1">
          <h2 className={`${rounded.className} truncate text-[1.25rem] leading-7 text-foreground`}>{room.heading}</h2>
          {!closed && room.activityLabel !== null && (
            <p className="flex items-center gap-1.5 text-[12px] font-medium text-secondary">
              <span
                aria-hidden="true"
                className={`size-2 rounded-full ${
                  room.activity === 'now'
                    ? 'bg-[#4fae6d]'
                    : room.activity === 'day'
                      ? 'bg-[color-mix(in_srgb,#4fae6d_35%,var(--card))]'
                      : 'border border-[var(--line)]'
                }`}
              />
              {room.activityLabel}
            </p>
          )}
        </div>
        {!room.left && (
          <Link
            href={previewHref(`/me/match/${room.matchId}`)}
            aria-label="함께 보는 궁합"
            className={`${theirTone} inline-flex min-h-11 shrink-0 items-center gap-1.5 rounded-full bg-[var(--tile)] px-3.5 text-[14px] font-semibold text-[var(--ink)] ring-1 ring-[color-mix(in_srgb,var(--ink)_18%,transparent)] hover:ring-[var(--ink)] active:scale-[0.96]`}
          >
            <Icon name="heart" className="size-4" />
            {room.compat === null ? '궁합' : <span className="tabular-nums">{room.compat.score}점</span>}
          </Link>
        )}
        {room.hasPartner && (
          <div className="relative shrink-0">
            <button
              type="button"
              aria-label="신고 · 차단"
              aria-expanded={menu}
              onClick={() => setMenu((was) => !was)}
              className={ROUND_ICON}
            >
              <ChatIcon name="more" />
            </button>
            {menu && (
              <div className="absolute right-0 top-13 z-20 w-56 rounded-[1.25rem] bg-[var(--card)] p-2 shadow-[var(--shadow-float)] ring-1 ring-[var(--line)]">
                <MenuItem
                  icon="flag"
                  label="신고"
                  onClick={() => {
                    setMenu(false);
                    setReported(false);
                    setSlot({ kind: 'report', messageId: null });
                  }}
                />
                {!closed && (
                  <MenuItem
                    icon="block"
                    label="차단"
                    danger
                    onClick={() => {
                      setMenu(false);
                      setSlot({ kind: 'block' });
                    }}
                  />
                )}
              </div>
            )}
          </div>
        )}
      </header>

      {/* 거꾸로 쌓는 칸 — 스크롤의 시작점이 맨 아래라 방에 들어오면 가장 최근 말이 먼저 보인다(사진이 늦게 와도 밀리지 않는다) */}
      <div className="flex min-h-0 flex-1 flex-col-reverse overflow-y-auto px-3 py-5 sm:px-6">
        <div className="flex flex-col gap-5">
          {room.compat !== null && <CompatNote compat={room.compat} matchId={room.matchId} />}

          {room.days.map((day) => (
            <div key={day.key} className="flex flex-col gap-3">
              <p className="self-center rounded-full bg-surface-soft px-3 py-1 text-[12px] font-medium text-secondary">{day.label}</p>
              <ol className="flex flex-col gap-3">
                {day.groups.map((group) => (
                  <Group
                    key={group.key}
                    group={group}
                    room={room}
                    mineTone={mineTone}
                    theirTone={theirTone}
                    picking={reporting && !group.mine && !group.fromLeft}
                    picked={slot.kind === 'report' ? slot.messageId : null}
                    onPick={(messageId) => setSlot({ kind: 'report', messageId })}
                  />
                ))}
              </ol>
            </div>
          ))}

          {empty && room.compat === null && <div className="flex-1" />}
        </div>
      </div>

      <div className="border-t border-[var(--line)] p-3 sm:px-5 sm:py-4">
        {reported && slot.kind === 'compose' && (
          <p role="status" className="mb-3 rounded-[1rem] bg-surface-soft px-4 py-2.5 text-[13px] text-secondary">
            신고를 접수했습니다. 운영자가 확인합니다.
          </p>
        )}
        {slot.kind === 'block' ? (
          <BlockAsk name={room.name} onCancel={() => setSlot({ kind: 'compose' })} />
        ) : slot.kind === 'report' ? (
          <ReportPanel
            picked={slot.messageId}
            onCancel={() => setSlot({ kind: 'compose' })}
            onDone={() => {
              setReported(true);
              setSlot({ kind: 'compose' });
            }}
          />
        ) : closed ? (
          <p role="status" className="flex items-center gap-2.5 rounded-full bg-surface-soft px-4 py-3 text-[14px] text-secondary">
            <ChatIcon name="lock" className="size-4" />
            {room.notice}
          </p>
        ) : (
          <Composer />
        )}
      </div>
    </section>
  );
}

function MenuItem({
  icon,
  label,
  danger = false,
  onClick,
}: {
  icon: 'flag' | 'block';
  label: string;
  danger?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex min-h-11 w-full items-center gap-2.5 rounded-xl px-3 text-left text-[15px] font-semibold hover:bg-surface-soft active:bg-surface-sunken ${
        danger ? 'text-danger' : 'text-foreground'
      }`}
    >
      <ChatIcon name={icon} className="size-[18px]" />
      {label}
    </button>
  );
}

/** 대화 첫머리의 궁합 한 줄 — 매칭 카드가 한 말을 그대로 되짚는다. 카드 전체가 함께 보는 궁합으로 가는 길이다 */
function CompatNote({ compat, matchId }: { compat: Compat; matchId: string }) {
  const tone = compat.element === null ? NONE_CLASS : ELEMENT_CLASS[compat.element];
  return (
    <Link
      href={previewHref(`/me/match/${matchId}`)}
      className={`${tone} group relative mx-auto flex w-full max-w-md items-center gap-4 overflow-hidden rounded-[1.5rem] bg-[var(--tile)] p-4 pr-5 active:scale-[0.99] sm:p-5`}
    >
      <ElementSymbol element={compat.element} className="pointer-events-none absolute -bottom-4 -right-4 size-24 opacity-20" />
      <span className="relative grid size-16 shrink-0 place-items-center rounded-full bg-[var(--card)] shadow-[0_6px_16px_-10px_rgba(0,0,0,0.35)]">
        <span className={`${rounded.className} text-[1.625rem] leading-none tabular-nums text-[var(--ink)]`}>{compat.score}</span>
        <span className="sr-only">점</span>
      </span>
      <span className="relative flex min-w-0 flex-1 flex-col gap-1">
        <span className="flex items-center gap-1.5 text-[12px] font-semibold text-[var(--ink)]">
          <Icon name="heart" className="size-3.5" />
          함께 보는 궁합
        </span>
        <span className="text-[15px] font-semibold leading-6 text-foreground">{compat.highlight ?? compat.balanceLabel}</span>
        {compat.highlight !== null && <span className="text-[13px] text-secondary">{compat.balanceLabel}</span>}
      </span>
      <span className="relative flex shrink-0 items-center gap-0.5 text-[13px] font-semibold text-[var(--ink)] underline decoration-2 underline-offset-4 group-hover:decoration-[var(--ink)]">
        자세히
        <Icon name="arrow" className="size-4" />
      </span>
    </Link>
  );
}

function Group({
  group,
  room,
  mineTone,
  theirTone,
  picking,
  picked,
  onPick,
}: {
  group: BubbleGroup;
  room: RoomView;
  mineTone: string | null;
  theirTone: string;
  picking: boolean;
  picked: string | null;
  onPick: (messageId: string) => void;
}) {
  const mine = group.mine;
  const bubbleTone = mine
    ? mineTone === null
      ? 'bg-[var(--btn)] text-[var(--on-btn)]'
      : `${mineTone} bg-[var(--ink)] text-[var(--tile)]`
    : `${theirTone} bg-[var(--tile)] text-foreground`;

  return (
    <li className={`flex min-w-0 gap-2 ${mine ? 'justify-end' : 'justify-start'}`}>
      {!mine && (
        <span className="mt-0.5 self-start">
          <RoomAvatar photoUrl={room.photoUrl} initial={room.initial} element={room.element} size="sm" />
        </span>
      )}
      <div className={`flex min-w-0 max-w-[82%] flex-col gap-1 sm:max-w-[70%] ${mine ? 'items-end' : 'items-start'}`}>
        {group.bubbles.map((bubble, index) => {
          const first = index === 0;
          const last = index === group.bubbles.length - 1;
          const chosen = picked === bubble.id;
          return (
            <div key={bubble.id} className={`flex max-w-full items-end gap-1.5 ${mine ? 'flex-row-reverse' : ''}`}>
              <p
                className={`${bubbleTone} max-w-full whitespace-pre-wrap break-words rounded-[1.25rem] px-4 py-2.5 text-[15px] leading-[1.55] ${
                  first ? (mine ? 'rounded-tr-md' : 'rounded-tl-md') : ''
                } ${chosen ? 'ring-[3px] ring-danger ring-offset-2 ring-offset-[var(--card)]' : ''}`}
              >
                {bubble.body}
              </p>
              {picking ? (
                <button
                  type="button"
                  onClick={() => onPick(bubble.id)}
                  aria-pressed={chosen}
                  aria-label="이 메시지 신고"
                  className={`grid size-11 shrink-0 place-items-center rounded-full ring-1 active:scale-95 ${
                    chosen ? 'bg-danger text-white ring-danger' : 'bg-[var(--card)] text-danger ring-danger/45'
                  }`}
                >
                  <ChatIcon name="flag" className="size-[18px]" />
                </button>
              ) : (
                last && (
                  <time dateTime={bubble.createdAt} className="shrink-0 pb-0.5 text-[11px] tabular-nums text-secondary">
                    {group.time}
                  </time>
                )
              )}
            </div>
          );
        })}
      </div>
    </li>
  );
}

/** 둥근 입력창 — 모양만. 보내기는 아무 일도 하지 않는다. 글자 수는 실제로 센다(1000자 한도의 자리) */
function Composer() {
  const [body, setBody] = useState('');
  const over = body.length > CHAT_POLICY.maxLength;
  const near = body.length >= CHAT_POLICY.maxLength * 0.9;
  return (
    <form
      className="flex flex-col gap-1.5"
      onSubmit={(event) => {
        event.preventDefault();
      }}
    >
      <div className="flex items-end gap-2 rounded-[1.75rem] bg-surface-soft p-1.5 pl-4 ring-1 ring-[var(--line)] focus-within:ring-2 focus-within:ring-[color-mix(in_srgb,var(--btn)_45%,transparent)]">
        <label className="flex min-w-0 flex-1">
          <span className="sr-only">메시지</span>
          <textarea
            value={body}
            onChange={(event) => setBody(event.target.value)}
            placeholder={CHAT_INPUT_PLACEHOLDER}
            rows={1}
            className="field-sizing-content max-h-40 min-h-11 w-full resize-none bg-transparent py-2.5 text-[15px] leading-6 text-foreground outline-none placeholder:text-secondary"
          />
        </label>
        <button
          type="submit"
          aria-label={CHAT_SEND_LABEL}
          className="inline-flex min-h-11 shrink-0 items-center gap-1.5 rounded-full bg-[var(--btn)] px-3 text-[15px] font-semibold text-[var(--on-btn)] shadow-[0_6px_14px_-8px_rgba(38,36,31,0.7)] hover:bg-[var(--btn-press)] active:scale-95 sm:px-4"
        >
          <ChatIcon name="send" className="size-[18px]" />
          <span className="hidden sm:inline">{CHAT_SEND_LABEL}</span>
        </button>
      </div>
      <p className="flex justify-between gap-3 px-4 text-[11px] text-secondary">
        <span role={over ? 'alert' : undefined} className={over ? 'font-semibold text-danger' : ''}>
          {over ? TOO_LONG_TEXT : ''}
        </span>
        <span className={`tabular-nums ${over ? 'font-semibold text-danger' : near ? 'text-foreground' : ''}`}>
          {body.length.toLocaleString('ko-KR')}/{CHAT_POLICY.maxLength.toLocaleString('ko-KR')}
        </span>
      </p>
    </form>
  );
}

/** 차단 — 원본(`BlockButton`)과 같은 두 걸음: 누르면 알림 글과 확인 단추가 선다 */
function BlockAsk({ name, onCancel }: { name: string; onCancel: () => void }) {
  return (
    <div className="flex flex-col gap-3 rounded-[1.5rem] bg-danger-wash p-4 ring-1 ring-danger/30 sm:p-5">
      <p className="flex items-center gap-2 text-[15px] font-bold text-danger">
        <ChatIcon name="block" className="size-[18px]" />
        {name} 님 차단
      </p>
      <p className="text-[14px] leading-6 text-foreground">{BLOCK_NOTE}</p>
      <div className="flex flex-wrap items-center gap-2">
        <button type="button" className={`${PRIMARY} bg-danger text-white hover:bg-danger`} onClick={onCancel}>
          차단합니다
        </button>
        <button type="button" className={SECONDARY} onClick={onCancel}>
          그만두기
        </button>
      </div>
    </div>
  );
}

/** 신고 — 메시지 하나를 고른다(PRD §7.1). 고르기 전에는 고르라는 말만, 고르면 사유 칸이 선다 */
function ReportPanel({ picked, onCancel, onDone }: { picked: string | null; onCancel: () => void; onDone: () => void }) {
  const [reason, setReason] = useState<ReportReason>(REPORT_REASONS[0].value);
  const [detail, setDetail] = useState('');
  return (
    <div className="flex max-h-[60vh] flex-col gap-3 overflow-y-auto rounded-[1.5rem] bg-surface-soft p-4 ring-1 ring-[var(--line)] sm:p-5">
      <div className="flex items-start justify-between gap-3">
        <p className="flex items-center gap-2 text-[15px] font-bold text-foreground">
          <ChatIcon name="flag" className="size-[18px] text-danger" />
          {picked === null ? '신고할 메시지를 골라 주세요' : '메시지 신고'}
        </p>
        <button type="button" aria-label="그만두기" onClick={onCancel} className={`${ROUND_ICON} -m-1.5 size-11`}>
          <ChatIcon name="close" className="size-[18px]" />
        </button>
      </div>
      <p className="text-[13px] leading-5 text-secondary">{REPORT_NOTE}</p>
      {picked !== null && (
        <>
          <label className="flex flex-col gap-1.5">
            <span className="text-[13px] font-semibold text-secondary">신고 사유</span>
            <select
              value={reason}
              onChange={(event) => setReason(event.target.value as ReportReason)}
              className="min-h-11 rounded-xl bg-[var(--card)] px-3 text-[15px] ring-1 ring-[var(--line)] outline-none focus:ring-2 focus:ring-[color-mix(in_srgb,var(--btn)_45%,transparent)]"
            >
              {REPORT_REASONS.map((one) => (
                <option key={one.value} value={one.value}>
                  {one.label}
                </option>
              ))}
            </select>
          </label>
          <label className="flex flex-col gap-1.5">
            <span className="text-[13px] font-semibold text-secondary">덧붙일 말 (선택)</span>
            <textarea
              value={detail}
              onChange={(event) => setDetail(event.target.value.slice(0, REPORT_DETAIL_MAX))}
              maxLength={REPORT_DETAIL_MAX}
              rows={2}
              className="rounded-xl bg-[var(--card)] px-3 py-2.5 text-[15px] ring-1 ring-[var(--line)] outline-none focus:ring-2 focus:ring-[color-mix(in_srgb,var(--btn)_45%,transparent)]"
            />
          </label>
          <button type="button" onClick={onDone} className={`${PRIMARY} self-start`}>
            신고합니다
          </button>
        </>
      )}
    </div>
  );
}
