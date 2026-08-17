import { BRANCH_INFO, ELEMENT_KO, STEM_INFO, type Stem } from '../constants';
import {
  ELEMENT_ROLE_KO,
  FOLLOWING_DIRECTION_KO,
  FOLLOWING_PATTERN_STATUS_KO,
  TEN_GOD_KO,
  type PillarTenGods,
} from '../analysis';
import { PILLAR_POSITION_KO, type PillarPosition } from '../position';
import { TWELVE_SPIRIT_KO } from '../sinsal/twelveSpirits';
import { TWELVE_STAGE_KO } from '../stages';
import type { Relation } from '../relations';
import type { Saju } from '../index';
import { FOLLOWING_SILENT_VERDICTS, type ClaimStrength } from './policy';
import { FRAGMENT_INDEX } from './corpus';
import {
  followingVariant,
  renderFragment,
  type FragmentIndex,
  type FragmentKey,
  type FragmentRequest,
  type FragmentViolation,
} from './fragment';

/**
 * L3 조립기 — **명식에서 발화를 발견하고 근거를 묶는다.**
 *
 * 이름이 조립기지만 하는 일의 절반은 조립 앞이다. 명식을 한 번 훑어서
 * ① 어떤 주제가 어느 변종으로 서는지, ② 슬롯에 꽂을 값이 무엇인지,
 * ③ 이 명식이 실제로 낸 용어가 무엇인지를 한꺼번에 낸다. 셋이 같은 순회에서
 * 나와야 슬롯 값과 근거 목록이 어긋나지 않는다.
 *
 * **고르지 않는다.** 사실이 있으면 발화하고 없으면 발화하지 않는다. "중요한
 * 관계 셋만" 같은 것은 여기서 하지 않는다 — 근거 없이 여섯 줄을 버리는 것이라
 * `distantRelations: 'detect-all'` 을 뒤집는 것과 같은 종류의 후퇴다. 줄이는 것은
 * 화면의 몫이고, 줄인다면 그것도 정책 값으로 적는다.
 *
 * 조각을 모른다는 것도 규율이다. `findUtterances` 는 말뭉치가 비어 있어도 같은
 * 요청을 낸다 — 그래야 "무엇을 말할 수 있는가"와 "무엇을 말할 조각이 있는가"가
 * 따로 세어지고, 후자의 공백이 생성기의 작업 목록이 된다.
 */

/** 명식이 낸 발화 하나 — 조각이 없어도 요청은 존재한다 */
export type Utterance = {
  request: FragmentRequest;
  /** 근거와 시각 여부로 계산된 값. 조각이 적은 것이 아니다 */
  strength: ClaimStrength;
  /** `silent` 이면 조회조차 하지 않으므로 null */
  key: FragmentKey | null;
  /** 말하지 않기로 했거나 조각이 아직 없으면 null */
  text: string | null;
  violations: FragmentViolation[];
};

const positionsKo = (positions: readonly PillarPosition[]): string =>
  positions.map((position) => PILLAR_POSITION_KO[position]).join('·');

/**
 * 관계 행의 첫 칸 — **어느 자리의 어느 글자인가.**
 *
 * 자리만 적던 때는 `participant.char` 를 통째로 버렸다. "년주·일주 자리의 두
 * 지지"로는 어느 글자가 子고 어느 것이 午인지 알 수 없는데, 그 값은 처음부터
 * 관계 안에 들어 있었다.
 *
 * 간(干)·지(支)를 자리 이름에 붙이는 것은 `char` 가 둘 중 무엇인지가 곧 그
 * 글자가 어디 앉았는지이기 때문이다 — 천간합과 지지합은 같은 기둥에서도 다른
 * 층에서 일어난다.
 *
 * `chartId` 는 아직 안 쓴다. 원국 한 판뿐이라 누구인지 물을 필요가 없다 —
 * 두 명식을 함께 놓는 궁합에서 이 자리에 이름이 들어온다.
 */
const participantsOf = (relation: Relation): string =>
  relation.participants
    .map((participant) => {
      const layer = participant.char in STEM_INFO ? '간' : '지';
      const position = PILLAR_POSITION_KO[participant.position].replace('주', layer);

      return `${position} ${participant.char}`;
    })
    .join(' · ');

const tenGodTerms = (pillar: PillarTenGods | null): string[] => {
  if (!pillar) return [];

  return [
    ...(pillar.stem ? [TEN_GOD_KO[pillar.stem]] : []),
    TEN_GOD_KO[pillar.branch],
    ...pillar.hiddenStems.map((hidden) => TEN_GOD_KO[hidden.tenGod]),
  ];
};

/**
 * 이 명식이 **실제로 낸** 용어들.
 *
 * 문장에 나온 명리 용어를 여기에 대조한다(`checkSentence` 의 `grounded`).
 * 그래서 이 목록은 **명식이 낸 것만** 담아야 한다 — 넉넉하게 담으면 대조가
 * 통과할 뿐 아무것도 잡지 못하고, 그물이 있다는 착각만 남는다.
 *
 * 말하지 않기로 한 판정은 넣지 않는다. `not-following` 은 문장을 만들지 않기로
 * 한 값이라 근거 목록에 이름을 올릴 자리도 없다.
 */
