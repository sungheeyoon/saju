import { accountStateOf, type AccountState } from '@account/index';
import { closedReasonOf, partnerNameOf, roomHeadingOf, roomNoticeOf, TOO_LONG_TEXT, checkBody, sendOutcomeOf, type ClosedReason } from '@chat';
import { roomCompatOf, type RoomCompat } from '@chat/room/compat';
import { MESSAGE_WINDOW, messagesOf, type ChatMessage } from '@chat/room/message';
import type { SendResult } from '@chat/room/pending';
import { rpcArgs } from '@db';
import { userFacingDbMessage } from '@db-error';
import { activityBandOf, type ActivityBand } from '@presence';
import { focusOf, focusesOf, leadFocusOf, type PhotoFocus } from '@profile';
import { STEM_INFO, storedChartSnapshot, type Element, type Stem } from '@saju';

import { supabase } from '@/auth/client';
import { NOT_READY } from '@/auth/signup';

/**
 * 채팅의 읽기 · 쓰기 — 웹의 `app/me/chat/rooms.ts` · `messages.ts` · `tones.ts` · `room-compat.ts` · `actions.ts` 와 같은 문을 같은 뜻으로 부른다.
 * 누가 어느 방을 보는가는 그 문이 정한다(ADR 0091) — 여기서 다시 판정하지 않는다.

 */

export type ChatRoom = {
  readonly matchId: string;
  /** 상대가 떠났으면 `null` — 신고도 차단도 걸 사람이 없다(ADR 0094) */
  readonly partnerUserId: string | null;
  readonly partnerNickname: string;
  readonly partnerLeft: boolean;
  readonly openedAt: string;
  readonly closedReason: ClosedReason | null;
  readonly lastMessageAt: string | null;
  readonly lastMessageBody: string | null;
  readonly unread: number;
  readonly partnerActivity: ActivityBand | null;
  readonly partnerHasPhoto: boolean;
  /** 대표 사진의 보일 자리 */
  readonly partnerPhotoFocus: PhotoFocus;
  /** 장마다의 보일 자리 — 수가 곧 장 수다(`photosFromFocus`). 닫힌 방은 시트를 안 여니 비운다 */
  readonly partnerPhotoFocuses: readonly PhotoFocus[];
};

export type RoomTones = {
  readonly mine: { readonly stem: Stem; readonly element: Element };
  readonly theirs: { readonly stem: Stem; readonly element: Element };
};

type RoomRow = {
  match_id: string;
  partner_user_id: string | null;
  partner_nickname: string | null;
  partner_left: boolean | null;
  opened_at: string;
  closed_reason: string | null;
  last_message_at: string | null;
  last_message_body: string | null;
  unread_count: number | null;
  partner_activity: string | null;
  partner_has_photo: boolean | null;
  partner_photo_focus: number[] | null;
};

const roomOf = (row: RoomRow): ChatRoom | null => {
  const reason = row.closed_reason === null ? null : closedReasonOf(row.closed_reason);
  /* 닫혔는데 이유를 모르면 무슨 말을 세울지 알 수 없다 — 그리지 않는다 */
  if (row.closed_reason !== null && reason === null) return null;
  return {
    matchId: row.match_id,
    partnerUserId: row.partner_user_id ?? null,
    partnerNickname: row.partner_nickname ?? '',
    partnerLeft: row.partner_left === true,
    openedAt: row.opened_at,
    closedReason: reason,
    lastMessageAt: row.last_message_at,
    lastMessageBody: row.last_message_body,
    unread: row.unread_count ?? 0,
    partnerActivity: activityBandOf(row.partner_activity),
    partnerHasPhoto: row.partner_has_photo === true,
    partnerPhotoFocus: leadFocusOf(row.partner_photo_focus),
    partnerPhotoFocuses:
      row.partner_has_photo === true && reason === null ? focusesOf(row.partner_photo_focus, Math.max(1, Math.floor((row.partner_photo_focus?.length ?? 0) / 2))) : [],
  };
};

/** 화면이 없는 까닭 — 로그인이 없다 · 못 읽었다 */
export type Unread = { readonly kind: 'signed-out' } | { readonly kind: 'failed'; readonly message: string };

export const currentUserId = async (): Promise<string | null> => {
  if (supabase === null) return null;
  const { data } = await supabase.auth.getSession();
  return data.session?.user.id ?? null;
};

