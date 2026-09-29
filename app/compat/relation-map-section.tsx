import { storedChartOf } from '@/src/lib/input/stored';

import { circleOf } from '../me/home/circle-view';
import { mapModelOf } from '../me/home/map/model';
import { RelationMap } from '../me/home/map/relation-map';
import type { ReadingEntry } from '../me/reading/current';
import { compatTabMap } from './map-links';

/**
 * **궁합 탭의 관계 지도** — 고르는 칸과 궁합풀이 한 줄 아래, 폰의 첫 화면 밖이다(ADR 0129 「2026-09-29 u2」).
 *
 * 저장한 사람 타일은 나 탭이 든다 — 여기는 지도 하나다. 지도의 선이 궁합이고 카드의 「궁합 보러 가기」가 위의 두 칸을
 * 채우므로(`CompatFillLink`) 지도는 궁합 탭에 남는다. 읽는 것은 나 탭의 타일과 같은 문이다(`circleOf`).
 *
 * **가운데는 나다** — 내 명식을 못 세우면 지도를 안 그린다. 모르는 출생지를 서울로 메워 다른 사주를 가운데에 세우지 않는다.
 * 내 사주를 못 읽었다는 말은 나 탭의 카드 자리가 한다.
 */
export async function CompatRelationMap({
  selfPersonId,
  readings,
}: {
  selfPersonId: string;
  readings: readonly ReadingEntry[];
}) {
  const { circle, self, people } = await circleOf(selfPersonId);
  if (self === null || circle.self === null) return null;
  const stood = storedChartOf(self.input, circle.self.label);
  if (!stood.ok) return null;

  return (
    <RelationMap
      model={compatTabMap(mapModelOf({ self: { personId: selfPersonId, label: stood.query.name, saju: stood.saju }, people, readings }))}
      addHref="/me/people"
      canAdd={circle.slots === null || circle.slots.remaining > 0}
    />
  );
}
