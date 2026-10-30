import { mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { builtinModules } from 'node:module';
import { tmpdir } from 'node:os';
import { dirname, join, relative, resolve, sep } from 'node:path';

import ts from 'typescript';
import { describe, expect, it } from 'vitest';

/**
 * **앱이 닿는 코드는 앱 번들에서 풀린다.**
 *
 * `mobile/src` 는 tsconfig 의 paths 로 웹의 `src/lib` · `app` 을 들인다. 그 파일이 웹 별칭(`@/src/lib/…`)이나 `next` · `node:` 를 들이면
 * 웹의 시험 · 타입 검사 · 빌드는 초록인데 앱 번들만 깨진다 — 웹 CI 는 `mobile/` 을 안 돌린다. 그래서 `mobile/src` 에서 import 를 따라가
 * 닿는 파일 전부를 여기서 잰다. 설치를 안 하는 CI 에서도 돌도록 `mobile/node_modules` 가 아니라 `mobile/package.json` 과 견준다.
 */
const ROOT = join(import.meta.dirname, '..');

/** 웹 쪽 코드가 머물 곳 — `mobile/metro.config.js` 의 watchFolders. 밖의 파일은 Metro 가 못 본다 */
const SHARED_ROOTS = ['src/lib', 'app'];
const EXTENSIONS = ['', '.ts', '.tsx', '.js', '.json', '/index.ts', '/index.tsx'];
/** 네이티브에서 안 돌거나 앱에 없는 패키지 — 앱 의존성 목록에 들어와도 어김이다 */
const WEB_ONLY = new Set(['next', 'server-only', ...builtinModules]);

/**
 * Hermes 에 없는 내장 — RN 0.88.1 이 싣는 `hermes-v260318099.0.5` 의 `include/hermes/VM/PredefinedStrings.def` 에 없다.
 * 타입 검사는 lib 설정을 따라 지나가고 웹 번들에서도 돌아, 폰에서만 `is not a function` 으로 터진다.
 */
const MISSING_IN_HERMES = /\.toSorted\(/;

const isFile = (path: string) => {
  try {
    return statSync(path).isFile();
  } catch {
    return false;
  }
};
const fileAt = (base: string) => EXTENSIONS.map((ending) => base + ending).find(isFile) ?? null;

const filesUnder = (dir: string): string[] =>
  readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const path = join(dir, entry.name);
    return entry.isDirectory() ? filesUnder(path) : [path];
  });

const isCode = (file: string) => /\.tsx?$/.test(file) && !/\.test\.tsx?$/.test(file);

const withoutComments = (text: string) =>
  text.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');

/** 앱의 alias 를 tsc 처럼 푼다 — 딱 맞는 이름이 먼저, 그다음 가장 긴 접두사 */
function aliasResolver(paths: Record<string, string[]>, mobile: string) {
  const entries = Object.entries(paths);
  return (specifier: string): string | null => {
    const exact = entries.find(([key]) => key === specifier);
    if (exact) return join(mobile, exact[1][0]);
    const prefix = entries
      .filter(([key]) => key.endsWith('/*') && specifier.startsWith(key.slice(0, -1)))
      .sort(([a], [b]) => b.length - a.length)[0];
    return prefix ? join(mobile, prefix[1][0].slice(0, -1) + specifier.slice(prefix[0].length - 1)) : null;
  };
}

