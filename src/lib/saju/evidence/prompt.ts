import { BRANCH_INFO, SEASON_KO, STEM_INFO, type Branch, type Stem } from '../constants';
import {
  CLAIM_STRENGTH_KO,
  CLAIM_STRENGTH_ORDER,
  type ClaimStrength,
} from '../text/policy';
import { EVIDENCE_CONTRACT, type ChartEvidence, type Evidence } from '.';

/**
 * 자료와 함께 넘길 **프롬프트.**
 *
 * `evidenceOf` 가 계약을 값으로 싣고 나가는 것까지는 했는데, 받는 쪽이 모델이면
 * 계약이 자료 안에 있다는 것만으로는 지켜지지 않는다. **모델은 읽으라고 하지 않으면
 * 읽지 않고, 읽어도 따르라고 하지 않으면 따르지 않는다.** 그 한 겹이 여기다.
 *
 * ## 상한은 여기서 입을 막지 않는다
 *
 * 처음에 이 파일은 L3 문장 계약을 그대로 모델에게 옮겼다 — 점수 금지, 길흉 금지,
 * 후보는 확정 금지. **그러면 넘길 이유가 없다.** 그 규율은 *우리가 문장을 낼 때*의
 * 것이고, 우리 문장은 이미 `corpus.ts` 가 계약에 걸려서 낸다. 자료를 밖으로 넘기는
 * 까닭은 우리가 안 하는 것을 시켜 보려는 것이다.
 *
 * 그래서 사다리의 구실이 바뀐다. **말하지 말라는 눈금이 아니라 어느 층에서 한 말인지
 * 붙이는 딱지다.** 근거가 단단한 것은 단정하고, 얕은 것은 얕다고 밝히고 끝까지 간다.
 * 층을 밝히지 않은 채 다 단정하는 것과, 층에 막혀 아무 말도 못 하는 것 사이가 이
 * 파일이 겨누는 자리다.
 *
 * 딱 하나만 여전히 금지한다 — **없는 사실을 지어내는 것.** 이것은 조심성의 문제가
 * 아니라 그냥 틀린 것이다. 자료에 없는 글자를 있다고 하면 그 위의 해석은 전부 남의
 * 명식 이야기가 된다.
 *
 * ## 왜 다섯인가
 *
 * 셋은 **해석을 시키는 것**이고(`reading`·`now`·`compat`), 하나는 **옛 계약 그대로
 * 조이는 것**이고(`strict`), 하나는 **나온 글을 되짚는 것**이다(`audit`). 넷째가
 * 남아 있는 것은 견줄 짝이 있어야 실험이기 때문이다 — 조인 것과 푼 것을 같은 자료로
 * 돌려 봐야 무엇이 상한 덕이고 무엇이 모델 덕인지 갈린다.
 *
 * ## 계약을 되풀이하지 않고 가리킨다
 *
 * 사다리도 규칙 묶음 이름도 손으로 타이핑하지 않는다. `CLAIM_STRENGTH_ORDER` 와
 * `EVIDENCE_CONTRACT` 에서 지어서, 사다리에 칸이 하나 생기면 프롬프트가 저절로
 * 따라오고 그 칸에 말투를 안 적었으면 **타입이 먼저 빨개진다**.
 */

export type PromptKind = 'reading' | 'now' | 'compat' | 'strict' | 'audit';

export const PROMPT_POLICY = {
  ruleSet: 'evidence-prompt-v1',
  /** 계약을 되풀이하지 않고 자료 안의 자리를 가리킨다 */
  contract: 'pointed-at-not-restated',
  /** 사다리는 손으로 적지 않는다 — 계약에서 짓는다 */
  ladder: 'generated-from-claim-strength-order',
  /**
   * 상한의 구실이 프롬프트마다 다르다.
   *
   * 해석용은 **딱지**로 쓰고 엄격용은 **눈금**으로 쓴다. 같은 사다리를 두 가지로
   * 쓰는 것이 이 파일의 요점이라 값으로 적는다 — 하나로 합치면 둘 중 하나가 사라진다.
   */
  ceiling: 'label-in-reading-limit-in-strict',
  /** 지어내는 것만 막는다 — 조심성이 아니라 참·거짓의 문제다 */
  hardRule: 'no-invented-facts',
  /** 자료는 들여쓰지 않고 붙인다 — 붙여 넣는 자리에서 들여쓰기는 값이 아니라 무게다 */
  payload: 'minified-json',
  /** 문장마다 층과 근거를 달게 한다 — 어디서 온 말인지가 눈으로 보여야 실험이 된다 */
  output: 'every-sentence-carries-tier-and-path',
} as const;

