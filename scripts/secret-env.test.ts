/**
 * **비밀은 서버에만 있고, 새면 무엇을 하는지 적혀 있다** (G-23 ⑧).
 *
 * 갈래와 빌드 산출물 검사는 `secret-env.mjs` 가 든다. 여기서 재는 것은 셋이다 — 코드가 읽는 이름이
 * 전부 갈래에 있는가, 비밀을 읽는 모듈이 서버 층에 잠겨 있는가, runbook 이 비밀마다 줄을 드는가.
 * 새 비밀이 들어오면 셋 다 빨개진다 — 갈래에 없고, 잠금이 없고, 절차가 없다.
 */
import { mkdirSync, mkdtempSync, readFileSync, readdirSync, statSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';

import { describe, expect, it } from 'vitest';

import {
  CONFIG_ENV,
  PUBLIC_ENV,
  SECRET_ENV,
  SECRET_READING_PACKAGES,
  clientFilesOf,
  leaksIn,
  secretValuesOf,
} from './secret-env.mjs';

const root = resolve(__dirname, '..');
const read = (path: string) => readFileSync(join(root, path), 'utf8');

const walk = (dir: string): string[] =>
  readdirSync(join(root, dir)).flatMap((entry) => {
    const path = join(dir, entry);
    if (entry === 'node_modules' || entry.startsWith('.')) return [];
    return statSync(join(root, path)).isDirectory() ? walk(path) : [path];
  });

/** 앱이 도는 코드 — 시험과 실호출 시험은 뺀다. `local-env.ts` 는 이름이 말하는 예외다(아래) */
const APP_SOURCES = [...walk('app'), ...walk('src'), 'proxy.ts', 'next.config.ts'].filter(
  (path) => /\.(ts|tsx|mts|mjs|js)$/.test(path) && !/\.test\.ts$/.test(path) && !path.endsWith('.generated.ts'),
);

const ENV_READ = /process\.env(?:\.([A-Za-z_][A-Za-z0-9_]*)|\[\s*['"]([A-Za-z_][A-Za-z0-9_]*)['"]\s*\])/g;

const envReadsOf = (text: string) => [...text.matchAll(ENV_READ)].map((m) => m[1] ?? m[2]);

const importsOf = (text: string) =>
  [...text.matchAll(/(?:from\s+|import\s*\(\s*|import\s+)['"]([^'"]+)['"]/g)].map((m) => m[1]);

/** 비밀을 읽는 모듈 — 이름으로 읽거나, 제 안에서 읽는 패키지를 부른다 */
const secretReaders = APP_SOURCES.filter((path) => {
  const text = read(path);
  return (
    envReadsOf(text).some((name) => SECRET_ENV.includes(name)) ||
    importsOf(text).some((spec) => spec in SECRET_READING_PACKAGES)
  );
});

describe('비밀의 갈래 (G-23 ⑧)', () => {
  it('앱이 읽는 환경변수는 전부 비밀 · 공개 · 설정 중 하나다', () => {
    const known = new Set([...SECRET_ENV, ...PUBLIC_ENV, ...CONFIG_ENV]);
    const unknown = APP_SOURCES.flatMap((path) =>
      envReadsOf(read(path))
        .filter((name) => !known.has(name))
        .map((name) => `${path} :: ${name}`),
    );
    expect(unknown, '새 이름은 scripts/secret-env.mjs 의 갈래에 먼저 세운다').toEqual([]);
  });

  it('갈래가 가리키는 이름은 실제로 읽힌다 — 목록이 코드보다 길지 않다', () => {
    const readNames = new Set(APP_SOURCES.flatMap((path) => envReadsOf(read(path))));
    const implicit = new Set(Object.values(SECRET_READING_PACKAGES).flat());
    const stale = [...SECRET_ENV, ...PUBLIC_ENV, ...CONFIG_ENV].filter(
      (name) => !readNames.has(name) && !implicit.has(name),
    );
    expect(stale).toEqual([]);
  });

  it('앱은 환경변수를 이름으로만 읽는다 — 통째로나 변수로 읽는 자리가 없다', () => {
    // `local-env.ts` 는 실호출 시험이 `.env.development.local` 을 읽는 자리다(docs/architecture.md 「예외 둘」)
    const whole = APP_SOURCES.filter((path) => path !== 'src/lib/local-env.ts').flatMap((path) =>
      [...read(path).matchAll(/process\.env(?![.\w]|\[\s*['"])/g)].map(() => path),
    );
    expect(whole).toEqual([]);
  });

  it('비밀은 NEXT_PUBLIC_ 이 아니고, 공개 이름은 NEXT_PUBLIC_ 이며 비밀처럼 생기지 않았다', () => {
    expect(SECRET_ENV.filter((name) => name.startsWith('NEXT_PUBLIC_'))).toEqual([]);
    expect(PUBLIC_ENV.filter((name) => !name.startsWith('NEXT_PUBLIC_'))).toEqual([]);
    expect(PUBLIC_ENV.filter((name) => /SECRET|SERVICE_ROLE|PRIVATE|TOKEN|HMAC|PASSWORD|API_KEY/.test(name))).toEqual(
      [],
    );
  });

  it('next.config 의 env 로 서버 값을 브라우저에 박지 않는다', () => {
    expect(read('next.config.ts')).not.toMatch(/^\s*env\s*:/m);
  });
});

describe('비밀을 읽는 모듈은 서버에만 있다 (G-23 ⑧)', () => {
  it('비밀을 읽는 모듈이 있다 — 부재로 통과하지 않는다', () => {
    expect(secretReaders).toEqual(
      expect.arrayContaining(['app/keyed-client.ts', 'app/me/reading/model.ts', 'app/api/cron/reading/route.ts']),
    );
  });

  it("비밀을 읽는 모듈은 import 'server-only' 로 잠겨 있다 — 브라우저 층이 부르면 빌드가 선다", () => {
    const unlocked = secretReaders.filter((path) => !/^import 'server-only';$/m.test(read(path)));
    expect(unlocked).toEqual([]);
  });

  it("화면과 'use client' 모듈은 비밀 이름을 안 든다", () => {
    const clientish = APP_SOURCES.filter((path) => path.endsWith('.tsx') || /^['"]use client['"]/m.test(read(path)));
    const named = clientish.flatMap((path) =>
      SECRET_ENV.filter((name) => read(path).includes(name)).map((name) => `${path} :: ${name}`),
    );
    expect(named).toEqual([]);
  });

  it('빌드가 끝에 산출물 검사를 부른다 — Vercel 의 운영 빌드도 지난다', () => {
    const { scripts } = JSON.parse(read('package.json')) as { scripts: Record<string, string> };
    expect(scripts.build).toBe('next build && node scripts/secret-env.mjs');
  });
});

describe('빌드 산출물 검사 — 가짜 값으로 (G-23 ⑧)', () => {
  const FAKE = {
    SUPABASE_SECRET_KEY: 'sb_secret_FAKEsupabase000000',
    OPENAI_API_KEY: 'sk-proj-FAKEopenai0000000000',
    CRON_SECRET: 'FAKEcron0000000000000000',
  };

  it('값은 그 빌드의 환경에 있는 비밀만 — 짧은 것과 자리표시자는 뺀다', () => {
    const values = secretValuesOf({ ...FAKE, OPENAI_WEBHOOK_SECRET: '[SENSITIVE]', SUPABASE_SERVICE_ROLE_KEY: 'short' });
    expect(values.map(({ name }) => name).sort()).toEqual(['CRON_SECRET', 'OPENAI_API_KEY', 'SUPABASE_SECRET_KEY']);
  });

  it('비밀 값이 박힌 파일을 이름과 함께 잡고, 값은 답에 싣지 않는다', () => {
    const leaks = leaksIn(
      [
        { path: 'static/chunks/a.js', text: `const k="${FAKE.CRON_SECRET}";` },
        { path: 'static/chunks/b.js', text: 'const ok="sb_publishable_x";' },
      ],
      secretValuesOf(FAKE),
    );
    expect(leaks).toEqual([{ path: 'static/chunks/a.js', name: 'CRON_SECRET', found: '값' }]);
    expect(JSON.stringify(leaks)).not.toContain(FAKE.CRON_SECRET);
  });

  it('값이 없어도 비밀 이름이 브라우저 파일에 있으면 잡는다', () => {
    const leaks = leaksIn([{ path: 'static/chunks/c.js', text: 'e.env.SUPABASE_SECRET_KEY' }], []);
    expect(leaks).toEqual([{ path: 'static/chunks/c.js', name: 'SUPABASE_SECRET_KEY', found: '이름' }]);
  });

  it('브라우저로 가는 파일만 본다 — 서버 청크는 안 보고, 미리 그린 화면은 본다', () => {
    const dist = mkdtempSync(join(tmpdir(), 'secret-env-'));
    for (const [path, text] of [
      ['static/chunks/app.js', 'x'],
      ['server/app/index.html', 'x'],
      ['server/app/index.rsc', 'x'],
      ['server/chunks/route.js', 'SUPABASE_SECRET_KEY'],
      ['server/app/page.js', 'x'],
    ]) {
      mkdirSync(join(dist, path, '..'), { recursive: true });
      writeFileSync(join(dist, path), text);
    }
    const files = clientFilesOf(dist).map((path: string) => path.slice(dist.length + 1)).sort();
    expect(files).toEqual(['server/app/index.html', 'server/app/index.rsc', 'static/chunks/app.js']);
  });

  it('빌드가 없으면 초록이 아니라 던진다', () => {
    expect(() => clientFilesOf(mkdtempSync(join(tmpdir(), 'secret-env-empty-')))).toThrow('빌드 산출물이 없다');
  });
});

describe('새면 무엇을 하는가 — runbook (G-23 ⑧)', () => {
  const runbook = read('docs/ops/runbook.md');
  const start = runbook.indexOf('### 비밀이 새면');
  const body = start < 0 ? '' : runbook.slice(runbook.indexOf('\n', start));
  // 다음 절(`#` 셋 이하) 앞까지 — 절 안의 소제목은 `####` 로 둔다
  const end = body.search(/^#{1,3} /m);
  const section = end < 0 ? body : body.slice(0, end);

  it('절이 있다', () => {
    expect(start).toBeGreaterThan(-1);
  });

  it('앱의 비밀마다 줄이 있다', () => {
    expect(SECRET_ENV.filter((name) => !section.includes(`\`${name}\``))).toEqual([]);
  });

  it('Vault 가 드는 이름마다 줄이 있다 — 마이그레이션이 읽는 이름을 모아 견준다', () => {
    const names = new Set(
      readdirSync(join(root, 'supabase/migrations')).flatMap((file) =>
        [...read(`supabase/migrations/${file}`).matchAll(/decrypted_secrets\s+where\s+name\s*=\s*'([a-z_]+)'/g)].map(
          (m) => m[1],
        ),
      ),
    );
    expect(names.size).toBeGreaterThan(0);
    expect([...names].filter((name) => !section.includes(`\`${name}\``))).toEqual([]);
  });
});