type AccountRow = { readonly state: AccountState; readonly nickname: string | null; readonly intro: string | null };

/** 계정이 어디에 서 있나 — 판정은 `accountStateOf` 하나다(ADR 0048) */
async function readAccount(): Promise<AccountRow> {
  if (supabase === null) return { state: { kind: 'unreachable' }, nickname: null, intro: null };
  const { data, error } = await supabase.from('app_user').select('status, self_person_id, nickname, intro').maybeSingle();
  if (error !== null) return { state: accountStateOf({ ok: false, reason: 'unreachable' }), nickname: null, intro: null };
  if (data === null) return { state: accountStateOf({ ok: false, reason: 'missing' }), nickname: null, intro: null };
  return {
    state: accountStateOf({ ok: true, account: { status: data.status, selfPersonId: data.self_person_id } }),
    nickname: data.nickname,
    intro: data.intro,
  };
}

async function readRooms(): Promise<{ ok: true; rooms: readonly ChatRoom[] } | { ok: false; message: string }> {
  if (supabase === null) return { ok: false, message: NOT_READY };
  const { data, error } = await supabase.rpc('my_chat_rooms');
  /* 목록 화면의 본체다 — 못 읽으면 빈 목록이 아니라 실패다(ADR 0078) */
  if (error !== null) return { ok: false, message: userFacingDbMessage(error, 'my_chat_rooms') };
  return {
    ok: true,
    rooms: (data ?? []).flatMap((row) => {
      const room = roomOf(row);
      return room === null ? [] : [room];
    }),
  };
}

type RoomScope = { readonly tones: RoomTones | null; readonly intro: string | null };

/** 인연 궁합이 이미 연 값에서만 두 사람의 색과 소개를 받는다 — 꾸밈이라 못 읽으면 중립 색이다(ADR 0078) */
async function readScope(matchId: string): Promise<RoomScope | null> {
  if (supabase === null) return null;
  const { data, error } = await supabase.rpc('my_match_scope', { p_match_id: matchId });
  if (error !== null) {
    console.error('my_match_scope', error.code);
    return null;
  }
  const row = (data ?? [])[0];
  if (row === undefined) return null;
  const intro = row.partner_intro ?? null;
  const mine = storedChartSnapshot(row.my_chart);
  const theirs = storedChartSnapshot(row.partner_chart);
  if (mine === null || theirs === null) return { tones: null, intro };
  return {
    tones: {
      mine: { stem: mine.dayMaster, element: STEM_INFO[mine.dayMaster].element },
      theirs: { stem: theirs.dayMaster, element: STEM_INFO[theirs.dayMaster].element },
    },
    intro,
  };
}

const isOpen = (room: ChatRoom): boolean => room.closedReason === null && !room.partnerLeft && room.partnerUserId !== null;

export type RoomListScreen =
  | Unread
  | { readonly kind: 'blocked'; readonly state: AccountState }
  | {
      readonly kind: 'ready';
      readonly rooms: readonly ChatRoom[];
      readonly tones: ReadonlyMap<string, RoomTones>;
      readonly hasSelf: boolean;
    };

export async function readRoomListScreen(): Promise<RoomListScreen> {
  if ((await currentUserId()) === null) return { kind: 'signed-out' };
  const [account, rooms] = await Promise.all([readAccount(), readRooms()]);
  if (isStopped(account.state)) return { kind: 'blocked', state: account.state };
  if (!rooms.ok) return { kind: 'failed', message: rooms.message };
  const scopes = await Promise.all(rooms.rooms.filter(isOpen).map(async (room) => [room.matchId, await readScope(room.matchId)] as const));
  const tones = new Map<string, RoomTones>();
  for (const [matchId, scope] of scopes) if (scope?.tones) tones.set(matchId, scope.tones);
  return { kind: 'ready', rooms: rooms.rooms, tones, hasSelf: account.state.kind === 'active' && account.state.selfPersonId !== null };
}

const isStopped = (state: AccountState): boolean => state.kind === 'halted' || state.kind === 'missing' || state.kind === 'unreachable';

export type RoomSelf = { readonly userId: string; readonly nickname: string; readonly intro: string | null; readonly photoFocuses: readonly PhotoFocus[] };

