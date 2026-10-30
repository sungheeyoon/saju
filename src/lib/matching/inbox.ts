import { balanceLabelOf, balanceShortOf, knownElementsOf } from '../discovery';
import {
  NOTIFICATION_KINDS,
  REQUEST_STATUSES,
  notificationText,
  suppliedText,
  type NotificationKind,
  type RequestDirection,
  type RequestStatus,
} from '../consent';
import type { RpcRow } from '../db';
import { leadFocusOf, type PhotoFocus } from '../profile';
import { READING_KINDS, type ReadingKind } from '../reading';
import type { Element } from '../saju';

import { photosFromFocus } from './cards';
import { withFrom } from './history';

/**
 * **요청 · Match · 소식의 행을 도메인 말로 옮기는 자리** — 웹(`app/me/requests/inbox.ts`)과 앱이 함께 쓴다.
 * 자를 것을 고르는 판단이 없다 — 그 문이 내주는 것이 곧 볼 수 있는 것이다. 여기서 하는 일은 말로 옮기는 것뿐이다.
 */

/** `my_match_requests()` 가 내주는 한 줄 — **여기 없는 것이 안 나가는 것이다** */
/** 문 셋이 내주는 한 줄 — **칸 이름은 생성 타입이 든다**(ADR 0078) */
type RequestRow = RpcRow<'my_match_requests'>;

type MatchRow = RpcRow<'my_matches'>;

type NotificationRow = RpcRow<'my_notifications'>;

export type InboxRequest = {
  readonly requestId: string;
  readonly direction: RequestDirection;
  /** 차단하는 문이 하나이려면 필요하다 — 후보 카드가 이미 내주는 것과 같은 값이다 */
  readonly counterpartUserId: string;
  readonly nickname: string;
  readonly intro: string | null;
  readonly hasPhoto: boolean;
  /** 대표 사진의 보일 자리(G-98) */
  readonly photoFocus: PhotoFocus;
  /**
   * 상대 프로필 시트(`app/me/partner-sheet.tsx`)가 넘기는 사진 전부와 장마다의 보일 자리 — 답할 요청에만 있다(끝난 줄은 빈 목록).
   * 요청 카드의 머리가 시트를 연다(G-103)
   */
  readonly photoUrls: readonly string[];
  readonly photoFocuses: readonly PhotoFocus[];
  readonly status: RequestStatus;
  /** 상대가 내게 채우는 오행 — **내 자리 기준**이다. 방향은 DB 가 뒤집어 준다 */
  readonly suppliedToMe: string | null;
  /** 내가 상대에게 채우는 오행 */
  readonly suppliedToThem: string | null;
  /** 위 두 문장의 오행 그대로 — 요청 카드가 그림으로 세운다(`app/me/matching/element-exchange.tsx`). 문장은 보조기기 이름이 된다 */
  readonly elementsToMe: readonly Element[];
  readonly elementsToThem: readonly Element[];
  readonly balanceLabel: string;
  /** 같은 균형의 짧은 꼴 — 주고받기 그림 아래 한 줄 */
  readonly balanceShort: string;
  readonly createdAt: string;
  readonly decidedAt: string | null;
};

export type InboxMatch = {
  readonly matchId: string;
  readonly partnerUserId: string;
  readonly nickname: string;
  readonly intro: string | null;
  readonly hasPhoto: boolean;
  /** 대표 사진의 보일 자리(G-98) */
  readonly photoFocus: PhotoFocus;
  readonly suppliedToMe: string | null;
  /**
   * 위 문장의 오행 그대로 — **값으로 넘긴다**(#849). 보관함의 인연 궁합 줄이 이것으로 기운 그림을 세운다. 앞서는 화면이 기운 이름과
   * 문장 전체를 견줘 늘 맞지 않았고, 그림이 한 번도 서지 않았다. 요청 카드의 `elementsToMe` 와 같은 읽기(`knownElementsOf`)다
   */
  readonly elementsToMe: readonly Element[];
  readonly balanceLabel: string;
  /** 같은 균형의 짧은 꼴 — 보관함 줄의 「받는 기운」 그림 뒤 한 줄(요청 카드와 같은 말, 대장 matching-10) */
  readonly balanceShort: string;
  readonly createdAt: string;
};

