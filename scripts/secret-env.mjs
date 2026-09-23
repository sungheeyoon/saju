/**
 * **비밀은 서버에만 있다** — 이름의 갈래와 빌드 산출물 검사 (G-23 ⑧).
 *
 * 2026-09-24 에 쟀다. 앱(`app/` · `src/` · `proxy.ts` · `next.config.ts`)이 `process.env` 로 읽는
 * 이름은 열둘이고, 그중 비밀은 셋(`SUPABASE_SECRET_KEY` · 로컬 갈래 `SUPABASE_SERVICE_ROLE_KEY` ·
 * `CRON_SECRET`)이며 둘은 SDK 가 제 안에서 읽는다(`OPENAI_API_KEY` · `OPENAI_WEBHOOK_SECRET`).
 * 운영(Vercel)에는 일곱 줄 — 비밀 넷과 공개 둘이 Production, `OPENAI_API_KEY` 하나가 Preview 에도 있다.
 * 그날 브라우저로 가는 파일(`static/**` 와 미리 그린 화면 `server/app/**` 의 html · rsc · body · meta)에
 * 비밀 이름도 가짜 값도 없었다 — 비밀을 읽는 모듈이 서버 층에만 있고, `NEXT_PUBLIC_` 이 아닌 이름은
 * Next 가 브라우저 쪽에 싣지 않기 때문이다.
 *
 * 그것이 우연히 참인 것이 아니라 **늘 참이게** 둘이 든다.
 *
 * - `secret-env.test.ts` — 앱이 읽는 이름은 전부 아래 갈래에 있고, 비밀은 `NEXT_PUBLIC_` 이 아니며,
 *   비밀을 읽는 모듈은 `import 'server-only'` 로 잠겨 있다. 새 비밀(무료 지급 HMAC · PG · 본인확인)이
 *   들어오면 이 목록에 먼저 서야 시험이 초록이다.
 * - 이 파일의 실행 — `npm run build` 끝에 돈다. 브라우저로 가는 파일에서 **비밀 이름**과, 그 빌드의
 *   환경에 있는 **비밀 값**을 찾는다. 값은 찍지 않고 이름과 파일만 말한다. Vercel 의 운영 빌드는
 *   진짜 값을 들고 돌므로 그 빌드에서 새면 배포가 선다. 값이 빌드 환경에 없으면 브라우저 파일에
 *   실릴 길도 없다 — 값이 실리는 것은 빌드 때 인라인뿐이다(`NEXT_PUBLIC_` · `next.config` 의 `env`).
 */
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

/**
 * 비밀 — 새면 교체한다. 절차는 `docs/ops/runbook.md` 「비밀이 새면」이 이름마다 든다.
 * Vault 에만 있는 비밀(`reading_recovery_secret` · `ops_alert_url` · `ops_alert_secret`)은 앱이 안 읽으므로
 * 여기 없고, 시험이 마이그레이션에서 이름을 모아 runbook 과 견준다.
 */
export const SECRET_ENV = [
  'SUPABASE_SECRET_KEY',
  /** 로컬 스택의 옛 이름 갈래(`keyed-client.ts`). 운영에는 없다 */
  'SUPABASE_SERVICE_ROLE_KEY',
  /** `@ai-sdk/openai` 와 `openai` 가 제 안에서 읽는다 — 앱 코드에 `process.env` 로는 안 나온다 */
  'OPENAI_API_KEY',
  /** `openai` 의 `webhooks.unwrap` 이 제 안에서 읽는다 */
  'OPENAI_WEBHOOK_SECRET',
  'CRON_SECRET',
];

/** 브라우저가 본다 — 빌드 때 번들에 박힌다. 비밀을 여기 두는 순간 공개된다 */
export const PUBLIC_ENV = ['NEXT_PUBLIC_SUPABASE_URL', 'NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY'];

/** 비밀도 공개 열쇠도 아닌 설정 — 주소 · 포트 · 단계 */
export const CONFIG_ENV = [
  'NODE_ENV',
  'NEXT_DIST_DIR',
  'SITE_URL',
  'PORT',
  'VERCEL_ENV',
  'VERCEL_URL',
  'VERCEL_PROJECT_PRODUCTION_URL',
];

