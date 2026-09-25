import { BRANCHES, HIDDEN_STEMS, STEMS, STEM_INFO, type Branch, type Stem } from '../constants';
import { hourPillarOf, type Pillars } from '../pillars';
import { PILLAR_POSITIONS } from '../position';
import { johuAssessmentOf, type JohuAssessment } from './johu';
import { JOHU_CONDITIONS, type JohuConditionSpec, type StemPresenceWhen } from './johuConditions';
import type {
  Grade,
  HourSensitivity,
  JohuCondition,
  JohuConditionKind,
  JohuJudgement,
  JohuStemNeed,
} from './needProfileTypes';
import { rootednessOf, type Rootedness } from './rootedness';

/**
 * 조후 판정 — 참고표(`johuAssessmentOf`) 위에 **문턱 없이 답할 수 있는 조건만** 판정해 얹는다(ADR 0111).
 *
 * 120칸 중 조건 없는 칸이 44, 반월 · 앞 글자의 실재 · 그 글자의 뿌리 · 꺼림만으로 끝까지 답하는
 * 칸이 24다(`johuConditions.ts`). 국 · 세력 문턱 · 적히지 않은 조건은 `not-evaluated` 로 남기고
 * `unevaluated` 에 종류를 든다 — 국이 섰다고 볼 등급(`bureau.ts` 의 반합 · 공협 · 완성)을 아직
 * 고르지 않았고, `effectiveElementsOf` 도 국을 「섰다 / 안 섰다」로 말하지 않고 무게(`pull`)로만
 * 기울이므로 여기서 읽어 쓸 이분 사실이 없다.
 *
 * **급함은 정하지 않는다.** 조후 외부 대조가 0 건이고 원국 전체의 한난조습은 세력 문턱이 있어야
 * 잰다. 표가 「급하다」고 적은 칸(乙巳 · 戊午)도 그 말을 단계로 옮길 규칙이 없어 사실로만
 * `urgencyBasis` 에 적는다. 신뢰도도 같은 까닭으로 늘 `low` 다 — 시를 몰라도 더 내려갈 단계가 없다.
 */

/**
 * 월지 하나로 보는 한난조습 — **조후론의 통설을 표로 적었다.** 원국 전체가 아니라 달의 성질이다.
 *
 * - 온도: 亥子丑 겨울은 한(寒), 巳午未 여름은 열(熱). 봄 · 가을 여섯 달은 `mild` 로 둔다.
 *   寅은 「초봄의 한기」(조후표 甲寅 · 乙寅 · 己寅), 申酉戌은 추기(秋氣)라 서늘하다고 읽는 계통이
 *   있으나 차다고 할지 갈리므로 가운데에 둔다.
 * - 습도: 辰丑은 습토(濕土), 未戌은 조토(燥土)다 — 《적천수》 이래 네 고지를 가르는 말이 이것이다.
 *   亥子는 수(水)라 습, 巳午는 화(火)라 조. 寅卯申酉는 한쪽으로 말하지 않아 `neutral` 이다.
 */
export const JOHU_SEASON_BY_MONTH: Record<Branch, JohuJudgement['season']> = {
  寅: { temperature: 'mild', moisture: 'neutral', basis: 'month-branch' },
  卯: { temperature: 'mild', moisture: 'neutral', basis: 'month-branch' },
  辰: { temperature: 'mild', moisture: 'wet', basis: 'month-branch' },
  巳: { temperature: 'hot', moisture: 'dry', basis: 'month-branch' },
  午: { temperature: 'hot', moisture: 'dry', basis: 'month-branch' },
  未: { temperature: 'hot', moisture: 'dry', basis: 'month-branch' },
  申: { temperature: 'mild', moisture: 'neutral', basis: 'month-branch' },
  酉: { temperature: 'mild', moisture: 'neutral', basis: 'month-branch' },
  戌: { temperature: 'mild', moisture: 'dry', basis: 'month-branch' },
  亥: { temperature: 'cold', moisture: 'wet', basis: 'month-branch' },
  子: { temperature: 'cold', moisture: 'wet', basis: 'month-branch' },
  丑: { temperature: 'cold', moisture: 'wet', basis: 'month-branch' },
};