/** `root` 의 앱에서 닿는 파일을 다 돌고 어김을 `파일 → 글자 — 까닭` 으로 적는다 */
function closureOf(root: string) {
  const mobile = join(root, 'mobile');
  const config = ts.parseConfigFileTextToJson('tsconfig.json', readFileSync(join(mobile, 'tsconfig.json'), 'utf8')).config;
  const manifest = JSON.parse(readFileSync(join(mobile, 'package.json'), 'utf8'));
  const packages = new Set(Object.keys({ ...manifest.dependencies, ...manifest.devDependencies }));
  const alias = aliasResolver(config.compilerOptions.paths, mobile);
  const inMobile = (file: string) => file.startsWith(mobile + sep);

  const seen = new Set<string>();
  const shared = new Set<string>();
  const violations: string[] = [];

  const visit = (file: string) => {
    if (seen.has(file)) return;
    seen.add(file);
    const where = relative(root, file);
    if (!inMobile(file)) shared.add(where);
    if (!/\.tsx?$/.test(file)) return;

    const source = readFileSync(file, 'utf8');
    if (MISSING_IN_HERMES.test(withoutComments(source))) violations.push(`${where} → .toSorted — Hermes 에 없다`);

    for (const { fileName: specifier } of ts.preProcessFile(source, true, true).importedFiles) {
      const fail = (why: string) => violations.push(`${where} → ${specifier} — ${why}`);
      const bare = specifier.startsWith('@') ? specifier.split('/').slice(0, 2).join('/') : specifier.split('/')[0];

      if (specifier.startsWith('node:') || WEB_ONLY.has(bare)) {
        fail('앱에서 안 돈다');
        continue;
      }
      /* 웹 코드의 `@/` 는 저장소 뿌리지만 앱은 같은 글자를 `mobile/src` 로 푼다 — 풀려도 다른 파일이다 */
      if (!inMobile(file) && specifier.startsWith('@/')) {
        fail('웹 별칭이다 — 함께 쓰는 코드는 상대 경로로 잇는다');
        continue;
      }
      const relativePath = specifier.startsWith('.');
      const aliased = relativePath ? null : alias(specifier);
      if (!relativePath && aliased === null) {
        if (!packages.has(bare)) fail('mobile/package.json 에 없다');
        continue;
      }
      const target = fileAt(relativePath ? resolve(dirname(file), specifier) : (aliased as string));
      if (target === null) {
        fail('안 풀린다');
        continue;
      }
      const seenFrom = relative(root, target);
      if (!inMobile(target) && !SHARED_ROOTS.some((dir) => seenFrom.startsWith(dir + sep))) {
        fail('Metro 가 안 보는 자리다(watchFolders)');
        continue;
      }
      visit(target);
    }
  };

  for (const file of filesUnder(join(mobile, 'src')).filter(isCode)) visit(file);
  return { violations, shared: [...shared] };
}

describe('앱이 닿는 코드의 닫힘', () => {
  const { violations, shared } = closureOf(ROOT);

  it('어김이 없다', () => {
    expect(violations).toEqual([]);
  });

  it('웹 쪽 코드까지 따라갔다 — 못 따라가면 위 시험은 아무것도 안 잰다', () => {
    expect(shared).toContain('app/db-error.ts');
    expect(shared).toContain('src/lib/saju/index.ts');
    expect(shared.length).toBeGreaterThan(100);
  });
});

/**
 * 뿌리 코드가 `mobile/` 을 import 한 자리. CI 에는 `mobile/node_modules` 가 없어 시험 파일이 통째로 붉고, 앱 패키지가 깔린 로컬에서는
 * 안 드러난다. 시험에서 부르는 도움 파일로 돌아가도 같으므로 시험 파일만이 아니라 전부 잰다. 글자로 읽는 `readFileSync` 는 import 가 아니라 괜찮다.
 */
