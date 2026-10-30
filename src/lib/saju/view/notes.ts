import {
  CLAIM_STRENGTH_KO,
  ELEMENT_KO,
  UNRESOLVED_FACTOR_KO,
  type Saju,
} from '../index';

import { percent1, round1, subjectParticle, type SpokenStrength } from './index';

/**
 * **명식 결과의 문단** — 웹과 앱이 같은 글자를 읽는다.
 *
 * 문단에는 굵은 낱말 · 한자가 섞인다. 태그를 든 채로는 두 화면이 함께 쓸 수 없어, 글자와 표시만 값으로 들고
 * 그리는 일은 각 화면의 `Rich` 가 한다(`app/saju/rich.tsx` · `mobile/src/chart/parts.tsx`).
 *
 * `copy.ts` 가 아니다 — 이 값은 프롭으로 넘어간다(`docs/agents/code-rules/screen-copy.md`).
 */
export type RichPart =
  | string
  /** 굵게 — 문단 안의 강조(`strong`) */
  | { readonly b: string }
  /** 중간 굵기 — 강조는 아니고 눈이 먼저 가야 할 말 */
  | { readonly m: string }
  /** 한자 — 기기 서체 */
  | { readonly g: string }
  /** 숫자 — 자릿수 폭을 맞춘다 */
  | { readonly n: string }
  /** 보조 글자색 */
  | { readonly s: string }
  /** 옅은 글자색 */
  | { readonly u: string };

export type Rich = readonly RichPart[];

/** 신살 — 길신 · 흉신의 낱말이 서는 자리의 고지 */
export const STAR_NATURE_NOTE = '길신·흉신·특수는 전통적 분류일 뿐, 좋고 나쁨의 판정이 아닙니다.';

export const STAR_BASIS_NOTE: Rich = [
  '산출법이 갈리는 신살은 채택한 기준을 밝히고 그 기준으로만 뽑습니다. 현침은 甲辛卯午申 중 3자 이상, 천문은 戌亥가 함께 있어야 성립하고, 천의성은 월지 바로 앞 지지입니다. 귀문관살·원진살은 원국 네 지지의 ',
  { b: '모든 쌍' },
  '에서 찾습니다(일지 기준으로 좁히는 계통은 쓰지 않습니다). 역마·도화·화개는 12신살에서, 귀문관살·원진살은 관계 표에서 가져온 값이라 그쪽과 언제나 일치합니다 — 두 글자가 서로 어떻게 걸렸는지는 ‘원국의 관계’에 있습니다.',
];

/**
 * 무엇이 세력을 옮겼는가의 각주.
 *
 * 몫의 근거를 같은 줄에 적는다. 25% 는 자료에 맞춰 고른 값이 아니라 **완성된 국의 절반**이고, 세 등급의 간격을 2배로
 * 고정한 데서 나온다(`BUREAU_POLICY.pull`) — 등급 사이의 비를 먼저 정하고 자료를 본다는 규율이다.
 */
export const WEIGHT_SHIFTS_NOTE: Rich = [
  '무게를 기울이는 것은 ',
  { b: '국(삼합·방합) 하나' },
  '입니다. 몫은 완성된 국이 절반(50%), 왕지를 낀 두 글자가 그 절반(25%), 왕지가 빠진 붙은 두 글자가 다시 그 절반(12.5%) — ',
  { b: '자료에 맞춰 고른 값이 아니라' },
  ' 등급 사이의 비(2배)를 먼저 정하고 나온 이 엔진의 실험값입니다. 월령을 잡았거나 화신이 투간했으면 깎지 않고, 왕지가 충을 맞으면 절반으로 깎습니다. 글자를 바꾸지는 않습니다 — 辰이 수국에 들어도 그 안의 土가 0 이 되지는 않습니다.',
];

export const SIX_COMBINATION_NOTE = '육합은 두 글자가 묶이는 관계이지 세력을 만드는 국(局)이 아닙니다';

export const STRENGTH_OVERLAP_NOTE = '세 기준은 서로 겹칩니다 — 득세 점수에 월지·일지가 이미 들어 있습니다.';

export const ROOTING_NOTE =
  '뿌리의 강약은 매기지 않습니다. 음양이 다른 뿌리와 고지의 중기도 거르지 않고 그대로 셉니다. 어디까지 통근으로 볼지는 계통마다 갈리며, 합충으로 뿌리가 상했는지도 여기서는 판정하지 않습니다.';

