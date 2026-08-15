/**
 * 네 기둥의 자리 — 관계·운성·신살이 모두 이 이름으로 자리를 가리킨다.
 *
 * 관계 연산에서 먼저 필요했지만 거기 묶어둘 것이 아니다. 12운성도, 12신살도,
 * 공망도 "어느 자리에 붙는가"를 말해야 하고, 셋이 각자 같은 타입을 다시
 * 정의하면 이름만 같고 서로 대입되지 않는 타입이 넷 생긴다.
 */

export type PillarPosition = 'year' | 'month' | 'day' | 'hour';

/** 년 → 시 순서. 거리·인접 판정이 이 순서를 기준으로 한다. */
export const PILLAR_POSITIONS = [
  'year',
  'month',
  'day',
  'hour',
] as const satisfies readonly PillarPosition[];

export const PILLAR_POSITION_KO: Record<PillarPosition, string> = {
  year: '년주',
  month: '월주',
  day: '일주',
  hour: '시주',
};

export const PILLAR_POSITION_INDEX: Record<PillarPosition, number> = {
  year: 0,
  month: 1,
  day: 2,
  hour: 3,
};