function mobileImportsIn(root: string) {
  return ['scripts', 'src', 'app']
    .flatMap((dir) => filesUnder(join(root, dir)))
    .filter((file) => /\.tsx?$/.test(file))
    .flatMap((file) =>
      ts
        .preProcessFile(readFileSync(file, 'utf8'), true, true)
        .importedFiles.map(({ fileName }) => fileName)
        .filter((specifier) => {
          const target = specifier.startsWith('.')
            ? relative(root, resolve(dirname(file), specifier))
            : specifier.replace(/^@\//, '');
          return target === 'mobile' || target.startsWith('mobile/');
        })
        .map((specifier) => `${relative(root, file)} → ${specifier}`),
    );
}

describe('뿌리 코드와 앱의 경계', () => {
  it('뿌리 코드는 mobile/ 을 import 하지 않는다', () => {
    expect(mobileImportsIn(ROOT)).toEqual([]);
  });

  it.each([
    ['상대 경로', `import { a } from '../mobile/src/a';\n`],
    ['뿌리 별칭', `import { a } from '@/mobile/src/a';\n`],
    ['타입만', `import type { A } from '../mobile/src/a';\n`],
    ['동적 import', `export const a = () => import('../mobile/src/a');\n`],
    ['다시 내보내기', `export { a } from '../mobile/src/a';\n`],
  ])('%s 로 들여도 잡는다', (_name, text) => {
    const root = mkdtempSync(join(tmpdir(), 'mobile-boundary-'));
    try {
      for (const dir of ['scripts', 'src', 'app']) mkdirSync(join(root, dir));
      writeFileSync(join(root, 'scripts/a.test.ts'), text);
      expect(mobileImportsIn(root)).toHaveLength(1);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it('글자로 읽는 것과 이름이 비슷한 패키지는 어김이 아니다', () => {
    const root = mkdtempSync(join(tmpdir(), 'mobile-boundary-'));
    try {
      for (const dir of ['scripts', 'src', 'app']) mkdirSync(join(root, dir));
      writeFileSync(join(root, 'scripts/a.test.ts'), `import { readFileSync } from 'node:fs';\nimport m from 'mobile-detect';\nexport const a = readFileSync('mobile/src/a.ts', 'utf8');\nexport { m };\n`);
      expect(mobileImportsIn(root)).toEqual([]);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });
});

describe('닫힘 재기는 어김을 잡는다', () => {
  /** 작은 앱 하나 — 화면이 alias 로 `src/lib/a.ts` 를 들이고, 어김은 그 뒤 한 다리에 둔다 */
  function caught(shared: string) {
    const root = mkdtempSync(join(tmpdir(), 'mobile-closure-'));
    const write = (file: string, text: string) => {
      mkdirSync(dirname(join(root, file)), { recursive: true });
      writeFileSync(join(root, file), text);
    };
    try {
      write('mobile/tsconfig.json', JSON.stringify({ compilerOptions: { paths: { '@/*': ['./src/*'], '@shared/*': ['../src/lib/*'] } } }));
      write('mobile/package.json', JSON.stringify({ dependencies: { 'react-native': '1' } }));
      write('mobile/src/app/screen.tsx', `import { a } from '@shared/a';\nimport { View } from 'react-native';\nexport { a, View };\n`);
      write('src/lib/a.ts', `import { b } from './b';\nexport const a = b;\n`);
      write('src/lib/b.ts', shared);
      write('src/lib/c.ts', 'export const c = 1;\n');
      write('scripts/out.ts', 'export const o = 1;\n');
      return closureOf(root).violations;
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  }

  it('깨끗하면 어김이 없다', () => {
    expect(caught(`import { c } from './c';\nexport const b = c;\n`)).toEqual([]);
  });

  it.each([
    ['웹 별칭', `import { c } from '@/src/lib/c';\nexport const b = c;\n`, '웹 별칭'],
    ['next', `import { cookies } from 'next/headers';\nexport const b = cookies;\n`, '앱에서 안 돈다'],
    ['server-only', `import 'server-only';\nexport const b = 1;\n`, '앱에서 안 돈다'],
    ['node:', `import { join } from 'node:path';\nexport const b = join;\n`, '앱에서 안 돈다'],
    ['Node 내장', `import { join } from 'path';\nexport const b = join;\n`, '앱에서 안 돈다'],
    ['타입만 들여도', `import type { X } from 'next';\nexport type b = X;\n`, '앱에서 안 돈다'],
    ['동적 import', `export const b = () => import('next/headers');\n`, '앱에서 안 돈다'],
    ['앱에 없는 패키지', `import z from 'zod';\nexport const b = z;\n`, 'package.json'],
    ['없는 파일', `import { x } from './nope';\nexport const b = x;\n`, '안 풀린다'],
    ['Metro 밖', `import { o } from '../../scripts/out';\nexport const b = o;\n`, 'watchFolders'],
    ['Hermes 에 없는 내장', `export const b = [2, 1].toSorted();\n`, 'Hermes'],
  ])('%s', (_name, shared, why) => {
    const found = caught(shared);
    expect(found).toHaveLength(1);
    expect(found[0]).toContain(why);
    expect(found[0]).toMatch(/^src\/lib\/b\.ts → /);
  });

  it('주석 속 글자는 어김이 아니다', () => {
    expect(caught(`/* import 'next' 나 .toSorted( 를 쓰지 않는다 */\nexport const b = 1;\n`)).toEqual([]);
  });
});
