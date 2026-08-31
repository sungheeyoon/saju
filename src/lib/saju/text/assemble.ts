import {
  BRANCH_INFO,
  ELEMENT_KO,
  STEM_INFO,
  type Element,
  type Pillar,
  type Stem,
} from '../constants';
import type { CivilDateTime } from '../civilTime';
import type { CurrentFortune } from '../now';
import {
  ELEMENT_ROLE_KO,
  FOLLOWING_DIRECTION_KO,
  FOLLOWING_PATTERN_STATUS_KO,
  SELF_SEAT_KINDS,
  TEN_GOD_GROUP,
  TEN_GOD_KO,
  TRANSFORMATION_VERDICT_KO,
  type Bureau,
  type StemTransformation,
  type FavorRole,
  type PillarTenGods,
  type TenGod,
} from '../analysis';
import { PILLAR_POSITION_KO, type PillarPosition } from '../position';
import { TWELVE_SPIRIT_KO } from '../sinsal/twelveSpirits';
import { TWELVE_STAGE_KO } from '../stages';
import { COMPAT_CHART_ID, COMPAT_SIDES, type Compatibility, type CompatSide } from '../compat';
import { absorbableByUnknownHour, orderedParticipants, type Relation } from '../relations';
import type { Saju } from '../index';
import { FOLLOWING_SILENT_VERDICTS, type ClaimPath, type ClaimStrength } from './policy';
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
const participantsOf = (relation: Relation, labelOf?: (chartId: string) => string): string =>
  // 완전 삼형은 자리 순서가 아니라 **도는 순서**로 늘어선다. 그러지 않으면 행이
  // "년지 未 · 일지 丑 · 월지 戌 — 축술미 삼형" 처럼 서서, 글자 순서와 이름이
  // 어긋난 채로 읽는 사람에게 둘 중 어느 것이 맞는지를 고르게 한다.
  orderedParticipants(relation)
    .map((participant) => {
      const layer = participant.char in STEM_INFO ? '간' : '지';
      const position = PILLAR_POSITION_KO[participant.position].replace('주', layer);
      const who = labelOf?.(participant.chartId);

      return `${who ? `${who} ` : ''}${position} ${participant.char}`;
    })
    .join(' · ');

/** 쌍 관계인가, 따로 있던 글자들이 합쳐 이룬 것인가 */
/**
 * 관계 행의 변종 — **두 축을 곱한다.** `followingVariant` 와 같은 꼴이다.
 *
 * 하나는 어떻게 성립했는가(한 판 안 / 두 판이 합쳐), 다른 하나는 **시주가 붙으면
 * 사라질 수 있는가**(`absorbableByUnknownHour`). 뒤엣것을 섞지 않고 축으로 둔
 * 이유는, 섞으면 반쪽 합에도 완성된 합과 같은 문장이 나가기 때문이다.
 *
 * `combined-absorbable` 은 두지 않는다. 두 판이 합쳐 이룬 것은 정의상 완성된
 * 구조라 언제나 `full: true` 이고(1200명 짝 399건에서 반쪽은 0건), 그 전제는
 * `corpus.test.ts` 가 다시 센다. 닿지 않는 변종을 두면 문장이 하나 죽는다.
 */
const relationVariant = (relation: Relation, hourKnown: boolean): string => {
  if (relation.scope === 'combinedFormation') return 'combined';

  return absorbableByUnknownHour(relation, hourKnown) ? 'row-absorbable' : 'row';
};

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

  // 국 이름은 관계 이름과 겹치기도 하고(삼합·방합·반합) 아니기도 하다 — 공협은
  // 관계 목록에 없어서 여기서 처음 들어온다. 명식이 낸 이름이 맞으므로 담는다.
  for (const bureau of saju.analysis.bureaus) terms.add(bureau.ko);

  // 성패의 조건 이름. 스물 중 둘(`식신제살`·`관인상생`)은 금지 표현이기도 해서,
  // 그 조건이 실제로 걸린 명식에서만 열린다 — 합화의 판정 이름과 같은 자리다.
  const { structure } = saju.analysis;
  for (const factor of [...structure.formingFactors, ...structure.breakingFactors]) {
    terms.add(factor.name);
  }

  // **판정 이름이 '합화'라 금지 표현이다.** 담는 것이 금지를 푸는 것이 아니라,
  // 化를 판정한 명식에서만 담기므로 금지가 그때만 열린다 — 그것이 원래 요구였다
  // (`FORBIDDEN_CLAIMS` 의 `transformation`). 합 이름(`ko`)은 관계 목록이 이미
  // 담았고 여기 오는 것은 등급 이름이다.
  for (const transformation of saju.analysis.effectiveElements.transformations) {
    terms.add(TRANSFORMATION_VERDICT_KO[transformation.verdict]);
  }

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
 * 주제 표가 아직 덮지 못한 사실 — **근거 자리(`ClaimPath`)로 적는다.**
 *
 * 발화하지 않는 이유가 **고른 것이 아니라 주제가 없는 것**임을 값으로 남긴다.
 * 둘을 구분하지 않으면 "이건 안 중요해서 뺐다"가 조용히 섞인다.
 *
 * **산문으로 적어 두었더니 목록이 엔진을 따라오지 않았다.** 2026-08-21 에 격국·
 * 오신·암합·국·합화가 엔진에 들어오는 동안 이 목록은 여섯 줄 그대로였다. 고지가
 * 좁아지는 것이 채워졌다는 증거라고 적어 두었는데, 그 사이 고지는 좁아진 것이
 * 아니라 **늘어야 할 때 안 늘었다** — 읽는 사람에게는 둘이 똑같이 보인다.
 * 이제 자리를 `ClaimPath` 로 적고, 주제가 하나도 읽지 않는 자리가 여기 없으면
 * 테스트가 걸린다(`assemble.test.ts` 의 "주제가 없는 근거 자리는 빠짐없이 고지된다").
 *
 * 자리가 목록에 있다고 통째로 침묵한다는 뜻은 아니다 — `analysis.rootedness` 는
 * 일간의 뿌리를 말하면서 그 밖은 말하지 않는다. 그래서 `note` 가 어디까지가
 * 공백인지 적고, 적을 것이 없으면 자리 이름만 선다.
 */
