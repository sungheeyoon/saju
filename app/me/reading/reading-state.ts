import type { CurrentReading } from '@/src/lib/reading';
import { isScored } from '@/src/lib/reading/policy';

import type { ReadingTarget } from './target';

/* 누름과 기다림의 판단은 웹과 앱이 함께 쓴다(ADR 0211). 여기 남는 것은 웹의 개발 기계만 세우는 예시 글이다 */
export * from '@/src/lib/reading/reading-flow';

/**
 * **연결을 못 쓸 때 대신 세우는 글.**
 *
 * 개발 기계에서만 지어진다. 글자는 화면을 보려고 박아 둔 것이라 뜻이 없지만, 두 칸은
 * 뜻이 있다.
 *
 * - **점수와 비유는 점수가 붙는 대상에만** 선다(`isScored`). 자기 풀이에 숫자를 달아
 *   두면 그 자리가 실제로는 비어 있다는 것을 화면 검토에서 못 본다.
 * - **`sourceRunId` 가 없다.** 이 글을 만든 시도가 없기 때문이고, 그래서 설문도 안
 *   붙는다(`panelChrome` 의 `asksFeedback`). 지어 넣으면 예시 글에 대한 답이 진짜
 *   판본별 값에 섞인다.
 */
export function previewReading(kind: ReadingTarget['kind'], at: Date): CurrentReading {
  const scored = isScored(kind);

  return {
    id: 'development-preview',
    score: scored ? 78 : null,
    metaphor: scored
      ? '오래 걷던 두 사람이 같은 갈림길에서 잠깐 멈춘 모양입니다.'
      : '늘 앞장서 걷다가 가끔 뒤를 돌아보는 사람입니다.',
    output: MOCK_OUTPUT,
    model: 'development-preview',
    viewedAt: at.toISOString(),
    createdAt: at.toISOString(),
    viewerIsFirst: true,
    fromCurrentChart: true,
    sourceRunId: null,
    myFeedback: null,
    dayMasterA: null,
    dayMasterB: null,
    /* 예시 글은 잰 눈금이 없다 — 지어 넣지 않는다 */
    scoreScale: { baseline: null, version: null, relation: null },
  };
}

const MOCK_OUTPUT = `## 지금의 핵심

당신의 사주는 **한 방향으로 빠르게 밀어붙이기보다, 주변의 흐름을 읽고 자신의 기준을 세울 때 힘이 나는 구조**로 보입니다. 겉으로는 차분하게 상황을 정리하지만, 납득할 만한 이유가 생기면 생각보다 결단이 빠른 편입니다.

## 강점이 드러나는 방식

목과 수의 흐름은 새로운 정보를 받아들이고 연결하는 힘으로 이어집니다. 처음부터 정답을 내기보다 여러 가능성을 살핀 뒤 공통점을 찾는 일에 강점이 있습니다. 사람 사이에서는 말의 표면보다 맥락을 읽으려는 태도로 나타날 수 있습니다.

- 복잡한 일을 순서와 기준으로 정리할 때 집중력이 좋아집니다.
- 혼자 결론을 품고 있기보다 믿을 만한 사람과 대화할 때 생각이 선명해집니다.
- 변화가 필요한 순간에도 준비할 시간을 확보하면 훨씬 안정적으로 움직입니다.

## 균형을 위한 제안

생각이 충분히 정리될 때까지 행동을 미루면 좋은 타이밍을 놓칠 수 있습니다. 모든 변수를 확인하려 하기보다 **지금 확인된 사실과 나중에 보완할 부분을 나누는 방식**이 도움이 됩니다. 중요한 선택에서는 완벽한 확신보다 작은 실행으로 반응을 확인해 보세요.

## 관계에서 기억할 점

상대의 상황을 먼저 헤아리는 태도는 장점이지만, 내 기준을 늦게 말하면 상대는 동의한 것으로 오해할 수 있습니다. 불편함이 커진 뒤 설명하기보다 초반에 “나는 이 부분이 중요하다”라고 짧게 경계를 알려주는 편이 관계의 피로를 줄입니다.

---

이 해석은 저장된 사주 근거를 바탕으로 현재 확인 가능한 경향을 설명합니다. 출생 시각이 없거나 계산 근거가 제한된 부분은 단정하지 않았으며, 중요한 결정을 대신하는 판단으로 사용하지 마세요.`;
