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

/** 가중 비율이 실린 판인가 — 결론 규칙의 한 줄이 이것을 따른다 */
const carriesWeighted = (input: GuideScope): boolean =>
  guideFor(input).some((entry) => entry.path.endsWith('ratios') || entry.path.endsWith('partnerRatio'));

/** 경로별 뜻 목록 — 1·2판이 함께 쓴다 */
const guideLines = (input: GuideScope): string =>
  guideFor(input)
    .map((entry) => `- \`${entry.path}\` — ${entry.meaning}`)
    .join('\n');

export const matchReadingGuideBlock = (input: MatchInput): string => `## 이 자료를 읽는 법

경로마다 **무엇을 기준으로 센 값인지**가 다르다. 기준이 다른 두 값을 한 문장으로 잇지 마라.

${guideFor(input)
  .map((entry) => `- \`${entry.path}\` — ${entry.meaning}`)
  .join('\n')}

## 결론은 근거가 닿는 데까지만

- 겉글자에 없는 오행을 「그 기운이 전혀 없다」로 넓히지 마라. 「드러난 글자에는 없다」까지가 사실이다.${
  carriesWeighted(input)
    ? `
- 가중 비율이 0보다 크다는 것만으로 「속에 약하게 있다」고 판정하지 마라. 세다·약하다는 **값을 서로 견줘** 받칠 때만 쓴다.`
    : ''
}
- 합의 글자가 다 모였거나 향하는 오행이 있다고 「그 오행으로 변했다」고 쓰지 마라.
- 두 일간 사이 십성은 두 사람이 서로를 어떤 결로 받아들이기 쉬운지를 읽는 **근거**다. 실제 성격이나 감정을 정하는 값이
  아니고, 이것만으로 누가 행동하는 사람이고 누가 판단하는 사람인지 정하지 마라.
- 자료가 받치지 않는 역할·성격은 글 끝까지 유지할 것이 아니라 **쓰지 않는다.**
- 근거가 충분하면 설명하고, 제한적이면 말하는 범위를 좁히고, 부족하면 그 주장을 뺀다. 근거 없는 주장을 「~같아요」로
  부드럽게 만들어 남기지 마라.
- 자료의 내부 말(후보·시험값·자료상 같은 것)은 본문에 옮기지 않는다 — 그 대신 위 기준으로 쓸지 말지를 정한다.`;

/**
 * **주장과 근거를 먼저 잇는다** — 3라운드의 한 판(`pairWriting: 'claims-first-v1'`).
 *
 * 1·2라운드에서 남은 오류는 필드를 몰라서가 아니라 **쓰는 도중에 사람이 바뀌거나 근거 없는 역할이
 * 끼어드는** 꼴이었다. 주장마다 누구에 대한 것인지와 받치는 경로·값을 먼저 적게 하고, 본문은 그
 * 목록에서만 쓰게 한다. 목록은 사람이 안 읽고 검사가 JSON 과 맞춰 본다.
 */
export const CLAIMS_FIRST_BLOCK = `## 쓰기 전에 주장과 근거를 잇는다

응답의 \`claims\` 칸을 **본문보다 먼저** 채운다. 본문에 쓸 주장마다 한 줄이다.

- \`subject\` — 그 주장이 누구에 대한 것인가: \`첫 번째 분\`(\`charts.a\`) · \`두 번째 분\`(\`charts.b\`) · \`두 사람\`
- \`statement\` — 본문에 쓸 주장 한 문장
- \`evidence\` — 그 주장을 받치는 자료. \`path\` 는 자료 JSON 의 경로를 사람 자리(\`a\`·\`b\`)와 배열 번호까지 그대로
  적는다(예: \`compatibility.elementSupport.a.missing\` · \`compatibility.relations[13]\`). \`value\` 는 그 경로의 값을
  JSON 그대로 옮긴다. 옮기다 사람이나 방향이 바뀌면 그 주장은 버린다
- \`reach\` — 근거가 주장을 그대로 받치면 \`direct\`, 범위를 좁혀야 받치면 \`narrowed\`(그때 \`statement\` 도 좁힌 말로 쓴다)

**본문은 \`claims\` 에 있는 주장만으로 쓴다.** 목록에 없는 성격·역할·오행 판단을 본문에서 새로 만들지 마라. 근거를
댈 수 없는 주장은 목록에 올리지 말고 본문에도 쓰지 않는다. 생활 장면과 조언은 목록의 주장을 풀어 쓰는 데만 쓴다.

\`claims\` 는 사용자에게 보이지 않는다 — 본문에 이 목록이나 경로를 옮기지 마라.`;

/**
 * **읽는 법 2판 — 자료 안내는 그대로, 억제하던 지시를 걷고 해석을 돕는다**(ADR 0067 4라운드).
 *
 * 1판의 「결론은 근거가 닿는 데까지만」은 틀릴 위험을 줄이려고 **무엇을 쓰지 말지**를 쌓았다 — 역할 배정 금지,
 * 근거가 부족하면 빼기, 조건 달린 말 금지. 두 분 평가에서 그 억제는 글을 낫게 만들지 못했고, 규칙 문장이 본문
 * 해설로 새는 부작용만 남겼다.
 *
 * 2판은 둘로 나눈다.
 * - **틀리면 안 되는 것** — 사람·방향·값의 기준·합화·한 글 안의 모순. 신뢰를 지키는 최소한이고, 검사도 이것을 본다.
 * - **관계를 읽는 안내** — 어느 자료를 함께 보면 이야기가 나오는지. **정답표가 아니다** — 「편관이면 판단형」 같은
 *   대응을 두지 않고, 모델이 여러 자료를 겹쳐 종합하게 한다. 해석은 자신 있게 써도 된다.
 */
