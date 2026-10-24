import Link from 'next/link';

import { activityText, type ActivityBand } from '@/src/lib/presence';
import type { Element } from '@/src/lib/saju';

import { ICON_BUTTON_GHOST } from '../../../ui/buttons';
import { Icon } from '../../../ui/icons';
import { Avatar } from '../../avatar';
import { partnerSheetName } from '../../partner-sheet';
import { ReportBlockMenu } from '../../requests/report-block';
import { CompatChip } from './compat-chip';
import type { RoomView } from './room-view';

/**
 * 방의 머리 — 목록으로 · 상대(사진 · 이름 · 접속 상태) · 궁합 단추 · 「⋯」(내 프로필 · 신고 · 차단).
 *
 * 제목은 메신저의 방 머리 크기다(카카오톡 · 위피 — 17px 안팎의 굵은 한 줄, 2026-10-24). 화면 제목 크기(`text-heading`)였을 때는
 * 이름이 머리를 채워 궁합 단추 · 「⋯」와 겨뤘다.
 */
export function RoomHeader({
  room,
  partnerOpens,
  onOpenPartner,
  onOpenMe,
  matchLink,
  chipTone,
  onReport,
  onBlock,
}: {
  room: RoomView;
  /** 상대 프로필 시트가 열리는 방인가 — 상대가 있고 열린 방 */
  partnerOpens: boolean;
  onOpenPartner: () => void;
  /** 내 프로필 시트 — 「⋯」 맨 위 「내 프로필」. 못 여는 방은 `null` */
  onOpenMe: (() => void) | null;
  /** 인연 궁합으로 가는 길 — 상대가 있는 열린 방에만 */
  matchLink: string | null;
  chipTone: Element | null;
  onReport: () => void;
  onBlock: () => void;
}) {
  const closed = room.notice !== null;
  const hasPartner = room.partnerUserId !== null;
  const theirTone = room.tones?.theirs.element ?? null;
  return (
    <header className="flex items-center gap-2 border-b border-border px-2.5 py-2.5 sm:gap-3 sm:px-4">
      <Link href="/me/chat" aria-label="대화방 목록" className={`${ICON_BUTTON_GHOST} lg:hidden`}>
        <Icon name="back" />
      </Link>
      {/*
        **사진 · 이름을 누르면 상대 프로필 시트다**(카카오톡의 프로필, 운영자 결정 2026-10-11 — ADR 0155 덧이 인연 궁합에서 바꿨다).
        인연 궁합은 그 시트의 단추다. 이름의 단추가 사진까지 덮는다(`after:inset-0`) — 누를 자리는 하나다. 이름 곁의 「›」가
        누를 수 있다는 단서다(글자 없이). 상대가 있고 열린 방에만 선다.
      */}
      <div className="relative flex min-w-0 flex-1 items-center gap-2 sm:gap-3">
        <span className={closed ? 'opacity-60 grayscale' : ''}>
          <Avatar userId={room.partnerUserId ?? ''} nickname={room.name} hasPhoto={room.partnerHasPhoto}
            focus={room.partnerPhotoFocus} size={44} tone={theirTone} />
        </span>
        <div className="min-w-0 flex-1">
          {/* 상대가 떠났으면 닉네임 자리에 「탈퇴한 사용자」가 선다(PRD 「계정이 멈추는 자리」, ADR 0094) */}
          <h1 className="truncate font-rounded text-lead leading-6 text-foreground">
            {partnerOpens ? (
              <button
                type="button"
                aria-haspopup="dialog"
                aria-label={partnerSheetName(room.name)}
                onClick={onOpenPartner}
                className="inline-flex max-w-full items-center gap-0.5 text-left after:absolute after:inset-0 after:rounded-2xl"
              >
                <span className="truncate">{room.heading}</span>
                <Icon name="chevron" className="size-4 text-secondary" />
              </button>
            ) : (
              room.heading
            )}
          </h1>
          {/* 접속 상태는 구간 하나다 — 열린 방에만 오고, 시각은 오지 않는다(PRD 「접속 상태」, ADR 0092) */}
          {room.activity !== null && <Activity band={room.activity} />}
        </div>
      </div>
      {/*
        **궁합 단추는 상태를 든다 — 폰에도 선다**(운영자 2026-10-11 저녁, ADR 0155 「2026-10-11 저녁 덧」). 수락하면 방으로 오고
        궁합풀이는 그동안 만들어진다 — 대화가 중심이고 생성 상태는 이 단추 하나가 작게 든다. 끝나면 채널이 방을 다시 그려 점수로
        바뀐다(`room-compat.ts`). 닫힌 방에는 안 선다: 차단 · 정지 · 탈퇴 신청으로 닫히면 인연 궁합도 그 쌍에게 닫힌다
        (`visible_matches()`) — 누르면 없는 화면이다.
      */}
      {matchLink !== null && <CompatChip compat={room.compat ?? { kind: 'quiet' }} href={matchLink} tone={chipTone} />}
      {hasPartner && (
        <ReportBlockMenu
          canBlock={!closed}
          onReport={onReport}
          onBlock={onBlock}
          onMyProfile={onOpenMe ?? undefined}
        />
      )}
    </header>
  );
}

function Activity({ band }: { band: ActivityBand }) {
  /* 점은 꾸밈이다 — 뜻은 곁의 글자가 든다(색만으로 말하지 않는다) */
  const dot = band === 'now' ? 'bg-success' : band === 'day' ? 'bg-success/40' : 'ring-1 ring-border-strong';
  return (
    <p className="flex items-center gap-1.5 text-fine font-medium text-secondary">
      <span aria-hidden="true" className={`size-2 shrink-0 rounded-full ${dot}`} />
      {activityText(band)}
    </p>
  );
}
