/**
 * **필수 읽기량** — 역할 문서(`docs/roles/`)를 받은 에이전트가 손대기 전에 읽게 되는 바이트 (ADR 0145).
 * `npm run read-budget` 이 역할마다 표로 찍고, `scripts/code-rules.test.ts` 가 같은 함수로 상한을 잰다 — 셈이 두 벌이 되지 않게
 * 계산은 여기 한 곳이다.
 *
 * 읽기량 = **고정** + **동적** + **선택 묶음**.
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
 * - **선택 묶음** — 「서로 다른 자리의 파일 중 하나를 골라 읽는다」는 가리킴이다(후보가 한 폴더에 없어 디렉터리 라우트로는 못
 *   적는다). 표기는 칸 안의 머리 줄 `- 하나를 고른다 — <묶음 이름>` 과, 그 바로 아래 두 칸 들여 쓴 줄 `  - <선택지 이름> — <파일들>`
 *   이고 들여 쓴 줄 하나가 선택지 하나다. 선택지는 파일 여럿일 수 있다(백틱 경로 · 파일 링크 · 「먼저 읽는 것」이면 `ADR NNNN`).
 *   묶음의 값은 **선택지마다 그 파일들의 합 가운데 최댓값**이고, 파일은 고정과 같은 규칙(잠근 크기 · 그 밖은 지금 크기)으로 센다 —
 *   선택지는 고정 원본이 「받은 것 하나」로 옮겨 앉은 것이라 자라는 까닭(간극 대장 · runbook 은 PR 마다 자란다)도 고정과 같다.
 *   묶음 안의 파일은 고정 목록에 들지 않는다. 같은 파일이 묶음 밖의 줄에도 적혀 있으면 고정 쪽에서 세고 선택지 합에서는 0 이다(두 번
 *   세지 않는다). **선택지 안에도 동적 라우트를 둘 수 있다** — 선택지의 원본이 색인이고 「고칠 자리에 맞는 주제 파일만 연다」면
 *   그 폴더를 디렉터리 링크로 적는다(`[그 주제 파일](../agents/code-rules/)`). 선택지의 값 = 그 파일들의 합 + 그 안 라우트마다 후보
 *   최댓값(지금 크기 — 위 동적 라우트와 같은 까닭). 후보에서는 README 와 고정 · 그 선택지의 파일을 뺀다. 머리 줄 아래 선택지가 둘
 *   미만이거나, 선택지 줄의 꼴이 틀리거나, 선택지에 파일이 없으면 셈이 멈춘다(던진다) — 기계가 잘못 읽은 채로 초록이 되지 않게.
 * - **세지 않는 것** — ADR 본문 가운데 「그 영역의 ADR — 색인에서 번호만」처럼 영역마다 달라지는 것. 후보 집합이 영역마다 다르고
 *   커서 색인(`docs/adr/README.md`)만 센다. 「끝날 때 고치는 것」의 쓰는 자리(백틱 디렉터리)도 읽을 것이 아니라 세지 않는다.
 *
 * 상한(`READ_BUDGET`)은 회귀 상한이다 — 임의의 절대 상한은 두지 않는다. 늘리려면 PR 에 까닭을 적고 여기 값을 함께 고친다. 원본을
 * 쪼개 줄였으면 상한도 내린다. 라우트 목록과 선택 묶음(이름 · 선택지 이름의 차례 · 선택지마다 라우트)도 같은 표가 든다 — 동적
 * 링크를 파일 하나로 바꿔치거나(묶음 밖이든 선택지 안이든), 묶음을 평범한 줄로 되돌리거나, 선택지를 줄이면 잠근 목록과 달라 붉어진다.
 */
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { dirname, join, relative, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

export const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
export const ROLES_DIR = 'docs/roles';
/** 읽기량을 세는 칸 — 「하지 않는 것 · 묻는 것」의 출처 링크는 멈출 자리의 근거라 안 센다 */
export const COUNTED_SECTIONS = ['먼저 읽는 것', '이 저장소의 방식', '끝날 때 고치는 것'];

/**
 * 역할마다 잠근 상한(바이트)과 동적 라우트(저장소 뿌리에서의 디렉터리, `/` 로 끝남)와 선택 묶음(이름 · 선택지 이름의 차례 ·
 * 선택지마다 그 안의 동적 라우트).
 *
 * @type {Record<string, { bytes: number, routes: string[], choices: { name: string, options: { name: string, routes: string[] }[] }[] }>}
 */
export const READ_BUDGET = {
  coordinator: { bytes: 95213, routes: [], choices: [] },
  db: { bytes: 128334, routes: [], choices: [] },
  docs: { bytes: 75804, routes: [], choices: [] },
  feature: { bytes: 177516, routes: ['docs/context/', 'docs/product/prd/'], choices: [] },
  ops: { bytes: 98676, routes: [], choices: [] },
  reading: { bytes: 145427, routes: [], choices: [] },
  reviewer: {
    bytes: 112865,
    routes: [],
    choices: [
      {
        name: '받은 관점의 원본',
        options: [
          { name: '코드 규칙', routes: ['docs/agents/code-rules/'] },
          { name: '아키텍트', routes: [] },
          { name: '시험', routes: ['docs/agents/test-map/'] },
          { name: '보안', routes: [] },
          { name: 'DB', routes: [] },
          { name: '프런트', routes: [] },
          { name: '문서', routes: ['docs/product/prd/'] },
          { name: 'SRE', routes: ['docs/ops/runbook/'] },
        ],
      },
    ],
  },
  ui: { bytes: 134935, routes: [], choices: [] },
};

/** 고정 · 선택 묶음으로 가리킨 원본의 잠근 날 크기 — 어느 역할도 안 가리키는 파일은 지운다(시험이 잰다) */
export const SIZE_AT_LOCK = {
  'CODING_STANDARDS.md': 2308,
  'GLOSSARY.md': 2979,
  'README.md': 26108,
  'docs/adr/0084-the-shape-is-asserted-not-only-the-behaviour.md': 7311,
  'docs/adr/0109-the-product-wears-one-soft-look-under-the-name-jeomjeom.md': 8466,
  'docs/adr/0135-the-screen-speaks-haeyo-by-default.md': 4970,
  'docs/adr/README.md': 14962,
  'docs/agents/code-rules/banned-words.md': 1822,
  'docs/agents/code-rules/comments.md': 1735,
  'docs/agents/code-rules/failures.md': 3216,
  'docs/agents/code-rules/locks.md': 2925,
  'docs/agents/code-rules/names.md': 2278,
  'docs/agents/code-rules/screen-copy.md': 2464,
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
  'docs/agents/test-map.md': 2420,
  'docs/agents/test-map/ci.md': 8878,
  'docs/agents/test-map/kinds.md': 5075,
  'docs/agents/test-map/live.md': 2434,
  'docs/agents/test-map/what-to-run.md': 10288,
  'docs/architecture.md': 13790,
  'docs/context/chart.md': 11667,
  'docs/context/code-names.md': 11701,
  'docs/context/copy.md': 7144,
  'docs/context/evidence.md': 19418,
  'docs/notes/2026-09-28-overnight-audit.md': 23358,
  'docs/notes/README.md': 18300,
  'docs/ops/runbook.md': 2895,
  'docs/ops/runbook/access.md': 7790,
  'docs/ops/runbook/deploy.md': 10151,
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

/** 백틱 안에서 파일로 세는 경로 — 뿌리의 `GLOSSARY.md` 같은 문서와 저장소 안의 경로 */
const POINTED_PATH = /^(?:[A-Z][A-Za-z_-]*\.md|(?:app|src|scripts|e2e|docs|supabase|public|\.github|\.claude)\/[A-Za-z0-9_.\/\[\]-]+)$/;
/** `[글](대상#앵커)` — 바깥 주소는 뺀다 */
const MARKDOWN_LINK = /\[[^\]]+\]\(([^)\s#]+)(?:#([^)\s]+))?\)/g;
/** 선택 묶음의 머리 줄 */
const CHOICE_HEAD = /^- 하나를 고른다 — (.+)$/;
/** 선택지 줄 — 두 칸 들여 쓴 `- <선택지 이름> — <파일들>` */
const CHOICE_OPTION = /^ {2}- (.+?) — (.+)$/;

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
 * 글 한 토막이 가리키는 파일과 디렉터리 — 백틱의 뿌리 경로 · Markdown 링크, `withAdr` 이면 `ADR NNNN` 도.
 *
 * @param {string} chunk
 * @param {string} doc 역할 문서의 절대 경로 — 링크는 여기서 푼다
 * @param {string} root
 * @param {boolean} withAdr
 * @returns {{ files: Set<string>, dirs: Set<string> }}
 */
function pointedIn(chunk, doc, root, withAdr) {
  const files = new Set();
  const dirs = new Set();
  for (const match of chunk.matchAll(/`([^`\s]+)`/g)) {
    if (POINTED_PATH.test(match[1]) && isFile(join(root, match[1]))) files.add(match[1]);
  }
  for (const { path } of linksOf(chunk)) {
    const target = resolve(dirname(doc), path);
    if (isFile(target)) files.add(relPath(root, target));
    else if (isDirectory(target)) dirs.add(`${relPath(root, target)}/`);
  }
  if (!withAdr) return { files, dirs };
  const adrFiles = readdirSync(join(root, 'docs/adr')).filter((name) => /^\d{4}-.+\.md$/.test(name));
  for (const line of chunk.split('\n').filter((one) => /\bADR\b/.test(one))) {
    for (const [number] of line.matchAll(/\b0\d{3}\b/g)) {
      const file = adrFiles.find((name) => name.startsWith(`${number}-`));
      if (file !== undefined) files.add(`docs/adr/${file}`);
    }
  }
  return { files, dirs };
}

/**
 * 한 칸을 선택 묶음과 나머지 줄로 가른다. 꼴이 틀린 묶음은 던진다 — 잘못 읽은 채로 세지 않는다.
 *
 * @param {string} section
 * @param {string} where 던질 때 붙이는 자리(역할 · 칸)
 * @returns {{ plain: string, groups: { name: string, options: { name: string, text: string }[] }[] }}
 */
function splitChoices(section, where) {
  const lines = section.split('\n');
  const plain = [];
  const groups = [];
  for (let i = 0; i < lines.length; i += 1) {
    const head = CHOICE_HEAD.exec(lines[i]);
    if (head === null) {
      plain.push(lines[i]);
      continue;
    }
    const options = [];
    while (i + 1 < lines.length && lines[i + 1].startsWith('  ')) {
      i += 1;
      const option = CHOICE_OPTION.exec(lines[i]);
      if (option === null) throw new Error(`${where} 「${head[1]}」: 선택지 줄은 \`  - <이름> — <파일들>\` 이다 — ${lines[i].trim().slice(0, 40)}`);
      options.push({ name: option[1].trim(), text: option[2] });
    }
    if (options.length < 2) throw new Error(`${where} 「${head[1]}」: 선택지가 ${options.length} 개다 — 하나뿐이면 고정 줄로 적는다`);
    groups.push({ name: head[1].trim(), options });
  }
  return { plain: plain.join('\n'), groups };
}

