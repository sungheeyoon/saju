'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useRef, useState, useTransition } from 'react';

import { BLOCK_NOTE } from '@/src/lib/consent';
import { activityText, type ActivityBand } from '@/src/lib/presence';
import { ELEMENT_KO, STEM_INFO, type Stem } from '@/src/lib/saju';

import { elementScope } from '../../../element-tone';
import {
  BUTTON_DANGER,
  BUTTON_SECONDARY,
  BUTTON_SECONDARY_SMALL,
} from '../../../ui/buttons';
import { ElementSymbol } from '../../../ui/element-symbol';
import { Icon } from '../../../ui/icons';
import { TYPE_META } from '../../../ui/surfaces';
import { Avatar } from '../../avatar';
import { DayMasterChip } from '../../people/chart-bits';
import { blockUser } from '../../requests/actions';
import { ChatIcon } from '../chat-icon';
import { Composer, ReadOnVisit } from '../composer';
import type { RoomTones } from '../tones';
import type { Bubble, BubbleDay } from './bubbles';
import { ReportPanel } from './report';
import styles from './room.module.css';

/**
 * 방 안에서 사람이 서는 모양 — 서버가 다 지어서 넘긴다(시각 글자 · 묶음 · 닫힌 까닭).
 */
export type RoomView = {
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
  readonly days: readonly BubbleDay[];
  /** 읽는 문이 준 것이 방의 처음부터다(200건 아래) — 그때만 첫머리를 세운다 */
  readonly fromBeginning: boolean;
  /** 두 사람의 일간 — 함께 보는 궁합이 연 값이 있을 때만(`roomTonesForViewer`). 없으면 중립 색이다 */
  readonly tones: RoomTones | null;
};

/**
 * 상대의 파스텔을 입은 알약 — 원본 시안의 궁합 알약이다. 보조 단추와 같은 44px · 같은 글자 크기이고, 면과 글자가
 * 한 오행 한 벌이라(글자 `--ink` · 면 `--tile`, 대비 5.6:1 이상) 어느 오행이어도 읽힌다.
 */
const TONED_PILL =
  'inline-flex min-h-11 items-center justify-center gap-1.5 rounded-full bg-[var(--tile)] px-4 text-sm font-semibold text-[var(--ink)] ring-1 ring-[color-mix(in_srgb,var(--ink)_18%,transparent)] hover:ring-[var(--ink)] active:scale-[0.97]';

/** 머리의 아이콘 단추 — 판 위에 테 없이 선다. 누를 자리는 44px 그대로다 */
const GHOST_ICON =
  'grid size-11 shrink-0 place-items-center rounded-full text-foreground hover:bg-surface-soft active:scale-95';

type Slot = { kind: 'compose' } | { kind: 'block' } | { kind: 'report'; messageId: string | null };

/**
 * **방 하나 — 머리와 입력이 붙어 있고 대화만 스크롤한다.**
 *
 * 폰에서 대화가 길면 입력칸까지 스크롤해야 했다. 이제 방이 화면 높이의 판이고, 그 안에서 대화 칸만
 * 움직인다. 대화 칸은 거꾸로 쌓는다(`flex-col-reverse`) — 스크롤의 시작점이 맨 아래라 들어오면 가장
 * 최근 말이 먼저 보이고, 보낸 뒤 다시 읽어도 그 자리에 남는다.
 *
 * **대화가 두 사람의 색으로 짜인다** — 내 말은 내 일간 오행의 진한 색으로 채우고, 상대 말은 상대 일간
 * 오행의 파스텔을 입는다(홈의 「사람 한 명 = 그 오행의 파스텔 한 장」을 대화로 옮겼다). 색은 함께 보는 궁합이
 * 이미 연 두 일간에서만 온다(`tones.ts`). 그 값이 없는 방(닫힌 방 · 떠난 상대 · 옛 Match)은 내 말이 먹색,
 * 상대 말이 회색 한 벌이다 — 지어낸 색은 그 사람에 대해 거짓을 말한다.
 *
 * 신고 · 차단은 머리의 「⋯」 안에 있다 — 말풍선마다 「신고」가 서 있으면 대화가 신고 목록처럼 읽힌다.
 * 신고는 고르는 걸음이 있어(PRD §7.1) 누르면 상대 말풍선 곁에 깃발이 서고, 하나를 고르면 입력 자리에
 * 사유 칸이 선다. 차단은 입력 자리에 알림 글과 확인 단추가 선다.
 */
