import { HIDDEN_STEMS, principalStem, STEM_INFO, STEMS, type Element, type Stem } from '../constants';
import type { Pillars } from '../pillars';
import type { PillarPosition } from '../position';
import type { Grade, NeedProfile } from './needProfileTypes';

/**
 * 방향별 필요 보완 — **주는 쪽 명식이 받는 쪽의 필요에 어디서 닿는가**를 사실로만 낸다(ADR 0112).
 *
 * 한 쌍에 두 번 부른다(A→B · B→A). 받는 쪽은 필요 오행 프로필(`needProfileOf`, ADR 0111)이고,
 * 주는 쪽은 원국 글자뿐이다 — 주는 쪽의 프로필은 보지 않는다.
 *
 * **등급도 점수도 없다.** 무엇을 「닿았다」고 볼지(일간도 치는가 · 지장간도 치는가)를 아직 안 골랐다.
 * 무작위 3000쌍(6000 방향)에서 억부 1순위 오행이 주는 쪽 어딘가(지장간 포함)에 있는 방향이 95.9%,
 * 받는 쪽의 가장 무거운 오행이 있는 방향이 96.7% 다
 * (`docs/notes/2026-09-25-need-complement-distribution.md`). 「있는가」 하나로 가르면 거의 모든 쌍이
 * 같은 칸에 든다. 그래서
 *
 * - 자리는 **날것으로** 든다 — 일간인가, 다른 천간 어디, 지지 본기 어디, 본기 아닌 지장간 어디.
 *   일간과 다른 천간을 한 칸으로 합치지 않는다(받는 쪽 `ElementSeat` 은 일간을 빼므로 다시 쓰지 않는다).
 * - 관계는 **세 기준**(`any` · `visible` · `stems`)에서 다 내고 고르지 않는다.
 * - 오행 개수 · 비율은 세지 않는다. 그것은 `discovery-v1` 의 상호보완 축이 이미 센다 — 여기서
 *   다시 세면 한 쌍의 같은 사실이 두 번 점수에 든다.
 * - 조후는 **글자대로**다. 丙을 권하면 丙이 있는가만 맞음으로 친다. 같은 불의 丁은 사실로만 옆에 둔다.
 * - 받는 쪽의 가장 무거운 오행을 주는 쪽이 가졌으면 `counterSignals` 에 한 줄 든다. 감점이 아니고
 *   기신이라 부르지 않는다(기신은 병을 봐야 정해진다).
 * - 못 정한 것(받는 쪽의 `unresolved` · 시 미상)은 `unresolved` 와 `confidence` 로만 간다. 맞음 사실은
 *   그대로 둔다.
 */

// ─── 계약 ───────────────────────────────────────────────────────────────────

/**
 * 주는 쪽 명식에서 한 글자(또는 한 오행)가 앉은 자리. **일간을 센다** — 받는 쪽 `ElementSeat` 과
 * 다른 선이다(그쪽은 자기 일간을 「쓸 수 있는 글자」에서 뺀다). 상대의 일간은 그 사람 자체라 뺄 까닭이 없다.
 */
export type ProviderPresence =
  /** 주는 쪽의 일간 */
  | 'day-master'
  /** 일간 밖의 천간(년 · 월 · 시) */
  | 'other-stem'
  /** 지지의 본기(정기) */
  | 'branch-main'
  /** 본기가 아닌 지장간(여기 · 중기) */
  | 'hidden-only'
  /** 주는 쪽이 가진 글자 어디에도 없다 — 시를 모르면 여섯 글자 안에서다 */
  | 'absent';

/** 자리의 날것 — 해당하는 자리를 **모두** 든다. 가장 센 하나로 줄이지 않는다 */
export type ProviderSeats = {
  dayMaster: boolean;
  /** 일간을 뺀 천간 자리 */
  stemAt: readonly PillarPosition[];
  /** 본기가 그것인 지지 자리 */
  branchMainAt: readonly PillarPosition[];
  /** 본기 아닌 지장간(여기 · 중기)에 그것이 있는 지지 자리 */
  hiddenAt: readonly PillarPosition[];
  /** 위에서 선 자리의 종류 — 이 순서(`day-master` → `hidden-only`)로, 하나도 없으면 `['absent']` */
  presences: readonly ProviderPresence[];
};

/** 관계를 가를 때 「있다」로 치는 자리의 묶음. **고르지 않고 셋 다 낸다** */
export type ComplementBasis =
  /** 지장간까지 어디든 */
  | 'any'
  /** 일간 · 다른 천간 · 지지 본기 */
  | 'visible'
  /** 일간 · 다른 천간 */
  | 'stems';

export type ComplementRelation = 'supportive' | 'mixed' | 'conflicting' | 'not-comparable';

export type ElementMatch = { element: Element; seats: ProviderSeats };

export type AlternativeMatch = ElementMatch & { ruleId: string };

