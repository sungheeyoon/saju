import { accountStateOf, type AccountState } from '@account/index';
import { REQUEST_STATUSES, type RequestStatus } from '@consent/index';
import { rpcArgs } from '@db';
import { userFacingDbMessage } from '@db-error';
import { boardNotes } from '@discovery';
import { elementSummaryOf, type ElementSummary } from '@discovery/element-axes';
import { storedChartOf } from '@input/stored';
import { publicCardFromRow } from '@matching/cards';
import type { DeckCard } from '@matching/deck-card';
import { withFrom } from '@matching/history';
import { matchOf, notificationOf, requestOf, type Inbox, type InboxMatch, type Requests } from '@matching/inbox';
import { refusedForCredits } from '@matching/requests';
import { activityBandOf } from '@presence';
import { ELEMENTS, storedChartSnapshot, type ChartSnapshot } from '@saju';
import type { PhotoFocus } from '@profile';
import { outOfCredits } from '@reading/panel-chrome';

import { supabase } from '@/auth/client';
import { respondToMatchRequest } from '@/reading/api';

/**
 * **앱의 인연 문** — 웹의 `app/me/candidates.ts` · `requests/inbox.ts` · `requests/actions.ts` · `discovery/actions.ts` 가 부르는 같은 문을
 * 앱 세션으로 부른다. 자를 것 · 판정은 여기 없다 — 공개 범위는 그 문의 반환형이 곧 답이다. 거절 문구는 `userFacingDbMessage` 다.
 *
 * **여기 없는 일 하나**(서버에서만 된다 — `docs/product/gaps.md` G-123): 참여를 여는 문(`ensure_discovery_participation`, 열쇠 전용 · ADR 0136).
 * 수락과 사진은 앱용 문(ADR 0211)이 든다 — `respondToRequest` · `@/ui/photo`.
 */

const NOT_READY = '이 빌드에서는 로그인할 수 없어요.';
const UNEXPECTED = '잠시 뒤 다시 시도해 주세요.';

export type Read<T> = { ok: true; value: T } | { ok: false; reason: string };
export type Done = { ok: true } | { ok: false; message: string };

/** 부름이 던진 것(망)의 원문은 화면에 안 세운다 */
const guarded = async <T>(run: () => Promise<Read<T>>): Promise<Read<T>> => {
  try {
    return await run();
  } catch (thrown) {
    console.error('matching', thrown);
    return { ok: false, reason: UNEXPECTED };
  }
};

export async function readAccountState(): Promise<AccountState> {
  if (supabase === null) return { kind: 'unreachable' };
  const { data, error } = await supabase.from('app_user').select('status, self_person_id').maybeSingle();
  if (error !== null) return accountStateOf({ ok: false, reason: 'unreachable' });
  if (data === null) return accountStateOf({ ok: false, reason: 'missing' });
  return accountStateOf({ ok: true, account: { status: data.status, selfPersonId: data.self_person_id } });
}

/** 내 오행 요약 — 카드의 문장을 지을 때만 쓴다. 풀에 올리지 않는다. 저장된 입력에서 웹과 같은 함수로 짓는다 */
async function mySummary(selfPersonId: string): Promise<ElementSummary | null> {
  if (supabase === null) return null;
  const [person, edge] = await Promise.all([
    supabase
      .from('person')
      .select('calendar, original_date, solar_date, birth_time, gender, city, late_night_rule, time_basis')
      .eq('id', selfPersonId)
      .maybeSingle(),
    supabase.from('user_person_access').select('local_label').eq('person_id', selfPersonId).maybeSingle(),
  ]);
  if (person.error !== null) throw new Error(person.error.code);
  if (edge.error !== null) throw new Error(edge.error.code);
  if (person.data === null || person.data.calendar === null || edge.data === null) return null;
  const stood = storedChartOf(person.data as Parameters<typeof storedChartOf>[0], edge.data.local_label);
  return stood.ok ? elementSummaryOf(stood.saju.analysis.elements) : null;
}

export type DeckPlace =
  /** 내 사주 · 이름이 아직 없다 */
  | { kind: 'guide' }
  /** 참여를 껐다 */
  | { kind: 'resting' }
  | {
      kind: 'deck';
      summary: ElementSummary;
      cards: readonly DeckCard[];
      passed: readonly DeckCard[];
      notice: string | null;
      explorationNote: string | null;
    };

const passedOf = (row: Parameters<typeof publicCardFromRow>[0], summary: ElementSummary): DeckCard => ({
  ...publicCardFromRow(row, summary),
  activity: null,
});

/**
 * 인연 탭의 덱 — 웹의 `app/me/matching/page.tsx` 와 같은 차례다. 다만 **참여를 여는 문은 못 부른다**(열쇠 전용). 한 번도 참여가 안 열린 계정은
 * `my_discovery_board` 의 거절(「매칭 참여를 먼저 켜 주세요.」)이 그대로 까닭 줄이 된다 — 지어낸 빈 덱을 세우지 않는다.
 */
