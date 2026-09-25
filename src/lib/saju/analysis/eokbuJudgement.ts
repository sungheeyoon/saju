import {
  BRANCHES,
  ELEMENT_KO,
  HIDDEN_STEMS,
  STEM_INFO,
  principalStem,
  type Element,
  type Stem,
} from '../constants';
import type { Pillars } from '../pillars';
import { hourPillarOf } from '../pillars/hour';
import type { PillarPosition } from '../position';
import { effectiveElementsOf } from './effectiveElements';
import { elementDistributionOf, type ElementWeights } from './fiveElements';
import { followingAssessmentOf } from './followingPatterns';
import type {
  ElementSeat,
  EokbuCandidate,
  EokbuJudgement,
  Grade,
  GradeOrUnresolved,
  HourSensitivity,
} from './needProfileTypes';
import { rootednessOf } from './rootedness';
import { rootQualityOf } from './rootQuality';
import { strengthOf, type Strength, type StrengthOptions } from './strength';
import {
  ELEMENT_ROLE_KO,
  eokbuAssessmentOf,
  elementRolesOf,
  type ElementRole,
} from './yongsin';

/**
 * 억부 판정 — `eokbuAssessmentOf` 의 오행 하나를 **구조로** 편다(ADR 0111).
 *
 * 기존 값은 「신약 · 재성 최다 → 비겁」처럼 규칙 한 줄의 답만 냈다. 필요 오행 프로필이
 * 읽으려면 그 답이 어디에 앉았는가 · 얼마나 뚜렷한가 · 시(時)를 모르면 얼마나 흔들리는가가
 * 값으로 있어야 한다. 2026-09-25 측정(`docs/notes/2026-09-25-need-profile-baseline.md`)에서
 * 문턱 없이 셀 수 있던 것만 싣는다.
 *
 * - **1순위는 바꾸지 않는다.** `candidates[0]` 은 `eokbuAssessmentOf` 를 그대로 불러 낸다.
 * - **대안은 하나.** 신약 · 재성 최다에서 인성이 여덟 글자에 보이면 인성 — 억부 논리 20건을
 *   10 → 15 로 올렸지만 같은 스무 건에 맞춘 규칙이라 1순위를 못 바꾼다.
 * - **자리**는 여덟 글자를 글자대로 센다(일간 제외). 출처는 투간한 오행을 16/20 골랐고
 *   엔진은 11/20 이었다.
 * - **시 미상**이면 열두 시를 다 넣어 본다. 모집단에서 억부 오행이 열두 시 모두 같은 명식은
 *   26.4% 뿐이다.
 *
 * `Analysis` 에는 싣지 않는다 — 읽는 자리가 필요 오행 프로필 하나뿐이다.
 */

export type EokbuJudgementOptions = {
  weights?: Partial<ElementWeights>;
  strength?: Omit<StrengthOptions, 'weights'>;
  /**
   * 억부가 「무엇이 가장 무거운가」를 잴 분포. 기본은 `analyzePillars` 와 같은 실효 분포다.
   * `literal` 은 합화 · 국을 끈 대조용이다 — 강약도 같이 끄려면 `strength.basis` 를 함께 준다.
   */
  distribution?: 'effective' | 'literal';
};

type JudgementInput = Pick<Pillars, 'year' | 'month' | 'day' | 'hour' | 'dayMaster'>;

const STEM_POSITIONS = ['year', 'month', 'hour'] as const satisfies readonly PillarPosition[];
const BRANCH_POSITIONS = [
  'year',
  'month',
  'day',
  'hour',
] as const satisfies readonly PillarPosition[];

type SeatFacts = Pick<EokbuCandidate, 'seat' | 'revealedAt' | 'hiddenAt'>;