export type JohuStemMatch = {
  stem: Stem;
  element: Element;
  /** 받는 쪽 조후 판정에서 조건 뒤 이 글자가 아직 권해지는가 — `false` 면 관계에 안 든다 */
  receiverStemActive: boolean;
  /** 그 글자 **자체**의 자리 */
  seats: ProviderSeats;
  /** 같은 오행의 다른 천간 중 주는 쪽에 있는 것 — 사실일 뿐 맞음으로 치지 않는다 */
  sameElementOthers: readonly { stem: Stem; seats: ProviderSeats }[];
};

export type CounterSignal = { kind: 'supplies-heaviest'; element: Element; seats: ProviderSeats };

export type DirectionalNeedComplement = {
  status: 'experimental';
  /** 등급을 아직 매기지 않는다 — 자리를 단계로 옮기는 일은 따로 정한다 */
  support: 'not-graded';
  matched: {
    eokbuPrimary: ElementMatch;
    eokbuAlternatives: readonly AlternativeMatch[];
    johuStems: readonly JohuStemMatch[];
  };
  /** 받는 쪽의 가장 무거운 오행을 주는 쪽이 가졌다(`any` 기준) — 감점이 아니다 */
  counterSignals: readonly CounterSignal[];
  relationByBasis: Record<ComplementBasis, ComplementRelation>;
  /** 받는 쪽 프로필의 신뢰도에서, 어느 쪽이든 시를 모르면 한 단계 내린다(`low` 아래는 없다) */
  confidence: Grade;
  unresolved: readonly string[];
  hour: { receiverHourKnown: boolean; providerHourKnown: boolean };
};

export type ProviderChart = Pick<Pillars, 'year' | 'month' | 'day' | 'hour' | 'dayMaster'>;

export const NEED_COMPLEMENT_POLICY = {
  ruleSet: 'need-complement-v1',
  status: 'experimental',
  /** 궁합 점수를 내지 않는다 — `COMPAT_POLICY.scoring` 과 같은 선 */
  scoring: 'not-scored',
  support: 'not-graded',
  /** 관계는 세 기준에서 다 내고 고르지 않는다 */
  bases: ['any', 'visible', 'stems'] as const satisfies readonly ComplementBasis[],
  /** 오행 개수 · 비율은 `discovery-v1` 이 센다 — 여기서 다시 세지 않는다 */
  elementCounts: 'not-counted',
} as const;

const BASIS_PRESENCES: Record<ComplementBasis, readonly ProviderPresence[]> = {
  any: ['day-master', 'other-stem', 'branch-main', 'hidden-only'],
  visible: ['day-master', 'other-stem', 'branch-main'],
  stems: ['day-master', 'other-stem'],
};

// ─── 자리 ───────────────────────────────────────────────────────────────────

const OTHER_STEM_POSITIONS = ['year', 'month', 'hour'] as const satisfies readonly PillarPosition[];
const BRANCH_POSITIONS = [
  'year',
  'month',
  'day',
  'hour',
] as const satisfies readonly PillarPosition[];

/** 천간 하나가 맞는가 — 글자대로 볼 때와 오행으로 볼 때를 한 자리에서 가른다 */
type StemTest = (stem: Stem) => boolean;

function seatsOf(provider: ProviderChart, test: StemTest): ProviderSeats {
  const dayMaster = test(provider.dayMaster);
  const stemAt = OTHER_STEM_POSITIONS.filter((position) => {
    const pillar = provider[position];
    return pillar !== null && test(pillar.stem);
  });
  const branchMainAt: PillarPosition[] = [];
  const hiddenAt: PillarPosition[] = [];
  for (const position of BRANCH_POSITIONS) {
    const pillar = provider[position];
    if (pillar === null) continue;
    if (test(principalStem(pillar.branch))) branchMainAt.push(position);
    // 본기 아닌 지장간만 — 본기와 같은 오행의 여기(예: 卯의 甲)는 오행으로 볼 때 여기에도 든다.
    if (HIDDEN_STEMS[pillar.branch].some((hidden) => hidden.role !== '正氣' && test(hidden.stem))) {
      hiddenAt.push(position);
    }
  }

  const presences: ProviderPresence[] = [];
  if (dayMaster) presences.push('day-master');
  if (stemAt.length > 0) presences.push('other-stem');
  if (branchMainAt.length > 0) presences.push('branch-main');
  if (hiddenAt.length > 0) presences.push('hidden-only');
  if (presences.length === 0) presences.push('absent');

  return { dayMaster, stemAt, branchMainAt, hiddenAt, presences };
}

export const providerSeatsOfElement = (provider: ProviderChart, element: Element): ProviderSeats =>
  seatsOf(provider, (stem) => STEM_INFO[stem].element === element);

export const providerSeatsOfStem = (provider: ProviderChart, stem: Stem): ProviderSeats =>
  seatsOf(provider, (other) => other === stem);

/** 그 기준에서 「있다」인가 */
export const presentUnder = (seats: ProviderSeats, basis: ComplementBasis): boolean =>
  seats.presences.some((presence) => BASIS_PRESENCES[basis].includes(presence));

