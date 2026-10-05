/**
 * **필수 읽기량** — 역할 문서(`docs/roles/`)를 받은 에이전트가 손대기 전에 읽게 되는 바이트 (ADR 0145).
 * `npm run read-budget` 이 역할마다 표로 찍고, `scripts/code-rules.test.ts` 가 같은 함수로 상한을 잰다 — 셈이 두 벌이 되지 않게
 * 계산은 여기 한 곳이다.
 *
 * 읽기량 = **고정** + **동적**.
 *
 * - **고정** — 역할 문서 자신과, 그 「먼저 읽는 것」 · 「이 저장소의 방식」 · 「끝날 때 고치는 것」이 가리키는 **파일**(백틱의 뿌리
 *   경로 · Markdown 링크, 중복은 한 번)과 「먼저 읽는 것」이 번호로 부르는 ADR(`ADR NNNN` → `docs/adr/NNNN-*.md`). 다른 칸의 ADR
 *   번호는 출처 표시라 안 센다. 원본은 **잠근 날의 크기**로 센다(`SIZE_AT_LOCK`) — 간극 대장 · changelog · runbook 은 PR 마다
 *   자라는데 그것은 길잡이의 회귀가 아니다. 역할 문서 자신과 잠근 날에 없던 새 원본은 지금 크기다.
 * - **동적 라우트** — 「여러 파일 중 하나를 골라 읽는다」는 가리킴이다. 표기는 **디렉터리를 가리키는 Markdown 링크** 하나뿐이다
 *   (`[영역 파일](../context/)`). 후보는 그 디렉터리 바로 아래의 `.md`(README 와, 그 역할이 이미 고정으로 읽는 파일은 뺀다)이고,
 *   라우트마다 **후보 가운데 가장 큰 것을 지금 크기로** 센다. PRD · 용어집의 영역 파일은 changelog 처럼 매 PR 자라는 파일이 아니라
 *   자라는 것이 곧 신호다 — 잠근 크기로 세면 영역 파일이 커져도 초록이다. 백틱 디렉터리(`docs/ops/runbook/`)는 「어디에 사는가 ·
 *   어디에 쓰는가」를 말하는 데 이미 두루 쓰여 라우트로 읽지 않는다.
 * - **세지 않는 것** — ADR 본문 가운데 「그 영역의 ADR — 색인에서 번호만」처럼 영역마다 달라지는 것. 후보 집합이 영역마다 다르고
 *   커서 색인(`docs/adr/README.md`)만 센다. 「끝날 때 고치는 것」의 쓰는 자리(백틱 디렉터리)도 읽을 것이 아니라 세지 않는다.
 *
 * 상한(`READ_BUDGET`)은 회귀 상한이다 — 임의의 절대 상한은 두지 않는다. 늘리려면 PR 에 까닭을 적고 여기 값을 함께 고친다. 원본을
 * 쪼개 줄였으면 상한도 내린다. 라우트 목록도 같은 표가 든다 — 동적 링크를 파일 하나로 바꿔치면 라우트가 사라진 것으로 붉어진다.
 */
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { dirname, join, relative, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

export const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
export const ROLES_DIR = 'docs/roles';
/** 읽기량을 세는 칸 — 「하지 않는 것 · 묻는 것」의 출처 링크는 멈출 자리의 근거라 안 센다 */
export const COUNTED_SECTIONS = ['먼저 읽는 것', '이 저장소의 방식', '끝날 때 고치는 것'];

/**
 * 역할마다 잠근 상한(바이트)과 동적 라우트(저장소 뿌리에서의 디렉터리, `/` 로 끝남).
 *
 * @type {Record<string, { bytes: number, routes: string[] }>}
 */
export const READ_BUDGET = {
  coordinator: { bytes: 106759, routes: [] },
  db: { bytes: 227849, routes: [] },
  docs: { bytes: 87624, routes: [] },
  feature: { bytes: 203606, routes: ['docs/context/', 'docs/product/prd/'] },
  ops: { bytes: 123122, routes: [] },
  reading: { bytes: 259378, routes: [] },
  reviewer: { bytes: 133395, routes: [] },
  ui: { bytes: 162222, routes: [] },
};

/** 고정으로 가리킨 원본의 잠근 날 크기 — 어느 역할도 고정으로 안 가리키는 파일은 지운다(시험이 잰다) */
export const SIZE_AT_LOCK = {
  'CONTEXT.md': 2979,
  'README.md': 26108,
  'app/me/reading/model.ts': 20492,
  'docs/adr/0047-the-engine-does-not-speak-to-the-model.md': 7093,
  'docs/adr/0071-the-consented-chart-is-copied-not-the-input.md': 18122,
  'docs/adr/0073-the-blocked-name-is-said-by-the-prompt.md': 6632,
  'docs/adr/0078-the-reading-doors-say-how-they-failed.md': 9754,
  'docs/adr/0084-the-shape-is-asserted-not-only-the-behaviour.md': 7311,
  'docs/adr/0105-the-operator-reads-leave-a-trace-from-the-first-read.md': 16278,
  'docs/adr/0109-the-product-wears-one-soft-look-under-the-name-jeomjeom.md': 8466,
  'docs/adr/0135-the-screen-speaks-haeyo-by-default.md': 4970,
  'docs/adr/README.md': 14962,
  'docs/agents/code-rules.md': 16485,
  'docs/agents/delegation/coordinator.md': 9000,
  'docs/agents/delegation/decisions.md': 3031,
  'docs/agents/delegation/done.md': 3269,
  'docs/agents/delegation/local-env.md': 6859,
  'docs/agents/delegation/notes.md': 1563,
  'docs/agents/delegation/parallel.md': 3836,
  'docs/agents/delegation/permissions.md': 11728,
  'docs/agents/delegation/unattended.md': 4823,
  'docs/agents/delegation/working.md': 7332,
  'docs/agents/domain.md': 1980,
  'docs/agents/test-map.md': 32484,
  'docs/architecture.md': 13790,
  'docs/context/chart.md': 11667,
  'docs/context/code-names.md': 11701,
  'docs/context/copy.md': 7144,
  'docs/context/evidence.md': 19418,
  'docs/notes/2026-09-28-overnight-audit.md': 23358,
  'docs/notes/README.md': 18300,
  'docs/notes/verification-discipline.md': 47917,
  'docs/ops/runbook.md': 2895,
  'docs/ops/runbook/access.md': 20690,
  'docs/ops/runbook/deploy.md': 21697,
  'docs/ops/runbook/jobs.md': 11109,
  'docs/ops/runbook/security.md': 32543,
  'docs/prd.md': 2617,
  'docs/product/copy-ledger.md': 30104,
  'docs/product/gaps.md': 14239,
  'docs/product/prd/foundation.md': 21970,
  'docs/product/prd/reading.md': 19263,
  'docs/product/prd/screens.md': 27868,
  'docs/roles/reviewer.md': 2523,
  'docs/start.md': 5641,
  'docs/text/claim-policy.md': 19554,
  'scripts/secret-env.mjs': 8315,
};

/** 백틱 안에서 파일로 세는 경로 — 뿌리의 `CONTEXT.md` 같은 문서와 저장소 안의 경로 */
const POINTED_PATH = /^(?:[A-Z][A-Za-z_-]*\.md|(?:app|src|scripts|e2e|docs|supabase|public|\.github|\.claude)\/[A-Za-z0-9_.\/\[\]-]+)$/;
/** `[글](대상#앵커)` — 바깥 주소는 뺀다 */
const MARKDOWN_LINK = /\[[^\]]+\]\(([^)\s#]+)(?:#([^)\s]+))?\)/g;

/** @param {string} root @param {string} file */
const relPath = (root, file) => relative(root, file).split(sep).join('/');
/** @param {string} path */
const isFile = (path) => existsSync(path) && statSync(path).isFile();
/** @param {string} path */
const isDirectory = (path) => existsSync(path) && statSync(path).isDirectory();

/**
 * 문서 안의 Markdown 링크 — 바깥 주소(`https:` …)는 뺀다.
 *
 * @param {string} text
 * @returns {{ path: string, anchor: string | undefined }[]}
 */
export function linksOf(text) {
  return [...text.matchAll(MARKDOWN_LINK)].filter((match) => !/^[a-z]+:/.test(match[1])).map((match) => ({ path: match[1], anchor: match[2] }));
}

/**
 * 한 칸(`## 이름`)의 본문 — 다음 `## ` 까지. 칸이 없으면 `null`.
 *
 * @param {string} text
 * @param {string} heading
 * @returns {string | null}
 */
export function sectionOf(text, heading) {
  const start = text.indexOf(`\n## ${heading}\n`);
  if (start === -1) return null;
  const end = text.indexOf('\n## ', start + 1);
  return text.slice(start + 1, end === -1 ? undefined : end);
}

/** @param {string} [root] @returns {string[]} */
export function rolesOf(root = ROOT) {
  return readdirSync(join(root, ROLES_DIR))
    .filter((name) => name.endsWith('.md'))
    .map((name) => name.replace(/\.md$/, ''))
    .sort();
}

/**
 * 역할 문서가 읽게 하는 것 — 고정 파일과 동적 라우트(디렉터리). 둘 다 저장소 뿌리에서의 경로다.
 *
 * @param {string} role
 * @param {string} [root]
 * @returns {{ fixed: string[], routes: string[] }}
 */
export function pointersOf(role, root = ROOT) {
  const doc = join(root, ROLES_DIR, `${role}.md`);
  const text = readFileSync(doc, 'utf8');
  const adrFiles = readdirSync(join(root, 'docs/adr')).filter((name) => /^\d{4}-.+\.md$/.test(name));
  const fixed = new Set();
  const routes = new Set();
  for (const heading of COUNTED_SECTIONS) {
    const section = sectionOf(text, heading) ?? '';
    for (const match of section.matchAll(/`([^`\s]+)`/g)) {
      if (POINTED_PATH.test(match[1]) && isFile(join(root, match[1]))) fixed.add(match[1]);
    }
    for (const { path } of linksOf(section)) {
      const target = resolve(dirname(doc), path);
      if (isFile(target)) fixed.add(relPath(root, target));
      else if (isDirectory(target)) routes.add(`${relPath(root, target)}/`);
    }
    // 「먼저 읽는 것」의 `ADR NNNN` 은 읽을 파일이다. 다른 칸의 ADR 은 출처 표시라 세지 않는다(줄마다 원본 링크가 따로 있다)
    if (heading !== '먼저 읽는 것') continue;
    for (const line of section.split('\n').filter((one) => /\bADR\b/.test(one))) {
      for (const [number] of line.matchAll(/\b0\d{3}\b/g)) {
        const file = adrFiles.find((name) => name.startsWith(`${number}-`));
        if (file !== undefined) fixed.add(`docs/adr/${file}`);
      }
    }
  }
  fixed.delete(relPath(root, doc));
  return { fixed: [...fixed].sort(), routes: [...routes].sort() };
}

/**
 * 역할 하나의 읽기량 — 고정(역할 문서 자신이 첫 줄) · 동적 라우트마다 후보와 최댓값 · 합.
 *
 * @param {string} role
 * @param {string} [root]
 */
export function readBudgetOf(role, root = ROOT) {
  const own = `${ROLES_DIR}/${role}.md`;
  const pointers = pointersOf(role, root);
  /** @type {Record<string, number>} */
  const atLock = SIZE_AT_LOCK;
  const fixed = [own, ...pointers.fixed].map((file) => ({
    file,
    bytes: file !== own && file in atLock ? atLock[file] : statSync(join(root, file)).size,
  }));
  const alreadyRead = new Set([own, ...pointers.fixed]);
  const routes = pointers.routes.map((dir) => {
    const candidates = readdirSync(join(root, dir))
      .filter((name) => name.endsWith('.md') && name !== 'README.md')
      .map((name) => `${dir}${name}`)
      .filter((file) => isFile(join(root, file)) && !alreadyRead.has(file))
      .map((file) => ({ file, bytes: statSync(join(root, file)).size }))
      .sort((a, b) => b.bytes - a.bytes || a.file.localeCompare(b.file));
    return { dir, candidates, max: candidates[0] ?? null };
  });
  const fixedBytes = fixed.reduce((sum, one) => sum + one.bytes, 0);
  const dynamicBytes = routes.reduce((sum, route) => sum + (route.max?.bytes ?? 0), 0);
  return { role, fixed, routes, fixedBytes, dynamicBytes, total: fixedBytes + dynamicBytes };
}

/** @param {number} n */
const grouped = (n) => n.toLocaleString('en-US');

/**
 * 역할마다 고정 · 동적 · 합 · 상한의 표(Markdown).
 *
 * @param {string} [root]
 * @returns {string}
 */
export function tableOf(root = ROOT) {
  const lines = ['| 역할 | 고정 | 동적 | 합 | 상한 | 여유 | 동적 라우트 → 가장 큰 후보 |', '| --- | ---: | ---: | ---: | ---: | ---: | --- |'];
  for (const role of rolesOf(root)) {
    const budget = readBudgetOf(role, root);
    const limit = READ_BUDGET[role]?.bytes;
    const routes = budget.routes.map((route) => `\`${route.dir}\` → ${route.max ? `\`${route.max.file}\` ${grouped(route.max.bytes)}` : '없음'}`).join(' · ');
    lines.push(
      `| ${role} | ${grouped(budget.fixedBytes)} | ${grouped(budget.dynamicBytes)} | ${grouped(budget.total)} | ${limit === undefined ? '—' : grouped(limit)} | ${limit === undefined ? '—' : grouped(limit - budget.total)} | ${routes || '—'} |`,
    );
  }
  return lines.join('\n');
}

if (process.argv[1] === fileURLToPath(import.meta.url)) console.log(tableOf());