/**
 * 글자가 여덟 글자 어디에 앉았는가 — **글자 그대로** 센다(일간 제외). 합화 · 국으로 바뀐 무게는
 * 「쓸 수 있는 글자가 있는가」와 다른 물음이라 여기 섞지 않는다.
 *
 * 무엇을 찾는지는 `test` 가 정한다 — 억부 후보는 오행으로, 조후 글자는 천간 그대로(`needProfile.ts`).
 * `ElementSeat` 의 선을 한 자리에서만 긋는다.
 *
 * `hiddenAt` 은 지장간(정기 포함) 어디에든 그 글자가 있는 지지 자리다. 지지의 오행은 늘
 * 그 정기의 오행이므로 오행으로 찾을 때 `branch-main` 은 「지지 글자로 보인다」와 같은 말이다.
 */
export function glyphSeatOf(pillars: JudgementInput, test: (stem: Stem) => boolean): SeatFacts {
  const revealedAt = STEM_POSITIONS.filter((position) => {
    const pillar = pillars[position];
    return pillar !== null && test(pillar.stem);
  });
  const hiddenAt = BRANCH_POSITIONS.filter((position) => {
    const pillar = pillars[position];
    return pillar !== null && HIDDEN_STEMS[pillar.branch].some((hidden) => test(hidden.stem));
  });
  const branchMain = BRANCH_POSITIONS.some((position) => {
    const pillar = pillars[position];
    return pillar !== null && test(principalStem(pillar.branch));
  });

  const seat: ElementSeat =
    revealedAt.length > 0
      ? 'revealed'
      : branchMain
        ? 'branch-main'
        : hiddenAt.length > 0
          ? 'hidden-only'
          : 'absent';

  return { seat, revealedAt, hiddenAt };
}

const seatOf = (pillars: JudgementInput, element: Element): SeatFacts =>
  glyphSeatOf(pillars, (stem) => STEM_INFO[stem].element === element);

/**
 * 불균형의 단계 — **강약 기준 셋(득령 · 득지 · 득세) 중 몇이 한쪽을 가리켰는가**에서만 낸다.
 *
 * 기본 규칙은 셋 중 둘 이상이면 신강이다(`requiredCriteria: 2`). 그러면 셈은 두 갈래뿐이다.
 * 셋이 다 한쪽(3 또는 0)이면 이 기준이 말할 수 있는 가장 뚜렷한 불균형이라 `high`, 둘 대
 * 하나면 기준 하나만 뒤집혀도 판정이 넘어가는 가장 얕은 자리라 `low` 다. 그 사이의 셈이
 * 없으므로 `medium` 은 나오지 않는다 — 득세 비율로 가운데를 지으려면 새 문턱이 필요하다.
 * 기본이 아닌 `requiredCriteria` 면 이 대응이 서지 않아 `unresolved`.
 */
function imbalanceOf(strength: Strength, requiredCriteria: number | undefined): GradeOrUnresolved {
  if (requiredCriteria !== undefined && requiredCriteria !== 2) return 'unresolved';
  const unanimous = strength.metCount === 0 || strength.metCount === strength.criteria.length;
  return unanimous ? 'high' : 'low';
}

/** 시 하나를 넣은(또는 뺀) 명식에서 판정의 뼈대만 — 열두 시를 돌 때 다시 부른다 */
type Core = {
  strength: Strength;
  candidates: EokbuCandidate[];
  heaviest: { element: Element; role: ElementRole };
  imbalance: GradeOrUnresolved;
  followingVerdict: string;
  followingMayReverse: boolean;
  unresolved: EokbuJudgement['unresolved'];
};

const PRIMARY_RULE_ID: Record<'weak' | 'strong', Partial<Record<ElementRole, string>>> = {
  weak: {
    官星: 'weak-officer-heaviest-resource',
    食傷: 'weak-output-heaviest-resource',
    財星: 'weak-wealth-heaviest-companion',
  },
  strong: {
    印星: 'strong-resource-heaviest-wealth',
    比劫: 'strong-companion-heaviest-officer',
  },
};