// ─── 관계 ───────────────────────────────────────────────────────────────────

/**
 * 한 기준의 관계.
 *
 * - 맞음 — 억부 1순위 오행이 있거나, 조후 **활성** 글자 중 하나가 글자 그대로 있다. 대안 오행은 안 센다
 *   (같은 스무 건에 맞춘 규칙이라, ADR 0111).
 * - 거스름 — 받는 쪽의 가장 무거운 오행이 있다.
 * - `supportive` 맞음만 · `conflicting` 거스름만 · `mixed` 둘 다 · `not-comparable` 둘 다 아님.
 */
function relationUnder(
  basis: ComplementBasis,
  primary: ProviderSeats,
  johuStems: readonly JohuStemMatch[],
  heaviest: readonly ProviderSeats[],
): ComplementRelation {
  const meets =
    presentUnder(primary, basis) ||
    johuStems.some((match) => match.receiverStemActive && presentUnder(match.seats, basis));
  const aggravates = heaviest.some((seats) => presentUnder(seats, basis));
  if (meets && aggravates) return 'mixed';
  if (meets) return 'supportive';
  if (aggravates) return 'conflicting';
  return 'not-comparable';
}

// ─── 못 정한 것 ─────────────────────────────────────────────────────────────

/** 내부 문구다(화면에 안 선다) */
const HOUR_UNKNOWN = {
  receiver: (sameAnswerHours: number) =>
    `받는 쪽: 시 미상 — 억부 1순위가 열두 시 중 ${sameAnswerHours} 시에서만 같음, 필요 자체가 바뀔 수 있음`,
  provider: '주는 쪽: 시 미상 — 여섯 글자만 보아 자리를 덜 셌을 수 있음',
} as const;

const GRADE_DOWN: Record<Grade, Grade> = { high: 'medium', medium: 'low', low: 'low' };

/**
 * 주는 쪽 명식이 받는 쪽의 필요에 어디서 닿는가 — **한 방향**이다. 쌍이면 두 번 부른다.
 *
 * 받는 쪽 프로필의 판정을 다시 하지 않는다. 억부 1순위 · 대안 · 조후 글자 · 가장 무거운 쪽을
 * 프로필에서 읽고, 주는 쪽 원국에서 그 오행 · 글자의 자리만 센다.
 */
export function needComplementOf(
  receiver: NeedProfile,
  provider: ProviderChart,
): DirectionalNeedComplement {
  const [primaryCandidate, ...rest] = receiver.eokbu.candidates;

  const eokbuPrimary: ElementMatch = {
    element: primaryCandidate.element,
    seats: providerSeatsOfElement(provider, primaryCandidate.element),
  };
  const eokbuAlternatives: AlternativeMatch[] = rest.map((candidate) => ({
    element: candidate.element,
    ruleId: candidate.ruleId,
    seats: providerSeatsOfElement(provider, candidate.element),
  }));
  const johuStems: JohuStemMatch[] = receiver.johu.stems.map((need) => ({
    stem: need.stem,
    element: need.element,
    receiverStemActive: need.active,
    seats: providerSeatsOfStem(provider, need.stem),
    sameElementOthers: STEMS.filter(
      (other) => other !== need.stem && STEM_INFO[other].element === need.element,
    ).flatMap((other) => {
      const seats = providerSeatsOfStem(provider, other);
      return presentUnder(seats, 'any') ? [{ stem: other, seats }] : [];
    }),
  }));

  const heaviest = receiver.aggravating.map((element) => ({
    element,
    seats: providerSeatsOfElement(provider, element),
  }));
  const counterSignals: CounterSignal[] = heaviest
    .filter(({ seats }) => presentUnder(seats, 'any'))
    .map(({ element, seats }) => ({ kind: 'supplies-heaviest', element, seats }));

  const heaviestSeats = heaviest.map(({ seats }) => seats);
  const relationOf = (basis: ComplementBasis) =>
    relationUnder(basis, eokbuPrimary.seats, johuStems, heaviestSeats);

  const receiverHour = receiver.eokbu.hour;
  const receiverHourKnown = receiverHour.hourKnown;
  const providerHourKnown = provider.hour !== null;
  const confidence =
    receiverHourKnown && providerHourKnown ? receiver.confidence : GRADE_DOWN[receiver.confidence];

  const unresolved = [
    ...receiver.unresolved.map((because) => `받는 쪽 프로필 — ${because}`),
    ...(receiverHour.hourKnown ? [] : [HOUR_UNKNOWN.receiver(receiverHour.sameAnswerHours)]),
    ...(providerHourKnown ? [] : [HOUR_UNKNOWN.provider]),
  ];

  return {
    status: 'experimental',
    support: 'not-graded',
    matched: { eokbuPrimary, eokbuAlternatives, johuStems },
    counterSignals,
    relationByBasis: {
      any: relationOf('any'),
      visible: relationOf('visible'),
      stems: relationOf('stems'),
    },
    confidence,
    unresolved,
    hour: { receiverHourKnown, providerHourKnown },
  };
}
