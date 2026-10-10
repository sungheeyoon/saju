'use client';

import Link from 'next/link';
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';

import { REPORT_DONE } from '@/src/lib/account';
import { NEW_MESSAGES_LABEL, OLDER_LOADING_LABEL, OLDER_MESSAGES_LABEL, ROOM_FIRST_HELLO, ROOM_SAFETY_NOTE } from '@/src/lib/chat/copy';
import { activityText, type ActivityBand } from '@/src/lib/presence';
import { STEM_INFO, type Stem } from '@/src/lib/saju';

import { withCameFrom } from '../../../came-from';
import { elementScope } from '../../../ui/element-tone';
import { BUTTON_SECONDARY_SMALL } from '../../../ui/buttons';
import { StemSymbol } from '../../../ui/stem-symbol';
import { Icon } from '../../../ui/icons';
import { TYPE_NAME } from '../../../ui/surfaces';
import { Avatar } from '../../avatar';
import { DayMasterChip } from '../../people/chart-bits';
import { BlockConfirm, ReportBlockMenu } from '../../requests/report-block';
import { Composer } from '../composer';
import { settlePending, withPending, type Pending } from './pending';
import type { RoomTones } from '../tones';
import { bubbleDaysOf, flaggable, type Bubble, type ShownMessage } from './bubbles';
import { ReportPanel } from './report';
import styles from './room.module.css';
import { newestSeq, readAlready } from './thread';
import { THEIR_SEQ, useReadMarker } from './use-read-marker';
import { useThread, type MergeKind } from './use-thread';

/**
 * 방 안에서 사람이 서는 모양 — 서버가 다 지어서 넘긴다(시각 글자 · 묶음 · 닫힌 까닭).
 */
type RoomView = {
  readonly matchId: string;
  /** `{닉네임} 님` · 떠났으면 「탈퇴한 사용자」 */
  readonly heading: string;
  readonly name: string;
  /** 상대가 떠났으면 `null` — 사진도 신고도 차단도 걸 사람이 없다(ADR 0094) */
  readonly partnerUserId: string | null;
  readonly partnerHasPhoto: boolean;
  /** 닫힌 까닭 한 줄 — 열린 방은 `null` */
  readonly notice: string | null;
  /** 열린 방에만 온다(ADR 0092) */
  readonly activity: ActivityBand | null;
  readonly unread: number;
  /** 서버가 읽은 최근 200건 — 시각 글자를 붙여 넘긴다(`labelled`). 그 뒤는 방이 브라우저에서 합친다(ADR 0155) */
  readonly messages: readonly ShownMessage[];
  /** 읽는 문이 준 것이 방의 처음부터다(200건 아래) — 그때만 첫머리를 세운다 */
  readonly fromBeginning: boolean;
  /** 두 사람의 일간 — 인연 궁합이 연 값이 있을 때만(`roomTonesForViewer`). 없으면 중립 색이다 */
  readonly tones: RoomTones | null;
};

/**
 * 상대의 파스텔을 입은 알약 — 원본 시안의 궁합 알약이다. 보조 단추와 같은 44px · 같은 글자 크기이고, 면과 글자가
 * 한 오행 한 벌이라(글자 `--ink` · 면 `--tile`, 대비 5.6:1 이상) 어느 오행이어도 읽힌다.
 */
const TONED_PILL =
  'inline-flex min-h-11 items-center justify-center gap-1.5 rounded-full bg-[var(--tile)] px-4 text-sm font-semibold text-[var(--ink)] ring-1 ring-[color-mix(in_srgb,var(--ink)_18%,transparent)] hover:ring-[var(--ink)] active:scale-[0.97]';

/** 머리의 아이콘 단추 — 판 위에 테 없이 선다. 누를 자리는 44px 그대로다(「⋯」도 같은 모양이다, `ReportBlockMenu`) */
const GHOST_ICON =
  'grid size-11 shrink-0 place-items-center rounded-full text-foreground hover:bg-surface-soft active:scale-95';

