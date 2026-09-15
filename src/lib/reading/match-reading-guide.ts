import type { MatchInput } from '../saju/evidence/shared';

/**
 * **인연 궁합 자료를 읽는 법** — 경로마다 무엇을 기준으로 센 값인가(ADR 0067).
 *
 * 엔진 주석에만 있던 뜻을 모델이 못 받아서 두 가지를 잘못 읽었다 — 겉글자에 없는 오행을 「그 기운이
 * 전혀 없다」로, 합의 글자가 다 모인 것을 「그 오행으로 변했다」로. 주석을 파싱하지 않고 여기 한
 * 벌을 둔다. 프롬프트가 이 목록을 그대로 싣고, 시험이 경로가 그 판의 JSON 에 실제로 있는지 잰다.
 *
 * 엔진(`src/lib/saju`)에 두지 않는 것은 ADR 0047 때문이다 — 엔진은 모델에게 말을 걸지 않는다.
 */
/**
 * 안내가 설명하는 **자료 범위** — 인연 궁합의 판, 또는 비공개 궁합(두 원국 전체 판정을 싣는다).
 */
export type GuideScope = MatchInput | 'private';

export type GuideEntry = {
  /** JSON 경로 — 사람 자리는 `*`, 배열 칸은 `[]` */
  readonly path: string;
  readonly meaning: string;
  /** 이 경로가 실리는 범위 */
  readonly inputs: readonly GuideScope[];
};

const BOTH = ['limited-v1', 'extended-v1', 'private'] as const;
const EXTENDED = ['extended-v1', 'private'] as const;
const PRIVATE_ONLY = ['private'] as const;

export const MATCH_READING_GUIDE: readonly GuideEntry[] = [
  {
    path: 'compatibility.elementSupport.*.missing',
    meaning: '그 사람의 **겉으로 드러난 글자**(시간을 모르면 여섯 글자)에 한 번도 안 나오는 오행. 지장간은 세지 않는다',
    inputs: BOTH,
  },
  {
    path: 'compatibility.elementSupport.*.supplied',
    meaning: '`missing` 가운데 상대의 겉글자에 있는 오행',
    inputs: BOTH,
  },
  {
    path: 'compatibility.elementSupport.*.stillMissing',
    meaning: '`missing` 가운데 상대의 겉글자에도 없는 오행',
    inputs: BOTH,
  },
  {
    path: 'compatibility.elementSupport.*.weakest.element',
    meaning: '그 사람의 **지장간 가중 점수**가 가장 낮은 오행 이름. 비율이 아니고, 겉글자 개수 기준도 아니다 — 겉글자에 있어도 가장 약할 수 있다',
    inputs: EXTENDED,
  },
  {
    path: 'compatibility.elementSupport.*.weakest.partnerRatio',
    meaning: '위 오행이 **상대의** 지장간 가중 분포에서 차지하는 비율(0~1). 그 사람 자신의 비율이 아니다',
    inputs: EXTENDED,
  },
  {
    path: 'compatibility.eokbuMatch.*.element',
    meaning: '그 사람의 억부 관점에서 엔진이 고른 오행. 억부 하나만 본 값이라 조후·격국·종격은 반영되지 않았다(`unresolved`)',
    inputs: EXTENDED,
  },
  {
    path: 'compatibility.eokbuMatch.*.role',
    meaning: '그 오행이 그 사람 일간에게 무엇인가',
    inputs: EXTENDED,
  },
  {
    path: 'compatibility.eokbuMatch.*.presentInPartner',
    meaning: '그 오행이 **상대의 겉글자에** 있는가',
    inputs: EXTENDED,
  },
  {
    path: 'compatibility.eokbuMatch.*.partnerRatio',
    meaning: '그 오행이 **상대의** 지장간 가중 분포에서 차지하는 비율(0~1). `presentInPartner` 가 거짓이어도 0보다 클 수 있다 — 겉글자와 지장간은 다른 기준이다',
    inputs: EXTENDED,
  },
  {
    path: 'charts.*.analysis.elements.counts',
    meaning: '그 사람 겉글자의 오행 개수(지지는 본기 하나로 센다)',
    inputs: EXTENDED,
  },
  {
    path: 'charts.*.analysis.elements.ratios',
    meaning: '그 사람의 지장간 가중 비율(합 1). 월지에 배수가 걸린다',
    inputs: EXTENDED,
  },
  {
    path: 'charts.*.analysis.elements.strongest',
    meaning: '그 사람의 지장간 가중 점수가 가장 높은 오행 이름',
    inputs: EXTENDED,
  },
  {
    path: 'charts.*.analysis.elements.weakest',
    meaning: '그 사람의 지장간 가중 점수가 가장 낮은 오행 이름(문자열)',
    inputs: EXTENDED,
  },
  {
    path: 'charts.*.analysis.elements.missing',
    meaning: '그 사람의 겉글자에 없는 오행',
    inputs: EXTENDED,
  },
  {
    path: 'charts.*.analysis.strength.verdict',
    meaning: '엔진이 기준 셋(`criteria`)으로 낸 일간 강약 판정. 기준을 어떻게 세느냐에 따라 달라지는 판정이다',
    inputs: EXTENDED,
  },
  {
    path: 'charts.*.analysis.eokbu.presentInChart',
    meaning: '억부 관점의 오행이 그 사람 자신의 겉글자에 있는가',
    inputs: EXTENDED,
  },
  {
    path: 'compatibility.relations[].full',
    meaning: '그 관계를 이루는 글자가 다 모였는가. **합이 그 오행으로 변했다(합화)는 판정이 아니다** — 합화에는 따로 조건이 필요하고 엔진은 그것을 판정하지 않는다',
    inputs: BOTH,
  },
  {
    path: 'compatibility.relations[].targetElement',
    meaning: '합이 성사되면 향하는 오행. 그 오행이 되었다는 뜻이 아니다',
    inputs: BOTH,
  },
  {
    path: 'compatibility.relations[].contested',
    meaning: '한 글자를 여러 합이 함께 문다는 사실. 그래서 합이 깨졌다거나 약해졌다는 판정은 들어 있지 않다',
    inputs: BOTH,
  },
  {
    path: 'compatibility.relations[].direction',
    meaning: '형이 어느 글자에서 어느 글자로 향하는가',
    inputs: BOTH,
  },
  {
    path: 'compatibility.tenGods.aSeesB',
    meaning: '`charts.a` 의 일간을 기준으로 `charts.b` 의 일간이 무엇인가 — 두 일간 글자의 생극과 음양만 본 값',
    inputs: BOTH,
  },
  {
    path: 'compatibility.tenGods.bSeesA',
    meaning: '`charts.b` 의 일간을 기준으로 `charts.a` 의 일간이 무엇인가',
    inputs: BOTH,
  },
  {
    path: 'charts.*.relations',
    meaning: '그 사람 **원국 안에서** 닫힌 관계. 두 사람 사이의 관계(`compatibility.relations`)와 다르다',
    inputs: PRIVATE_ONLY,
  },
  {
    path: 'charts.*.sinsal.stars[].basis',
    meaning: '그 신살을 판정할 때 **기준으로 삼은** 글자. 신살이 걸린 자리가 아니다',
    inputs: PRIVATE_ONLY,
  },
  {
    path: 'charts.*.sinsal.stars[].hits',
    meaning: '그 신살이 **실제로 걸린** 자리(기둥·천간/지지/기둥 전체)',
    inputs: PRIVATE_ONLY,
  },
  {
    path: 'charts.*.now',
    meaning: '기준 시각(`viewedAt`)에 도는 대운·세운·월운과 그 운이 원국과 맺는 관계. 그 시기에 새로 걸린 것이지 타고난 구조가 아니다',
    inputs: PRIVATE_ONLY,
  },
];

