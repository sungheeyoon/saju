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

- 열 절을 모두 썼는가 — 맨 앞 요약 셋을 빠뜨리지 않았는가
- 사용자 본문에 생한자나 한국어가 아닌 외국 문자가 없는가
- 귀인·신살은 자료에 실제로 있는 것만 이름을 밝혔는가
- 일·돈·연애와 대운·세운·월운을 빠뜨리지 않았는가
- 확실한 장점까지 완충해서 흐리지 않았는가
- 해석보다 생활 과제가 많아지지 않았는가
- 다른 사람에게 그대로 붙여도 맞는 문장을 지웠는가
- 검사용 근거 절이 절마다 한 줄씩 있는가`;

export type PromptVariantId =
  | 'control'
  | 'yongsin-v1'
  | 'legacy-v1'
  | 'longer-v1'
  | 'plain-terms-v1'
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
    changes: '실제로 보내는 것 그대로 — 요약 절을 앞세운 열 절, 5000~9000자, 한국어 상담 말투.',
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
    id: 'plain-terms-v1',
    label: '이름 없이',
    changes:
      '전문용어의 이름을 본문에 부르지 않고 그 말이 가리키는 장면으로 쓴다. 절과 본보기가 함께 그 판으로 바뀐다 — 오행 이름은 그대로 둔다.',
    /**
     * **가드를 절 단위로 조이자 이 변형이 걸렸다.** 조립 칸은 `terminology` 하나인데
     * 그 한 칸이 **절 여섯의 본문을 다시 쓴다.** `changes` 는 「절과 본보기가 함께
     * 바뀐다」고 이미 적고 있었는데 이 칸만 비어 있었다 — 산문이 적은 것을 값이 안 들고
     * 있었다.
     */
    confounded:
      '용어 판을 바꾸면 절 여섯의 본문이 함께 다시 쓰인다. 이겨도 용어 규칙 덕인지 다시 쓴 절 덕인지 이 라운드는 답하지 않는다.',
    assembly: { ...CONTROL, terminology: 'plain' },
  },
  {
    id: 'yongsin-v1',
    label: '용신 계열을 읽힌다',
    changes:
      '이미 있는 세 절(성격·강점·조심할 점)이 버틸 힘·격국·억부·조후·대조를 읽게 한다. 절은 안 늘리고 지시문에 이름을 앞세우지도 않는다 — 뜻으로 쓰고 경로만 든다.',
    confounded:
      '한 조립 칸(`selfPresentation`) 안에서 **절 셋이 함께 움직인다.** 이겨도 셋 중 무엇 덕인지 이 라운드는 답하지 않는다 — 합칠 때는 셋을 한 덩어리로 합치거나, 쪼개서 다시 재야 한다.',
    assembly: { ...CONTROL, selfPresentation: 'expert-v4' },
  },
  {
    id: 'legacy-v1',
    label: '옛 여덟 절',
    changes: '갈아엎기 전의 뼈대 — 여덟 절, 1800~2600자. 새 것이 정말 나은지 견줄 바탕.',
    confounded:
      '뼈대와 분량이 함께 움직인다. 이 변형은 새 뼈대와 옛 여덟 절의 전체 인상을 견주는 자리이지 단일변수 실험이 아니다 — 져도 그것이 절 수 탓인지 분량 탓인지 이 라운드는 답하지 않는다.',
    assembly: {
      ...CONTROL,
      selfPresentation: 'legacy-v1',
      selfLength: { min: 1800, max: 2600 },
    },
  },
];