export function readDeck(selfPersonId: string | null): Promise<Read<DeckPlace>> {
  return guarded<DeckPlace>(async () => {
    if (supabase === null) return { ok: false, reason: NOT_READY };
    if (selfPersonId === null) return { ok: true, value: { kind: 'guide' } };
    const summary = await mySummary(selfPersonId);
    if (summary === null) return { ok: true, value: { kind: 'guide' } };

    const profile = await supabase.from('discovery_profile').select('prefer_gender, opted_out_at').maybeSingle();
    if (profile.error === null && profile.data !== null && profile.data.opted_out_at != null) {
      return { ok: true, value: { kind: 'resting' } };
    }

    const [board, passed] = await Promise.all([supabase.rpc('my_discovery_board'), supabase.rpc('my_passed_connections')]);
    if (board.error !== null) return { ok: false, reason: userFacingDbMessage(board.error, 'my_discovery_board') };
    if (passed.error !== null) return { ok: false, reason: userFacingDbMessage(passed.error, 'my_passed_connections') };

    const cards: DeckCard[] = (board.data ?? []).map((row) => ({
      ...publicCardFromRow(row, summary),
      exploration: row.exploration,
      activity: activityBandOf(row.activity),
    }));
    const notes = boardNotes({
      viewerMissingCount: ELEMENTS.filter((element) => summary.counts[element] === 0).length,
      hasExploration: cards.some((card) => card.exploration),
    });
    return {
      ok: true,
      value: {
        kind: 'deck',
        summary,
        cards,
        passed: (passed.data ?? []).map((row) => passedOf(row, summary)),
        ...notes,
      },
    };
  });
}

export function readRequests(): Promise<Read<Requests>> {
  return guarded(async () => {
    if (supabase === null) return { ok: false, reason: NOT_READY };
    const [requests, blocked] = await Promise.all([supabase.rpc('my_match_requests'), supabase.from('block').select('blocked_user_id')]);
    if (requests.error !== null) return { ok: false, reason: userFacingDbMessage(requests.error, 'inbox') };
    if (blocked.error !== null) return { ok: false, reason: userFacingDbMessage(blocked.error, 'inbox') };
    return { ok: true, value: { requests: (requests.data ?? []).flatMap(requestOf), blocked: (blocked.data ?? []).length } };
  });
}

export function readMatches(): Promise<Read<readonly InboxMatch[]>> {
  return guarded(async () => {
    if (supabase === null) return { ok: false, reason: NOT_READY };
    const { data, error } = await supabase.rpc('my_matches');
    if (error !== null) return { ok: false, reason: userFacingDbMessage(error, 'my_matches') };
    return { ok: true, value: (data ?? []).map(matchOf) };
  });
}

/** 인연 궁합 표지 한 권 — 글이 선 Match. 기록 화면의 「인연 궁합」 칸이 읽는다 */
export type MatchBook = { key: string; matchId: string; href: string; label: string };

/** 글이 선 인연 궁합 — 책장과 같은 문(`my_readings`)의 `match` 줄 */
export function readMatchBooks(): Promise<Read<readonly MatchBook[]>> {
  return guarded(async () => {
    if (supabase === null) return { ok: false, reason: NOT_READY };
    const { data, error } = await supabase.rpc('my_readings');
    if (error !== null) return { ok: false, reason: userFacingDbMessage(error, 'my_readings') };
    return {
      ok: true,
      value: (data ?? []).flatMap((row) =>
        row.kind === 'match' && row.match_id !== null
          ? [{ key: row.match_id, matchId: row.match_id, href: withFrom(`/me/match/${row.match_id}`, 'history'), label: row.label_b ?? '' }]
          : [],
      ),
    };
  });
}

export function readInbox(): Promise<Read<Inbox>> {
  return guarded(async () => {
    if (supabase === null) return { ok: false, reason: NOT_READY };
    const { data, error } = await supabase.rpc('my_notifications');
    if (error !== null) return { ok: false, reason: userFacingDbMessage(error, 'inbox') };
    const rows = data ?? [];
    return { ok: true, value: { notifications: rows.flatMap(notificationOf), unread: rows.filter((row) => row.read_at === null).length } };
  });
}

const doing = async (run: () => Promise<Done>): Promise<Done> => {
  try {
    return await run();
  } catch (thrown) {
    console.error('matching', thrown);
    return { ok: false, message: UNEXPECTED };
  }
};

export const markNotificationsRead = (): Promise<Done> =>
  doing(async () => {
    if (supabase === null) return { ok: false, message: NOT_READY };
    const { error } = await supabase.rpc('mark_notifications_read');
    return error === null ? { ok: true } : { ok: false, message: userFacingDbMessage(error, 'mark_notifications_read') };
  });