export const UNCOVERED_FACTS_BY_PATH: readonly {
  paths: readonly ClaimPath[];
  note?: string;
}[] = [
  { paths: ['pillars'], note: '여덟 글자 자체 — 사주팔자 표가 그대로 든다' },
  { paths: ['analysis.elements'], note: '다섯 오행이 몇인가 — 억부·궁합 문장이 근거로 쓰기만 하고 분포 자체는 표가 든다' },
  { paths: ['analysis.tenGodCounts'] },
  { paths: ['analysis.rootedness'], note: '일간 밖의 천간·투출' },
  // 2026-08-21 에 들어온 판정들. 엔진에는 값이 있고 주제가 없다 — 여기 이름이
  // 서 있는 동안은 화면도 문장도 이것들을 모른다.
  {
    paths: ['analysis.structure'],
    note: '조건이 어느 자리의 무슨 글자에서 나왔는가 — 조건의 이름까지 든다. 근거 글자는 `StructureFactor.detail` 에 산문으로만 있어 아직 계약 밖이다',
  },
  {
    paths: ['analysis.favorability'],
    note: '자리마다 원국에 몇 자인가 — 배정만 말한다. 「한 자도 없다」는 없다는 주장이라 방향이 다르고, 세어진 수는 행의 몫이다',
  },
  { paths: ['analysis.hiddenCombinations'], note: '암합 — 관계 표에 섞지 않기로 한 자리' },
  {
    paths: ['analysis.bureaus', 'analysis.effectiveElements'],
    note: '몫과 등급을 정한 조건들 — 국의 받침·왕지의 충, 化를 막은 것. 조건의 목록이라 한 문장으로 접으면 반올림이 되므로 결과만 든다',
  },
  {
    paths: ['analysis.rootQuality'],
    note: '일간 밖의 천간 — 일간의 뿌리만 말한다. 질의 수치는 배수를 곱한 값이라 단위가 없어 들지 않는다',
  },
  { paths: ['analysis.followingCandidacy'], note: '종격 후보 자격 — 판정(`analysis.following`)만 말한다' },
  { paths: ['stages'] },
  { paths: ['sinsal'] },
  // 대운·세운·월운은 **표 전체로는** 아직 침묵한다. 지금 도는 한 칸만
  // 현재운이 말한다(`findNowUtterances`) — 아홉 칸과 열두 칸을 다 말하는 것은
  // "고르지 않는다"가 화면을 덮어 버리는 자리라 따로 정할 일이다.
  {
    paths: ['daeun', 'saeun', 'wolun'],
    note: '표 전체 — 지금 도는 칸만 현재운이 말한다',
  },
];

/** 골든이 읽는 줄. 위 목록이 원본이고 이쪽은 그것을 적어 낸 것이다 */
export const UNCOVERED_FACTS: readonly string[] = UNCOVERED_FACTS_BY_PATH.map(
  ({ paths, note }) => `${paths.join(' · ')}${note === undefined ? '' : ` (${note})`}`,
);

const HALF_KO = { first: '상반월', second: '하반월' } as const;

/**
 * 이름 둘을 잇는다 — **조사는 앞 글자의 받침을 따른다.**
 *
 * 문장 틀은 슬롯 뒤에 조사를 붙이지 못한다(`VARIABLE_PARTICLES`). 그 규칙이 막는
 * 것은 **틀이 미리 고르는 것**이지 값을 만드는 쪽이 고르는 것이 아니다 — 여기는
 * 이름을 이미 알고 있으므로 맞는 조사를 고를 수 있다.
 */
const joinNames = (names: readonly string[]): string =>
  names.reduce((joined, name) => {
    const last = joined.charCodeAt(joined.length - 1) - 0xac00;
    const closed = last >= 0 && last <= 11171 && last % 28 !== 0;

    return `${joined}${closed ? '과' : '와'} ${name}`;
  });

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
 * 일간의 뿌리에서 깎인 것 — **무엇이 깎았는가가 변종이고, 얼마나 남았는가가
 * 주제를 가른다.**
 *
 * 깎인 것이 하나도 없으면 아무것도 안 낸다 — 「깎인 것이 없다」는 없다는 주장이고,
 * 뿌리가 있다는 것은 뿌리 문장이 이미 말했다.
 *
 * **무근을 따로 막지 않는다.** `effectivelyRootless` 는 「질의 합이 문턱 아래」라는
 * 뜻이라 뿌리가 0개일 때도 참이고, 그대로 두면 무근 명식이 「세어지기는 해도 남지
 * 않았다」는 거짓말을 듣는다. 그런데 뿌리가 없으면 깎일 것도 없어서
 * (`rooted === roots.length > 0`) 아래 한 줄이 이미 막는다 — 게이트를 하나 더
 * 세워 뒀다가 **떼어 보니 아무 시험도 깨지지 않았다.** 있으나 마나 한 것을
 * 있는 것처럼 두면 다음 사람이 그것을 근거로 읽는다.
 *
 * **일간만 본다.** `RootQualityChart.stems` 가 나머지 천간의 질도 들고 있지만
 * 뿌리 문장 자체가 일간의 뿌리만 말하므로(`analysis.rootedness` 고지), 여기만
 * 앞서 나가면 화면이 한쪽 축에서만 자란다.
 */
