'use server';

import { relationOf, type Relation } from '@/src/lib/people';

import { supabaseOnServer } from '../../auth/server-client';
import { beginReading, type ReadingStart } from '../reading/pipeline';

/**
 * 이 쌍에 적어 둔 사이 — **화면이 저장된 값을 보여 주려고 읽는다.**
 *
 * 고르는 칸이 늘 「아직 모르겠음」에서 시작했다. 그래서 지난번에 「가족」이라 답한
 * 두 사람을 다시 고르면 화면이 **거짓말을 하고 있었고**, 그대로 누르면 그 답이 지워졌다
 * (`set_pair_relation` 은 `null` 을 지우기로 읽는다).
 *
 * **못 읽은 것과 「모른다」를 한 값으로 내지 않는다.** 둘을 `null` 로 합치면 읽기가
 * 실패한 순간 화면이 「모른다」로 서고, 그다음 누름이 멀쩡한 값을 지운다.
 */
export type PairRelationRead = { ok: true; relation: Relation | null } | { ok: false };

export async function pairRelationFor(
  personA: string,
  personB: string,
): Promise<PairRelationRead> {
  const supabase = await supabaseOnServer();

  const { data, error } = await supabase.rpc('pair_relation_of', {
    p_person_a: personA,
    p_person_b: personB,
  });

  if (error) return { ok: false };

  return { ok: true, relation: relationOf(data) };
}

/**
 * 두 사람의 풀이를 시작한다 — **사이를 먼저 적고 나서.**
 *
 * 둘이 한 누름에서 일어나야 한다. 사이를 따로 저장하게 두면 「골랐는데 안 반영된
 * 글」이 나올 수 있고, 그때 사용자는 자기가 고른 것이 무슨 소용이었는지 알 수 없다.
 *
 * **적는 것이 먼저다.** 시도를 먼저 열면 근거를 조립하는 자리가 옛 값을 읽는다.
 *
 * ## `undefined` 는 안 적는다
 *
 * 「모른다를 골랐다」와 **「이 누름에서 사이를 안 정했다」**는 다른 일이다. 앞의 것은
 * 행을 지우는 답이고 뒤의 것은 아무 답도 아니다. 한 값으로 묶여 있던 동안, 저장된
 * 답이 있는 쌍을 다시 고르기만 해도 그 답이 조용히 지워졌다.
 *
 * 저장되는 값은 그대로 둘뿐이다 — 행이 있거나 없거나(ADR 0019). 갈린 것은 **이번
 * 누름이 그 값을 건드리는가**이고, 그것은 저장 값이 아니라 쓰기의 일이다.
 */
export async function startPairReading(
  personA: string,
  personB: string,
  relation: string | null | undefined,
  requestKey: string,
): Promise<ReadingStart> {
  const supabase = await supabaseOnServer();

  if (relation !== undefined) {
    const { error } = await supabase.rpc('set_pair_relation', {
      p_person_a: personA,
      p_person_b: personB,
      // 모르는 값은 모르는 채로 넘긴다 — 서버 액션은 주소만 알면 아무 값이나 온다.
      p_relation: relationOf(relation),
    });
    if (error) return { ok: false, message: error.message };
  }

  return beginReading({ kind: 'private', personA, personB }, requestKey);
}
