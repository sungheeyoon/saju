import type { ElementRole, FollowingDirection, FollowingPatternStatus } from '../analysis';
import type { ClaimStrength } from './policy';
import { followingVariant, indexFragments, type Fragment, type FragmentIndex } from './fragment';

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
 * 사실·유도·후보·참고가 한 번씩 나온다.
 *
 * 그 다음은 칸을 채우는 일이 아니라 **주제를 더하는 일**이었다. 조후를 먼저 고른
 * 것은 **가장 작으면서 아직 한 번도 돌지 않은 규칙을 지나가기** 때문이었고
 * (출처 의무), 종격은 반대로 가장 깊었다 — 판정값 하나만 침묵한다는 것을 스키마가
 * 표현하지 못해 강도가 나오는 축이 (주제, 시각)에서 (주제, 변종, 시각)으로 넓어졌다.
 *
 * 그리고 관계가 22칸에서 **2칸으로 줄었다.** 종류마다 서술어를 달던 것이
 * 동어반복이었다는 것이 드러났고, 세어지기만 하는 사실은 문장이 아니라 **행**이라는
 * 구분이 계약에 들어왔다(`ClaimForm`). 줄이면서 정보는 늘었다 — 행은 자리뿐 아니라
 * 글자를 들고, 궁합에서는 이름까지 든다.
 *
 * 행이 시간 미상에 내려가지 않게 된 것도 그 뒤의 일이다. 목록의 한계를 항목마다
 * 나눠 지우고 있었는데, 그것을 **목록이 스스로 들도록** 떼어 냈다
 * (`relation.coverage`, `INCOMPLETE_INPUT_RULE`). 분모는 32 그대로다 — 행이 두 벌
 * 줄고 목록이 두 벌 늘었다.
 *
 * 빈칸이 없다는 것은 여전히 **할 말을 다 했다는 뜻이 아니다.** 12운성·신살·대운은
 * 아직 침묵하고 그것은 조각이 없어서가 아니라 주제가 없어서다
 * (`UNCOVERED_FACTS`).
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
 * 다섯 자리가 일간과 맺는 방향 — **변종 축이 값을 내는 자리다.**
 *
 * 다섯 변종에 같은 문장을 다섯 벌 넣으면 변종은 장식이 된다. `{role}`·`{tenGod}`
 * 슬롯이 이름을 꽂아 주므로 조각이 더할 것은 **그 자리가 일간과 맺는 방향**뿐이고,
 * 그것은 십성의 정의라서 명식마다 달라지지 않는다(그래서 슬롯이 아니라 변종에
 * 얹힌다). 새 역할이 생기면 여기서 컴파일이 깨진다.
 *
 * **두 주제가 나눠 쓴다**(억부 후보 · 궁합 십성). 원래 억부의 것이었는데 궁합
 * 십성이 같은 뜻풀이를 필요로 했고, 같은 정의를 두 벌 적으면 언젠가 한쪽만
 * 고쳐진다 — 역마·도화·화개를 신살 표에 옮겨 적되 값은 12신살에서 가져오기만
 * 한 것과 같은 판단이다. 열쇠 타입이 둘로 갈려 있는 것(`ElementRole` ·
 * `TenGodGroup`)은 L2 에 남아 있는 이름 중복이지 여기서 갈린 것이 아니다.
 */
export const ROLE_GLOSS: Record<ElementRole, string> = {
  比劫: '일간과 한편에 서는',
  印星: '일간을 받쳐 주는',
  食傷: '일간이 기운을 내보내는',
  財星: '일간이 기운을 쓰는',
  官星: '일간을 누르는',
};

