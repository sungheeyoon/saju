import type { ElementRole } from '../analysis';
import type { ClaimStrength } from './policy';
import { indexFragments, type Fragment, type FragmentIndex } from './fragment';

/**
 * L3 말뭉치 — **조각이 실제로 들어앉는 곳.**
 *
 * `fragment.ts` 는 스키마이고 여기는 그 스키마가 요구한 칸을 채운 내용물이다.
 * 파일을 나눈 이유는 **바뀌는 이유가 다르기** 때문이다. 스키마는 계약이 바뀔 때
 * 바뀌고 말뭉치는 문장을 더 쓸 때마다 바뀐다. 나중에 생성기가 붙으면 손대는
 * 파일도 이쪽 하나다 — 생성기는 런타임 줄의 다음이 아니라 **옆**이라, 이 상수를
 * 빌드 타임에 만들어 넣는 놈으로 바뀔 뿐 `renderFragment` 아래는 그대로다.
 *
 * 지금은 손으로 썼다. 세 주제(`rootedness`·`strength`·`eokbu`)를 먼저 채운 것은
 * 그 셋이 **강도 사다리 네 칸을 전부 지나가는 가장 작은 묶음**이기 때문이다 —
 * 사실·유도·후보·참고가 한 번씩 나온다. 관계 21칸은 표현 규칙이 확정된 뒤에
 * 대량으로 돈다.
 */

/**
 * 강도 한 칸이 문장에서 갖는 **모양**.
 *
 * `REQUIRED_HEDGES` 는 "이 중 하나는 품어라"는 하한이고 여기는 그중 **하나를
 * 골라 고정한 것**이다. 하한만 있으면 같은 후보 강도의 문장이 어떤 것은 '여지',
 * 어떤 것은 '가능성', 어떤 것은 '검토'로 갈려 읽는 사람이 강도 차이를 못 본다.
 * 사다리가 문장에서 보이지 않으면 사다리를 유지할 이유도 사라진다.
 *
 * `fact` 는 표지가 없다 — 있는 것이 아니라 **아래 칸의 표지가 하나도 없는 것**이
 * 사실의 모양이다. 사실 문장이 "…쪽으로 봅니다"로 끝나면 근거보다 약하게 말하는
 * 것이고, 그것은 안전해 보이지만 강도 체계를 장식으로 만든다.
 *
 * `reference` 가 '참고'인 것은 출처 표시가 아니다 — 억부가 시간 미상에서 이 칸에
 * 내려앉는데 억부에는 인용할 표가 없다. 출처 의무는 강도가 아니라 읽은 근거에
 * 걸려 있다(`ATTRIBUTION_PATHS`).
 */
export const STRENGTH_WORDING: Record<Exclude<ClaimStrength, 'fact' | 'silent'>, string> = {
  derived: '으로 봅니다',
  candidate: '후보로 봅니다',
  reference: '참고할 수 있습니다',
};

/**
 * 강도가 한 칸 내려앉은 벌이 문장에 반드시 적는 말.
 *
 * 주제마다 조각이 두 벌인 것은 시간 미상 때문이고(`producibleStrengths`), 약한
 * 쪽은 **시주 두 글자를 빼고 센 값**이다. 그 사실을 문장이 스스로 밝히지 않으면
 * 독자에게는 그냥 말끝이 흐린 문장으로 보인다. 경고는 `meta.warnings` 에 따로
 * 나가지만 경고는 문장 옆에 붙어 있지 않다 — 강등을 하기로 한 이유가 그것이었다.
 */
export const HOUR_UNKNOWN_MARK = '시주';

/**
 * 억부 후보의 자리마다 붙는 한 마디 — **변종 축이 값을 내는 자리다.**
 *
 * 다섯 변종에 같은 문장을 다섯 벌 넣으면 변종은 장식이 된다. `{role}` 슬롯이
 * 이름을 꽂아 주므로 조각이 더할 것은 **그 자리가 일간과 맺는 방향**뿐이고,
 * 그것은 십성의 정의라서 명식마다 달라지지 않는다(그래서 슬롯이 아니라 변종에
 * 얹힌다). 새 역할이 생기면 여기서 컴파일이 깨진다.
 */
const EOKBU_GLOSS: Record<ElementRole, string> = {
  比劫: '일간과 한편에 서는',
  印星: '일간을 받쳐 주는',
  食傷: '일간이 기운을 내보내는',
  財星: '일간이 기운을 쓰는',
  官星: '일간을 누르는',
};

const eokbuFragments = (Object.entries(EOKBU_GLOSS) as [ElementRole, string][]).flatMap(
  ([role, gloss]): Fragment[] => [
    {
      topic: 'eokbu.candidate',
      variant: role,
      strength: 'candidate',
      template: `억부 관점에서는 ${gloss} {role} 자리의 {element} 쪽을 후보로 봅니다.`,
    },
    {
      topic: 'eokbu.candidate',
      variant: role,
      strength: 'reference',
      template: `시주를 빼고 세면 억부 관점에서는 ${gloss} {role} 자리의 {element} 쪽을 참고할 수 있습니다.`,
    },
  ],
);

