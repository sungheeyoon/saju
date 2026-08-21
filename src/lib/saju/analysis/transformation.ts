import {
  CONTROLLED_BY,
  GENERATED_BY,
  HIDDEN_STEMS,
  STEM_COMBINATIONS,
  STEM_INFO,
  findStemClash,
  findStemCombination,
  principalStem,
  type Element,
  type Stem,
} from '../constants';
import type { Pillars } from '../pillars';
import { PILLAR_POSITIONS, PILLAR_POSITION_INDEX, type PillarPosition } from '../position';

/**
 * 합화(合化) — 천간합이 **정말 다른 오행으로 변했는가.**
 *
 * `relations/index.ts` 는 「합이 성사되었다」를 말하지 않는다. 그것이 맞다 —
 * 관계 열거는 사실을 세는 자리이고, 화(化)는 조건 판정이라 계통이 갈린다.
 * 그런데 갈린다는 이유로 아예 보지 않으면 **종격이 못 잡는 자리가 생긴다.**
 * 丁壬합목으로 목이 서는 명식을 목 없는 명식으로 세면 그 명조는 영영 안 잡힌다.
 *
 * 그래서 여기서는 갈리는 지점을 문턱이 아니라 **등급**으로 낸다. 化했다·안
 * 했다 둘로 자르면 경계에 선 명식이 한쪽으로 반올림되므로, 고전이 실제로
 * 구분하는 세 자리를 그대로 쓴다.
 *
 *   化    조건을 다 채웠다 — 두 글자가 화신의 오행으로 선다
 *   조건부 인접하고 다툼도 없는데 월령이 받쳐주지 않았다 — 운에서 化할 자리다
 *   合而不化 묶이기만 했다 — 화신으로 세지 않는다
 *
 * 「합이불화(合而不化)」는 우리가 지어낸 등급이 아니라 《적천수천미》가 쓰는
 * 말이다. 묶였다는 사실과 변했다는 판정이 다르다는 것을 고전이 이미 이름으로
 * 갈라 두었다.
 *
 * **지지의 합은 여기서 보지 않는다** — 삼합·방합은 두 글자가 다른 글자가 되는
 * 것이 아니라 여럿이 한 세력으로 서는 것이라 셈이 다르다. `bureau.ts` 가 맡는다.
 */

export const TRANSFORMATION_POLICY = {
  ruleSet: 'stem-transformation-v1',
  /** 고전이 정한 값이 아니라 이 엔진의 실험 규칙이다 */
  status: 'experimental',
  /**
   * 붙어 있어야 化한다.
   *
   * 관계 열거가 거리를 조건으로 걸지 않는 것과 어긋나지 않는다 — 거기서는
   * 사실을 지우지 않으려고 다 냈고, 여기서는 그 사실 위에서 판정한다.
   * 떨어진 합도 `facts` 에 그대로 남고 등급만 `bound` 가 된다.
   */
  adjacencyRequired: true,
  /**
   * 월령이 화신이어야 진짜 化다. 화신을 생하기만 하는 월령은 한 등급 아래로 둔다.
   *
   * 「化之真者，month令 得其氣」 계열의 통설을 좁게 잡은 것이다. 넓게 잡는
   * 계통(화신이 지지에 통근하기만 하면 化로 보는 쪽)은 `conditional` 을 化로
   * 읽으면 된다 — 등급을 남겨 두었으므로 계통을 바꿔도 되살릴 수 있다.
   */
  monthCommandRequired: 'for-true-transformation',
  /** 쟁합·투합이면 化하지 않는다 — 한 글자를 둘이 물면 어느 쪽도 못 변한다 */
  contestBlocks: true,
  /** 화신을 극하는 천간이 남아 있으면 化하지 않는다 */
  controllingStemBlocks: true,
  /**
   * 일간이 합에 참여하면 통근 여부를 본다.
   *
   * 뿌리가 있는 일간은 기댈 데가 있어 변하지 않는다(「合而不化」). 화격(化格)의
   * 성립 조건이기도 하다 — 다만 화격 자체는 여기서 판정하지 않는다.
   */
  dayMasterRootBlocks: true,
} as const;