export type RoomView = {
  readonly matchId: string;
  readonly heading: string;
  readonly name: string;
  readonly partnerUserId: string | null;
  readonly partnerHasPhoto: boolean;
  readonly partnerPhotoFocus: PhotoFocus;
  readonly partnerPhotoFocuses: readonly PhotoFocus[];
  readonly partnerIntro: string | null;
  /** 닫힌 까닭 한 줄 — 열린 방은 `null` */
  readonly notice: string | null;
  readonly activity: ActivityBand | null;
  readonly unread: number;
  readonly messages: readonly ChatMessage[];
  /** 읽은 것이 방의 처음부터다(200건 아래) — 그때만 첫머리를 세운다 */
  readonly fromBeginning: boolean;
  readonly tones: RoomTones | null;
  /** 열린 방에만 온다 — 닫힌 방에는 단추가 없다 */
  readonly compat: RoomCompat | null;
  readonly me: RoomSelf | null;
};

export type RoomScreen =
  | Unread
  | { readonly kind: 'blocked'; readonly state: AccountState }
  /** 없는 방 · 내가 볼 수 없는 방 — 문이 내주지 않았다 */
  | { readonly kind: 'not-found' }
  | { readonly kind: 'ready'; readonly view: RoomView };

/** 방 머리의 궁합 단추 — 결과 화면과 같은 두 문을 점수 칸만 읽는다. 꾸밈이라 못 읽으면 이름만 선다(ADR 0078) */
async function readCompat(matchId: string): Promise<RoomCompat> {
  if (supabase === null) return { kind: 'quiet' };
  const target = { p_kind: 'match', p_person_a: null, p_person_b: null, p_match_id: matchId };
  const [reading, run] = await Promise.all([
    supabase.rpc('my_reading', rpcArgs<'my_reading'>(target)).select('score'),
    supabase.rpc('my_last_reading_run', rpcArgs<'my_last_reading_run'>(target)),
  ]);
  const row = (reading.data ?? [])[0];
  return roomCompatOf(
    reading.error !== null ? { ok: false } : { ok: true, value: row === undefined ? null : { score: row.score ?? null } },
    run.error !== null ? { ok: false } : { ok: true, value: (run.data ?? [])[0]?.status ?? null },
  );
}

export async function readRoomScreen(matchId: string): Promise<RoomScreen> {
  const userId = await currentUserId();
  if (userId === null) return { kind: 'signed-out' };
  const [account, rooms] = await Promise.all([readAccount(), readRooms()]);
  if (isStopped(account.state)) return { kind: 'blocked', state: account.state };
  if (!rooms.ok) return { kind: 'failed', message: rooms.message };
  const room = rooms.rooms.find((one) => one.matchId === matchId);
  if (room === undefined) return { kind: 'not-found' };

  const notice = roomNoticeOf(room);
  const open = notice === null && room.partnerUserId !== null;
  const [messages, scope, compat, mine] = await Promise.all([
    readMessages(matchId).then(
      (page) => ({ ok: true as const, page }),
      (failure: Error) => ({ ok: false as const, message: failure.message }),
    ),
    open ? readScope(matchId) : null,
    open ? readCompat(matchId) : null,
    /* 내 시트의 사진 — 꾸밈이라 못 읽으면 사진 없는 나로 선다(ADR 0078) */
    supabase === null ? null : supabase.rpc('my_photos'),
  ]);
  if (!messages.ok) return { kind: 'failed', message: messages.message };

  return {
    kind: 'ready',
    view: {
      matchId,
      heading: roomHeadingOf(room),
      name: partnerNameOf(room),
      partnerUserId: room.partnerUserId,
      partnerHasPhoto: room.partnerHasPhoto,
      partnerPhotoFocus: room.partnerPhotoFocus,
      partnerPhotoFocuses: room.partnerPhotoFocuses,
      partnerIntro: scope?.intro ?? null,
      notice,
      activity: room.partnerActivity,
      unread: room.unread,
      messages: messages.page,
      fromBeginning: messages.page.length < MESSAGE_WINDOW,
      tones: scope?.tones ?? null,
      compat,
      me: account.nickname === null ? null : { userId, nickname: account.nickname, intro: account.intro, photoFocuses: (mine?.data ?? []).map((row) => focusOf(row.focus_x, row.focus_y)) },
    },
  };
}