export function ChatRoomView({ room }: { room: RoomView }) {
  const [slot, setSlot] = useState<Slot>({ kind: 'compose' });
  const [reported, setReported] = useState(false);
  const closed = room.notice !== null;
  const hasPartner = room.partnerUserId !== null;
  const picking = slot.kind === 'report';
  const picked = slot.kind === 'report' ? slot.messageId : null;
  const theirTone = room.tones?.theirs.element ?? null;

  return (
    <section
      aria-label={room.heading}
      className={`${styles.room} flex min-w-0 flex-col lg:flex-1 overflow-hidden rounded-[1.75rem] bg-surface ring-1 ring-border lg:rounded-[2rem]`}
    >
      {/* 들어오면 읽은 것으로 남긴다 — 신고 · 차단 칸이 입력 자리를 차지해도 읽음은 그대로다 */}
      {!closed && <ReadOnVisit matchId={room.matchId} unread={room.unread} />}
      <header className="flex items-center gap-2 border-b border-border px-2.5 py-2.5 sm:gap-3 sm:px-4">
        <Link href="/me/chat" aria-label="대화방 목록" className={`${GHOST_ICON} lg:hidden`}>
          <Icon name="back" />
        </Link>
        <span className={closed ? 'opacity-60 grayscale' : ''}>
          <Avatar userId={room.partnerUserId ?? ''} nickname={room.name} hasPhoto={room.partnerHasPhoto} size={44} tone={theirTone} />
        </span>
        <div className="min-w-0 flex-1">
          {/* 상대가 떠났으면 닉네임 자리에 「탈퇴한 사용자」가 선다(PRD §5.3, ADR 0094) */}
          <h1 className="truncate font-rounded text-[1.25rem] leading-7 text-foreground">{room.heading}</h1>
          {/* 접속 상태는 구간 하나다 — 열린 방에만 오고, 시각은 오지 않는다(PRD §7.2, ADR 0092) */}
          {room.activity !== null && <Activity band={room.activity} />}
        </div>
        {/*
          폰에서는 이름에 자리를 준다 — 같은 길이 대화의 첫머리에 있다. 닫힌 방에는 안 선다: 차단 · 정지 · 탈퇴 신청으로
          닫히면 함께 보는 궁합도 그 쌍에게 닫힌다(`visible_matches()`) — 누르면 없는 화면이다.
        */}
        {hasPartner && !closed && (
          <span className="hidden shrink-0 sm:block">
            <Link href={`/me/match/${room.matchId}`} className={room.tones === null ? BUTTON_SECONDARY_SMALL : `${elementScope(theirTone)} ${TONED_PILL}`}>
              <Icon name="heart" className={`size-[18px] ${room.tones === null ? 'text-danger' : ''}`} />
              함께 보는 궁합
            </Link>
          </span>
        )}
        {hasPartner && (
          <RoomMenu
            closed={closed}
            onReport={() => {
              setReported(false);
              setSlot({ kind: 'report', messageId: null });
            }}
            onBlock={() => setSlot({ kind: 'block' })}
          />
        )}
      </header>

      <div role="log" aria-label="메시지" className="flex min-h-0 flex-1 flex-col-reverse overflow-y-auto overscroll-contain">
        <div className="flex flex-col gap-5 px-3 py-5 sm:px-6">
          {room.fromBeginning && <RoomStart room={room} />}
          {room.days.map((day) => (
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
                    /* 신고는 상대의 말에만 선다 — 자기 자신은 신고할 수 없고, 떠난 사람은 신고당할 계정이 없다 */
                    pickable={picking && !bubble.mine && !bubble.fromLeftPartner}
                    chosen={picked === bubble.id}
                    onPick={() => setSlot({ kind: 'report', messageId: bubble.id })}
                  />
                ))}
              </ol>
            </div>
          ))}
        </div>
      </div>

      <div className="flex flex-col gap-2 border-t border-border p-2.5 sm:p-4">
        {reported && slot.kind === 'compose' && (
          <p role="status" className="rounded-[1rem] bg-surface-soft px-4 py-2.5 text-[13px] text-secondary">
            신고를 접수했습니다. 운영자가 확인합니다.
          </p>
        )}
        {/* 차단이 끝나 다시 읽으면 방이 닫혀 있다 — 그때는 확인 칸 대신 닫힌 까닭이 선다 */}
        {slot.kind === 'block' && !closed && room.partnerUserId !== null ? (
          <BlockAsk userId={room.partnerUserId} onCancel={() => setSlot({ kind: 'compose' })} />
        ) : slot.kind === 'report' ? (
          <ReportPanel
            messageId={slot.messageId}
            onCancel={() => setSlot({ kind: 'compose' })}
            onDone={() => {
              setReported(true);
              setSlot({ kind: 'compose' });
            }}
          />
        ) : closed ? (
          /* 닫힌 까닭 한 줄 — 상대가 떠났으면 넷째 줄(PRD §7.1) */
          <p role="status" className="flex items-center gap-2.5 rounded-[1.25rem] bg-surface-soft px-4 py-3 text-[14px] text-secondary">
            <ChatIcon name="lock" className="size-4" />
            {room.notice}
          </p>
        ) : (
          <Composer matchId={room.matchId} />
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

/** 「⋯」 — 신고 · 차단. 닫힌 방은 차단할 것이 없고(이미 끊겼다) 신고만 남는다 */
function RoomMenu({ closed, onReport, onBlock }: { closed: boolean; onReport: () => void; onBlock: () => void }) {
  const [open, setOpen] = useState(false);
  const box = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const outside = (event: PointerEvent) => {
      if (!box.current?.contains(event.target as Node)) setOpen(false);
    };
    const escape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false);
    };
    document.addEventListener('pointerdown', outside);
    document.addEventListener('keydown', escape);
    return () => {
      document.removeEventListener('pointerdown', outside);
      document.removeEventListener('keydown', escape);
    };
  }, [open]);

  const item = 'flex min-h-11 w-full items-center gap-2.5 rounded-xl px-3 text-left text-[15px] font-semibold hover:bg-surface-soft active:bg-surface-sunken';

  return (
    <div ref={box} className="relative shrink-0">
      <button
        type="button"
        aria-label="신고 · 차단"
        aria-expanded={open}
        onClick={() => setOpen((was) => !was)}
        className={GHOST_ICON}
      >
        <ChatIcon name="more" />
      </button>
      {open && (
        <div className="absolute right-0 top-12 z-20 flex w-48 flex-col rounded-[1.25rem] bg-surface p-1.5 shadow-[0_14px_36px_-16px_rgba(60,48,30,0.45)] ring-1 ring-border">
          <button
            type="button"
            className={`${item} text-foreground`}
            onClick={() => {
              setOpen(false);
              onReport();
            }}
          >
            <ChatIcon name="flag" className="size-[18px]" />
            신고
          </button>
          {!closed && (
            <button
              type="button"
              className={`${item} text-danger`}
              onClick={() => {
                setOpen(false);
                onBlock();
              }}
            >
              <ChatIcon name="block" className="size-[18px]" />
              차단
            </button>
          )}
        </div>
      )}
    </div>
  );
}

