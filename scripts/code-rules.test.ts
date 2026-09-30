/**
 * **코드 규칙은 이 시험이 든다** (ADR 0086, `docs/agents/code-rules.md`).
 *
 * `eslint.config.mjs` 가 구문으로 잡을 수 있는 것(enum·class·interface·console·미결 표시·default export)은
 * 린트가 잡는다. 여기는 린트가 못 보는 것을 잰다 — **파일 이름**, **ADR 참조가 실제 파일을
 * 가리키는가**, 그리고 **탈출구의 지문**(이중 캐스트·`!`·`if (error)` 뒤에서 실패를 지우는 자리·
 * `error` 를 꺼내지도 않는 자리·예외 표시). 지문 목록은 2026-09-22 에 잰 값이고 **줄어들기만 한다** — 하나를 고치면 여기서
 * 지우고, 새 자리는 못 든다(ADR 0085 §3 의 화면 DB 호출과 같은 결).
 *
 * 수가 아니라 지문으로 잠그는 까닭은 ADR 0085 정정 둘째에 있다 — 수를 세면 하나를 지운 예산을
 * 다른 새 자리가 쓴다.
 */
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { basename, extname, join, relative, resolve, sep } from 'node:path';

import ts from 'typescript';
import { describe, expect, it } from 'vitest';

import { SUPPORT_EMAIL } from '../src/lib/account';

import { LAUNCHED, stagesOf } from './release-stage.mjs';

const ROOT = resolve(__dirname, '..');
const relPath = (file: string) => relative(ROOT, file).split(sep).join('/');

/** `scripts/layers.test.ts` 의 `SOURCE_EXTENSIONS` 와 같은 목록 */
const SOURCE_EXTENSIONS = ['.ts', '.mts', '.cts', '.tsx', '.js', '.jsx', '.mjs', '.cjs'];

function walk(dir: string, out: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    if (name === 'node_modules' || name.startsWith('.')) continue;
    const full = join(dir, name);
    if (statSync(full).isDirectory()) walk(full, out);
    else out.push(full);
  }
  return out;
}

const ALL_FILES = [...walk(join(ROOT, 'src')), ...walk(join(ROOT, 'app')), ...walk(join(ROOT, 'scripts')), ...walk(join(ROOT, 'e2e'))];
const SOURCE_FILES = [
  ...ALL_FILES.filter((file) => SOURCE_EXTENSIONS.includes(extname(file)) && !file.endsWith('.d.ts')),
  join(ROOT, 'proxy.ts'),
];
const isTest = (rel: string) => /\.(test|spec)\.(ts|tsx|mts)$/.test(rel);
/** 앱과 lib 의 **제품 코드** — 시험·검사 도구는 뺀다. 탈출구는 여기서만 센다 */
const PRODUCT_FILES = SOURCE_FILES.filter((file) => {
  const rel = relPath(file);
  return (rel.startsWith('src/') || rel.startsWith('app/') || rel === 'proxy.ts') && !isTest(rel) && !rel.endsWith('.generated.ts');
});

function parse(file: string): ts.SourceFile {
  const kind = file.endsWith('.tsx') ? ts.ScriptKind.TSX : file.endsWith('.jsx') ? ts.ScriptKind.JSX : /\.(js|mjs|cjs)$/.test(file) ? ts.ScriptKind.JS : ts.ScriptKind.TS;
  return ts.createSourceFile(file, readFileSync(file, 'utf8'), ts.ScriptTarget.Latest, true, kind);
}
const lineOf = (source: ts.SourceFile, node: ts.Node) => source.getLineAndCharacterOfPosition(node.getStart()).line + 1;
const oneLine = (text: string) => text.replace(/\s+/g, ' ').trim();

/** `파일 :: 코드` 지문을 AST 로 모은다 — 줄 번호는 지문에 안 든다(줄이 밀려도 같은 자리다) */
function fingerprints(files: readonly string[], pick: (node: ts.Node, source: ts.SourceFile) => string | null) {
  const out: { file: string; line: number; fingerprint: string }[] = [];
  for (const file of files) {
    const source = parse(file);
    const rel = relPath(file);
    const visit = (node: ts.Node) => {
      const text = pick(node, source);
      if (text !== null) out.push({ file: rel, line: lineOf(source, node), fingerprint: `${rel} :: ${text}` });
      ts.forEachChild(node, visit);
    };
    visit(source);
  }
  return out;
}

const say = (one: { file: string; line: number; fingerprint: string }) => `${one.file}:${one.line} ${one.fingerprint}`;

/**
 * 지문 목록과 코드가 **정확히** 같은가 — 낯선 것도, 목록에만 남은 것도 빨개진다.
 * 같은 지문이 둘이면 목록에도 둘을 적는다 — 집합으로 비교하면 셋째가 둘째의 이름으로 지나간다.
 */
function expectExactly(found: readonly { file: string; line: number; fingerprint: string }[], allowed: readonly string[]) {
  const budget = new Map<string, number>();
  for (const one of allowed) budget.set(one, (budget.get(one) ?? 0) + 1);
  const strangers = found.filter((one) => {
    const left = budget.get(one.fingerprint) ?? 0;
    if (left === 0) return true;
    budget.set(one.fingerprint, left - 1);
    return false;
  });
  expect(strangers.map(say), '목록에 없는 새 자리').toEqual([]);
  const leftovers = [...budget].filter(([, left]) => left > 0).map(([one, left]) => `${one} ×${left}`);
  expect(leftovers, '고쳤는데 목록에서 안 지운 자리').toEqual([]);
}

// -----------------------------------------------------------------------------
// 이름
// -----------------------------------------------------------------------------

/** `input-form.ts` · `db-error.boundary.test.ts` · `check-share.mjs` */
const KEBAB_FILE = /^[a-z0-9]+(-[a-z0-9]+)*(\.[a-z]+)*\.[a-z]+$/;
/** 엔진의 옛 규약 — `solarTerms.ts` · `zoneHistory.generated.test.ts`. 하이픈이 없다 */
const CAMEL_FILE = /^[a-z][a-zA-Z0-9]*(\.[a-z]+)*\.ts$/;
/** 폴더 — kebab, 엔진 안은 camel 도, Next 의 `[param]`·`(group)` 은 그대로 */
const KEBAB_DIR = /^[a-z0-9]+(-[a-z0-9]+)*$/;
const CAMEL_DIR = /^[a-z][a-zA-Z0-9]*$/;
const NEXT_SEGMENT = /^(\[[a-zA-Z]+\]|\([a-z-]+\))$/;

const inEngine = (rel: string) => rel.startsWith('src/lib/saju/');

