import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, join, relative, resolve, sep } from 'node:path';

import ts from 'typescript';
import { describe, expect, it } from 'vitest';

import { config } from '@/proxy';

/**
 * **`signedInUser` 는 관문(`proxy.ts`)의 matcher 안에서만 돈다** — 두 파일이 나눠 든 계약을 잰다.
 *
 * `app/auth/signed-in.ts` 는 쿠키의 서명만 확인한다(ADR 0117). 서명으로는 **서버에서 막 끊은 세션**(다른 기기에서 나감 ·
 * 지워진 계정)을 못 알아채고, 그것은 같은 요청에서 먼저 도는 관문의 `getUser` 가 알아채 그 쿠키를 걷는다. 그래서 둘은 한
 * 벌이다 — 관문이 안 도는 주소에서 `signedInUser` 가 돌면, 끊긴 세션의 쿠키가 토큰이 만료될 때까지 「로그인한 사람」으로
 * 읽힌다. 그 문장은 `signed-in.ts` 머리말에만 있었고 아무것도 안 쟀다(2026-09-28 밤샘 감사의 구조 줄).
 *
 * **무엇이 「그 주소에서 돈다」인가.** 화면 · 레이아웃 · 라우트 파일(주소의 입구)에서 정적 import 를 따라가 `signed-in.ts`
 * 에 닿으면 그 주소에서 돈다. 서버 액션도 여기 든다 — 브라우저는 액션을 **지금 화면의 주소로** POST 하므로, 화면이
 * (클라이언트 부품을 거쳐) 부르는 액션은 그 화면의 주소에서 돈다. 타입만 부르는 import 는 안 따라간다.
 *
 * **액션으로만 닿는 주소**는 관문이 액션 POST 에서만 돌아도 된다 — 화면을 그리는 GET 은 `signedInUser` 를 안 부른다.
 * 그래서 길이 `'use server'` 파일을 지나 닿으면 조건(`has` · `missing`)이 붙은 matcher 도 덮은 것으로 센다. 화면이 그리면서
 * 닿으면 조건 없는 matcher 여야 한다.
 *
 * matcher 는 **Next 가 쓰는 그 함수**(`getMiddlewareMatchers`)로 정규식을 짓는다 — 손으로 옮긴 해석은 Next 와 갈린다.
 * 잠그지 않은 것: 문자열이 아닌 `import()` 는 층 시험이 이미 막는다(`scripts/layers.test.ts`). `has` 의 조건이 실제로
 * 액션 POST 를 가리키는지는 안 본다 — 조건이 붙었으면 액션만 덮는다고 **덜** 믿을 뿐이다.
 */

const ROOT = resolve(__dirname, '../..');
const SIGNED_IN = 'app/auth/signed-in.ts';

const posix = (file: string) => relative(ROOT, file).split(sep).join('/');

function walk(dir: string, out: string[] = []): string[] {
  for (const entry of readdirSync(dir)) {
    if (entry === 'node_modules' || entry.startsWith('.')) continue;
    const path = join(dir, entry);
    if (statSync(path).isDirectory()) walk(path, out);
    else if (/\.(tsx?|mjs|js)$/.test(entry) && !/\.test\.tsx?$/.test(entry)) out.push(path);
  }
  return out;
}

const EXTENSIONS = ['.ts', '.tsx', '.mts', '.js', '.mjs'];

/** `@/…` 와 상대경로만 푼다 — 패키지는 이 계약과 무관하다 */
function resolveSpec(from: string, spec: string): string | null {
  const base = spec.startsWith('@/') ? join(ROOT, spec.slice(2)) : spec.startsWith('.') ? resolve(dirname(from), spec) : null;
  if (base === null) return null;
  for (const candidate of [base, ...EXTENSIONS.map((ext) => base + ext), ...EXTENSIONS.map((ext) => join(base, `index${ext}`))]) {
    if (existsSync(candidate) && statSync(candidate).isFile()) return candidate;
  }
  return null;
}

