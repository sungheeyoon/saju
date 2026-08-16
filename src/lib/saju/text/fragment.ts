import { ELEMENT_ROLE_KO, type ElementRole } from '../analysis';
import { RELATION_KIND_KO } from '../relations';
import {
  ceilingFor,
  checkSentence,
  type ClaimPath,
  type ClaimPolarity,
  type ClaimStrength,
  type TextViolation,
  type TextViolationRule,
} from './policy';

/**
 * L3 조각 스키마 — **어떤 키로 조회되고 무엇을 입력으로 받는가.**
 *
 * 계약(`policy.ts`)이 "얼마나 세게 말해도 되는가"를 정했다면 여기는 그 계약을
 * 지키는 문장이 실제로 어떤 모양이어야 하는지를 정한다. 아직 생성기는 없다 —
 * 이 파일은 생성기에게 **무엇을 몇 개 만들어야 하는지 적어 주는 작업 지시서**이고,
 * 씨앗 조각 여섯 개는 스키마가 실제로 문장을 받아 내는지 보이는 자리다.
 *
 * 정한 넷:
 *
 * 1. **근거는 조각이 아니라 주제가 적는다.** 조각이 `paths` 를 직접 들면
 *    억부 문장에 `paths: ['pillars']` 를 적어 상한을 `fact` 로 올릴 수 있다 —
 *    손으로 `strength: 'fact'` 를 적는 것과 **같은 구멍이 한 겹 위로 옮겨 온
 *    것**뿐이다. `polarity` 도 같다. 그래서 주제가 근거·방향을 못박고 조각은
 *    그 아래에서 표현만 고른다.
 * 2. **조회 키는 `주제/변종@강도`다.** 강도가 키에 있는 것은 조각이 강도를
 *    선언한다는 뜻이 **아니다.** 강도는 여전히 `ceilingFor` 가 내고, 키는 그
 *    강도에 맞는 **표현 변형을 고르는 데만** 쓰인다. 조각이 하나뿐이면 시간
 *    미상에서 한 칸 내려간 강도까지 감당해야 해서 가장 약한 표현으로 써야 하고,
 *    그러면 시각을 아는 흔한 경우까지 눌려 상한 체계가 통째로 바닥으로 무너진다.
 * 3. **변종은 유한하고 슬롯은 무한하다.** 변종은 문장이 갈리는 자리라 빌드
 *    타임에 전수로 돌 수 있어야 하고, 슬롯은 런타임에 데이터가 꽂히는 자리다.
 *    관계 이름 `자축합토` 는 변종이 아니라 슬롯이다 — 그래야 조각 안에 관계
 *    이름이 없고, 없는 관계를 말하려면 없는 데이터가 먼저 있어야 한다.
 * 4. **슬롯 뒤에 조사를 붙이지 않는다.** 이/가·을/를·은/는·(으)로는 앞 글자의
 *    받침을 따르는데 슬롯 값은 런타임에 정해진다. `{element}를` 은 화·토·수에서만
 *    맞고 목·금에서 틀린다. 검사기가 정적으로 잡는다.
 */

/** 조각이 말하는 주제 — 근거와 방향이 여기 묶인다 */
export type FragmentTopic =
  | 'rootedness.rooted'
  | 'rootedness.rootless'
  | 'strength.verdict'
  | 'eokbu.candidate'
  | 'relation.present';

export type TopicSpec = {
  /** 이 주제의 문장이 읽는 근거. **조각이 아니라 주제가 적는다** */
  paths: readonly ClaimPath[];
  /** 있다고 하는가, 없다고 하는가. 안전도가 다르므로 방향이 다르면 다른 주제다 */
  polarity: ClaimPolarity;
  /** 문장이 갈리는 자리 — 유한해야 한다. 생성기가 이 목록을 전수로 돈다 */
  variants: readonly string[];
  /** 데이터가 꽂히는 자리 — 값은 무한해도 된다. 여기 오는 것만이 명리 용어다 */
  slots: readonly string[];
  /**
   * 슬롯 값의 **모양**을 보이는 표본 — 생성기 계약의 나머지 절반이다.
   *
   * `slots: ['positions']` 는 "positions 라는 값이 있다"까지만 말한다. 그 값이
   * `'월주·일주'` 인지 `'子, 午'` 인지 모르면 생성기가 문장 틀을 쓸 수 없고,
   * 뼈대 검사는 슬롯을 비우고 보므로 띄어쓰기도 조사도 못 본다.
   *
   * **표본은 검사용 fixture 이지 근거가 아니다.** 절대 `grounded` 로 흘려보내지
   * 않는다 — 흘리면 꽂은 값이 스스로를 근거로 삼아 "없는 관계를 말하면 걸린다"가
   * 통째로 무력해진다. 그래서 표본에는 일부러 명리 용어를 넣어 뒀고, 그것이
   * 근거 없이 렌더되면 걸린다는 것을 테스트가 잠근다.
   */
  samples: Record<string, string>;
  note: string;
};

