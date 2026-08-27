import { EVIDENCE_CONTRACT } from '../saju/evidence';
import { PROMPT_PARTS, withSummary } from '../saju/evidence/prompt';

import type { ReadingEvidence } from '.';
import { READING_POLICY, isScored, type ReadingKind } from './policy';

/**
 * 사용자에게 나가는 결과를 만드는 **프롬프트.**
 *
 * ## 왜 익명 화면의 프롬프트와 따로 서는가
 *
 * `evidence/prompt.ts` 는 사람이 복사해 붙이는 실험판이다(`evidence-prompt-v1`).
 * 받는 쪽이 사람이라 출력이 Markdown 한 덩어리여도 되고, 점수도 「쪼개서 만들었다고
 * 밝히라」로 충분하다. **여기는 아니다** — 점수가 값으로 저장되고 화면이 그것을
 * 숫자로 세우므로, 출력의 모양이 계약이어야 한다.
 *
 * 갈라 두되 **말투와 규율은 갈리지 않는다.** 자료를 어떻게 읽고 어떤 층에서 말하는지,
 * 어떻게 써야 사람이 읽는 글이 되는지는 `PROMPT_PARTS` 한 벌을 둘이 같이 쓴다.
 * 이것이 갈리면 느슨한 쪽이 언제나 사용자에게 나가는 쪽이 된다.
 *
 * ## 「낼 것」만 kind 마다 다르다
 *
 * 자기 풀이는 한 사람을 끝까지 읽고, 궁합은 두 사람 **사이**를 읽는다. `match` 는
 * 자료 자체가 이미 잘려 있어(`shareEvidence`) 상대 원국 판정을 쓰고 싶어도 쓸 자료가
 * 없다 — 프롬프트가 그것을 한 번 더 적는 것은 **자료에 없는 것을 왜 안 쓰는지**
 * 모델이 알아야 얼버무리지 않기 때문이다.
 */

/**
 * **조립 옵션** — 실험 변형이 프롬프트를 뜯어고치지 않고 갈라지는 자리.
 *
 * 완성된 46KB 문자열에 `.replace()` 를 대는 순간 변형은 「무엇이 달라졌는가」를 스스로
 * 말하지 못하게 된다 — 앞의 문구를 고치면 뒤의 치환이 조용히 빗나가고, 빗나간 채로도
 * 문자열은 그럴듯하게 나온다. 갈라지는 자리를 **조립 단계**에 두면 변형 하나가
 * 정확히 한 곳만 바꾼다는 것이 코드로 보인다.
 *
 * **기본값이 곧 실제로 보내는 것이다**(`CONTROL`). 변형은 이 기본값에서 하나씩만
 * 벗어나고 서로 쌓이지 않는다 — 쌓으면 이긴 변형이 무엇 덕에 이겼는지 알 수 없다.
 */
export type Length = { readonly min: number; readonly max: number };

export type ParagraphOrder = 'evidence-first' | 'answer-first';
export type SelfItemCount = 'fixed' | 'bounded';
export type SelfSectionOrder = 'nature-first' | 'now-first';

/**
 * 자기 풀이가 **무엇에 답하는가** — 여기만 출력의 *단위*를 바꾼다.
 *
 * 다른 옵션들은 여덟 절 한 편을 어떻게 세울지를 고른다(순서·개수·분량). 그 셋을
 * 아무리 돌려도 나오는 것은 여전히 한 편의 풀이다. 「사람들은 풀이보다 답을 원한다」가
 * 참인지 거짓인지는 **한 편을 내주는 것을 그만두어 봐야** 갈린다.
 *
 * `now` 는 그 물음의 첫 후보다 — 「지금」 하나만 답하고 나머지는 절로 세우지 않는다.
 */
export type SelfScope = 'whole' | 'now';

export type PromptAssembly = {
  /** 자기 풀이 본문 분량 */
  readonly selfLength: Length;
  /** 판단 순서는 그대로 두고 사용자에게 보이는 문단 순서만 가른다 */
  readonly paragraphOrder: ParagraphOrder;
  /** 강점·걸림을 고정 개수로 채울지, 근거가 있는 만큼만 낼지 */
  readonly selfItemCount: SelfItemCount;
  /** 자기 풀이에서 「지금」을 원래 자리에 둘지 앞으로 옮길지 */
  readonly selfSectionOrder: SelfSectionOrder;
  /** 자기 풀이가 답하는 범위 — 한 편을 다 읽을지 「지금」 한 축만 답할지 */
  readonly selfScope: SelfScope;
  /** 「낼 것」 앞에 얹는 절 — 없으면 빈 배열 */
  readonly extraSections: readonly string[];
  /** 자료 **뒤에** 붙는 꼬리 — 없으면 `null` */
  readonly tail: string | null;
};