export function groundedTermsOf(saju: Saju): string[] {
  const terms = new Set<string>();

  for (const relation of saju.relations) terms.add(relation.ko);

  for (const key of ['year', 'month', 'day', 'hour'] as const) {
    for (const term of tenGodTerms(saju.analysis.tenGods[key])) terms.add(term);
  }

  for (const chart of [saju.stages.byDayMaster, saju.stages.bySelf]) {
    for (const stage of Object.values(chart)) {
      if (stage) terms.add(TWELVE_STAGE_KO[stage]);
    }
  }

  for (const chart of saju.sinsal.twelveSpirits) {
    for (const spirit of Object.values(chart.byPosition)) {
      if (spirit) terms.add(TWELVE_SPIRIT_KO[spirit]);
    }
  }

  for (const star of saju.sinsal.stars) terms.add(star.ko);

  terms.add(ELEMENT_ROLE_KO[saju.analysis.eokbu.role]);

  // 가장 무거운 세력은 판정과 상관없이 세어진 사실이다(`candidacy: 'facts-only'`).
  // 종격이 말하지 않기로 한 명식에서도 이 자리는 명식이 낸 값이다.
  terms.add(ELEMENT_ROLE_KO[saju.analysis.following.facts.dominant.role]);

  const { verdict } = saju.analysis.following;
  if (!FOLLOWING_SILENT_VERDICTS.includes(verdict)) terms.add(FOLLOWING_PATTERN_STATUS_KO[verdict]);

  return [...terms];
}

/**
 * 주제 표가 아직 덮지 못한 사실.
 *
 * 발화하지 않는 이유가 **고른 것이 아니라 주제가 없는 것**임을 값으로 남긴다.
 * 둘을 구분하지 않으면 "이건 안 중요해서 뺐다"가 조용히 섞인다.
 */
export const UNCOVERED_FACTS: readonly string[] = [
  'analysis.elements',
  'analysis.tenGodCounts',
  'analysis.rootedness (일간 밖의 천간·투출)',
  'stages',
  'sinsal',
  'daeun',
  'saeun',
  'wolun',
];

const HALF_KO = { first: '상반월', second: '하반월' } as const;

const stemsKo = (stems: readonly Stem[]): string => stems.map((stem) => STEM_INFO[stem].ko).join('·');

/**
 * 시간 미상일 때 채워 넣은 정오가 절반을 정했을 수 있는 폭 — **문턱이 아니라
 * 그날 하루다.**
 *
 * 시간을 모르면 `resolvedTime` 이 정오로 채워지고(`computeSaju`), 조후의
 * 상·하반월은 그 시각을 중기와 견주어 나온다. 실제 태어난 시각은 그날 자정에서
 * 자정 사이 어디든이므로 **정오에서 ±12시간이 곧 그날의 폭**이고, 중기가 그
 * 안에 들어 있으면 진짜 시각이 절반을 뒤집는다.
 *
 * 이 값은 우리가 고른 숫자가 아니라 채워 넣은 값에서 그대로 유도된다. 지어낸
 * 문턱이었다면 여기 있으면 안 됐다 — 조후가 세력 조건을 판정하지 않는 이유가
 * 정확히 그것이다(`JOHU_POLICY.conditionEvaluation`).
 */
const FILLED_NOON_SPAN_MS = 12 * 60 * 60 * 1000;

/**
 * 조후표에서 읽어 온 것 — **어느 변종으로 서는지가 여기서 정해진다.**
 *
 * 갈리지 않는 칸이면 표의 천간을 그대로 들고, 갈리는 칸이면 절반을 말한다.
 * 절반이 채워 넣은 정오에서 나온 값이면 한쪽을 고르지 않고 양쪽을 나란히 든다.
 */
function johuRequest(saju: Saju): Pick<FragmentRequest, 'topic' | 'variant' | 'slots'> {
  const { johu } = saju.analysis;

  const shared = {
    dayMaster: STEM_INFO[johu.dayMaster].ko,
    monthBranch: BRANCH_INFO[johu.monthBranch].ko,
  };

  if (!johu.halfMonth) {
    return { topic: 'johu.table', variant: 'whole-month', slots: { ...shared, stems: stemsKo(johu.stems) } };
  }

  const filledNoonCouldFlip =
    !saju.meta.hourKnown &&
    johu.midTerm !== null &&
    Math.abs(saju.meta.instant.getTime() - johu.midTerm.date.getTime()) <= FILLED_NOON_SPAN_MS;

  // 셋을 함께 본다 — `halfStems` 는 절반을 판정했을 때만 차므로 사실상 한 조건이고,
  // 타입이 그것을 모르기 때문에 `half` 도 나란히 놓는다.
  if (johu.half === null || johu.halfStems === null || filledNoonCouldFlip) {
    return {
      topic: 'johu.table',
      variant: 'half-unjudged',
      slots: {
        ...shared,
        firstStems: stemsKo(johu.halfMonth.first),
        secondStems: stemsKo(johu.halfMonth.second),
      },
    };
  }

  return {
    topic: 'johu.table',
    variant: 'half-month',
    slots: { ...shared, half: HALF_KO[johu.half], stems: stemsKo(johu.halfStems) },
  };
}