export type InboxNotification = {
  readonly notificationId: string;
  /** 사건의 갈래 — 화면이 줄 머리의 그림을 고른다. 문장은 `text` 가 든다 */
  readonly kind: NotificationKind;
  readonly text: string;
  /**
   * 가서 볼 자리 — **요청의 소식과 풀이의 소식(완성 · 실패)에 있다.**
   *
   * 요청은 인연 탭에 산다(ADR 0130) — 소식은 그리로 간다. 풀이는 어느 대상인지 아는 것과
   * **그 자리로 가는 것**이 다른 일이고, 비공개 궁합은 두 사람을 다시 골라야 닿는다. 완성이면 그 글을 보고,
   * 실패면 같은 화면에서 다시 시도한다(ADR 0157). 못 찾으면 `null` — 아무 데도 안 가는 링크를 세우지 않는다.
   */
  readonly href: string | null;
  readonly createdAt: string;
  readonly unread: boolean;
};

export type Inbox = {
  readonly notifications: InboxNotification[];
  readonly unread: number;
};

export type Requests = {
  readonly requests: InboxRequest[];
  readonly blocked: number;
};

export const matchOf = (row: MatchRow): InboxMatch => ({
  matchId: row.match_id,
  partnerUserId: row.partner_user_id,
  nickname: row.partner_nickname ?? '',
  intro: row.partner_intro,
  hasPhoto: row.partner_has_photo === true,
  photoFocus: leadFocusOf(row.partner_photo_focus),
  suppliedToMe: suppliedText(row.supplied_to_me, 'toMe'),
  elementsToMe: knownElementsOf(row.supplied_to_me),
  balanceLabel: balanceLabelOf(row.balance_band),
  balanceShort: balanceShortOf(row.balance_band),
  createdAt: row.created_at,
});

/** 요청에서 난 소식 — 누르면 인연 탭으로 간다. 성립 소식만 그 Match 의 채팅방으로 간다(`destinationFor`) */
const REQUEST_NOTIFICATIONS: readonly NotificationKind[] = [
  'request_received',
  'request_accepted',
  'request_rejected',
  'request_invalidated',
  'request_expired',
];

/**
 * 소식 한 줄이 가리키는 자리.
 *
 * **주소를 지어 내지 않는다.** 대상을 못 알아보면 `null` 이고, 그때 알림은 글자로만
 * 선다 — 눌러도 아무것도 없는 줄을 만들지 않는다.
 *
 * 요청의 소식은 **인연 탭**으로 간다(ADR 0130) — 받은 요청 · 보낸 요청 · 끝난 요청이 거기 산다. **성립 소식만 그 Match 의
 * 채팅방으로 간다**(ADR 0130 「2026-10-11 저녁」) — 수락한 쪽이 도착한 그 방이다. 소식 줄의 Match 는 지금 볼 수 있는 것뿐이고
 * (`visible_notifications` 가 `visible_matches` 로 거른다) 열린 Match 에는 방이 늘 서 있어(ADR 0091) 이 링크는 404 로 떨어지지
 * 않는다. Match 가 없는 옛 줄은 인연 탭이다. 인연 궁합의 완성 소식은 그 결과 화면이다.
 */
function destinationFor(
  kind: NotificationKind,
  readingKind: ReadingKind | null,
  row: NotificationRow,
): string | null {
  if (kind === 'request_accepted' && row.match_id !== null) {
    return `/me/chat/${row.match_id}`;
  }
  if (REQUEST_NOTIFICATIONS.includes(kind)) return '/me/matching';
  /* 무상 풀이권의 지급 · 회수는 풀이권 화면으로 — 바뀐 잔액이 거기 선다 */
  if (kind === 'credits_granted' || kind === 'credits_revoked') return '/me/credits';
  if (kind !== 'reading_failed' && kind !== 'reading_ready') return null;

  /*
    인연 궁합의 완성 소식(두 사람 다)은 시도를 안 가리켜 `readingKind` 가 없다 — Match 가 곧 대상이다.
  */
  const matchReady = kind === 'reading_ready' && readingKind === null;
  const result = resultOf(matchReady ? 'match' : readingKind, row);
  /* 소식에서 연 결과의 ← 는 소식으로, 불은 종에 선다(ADR 0134) */
  return result === null ? null : withFrom(result, 'news');
}