/**
 * 사다리 칸마다 **어떻게 말할 것인가** — 해석용.
 *
 * 어느 칸에서도 「말하지 마라」가 없다. 가장 낮은 칸조차 말할 길을 준다 — 다만
 * 그것이 자료에서 온 것이 아님을 먼저 밝히게 한다.
 */
const TIER_RULE: Record<ClaimStrength, string> = {
  fact: '자료가 그대로 말한다. **단정해서 써라.**',
  derived:
    '세어 보면 나온다. 「…로 세면 …이다」로 쓰고, 세는 법이 달라지면 값도 달라진다는 것을 한 번은 밝혀라.',
  candidate:
    '갈래가 여럿인데 이 엔진은 하나만 봤다. 「…쪽으로 본다면」으로 열되 **끝까지 해석해라.** 여기서 멈추면 넘긴 보람이 없다.',
  reference:
    '고전 표에서 옮긴 것이다. 표가 뭐라 적었는지 밝히고 그 위에 네 읽기를 이어 붙여라 — 표와 네 읽기가 구별되게만 써라.',
  silent:
    '자료가 이 방향으로는 아무것도 못 준다(대개 시주를 몰라서다). 그래도 말하고 싶으면 **「자료가 뒷받침하지 않는 추측」이라고 먼저 적고** 말해라.',
};

/**
 * 같은 사다리를 **눈금으로** 쓸 때 — 엄격용.
 *
 * 우리 L3 가 문장을 낼 때 지키는 것과 같은 규율이다. 견줄 짝으로 남겨 둔다.
 */
const CEILING_RULE: Record<ClaimStrength, string> = {
  fact: '단정해도 된다. 「…이다」로 쓴다.',
  derived: '무엇을 어떻게 세어 나온 값인지 함께 적는다. 「…로 세면 …이다」.',
  candidate: '「후보」라는 말을 반드시 넣는다. 확정하지 마라.',
  reference: '「고전 표에는 …라고 적혀 있다」까지만. 그 표가 이 명식에 맞는다고 말하지 마라.',
  silent: '그 방향으로는 한 글자도 쓰지 마라.',
};

/** 사다리를 프롬프트에 적을 꼴로 — 센 것부터 내려온다 */
const ladderLines = (rule: Record<ClaimStrength, string>): string =>
  [...CLAIM_STRENGTH_ORDER]
    .reverse()
    .map(
      (strength) =>
        `- \`${strength}\` ${CLAIM_STRENGTH_KO[strength]} — ${rule[strength]}`,
    )
    .join('\n');

/**
 * 해석용 프롬프트에 늘 붙는 머리.
 *
 * 자료가 무엇인지, 무엇이 딱 하나 금지인지, 층을 어떻게 달지 — 셋뿐이다. 짧은 것이
 * 목적이다. 규칙이 길면 모델이 규칙 지키기에 지면을 다 쓰고 해석을 안 한다.
 */
