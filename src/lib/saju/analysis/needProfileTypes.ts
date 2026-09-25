import type { Branch, Element, Stem } from '../constants';
import type { PillarPosition } from '../position';
import type { JudgementKey } from './precedence';
import type { ElementRole, UnresolvedFactor } from './yongsin';

/**
 * 필요 오행 프로필의 **계약** — 억부 판정 · 조후 판정 · 둘의 관계 · 프로필이 서로 주고받는
 * 모양만 둔다(ADR 0111). 판정 코드는 각자의 파일에 있다.
 *
 * - 억부 판정 `eokbuJudgementOf` → `eokbuJudgement.ts`
 * - 조후 판정 `johuJudgementOf` → `johuJudgement.ts`
 * - 관계 · 프로필 `needProfileOf` → `needProfile.ts`
 *
 * **기존 값의 모양은 그대로다.** `EokbuAssessment` · `JohuAssessment` 는 프롬프트 · 문장 층 ·
 * 근거 스냅샷 · 원국 화면이 읽는다. 여기 것은 그 옆에 덧붙는 새 값이고, `Analysis` 에도
 * 아직 싣지 않는다 — 읽는 자리가 궁합 보완 계산 하나뿐이라서다.
 *
 * **소수를 만들지 않는다.** 근거가 외부 대조 스무 건(억부) · 0 건(조후)이라 세기는 단계로만
 * 말하고, 못 정하면 `'unresolved'` 와 그 까닭을 값으로 든다.
 */

/** 세기 · 신뢰도의 단계. 수가 아니다 */
export type Grade = 'low' | 'medium' | 'high';

/** 못 정했으면 못 정했다고 말한다 — 빈칸을 `low` 로 채우지 않는다 */
export type GradeOrUnresolved = Grade | 'unresolved';

/**
 * 오행 하나가 원국의 어디에 앉았는가. **일간 자신은 세지 않는다.**
 *
 * 측정(`docs/notes/2026-09-25-need-profile-baseline.md` 3)에서 출처는 고른 오행이 천간에
 * 드러난 것을 20건 중 16건 골랐고 엔진은 11건이었다 — 문턱 없이 세는 사실이라 먼저 든다.
 */
export type ElementSeat =
  /** 천간에 드러났다(일간 제외) */
  | 'revealed'
  /** 드러나지 않았지만 지지의 본기다 */
  | 'branch-main'
  /** 지장간 중기 · 여기로만 있다 */
  | 'hidden-only'
  /** 여덟 글자 어디에도 없다 */
  | 'absent';

/** 시(時)를 모를 때 판정이 얼마나 흔들리는가 — 열두 시를 다 넣어 본 사실이다 */
export type HourSensitivity =
  | { hourKnown: true }
  | {
      hourKnown: false;
      /** 열두 시 가운데 지금(시 없음) 판정과 같은 답을 낸 시의 수 — 0~12 */
      sameAnswerHours: number;
    };

// ─── 억부 ───────────────────────────────────────────────────────────────────

/** 억부가 권하는 쪽: 신약이면 돕고, 신강이면 누르거나 뺀다 */
export type EokbuDirection = 'support' | 'restrain';

/** 억부 후보 하나. 규칙이 둘 이상 서면 후보도 여럿이다 */
export type EokbuCandidate = {
  element: Element;
  role: ElementRole;
  /**
   * 어느 규칙에서 나왔는가.
   *
   * `primary` 는 지금 `eokbuAssessmentOf` 가 낸 것과 **같은 오행**이어야 한다(시험이 잠근다).
   * `alternative` 는 외부 대조에서 설명력이 보였지만 같은 자료로 맞춘 규칙이라 기준을
   * 못 바꾸는 것이다 — 예: 「신약 · 재성이 가장 무거움 → 인성이 드러났으면 인성」.
   */
  rule: 'primary' | 'alternative';
  /** 규칙 이름(영문 슬러그)과 한 줄 근거 */
  ruleId: string;
  reason: string;
  seat: ElementSeat;
  /** 그 오행이 드러난 자리 · 숨은 자리 — `seat` 의 근거 */
  revealedAt: readonly PillarPosition[];
  hiddenAt: readonly PillarPosition[];
};

