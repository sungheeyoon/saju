import { CONTROL, type PromptAssembly } from './prompt';

/**
 * **손으로 돌리는 실험판** — 실제 생성에는 쓰지 않는다.
 *
 * ## 규칙 셋
 *
 * 1. **변형은 control 에서 하나만 벗어난다.** 둘을 함께 바꾸면 이긴 변형이 무엇 덕에
 *    이겼는지 알 수 없다. 못 지키는 변형은 `confounded` 에 무엇이 함께 움직였는지
 *    적는다 — **시험이 조립 칸 수를 세므로** 안 적으면 통과하지 못한다.
 * 2. **서로 쌓지 않는다.** 변형들은 형제이지 계단이 아니다.
 * 3. **판본을 사칭하지 않는다.** 실험 id 는 `READING_POLICY.version` 과 따로 산다.
 *
 * ## 이 판이 재려는 것이 바뀌었다
 *
 * 앞 기준판은 네 절로 줄이고 판정 이름을 전부 숨겼다. 그 결과 개인 사주에서 가장
 * 궁금한 일·돈·연애·귀인과 대운의 맥락이 사라지고, 생활 코칭만 남았다.
 *
 * 기준판은 개인 사주가 답해야 할 축들을 다시 열고(`expert-v3`), 그 위에 먼저 볼 셋을
 * 요약으로 얹었다. 옛 여덟 절은 길이와 구조를 견줄 실험판으로만 남긴다.
 */

/** 자료 뒤에 서는 꼬리 — **새 지시가 아니라 제출 전 확인이다.** */
const RECENCY_CHECK = `## 제출 전 확인

위 자료를 다 읽었으면 아래를 하나씩 확인하고 내라. **여기서 새로 정하는 규칙은 없다** —
앞에서 이미 정한 것을 빠뜨리지 않았는지만 본다.

- 아홉 절을 모두 썼는가 — 맨 앞 요약 셋을 빠뜨리지 않았는가
- 사용자 본문에 생한자나 한국어가 아닌 외국 문자가 없는가
- 귀인·신살은 자료에 실제로 있는 것만 이름을 밝혔는가
- 일·돈·연애와 대운·세운·월운을 빠뜨리지 않았는가
- 확실한 장점까지 완충해서 흐리지 않았는가
- 해석보다 생활 과제가 많아지지 않았는가
- 다른 사람에게 그대로 붙여도 맞는 문장을 지웠는가
- 검사용 근거 절이 절마다 한 줄씩 있는가`;

export type PromptVariantId =
  | 'control'
  | 'no-yongsin-v1'
  | 'longer-v1'
  | 'annotated-terms-v1'
  | 'recency-check-v1';

export type PromptVariant = {
  readonly id: PromptVariantId;
  readonly label: string;
  /** control 에서 **무엇 하나가** 달라졌는가 */
  readonly changes: string;
  /**
   * 한 곳만 바꾼 것이 **아닐 때** 무엇이 함께 움직였는지 — 아니면 `null`.
   *
   * 적어 두는 것은 면제가 아니라 **읽는 법**이다. 여기 문장이 있는 변형의 승패는
   * 「무엇 덕에」를 못 말하므로, 이겨도 그대로 합치지 않는다.
   */
  readonly confounded: string | null;
  readonly assembly: PromptAssembly;
};

