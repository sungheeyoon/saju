import {
  HIDDEN_STEMS,
  findStemCombination,
  type Branch,
  type Element,
  type HiddenStemRole,
  type Stem,
} from '../constants';
import type { Pillars } from '../pillars';
import { PILLAR_POSITIONS, PILLAR_POSITION_INDEX, PILLAR_POSITION_KO, type PillarPosition } from '../position';

/**
 * 암합(暗合) — **드러나지 않은 자리에서 맺히는 합.**
 *
 * 관계 연산은 지장간을 보지 않는다. 그 판단에는 이유가 적혀 있다 — 「암합은
 * 성립 조건 자체가 갈리고, 넣는 순간 관계 수가 폭증해 대조군을 만들 수 없다」.
 * 그 말은 지금도 맞다. 그래서 여기로 옮기고 관계 표에는 넣지 않는다.
 *
 * **관계 표에 섞지 않는 것이 이 파일의 요점이다.** 골든 명식에서 암합은 한
 * 명식에 0에서 11 건, 가운데가 여섯이다 — 드러난 형충회합보다 대체로 많다.
 * 둘을 한 목록에 담으면 드러난 관계가 숨은 관계에 파묻히고, 「이 명식의 관계」라는
 * 말이 뜻을 잃는다. 그 숫자는 골든 스냅샷의 `암합` 줄이 직접 보여 준다.
 *
 * 두 갈래를 낸다.
 *
 *   명암합(明暗合)  드러난 천간이 다른 자리의 지장간과 맺는다
 *   암암합(暗暗合)  지장간끼리 맺는다 — 양쪽 다 드러나지 않았다
 *
 * **표를 따로 두지 않는다.** 지지끼리의 암합을 卯申·午亥처럼 표로 적는 계통이
 * 있는데, 그 표는 지장간과 천간합에서 유도된 것이다. 유도할 수 있는 것을 표로
 * 적으면 두 벌이 되고 어긋난 쪽을 알 수 없다.
 *
 * **성립 여부는 판정하지 않는다.** 관계 연산이 「합이 성사되었다」를 말하지
 * 않는 것과 같다. 여기서는 한 걸음 더 물러서 있다 — 드러난 합조차 化를 등급으로
 * 가르는데(`transformation.ts`), 숨은 합을 이뤘다고 말할 근거는 더 없다.
 */

export const HIDDEN_RELATION_POLICY = {
  ruleSet: 'hidden-combination-facts-v1',
  /** 사실만 낸다 — 성립도 화(化)도 판정하지 않는다 */
  status: 'facts-only',
  /** 지지암합 표를 따로 두지 않고 지장간 × 천간합에서 유도한다 */
  derivation: 'hidden-stems-times-stem-combination-table',
  /** 관계 표(`relations/index.ts`)에는 넣지 않는다 */
  mergedIntoRelations: false,
  /** 같은 기둥 안의 천간과 그 지지의 지장간은 세지 않는다 */
  withinSamePillar: 'excluded',
  /** 거리를 조건으로 걸지 않는다 — 인접 여부만 표시한다 */
  adjacency: 'marked-not-filtered',
  /** 골든 명식에서 센 건수. 관계 표에 섞지 않는 이유가 이 숫자다 */
  observedPerChart: '0-11',
} as const;

export type HiddenCombinationKind =
  /** 드러난 천간이 다른 자리의 지장간과 맺는다 */
  | 'revealedToHidden'
  /** 지장간끼리 맺는다 */
  | 'hiddenToHidden';

export const HIDDEN_COMBINATION_KIND_KO: Record<HiddenCombinationKind, string> = {
  revealedToHidden: '명암합',
  hiddenToHidden: '암암합',
};

/** 합에 참여한 글자 하나 */
export type HiddenParticipant = {
  position: PillarPosition;
  stem: Stem;
  /** 지지에 숨어 있으면 그 지지와 역할·일수, 천간에 드러나 있으면 `null` */
  hidden: { branch: Branch; role: HiddenStemRole; days: number } | null;
};