export type EokbuJudgement = {
  status: 'experimental';
  /** 억부로 볼 수 없는 명식이면 `withheld` — 예: 종격이 서서 방향이 뒤집힐 수 있을 때도 판정은 내되 이것은 `judged` 다 */
  verdict: 'judged' | 'withheld';
  direction: EokbuDirection;
  /** 첫 줄이 `primary` 다 */
  candidates: readonly EokbuCandidate[];
  /**
   * 불균형이 얼마나 뚜렷한가. 강약 기준 셋 중 몇을 채웠는가처럼 **이미 있는 셈**에서만
   * 단계를 낸다. 새 문턱이 필요하면 `unresolved`.
   */
  imbalance: GradeOrUnresolved;
  /**
   * 무거운 쪽 — 억부 규칙이 「이것이 가장 무겁다」고 본 오행. 이 오행을 더 받으면 불균형이
   * 커진다는 것은 억부 규칙 자체의 말이다. **기신이 아니다**(기신은 병을 봐야 정해진다).
   */
  heaviest: { element: Element; role: ElementRole };
  /** 종격 판정이 억부 방향을 뒤집을 수 있는가 — 서열은 여전히 억부지만 알린다 */
  followingMayReverse: boolean;
  hour: HourSensitivity;
  confidence: Grade;
  unresolved: readonly UnresolvedFactor[];
  /** 판정 근거 — 사람이 읽을 짧은 줄들(내부 문구, 화면에 안 선다) */
  basis: readonly string[];
};

// ─── 조후 ───────────────────────────────────────────────────────────────────

/** 조후표 조건 하나를 어떻게 다루었는가 */
export type JohuConditionKind =
  | 'half-month'
  /** 「丙이 없으면 庚」 — 앞 글자의 실재로 답한다 */
  | 'stem-presence-fallback'
  /** 「丁이 통근하면」 — 그 글자의 뿌리로 답한다 */
  | 'stem-rooting'
  /** 「癸를 꺼린다」 */
  | 'avoidance'
  /** 「화국이면」 — 국이 섰다고 볼 문턱을 아직 안 골랐다 */
  | 'bureau'
  /** 「수가 왕하면」 — 세력 문턱이 있어야 한다 */
  | 'force-threshold'
  /** 「원국에 따라 참작」 — 조건이 적혀 있지 않다 */
  | 'unspecified';

export type JohuCondition = {
  kind: JohuConditionKind;
  /** 원문 요약 한 줄(표의 `note` 에서) */
  text: string;
  evaluation: 'met' | 'not-met' | 'not-evaluated';
};

/** 조후가 권한 **천간 하나.** 오행으로 줄이지 않는다 */
export type JohuStemNeed = {
  stem: Stem;
  element: Element;
  presence: 'revealed' | 'hidden' | 'absent';
  /** 그 글자가 지지에 뿌리를 두었는가. 없는 글자면 `null` */
  rooted: boolean | null;
  /**
   * 같은 오행의 **다른 천간** 중 원국에 있는 것. 대신 선다는 뜻이 아니다 —
   * 丙 자리에 丁은 다른 사정이다. 대체 가능 여부는 `substitutable` 이 따로 든다.
   */
  sameElementOthers: readonly { stem: Stem; presence: 'revealed' | 'hidden' }[];
  /** 표가 대체를 말했으면 `true`, 말하지 않았으면 `'unresolved'` — 추측하지 않는다 */
  substitutable: true | 'unresolved';
  /** 조건 판정 뒤 이 글자가 아직 권해지는가 */
  active: boolean;
};

export type JohuJudgement = {
  status: 'reference-with-conditions';
  dayMaster: Stem;
  monthBranch: Branch;
  /**
   * 월지로 보는 계절의 한난조습 — **월지 하나에서만** 나온 사실이다.
   * 원국 전체의 한난조습은 세력 문턱이 필요해 `unresolved` 로 둔다.
   */
  season: {
    temperature: 'cold' | 'hot' | 'mild';
    moisture: 'wet' | 'dry' | 'neutral';
    basis: 'month-branch';
  };
  chartClimate: 'unresolved';
  /** 조후 문제가 얼마나 급한가. 근거가 없으면 `unresolved` 와 까닭 */
  urgency: GradeOrUnresolved;
  urgencyBasis: readonly string[];
  stems: readonly JohuStemNeed[];
  conditions: readonly JohuCondition[];
  /** 자동 판정 못 한 조건이 하나라도 있으면 그 종류들 */
  unevaluated: readonly JohuConditionKind[];
  hour: HourSensitivity;
  confidence: Grade;
};