describe('이름 (docs/agents/code-rules.md)', () => {
  it('파일을 실제로 읽고 있다', () => {
    expect(SOURCE_FILES.length).toBeGreaterThan(300);
    expect(SOURCE_FILES.filter((file) => inEngine(relPath(file))).length).toBeGreaterThan(80);
  });

  it('엔진 밖의 소스 파일은 kebab-case 다', () => {
    const wrong = SOURCE_FILES.map(relPath).filter((rel) => !inEngine(rel) && !KEBAB_FILE.test(basename(rel)));
    expect(wrong).toEqual([]);
  });

  it('엔진 안의 소스 파일은 camelCase 다 — 두 규약이 한 폴더에 섞이지 않는다', () => {
    const engine = SOURCE_FILES.map(relPath).filter(inEngine);
    const wrong = engine.filter((rel) => !CAMEL_FILE.test(basename(rel)));
    expect(wrong).toEqual([]);
    // 규약이 실제로 쓰이고 있다 — 한 낱말짜리만 남으면 이 시험은 아무것도 안 잰다
    expect(engine.filter((rel) => /[A-Z]/.test(basename(rel))).length).toBeGreaterThan(20);
  });

  it('폴더 이름도 같은 규약이다', () => {
    const dirs = new Set(SOURCE_FILES.map(relPath).flatMap((rel) => {
      const parts = rel.split('/');
      return parts.slice(0, -1).map((_, at) => parts.slice(0, at + 1).join('/'));
    }));
    const wrong = [...dirs].filter((dir) => {
      const name = basename(dir);
      if (NEXT_SEGMENT.test(name)) return false;
      return inEngine(`${dir}/`) ? !CAMEL_DIR.test(name) : !KEBAB_DIR.test(name);
    });
    expect(wrong).toEqual([]);
  });

  it('시험은 소스 옆에 `*.test.ts` 로 산다 — `__tests__` 폴더도, e2e 밖의 `*.spec.ts` 도 없다', () => {
    const rels = ALL_FILES.map(relPath);
    expect(rels.filter((rel) => rel.split('/').includes('__tests__'))).toEqual([]);
    expect(rels.filter((rel) => rel.endsWith('.spec.ts') && !rel.startsWith('e2e/'))).toEqual([]);
    expect(rels.filter((rel) => /\.test\.(ts|tsx|mts)$/.test(rel) && rel.startsWith('e2e/'))).toEqual([]);
    expect(rels.filter((rel) => rel.endsWith('.test.tsx'))).toEqual([]);
  });

  it('시험 파일의 중간 이름은 넷 중 하나이거나 없다 — live · boundary · external · generated', () => {
    // 기본 이름 뒤의 점 구간 **전체**를 뗀다 — 마지막 칸만 보면 `x.weird.live.test.ts` 가 `live` 로 지나간다
    const ALLOWED = new Set(['boundary', 'external', 'generated', 'live']);
    const seen = new Set<string>();
    const wrong: string[] = [];
    for (const rel of ALL_FILES.map(relPath)) {
      const name = basename(rel);
      if (!name.endsWith('.test.ts')) continue;
      const between = name.slice(name.indexOf('.') + 1, -'.test.ts'.length);
      if (between === '') continue;
      if (ALLOWED.has(between)) seen.add(between);
      else wrong.push(rel);
    }
    expect(wrong).toEqual([]);
    expect([...seen].sort()).toEqual([...ALLOWED].sort());
  });

  it('마이그레이션은 시각 + 영어 문장, pgTAP 은 두 자리 번호 + 영어 문장이다', () => {
    const migrations = readdirSync(join(ROOT, 'supabase/migrations'));
    expect(migrations.length).toBeGreaterThan(50);
    expect(migrations.filter((name) => !/^\d{14}_[a-z0-9_]+\.sql$/.test(name))).toEqual([]);
    const pgtap = readdirSync(join(ROOT, 'supabase/tests'));
    expect(pgtap.length).toBeGreaterThan(20);
    expect(pgtap.filter((name) => !/^\d{2}_[a-z0-9_]+(\.test)?\.sql$/.test(name))).toEqual([]);
  });
});

// -----------------------------------------------------------------------------
// ADR 참조
// -----------------------------------------------------------------------------

const ADR_DIR = join(ROOT, 'docs/adr');
const ADR_FILES = readdirSync(ADR_DIR).filter((name) => name.endsWith('.md'));
const ADR_NUMBERS = new Set(ADR_FILES.map((name) => name.slice(0, 4)));

/** 루트의 설정 파일 — `playwright.config.ts` 처럼 ADR 을 가리키는 것이 있다 */
const ROOT_FILES = readdirSync(ROOT)
  .filter((name) => SOURCE_EXTENSIONS.includes(extname(name)) && !name.endsWith('.d.ts'))
  .map((name) => join(ROOT, name));

/** ADR 참조가 사는 곳 — 코드·루트 설정·SQL·문서 전부 */
const REFERRING_FILES = [
  ...SOURCE_FILES,
  ...ROOT_FILES.filter((file) => file !== join(ROOT, 'proxy.ts')),
  ...walk(join(ROOT, 'supabase')).filter((file) => file.endsWith('.sql')),
  ...walk(join(ROOT, 'docs')).filter((file) => file.endsWith('.md')),
  join(ROOT, 'CONTEXT.md'),
  join(ROOT, 'README.md'),
];

describe('ADR 참조 (docs/agents/code-rules.md)', () => {
  it('ADR 파일은 `NNNN-영어-문장.md` 이고 번호가 빈틈없이 이어진다', () => {
    expect(ADR_FILES.filter((name) => !/^\d{4}-[a-z0-9]+(-[a-z0-9]+)*\.md$/.test(name))).toEqual([]);
    const numbers = [...ADR_NUMBERS].map(Number).sort((a, b) => a - b);
    expect(numbers[0]).toBe(1);
    expect(numbers.at(-1)).toBe(numbers.length);
  });

  it('코드·SQL·문서의 `ADR NNNN` 은 전부 있는 파일을 가리킨다', () => {
    const dangling: string[] = [];
    let seen = 0;
    for (const file of REFERRING_FILES) {
      const text = readFileSync(file, 'utf8');
      for (const match of text.matchAll(/\bADR (\d{4}(?:·\d{4})*)\b/g)) {
        for (const number of match[1].split('·')) {
          seen += 1;
          if (!ADR_NUMBERS.has(number)) dangling.push(`${relPath(file)}: ADR ${number}`);
        }
      }
    }
    expect(seen).toBeGreaterThan(700);
    expect(dangling).toEqual([]);
  });

  it('표기는 `ADR 0085` 하나다 — 붙여 쓰거나 하이픈으로 잇거나 자릿수를 줄이지 않는다', () => {
    const odd: string[] = [];
    for (const file of REFERRING_FILES) {
      const text = readFileSync(file, 'utf8');
      for (const match of text.matchAll(/\bADR(?:-\d|\d|\s\d{1,3}\b|\s\d{5,})/g)) {
        odd.push(`${relPath(file)}: ${match[0]}`);
      }
    }
    expect(odd).toEqual([]);
  });
});

// -----------------------------------------------------------------------------
// 탈출구 — 제품 코드의 지문. 줄어들기만 한다
// -----------------------------------------------------------------------------

/** `x as unknown as T` — 타입이 못 잇는 자리를 손으로 잇는 것. `as never as` · `as any as` 도 같은 예산이다 */
const DOUBLE_CASTS_STILL_THERE = [
  'app/me/account.ts :: data as unknown as T',
  'app/me/person-input.ts :: data as unknown as StoredInput',
  'app/me/person-input.ts :: row as unknown as StoredInput',
  'app/me/reading/pipeline.ts :: (data ?? []) as unknown as FrozenJob[]',
  'app/me/reading/pipeline.ts :: (data ?? []) as unknown as FrozenJob[]',
  "app/me/reading/target.ts :: null as unknown as ReadingTarget['kind']",
  'app/shared-pillar.ts :: chart as unknown as SharedPillarChart',
];

/** `x!` — 「있다」를 타입 대신 사람이 주장하는 것 */
const NON_NULL_STILL_THERE = [
  'app/me/person-input.ts :: data!',
  'app/saju-calculator.tsx :: model!',
  'src/lib/reading/summary.ts :: pillars[position]!',
  'src/lib/saju/analysis/effectiveElements.ts :: pillars[key]!',
  'src/lib/saju/analysis/favorability.ts :: ELEMENTS.find((element) => !assigned.includes(element))!',
  "src/lib/saju/analysis/structure.ts :: HIDDEN_STEMS[monthBranch].find((hidden) => hidden.role === '正氣')!",
  "src/lib/saju/analysis/structure.ts :: candidates.find((candidate) => candidate.role === '正氣')!",
  "src/lib/saju/analysis/structure.ts :: candidates.find((candidate) => candidate.role === '正氣')!",
  "src/lib/saju/analysis/structure.ts :: candidates.find((candidate) => candidate.role === '正氣')!",
  "src/lib/saju/analysis/tenGods.ts :: forPillar('day')!",
  "src/lib/saju/analysis/tenGods.ts :: forPillar('month')!",
  "src/lib/saju/analysis/tenGods.ts :: forPillar('year')!",
];

/**
 * `if (error) return null` — 「DB 실패」와 「성공했는데 없음」을 한 값으로 합치는 자리(ADR 0078).
 * 새로 쓰는 문은 `dbFailure`·`SkippableRead`·`userFacingDbMessage` 셋 중 하나로 말한다.
 */