const readingRules = (): string => `## 이 자료가 무엇인가

만세력 엔진이 낸 **사실과 계산의 목록**이다(\`contract\`, ${EVIDENCE_CONTRACT.version}). 해석은 하나도 들어 있지 않다(\`contract.interpretation: "none"\`) — 그 자리를 채우라고 너에게 넘긴다.

관계의 참여자마다 \`chartId\` 가 있다: \`natal\`(원국)·\`decade:n\`(대운)·\`annual:연도\`(세운)·\`monthly:…\`(월운). 두 사람이면 \`natal:a\`·\`natal:b\` 로 갈린다. 운은 지금 도는 칸만 실리고 기준 시각은 \`viewedAt\` 이다.

## 딱 하나 금지

**없는 것을 지어내지 마라.** 자료에 없는 글자·관계·운을 있다고 하면, 그 위에 쌓은 해석은 전부 남의 명식 이야기가 된다. 이건 조심성의 문제가 아니라 참·거짓의 문제다. 자료가 안 주는 것을 말해야겠으면 「자료 밖」이라고 먼저 적어라.

그 밖에는 **막지 않는다.** 길흉도, 시기도, 조언도, 성격도 말해도 된다. 이 엔진이 스스로는 안 하는 것들이고, 그것을 시켜 보려고 넘기는 것이다.

## 근거의 층 — 입을 막는 눈금이 아니라 딱지다

값마다 \`claims\` 표에 상한이 적혀 있다(사람마다 한 벌씩, 「있다(\`presence\`)」와 「없다(\`absence\`)」가 따로). **전부 해석하되 어느 층에서 한 말인지 밝혀라.**

${ladderLines(TIER_RULE)}

두 방향이 갈리는 까닭은 시각을 모를 때 「없다」가 먼저 무너지기 때문이다 — 여덟 글자 중 둘이 빠졌는데 「金이 없다」고 하면 그냥 거짓이다.

**얕은 근거에서 멈추지 마라.** 얕으면 얕다고 적고 **그 위에서 계속 읽어라.** 「후보라서 말할 수 없다」는 이 자리에서 쓸 답이 아니다 — 그 말을 하라고 넘기는 것이 아니다.

문장 끝마다 \`[층 · 근거경로]\` 를 단다. 예: \`[사실 · analysis.elements]\`, \`[후보 · analysis.eokbu]\`, \`[추측 · 자료밖]\`.`;

/** 해석용 셋이 공통으로 닫는 자리 */
const CLOSING = `마지막에 두 묶음으로 닫는다.

- **가장 단단한 것 셋** — \`fact\`·\`derived\` 에서만 고른다.
- **가장 흔들리는 것 셋** — 무엇을 더 알면 단단해지는지까지. \`contract.excluded\` 와 \`limitations\` 도 여기서 읽어라.`;

const READING = `# 역할

너는 이 사람의 사주를 **끝까지 읽어 주는 사람**이다. 자료를 목록으로 되풀이하지 말고, 그것이 이 사람에게 무엇을 뜻하는지까지 가라.

${readingRules()}

## 낼 것

**전부 해석해라.** 자료가 닿는 데까지 다 다룬다 — 타고난 기질, 무엇으로 먹고사는 쪽인지, 사람 관계에서 반복되는 모양, 돈, 몸, 그리고 지금이 어느 때인지.

층으로 갈라서 쓰지 마라. **주제로 갈라 쓰고 층은 문장마다 딱지로 붙인다** — 「사실 문단」과 「후보 문단」을 따로 두면 읽는 사람은 뒤쪽을 안 읽는다.

${CLOSING}

전체 1500자 안팎.`;

const NOW = `# 역할

너는 이 사람의 **지금**을 읽는 사람이다.

${readingRules()}

## 낼 것

1. **언제를 말하는가** — \`viewedAt\` 을 첫 줄에 적는다. 이 글은 하루 뒤에 읽으면 틀릴 수 있고 읽는 사람이 그것을 알아야 한다.
2. **지금 도는 세 칸** — \`now.daeun\`·\`now.saeun\`·\`now.wolun\`. 간지와 일간에서 본 십성을 적고, **그것이 이 사람에게 지금 무엇인지 해석해라.**
3. **지금이 원국과 무엇에 걸리는가** — \`now.relations\`. 참여자의 \`chartId\` 로 어느 판의 글자인지 밝히고, 그 걸림이 어떤 국면으로 나타날 만한지까지 말해라.
4. **틀이 다른 값이 섞여 있다** — \`contract.crossedFortunes\` 를 읽어라. \`now.saeun.relations\` 는 **한 해 전체**를 견준 것이라 지금 안 도는 대운과 걸린 것이 섞일 수 있고, \`now.relations\` 는 **한 순간**이라 지금 도는 대운만 남긴 것이다.
5. **흔들리는 것** — \`daeunApproximate\` 가 참이면 시각을 몰라 대운수가 두어 달 흔들리고, 경계에 걸리면 칸이 하나 어긋난다. 그러면 지금 대운이 다른 칸일 수 있다.

${CLOSING}

전체 1200자 안팎.`;

