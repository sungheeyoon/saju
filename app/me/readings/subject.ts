import { storedChartOf } from '@/src/lib/input/stored';
import { STEM_INFO, type Element } from '@/src/lib/saju';

import type { supabaseOnServer } from '../../auth/server-client';
import { storedInputsOf } from '../person-input';

type ServerClient = Awaited<ReturnType<typeof supabaseOnServer>>;

/**
 * 풀이 대상 한 사람의 **일간** — 글 화면(`[subject]`) 표지의 색이 여기서 난다.
 *
 * **책장은 이제 이것을 안 부른다**(G-59) — 목록 문(`my_readings()`)이 두 일간을 함께 준다. 글 화면은 사람
 * 목록 화면이 이미 쓰는 두 걸음(`storedInputsOf` → `storedChartOf`)을 그대로 밟는다. 둘 다 그 사람의 지금
 * 명식이라 책장의 초록 표지와 글 화면의 초록 표지가 같은 사람을 가리킨다.
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