// ─── 관계 ───────────────────────────────────────────────────────────────────

export type EokbuJohuRelationKind =
  /** 조후가 권한 활성 글자 중에 억부 1순위 오행짜리가 있고, 억부 방향과 어긋나는 글자가 없다 */
  | 'same-direction'
  /** 일부만 겹친다 */
  | 'partial'
  /** 조후 글자가 억부가 누르려는 쪽(무거운 쪽)을 보탠다 */
  | 'conflict'
  /** 같은 자로 잴 수 없다 — 예: 조후 활성 글자가 없다 */
  | 'not-comparable'
  /** 한쪽 판정이 `withheld` 거나 조건이 거의 판정되지 않았다 */
  | 'insufficient';

/** 우선순위를 정할 수 있게 하는 조건들 — 무엇이 서면 어느 쪽이 설 수 있는가 */
export type PrecedenceSignal =
  | 'johu-urgent'
  | 'following-may-reverse'
  | 'johu-mild-and-eokbu-imbalance-clear'
  | 'both-point-same-way';

export type EokbuJohuRelation = {
  kind: EokbuJohuRelationKind;
  /** 어느 쪽이 우선하는가 — 검증된 규칙이 없으면 `unresolved` */
  precedence: 'eokbu' | 'johu' | 'reinforced' | 'unresolved';
  /** 지금 명식에서 선 신호들 */
  signals: readonly PrecedenceSignal[];
  /** `unresolved` 인 까닭 — 비어 있으면 안 된다(시험이 잠근다) */
  unresolvedBecause: readonly string[];
};

// ─── 프로필 ─────────────────────────────────────────────────────────────────

export type NeedTarget = { kind: 'element'; element: Element } | { kind: 'stem'; stem: Stem };

export type NeedAction = 'reinforce' | 'restrain' | 'johu' | 'tonggwan';

export type NeedEntry = {
  target: NeedTarget;
  action: NeedAction;
  strength: GradeOrUnresolved;
  /** 넘치게 받으면 불리해지는가 — 규칙이 말하지 않으면 `unknown` */
  oversupply: 'harmful' | 'not-harmful' | 'unknown';
  /** 원국에서 쓸 수 있는가 */
  seat: ElementSeat;
  /** 어느 판정에서 나왔는가 — 여러 판정이 같은 것을 권하면 여럿 */
  sources: readonly JudgementKey[];
};

/**
 * 한 사람의 필요 오행 프로필 — **궁합 점수가 아니다.** 후속 A→B · B→A 보완 계산의 입력이다.
 *
 * 같은 오행 분포를 여러 번 세지 않도록, 억부 · 조후 판정은 각자 한 번씩만 분포를 읽고 이
 * 프로필은 그 결과만 합친다. 두 사람을 보지 않는다 — A/B 순서와 무관하다.
 */
export type NeedProfile = {
  status: 'experimental';
  entries: readonly NeedEntry[];
  /** 무거운 쪽 — 넘치면 불리해지는 오행(억부 규칙의 말) */
  aggravating: readonly Element[];
  eokbu: EokbuJudgement;
  johu: JohuJudgement;
  relation: EokbuJohuRelation;
  confidence: Grade;
  unresolved: readonly string[];
};

export const NEED_PROFILE_POLICY = {
  ruleSet: 'need-profile-v1',
  status: 'experimental',
  /** 궁합 점수를 내지 않는다 — `COMPAT_POLICY.scoring` 과 같은 선 */
  scoring: 'not-scored',
  /** 억부 · 조후 우선순위는 신호만 모으고 확정하지 않는다 */
  precedence: 'signals-not-ranked',
  grades: 'ordinal-not-numeric',
} as const;
