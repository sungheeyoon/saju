'use server';

import { revalidatePath } from 'next/cache';

import { relationOf, type Relation } from '@/src/lib/people';

import { supabaseOnServer } from '../../auth/server-client';
import { sameChartInMyList, type SameChart } from '../same-chart';
import { missingAnswer, type Query } from '@/src/lib/input/query';
import { managedPersonArgs, unsupportedForSaving } from '@/src/lib/input/revision';

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
 * 고른 두 사람으로 **궁합 화면을 연다** — 저장하지 않고.
 *
 * ## 두 칸이 각자 어디서 오든 상관없다
 *
 * 한 칸은 저장한 사람에서 고를 수도 있고 직접 적을 수도 있다. 화면이 그 둘을 나눠 놓고
 * 있었는데(탭 둘), 나뉜 것은 **사람이 아니라 입력 방법**이라 「내 사주 × 직접 적은 그
 * 사람」 같은 흔한 조합이 갈 곳이 없었다.
 *
 * 여기서는 칸마다 답이 둘 중 하나다 — **이미 있는 사람의 id**이거나 **적어 넣은 입력**.
 * 뒤엣것은 이 자리에서 사람으로 굳는데, **사람 목록에 안 서고 열 자리도 안 쓴다**
 * (`listed = false`, ADR 0053). 시도도 잠금도 풀이권도 대상에 걸리므로(ADR 0013)
 * 대상은 있어야 하고, 사용자가 저장한 적 없는 것이 목록에 설 이유는 없다.
 *
 * ## 여기서 글은 안 만든다
 *
 * 이 누름이 여는 것은 **두 명식이 나란히 선 화면**이고, 글을 만드는 누름은 거기 있다.
 * 되돌릴 수 없는 누름을 대신 눌러 주지 않는다(ADR 0028) — 여기서 만들어 버리면 명식을
 * 보러 온 사람이 풀이권을 쓰게 된다.
 *
 * ## 여기서 판정하지 않는다
 *
 * 자격도 한도도 판본도 DB 가 든다(`create_pair_for_reading` 이 부르는 셋). 여기서 보는
 * 것은 **모양**뿐이고, 그마저도 사람이 읽을 말로 돌려주려는 것이다(`saveSelfPerson` 과
 * 같은 규율).
 */

/**
 * 한 칸의 답 — **고른 사람**이거나 **적어 넣은 입력**이다.
 *
 * 두 갈래를 한 타입으로 두는 것이 요점이다. 「id 아니면 입력」을 두 인자로 받으면 둘 다
 * 온 경우와 둘 다 안 온 경우가 생기고, 그 둘을 부르는 쪽마다 다르게 처리한다.
 */
export type PairSide =
  | { readonly from: 'saved'; readonly personId: string }
  | { readonly from: 'typed'; readonly query: Query };

/**
 * 어느 쪽이 이미 저장돼 있나 — **한쪽씩 답한다.**
 *
 * 둘 다 이미 있을 수 있으므로 물음도 두 번 갈 수 있다. 한 번에 둘을 물으면 화면이
 * 「첫 번째는 맞고 두 번째는 아니다」를 한 칸에 담아야 하고, 그 칸은 누구도 안 읽는다.
 */
export type PairOpened =
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

