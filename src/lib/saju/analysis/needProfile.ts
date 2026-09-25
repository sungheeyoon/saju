import type { Element, Stem } from '../constants';
import type { Pillars } from '../pillars';
import { eokbuJudgementOf, glyphSeatOf, type EokbuJudgementOptions } from './eokbuJudgement';
import type { FollowingAssessment } from './followingPatterns';
import { johuJudgementOf } from './johuJudgement';
import type {
  ElementSeat,
  EokbuJohuRelation,
  EokbuJohuRelationKind,
  EokbuJudgement,
  Grade,
  JohuConditionKind,
  JohuJudgement,
  JohuStemNeed,
  NeedAction,
  NeedEntry,
  NeedProfile,
  PrecedenceSignal,
} from './needProfileTypes';
import { TONGGWAN_POLICY } from './tonggwan';
import { UNRESOLVED_FACTOR_KO } from './yongsin';

/**
 * 필요 오행 프로필 — 억부 판정 · 조후 판정을 **한 번씩** 부르고 둘의 관계를 값으로 낸다(ADR 0111).
 *
 * 궁합 점수가 아니다. 다음 일(A→B · B→A 보완 계산)이 이 함수를 사람마다 한 번씩, 두 번 부른다.
 * 그래서 **한 사람만 본다** — 상대를 받지 않고, 같은 명식이면 누구와 견주든 같은 값이다.
 *
 * 이 파일이 새로 판정하는 것은 **관계 하나**다. 억부는 오행 셋(1순위 · 대안 · 가장 무거운 쪽)만
 * 말하고 조후는 천간 몇 자를 말한다. 관계는 그 두 말이 겹치는가 · 부딪는가만 본다.
 *
 * - **서열은 정하지 않는다.** 억부 · 조후 중 무엇이 앞서는지 가를 외부 대조가 억부 20 건 · 조후 0 건
 *   이라, 넷의 신호(조후 급함 · 종격 · 조후 느슨 + 억부 뚜렷 · 같은 쪽)를 모으기만 한다. 둘이 같은
 *   쪽을 가리킬 때만 `reinforced` 이고, 나머지는 `unresolved` 와 그 까닭이다. `eokbu` · `johu` 값은
 *   계약에 있지만 이 판에서는 서지 않는다 — 설 근거가 생기면 그 대조와 함께 연다.
 * - **분포를 다시 읽지 않는다.** 두 판정이 각자 한 번씩 실효 분포를 읽었고, 여기서는 그 결과와
 *   원국의 글자 자리(`seatOfStem`)만 본다. 같은 세력을 두 번 세지 않는다.
 * - **세기를 새로 짓지 않는다.** 억부 1순위의 세기는 억부의 불균형 단계, 조후 글자의 세기는
 *   조후의 급함(지금은 늘 `unresolved`)이다. 둘이 같은 쪽을 가리켜도 단계를 올리지 않는다 —
 *   「더 필요하다」는 말은 `relation.precedence: 'reinforced'` 가 든다.
 */

export type NeedProfileOptions = {
  /** 상 · 하반월을 가를 출생 시각 — `johuJudgementOf` 로 간다 */
  instant?: Date;
  weights?: EokbuJudgementOptions['weights'];
  strength?: EokbuJudgementOptions['strength'];
  /** 합화 · 국을 끈 대조용 — `eokbuJudgementOf` 의 같은 옵션이다 */
  distribution?: EokbuJudgementOptions['distribution'];
};

type ProfileInput = Pick<Pillars, 'year' | 'month' | 'day' | 'hour' | 'dayMaster'> & {
  meta?: Pick<Pillars['meta'], 'monthTerm'>;
};

// ─── 관계 ───────────────────────────────────────────────────────────────────

/**
 * 억부 · 조후의 서열을 못 정한 까닭 — 내부 문구다(화면에 안 선다). 늘 드는 것은 첫 줄이다.
 */