export const PROMPT_VARIANTS: readonly PromptVariant[] = [
  {
    id: 'control',
    label: '기준판',
    changes: '실제로 보내는 것 그대로 — 요약 절을 앞세운 아홉 절, 5000~9000자, 한국어 상담 말투.',
    confounded: null,
    assembly: CONTROL,
  },
  {
    id: 'longer-v1',
    label: '더 길게',
    changes: '같은 뼈대에 분량만 5000~9000에서 8500~11000자로. 깊이를 더 낼 자리를 준다.',
    confounded: null,
    assembly: { ...CONTROL, selfLength: { min: 8500, max: 11000 } },
  },
  {
    id: 'recency-check-v1',
    label: '자료 뒤 확인 목록',
    changes: '자료 뒤에 제출 전 확인 목록을 붙인다. 규칙은 하나도 더하지 않는다.',
    confounded: null,
    assembly: { ...CONTROL, tail: RECENCY_CHECK },
  },
  {
    id: 'annotated-terms-v1',
    label: '이름을 달아 부른다 (앞 기준판)',
    changes:
      '기준판이 이름을 안 부르는 판으로 올라가기 전의 벌. 전문용어를 「뜻 → 장면 → (이름)」 차례로 본문에 단다 — 무엇이 없어지는지를 견줄 짝이다.',
    /**
     * **가드를 절 단위로 조이자 이 변형이 걸렸다.** 조립 칸은 `terminology` 하나인데
     * 그 한 칸이 **절 여섯의 본문을 다시 쓴다.** `changes` 는 「절과 본보기가 함께
     * 바뀐다」고 이미 적고 있었는데 이 칸만 비어 있었다 — 산문이 적은 것을 값이 안 들고
     * 있었다.
     */
    confounded:
      '용어 판을 바꾸면 절 여섯의 본문이 함께 다시 쓰인다. 이 짝이 이겨도 용어 규칙 탓인지 다시 쓴 절 탓인지 이 라운드는 답하지 않는다.',
    assembly: { ...CONTROL, terminology: 'annotated' },
  },
  {
    id: 'no-yongsin-v1',
    label: '용신 계열을 안 읽힌다 (앞 기준판)',
    changes:
      '기준판이 `expert-v4` 로 올라가기 전의 뼈대(`expert-v3`). 세 절(성격·강점·조심할 점)이 버틸 힘·격국·억부·조후·대조를 안 읽는다 — 무엇이 없어지는지를 견줄 짝이다.',
    confounded:
      '한 조립 칸(`selfPresentation`) 안에서 **절 셋이 함께 움직인다.** 이 짝이 이겨도 셋 중 무엇 탓인지 이 라운드는 답하지 않는다 — 되돌릴 때는 셋을 한 덩어리로 되돌리거나, 쪼개서 다시 재야 한다.',
    assembly: { ...CONTROL, selfPresentation: 'expert-v3' },
  },
];

export type PairVariantId = 'control' | 'pair-sections-v1';

/** 같은 계약을 쓰되 id 만 갈린다 — 재는 축이 다르므로 목록도 다르다 */
export type PairVariant = Omit<PromptVariant, 'id'> & { readonly id: PairVariantId };

