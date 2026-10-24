'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { MY_PROFILE_EDIT_LABEL, NEW_MESSAGES_LABEL, OLDER_LOADING_LABEL, OLDER_MESSAGES_LABEL } from '@/src/lib/chat/copy';

import { withCameFrom } from '../../../came-from';
import { BUTTON_SECONDARY_SMALL } from '../../../ui/buttons';
import { Icon } from '../../../ui/icons';
import { PartnerSheet, usePartnerSheet, type PartnerProfile } from '../../partner-sheet';
import { BlockDialog, ReportBlockMenu, ReportDialog } from '../../requests/report-block';
import { reportChatMessage } from '../actions';
import { Composer } from '../composer';
import { dropDraft } from '../draft';
import { droppable, withPending } from './pending';
import { bubbleDaysOf, reportableOf, type ShownMessage } from './bubbles';
import { BubbleRow } from './bubble-row';
import { CompatChip } from './compat-chip';
import { RoomHeader } from './room-header';
import { RoomStart } from './room-start';
import type { RoomView } from './room-view';
import styles from './room.module.css';
import { readAlready, readsNow } from './thread';
import { useReadMarker } from './use-read-marker';
import { useOutbox } from './use-outbox';
import { useRoomHeight } from './use-room-height';
import { useScrollKeeper } from './use-scroll-keeper';
import { useThread, type MergeKind } from './use-thread';

/** 방 위에 선 창 — 신고 창이나 차단을 묻는 창. 입력 자리는 그대로 남는다 */
type Opened = 'report' | 'block' | null;

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
 * 오늘의 인연 카드와 같은 「⋯」다(`ReportBlockMenu`, ADR 0158). **둘 다 창이다**(G-97, 2026-10-18) — 입력 자리를 판으로
 * 바꾸지 않아 쓰던 글이 그대로다. 신고 창은 사유 칸이 곧장 서고, 그 안에 상대의 말이 최근 것부터 줄로 선다 — 하나를 고르면
 * 메시지 신고(`report_chat_message` — 앞뒤 문맥 스냅샷), 안 고르면 사람 신고다. 차단은 다른 자리와 같은 차단 창이다.
 */