export const JOHU_JUDGEMENT_POLICY = {
  ruleSet: 'johu-judgement-v1',
  status: 'reference-with-conditions',
  /** 문턱 없이 답하는 조건만 판정한다 */
  evaluated: ['half-month', 'stem-presence-fallback', 'stem-rooting', 'avoidance'],
  /** 국 · 세력 · 적히지 않은 조건은 판정하지 않는다 */
  notEvaluated: ['bureau', 'force-threshold', 'unspecified'],
  /** 급함은 외부 대조가 생기기 전까지 정하지 않는다 */
  urgency: 'unresolved',
  /** 조후 외부 대조 0 건 — 늘 `low` */
  confidence: 'low',
} as const satisfies {
  ruleSet: string;
  status: JohuJudgement['status'];
  evaluated: readonly JohuConditionKind[];
  notEvaluated: readonly JohuConditionKind[];
  urgency: 'unresolved';
  confidence: Grade;
};

/**
 * 네 기둥과, 상 · 하반월을 볼 때만 그 달을 연 절기. `Pillars` 가 그대로 들어간다 —
 * 시험이 간지만으로 명식을 지을 수 있게 `meta` 를 다 요구하지 않는다(`johuAssessmentOf` 와 같다).
 */
export type JohuJudgementInput = Pick<Pillars, 'year' | 'month' | 'day' | 'hour' | 'dayMaster'> & {
  meta?: Pick<Pillars['meta'], 'monthTerm'>;
};

type Seen = { presence: JohuStemNeed['presence']; inBranch: boolean };

/** 한 글자가 원국 어디에 있는가 — `johu.ts` 의 `locate` 와 같은 선(시험이 견준다) */
function seenOf(pillars: JohuJudgementInput, stem: Stem): Seen {
  let revealed = false;
  let inBranch = false;

  for (const position of PILLAR_POSITIONS) {
    const pillar = pillars[position];
    if (!pillar) continue;
    if (pillar.stem === stem) revealed = true;
    if (HIDDEN_STEMS[pillar.branch].some((hidden) => hidden.stem === stem)) inBranch = true;
  }

  return {
    presence: revealed ? 'revealed' : inBranch ? 'hidden' : 'absent',
    inBranch,
  };
}

function holds(seen: Seen, when: StemPresenceWhen): boolean {
  switch (when) {
    case 'absent':
      return seen.presence === 'absent';
    case 'present':
      return seen.presence !== 'absent';
    case 'revealed':
      return seen.presence === 'revealed';
    case 'in-branch':
      return seen.inBranch;
  }
}

/**
 * 그 글자가 뿌리를 두었는가 — 뿌리의 뜻은 `rootedness.ts` 다(같은 오행의 지장간).
 *
 * 천간에 드러났으면 그 천간의 `rooted` 를 읽는다. 지장간으로만 있으면 그 글자 자신이 지지 안에
 * 있으므로 같은 규칙으로 뿌리가 있다(`same-stem`). 없는 글자는 `null` 이다.
 */
function rootedOf(rootedness: Rootedness, stem: Stem, seen: Seen): boolean | null {
  if (seen.presence === 'absent') return null;
  if (seen.presence === 'hidden') return true;
  return rootedness.stems.some((rooting) => rooting.stem === stem && rooting.rooted);
}

type Evaluated = {
  spec: JohuConditionSpec;
  evaluation: JohuCondition['evaluation'];
};

function evaluate(
  spec: JohuConditionSpec,
  pillars: JohuJudgementInput,
  rootedness: Rootedness,
  assessment: JohuAssessment,
): JohuCondition['evaluation'] {
  switch (spec.kind) {
    // 절반을 알아 그 절반의 후보를 골랐으면 `met` — 모르면 여섯 칸에서 다른 천간을 권할 수 있다.
    case 'half-month':
      return assessment.half === null ? 'not-evaluated' : 'met';
    case 'stem-presence-fallback': {
      const each = spec.trigger.map((stem) => holds(seenOf(pillars, stem), spec.when));
      const met = spec.match === 'all' ? each.every(Boolean) : each.some(Boolean);
      return met ? 'met' : 'not-met';
    }
    // 통근은 천간의 일이다 — 지장간으로만 있는 글자는 「통근했다」고 하지 않는다.
    case 'stem-rooting': {
      const met = rootedness.stems.some(
        (rooting) =>
          spec.stems.includes(rooting.stem) &&
          rooting.roots.some(
            (root) => spec.branches === null || spec.branches.includes(root.branch),
          ),
      );
      return met ? 'met' : 'not-met';
    }
    // `met` 은 꺼리는 글자가 천간에 드러났다는 뜻이다. 권하는 글자를 끄지 않는다.
    case 'avoidance':
      return seenOf(pillars, spec.stem).presence === 'revealed' ? 'met' : 'not-met';
    case 'bureau':
    case 'force-threshold':
    case 'unspecified':
      return 'not-evaluated';
  }
}

