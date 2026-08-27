import { CONTROL, type PromptAssembly } from './prompt';

/**
 * **손으로 돌리는 실험판** — 실제 생성에는 쓰지 않는다.
 *
 * 게이트웨이가 붙기 전에는 프롬프트를 고쳐도 무엇이 나오는지 볼 수가 없다. 그래서
 * 같은 근거 한 벌로 control 과 변형들을 지어 놓고 사람이 손으로 돌려 견준다.
 *
 * ## 규칙 셋
 *
 * 1. **변형은 control 에서 하나만 벗어난다.** 둘을 함께 바꾸면 이긴 변형이 무엇 덕에
 *    이겼는지 알 수 없다. 못 지키는 변형은 `confounded` 에 무엇이 함께 움직였는지
 *    적는다 — **시험이 조립 칸 수를 세므로** 안 적으면 통과하지 못한다.
 * 2. **서로 쌓지 않는다.** 변형들은 형제이지 계단이 아니다.
 * 3. **판본을 사칭하지 않는다.** 실험 id 는 `READING_POLICY.version` 과 따로 산다 —
 *    손으로 만든 판을 `reading-prompt-v1` 이라고 적으면, 나중에 저장된 결과를 보고
 *    무엇으로 만든 것인지 되짚을 수 없다.
 *
 * `selection-bridge-v1` 만 둘 이상을 담는데, 그 셋이 **한 정책**이기 때문이다 —
 * 「무엇을 골라 남길 것인가」. 이 묶음이 이긴 뒤에 안을 갈라 봐도 늦지 않다. (조립
 * 칸으로는 `extraSections` 하나라 규칙 1을 어기지 않는다.)
 *
 * ## 이 라운드가 답할 수 있는 것
 *
 * 여기 있는 변형 중 여섯은 **여덟 절 한 편을 어떻게 세울지**를 고른다. 그 여섯을
 * 아무리 돌려도 나오는 것은 한 편의 풀이다. `focus-now-v1` 만 출력의 *단위*를 바꾼다.
 *
 * 그렇다고 이 채점이 「사람들은 풀이보다 답을 원한다」를 판정하지는 **않는다.** 그것은
 * 사용자에 대한 주장이고 여기서 재는 사람은 이 변형들을 쓴 사람이다. 이 라운드가
 * 답하는 것은 하나다 — **좁힌 출력이 품질을 지키는가**(근거 밀착성·hard fail).
 * 선호는 나중에 사용자 A/B 가 답한다.
 */

/** 자료 뒤에 서는 꼬리 — **새 지시가 아니라 제출 전 확인이다.** */
const RECENCY_CHECK = `## 제출 전 확인

위 자료를 다 읽었으면 아래를 하나씩 확인하고 내라. **여기서 새로 정하는 규칙은 없다** —
앞에서 이미 정한 것을 빠뜨리지 않았는지만 본다.

- 1~8절을 모두 썼는가
- 잘하는 것 넷, 걸리는 것 셋을 채웠는가
- 「지금」절에 기준 시각과 대운·세운·월운이 다 있는가
- 근거 칸이 절마다 한 줄씩 있고, 가장 흔들리는 것 셋을 덧붙였는가
- 자료 밖에서 가져온 말이 있으면 그 절의 근거 줄에 \`자료 밖\` 을 적었는가
- \`score\` 가 \`null\` 인가
- 본문이 요구한 분량 안에 있는가`;

/**
 * **무엇을 골라 남길 것인가** — 세 가지가 한 뿌리다.
 *
 * 자료는 관계를 스무 개 넘게 실어 보내고 프롬프트는 「전부 해석하되」라고 압력을
 * 넣는다. 그러면 나오는 것은 해석이 아니라 관계 목록 낭독이다. 같은 구멍에서
 * 「일간이 庚이라 …」 같은, 같은 일간을 가진 수천만에게 그대로 붙는 문장도 나온다 —
 * 둘 다 **버릴 것을 안 정해 준 결과**다.
 */
const SELECTION_BRIDGE = `## 무엇을 남길 것인가

**있는 관계를 다 적지 마라.** 관계는 자료에 스무 개도 넘게 실려 있고, 그것을 차례로
옮기면 해석이 아니라 목록 낭독이 된다. 아래 차례로 중요도를 매긴다.

1. 일간과 직접 걸리는 관계
2. 월령과 핵심 구조를 바꾸는 관계
3. 되풀이되거나 서로 같은 방향을 가리키는 관계
4. 지금 도는 운에서 걸린 관계
5. 나머지

여럿이 **같은 것을 설명하면 한 해석으로 묶어라.** 관계 하나만으로 새 성격을 만들지 마라.
최종 글에 세워 두는 것은 **가장 중요한 세 가지에서 다섯 가지 갈래**다.

## 이 사람의 글인가

성격 결론은 되도록 **서로 다른 근거 둘 이상을 엮어서** 세워라. 다 쓰고 나서 문장마다
물어라 — **다른 명식에 그대로 붙여도 맞는 말인가.** 맞다면 지우고, 이 자료의 어떤
조합 때문에 방향·조건·상황이 달라지는지로 다시 써라.

## 오행에서 행동으로

부족한 오행을 채우라고 할 때 **색·방위·시간대로 건너뛰지 마라**(그것은 자료 밖이다).
그 오행이 이 명식에서 **무엇 노릇을 하는지**를 먼저 짚고, 그 노릇에서 행동을 뽑아라 —
이를테면 木이 인성 자리라면 배우고 정리하고 회복하는 쪽의 일이다. 다리를 안 놓으면
조언이 오행 미신이 된다.`;