export async function openPairScreen(
  a: PairSide,
  b: PairSide,
  /**
   * 이 화면에서 고른 사이 — **`undefined` 는 「안 건드렸다」다.**
   *
   * 「모른다」(`null`)와 갈라야 한다. 칸이 늘 「아직 모르겠음」에서 시작하므로, 안 건드린
   * 것을 답으로 읽으면 지난번에 적어 둔 답이 **화면을 지나가는 것만으로** 지워진다.
   */
  relation: Relation | null | undefined,
  answered: PairAnswers = {},
): Promise<PairOpened> {
  for (const side of [a, b]) {
    if (side.from !== 'typed') continue;

    const missing = missingAnswer(side.query);
    if (missing !== null) return { ok: false, kind: 'failed', message: missing };

    const unsupported = unsupportedForSaving(side.query);
    if (unsupported !== null) return { ok: false, kind: 'failed', message: unsupported };
  }

  /**
   * **아직 안 물은 쪽만 묻는다.** 답한 쪽을 다시 물으면 「아니다」라고 답한 사람이 같은
   * 물음을 영영 다시 받는다.
   *
   * **묻는 것은 목록에 선 사람일 때뿐이다.** 궁합만 보려고 만들어 둔 사람은 목록에
   * 없어서 물어도 확인할 데가 없다 — 그때는 묻지 않고 그 사람을 그대로 쓴다. 새로
   * 만들면 같은 두 사람의 궁합이 대상 두 벌로 갈리고, 풀이 목록에 같은 쌍이 두 줄 선다.
   */
  const use: { a?: string | null; b?: string | null } = { ...answered };

  for (const [key, side] of [
    ['a', a],
    ['b', b],
  ] as const) {
    if (side.from === 'saved') {
      use[key] = side.personId;
      continue;
    }
    if (use[key] !== undefined) continue;

    const same = await sameChartInMyList(side.query);
    if (same === null) continue;
    if (same.listed) return { ok: false, kind: 'same-chart', side: key, same };

    use[key] = same.personId;
  }

  const supabase = await supabaseOnServer();

  const { data, error } = await supabase.rpc('create_pair_for_reading', {
    /*
      **고른 사람 쪽에는 입력을 안 보낸다.** id 가 있으면 문이 그 사람을 쓰고 나머지
      인자를 안 본다 — 거기에 아무 값이나 채워 보내면 그 문을 읽는 사람이 「이 값이
      어딘가에 쓰이나」를 다시 확인해야 한다.
    */
    ...prefixed(argsFor(a), 'a'),
    ...prefixed(argsFor(b), 'b'),
    // 모르는 값은 모르는 채로 넘긴다 — 서버 액션은 주소만 알면 아무 값이나 온다.
    p_relation: relation === undefined ? null : relationOf(relation),
    p_a_person: use.a ?? null,
    p_b_person: use.b ?? null,
    /* 목록에 안 세운다 — 이 누름은 궁합을 보려는 것이지 사람을 저장하려는 것이 아니다 */
    p_listed: false,
  });

  if (error) return { ok: false, kind: 'failed', message: error.message };

  const pair = ((data ?? []) as { person_a: string; person_b: string }[])[0];
  if (pair === undefined) {
    return { ok: false, kind: 'failed', message: '두 사람의 궁합을 열지 못했습니다.' };
  }

  /**
   * **「모른다」로 되돌리는 것도 답이다.** 문은 사이를 적기만 하고 지우지는 않으므로
   * (`null` 이면 아무것도 안 한다), 사용자가 이 화면에서 「아직 모르겠음」을 고른 경우는
   * 여기서 지운다. 안 건드렸으면(`undefined`) 적어 둔 답은 그대로 둔다.
   */
  if (relation === null) {
    const cleared = await supabase.rpc('set_pair_relation', {
      p_person_a: pair.person_a,
      p_person_b: pair.person_b,
      p_relation: null,
    });
    if (cleared.error) return { ok: false, kind: 'failed', message: cleared.error.message };
  }

  revalidatePath('/me/compat');

  return { ok: true, personA: pair.person_a, personB: pair.person_b };
}

/** 고른 사람이면 입력 자리는 비운다 — 문이 그 자리를 안 본다 */
const argsFor = (side: PairSide): Record<string, unknown> =>
  side.from === 'typed'
    ? managedPersonArgs(side.query, '')
    : {
        p_local_label: null,
        p_note: null,
        p_calendar: null,
        p_original_date: null,
        p_solar_date: null,
        p_birth_time: null,
        p_gender: null,
        p_city: null,
        p_late_night_rule: null,
        p_time_basis: null,
      };

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
