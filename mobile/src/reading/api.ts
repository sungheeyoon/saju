import type { DoorRefusal, DoorRespond, ReadingPress, ReadingView, RunView, ShelfView } from '@reading/door';
import { readingTargetQuery, type ReadingTarget } from '@reading/target';

import { supabase } from '@/auth/client';

export type { ReadingTarget } from '@reading/target';
export type { DoorRefusal, DoorRespond, ReadingPress, ReadingView, RunView, ShelfView } from '@reading/door';

const SITE_URL = process.env.EXPO_PUBLIC_SITE_URL;

/** 문에 못 닿은 때 — 서버가 답하지 못한 자리라 웹의 계정 실패 줄과 같은 글자를 쓴다 */
const UNREACHABLE_NOTE = '계정을 확인하지 못했어요.';

/**
 * 문의 답 — **값이거나 까닭이다.** 던지지 않는다.
 *
 * 부르는 화면은 `refused` 로 길을 고른다(`panel.tsx` 의 `followRefusal`) — 다시 로그인 · 가입 · 다시 시도.
 */
export type DoorAnswer<T> = { readonly ok: true; readonly value: T } | { readonly ok: false; readonly refused: DoorRefusal };

/**
 * **풀이의 문을 부르는 유일한 자리**(ADR 0211) — 다른 영역(궁합 · 인연)도 이 함수들을 그대로 부른다. 대상이 곧 갈래다:
 * `{ kind: 'private', personA, personB }` 면 궁합풀이, `{ kind: 'match', matchId }` 면 인연 궁합이다.
 *
 * 토큰은 부를 때마다 세션에서 읽는다. 만료가 가까우면 라이브러리가 갱신한 값을 내준다.
 */
export async function door<T>(path: string, init?: RequestInit): Promise<DoorAnswer<T>> {
  if (supabase === null || !SITE_URL) return { ok: false, refused: { refused: 'unavailable', message: UNREACHABLE_NOTE } };

  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  if (token === undefined) return { ok: false, refused: { refused: 'sign-in' } };

  try {
    const response = await fetch(`${SITE_URL}${path}`, {
      ...init,
      headers: { ...init?.headers, Authorization: `Bearer ${token}` },
    });
    const body: unknown = await response.json();
    return response.ok ? { ok: true, value: body as T } : { ok: false, refused: body as DoorRefusal };
  } catch {
    return { ok: false, refused: { refused: 'unavailable', message: UNREACHABLE_NOTE } };
  }
}

/**
 * 누름 하나를 가리키는 값 — 같은 누름의 재전송이면 같은 값이라 DB 가 한 번만 연다. 비밀이 아니고 내 시도 안에서만 견준다.
 * Hermes 에는 `crypto.randomUUID` 가 없다.
 */
export function newRequestKey(): string {
  return 'xxxxxxxx-xxxx-4xxx-8xxx-xxxxxxxxxxxx'.replace(/x/g, () => Math.floor(Math.random() * 16).toString(16));
}

/** 시도를 연다 — 모델이 불리는 길은 이것 하나다. 같은 누름을 다시 보낼 때는 같은 `requestKey` 를 넘긴다 */
export function startReading(target: ReadingTarget, requestKey: string): Promise<DoorAnswer<ReadingPress>> {
  return door('/api/mobile/reading', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ target, requestKey }),
  });
}

/**
 * 받은 요청에 답한다 — 수락이면 서버가 응답 뒤에 궁합풀이를 떠나보낸다. `respond_to_match_request` 를 앱에서 바로 부르면 방만 열리고 글이 안 선다.
 * 제출만 하는 문은 없다 — 이 부름이 수락 그 자체다(ADR 0211).
 */
export function respondToMatchRequest(requestId: string, accept: boolean): Promise<DoorAnswer<DoorRespond>> {
  return door('/api/mobile/matching/respond', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ requestId, accept }),
  });
}

/** 그 대상의 풀이 칸 — 글 · 마지막 시도 · 풀이권. 읽기만 한다 */
export function readReadingView(target: ReadingTarget): Promise<DoorAnswer<ReadingView>> {
  return door(`/api/mobile/reading?${readingTargetQuery(target)}`);
}

/** 기다리며 묻는다 — 읽기만 한다 */
export function readReadingRun(target: ReadingTarget): Promise<DoorAnswer<RunView>> {
  return door(`/api/mobile/reading/run?${readingTargetQuery(target)}`);
}

/** 풀이 보관함 — 표지만 온다 */
export function readShelf(): Promise<DoorAnswer<ShelfView>> {
  return door('/api/mobile/readings');
}

/** 본 글의 완성 소식을 읽음으로 — 무엇이 내 소식인지는 DB 가 답하므로 앱에서 바로 부른다. 답을 안 쓴다 */
export async function markReadingRead(readingId: string): Promise<void> {
  if (supabase === null) return;
  const { error } = await supabase.rpc('mark_reading_ready_read', { p_reading_id: readingId });
  if (error !== null) console.error('mark_reading_ready_read', error.code);
}

/** 판매가 이 계정에게 열렸나 — 못 물었으면 열린 꼴이다(`app/me/credits/buy-path.ts` 의 `saleShapeOf`) */
export async function saleIsOpen(): Promise<boolean> {
  if (supabase === null) return true;
  const { data, error } = await supabase.rpc('my_reading_sale_is_open');
  if (error !== null) console.error('my_reading_sale_is_open', error.code);
  return data !== false;
}
