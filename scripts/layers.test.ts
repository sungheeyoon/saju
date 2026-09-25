/**
 * **층의 방향은 이 시험이 잠근다** (ADR 0085, `docs/architecture.md`).
 *
 * `eslint.config.mjs` 가 같은 규칙을 편집기에서 알려 주지만, 린트는 규칙마다 사각이 있다 —
 * 첫 판은 별칭의 정적 import 만 봐서 상대경로·`import()` 가 지나갔고, 둘째 판은 문자열
 * 정규식이라 `.mts` 와 백틱 `import(\`…\`)` 이 지나갔다. 여기는 **TypeScript AST** 로
 * import 를 읽는다 — 정적 · `export … from` · `import()` · `require()` · 타입 자리의 `import('…').X`
 * 다섯을 같은 자리에서 집고, 대상이 문자열 리터럴이 아닌 `import()` 는 **모르는 것이라 막는다.**
 * 대상은 확장자를 떼고 견준다 — `@/proxy.js` 가 `proxy` 와 다른 이름으로 지나가지 않게.
 *
 * 도메인 lib 끼리의 방향은 **허용 목록과 같은가**로 잰다 — 새 방향이 생기면 여기와
 * `docs/architecture.md` 를 함께 고친다. 화면 안의 DB 호출은 **호출마다 지문**을 잠근다 —
 * 표시 수를 세면 같은 줄의 둘째 호출과 예산 재사용을 못 본다.
 */
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { builtinModules } from 'node:module';
import { dirname, extname, join, relative, resolve, sep } from 'node:path';

import ts from 'typescript';
import { describe, expect, it } from 'vitest';

const ROOT = resolve(__dirname, '..');

/** 읽는 확장자 — `eslint.config.mjs` 의 glob 과 같은 목록이다. `tsconfig` 가 `.mts` 를 포함한다 */
export const SOURCE_EXTENSIONS = ['.ts', '.mts', '.cts', '.tsx', '.js', '.jsx', '.mjs', '.cjs'];

/** 도메인 lib 사이에 **지금 열려 있는** 방향 — 이것 밖의 방향은 빨개진다. `db` 는 나가는 방향이 없다 */
const ALLOWED_LIB_EDGES = new Set([
  'consent → discovery',
  'consent → presence',
  'consent → reading',
  'consent → saju',
  'discovery → saju',
  'input → local-env',
  'input → saju',
  'matching → discovery',
  'matching → saju',
  'reading → discovery',
  'reading → people',
  'reading → saju',
]);

/**
 * 화면 안에서 아직 DB 를 부르는 호출의 **지문** — `파일 :: 호출부`. **줄어들기만 한다.**
 * 하나를 문으로 옮기면 그 `eslint-disable-next-line` 을 지우고 여기서도 지운다. 여기 없는
 * 호출은 표시가 있어도 빨개진다 — 같은 줄의 둘째 호출도, 지운 자리의 예산을 쓰는 새 호출도.
 */
const SCREEN_DB_CALLS_STILL_THERE = new Set([
  "app/compat/page.tsx :: supabase.from('user_person_access')",
  "app/me/matching/page.tsx :: supabase.rpc('ensure_discovery_participation', …)",
  "app/me/people/page.tsx :: supabase.from('user_person_access')",
  "app/me/people/page.tsx :: supabase.rpc('my_person_slots')",
  "app/me/readings/[subject]/page.tsx :: supabase.from('user_person_access')",
  "app/save-for-reading.tsx :: supabaseInBrowser().rpc('my_person_slots')",
]);
const SCREEN_EXCEPTION = 'eslint-disable-next-line no-restricted-syntax';
/** `.from()` 이름이 겹치는 내장 — `eslint.config.mjs` 의 셀렉터와 같은 목록 */
const NOT_A_DB_OBJECT = /^(Array|Buffer|Uint8Array|Int32Array|Float64Array|Object|Promise|Set|Map|String)$/;

