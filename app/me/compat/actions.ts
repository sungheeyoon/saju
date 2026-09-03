'use server';

import { revalidatePath } from 'next/cache';

import { relationOf, type Relation } from '@/src/lib/people';

import { supabaseOnServer } from '../../auth/server-client';
import { missingAnswer, type Query } from '../../query';
import { managedPersonArgs, unsupportedForSaving } from '../../revision';
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


/**
 * 직접 입력한 두 사람을 **저장하고 궁합 풀이로 넘긴다.**
 *
 * ## 왜 저장을 거치는가
 *
 * 「두 사람 직접 입력」 화면은 아무것도 저장하지 않고 브라우저에서 계산한다(ADR 0007).
 * 그래서 AI 풀이가 없었다 — 시도도 잠금도 풀이권도 **대상**에 거는데(ADR 0013), 저장된
 * 것이 없으면 걸 대상이 없다. 대상 없는 시도를 새로 만드는 길도 있었지만 그것은
 * 「잠금은 사람이 아니라 대상에 건다」를 뒤집는 일이고, 그 값으로 얻는 것은 새로고침
 * 하면 사라지는 글 하나다.
 *
 * 그래서 이 화면이 AI 로 가는 길은 **저장 하나**다. 그리고 그렇게 저장하면 다음에 다시
 * 찾아볼 수 있다 — 익명 화면의 결과가 주소를 잃으면 영영 사라지던 것과 갈리는 자리다.
 *
 * ## 여기서 판정하지 않는다
 *
 * 자격도 한도도 판본도 DB 가 든다(`create_pair_for_reading` 이 부르는 셋). 여기서 보는
 * 것은 **모양**뿐이고, 그마저도 사람이 읽을 말로 돌려주려는 것이다(`saveSelfPerson` 과
 * 같은 규율). 한도에 걸리면 **아무도 저장되지 않는다** — 한 트랜잭션이라 그렇다.
 */
export type PairSaved =
  | { ok: true; personA: string; personB: string }
  | { ok: false; message: string };

export async function savePairForReading(
  a: Query,
  b: Query,
  relation: string | null,
): Promise<PairSaved> {
  for (const one of [a, b]) {
    const missing = missingAnswer(one);
    if (missing !== null) return { ok: false, message: missing };

    const unsupported = unsupportedForSaving(one);
    if (unsupported !== null) return { ok: false, message: unsupported };
  }

  const supabase = await supabaseOnServer();

  const { data, error } = await supabase.rpc('create_pair_for_reading', {
    ...prefixed(managedPersonArgs(a, ''), 'a'),
    ...prefixed(managedPersonArgs(b, ''), 'b'),
    // 모르는 값은 모르는 채로 넘긴다 — 서버 액션은 주소만 알면 아무 값이나 온다.
    p_relation: relationOf(relation),
  });

  if (error) return { ok: false, message: error.message };

  const saved = ((data ?? []) as { person_a: string; person_b: string }[])[0];
  if (saved === undefined) return { ok: false, message: '두 사람을 저장하지 못했습니다.' };

  revalidatePath('/me/people');
  revalidatePath('/me/compat');

  return { ok: true, personA: saved.person_a, personB: saved.person_b };
}

/**
 * 인자 한 벌에 누구 것인지를 붙인다 — **이름을 손으로 다시 적지 않는다.**
 *
 * `p_local_label` 을 `p_a_local_label` 로 스무 번 옮겨 적으면, 등록이 받는 칸이 하나
 * 늘어나는 날 이 자리만 안 고쳐진다. 붙이는 규칙 하나만 적는다.
 */
const prefixed = <T extends Record<string, unknown>>(
  args: T,
  side: 'a' | 'b',
): Record<string, unknown> =>
  Object.fromEntries(
    Object.entries(args).map(([key, value]) => [key.replace(/^p_/, `p_${side}_`), value]),
  );
