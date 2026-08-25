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

const SCORE_SECTION = `## 점수

**0~100 정수 하나**를 낸다. 이 엔진은 궁합을 점수로 내지 않으므로(\`contract.scoring: "${EVIDENCE_CONTRACT.scoring}"\`) 그 숫자는 **네가 만드는 것**이다. 우리가 배점의 근거를 못 찾아서지 네가 못 하리라는 뜻이 아니다.

- 한 덩어리 느낌으로 찍지 마라. **서로 채워 주는 정도 · 부딪히는 정도 · 둘이 모여야 서는 구조** 셋을 각각 본 뒤 합쳐라.
- 관계가 **많다**는 것이 좋다는 뜻이 아니다. 충·형·해도 관계다.
- 시각을 모르는 사람이 있으면(\`compatibility.hourKnown\`) 그만큼 덜 확신하는 쪽으로 잡고, 본문에 그렇게 적어라.
- 50 을 기본값처럼 쓰지 마라. 자료가 한쪽으로 기울면 기울어진 대로 내라.

본문에는 **점수의 근거**를 한 문단으로 적되 숫자를 되풀이해 적지는 마라. 점수 자체는 본문이 아니라 따로 낸다.`;

const SELF_SECTIONS = `## 낼 것

Markdown 으로 쓴다. 소제목은 \`##\` 로 단다.

**1. 한 줄로** — 이 사람이 어떤 사람인지 한 문장. 비유를 쓸 거면 여기서만.

**2. 타고난 결** — 어떤 기질이고 그것이 하루에 어떻게 나오는지.

**3. 잘하는 것 넷** — 줄마다 「무엇을 잘한다 → 왜 그런가 → 어디에 쓰면 되는가」.

**4. 걸리는 것 셋** — 줄마다 「무엇이 문제다 → 언제 그렇게 되는가 → 그때 어떻게 하는가」.

**5. 일과 돈** — 어떤 판에서 힘이 나고 어떤 판에서 빠지는지. **직업 이름을 못박지 말고 조건으로 말해라.**

**6. 사람 관계** — 되풀이되는 모양 하나와, 그것을 아는 것만으로 달라지는 것 하나.

**7. 살림법** — 늘릴 기운 하나와 그것을 일상에서 늘리는 법 서넛, 줄일 것 하나. 억부 후보(\`analysis.eokbu\`)·없는 오행(\`analysis.elements.missing\`)·조후(\`analysis.johu\`)를 함께 보고 고른다.

**8. 지금** — 기준 시각(\`viewedAt\`)을 밝히고 지금 도는 대운·세운·월운이 무슨 때인지. 이번 달에 밀어붙일 것 하나, 미룰 것 하나까지.

그다음에 줄을 긋고:

${PROMPT_PARTS.closing}

본문 1800~2600자. 근거 칸은 분량에 넣지 않는다.`;

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
    : '`markdown`(본문) 한 자리로 낸다. `score` 는 비운다 — 한 사람의 풀이에 궁합 점수를 붙이지 않는다.'
}

본문에 \`\`\`json 같은 감싸개를 두르지 마라.

**표는 쓰지 마라.** 소제목(\`##\`)·문단·목록(\`-\`)·굵게(\`**\`)·인라인 코드만 쓴다. 화면이 세우는 것이 그것뿐이라, 표를 쓰면 사용자에게는 파이프 문자가 그대로 보인다.`;

const bodyOf = (kind: ReadingKind): string => {
  const head =
    kind === 'self'
      ? `# 역할

너는 이 사람의 사주를 **끝까지 읽어 주는 사람**이다. 자료를 우리말로 옮겨 적지 마라 — 그건 자료가 이미 하고 있다.`
      : `# 역할

너는 두 사람의 사주를 맞대어 읽어 주는 사람이다. 「잘 맞는다/안 맞는다」로 끝내지 마라 — **어디서 맞고 어디서 부딪히며 그때 어떻게 하는지**가 이 글의 목적이다.`;

  const sections = [
    head,
    PROMPT_PARTS.rules,
    ...(kind === 'match' ? [MATCH_SCOPE] : []),
    PROMPT_PARTS.voice,
    // 성격을 읽는 순서는 원국 판정이 자료에 있을 때만 뜻이 있다.
    ...(kind === 'match' ? [] : [PROMPT_PARTS.personality]),
    kind === 'self' ? SELF_SECTIONS : COMPAT_SECTIONS,
    OUTPUT_CONTRACT(kind),
  ];

  return sections.join('\n\n');
};

/** kind 마다의 프롬프트 몸통 — 자료 없이. 내부 테스트 화면이 이것을 보인다 */
export const READING_PROMPTS: Record<ReadingKind, string> = {
  self: bodyOf('self'),
  private: bodyOf('private'),
  match: bodyOf('match'),
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
export function readingPromptOf({ kind, evidence }: ReadingEvidence): string {
  const head = withSummary(READING_PROMPTS[kind], evidence);

  return `${head}

## 자료 (${EVIDENCE_CONTRACT.version})

\`\`\`json
${JSON.stringify(evidence)}
\`\`\``;
}