const eokbuFragments = (Object.entries(ROLE_GLOSS) as [ElementRole, string][]).flatMap(
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
 * 궁합 억부 부합 세 벌 — **궁합에서 처음 서는 산문이다.**
 *
 * 그 전까지 궁합이 낸 발화는 전부 `fact` 였다(관계 행 · 목록 · 십성). 완충 표현이
 * 한 번도 필요하지 않았고, 그래서 `hourKnown` 도 궁합에서는 아무 일도 하지 않는
 * 죽은 값이었다. 여기서 강등과 침묵이 궁합에 처음 들어온다.
 *
 * **`{who}` 가 문장 안으로 들어온 것이 이번의 새 규칙이다.** 원국에서는 강등된 벌이
 * '시주' 한 마디만 적으면 됐다 — 명식이 하나뿐이라 누구 것인지 물을 일이 없었다.
 * 궁합에서는 그것으로 못 가린다. 행이 못 하던 말을 목록이 한 것과 같은 문제가
 * **문장 안에서** 다시 나오고(`relation.coverage`), 같은 방법으로 푼다.
 *
 * **비중은 상대의 여덟 글자에서 나온다.** 그래서 두 사람의 시주가 모두 걸린다 —
 * 내 억부 후보가 무엇인지도, 상대가 그것을 얼마나 가졌는지도 시주가 바꾼다.
 *
 * 뜻풀이를 달지 않는다. 그 자리가 일간과 무엇을 맺는지는 **원국의 억부 문장이 이미
 * 말했고**, 궁합이 얹는 것은 "상대가 갖고 있는가" 하나다. 십성이 뜻풀이를 다는 것과
 * 정반대인데 이유도 정반대다 — 일간↔일간은 원국 표에 없어 혼자 서야 한다.
 *
 * **채워 준다고 말하지 않는다.** 상대가 내 억부 후보를 가졌다는 것과 그것이 좋은
 * 궁합이라는 것은 다르고, 보완을 좋은 것으로 읽을지부터가 계통 갈림이다
 * (`COMPAT_POLICY.elementSupport: 'facts-only'`). 문장은 무엇이 얼마나 있는지까지만
 * 적는다 — 궁합 점수를 내지 않기로 한 결정이 산문에서 풀리는 자리가 여기다.
 */
const EOKBU_MATCH_BODY = '{viewer}의 억부 후보는 {role} 자리의 {element} 쪽이고';

const eokbuMatchFragments: Fragment[] = [
  {
    topic: 'eokbuMatch.supplied',
    variant: 'partner',
    strength: 'candidate',
    template: `${EOKBU_MATCH_BODY}, {partner} 원국에서 그 오행이 {ratio} 정도입니다. 억부 관점의 후보로 봅니다.`,
  },
  // 강등된 벌. 원국과 달리 **누구의** 시주인지를 밝힌다.
  {
    topic: 'eokbuMatch.supplied',
    variant: 'partner',
    strength: 'reference',
    template: `{who}의 시주를 빼고 세면 ${EOKBU_MATCH_BODY}, {partner} 원국에서 그 오행이 {ratio} 정도입니다. 억부 관점에서 참고할 수 있습니다.`,
  },
  // 한 벌뿐이다. 상대의 시주가 빠지면 그 자리에 그 오행이 있었을 수 있어 "없습니다"
  // 가 그냥 틀린 문장이 된다 — 내리는 것이 아니라 입을 닫는다.
  {
    topic: 'eokbuMatch.missing',
    variant: 'partner',
    strength: 'candidate',
    template: `${EOKBU_MATCH_BODY}, {partner} 원국에는 그 오행이 없습니다. 억부 관점의 후보로 봅니다.`,
  },
];

/**
 * 오행 보완 네 벌 — **행이고, "보완"이라는 말은 쓰지 않는다.**
 *
 * 궁합에서 보완이라 불리는 자리인데 엔진이 아는 것은 개수 둘이다. 내 원국에 그
 * 오행이 0개이고 상대 원국에 0개가 아니다. 채우는 쪽이 좋다는 읽기와 용신에 맞는
 * 오행이라야 한다는 읽기가 갈리므로(`COMPAT_POLICY.elementSupport: 'facts-only'`)
 * 행에는 그 판정을 실을 서술어를 두지 않는다.
 *
 * **행이 `fact` 아닌 강도로 서는 첫 자리가 여기 있다**(`weakest` 의 강등된 벌).
 * 계약이 "행은 완충 표현을 요구받지 않고 강도는 옆 칸이 든다"고 적어 둔 것이 그제야
 * 값을 낸다 — 면제된 것은 완충 표현이지 강도가 아니다. 그래서 이 벌은 표지를 품지
 * 않은 채 '유도' 칸에 선다.
 */
const ELEMENT_SUPPORT_ROWS = {
  supplied: '{viewer}에게 없고 {partner}에게 있는 오행 — {elements}',
  stillMissing: '{who} 둘 다에게 없는 오행 — {elements}',
  weakest: '{viewer}의 가장 얇은 {element} — {partner} 원국에서 {ratio}',
} as const;

const elementSupportFragments: Fragment[] = [
  // 없다는 주장이라 시간 미상에서는 입을 닫는다 — 한 벌씩이다.
  {
    topic: 'elementSupport.absent',
    variant: 'supplied',
    strength: 'fact',
    template: ELEMENT_SUPPORT_ROWS.supplied,
  },
  {
    topic: 'elementSupport.absent',
    variant: 'still-missing',
    strength: 'fact',
    template: ELEMENT_SUPPORT_ROWS.stillMissing,
  },
  {
    topic: 'elementSupport.weakest',
    variant: 'pair',
    strength: 'fact',
    template: ELEMENT_SUPPORT_ROWS.weakest,
  },
  // 강등된 행. 표지는 없고(행이다) 시주를 뺐다는 것만 적는다 — 강도는 옆 칸이 든다.
  {
    topic: 'elementSupport.weakest',
    variant: 'pair',
    strength: 'derived',
    template: `${ELEMENT_SUPPORT_ROWS.weakest} ({who}의 ${HOUR_UNKNOWN_MARK}를 빼고 셈)`,
  },
];

/**
 * 조후 문장이 반드시 적는 것 둘 — **출처와, 판정하지 않은 나머지.**
 *
 * 출처는 계약이 요구한다. `analysis.johu` 는 `ATTRIBUTION_PATHS` 의 유일한
 * 원소라 이 근거를 읽은 문장은 `ATTRIBUTION_TERMS` 중 하나를 품지 않으면
 * `missing-attribution` 으로 걸린다. 계약을 세울 때부터 있던 규칙인데 이 표를
 * 읽는 주제가 없어서 프로덕션에서 한 번도 돈 적이 없던 분기다.
 *
 * 미판정 고지는 계약이 요구하지 않는다 — **조후표 쪽에서 온 의무다.** 원문은
 * 칸마다 "수가 왕하면 戊", "화국이면 壬" 같은 조건을 달아 두었고 우리는 그중
 * 상·하반월 하나만 판정한다(`JOHU_POLICY.conditionEvaluation`). 천간만 옮기고
 * 조건을 떼면 그것은 옮겨 적기가 아니라 **요약**이고, 요약은 우리가 고른 것이다.
 * 조건이 붙은 칸과 아닌 칸을 표가 구분하지 않으므로 갈라 쓸 근거도 없다 —
 * 그래서 세 문장이 모두 이 한 마디를 달고 나간다.
 */
const JOHU_SOURCE = '궁통보감 조후표';
const JOHU_UNJUDGED = '나머지 조건은 원문에 그대로 있고 여기서 판정하지 않습니다.';

/**
 * 조후 세 벌. 강도는 `reference` 하나뿐이라 **한 주제가 조각 한 벌만 갖는 두
 * 번째 자리**이고, 앞선 하나(`rootedness.rootless`)와 이유가 정반대다 — 저쪽은
 * 시간 미상에서 입을 닫아서 한 벌이고 이쪽은 시주가 아무것도 바꾸지 않아서다.
 */
const johuFragments: Fragment[] = [
  {
    topic: 'johu.table',
    variant: 'whole-month',
    strength: 'reference',
    template: `${JOHU_SOURCE}에서 {dayMaster} 일간 {monthBranch}월은 {stems} 쪽을 참고할 수 있습니다. ${JOHU_UNJUDGED}`,
  },
  {
    topic: 'johu.table',
    variant: 'half-month',
    strength: 'reference',
    template: `${JOHU_SOURCE}는 {dayMaster} 일간 {monthBranch}월을 상·하반월로 갈라 말하고, 이 명식은 {half}에 들어 {stems} 쪽을 참고할 수 있습니다. ${JOHU_UNJUDGED}`,
  },
  // 절반을 채워 넣은 정오가 정했을 수 있는 자리. 한쪽을 골라 말하지 않고 양쪽을
  // 나란히 든다 — 고르면 뒤집힐 수 있고, 덮으면 원문이 갈랐다는 사실이 사라진다.
  {
    topic: 'johu.table',
    variant: 'half-unjudged',
    strength: 'reference',
    template: `${JOHU_SOURCE}는 {dayMaster} 일간 {monthBranch}월을 상·하반월로 갈라 말하는데, 시각을 몰라 어느 절반인지 가리지 않았습니다. 상반월은 {firstStems} 쪽, 하반월은 {secondStems} 쪽을 참고할 수 있습니다. ${JOHU_UNJUDGED}`,
  },
];

/**
 * 종격 여섯 벌 — **판정과 방향이 곱해지는데 곱한 만큼 이유가 다르다.**
 *
 * 방향 축만으로도 문장이 갈리고(밖으로 종은 일간을 도울 것이 없어 따르고,
 * 안으로 종은 일간 편이 극왕해 따른다), 판정 축은 **그 방향에서 무엇을 보고
 * 갈렸는가**를 적는다. 둘을 곱해야 하는 이유가 여기 있다 — 진종의 조건이
 * 방향마다 거울처럼 뒤집힌다. 밖으로 종은 일간이 무근이어야 하고 안으로 종은
 * 뿌리가 있어야 한다(`followingAssessmentOf`). 같은 판정 이름에 같은 이유를 달면
 * 둘 중 하나는 거짓말이 된다.
 *
 * `candidate` 두 칸은 이유가 겹친다 — 코드에서도 진종·가종 어느 가지에도 걸리지
 * 않은 나머지라 방향과 무관하다. 겹치는 것을 겹친 채로 두는 것이 관계 넷이 한
 * 문장을 나눠 쓰는 것과 같은 판단이다.
 *
 * **판정 이름을 문장 틀에 타이핑하지 않는다.** '진종'·'가종'은 명리 용어라
 * (`MYEONGRI_LEXICON`) 틀에 적으면 근거 없는 용어로 걸린다 — 이름은 `{verdict}`
 * 슬롯으로 들어오고 이유만 여기 적힌다. 종격 후보 두 칸이 `{verdict}` 를 쓰지
 * 않는 것도 그래서다. 그 칸의 이름은 '종격 후보'인데 강도 표지가 이미 '후보로
 * 봅니다'라 "종격 후보 자리를 후보로 봅니다"가 된다.
 */
type FollowingWording = {
  verdict: FollowingPatternStatus;
  direction: FollowingDirection;
  /** 이 방향에서 이 판정으로 갈린 까닭 */
  because: string;
  /** 판정 이름을 문장이 부르는가 — 종격 후보만 부르지 않는다 */
  namesVerdict: boolean;
};

export const FOLLOWING_WORDINGS: readonly FollowingWording[] = [
  {
    verdict: 'true-following',
    direction: 'outward',
    because: '일간에 뿌리도 천간의 생부도 남아 있지 않아',
    namesVerdict: true,
  },
  {
    verdict: 'true-following',
    direction: 'inward',
    because: '일간에 뿌리가 있고 맞서는 천간이 없어',
    namesVerdict: true,
  },
  {
    verdict: 'pseudo-following',
    direction: 'outward',
    because: '약한 뿌리나 생부가 조금 남아 있어',
    namesVerdict: true,
  },
  {
    verdict: 'pseudo-following',
    direction: 'inward',
    because: '맞서는 천간이 조금 남아 있어',
    namesVerdict: true,
  },
  {
    verdict: 'candidate',
    direction: 'outward',
    because: '어느 쪽으로도 가를 만큼은 아니어서',
    namesVerdict: false,
  },
  {
    verdict: 'candidate',
    direction: 'inward',
    because: '어느 쪽으로도 가를 만큼은 아니어서',
    namesVerdict: false,
  },
];

/**
 * 종격 문장이 반드시 다는 마디 — **이 판정은 억부를 반박하지 않는다.**
 *
 * 문턱이 고전에서 온 숫자가 아니라 이 엔진의 실험값이라 억부를 뒤집지 않기로
 * 했다(`FOLLOWING_PATTERN_POLICY.eokbuOverride: 'disabled'`). 그런데 화면에서는
 * 억부 문장과 종격 문장이 나란히 서고, 둘이 서로 다른 오행을 가리킬 수 있다.
 * 문장이 순위를 밝히지 않으면 **독자가 둘 중 하나를 고르게 된다** — 그것은 우리가
 * 내리지 않은 판정을 독자에게 떠넘기는 것이다.
 */
const FOLLOWING_DEFERS = '실험 규칙이라 억부 후보를 뒤집지 않습니다.';

const followingBody = (wording: FollowingWording, mark: string): string =>
  [
    '자당 몫 {selfShare} 정도에 {dominant} 쪽이 가장 무거운데',
    wording.because,
    `{direction}하는${wording.namesVerdict ? ' {verdict}' : ''} 자리를 ${mark}.`,
    FOLLOWING_DEFERS,
  ].join(' ');

// 한 벌뿐이다. 시간 미상에서 내려앉는 것이 아니라 **입을 닫는다** — 주제가
// `absence` 라 계약이 통째로 잠근다(`FRAGMENT_TOPICS['following.verdict']`).
const followingFragments = FOLLOWING_WORDINGS.map(
  (wording): Fragment => ({
    topic: 'following.verdict',
    variant: followingVariant(wording.verdict, wording.direction),
    strength: 'candidate',
    template: followingBody(wording, '후보로 봅니다'),
  }),
);

/**
 * 궁합 십성 다섯 벌 — **누구 눈으로 본 것인지가 행의 첫 칸이다.**
 *
 * 십성은 원국에서 이미 사주팔자 표에 다 적혀 있다. 여기서 처음 생기는 값은
 * **일간과 일간 사이** 하나이고, 그것이 양방향으로 다르다 — 甲이 본 辛은 정관인데
 * 辛이 본 甲은 정재다. 방향을 적지 않으면 두 값 중 어느 쪽인지 잃어버린다.
 *
 * 그런데 방향은 **변종이 아니라 슬롯**이다. 두 방향의 문장이 갈리지 않고 이름만
 * 바뀌므로, 같은 틀을 두 번 세우면 비대칭은 두 행이 나란히 선 것으로 보인다.
 * 같은 오행이면 양쪽이 같은 십성이 되는데(비겁) 그때도 두 행이 그대로 선다 —
 * 겹치는 것을 겹친 채로 두는 것이 종격 후보 두 칸과 같은 판단이다.
 *
 * **`(...)` 안의 한 마디는 서술어가 아니라 뜻풀이다.** 관계 행에서 서술어를 뗀
 * 이유는 그것이 동어반복이어서였다 — '충(沖)' 에 이미 "맞선다"가 들어 있다.
 * 십성은 그렇지 않다. '정관' 이라는 한글 두 글자에 "일간을 누른다"는 뜻이 보이지
 * 않으므로 뜻풀이는 정보를 더한다. 그리고 그 뜻풀이는 십성의 **정의**라 명식마다
 * 달라지지 않고 판정을 담지도 않는다(`ROLE_GLOSS`).
 *
 * 한 벌뿐인 것은 조후와 같은 이유다 — 십성을 여는 열쇠가 두 일간뿐이고 일주는
 * 시각을 몰라도 나오므로 시주가 값을 바꾸지 않는다.
 */
const tenGodsFragments = (Object.entries(ROLE_GLOSS) as [ElementRole, string][]).map(
  ([role, gloss]): Fragment => ({
    topic: 'tenGods.between',
    variant: role,
    strength: 'fact',
    // 조사가 슬롯 뒤에 붙지 않는다. '의' 는 받침을 따르지 않고, 뜻풀이의 '을·이'
    // 는 슬롯이 아니라 '일간' 뒤에 붙는다.
    template: `{viewer}의 눈으로 본 {viewed} — {tenGod} (${gloss} 자리)`,
  }),
);

/**
 * 현재운 일곱 벌 — **강도가 행과 산문을 한 묶음 안에서 가른다.**
 *
 * 세운·월운은 `fact` 라 행이고 대운은 `derived` 라 산문이다. 같은 카드에 나란히
 * 서면서 갈리는 것이 이 묶음의 값이다 — `ClaimForm` 이 "완충 표현이 필요하다는
 * 것이 곧 산문이어야 한다는 뜻"이라고 적어 둔 것을 한눈에 보여 준다.
 *
 * 갈리는 까닭은 하나다. **대운수는 우리가 고른 값이다.** 절입까지의 거리를 사흘에
 * 한 살로 셈한 뒤 정수로 만드는데 그 정수화가 계통마다 다르고(`DaeunRounding`),
 * 그 정수 없이는 어느 칸이 몇 살부터인지 말할 수 없다. 세운의 해는 입춘에서,
 * 월운의 달은 절입에서 갈리는데 그 둘은 천문이라 고를 것이 없다.
 */
const DAEUN_LINEAGE =
  '대운수는 절입까지를 사흘에 한 살로 세어 반올림한 값이라, 버림으로 세는 계통에서는 한 해 이릅니다.';

/**
 * 나이와 대운 칸을 갈라 둔다 — **강등된 벌이 무엇에 걸리는지 때문이다.**
 *
 * 한 덩어리로 두면 "시주를 빼고 세면 만 36세인 지금은…" 이 되어 **나이가 시주 없이
 * 세어진 것처럼 읽힌다.** 나이는 생년월일에서 나오므로 시각과 무관하다. 흔들리는
 * 것은 그 나이가 몇 번째 칸에 떨어지는가뿐이라, 완충 표현이 그 자리에 붙어야 한다.
 */
const daeunHead = '만 {age}세인 지금은';
const daeunSpan = '{index} 대운 {pillar}({ageRange})';

/**
 * 기준 시각을 목록 앞에 세우는 한 줄.
 *
 * 행마다 날짜를 적지 않는다 — 다섯 줄에 같은 날짜가 다섯 번 찍히면 배경으로
 * 흘려 읽히고, 그러면 적어 둔 값을 잃는다. 목록의 조건을 목록이 드는 것이고
 * (`relation.coverage`), 다른 것은 이쪽이 **조건이 아니라 좌표**라서 언제나
 * 선다는 점이다.
 *
 * 둘째 문장이 링크를 위한 것이다. 결과 화면은 주소로 나눠 줄 수 있으므로
 * (`app/query.ts`) 받은 사람의 '지금'은 다른 지금이다. 기준 시각만 적고 그것이
 * 다시 셈된다는 것을 적지 않으면, 어제 찍은 스크린샷이 오늘의 운으로 읽힌다.
 *
 * 경계를 여기서 밝히는 것도 같은 이유다. 해가 입춘에서, 달이 절입에서 갈린다는
 * 것은 **이 달에 대한 사실이 아니라 우리가 어떻게 짚었는가**라서 행이 아니라
 * 목록의 몫이다 — 양력 1월에 열면 세운이 전 해로 나오는 것이 여기서 설명된다.
 */
const AS_OF = [
  '{at} 기준으로 짚은 운입니다.',
  '해는 입춘에서, 달은 절입에서 갈립니다.',
  '이 화면을 다시 열면 그때의 시각으로 다시 셉니다.',
].join(' ');

/**
 * 현재운 관계 목록이 운끼리는 보지 않았다는 고지.
 *
 * `relation.coverage` 와 문장을 나눠 쓰지 않는다. 저쪽에서 빠진 것은 **입력**
 * (시주)이고 여기서 빠진 것은 **우리 구현**이다. 한 문장으로 묶으면 시각을 다 아는
 * 사람에게 "목록이 온전하다"가 되어 버린다.
 *
 * **한동안 "대운이 낀 관계는 아직 세지 않아"였다.** 대운 칸이 관계를 들게 되면서 그
 * 말이 거짓이 됐고, 그 자리에서 더 좁은 공백이 드러났다 — 세 칸이 저마다 원국과의
 * 관계만 낸다. 고지가 좁아지는 것이 채워졌다는 증거다.
 *
 * "판정하지 않는다"가 아니라 "보지 않았다"라고 적는다 — 판정을 미룬 것이 아니라
 * 아직 만들지 않은 것이고, 그 구분이 `UNCOVERED_NOW_FACTS` 가 하는 일이다.
 */
const NOW_COVERAGE =
  '세 칸이 저마다 원국과 걸리는 것만 셌습니다. 대운과 세운·월운이 서로 걸리는 것은 아직 보지 않습니다.';

const nowFragments: Fragment[] = [
  { topic: 'now.asOf', variant: 'instant', strength: 'fact', template: AS_OF },

  // 산문 두 벌. 시간 미상이면 대운수가 정오에서 재어져 칸이 하나 어긋날 수 있다 —
  // 값이 달라지는 쪽이라 입을 닫는 것이 아니라 한 칸 내려간다.
  {
    topic: 'now.daeun',
    variant: 'within',
    strength: 'derived',
    template: `${daeunHead} ${daeunSpan} 안에 있는 것으로 봅니다. ${DAEUN_LINEAGE}`,
  },
  {
    topic: 'now.daeun',
    variant: 'within',
    strength: 'candidate',
    template: `${daeunHead} ${HOUR_UNKNOWN_MARK}를 빼고 세면 ${daeunSpan} 안에 있는 쪽을 후보로 봅니다. ${DAEUN_LINEAGE} 시각을 몰라 대운수가 두 달쯤 흔들리므로 칸이 하나 어긋날 수 있습니다.`,
  },

  // 한 벌뿐이다. "아직 없다"는 대운수가 한 살 어긋나면 그냥 틀린 문장이 되므로
  // 시간 미상에서는 내리는 것이 아니라 입을 닫는다(`polarity: 'absence'`).
  {
    topic: 'now.daeunPending',
    variant: 'first',
    strength: 'derived',
    // `{startAge}이고` 로 쓸 수 없다 — '이' 는 받침을 따르는 조사라 정적으로 막힌다.
    // 슬롯 뒤에 낱말('세')을 한 번 놓고 그 낱말에 붙인다.
    template:
      '만 {age}세인 지금은 첫 대운 {pillar} 앞이라 아직 대운이 들어오지 않은 것으로 봅니다. 첫 대운은 만 {startAge}세부터이고, ' +
      DAEUN_LINEAGE,
  },

  // 행 두 벌. 시주에 걸리지 않으므로 한 벌씩이다 — 세운의 해와 월운의 달은
  // 시주 두 글자가 바꾸지 않는다.
  {
    topic: 'now.saeun',
    variant: 'year',
    strength: 'fact',
    template: '{year}년 세운 {pillar} — 천간 {stemTenGod} · 지지 {branchTenGod}',
  },
  {
    topic: 'now.wolun',
    variant: 'month',
    strength: 'fact',
    template: '{month} 월운 {pillar} — 천간 {stemTenGod} · 지지 {branchTenGod}',
  },

  {
    topic: 'now.coverage',
    variant: 'fortunes-not-crossed',
    strength: 'fact',
    template: NOW_COVERAGE,
  },
];

/**
 * 관계 두 벌 — **열한 종류가 한 행을 쓴다.**
 *
 * 한동안 종류마다 서술어를 달았다: 합은 짝을 짓고, 충은 맞서고, 삼합은 무리를
 * 이루고, 방합은 계절에 모이고, 형은 서로 물린다. 여덟 벌이었다. 그것을 두 벌로
 * 줄인 것은 규칙이 바뀌어서가 아니라 **같은 규칙을 끝까지 밀었기** 때문이다.
 *
 * 해·파·원진·귀문 넷이 한 문장을 나눠 쓴 이유는 "엔진이 아는 것이 짝의 성립뿐"
 * 이어서였다. 그 잣대를 나머지에 대 보면 서술어가 전부 **동어반복**이다 —
 * '충(沖)' 이라는 글자에 이미 "맞선다"가 들어 있어서 `{name}` 슬롯이 이미 그
 * 말을 하고 있었다. 열한 종류가 행을 하나도 가르지 못하면 종류는 변종이 아니라
 * 슬롯이다.
 *
 * 줄이면서 정보가 **늘었다.** 옛 문장은 자리만 말하느라 `participant.char` 를
 * 통째로 버렸다 — "년주·일주 자리의 두 지지가 자오충"에는 어느 글자가 子고
 * 어느 것이 午인지 없다. 행은 글자를 그대로 든다.
 *
 * 그리고 위험이 하나 사라졌다. 합에 붙인 "짝을 짓습니다"는 합이 **성사됐다**는
 * 뉘앙스를 실어 합화(化) 판정처럼 읽혔는데, 그 판정은 하지 않기로 한 것이다
 * (`targetElement` 이지 `result` 가 아니다). 행에는 실을 서술어가 없다.
 *
 * 두 벌인 것은 시간 미상 때문이고, 갈리는 것은 **시주를 뺐다는 사실 하나**다.
 */
export const RELATION_ROW = '{participants} — {name}';

/**
 * 행 뒤에 괄호로 붙는 단서.
 *
 * 서술어가 아니라 **그 관계가 어떻게 성립했는지**를 적는다. 두 사람의 글자가
 * 합쳐 세 글자를 이룬 것은 쌍 관계와 무게가 다르고 **인정 여부 자체가 계통
 * 선택**이라, 같은 표에 놓되 그렇다는 것이 행에 남아야 한다.
 *
 * 한동안 `시주 없이 본 것` 이 여기 함께 있었다. **뺐다** — 그것은 이 관계가
 * 어떻게 성립했는지가 아니라 **목록을 어떻게 셌는지**라, 항목이 아니라 목록이
 * 질 몫이다(`relation.coverage`).
 */
/**
 * 한동안 `두 사람 글자가 합쳐 이룬 것` 이었다. **현재운이 그 낱말을 낡게 만들었다** —
 * 원국 巳 · 원국 未 · 세운 午 가 사오미 화방을 이루는 것은 두 사람이 아니라 한 사람의
 * 원국과 그해 세운이다. `RelationScope` 가 재는 것은 사람 수가 아니라 **글자들이 한 판
 * 안에서 만났는가**였고, 궁합밖에 없던 동안에는 그 둘이 같아 보였다.
 *
 * '반쪽'을 '두 글자'로 고친 것과 같은 종류다 — 규칙은 그대로고 낱말만 낡았다.
 */
export const RELATION_MARKS = { combined: '따로 있는 글자들이 합쳐 이룬 것' } as const;

const relationRow = (mark?: string): string =>
  mark === undefined ? RELATION_ROW : `${RELATION_ROW} (${mark})`;

/**
 * 관계 이름의 한자를 그대로 쓰는 이유.
 *
 * 산문은 한국어로 읽어야 하니 '을 일간'·'사월'로 쓰지만, 행은 바로 위에 있는
 * 사주 표기(`癸未 乙酉 辛巳 庚午`)와 **눈으로 이어져야** 한다. 행이 '자'라고
 * 쓰면 표의 `子` 를 찾아 짚을 수가 없다.
 */
// 한 벌씩이다. 시간 미상에 내려가지 않는다 — 시주가 빠져도 **그 합이 성립한다는
// 것은 그대로 참이고**, 흔들리는 것은 목록의 전체성이라 목록이 따로 든다.
const relationFragments: Fragment[] = [
  { topic: 'relation.present', variant: 'row', strength: 'fact', template: relationRow() },
  {
    topic: 'relation.present',
    variant: 'combined',
    strength: 'fact',
    template: relationRow(RELATION_MARKS.combined),
  },
];

/**
 * 목록이 스스로 드는 한계 — **행이 못 하던 말을 한다.**
 *
 * 행에는 누구의 시주가 빠졌는지 적을 자리가 없었다. 궁합에서 `(시주 없이 본 것)`
 * 만 보고는 민수 쪽인지 지영 쪽인지 알 수 없었는데, 목록은 이름을 부른다.
 *
 * `사실` 강도인데 완충 표현이 없는 것이 맞다. 이 문장이 주장하는 것은 관계에
 * 대한 무엇이 아니라 **우리가 무엇을 보고 셌는가**이고, 그것은 시주가 없어도
 * 확실히 아는 사실이다.
 */
const COVERAGE_TAIL = '시주를 빼고 센 목록이라 그 자리가 낄 관계는 여기 없습니다.';

const coverageFragments: Fragment[] = [
  {
    topic: 'relation.coverage',
    variant: 'natal',
    strength: 'fact',
    template: COVERAGE_TAIL,
  },
  // 한 판이면 누구인지 물을 일이 없고, 두 판이면 그것부터 밝혀야 한다.
  {
    topic: 'relation.coverage',
    variant: 'compat',
    strength: 'fact',
    template: `{who}의 ${COVERAGE_TAIL}`,
  },
];

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

  // ── 궁합 억부 부합 ───────────────────────────────────────────────────
  // 궁합의 첫 산문. 강등된 벌이 누구의 시주를 뺐는지 밝힌다.
  ...eokbuMatchFragments,

  // ── 궁합 오행 보완 ───────────────────────────────────────────────────
  // 행이다. 개수 둘을 세는 것뿐이라 물려받을 판정이 없다.
  ...elementSupportFragments,

  // ── 조후 ─────────────────────────────────────────────────────────────
  // 출처 의무가 처음으로 문장에 걸리는 자리다 — 위 `JOHU_SOURCE` 참조.
  ...johuFragments,

  // ── 종격 ─────────────────────────────────────────────────────────────
  // 여섯 변종 × 한 벌. 일곱 번째 변종(`not-following`)은 말하지 않기로 했으므로
  // 지시서에 오르지 않는다 — 조각이 없는 것이 아니라 조회되지 않는 자리다.
  ...followingFragments,

  // ── 궁합 십성 ────────────────────────────────────────────────────────
  // 원국 표에 없던 자리 하나 — 일간과 일간 사이. 양방향이라 같은 틀이 이름만
  // 바꿔 두 번 선다.
  ...tenGodsFragments,

  // ── 현재운 ───────────────────────────────────────────────────────────
  // 강도가 행과 산문을 한 묶음 안에서 가른다. 세운·월운은 해와 달에서 나온 사실이고
  // 대운은 우리가 고른 대운수 위에 서 있다 — 그래서 그 계통을 문장이 밝힌다.
  ...nowFragments,

  // ── 관계 ─────────────────────────────────────────────────────────────
  // 한때 22칸으로 지시서의 절반이었다. 종류가 행을 가르지 못한다는 것을 인정하고
  // 두 칸이 됐다 — 위 `RELATION_ROW` 참조.
  ...relationFragments,
  ...coverageFragments,
];

