/**
 * **층의 방향은 이 시험이 잠근다** (ADR 0085, `docs/architecture.md`).
 *
 * `eslint.config.mjs` 가 같은 규칙을 편집기에서 알려 주지만, 린트는 규칙마다 사각이 있다 —
 * 첫 판은 별칭의 정적 import 만 봐서 상대경로·`import()` 가 지나갔다. 여기는 import 문을
 * **네 형태 다** 문자열로 집어 와(정적 · `export … from` · `import()` · `require()`) 파일로
 * 풀고, 규칙 하나에 단언 하나를 둔다. 린트가 바뀌어도 이 시험은 그대로 잰다.
 *
 * 도메인 lib 끼리의 방향은 **허용 목록과 같은가**로 잰다 — 새 방향이 생기면 여기와
 * `docs/architecture.md` 를 함께 고친다. 문서가 코드와 어긋난 채로 남지 않게 하려는 것이다
 * (첫 판의 문서가 셋이라고 적은 방향이 실제로는 여덟이었다).
 */
import { builtinModules } from 'node:module';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { dirname, join, relative, resolve, sep } from 'node:path';

import { describe, expect, it } from 'vitest';

const ROOT = resolve(__dirname, '..');

/** 도메인 lib 사이에 **지금 열려 있는** 방향 — 이것 밖의 방향은 빨개진다 */
const ALLOWED_LIB_EDGES = new Set([
  'consent → discovery',
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
 * 화면 안에서 아직 DB 를 부르는 자리의 수 — **줄어들기만 한다.**
 * 한 자리를 문으로 옮기면 그 `eslint-disable-next-line` 을 지우고 이 수를 하나 내린다.
 */
const SCREEN_DB_CALLS_STILL_THERE = 13;
const SCREEN_EXCEPTION = 'eslint-disable-next-line no-restricted-syntax';

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
    else if (/\.(ts|tsx|mjs)$/.test(name) && !name.endsWith('.d.ts')) out.push(full);
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

/** import 문 네 형태의 문자열 — 주석 안의 것은 안 센다 */
const IMPORT_SPEC =
  /(?:\bfrom\s*|\bimport\s*\(\s*|\brequire\s*\(\s*|^\s*import\s+)['"]([^'"]+)['"]/gm;

type Edge = { file: string; spec: string; target: string | null };

function edgesOf(file: string): Edge[] {
  const text = readFileSync(file, 'utf8').replace(/\/\*[\s\S]*?\*\//g, '');
  const rel = relative(ROOT, file).split(sep).join('/');
  const out: Edge[] = [];
  for (const match of text.matchAll(IMPORT_SPEC)) {
    const spec = match[1];
    let target: string | null = null;
    if (spec.startsWith('@/')) target = spec.slice(2);
    else if (spec.startsWith('.'))
      target = relative(ROOT, resolve(dirname(file), spec)).split(sep).join('/');
    out.push({ file: rel, spec, target });
  }
  return out;
}

const EDGES = SOURCE_FILES.flatMap(edgesOf);

const under = (path: string | null, dir: string) => path !== null && (path === dir || path.startsWith(`${dir}/`));
const libModuleOf = (path: string | null) => {
  if (!under(path, 'src/lib')) return null;
  const rest = path!.slice('src/lib/'.length);
  return rest.split('/')[0].replace(/\.ts$/, '');
};

describe('층의 방향 (ADR 0085)', () => {
  it('import 를 실제로 읽고 있다 — 빈 목록으로 통과하지 않는다', () => {
    expect(SOURCE_FILES.length).toBeGreaterThan(200);
    expect(EDGES.length).toBeGreaterThan(500);
    // 동적 import 도 집는다 — 옮긴 라이브 시험이 그 형태로 app 을 부른다
    expect(EDGES.some((edge) => edge.file === 'app/me/reading/call.live.test.ts' && edge.target === 'app/me/reading/model')).toBe(true);
  });

  it('src/lib 은 app 과 관문을 모른다 — 상대경로·동적 import 포함', () => {
    const wrong = EDGES.filter(
      (edge) => under(edge.file, 'src/lib') && (under(edge.target, 'app') || edge.target === 'proxy'),
    );
    expect(wrong.map((edge) => `${edge.file} → ${edge.spec}`)).toEqual([]);
  });

  it('엔진(src/lib/saju)은 다른 도메인 lib 을 모른다', () => {
    const wrong = EDGES.filter(
      (edge) => under(edge.file, 'src/lib/saju') && under(edge.target, 'src/lib') && !under(edge.target, 'src/lib/saju'),
    );
    expect(wrong.map((edge) => `${edge.file} → ${edge.spec}`)).toEqual([]);
  });

  it('scripts 와 e2e 는 화면 모듈을 모른다', () => {
    const wrong = EDGES.filter(
      (edge) => (under(edge.file, 'scripts') || under(edge.file, 'e2e')) && under(edge.target, 'app'),
    );
    expect(wrong.map((edge) => `${edge.file} → ${edge.spec}`)).toEqual([]);
  });

  it('src/lib 은 React·Next·supabase·모델 SDK·실행 환경을 모른다 — 예외는 이름이 말한다', () => {
    const exempt = (file: string) => file === 'src/lib/local-env.ts' || file.endsWith('.live.test.ts');
    const wrong = EDGES.filter((edge) => {
      if (!under(edge.file, 'src/lib') || edge.target !== null) return false;
      if (APP_ONLY_PACKAGES.test(edge.spec)) return true;
      if (exempt(edge.file)) return false;
      return SUPABASE.test(edge.spec) || isNodeBuiltin(edge.spec);
    });
    expect(wrong.map((edge) => `${edge.file} → ${edge.spec}`)).toEqual([]);
  });

  it('도메인 lib 끼리의 방향은 허용 목록과 정확히 같다 — 문서(docs/architecture.md)가 이 목록이다', () => {
    const found = new Set<string>();
    for (const edge of EDGES) {
      const from = libModuleOf(edge.file);
      const to = libModuleOf(edge.target);
      if (from && to && from !== to && from !== 'db') found.add(`${from} → ${to}`);
    }
    expect([...found].sort()).toEqual([...ALLOWED_LIB_EDGES].sort());
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

describe('화면 안의 DB 호출 (ADR 0072·0078·0085)', () => {
  const screens = walk(join(ROOT, 'app')).filter((file) => file.endsWith('.tsx'));

  it('옛 자리의 수는 줄어들기만 한다', () => {
    const markers = screens.flatMap((file) => {
      const lines = readFileSync(file, 'utf8').split('\n');
      return lines.flatMap((line, at) => (line.includes(SCREEN_EXCEPTION) ? [{ file: relative(ROOT, file), at, lines }] : []));
    });
    expect(markers.length).toBeLessThanOrEqual(SCREEN_DB_CALLS_STILL_THERE);

    // 예외 표시는 **실제 DB 호출 바로 위에만** 선다 — 다른 것을 끄는 데 쓰지 않는다
    for (const marker of markers) {
      const window = marker.lines.slice(marker.at + 1, marker.at + 3).join('\n');
      expect(window, `${marker.file}:${marker.at + 1} 아래에 .rpc()/.from() 이 없다`).toMatch(/\.(rpc|from)\(/);
    }
  });
});