export const CONTROL: PromptAssembly = {
  selfLength: { min: 1800, max: 2600 },
  paragraphOrder: 'evidence-first',
  selfItemCount: 'fixed',
  selfSectionOrder: 'nature-first',
  selfScope: 'whole',
  extraSections: [],
  tail: null,
};

const SCORE_SECTION = `## 점수

**0~100 정수 하나**를 낸다. 이 엔진은 궁합을 점수로 내지 않으므로(\`contract.scoring: "${EVIDENCE_CONTRACT.scoring}"\`) 그 숫자는 **네가 만드는 것**이다. 우리가 배점의 근거를 못 찾아서지 네가 못 하리라는 뜻이 아니다.

- 한 덩어리 느낌으로 찍지 마라. **서로 채워 주는 정도 · 부딪히는 정도 · 둘이 모여야 서는 구조** 셋을 각각 본 뒤 합쳐라.
- 관계가 **많다**는 것이 좋다는 뜻이 아니다. 충·형·해도 관계다.
- 시각을 모르는 사람이 있으면(\`compatibility.hourKnown\`) 그만큼 덜 확신하는 쪽으로 잡고, 본문에 그렇게 적어라.
- 50 을 기본값처럼 쓰지 마라. 자료가 한쪽으로 기울면 기울어진 대로 내라.

본문에는 **점수의 근거**를 한 문단으로 적되 숫자를 되풀이해 적지는 마라. 점수 자체는 본문이 아니라 따로 낸다.`;

const strengthsAt = (position: number, itemCount: SelfItemCount): string =>
  itemCount === 'fixed'
    ? `**${position}. 잘하는 것 넷** — 줄마다 「무엇을 잘한다 → 왜 그런가 → 어디에 쓰면 되는가」.`
    : `**${position}. 잘하는 것 — 최대 넷** — 근거가 있는 만큼만 쓴다. 서로 다른 근거가 같은 방향으로 모인 것을 우선하고, 결정적인 단일 근거는 「~한 경향」으로 완충해 구체적으로 쓴다. 개수를 채우려고 일반론을 보태지 마라. 줄마다 「무엇을 잘한다 → 왜 그런가 → 어디에 쓰면 되는가」.`;

const frictionAt = (position: number, itemCount: SelfItemCount): string =>
  itemCount === 'fixed'
    ? `**${position}. 걸리는 것 셋** — 줄마다 「무엇이 문제다 → 언제 그렇게 되는가 → 그때 어떻게 하는가」.`
    : `**${position}. 걸리는 것 — 최대 셋** — 근거가 있는 만큼만 쓴다. 서로 다른 근거가 같은 방향으로 모인 것을 우선하고, 결정적인 단일 근거는 「~로 나타날 수 있다」로 완충해 조건을 밝힌다. 개수를 채우려고 일반론을 보태지 마라. 줄마다 「무엇이 문제다 → 언제 그렇게 되는가 → 그때 어떻게 하는가」.`;

/**
 * 「지금」 한 축만 답할 때 **안 쓰는 것을 먼저 말한다.**
 *
 * 절 목록만 줄이면 모델은 남은 절 안에 나머지를 밀어 넣는다 — 「타고난 결」이 없어도
 * 2번 절이 기질 설명으로 절반을 쓴다. 그러면 범위를 좁힌 것이 아니라 소제목만 줄인 것이
 * 되고, 이 변형이 재려던 「출력의 단위」는 하나도 안 달라진다.
 *
 * 빠뜨린 것을 아쉬워하는 문장도 함께 막는다. `MATCH_SCOPE` 와 같은 판단이다 — 없는 것을
 * 아쉬워하는 데 지면을 쓰면 좁힌 만큼이 그대로 사라진다.
 */