type Slot = { kind: 'compose' } | { kind: 'block' } | { kind: 'report'; messageId: string | null };

/** 맨 아래에서 이만큼 안이면 「맨 아래에 있다」 — 새 메시지가 오면 그대로 따라 내려간다 */
const NEAR_BOTTOM_PX = 48;

/** 말풍선 줄이 메시지를 가리키는 자리 — 스크롤 자리를 지킬 때 같은 줄을 다시 찾는다 */
const MESSAGE_ID = 'data-message-id';

/**
 * 대화 칸의 스크롤 자리를 지킨다 — **과거를 읽는 사람의 눈 앞이 움직이지 않는다**(ADR 0155).
 *
 * 대화 칸은 거꾸로 쌓여(`flex-col-reverse`) 스크롤의 0 이 맨 아래다. 맨 아래에 있으면 새 말이 붙어도 그대로 맨 아래다.
 * 위에서 읽는 중이면 합치기 직전에 맨 위에 보이는 말풍선과 그 높이를 재어 두고, 그린 뒤 그 말풍선이 같은 높이에 오게
 * 스크롤을 옮긴다 — 아래에 새 말이 붙든 위에 이전 말이 붙든 같은 규칙이다. 브라우저의 스크롤 고정이 이미 지켰으면
 * 옮길 것이 0 이다.
 */
function useScrollKeeper(messages: readonly ShownMessage[]) {
  const log = useRef<HTMLDivElement>(null);
  const anchor = useRef<{ id: string; top: number } | null>(null);
  /** 위에서 읽는 동안 상대의 새 말이 왔다 — 「새 메시지」 단추가 선다 */
  const [fresh, setFresh] = useState(false);

  const atBottom = useCallback(() => {
    const element = log.current;
    return element === null || Math.abs(element.scrollTop) < NEAR_BOTTOM_PX;
  }, []);

  const beforeMerge = useCallback(
    (kind: MergeKind, incoming: readonly ShownMessage[]) => {
      const element = log.current;
      anchor.current = null;
      if (element === null) return;
      if (kind === 'newer' && atBottom()) return;
      const top = element.getBoundingClientRect().top;
      for (const row of element.querySelectorAll(`[${MESSAGE_ID}]`)) {
        const box = row.getBoundingClientRect();
        if (box.bottom > top) {
          anchor.current = { id: row.getAttribute(MESSAGE_ID) ?? '', top: box.top };
          break;
        }
      }
      if (kind === 'newer' && incoming.some((message) => !message.mine)) setFresh(true);
    },
    [atBottom],
  );

  /* 그린 뒤 — 재어 둔 말풍선이 같은 높이에 오게 스크롤을 옮긴다 */
  useLayoutEffect(() => {
    const keep = anchor.current;
    anchor.current = null;
    const element = log.current;
    if (keep === null || element === null) return;
    const row = element.querySelector(`[${MESSAGE_ID}="${CSS.escape(keep.id)}"]`);
    if (row === null) return;
    const moved = row.getBoundingClientRect().top - keep.top;
    if (moved !== 0) element.scrollTop += moved;
  }, [messages]);

  const toBottom = useCallback(() => {
    log.current?.scrollTo({ top: 0 });
    setFresh(false);
  }, []);

  const onScroll = useCallback(() => {
    if (atBottom()) setFresh(false);
  }, [atBottom]);

  return { log, fresh, beforeMerge, toBottom, onScroll };
}