/**
 * 역할 문서가 읽게 하는 것 — 고정 파일 · 동적 라우트(디렉터리) · 선택 묶음. 경로는 모두 저장소 뿌리에서다.
 *
 * @param {string} role
 * @param {string} [root]
 * @returns {{ fixed: string[], routes: string[], choices: { name: string, options: { name: string, files: string[], routes: string[] }[] }[] }}
 */
export function pointersOf(role, root = ROOT) {
  const doc = join(root, ROLES_DIR, `${role}.md`);
  const text = readFileSync(doc, 'utf8');
  const fixed = new Set();
  const routes = new Set();
  const choices = [];
  for (const heading of COUNTED_SECTIONS) {
    // 「먼저 읽는 것」의 `ADR NNNN` 은 읽을 파일이다. 다른 칸의 ADR 은 출처 표시라 세지 않는다(줄마다 원본 링크가 따로 있다)
    const withAdr = heading === '먼저 읽는 것';
    const { plain, groups } = splitChoices(sectionOf(text, heading) ?? '', `${role} 「${heading}」`);
    const pointed = pointedIn(plain, doc, root, withAdr);
    for (const file of pointed.files) fixed.add(file);
    for (const dir of pointed.dirs) routes.add(dir);
    for (const group of groups) {
      const options = group.options.map((option) => {
        const inOption = pointedIn(option.text, doc, root, withAdr);
        const where = `${role} 「${group.name}」 · ${option.name}`;
        if (inOption.files.size === 0) throw new Error(`${where}: 가리킨 파일이 없다 — 선택지는 원본 파일(색인)을 들고, 그 뒤에서 고르는 것만 디렉터리 링크다`);
        return { name: option.name, files: [...inOption.files].sort(), routes: [...inOption.dirs].sort() };
      });
      choices.push({ name: group.name, options });
    }
  }
  fixed.delete(relPath(root, doc));
  return { fixed: [...fixed].sort(), routes: [...routes].sort(), choices };
}