/**
 * 조각 전부. 키가 겹치면 `indexFragments` 가 세우는 자리에서 막는다.
 *
 * 아직 비어 있는 칸은 `fragmentCoverage(FRAGMENT_INDEX).missing` 이 센다.
 * 비어 있다는 것이 곧 침묵이고, 침묵은 문장 골든에 `(조각 없음)` 으로 찍힌다 —
 * 다른 강도의 조각으로 메우지 않는다.
 */
export const FRAGMENTS: readonly Fragment[] = [
  // ── 뿌리 ─────────────────────────────────────────────────────────────
  // 여섯 글자에서 찾은 뿌리는 시주가 있어도 그대로 뿌리다. 그래서 시간 미상에
  // 한 칸 내려가기만 하고 입을 닫지는 않는다(`polarity: 'presence'`).
  {
    topic: 'rootedness.rooted',
    variant: 'same-stem',
    strength: 'fact',
    template: '{dayMaster} 일간은 {positions} 자리에 같은 글자로 뿌리를 둡니다.',
  },
  {
    topic: 'rootedness.rooted',
    variant: 'same-stem',
    strength: 'derived',
    template: '시주를 빼고 세면 {dayMaster} 일간은 {positions} 자리에 같은 글자로 뿌리를 둔 것으로 봅니다.',
  },
  // 같은 글자에 둔 뿌리와 같은 오행에만 둔 뿌리는 계통이 갈리는 자리라 문장도
  // 갈린다(`ROOTEDNESS_POLICY.rootKind: 'same-element-marked'`).
  {
    topic: 'rootedness.rooted',
    variant: 'same-element',
    strength: 'fact',
    template: '{dayMaster} 일간은 {positions} 자리에 같은 오행으로 뿌리를 둡니다.',
  },
  {
    topic: 'rootedness.rooted',
    variant: 'same-element',
    strength: 'derived',
    template: '시주를 빼고 세면 {dayMaster} 일간은 {positions} 자리에 같은 오행으로 뿌리를 둔 것으로 봅니다.',
  },
  // "없다"는 주장은 시지가 통째로 뒤집으므로 시간 미상에서는 아예 침묵한다.
  // 조각이 한 벌뿐인 유일한 주제이고, 그것이 계약이 값을 내는 자리다.
  {
    topic: 'rootedness.rootless',
    variant: 'day-master',
    strength: 'fact',
    template: '{dayMaster} 일간은 네 지지 어디에도 뿌리를 두지 못합니다.',
  },

  // ── 신강·신약 ────────────────────────────────────────────────────────
  // 등급 이름은 붙이지 않는다(`STRENGTH_POLICY.gradeBands: 'none'`) — 문장이
  // 드는 것은 비율 숫자 하나뿐이다.
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
    topic: 'strength.verdict',
    variant: 'strong',
    strength: 'candidate',
    template: '시주를 빼고 세면 일간을 돕는 세력이 {ratio} 정도라 신강 쪽을 후보로 봅니다.',
  },
  {
    topic: 'strength.verdict',
    variant: 'weak',
    strength: 'candidate',
    template: '시주를 빼고 세면 일간을 돕는 세력이 {ratio} 정도라 신약 쪽을 후보로 봅니다.',
  },

  // ── 억부 후보 ────────────────────────────────────────────────────────
  ...eokbuFragments,

  // ── 관계 ─────────────────────────────────────────────────────────────
  // 스키마를 세울 때 쓴 조각 하나가 그대로 남아 있다. 관계는 변종 열하나 ×
  // 두 벌이라 이 주제만 21칸이고, 종류마다 술어가 갈려야 변종 축이 값을 낸다
  // (충은 부딪히고 합은 묶인다). 그 21칸은 다음 묶음이다.
  {
    topic: 'relation.present',
    variant: 'branchClash',
    strength: 'fact',
    template: '{positions} 자리에서 {name} 관계가 성립합니다.',
  },
];

export const FRAGMENT_INDEX: FragmentIndex = indexFragments(FRAGMENTS);

/**
 * 채택한 말뭉치 규칙. 다른 `*_POLICY` 와 같은 구실을 한다 — 골든이 찍는다.
 */
export const CORPUS_POLICY = {
  ruleSet: 'text-corpus-v1',
  /** 아직 손으로 썼다. 생성기가 붙으면 이 값만 바뀐다 */
  producedBy: 'hand-written',
  /** 채운 주제 — 관계는 스키마를 세울 때 쓴 조각 하나뿐이라 21칸이 남았다 */
  covered: 'rootedness, strength, eokbu — relation 1/22',
  /** 강도마다 표지를 하나로 고정한다. 완충 표현 목록은 하한일 뿐이다 */
  wording: 'one-mark-per-strength',
  /** 사실은 표지가 없는 것이 표지다 — 아래 칸의 말투를 쓰지 않는다 */
  fact: 'no-hedge-mark',
  /** 한 칸 내려앉은 벌은 시주를 빼고 셌다는 것을 문장이 밝힌다 */
  hourUnknownRung: 'names-the-missing-hour',
  /** 변종이 문장을 가르지 못하면 변종 축은 장식이다 */
  variants: 'must-change-the-sentence',
} as const;
