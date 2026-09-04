import { ELEMENTS, type Element } from '@/src/lib/saju';
import { cardTextFor, type BalanceBand } from '@/src/lib/discovery';
import { READING_KINDS, type ReadingKind } from '@/src/lib/reading';
import {
  NOTIFICATION_KINDS,
  REQUEST_STATUSES,
  notificationText,
  suppliedText,
  type NotificationKind,
  type RequestDirection,
  type RequestStatus,
} from '@/src/lib/consent';

import { supabaseOnServer } from '../../auth/server-client';

/**
 * **요청·Match·알림이 브라우저로 내려가는 유일한 문.**
 *
 * 네 표(`match_request` · `match` · `notification` · `block`) 중 셋은 `authenticated`
 * 에게 한 줄도 열려 있지 않다. 읽는 길은 `definer` 함수뿐이고, **그 함수가 내주는 것이
 * 곧 브라우저가 볼 수 있는 것이다.**
 *
 * 그래서 이 파일에는 자를 것을 고르는 판단이 없다. 판단이 앱에 있으면 그 앱을 건너뛴
 * 경로에서 열린다 — 서버 액션도 RPC 도 주소만 알면 부를 수 있는 자리다.
 * 여기서 하는 일은 **말로 옮기는 것**뿐이다(`candidatesForViewer` 와 같은 규율).
 */

/** `my_match_requests()` 가 내주는 한 줄 — **여기 없는 것이 안 나가는 것이다** */
type RequestRow = {
  request_id: string;
  direction: string;
  counterpart_user_id: string;
  counterpart_nickname: string | null;
  counterpart_intro: string | null;
  counterpart_has_photo: boolean;
  status: string;
  supplied_to_me: string[] | null;
  supplied_to_them: string[] | null;
  balance_band: string;
  created_at: string;
  decided_at: string | null;
};

type MatchRow = {
  match_id: string;
  partner_user_id: string;
  partner_nickname: string | null;
  partner_intro: string | null;
  partner_has_photo: boolean;
  supplied_to_me: string[] | null;
  balance_band: string;
  created_at: string;
};

type NotificationRow = {
  notification_id: string;
  kind: string;
  counterpart_nickname: string | null;
  request_id: string | null;
  match_id: string | null;
  /** 실패한 시도가 무엇을 만들던 것인가. 실패 알림에만 있다 */
  reading_kind: string | null;
  reading_person_a: string | null;
  reading_person_b: string | null;
  created_at: string;
  read_at: string | null;
};

export type InboxRequest = {
  readonly requestId: string;
  readonly direction: RequestDirection;
  /** 차단하는 문이 하나이려면 필요하다 — 후보 카드가 이미 내주는 것과 같은 값이다 */
  readonly counterpartUserId: string;
  readonly nickname: string;
  readonly intro: string | null;
  readonly hasPhoto: boolean;
  readonly status: RequestStatus;
  /** 상대가 내게 채우는 오행 — **내 자리 기준**이다. 방향은 DB 가 뒤집어 준다 */
  readonly suppliedToMe: string | null;
  /** 내가 상대에게 채우는 오행 */
  readonly suppliedToThem: string | null;
  readonly balanceLabel: string;
  readonly createdAt: string;
  readonly decidedAt: string | null;
};

export type InboxMatch = {
  readonly matchId: string;
  readonly partnerUserId: string;
  readonly nickname: string;
  readonly intro: string | null;
  readonly hasPhoto: boolean;
  readonly suppliedToMe: string | null;
  readonly balanceLabel: string;
  readonly createdAt: string;
};

export type InboxNotification = {
  readonly notificationId: string;
  readonly text: string;
  /**
   * 가서 볼 자리 — **실패 알림에만 있다.**
   *
   * 다른 사건은 요청과 Match 를 이 화면이 이미 세우고 있어 갈 곳이 여기다. 실패는
   * 다르다. 어느 대상인지 아는 것과 **그 자리로 가는 것**은 다른 일이고, 비공개
   * 궁합은 두 사람을 다시 골라야 닿는다. 못 찾으면 `null` — 아무 데도 안 가는 링크를
   * 세우지 않는다.
   */
  readonly href: string | null;
  readonly createdAt: string;
  readonly unread: boolean;
};

export type Inbox = {
  readonly requests: InboxRequest[];
  readonly matches: InboxMatch[];
  readonly notifications: InboxNotification[];
  readonly unread: number;
  readonly blocked: number;
};

const BANDS: readonly BalanceBand[] = ['even', 'mixed', 'skewed'];

/** 모르는 오행 글자는 버린다. 모르는 값을 그럴듯한 것으로 눕히지 않는다 */
function elementsOf(raw: string[] | null): Element[] {
  return (raw ?? []).filter((element): element is Element =>
    (ELEMENTS as readonly string[]).includes(element),
  );
}

/** 밴드 이름을 못 알아보면 가장 낮은 칸으로 읽는다 — 좋은 쪽으로 눕히지 않는다 */
function bandOf(raw: string): BalanceBand {
  return BANDS.find((band) => band === raw) ?? 'skewed';
}