/**
 * 명식에서 발화를 찾는다 — **조각을 모른다.**
 *
 * 말뭉치가 비어 있어도 같은 목록이 나온다. 발화의 수는 명식이 정하고,
 * 그중 몇 개가 문장이 되는지는 말뭉치가 정한다.
 */
export function findUtterances(saju: Saju): FragmentRequest[] {
  const grounded = groundedTermsOf(saju);
  const hourKnown = saju.meta.hourKnown;
  const base = { grounded, hourKnown };

  const requests: FragmentRequest[] = [];

  const { dayMaster: rooting } = saju.analysis.rootedness;
  const dayMaster = STEM_INFO[saju.pillars.dayMaster].ko;

  if (rooting.rooted) {
    // 같은 글자에 둔 뿌리가 하나라도 있으면 그것이 이 명식의 뿌리다.
    const sameStem = rooting.roots.filter((root) => root.kind === 'same-stem');
    const roots = sameStem.length > 0 ? sameStem : rooting.roots;

    requests.push({
      ...base,
      topic: 'rootedness.rooted',
      variant: sameStem.length > 0 ? 'same-stem' : 'same-element',
      slots: {
        dayMaster,
        positions: positionsKo([...new Set(roots.map((root) => root.position))]),
      },
    });
  } else {
    requests.push({
      ...base,
      topic: 'rootedness.rootless',
      variant: 'day-master',
      slots: { dayMaster },
    });
  }

  const { strength, eokbu } = saju.analysis;

  requests.push({
    ...base,
    topic: 'strength.verdict',
    variant: strength.verdict,
    slots: { ratio: `${Math.round(strength.ratio * 100)}%` },
  });

  requests.push({
    ...base,
    topic: 'eokbu.candidate',
    variant: eokbu.role,
    slots: {
      role: ELEMENT_ROLE_KO[eokbu.role],
      element: ELEMENT_KO[eokbu.suggestedElement],
    },
  });

  requests.push({ ...base, ...johuRequest(saju) });

  // 말하지 않기로 한 판정도 요청은 낸다. 여기서 걸러 버리면 "사실이 없다"와
  // "말하지 않기로 했다"가 한 덩어리가 되고, 골든에서 침묵이 보이지 않는다.
  const { following } = saju.analysis;

  requests.push({
    ...base,
    topic: 'following.verdict',
    variant: followingVariant(following.verdict, following.direction),
    slots: {
      verdict: FOLLOWING_PATTERN_STATUS_KO[following.verdict],
      direction: following.direction === null ? '' : FOLLOWING_DIRECTION_KO[following.direction],
      selfShare: `${Math.round(following.selfShare * 100)}%`,
      dominant: ELEMENT_ROLE_KO[following.facts.dominant.role],
    },
  });

  // 전부 낸다. 어느 것이 무거운지는 판정이라 여기서 하지 않는다.
  for (const relation of saju.relations) {
    requests.push({
      ...base,
      topic: 'relation.present',
      variant: 'row',
      slots: { participants: participantsOf(relation), name: relation.ko },
    });
  }

  return requests;
}

/** 발화를 찾아 조각에 물린다 */
export function assembleText(saju: Saju, index: FragmentIndex = FRAGMENT_INDEX): Utterance[] {
  return findUtterances(saju).map((request) => ({ request, ...renderFragment(request, index) }));
}

/** 문장이 된 것만 */
export const sentencesOf = (utterances: readonly Utterance[]): string[] =>
  utterances.flatMap((utterance) => (utterance.text === null ? [] : [utterance.text]));

/** 발화는 있는데 조각이 없어 침묵한 자리 — 생성기의 다음 작업 */
export const missingFragmentsOf = (utterances: readonly Utterance[]): FragmentKey[] => [
  ...new Set(
    utterances.flatMap((utterance) =>
      utterance.key !== null && utterance.text === null ? [utterance.key] : [],
    ),
  ),
];

export const ASSEMBLE_POLICY = {
  ruleSet: 'utterance-discovery-v1',
  /** 사실이 있으면 발화한다. 중요도로 거르지 않는다 */
  selection: 'all-facts-speak',
  /** 발화 판정은 말뭉치를 모른다 — 조각이 없어도 요청은 나온다 */
  discovery: 'corpus-independent',
  /** 슬롯 값과 근거 목록이 같은 순회에서 나온다 */
  grounding: 'one-pass-with-slots',
  /** 근거 목록은 이 명식이 낸 것만 담는다 */
  groundedScope: 'chart-produced-only',
  /** 주제가 없어 발화하지 않는 사실은 목록으로 남긴다 */
  coverage: 'uncovered-facts-listed',
  /** 순서는 주제 표 순서이고 관계는 관계 목록 순서다 */
  order: 'topic-table-then-relation-order',
} as const;
