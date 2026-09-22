import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

/**
 * **층은 문서가 아니라 린트가 지킨다** (ADR 0085, `docs/architecture.md`).
 *
 * 2026-09-22 에 재어 보니 방향은 전부 지켜지고 있었다 — `src/lib`→`app` 0건, `saju`→다른
 * lib 0건, `src/lib`→supabase 런타임 0건. 그런데 그것을 막는 규칙이 **한 줄도 없었다.**
 * 지켜진 것은 사람이 알고 있어서였고, 에이전트는 세션마다 새로 배운다. 아래 규칙은
 * 새 것을 정하지 않는다 — 이미 참인 것을 값으로 잠근다.
 */

/** 화면·서버가 아는 것 — 엔진과 도메인 lib 은 모른다 */
const APP_ONLY = [
  { group: ["@/app/*", "@/app"], message: "src/lib 은 app 을 모른다 — 방향이 거꾸로다 (docs/architecture.md)" },
  { group: ["next", "next/*", "react", "react/*", "react-dom", "react-dom/*"], message: "React/Next 는 app/ 에만 있다" },
  { group: ["ai", "openai", "@ai-sdk/*"], message: "모델은 app/me/reading/model.ts 만 부른다 (ADR 0047)" },
];

/** 런타임 의존 0건 (ADR 0078) — 운영 DB 를 직접 두드리는 잠긴 시험(`*.live.test.ts`)만 예외 */
const NO_SUPABASE = [
  { group: ["@supabase/*"], message: "src/lib 은 supabase 를 부르지 않는다 — 타입은 @/src/lib/db, 호출은 app 의 문(ADR 0078)" },
];

/** 순수 계산에는 실행 환경이 없다 */
const NO_NODE = [
  { group: ["node:*", "fs", "path", "child_process", "os"], message: "src/lib 은 실행 환경을 모른다 — 예외는 local-env.ts 와 *.live.test.ts 뿐" },
];

/**
 * 화면(.tsx)은 DB 를 직접 부르지 않는다 — **문**(.ts)이 부른다 (ADR 0072·0078).
 *
 * `.from()` 은 `Array.from` 같은 이름과 겹쳐서 객체 이름으로 거른다.
 */
const NO_DB_CALL_IN_SCREENS = [
  {
    selector: "CallExpression[callee.property.name='rpc']",
    message: "화면(.tsx)에서 .rpc() 를 부르지 않는다 — 읽는 문(.ts)으로 옮긴다 (docs/architecture.md)",
  },
  {
    selector:
      "CallExpression[callee.property.name='from']:not([callee.object.name=/^(Array|Buffer|Uint8Array|Int32Array|Float64Array|Object|Promise|Set|Map|String)$/])",
    message: "화면(.tsx)에서 .from() 을 부르지 않는다 — 읽는 문(.ts)으로 옮긴다 (docs/architecture.md)",
  },
];

/**
 * **옛 자리 열하나 — 잠근 날에 이미 부르고 있던 화면.** 좁히기만 한다 (ADR 0085 §3).
 * 하나를 문으로 옮기면 여기서 지운다. 늘리지 않는다.
 */
const SCREENS_STILL_CALLING_DB = [
  "app/closed/page.tsx",
  "app/compat/page.tsx",
  "app/me/matching/page.tsx",
  "app/me/page.tsx",
  "app/me/people/page.tsx",
  "app/me/profile/page.tsx",
  // 대괄호는 glob 의 문자 집합이라 벗긴다
  "app/me/readings/\\[subject\\]/page.tsx",
  "app/me/settings/page.tsx",
  "app/privacy/page.tsx",
  "app/save-for-reading.tsx",
  "app/signup/page.tsx",
];

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    // 서버 검사가 짓는 자리 — 빌드 산출물이라 읽지 않는다(`scripts/check-managed.mjs`).
    ".next-check/**",
    ".next-matching-test/**",
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

  // ---------------------------------------------------------------------------
  // 층의 방향 (ADR 0085)
  // ---------------------------------------------------------------------------
  {
    /** 도메인 lib — app 도, 실행 환경도 모른다 */
    files: ["src/lib/**/*.ts"],
    ignores: ["src/lib/local-env.ts", "src/lib/**/*.live.test.ts"],
    rules: { "no-restricted-imports": ["error", { patterns: [...APP_ONLY, ...NO_SUPABASE, ...NO_NODE] }] },
  },
  {
    /** 실행 환경과 운영 DB 를 아는 두 예외 — 그래도 app 은 모른다 */
    files: ["src/lib/local-env.ts", "src/lib/**/*.live.test.ts"],
    rules: { "no-restricted-imports": ["error", { patterns: APP_ONLY }] },
  },
  {
    /** 엔진 — 다른 도메인 lib 도 모른다. 순수 TypeScript 다 (README) */
    files: ["src/lib/saju/**/*.ts"],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          patterns: [
            ...APP_ONLY,
            ...NO_SUPABASE,
            ...NO_NODE,
            { regex: "^@/src/lib/(?!saju(/|$))", message: "엔진은 다른 도메인 lib 을 모른다 — 반대 방향만 허용된다" },
          ],
        },
      ],
    },
  },
  {
    /** 검사·시험 도구 — 엔진과 도메인 lib 은 부르되 화면은 모른다 */
    files: ["scripts/**/*.{ts,mjs}", "e2e/**/*.ts"],
    rules: {
      "no-restricted-imports": [
        "error",
        { patterns: [{ group: ["@/app/*", "@/app"], message: "검사 도구는 화면 모듈을 모른다 — 주소로 두드리거나 src/lib 을 부른다" }] },
      ],
    },
  },

  // ---------------------------------------------------------------------------
  // 문의 자리 (ADR 0072·0078·0085)
  // ---------------------------------------------------------------------------
  {
    files: ["app/**/*.tsx"],
    ignores: SCREENS_STILL_CALLING_DB,
    rules: { "no-restricted-syntax": ["error", ...NO_DB_CALL_IN_SCREENS] },
  },
]);

export default eslintConfig;