const NOW_SCOPE = `## 이 글이 답하는 것

이 글은 **「지금」 하나만** 답한다. 타고난 결·잘하는 것·걸리는 것·일과 돈·사람 관계·살림법을 **절로 세우지 마라.** 그것들은 지금 도는 운이 이 사람에게 어떻게 걸리는지 설명하는 데 **필요한 만큼만** 끌어 쓰고, 끌어 썼으면 그 절의 근거 줄에 적는다.

빠뜨린 것을 아쉬워하지 마라. 「전체 해석에서는」·「이 글에서 다루지 못한」 같은 말은 이 자리에서 쓸 답이 아니다. 좁힌 만큼 **깊이 답하는 것**이 이 글의 목적이다.`;

const nowOnlySections = [
  '**1. 한 줄로** — 지금 이 사람에게 무슨 때인지 한 문장. 비유를 쓸 거면 여기서만.',
  '**2. 무슨 때인가** — 기준 시각(\`viewedAt\`)을 밝히고 지금 도는 대운·세운·월운이 각각 무슨 때인지. 셋이 같은 방향을 가리키는지 서로 어긋나는지까지.',
  '**3. 이번 달에 할 것** — 밀어붙일 것 하나와 미룰 것 하나. **언제·어떤 상황에서·무엇을** 로 적는다.',
  '**4. 이때 걸리는 것 하나** — 지금 운에서 무엇이 문제로 나오는가. 언제 그렇게 되고 그때 어떻게 하는가.',
];

const selfSections = (
  { selfLength: { min, max }, selfItemCount: itemCount, selfSectionOrder: sectionOrder, selfScope }: PromptAssembly,
): string => {
  const natureFirst = [
    '**1. 한 줄로** — 이 사람이 어떤 사람인지 한 문장. 비유를 쓸 거면 여기서만.',
    '**2. 타고난 결** — 어떤 기질이고 그것이 하루에 어떻게 나오는지.',
    strengthsAt(3, itemCount),
    frictionAt(4, itemCount),
    '**5. 일과 돈** — 어떤 판에서 힘이 나고 어떤 판에서 빠지는지. **직업 이름을 못박지 말고 조건으로 말해라.**',
    '**6. 사람 관계** — 되풀이되는 모양 하나와, 그것을 아는 것만으로 달라지는 것 하나.',
    '**7. 살림법** — 늘릴 기운 하나와 그것을 일상에서 늘리는 법 서넛, 줄일 것 하나. 억부 후보(\`analysis.eokbu\`)·없는 오행(\`analysis.elements.missing\`)·조후(\`analysis.johu\`)를 함께 보고 고른다.',
    '**8. 지금** — 기준 시각(\`viewedAt\`)을 밝히고 지금 도는 대운·세운·월운이 무슨 때인지. 이번 달에 밀어붙일 것 하나, 미룰 것 하나까지.',
  ];

  const nowFirst = [
    natureFirst[0],
    '**2. 지금** — 기준 시각(\`viewedAt\`)을 밝히고 지금 도는 대운·세운·월운이 무슨 때인지. 이번 달에 밀어붙일 것 하나, 미룰 것 하나까지.',
    '**3. 타고난 결** — 어떤 기질이고 그것이 하루에 어떻게 나오는지.',
    strengthsAt(4, itemCount),
    frictionAt(5, itemCount),
    '**6. 일과 돈** — 어떤 판에서 힘이 나고 어떤 판에서 빠지는지. **직업 이름을 못박지 말고 조건으로 말해라.**',
    '**7. 사람 관계** — 되풀이되는 모양 하나와, 그것을 아는 것만으로 달라지는 것 하나.',
    '**8. 살림법** — 늘릴 기운 하나와 그것을 일상에서 늘리는 법 서넛, 줄일 것 하나. 억부 후보(\`analysis.eokbu\`)·없는 오행(\`analysis.elements.missing\`)·조후(\`analysis.johu\`)를 함께 보고 고른다.',
  ];

  const sections =
    selfScope === 'now' ? nowOnlySections : sectionOrder === 'nature-first' ? natureFirst : nowFirst;

  const scopeRule = selfScope === 'now' ? `${NOW_SCOPE}\n\n` : '';

  return `${scopeRule}## 낼 것

Markdown 으로 쓴다. 소제목은 \`##\` 로 단다.

${sections.join('\n\n')}

그다음에 줄을 긋고:

${PROMPT_PARTS.closing}

본문 ${min}~${max}자. 근거 칸은 분량에 넣지 않는다.`;
};