/**
 * **방 하나 — 머리와 입력이 붙어 있고 대화만 스크롤한다.**
 *
 * 폰에서 대화가 길면 입력칸까지 스크롤해야 했다. 이제 방이 화면 높이의 판이고, 그 안에서 대화 칸만
 * 움직인다. 대화 칸은 거꾸로 쌓는다(`flex-col-reverse`) — 스크롤의 시작점이 맨 아래라 들어오면 가장
 * 최근 말이 먼저 보이고, 보낸 뒤 다시 읽어도 그 자리에 남는다.
 *
 * **대화가 두 사람의 색으로 짜인다** — 내 말은 내 일간 오행의 진한 색으로 채우고, 상대 말은 상대 일간
 * 오행의 파스텔을 입는다(홈의 「사람 한 명 = 그 오행의 파스텔 한 장」을 대화로 옮겼다). 색은 인연 궁합이
 * 이미 연 두 일간에서만 온다(`tones.ts`). 그 값이 없는 방(닫힌 방 · 떠난 상대 · 옛 Match)은 내 말이 먹색,
 * 상대 말이 회색 한 벌이다 — 지어낸 색은 그 사람에 대해 거짓을 말한다.
 *
 * 신고 · 차단은 머리의 「⋯」 안에 있다 — 말풍선마다 「신고」가 서 있으면 대화가 신고 목록처럼 읽힌다. 인연 궁합 ·
 * 오늘의 인연 카드와 같은 「⋯」다(`ReportBlockMenu`, ADR 0158). 신고를 누르면 입력 자리에 사유 칸이 곧장 서고, 상대
 * 말풍선 곁에 깃발이 선다 — 하나를 고르면 메시지 신고, 안 고르면 사람 신고다. 차단은 입력 자리에 알림 글과 확인 단추가 선다.
 */