/** 값으로 닿는 import 만 — `import type` · `export type` 은 실행에 안 든다 */
function valueImportsOf(file: string): string[] {
  const text = readFileSync(file, 'utf8');
  const source = ts.createSourceFile(file, text, ts.ScriptTarget.Latest, true);
  const specs: string[] = [];
  const visit = (node: ts.Node) => {
    if (ts.isImportDeclaration(node) && ts.isStringLiteral(node.moduleSpecifier)) {
      const clause = node.importClause;
      const typeOnly =
        clause?.isTypeOnly === true ||
        (clause !== undefined &&
          clause.name === undefined &&
          clause.namedBindings !== undefined &&
          ts.isNamedImports(clause.namedBindings) &&
          clause.namedBindings.elements.length > 0 &&
          clause.namedBindings.elements.every((element) => element.isTypeOnly));
      if (!typeOnly) specs.push(node.moduleSpecifier.text);
    } else if (ts.isExportDeclaration(node) && node.moduleSpecifier && ts.isStringLiteral(node.moduleSpecifier)) {
      if (!node.isTypeOnly) specs.push(node.moduleSpecifier.text);
    } else if (
      ts.isCallExpression(node) &&
      node.expression.kind === ts.SyntaxKind.ImportKeyword &&
      node.arguments[0] !== undefined &&
      ts.isStringLiteralLike(node.arguments[0])
    ) {
      specs.push(node.arguments[0].text);
    }
    ts.forEachChild(node, visit);
  };
  visit(source);
  return specs.flatMap((spec) => {
    const target = resolveSpec(file, spec);
    return target === null ? [] : [target];
  });
}

const files = [...walk(join(ROOT, 'app')), ...walk(join(ROOT, 'src'))];
const edges = new Map(files.map((file) => [file, valueImportsOf(file)]));

/** 이 파일에서 값 import 를 따라가 `signed-in.ts` 에 닿는 길 — 없으면 `null` */
function pathToSignedIn(entry: string): string[] | null {
  const target = join(ROOT, SIGNED_IN);
  const came = new Map<string, string | null>([[entry, null]]);
  const queue = [entry];
  while (queue.length > 0) {
    const file = queue.shift() as string;
    if (file === target) {
      const path: string[] = [];
      for (let at: string | null = file; at !== null; at = came.get(at) ?? null) path.unshift(posix(at));
      return path;
    }
    for (const next of edges.get(file) ?? valueImportsOf(file)) {
      if (came.has(next)) continue;
      came.set(next, file);
      queue.push(next);
    }
  }
  return null;
}

/** 주소의 입구 — Next 가 주소에 매다는 파일 이름 */
const ENTRY = /\/(page|layout|template|default|loading|error|not-found|route)\.(tsx|ts)$/;

/** 입구 파일 → 그 주소의 한 예. 무리 폴더 `(x)` 는 주소에 안 들고, `[x]` 는 아무 값이나 한 칸이다 */
function routeOf(entry: string): string {
  const dir = posix(dirname(entry)).replace(/^app/, '');
  const route = dir
    .split('/')
    .filter((segment) => !/^\(.+\)$/.test(segment))
    .map((segment) => segment.replace(/^\[+\.{0,3}([^\]]+)\]+$/, 'x-$1'))
    .join('/');
  return route === '' ? '/' : route;
}

type Matcher = { regexp: string; has?: unknown[]; missing?: unknown[] };

/** Next 가 matcher 를 정규식으로 짓는 그 함수 — 공개 타입이 없어 여기서 모양을 적는다 */
const { getMiddlewareMatchers } = createRequire(import.meta.url)('next/dist/build/analysis/get-page-static-info') as {
  getMiddlewareMatchers: (matcher: unknown, nextConfig: object) => Matcher[];
};

const compiled = (matcher: unknown) =>
  getMiddlewareMatchers(matcher, {}).map((one) => ({
    regex: new RegExp(one.regexp),
    /** 조건이 붙은 matcher 는 요청 일부만 덮는다 — 화면을 그리는 GET 을 덮는다고 안 믿는다 */
    always: (one.has ?? []).length === 0 && (one.missing ?? []).length === 0,
  }));

const matchers = compiled(config.matcher);
/** 화면을 그리는 요청까지 관문이 도는가 */
const gateOnRender = (route: string) => matchers.some(({ regex, always }) => always && regex.test(route));
/** 적어도 어떤 요청(액션 POST 포함)에서 관문이 도는가 */
const gateOnSome = (route: string) => matchers.some(({ regex }) => regex.test(route));

