/**
 * **디자인 값** — 토큰의 원본은 `tokens.json` 하나이고 `scripts/design-tokens.mjs` 가 웹 `app/globals.css` 의 칸과 `tokens.generated.ts` 를 짓는다
 * (ADR 0109 추기 2026-10-31). 앱은 `@design` 으로 부른다. 이 폴더는 React 를 모른다.
 */
export * from './tokens.generated';
export * from './parts';
export * from './contract';
