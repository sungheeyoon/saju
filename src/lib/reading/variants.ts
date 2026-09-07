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

export type PairVariantId = 'control' | 'pair-precedence-v1';

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
 * ## 이 라운드가 묻는 것 하나
 *
 * **10절의 각자 읽기가 안정되는가.** 그것만 묻는다. `analysis` 를 통째로 빼는 실험은
 * 이 다음이다 — 둘을 같은 라운드에 넣으면 「자료가 있어서」와 「서열을 읽혀서」가 섞여
 * 이겨도 무엇 덕인지 못 말한다.
 *
 * ## 부르기 전에 무엇을 볼지 적어 둔다
 *
 * 읽고 나서 기준이 생기면 그것은 측정이 아니라 감상이다. 10절만 놓고 넷을 본다.
 *
 * 1. 한 사람에 대해 **서로 다른 방향을 가리키는 서술이 함께 서는가** — P1 이 없앨 것
 * 2. **같은 결론이 다른 근거로 되풀이되는가** — P1 이 **안** 고칠 것. 여기서 갈리면
 *    「상관된 판정이 같은 결론을 거듭 강화한다」가 실재한다는 첫 증거다
 * 3. 갈린 사정이 본문에 샜는가 — 「우선순위가 높은 쪽에 따르면」류
 * 4. 분량이 계약 안에 남는가 (`compatLength.private`)
 *
 * 2번이 이 라운드의 값이다. **P1 의 실패가 곧 다음 문제의 존재 증거**가 되도록 짰다.
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
    id: 'pair-precedence-v1',
    label: '10절이 서열을 읽는다 (P1)',
    changes:
      '같은 자료·같은 절 목록에서 **10절에만** 한 문단이 붙는다 — 각자의 `analysis.precedence` 를 보고 `primary` 를 기준으로 읽고, `overrides` 가 거짓인 줄을 결론으로 세우지 않는다. 1~9절과 11절은 한 글자도 안 바뀐다.',
    confounded: null,
    assembly: { ...CONTROL, eachPersonJudgements: 'precedence-v1' },
  },
];