const COMPAT = `# 역할

너는 두 사람의 사주를 맞대어 읽는 사람이다.

${readingRules()}

## 낼 것

1. **두 사람의 글자가 서로 무엇에 걸리는가** — \`compatibility.relations\`. 줄마다 누구의 어느 자리 글자인지 밝히고 **그 걸림을 해석해라.**
2. **합쳐서 이룬 것** — \`combinedFormations\`. 혼자서는 못 이루고 둘이 모여야 서는 구조다. 둘이 만나 새로 생기는 것이라 여기가 궁합의 본론이다.
3. **오행이 서로 무엇을 채우고 무엇을 겹치는가** — \`elementSupport\`.
4. **서로를 어떤 십성으로 보는가** — \`tenGods.aSeesB\` 와 \`bSeesA\`. **한쪽이 다른 쪽을 뜻하지 않는다** — 짝사랑이 흔한 모양이다.
5. **억부 후보끼리의 맞물림** — \`eokbuMatch\`. 후보 위에 세운 값이니 얕다고 적고, 그 위에서 계속 읽어라.

## 점수

**점수를 내 봐라.** 이 엔진은 궁합을 점수로 내지 않지만(\`contract.scoring: "${EVIDENCE_CONTRACT.scoring}"\`, \`${EVIDENCE_CONTRACT.ruleSets.compatibility}\`), 그것은 우리가 배점의 근거를 못 찾아서지 네가 못 하리라는 뜻이 아니다.

다만 **한 덩어리 숫자로 내지 마라.** 무엇에 몇 점을 왜 줬는지 항목으로 쪼개고, 각 항목이 자료의 어느 경로에서 나왔는지 적어라. 그리고 마지막에 한 줄 — **이 배점은 자료에 없고 네가 만든 것이다.** 그 사실을 숨기지 마라.

${CLOSING}

전체 1500자 안팎.`;

const STRICT = `# 역할

너는 만세력 자료를 **근거보다 세게 말하지 않고** 옮기는 사람이다. 이 프롬프트는 앞의 것들과 견주려고 있다 — 같은 자료를 조여서 읽으면 무엇이 남는지 보는 자리다.

## 반드시 지킬 것

이 자료는 스스로 계약을 들고 나온다(\`contract\`, ${EVIDENCE_CONTRACT.version}).

1. **자료 밖의 것을 말하지 않는다.** 사주 지식으로 빈칸을 메우지 마라. 없으면 「이 자료로는 알 수 없다」고 적는다.
2. **근거마다 상한이 다르다.** \`claims\` 의 「있다」·「없다」 상한을 넘지 마라.
3. **점수도 등급도 만들지 않는다**(\`contract.scoring: "${EVIDENCE_CONTRACT.scoring}"\`). 오행 비율(\`analysis.elements.ratios\`)은 지장간을 사령 일수로 펼친 **엔진 내부 점수**이지 세력이 그만큼이라는 뜻이 아니다.
4. **길흉을 말하지 않는다.**
5. **용신을 확정하지 않는다.** \`analysis.eokbu\` 는 억부만 본 후보다. 「기신은 金입니다」가 아니라 「억부 후보를 용신으로 놓으면 金이 기신 자리에 온다」이다.
6. **합이 되었다고 말하지 않는다.** 관계 목록은 「모였다」까지고 화(化)는 \`analysis.transformation\` 이 세 등급으로만 낸다.
7. **운은 지금 도는 칸뿐이다**(\`contract.fortune: "${EVIDENCE_CONTRACT.fortune}"\`). \`daeunAbsence: "beyond-table"\` 은 우리 표가 짧아서이지 그 사람에게 대운이 없다는 뜻이 아니다.
8. **누구의, 어느 판의 글자인지 밝힌다**(\`chartId\`).

## 강도 사다리

${ladderLines(CEILING_RULE)}

## 낼 것

네 부분. 문장 끝마다 \`[강도 · 근거경로]\` 를 단다.

1. **여덟 글자가 그대로 말하는 것** — \`fact\` 만.
2. **세어 보면 나오는 것** — \`derived\`.
3. **후보에 그치는 것** — \`candidate\`·\`reference\`.
4. **이 자료가 답하지 못하는 것** — \`contract.excluded\`·\`limitations\`, 그리고 **네가 말하고 싶었으나 상한에 막혀 못 쓴 것.**

전체 900자 안쪽.`;

