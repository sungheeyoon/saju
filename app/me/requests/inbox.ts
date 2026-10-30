import type { SupabaseClient } from '@supabase/supabase-js';

import type { Database } from '@/src/lib/db';
import { acceptedMatchOf } from '@/src/lib/matching/history';
import {
  matchOf,
  notificationOf,
  requestOf,
  type Inbox,
  type InboxMatch,
  type InboxRequest,
  type Requests,
} from '@/src/lib/matching/inbox';

import { supabaseOnServer } from '../../auth/server-client';
import { dbFailure } from '../../db-error';

export type { Inbox, InboxMatch, InboxRequest, Requests };

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

/** 책장(`/me/readings`)에 세울, 서로 동의해 성립한 궁합. */
export async function matchesForViewer(client?: SupabaseClient<Database>): Promise<readonly InboxMatch[]> {
  const supabase = client ?? (await supabaseOnServer());
  const { data, error } = await supabase.rpc('my_matches');
  /* 책장의 본체다 — 같은 문을 읽는 `inboxForViewer` 와 같은 답을 해야 한다(ADR 0078) */
  if (error) throw dbFailure(error, 'my_matches');
  return (data ?? []).map(matchOf);
}

/**
 * 방금 수락한 요청의 인연 궁합 — 수락한 사람을 그 결과로 보낸다(ADR 0130 「2026-10-11」).
 *
 * 수락 RPC 는 상태만 답한다. 요청과 Match 를 같은 사람 눈으로 다시 읽어 잇는다(`acceptedMatchOf`). 못 찾으면 `null`.
 */
export async function matchOfAcceptedRequest(requestId: string, client?: SupabaseClient<Database>): Promise<string | null> {
  const supabase = client ?? (await supabaseOnServer());
  const [requests, matches] = await Promise.all([supabase.rpc('my_match_requests'), supabase.rpc('my_matches')]);
  for (const [{ error }, where] of [[requests, 'my_match_requests'], [matches, 'my_matches']] as const) {
    if (error) throw dbFailure(error, where);
  }

  const request = (requests.data ?? []).flatMap(requestOf).find((row) => row.requestId === requestId);
  if (request === undefined) return null;
  return acceptedMatchOf(request, (matches.data ?? []).map(matchOf));
}

/**
 * 내 요청 — 인연 탭 맨 위에 선다(ADR 0130).
 *
 * 요청과 차단 수를 한 번에 읽는다. 차단은 요청 카드에서 일어나고, 차단한 뒤에 「몇 명을 차단했나」가 같은
 * 자리에 서야 누른 것이 어디 갔는지 보인다.
 */
export async function requestsForViewer(): Promise<Requests> {
  const supabase = await supabaseOnServer();

  const [requests, blocked] = await Promise.all([
    supabase.rpc('my_match_requests'),
    // 차단 목록은 정책이 자기 행만 연다. **누구인지는 세지 않고 몇인지만 센다** —
    // 차단한 뒤에는 그 사람의 프로필을 읽을 이유가 없다.
    supabase.from('block').select('blocked_user_id'),
  ]);

  for (const { error } of [requests, blocked]) {
    // 「이용이 정지된 계정입니다」 같은 거절은 DB 가 문장으로 낸다. 여기서 다시 판정하지 않는다.
    if (error) throw dbFailure(error, 'inbox');
  }

  return {
    requests: (requests.data ?? []).flatMap(requestOf),
    blocked: (blocked.data ?? []).length,
  };
}

/**
 * 지금 내 소식 — 종(`/me/requests`)의 본체다.
 *
 * 요청은 여기 없다 — 인연 탭이 `requestsForViewer` 로 읽는다(ADR 0130). `unread` 는 **읽음으로 바꿀 것의 수**라
 * 요청이 왔다는 소식까지 센다 — 이 화면에 들어오면 그 줄도 읽은 것이다. 머리글의 딱지(`bellCount`)와는 다른 값이다.
 */
export async function inboxForViewer(): Promise<Inbox> {
  const supabase = await supabaseOnServer();

  const { data, error } = await supabase.rpc('my_notifications');
  if (error) throw dbFailure(error, 'inbox');

  const notificationRows = data ?? [];
  return {
    notifications: notificationRows.flatMap(notificationOf),
    unread: notificationRows.filter((row) => row.read_at === null).length,
  };
}
