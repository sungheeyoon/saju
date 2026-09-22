import { builtinModules } from "node:module";

import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";
import importPlugin from "eslint-plugin-import";

/**
 * **층의 방향과 화면의 DB 호출은 린트가 막는다** (ADR 0085, `docs/architecture.md`).
 *
 * 무엇을 막는지는 `scripts/layers.test.ts` 가 **같은 표**로 다시 잰다 — 린트는 편집기에서
 * 빠르게 알려 주는 자리이고, 시험은 상대경로·동적 import·패키지까지 한 벌로 잠그는 자리다.
 * 첫 판(2026-09-22)은 별칭(`@/…`)의 정적 import 만 막아 상대경로와 `import()` 가 지나갔다.
 * 그래서 경로는 `import/no-restricted-paths` 로(파일을 풀어서 본다), 패키지는
 * `no-restricted-imports` 로 가른다.
 */

/** 읽는 확장자 — `scripts/layers.test.ts` 의 `SOURCE_EXTENSIONS` 와 같은 목록. `tsconfig` 가 `.mts` 를 포함한다 */
const TS = "{ts,mts,cts}";
const ANY = "{ts,mts,cts,tsx,js,mjs,cjs}";

/**
 * `import()` 의 대상은 **따옴표 문자열**로만 적는다 — 백틱·변수·식은 린트도 시험도 해석할 수
 * 없어 모르는 것이고, 모르는 것은 막는다(ADR 0082 의 CI 계획과 같은 결).
 */
const NO_UNKNOWN_DYNAMIC_IMPORT = {
  selector: "ImportExpression > :not(Literal)",
  message: "import() 대상은 따옴표 문자열 하나로 적는다 — 백틱·변수·식은 층 검사가 못 읽는다 (ADR 0085)",
};

/** 파일로 푸는 경로 규칙 — 별칭이든 상대경로든 `import()` 든 같은 파일이면 같은 답이다 */
const PATH_ZONES = [
  { target: "./src/lib", from: "./app", message: "src/lib 은 app 을 모른다 — 방향이 거꾸로다 (docs/architecture.md)" },
  { target: "./src/lib", from: "./proxy.ts", message: "src/lib 은 관문을 모른다" },
  {
    target: "./src/lib/saju",
    from: "./src/lib",
    except: ["./saju"],
    message: "엔진은 다른 도메인 lib 을 모른다 — 반대 방향만 허용된다 (docs/architecture.md)",
  },
  { target: "./scripts", from: "./app", message: "검사 도구는 화면 모듈을 모른다 — 주소로 두드리거나 src/lib 을 부른다" },
  { target: "./e2e", from: "./app", message: "검사 도구는 화면 모듈을 모른다 — 주소로 두드리거나 src/lib 을 부른다" },
];

/** 화면·서버가 아는 패키지 — 엔진과 도메인 lib 은 모른다 */
const APP_ONLY_PACKAGES = [
  { group: ["next", "next/*", "react", "react/*", "react-dom", "react-dom/*"], message: "React/Next 는 app/ 에만 있다" },
  { group: ["ai", "openai", "@ai-sdk/*"], message: "모델은 app/me/reading/model.ts 만 부른다 (ADR 0047)" },
];

/** 런타임 의존 0건 (ADR 0078) — 운영 DB 를 직접 두드리는 잠긴 시험(`*.live.test.ts`)만 예외 */
const NO_SUPABASE = [
  { group: ["@supabase/*"], message: "src/lib 은 supabase 를 부르지 않는다 — 타입은 @/src/lib/db, 호출은 app 의 문(ADR 0078)" },
];

/**
 * 순수 계산에는 실행 환경이 없다 — Node 내장 모듈 전부, `node:` 접두사가 있든 없든.
 *
 * **앞에 `/` 를 붙여 앵커한다.** 이 규칙의 패턴은 gitignore 문법이라 `constants` 라고만 적으면
 * `../constants` 도 걸린다 — 엔진의 상수 폴더가 Node 의 `constants` 모듈과 이름이 같아서
 * 첫 실행이 66건으로 빨개졌다. `/fs` 는 import 문자열이 `fs` 로 **시작할 때만** 맞는다.
 */
const NODE_BUILTINS = builtinModules.filter((name) => !name.startsWith("_") && !name.startsWith("node:"));
const NO_NODE = [
  {
    group: [...NODE_BUILTINS.map((name) => `/${name}`), "node:*"],
    message: "src/lib 은 실행 환경을 모른다 — 예외는 local-env.ts 와 *.live.test.ts 뿐",
  },
];

/**
 * 화면(.tsx)은 DB 를 직접 부르지 않는다 — **문**(.ts)이 부른다 (ADR 0072·0078).
 *
 * 구문으로 거른다: `.rpc()` 와 `.from()`. `.from()` 은 `Array.from` 같은 이름과 겹쳐서 객체
 * 이름으로 뺀다. 잠근 날 이미 부르고 있던 열세 자리는 **그 줄에** `eslint-disable-next-line`
 * 이 붙어 있다. 그 표시는 줄 하나를 통째로 끄므로, **어느 호출인지는 `scripts/layers.test.ts`
 * 가 지문으로 잠근다** — 같은 줄의 둘째 호출도, 지운 자리의 예산을 쓰는 새 호출도 거기서 빨개진다.
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

// -----------------------------------------------------------------------------
// 코드 규칙 (ADR 0086, `docs/agents/code-rules.md`) — 잰 값이 이미 참인 것만 잠근다
// -----------------------------------------------------------------------------

/**
 * **모양은 셋뿐이다** — `type`(interface 0건), 상수 표, 함수. 2026-09-22 에 재어 보니 `enum` 0건,
 * `class` 는 내장을 잇는 여덟뿐이었다(`Error` 일곱, 훑기용 시계가 `Date` 하나). 제 손으로 짓는
 * 클래스가 하나 생기면 그 안의 판단은 vitest 가 닿기 어려운 자리로 들어간다(ADR 0080 의 같은 결).
 * 어느 내장을 잇는지는 `scripts/code-rules.test.ts` 가 이름으로 든다.
 */