/**
 * 그 조립이 세우는 자기 풀이 절의 수 — **채점표의 눈금이 이 값이다.**
 *
 * 「빠진 절 수」 칸이 0~8로 못박혀 있었다. 네 절짜리 변형이 서는 순간 그 눈금은 잘못된
 * 것을 재고, 8을 적을 수 없는 칸에 8을 못 적었다는 사실은 기록에 남지 않는다. 세는
 * 쪽과 눈금이 **같은 값에서 나와야** 한다.
 *
 * 이 값이 채점표로 가는 것이 블라인드를 더 깎지는 않는다 — 절이 넷인지 여덟인지는
 * 붙여 넣은 출력에 이미 보인다.
 */
export const selfSectionCount = (assembly: PromptAssembly): number =>
  assembly.selfScope === 'now' ? nowOnlySections.length : 8;

const COMPAT_SECTIONS = `두 사람을 부를 이름이 자료에 없다. \`charts.a\` 를 「첫 번째 분」, \`charts.b\` 를 「두 번째 분」이라 부르고, **누구 이야기인지 문장마다 분명히 하라.** 한쪽 편을 들지 말고 **누가 읽어도 같은 글**을 써라 — 이 글은 두 사람이 같은 화면에서 함께 읽는다.

## 낼 것

Markdown 으로 쓴다. 소제목은 \`##\` 로 단다.

**1. 한 줄로** — 이 둘이 만나면 어떤 그림인지 한 문장.

**2. 서로에게 무엇인가** — 첫 번째 분이 두 번째 분을 보는 자리와 그 반대가 다르다(\`compatibility.tenGods.aSeesB\`·\`bSeesA\`). **한쪽이 다른 쪽을 뜻하지 않는다.** 그것이 일상에서 어떻게 보이는지까지.

**3. 잘 맞는 지점 셋** — 줄마다 「어디서 맞는가 → 왜 그런가 → 그래서 무엇이 쉬워지는가」.

**4. 부딪히는 지점 셋** — 줄마다 「어디서 부딪히는가 → 어떤 상황에서 터지는가 → 그때 어떻게 하는가」.

**5. 둘이 만나야 생기는 것** — \`compatibility.combinedFormations\`. 혼자서는 못 이루고 둘이 모여야 서는 구조다. 궁합의 본론이 여기다.

**6. 점수는 왜 그 자리인가** — 한 문단.

그다음에 줄을 긋고:

${PROMPT_PARTS.closing}

본문 1200~1800자. 근거 칸은 분량에 넣지 않는다.

${SCORE_SECTION}`;

/**
 * Match 자료에만 붙는 한 겹 — **없는 것을 왜 안 쓰는지 말해 준다.**
 *
 * 안 적어도 못 쓴다(자료에 없으니까). 적는 까닭은 다르다: 모델이 「자료가 부족하다」고
 * 얼버무리며 지면을 쓰는 것을 막고, 그 대신 **있는 것으로 끝까지 가게** 하려는 것이다.
 */
const MATCH_SCOPE = `## 이 자료의 범위

두 분이 서로 동의해 열린 범위만 실려 있다(\`contract.scope: "match-consent"\`). 여덟 글자와 **두 원국 사이의** 사실은 있고, 각자의 원국 하나에 대한 판정(십성·신살·신강신약·억부·조후·격국·종격·원국 안의 형충회합·운)은 **없다**(\`contract.withheld\`).

없는 것을 아쉬워하는 문장을 쓰지 마라. 「자료가 부족해 말하기 어렵다」는 이 자리에서 쓸 답이 아니다 — **있는 것으로 끝까지 가라.** 두 사람 사이의 관계와 오행 보완만으로도 쓸 것이 많다.

각자의 원국을 새로 판정하지 마라. 여덟 글자가 보인다고 해서 그 글자로 「이분은 신약하다」·「이분의 용신은 …」을 만들어 내면 **동의 범위를 넘는 것**이다.`;

