'use server';

import { revalidatePath } from 'next/cache';

import { relationOf, type Relation } from '@/src/lib/people';

import { supabaseOnServer } from '../../auth/server-client';
import { sameChartInMyList, type SameChart } from '../same-chart';
import { missingAnswer, type Query } from '../../query';
import { managedPersonArgs, unsupportedForSaving } from '../../revision';

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
/**
 * 어느 쪽이 이미 저장돼 있나 — **한쪽씩 답한다.**
 *
 * 둘 다 이미 있을 수 있으므로 물음도 두 번 갈 수 있다. 한 번에 둘을 물으면 화면이
 * 「첫 번째는 맞고 두 번째는 아니다」를 한 칸에 담아야 하고, 그 칸은 누구도 안 읽는다.
 */
export type PairSaved =
  | { ok: true; personA: string; personB: string }
  | { ok: false; kind: 'failed'; message: string }
  | { ok: false; kind: 'same-chart'; side: 'a' | 'b'; same: SameChart };

/**
 * 사용자가 「같은 사람이다」라고 답한 쪽 — **그쪽은 만들지 않고 있는 것을 쓴다.**
 *
 * `null` 이면 아직 안 물었거나 「아니다」라고 답한 것이고, 그때는 새로 만든다.
 * 확인은 DB 가 한 번 더 한다(`person_for_pair` — 내 목록에 없는 id 는 거절된다).
 */
export type PairAnswers = { readonly a?: string | null; readonly b?: string | null };

export async function savePairForReading(
  a: Query,
  b: Query,
  relation: string | null,
  answered: PairAnswers = {},
): Promise<PairSaved> {
  for (const one of [a, b]) {
    const missing = missingAnswer(one);
    if (missing !== null) return { ok: false, kind: 'failed', message: missing };

    const unsupported = unsupportedForSaving(one);
    if (unsupported !== null) return { ok: false, kind: 'failed', message: unsupported };
  }

  /**
   * **아직 안 물은 쪽만 묻는다.** 답한 쪽을 다시 물으면 「아니다」라고 답한 사람이 같은
   * 물음을 영영 다시 받는다.
   */
  for (const [side, query, answer] of [
    ['a', a, answered.a],
    ['b', b, answered.b],
  ] as const) {
    if (answer !== undefined) continue;

    const same = await sameChartInMyList(query);
    if (same !== null) return { ok: false, kind: 'same-chart', side, same };
  }

  const supabase = await supabaseOnServer();

  const { data, error } = await supabase.rpc('create_pair_for_reading', {
    ...prefixed(managedPersonArgs(a, ''), 'a'),
    ...prefixed(managedPersonArgs(b, ''), 'b'),
    // 모르는 값은 모르는 채로 넘긴다 — 서버 액션은 주소만 알면 아무 값이나 온다.
    p_relation: relationOf(relation),
    p_a_person: answered.a ?? null,
    p_b_person: answered.b ?? null,
  });

  if (error) return { ok: false, kind: 'failed', message: error.message };

  const saved = ((data ?? []) as { person_a: string; person_b: string }[])[0];
  if (saved === undefined) {
    return { ok: false, kind: 'failed', message: '두 사람을 저장하지 못했습니다.' };
  }

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