const APP_ONLY_PACKAGES = /^(react|react-dom|next|ai|openai)(\/|$)|^@ai-sdk\//;
const SUPABASE = /^@supabase\//;
const NODE = new Set(builtinModules.filter((name) => !name.startsWith('_')));
const isNodeBuiltin = (spec: string) =>
  spec.startsWith('node:') || NODE.has(spec) || NODE.has(spec.split('/')[0]);

function walk(dir: string, out: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    if (name === 'node_modules' || name.startsWith('.')) continue;
    const full = join(dir, name);
    if (statSync(full).isDirectory()) walk(full, out);
    else if (SOURCE_EXTENSIONS.includes(extname(name)) && !name.endsWith('.d.ts')) out.push(full);
  }
  return out;
}

const SOURCE_FILES = [
  ...walk(join(ROOT, 'src')),
  ...walk(join(ROOT, 'app')),
  ...walk(join(ROOT, 'scripts')),
  ...walk(join(ROOT, 'e2e')),
  join(ROOT, 'proxy.ts'),
];

const relPath = (file: string) => relative(ROOT, file).split(sep).join('/');

function parse(file: string): ts.SourceFile {
  const kind = file.endsWith('.tsx') ? ts.ScriptKind.TSX : file.endsWith('.jsx') ? ts.ScriptKind.JSX : /\.(js|mjs|cjs)$/.test(file) ? ts.ScriptKind.JS : ts.ScriptKind.TS;
  return ts.createSourceFile(file, readFileSync(file, 'utf8'), ts.ScriptTarget.Latest, true, kind);
}

/** `spec` 이 `null` 이면 대상을 **정적으로 알 수 없는** import 다 */
type Edge = { file: string; spec: string | null; target: string | null; line: number; typeOnly: boolean };

/** 대상 경로 끝의 소스 확장자 — `SOURCE_EXTENSIONS` 와 같은 목록이다 */
const SOURCE_EXTENSION_AT_END = /\.(ts|mts|cts|tsx|js|jsx|mjs|cjs)$/;

const literalOf = (node: ts.Node | undefined): string | null =>
  node && (ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node)) ? node.text : null;

function edgesOf(file: string): Edge[] {
  const source = parse(file);
  const rel = relPath(file);
  const out: Edge[] = [];
  const push = (specNode: ts.Node | undefined, at: ts.Node, typeOnly = false) => {
    const spec = literalOf(specNode);
    let target: string | null = null;
    if (spec?.startsWith('@/')) target = spec.slice(2);
    else if (spec?.startsWith('.')) target = relPath(resolve(dirname(file), spec));
    // `@/proxy.js` 와 `@/proxy` 는 같은 파일이다 — 확장자를 떼고 견준다
    if (target !== null) target = target.replace(SOURCE_EXTENSION_AT_END, '');
    out.push({ file: rel, spec, target, line: source.getLineAndCharacterOfPosition(at.getStart()).line + 1, typeOnly });
  };
  const visit = (node: ts.Node) => {
    if (ts.isImportDeclaration(node)) push(node.moduleSpecifier, node);
    else if (ts.isExportDeclaration(node) && node.moduleSpecifier) push(node.moduleSpecifier, node);
    else if (ts.isCallExpression(node)) {
      const callee = node.expression;
      if (callee.kind === ts.SyntaxKind.ImportKeyword) push(node.arguments[0], node);
      else if (ts.isIdentifier(callee) && callee.text === 'require') push(node.arguments[0], node);
    }
    // 타입 자리의 `import('…').X` — 값은 안 불러도 그 모듈의 모양에 기대는 방향이다
    else if (ts.isImportTypeNode(node)) {
      const argument = node.argument;
      push(ts.isLiteralTypeNode(argument) ? argument.literal : undefined, node, true);
    }
    ts.forEachChild(node, visit);
  };
  visit(source);
  return out;
}

const EDGES = SOURCE_FILES.flatMap(edgesOf);

const under = (path: string | null, dir: string) => path !== null && (path === dir || path.startsWith(`${dir}/`));
const libModuleOf = (path: string | null) => {
  if (!under(path, 'src/lib')) return null;
  return path!.slice('src/lib/'.length).split('/')[0].replace(/\.(m|c)?ts$/, '');
};
const say = (edge: Edge) => `${edge.file}:${edge.line} → ${edge.spec ?? '<정적으로 모르는 대상>'}`;

