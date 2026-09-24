/**
 * **코드 규칙은 이 시험이 든다** (ADR 0086, `docs/agents/code-rules.md`).
 *
 * `eslint.config.mjs` 가 구문으로 잡을 수 있는 것(enum·class·interface·console·미결 표시·default export)은
 * 린트가 잡는다. 여기는 린트가 못 보는 것을 잰다 — **파일 이름**, **ADR 참조가 실제 파일을
 * 가리키는가**, 그리고 **탈출구의 지문**(이중 캐스트·`!`·`if (error)` 뒤에서 실패를 지우는 자리·
 * 예외 표시). 지문 목록은 2026-09-22 에 잰 값이고 **줄어들기만 한다** — 하나를 고치면 여기서
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

/** `x as unknown as T` — 타입이 못 잇는 자리를 손으로 잇는 것 */
const DOUBLE_CASTS_STILL_THERE = [
  'app/me/account.ts :: data as unknown as T',
  'app/me/person-input.ts :: data as unknown as StoredInput',
  'app/me/person-input.ts :: row as unknown as StoredInput',
  'app/me/photo/[userId]/route.ts :: Buffer.from(row.base64, \'base64\') as unknown as BodyInit',
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
  'src/lib/consent/schedule.ts :: if (error) return null;',
];

/** 층 시험이 세는 화면 DB 호출 표시는 여기서 안 센다 */
const COUNTED_BY_LAYERS = 'no-restricted-syntax';
/** 그 밖의 예외 표시 — `파일 :: 규칙` */
const DISABLES_STILL_THERE = [
  'app/me/avatar.tsx :: @next/next/no-img-element',
  'app/me/matching/matching-experience.tsx :: @next/next/no-img-element',
  'app/me/profile/form.tsx :: @next/next/no-img-element',
  'app/me/survey/form.tsx :: react-hooks/exhaustive-deps',
];
/** 까닭(`-- …`) 없이 선 표시 — 새 표시는 까닭을 적는다 */
const DISABLES_WITHOUT_A_REASON = ['app/me/survey/form.tsx :: react-hooks/exhaustive-deps'];

/** class 가 잇는 것 — `Error` 가 아니면 이름으로 든다 */
const CLASSES_NOT_EXTENDING_ERROR = ['scripts/fake-clock.mjs :: Shifted extends Real'];

const isAs = (node: ts.Node): node is ts.AsExpression => ts.isAsExpression(node);
const isUnknown = (type: ts.TypeNode) => type.kind === ts.SyntaxKind.UnknownKeyword;

describe('탈출구의 지문 (docs/agents/code-rules.md) — 줄어들기만 한다', () => {
  it('제품 코드를 실제로 읽고 있다', () => {
    expect(PRODUCT_FILES.length).toBeGreaterThan(150);
  });

  it('`as unknown as` 는 옛 자리 여덟에만 있다', () => {
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
    const swallows = (node: ts.Node, source: ts.SourceFile): string | null => {
      if (!ts.isIfStatement(node) || !ts.isIdentifier(node.expression) || node.expression.text !== 'error') return null;
      const body = ts.isBlock(node.thenStatement) && node.thenStatement.statements.length === 1 ? node.thenStatement.statements[0] : node.thenStatement;
      if (!ts.isReturnStatement(body)) return null;
      const value = body.expression;
      const empty =
        value === undefined ||
        value.kind === ts.SyntaxKind.NullKeyword ||
        value.kind === ts.SyntaxKind.UndefinedKeyword ||
        (ts.isArrayLiteralExpression(value) && value.elements.length === 0) ||
        ts.isNumericLiteral(value);
      return empty ? `if (error) ${oneLine(body.getText(source))}` : null;
    };
    expectExactly(fingerprints(PRODUCT_FILES, swallows), ERROR_SWALLOWS_STILL_THERE);
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
  join(ROOT, 'CONTEXT.md'),
  join(ROOT, 'docs/product/gaps.md'),
  join(ROOT, 'README.md'),
  join(ROOT, 'docs/architecture.md'),
  ...readdirSync(join(ROOT, 'docs/agents')).map((name) => join(ROOT, 'docs/agents', name)),
];
/** 저장소 뿌리에서 시작하는 경로만 잰다 — `person-input.ts` 같은 줄임과 `NNNN-….md` 같은 틀은 경로가 아니다 */
const ROOTED_PATH = /^(app|src|scripts|e2e|docs|supabase|public|\.github)\/[A-Za-z0-9_.\/\[\]-]+$/;

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