function rootQualityRequest(
  saju: Saju,
): Pick<FragmentRequest, 'topic' | 'variant' | 'slots'> | null {
  const quality = saju.analysis.rootQuality.dayMaster;
  const clashed = quality.roots.filter((graded) => graded.clashed);
  const defected = quality.roots.filter((graded) => graded.defected > 0);
  if (clashed.length === 0 && defected.length === 0) return null;

  const at = (roots: readonly (typeof quality.roots)[number][]) =>
    positionsKo([...new Set(roots.map((graded) => graded.root.position))]);

  return {
    topic: quality.effectivelyRootless ? 'rootQuality.pulled' : 'rootQuality.damaged',
    variant:
      clashed.length > 0 && defected.length > 0 ? 'both' : clashed.length > 0 ? 'clashed' : 'defected',
    slots: {
      dayMaster: STEM_INFO[saju.pillars.dayMaster].ko,
      clashedAt: at(clashed),
      defectedAt: at(defected),
    },
  };
}

/**
 * 천간합 하나 — **판정이 변종이고, 일간이 그 위에 얹힌다.**
 *
 * 일간이 물린 합은 판정이 무엇이든 무게를 안 옮긴다
 * (`EFFECTIVE_ELEMENTS_POLICY.dayMasterCombination`). 판정만 보고 고르면 옮기지도
 * 않은 무게를 옮겼다고 적게 되므로 `day-master` 가 그 자리에서 먼저 집는다.
 *
 * 합이불화는 일간이 물려 있어도 판정 그대로다 — 어차피 옮길 무게가 없어 문장이
 * 거짓이 되지 않고, 화격은 化해야 서는 것이라 꺼낼 자리도 아니다.
 */
function transformationRequest(
  transformation: StemTransformation,
): Pick<FragmentRequest, 'topic' | 'variant' | 'slots'> {
  const moved = transformation.verdict !== 'bound';

  return {
    topic: 'transformation.verdict',
    variant:
      transformation.involvesDayMaster && moved ? 'day-master' : transformation.verdict,
    slots: {
      name: transformation.ko,
      verdict: TRANSFORMATION_VERDICT_KO[transformation.verdict],
      element: ELEMENT_KO[transformation.target],
    },
  };
}

/**
 * 국 하나 — **관계 표에 실렸는가가 변종을 고른다.**
 *
 * `spanTriple` 만 관계 열거가 내지 않는다. 그것은 우연이 아니라 `bureau.ts` 가
 * 적어 둔 결정이고(왕지가 빠진 두 글자를 관계로 부르는 계통이 없다), 모집단에서도
 * 정확히 그렇게 갈린다 — 공협 406건은 전부 관계 목록에 없고 나머지 2570건은
 * 전부 있다.
 *
 * 기운 몫은 반올림해서 든다. `pull` 이 낼 수 있는 값은 여섯뿐이라(0.075 · 0.125 ·
 * 0.15 · 0.25 · 0.3 · 0.5) 소수점이 생기지 않는다.
 */
function bureauRequest(bureau: Bureau): Pick<FragmentRequest, 'topic' | 'variant' | 'slots'> {
  return {
    topic: 'bureau.standing',
    variant: bureau.kind === 'spanTriple' ? 'span' : 'in-table',
    slots: {
      positions: positionsKo(bureau.members.map((member) => member.position)),
      name: bureau.ko,
      element: ELEMENT_KO[bureau.element],
      pull: `${Math.round(bureau.pull * 100)}%`,
    },
  };
}

/**
 * 두 셈의 가장 무거운 오행 — **갈렸는가가 변종이다.**
 *
 * 옮긴 것이 없으면 두 분포가 같은 값이라 견줄 것이 없다. 요청을 안 내는 것이
 * 맞다 — 말하지 않기로 한 것이 아니라 **사실이 없는** 자리다.
 */
function heaviestRequest(saju: Saju): Pick<FragmentRequest, 'topic' | 'variant' | 'slots'> | null {
  const { elements, effectiveElements } = saju.analysis;
  if (!effectiveElements.adjusted) return null;

  const literal = elements.strongest;
  const effective = effectiveElements.distribution.strongest;

  return {
    topic: 'elements.heaviest',
    variant: literal === effective ? 'same' : 'differs',
    slots: { literal: ELEMENT_KO[literal], effective: ELEMENT_KO[effective] },
  };
}

/**
 * 오신 배정 — **다섯 자리를 엔진의 표에서 그대로 옮긴다.**
 *
 * 고를 것이 없다. `byRole` 이 이미 자리→오행 표라, 여기가 하는 일은 오행 이름을
 * 한글로 바꿔 슬롯에 꽂는 것뿐이다. 자리를 손으로 늘어놓지 않는 것은 말뭉치와
 * 같은 이유다 — 자리가 하나 늘면 슬롯도 함께 늘어야 하고, 늘지 않으면 조각이
 * 채우지 못한 슬롯을 들고 `unfilled-slot` 으로 걸린다.
 */