export const guideFor = (input: GuideScope): readonly GuideEntry[] =>
  MATCH_READING_GUIDE.filter((entry) => entry.inputs.includes(input));

/** 경로별 뜻 목록 */
const guideLines = (input: GuideScope): string =>
  guideFor(input)
    .map((entry) => `- \`${entry.path}\` — ${entry.meaning}`)
    .join('\n');

/**
 * **글을 나누는 법 — 4판에서 더한 구성 기준**(2026-09-15, 사용자가 5라운드 글을 읽고 정함).
 *
 * 3판의 「이야기 두세 개를 골라 깊게」가 소제목까지 두세 개로 줄여, 한 절에 돈·처리 방식·서운함·생활 규칙·회복이
 * 한꺼번에 들어갔다. 고르는 이야기 수와 읽는 단위는 다르다.
 */
export const MATCH_STRUCTURE_BLOCK = `## 글을 나누는 법

핵심 이야기를 두세 개로 고른다고 **소제목까지 두세 개로 줄이지 않는다.** 해석의 중심은 고른 이야기에 두고, 읽는 단위는
충분히 나눈다 — 읽다가 멈춰도 관심 있는 대목을 다시 찾을 수 있어야 한다.

- **소제목은 4~5개를 기본으로**, 실제 내용에 맞게 나눈다. 서로 다른 이야기를 한 절에 몰아넣지 않는다.
- **소제목은 그 절의 구체적인 특징을 드러낸다.** 추상적인 낱말을 나란히 놓지 말고, 그 절에서 벌어지는 장면이나 마음이
  보이는 말로 단다.
- **한 문단에는 한 장면이나 한 주장.** 해석에서 조언으로 넘어갈 때는 문단을 나눈다.
- **감정과 생활 장면을 먼저 쓴다.** 어느 자리가 어떻게 걸렸는지 같은 계산 구조 설명은 필요할 때 뒤에 짧게 붙인다.
- **같은 설명을 여러 절에서 되풀이하지 않는다.** 절이나 문단 첫머리에 앞과 억지로 잇는 연결어를 두지 않는다.
- **모든 절에 조언을 붙이지 않는다.** 조언은 실제로 도움이 되는 자리에만 둔다.`;

