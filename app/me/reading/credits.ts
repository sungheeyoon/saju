import type { SupabaseClient } from '@supabase/supabase-js';

import type { Database, RpcRow } from '@/src/lib/db';

import { read, unread, type SkippableRead } from '../../db-error';

/**
 * **남은 풀이권을 읽는 문 — 서버와 브라우저가 같은 것을 쓴다**(ADR 0078).
 *
 * client 를 인자로 받는다. 안에서 만들면 서버 전용 모듈이 딸려 들어가 헤더(클라이언트
 * 컴포넌트)가 이 문을 못 쓰고, 그러면 **같은 값을 읽는 자리가 다시 둘**이 된다 —
 * 헤더가 열 이름을 손으로 캐스팅하던 것이 그 상태였다(`credit_limit` 이 바뀌어도
 * 컴파일러가 말해 주지 않고 칩만 조용히 사라졌다).
 *
 * 헤더가 브라우저에서 읽는 것 자체는 그대로 둔다 — 레이아웃이 하나뿐이라 서버로
 * 옮기면 랜딩 `/` 이 정적이기를 그만둔다(ADR 0078).
 */
export type ReadingCredits = {
  readonly limit: number;
  readonly used: number;
  /** 지금 만들고 있는 것이 잡고 있는 자리 — 화면이 그 이유를 말할 수 있게 따로 든다 */
  readonly reserved: number;
  /**
   * 상대의 답을 기다리는 **내 요청**이 잡고 있는 자리 (ADR 0038).
   *
   * `reserved` 와 합쳐 내지 않는다. 자리가 찬 것은 같지만 사용자가 할 일이 다르다 —
   * 하나는 기다리면 되고 하나는 보낸 요청을 거두면 된다.
   */
  readonly requested: number;
  readonly available: number;
};

/** DB 의 말을 도메인의 말로 — **칸 이름은 생성 타입이 든다** */
export const readingCreditsFromDb = (row: RpcRow<'my_reading_credits'>): ReadingCredits => ({
  limit: row.credit_limit,
  used: row.used,
  reserved: row.reserved,
  requested: row.requested,
  available: row.available,
});

/**
 * @returns **부속 정보다** — 못 읽으면 값으로 말하고 화면이 그 자리만 생략한다.
 *   문이 성공했고 행이 없는 것은 `null` 이고, 그것은 못 읽은 것과 다르다.
 */
export async function readReadingCredits(
  client: SupabaseClient<Database>,
): Promise<SkippableRead<ReadingCredits | null>> {
  const { data, error } = await client.rpc('my_reading_credits');
  if (error) return unread(error, 'my_reading_credits');

  const row = (data ?? [])[0];
  return read(row === undefined ? null : readingCreditsFromDb(row));
}