/**
 * 대화의 첫머리 — 누구와 이야기하는지와 함께 보는 궁합으로 가는 길.
 *
 * 두 일간을 아는 방은 **두 사람의 카드**다: 나와 상대가 제 일간 오행의 파스텔 한 장씩으로 나란히 서고(결과 화면의
 * 「각자의 사주」와 같은 조각 `DayMasterChip`), 아래로 함께 보는 궁합이 이어진다. 「이 사람과 왜 이야기하게
 * 됐나」를 두 색이 되짚는다. 점수 · 궁합 한 줄은 방의 문이 주지 않으므로 싣지 않는다(지어낸 점수는 함께 보는
 * 궁합의 점수와 갈린다). 두 일간을 모르는 방은 상대의 사진과 이름만 선다.
 */
function RoomStart({ room }: { room: RoomView }) {
  const tones = room.tones;
  const toMatch = room.partnerUserId !== null && room.notice === null && (
    <Link href={`/me/match/${room.matchId}`} className={BUTTON_SECONDARY_SMALL}>
      <Icon name="heart" className="size-4 text-danger" />
      함께 보는 궁합
      <Icon name="arrow" className="size-4" />
    </Link>
  );

  if (tones === null) {
    return (
      <div className="flex flex-col items-center gap-3 pb-2 pt-4 text-center">
        <Avatar userId={room.partnerUserId ?? ''} nickname={room.name} hasPhoto={room.partnerHasPhoto} size={72} />
        <p className="font-rounded text-[1.3rem] leading-7 text-foreground">{room.heading}</p>
        {toMatch}
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
    </div>
  );
}

/** 첫머리 카드의 한 사람 — 제 일간 오행의 파스텔 한 장. 색만으로 말하지 않게 딱지(상징 · 글자 · 이름)와 「갑목 일간」이 함께 선다 */
function StartSide({ label, stem }: { label: string; stem: Stem }) {
  const info = STEM_INFO[stem];
  return (
    <section className={`${elementScope(info.element)} relative flex min-w-0 flex-col gap-2 overflow-hidden rounded-[1.5rem] bg-[var(--tile)] p-4`}>
      <ElementSymbol element={info.element} className="pointer-events-none absolute -bottom-4 -right-4 size-20 opacity-20" />
      <DayMasterChip stem={stem} className="relative self-start" />
      <div className="relative min-w-0">
        <p className="truncate font-rounded text-[1.125rem] leading-6 text-foreground">{label}</p>
        <p className={TYPE_META}>
          {info.ko}
          {ELEMENT_KO[info.element]} 일간
        </p>
      </div>
    </section>
  );
}

function BubbleRow({
  bubble,
  room,
  pickable,
  chosen,
  onPick,
}: {
  bubble: Bubble;
  room: RoomView;
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
    <li className={`flex min-w-0 gap-2 ${mine ? 'justify-end' : 'justify-start'} ${bubble.first ? 'mt-2 first:mt-0' : ''}`}>
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
            <ChatIcon name="flag" className="size-[18px]" />
          </button>
        ) : (
          bubble.last && (
            <time dateTime={bubble.createdAt} className="shrink-0 pb-0.5 text-[12px] tabular-nums text-secondary">
              {bubble.time}
            </time>
          )
        )}
      </div>
    </li>
  );
}