export const passCandidate = (candidateUserId: string): Promise<Done> =>
  doing(async () => {
    if (supabase === null) return { ok: false, message: NOT_READY };
    const { data: session } = await supabase.auth.getSession();
    const userId = session.session?.user.id;
    if (userId === undefined) return { ok: false, message: '로그인이 풀렸어요. 다시 로그인해 주세요.' };
    const { error } = await supabase
      .from('discovery_passed')
      .upsert({ user_id: userId, passed_user_id: candidateUserId, passed_at: new Date().toISOString() }, { onConflict: 'user_id,passed_user_id' });
    return error === null ? { ok: true } : { ok: false, message: userFacingDbMessage(error, 'discovery_passed.insert') };
  });

type BoardCardRow = Parameters<typeof publicCardFromRow>[0];

/** 「다시 만나보기」와 되돌리기가 같이 쓴다 — 문이 든 덱 한 덩이를 카드로 옮긴다 */
export async function restorePassed(
  candidateUserId: string,
  summary: ElementSummary,
): Promise<{ ok: true; card: DeckCard; passed: readonly DeckCard[] } | { ok: false; message: string }> {
  if (supabase === null) return { ok: false, message: NOT_READY };
  try {
    const { data, error } = await supabase.rpc('restore_passed_connection', { p_candidate_user_id: candidateUserId });
    if (error !== null) return { ok: false, message: userFacingDbMessage(error, 'restore_passed_connection') };
    /* `jsonb` 를 내주는 문이라 생성 타입이 `Json` 까지만 말한다 — 모양을 주장하는 자리를 이 한 줄로 가둔다(웹과 같다) */
    const deck = data as { card?: BoardCardRow; passed?: BoardCardRow[] } | null;
    if (!deck?.card) return { ok: false, message: '되돌린 인연을 불러오지 못했어요. 목록을 새로 열어 주세요.' };
    return { ok: true, card: passedOf(deck.card, summary), passed: (deck.passed ?? []).map((row) => passedOf(row, summary)) };
  } catch (thrown) {
    console.error('matching', thrown);
    return { ok: false, message: '카드를 되돌리지 못했어요. 잠시 뒤 다시 시도해 주세요.' };
  }
}

/** 요청 — 인자는 상대 하나뿐이다. 풀이권으로 막혔으면 표를 단다(화면이 풀이권 창을 연다). 부름이 던졌으면 던진다 — 서버가 받았는지 모른다 */
export async function requestMatch(candidateUserId: string): Promise<Done | { ok: false; message: string; outOfCredits: true }> {
  if (supabase === null) return { ok: false, message: NOT_READY };
  const { error } = await supabase.rpc('request_match', { p_candidate_user_id: candidateUserId });
  if (error === null) return { ok: true };
  const message = userFacingDbMessage(error, 'request_match');
  return refusedForCredits(error) ? { ok: false, message, outOfCredits: true } : { ok: false, message };
}

/** 지금 풀이권이 0개인가 — 못 물었으면 `false`(DB 가 판정한다) */
export async function outOfCreditsNow(): Promise<boolean> {
  if (supabase === null) return false;
  try {
    const { data, error } = await supabase.rpc('my_reading_credits');
    if (error !== null) return false;
    const row = (data ?? [])[0];
    return row !== undefined && outOfCredits(row);
  } catch {
    return false;
  }
}

/** 이 계정에게 판매가 열렸나 — 못 물었으면 열린 꼴(`saleShapeOf` 와 같다). 상품 화면이 다시 묻는다 */
export async function saleIsOpenNow(): Promise<boolean> {
  if (supabase === null) return true;
  try {
    const { data, error } = await supabase.rpc('my_reading_sale_is_open');
    return error !== null || data === true;
  } catch {
    return true;
  }
}

const statusOf = (value: unknown): RequestStatus | null => REQUEST_STATUSES.find((known) => known === value) ?? null;

export type Answered = { ok: true; status: RequestStatus; matchId?: string } | { ok: false; message: string };

/**
 * 받은 요청에 답한다 — **앱용 문으로 간다**(ADR 0211). 판정은 `respond_to_match_request` 안에 있고, 수락이면 서버가 응답 뒤에 궁합풀이를 떠나보낸다.
 * RPC 를 앱에서 바로 부르면 방만 열리고 글이 안 선다. 그 Match 를 못 찾았으면 `matchId` 없이 답한다 — 카드만 내려가고 인연 탭에 남는다(웹과 같다).
 */