describe('층의 방향 (ADR 0085)', () => {
  it('import 를 실제로 읽고 있다 — 빈 목록으로 통과하지 않는다', () => {
    expect(SOURCE_FILES.length).toBeGreaterThan(200);
    expect(EDGES.length).toBeGreaterThan(500);
    // 동적 import 도 집는다 — 옮긴 라이브 시험이 그 형태로 app 을 부른다
    expect(EDGES.some((edge) => edge.file === 'app/me/reading/call.live.test.ts' && edge.target === 'app/me/reading/model')).toBe(true);
    // 타입 자리의 import() 도 집는다 — 같은 시험이 그 형태로 lib 의 타입을 부른다
    expect(
      EDGES.some((edge) => edge.typeOnly && edge.file === 'app/me/reading/call.live.test.ts' && edge.target === 'src/lib/reading/match-input-eval'),
    ).toBe(true);
  });

  it('src/lib·scripts·e2e 의 import() 대상은 문자열 리터럴이다 — 모르는 대상은 막는다', () => {
    const unknown = EDGES.filter(
      (edge) => edge.spec === null && (under(edge.file, 'src/lib') || under(edge.file, 'scripts') || under(edge.file, 'e2e')),
    );
    expect(unknown.map(say)).toEqual([]);
  });

  it('src/lib 은 app 과 관문을 모른다 — 상대경로·동적 import 포함', () => {
    const wrong = EDGES.filter(
      (edge) => under(edge.file, 'src/lib') && (under(edge.target, 'app') || edge.target === 'proxy'),
    );
    expect(wrong.map(say)).toEqual([]);
  });

  it('엔진(src/lib/saju)은 다른 도메인 lib 을 모른다', () => {
    const wrong = EDGES.filter(
      (edge) => under(edge.file, 'src/lib/saju') && under(edge.target, 'src/lib') && !under(edge.target, 'src/lib/saju'),
    );
    expect(wrong.map(say)).toEqual([]);
  });

  it('scripts 와 e2e 는 화면 모듈을 모른다', () => {
    const wrong = EDGES.filter(
      (edge) => (under(edge.file, 'scripts') || under(edge.file, 'e2e')) && under(edge.target, 'app'),
    );
    expect(wrong.map(say)).toEqual([]);
  });

  it('src/lib 은 React·Next·supabase·모델 SDK·실행 환경을 모른다 — 예외는 이름이 말한다', () => {
    const exempt = (file: string) => file === 'src/lib/local-env.ts' || file.endsWith('.live.test.ts');
    const wrong = EDGES.filter((edge) => {
      if (!under(edge.file, 'src/lib') || edge.spec === null || edge.target !== null) return false;
      if (APP_ONLY_PACKAGES.test(edge.spec)) return true;
      if (exempt(edge.file)) return false;
      return SUPABASE.test(edge.spec) || isNodeBuiltin(edge.spec);
    });
    expect(wrong.map(say)).toEqual([]);
  });

  /**
   * **공용 부품(`app/ui`)은 화면 층의 바닥이다**(G-58) — 여러 화면이 부르므로, 거기서 문 · 액션 · 클라이언트를 부르면
   * 부르는 화면 전부가 DB 와 서버에 묶인다. `app` 안에서는 제 폴더와 아래 목록의 순수 모듈만 안다. 목록에 더할 때는
   * 그 모듈이 DB · 비밀 · `'use server'` 를 모르는지 보고 `docs/architecture.md` 「그 밖의 자리」와 함께 고친다.
   */
  it('공용 부품(app/ui)은 app 안에서 제 폴더와 순수 모듈만 안다 — supabase 도 모른다', () => {
    const UI_KNOWS_IN_APP = new Set(['app/element-tone']);
    const wrong = EDGES.filter(
      (edge) =>
        under(edge.file, 'app/ui') &&
        ((under(edge.target, 'app') && !under(edge.target, 'app/ui') && !UI_KNOWS_IN_APP.has(edge.target!)) ||
          (edge.spec !== null && SUPABASE.test(edge.spec))),
    );
    expect(wrong.map(say)).toEqual([]);
    // 빈 폴더로 통과하지 않는다 — 부품이 lib 과 순수 모듈을 실제로 부르고 있다
    expect(EDGES.some((edge) => under(edge.file, 'app/ui') && edge.target === 'app/element-tone')).toBe(true);
  });

  it('도메인 lib 끼리의 방향은 허용 목록과 정확히 같다 — 문서(docs/architecture.md)가 이 목록이다', () => {
    const found = new Set<string>();
    for (const edge of EDGES) {
      const from = libModuleOf(edge.file);
      const to = libModuleOf(edge.target);
      if (from && to && from !== to) found.add(`${from} → ${to}`);
    }
    expect([...found].sort()).toEqual([...ALLOWED_LIB_EDGES].sort());
  });

  it('src/lib/db 는 타입만 낸다 — 나가는 방향이 없다', () => {
    const out = EDGES.filter((edge) => libModuleOf(edge.file) === 'db' && edge.target !== null && libModuleOf(edge.target) !== 'db');
    expect(out.map(say)).toEqual([]);
  });

  it('허용 목록에 순환이 없다', () => {
    const next = new Map<string, string[]>();
    for (const edge of ALLOWED_LIB_EDGES) {
      const [from, to] = edge.split(' → ');
      next.set(from, [...(next.get(from) ?? []), to]);
    }
    const seen = new Set<string>();
    const visit = (node: string, path: string[]): void => {
      if (path.includes(node)) throw new Error(`순환: ${[...path, node].join(' → ')}`);
      if (seen.has(node)) return;
      for (const to of next.get(node) ?? []) visit(to, [...path, node]);
      seen.add(node);
    };
    for (const node of next.keys()) visit(node, []);
  });
});