const USE_SERVER = /^\s*['"]use server['"];?/m;
const isServerActionFile = (file: string) => USE_SERVER.test(readFileSync(join(ROOT, file), 'utf8').split('\n').slice(0, 3).join('\n'));

const entries = files.filter((file) => ENTRY.test(posix(file)) && posix(file).startsWith('app/'));
const reaching = entries
  .map((entry) => ({ entry: posix(entry), route: routeOf(entry), path: pathToSignedIn(entry) }))
  .filter((one): one is { entry: string; route: string; path: string[] } => one.path !== null)
  .map((one) => ({ ...one, byActionOnly: one.path.slice(0, -1).some(isServerActionFile) }));

/**
 * **알고 있는 어긋남 — 줄어들기만 한다.** 시험을 세운 날(2026-09-30) 있던 하나 — `/` 의 이어 보기 저장 액션 — 는 관문이
 * `/` 의 액션 POST 에서 돌게 해 닫았다(ADR 0137). 새 자리는 여기 들지 않는다 — 관문을 넓히거나 부르는 자리를 옮긴다.
 */
const KNOWN_OUTSIDE: Readonly<Record<string, string>> = {};

describe('signedInUser 는 관문의 matcher 안에서만 돈다', () => {
  /** 입구를 못 찾았거나 아무도 안 닿으면 이 시험은 아무것도 안 잰 것이다 */
  it('입구를 읽었고, 로그인을 묻는 입구가 실제로 있다', () => {
    expect(entries.length).toBeGreaterThan(40);
    expect(reaching.length).toBeGreaterThan(15);
  });

  it('화면을 그리며 로그인을 묻는 주소는 관문이 늘 돈다', () => {
    const outside = reaching
      .filter(({ byActionOnly, route }) => !byActionOnly && !gateOnRender(route) && !(route in KNOWN_OUTSIDE))
      .map(({ route, path }) => `${route} — ${path.join(' → ')}`);

    expect(outside).toEqual([]);
  });

  it('액션으로만 로그인을 묻는 주소도 관문이 액션에서는 돈다', () => {
    const outside = reaching
      .filter(({ byActionOnly, route }) => byActionOnly && !gateOnSome(route) && !(route in KNOWN_OUTSIDE))
      .map(({ route, path }) => `${route} — ${path.join(' → ')}`);

    expect(outside).toEqual([]);
  });

  /** 목록이 실물보다 오래 살지 않게 — 고쳤으면 지운다 */
  it('알고 있는 어긋남은 아직 어긋나 있다', () => {
    const stillOutside = new Set(reaching.filter(({ route }) => !gateOnSome(route)).map(({ route }) => route));

    expect(Object.keys(KNOWN_OUTSIDE).filter((route) => !stillOutside.has(route))).toEqual([]);
  });

  /**
   * **관문 밖의 주소는 로그인을 안 묻는다** — 반대 방향의 표본. 현관(`/`) · 공유 화면 · 크론 · webhook 이 `signedInUser` 에
   * 닿기 시작하면 위 시험이 붉어지지만, 이 표본은 matcher 를 넓혀 그 붉음을 지우는 길을 막는다 — 넓히면 여기가 붉다.
   */
  it.each(['/', '/saju', '/share/x-id', '/privacy', '/api/cron/reading', '/api/portone/webhook', '/api/openai/webhook'])(
    '%s 를 그리는 요청은 관문 밖이다',
    (route) => {
      expect(gateOnRender(route)).toBe(false);
    },
  );

  /** 현관은 액션만 관문을 지난다(ADR 0137) — 나머지 관문 밖 주소는 액션도 안 지난다 */
  it.each(['/saju', '/share/x-id', '/privacy', '/api/cron/reading', '/api/portone/webhook', '/api/openai/webhook'])(
    '%s 는 어떤 요청도 관문을 안 지난다',
    (route) => {
      expect(gateOnSome(route)).toBe(false);
    },
  );
});

describe('matcher 를 읽는 법', () => {
  it('`/:path*` 는 그 자리와 그 아래를 다 덮고, 이웃 이름은 안 덮는다', () => {
    const [{ regex }] = compiled('/me/:path*');

    expect(['/me', '/me/matching', '/me/chat/x-matchId'].every((route) => regex.test(route))).toBe(true);
    expect(['/meet', '/', '/compat'].some((route) => regex.test(route))).toBe(false);
  });

  it('고정 경로는 그 주소 하나다', () => {
    const [{ regex }] = compiled('/compat');

    expect(regex.test('/compat')).toBe(true);
    expect(regex.test('/compat/x')).toBe(false);
  });

  it('조건이 붙은 matcher 는 화면을 그리는 요청을 덮는다고 안 센다', () => {
    const [one] = compiled([{ source: '/', has: [{ type: 'header', key: 'next-action' }] }]);

    expect(one.regex.test('/')).toBe(true);
    expect(one.always).toBe(false);
  });

  it('무리 폴더는 주소에 안 들고, 동적 칸은 한 칸이다', () => {
    expect(routeOf(join(ROOT, 'app/me/(home)/page.tsx'))).toBe('/me');
    expect(routeOf(join(ROOT, 'app/me/chat/[matchId]/page.tsx'))).toBe('/me/chat/x-matchId');
    expect(routeOf(join(ROOT, 'app/page.tsx'))).toBe('/');
  });

  it('`use server` 파일을 액션 파일로 읽는다', () => {
    expect(isServerActionFile('app/me/actions.ts')).toBe(true);
    expect(isServerActionFile('app/me/keyed-chart-writes.ts')).toBe(false);
  });
});