export function ChatRoomView({ room }: { room: RoomView }) {
  const [slot, setSlot] = useState<Slot>({ kind: 'compose' });
  const [reported, setReported] = useState(false);
  const closed = room.notice !== null;
  const hasPartner = room.partnerUserId !== null;
  const picking = slot.kind === 'report';
  const picked = slot.kind === 'report' ? slot.messageId : null;
  const theirTone = room.tones?.theirs.element ?? null;

  /* 메시지는 방이 든다 — 서버의 첫 200건에서 시작해 채널이 알릴 때마다 합친다(ADR 0155) */
  /* 방이 합치기 직전에 스크롤 자리를 재는 손 — 스크롤 자리는 합쳐진 메시지를 보고 지키므로 손을 뒤에서 잇는다 */
  const measure = useRef<(kind: MergeKind, incoming: readonly ShownMessage[]) => void>(() => {});
  const thread = useThread(room.matchId, room.messages, room.fromBeginning, (kind, incoming) => measure.current(kind, incoming));
  const { log, fresh, beforeMerge, toBottom, onScroll } = useScrollKeeper(thread.messages);
  useEffect(() => {
    measure.current = beforeMerge;
  }, [beforeMerge]);
  /*
    **보내는 중인 내 말** — 누르는 순간 흐린 말풍선으로 서고, 읽혀 온 진짜 말이 그 자리를 잇는다(`pending.ts`). 읽음 · 스크롤 자리는
    진짜 말만 본다 — 보내는 중인 말은 그리는 목록에만 붙는다.
  */
  const [held, setPending] = useState<readonly Pending[]>([]);
  const pendingSerial = useRef(0);
  /* 걷힌 것은 그릴 때 뺀다 — 들고 있는 목록은 다음에 맡길 때 함께 비운다 */
  const pending = useMemo(() => settlePending(held, thread.messages), [held, thread.messages]);
  const shown = useMemo(() => withPending(thread.messages, pending), [thread.messages, pending]);
  const pendingIds = useMemo(() => new Set(pending.map((one) => one.id)), [pending]);
  const days = useMemo(() => bubbleDaysOf(shown), [shown]);
  /* 들어올 때 이미 읽은 차례 — 처음 그린 값으로 한 번 정한다 */
  const [already] = useState(() => readAlready(room.messages, room.unread));
  useReadMarker(log, room.matchId, already, !closed, days);

  return (
    <section
      aria-label={room.heading}
      className={`${styles.room} flex min-w-0 flex-col lg:flex-1 overflow-hidden rounded-[1.75rem] bg-surface ring-1 ring-border lg:rounded-[2rem]`}
    >
      <header className="flex items-center gap-2 border-b border-border px-2.5 py-2.5 sm:gap-3 sm:px-4">
        <Link href="/me/chat" aria-label="대화방 목록" className={`${GHOST_ICON} lg:hidden`}>
          <Icon name="back" />
        </Link>
        <span className={closed ? 'opacity-60 grayscale' : ''}>
          <Avatar userId={room.partnerUserId ?? ''} nickname={room.name} hasPhoto={room.partnerHasPhoto} size={44} tone={theirTone} />
        </span>
        <div className="min-w-0 flex-1">
          {/* 상대가 떠났으면 닉네임 자리에 「탈퇴한 사용자」가 선다(PRD 「계정이 멈추는 자리」, ADR 0094) */}
          <h1 className="truncate font-rounded text-[1.25rem] leading-7 text-foreground">{room.heading}</h1>
          {/* 접속 상태는 구간 하나다 — 열린 방에만 오고, 시각은 오지 않는다(PRD 「접속 상태」, ADR 0092) */}
          {room.activity !== null && <Activity band={room.activity} />}
        </div>
        {/*
          폰에서는 이름에 자리를 준다 — 같은 길이 대화의 첫머리에 있다. 닫힌 방에는 안 선다: 차단 · 정지 · 탈퇴 신청으로
          닫히면 인연 궁합도 그 쌍에게 닫힌다(`visible_matches()`) — 누르면 없는 화면이다.
        */}
        {hasPartner && !closed && (
          <span className="hidden shrink-0 sm:block">
            <Link href={withCameFrom(`/me/match/${room.matchId}`, 'chat')} className={room.tones === null ? BUTTON_SECONDARY_SMALL : `${elementScope(theirTone)} ${TONED_PILL}`}>
              <Icon name="heart" className={`size-[18px] ${room.tones === null ? 'text-danger' : ''}`} />
              인연 궁합
            </Link>
          </span>
        )}
        {hasPartner && (
          <ReportBlockMenu
            canBlock={!closed}
            onReport={() => {
              setReported(false);
              setSlot({ kind: 'report', messageId: null });
            }}
            onBlock={() => setSlot({ kind: 'block' })}
          />
        )}
      </header>

      {/* 읽음은 화면에 들어온 상대 말까지만 남는다 — 신고 · 차단 칸이 입력 자리를 차지해도 그대로다(`useReadMarker`) */}
      <div className="relative flex min-h-0 flex-1 flex-col">
      <div
        ref={log}
        onScroll={onScroll}
        role="log"
        aria-label="메시지"
        className="flex min-h-0 flex-1 flex-col-reverse overflow-y-auto overscroll-contain"
      >
        <div className="flex flex-col gap-5 px-3 py-5 sm:px-6">
          {thread.reachedStart ? (
            <RoomStart room={room} quiet={thread.messages.length === 0 && pending.length === 0} />
          ) : (
            thread.messages.length > 0 && (
              <button
                type="button"
                onClick={thread.loadOlder}
                disabled={thread.loadingOlder}
                className={`${BUTTON_SECONDARY_SMALL} self-center`}
              >
                {thread.loadingOlder ? OLDER_LOADING_LABEL : OLDER_MESSAGES_LABEL}
              </button>
            )
          )}
          {days.map((day) => (
            <div key={day.key} className="flex flex-col gap-1">
              <p className="mb-2 self-center rounded-full bg-surface-soft px-3 py-1 text-[12px] font-medium text-secondary">
                {day.label}
              </p>
              <ol className="flex flex-col gap-1">
                {day.bubbles.map((bubble) => (
                  <BubbleRow
                    key={bubble.id}
                    bubble={bubble}
                    room={room}
                    sending={pendingIds.has(bubble.id)}
                    /* 신고는 상대의 말에만 선다(`flaggable`). 고른 깃발을 다시 누르면 고르기가 풀린다 — 고르기는 선택이다 */
                    pickable={picking && flaggable(bubble)}
                    chosen={picked === bubble.id}
                    onPick={() => setSlot({ kind: 'report', messageId: picked === bubble.id ? null : bubble.id })}
                  />
                ))}
              </ol>
            </div>
          ))}
        </div>
      </div>
      {fresh && (
        <button
          type="button"
          onClick={toBottom}
          className={`${BUTTON_SECONDARY_SMALL} absolute bottom-3 left-1/2 -translate-x-1/2 shadow-float`}
        >
          <Icon name="arrow" className="size-4 rotate-90" />
          {NEW_MESSAGES_LABEL}
        </button>
      )}
      </div>

      <div className="flex flex-col gap-2 border-t border-border p-2.5 sm:p-4">
        {reported && slot.kind === 'compose' && (
          <p role="status" className="rounded-[1rem] bg-surface-soft px-4 py-2.5 text-[13px] text-secondary">
            {REPORT_DONE}
          </p>
        )}
        {/* 차단이 끝나 다시 읽으면 방이 닫혀 있다 — 그때는 확인 칸 대신 닫힌 까닭이 선다 */}
        {slot.kind === 'block' && !closed && room.partnerUserId !== null ? (
          <BlockConfirm userId={room.partnerUserId} onCancel={() => setSlot({ kind: 'compose' })} />
        ) : slot.kind === 'report' && room.partnerUserId !== null ? (
          <ReportPanel
            partnerUserId={room.partnerUserId}
            messageId={slot.messageId}
            onBlock={closed ? undefined : () => setSlot({ kind: 'block' })}
            onCancel={() => setSlot({ kind: 'compose' })}
            onDone={() => {
              setReported(true);
              setSlot({ kind: 'compose' });
            }}
          />
        ) : closed ? (
          /* 닫힌 까닭 한 줄 — 상대가 떠났으면 넷째 줄(PRD 「앱 내 채팅」) */
          <p role="status" className="flex items-center gap-2.5 rounded-[1.25rem] bg-surface-soft px-4 py-3 text-[14px] text-secondary">
            <Icon name="lock" className="size-4" />
            {room.notice}
          </p>
        ) : (
          <Composer
            matchId={room.matchId}
            onPending={(body) => {
              // 보낸 사람은 제 말을 곧장 본다 — 맨 아래로 내려가고, 흐린 말풍선이 선다.
              const id = `pending-${++pendingSerial.current}`;
              setPending((now) => [
                ...settlePending(now, thread.messages),
                { id, body, after: newestSeq(thread.messages), sentAt: new Date().toISOString() },
              ]);
              toBottom();
              return id;
            }}
            onSettled={(id, sent) => {
              // 서버가 받았으면 그 말을 읽는 문으로 읽어 합친다 — 합쳐지면 흐린 말풍선이 걷힌다. 못 보냈으면 곧장 걷는다.
              if (sent) thread.catchUp();
              else setPending((now) => now.filter((one) => one.id !== id));
            }}
          />
        )}
      </div>
    </section>
  );
}

