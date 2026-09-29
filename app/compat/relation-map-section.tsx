import { storedChartOf } from '@/src/lib/input/stored';

import { supabaseOnServer } from '../auth/server-client';
import { myCircle } from '../me/home/circle';
import { mapModelOf, type HomePerson } from '../me/home/map/model';
import { RelationMap } from '../me/home/map/relation-map';
import { storedInputOf, storedInputsOf } from '../me/person-input';
import type { ReadingEntry } from '../me/reading/current';
import { compatTabMap } from './map-links';

/**
 * **궁합 탭의 관계 지도** — 고르는 칸과 궁합풀이 한 줄 아래, 폰의 첫 화면 밖이다(「2026-09-29 u2」).
 *
 * 저장한 사람 타일은 나 탭이 든다 — 여기는 지도 하나다. 지도의 선이 궁합이고 카드의 「궁합 보러 가기」가 위의 두 칸을
 * 채우므로(`CompatFillLink`) 지도는 궁합 탭에 남는다. **가운데는 나다** — 내 명식을 못 세우면 지도를 안 그린다(모르는
 * 출생지를 서울로 메워 다른 사주를 가운데에 세우지 않는다).
 *
 * 왕복은 둘이다 — 엣지 · 자리 수와 내 입력을 겹쳐 읽고, 사람들의 입력은 엣지를 알아야 하므로 뒤에 묶어 읽는다.
 */
export async function CompatRelationMap({
  selfPersonId,
  readings,
}: {
  selfPersonId: string;
  readings: readonly ReadingEntry[];
}) {
  const supabase = await supabaseOnServer();

  const [circle, self] = await Promise.all([myCircle(supabase, selfPersonId), storedInputOf(supabase, selfPersonId)]);
  if (self === null || circle.self === null) return null;
  const stood = storedChartOf(self.input, circle.self.label);
  if (!stood.ok) return null;

  const inputs = await storedInputsOf(
    supabase,
    circle.people.map((person) => person.personId),
  );
  const people: HomePerson[] = circle.people.map((edge) => {
    const stored = inputs.get(edge.personId);
    /* 입력이 없는 사람 — 읽을 것이 없다는 말과 못 읽는다는 말을 여기서 합친다(저장한 사람 화면과 같다) */
    const chart =
      stored === undefined
        ? ({ ok: false, message: '저장된 출생 정보를 읽지 못했습니다.' } as const)
        : storedChartOf(stored, edge.label);
    return {
      personId: edge.personId,
      label: edge.label,
      note: edge.note,
      chart: chart.ok ? { ok: true, saju: chart.saju } : { ok: false, message: chart.message },
    };
  });

  return (
    <RelationMap
      model={compatTabMap(mapModelOf({ self: { personId: selfPersonId, label: stood.query.name, saju: stood.saju }, people, readings }))}
      addHref="/me/people"
      canAdd={circle.slots === null || circle.slots.remaining > 0}
    />
  );
}