/** 차단 — 두 걸음: 알림 글과 확인 단추. 되돌릴 수 없어서 위험 색의 주 단추다 */
function BlockAsk({ userId, onCancel }: { userId: string; onCancel: () => void }) {
  const router = useRouter();
  const [failure, setFailure] = useState<string | null>(null);
  const [working, startWorking] = useTransition();

  const block = () => {
    setFailure(null);
    startWorking(async () => {
      const result = await blockUser(userId);
      // 방이 닫혔다 — 다시 읽으면 입력 자리에 닫힌 까닭이 선다.
      if (result.ok) {
        router.refresh();
      } else {
        setFailure(result.message);
      }
    });
  };

  return (
    <div className="flex flex-col gap-3 rounded-[1.5rem] bg-danger-wash p-4 ring-1 ring-danger/30">
      <p className="flex items-center gap-2 text-[15px] font-bold text-danger">
        <ChatIcon name="block" className="size-[18px]" />
        차단
      </p>
      <p className="text-[14px] leading-6 text-foreground">{BLOCK_NOTE}</p>
      <div className="flex flex-wrap items-center gap-2">
        <button type="button" onClick={block} disabled={working} className={BUTTON_DANGER}>
          {working ? '차단하는 중…' : '차단합니다'}
        </button>
        <button type="button" onClick={onCancel} disabled={working} className={BUTTON_SECONDARY}>
          그만두기
        </button>
        {failure !== null && <span className="text-[13px] text-danger">{failure}</span>}
      </div>
    </div>
  );
}