/**
 * 생성된 `Database` 가 아는 **DB 함수의 이름** — `public.Functions` 의 키.
 *
 * 표 이름은 안 든다. `person` · `match` · `reading` 은 도메인의 낱말이기도 해서 문자열로
 * 견주면 lib 이 제 말을 하는 자리마다 빨개진다. 함수 이름은 `current_beta_schedule` 처럼
 * DB 에서만 쓰는 이름이다.
 */
function dbFunctionNames(): Set<string> {
  const source = parse(join(ROOT, 'src/lib/db/database.generated.ts'));
  const names = new Set<string>();
  const membersOf = (node: ts.Node | undefined): readonly ts.TypeElement[] =>
    node && ts.isTypeLiteralNode(node) ? node.members : [];
  const named = (members: readonly ts.TypeElement[], name: string) =>
    members.find((member): member is ts.PropertySignature => ts.isPropertySignature(member) && member.name.getText(source) === name);
  ts.forEachChild(source, (node) => {
    if (!ts.isTypeAliasDeclaration(node) || node.name.text !== 'Database') return;
    const functions = named(membersOf(named(membersOf(node.type), 'public')?.type), 'Functions');
    for (const member of membersOf(functions?.type)) {
      if (ts.isPropertySignature(member)) names.add(member.name.getText(source));
    }
  });
  return names;
}

describe('src/lib 은 DB 를 부르지 않는다 (ADR 0078·0085)', () => {
  const functions = dbFunctionNames();

  it('생성된 DB 함수 이름을 실제로 읽고 있다', () => {
    expect(functions.size).toBeGreaterThan(50);
    expect(functions.has('current_beta_schedule')).toBe(true);
  });

  /**
   * 부를 문을 콜백으로 받아도 **이름을 드는 쪽이 부르는 쪽**이다 — `scheduleFrom(rpc)` 이 그렇게
   * `current_beta_schedule` 을 들고 `if (error) return null` 을 lib 안에 두었다(2026-09-25).
   * 호출 인자로 쓰인 문자열이 DB 함수 이름이면 빨개진다. 타입 인자(`rpcArgs<'…'>`)는 안 센다.
   * 예외는 위의 것과 같다 — `*.live.test.ts` 는 운영 DB 를 안다(`docs/architecture.md`).
   */
  it('src/lib 의 호출 인자에 DB 함수 이름이 없다', () => {
    const found = walk(join(ROOT, 'src/lib')).filter((file) => !file.endsWith('.live.test.ts')).flatMap((file) => {
      const source = parse(file);
      const out: string[] = [];
      const visit = (node: ts.Node) => {
        if (ts.isCallExpression(node)) {
          for (const argument of node.arguments) {
            const text = literalOf(argument);
            if (text !== null && functions.has(text)) {
              out.push(`${relPath(file)}:${source.getLineAndCharacterOfPosition(argument.getStart()).line + 1} ${oneCall(node, source)}`);
            }
          }
        }
        ts.forEachChild(node, visit);
      };
      visit(source);
      return out;
    });
    expect(found).toEqual([]);
  });
});