const OUTPUT_CONTRACT = (kind: ReadingKind): string => `## 어떻게 낼 것인가

${
  isScored(kind)
    ? `\`score\`(${READING_POLICY.scoreRange.min}~${READING_POLICY.scoreRange.max} 정수)와 \`markdown\`(본문) 두 자리로 낸다.`
    : `자기 풀이도 **두 자리를 다 낸다.** 정확히 \`{"score": null, "markdown": "…"}\` 꼴이다 — \`score\` 를 빼거나 빈 문자열로 내지 마라. 한 사람의 풀이에 궁합 점수를 붙이지 않는다는 뜻이지 자리를 없애라는 뜻이 아니다.`
}

본문에 \`\`\`json 같은 감싸개를 두르지 마라.

**표는 쓰지 마라.** 소제목(\`##\`)·문단·목록(\`-\`)·굵게(\`**\`)·인라인 코드만 쓴다. 화면이 세우는 것이 그것뿐이라, 표를 쓰면 사용자에게는 파이프 문자가 그대로 보인다.`;

const bodyOf = (kind: ReadingKind, assembly: PromptAssembly): string => {
  const head =
    kind === 'self'
      ? assembly.selfScope === 'now'
        ? `# 역할

너는 이 사람에게 **지금 무슨 때인지 답해 주는 사람**이다. 자료를 우리말로 옮겨 적지 마라 — 그건 자료가 이미 하고 있다. 사주 전체를 읽어 주는 자리가 아니다.`
        : `# 역할

너는 이 사람의 사주를 **끝까지 읽어 주는 사람**이다. 자료를 우리말로 옮겨 적지 마라 — 그건 자료가 이미 하고 있다.`
      : `# 역할

너는 두 사람의 사주를 맞대어 읽어 주는 사람이다. 「잘 맞는다/안 맞는다」로 끝내지 마라 — **어디서 맞고 어디서 부딪히며 그때 어떻게 하는지**가 이 글의 목적이다.`;

  const sections = [
    head,
    PROMPT_PARTS.rules,
    ...(kind === 'match' ? [MATCH_SCOPE] : []),
    kind === 'self' && assembly.paragraphOrder === 'answer-first'
      ? PROMPT_PARTS.answerFirstVoice
      : PROMPT_PARTS.voice,
    // 성격을 읽는 순서는 원국 판정이 자료에 있을 때만 뜻이 있다.
    ...(kind === 'match' ? [] : [PROMPT_PARTS.personality]),
    ...assembly.extraSections,
    kind === 'self' ? selfSections(assembly) : COMPAT_SECTIONS,
    OUTPUT_CONTRACT(kind),
  ];

  return sections.join('\n\n');
};

/** kind 마다의 프롬프트 몸통 — 자료 없이. 내부 테스트 화면이 이것을 보인다 */
export const READING_PROMPTS: Record<ReadingKind, string> = {
  self: bodyOf('self', CONTROL),
  private: bodyOf('private', CONTROL),
  match: bodyOf('match', CONTROL),
};

/**
 * 실제로 보낼 것 — **이 문자열이 그대로 `Reading.prompt` 에 저장된다.**
 *
 * 자료는 뒤에 붙는다. 앞에 놓으면 긴 JSON 을 다 읽고 나서야 규칙을 만나고, 그때는
 * 이미 읽는 방식이 정해져 있다(`promptWithEvidence` 와 같은 판단).
 *
 * 「한눈에」 머리는 익명 화면과 **같은 함수**가 짓는다. 두 자리에서 지으면 언젠가
 * 갈리고, 갈리면 머리가 아래 자료와 다른 말을 한다.
 */
export function readingPromptOf(
  { kind, evidence }: ReadingEvidence,
  /**
   * 손으로 돌리는 실험만 이 자리를 쓴다. **파이프라인은 넘기지 않는다** — 기본값이
   * 곧 실제로 보내는 것이고, 그래야 「지금 보낼 프롬프트」가 정말 그것이다.
   */
  assembly: PromptAssembly = CONTROL,
): string {
  const body = assembly === CONTROL ? READING_PROMPTS[kind] : bodyOf(kind, assembly);
  const head = withSummary(body, evidence);

  const prompt = `${head}

## 자료 (${EVIDENCE_CONTRACT.version})

\`\`\`json
${JSON.stringify(evidence)}
\`\`\``;

  // 꼬리는 **자료 뒤**에 선다. 그것이 이 변형이 재려는 것이다.
  return assembly.tail === null ? prompt : `${prompt}\n\n${assembly.tail}`;
}
