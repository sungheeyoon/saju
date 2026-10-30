import type { ReactNode } from 'react';

import { SEND_DROP_LABEL, SEND_FAILED_LABEL, SEND_RETRY_LABEL } from '@/src/lib/chat/copy';

import { elementScope } from '../../../ui/element-tone';
import { Icon } from '../../../ui/icons';
import { useDetailsMenu } from '../../../ui/details-menu';
import { MENU_PANEL } from '../../../ui/surfaces';
import { Avatar } from '../../avatar';
import { partnerSheetName } from '../../partner-sheet';
import type { Bubble } from '@/src/lib/chat/room/bubbles';
import { bodyPartsOf } from '@/src/lib/chat/room/links';
import type { Pending } from '@/src/lib/chat/room/pending';
import type { RoomView } from './room-view';
import { THEIR_SEQ } from './use-read-marker';
import { MESSAGE_ID } from './use-scroll-keeper';

/**
 * 대화 칸의 말풍선 한 줄 — 말풍선 · 상대 얼굴 · 시각, 그리고 못 보낸 말이면 그 자리의 단추. 신고할 말은 신고 창 안에서
 * 고른다(G-97, 2026-10-18) — 말풍선 곁에 깃발이 서지 않는다.
 */
export function BubbleRow({
  bubble,
  room,
  sending = null,
  onRetry = null,
  onDrop = null,
  onFace = null,
}: {
  bubble: Bubble;
  room: RoomView;
  /**
   * 아직 안 읽혀 온 내 말의 상태 — 읽혀 온 말은 `null`. 모양은 확정된 말과 같다(흐리지 않다). 보내는 중이면 시각 자리가 비고,
   * 서버가 받았으면 보낸 시각이 서고, 못 보냈으면 그 자리에 실패 단추가 선다(ADR 0155 덧)
   */
  sending?: Pending['state'] | null;
  /** 실패한 말을 같은 id 로 다시 보낸다 — 닫힌 방에서 서버에 간 적 없는 말은 `null` */
  onRetry?: (() => void) | null;
  /** 이 화면에서만 걷는다 — 서버에 간 적이 없다고 분명한 말에만 선다 */
  onDrop?: (() => void) | null;
  /** 곁 사진을 누르면 상대 프로필 시트 — 닫힌 방은 `null`(누를 자리가 없다) */
  onFace?: (() => void) | null;
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

  /* 말풍선과 그 곁(시각 · 못 보낸 말의 단추) — 내 말은 오른쪽으로, 상대 말은 이름 아래로 선다 */
  const line = (
    <div className={`flex min-w-0 max-w-[80%] items-end gap-1.5 sm:max-w-[68%] ${mine ? 'flex-row-reverse' : ''}`}>
      <p className={`${tone} ${corner} min-w-0 whitespace-pre-wrap break-words rounded-card px-4 py-2.5 text-body leading-[1.55]`}>
        <BubbleBody body={bubble.body} />
      </p>
      {sending === 'failed' ? (
        <SendFailedMenu onRetry={onRetry} onDrop={onDrop} />
      ) : (
        bubble.last &&
        sending !== 'sending' && (
          <time dateTime={bubble.createdAt} className="shrink-0 pb-0.5 text-fine tabular-nums text-secondary">
            {bubble.time}
          </time>
        )
      )}
    </div>
  );

  return (
    <li
      {...{ [MESSAGE_ID]: bubble.id, ...(mine ? {} : { [THEIR_SEQ]: bubble.seq }) }}
      aria-busy={sending === 'sending' || undefined}
      className={`flex min-w-0 gap-2 ${mine ? 'justify-end' : 'justify-start'} ${bubble.first ? 'mt-2 first:mt-0' : ''}`}
    >
      {!mine &&
        (bubble.first ? (
          <BubbleFace onFace={onFace} name={room.name}>
            <Avatar
              userId={room.partnerUserId ?? ''}
              nickname={room.name}
              hasPhoto={room.partnerHasPhoto}
              focus={room.partnerPhotoFocus}
              size={36}
              tone={room.tones?.theirs.element ?? null}
            />
          </BubbleFace>
        ) : (
          <span aria-hidden="true" className="w-9 shrink-0" />
        ))}
      {mine ? (
        line
      ) : (
        /*
          상대 묶음의 첫 말 위에는 이름이 선다(카카오톡 · 위피의 방 — 얼굴 곁 이름, 2026-10-24). 얼굴만으로는 누구의 말인지 읽을
          자리가 없었다 — 보조기기는 이름 없이 말만 읽었다
        */
        <div className="flex min-w-0 flex-1 flex-col gap-1">
          {bubble.first && <p className="truncate px-1 text-fine font-medium text-secondary">{room.name}</p>}
          {line}
        </div>
      )}
    </li>
  );
}

/**
 * 상대 말풍선 곁의 얼굴 — 열린 방이면 누르는 단추(상대 프로필 시트), 닫힌 방이면 그림만. 단추는 보이는 36px 둘레로 4px 씩
 * 누를 자리를 넓혀 44px 이다(자리는 그대로 — 음의 여백이 메운다).
 */
function BubbleFace({ onFace, name, children }: { onFace: (() => void) | null; name: string; children: ReactNode }) {
  if (onFace === null) return <span className="shrink-0 self-start">{children}</span>;
  return (
    <button
      type="button"
      aria-haspopup="dialog"
      aria-label={partnerSheetName(name)}
      onClick={onFace}
      className="-m-1 shrink-0 self-start rounded-full p-1 active:scale-95"
    >
      {children}
    </button>
  );
}

/**
 * 말풍선의 본문 — 글은 글자 그대로 서고 `http(s)://` 주소만 링크다(`links.ts`). 새 탭으로 열고, 이 화면을 넘기지 않으며
 * (`noopener noreferrer`) 검색 엔진에 보증하지 않는다(`nofollow`). 글자 색은 말풍선의 것을 그대로 입고 밑줄로 갈린다.
 */
function BubbleBody({ body }: { body: string }) {
  return bodyPartsOf(body).map((part, index) =>
    part.kind === 'text' ? (
      part.text
    ) : (
      <a
        key={index}
        href={part.href}
        target="_blank"
        rel="noopener noreferrer nofollow"
        className="underline decoration-1 underline-offset-2 [overflow-wrap:anywhere]"
      >
        {part.text}
      </a>
    ),
  );
}

/**
 * 못 보낸 말 곁의 단추 — 빨간 경고 하나(44px)이고, 누르면 「다시 보내기」 · 「삭제」가 선다(카카오톡의 방식, ADR 0155 덧).
 * 다시 보내기는 같은 id 로 보내므로 서버가 실은 받았던 말이어도 두 번 남지 않는다. 삭제는 이 화면에서만 걷으므로 서버가
 * 분명히 거절한 말(한도 · 닫힘 · 문장 있는 거절)에만 선다 — 떠났는데 답을 못 받은 말(시한 · 망 끊김)은 서버에 남았을 수 있어
 * 다시 보내기만 선다. 닫힌 방에서 거절된 말은 삭제만 선다.
 *
 * 말풍선은 대화 칸의 아래쪽에 서므로 판은 단추 위로 연다.
 */
function SendFailedMenu({ onRetry, onDrop }: { onRetry: (() => void) | null; onDrop: (() => void) | null }) {
  const { menu, close } = useDetailsMenu();
  const item = 'flex min-h-11 w-full items-center gap-2.5 rounded-cell px-3 text-left text-body font-semibold hover:bg-surface-soft active:bg-surface-sunken';
  return (
    <details ref={menu} className="relative shrink-0 self-end">
      <summary
        aria-label={SEND_FAILED_LABEL}
        className="grid size-11 cursor-pointer list-none place-items-center rounded-full text-danger hover:bg-surface-soft active:scale-95 [&::-webkit-details-marker]:hidden"
      >
        <Icon name="alert" className="size-[22px]" />
      </summary>
      <div className={`${MENU_PANEL} absolute bottom-12 right-0 z-20 flex w-40 flex-col p-1.5`}>
        {onRetry !== null && (
          <button
            type="button"
            className={`${item} text-foreground`}
            onClick={() => {
              close();
              onRetry();
            }}
          >
            <Icon name="send" className="size-[18px]" />
            {SEND_RETRY_LABEL}
          </button>
        )}
        {onDrop !== null && (
          <button
            type="button"
            className={`${item} text-danger`}
            onClick={() => {
              close();
              onDrop();
            }}
          >
            <Icon name="close" className="size-[18px]" />
            {SEND_DROP_LABEL}
          </button>
        )}
      </div>
    </details>
  );
}