function Activity({ band }: { band: ActivityBand }) {
  /* 점은 꾸밈이다 — 뜻은 곁의 글자가 든다(색만으로 말하지 않는다) */
  const dot = band === 'now' ? 'bg-success' : band === 'day' ? 'bg-success/40' : 'ring-1 ring-border-strong';
  return (
    <p className="flex items-center gap-1.5 text-[12px] font-medium text-secondary">
      <span aria-hidden="true" className={`size-2 shrink-0 rounded-full ${dot}`} />
      {activityText(band)}
    </p>
  );
}

/**
 * 대화의 첫머리 — 누구와 이야기하는지와 (폰에서) 인연 궁합으로 가는 길.
 *
 * 두 일간을 아는 방은 **두 사람의 카드**다: 나와 상대가 제 일간 오행의 파스텔 한 장씩으로 나란히 서고(결과 화면의
 * 「각자의 사주」와 같은 조각 `DayMasterChip`), 아래로 인연 궁합이 이어진다. 「이 사람과 왜 이야기하게
 * 됐나」를 두 색이 되짚는다. 점수 · 궁합 한 줄은 방의 문이 주지 않으므로 싣지 않는다(지어낸 점수는 함께 보는
 * 궁합의 점수와 갈린다). 두 일간을 모르는 방은 상대의 사진과 이름만 선다.
 */
