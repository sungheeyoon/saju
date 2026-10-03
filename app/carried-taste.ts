import type { TasteClaimResult } from '@/src/lib/reading/taste-visit';

import { TASTE_ARRIVAL_KEY, TASTE_SESSION_KEY } from './reading-draft';

/**
 * **탭이 들고 온 로그인 전 사주 문단을 붙이는 브라우저 쪽 한 걸음**(ADR 0143 「덧」) — 「이 사주가 내 사주 맞나요?」가 내 사주를
 * 저장한 뒤 부른다. 판단은 서버가 하고(`claimTaste`), 여기는 **세션 id 를 언제 지우는가**만 든다.
 *
 * 앞서는 id 를 먼저 꺼내 지우고 귀속의 실패를 삼켰다 — 순간 장애 하나에 id 가 사라져 다시 붙일 길이 없었다. 이제 id 는
 * **읽기만 하고**, 답이 났을 때(`claimed` · `terminal`)만 지운다. 답이 안 났으면(`retryable` · 액션이 던짐) id 는 남고 화면이
 * 다시 시도를 세운다.
 *
 * 저장소가 막힌 브라우저(사생활 보호 창 등)면 id 를 못 읽은 것이다 — 들고 온 것이 없는 것과 같다(`none`).
 */

/** 탭 저장소의 좁은 꼴 — 시험은 가짜를 넣는다 */
export type TabStorage = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>;

/**
 * - `none` — 들고 온 세션이 없다. 보통 흐름
 * - 그 밖은 `TasteClaimResult` 그대로 — `claimed` 면 도착 표(`TASTE_ARRIVAL_KEY`)를 세웠다
 */
export type CarriedTasteResult = 'none' | TasteClaimResult;

export async function claimCarriedTaste(
  storage: () => TabStorage,
  claim: (sessionId: string) => Promise<{ result: TasteClaimResult }>,
): Promise<CarriedTasteResult> {
  const sessionId = read(storage);
  if (sessionId === null) return 'none';

  let result: TasteClaimResult;
  try {
    ({ result } = await claim(sessionId));
  } catch {
    /* 액션이 닿지 않았다(네트워크 · 배포 사이) — 답이 안 났다 */
    return 'retryable';
  }
  if (result === 'retryable') return 'retryable';

  write(storage, (tab) => {
    tab.removeItem(TASTE_SESSION_KEY);
    if (result === 'claimed') tab.setItem(TASTE_ARRIVAL_KEY, '1');
  });
  return result;
}

/** 들고 온 세션을 버린다 — 「다른 사람의 사주예요」 · 이어 보지 않고 계속하기 */
export function dropCarriedTaste(storage: () => TabStorage): void {
  write(storage, (tab) => tab.removeItem(TASTE_SESSION_KEY));
}

/**
 * 도착 표를 **읽고 지운다** — 한 번만 참이다. 내 사주풀이 화면이 처음 그려질 때 부른다. 새로고침 · 뒤로가기 · 다음 방문에는
 * 이미 지워져 있다.
 */
export function takeTasteArrival(storage: () => TabStorage): boolean {
  let arrived = false;
  write(storage, (tab) => {
    arrived = tab.getItem(TASTE_ARRIVAL_KEY) !== null;
    tab.removeItem(TASTE_ARRIVAL_KEY);
  });
  return arrived;
}

function read(storage: () => TabStorage): string | null {
  try {
    return storage().getItem(TASTE_SESSION_KEY);
  } catch {
    return null;
  }
}

function write(storage: () => TabStorage, change: (tab: TabStorage) => void): void {
  try {
    change(storage());
  } catch {
    /* 저장소가 막혔다 — 남는 것은 이 탭의 id 하나뿐이고 탭을 닫으면 사라진다 */
  }
}