/**
 * 실패한 시도를 다시 누를 수 있는 자리.
 *
 * **주소를 지어 내지 않는다.** 대상을 못 알아보면 `null` 이고, 그때 알림은 글자로만
 * 선다 — 눌러도 아무것도 없는 줄을 만들지 않는다.
 */
function destinationFor(
  kind: NotificationKind,
  readingKind: ReadingKind | null,
  row: NotificationRow,
): string | null {
  if (kind !== 'reading_failed') return null;

  if (readingKind === 'self') return '/me';
  /* 저장한 사람의 풀이는 그 사람의 상세 화면에서 다시 누른다 */
  if (readingKind === 'person') {
    return row.reading_person_a === null ? null : `/me/people/${row.reading_person_a}`;
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

/**
 * 지금 내 요청함.
 *
 * 넷을 한 번에 읽는다. 나눠 부르면 화면이 「알림은 왔는데 요청은 아직 없는」 찰나를
 * 그리게 되고, 그 찰나는 사용자에게 고장으로 보인다.
 */
export async function inboxForViewer(): Promise<Inbox> {
  const supabase = await supabaseOnServer();

  const [requests, matches, notifications, blocked] = await Promise.all([
    supabase.rpc('my_match_requests'),
    supabase.rpc('my_matches'),
    supabase.rpc('my_notifications'),
    // 차단 목록은 정책이 자기 행만 연다. **누구인지는 세지 않고 몇인지만 센다**
    // (「다시 보지 않기」와 같은 이유 — 감춘 뒤에는 그 프로필을 읽을 이유가 없다).
    supabase.from('block').select('blocked_user_id'),
  ]);

  for (const { error } of [requests, matches, notifications, blocked]) {
    // 「중지된 계정입니다」 같은 거절은 DB 가 문장으로 낸다. 여기서 다시 판정하지 않는다.
    if (error) throw new Error(error.message);
  }

  const requestRows = (requests.data ?? []) as RequestRow[];
  const matchRows = (matches.data ?? []) as MatchRow[];
  const notificationRows = (notifications.data ?? []) as NotificationRow[];

  return {
    requests: requestRows.flatMap((row) => {
      const status = REQUEST_STATUSES.find((known) => known === row.status);
      // 모르는 상태는 그리지 않는다. 「알 수 없음」으로 세워 두면 사용자가 그 카드로
      // 무엇을 할 수 있는지 알 수 없다.
      if (status === undefined) return [];

      return [
        {
          requestId: row.request_id,
          direction: row.direction === 'sent' ? ('sent' as const) : ('received' as const),
          counterpartUserId: row.counterpart_user_id,
          nickname: row.counterpart_nickname ?? '',
          intro: row.counterpart_intro,
          hasPhoto: row.counterpart_has_photo === true,
          status,
          suppliedToMe: suppliedText(elementsOf(row.supplied_to_me), 'toMe'),
          suppliedToThem: suppliedText(elementsOf(row.supplied_to_them), 'toThem'),
          balanceLabel: cardTextFor({
            suppliedElements: [],
            balanceBand: bandOf(row.balance_band),
          }).balanceLabel,
          createdAt: row.created_at,
          decidedAt: row.decided_at,
        },
      ];
    }),

    matches: matchRows.map((row) => ({
      matchId: row.match_id,
      partnerUserId: row.partner_user_id,
      nickname: row.partner_nickname ?? '',
      intro: row.partner_intro,
      hasPhoto: row.partner_has_photo === true,
      suppliedToMe: suppliedText(elementsOf(row.supplied_to_me), 'toMe'),
      balanceLabel: cardTextFor({
        suppliedElements: [],
        balanceBand: bandOf(row.balance_band),
      }).balanceLabel,
      createdAt: row.created_at,
    })),

    notifications: notificationRows.flatMap((row) => {
      const kind = NOTIFICATION_KINDS.find((known) => known === row.kind);
      if (kind === undefined) return [];

      const readingKind = READING_KINDS.find((known) => known === row.reading_kind) ?? null;

      return [
        {
          notificationId: row.notification_id,
          // **문장은 DB 가 저장하지 않는다.** 사건과 상대만 오고 말은 정책이 짓는다.
          text: notificationText({
            kind: kind as NotificationKind,
            nickname: row.counterpart_nickname,
            readingKind,
          }),
          href: destinationFor(kind as NotificationKind, readingKind, row),
          createdAt: row.created_at,
          unread: row.read_at === null,
        },
      ];
    }),

    unread: notificationRows.filter((row) => row.read_at === null).length,
    blocked: (blocked.data ?? []).length,
  };
}

/** 다른 화면이 배지 하나를 세우려고 부른다 — 목록 전체를 읽지 않는다 */
export async function unreadCount(): Promise<number> {
  const supabase = await supabaseOnServer();
  const { data, error } = await supabase.rpc('unread_notifications');
  if (error) return 0;
  return typeof data === 'number' ? data : 0;
}
