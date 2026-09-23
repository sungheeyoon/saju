import { fileURLToPath } from 'node:url';

import { defineConfig } from 'vitest/config';

export default defineConfig({
  resolve: {
    // tsconfig.json 의 paths ("@/*") 를 그대로 사용
    tsconfigPaths: true,
    /**
     * **`server-only` 은 Next 가 풀어 주는 이름이다**(G-23 ⑧). 비밀을 읽는 모듈 셋이 첫 줄에
     * 들고, Next 는 서버 층에서 빈 모듈로, 브라우저 층에서 빌드 오류로 푼다. vitest 는 그 층을
     * 모르므로 Next 의 빈 모듈을 그대로 가리킨다 — 시험은 서버에서 도는 코드를 잰다.
     */
    alias: {
      'server-only': fileURLToPath(new URL('./node_modules/next/dist/compiled/server-only/empty.js', import.meta.url)),
    },
  },
  test: {
    // 순수 TS 로직 테스트 — DOM 불필요
    environment: 'node',
    // Playwright E2E는 별도 러너에서 실행한다.
    // app/ 은 화면이지만 주소창 코덱처럼 JSX 없는 순수 모듈은 여기서 함께 돈다.
    /**
     * **검사 도구 자신도 시험 사정권 안에 있다.**
     *
     * `scripts/` 는 여태 밖이었다. 그동안 흐름 검사를 묶는 자리에는 아무 시험도 없었고,
     * `&&` 사슬이 뒤 검사를 통째로 건너뛰는 것을 **아무도 못 봤다**(`run-checks.test.ts`).
     */
    include: ['src/**/*.test.ts', 'app/**/*.test.ts', 'scripts/**/*.test.ts'],
    /**
     * **CI 는 느리다.**
     *
     * 여기 몇몇은 자료를 전수로 훑는다 — 1900~2100 하루 단위 tzdb 대조, 음력 표
     * 왕복, 대운 무작위 500건. 이 기계에서 가장 오래 걸리는 것이 3.3초라 기본 5초에
     * 아슬아슬하게 들어가는데, 공유 러너에서는 넘어간다. 실제로 그것 때문에 배포
     * 브랜치 검증이 빨간불이었다.
     *
     * 늘리는 것은 무엇을 재는지를 바꾸지 않는다 — 안 끝나는 것은 여전히 안 끝난다.
     *
     * **모집단 3000건을 도는 시험은 제 시간을 직접 든다**(`POPULATION_TIMEOUT_MS`).
     * 통관·대조·서열의 보정값이 그것인데, 그 셋 때문에 여기를 넓히면 나머지 1500여
     * 시험의 달아남을 잡는 자리가 함께 헐거워진다.
     */
    testTimeout: process.env.CI ? 30_000 : 5_000,
  },
});