const ERROR_SWALLOWS_STILL_THERE = [
  'app/me/reading/pipeline.ts :: if (error) return;',
  'app/person-slots.ts :: if (error) return null;',
];

/**
 * `const { data } = await supabase.from(…)` — `error` 를 **꺼내지도 않는** 자리. `if (error) return null` 보다
 * 한 걸음 더 간다 — 실패가 `data: null` 이 되어 「없음」과 같은 길로 흐른다(ADR 0078).
 * 지문은 `파일 :: 꺼내는 모양 ← DB 호출` 이다. 2026-09-25 에 잰 열둘을 같은 날 다 고쳤다 — 예산 0 이다.
 */
const ERRORS_NEVER_READ_STILL_THERE: readonly string[] = [];
/**
 * `await supabase.rpc(…)` 을 **문장으로** 두는 자리 — 결과를 통째로 버린다. supabase 는 거절을 던지지 않고 `{ error }` 로
 * 내므로, 이 모양은 실패를 아무 데도 안 남긴다(ADR 0078). `{ data }` 만 꺼내는 자리(위)의 형제이고, 그 시험이 구조분해만
 * 봐서 이 모양이 지나갔다(2026-09-25 에 쟀다, 아홉 — 그중 `app/api` 둘은 같은 날 고쳤다).
 *
 * 남은 자리는 없다 — 예산 0 이다. 뒤에서 받치는 쓰기(복구기 · 만료가 닫는 일감)라도 `error` 를 꺼내 기록(`console.error`)에
 * 남긴다. 풀이의 여섯(`app/me/reading/collect.ts` · `pipeline.ts`)과 `app/me/discovery/participation.ts` 를 2026-09-26 에
 * 그렇게 고쳤다.
 */
const DB_RESULTS_DROPPED_STILL_THERE: readonly string[] = [];
/** `.from()` 이름이 겹치는 내장 — `scripts/layers.test.ts` 의 `NOT_A_DB_OBJECT` 와 같은 목록 */
const NOT_A_DB_OBJECT = /^(Array|Buffer|Uint8Array|Int32Array|Float64Array|Object|Promise|Set|Map|String)$/;

/** 식 안의 첫 `.rpc()`·`.from()` 호출 — 층 시험의 화면 DB 호출 지문과 같은 모양으로 적는다 */
function dbCallIn(node: ts.Node, source: ts.SourceFile): string | null {
  if (ts.isCallExpression(node) && ts.isPropertyAccessExpression(node.expression)) {
    const name = node.expression.name.text;
    const object = node.expression.expression;
    const objectName = ts.isIdentifier(object) ? object.text : null;
    if ((name === 'rpc' || name === 'from') && !(objectName !== null && NOT_A_DB_OBJECT.test(objectName))) {
      const first = node.arguments[0];
      const arg = first ? (ts.isStringLiteral(first) ? `'${first.text}'` : first.getText(source)) : '';
      const rest = node.arguments.length > 1 ? ', …' : '';
      return `${object.getText(source).replace(/\s+/g, '')}.${name}(${arg}${rest})`;
    }
  }
  return ts.forEachChild(node, (child) => dbCallIn(child, source) ?? undefined) ?? null;
}

/** `{ data }` 가 `error` 를 꺼내지 않는다 — `...rest` 는 `error` 를 들고 가므로 꺼낸 것으로 친다 */
const leavesErrorBehind = (pattern: ts.ObjectBindingPattern) =>
  !pattern.elements.some((element) => {
    if (element.dotDotDotToken) return true;
    const key = element.propertyName ?? element.name;
    return (ts.isIdentifier(key) || ts.isStringLiteral(key)) && key.text === 'error';
  });

/** 층 시험이 세는 화면 DB 호출 표시는 여기서 안 센다 */
const COUNTED_BY_LAYERS = 'no-restricted-syntax';
/** 그 밖의 예외 표시 — `파일 :: 규칙` */
const DISABLES_STILL_THERE = [
  'app/me/avatar.tsx :: @next/next/no-img-element',
  'app/me/matching/candidate-photo.tsx :: @next/next/no-img-element',
  'app/me/profile/photo-grid.tsx :: @next/next/no-img-element',
];
/** 까닭(`-- …`) 없이 선 표시 — 새 표시는 까닭을 적는다 */
const DISABLES_WITHOUT_A_REASON: readonly string[] = [];

/** class 가 잇는 것 — `Error` 가 아니면 이름으로 든다 */
const CLASSES_NOT_EXTENDING_ERROR = ['scripts/fake-clock.mjs :: Shifted extends Real'];

const isAs = (node: ts.Node): node is ts.AsExpression => ts.isAsExpression(node);
/** 이중 캐스트의 가운데 — `unknown` · `never` · `any` 셋 다 타입 검사를 건너뛴다 */
const isUnknown = (type: ts.TypeNode) =>
  type.kind === ts.SyntaxKind.UnknownKeyword || type.kind === ts.SyntaxKind.NeverKeyword || type.kind === ts.SyntaxKind.AnyKeyword;