function favorabilityRequest(saju: Saju): Pick<FragmentRequest, 'topic' | 'variant' | 'slots'> {
  const { byRole } = saju.analysis.favorability;

  return {
    topic: 'favorability.seating',
    variant: 'seating',
    slots: Object.fromEntries(
      (Object.keys(byRole) as FavorRole[]).map((role) => [role, ELEMENT_KO[byRole[role]]]),
    ),
  };
}

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
 * 격국 — **격을 잡은 방식이 변종을 고른다.**
 *
 * 월령이 일간 편이면 격이 아니라 자리 이름이고(건록·양인·월겁), 그 셋은
 * `STRUCTURE_KIND_KO` 에서 이름이 갈리는 것이 아니라 `SELF_SEAT_KINDS` 로
 * 갈린다 — 십성으로 읽으면 戊土의 巳월이 편인격이 되어 버린다는 것을
 * `STRUCTURE_POLICY.selfSeat` 가 이미 적어 두었다.
 */
function structureRequest(saju: Saju): Pick<FragmentRequest, 'topic' | 'variant' | 'slots'> {
  const { structure } = saju.analysis;

  const shared = {
    kind: structure.ko,
    monthBranch: BRANCH_INFO[saju.pillars.month.branch].ko,
    sourceStem: STEM_INFO[structure.source.stem].ko,
  };

  if ((SELF_SEAT_KINDS as readonly string[]).includes(structure.kind)) {
    return { topic: 'structure.kind', variant: 'self-seat', slots: shared };
  }

  if (!structure.revealed) {
    return {
      topic: 'structure.kind',
      variant:
        structure.principalFallback === 'revealed-unusable' ? 'self-revealed-only' : 'principal-only',
      slots: shared,
    };
  }

  return {
    topic: 'structure.kind',
    variant: 'revealed',
    slots: { ...shared, revealedAt: positionsKo(structure.source.revealedAt) },
  };
}

/**
 * 성패 — **두 목록의 길이가 변종을 고른다.**
 *
 * 엔진의 `outcome` 을 안 읽는다. 그 값은 「섞였거나 둘 다 없다」를 `unresolved`
 * 한 칸에 담는데 둘은 뜻이 정반대라(3000건에서 22.5% 대 15.5%) 문장이 갈려야
 * 하고, 갈릴 근거는 **두 배열의 길이**에 이미 있다. 값을 하나 더 만들어 달라고
 * 하는 대신 사실을 읽는다 — `principalFallback` 은 `selectSource` 안에서만 알 수
 * 있는 것이라 값이 필요했지만 여기는 밖에서 보인다.
 */