/** 조후 — 전체 후보를 적는 줄. 상 · 하반월로 갈린 칸에서만 선다 */
export const johuHalfNote = (stems: readonly string[]): Rich => [
  '이 칸은 상·하반월로 갈려서 그 절반의 후보만 위에 적었습니다. 전체 후보는 ',
  { g: stems.join(' · ') },
  ' 입니다.',
];

export const JOHU_NOTE =
  '세력 조건(‘수가 왕하면 戊’)은 판정하지 않으므로, 확정 용신이 아니라 후보와 조건을 함께 읽어야 합니다.';

/**
 * 억부와 조후가 같은 곳을 가리키는가 — **두 칸이 서로 무슨 관계인지 말한다.**
 *
 * 조후와 억부가 여태 나란히 서 있기만 했다. 하나는 「土를 쓰라」 하고 다른 하나는 「壬·丙을 보라」 하는데, 그 둘이
 * 같은 말인지는 읽는 사람이 오행 표를 외워 맞춰 봐야 알 수 있었다 — 무작위 3000건에서 **어긋나는 명식이 43.2%** 다.
 */
export const agreementNote = (agreement: Saju['analysis']['yongsinAgreement']): Rich => [
  { m: agreement.aligned ? '조후와 같은 곳을 가리킵니다.' : '조후와 다른 곳을 가리킵니다.' },
  ' ',
  ...(agreement.aligned
    ? [
        '조후가 권한 글자 가운데 ',
        { g: agreement.sharedStems.join(' · ') },
        `${subjectParticle(agreement.sharedStems[agreement.sharedStems.length - 1])} 억부와 같은 ${ELEMENT_KO[agreement.eokbuElement]}입니다.`,
      ]
    : [
        '조후가 권한 ',
        { g: agreement.johuStems.join(' · ') },
        ` 중에는 억부가 권한 ${ELEMENT_KO[agreement.eokbuElement]}${subjectParticle(ELEMENT_KO[agreement.eokbuElement])} 없습니다.`,
      ]),
  ' ',
  { u: '어느 쪽이 먼저인지는 「서열」 판이 답합니다.' },
];

/** 이 후보를 잘못 읽지 않게 하는 둘 — 확정이 아니라는 것과, 무엇이 아직 안 재어졌는가 */
export const eokbuNote = (eokbu: Saju['analysis']['eokbu']): Rich => [
  { b: '용신 확정값이 아닙니다.' },
  ` 억부는 용신을 잡는 네 길 중 하나이고, 아직 판정하지 않은 것이 남아 있습니다 — ${eokbu.unresolved
    .map((factor) => UNRESOLVED_FACTOR_KO[factor])
    .join(', ')}.`,
];

export const PRECEDENCE_NOTE: Rich = [
  '억부가 기준인 것은 ',
  { b: '용신을 잡는 네 길 중 유일하게 외부 명조와 대조된 판정' },
  '이기 때문입니다 — 그것도 시험값입니다. 이 서열은 AI 풀이 자료에도 같이 실립니다.',
];

type Tightest = Saju['analysis']['tonggwan']['tightest'];

/** 사이를 잇는 오행 — 드러났는가 · 숨었는가 · 없는가로 끝 문장이 갈린다 */
export const tonggwanBridgeNote = (tightest: Tightest): Rich => [
  '사이를 잇는 것은 ',
  { g: tightest.bridge },
  ` ${ELEMENT_KO[tightest.bridge]}입니다(${percent1(tightest.shares.bridge)}) — ${tightest.controller}는 ${tightest.bridge}를 낳고 ${tightest.bridge}는 ${tightest.controlled}를 낳습니다. ${
    tightest.bridgePresence === 'revealed'
      ? '이 오행은 여덟 글자에 드러나 있습니다.'
      : tightest.bridgePresence === 'hidden'
        ? '다만 여덟 글자에는 드러나지 않고 지장간에만 있습니다 — 위 몫은 그 지장간까지 편 점수입니다.'
        : '그런데 이 오행이 지장간까지 봐도 한 톨 없습니다 — 이을 손이 없다는 뜻입니다.'
  }`,
];