function resultOf(readingKind: ReadingKind | null, row: NotificationRow): string | null {
  if (readingKind === 'self') return '/me/readings/self';
  /* 저장한 사람의 풀이는 그 사람의 풀이 화면에서 다시 누른다 */
  if (readingKind === 'person') {
    return row.reading_person_a === null ? null : `/me/readings/${row.reading_person_a}`;
  }
  if (readingKind === 'match') {
    return row.match_id === null ? null : `/me/match/${row.match_id}`;
  }
  if (readingKind === 'private') {
    if (row.reading_person_a === null || row.reading_person_b === null) return null;
    return `/me/compat?a=${row.reading_person_a}&b=${row.reading_person_b}`;
  }

  return null;
}

/** 요청 한 줄을 도메인 말로 — 모르는 상태는 그리지 않는다 */
export function requestOf(row: RequestRow): InboxRequest[] {
  const status = REQUEST_STATUSES.find((known) => known === row.status);
  // 모르는 상태는 그리지 않는다. 「알 수 없음」으로 세워 두면 사용자가 그 카드로
  // 무엇을 할 수 있는지 알 수 없다.
  if (status === undefined) return [];
  const photos = photosFromFocus(row.counterpart_user_id, row.counterpart_photo_focus, row.counterpart_has_photo === true);

  return [
    {
      requestId: row.request_id,
      direction: row.direction === 'sent' ? ('sent' as const) : ('received' as const),
      counterpartUserId: row.counterpart_user_id,
      nickname: row.counterpart_nickname ?? '',
      intro: row.counterpart_intro,
      hasPhoto: row.counterpart_has_photo === true,
      photoFocus: leadFocusOf(row.counterpart_photo_focus),
      photoUrls: photos.photoUrls,
      photoFocuses: photos.photoFocus,
      status,
      suppliedToMe: suppliedText(row.supplied_to_me, 'toMe'),
      suppliedToThem: suppliedText(row.supplied_to_them, 'toThem'),
      elementsToMe: knownElementsOf(row.supplied_to_me),
      elementsToThem: knownElementsOf(row.supplied_to_them),
      balanceLabel: balanceLabelOf(row.balance_band),
      balanceShort: balanceShortOf(row.balance_band),
      createdAt: row.created_at,
      decidedAt: row.decided_at,
    },
  ];
}

/** 소식 한 줄을 도메인 말로 */
export function notificationOf(row: NotificationRow): InboxNotification[] {
  const kind = NOTIFICATION_KINDS.find((known) => known === row.kind);
  if (kind === undefined) return [];

  const readingKind = READING_KINDS.find((known) => known === row.reading_kind) ?? null;
  const href = destinationFor(kind as NotificationKind, readingKind, row);

  return [
    {
      notificationId: row.notification_id,
      kind: kind as NotificationKind,
      // **문장은 DB 가 저장하지 않는다.** 사건과 상대만 오고 말은 정책이 짓는다.
      text: notificationText({
        kind: kind as NotificationKind,
        nickname: row.counterpart_nickname,
        readingKind,
        /* 앱이 DB 보다 먼저 나가면 두 칸이 안 온다 — 그때는 이름 없는 문장이다 */
        readingLabels: [row.reading_label_a ?? null, row.reading_label_b ?? null],
        tappable: href !== null,
        /* 앱이 DB 보다 먼저 나가면 두 칸이 안 온다 — 그때는 수량 · 갈래 없는 문장이다 */
        credits: { count: row.credit_count ?? null, reason: row.credit_reason ?? null },
      }),
      href,
      createdAt: row.created_at,
      unread: row.read_at === null,
    },
  ];
}