export const FRAGMENT_TOPICS: Record<FragmentTopic, TopicSpec> = {
  /**
   * 뿌리가 있다. 여섯 글자에서 찾은 뿌리는 시주가 있어도 그대로 뿌리라
   * 시간 미상에서도 말할 수 있다(한 칸 내려서).
   */
  'rootedness.rooted': {
    paths: ['analysis.rootedness'],
    polarity: 'presence',
    // 같은 글자에 둔 뿌리와 같은 오행에만 둔 뿌리는 계통이 갈리는 자리라
    // 문장도 갈린다(`ROOTEDNESS_POLICY.rootKind: 'same-element-marked'`).
    variants: ['same-stem', 'same-element'],
    slots: ['dayMaster', 'positions'],
    samples: { dayMaster: '갑', positions: '월주·일주' },
    note: '일간이 어느 지지에 뿌리를 두는가',
  },

  /**
   * 뿌리가 없다. **시간 미상이면 이 주제는 통째로 말할 수 없다** — 시지가
   * 뿌리였다면 "무근입니다"가 그냥 틀린 문장이 된다. `producibleStrengths` 가
   * 강도 하나만 내는 유일한 주제이고, 그것이 계약이 여기서 값을 내는 자리다.
   */
  'rootedness.rootless': {
    paths: ['analysis.rootedness'],
    polarity: 'absence',
    variants: ['day-master'],
    slots: ['dayMaster'],
    samples: { dayMaster: '갑' },
    note: '일간이 어디에도 뿌리를 두지 못한다',
  },

  'strength.verdict': {
    paths: ['analysis.strength'],
    polarity: 'presence',
    variants: ['strong', 'weak'],
    // 등급 이름은 붙이지 않는다(`STRENGTH_POLICY.gradeBands: 'none'`).
    // 숫자를 그대로 꽂는 슬롯 하나뿐인 것이 그 결정의 결과다.
    slots: ['ratio'],
    samples: { ratio: '38%' },
    note: '신강·신약을 어느 쪽으로 보는가',
  },

  /**
   * 억부 후보. 근거가 둘이라 상한이 낮은 쪽(`candidate`)을 따른다 —
   * 강약을 읽지 않고는 억부 후보가 나오지 않으므로 둘 다 적어야 한다.
   */
  'eokbu.candidate': {
    paths: ['analysis.strength', 'analysis.eokbu'],
    polarity: 'presence',
    variants: Object.keys(ELEMENT_ROLE_KO) as ElementRole[],
    slots: ['role', 'element'],
    samples: { role: '재성', element: '화' },
    note: '억부 관점에서 어느 자리의 오행을 후보로 보는가',
  },

  /**
   * 원국에서 성립한 관계 하나. **변종은 관계의 종류이고 이름은 슬롯이다** —
   * 조각 안에 `자오충` 이 없어야 없는 관계를 말할 길이 없다.
   */
  'relation.present': {
    paths: ['relations'],
    polarity: 'presence',
    variants: Object.keys(RELATION_KIND_KO),
    slots: ['name', 'positions'],
    samples: { name: '자오충', positions: '년주·일주' },
    note: '어느 자리에서 어떤 관계가 성립하는가',
  },
};

export const FRAGMENT_TOPIC_IDS = Object.keys(FRAGMENT_TOPICS) as FragmentTopic[];

