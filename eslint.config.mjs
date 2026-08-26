import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    // 서버 검사가 짓는 자리 — 빌드 산출물이라 읽지 않는다(`scripts/check-managed.mjs`).
    ".next-check/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
  ]),
  {
    /**
     * Playwright 의 fixture 는 `use(value)` 로 값을 넘긴다. React 의 `use` 와 이름만
     * 같고 훅이 아니다 — 규칙이 이름으로 알아보므로 이 폴더에서만 끈다.
     */
    files: ["e2e/**/*.ts"],
    rules: { "react-hooks/rules-of-hooks": "off" },
  },
]);

export default eslintConfig;
