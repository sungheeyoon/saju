import { storedChartOf } from '@/src/lib/input/stored';
import { STEM_INFO, type Element } from '@/src/lib/saju';

import type { supabaseOnServer } from '../../../auth/server-client';
import { dbFailure } from '../../../db-error';
import { UUID } from '../../../uuid';
import { storedInputsOf } from '../../person-input';

type ServerClient = Awaited<ReturnType<typeof supabaseOnServer>>;

/**
 * 풀이 대상 한 사람의 **일간** — 글 화면(`[subject]`) 표지의 색이 여기서 난다.
 *
 * **책장은 이제 이것을 안 부른다**(G-59) — 목록 문(`my_readings()`)이 두 일간을 함께 준다. 글 화면은 사람
 * 목록 화면이 이미 쓰는 두 걸음(`storedInputsOf` → `storedChartOf`)을 그대로 밟는다. 둘 다 그 사람의 지금
 * 명식이다. **표지 색은 여기서 안 난다** — 책장과 글 화면의 표지는 풀이를 만들 때의 일간을 입는다(2026-09-25,
 * `my_readings` · `my_reading`). 이 값은 글이 없을 때의 표지와 머리 딱지만 쓴다.
 *
 * **못 읽은 사람은 지도에 없다.** 입력이 비었거나 지금 엔진이 못 읽는 판본이면 그 사람의 표지는 회색
 * (`tone-none`)으로 선다 — 색을 지어 넣지 않는다. 인연 궁합의 상대처럼 정책이 안 보여 주는 사람도 같다.
 */
export type DayMaster = { readonly stem: string; readonly element: Element };

export async function dayMastersOf(
  supabase: ServerClient,
  personIds: readonly string[],
): Promise<ReadonlyMap<string, DayMaster>> {
  const unique = [...new Set(personIds)];
  const inputs = await storedInputsOf(supabase, unique);

  const found = new Map<string, DayMaster>();
  for (const [personId, input] of inputs) {
    /* 이름은 계산에 닿지 않는다 — 일간만 쓰므로 빈 이름으로 세운다 */
    const chart = storedChartOf(input, '');
    if (!chart.ok) continue;
    const stem = chart.saju.pillars.dayMaster;
    found.set(personId, { stem, element: STEM_INFO[stem].element });
  }
  return found;
}

/** 글 화면이 머리에 세우는 저장한 사람 — 사람 id 와 내가 부르는 이름(localLabel) */
export type SavedPerson = { readonly personId: string; readonly localLabel: string };

/**
 * 주소의 `[subject]` 가 가리키는 **내가 저장한 사람.**
 *
 * @returns 내 목록에 있으면 그 사람, **없거나 못 보면 `null`** — 화면은 404 를 세운다. 주소로 들어온 값이라
 *   모양부터 본다: 형식이 틀린 것도 「없는 사람」이다(`payloadForViewer` 와 같다). 안 보면 DB 가 uuid 형식으로
 *   거절하고, 그 거절이 아래에서 오류 화면이 된다.
 * @throws 읽기가 실패하면 `dbFailure` — 못 읽은 것은 「없는 사람」이 아니다(ADR 0078). 앞서는 화면이 `error` 를
 *   버려 DB 실패가 404 로 섰다.
 */
export async function savedPersonOf(supabase: ServerClient, personId: string): Promise<SavedPerson | null> {
  if (!UUID.test(personId)) return null;

  /* 정책이 자기 것만 내주므로 `user_id` 를 적지 않는다(ADR 0004) */
  const { data, error } = await supabase
    .from('user_person_access')
    .select('person_id, local_label')
    .eq('person_id', personId)
    .maybeSingle();
  if (error) throw dbFailure(error, 'user_person_access.reading_subject');
  if (data === null) return null;

  return { personId: data.person_id, localLabel: data.local_label };
}
