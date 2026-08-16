import {
  HIDDEN_STEMS,
  STEM_INFO,
  type Branch,
  type Element,
  type HiddenStemRole,
  type Stem,
} from '../constants';
import type { Pillars } from '../pillars';
import { PILLAR_POSITIONS, type PillarPosition } from '../position';

/**
 * 통근(通根)과 투출(透出) — **사실만 낸다.**
 *
 * 억부·종격·격국이 모두 "이 천간이 쓸 만한가"를 묻는데, 그 재료가 이 둘이다.
 * 천간이 지지 속에 뿌리를 두었는가(통근), 지지 속 글자가 천간에 드러났는가
 * (투출). 지금까지 `STRENGTH_POLICY.unaccounted` 와 `EokbuAssessment.unresolved`
 * 가 "아직 안 본다"고 적어 온 항목이 바로 이것이다.
 *
 * **질(質)은 매기지 않는다.** 뿌리가 있다·없다, 어느 자리에 며칠치다까지가
 * 사실이고, "이 뿌리는 약하다"거나 "이 정도면 통근으로 안 친다"는 판정은
 * 계통마다 갈린다. 특히 되돌리기 쉬운 것 셋:
 *
 * 1. **같은 오행이면 뿌리로 센다** — 甲이 卯(乙)에 통근하는가처럼 음양이 다른
 *    경우를 인정할지가 갈린다. 여기서는 `kind` 로 같은 글자(`same-stem`)와 같은
 *    오행(`same-element`)을 **구분해 남기고** 거르지 않는다. 좁게 보고 싶으면
 *    `kind` 로 걸러 쓰면 된다. 거르는 쪽을 기본값으로 삼으면 되살릴 수 없다.
 * 2. **고지(庫支)를 따로 취급하지 않는다** — 辰戌丑未의 중기에 둔 뿌리도 같은
 *    규칙으로 낸다. "묘고는 충해야 열린다"는 판정이 계통 갈림의 한복판이라
 *    여기서 미리 정하지 않는다. `role: '中氣'` 와 `days` 가 그대로 나오므로
 *    그 판정을 쓰는 쪽에서 하면 된다.
 * 3. **합충으로 뿌리가 상했는지 보지 않는다** — 관계 연산이 "합이 성사되는가"를
 *    판정하지 않는 것과 같은 이유다. 뿌리 목록과 관계 목록을 함께 읽어야 한다.
 *
 * 투출은 **지지 → 천간** 방향으로만 본다. 천간에 있는 글자가 어느 지지에서
 * 나왔는지는 통근이 이미 답한다.
 */

export const ROOTEDNESS_POLICY = {
  ruleSet: 'rooting-facts-v1',
  /** 같은 오행이면 뿌리로 세되 같은 글자인지 구분해 남긴다 */
  rootKind: 'same-element-marked',
  /** 고지의 중기도 같은 규칙으로 낸다 — 묘고 판정은 하지 않는다 */
  storageBranch: 'no-special-case',
  /** 합충으로 인한 뿌리 변화는 보지 않는다 */
  combinationEffects: 'not-judged',
  /** 뿌리의 질(강약)을 매기지 않는다 — 자리·역할·일수만 낸다 */
  quality: 'not-graded',
} as const;

/** 뿌리 하나 — 어느 자리의 어느 지장간에 걸렸는가 */
export type Root = {
  /** 뿌리가 된 지지의 자리 */
  position: PillarPosition;
  branch: Branch;
  /** 뿌리가 된 지장간 */
  stem: Stem;
  role: HiddenStemRole;
  /** 그 지장간의 사령 일수 */
  days: number;
  /**
   * 천간과 **같은 글자**인가, 같은 오행일 뿐인가.
   *
   * 甲이 寅의 甲에 통근하면 `same-stem`, 卯의 乙에 통근하면 `same-element` 다.
   * 음양이 다른 뿌리를 인정할지가 계통 갈림이라 거르지 않고 구분만 한다.
   */
  kind: 'same-stem' | 'same-element';
};