export const tonggwanNote = (tightest: Tightest): Rich => [
  { b: '맞선 것인지는 판정하지 않습니다.' },
  ' 얼마나 맞서야 대치(相戰)인지, 대치면 억부를 제치는지가 계통마다 갈리기 때문입니다 — 종격이 먼저 지나온 자리와 같습니다. 가벼운 쪽이 ',
  { n: percent1(tightest.facing) },
  ' 인데, 무작위 3000건에서 이 값이 30% 를 넘는 명식은 10.2% 입니다. 나머지 네 쌍도 자료에는 그대로 실립니다.',
];

/**
 * 종격의 문턱 — **수치를 손으로 적지 않는다.** 여기 「14건 중 4건」이 적혀 있었다 — 규칙이 v2 로 가고 대조 자료가
 * 늘어나는 동안 화면만 v1 의 숫자에 남아 있었다. 재는 자리가 값으로 들고 있는 것을(`externalCheck`) 그대로 받는다.
 */
export const followingNote = (externalCheck: {
  readonly claimedFollowing: number;
  readonly caught: number;
  readonly falsePositives: number;
}): Rich => [
  { b: '문턱은 고전이 정한 숫자가 아닙니다.' },
  ' 무작위 3000건의 세력 분포를 재고 정한 이 엔진의 실험값입니다. 종에는 방향이 둘이라 축 하나의 양끝으로 잽니다 — 일간을 도울 것이 없으면 ',
  { b: '밖으로' },
  '(종재·종살), 일간 편이 극왕하면 ',
  { b: '안으로' },
  ` 따릅니다. 외부 자료에서 종격이라고 밝힌 명조 ${externalCheck.claimedFollowing}건과 대조해 `,
  { b: `${externalCheck.caught}건을 잡았습니다` },
  ` — 여전히 덜 잡는 쪽으로 틀리고, 아니라고 적힌 쪽에서도 ${externalCheck.falsePositives}건을 종격으로 봅니다. 그래서 이 판정은 억부 후보를 뒤집지 않습니다. 진종·가종 어느 쪽으로도 밀기 어려운 명식은 ‘종격 후보’로 남겨 둡니다.`,
];

/**
 * 딱지가 무슨 뜻인가 — **한 벌만 있다.**
 *
 * 원국 화면과 궁합 화면이 이 문단을 각자 손으로 들고 있었고, 그래서 이미 갈려 있었다:
 * 궁합 쪽에는 **「참고」가 빠져** 있었다. 같은 딱지 체계를 화면마다 다르게 설명하면
 * 사용자는 자기가 본 딱지가 무엇인지 화면에 따라 다르게 배운다.
 *
 * **낱말은 엔진에서 온다**(`CLAIM_STRENGTH_KO`). 여기서 '사실'·'유도'를 손으로 적으면
 * 딱지에 찍히는 글자와 그 뜻을 적은 글자가 갈릴 수 있고, 그건 눈에 안 띈다.
 *
 * `silent` 는 뜻을 적지 않는다 — 말하지 않기로 한 것은 딱지로 서지 않으므로,
 * 여기 적으면 본 적 없는 딱지를 설명하는 줄이 된다.
 */
const CLAIM_STRENGTH_MEANING: Record<SpokenStrength, string> = {
  // 조사를 문장에 붙여 둔다 — '표' 뒤에는 「은」이 아니라 「는」이 붙어서,
  // 밖에서 한 글자를 이어 붙이면 넷 중 하나가 틀린 말이 된다.
  fact: '여덟 글자에서 곧장 세어진 것은',
  derived: '우리가 고른 문턱을 거친 것은',
  candidate: '아직 시험 중인 규칙은',
  reference: '조건을 자동 판정하지 않고 옮겨 적은 표는',
};

const MEANING_ORDER: readonly SpokenStrength[] = ['fact', 'derived', 'candidate', 'reference'];

export const CLAIM_STRENGTH_LEGEND: Rich = [
  '왼쪽 딱지는 ',
  { b: '얼마나 세게 말할 수 있는가' },
  `입니다. ${MEANING_ORDER.map(
    (strength, index) =>
      `${CLAIM_STRENGTH_MEANING[strength]} ${CLAIM_STRENGTH_KO[strength]}${index < MEANING_ORDER.length - 1 ? ', ' : '입니다. '}`,
  ).join('')}근거보다 세게 말하지 않는지는 계약이 검사합니다.`,
];

