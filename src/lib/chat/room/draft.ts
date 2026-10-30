/** 탭(앱은 프로세스) 수명의 저장소 — 웹은 `sessionStorage`, 앱은 메모리다 */
export type TabStorage = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>;

/**
 * **쓰던 글은 방마다 탭에 남는다** — 신고 · 차단 판이 입력 자리를 차지했다 돌아와도, 다른 방에 갔다 와도 칸에 그대로다
 * (ADR 0155 「2026-10-11 덧 — 쓰던 글」). 입력 칸은 판이 바뀌면 내려가고(`room.tsx` 의 입력 자리) 방은 `matchId` 로 다시
 * 그려져, 칸이 든 값만으로는 글이 사라졌다.
 *
 * 개인 대화가 기기에 남는 범위는 **탭의 수명**이다 — `sessionStorage` 만 쓴다(탭을 닫으면 사라진다). 보내면 지우고, 방이
 * 닫혔으면 지운다. 빈 칸은 적지 않는다. 저장소가 막힌 창에서는 아무것도 남지 않을 뿐 칸은 평소대로 쓴다.
 */
const draftKey = (matchId: string) => `chat-draft:${matchId}`;

export function readDraft(storage: () => TabStorage, matchId: string): string {
  try {
    return storage().getItem(draftKey(matchId)) ?? '';
  } catch {
    return '';
  }
}

export function writeDraft(storage: () => TabStorage, matchId: string, body: string): void {
  try {
    if (body === '') storage().removeItem(draftKey(matchId));
    else storage().setItem(draftKey(matchId), body);
  } catch {
    // 막힌 저장소 — 이 탭에서만 기억을 못 할 뿐이다
  }
}

export const dropDraft = (storage: () => TabStorage, matchId: string): void => writeDraft(storage, matchId, '');