const BECAUSE = {
  noExternalCheck: '억부 · 조후 서열을 가를 외부 대조가 없음(억부 20건 · 조후 0건)',
  johuUrgencyUnresolved: '조후 긴급도를 재는 외부 대조 0건',
  followingMayReverse: '종격이 억부를 뒤집을 수 있음',
  eokbuWithheld: '억부 판정을 거두었음',
  johuPartlyEvaluated: '조후 조건 일부(국 · 세력 · 적히지 않음)를 판정하지 않아 같은 쪽이 판정한 몫까지만 같음',
  noActiveJohu: '조후가 권하는 글자가 조건 판정 뒤 남지 않았음',
  johuOutsideEokbu: '조후 글자가 억부가 말한 오행(1순위 · 대안 · 가장 무거운 쪽) 밖에 있음',
  conflict: '조후 글자가 억부의 가장 무거운 쪽을 보탬 — 어느 쪽을 따를지 정한 규칙이 없음',
  partial: '조후 글자 일부만 억부 후보와 겹침',
  mildButClear: '조후가 느슨하고 억부 불균형이 뚜렷하다는 신호는 섰으나 억부를 앞세울 검증된 규칙이 없음',
} as const;

/**
 * 관계의 종류. 위에서부터 처음 맞는 줄이 선다.
 *
 * 1. `insufficient` — 억부가 판정을 거두었거나, 조건 판정 뒤 조후 활성 글자가 없는데 판정 안 한
 *    조건(국 · 세력 · 적히지 않음)이 남았다. 그 조건이 글자를 살렸을지 모른다.
 *    활성 글자가 있는 칸은 판정 안 한 조건이 남아도 여기 들지 않는다 — 조건이 하나라도 판정 안
 *    된 칸을 모두 빼면 무작위 표본의 38% 가 빠지고, 남은 조건은 표의 본 처방에 덧붙는 말이다.
 *    대신 그런 칸은 `same-direction` 이어도 `reinforced` 가 못 된다(아래 `eokbuJohuRelationOf`).
 * 2. `not-comparable` — 조건 판정 뒤 조후 활성 글자가 없고 판정 안 한 조건도 없다.
 * 3. `conflict` — 활성 글자 하나라도 억부의 가장 무거운 쪽 오행이다. 억부 규칙이 「이것이 가장
 *    무겁다」고 한 오행을 조후가 보탠다. 무거운 쪽이 아닌 다른 오행은 억부가 아무 말도 하지
 *    않았으므로 부딪는다고 하지 않는다.
 * 4. `same-direction` — 활성 글자가 **모두** 억부 1순위 오행이다. 대안 오행은 세지 않는다 — 대안은
 *    같은 스무 건에 맞춘 규칙이라 「둘이 같은 쪽」을 세울 만큼 서지 못했다.
 * 5. `partial` — 활성 글자 중 하나라도 1순위나 대안 오행이다(나머지는 억부가 말하지 않은 오행).
 * 6. `not-comparable` — 활성 글자가 모두 억부가 말하지 않은 오행이다. 억부의 말(1순위 · 대안 ·
 *    가장 무거운 쪽)로는 그 글자를 돕는다 · 거스른다 가를 수 없다. 오신 배정(`favorability`)으로
 *    가르면 가를 수는 있지만 그것은 억부 1순위를 용신에 놓은 뒤의 표라 여기서 판정으로 쓰지 않는다.
 */
function relationKindOf(eokbu: EokbuJudgement, johu: JohuJudgement): EokbuJohuRelationKind {
  if (eokbu.verdict === 'withheld') return 'insufficient';

  const active = johu.stems.filter((need) => need.active);
  if (active.length === 0) return johu.unevaluated.length > 0 ? 'insufficient' : 'not-comparable';

  const primary = eokbu.candidates[0].element;
  const eokbuWants = new Set(eokbu.candidates.map((candidate) => candidate.element));

  if (active.some((need) => need.element === eokbu.heaviest.element)) return 'conflict';
  if (active.every((need) => need.element === primary)) return 'same-direction';
  if (active.some((need) => eokbuWants.has(need.element))) return 'partial';
  return 'not-comparable';
}