function structureOutcomeRequest(
  saju: Saju,
): Pick<FragmentRequest, 'topic' | 'variant' | 'slots'> {
  const { structure } = saju.analysis;
  const names = (factors: readonly { name: string }[]) =>
    factors.map((factor) => factor.name).join('·');

  const forming = structure.formingFactors.length > 0;
  const breaking = structure.breakingFactors.length > 0;

  return {
    topic: 'structure.outcome',
    variant:
      forming && breaking ? 'mixed' : forming ? 'formed' : breaking ? 'broken' : 'none',
    slots: {
      kind: structure.ko,
      forming: names(structure.formingFactors),
      breaking: names(structure.breakingFactors),
    },
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

  // **세력 앞에 선다.** 강약·억부·격국·종격이 전부 옮긴 뒤의 분포에서 세력을
  // 재므로(`STRENGTH_POLICY.basis`), 무엇이 옮겼는지가 그 문장들보다 뒤에 오면
  // 근거가 결론 뒤에 서게 된다.
  // 무게가 실제로 움직이는 순서다 — 천간합화가 먼저고 지지국이 나중이다
  // (`effectiveElementsOf`). 문장 순서를 그것에 맞춰 두면 `shifts` 를 되짚는
  // 사람이 목록과 문장을 나란히 읽을 수 있다.
  for (const transformation of saju.analysis.effectiveElements.transformations) {
    requests.push({ ...base, ...transformationRequest(transformation) });
  }

  for (const bureau of saju.analysis.bureaus) {
    requests.push({ ...base, ...bureauRequest(bureau) });
  }

  const heaviest = heaviestRequest(saju);
  if (heaviest) requests.push({ ...base, ...heaviest });

  // **국 다음이다.** 뿌리 문장 바로 뒤에 붙이고 싶어지지만, 이 문장이 「국에
  // 끌려갔다」고 말할 때 그 국이 무엇인지는 위의 국 문장만 답할 수 있다. 계산도
  // 그 순서다 — `rootQualityOf` 가 `bureaus` 를 인자로 받는다. 뿌리 문장과는
  // 자리 이름이 겹쳐 이어지므로 떨어져 있어도 짚을 수 있다.
  const rootDamage = rootQualityRequest(saju);
  if (rootDamage) requests.push({ ...base, ...rootDamage });

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

  // 억부 바로 다음이다. 이 문장은 억부가 낸 후보를 용신 자리에 놓고 시작하므로,
  // 사이에 다른 주제가 끼면 「무엇을 놓았는가」가 앞줄에서 떨어진다.
  requests.push({ ...base, ...favorabilityRequest(saju) });

  requests.push({ ...base, ...johuRequest(saju) });

  requests.push({ ...base, ...structureRequest(saju) });

  // 격 이름 바로 뒤다. 성패는 그 격에 대한 말이라 사이에 다른 주제가 끼면
  // 무엇의 성패인지가 앞줄에서 떨어진다 — 시간 미상이면 여기만 입을 닫는다.
  requests.push({ ...base, ...structureOutcomeRequest(saju) });

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

  // 목록의 한계가 목록 앞에 선다. 행은 그대로 사실이고, 못 본 것은 여기서 말한다.
  // 관계가 0개일 때도 낸다 — 그때가 오히려 필요하다(없는 것이 시주 때문일 수 있다).
  if (!saju.meta.hourKnown) {
    requests.push({ ...base, topic: 'relation.coverage', variant: 'natal', slots: {} });
  }

  // 전부 낸다. 어느 것이 무거운지는 판정이라 여기서 하지 않는다.
  for (const relation of saju.relations) {
    requests.push({
      ...base,
      topic: 'relation.present',
      variant: relationVariant(relation, saju.meta.hourKnown),
      slots: { participants: participantsOf(relation), name: relation.ko },
    });
  }

  return requests;
}

/** 발화를 찾아 조각에 물린다 */
export function assembleText(saju: Saju, index: FragmentIndex = FRAGMENT_INDEX): Utterance[] {
  return findUtterances(saju).map((request) => ({ request, ...renderFragment(request, index) }));
}

/**
 * 대운 순번을 부르는 말 — **`4번째` 로 적지 않는다.**
 *
 * 행이 아니라 산문이라서다. 숫자 슬롯이 그대로 문장에 박히면 읽는 리듬이 끊기고,
 * 무엇보다 첫 칸을 '1번째'라고 부르게 된다. 표를 넘어가는 순번은 숫자로 돌아온다 —
 * 열두 번째까지 세면 그다음은 사람이 말로 세지 않는다.
 */
const DAEUN_ORDINALS = [
  '첫',
  '두 번째',
  '세 번째',
  '네 번째',
  '다섯 번째',
  '여섯 번째',
  '일곱 번째',
  '여덟 번째',
  '아홉 번째',
  '열 번째',
  '열한 번째',
  '열두 번째',
] as const;

const daeunOrdinal = (index: number): string => DAEUN_ORDINALS[index - 1] ?? `${index}번째`;

const ganji = (pillar: Pillar): string => `${pillar.stem}${pillar.branch}`;

/**
 * 기준 시각을 문장에 적는 말 — **분까지 적는다.**
 *
 * 날짜만 적으면 절입일에 거짓이 된다. 2026 년 경칩은 3월 5일 22:58(KST)이라
 * 같은 날짜 안에서 인월과 묘월이 갈리는데, "3월 5일 기준"은 둘 중 어느 쪽을
 * 보고 한 말인지 가리키지 못한다.
 */
const asOfLabel = (viewedOn: CivilDateTime): string =>
  `${viewedOn.year}년 ${viewedOn.month}월 ${viewedOn.day}일 ${viewedOn.hour}시 ${viewedOn.minute}분`;

/** 현재운 관계 행에서 그 글자가 어느 판의 것인지 */
const NOW_CHART_LABELS: Record<string, string> = {
  natal: '',
  decade: '대운',
  annual: '세운',
  monthly: '월운',
};

/**
 * 이 현재운이 **실제로 낸** 용어들 — 원국·궁합의 같은 함수와 같은 구실이다.
 *
 * 12운성·12신살은 담지 않는다. 세운·월운 칸이 그것들을 계산해 두었지만
 * (`SaeunEntry.stage`·`spirits`) **주제가 없어 문장이 되지 않으므로**, 근거 목록에
 * 넣으면 그물만 넓어지고 잡는 것은 없다 — "넉넉히 담으면 대조가 통과할 뿐 아무것도
 * 잡지 못한다"가 이 목록의 규율이다.
 */
export function groundedNowTermsOf(now: CurrentFortune): string[] {
  const terms = new Set<string>();

  for (const relation of now.relations) terms.add(relation.ko);

  for (const entry of [now.saeun, now.wolun]) {
    terms.add(TEN_GOD_KO[entry.tenGods.stem]);
    terms.add(TEN_GOD_KO[entry.tenGods.branch]);
  }

  return [...terms];
}

/**
 * 현재운에서 아직 주제가 없는 사실.
 *
 * `UNCOVERED_FACTS`·`UNCOVERED_COMPAT_FACTS` 와 같은 구실이고, 목록을 나눈 것은
 * 세는 대상이 `Saju` 도 `Compatibility` 도 아니기 때문이다. 여기 적힌 것들은
 * `UNCOVERED_NOW_FACTS`(엔진이 아직 세지 않는 것)와 다르다 — **이쪽은 값이 있는데
 * 주제가 없는 것**이다. 운끼리의 관계는 이제 둘 중 어느 목록에도 없다 — 세어지고
 * 발화한다.
 */
export const UNCOVERED_NOW_TOPICS: readonly string[] = [
  'saeun.stage · wolun.stage (일간이 그 지지에서 어떤 상태인가)',
  'saeun.spirits · wolun.spirits (12신살 — 년지·일지 기준)',
  'saeun.startTerm · wolun.startTerm (그 칸이 언제부터 언제까지인가)',
];

/**
 * 현재운에서 발화를 찾는다 — **`Saju` 를 받지 않는다.**
 *
 * 궁합이 `Compatibility` 와 이름 두 개만 받는 것과 같은 규율이다. `Saju` 를 통째로
 * 받으면 L3 가 "지금이 어느 칸인가"를 다시 셀 길이 생기고, 그러면 화면의 운과
 * 문장의 운이 언젠가 어긋난다.
 *
 * **기준 시각이 맨 앞에 선다.** 나머지 발화가 '지금'·'이번'이라는 상대 표현을
 * 쓰므로 그 좌표 없이는 전부 기준점 없는 문장이 된다. 조건에 따라 서는 것이 아니라
 * **언제나** 서는 유일한 발화다.
 */
export function findNowUtterances(now: CurrentFortune): FragmentRequest[] {
  const base = { grounded: groundedNowTermsOf(now), hourKnown: now.hourKnown };
  const requests: FragmentRequest[] = [];

  requests.push({
    ...base,
    topic: 'now.asOf',
    variant: 'instant',
    slots: { at: asOfLabel(now.viewedOn) },
  });

  // 대운은 셋 중 유일하게 우리가 고른 값 위에 서 있다 — 그래서 산문이고 계통을 밝힌다.
  if (now.daeun !== null) {
    requests.push({
      ...base,
      topic: 'now.daeun',
      variant: 'within',
      slots: {
        age: String(now.age),
        index: daeunOrdinal(now.daeun.index),
        pillar: ganji(now.daeun.pillar),
        ageRange: `만 ${now.daeun.startAge}→${now.daeun.endAge}세`,
      },
    });
  } else if (now.daeunAbsence === 'before-first') {
    // 표 밖으로 나간 쪽(`beyond-table`)은 발화하지 않는다. 그것은 이 사람에 대한
    // 사실이 아니라 우리가 뽑은 칸 수의 한계라, 문장이 들면 남의 한계를 사실처럼
    // 말하게 된다.
    requests.push({
      ...base,
      topic: 'now.daeunPending',
      variant: 'first',
      slots: {
        age: String(now.age),
        startAge: String(now.firstDaeun.startAge),
        pillar: ganji(now.firstDaeun.pillar),
      },
    });
  }

  requests.push({
    ...base,
    topic: 'now.saeun',
    variant: 'year',
    slots: {
      year: String(now.saeun.year),
      pillar: ganji(now.saeun.pillar),
      stemTenGod: TEN_GOD_KO[now.saeun.tenGods.stem],
      branchTenGod: TEN_GOD_KO[now.saeun.tenGods.branch],
    },
  });

  requests.push({
    ...base,
    topic: 'now.wolun',
    variant: 'month',
    slots: {
      month: `${BRANCH_INFO[now.wolun.pillar.branch].ko}월`,
      pillar: ganji(now.wolun.pillar),
      stemTenGod: TEN_GOD_KO[now.wolun.tenGods.stem],
      branchTenGod: TEN_GOD_KO[now.wolun.tenGods.branch],
    },
  });

  // 목록의 한계 둘이 나란히 선다. 앞은 **우리 구현**이 못 센 것이라 늘 서고,
  // 뒤는 **입력**이 빠진 것이라 시각을 모를 때만 선다.
  requests.push({ ...base, topic: 'now.coverage', variant: 'other-daeun-omitted', slots: {} });

  if (!now.hourKnown) {
    requests.push({ ...base, topic: 'relation.coverage', variant: 'natal', slots: {} });
  }

  // 원국과 같은 주제·같은 조각이다. 갈리는 것은 슬롯에 어느 판인지가 들어온다는 것뿐 —
  // 궁합에서 이름이 들어온 그 자리다.
  for (const relation of now.relations) {
    requests.push({
      ...base,
      topic: 'relation.present',
      variant: relationVariant(relation, now.hourKnown),
      slots: { participants: participantsOf(relation, nowChartLabel), name: relation.ko },
    });
  }

  return requests;
}

/**
 * 계산판 이름을 사람이 읽는 말로 — `annual:2026` → `세운`.
 *
 * 해와 달을 이름에 넣지 않는다. 기준 시각 문장이 이미 언제인지 말했고, 행마다
 * 연도를 붙이면 같은 값이 목록 내내 되풀이된다. 모르는 판이면 `chartId` 를 그대로
 * 보인다 — 궁합에서 남의 기둥이 조용히 내 것으로 적히는 것을 막은 것과 같다.
 */
const nowChartLabel = (chartId: string): string =>
  NOW_CHART_LABELS[chartId.split(':')[0]] ?? chartId;

/** 현재운 발화를 찾아 조각에 물린다 */
export function assembleNowText(
  now: CurrentFortune,
  index: FragmentIndex = FRAGMENT_INDEX,
): Utterance[] {
  return findNowUtterances(now).map((request) => ({ request, ...renderFragment(request, index) }));
}

/**
 * 궁합 한 사람 — **L3 가 알아야 하는 것은 이름뿐이다.**
 *
 * 명식 전체를 받지 않는 것이 규율이다. 관계는 `Compatibility` 가 이미 다 냈고,
 * 여기서 더 필요한 것은 그 글자를 **누구라고 부를지**뿐이다. `Saju` 를 통째로
 * 받으면 L3 가 다시 계산할 길이 생기고, 그러면 화면의 궁합과 문장의 궁합이
 * 언젠가 어긋난다.
 *
 * `hourKnown` 이 여기 있었다. 이름과 나란히 있으니 같은 종류로 보였지만 아니다 —
 * 이름은 계산 밖에서 오는 것이라 호출부밖에 알 수 없고, 시각을 알았는가는
 * **궁합이 이미 아는 값**이다(`Compatibility.hourKnown`). 호출부가 다른 명식의
 * 값을 적어도 아무것도 걸리지 않았고, 걸렸다면 문장이 엉뚱한 사람의 시주를
 * 빠졌다고 부르는 모양이었다.
 */
export type CompatPerson = {
  /** 행에서 이 사람의 글자 앞에 붙는 이름. 계산에는 들어가지 않는다 */
  label: string;
};

/**
 * 이 궁합이 **실제로 낸** 용어들 — 원국의 `groundedTermsOf` 와 같은 구실이다.
 *
 * 목록을 나눈 것은 세는 대상이 `Saju` 가 아니라 `Compatibility` 이기 때문이다.
 * 두 사람의 원국이 각자 낸 용어는 여기 오지 않는다 — 궁합 문장이 읽는 것은
 * 사이에서 생긴 값뿐이고, 넉넉히 담으면 대조가 통과할 뿐 아무것도 잡지 못한다.
 *
 * 슬롯 값을 그대로 옮겨 담는 것이 아니라 **엔진이 낸 것을 다시 훑는다.** 꽂은
 * 값을 근거로 흘려보내면 그 값이 스스로를 근거로 삼아 "없는 것을 말하면 걸린다"가
 * 통째로 무력해진다.
 */
export function groundedCompatTermsOf(compat: Compatibility): string[] {
  const terms = new Set<string>();

  for (const relation of compat.relations) terms.add(relation.ko);
  for (const tenGod of Object.values(compat.tenGods)) terms.add(TEN_GOD_KO[tenGod]);
  for (const match of Object.values(compat.eokbuMatch)) terms.add(ELEMENT_ROLE_KO[match.role]);

  return [...terms];
}

/**
 * 궁합 관계를 행으로 — **원국과 같은 주제, 같은 조각을 쓴다.**
 *
 * 갈리는 것은 `{participants}` 슬롯에 이름이 들어온다는 것뿐이다. 궁합용 문장을
 * 따로 두면 같은 관계가 화면 두 곳에서 다르게 읽히고, 그것은 궁합 관계를
 * `findRelationsAmong` 하나로 모은 이유를 문장 층에서 되돌리는 것이 된다.
 *
 * **시각은 둘 다 알아야 안다.** 한쪽이라도 시주가 없으면 그 사람 두 글자가 낼
 * 관계를 통째로 못 본 것이라, 목록이 이 두 사람 사이의 전부라고 말할 수 없다.
 * 적힌 관계 하나하나는 여전히 성립하지만 강도는 목록에도 걸린다.
 */
export function findCompatUtterances(
  compat: Compatibility,
  people: Record<CompatSide, CompatPerson>,
): FragmentRequest[] {
  const labels: Record<string, string> = {
    [COMPAT_CHART_ID.a]: people.a.label,
    [COMPAT_CHART_ID.b]: people.b.label,
  };

  // 모르는 계산판이면 이름 대신 그 이름표를 그대로 보인다. 한쪽으로 기본값을
  // 주면 남의 기둥이 조용히 내 것으로 적히는데, 그것이 가장 나쁜 실패다.
  const labelOf = (chartId: string): string => labels[chartId] ?? chartId;

  // **시각은 둘 다 알아야 안다** — 한쪽만 알아도 목록은 이 두 사람 사이의 전부가
  // 아니다. 그 사실은 궁합이 값으로 든다.
  const base = {
    grounded: groundedCompatTermsOf(compat),
    hourKnown: COMPAT_SIDES.every((side) => compat.hourKnown[side]),
  };

  const requests: FragmentRequest[] = [];

  // 두 방향을 같은 틀로 두 번 세운다. 비대칭은 두 행이 나란히 선 것으로 보이고,
  // 같은 오행이라 양쪽이 같은 십성일 때도(비겁) 두 행이 그대로 선다.
  const views: { viewer: CompatSide; viewed: CompatSide; tenGod: TenGod }[] = [
    { viewer: 'a', viewed: 'b', tenGod: compat.tenGods.aSeesB },
    { viewer: 'b', viewed: 'a', tenGod: compat.tenGods.bSeesA },
  ];

  for (const { viewer, viewed, tenGod } of views) {
    requests.push({
      ...base,
      topic: 'tenGods.between',
      variant: TEN_GOD_GROUP[tenGod],
      slots: {
        viewer: people[viewer].label,
        viewed: people[viewed].label,
        tenGod: TEN_GOD_KO[tenGod],
      },
    });
  }

  // 행에는 **누구의** 시주가 빠졌는지 적을 자리가 없었다. 목록은 이름을 부른다 —
  // 한쪽만 모르는 것과 둘 다 모르는 것은 같은 칸이지만 같은 문장은 아니다.
  const unknown = COMPAT_SIDES.filter((side) => !compat.hourKnown[side]);
  const who = unknown.length > 0 ? joinNames(unknown.map((side) => people[side].label)) : '';

  // 억부 부합 — 궁합의 첫 산문. 방향이 갈리면 주제가 갈린다: 상대가 가졌다는 것은
  // 시주가 빠져도 참이지만 "없다"는 시주가 뒤집을 수 있다.
  for (const side of COMPAT_SIDES) {
    const match = compat.eokbuMatch[side];
    const partner = side === 'a' ? 'b' : 'a';

    requests.push({
      ...base,
      topic: match.presentInPartner ? 'eokbuMatch.supplied' : 'eokbuMatch.missing',
      variant: 'partner',
      slots: {
        viewer: people[side].label,
        partner: people[partner].label,
        role: ELEMENT_ROLE_KO[match.role],
        element: ELEMENT_KO[match.element],
        ratio: `${Math.round(match.partnerRatio * 100)}%`,
        who,
      },
    });
  }

  // 오행 보완 — 행이다. 엔진이 아는 것은 개수 둘이라 물려받을 판정이 없다.
  const elementsKo = (elements: readonly Element[]) => elements.map((e) => ELEMENT_KO[e]).join('·');

  for (const side of COMPAT_SIDES) {
    const support = compat.elementSupport[side];
    const partner = side === 'a' ? 'b' : 'a';
    const names = { viewer: people[side].label, partner: people[partner].label };

    if (support.supplied.length > 0) {
      requests.push({
        ...base,
        topic: 'elementSupport.absent',
        variant: 'supplied',
        slots: { ...names, elements: elementsKo(support.supplied) },
      });
    }

    // **없는 오행이 하나도 없을 때만 선다.** `weakest` 는 argmin 이라 없는 오행이
    // 있으면 그것을 가리키는데, 0 인 자리를 "가장 얇다"고 부르면 있는 것처럼
    // 읽힌다. 그 자리는 위 행이 이미 없다고 말했다 — 두 주제가 공간을 나눠 갖고
    // 각 낱말이 참인 자리에서만 선다.
    if (support.missing.length === 0) {
      requests.push({
        ...base,
        topic: 'elementSupport.weakest',
        variant: 'pair',
        slots: {
          ...names,
          element: ELEMENT_KO[support.weakest.element],
          ratio: `${Math.round(support.weakest.partnerRatio * 100)}%`,
          who,
        },
      });
    }
  }

  // **한 번만 선다.** 둘 다 없는 것은 사람마다가 아니라 짝의 성질이고, 두 쪽의
  // 집합이 정의상 같다(내게 없다 ∩ 상대에게 없다). 사람마다 내면 같은 행이 두 벌
  // 찍히고, 그러면 읽는 사람은 다른 값인 줄 알고 두 번 읽는다.
  const stillMissing = compat.elementSupport.a.stillMissing;

  if (stillMissing.length > 0) {
    requests.push({
      ...base,
      topic: 'elementSupport.absent',
      variant: 'still-missing',
      slots: {
        who: joinNames(COMPAT_SIDES.map((side) => people[side].label)),
        elements: elementsKo(stillMissing),
      },
    });
  }

  if (unknown.length > 0) {
    requests.push({
      ...base,
      topic: 'relation.coverage',
      variant: 'compat',
      slots: { who },
    });
  }

  for (const relation of compat.relations) {
    requests.push({
      ...base,
      topic: 'relation.present',
      // 둘 중 하나라도 시주를 모르면 반쪽 합이 흡수될 수 있다 — 궁합 상한을
      // 두 사람의 곱으로 묻는 것과 같은 셈이다(`compatClaimsFor`).
      variant: relationVariant(relation, compat.hourKnown.a && compat.hourKnown.b),
      slots: { participants: participantsOf(relation, labelOf), name: relation.ko },
    });
  }

  return requests;
}

/** 궁합 발화를 찾아 조각에 물린다 */
export function assembleCompatText(
  compat: Compatibility,
  people: Record<CompatSide, CompatPerson>,
  index: FragmentIndex = FRAGMENT_INDEX,
): Utterance[] {
  return findCompatUtterances(compat, people).map((request) => ({
    request,
    ...renderFragment(request, index),
  }));
}

/**
 * 궁합에서 아직 주제가 없는 사실.
 *
 * 남은 하나뿐이다. 사실이 없어서가 아니라 주제가 없어서 침묵한다 —
 * `UNCOVERED_FACTS` 와 같은 구실이고, 목록을 나눈 것은 세는 대상이 `Saju` 가
 * 아니라 `Compatibility` 이기 때문이다.
 *
 * `combinedFormations` 는 **사실이 이미 발화한다** — 같은 관계가 `relations` 안에
 * 있고 행이 `(따로 있는 글자들이 합쳐 이룬 것)` 로 그렇다는 것을 적는다. 여기 남은
 * 것은 그것들만 따로 모은 목록인데, 목록이 따로 서야 하는지가 화면의 질문이라
 * 문장 층에서 먼저 정할 일이 아니다.
 */
export const UNCOVERED_COMPAT_FACTS: readonly string[] = [
  'combinedFormations (관계 행에는 들어가지만 따로 모은 목록은 아직)',
];

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
  /**
   * 현재운은 기준 시각 발화를 **조건 없이 맨 앞에** 낸다.
   *
   * 나머지 발화가 '지금'·'이번'이라는 상대 표현을 쓰므로 그 좌표 없이는 전부 기준점
   * 없는 문장이 된다. **화면이 이 발화를 빼면 나머지가 거짓이 되고, 그것을 테스트가
   * 못 본다** — 조립기는 한 번 내고 어디에 놓을지는 화면의 일이라는 것을 이미
   * `relation.coverage` 에서 배웠다.
   */
  viewingInstant: 'as-of-line-always-first',
  /**
   * 대운 표 밖은 **발화하지 않는다.**
   *
   * 침묵과 다르다. 침묵은 값이 있는데 말하지 않기로 한 것이고, 이쪽은 우리가 뽑은
   * 칸 수(`DaeunOptions.count`)의 한계라 이 사람에 대한 사실이 아니다 — 문장이 들면
   * 남의 한계를 사실처럼 말하게 된다.
   */
  daeunBeyondTable: 'no-utterance-not-silence',
} as const;