/**
 * 역할 하나의 읽기량 — 고정(역할 문서 자신이 첫 줄) · 동적 라우트마다 후보와 최댓값 · 선택 묶음마다 선택지 합과 최댓값 · 합.
 *
 * @param {string} role
 * @param {string} [root]
 */
export function readBudgetOf(role, root = ROOT) {
  const own = `${ROLES_DIR}/${role}.md`;
  const pointers = pointersOf(role, root);
  /** @type {Record<string, number>} */
  const atLock = SIZE_AT_LOCK;
  /** @param {string} file */
  const sizeOf = (file) => (file !== own && file in atLock ? atLock[file] : statSync(join(root, file)).size);
  const fixed = [own, ...pointers.fixed].map((file) => ({ file, bytes: sizeOf(file) }));
  const alreadyRead = new Set([own, ...pointers.fixed]);
  /** @param {string} dir @param {Set<string>} read 이미 센 파일 — 후보에서 뺀다 */
  const routeOf = (dir, read) => {
    const candidates = readdirSync(join(root, dir))
      .filter((name) => name.endsWith('.md') && name !== 'README.md')
      .map((name) => `${dir}${name}`)
      .filter((file) => isFile(join(root, file)) && !read.has(file))
      .map((file) => ({ file, bytes: statSync(join(root, file)).size }))
      .sort((a, b) => b.bytes - a.bytes || a.file.localeCompare(b.file));
    return { dir, candidates, max: candidates[0] ?? null };
  };
  const routes = pointers.routes.map((dir) => routeOf(dir, alreadyRead));
  // 묶음 밖에도 적힌 파일은 고정에서 이미 셌다 — 선택지 합에서는 0 이다. 선택지 안의 라우트는 고정과 그 선택지의 파일을 후보에서 뺀다
  const choices = pointers.choices.map((group) => {
    const options = group.options.map((option) => {
      const files = option.files.map((file) => ({ file, inFixed: alreadyRead.has(file), bytes: alreadyRead.has(file) ? 0 : sizeOf(file) }));
      const optionRoutes = option.routes.map((dir) => routeOf(dir, new Set([...alreadyRead, ...option.files])));
      const fileBytes = files.reduce((sum, one) => sum + one.bytes, 0);
      const routeBytes = optionRoutes.reduce((sum, route) => sum + (route.max?.bytes ?? 0), 0);
      return { name: option.name, files, routes: optionRoutes, fileBytes, routeBytes, bytes: fileBytes + routeBytes };
    });
    const max = options.reduce((best, option) => (option.bytes > best.bytes ? option : best), options[0]);
    return { name: group.name, options, max };
  });
  const fixedBytes = fixed.reduce((sum, one) => sum + one.bytes, 0);
  const dynamicBytes = routes.reduce((sum, route) => sum + (route.max?.bytes ?? 0), 0);
  const choiceBytes = choices.reduce((sum, group) => sum + group.max.bytes, 0);
  return { role, fixed, routes, choices, fixedBytes, dynamicBytes, choiceBytes, total: fixedBytes + dynamicBytes + choiceBytes };
}