/**
 * 억부 판정과 조후 판정의 관계 — **대조와 신호**다. 서열은 세우지 않는다.
 *
 * `following` 을 주면 종격 판정 이름을 까닭에 싣는다. 종격이 억부를 뒤집을 수 있는가는
 * 억부 판정(`followingMayReverse`)이 이미 들고 있어 그것만으로 신호가 선다.
 *
 * 신호 넷:
 * - `johu-urgent` — 조후 급함이 `high` 일 때. 지금은 급함을 늘 `unresolved` 로 내므로 서지 않는다.
 * - `following-may-reverse` — 억부 판정이 그렇다고 말할 때.
 * - `johu-mild-and-eokbu-imbalance-clear` — 월지로 본 계절이 `mild` 이고 억부 불균형이 `high`.
 *   **신호지 규칙이 아니다** — 「조후가 느슨하면 억부가 앞선다」는 여러 계통의 말이지만 대조한 적이 없다.
 * - `both-point-same-way` — 관계가 `same-direction` 일 때.
 *
 * `reinforced` 는 `same-direction` 이고 다음 둘이 다 설 때만이다.
 * - 종격이 억부를 뒤집을 수 없다 — 서면 두 길이 같은 쪽을 가리켜도 그 쪽 자체가 뒤집힐 수 있다.
 * - 조후 칸의 조건을 모두 판정했다 — 판정 안 한 조건(「수가 왕하면 戊」)이 다른 오행의 글자를
 *   더할 수 있어, 그 조건이 남은 칸의 「같은 쪽」은 판정한 몫까지만 같다는 말이다.
 */
export function eokbuJohuRelationOf(
  eokbu: EokbuJudgement,
  johu: JohuJudgement,
  following?: Pick<FollowingAssessment, 'verdict'>,
): EokbuJohuRelation {
  const kind = relationKindOf(eokbu, johu);

  const signals: PrecedenceSignal[] = [];
  if (johu.urgency === 'high') signals.push('johu-urgent');
  if (eokbu.followingMayReverse) signals.push('following-may-reverse');
  if (johu.season.temperature === 'mild' && eokbu.imbalance === 'high') {
    signals.push('johu-mild-and-eokbu-imbalance-clear');
  }
  if (kind === 'same-direction') signals.push('both-point-same-way');

  if (kind === 'same-direction' && !eokbu.followingMayReverse && johu.unevaluated.length === 0) {
    return { kind, precedence: 'reinforced', signals, unresolvedBecause: [] };
  }

  const because: string[] = [BECAUSE.noExternalCheck];
  if (johu.urgency === 'unresolved') because.push(BECAUSE.johuUrgencyUnresolved);
  if (eokbu.followingMayReverse) {
    because.push(
      following === undefined
        ? BECAUSE.followingMayReverse
        : `${BECAUSE.followingMayReverse}(종격 판정 ${following.verdict})`,
    );
  }
  if (kind === 'insufficient') {
    because.push(eokbu.verdict === 'withheld' ? BECAUSE.eokbuWithheld : BECAUSE.noActiveJohu);
  }
  if (kind === 'not-comparable') {
    because.push(
      johu.stems.some((need) => need.active) ? BECAUSE.johuOutsideEokbu : BECAUSE.noActiveJohu,
    );
  }
  if (kind === 'same-direction' && johu.unevaluated.length > 0) {
    because.push(BECAUSE.johuPartlyEvaluated);
  }
  if (kind === 'conflict') because.push(BECAUSE.conflict);
  if (kind === 'partial') because.push(BECAUSE.partial);
  if (signals.includes('johu-mild-and-eokbu-imbalance-clear')) because.push(BECAUSE.mildButClear);

  return { kind, precedence: 'unresolved', signals, unresolvedBecause: because };
}

// ─── 프로필 ─────────────────────────────────────────────────────────────────

/**
 * 조후 글자 하나가 원국 어디에 앉았는가 — `ElementSeat` 의 선(일간 제외)으로 **글자대로** 센다.
 *
 * 조후 판정의 `presence` 는 일간까지 보고 본기 · 여기를 가르지 않아 그대로 옮기지 않는다.
 * 같은 오행의 다른 글자는 세지 않는다 — 丙 자리에 丁이 있어도 丙은 `absent` 다.
 */
const seatOfStem = (pillars: ProfileInput, stem: Stem): ElementSeat =>
  glyphSeatOf(pillars, (other) => other === stem).seat;

const JOHU_CONDITION_KO: Record<JohuConditionKind, string> = {
  'half-month': '상 · 하반월',
  'stem-presence-fallback': '앞 글자의 실재',
  'stem-rooting': '그 글자의 뿌리',
  avoidance: '꺼리는 글자',
  bureau: '국이 섰는가',
  'force-threshold': '세력 문턱',
  unspecified: '적히지 않은 조건',
};