/**
 * **비공개 궁합 변형** — 위 목록과 갈라 둔다.
 *
 * 한 목록으로 묶으면 자기 풀이 변형(`no-yongsin-v1`·`longer-v1`…)까지 궁합으로 부르게
 * 되는데, 그것들은 궁합 프롬프트를 **한 글자도 안 바꾼다.** 그러면 돈을 내고 같은 글을
 * 두 번 받으면서 「변형을 쟀다」고 적히는 자리가 생긴다. 재는 축이 다르면 목록도 다르다
 * — `compatLength` 를 `selfLength` 에서 갈라 둔 것과 같은 판단이다.
 *
 * ## 1라운드가 알아낸 것 — **도구가 그 자리에 안 닿았다**
 *
 * P1(`pair-precedence-v1`)을 한 번 불렀다. 표본 두 사람 다 `조후` 에서 갈리는데도 두
 * 판의 10절에 **없앨 모순 자체가 없었다.** 까닭은 표본이 아니라 겨냥이다 —
 * `precedence` 가 서열을 매기는 다섯은 전부 「무엇을 쓸 것인가」(용신)에 대한 답인데,
 * 10절은 **「반복하는 모양·서운할 때의 반응·표현하는 속도」**를 묻는다. 절은 맞게
 * 골랐고 **내용을 잘못 골랐다.**
 *
 * 그래서 **더 돌리지 않는다.** 안 닿는 지시는 몇 번을 돌려도 안 닿고, 반복해서 얻는
 * 것은 「생성 변동성이 이만큼이다」 하나인데 그건 이미 아는 것이다.
 *
 * 그 라운드에서 참으로 드러난 것은 따로 있다. **두 판 다 이 명식이 아니어도 맞는
 * 글이었다** — 재성이 가장 무겁다는 것도, 신약이라는 것도 글에 안 닿았다. 자기 풀이
 * 확인 목록에는 이미 그 줄이 있다(「다른 사람에게 그대로 붙여도 맞는 문장을 지웠는가」).
 * 궁합 10절에는 그 자가 없었다.
 *
 * ## 2라운드가 묻는 것 하나
 *
 * **10절이 이 사람 것을 쓰는가.** P2(`pair-named-v1`)가 그 물음에 실제로 답하는
 * 판정(강약·십성 무게·관계·뿌리)을 지목한다.
 *
 * ## 부르기 전에 무엇을 볼지 적어 둔다
 *
 * 읽고 나서 기준이 생기면 그것은 측정이 아니라 감상이다. 10절만 놓고 넷을 본다.
 *
 * 1. **이 사람 것인가** — 두 사람 묘사를 서로 바꿔 놓아도 말이 되면 진 것이다. 이번
 *    라운드의 값이 여기 있다
 * 2. **자료가 글에 닿았는가** — 유난히 튀는 것(무거운 십성·비어 있는 자리·부딪히는
 *    자리)이 장면으로 나오는가, 아니면 여전히 상담 총평인가
 * 3. **지어낸 심리 서사가 늘었는가** — 자료를 지목시키면 모델이 그 위에 이야기를 더
 *    얹을 수 있다. 계약 검사는 이것을 **못 잡는다**(경로·금지어·비밀값까지가 그 자의
 *    사정거리다). 사람이 읽어야 한다
 * 4. 분량이 계약 안에 남는가 (`compatLength.private`)
 *
 * **세 판을 나란히 놓고 읽는다** — 아무것도 안 시킨 판(P0) · 엉뚱한 것을 시킨 판(P1) ·
 * 맞는 것을 시킨 판(P2). P1 이 목록에 남아 있는 까닭이 이것이다: 「안 시킨 것」과
 * 「시켰는데 안 닿은 것」이 같아 보이면, P2 가 이겨도 무엇 덕인지 흐려진다.
 *
 * ## 두 실험판을 **서로** 견줄 때 하나가 섞인다 — 붙는 문단의 분량
 *
 * P1 과 P2 는 둘 다 10절에 대여섯 줄을 더한다. 지시가 늘면 글이 길고 자세해지므로,
 * **P2 가 P1 을 이겨도 「지목한 덕」인지 「더 시킨 덕」인지 이 라운드는 답하지 않는다.**
 *
 * 그런데 이 라운드가 묻는 것은 그 우열이 아니다. **P0 대비 「이 사람 것인가」가
 * 달라졌는가**이고, 그 축은 분량으로 설명되지 않는다 — 길게 쓴다고 두 사람 묘사를
 * 서로 바꿔 놓을 수 없게 되지는 않는다. 그 자리를 본다.
 *
 * 이것을 변형의 `confounded` 에 안 적는다. 그 칸은 **한 변형 안에서** 무엇이 함께
 * 움직였는지를 적는 자리이고, 둘 다 칸도 절도 하나만 옮긴다 — 시험이 그것을 센다.
 */
export const PAIR_VARIANTS: readonly PairVariant[] = [
  {
    id: 'control',
    label: '기준판 (P0)',
    changes: '지금 실제로 나가는 비공개 궁합 그대로. 10절이 갈린 판정을 스스로 고른다.',
    confounded: null,
    assembly: CONTROL,
  },
  {
    id: 'pair-sections-v1',
    label: '절 열하나로 시킨다 (앞 기준판)',
    changes:
      '기준판이 절을 걷어내기 전의 벌. 우리가 정한 절 열하나와 「성격을 읽는 순서」가 서고, 무엇을 어느 절에 쓸지를 절마다 시킨다 — 무엇이 없어지는지를 견줄 짝이다.',
    confounded:
      '절 목록과 「성격을 읽는 순서」가 함께 움직인다. 이 짝이 이겨도 「절이 있어서」인지 「읽는 순서를 시켜서」인지 이 라운드는 답하지 않는다.',
    /* 운영 기본값이 궁합 읽는 법 4판으로 옮겨 가도 이 옛 판은 옛 조각으로 재현한다 */
    assembly: { ...CONTROL, pairShape: 'sections-v1', pairReading: 'plain-v1' },
  },
];

export type MatchInputVariantId =
  | 'match-limited-v1'
  | 'match-extended-v1'
  | 'match-limited-v2'
  | 'match-extended-v2'
  | 'match-limited-direct-v3'
  | 'match-limited-claims-v3'
  | 'match-limited-guide2-v4'
  | 'match-limited-guide3-v5';