/** 화(化)의 세 등급 */
export type TransformationVerdict =
  /** 조건을 다 채웠다 — 두 글자를 화신의 오행으로 센다 */
  | 'transformed'
  /** 인접하고 다툼도 없으나 월령이 받쳐주지 않았다 */
  | 'conditional'
  /** 묶이기만 했다 — 화신으로 세지 않는다 */
  | 'bound';

export const TRANSFORMATION_VERDICT_KO: Record<TransformationVerdict, string> = {
  transformed: '합화',
  conditional: '조건부 합화',
  bound: '합이불화',
};

/** 化를 막은 이유 — 등급만 보고는 왜 안 됐는지 알 수 없다 */
export type TransformationBlocker =
  /** 두 글자가 붙어 있지 않다 */
  | 'notAdjacent'
  /** 한 글자를 둘이 다툰다 — 쟁합·투합 */
  | 'contested'
  /** 월령이 화신이 아니다 */
  | 'monthDoesNotCommand'
  /** 화신을 극하는 천간이 남아 있다 */
  | 'controlledStemPresent'
  /** 참여한 천간이 충을 맞고 있다 */
  | 'participantClashed'
  /** 일간이 통근해 있어 변할 까닭이 없다 */
  | 'dayMasterRooted';

export const TRANSFORMATION_BLOCKER_KO: Record<TransformationBlocker, string> = {
  notAdjacent: '떨어져 있음',
  contested: '쟁합·투합',
  monthDoesNotCommand: '월령이 화신이 아님',
  controlledStemPresent: '화신을 극하는 천간',
  participantClashed: '참여한 천간이 충을 맞음',
  dayMasterRooted: '일간이 통근함',
};

export type StemTransformation = {
  /** 실험 규칙임을 값으로 못박는다 */
  status: 'experimental';
  verdict: TransformationVerdict;
  ko: string;
  /** 합이 지향하는 오행 — 化했든 아니든 같다 */
  target: Element;
  participants: readonly { position: PillarPosition; stem: Stem }[];
  /** 무엇이 化를 막았는가. 빈 배열이면 `transformed` 다 */
  blockers: readonly TransformationBlocker[];
  /** 일간이 이 합에 물려 있는가 — 화격 여부를 묻는 쪽이 가장 먼저 본다 */
  involvesDayMaster: boolean;
  /** 판정의 재료 */
  facts: {
    adjacent: boolean;
    /** 월지 정기의 오행이 화신인가 */
    monthCommandsTarget: boolean;
    /** 월지 정기가 화신을 생하는가 — 월령의 한 등급 아래 지원 */
    monthGeneratesTarget: boolean;
    /** 화신이 지지 어디엔가 뿌리를 두는가 (지장간까지 본다) */
    targetRootedInBranches: boolean;
    /** 화신을 극하는, 합에 끼지 않은 천간들 */
    controllingStems: readonly { position: PillarPosition; stem: Stem }[];
    /** 참여한 글자를 두고 겨루는 제3의 천간들 */
    rivals: readonly { position: PillarPosition; stem: Stem }[];
    /** 일간이 참여한 경우 일간의 통근 여부. 끼지 않았으면 null */
    dayMasterRooted: boolean | null;
  };
};

type TransformationInput = Pick<Pillars, 'year' | 'month' | 'day' | 'hour' | 'dayMaster'>;

type Slot = { position: PillarPosition; stem: Stem };

const slotsOf = (pillars: TransformationInput): Slot[] =>
  PILLAR_POSITIONS.flatMap((position) => {
    const pillar = pillars[position];
    return pillar === null ? [] : [{ position, stem: pillar.stem }];
  });

/** 화신이 지지 지장간 어디엔가 있는가 — 뿌리 없는 화신은 설 자리가 없다 */
function targetRooted(pillars: TransformationInput, target: Element): boolean {
  return PILLAR_POSITIONS.some((position) => {
    const pillar = pillars[position];
    if (pillar === null) return false;
    return HIDDEN_STEMS[pillar.branch].some((hidden) => STEM_INFO[hidden.stem].element === target);
  });
}