const GRADE_RANK: Record<Grade, number> = { low: 0, medium: 1, high: 2 };
const lowerOf = (a: Grade, b: Grade): Grade => (GRADE_RANK[a] <= GRADE_RANK[b] ? a : b);

function eokbuEntries(eokbu: EokbuJudgement): NeedEntry[] {
  // 신약이면 그 오행이 일간을 돕고, 신강이면 일간을 누르거나 뺀다 — 오행이 일간에 하는 일이다.
  const action: NeedAction = eokbu.direction === 'support' ? 'reinforce' : 'restrain';
  return eokbu.candidates.map((candidate) => ({
    target: { kind: 'element', element: candidate.element },
    action,
    // 대안은 같은 스무 건에 맞춘 규칙이라 불균형이 뚜렷해도 `low` 에 둔다.
    strength: candidate.rule === 'primary' ? eokbu.imbalance : 'low',
    oversupply: 'unknown',
    seat: candidate.seat,
    // 조후가 같은 오행을 권해도 여기에 `johu` 를 더하지 않는다 — 그 글자는 조후 칸이 따로 들고,
    // 둘이 겹친다는 사실은 `relation` 이 든다. 한 필요를 두 줄로 세지 않는다.
    sources: ['eokbu'],
  }));
}

function johuEntries(pillars: ProfileInput, johu: JohuJudgement): NeedEntry[] {
  return johu.stems
    .filter((need: JohuStemNeed) => need.active)
    .map((need) => ({
      target: { kind: 'stem', stem: need.stem },
      action: 'johu',
      strength: johu.urgency,
      oversupply: 'unknown',
      seat: seatOfStem(pillars, need.stem),
      sources: ['johu'],
    }));
}

/**
 * 한 사람의 필요 오행 프로필.
 *
 * - `entries` — 억부 1순위 · 대안(있으면) · 조후 활성 글자. 통관은 판정이 없어(`TONGGWAN_POLICY.verdict`)
 *   줄이 없고 `unresolved` 에 그 사실을 든다.
 * - `aggravating` — 억부가 가장 무겁다고 본 오행 하나. 기신이 아니다.
 * - `confidence` — 억부 · 조후 신뢰도 중 낮은 쪽. 관계가 `insufficient` · `conflict` 면 `low`.
 *   조후가 늘 `low` 라 지금은 늘 `low` 다 — 억부의 `medium` 은 `eokbu.confidence` 에 남는다.
 * - `unresolved` — 한국어 낱말로 모은다(억부 미결 · 조후가 판정 안 한 조건 · 원국 한난조습 · 관계의
 *   까닭 · 통관).
 */
export function needProfileOf(pillars: ProfileInput, options: NeedProfileOptions = {}): NeedProfile {
  const eokbu = eokbuJudgementOf(pillars, {
    weights: options.weights,
    strength: options.strength,
    distribution: options.distribution,
  });
  const johu = johuJudgementOf(pillars, options.instant);
  const relation = eokbuJohuRelationOf(eokbu, johu);

  const heaviest: Element = eokbu.heaviest.element;
  const confidence: Grade =
    relation.kind === 'insufficient' || relation.kind === 'conflict'
      ? 'low'
      : lowerOf(eokbu.confidence, johu.confidence);

  const unresolved = [
    ...new Set([
      ...eokbu.unresolved.map((factor) => `억부: ${UNRESOLVED_FACTOR_KO[factor]}`),
      ...johu.unevaluated.map((kind) => `조후: 판정 안 한 조건 — ${JOHU_CONDITION_KO[kind]}`),
      ...(johu.chartClimate === 'unresolved' ? ['조후: 원국 전체의 한난조습'] : []),
      ...relation.unresolvedBecause.map((because) => `관계: ${because}`),
      ...(TONGGWAN_POLICY.verdict === 'none' ? ['통관: 판정 없음(사실만 낸다)'] : []),
    ]),
  ];

  return {
    status: 'experimental',
    entries: [...eokbuEntries(eokbu), ...johuEntries(pillars, johu)],
    aggravating: [heaviest],
    eokbu,
    johu,
    relation,
    confidence,
    unresolved,
  };
}