/** 제 안에서 비밀을 읽는 패키지 — 이것을 부르는 모듈도 비밀을 읽는 모듈이다 */
export const SECRET_READING_PACKAGES = {
  openai: ['OPENAI_API_KEY', 'OPENAI_WEBHOOK_SECRET'],
  '@ai-sdk/openai': ['OPENAI_API_KEY'],
};

/** 이보다 짧은 값은 대조하지 않는다 — 우연히 겹치는 낱말이 걸린다. 진짜 비밀은 전부 이보다 길다 */
const MIN_VALUE_LENGTH = 12;

/** `vercel env pull` 이 Secret 자리에 내려 주는 자리표시자 — 값이 아니다 */
const PLACEHOLDERS = new Set(['[SENSITIVE]']);

/**
 * 대조할 값 — 그 빌드의 환경에 있는 비밀만. 없는 것과 자리표시자는 뺀다.
 *
 * @returns `{ name, value }` — `value` 는 찍지 않는다
 */
export function secretValuesOf(env) {
  return SECRET_ENV.flatMap((name) => {
    const value = env[name]?.trim();
    if (!value || value.length < MIN_VALUE_LENGTH || PLACEHOLDERS.has(value)) return [];
    return [{ name, value }];
  });
}

/**
 * 브라우저로 가는 파일에서 비밀 이름과 비밀 값을 찾는다.
 *
 * @param files `{ path, text }` 목록
 * @param values `secretValuesOf` 의 답
 * @returns 걸린 것 — `{ path, name, found: '이름' | '값' }`. 값은 싣지 않는다
 */
export function leaksIn(files, values) {
  const leaks = [];
  for (const { path, text } of files) {
    for (const name of SECRET_ENV) {
      if (text.includes(name)) leaks.push({ path, name, found: '이름' });
    }
    for (const { name, value } of values) {
      if (text.includes(value)) leaks.push({ path, name, found: '값' });
    }
  }
  return leaks;
}

/** 미리 그린 화면 중 브라우저가 받는 것 — 서버 청크(`server/chunks`)는 안 간다 */
const PRERENDERED = /\.(html|rsc|body|meta)$/;

const walk = (dir) =>
  readdirSync(dir).flatMap((entry) => {
    const path = join(dir, entry);
    return statSync(path).isDirectory() ? walk(path) : [path];
  });

const exists = (path) => {
  try {
    return statSync(path).isDirectory();
  } catch {
    return false;
  }
};

/**
 * 빌드 산출물 중 **브라우저로 가는 파일**의 경로.
 *
 * `static/**` 는 전부, `server/app/**` 는 미리 그린 화면(html · rsc · body · meta)만이다.
 * `static` 이 없으면 빈 목록이 아니라 던진다 — 빌드가 없는데 「새는 것 0」으로 초록이 되면
 * 안 잰 것이다.
 */
export function clientFilesOf(distDir) {
  const staticDir = join(distDir, 'static');
  if (!exists(staticDir)) throw new Error(`빌드 산출물이 없다: ${staticDir} — next build 뒤에 돈다`);

  const appDir = join(distDir, 'server', 'app');
  const prerendered = exists(appDir) ? walk(appDir).filter((path) => PRERENDERED.test(path)) : [];
  return [...walk(staticDir), ...prerendered];
}

function main() {
  const distDir = process.env.NEXT_DIST_DIR ?? '.next';
  const paths = clientFilesOf(distDir);
  const files = paths.map((path) => ({ path: relative(process.cwd(), path), text: readFileSync(path, 'utf8') }));
  const values = secretValuesOf(process.env);
  const leaks = leaksIn(files, values);

  if (leaks.length > 0) {
    console.error('비밀이 브라우저로 가는 파일에 있다 (G-23 ⑧, docs/ops/runbook.md 「비밀이 새면」):');
    for (const { path, name, found } of leaks) console.error(`  ${path} — ${name} 의 ${found}`);
    process.exit(1);
  }

  console.log(
    `비밀 검사: 브라우저로 가는 파일 ${files.length}개에 비밀 이름 ${SECRET_ENV.length}개 · 이 빌드의 비밀 값 ${values.length}개 — 없다`,
  );
}

if (process.argv[1] === fileURLToPath(import.meta.url)) main();