/** 시 하나를 넣은 판정 — 시 민감도는 바깥에서 센다 */
function judgementAt(
  pillars: JohuJudgementInput,
  instant: Date | undefined,
): Omit<JohuJudgement, 'hour'> {
  const assessment = johuAssessmentOf(pillars, instant);
  const rootedness = rootednessOf(pillars);
  const { dayMaster, monthBranch } = assessment;
  const specs = JOHU_CONDITIONS[dayMaster][monthBranch];

  const evaluated: Evaluated[] = specs.map((spec) => ({
    spec,
    evaluation: evaluate(spec, pillars, rootedness, assessment),
  }));

  // 목록은 참고표가 센 것과 같다. 「없으면 庚」처럼 목록 밖 글자는 뒤에 붙는다(癸寅 · 癸巳 · 庚午).
  const base = assessment.halfStems ?? assessment.stems;
  const gates = evaluated.flatMap(({ spec, evaluation }) =>
    spec.kind === 'stem-presence-fallback' && spec.effect === 'gate'
      ? [{ use: spec.use, met: evaluation === 'met' }]
      : [],
  );
  const listed = [...base];
  for (const gate of gates) {
    for (const stem of gate.use) if (!listed.includes(stem)) listed.push(stem);
  }

  const substitutable = new Set(
    specs.flatMap((spec) =>
      spec.kind === 'stem-presence-fallback' && spec.substitute ? spec.trigger : [],
    ),
  );

  const stems: JohuStemNeed[] = listed.map((stem) => {
    const seen = seenOf(pillars, stem);
    const element = STEM_INFO[stem].element;
    const gatedBy = gates.filter((gate) => gate.use.includes(stem));

    return {
      stem,
      element,
      presence: seen.presence,
      rooted: rootedOf(rootedness, stem, seen),
      sameElementOthers: STEMS.filter(
        (other) => other !== stem && STEM_INFO[other].element === element,
      ).flatMap((other) => {
        const presence = seenOf(pillars, other).presence;
        return presence === 'absent' ? [] : [{ stem: other, presence }];
      }),
      substitutable: substitutable.has(stem) ? true : 'unresolved',
      active: gatedBy.every((gate) => gate.met),
    };
  });

  const conditions: JohuCondition[] = evaluated.map(({ spec, evaluation }) => ({
    kind: spec.kind,
    text: spec.text,
    evaluation,
  }));
  const unevaluated = [
    ...new Set(conditions.filter((c) => c.evaluation === 'not-evaluated').map((c) => c.kind)),
  ];

  const urgencyBasis = [
    '조후 외부 대조 사례가 0 건이라 급함을 단계로 가를 근거가 없다',
    '원국 전체의 한난조습은 세력 문턱이 있어야 재므로 판정하지 않는다',
    ...(assessment.note.includes('급')
      ? ['표가 이 칸을 급하다고 적었다 — 단계로 옮길 규칙은 아직 없다']
      : []),
  ];

  return {
    status: 'reference-with-conditions',
    dayMaster,
    monthBranch,
    season: JOHU_SEASON_BY_MONTH[monthBranch],
    chartClimate: 'unresolved',
    urgency: JOHU_JUDGEMENT_POLICY.urgency,
    urgencyBasis,
    stems,
    conditions,
    unevaluated,
    confidence: JOHU_JUDGEMENT_POLICY.confidence,
  };
}

/** 판정의 답 — 활성 글자의 집합 */
const answerOf = (judgement: Pick<JohuJudgement, 'stems'>): string =>
  judgement.stems
    .filter((need) => need.active)
    .map((need) => need.stem)
    .sort()
    .join('');

/**
 * 조후 판정. `instant` 를 주면 상 · 하반월까지 판정한다(`johuAssessmentOf` 와 같은 시계).
 *
 * 시를 모르면 열두 시를 다 넣어 보고, 시 없는 판정과 **활성 글자 집합**이 같은 시의 수를 낸다.
 */
export function johuJudgementOf(pillars: JohuJudgementInput, instant?: Date): JohuJudgement {
  const judgement = judgementAt(pillars, instant);

  if (pillars.hour !== null) return { ...judgement, hour: { hourKnown: true } };

  const answer = answerOf(judgement);
  const sameAnswerHours = BRANCHES.filter(
    (branch) =>
      answerOf(
        judgementAt({ ...pillars, hour: hourPillarOf(pillars.dayMaster, branch) }, instant),
      ) === answer,
  ).length;
  const hour: HourSensitivity = { hourKnown: false, sameAnswerHours };

  return { ...judgement, hour };
}