export function ChatRoomView({ room }: { room: RoomView }) {
  const router = useRouter();
  const frame = useRef<HTMLElement>(null);
  useRoomHeight(frame);
  const [opened, setOpened] = useState<Opened>(null);
  const closed = room.notice !== null;
  const hasPartner = room.partnerUserId !== null;
  const theirTone = room.tones?.theirs.element ?? null;
  /*
    **상대 프로필 시트** — 머리의 사진 · 이름과 상대 말풍선 곁 사진이 연다(운영자 결정 2026-10-11, ADR 0155 덧). 시트라 방의
    스크롤 자리 · 더 불러 둔 이전 말 · 쓰던 글이 그대로다. 닫힌 방(차단 · 정지 · 탈퇴 · 떠난 상대)은 열지 않고 누를 단서도 없다
  */
  const profile = usePartnerSheet();
  const partner: PartnerProfile | null =
    room.partnerUserId !== null && !closed
      ? {
          userId: room.partnerUserId,
          nickname: room.name,
          intro: room.partnerIntro,
          photoUrls: room.partnerPhotoUrls,
          photoFocus: room.partnerPhotoFocuses,
          tone: theirTone,
        }
      : null;
  const openPartner = profile.open;
  /*
    **내 프로필 시트** — 상대가 이 방에서 내 얼굴을 누르면 보는 것과 같은 판에 내 지금 사진 · 소개를 싣는다(카카오톡 채팅방 서랍의
    「대화상대 — 나」, 2026-10-24). 머리의 「⋯」 맨 위 「내 프로필」과 첫머리의 「나」 카드가 연다. 궁합 단추 자리에 프로필 편집으로
    가는 단추가 서고, 신고 · 차단은 없다. 사진을 못 읽은 방(`room.me` 가 `null`)에는 이 길이 안 선다
  */
  const myself = usePartnerSheet();
  const me: PartnerProfile | null =
    room.me === null
      ? null
      : {
          userId: room.me.userId,
          nickname: room.me.nickname,
          intro: room.me.intro,
          photoUrls: room.me.photoUrls,
          photoFocus: room.me.photoFocus,
          tone: room.tones?.mine.element ?? null,
        };
  const openMe = me === null ? null : myself.open;
  /* 인연 궁합으로 가는 길 — 상대가 있는 열린 방에만. 머리와 시트의 궁합 단추가 같은 곳 · 같은 상태다 */
  const matchLink = hasPartner && !closed ? withCameFrom(`/me/match/${room.matchId}`, 'chat') : null;
  const chipTone = room.tones === null ? null : theirTone;
  /* 닫힌 방에는 쓸 칸이 없다 — 쓰다 만 글도 탭에서 걷는다(`draft.ts`) */
  useEffect(() => {
    if (closed) dropDraft(() => sessionStorage, room.matchId);
  }, [closed, room.matchId]);

  /* 메시지는 방이 든다 — 서버의 첫 200건에서 시작해 채널이 알릴 때마다 합친다(ADR 0155) */
  /* 방이 합치기 직전에 스크롤 자리를 재는 손 — 스크롤 자리는 합쳐진 메시지를 보고 지키므로 손을 뒤에서 잇는다 */
  const measure = useRef<(kind: MergeKind, incoming: readonly ShownMessage[]) => void>(() => {});
  const thread = useThread(room.matchId, room.messages, room.fromBeginning, (kind, incoming) => measure.current(kind, incoming));
  const { log, fresh, beforeMerge, toBottom, onScroll } = useScrollKeeper(thread.messages);
  useEffect(() => {
    measure.current = beforeMerge;
  }, [beforeMerge]);
  /*
    **보내는 중인 내 말** — 누르는 순간 확정된 말과 같은 모양으로 서고, 읽혀 온 진짜 말이 그 자리를 잇는다. 못 보냈으면 제자리에
    실패로 남는다(`pending.ts`, ADR 0155 덧). 읽음 · 스크롤 자리는 진짜 말만 본다 — 보내는 중인 말은 그리는 목록에만 붙는다.
    서버가 받았으면 읽는 문으로 읽어 합치고, 방이 닫혔으면 다시 그려 닫힌 까닭을 세운다.
  */
  const { catchUp } = thread;
  const refresh = useCallback(() => router.refresh(), [router]);
  const outbox = useOutbox(room.matchId, thread.messages, catchUp, refresh);
  const pending = outbox.pending;
  const shown = useMemo(() => withPending(thread.messages, pending), [thread.messages, pending]);
  const pendingById = useMemo(() => new Map(pending.map((one) => [one.id, one])), [pending]);
  const days = useMemo(() => bubbleDaysOf(shown), [shown]);
  /* 신고 창에서 고를 상대의 말 — 보내는 중인 내 말은 들지 않는다 */
  const reportable = useMemo(() => reportableOf(thread.messages), [thread.messages]);
  /* 들어올 때 이미 읽은 차례 — 처음 그린 값으로 한 번 정한다 */
  const [already] = useState(() => readAlready(room.messages, room.unread));
  /*
    신고 · 차단 창이나 상대 프로필 시트가 대화를 덮은 동안은 읽음을 남기지 않는다 — 창 · 시트 뒤에 든 말은 본 것이 아니다. 닫으면
    그때 화면에 든 것으로 다시 잰다. 시트의 「⋯」에서 창으로 넘어갈 때는 창이 먼저 서고 시트가 내려간 뒤 닫혀 틈이 없다
  */
  useReadMarker(log, room.matchId, already, readsNow({ closed, dialogOpen: opened !== null, sheetOpen: profile.shown || myself.shown }), days);

  return (
    <section
      ref={frame}
      aria-label={room.heading}
      data-chat-room
      className={`${styles.room} flex min-w-0 flex-col lg:flex-1 overflow-hidden bg-surface md:rounded-card md:ring-1 md:ring-border lg:rounded-paper`}
    >
      <RoomHeader
        room={room}
        partnerOpens={partner !== null}
        onOpenPartner={openPartner}
        onOpenMe={openMe}
        matchLink={matchLink}
        chipTone={chipTone}
        onReport={() => setOpened('report')}
        onBlock={() => setOpened('block')}
      />

      {/* 읽음은 화면에 들어온 상대 말까지만 남는다 — 신고 · 차단 창이나 프로필 시트가 대화를 덮은 동안은 멈춘다(`useReadMarker`) */}
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
            <RoomStart
              room={room}
              quiet={thread.messages.length === 0 && pending.length === 0}
              onMe={openMe}
              onPartner={partner === null ? null : openPartner}
            />
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
              <p className="mb-2 self-center rounded-full bg-surface-soft px-3 py-1 text-fine font-medium text-secondary">
                {day.label}
              </p>
              <ol className="flex flex-col gap-1">
                {day.bubbles.map((bubble) => {
                  const one = pendingById.get(bubble.id);
                  return (
                    <BubbleRow
                      key={bubble.id}
                      bubble={bubble}
                      room={room}
                      sending={one?.state ?? null}
                      /*
                        닫힌 방에는 다시 보낼 곳이 없다 — 다만 서버에 남았을 수 있는 말은 다시 보내기가 답을 받아 온다(같은 id 가 남았으면
                        「받았다」, 아니면 「닫혔다」). 남았을 수 있는 말에는 「삭제」가 없다 — 지운 말이 상대에게 가면 안 된다
                      */
                      onRetry={closed && one?.mightBeKept !== true ? null : () => outbox.retry(bubble.id)}
                      onDrop={one !== undefined && droppable(one) ? () => outbox.drop(bubble.id) : null}
                      onFace={partner === null ? null : openPartner}
                    />
                  );
                })}
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
        {/* 차단이 끝나 다시 읽으면 방이 닫혀 있다 — 입력 칸 대신 닫힌 까닭이 선다 */}
        {closed ? (
          /* 닫힌 까닭 한 줄 — 상대가 떠났으면 넷째 줄(PRD 「앱 내 채팅」) */
          <p role="status" className="flex items-center gap-2.5 rounded-row bg-surface-soft px-4 py-3 text-note text-secondary">
            <Icon name="lock" className="size-4" />
            {room.notice}
          </p>
        ) : (
          <Composer
            matchId={room.matchId}
            said={outbox.said}
            onSend={(body) => {
              // 보낸 사람은 제 말을 곧장 본다 — 맨 아래로 내려가고 말풍선이 선다.
              outbox.send(body);
              toBottom();
            }}
          />
        )}
      </div>
      {partner !== null && (
        <PartnerSheet
          control={profile}
          partner={partner}
          toMatch={
            matchLink === null ? null : <CompatChip compat={room.compat ?? { kind: 'quiet' }} href={matchLink} tone={chipTone} fill />
          }
          /* 시트의 「⋯」는 머리의 것과 같은 길이다 — 시트를 닫고 신고 · 차단 창을 연다 */
          menu={
            <ReportBlockMenu
              canBlock
              onReport={() => {
                profile.close();
                setOpened('report');
              }}
              onBlock={() => {
                profile.close();
                setOpened('block');
              }}
            />
          }
        />
      )}
      {me !== null && (
        <PartnerSheet
          control={myself}
          partner={me}
          toMatch={
            <Link href="/me/profile" className={BUTTON_SECONDARY_SMALL}>
              <Icon name="pencil" className="size-4" />
              {MY_PROFILE_EDIT_LABEL}
            </Link>
          }
        />
      )}
      {room.partnerUserId !== null && (
        <>
          <ReportDialog
            userId={room.partnerUserId}
            nickname={room.name}
            open={opened === 'report'}
            onClose={() => setOpened((now) => (now === 'report' ? null : now))}
            onBlock={closed ? undefined : () => setOpened('block')}
            pick={{ messages: reportable, reportMessage: reportChatMessage }}
          />
          {/* 닫힌 방에는 차단할 것이 없다 — 「⋯」에도 차단이 안 선다 */}
          {!closed && (
            <BlockDialog
              userId={room.partnerUserId}
              nickname={room.name}
              open={opened === 'block'}
              onClose={() => setOpened((now) => (now === 'block' ? null : now))}
            />
          )}
        </>
      )}
    </section>
  );
}