export async function respondToRequest(requestId: string, accept: boolean): Promise<Answered> {
  const answer = await respondToMatchRequest(requestId, accept);
  if (!answer.ok) {
    if (answer.refused.refused === 'unavailable') return { ok: false, message: answer.refused.message };
    if (answer.refused.refused === 'sign-in') return { ok: false, message: '로그인이 풀렸어요. 다시 로그인해 주세요.' };
    return { ok: false, message: '답을 보내지 못했어요. 잠시 뒤 다시 시도해 주세요.' };
  }
  if (!answer.value.ok) return { ok: false, message: answer.value.message };
  const status = statusOf(answer.value.status);
  if (status === null) return { ok: false, message: '답을 보내지 못했어요. 잠시 뒤 다시 시도해 주세요.' };
  return answer.value.matchId === undefined ? { ok: true, status } : { ok: true, status, matchId: answer.value.matchId };
}

export async function cancelRequest(requestId: string): Promise<Answered> {
  if (supabase === null) return { ok: false, message: NOT_READY };
  try {
    const { data, error } = await supabase.rpc('cancel_match_request', { p_request_id: requestId });
    if (error !== null) return { ok: false, message: userFacingDbMessage(error, 'cancel_match_request') };
    const status = statusOf(data);
    if (status === null) return { ok: false, message: '요청을 취소하지 못했어요. 새로고침한 뒤 다시 시도해 주세요.' };
    return { ok: true, status };
  } catch (thrown) {
    console.error('matching', thrown);
    return { ok: false, message: UNEXPECTED };
  }
}

export const blockUser = (userId: string): Promise<Done> =>
  doing(async () => {
    if (supabase === null) return { ok: false, message: NOT_READY };
    const { error } = await supabase.rpc('block_user', { p_user_id: userId });
    return error === null ? { ok: true } : { ok: false, message: userFacingDbMessage(error, 'block_user') };
  });

export const reportUser = (userId: string, reason: string, detail: string): Promise<Done> =>
  doing(async () => {
    if (supabase === null) return { ok: false, message: NOT_READY };
    const { error } = await supabase.rpc(
      'report_user',
      rpcArgs<'report_user'>({ p_user_id: userId, p_reason: reason, p_detail: detail.trim() || null }),
    );
    return error === null ? { ok: true } : { ok: false, message: userFacingDbMessage(error, 'report_user') };
  });

export type MatchResult = {
  matchId: string;
  partnerUserId: string;
  partnerNickname: string;
  partnerIntro: string | null;
  partnerPhotoCount: number;
  partnerPhotoFocus: readonly PhotoFocus[];
  mine: ChartSnapshot;
  theirs: ChartSnapshot;
};

export type MatchOutcome = { kind: 'ok'; result: MatchResult } | { kind: 'closed' } | { kind: 'none' };

/** 인연 궁합 — 없는 Match 와 못 보는 Match 는 같은 답이다(`none`). 여덟 글자는 동의 때 베낀 것을 그대로 읽는다 */
export function readMatchResult(matchId: string): Promise<Read<MatchOutcome>> {
  return guarded<MatchOutcome>(async () => {
    if (supabase === null) return { ok: false, reason: NOT_READY };
    const [scope, matches] = await Promise.all([supabase.rpc('my_match_scope', { p_match_id: matchId }), supabase.rpc('my_matches')]);
    if (scope.error !== null) return { ok: false, reason: userFacingDbMessage(scope.error, 'my_match_scope') };
    const row = (scope.data ?? [])[0];
    if (row === undefined) return { ok: true, value: { kind: 'none' } };
    const mine = storedChartSnapshot(row.my_chart);
    const theirs = storedChartSnapshot(row.partner_chart);
    if (mine === null || theirs === null) return { ok: true, value: { kind: 'closed' } };
    const inbox = (matches.data ?? []).find((one) => one.match_id === matchId);
    const match = inbox === undefined ? null : matchOf(inbox);
    const flat = inbox?.partner_photo_focus ?? null;
    const count = row.partner_has_photo === true ? Math.max(1, Math.floor((flat?.length ?? 0) / 2)) : 0;
    return {
      ok: true,
      value: {
        kind: 'ok',
        result: {
          matchId: row.match_id,
          partnerUserId: row.partner_user_id,
          partnerNickname: row.partner_nickname ?? '상대',
          partnerIntro: row.partner_intro,
          partnerPhotoCount: count,
          partnerPhotoFocus: match === null ? [] : [match.photoFocus],
          mine,
          theirs,
        },
      },
    };
  });
}

/** 내 닉네임 — 글의 자리 호칭을 바꿔 넣을 값이다. 못 읽으면 빈 값이고 글은 그대로 선다 */
export async function readMyNickname(): Promise<string> {
  if (supabase === null) return '';
  const { data, error } = await supabase.from('app_user').select('nickname').maybeSingle();
  return error !== null ? '' : (data?.nickname ?? '');
}