export type HiddenCombination = {
  status: 'facts-only';
  kind: HiddenCombinationKind;
  /** 합의 한글 이름 — 천간합 표에서 그대로 온다 */
  ko: string;
  /**
   * 이 합이 지향하는 오행.
   *
   * `result` 가 아니라 `targetElement` 인 이유는 관계 연산과 같다. 글자가 만났다는
   * 사실이 化를 뜻하지 않는다. 드러난 합조차 등급으로 가르는데 숨은 합은 더 그렇다.
   */
  targetElement: Element;
  participants: readonly [HiddenParticipant, HiddenParticipant];
  /** 두 기둥이 붙어 있는가 */
  adjacent: boolean;
  /** 몇 칸 떨어져 있는가 */
  distance: number;
  /** 화면에 그대로 쓸 수 있는 한 줄 */
  detail: string;
};

type HiddenRelationInput = Pick<Pillars, 'year' | 'month' | 'day' | 'hour'>;

type Slot = { position: PillarPosition; stem: Stem; hidden: HiddenParticipant['hidden'] };

/** 여덟(시간 미상이면 여섯) 글자를 천간과 지장간으로 모두 펼친다 */
function slotsOf(pillars: HiddenRelationInput): Slot[] {
  return PILLAR_POSITIONS.flatMap((position): Slot[] => {
    const pillar = pillars[position];
    if (pillar === null) return [];

    return [
      { position, stem: pillar.stem, hidden: null },
      ...HIDDEN_STEMS[pillar.branch].map(
        (entry): Slot => ({
          position,
          stem: entry.stem,
          hidden: { branch: pillar.branch, role: entry.role, days: entry.days },
        }),
      ),
    ];
  });
}

const describe = (slot: Slot): string =>
  slot.hidden === null
    ? `${PILLAR_POSITION_KO[slot.position]} ${slot.stem}`
    : `${PILLAR_POSITION_KO[slot.position]} ${slot.hidden.branch} 속 ${slot.stem}`;

/**
 * 원국의 암합을 모두 낸다.
 *
 * 같은 기둥 안(천간과 제 지지의 지장간)은 세지 않는다. 년간 甲과 년지 寅 속 己는
 * 「만났다」고 할 것이 없는 한 몸이고, 그것까지 세면 거의 모든 명식이 암합
 * 몇 개씩을 달게 된다.
 *
 * 드러난 천간끼리의 합은 여기 없다 — 그쪽은 관계 표와 `transformation.ts` 의
 * 몫이다. 같은 사실을 두 곳에서 내면 어긋난 쪽을 알 수 없다.
 */
export function hiddenCombinationsOf(pillars: HiddenRelationInput): HiddenCombination[] {
  const slots = slotsOf(pillars);
  const found: HiddenCombination[] = [];

  for (let i = 0; i < slots.length; i += 1) {
    for (let j = i + 1; j < slots.length; j += 1) {
      const a = slots[i];
      const b = slots[j];

      // 한 몸인 자리는 만난 것이 아니다.
      if (a.position === b.position) continue;
      // 드러난 천간끼리는 관계 표가 이미 낸다.
      if (a.hidden === null && b.hidden === null) continue;

      const combination = findStemCombination(a.stem, b.stem);
      if (combination === null) continue;

      const distance = Math.abs(
        PILLAR_POSITION_INDEX[a.position] - PILLAR_POSITION_INDEX[b.position],
      );
      const kind: HiddenCombinationKind =
        a.hidden === null || b.hidden === null ? 'revealedToHidden' : 'hiddenToHidden';

      found.push({
        status: 'facts-only',
        kind,
        ko: combination.ko,
        targetElement: combination.result,
        participants: [
          { position: a.position, stem: a.stem, hidden: a.hidden },
          { position: b.position, stem: b.stem, hidden: b.hidden },
        ],
        adjacent: distance === 1,
        distance,
        detail: `${describe(a)} · ${describe(b)} — ${combination.ko}(${HIDDEN_COMBINATION_KIND_KO[kind]})`,
      });
    }
  }

  return found;
}