/**
 * **인연 궁합 입력 두 판** — 자료를 많이 넣는 쪽이 낫다고 가정하지 않고 견준다(ADR 0067).
 *
 * 위 두 목록과 규칙 1(「하나만 벗어난다」)을 **못 지킨다.** 확장형은 자료를 더하는 것만으로
 * 끝나지 않는다 — 점수표가 새 근거를 가리키고, 범위 절이 그 판정을 어떻게 쓸지 말해야
 * 한다. 그래서 무엇이 함께 움직였는지를 값으로 든다(`promptChanges`). 결과를 「필드만
 * 더한 효과」로 읽지 않는다.
 *
 * **둘 다 실험판이다.** 운영은 옛 컷(`legacy-v0`)이고, 이 목록의 어느 쪽도 운영판이 아니다.
 *
 * 두 판이 **같이 쓰는 것**: 기준점 계산(`previewScoreOf`)·조정 상한·재량 폭·분량·모델·
 * 생성 설정·말투·출력 계약. `assembly` 가 `matchInput` 한 칸만 다르다.
 */
export type MatchInputVariant = {
  readonly id: MatchInputVariantId;
  /** 몇 번째 비교인가 — 한 라운드의 두 판만 견준다 */
  readonly round: 1 | 2 | 3 | 4 | 5;
  readonly label: string;
  readonly assembly: PromptAssembly;
  /** 제한형에 **더해진** 자료 경로 — 제한형은 빈 목록이다 */
  readonly addedEvidence: readonly string[];
  /** 자료와 함께 **바뀐 지시** — 비교를 읽을 때 같이 적는다 */
  readonly promptChanges: readonly string[];
};

