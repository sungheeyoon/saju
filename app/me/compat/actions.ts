'use server';

import { relationOf } from '@/src/lib/people';

import { supabaseOnServer } from '../../auth/server-client';
import { beginReading, type ReadingStart } from '../reading/pipeline';

/**
 * 두 사람의 풀이를 시작한다 — **사이를 먼저 적고 나서.**
 *
 * 둘이 한 누름에서 일어나야 한다. 사이를 따로 저장하게 두면 「골랐는데 안 반영된
 * 글」이 나올 수 있고, 그때 사용자는 자기가 고른 것이 무슨 소용이었는지 알 수 없다.
 *
 * **적는 것이 먼저다.** 시도를 먼저 열면 근거를 조립하는 자리가 옛 값을 읽는다.
 */
export async function startPairReading(
  personA: string,
  personB: string,
  relation: string | null,
  requestKey: string,
): Promise<ReadingStart> {
  const supabase = await supabaseOnServer();

  const { error } = await supabase.rpc('set_pair_relation', {
    p_person_a: personA,
    p_person_b: personB,
    // 모르는 값은 모르는 채로 넘긴다 — 서버 액션은 주소만 알면 아무 값이나 온다.
    p_relation: relationOf(relation),
  });
  if (error) return { ok: false, message: error.message };

  return beginReading({ kind: 'private', personA, personB }, requestKey);
}