/** 일간이 지지 어디엔가 통근했는가 — `rootedness.ts` 와 같은 규칙(같은 오행이면 뿌리) */
function dayMasterRooted(pillars: TransformationInput): boolean {
  const element = STEM_INFO[pillars.dayMaster].element;
  return PILLAR_POSITIONS.some((position) => {
    const pillar = pillars[position];
    if (pillar === null) return false;
    return HIDDEN_STEMS[pillar.branch].some((hidden) => STEM_INFO[hidden.stem].element === element);
  });
}

/**
 * 원국의 천간합을 모두 찾아 화(化) 등급을 매긴다.
 *
 * 합 하나가 한 항목이다. 쟁합이면 두 항목이 같은 글자를 공유하고 둘 다
 * `contested` 로 막힌다 — 어느 쪽이 이겼는지는 판정하지 않는다.
 */
export function stemTransformationsOf(pillars: TransformationInput): StemTransformation[] {
  const slots = slotsOf(pillars);

  /** 이 글자와 합하는 상대가 몇이나 되는가 — 쟁합·투합 판정의 바탕 */
  const partnersOf = (slot: Slot): Slot[] =>
    slots.filter((other) => other !== slot && findStemCombination(slot.stem, other.stem) !== null);

  const found: StemTransformation[] = [];

  for (let i = 0; i < slots.length; i += 1) {
    for (let j = i + 1; j < slots.length; j += 1) {
      const a = slots[i];
      const b = slots[j];
      const combination = findStemCombination(a.stem, b.stem);
      if (combination === null) continue;

      const target = combination.result;
      const pair = [a, b];

      const adjacent =
        Math.abs(PILLAR_POSITION_INDEX[a.position] - PILLAR_POSITION_INDEX[b.position]) === 1;

      const monthPillar = pillars.month;
      const monthElement =
        monthPillar === null ? null : STEM_INFO[principalStem(monthPillar.branch)].element;
      const monthCommandsTarget = monthElement === target;
      const monthGeneratesTarget = monthElement !== null && GENERATED_BY[target] === monthElement;

      // 화신을 극하는 천간 — 합에 낀 두 글자는 이미 변할 몸이라 세지 않는다.
      const controllingStems = slots.filter(
        (slot) =>
          !pair.includes(slot) && STEM_INFO[slot.stem].element === CONTROLLED_BY[target],
      );

      const rivals = [...partnersOf(a), ...partnersOf(b)].filter((slot) => !pair.includes(slot));

      const clashed = slots.some(
        (slot) =>
          !pair.includes(slot) &&
          pair.some((participant) => findStemClash(participant.stem, slot.stem) !== null),
      );

      const involvesDayMaster = pair.some((slot) => slot.position === 'day');
      const dayRooted = involvesDayMaster ? dayMasterRooted(pillars) : null;

      const blockers: TransformationBlocker[] = [];
      if (!adjacent) blockers.push('notAdjacent');
      if (rivals.length > 0) blockers.push('contested');
      if (!monthCommandsTarget) blockers.push('monthDoesNotCommand');
      if (controllingStems.length > 0) blockers.push('controlledStemPresent');
      if (clashed) blockers.push('participantClashed');
      if (dayRooted === true) blockers.push('dayMasterRooted');

      // 월령만 모자란 것은 운에서 채워질 수 있다 — 그 하나만 남았을 때가 조건부다.
      const onlyMonthMissing =
        blockers.length === 1 && blockers[0] === 'monthDoesNotCommand';

      const verdict: TransformationVerdict =
        blockers.length === 0
          ? 'transformed'
          : onlyMonthMissing && (monthGeneratesTarget || targetRooted(pillars, target))
            ? 'conditional'
            : 'bound';

      found.push({
        status: 'experimental',
        verdict,
        ko: combination.ko,
        target,
        participants: pair,
        blockers,
        involvesDayMaster,
        facts: {
          adjacent,
          monthCommandsTarget,
          monthGeneratesTarget,
          targetRootedInBranches: targetRooted(pillars, target),
          controllingStems,
          rivals,
          dayMasterRooted: dayRooted,
        },
      });
    }
  }

  return found;
}

/** 다섯 천간합의 화신 — 표를 두 벌 들지 않으려고 여기서 꺼내 쓴다 */
export const STEM_COMBINATION_TARGETS: Record<string, Element> = Object.fromEntries(
  STEM_COMBINATIONS.map((combination) => [combination.stems.join(''), combination.result]),
);