export const RELATIONS_NOTE =
  '성립 여부만 적습니다. 합이 이뤄지는지, 충이 합을 깨는지는 학파마다 갈려 판정하지 않습니다. 원진과 귀문은 네 쌍이 겹치므로 같은 두 글자에 두 줄이 함께 나올 수 있습니다.';

export const OVERLAPS_NOTE =
  '새로 센 것이 아니라 아래 표와 원국의 관계 표를 맞춰 본 것입니다 — 같은 종류가 같은 자리에 다시 걸린 것만 셉니다.';

/**
 * 표가 「현재」를 짚은 기준 시각 — **표 옆에 적어야 참이 된다.** 적지 않으면 어제 열어 둔 탭이 오늘의 운인 것처럼
 * 읽히고, 링크를 받은 사람은 남의 어제를 자기 지금으로 읽는다.
 */
export const fortuneTabsNote = (asOf: string) =>
  `다른 시점을 골라 한 표씩 집중해서 봅니다. ${asOf} 기준으로 짚었고, 다시 제출하기 전까지는 이 기준 시각이 바뀌지 않습니다.`;

export const SAEUN_BOUNDARY_NOTE = '해의 경계는 입춘입니다. 양력 1월에 일어난 일은 아직 전 해의 세운입니다.';

export const SAEUN_NOTE: Rich = [
  '칸 안은 위에서부터 천간 십성 · 간지 · 지지 십성 · 12운성(일간 기준) · 12신살(년지 기준)입니다. 아래 목록은 그 해가 ',
  { b: '원국과 그 해를 감싼 대운' },
  '에 대해 맺는 관계로, 원국 안에서만 성립하는 관계와 원국·대운 사이의 관계는 뺐습니다. 대운과 걸린 줄에는 ',
  { s: '대운' },
  ' 딱지가 붙습니다. 머리의 ',
  { s: 'N대운' },
  '은 그 해가 지나는 대운이고, 대운 경계를 넘는 해에는 둘이 적힙니다.',
];

export const WOLUN_BOUNDARY_NOTE =
  '경계는 절입입니다. 달력 월이 아니라 절기가 달을 가릅니다 — 3월 초 경칩 전까지는 아직 인월(寅月)입니다.';

export const WOLUN_NOTE: Rich = [
  '아래 목록은 그 달이 ',
  { b: '원국과 세운과 대운' },
  '에 대해 맺는 관계입니다. 그 달이 끼지 않은 관계는 빼두었습니다 — 원국 안에서 닫힌 것도, 원국·세운·대운끼리의 것도 여기 적을 이유가 없습니다. 원국 밖의 글자가 낀 줄에는 ',
  { s: '세운' },
  '·',
  { s: '대운' },
  ' 딱지가 붙습니다.',
];

/** 대운수가 나온 길 */
export const daeunReasonNote = (daeun: Saju['daeun']) =>
  `${daeun.directionReason} ${daeun.boundaryTerm.name} 절입까지 ${round1(daeun.daysToBoundary)}일이라 3으로 나눠 ${round1(daeun.startAgeExact)}년입니다.`;

export const daeunNote = (approximate: boolean): Rich => [
  '칸 안은 위에서부터 천간 십성 · 간지 · 지지 십성 · 12운성(일간 기준) · 12신살(년지 기준)입니다. 아래 목록은 그 대운이 원국과 맺는 관계입니다. ',
  { b: '세운·월운과 걸리는 것은 세운·월운 표에 있습니다' },
  ` — 한 칸이 열 해라 함께 놓을 세운이 하나가 아니어서, 좁은 쪽이 자기를 감싼 대운을 듭니다. 나이는 만 나이입니다.${
    approximate ? ' 출생 시각을 몰라 정오 기준으로 계산해 대운수가 두어 달 흔들립니다.' : ''
  }`,
];

export const HOUR_UNKNOWN_CORRECTION_NOTE =
  '출생 시각을 몰라 정오를 기준으로 계산했습니다. 아래는 그 시각에 적용된 보정 기록일 뿐입니다 — 시주는 뽑지 않았고, 연·월주는 절대 시각으로 판정하며, 일주는 정오라 이 보정으로는 넘어가지 않습니다.';