export const matchReadingGuideV2Block = (input: MatchInput): string => `## 이 자료를 읽는 법

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
- **한 글 안에서** — 앞에서 그린 두 사람의 모습을 뒤에서 반대로 그리지 않는다.

## 관계를 읽는 안내

아래는 **정답표가 아니라 어디를 함께 보면 이야기가 나오는지**에 대한 안내다. 한 값에서 성격을 곧바로 끌어내지
말고 여러 자료를 겹쳐 네가 종합해서 읽어라. 그렇게 읽은 해석은 **자신 있게** 써도 된다 — 문장마다 조건이나 단서를
달지 않는다.

- **서로에게 끌리는 지점** — 합·반합·방합이 누구의 어느 자리끼리 닿는지와, 두 일간이 서로를 무엇으로 보는지를 함께
  본다. 첫 번째 분이 두 번째 분의 어떤 모습에 끌리는지와 그 반대가 같지 않다는 데서 이야기가 시작된다.
- **같은 행동이 다르게 읽히는 순간** — 한 사람이 상대를 받아들이는 결과 반대쪽의 결이 다르면, 같은 말과 행동이 한쪽에는
  믿음직함으로, 다른 쪽에는 부담으로 닿을 수 있다. 어떤 장면에서 그 어긋남이 생기는지 찾아라.
- **가장 크게 부딪히는 곳** — 충·형·해·파가 가장 가까운 자리(일간·일지)에 걸렸는지 바깥 자리에 걸렸는지에 따라 다툼의
  무게와 주제가 달라진다. 형은 어느 쪽에서 어느 쪽으로 향하는지까지 장면에 담는다.
- **함께 사는 생활** — 오행 보완은 둘이 함께 있을 때 무엇이 채워지고 무엇이 계속 비는지를 보여 준다. 연락·돈·집안일·
  일정처럼 되풀이되는 생활에서 그것이 어떤 모습일지 그려라.
- **한 글자를 둘러싼 여러 끌림** — 쟁합은 한 사람의 글자를 상대의 여러 글자가 함께 당긴다는 사실이다. 다른 자료와 함께
  두 사람 사이에서 어떤 모습일지 판단한다. 자료에 없는 제3자를 끌어오지 않는다.
- **틀어진 뒤 다시 이어지는 법** — 앞의 끌림과 부딪힘을 같이 놓고, 두 사람이 무엇으로 다시 가까워지는지 쓴다.

\`## 두 사람은 무슨 사이인가\` 에 맞는 장면을 고른다. **이 두 사람에게만 해당하는 구체적인 장면**일수록 좋다 — 누구에게나
붙는 일반론과 같은 조언의 되풀이는 줄인다.

## 본문에 옮기지 않는 것

자료 경로와 필드 이름, 그리고 「후보」「시험값」「자료상」 같은 검토용 말은 본문에 쓰지 않는다. 값의 기준을 설명하는 말
(「겉글자 기준이라」「합화는 아니지만」)은 **맨 끝 근거 칸에만** 적고, 본문은 그 기준 안에서 바로 말한다.`;

/**
 * **읽는 법 3판 — 관계 질문을 목차가 아니라 고르는 안내로**(ADR 0067 5라운드).
 *
 * 4라운드 글의 소제목이 2판 「관계를 읽는 안내」 여섯 줄을 차례대로 따라갔다 — 안내가 목차가 됐다. 3판은 **이 두
 * 사람에게서 두드러지는 이야기 두세 개를 고르는** 안내로 바꾼다. 자료 안내와 「틀리면 안 되는 것」은 2판과 같고,
 * 시각을 모르는 쪽의 반쪽 합 규칙을 여기로 옮긴다(공통 규칙에서는 뺐다).
 */
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

export const matchReadingGuideV3Block = (
  input: GuideScope,
  absorptionRule: string,
  /** 4판 — 글을 나누는 법을 함께 싣는다 */
  structured = false,
): string => {
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

- 합·반합·방합이 **누구의 어느 자리끼리** 닿는지, 두 일간이 서로를 무엇으로 보는지 — ${structured ? '누가 누구 쪽으로 먼저 다가가고 어디서 가까워지는지' : '끌림이 어느 쪽에서 어떻게 시작되는지'}
- 한 사람이 상대를 받아들이는 결과 반대쪽의 결이 다른 곳 — 같은 말과 행동이 한쪽에는 믿음직함으로, 다른 쪽에는 부담으로 닿는 순간
- 충·형·해·파가 **가장 가까운 자리**에 걸렸는지 바깥 자리에 걸렸는지, 형이 **어느 쪽에서 어느 쪽으로** 향하는지 — 다툼의 무게와 주제
- 오행 보완에서 채워지는 것과 계속 비는 것 — 함께 사는 생활
- 쟁합 — 한 사람의 글자를 상대의 여러 글자가 함께 당기는 모습. 자료에 없는 제3자는 끌어오지 않는다
- ${structured ? '가까워지는 곳과 부딪히는 곳이' : '끌림과 부딪힘이'} **같은 자리에 겹치는** 곳 — 틀어진 뒤 무엇으로 다시 이어지는지${
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
${structured ? `\n${MATCH_STRUCTURE_BLOCK}\n` : ''}
## 본문에 옮기지 않는 것

자료 경로와 필드 이름, 그리고 「후보」「시험값」「자료상」「자료 밖」 같은 검토용 말은 본문에 쓰지 않는다. 값의 기준을
설명하는 말(「겉글자 기준이라」「합화는 아니지만」)은 **맨 끝 근거 칸에만** 적고, 본문은 그 기준 안에서 바로 말한다.`;
};