function RoomStart({ room, quiet }: { room: RoomView; quiet: boolean }) {
  const tones = room.tones;
  /*
    **막 열린 방은 무엇을 하면 되는지와 어디서 끊는지를 말한다**(운영자 2026-10-10, 화면 점검 C4). 두 사람 카드와 빈 입력칸만
    서 있으면 첫 말을 기다리는 방인지 고장 난 방인지 갈리지 않는다. 첫 말이 오가면 걷힌다. 열린 방 · 상대가 있는 방에만 선다 —
    닫힌 방은 입력이 없고, 떠난 상대의 방에는 「⋯」가 없다.
  */
  const hello = quiet && room.partnerUserId !== null && room.notice === null && (
    <div className="flex max-w-sm flex-col gap-1 text-center">
      <p className="text-[15px] font-semibold leading-6 text-foreground">{ROOM_FIRST_HELLO}</p>
      <p className="text-[13px] leading-5 text-secondary">{ROOM_SAFETY_NOTE}</p>
    </div>
  );
  /*
    **폰에서만 선다** — 넓은 화면(sm 이상)은 머리에 같은 단추가 늘 서 있어, 여기도 서면 한 화면에 「인연 궁합」이 둘이었다
    (화면 감사 2026-10-09). 폰의 머리는 이름에 자리를 주느라 그 단추가 없다. 서는 조건은 머리와 같다(상대가 있고 열린 방).
  */
  const toMatch = room.partnerUserId !== null && room.notice === null && (
    <Link href={withCameFrom(`/me/match/${room.matchId}`, 'chat')} className={`${BUTTON_SECONDARY_SMALL} sm:hidden`}>
      <Icon name="heart" className="size-4 text-danger" />
      인연 궁합
      <Icon name="arrow" className="size-4" />
    </Link>
  );

  if (tones === null) {
    return (
      <div className="flex flex-col items-center gap-3 pb-2 pt-4 text-center">
        <Avatar userId={room.partnerUserId ?? ''} nickname={room.name} hasPhoto={room.partnerHasPhoto} size={72} />
        <p className={TYPE_NAME}>{room.heading}</p>
        {toMatch}
        {hello}
      </div>
    );
  }

  return (
    <div className="mx-auto flex w-full max-w-md flex-col items-center gap-3 pt-2">
      <div className="grid w-full grid-cols-2 gap-2">
        <StartSide label="나" stem={tones.mine.stem} />
        <StartSide label={room.name} stem={tones.theirs.stem} />
      </div>
      {toMatch}
      {hello}
    </div>
  );
}

/** 첫머리 카드의 한 사람 — 제 일간 오행의 파스텔 한 장. 색만으로 말하지 않게 딱지(상징 · 글자 · 이름)와 「갑목 일간」이 함께 선다 */
function StartSide({ label, stem }: { label: string; stem: Stem }) {
  const info = STEM_INFO[stem];
  return (
    <section className={`${elementScope(info.element)} relative flex min-w-0 flex-col gap-2 overflow-hidden rounded-[1.5rem] bg-[var(--tile)] p-4`}>
      <StemSymbol stem={stem} className="pointer-events-none absolute -bottom-4 -right-4 size-20 opacity-20" />
      <DayMasterChip stem={stem} className="relative self-start" />
      <div className="relative min-w-0">
        <p className="truncate font-rounded text-[1.125rem] leading-6 text-foreground">{label}</p>
      </div>
    </section>
  );
}