/**
 * **읽는 법 4판** — 두 궁합의 운영 지시(ADR 0067). 경로별 뜻은 그 범위에 실린 것만 싣는다.
 *
 * 1~3판과 주장·근거 연결판(3라운드)은 실험을 닫으며 지웠다. 그 프롬프트는 커밋 `e586152` 에서 재현한다.
 */
export const pairReadingGuideBlock = (input: GuideScope, absorptionRule: string): string => {
  const personal = input === 'private';
  return `## 이 자료를 읽는 법

경로마다 **무엇을 기준으로 센 값인지**가 다르다.

${guideLines(input)}

## 틀리면 안 되는 것

해석은 자유롭게 하되, 아래를 틀리면 두 분이 자기 명식과 대 보는 순간 글 전체를 믿지 않게 된다.

- **사람** — \`a\` 는 첫 번째 분, \`b\` 는 두 번째 분이다. \`aSeesB\` 는 첫 번째 분 쪽에서 본 값이고 \`bSeesA\` 는 그 반대다.
  문장마다 누구 이야기인지 바뀌지 않게 쓴다.
- **방향** — 형의 \`direction\` 은 \`from\` 에서 \`to\` 로 향한다. 거꾸로 옮기지 않는다.
- **값의 기준** — 겉글자 개수로 센 값과 지장간 가중 비율을 한 값처럼 섞지 않는다. 겉글자에 없다는 것을 그 기운이
  아예 없다는 말로 바꾸지 않는다.
- **합** — 합의 글자가 다 모였다는 것은 그 오행으로 변했다는 뜻이 아니다.
- **한 사람의 모습** — 글 앞에서 그린 한 사람의 모습을 뒤 절이나 한 줄 요약에서 반대로 그리지 않는다.${
  personal
    ? `
- **원국 안과 두 사람 사이** — \`charts.*.relations\` 는 한 사람 원국 안의 관계이고 \`compatibility.relations\` 는 두 사람 사이의
  관계다. 한쪽 원국 안의 일을 두 사람 사이의 일로 옮기지 않는다.
- **기준과 걸린 자리** — 신살의 \`basis\` 는 판정에 쓴 글자이고 \`hits\` 가 실제로 걸린 자리다.
- **때** — \`charts.*.now\` 의 운에서 새로 걸린 것은 그 시기의 일이고, 원국의 관계는 타고난 구조다. 섞지 않는다.`
    : ''
}
- ${absorptionRule}

## 이 두 사람에게서 두드러지는 이야기를 고른다

아래는 **다 답해야 하는 목차가 아니다.** 자료를 겹쳐 보고 이 두 사람에게서 **유난히 두드러지는 이야기 두세 개**를
골라 깊게 써라. 두드러지지 않는 것은 짧게 지나거나 쓰지 않아도 된다.

어디를 보면 이야기가 나오는지:

- 합·반합·방합이 **누구의 어느 자리끼리** 닿는지, 두 일간이 서로를 무엇으로 보는지 — 누가 누구 쪽으로 먼저 다가가고 어디서 가까워지는지
- 한 사람이 상대를 받아들이는 결과 반대쪽의 결이 다른 곳 — 같은 말과 행동이 한쪽에는 믿음직함으로, 다른 쪽에는 부담으로 닿는 순간
- 충·형·해·파가 **가장 가까운 자리**에 걸렸는지 바깥 자리에 걸렸는지, 형이 **어느 쪽에서 어느 쪽으로** 향하는지 — 다툼의 무게와 주제
- 오행 보완에서 채워지는 것과 계속 비는 것 — 함께 사는 생활
- 쟁합 — 한 사람의 글자를 상대의 여러 글자가 함께 당기는 모습. 자료에 없는 제3자는 끌어오지 않는다
- 가까워지는 곳과 부딪히는 곳이 **같은 자리에 겹치는** 곳 — 틀어진 뒤 무엇으로 다시 이어지는지${
  personal
    ? `
- 각자의 원국 판정(강약·억부·오행 세력)이 **두 사람 사이에서** 어떻게 맞물리는지 — 한 사람씩 따로 풀지 않는다
- 지금 두 사람에게 도는 운이 이 관계에 어떤 시기를 만드는지 — 언제를 기준으로 한 말인지 밝힌다`
    : ''
}

해석은 여러 자료를 겹쳐 네가 종합한다. 한 값에서 성격을 곧바로 끌어내지 말고, 그렇게 종합한 해석은 **자신 있게**
쓴다 — 문장마다 조건이나 단서를 달지 않는다.

**이 두 사람에게만 해당하는 장면**일수록 좋다. 연락 규칙이나 답할 시각 정하기처럼 **어느 두 사람에게나 붙는 조언은
한 번 넘게 쓰지 않는다.**

${MATCH_STRUCTURE_BLOCK}

## 본문에 옮기지 않는 것

자료 경로와 필드 이름, 그리고 「후보」「시험값」「자료상」「자료 밖」 같은 검토용 말은 본문에 쓰지 않는다. 값의 기준을
설명하는 말(「겉글자 기준이라」「합화는 아니지만」)은 **맨 끝 근거 칸에만** 적고, 본문은 그 기준 안에서 바로 말한다.`;
};
