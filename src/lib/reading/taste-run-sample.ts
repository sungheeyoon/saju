import type { TasteRunOutput } from './taste-run';

/**
 * **운영자와 합의할 때 손으로 쓴 견본 한 벌 — 실호출이 아니다**(2026-10-03, `docs/notes/2026-10-03-taste-run-experiment.md`).
 *
 * 맛보기 · 이어쓰기 검사가 「합의한 모양을 지나는가」를 재는 자다. 단위 시험이 이 한 벌로 두 검사를 돌리고, 실호출 시험은
 * 짝 문서 옆에 견줄 거리로 싣는다. 문단 끝 괄호(기대는 엔진 값)는 노트에만 있고 여기에는 원문만 둔다.
 */
export const HAND_SAMPLE = {
  input: { year: 1992, month: 5, day: 14, hour: 9, minute: 30, second: 0, gender: 'female' as const },
  taste: {
    previewMarkdown: [
      '쇠의 기운을 가장 많이 타고났어요. 기준이 분명하고, 맡은 일은 끝을 보려는 편이에요. 그런데 태어난 계절이 막 더워지는 초여름이라, 그 쇠가 뜨거운 불 앞에 놓인 모양이에요.',
      '그래서 책임과 기대가 몰리는 자리에 서기 쉽고, 그 압박을 혼자 버티는 쪽을 자주 택해요. 다만 그 단단함을 받쳐 주는 힘은 쇠의 양만큼 크지 않아서, 오래 버틸수록 안에서 먼저 지칠 수 있어요.',
      '이 사주 안에는 그 열기를 덜어 낼 방향도 함께 보여요. 그 방향을 알면, 같은 압박을 버티는 대신 다르게 다룰 수 있어요.',
    ].join('\n\n'),
    continuationQuestion: '이 사주에서 압박의 열기를 덜어 내는 방향은 무엇이고, 어떻게 쓰나',
    answerDirection: '안에 쌓지 않고 생각을 밖으로 꺼내는 것',
    supportingClaims: ['analysis.structure', 'analysis.johu', 'pillars.year.stem', 'analysis.strength', 'analysis.rootQuality'],
  } satisfies TasteRunOutput,
  continuationAnswer:
    "그 방향은 '안에 쌓아 두지 않고 꺼내는 것'이에요. 이 사주에서는 생각과 기준을 밖으로 내보내는 힘이 불의 열기를 누그러뜨리는 쪽으로 읽혀요. 그래서 부담이 몰릴 때 혼자 정리를 끝내고 내놓기보다, 덜 다듬어진 채로라도 말로 먼저 나누고 결과물을 일찍 보여 주는 편이 맞아요. 버티는 시간이 줄면 같은 책임도 지치는 일보다 실력을 보여 주는 일에 가까워져요.",
};
