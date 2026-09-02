import { defineConfig } from 'vitest/config';

export default defineConfig({
  resolve: {
    // tsconfig.json 의 paths ("@/*") 를 그대로 사용
    tsconfigPaths: true,
  },
  test: {
    // 순수 TS 로직 테스트 — DOM 불필요
    environment: 'node',
    // Playwright E2E는 별도 러너에서 실행한다.
    // app/ 은 화면이지만 주소창 코덱처럼 JSX 없는 순수 모듈은 여기서 함께 돈다.
    include: ['src/**/*.test.ts', 'app/**/*.test.ts'],
    /**
     * **CI 는 느리다.**
     *
     * 여기 몇몇은 자료를 전수로 훑는다 — 1900~2100 하루 단위 tzdb 대조, 음력 표
     * 왕복, 대운 무작위 500건. 이 기계에서 가장 오래 걸리는 것이 3.3초라 기본 5초에
     * 아슬아슬하게 들어가는데, 공유 러너에서는 넘어간다. 실제로 그것 때문에 배포
     * 브랜치 검증이 빨간불이었다.
     *
     * 늘리는 것은 무엇을 재는지를 바꾸지 않는다 — 안 끝나는 것은 여전히 안 끝난다.
     */
    testTimeout: process.env.CI ? 30_000 : 5_000,
  },
});