export type PromptVariantId =
  | 'control'
  | 'recency-check-v1'
  | 'length-v1'
  | 'selection-bridge-v1'
  | 'answer-first-v1'
  | 'bounded-items-v1'
  | 'now-first-v1'
  | 'focus-now-v1';

export type PromptVariant = {
  readonly id: PromptVariantId;
  readonly label: string;
  /** control 에서 **무엇 하나가** 달라졌는가 */
  readonly changes: string;
  /**
   * 한 곳만 바꾼 것이 **아닐 때** 무엇이 함께 움직였는지 — 아니면 `null`.
   *
   * 규칙 1은 주석으로만 서 있었다. 주석은 아무것도 잠그지 않는다 — 조립 옵션 둘을 함께
   * 바꾼 변형을 넣어도 시험은 통과하고, 그 변형이 이기면 무엇 덕에 이겼는지 아무도
   * 모른 채 합치게 된다. 이 자리를 값으로 두면 **바뀐 칸 수를 시험이 셀 수 있고**,
   * 둘 이상 바뀐 변형은 여기에 이유를 적어야만 통과한다.
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
    changes: '실제로 보내는 것 그대로. 나머지 변형은 여기서 하나씩만 벗어난다.',
    confounded: null,
    assembly: CONTROL,
  },
  {
    id: 'recency-check-v1',
    label: '자료 뒤 확인 목록',
    changes: '자료 뒤에 제출 전 확인 목록을 붙인다. 규칙은 하나도 더하지 않는다.',
    confounded: null,
    assembly: { ...CONTROL, tail: RECENCY_CHECK },
  },
  {
    id: 'length-v1',
    label: '분량 넓히기',
    changes: '자기 풀이 본문을 1800~2600자에서 2200~3000자로. 다른 것은 그대로.',
    confounded: null,
    assembly: { ...CONTROL, selfLength: { min: 2200, max: 3000 } },
  },
  {
    id: 'selection-bridge-v1',
    label: '골라 남기기',
    changes: '관계 우선순위 · 이 사람의 글인가 · 오행에서 행동으로 — 셋을 한 정책으로 얹는다.',
    confounded: null,
    assembly: { ...CONTROL, extraSections: [SELECTION_BRIDGE] },
  },
  {
    id: 'answer-first-v1',
    label: '결론 먼저',
    changes: '판단 순서는 그대로 두고, 절마다 결론 → 근거 → 조건·행동 순서로 쓴다.',
    confounded: null,
    assembly: { ...CONTROL, paragraphOrder: 'answer-first' },
  },
  {
    id: 'bounded-items-v1',
    label: '근거만큼만',
    changes: '잘하는 것과 걸리는 것을 고정 개수가 아닌 최대 개수로 바꾼다.',
    confounded: null,
    assembly: { ...CONTROL, selfItemCount: 'bounded' },
  },
  {
    id: 'now-first-v1',
    label: '지금 먼저',
    changes: '「지금」을 원래 자리에서 꺼내 2번으로 옮긴다. 절을 복제하지 않는다.',
    confounded: null,
    assembly: { ...CONTROL, selfSectionOrder: 'now-first' },
  },
  {
    id: 'focus-now-v1',
    label: '지금만',
    changes:
      '여덟 절 한 편 대신 「지금」 하나만 답한다 — 네 절, 600~900자. 출력의 단위를 바꾸는 유일한 변형이다.',
    confounded:
      '범위와 분량이 함께 움직인다. 네 절짜리 글을 1800~2600자로 쓰게 하면 좁힌 만큼이 늘여 쓰기로 되돌아오므로 뗄 수가 없다. 그래서 이 변형이 이겨도 「짧아서 이겼는가 좁혀서 이겼는가」는 이 라운드가 답하지 못한다 — 그것은 다음 라운드에서 `focus-now` 를 분량만 바꿔 두 벌 세워야 갈린다.',
    assembly: { ...CONTROL, selfScope: 'now', selfLength: { min: 600, max: 900 } },
  },
];
