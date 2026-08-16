/**
 * L3 해석 문장.
 *
 * 계약(`policy.ts`) → 조각 스키마(`fragment.ts`) → 말뭉치(`corpus.ts`) →
 * 조립기(`assemble.ts`) 까지다. 생성기는 그 위가 아니라 **옆**이다 — 빌드 타임에
 * `corpus.ts` 를 만들어 넣는 놈이라 런타임 흐름에는 끼지 않는다(`runtimeAi: 'none'`).
 */
export * from './policy';
export * from './fragment';
export * from './corpus';
export * from './assemble';