/** 천간 하나가 어디에 뿌리를 두는가 */
export type StemRooting = {
  /** 천간의 자리 */
  position: PillarPosition;
  stem: Stem;
  element: Element;
  roots: Root[];
  /** 뿌리들의 사령 일수 합 — 뿌리가 없으면 0 */
  totalDays: number;
  /** 뿌리가 하나라도 있는가 */
  rooted: boolean;
};

/** 지장간 하나가 천간에 드러난 것 */
export type Emergence = {
  /** 드러난 글자를 품은 지지의 자리 */
  position: PillarPosition;
  branch: Branch;
  stem: Stem;
  role: HiddenStemRole;
  days: number;
  /** 그 글자가 드러난 천간의 자리들 */
  revealedAt: PillarPosition[];
};

export type Rootedness = {
  /** 네 천간 각각. 시간 미상이면 셋이다 */
  stems: StemRooting[];
  /** 일간 — 종격·억부가 가장 먼저 묻는 자리라 따로 꺼내 둔다 */
  dayMaster: StemRooting;
  /** 천간에 드러난 지장간만. 드러나지 않은 것은 빠진다 */
  emergences: Emergence[];
};

type RootednessInput = Pick<Pillars, 'year' | 'month' | 'day' | 'hour' | 'dayMaster'>;

const eachPillar = <T>(
  pillars: RootednessInput,
  pick: (branchOrStem: { stem: Stem; branch: Branch }, position: PillarPosition) => T | null,
): T[] =>
  PILLAR_POSITIONS.flatMap((position) => {
    const pillar = pillars[position];
    if (!pillar) return [];
    const found = pick(pillar, position);
    return found === null ? [] : [found];
  });

/** 한 천간이 네 지지에 두는 뿌리를 모은다 */
function rootsOf(pillars: RootednessInput, stem: Stem): Root[] {
  const element = STEM_INFO[stem].element;

  return PILLAR_POSITIONS.flatMap((position) => {
    const pillar = pillars[position];
    if (!pillar) return [];

    return HIDDEN_STEMS[pillar.branch]
      .filter((hidden) => STEM_INFO[hidden.stem].element === element)
      .map(
        (hidden): Root => ({
          position,
          branch: pillar.branch,
          stem: hidden.stem,
          role: hidden.role,
          days: hidden.days,
          kind: hidden.stem === stem ? 'same-stem' : 'same-element',
        }),
      );
  });
}

function rootingOf(pillars: RootednessInput, stem: Stem, position: PillarPosition): StemRooting {
  const roots = rootsOf(pillars, stem);

  return {
    position,
    stem,
    element: STEM_INFO[stem].element,
    roots,
    totalDays: roots.reduce((sum, root) => sum + root.days, 0),
    rooted: roots.length > 0,
  };
}

/**
 * 통근과 투출을 센다.
 *
 * 시간 미상이면 시주가 통째로 빠진다 — 없는 자리를 0 으로 채우지 않고 아예
 * 세지 않는다. 뿌리가 실제보다 적게 나오므로 쓰는 쪽이 그 사실을 알아야 한다.
 */
export function rootednessOf(pillars: RootednessInput): Rootedness {
  const stems = eachPillar(pillars, (pillar, position) =>
    rootingOf(pillars, pillar.stem, position),
  );

  const revealed = new Map<Stem, PillarPosition[]>();
  for (const { stem, position } of eachPillar(pillars, (pillar, position) => ({
    stem: pillar.stem,
    position,
  }))) {
    revealed.set(stem, [...(revealed.get(stem) ?? []), position]);
  }

  const emergences = PILLAR_POSITIONS.flatMap((position) => {
    const pillar = pillars[position];
    if (!pillar) return [];

    return HIDDEN_STEMS[pillar.branch].flatMap((hidden): Emergence[] => {
      const revealedAt = revealed.get(hidden.stem);
      if (!revealedAt) return [];

      return [
        {
          position,
          branch: pillar.branch,
          stem: hidden.stem,
          role: hidden.role,
          days: hidden.days,
          revealedAt,
        },
      ];
    });
  });

  return {
    stems,
    dayMaster: rootingOf(pillars, pillars.dayMaster, 'day'),
    emergences,
  };
}