function BubbleRow({
  bubble,
  room,
  sending = false,
  pickable,
  chosen,
  onPick,
}: {
  bubble: Bubble;
  room: RoomView;
  /** 보내는 중 — 서버가 받은 말이 아직 안 읽혀 왔다. 흐리게 서고 시각이 안 선다 */
  sending?: boolean;
  pickable: boolean;
  chosen: boolean;
  onPick: () => void;
}) {
  const mine = bubble.mine;
  /*
    내 말 = 내 일간 오행의 진한 색 면 + 그 파스텔 글자(한 벌의 두 끝이라 대비 5.6:1 이상, 어두운 화면에서 뒤집힌다).
    상대 말 = 상대 일간의 파스텔 + 본문색. 모르면 먹색 · 회색 한 벌 — 위 머리말
  */
  const tone = mine
    ? room.tones === null
      ? 'bg-accent text-on-accent'
      : `${elementScope(room.tones.mine.element)} bg-[var(--ink)] text-[var(--tile)]`
    : room.tones === null
      ? `${elementScope(null)} bg-[var(--tile)] text-foreground ring-1 ring-border`
      : `${elementScope(room.tones.theirs.element)} bg-[var(--tile)] text-foreground`;
  /* 묶음의 첫 말은 머리 쪽 모서리만 뾰족하다 — 누가 말을 시작했는지 모양으로 읽힌다 */
  const corner = bubble.first ? (mine ? 'rounded-tr-md' : 'rounded-tl-md') : '';

  return (
    <li
      {...{ [MESSAGE_ID]: bubble.id, ...(mine ? {} : { [THEIR_SEQ]: bubble.seq }) }}
      aria-busy={sending || undefined}
      className={`flex min-w-0 gap-2 transition-opacity ${sending ? 'opacity-55' : ''} ${mine ? 'justify-end' : 'justify-start'} ${bubble.first ? 'mt-2 first:mt-0' : ''}`}
    >
      {!mine &&
        (bubble.first ? (
          <span className="shrink-0 self-start">
            <Avatar
              userId={room.partnerUserId ?? ''}
              nickname={room.name}
              hasPhoto={room.partnerHasPhoto}
              size={36}
              tone={room.tones?.theirs.element ?? null}
            />
          </span>
        ) : (
          <span aria-hidden="true" className="w-9 shrink-0" />
        ))}
      <div className={`flex min-w-0 max-w-[80%] items-end gap-1.5 sm:max-w-[68%] ${mine ? 'flex-row-reverse' : ''}`}>
        <p
          className={`${tone} ${corner} min-w-0 whitespace-pre-wrap break-words rounded-[1.25rem] px-4 py-2.5 text-[15px] leading-[1.55] ${
            chosen ? 'outline-[3px] outline-offset-2 outline-danger' : ''
          }`}
        >
          {bubble.body}
        </p>
        {pickable ? (
          <button
            type="button"
            onClick={onPick}
            aria-pressed={chosen}
            aria-label="이 메시지 신고"
            className={`grid size-11 shrink-0 place-items-center rounded-full ring-1 active:scale-95 ${
              chosen ? 'bg-danger text-surface ring-danger' : 'bg-surface text-danger ring-danger/45'
            }`}
          >
            <Icon name="flag" className="size-[18px]" />
          </button>
        ) : (
          bubble.last &&
          !sending && (
            <time dateTime={bubble.createdAt} className="shrink-0 pb-0.5 text-[12px] tabular-nums text-secondary">
              {bubble.time}
            </time>
          )
        )}
      </div>
    </li>
  );
}