export type FragmentKey = `${FragmentTopic}/${string}@${ClaimStrength}`;

/**
 * 조각 하나 — **문장 틀과 그 틀을 고르는 좌표뿐이다.**
 *
 * 근거도 방향도 여기 없다. 그것은 `topic` 이 들고 있고, 조각은 주제를 고를 수
 * 있을 뿐 주제가 무엇을 읽었는지는 고칠 수 없다.
 */
export type Fragment = {
  topic: FragmentTopic;
  variant: string;
  /**
   * 이 조각이 받아 내는 강도 — **선언이 아니라 조회 좌표다.**
   *
   * 조각이 "나는 사실이다"라고 말하는 자리가 아니라, `ceilingFor` 가 사실을
   * 냈을 때 고를 문장이 이것이라는 뜻이다. 주제가 낼 수 없는 강도를 적으면
   * `checkFragment` 가 잡는다.
   */
  strength: ClaimStrength;
  /** 슬롯만 비어 있는 문장 틀. 명리 용어를 여기 타이핑하지 않는다 */
  template: string;
};

export function fragmentKey(topic: FragmentTopic, variant: string, strength: ClaimStrength): FragmentKey {
  return `${topic}/${variant}@${strength}`;
}

export const keyOf = (fragment: Fragment): FragmentKey =>
  fragmentKey(fragment.topic, fragment.variant, fragment.strength);

/**
 * 이 주제가 실제로 낼 수 있는 강도들 — **생성기가 만들어야 할 벌 수**.
 *
 * 시각을 아는 명식과 모르는 명식에서 상한이 달라지므로 보통 둘이다.
 * `silent` 은 문장을 만들지 않으므로 세지 않는다 — 그래서 `rootedness.rootless`
 * 처럼 시간 미상에서 입을 닫는 주제는 한 벌만 나온다.
 */
export function producibleStrengths(topic: FragmentTopic): readonly ClaimStrength[] {
  const { paths, polarity } = FRAGMENT_TOPICS[topic];

  const strengths = [true, false].map((hourKnown) => ceilingFor({ paths, polarity, hourKnown }));

  return [...new Set(strengths)].filter((strength) => strength !== 'silent');
}

/**
 * 채워져야 하는 키 전부 — 생성기의 작업 지시서다.
 *
 * 조합이 유한하다는 것이 L3 를 런타임 AI 없이 하겠다는 결정의 전제였다.
 * 그 전제를 값으로 셀 수 있게 만드는 것이 이 함수의 몫이다.
 */
export function expectedFragmentKeys(): FragmentKey[] {
  return FRAGMENT_TOPIC_IDS.flatMap((topic) =>
    FRAGMENT_TOPICS[topic].variants.flatMap((variant) =>
      producibleStrengths(topic).map((strength) => fragmentKey(topic, variant, strength)),
    ),
  );
}

export type FragmentViolationRule =
  | TextViolationRule
  /** 주제에 없는 변종이다 */
  | 'unknown-variant'
  /** 이 주제가 낼 수 없는 강도다 */
  | 'unproducible-strength'
  /** 주제가 선언하지 않은 슬롯을 썼다 */
  | 'undeclared-slot'
  /** 조사를 슬롯 뒤에 붙였다 — 받침에 따라 갈린다 */
  | 'slot-particle'
  /** 주제가 이 슬롯의 표본 값을 적지 않았다 */
  | 'missing-sample'
  /** 표본으로 렌더하면 문장의 형태가 어긋난다 */
  | 'malformed-sample'
  /** 채우지 않은 슬롯이 남았다 */
  | 'unfilled-slot';

export type FragmentViolation = {
  rule: FragmentViolationRule;
  slot?: string;
  term?: string;
  detail: string;
};

/**
 * 앞 글자의 받침에 따라 갈리는 조사.
 *
 * `{element}를` 은 화·토·수에서만 맞고 목·금에서 틀린다. 슬롯 값은 런타임에
 * 정해지므로 문장 틀이 미리 고를 수 없다. 조사를 붙여 쓰려면 슬롯 뒤에 다른
 * 낱말을 한 번 놓고(`{name} 관계가`) 그 낱말에 붙인다.
 */