const AUDIT = `# 역할

아래에 만세력 자료와, 그 자료를 읽고 **어떤 모델이 쓴 해설**이 있다. 너는 그 해설을 되짚는다.

찾을 것은 「틀린 곳」이 아니라 **「어디서 온 말인가」**다. 해석은 있어도 된다 — 해석인 줄 모르게 적힌 것이 문제다.

## 가를 것

문장마다 셋 중 하나로 가른다.

- **자료** — 자료의 값이 그대로 말한다. 근거 경로를 적는다.
- **읽기** — 자료 위에 세운 해석이다. 어느 값에서 출발했는지 적는다.
- **자료 밖** — 자료에 없는 것을 말했다. 모델이 제 지식에서 가져왔거나 지어낸 것이다.

## 특히 볼 것

1. 자료에 **없는 글자·관계·운**을 있다고 한 곳 — 이건 해석이 아니라 오류다.
2. \`claims\` 의 상한이 얕은데(\`candidate\`·\`reference\`) 단정으로 적힌 곳.
3. 「있다」와 「없다」를 같은 세기로 쓴 곳 — 시각을 모르면 「없다」가 먼저 무너진다.
4. 누구의 글자인지, 어느 계산판(\`chartId\`)의 글자인지 흐린 곳.
5. 기준 시각(\`viewedAt\`)을 안 밝히고 운을 말한 곳.
6. 점수·등급을 냈으면 **그 배점이 어디서 왔는지 적혀 있는가.** 만든 것을 만들었다고 적었으면 통과다.

## 낼 것

표 하나. | 해설의 문장 | 자료 / 읽기 / 자료 밖 | 근거 경로 | 한 줄 평 |

마지막에 두 줄로 닫는다 — **자료가 실제로 떠받친 비율**이 얼마쯤인지, 그리고 **가장 위험한 한 문장**이 무엇인지.

**없는 문제를 만들지 마라.** 해석을 해석이라고 밝히고 쓴 문장은 문제가 아니다.

## 검사할 해설

<<< 여기에 검사할 해설을 붙여 넣으세요 >>>`;

const BODY: Record<PromptKind, string> = {
  reading: READING,
  now: NOW,
  compat: COMPAT,
  strict: STRICT,
  audit: AUDIT,
};

/** 화면이 고르게 할 목록 — 문구는 여기 있고 화면은 자리만 안다 */
export const PROMPTS: readonly {
  kind: PromptKind;
  label: string;
  hint: string;
  /** 두 사람일 때만 뜻이 있는가 */
  needsTwo: boolean;
}[] = [
  {
    kind: 'reading',
    label: '전부 해석',
    hint: '근거의 층은 딱지로 붙이고 끝까지 읽힌다 — 막지 않는다',
    needsTwo: false,
  },
  {
    kind: 'now',
    label: '지금 도는 운',
    hint: '기준 시각과 세 칸을 해석까지 시킨다',
    needsTwo: false,
  },
  {
    kind: 'compat',
    label: '궁합 · 점수',
    hint: '점수를 내되 배점을 쪼개고 만든 것이라고 밝히게 한다',
    needsTwo: true,
  },
  {
    kind: 'strict',
    label: '상한 지키기',
    hint: '조여서 읽으면 무엇이 남는가 — 견줄 짝',
    needsTwo: false,
  },
  {
    kind: 'audit',
    label: '해설 되짚기',
    hint: '나온 글의 어느 문장이 자료에서 왔는지 가른다',
    needsTwo: false,
  },
];

/** 자료 없이 프롬프트만 — 화면이 미리 보이는 자리에 쓴다 */
export const promptBodyOf = (kind: PromptKind): string => BODY[kind];

/**
 * 한눈에 보이는 머리 — **새 값이 아니라 아래 자료에서 뽑은 것.**
 *
 * 여덟 글자를 읽으려고 36KB 짜리 JSON 을 뒤지게 하지 않는다. 사람이 붙여 넣기 전에
 * 「이 사람 맞나」를 눈으로 확인하는 자리이기도 하고, 모델에게는 긴 자료를 읽기 전에
 * 좌표를 주는 자리다.
 *
 * **다시 세지 않는다.** 전부 `evidence` 의 필드를 읽어서 적는다 — 여기서 간지나 절기를
 * 새로 구하면 머리와 자료가 언젠가 어긋나고, 어긋난 날 어느 쪽이 맞는지 알 수 없다.
 * 화면의 운과 문장의 운을 한 곳에서 낸 것과 같은 규율이다.
 *
 * **사람을 이름으로 부르지 않는다.** `charts.a`·`charts.b` 라고 적는 것은 무뚝뚝해서가
 * 아니라, 이 머리가 하는 말이 사람에 대한 것이 아니라 **자료의 어느 자리**에 대한
 * 것이기 때문이다. 모델이 아래 JSON 에서 찾아갈 이름도 그것이다.
 */
