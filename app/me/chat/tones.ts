import { STEM_INFO, type Element, type Stem } from '@/src/lib/saju';

import { supabaseOnServer } from '../../auth/server-client';
import { read, unread, type SkippableRead } from '../../db-error';
import { storedPillarChart } from '../../shared-pillar';
import type { ChatRoom } from './rooms';

/**
 * **대화가 입는 두 사람의 색 — 함께 보는 궁합이 이미 연 값에서만 온다.**
 *
 * 방의 문(`my_chat_rooms`)은 오행을 주지 않는다. 그런데 매칭된 두 사람은 함께 보는 궁합(`/me/match/[id]`)에서
 * 서로의 여덟 글자를 **동의 당시 베껴 둔 그대로** 이미 본다(ADR 0012·0058·0071) — 그 결과 화면은 궁합풀이가
 * 만들어지는 중에도 두 명식을 먼저 세운다. 그래서 같은 문(`my_match_scope`)에서 두 일간만 받는다. 새로 열리는
 * 것이 없고, 브라우저로 나가는 것은 일간 두 글자뿐이다(여덟 글자 전체는 결과 화면의 몫이다).
 *
 * 내 일간도 같은 줄의 내 스냅샷에서 읽는다 — 방을 열 때마다 엔진을 돌리지 않고, 결과 화면 표지의 두 색
 * (`tones`)과 같은 값이라 두 화면이 한 사람을 같은 색으로 칠한다.
 *
 * **결과 화면이 못 여는 방은 색이 없다.** 그 문은 차단된 쌍과 떠난 · 멈춘 상대를 빼고 낸다(`visible_matches()`)
 * — 채팅이 결과 화면보다 먼저 드러내는 값이 없게, 닫힌 방은 아예 묻지 않는다. 동의 당시 여덟 글자가 없는 옛
 * Match 도 색이 없다(결과 화면이 명식을 안 세우는 자리다).
 *
 * `matchResultForViewer` 를 안 쓰는 까닭 — 그 문은 결과 화면의 **본체**라 못 읽으면 던진다. 여기서는 꾸밈이라
 * 못 읽으면 그 방만 중립 색으로 둔다(ADR 0078). 목록은 열린 방마다 한 번씩 묻는다(방은 매칭 수만큼이라 적다).
 */
export type RoomTones = {
  readonly mine: { readonly stem: Stem; readonly element: Element };
  readonly theirs: { readonly stem: Stem; readonly element: Element };
};

async function tonesOf(matchId: string): Promise<SkippableRead<RoomTones | null>> {
  const supabase = await supabaseOnServer();
  const { data, error } = await supabase.rpc('my_match_scope', { p_match_id: matchId });
  if (error) return unread(error, 'my_match_scope');

  const row = (data ?? [])[0];
  if (row === undefined) return read(null);
  const mine = storedPillarChart(row.my_chart);
  const theirs = storedPillarChart(row.partner_chart);
  if (mine === null || theirs === null) return read(null);

  return read({
    mine: { stem: mine.dayMaster, element: STEM_INFO[mine.dayMaster].element },
    theirs: { stem: theirs.dayMaster, element: STEM_INFO[theirs.dayMaster].element },
  });
}

/** 열린 방마다 두 사람의 색. 없으면 그 방은 이 표에 없다 — 화면은 중립 색으로 선다 */
export async function roomTonesForViewer(rooms: readonly ChatRoom[]): Promise<ReadonlyMap<string, RoomTones>> {
  const open = rooms.filter((room) => room.closedReason === null && !room.partnerLeft && room.partnerUserId !== null);
  const reads = await Promise.all(open.map(async (room) => [room.matchId, await tonesOf(room.matchId)] as const));
  const tones = new Map<string, RoomTones>();
  for (const [matchId, one] of reads) {
    if (one.ok && one.value !== null) tones.set(matchId, one.value);
  }
  return tones;
}