export const VARIABLE_PARTICLES: readonly string[] = ['이', '가', '은', '는', '을', '를', '과', '와', '로', '으로'];

const SLOT_PATTERN = /\{([a-zA-Z]+)\}/g;

/** 문장 틀이 쓴 슬롯 이름들 */
export function slotsUsedBy(template: string): string[] {
  return [...template.matchAll(SLOT_PATTERN)].map(([, name]) => name);
}

/** 슬롯을 비운 문장 — 정적 검사는 이 뼈대를 본다 */
export function skeletonOf(template: string): string {
  return template.replace(SLOT_PATTERN, '');
}

/**
 * 표본 값으로 렌더한 문장 — **읽어 볼 수 있는 예문이자 형태 검사의 입력이다.**
 *
 * 이 문장을 계약 검사기에 다시 넣지 않는다. 표본은 근거가 아니라서 넣으면
 * 명리 용어가 전부 `ungrounded-term` 으로 걸린다 — 그것을 피하려고 표본을
 * 근거로 넘기는 순간 검사가 통째로 무력해진다. 여기서 보는 것은 **형태**다.
 */
export function sampleSentence(fragment: Fragment): string {
  return fillTemplate(fragment.template, FRAGMENT_TOPICS[fragment.topic].samples);
}

function fillTemplate(template: string, slots: Record<string, string>): string {
  return template.replace(SLOT_PATTERN, (whole, name: string) => slots[name] ?? whole);
}

/**
 * 조각 하나를 스키마와 계약에 비춰 본다 — **명식 없이 돈다.**
 *
 * 핵심은 마지막 줄이다. **슬롯을 비운 뼈대를 근거 하나 없이 검사기에 넣는다.**
 * 뼈대에 명리 용어가 하나라도 있으면 근거 목록이 비었으니 `ungrounded-term` 으로
 * 걸린다 — 그것이 곧 "용어는 데이터에서만 온다"를 정적으로 강제하는 자리다.
 * 완충 표현과 금지 표현도 같은 호출에서 함께 본다. 규칙을 두 번 쓰지 않는다.
 */
export function checkFragment(fragment: Fragment): FragmentViolation[] {
  const violations: FragmentViolation[] = [];
  const spec = FRAGMENT_TOPICS[fragment.topic];

  if (!spec.variants.includes(fragment.variant)) {
    violations.push({
      rule: 'unknown-variant',
      term: fragment.variant,
      detail: `${fragment.topic} 에 없는 변종이다. 변종은 유한해야 생성기가 전수로 돈다.`,
    });
  }

  if (!producibleStrengths(fragment.topic).includes(fragment.strength)) {
    violations.push({
      rule: 'unproducible-strength',
      detail: `${fragment.topic} 은 ${fragment.strength} 를 내지 않는다 — 아무도 조회하지 못하는 조각이다.`,
    });
  }

  for (const slot of slotsUsedBy(fragment.template)) {
    if (spec.slots.includes(slot)) continue;

    violations.push({
      rule: 'undeclared-slot',
      slot,
      detail: `${fragment.topic} 이 선언하지 않은 슬롯이다. 채울 값이 어디서 오는지 아무도 모른다.`,
    });
  }

  for (const match of fragment.template.matchAll(SLOT_PATTERN)) {
    const after = fragment.template.slice((match.index ?? 0) + match[0].length);
    const particle = VARIABLE_PARTICLES.find((p) => after.startsWith(p));
    if (!particle) continue;

    violations.push({
      rule: 'slot-particle',
      slot: match[1],
      term: particle,
      detail: `조사 '${particle}' 는 앞 글자의 받침을 따르는데 슬롯 값은 런타임에 정해진다.`,
    });
  }

  const sample = sampleSentence(fragment);

  for (const slot of slotsUsedBy(sample)) {
    violations.push({
      rule: 'missing-sample',
      slot,
      detail: `${fragment.topic} 이 ${slot} 의 표본 값을 적지 않았다 — 생성기가 값의 모양을 모른다.`,
    });
  }

  // 뼈대 검사는 슬롯을 비우고 보므로 띄어쓰기도 문장 끝도 못 본다.
  if (sample !== sample.trim() || /\s{2}/.test(sample) || / \.$/.test(sample) || !sample.endsWith('.')) {
    violations.push({
      rule: 'malformed-sample',
      detail: `표본으로 렌더하면 형태가 어긋난다: "${sample}"`,
    });
  }

  // 뼈대는 근거가 하나도 없는 상태로 계약을 통과해야 한다.
  violations.push(
    ...checkSentence({
      text: skeletonOf(fragment.template),
      paths: spec.paths,
      strength: fragment.strength,
      grounded: [],
    }),
  );

  return violations;
}