const oneCall = (node: ts.CallExpression, source: ts.SourceFile) => node.getText(source).replace(/\s+/g, ' ');

describe('화면 안의 DB 호출 (ADR 0072·0078·0085)', () => {
  type Call = { file: string; line: number; fingerprint: string };

  /** `.rpc()`·`.from()` 호출 — 린트 셀렉터와 같은 뜻을 AST 로 센다 */
  function dbCallsOf(file: string): Call[] {
    const source = parse(file);
    const rel = relPath(file);
    const out: Call[] = [];
    const visit = (node: ts.Node) => {
      if (ts.isCallExpression(node) && ts.isPropertyAccessExpression(node.expression)) {
        const name = node.expression.name.text;
        const object = node.expression.expression;
        const objectName = ts.isIdentifier(object) ? object.text : null;
        if ((name === 'rpc' || name === 'from') && !(objectName !== null && NOT_A_DB_OBJECT.test(objectName))) {
          const first = node.arguments[0];
          const arg = first ? (literalOf(first) !== null ? `'${literalOf(first)}'` : first.getText(source)) : '';
          const rest = node.arguments.length > 1 ? ', …' : '';
          out.push({
            file: rel,
            line: source.getLineAndCharacterOfPosition(node.getStart()).line + 1,
            fingerprint: `${rel} :: ${object.getText(source).replace(/\s+/g, '')}.${name}(${arg}${rest})`,
          });
        }
      }
      ts.forEachChild(node, visit);
    };
    visit(source);
    return out;
  }

  const screens = walk(join(ROOT, 'app')).filter((file) => file.endsWith('.tsx') || file.endsWith('.jsx'));
  const calls = screens.flatMap(dbCallsOf);

  it('화면 안의 DB 호출은 옛 자리의 지문 안에만 있다 — 줄어들기만 한다', () => {
    const strangers = calls.filter((call) => !SCREEN_DB_CALLS_STILL_THERE.has(call.fingerprint));
    expect(strangers.map((call) => `${call.file}:${call.line} ${call.fingerprint}`)).toEqual([]);
    // 지문 목록이 코드보다 길면 옮긴 자리를 여기서 안 지운 것이다 — 예산이 남는다
    const present = new Set(calls.map((call) => call.fingerprint));
    expect([...SCREEN_DB_CALLS_STILL_THERE].filter((one) => !present.has(one))).toEqual([]);
  });

  it('예외 표시는 실제 호출 바로 위에만 서고, 호출마다 하나다', () => {
    const markers = screens.flatMap((file) => {
      const lines = readFileSync(file, 'utf8').split('\n');
      return lines.flatMap((line, at) => (line.includes(SCREEN_EXCEPTION) ? [{ file: relPath(file), line: at + 1 }] : []));
    });
    // 표시 아래 두 줄 안에 이 파일의 호출 하나가 시작한다
    for (const marker of markers) {
      const covered = calls.some((call) => call.file === marker.file && call.line > marker.line && call.line <= marker.line + 2);
      expect(covered, `${marker.file}:${marker.line} 아래에 DB 호출이 없다`).toBe(true);
    }
    // 그리고 호출 수와 표시 수가 같다 — 같은 줄에 둘을 두면 표시 하나로 둘을 끄게 된다
    expect(markers.length).toBe(calls.length);
    expect(calls.length).toBe(SCREEN_DB_CALLS_STILL_THERE.size);
  });
});
