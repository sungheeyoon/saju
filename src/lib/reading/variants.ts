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
 * 앞 라운드는 여덟 절 한 편을 **어떻게 세울지**를 견줬다(순서·개수·분량). 그 결과
 * 나온 글이 사람이 읽고 싶은 글이 아니었다 — 한자와 판정 이름이 본문을 채웠고,
 * 근거를 증명하느라 지면을 썼고, 「이거 난데」가 한 줄도 없었다.
 *
 * 그래서 출력층을 통째로 갈았다(`human-v2`: 딱 나 · 힘든 때 · 채울 것 · 지금).
 * 지금 견줘야 하는 것은 **새 뼈대가 옛 뼈대보다 읽히는가**이고, 그러려면 옛 뼈대가
 * 실험판으로 남아 있어야 한다. 지워 버리면 「나아졌다」가 기억으로만 남는다.
 */

/** 자료 뒤에 서는 꼬리 — **새 지시가 아니라 제출 전 확인이다.** */
const RECENCY_CHECK = `## 제출 전 확인

위 자료를 다 읽었으면 아래를 하나씩 확인하고 내라. **여기서 새로 정하는 규칙은 없다** —
앞에서 이미 정한 것을 빠뜨리지 않았는지만 본다.

- 네 절을 모두 썼는가
- 본문에 한자가 한 글자도 없는가
- 판정 이름(정관·용신·억부 …)이 본문에 없는가
- 장면 없이 완충만 있는 문장이 남아 있지 않은가
- 다른 사람에게 그대로 붙여도 맞는 문장을 지웠는가
- 검사용 근거 절이 절마다 한 줄씩 있는가`;

export type PromptVariantId = 'control' | 'legacy-v1' | 'longer-v1' | 'recency-check-v1';

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
    changes: '실제로 보내는 것 그대로 — 네 절, 900~1400자, 고객 말투.',
    confounded: null,
    assembly: CONTROL,
  },
  {
    id: 'longer-v1',
    label: '더 길게',
    changes: '같은 뼈대에 분량만 900~1400에서 1400~2000자로. 장면이 더 들어갈 자리를 준다.',
    confounded: null,
    assembly: { ...CONTROL, selfLength: { min: 1400, max: 2000 } },
  },
  {
    id: 'recency-check-v1',
    label: '자료 뒤 확인 목록',
    changes: '자료 뒤에 제출 전 확인 목록을 붙인다. 규칙은 하나도 더하지 않는다.',
    confounded: null,
    assembly: { ...CONTROL, tail: RECENCY_CHECK },
  },
  {
    id: 'legacy-v1',
    label: '옛 여덟 절',
    changes: '갈아엎기 전의 뼈대 — 여덟 절, 1800~2600자. 새 것이 정말 나은지 견줄 바탕.',
    confounded:
      '뼈대와 분량이 함께 움직인다. 여덟 절을 900~1400자에 담을 수는 없으므로 뗄 수가 없다. 이 변형은 「어느 쪽이 읽히는가」를 묻는 자리이지 단일변수 실험이 아니다 — 져도 그것이 절 수 탓인지 분량 탓인지 이 라운드는 답하지 않는다.',
    assembly: {
      ...CONTROL,
      selfPresentation: 'legacy-v1',
      selfLength: { min: 1800, max: 2600 },
    },
  },
];