export type FragmentIndex = ReadonlyMap<FragmentKey, Fragment>;

/** 같은 키가 둘이면 어느 쪽이 나갔는지 알 수 없다 — 세우는 자리에서 막는다 */
export function indexFragments(fragments: readonly Fragment[]): FragmentIndex {
  const index = new Map<FragmentKey, Fragment>();

  for (const fragment of fragments) {
    const key = keyOf(fragment);
    if (index.has(key)) throw new Error(`조각 키가 겹친다: ${key}`);
    index.set(key, fragment);
  }

  return index;
}

export type FragmentRequest = {
  topic: FragmentTopic;
  variant: string;
  /** 슬롯에 꽂을 값 — 전부 L2 가 낸 것이어야 한다 */
  slots: Record<string, string>;
  /**
   * 이 명식이 실제로 낸 용어들.
   *
   * 슬롯 값을 여기에 자동으로 넣지 않는다. 넣으면 꽂은 값이 스스로를 근거로
   * 삼는 셈이라 검사가 언제나 통과한다 — 조회하는 쪽이 명식에서 읽어 온 것을
   * 그대로 적어야 대조가 성립한다.
   */
  grounded: readonly string[];
  /** 시각을 알고 계산했는가 */
  hourKnown?: boolean;
};

export type RenderedFragment = {
  /** `silent` 이면 조회조차 하지 않으므로 null */
  key: FragmentKey | null;
  strength: ClaimStrength;
  /** 말하지 않기로 했거나 조각이 아직 없으면 null */
  text: string | null;
  violations: FragmentViolation[];
};

/**
 * 조회 → 조립 한 번.
 *
 * **강도를 받지 않는다.** 주제의 근거와 명식의 시각 여부만으로 여기서 계산한다.
 * 부르는 쪽이 강도를 건네게 두면 `paths` 를 주제로 옮겨 막은 구멍이 호출부에서
 * 그대로 다시 열린다.
 *
 * 조각이 없으면 말하지 않는다. 비어 있는 자리를 억지로 다른 강도의 조각으로
 * 메우지 않는다 — 그 순간 강도는 조회 좌표가 아니라 장식이 된다.
 */
export function renderFragment(request: FragmentRequest, index: FragmentIndex): RenderedFragment {
  const { topic, variant, slots, grounded, hourKnown = true } = request;
  const spec = FRAGMENT_TOPICS[topic];

  const strength = ceilingFor({ paths: spec.paths, polarity: spec.polarity, hourKnown });
  if (strength === 'silent') return { key: null, strength, text: null, violations: [] };

  const key = fragmentKey(topic, variant, strength);
  const fragment = index.get(key);
  if (!fragment) return { key, strength, text: null, violations: [] };

  const text = fillTemplate(fragment.template, slots);
  const violations: FragmentViolation[] = slotsUsedBy(text).map((slot) => ({
    rule: 'unfilled-slot' as const,
    slot,
    detail: `${key} 가 요구하는 값이 요청에 없다.`,
  }));

  const sentence: TextViolation[] = checkSentence({
    text,
    paths: spec.paths,
    strength,
    grounded,
  });

  return { key, strength, text, violations: [...violations, ...sentence] };
}

/**
 * 씨앗 조각 — **스키마를 고정하는 여섯 개이지 말뭉치가 아니다.**
 *
 * 생성기가 채워야 할 자리는 `expectedFragmentKeys()` 가 세고, 이 여섯은 그중
 * 강도 사다리의 각 칸이 실제로 문장을 받아 내는지 보이는 표본이다. 조후는
 * 출처를 문장에 넣는 규칙이 하나 더 붙어 뒤로 미뤘고, 종격은 게이트가 닫혀
 * 있어 `candidate` 한 칸뿐이라 씨앗에서 얻을 것이 적다.
 */