function coreOf(pillars: JudgementInput, options: EokbuJudgementOptions): Core {
  const { weights } = options;
  const strength = strengthOf(pillars, { ...options.strength, weights });
  const effective = effectiveElementsOf(pillars, weights);
  const distribution =
    options.distribution === 'literal'
      ? elementDistributionOf(pillars, weights)
      : effective.distribution;
  const assessment = eokbuAssessmentOf(pillars, strength, weights, distribution);

  const roles = elementRolesOf(STEM_INFO[pillars.dayMaster].element);
  const { scores } = distribution;
  // `eokbuAssessmentOf` 안의 `heaviestOf` 와 같은 셈이다 — 같은 분포 · 같은 후보 순서 ·
  // 안정 정렬이라 동점이면 앞의 것이 선다. 규칙을 새로 짓지 않고 그 규칙이 본 것을 옮긴다.
  const heaviestOf = (group: readonly ElementRole[]): ElementRole =>
    [...group].sort((a, b) => scores[roles[b]] - scores[roles[a]])[0];
  const weak = strength.verdict === 'weak';
  const heaviestRole = weak
    ? heaviestOf(['官星', '食傷', '財星'])
    : heaviestOf(['印星', '比劫']);

  const ruleId =
    !weak && heaviestRole === '比劫' && assessment.role === '食傷'
      ? 'strong-companion-heaviest-no-officer-output'
      : (PRIMARY_RULE_ID[strength.verdict][heaviestRole] ?? 'eokbu-primary');

  const candidates: EokbuCandidate[] = [
    {
      element: assessment.suggestedElement,
      role: assessment.role,
      rule: 'primary',
      ruleId,
      reason: assessment.reason,
      ...seatOf(pillars, assessment.suggestedElement),
    },
  ];

  /*
    대안 — 신약 · 재성 최다에서 인성이 여덟 글자에 보이면(천간 투간이든 지지 본기든, 일간
    제외) 인성. 재가 인성을 극한다는 1순위의 까닭은 인성이 아예 없을 때의 말이고, 드러난
    인성은 재를 받아 넘길 손이 있다는 쪽이다. 외부 억부 20건 중 다섯을 새로 맞추고 맞던
    것을 하나도 안 깼지만 같은 스무 건으로 맞춘 규칙이라 대안에만 둔다.
  */
  if (weak && heaviestRole === '財星') {
    const resource = seatOf(pillars, roles.印星);
    if (resource.seat === 'revealed' || resource.seat === 'branch-main') {
      candidates.push({
        element: roles.印星,
        role: '印星',
        rule: 'alternative',
        ruleId: 'weak-wealth-heaviest-visible-resource',
        reason: `신약하고 재성(${ELEMENT_KO[roles.財星]})이 가장 무겁지만 인성(${ELEMENT_KO[roles.印星]})이 원국에 보여 인성으로 일간을 돕는 길도 있습니다.`,
        ...resource,
      });
    }
  }

  const rootedness = rootednessOf(pillars);
  const rootQuality = rootQualityOf(rootedness, pillars, effective.bureaus);
  // 종격은 `analyzePillars` 와 같이 늘 실효 분포로 잰다 — 억부 분포 옵션은 대조용이다.
  const following = followingAssessmentOf(
    pillars,
    effective.distribution,
    rootedness,
    rootQuality.dayMaster,
  );

  return {
    strength,
    candidates,
    heaviest: { element: roles[heaviestRole], role: heaviestRole },
    imbalance: imbalanceOf(strength, options.strength?.requiredCriteria),
    followingVerdict: following.verdict,
    followingMayReverse: following.verdict !== 'not-following',
    // 하나도 풀지 않았다 — 종격은 판정하지만 억부를 뒤집을지는 여전히 안 정했고, 뿌리의
    // 질은 득령 · 득지에 넣어 보아도 외부 20건의 일치가 움직이지 않았다.
    unresolved: assessment.unresolved,
  };
}