describe('탈출구의 지문 (docs/agents/code-rules.md) — 줄어들기만 한다', () => {
  it('제품 코드를 실제로 읽고 있다', () => {
    expect(PRODUCT_FILES.length).toBeGreaterThan(150);
  });

  it('`as unknown as` 는 옛 자리 일곱에만 있다 — `as never as` · `as any as` 도 같은 예산이다', () => {
    const found = fingerprints(PRODUCT_FILES, (node, source) =>
      isAs(node) && isAs(node.expression) && isUnknown(node.expression.type) ? oneLine(node.getText(source)) : null,
    );
    expectExactly(found, DOUBLE_CASTS_STILL_THERE);
  });

  it('`!` 단언은 옛 자리 열둘에만 있다', () => {
    const found = fingerprints(PRODUCT_FILES, (node, source) => (ts.isNonNullExpression(node) ? oneLine(node.getText(source)) : null));
    expectExactly(found, NON_NULL_STILL_THERE);
  });

  it('`if (error)` 뒤에서 실패를 값 없이 지우는 자리는 옛 자리 셋뿐이다 (ADR 0078)', () => {
    // `error` · `x.error` 를 조건으로, 또는 `error || …` 의 한 갈래로 드는 if 다
    const isError = (node: ts.Expression): boolean =>
      (ts.isIdentifier(node) && node.text === 'error') || (ts.isPropertyAccessExpression(node) && node.name.text === 'error');
    const isNothing = (node: ts.Expression): boolean =>
      node.kind === ts.SyntaxKind.NullKeyword || (ts.isIdentifier(node) && node.text === 'undefined');
    const isInequality = (kind: ts.SyntaxKind): boolean =>
      kind === ts.SyntaxKind.ExclamationEqualsEqualsToken || kind === ts.SyntaxKind.ExclamationEqualsToken;
    const namesError = (node: ts.Expression): boolean =>
      isError(node) ||
      (ts.isBinaryExpression(node) && node.operatorToken.kind === ts.SyntaxKind.BarBarToken && (namesError(node.left) || namesError(node.right))) ||
      // `error !== null` · `null != error` 도 같은 물음이다(2026-09-28 에 넓혔다 — `app/me/account.ts` 가 이 모양으로 지나갔다)
      (ts.isBinaryExpression(node) && isInequality(node.operatorToken.kind) &&
        ((isError(node.left) && isNothing(node.right)) || (isNothing(node.left) && isError(node.right)))) ||
      (ts.isParenthesizedExpression(node) && namesError(node.expression));
    /** 값이 전부 글자 그대로인 객체 — `{ ok: false }` 처럼 실패를 「못 했다」 하나로만 내고 원문을 안 싣는다 */
    const isLiteral = (node: ts.Expression): boolean =>
      node.kind === ts.SyntaxKind.NullKeyword ||
      node.kind === ts.SyntaxKind.TrueKeyword ||
      node.kind === ts.SyntaxKind.FalseKeyword ||
      ts.isNumericLiteral(node) ||
      ts.isStringLiteral(node) ||
      (ts.isIdentifier(node) && node.text === 'undefined');
    const isBareObject = (node: ts.Expression): boolean =>
      ts.isObjectLiteralExpression(node) &&
      node.properties.every((property) => ts.isPropertyAssignment(property) && isLiteral(property.initializer));
    const swallows = (node: ts.Node, source: ts.SourceFile): string | null => {
      if (!ts.isIfStatement(node) || !namesError(node.expression)) return null;
      const body = ts.isBlock(node.thenStatement) && node.thenStatement.statements.length === 1 ? node.thenStatement.statements[0] : node.thenStatement;
      if (!ts.isReturnStatement(body)) return null;
      const value = body.expression;
      const empty =
        value === undefined ||
        value.kind === ts.SyntaxKind.NullKeyword ||
        value.kind === ts.SyntaxKind.FalseKeyword ||
        (ts.isIdentifier(value) && value.text === 'undefined') ||
        (ts.isArrayLiteralExpression(value) && value.elements.length === 0) ||
        ts.isNumericLiteral(value) ||
        isBareObject(value);
      return empty ? `if (${oneLine(node.expression.getText(source))}) ${oneLine(body.getText(source))}` : null;
    };
    expectExactly(fingerprints(PRODUCT_FILES, swallows), ERROR_SWALLOWS_STILL_THERE);
  });

  it('DB 결과에서 `error` 를 꺼내지 않는 자리는 없다 (ADR 0078)', () => {
    // `const { data } = await …from(…)` 과 `const [{ data }] = await Promise.all([…from(…)])` 의 한 칸
    const unread = (pattern: ts.BindingName, value: ts.Expression | undefined, source: ts.SourceFile): string | null => {
      if (!ts.isObjectBindingPattern(pattern) || value === undefined || !leavesErrorBehind(pattern)) return null;
      const call = dbCallIn(value, source);
      return call === null ? null : `${oneLine(pattern.getText(source))} ← ${call}`;
    };
    const found = PRODUCT_FILES.flatMap((file) => {
      const source = parse(file);
      const rel = relPath(file);
      const out: { file: string; line: number; fingerprint: string }[] = [];
      const note = (at: ts.Node, text: string | null) => {
        if (text !== null) out.push({ file: rel, line: lineOf(source, at), fingerprint: `${rel} :: ${text}` });
      };
      const visit = (node: ts.Node) => {
        if (ts.isVariableDeclaration(node) && node.initializer && ts.isAwaitExpression(node.initializer)) {
          const awaited = node.initializer.expression;
          if (ts.isObjectBindingPattern(node.name)) note(node, unread(node.name, awaited, source));
          else if (
            ts.isArrayBindingPattern(node.name) &&
            ts.isCallExpression(awaited) &&
            awaited.expression.getText(source) === 'Promise.all' &&
            awaited.arguments[0] !== undefined &&
            ts.isArrayLiteralExpression(awaited.arguments[0])
          ) {
            const slots = awaited.arguments[0].elements;
            node.name.elements.forEach((element, at) => {
              if (ts.isBindingElement(element)) note(element, unread(element.name, slots[at], source));
            });
          }
        }
        ts.forEachChild(node, visit);
      };
      visit(source);
      return out;
    });
    expectExactly(found, ERRORS_NEVER_READ_STILL_THERE);
  });

  it('DB 결과를 문장으로 버리는 자리는 없다 — 예산 0 이다 (ADR 0078)', () => {
    // `await x.rpc(…)` · `void x.from(…).update(…)` — 식이 곧 문장이다. `.then` · `.catch` 로 받는 사슬은 받은 것으로 친다
    const rootCall = (node: ts.Expression): ts.CallExpression | null => {
      if (ts.isCallExpression(node) && ts.isPropertyAccessExpression(node.expression)) {
        const name = node.expression.name.text;
        if (name === 'then' || name === 'catch') return null;
        if (dbCallIn(node, node.getSourceFile()) !== null && (name === 'rpc' || name === 'from')) return node;
        return rootCall(node.expression.expression);
      }
      return null;
    };
    const found = fingerprints(PRODUCT_FILES, (node, source) => {
      if (!ts.isExpressionStatement(node)) return null;
      let expression = node.expression;
      if (ts.isVoidExpression(expression)) expression = expression.expression;
      if (ts.isAwaitExpression(expression)) expression = expression.expression;
      const call = rootCall(expression);
      return call === null ? null : dbCallIn(call, source);
    });
    expectExactly(found, DB_RESULTS_DROPPED_STILL_THERE);
  });

  it('`@ts-expect-error` 는 없다 — 타입 오류를 끄는 표시도 예산 0 이다', () => {
    const found = PRODUCT_FILES.flatMap((file) =>
      readFileSync(file, 'utf8')
        .split('\n')
        .flatMap((line, at) => (/(\/\/|\/\*)\s*@ts-expect-error/.test(line) ? [`${relPath(file)}:${at + 1} ${line.trim()}`] : [])),
    );
    expect(found).toEqual([]);
  });

  it('예외 표시는 `eslint-disable-next-line 규칙 -- 까닭` 한 줄뿐이다 — 파일째 끄지 않는다', () => {
    const found: { file: string; line: number; fingerprint: string }[] = [];
    const withoutReason: string[] = [];
    const wrongForm: string[] = [];
    for (const file of SOURCE_FILES) {
      const rel = relPath(file);
      const lines = readFileSync(file, 'utf8').split('\n');
      lines.forEach((line, at) => {
        // tsconfig 의 target 이 ES2017 이라 이름 붙은 그룹을 못 쓴다 — 차례로 형태 · 규칙 · 까닭이다
        const match = /(?:\/\/|\/\*|\{\/\*)\s*eslint-disable(-next-line|-line)?\s*([@\w/-]+)?(\s+--\s+\S)?/.exec(line);
        if (!match) return;
        const [, form, rule, reason] = match;
        // 주석 본문이 이 표시를 **말하는** 자리(`` `eslint-disable-next-line` 을 지우고 ``)는 표시가 아니다
        if (/[`「]\s*eslint-disable/.test(line)) return;
        if (form !== '-next-line' || !rule) {
          wrongForm.push(`${rel}:${at + 1} ${line.trim()}`);
          return;
        }
        if (rule === COUNTED_BY_LAYERS) return;
        const fingerprint = `${rel} :: ${rule}`;
        found.push({ file: rel, line: at + 1, fingerprint });
        if (!reason) withoutReason.push(fingerprint);
      });
    }
    expect(wrongForm).toEqual([]);
    expectExactly(found, DISABLES_STILL_THERE);
    expect(withoutReason).toEqual(DISABLES_WITHOUT_A_REASON);
  });

  it('class 는 Error 를 잇는다 — 다른 것을 잇는 자리는 이름으로 든다', () => {
    const found = fingerprints(SOURCE_FILES, (node, source) => {
      if (!ts.isClassDeclaration(node) && !ts.isClassExpression(node)) return null;
      const heritage = node.heritageClauses?.find((clause) => clause.token === ts.SyntaxKind.ExtendsKeyword);
      const parent = heritage?.types[0]?.expression.getText(source) ?? null;
      if (parent === 'Error') return null;
      return `${node.name?.text ?? '(이름 없음)'} extends ${parent ?? '(없음)'}`;
    });
    expectExactly(found, CLASSES_NOT_EXTENDING_ERROR);
    // 규칙이 실제로 쓰이고 있다 — Error 를 잇는 클래스가 있어야 이 단언이 무엇인가를 잰 것이다
    const errors = fingerprints(SOURCE_FILES, (node) => (ts.isClassDeclaration(node) ? node.name?.text ?? null : null));
    expect(errors.length).toBeGreaterThan(5);
  });

  it('import 는 홑따옴표다', () => {
    const found = fingerprints(SOURCE_FILES, (node, source) => {
      const spec = ts.isImportDeclaration(node) || ts.isExportDeclaration(node) ? node.moduleSpecifier : undefined;
      return spec && spec.getText(source).startsWith('"') ? oneLine(node.getText(source)) : null;
    });
    expect(found.map(say)).toEqual([]);
  });
});

// -----------------------------------------------------------------------------
// 에이전트가 먼저 읽는 문서 — 가리키는 파일이 있다
// -----------------------------------------------------------------------------

/** 세션마다 처음 읽히는 문서 — 여기 적힌 경로가 낡으면 에이전트가 없는 파일을 찾아 헤맨다 */
const ENTRY_DOCS = [
  join(ROOT, 'CLAUDE.md'),
  join(ROOT, 'AGENTS.md'),
  join(ROOT, 'CONTEXT.md'),
  join(ROOT, 'docs/product/gaps.md'),
  join(ROOT, 'README.md'),
  join(ROOT, 'docs/architecture.md'),
  join(ROOT, 'docs/ops/runbook.md'),
  ...readdirSync(join(ROOT, 'docs/agents')).map((name) => join(ROOT, 'docs/agents', name)),
  join(ROOT, 'docs/start.md'),
  ...readdirSync(join(ROOT, 'docs/roles')).map((name) => join(ROOT, 'docs/roles', name)),
];
/** 저장소 뿌리에서 시작하는 경로만 잰다 — `person-input.ts` 같은 줄임과 `NNNN-….md` 같은 틀은 경로가 아니다 */
const ROOTED_PATH = /^(app|src|scripts|e2e|docs|supabase|public|\.github)\/[A-Za-z0-9_.\/\[\]-]+$/;

describe('금지어 (docs/agents/code-rules.md)', () => {
  /**
   * 「맛보기」는 화면에서 걷었고(#349) 한국어로는 「로그인 전 결과」로 부른다(`CONTEXT.md`, 2026-09-30). 주석에 남은
   * 낱말이 다음 작업에서 화면 글자로 다시 번졌으므로 **주석까지** 센다 — 예산 0 이다.
   */
  it('화면 파일(`app/**/*.tsx`)에 「맛보기」가 없다 — 주석도', () => {
    const screens = SOURCE_FILES.filter((file) => relPath(file).startsWith('app/') && file.endsWith('.tsx'));
    expect(screens.length).toBeGreaterThan(50);
    const found = screens.filter((file) => readFileSync(file, 'utf8').includes('맛보기')).map(relPath);
    expect(found).toEqual([]);
  });
});

describe('입구 문서가 가리키는 경로 (docs/agents/test-map.md)', () => {
  it('백틱 안의 뿌리 경로는 전부 있는 파일이나 폴더다 — 옮기면 문서도 옮긴다', () => {
    const missing: string[] = [];
    let seen = 0;
    for (const doc of ENTRY_DOCS) {
      const text = readFileSync(doc, 'utf8');
      for (const match of text.matchAll(/`([^`\s]+)`/g)) {
        const token = match[1];
        if (!ROOTED_PATH.test(token) || token.includes('*')) continue;
        seen += 1;
        // 모듈 경로는 확장자 없이 적는다(`app/auth/config`) — 소스 확장자 중 하나로 있으면 된다
        const exists = [''].concat(SOURCE_EXTENSIONS).some((ext) => existsSync(join(ROOT, token + ext)));
        if (!exists) missing.push(`${relPath(doc)}: ${token}`);
      }
    }
    expect(seen).toBeGreaterThan(60);
    expect(missing).toEqual([]);
  });

  /** 문서가 시키는 명령이 없으면 에이전트는 그 자리에서 멈추거나 비슷한 이름을 지어 부른다 */
  it('`npm run <이름>` 은 전부 package.json 에 있는 스크립트다 — 이름을 바꾸면 문서도 바꾼다', () => {
    const scripts = new Set(
      Object.keys((JSON.parse(readFileSync(join(ROOT, 'package.json'), 'utf8')) as { scripts: Record<string, string> }).scripts),
    );
    const missing: string[] = [];
    let seen = 0;
    for (const doc of ENTRY_DOCS) {
      for (const match of readFileSync(doc, 'utf8').matchAll(/npm run ([a-z][a-z0-9:-]*[a-z0-9])/g)) {
        seen += 1;
        if (!scripts.has(match[1])) missing.push(`${relPath(doc)}: npm run ${match[1]}`);
      }
    }
    expect(seen).toBeGreaterThan(40);
    expect(missing).toEqual([]);
  });
});

// -----------------------------------------------------------------------------
// 운영 소스의 주석이 가리키는 파일 — 있다
// -----------------------------------------------------------------------------

/**
 * 주석이 가리키는 경로를 읽는 곳 — **지금 도는 운영 소스**(`app/**` · `src/**` · `proxy.ts` 의 `.ts` · `.tsx`, 시험 빼고).
 * 마이그레이션 · pgTAP · e2e · scripts 는 범위 밖이다 — 마이그레이션은 그날의 기록이고, 나머지는 도구다.
 */
const COMMENTED_SOURCE = SOURCE_FILES.filter((file) => {
  const rel = relPath(file);
  return (rel.startsWith('app/') || rel.startsWith('src/') || rel === 'proxy.ts') && /\.tsx?$/.test(rel) && !isTest(rel);
});

/**
 * **없는 파일을 일부러 말하는 주석** — `파일 :: 경로` 와 까닭 한 줄. 옛 자리를 적는 역사 설명(「…였다」 · 「살다가 왔다」)과
 * 두지 않은 자리를 가정하는 문장이다. 2026-09-28 에 잰 넷이고, 주석을 고치거나 지우면 여기서도 지운다 — 안 쓰이는
 * 항목은 시험이 잡는다(목록이 썩지 않게).
 */
const COMMENT_PATHS_NOT_THERE: readonly { at: string; why: string; ignored?: true }[] = [
  { at: 'app/me/(home)/loading.tsx :: app/me/loading.tsx', why: '가정 — 뼈대를 그 자리에 두면 /me 아래가 다 이 뼈대로 연다(그래서 안 둔다)' },
  { at: 'app/ui/surfaces.ts :: app/card.ts', why: '역사 — 카드 판이 따로 살던 옛 파일(2026-09-26 에 이 파일로 왔다)' },
  {
    at: 'src/lib/local-env.ts :: supabase/.env.local',
    why: '무시된 파일 — 워크트리마다 `stack:slot` 이 짓고 저장소에는 없다',
    // 디스크에 있든 없든 쓰인 항목이다 — 자리를 받은 워크트리에서만 있어 로컬만 붉었다(2026-09-30)
    ignored: true,
  },
  { at: 'src/lib/reading/parts.ts :: src/lib/saju/evidence/prompt.ts', why: '역사 — 이 파일이 엔진 안에 있던 옛 자리(ADR 0047)' },
];

/** 한 파일의 주석 전부 — `//` · `/* *\/` · JSDoc, JSX 안의 `{/* *\/}` 도. JSX 글자(`JsxText`)는 주석이 아니다 */
function commentsOf(file: string): { text: string; pos: number; source: ts.SourceFile }[] {
  const source = parse(file);
  const text = source.getFullText();
  const jsxText: [number, number][] = [];
  const ranges = new Map<number, ts.CommentRange>();
  const visit = (node: ts.Node) => {
    if (node.kind === ts.SyntaxKind.JsxText) {
      jsxText.push([node.pos, node.end]);
      return;
    }
    for (const range of ts.getLeadingCommentRanges(text, node.pos) ?? []) ranges.set(range.pos, range);
    for (const range of ts.getTrailingCommentRanges(text, node.end) ?? []) ranges.set(range.pos, range);
    node.getChildren(source).forEach(visit);
  };
  visit(source);
  return [...ranges.values()]
    .filter((range) => !jsxText.some(([from, to]) => range.pos >= from && range.pos < to))
    .map((range) => ({ text: text.slice(range.pos, range.end), pos: range.pos, source }));
}

describe('운영 소스의 주석이 가리키는 경로', () => {
  it('주석의 백틱 안 뿌리 경로는 있는 파일이나 폴더다 — 옛 자리를 말하는 주석은 이름과 까닭으로 든다', () => {
    const allowed = new Set(COMMENT_PATHS_NOT_THERE.map((one) => one.at));
    const ignored = new Set(COMMENT_PATHS_NOT_THERE.filter((one) => one.ignored).map((one) => one.at));
    const missing: string[] = [];
    const used = new Set<string>();
    let seen = 0;
    for (const file of COMMENTED_SOURCE) {
      const rel = relPath(file);
      for (const comment of commentsOf(file)) {
        for (const match of comment.text.matchAll(/`([^`\s]+)`/g)) {
          const token = match[1];
          if (!ROOTED_PATH.test(token) || token.includes('*')) continue;
          seen += 1;
          const at = `${rel} :: ${token}`;
          if (ignored.has(at)) {
            used.add(at);
            continue;
          }
          // 모듈 경로는 확장자 없이 적는다(`app/auth/config`) — 소스 확장자 중 하나로 있으면 된다
          if ([''].concat(SOURCE_EXTENSIONS).some((ext) => existsSync(join(ROOT, token + ext)))) continue;
          if (allowed.has(at)) {
            used.add(at);
            continue;
          }
          const line = comment.source.getLineAndCharacterOfPosition(comment.pos + (match.index ?? 0)).line + 1;
          missing.push(`${rel}:${line} ${token}`);
        }
      }
    }
    expect(seen).toBeGreaterThan(100);
    expect(missing).toEqual([]);
    // 허용 목록이 썩지 않는다 — 주석을 고쳤거나 그 파일이 다시 생겼으면 항목을 지운다
    expect([...allowed].filter((at) => !used.has(at))).toEqual([]);
  });
});

// -----------------------------------------------------------------------------
// 용어집 ↔ 코드 (CONTEXT.md §9)
// -----------------------------------------------------------------------------

/** 용어집의 식별자를 찾는 곳 — 제품 코드와 마이그레이션. 시험과 생성 파일은 뺀다(생성 파일은 마이그레이션의 사본이다) */
const GLOSSARY_CODE = [
  ...SOURCE_FILES.filter((file) => {
    const rel = relPath(file);
    return (rel.startsWith('src/') || rel.startsWith('app/')) && !isTest(rel) && !rel.endsWith('.generated.ts');
  }),
  ...walk(join(ROOT, 'supabase/migrations')).filter((file) => file.endsWith('.sql')),
];

/** §9 표의 「코드」 칸 — 백틱 토큰마다 `용어 :: 식별자` */
function glossaryIdentifiers(): { term: string; token: string }[] {
  const text = readFileSync(join(ROOT, 'CONTEXT.md'), 'utf8');
  const section = text.slice(text.indexOf('## 9. 용어 ↔ 코드'), text.indexOf('## 10. '));
  const out: { term: string; token: string }[] = [];
  for (const line of section.split('\n')) {
    const cells = line.split('|').map((cell) => cell.trim());
    if (cells.length < 4 || cells[1] === '용어' || cells[1].startsWith('---')) continue;
    for (const match of cells[2].matchAll(/`([^`]+)`/g)) out.push({ term: cells[1], token: match[1] });
  }
  return out;
}

describe('용어집 ↔ 코드 (CONTEXT.md §9)', () => {
  it('표의 식별자는 전부 코드나 마이그레이션에 낱말로 있다 — 이름을 바꾸면 용어집도 바꾼다', () => {
    const wanted = glossaryIdentifiers();
    expect(wanted.length).toBeGreaterThan(150);
    const corpus = GLOSSARY_CODE.map((file) => readFileSync(file, 'utf8')).join('\n');
    const missing = wanted
      .filter(({ token }) => {
        const escaped = token.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        return !new RegExp(`(^|[^A-Za-z0-9_])${escaped}(?![A-Za-z0-9_])`, 'm').test(corpus);
      })
      .map(({ term, token }) => `${term} :: ${token}`);
    expect(missing).toEqual([]);
  });

  it('§10 이 든 어긋난 이름은 아직 코드에 있다 — 고쳤으면 표에서 지운다', () => {
    const text = readFileSync(join(ROOT, 'CONTEXT.md'), 'utf8');
    const section = text.slice(text.indexOf('## 10. 어긋난 이름'));
    const corpus = [...GLOSSARY_CODE, ...SOURCE_FILES.filter((file) => relPath(file).endsWith('.tsx'))]
      .map((file) => readFileSync(file, 'utf8'))
      .join('\n');
    const stale: string[] = [];
    const appeared: string[] = [];
    let seen = 0;
    for (const line of section.split('\n')) {
      const cells = line.split('|').map((cell) => cell.trim());
      if (cells.length < 5 || cells[1] === '코드의 이름' || cells[1].startsWith('---')) continue;
      if (cells[1] === '이름 없음') {
        // 반대 방향 — 용어집의 말이 TS 타입으로 **아직 없어야** 한다. 생기면 이 행을 지운다
        const name = cells[2].trim();
        if (new RegExp(`\\b(type|interface|class|function|const) ${name}\\b`).test(corpus)) appeared.push(name);
        continue;
      }
      for (const match of cells[1].matchAll(/`([A-Za-z_][A-Za-z0-9_]*)`/g)) {
        seen += 1;
        if (!new RegExp(`(^|[^A-Za-z0-9_])${match[1]}(?![A-Za-z0-9_])`).test(corpus)) stale.push(match[1]);
      }
    }
    expect(seen).toBeGreaterThan(5);
    // 「이름 없음」 행의 수는 단언하지 않는다 — 2026-09-23 에 마지막 하나(DiscoveryProfile)가 타입을 얻어
    // 지워졌다. 다시 생기면 위 갈래가 그 행을 잰다
    expect(stale).toEqual([]);
    expect(appeared, '표는 「없다」고 하는데 코드에 생겼다').toEqual([]);
  });
});

// -----------------------------------------------------------------------------
// 간극 대장 (docs/product/gaps.md)
// -----------------------------------------------------------------------------

describe('간극 대장 (docs/product/gaps.md, ADR 0089)', () => {
  const ledger = readFileSync(join(ROOT, 'docs/product/gaps.md'), 'utf8');
  const prd = readFileSync(join(ROOT, 'docs/prd.md'), 'utf8');
  const rows = ledger
    .split('\n')
    .map((line) => line.split('|').map((cell) => cell.trim()))
    .filter((cells) => cells.length >= 6 && /^G-\d{2}$/.test(cells[1]));

  it('줄마다 번호가 하나씩이고 상태는 다섯 중 하나다', () => {
    // 파싱이 0 으로 떨어지는 것을 막는 문턱이다 — 줄이 닫혀 줄어드는 것은 정상이다. 수를 걸면 닫을 때마다
    // 문턱을 내려야 한다(2026-09-23 에 21 → 16 → 12줄, § 17 → 10)
    expect(rows.length).toBeGreaterThan(0);
    const ids = rows.map((cells) => cells[1]);
    expect(new Set(ids).size).toBe(ids.length);
    const STATES = new Set(['정했다', '미정', '어긋남', '보류', '결정 대기']);
    expect(rows.filter((cells) => !STATES.has(cells[4])).map((cells) => `${cells[1]} :: ${cells[4]}`)).toEqual([]);
  });

  it('출처의 § 는 PRD 본체에 실제로 있는 절이다 — 절을 옮기면 대장도 옮긴다', () => {
    const headings = new Set([...prd.matchAll(/^#{2,3} (\d+(?:\.\d+)*)/gm)].map((match) => match[1]));
    // §8 은 절이 아니라 번호 목록이다 — `§8.N` 은 그 목록의 N 번째 줄을 가리킨다
    const s8 = prd.slice(prd.indexOf('\n## 8. '), prd.indexOf('\n## 9. '));
    const s8Items = new Set([...s8.matchAll(/^(\d+)\. /gm)].map((match) => `8.${match[1]}`));
    const missing: string[] = [];
    let seen = 0;
    for (const cells of rows) {
      // `CONTEXT §10` 은 용어집의 절이다 — PRD 의 것만 잰다
      const source = cells[3].replace(/CONTEXT §\d+/g, '');
      for (const match of source.matchAll(/§(\d+(?:\.\d+)*)/g)) {
        seen += 1;
        if (!headings.has(match[1]) && !s8Items.has(match[1])) missing.push(`${cells[1]} :: §${match[1]}`);
      }
    }
    expect(seen).toBeGreaterThan(0);
    expect(missing).toEqual([]);
  });

  it('PRD 본체에는 개정 기록이 없다 — 계보와 「재어 본 값」은 changelog 에 산다', () => {
    expect(prd).not.toMatch(/^## 10\. /m);
    expect(prd).not.toMatch(/^### 0\.[3-8] /m);
    const changelog = readFileSync(join(ROOT, 'docs/product/prd-changelog.md'), 'utf8');
    expect(changelog).toMatch(/^## 10\. 이 문서의 계보/m);
  });
});

// -----------------------------------------------------------------------------
// 역할 문서 (docs/start.md · docs/roles/, ADR 0140)
// -----------------------------------------------------------------------------

describe('역할 문서 (docs/start.md · docs/roles/, ADR 0140)', () => {
  const START = join(ROOT, 'docs/start.md');
  const ROLES_DIR = join(ROOT, 'docs/roles');
  const AGENTS_DIR = join(ROOT, '.claude/agents');
  const roles = readdirSync(ROLES_DIR)
    .filter((name) => name.endsWith('.md'))
    .map((name) => name.replace(/\.md$/, ''));
  /** 사람과 말하는 세션 자신이라 에이전트 정의가 없는 역할 */
  const WITHOUT_AGENT = ['coordinator'];
  const COLUMNS = ['먼저 읽는 것', '이 저장소의 방식', '하지 않는 것 · 묻는 것', '끝날 때 고치는 것'];
  /** 한 화면 — 넘으면 원본으로 옮길 것을 옮겨 적고 있다는 뜻이다 */
  const MAX_BYTES = 8000;

  it('입구 표가 역할 문서 전부를 들고, 없는 역할 문서를 들지 않는다', () => {
    const start = readFileSync(START, 'utf8');
    const listed = [...start.matchAll(/`docs\/roles\/([a-z-]+)\.md`/g)].map((match) => match[1]);
    expect(roles.length).toBeGreaterThan(5);
    expect([...new Set(listed)].sort()).toEqual([...roles].sort());
  });

  it('역할 문서마다 칸 넷이 그 차례로 있고 한 화면 안이다', () => {
    for (const role of roles) {
      const text = readFileSync(join(ROLES_DIR, `${role}.md`), 'utf8');
      const headings = [...text.matchAll(/^## (.+)$/gm)].map((match) => match[1].trim());
      expect(headings, role).toEqual(COLUMNS);
      expect(Buffer.byteLength(text), role).toBeLessThanOrEqual(MAX_BYTES);
    }
  });

  it('`경로.md` 「절」 로 가리킨 절은 그 파일에 제목으로 있다 — 원본의 절을 옮기면 가리키는 쪽도 옮긴다', () => {
    const docs = [START, ...roles.map((role) => join(ROLES_DIR, `${role}.md`))];
    const missing: string[] = [];
    let seen = 0;
    for (const doc of docs) {
      const text = readFileSync(doc, 'utf8');
      for (const match of text.matchAll(/`([^`\s]+\.md)`((?:\s*(?:·\s*)?「[^」]+」)+)/g)) {
        const target = join(ROOT, match[1]);
        if (!existsSync(target)) {
          missing.push(`${relPath(doc)}: ${match[1]} (파일 없음)`);
          continue;
        }
        const headings = [...readFileSync(target, 'utf8').matchAll(/^#{1,4} (.+)$/gm)].map((heading) =>
          heading[1].replace(/\*\*/g, '').trim(),
        );
        for (const section of [...match[2].matchAll(/「([^」]+)」/g)].map((quoted) => quoted[1])) {
          seen += 1;
          if (!headings.some((heading) => heading.startsWith(section))) missing.push(`${relPath(doc)}: ${match[1]} 「${section}」`);
        }
      }
    }
    expect(seen).toBeGreaterThan(30);
    expect(missing).toEqual([]);
  });

  /**
   * 「이 저장소의 방식」은 원본을 줄인 길잡이다 — 줄마다 끝에 `(원본: …)` 을 달아 대조할 자리를 드러낸다(ADR 0140).
   * 출처는 `경로.md` 「절」 과 `ADR NNNN` 만이다. 본문에 경로나 ADR 이 우연히 있어도 그 줄의 출처로 세지 않는다.
   * 가리킨 절이 제목으로 있는지는 위 시험이 잰다.
   */
  it('「이 저장소의 방식」의 줄마다 끝에 `(원본: …)` 이 있고, 출처는 `경로.md` 「절」 이나 있는 ADR 뿐이다', () => {
    const adrs = new Set(readdirSync(join(ROOT, 'docs/adr')).map((name) => name.slice(0, 4)));
    const wrong: string[] = [];
    let seen = 0;
    for (const role of roles) {
      const text = readFileSync(join(ROLES_DIR, `${role}.md`), 'utf8');
      const start = text.indexOf('\n## 이 저장소의 방식\n');
      const section = text.slice(start + 1, text.indexOf('\n## ', start + 1));
      const bullets = section
        .split('\n')
        .slice(1)
        .reduce<string[]>((acc, line) => {
          if (line.startsWith('- ')) acc.push(line);
          else if (line.startsWith('  ') && acc.length > 0) acc[acc.length - 1] += `\n${line}`;
          return acc;
        }, []);
      expect(bullets.length, role).toBeGreaterThan(3);
      for (const bullet of bullets) {
        seen += 1;
        const source = /\n {2}\(원본: ([^\n]+)\)$/.exec(bullet)?.[1];
        const rest = source
          ?.replace(/`[^`\s]+\.md`(?:\s*(?:·\s*)?「[^」]+」)+/g, '')
          .replace(/ADR (\d{4})/g, (whole, number: string) => (adrs.has(number) ? '' : whole))
          .replace(/[\s·]/g, '');
        if (rest !== '') wrong.push(`${role}: ${bullet.split('\n')[0].slice(0, 40)}`);
      }
    }
    expect(seen).toBeGreaterThan(30);
    expect(wrong).toEqual([]);
  });

  it('에이전트 정의와 역할 문서는 짝이다 — 정의는 제 역할 문서를 가리킨다', () => {
    const agents = readdirSync(AGENTS_DIR)
      .filter((name) => name.endsWith('.md'))
      .map((name) => name.replace(/\.md$/, ''));
    expect([...agents].sort()).toEqual(roles.filter((role) => !WITHOUT_AGENT.includes(role)).sort());
    for (const agent of agents) {
      const text = readFileSync(join(AGENTS_DIR, `${agent}.md`), 'utf8');
      expect(/^name: (.+)$/m.exec(text)?.[1].trim(), agent).toBe(agent);
      expect(text, agent).toContain(`docs/roles/${agent}.md`);
    }
  });
});

// -----------------------------------------------------------------------------
// 위임 규약 (docs/agents/delegation.md, ADR 0090)
// -----------------------------------------------------------------------------

describe('위임 규약 (docs/agents/delegation.md, ADR 0090)', () => {
  const doc = readFileSync(join(ROOT, 'docs/agents/delegation.md'), 'utf8');
  const settings = JSON.parse(readFileSync(join(ROOT, '.claude/settings.json'), 'utf8')) as {
    permissions?: { ask?: string[]; deny?: string[] };
  };

  /** 권한 표에서 첫 칸이 `**N ` 으로 시작하는 줄의 잠금 칸(넷째)에 적힌 `Bash(…)` 규칙 */
  function lockedRulesOfTier(tier: string): string[] {
    return doc
      .split('\n')
      .map((line) => line.split('|').map((cell) => cell.trim()))
      .filter((cells) => cells.length >= 6 && cells[1].startsWith(`**${tier} `))
      .flatMap((cells) => [...cells[4].matchAll(/`(Bash\([^`]+\))`/g)].map((match) => match[1]));
  }

  /** 「공식 운영에 들어가면 켜는 잠금」 절의 `Bash(…)` 규칙 — 공식 운영 뒤 `ask` 로 되돌릴 목록 (ADR 0093) */
  function deferredAskRules(): string[] {
    const start = doc.indexOf('\n### 공식 운영에 들어가면 켜는 잠금');
    expect(start).toBeGreaterThan(-1);
    const end = doc.indexOf('\n## ', start + 1);
    return [...doc.slice(start, end).matchAll(/^- `(Bash\([^`]+\))`$/gm)].map((match) => match[1]);
  }

  it('권한 표의 등급 3 은 settings 의 ask 와, 등급 4 는 deny 와 정확히 같은 목록이다', () => {
    const ask = lockedRulesOfTier('3');
    const deny = lockedRulesOfTier('4');
    expect(deny.length).toBeGreaterThan(5);
    expect([...ask].sort()).toEqual([...(settings.permissions?.ask ?? [])].sort());
    expect([...deny].sort()).toEqual([...(settings.permissions?.deny ?? [])].sort());
    // 같은 규칙이 두 등급에 서 있으면 어느 쪽이 이기는지 도구가 정한다 — 문서가 그것을 안 든다
    expect(ask.filter((rule) => deny.includes(rule))).toEqual([]);
  });

  /** 출시 단계의 표와 PRD 읽기는 `scripts/release-stage.mjs` 한 곳이다 — CI 계획도 같은 것을 읽는다 (ADR 0093 · 0097) */
  const TIER_THREE_LOCKED: Record<string, boolean> = LAUNCHED;
  const stagesOfPrd = () => stagesOf(readFileSync(join(ROOT, 'docs/prd.md'), 'utf8'));

  it('PRD §7.0 의 단계는 전부 잠금 여부가 정해져 있다 — 모르는 단계는 잠금을 켜라고도 끄라고도 안 한다', () => {
    const names = stagesOfPrd().map((stage) => stage.name);
    expect(names.length).toBeGreaterThan(2);
    expect(names.filter((name) => !(name in TIER_THREE_LOCKED)), '단계 표에 더한다').toEqual([]);
  });

  it('등급 3 의 잠금은 공개 출시에 켠다 — 그 전에는 ask 가 비어 있고, 그 뒤에는 켤 목록과 같다 (ADR 0093)', () => {
    const deferred = deferredAskRules();
    const deny = lockedRulesOfTier('4');
    const ask = settings.permissions?.ask ?? [];
    expect(deferred.length).toBeGreaterThan(10);
    expect(deferred.filter((rule) => deny.includes(rule))).toEqual([]);

    const stages = stagesOfPrd().filter((stage) => stage.current).map((stage) => stage.name);
    expect(stages, 'PRD §7.0 표의 「(지금)」은 하나다').toHaveLength(1);
    expect(stages[0] in TIER_THREE_LOCKED, `${stages[0]} 은 모르는 단계다 — 단계 표에 더한다`).toBe(true);
    if (TIER_THREE_LOCKED[stages[0]]) {
      expect([...ask].sort(), 'delegation.md 「공식 운영에 들어가면 켜는 잠금」의 걸음을 밟는다').toEqual([...deferred].sort());
    } else {
      // #134 는 켤 목록 전부를 ask 와 등급 3 칸에 함께 넣어 초록이었다 — 단계를 안 옮기고는 못 켠다
      expect(ask, `지금은 ${stages[0]}다 — 등급 3 은 공개 출시 전까지 묻지 않는다`).toEqual([]);
    }
  });

  /**
   * 경고 안내는 이의 제기의 길로 고객 문의 이메일을 이용자에게 말한다(ADR 0108). 그 주소는 사업자등록 뒤에 서므로(G-25 ㉡)
   * 지금은 자리 표시다 — 공개 출시로 옮기는 날 채우지 않았으면 여기서 붉다.
   */
  it('공개 출시에는 고객 문의 이메일이 자리 표시가 아니라 주소다 (ADR 0108)', () => {
    const [stage] = stagesOfPrd().filter((one) => one.current).map((one) => one.name);
    if (TIER_THREE_LOCKED[stage]) {
      expect(SUPPORT_EMAIL, 'src/lib/account/warning.ts 의 SUPPORT_EMAIL 을 채운다(G-25 ㉡)').toMatch(
        /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
      );
    } else {
      expect(SUPPORT_EMAIL.length).toBeGreaterThan(0);
    }
  });

  /** 문서의 한 절 안에서, 표의 첫 칸이 `**이름**` 인 줄의 그 이름들 — 차례대로 */
  function columnsOfSection(heading: string): string[] {
    const start = doc.indexOf(`\n## ${heading}`);
    const end = doc.indexOf('\n## ', start + 1);
    expect(start, heading).toBeGreaterThan(-1);
    return doc
      .slice(start, end === -1 ? undefined : end)
      .split('\n')
      .map((line) => /^\| \*\*([^*]+)\*\* \|/.exec(line)?.[1].trim() ?? null)
      .filter((name): name is string => name !== null);
  }

  it('이슈 틀과 PR 틀의 칸은 위임 규약 문서의 표와 차례까지 같다 — 어느 쪽에 더해도 붉어진다', () => {
    const pairs = [
      { file: '.github/ISSUE_TEMPLATE/ready-for-agent.md', section: '맡길 이슈', expected: 9 },
      { file: '.github/pull_request_template.md', section: '끝났다는 것', expected: 6 },
    ];
    for (const { file, section, expected } of pairs) {
      const headings = [...readFileSync(join(ROOT, file), 'utf8').matchAll(/^## (.+)$/gm)].map((match) => match[1].trim());
      const columns = columnsOfSection(section);
      expect(columns.length, section).toBe(expected);
      expect(headings, file).toEqual(columns);
    }
  });

  it('「나란히 맡길 때」 표가 드는 공유 자원의 경로는 전부 있다 — 옮겨진 파일을 두고 병렬을 판단하지 않는다', () => {
    const start = doc.indexOf('\n## 나란히 맡길 때');
    expect(start).toBeGreaterThan(-1);
    const rows = doc
      .slice(start, doc.indexOf('\n**', start))
      .split('\n')
      .filter((line) => /^\| \*\*[^*]+\*\* \|/.test(line));
    expect(rows.length).toBeGreaterThan(5);
    const paths = rows.flatMap((line) =>
      [...line.split('|')[2].matchAll(/`([^`\s]+\.[a-z]+|[^`\s]+\/)`/g)].map((match) => match[1]),
    );
    expect(paths.length).toBeGreaterThan(8);
    expect(paths.filter((path) => !existsSync(join(ROOT, path)))).toEqual([]);
  });

  it('이슈 틀이 붙이는 딱지는 triage 표에 있는 이름이다', () => {
    const template = readFileSync(join(ROOT, '.github/ISSUE_TEMPLATE/ready-for-agent.md'), 'utf8');
    const labels = /^labels: (.+)$/m.exec(template)?.[1].split(',').map((label) => label.trim()) ?? [];
    expect(labels.length).toBeGreaterThan(0);
    const triage = readFileSync(join(ROOT, 'docs/agents/triage-labels.md'), 'utf8');
    const known = new Set([...triage.matchAll(/^\| `[^`]+` \| `([^`]+)` \|/gm)].map((match) => match[1]));
    expect(known.size).toBe(5);
    expect(labels.filter((label) => !known.has(label))).toEqual([]);
  });

  it('세션 기록의 차례(docs/notes/README.md)는 그 폴더의 파일 전부를 들고, 없는 파일을 들지 않는다', () => {
    const dir = join(ROOT, 'docs/notes');
    const readme = readFileSync(join(dir, 'README.md'), 'utf8');
    const files = readdirSync(dir).filter((name) => name.endsWith('.md') && name !== 'README.md');
    expect(files.length).toBeGreaterThan(10);
    expect(files.filter((name) => !readme.includes(`| \`${name}\` |`))).toEqual([]);
    const listed = [...readme.matchAll(/^\| `([a-z0-9-]+\.md)` \|/gm)].map((match) => match[1]);
    expect(listed.filter((name) => !existsSync(join(dir, name)))).toEqual([]);
  });
});