export const SEED_FRAGMENTS: readonly Fragment[] = [
  {
    topic: 'rootedness.rooted',
    variant: 'same-stem',
    strength: 'fact',
    template: '{dayMaster} 일간은 {positions} 자리에 같은 글자로 뿌리를 둡니다.',
  },
  {
    // 시간 미상에서는 이 주제가 통째로 입을 닫으므로 `fact` 한 벌뿐이다.
    topic: 'rootedness.rootless',
    variant: 'day-master',
    strength: 'fact',
    template: '{dayMaster} 일간은 네 지지 어디에도 뿌리를 두지 못합니다.',
  },
  {
    topic: 'strength.verdict',
    variant: 'strong',
    strength: 'derived',
    template: '일간을 돕는 세력이 {ratio} 정도라 신강 쪽으로 봅니다.',
  },
  {
    topic: 'strength.verdict',
    variant: 'weak',
    strength: 'derived',
    template: '일간을 돕는 세력이 {ratio} 정도라 신약 쪽으로 봅니다.',
  },
  {
    // 변종이 자리를 고르고 그 자리의 이름은 슬롯으로 꽂힌다 — 문장 틀에는
    // '재성' 이 없다.
    topic: 'eokbu.candidate',
    variant: '財星',
    strength: 'candidate',
    template: '억부 관점에서는 {role} 자리의 {element} 쪽을 후보로 봅니다.',
  },
  {
    topic: 'relation.present',
    variant: 'branchClash',
    strength: 'fact',
    template: '{positions} 자리에서 {name} 관계가 성립합니다.',
  },
];

export const SEED_INDEX: FragmentIndex = indexFragments(SEED_FRAGMENTS);

/** 채운 자리 / 채워야 할 자리 */
export function fragmentCoverage(index: FragmentIndex = SEED_INDEX) {
  const expected = expectedFragmentKeys();

  return {
    filled: expected.filter((key) => index.has(key)).length,
    expected: expected.length,
    missing: expected.filter((key) => !index.has(key)),
  };
}

/**
 * 채택한 조각 규칙. 다른 `*_POLICY` 와 같은 구실을 한다 — 골든 스냅샷이 찍는다.
 */
export const FRAGMENT_POLICY = {
  ruleSet: 'text-fragment-schema-v1',
  /** 스키마와 씨앗뿐이다. 조립기도 생성기도 아직 없다 */
  status: 'schema-and-seeds',
  /** 조회 좌표 */
  key: 'topic/variant@strength',
  /** 강도는 표현을 고르는 좌표이지 조각이 선언하는 속성이 아니다 */
  claimStrength: 'selects-wording-never-declared',
  /** 근거는 주제가 적는다 — 조각이 적으면 상한을 스스로 올릴 수 있다 */
  evidence: 'declared-by-topic',
  /** 방향도 주제가 적는다 — 있다와 없다는 안전도가 달라 다른 주제다 */
  polarity: 'declared-by-topic',
  /** 변종은 빌드 타임에 전수로 도는 유한 목록이다 */
  variants: 'finite-enumerated',
  /** 슬롯 값은 런타임에 L2 에서 온다 — 명리 용어는 전부 이 길로만 들어온다 */
  slots: 'runtime-values-from-l2',
  /** 슬롯 값은 스스로를 근거로 삼지 못한다 */
  grounding: 'evidence-supplied-by-caller',
  /** 슬롯 표본은 값의 모양을 보이는 fixture 다 — 근거로 흘려보내지 않는다 */
  samples: 'fixture-not-evidence',
  /** 받침에 따라 갈리는 조사를 슬롯 뒤에 붙이지 않는다 */
  particles: 'no-variable-particle-after-slot',
  /** 슬롯을 비운 뼈대가 근거 없이 계약을 통과해야 한다 */
  staticCheck: 'skeleton-passes-contract-with-no-evidence',
  /** 조각이 없으면 말하지 않는다 — 다른 강도의 조각으로 메우지 않는다 */
  missingFragment: 'silent',
} as const;