/**
 * 신뢰도 — **`low` 에서 시작한다.** 외부 억부 20건 중 1순위 일치가 10건이라서다.
 *
 * `medium` 은 측정에서 흔들림이 없던 사실이 **전부** 설 때만이다(가중치 없이 모두-아니면-안-됨).
 * - 대안 후보가 없다 — 대안이 서는 명식은 출처와 1순위가 갈린 다섯이 모인 자리다.
 * - 1순위 오행이 천간에 드러났다 — 출처가 고른 오행은 16/20 이 투간이었다.
 * - 불균형이 `high` 다 — 강약 기준 셋이 한쪽을 가리켰다.
 * - 종격이 서지 않았다 — 서면 억부 방향이 뒤집힐 수 있다.
 *
 * 시를 모르면 여기에 하나를 더 건다: **열두 시를 넣은 판정이 모두 `medium`** 이어야 한다.
 * 그래야 시 미상의 신뢰도가 어느 시를 넣은 판정보다도 높지 않다.
 */
function mediumConditionsHold(core: Core): boolean {
  return (
    core.candidates.length === 1 &&
    core.candidates[0].seat === 'revealed' &&
    core.imbalance === 'high' &&
    !core.followingMayReverse
  );
}

export function eokbuJudgementOf(
  pillars: JudgementInput,
  options: EokbuJudgementOptions = {},
): EokbuJudgement {
  const core = coreOf(pillars, options);
  const primary = core.candidates[0];

  let hour: HourSensitivity;
  let confidence: Grade;

  if (pillars.hour !== null) {
    hour = { hourKnown: true };
    confidence = mediumConditionsHold(core) ? 'medium' : 'low';
  } else {
    const completions = BRANCHES.map((branch) =>
      coreOf({ ...pillars, hour: hourPillarOf(pillars.dayMaster, branch) }, options),
    );
    const sameAnswerHours = completions.filter(
      (completion) => completion.candidates[0].element === primary.element,
    ).length;
    hour = { hourKnown: false, sameAnswerHours };
    confidence =
      sameAnswerHours === BRANCHES.length &&
      mediumConditionsHold(core) &&
      completions.every(mediumConditionsHold)
        ? 'medium'
        : 'low';
  }

  const ko = (element: Element) => ELEMENT_KO[element];
  const { strength } = core;
  const basis = [
    `강약: ${strength.verdict === 'weak' ? '신약' : '신강'} — 기준 셋 중 ${strength.metCount} 충족`,
    `가장 무거운 쪽: ${ELEMENT_ROLE_KO[core.heaviest.role]}(${ko(core.heaviest.element)})`,
    ...core.candidates.map(
      (candidate) =>
        `${candidate.rule === 'primary' ? '1순위' : '대안'} ${ko(candidate.element)}: ${candidate.seat}` +
        (candidate.revealedAt.length > 0 ? ` · 투간 ${candidate.revealedAt.join('·')}` : '') +
        (candidate.hiddenAt.length > 0 ? ` · 지장간 ${candidate.hiddenAt.join('·')}` : ''),
    ),
    ...(core.followingMayReverse
      ? [`종격 판정 ${core.followingVerdict} — 억부 방향이 뒤집힐 수 있음`]
      : []),
    ...(hour.hourKnown ? [] : [`시 미상: 열두 시 중 ${hour.sameAnswerHours} 시가 같은 1순위`]),
  ];

  return {
    status: 'experimental',
    // 강약은 언제나 신강 · 신약 둘 중 하나로 서고 1순위도 언제나 나온다 — 거둘 자리를 못 찾았다.
    verdict: 'judged',
    direction: strength.verdict === 'weak' ? 'support' : 'restrain',
    candidates: core.candidates,
    imbalance: core.imbalance,
    heaviest: core.heaviest,
    followingMayReverse: core.followingMayReverse,
    hour,
    confidence,
    unresolved: core.unresolved,
    basis,
  };
}