/** @param {number} n */
const grouped = (n) => n.toLocaleString('en-US');

/** 표의 칸 — 시험은 「합」 칸을 이름으로 찾는다 */
export const TABLE_COLUMNS = ['역할', '고정', '동적', '묶음', '합', '상한', '여유', '동적 라우트 → 가장 큰 후보', '선택 묶음 → 선택지마다 합(굵게가 최댓값)'];

/**
 * 역할마다 고정 · 동적 · 묶음 · 합 · 상한의 표(Markdown).
 *
 * @param {string} [root]
 * @returns {string}
 */
export function tableOf(root = ROOT) {
  const lines = [`| ${TABLE_COLUMNS.join(' | ')} |`, '| --- | ---: | ---: | ---: | ---: | ---: | ---: | --- | --- |'];
  for (const role of rolesOf(root)) {
    const budget = readBudgetOf(role, root);
    const limit = READ_BUDGET[role]?.bytes;
    const routes = budget.routes.map((route) => `\`${route.dir}\` → ${route.max ? `\`${route.max.file}\` ${grouped(route.max.bytes)}` : '없음'}`).join(' · ');
    const choices = budget.choices
      .map((group) => {
        const options = group.options.map((option) => {
          const routes = option.routes.map((route) => (route.max ? `\`${route.max.file}\`` : `\`${route.dir}\` 없음`)).join(' · ');
          const cell = option.routes.length === 0 ? `${option.name} ${grouped(option.bytes)}` : `${option.name} ${grouped(option.bytes)}(${grouped(option.fileBytes)} + ${routes} ${grouped(option.routeBytes)})`;
          return option === group.max ? `**${cell}**` : cell;
        });
        return `「${group.name}」 → ${options.join(' · ')}`;
      })
      .join(' / ');
    lines.push(
      `| ${role} | ${grouped(budget.fixedBytes)} | ${grouped(budget.dynamicBytes)} | ${grouped(budget.choiceBytes)} | ${grouped(budget.total)} | ${limit === undefined ? '—' : grouped(limit)} | ${limit === undefined ? '—' : grouped(limit - budget.total)} | ${routes || '—'} | ${choices || '—'} |`,
    );
  }
  return lines.join('\n');
}

if (process.argv[1] === fileURLToPath(import.meta.url)) console.log(tableOf());