/** 한 쪽 — 못 읽으면 던진다. 부른 자리가 가진 것을 그대로 두고 다음 다시 대조가 메운다. 던지는 글은 사람에게 보여도 되는 문장이다 */
export async function readMessages(
  matchId: string,
  page: { readonly before?: number; readonly limit?: number } = {},
): Promise<readonly ChatMessage[]> {
  if (supabase === null) throw new Error(NOT_READY);
  const { data, error } = await supabase.rpc('my_chat_messages', {
    p_match_id: matchId,
    p_limit: page.limit ?? MESSAGE_WINDOW,
    ...(page.before === undefined ? {} : { p_before_seq: page.before }),
  });
  if (error !== null) throw new Error(userFacingDbMessage(error, 'my_chat_messages'));
  return messagesOf(data ?? []);
}

/** 웹의 `sendChatMessage` 와 같은 갈래다 — 코드가 있는 오류는 DB 가 답한 거절이라 아무것도 안 남았다(ADR 0155 덧) */
export async function sendMessage(matchId: string, body: string, clientId: string): Promise<SendResult> {
  if (supabase === null) return { ok: false, message: NOT_READY, refused: true };
  if (checkBody(body) === 'too_long') return { ok: false, message: TOO_LONG_TEXT, refused: true };
  noteActivity();
  const { data, error } = await supabase.rpc(
    'send_chat_message',
    rpcArgs<'send_chat_message'>({ p_match_id: matchId, p_body: body, p_client_id: clientId }),
  );
  if (error !== null) return { ok: false, message: userFacingDbMessage(error, 'send_chat_message'), refused: Boolean(error.code) };
  const outcome = sendOutcomeOf(data);
  /* 모르는 값은 성공으로 세우지 않는다 — 보냈다고 말했는데 목록에 없는 편이 더 나쁘다 */
  if (outcome === null) {
    return { ok: false, message: userFacingDbMessage({ message: `chat: unknown outcome ${String(data)}` }, 'send_chat_message'), refused: false };
  }
  return { ok: true, outcome };
}

/** 읽음은 사람이 누른 것이 아니라 활동으로 적지 않는다(ADR 0155) */
export async function markRead(matchId: string, upToSeq: number): Promise<boolean> {
  if (supabase === null) return false;
  const { error } = await supabase.rpc('mark_chat_read', { p_match_id: matchId, p_up_to_seq: upToSeq });
  return error === null;
}

export type SaveAnswer = { readonly ok: true } | { readonly ok: false; readonly message: string };

export async function blockUser(userId: string): Promise<SaveAnswer> {
  if (supabase === null) return { ok: false, message: NOT_READY };
  noteActivity();
  const { error } = await supabase.rpc('block_user', { p_user_id: userId });
  return error === null ? { ok: true } : { ok: false, message: userFacingDbMessage(error, 'block_user') };
}

export async function reportUser(userId: string, reason: string, detail: string): Promise<SaveAnswer> {
  if (supabase === null) return { ok: false, message: NOT_READY };
  noteActivity();
  const { error } = await supabase.rpc(
    'report_user',
    rpcArgs<'report_user'>({ p_user_id: userId, p_reason: reason, p_detail: detail.trim() || null }),
  );
  return error === null ? { ok: true } : { ok: false, message: userFacingDbMessage(error, 'report_user') };
}

export async function reportMessage(messageId: string, reason: string, detail: string): Promise<SaveAnswer> {
  if (supabase === null) return { ok: false, message: NOT_READY };
  noteActivity();
  const { error } = await supabase.rpc(
    'report_chat_message',
    rpcArgs<'report_chat_message'>({ p_message_id: messageId, p_reason: reason, p_detail: detail.trim() || null }),
  );
  return error === null ? { ok: true } : { ok: false, message: userFacingDbMessage(error, 'report_chat_message') };
}

/**
 * **사람이 화면을 열거나 누른 것은 활동이다**(ADR 0118) — 웹은 관문과 화면 그리기가 적는데 앱은 그 길을 안 지나 여기서 적는다. 안 적으면 앱만 쓰는
 * 사람은 상대에게 늘 「24시간 이전 활동」이다. 1분에 한 번만 실제로 적히고(ADR 0092) 부속 정보라 실패는 기록에만 남긴다. 다시 읽기 · 읽음은 부르지 않는다.
 */
export function noteActivity(): void {
  if (supabase === null) return;
  void Promise.resolve(supabase.rpc('touch_activity')).then(({ error }) => {
    if (error !== null) console.error('touch_activity', error.code);
  });
}