export const MATCH_INPUT_VARIANTS: readonly MatchInputVariant[] = [
  {
    id: 'match-limited-v1',
    round: 1,
    label: 'A 제한형',
    assembly: { ...CONTROL, matchInput: 'limited-v1', pairReading: 'plain-v1', pairWriting: 'direct-v1' },
    addedEvidence: [],
    promptChanges: [],
  },
  {
    id: 'match-extended-v1',
    round: 1,
    label: 'B 확장형 (실험 전용)',
    assembly: { ...CONTROL, matchInput: 'extended-v1', pairReading: 'plain-v1', pairWriting: 'direct-v1' },
    addedEvidence: [
      'charts.*.analysis.elements',
      'charts.*.analysis.strength',
      'charts.*.analysis.eokbu',
      'compatibility.elementSupport.*.weakest',
      'compatibility.eokbuMatch',
      'compatibility.relations[].contested (원국 안 경쟁자)',
    ],
    promptChanges: [
      '점수표에 「용신을 상대가 가졌다 | eokbuMatch | +1~+3」 줄이 선다',
      '범위 절이 실린 판정(신강신약·억부 후보·오행 세력)을 사이 설명의 근거로만 쓰고 이름은 본문에 안 쓰라고 말한다',
    ],
  },
  /**
   * **2라운드** — 1라운드 두 판에 읽는 법과 결론 규칙을 얹는다(`pairReading: 'guide-v1'`).
   *
   * 1라운드 변형은 지우지 않는다 — 그 프롬프트 해시로 지난 실호출을 재현한다. 2라운드는 **읽는 법과
   * 문체 지시가 함께 바뀐다**(`promptChanges`). 좋아져도 어느 하나의 효과로 읽지 않는다.
   */
  {
    id: 'match-limited-v2',
    round: 2,
    label: 'A 제한형 + 읽는 법',
    assembly: { ...CONTROL, matchInput: 'limited-v1', pairReading: 'guide-v1' },
    addedEvidence: [],
    promptChanges: ['「이 자료를 읽는 법」(판에 실린 경로만)', '「결론은 근거가 닿는 데까지만」 규칙'],
  },
  {
    id: 'match-extended-v2',
    round: 2,
    label: 'B 확장형 + 읽는 법 (실험 전용)',
    assembly: { ...CONTROL, matchInput: 'extended-v1', pairReading: 'guide-v1' },
    addedEvidence: [
      'charts.*.analysis.elements',
      'charts.*.analysis.strength',
      'charts.*.analysis.eokbu',
      'compatibility.elementSupport.*.weakest',
      'compatibility.eokbuMatch',
      'compatibility.relations[].contested (원국 안 경쟁자)',
    ],
    promptChanges: [
      '점수표에 「용신을 상대가 가졌다 | eokbuMatch | +1~+3」 줄이 선다',
      '범위 절이 실린 판정을 사이 설명의 근거로만 쓰고 이름은 본문에 안 쓰라고 말한다 — 「시험값이라 단정하지 않는다」는 뺐다',
      '「이 자료를 읽는 법」(판에 실린 경로만)',
      '「결론은 근거가 닿는 데까지만」 규칙',
    ],
  },
  /**
   * **3라운드** — A 제한형(+읽는 법)을 기준으로 **쓰는 방식만** 견준다. 입력 범위는 같다.
   *
   * 직접 작성판은 2라운드 A 와 조립이 같다 — 같은 명식이면 프롬프트 해시도 같다. 주장·근거판은
   * 지시 한 절과 **출력 스키마**(`claims` 가 본문보다 먼저)가 함께 바뀐다.
   */
  {
    id: 'match-limited-direct-v3',
    round: 3,
    label: 'A + 읽는 법 · 직접 작성',
    assembly: { ...CONTROL, matchInput: 'limited-v1', pairReading: 'guide-v1', pairWriting: 'direct-v1' },
    addedEvidence: [],
    promptChanges: [],
  },
  {
    id: 'match-limited-claims-v3',
    round: 3,
    label: 'A + 읽는 법 · 주장·근거 연결 후 작성',
    assembly: { ...CONTROL, matchInput: 'limited-v1', pairReading: 'guide-v1', pairWriting: 'claims-first-v1' },
    addedEvidence: [],
    promptChanges: ['「쓰기 전에 주장과 근거를 잇는다」 절', '출력 스키마에 `claims` 가 본문보다 먼저 선다'],
  },
  /**
   * **4라운드** — A 제한형에 읽는 법 2판. 판 비교가 아니라 **한 판의 소규모 확인**이다(두 분 명식 + 다른 커플).
   *
   * 2라운드 A(`match-limited-v2`)에서 달라진 것: 억제 규칙 절(「결론은 근거가 닿는 데까지만」)을 걷고, 「틀리면
   * 안 되는 것」·「관계를 읽는 안내」·「본문에 옮기지 않는 것」을 넣었다. 자료 안내(경로별 뜻)는 같다.
   */
  {
    id: 'match-limited-guide2-v4',
    round: 4,
    label: 'A + 읽는 법 2판',
    assembly: { ...CONTROL, matchInput: 'limited-v1', pairReading: 'guide-v2', pairWriting: 'direct-v1' },
    addedEvidence: [],
    promptChanges: [
      '억제 규칙 절 「결론은 근거가 닿는 데까지만」을 걷었다',
      '「틀리면 안 되는 것」 — 사람·방향·값의 기준·합화·한 글 안의 모순',
      '「관계를 읽는 안내」 — 정답표가 아닌 종합 해석 안내, 자신 있게 쓰기',
      '「본문에 옮기지 않는 것」 — 경로·검토 말·기준 설명은 근거 칸에만',
    ],
  },
  /**
   * **5라운드** — 4라운드와 같은 조건(두 분 명식 + 다른 커플, 1회씩). 새 안내와 부딪히던 공통 지시·예시를 인연 궁합
   * 실험판에서 갈아 끼우고, 관계 질문을 고르는 안내로, 한 줄 요약을 본문 뒤로.
   */
  {
    id: 'match-limited-guide3-v5',
    round: 5,
    label: 'A + 읽는 법 3판',
    assembly: { ...CONTROL, matchInput: 'limited-v1', pairReading: 'guide-v3', pairWriting: 'direct-v1' },
    addedEvidence: [],
    promptChanges: [
      '공통 규칙 — 운 칸 설명·「자료 밖이라고 먼저 적어라」·층을 본문 표지로 드러내는 사다리를 인연 궁합용 짧은 판으로',
      '본문 규칙 — 「한계는 판단 옆에서 말한다」 → 「이 글에 없는 것은 꺼내지도 설명하지도 않는다」',
      '용어 절 — 고정 대응 예시(관성·재성·금 셋)·운·신살 예시·역할 본보기(즉각 반응/속으로 따짐)를 걷음',
      '근거 칸 — 「연락 속도·편관」 본보기와 「한계는 본문에서」 끝줄을 걷음',
      '관계 안내 — 목차가 아니라 두드러지는 이야기 두세 개를 고르는 안내. 「다 다루되」 목록도 같은 뜻으로',
      '「틀리면 안 되는 것」에 한 사람의 모습(요약 포함)·시각 모르는 쪽의 반쪽 합',
      '한 줄 요약 — 본문을 다 쓴 뒤 가장 크게 다룬 이야기 하나, 대구 금지. 출력 스키마 차례를 본문 → 점수 → 요약으로(실험 전용)',
    ],
  },
];