export const FRAGMENT_INDEX: FragmentIndex = indexFragments(FRAGMENTS);

/**
 * 채택한 말뭉치 규칙. 다른 `*_POLICY` 와 같은 구실을 한다 — 골든이 찍는다.
 */
export const CORPUS_POLICY = {
  ruleSet: 'text-corpus-v1',
  /** 아직 손으로 썼다. 생성기가 붙으면 이 값만 바뀐다 */
  producedBy: 'hand-written',
  /** 지시서에 빈칸이 없다. 다음은 칸을 채우는 것이 아니라 주제를 더하는 일이다 */
  covered: 'every-key-in-the-schema',
  /** 강도마다 표지를 하나로 고정한다. 완충 표현 목록은 하한일 뿐이다 */
  wording: 'one-mark-per-strength',
  /** 사실은 표지가 없는 것이 표지다 — 아래 칸의 말투를 쓰지 않는다 */
  fact: 'no-hedge-mark',
  /** 한 칸 내려앉은 벌은 시주를 빼고 셌다는 것을 문장이 밝힌다 */
  hourUnknownRung: 'names-the-missing-hour',
  /** 변종이 문장을 하나도 가르지 못하면 변종 축은 장식이다 */
  variants: 'must-change-some-sentence',
  /** 갈릴 근거가 없으면 여러 변종이 한 문장을 나눠 쓰고, 끝까지 밀면 변종이 사라진다 */
  sharedWording: 'collapses-to-a-slot',
  /** 세어지기만 하는 사실은 행이다 — 서술어는 동어반복이거나 없는 무게다 */
  countedFacts: 'rows-not-prose',
  /** 면제된 것은 완충 표현이지 강도가 아니다 — 행도 한 칸 내려앉는다 */
  rowStrength: 'not-pinned-to-fact',
  /** 옮겨 적은 표는 문장 안에서 출처를 부른다 — 조후가 그 규칙을 처음 돌린다 */
  attribution: 'named-in-the-sentence',
  /** 판정하지 않은 조건은 문장이 스스로 밝힌다 — 천간만 옮기면 그것은 요약이다 */
  copiedTable: 'names-what-it-did-not-judge',
  /** 실험 규칙은 자기가 몇 번째인지 밝힌다 — 순위를 감추면 독자가 고르게 된다 */
  precedence: 'names-what-it-does-not-overturn',
  /**
   * 계통을 고른 값은 **어느 쪽을 골랐는지** 문장이 밝힌다.
   *
   * 대운수가 그 첫 자리다(반올림이냐 버림이냐). 조후가 "나머지 조건은 원문에 있고
   * 판정하지 않습니다"를 다는 것과 같은 의무인데 방향이 반대다 — 저쪽은 **하지 않은
   * 것**을 밝히고 이쪽은 **한 것**을 밝힌다. 둘 다 밝히지 않으면 독자는 답이
   * 하나뿐인 줄 안다.
   */
  lineageChoice: 'names-which-lineage-it-took',
  /**
   * 상대 표현('지금'·'이번')을 쓰는 묶음은 좌표를 **목록 앞에 한 번** 적는다.
   *
   * 행마다 적으면 같은 값이 되풀이되어 배경으로 흘려 읽힌다 — 목록의 한계를 목록이
   * 드는 것과 같은 자리이고, 다른 것은 이쪽이 조건이 아니라 좌표라서 **언제나
   * 선다**는 점이다(`ASSEMBLE_POLICY.viewingInstant`).
   */
  relativeTime: 'coordinate-stated-once-up-front',
} as const;