const CODE_SHAPE = [
  { selector: "TSEnumDeclaration", message: "enum 을 쓰지 않는다 — 문자열 리터럴 유니언으로 적는다 (docs/agents/code-rules.md)" },
  {
    selector: "ClassDeclaration:not([superClass]), ClassExpression:not([superClass])",
    message: "class 는 내장(Error·Date)을 잇는 자리에만 쓴다 — 나머지는 type 과 함수다 (docs/agents/code-rules.md)",
  },
];

/** 코드에 남기는 미결은 TODO 가 아니라 ADR 의 「잠그지 않은 것」·PRD §9·이슈다 — 2026-09-22 기준 0건 */
const NO_LOOSE_ENDS = ["error", { terms: ["todo", "fixme", "xxx", "hack"], location: "anywhere" }];

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  {
    /** 안 걸리는 예외 표시는 지운다 — 남겨 두면 다음 사람이 그 줄을 또 끈다 */
    linterOptions: { reportUnusedDisableDirectives: "error" },
  },
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
  // 층의 방향 (ADR 0085) — 경로는 파일로 풀어서, 패키지는 이름으로
  // ---------------------------------------------------------------------------
  {
    files: [`src/lib/**/*.${ANY}`, `scripts/**/*.${ANY}`, `e2e/**/*.${ANY}`],
    plugins: { import: importPlugin },
    settings: { "import/resolver": { typescript: { project: "./tsconfig.json" }, node: true } },
    rules: {
      "import/no-restricted-paths": ["error", { zones: PATH_ZONES }],
      "no-restricted-syntax": ["error", NO_UNKNOWN_DYNAMIC_IMPORT, ...CODE_SHAPE],
    },
  },
  {
    /** 도메인 lib — 실행 환경도, supabase 도, React 도 모른다 */
    files: [`src/lib/**/*.${TS}`],
    ignores: ["src/lib/local-env.ts", "src/lib/**/*.live.test.ts"],
    rules: { "no-restricted-imports": ["error", { patterns: [...APP_ONLY_PACKAGES, ...NO_SUPABASE, ...NO_NODE] }] },
  },
  {
    /** 실행 환경과 운영 DB 를 아는 두 예외 — 그래도 React 와 모델은 모른다 */
    files: ["src/lib/local-env.ts", "src/lib/**/*.live.test.ts"],
    rules: { "no-restricted-imports": ["error", { patterns: APP_ONLY_PACKAGES }] },
  },

  // ---------------------------------------------------------------------------
  // 문의 자리 (ADR 0072·0078·0085)
  // ---------------------------------------------------------------------------
  {
    files: ["app/**/*.tsx"],
    rules: { "no-restricted-syntax": ["error", ...NO_DB_CALL_IN_SCREENS, ...CODE_SHAPE] },
  },
  {
    /** 화면 폴더의 .ts 도 import() 대상은 문자열이다 — 라이브 시험이 여기 산다 */
    files: [`app/**/*.${TS}`, "proxy.ts"],
    rules: { "no-restricted-syntax": ["error", NO_UNKNOWN_DYNAMIC_IMPORT, ...CODE_SHAPE] },
  },

  // ---------------------------------------------------------------------------
  // 코드 규칙 (ADR 0086, `docs/agents/code-rules.md`)
  // ---------------------------------------------------------------------------
  {
    /** 모양·미결 — 소스 전부. `no-restricted-syntax` 의 몫(enum·class)은 위 블록마다 `CODE_SHAPE` 로 든다 */
    files: [`src/**/*.${ANY}`, `app/**/*.${ANY}`, `scripts/**/*.${ANY}`, `e2e/**/*.${ANY}`, "proxy.ts"],
    rules: {
      "@typescript-eslint/consistent-type-definitions": ["error", "type"],
      "no-warning-comments": NO_LOOSE_ENDS,
    },
  },
  {
    /**
     * 앱은 `console.log` 를 안 쓴다 — 사용자에게 못 옮긴 오류를 **기록에 남기는** `console.error` 만
     * 있다(`app/db-error.ts`). 찍어 보는 자리는 `scripts/` 와, 사람이 읽으려고 돌리는 잠긴
     * 실호출 시험(`*.live.test.ts`)뿐이다 — 예외는 이름이 말한다(ADR 0085).
     */
    files: [`src/**/*.${ANY}`, `app/**/*.${ANY}`, "proxy.ts"],
    ignores: ["**/*.live.test.ts"],
    rules: { "no-console": ["error", { allow: ["error", "warn"] }] },
  },
  {
    /** 이름 있는 export 만 — `export default` 는 Next 가 요구하는 `app/` 과 루트 설정 파일에만 있다 */
    files: [`src/**/*.${ANY}`, `scripts/**/*.${ANY}`, `e2e/**/*.${ANY}`],
    rules: { "import/no-default-export": "error" },
  },
]);

export default eslintConfig;
