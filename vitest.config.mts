import { defineConfig } from 'vitest/config';

export default defineConfig({
  resolve: {
    // tsconfig.json 의 paths ("@/*") 를 그대로 사용
    tsconfigPaths: true,
  },
  test: {
    // 순수 TS 로직 테스트 — DOM 불필요
    environment: 'node',
  },
});