function chartSummary(key: 'charts.a' | 'charts.b', chart: ChartEvidence): string {
  const { pillars, now } = chart;
  const { year, month, day, hour, dayMaster, meta } = pillars;

  const stem = STEM_INFO[dayMaster as Stem];
  const monthBranch = BRANCH_INFO[month.branch as Branch];

  const eight = [
    `년 ${year.name}`,
    `월 ${month.name}`,
    `일 ${day.name}`,
    hour === null ? '시 —(시간 미상)' : `시 ${hour.name}`,
  ].join(' · ');

  const daeun =
    now.daeun === null
      ? `대운 없음(${now.daeunAbsence})`
      : `대운 ${now.daeun.index} ${now.daeun.pillar.name}(만 ${now.daeun.startAge}→${now.daeun.endAge}세)`;

  return [
    `\`${key}\``,
    `- 여덟 글자  ${eight}`,
    `- 일간 ${dayMaster}(${stem.yinYang === '陽' ? '양' : '음'}·${stem.element}) · 월지 ${month.branch}(${SEASON_KO[monthBranch.season]}) · 절입 ${meta.monthTerm.name} · 사주년 ${meta.sajuYear}`,
    `- 지금 만 ${now.age}세 — ${daeun} · 세운 ${now.saeun.pillar.name}(${now.saeun.year}) · 월운 ${now.wolun.pillar.name}(${now.wolun.startTerm.name})`,
  ].join('\n');
}

/** 자료 앞에 놓는 머리 전체 */
function summaryOf(evidence: Evidence): string {
  const lines = [chartSummary('charts.a', evidence.charts.a)];
  if (evidence.charts.b !== null) lines.push(chartSummary('charts.b', evidence.charts.b));

  return `## 한눈에

아래 자료에서 뽑은 것이다 — **새로 더한 값이 아니다.** 어긋나 보이면 자료 쪽이 맞다.

${lines.join('\n\n')}

기준 시각 \`viewedAt\` = ${evidence.viewedAt}`;
}

/**
 * 프롬프트와 자료를 한 덩어리로 — **이대로 붙여 넣으면 된다.**
 *
 * 자료를 뒤에 놓는다. 앞에 놓으면 긴 JSON 을 다 읽고 나서야 규칙을 만나고, 그때는
 * 이미 읽는 방식이 정해져 있다. 규칙이 먼저다.
 *
 * **한눈에 보이는 머리는 역할 바로 뒤에 선다.** 규칙보다도 앞이다 — 무엇을 읽는지
 * 모르는 채 어떻게 읽을지부터 듣게 하지 않는다. 붙여 넣는 사람도 첫 줄에서 「이 사람
 * 맞나」를 확인한다.
 *
 * 자리를 찾는 법이 암묵이라 테스트가 잠근다. 프롬프트는 전부 `# 역할` 문단으로 열고
 * 그다음이 `## ` 로 시작하는 절이다 — 그 경계에 끼운다.
 *
 * 들여쓰지 않는다. 붙여 넣는 자리에서 들여쓰기는 읽기 좋음이 아니라 **무게**다 —
 * 두 사람짜리가 들여쓰면 460KB 이고 안 들여쓰면 76KB 다.
 */
export function promptWithEvidence(kind: PromptKind, evidence: Evidence): string {
  return `${promptHeadOf(kind, evidence)}

## 자료 (${EVIDENCE_CONTRACT.version})

\`\`\`json
${JSON.stringify(evidence)}
\`\`\``;
}

/**
 * 자료를 뺀 나머지 — **화면 미리 보기가 실제로 보낼 것을 보이게 한다.**
 *
 * 미리 보기가 `promptBodyOf` 를 보이면 머리가 빠진 글을 보여 주게 되고, 그러면
 * 「보내기 전에 무엇을 보내는지 본다」는 그 칸의 구실이 절반만 지켜진다. 자료만
 * 잘라 낸다 — 잘린 자리가 어디인지는 화면이 한 줄로 적는다.
 */
export function promptHeadOf(kind: PromptKind, evidence: Evidence): string {
  const [role, ...rest] = BODY[kind].split(/\n\n(?=## )/);

  return [role, summaryOf(evidence), ...rest].join('\n\n');
}
