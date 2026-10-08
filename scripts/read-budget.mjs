/**
 * **필수 읽기량** — 역할 문서(`docs/roles/`)를 받은 에이전트가 손대기 전에 읽게 되는 바이트 (ADR 0145 · 0147).
 * `npm run read-budget` 이 역할마다 표로 찍고, `scripts/code-rules.test.ts` 가 같은 함수로 상한을 잰다 — 셈이 두 벌이 되지 않게
 * 계산은 여기 한 곳이다.
 *
 * 읽기량 = **고정** + **동적** + **선택 묶음**. 크기는 모두 **지금 크기**다 — 에이전트가 오늘 읽는 바이트다(ADR 0147).
 *
 * - **세는 칸** — 「먼저 읽는 것」 · 「이 저장소의 방식」 · 「끝날 때 고치는 것」. 「하지 않는 것 · 묻는 것」의 출처 링크와
 *   **「닿을 때 여는 것」**(일이 그 자리에 닿을 때만 여는 원본, ADR 0147)은 세지 않는다.
 * - **고정** — 역할 문서 자신과, 세는 칸이 가리키는 **파일**(백틱의 뿌리 경로 · Markdown 링크)과 「먼저 읽는 것」이 번호로 부르는
 *   ADR(`ADR NNNN` → `docs/adr/NNNN-*.md`). 다른 칸의 ADR 번호는 출처 표시라 안 센다. 백틱 **디렉터리**는 「어디에 사는가 · 어디에
 *   쓰는가」라 세지 않는다 — 「끝날 때 고치는 것」의 쓰는 자리는 그렇게 적는다.
 * - **절** — 가리킴이 절을 들면 그 절만 센다: 백틱 경로 바로 뒤의 `「절」`(제목이 그 글자로 시작하는 첫 제목) · 링크의 `#앵커`.
 *   절은 그 제목부터 같거나 높은 다음 제목 앞까지다. 한 파일을 절 없이 한 번이라도 가리키면 파일 전부를 센다. 같은 파일의 절이
 *   겹치면 한 번만 센다. 가리킨 절이 없으면 셈이 멈춘다(던진다).
 * - **동적 라우트** — 「여러 파일 중 하나를 골라 읽는다」는 가리킴이다. 표기는 **디렉터리를 가리키는 Markdown 링크** 하나뿐이다
 *   (`[영역 파일](../context/)`). 후보는 그 디렉터리 바로 아래의 `.md`(README 와, 그 역할이 이미 고정으로 읽는 파일은 뺀다)이고,
 *   라우트마다 **후보 가운데 가장 큰 파일**을 센다.
 * - **선택 묶음** — 「서로 다른 자리의 파일 중 하나를 골라 읽는다」는 가리킴이다. 표기는 칸 안의 머리 줄 `- 하나를 고른다 — <묶음
 *   이름>` 과, 그 바로 아래 두 칸 들여 쓴 줄 `  - <선택지 이름> — <파일들>` 이고 들여 쓴 줄 하나가 선택지 하나다. 선택지는 파일
 *   여럿 · 절 · 디렉터리 링크(그 선택지의 동적 라우트)를 들 수 있다. 선택지의 값 = 그 파일들 가운데 **고정이 아직 안 센 바이트** +
 *   그 안 라우트마다 후보 최댓값. 묶음의 값은 선택지 값의 최댓값이다. 머리 줄 아래 선택지가 둘 미만이거나, 선택지 줄의 꼴이
 *   틀리거나, 선택지에 파일이 없으면 셈이 멈춘다(던진다) — 기계가 잘못 읽은 채로 초록이 되지 않게.
 * - **세지 않는 것** — ADR 본문 가운데 「그 영역의 ADR — 색인에서 번호만」처럼 영역마다 달라지는 것(색인 `docs/adr/README.md` 만
 *   센다), 「닿을 때 여는 것」, 백틱 디렉터리.
 *
 * **상한(`READ_BUDGET` 의 `bytes`)은 여유를 둔 천장이다**(ADR 0147). `CEILING_STEP` 의 배수이고, 정할 때는 그때의 합에서
 * `CEILING_STEP / 2` 이상 남는 가장 작은 배수를 고른다. 합이 천장을 넘으면 붉고(파일 하나 · 큰 절 하나가 늘었다), 천장이 합보다
 * `MAX_SLACK` 넘게 남아도 붉다(줄였으면 내린다 — 남는 여유에 새 원본이 숨지 않게). 천장을 바꾸면 ADR 에 `| 역할 | … | 천장 |` 줄을
 * 남긴다 — 시험이 그 줄을 찾는다. 라우트 목록과 선택 묶음(이름 · 선택지 이름의 차례 · 선택지마다 라우트)도 같은 표가 든다 — 동적
 * 링크를 파일 하나로 바꿔치거나, 묶음을 평범한 줄로 되돌리거나, 선택지를 줄이면 잠근 목록과 달라 붉어진다.
 */
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { dirname, join, relative, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

export const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
export const ROLES_DIR = 'docs/roles';
/** 읽기량을 세는 칸 — 「하지 않는 것 · 묻는 것」의 출처 링크는 멈출 자리의 근거라, 「닿을 때 여는 것」은 그때만 여는 것이라 안 센다 */
export const COUNTED_SECTIONS = ['먼저 읽는 것', '이 저장소의 방식', '끝날 때 고치는 것'];
/** 일이 그 자리에 닿을 때만 여는 원본의 칸 — 세지 않는다. 줄마다 `- <언제> → [원본](경로)` 이다(ADR 0147) */
export const ON_DEMAND_SECTION = '닿을 때 여는 것';
/** 천장의 눈금 — 천장은 이 수의 배수다. 파일 이름 한 글자 · 역할 문서 한 줄은 눈금 하나를 못 넘는다 */
export const CEILING_STEP = 5000;
/** 천장이 합보다 이만큼 넘게 남으면 붉다 — 줄인 PR 이 천장도 내린다 */
export const MAX_SLACK = 10000;

/**
 * 역할마다 천장(바이트)과 동적 라우트(저장소 뿌리에서의 디렉터리, `/` 로 끝남)와 선택 묶음(이름 · 선택지 이름의 차례 ·
 * 선택지마다 그 안의 동적 라우트).
 *
 * @type {Record<string, { bytes: number, routes: string[], choices: { name: string, options: { name: string, routes: string[] }[] }[] }>}
 */
export const READ_BUDGET = {
  coordinator: { bytes: 65000, routes: [], choices: [] },
  db: { bytes: 85000, routes: [], choices: [] },
  docs: { bytes: 60000, routes: [], choices: [] },
  feature: { bytes: 95000, routes: ['docs/product/prd/'], choices: [] },
  ops: { bytes: 50000, routes: [], choices: [] },
  reading: {
    bytes: 85000,
    routes: [],
    choices: [
      {
        name: '고칠 자리(둘에 걸치면 둘 다)',
        options: [
          { name: '엔진', routes: [] },
          { name: '글 · 프롬프트', routes: [] },
          { name: '풀이 화면 · 흐름', routes: [] },
        ],
      },
    ],
  },
  reviewer: {
    bytes: 80000,
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
  ui: { bytes: 80000, routes: [], choices: [] },
};

/** 백틱 안에서 파일로 세는 경로 — 뿌리의 `GLOSSARY.md` 같은 문서와 저장소 안의 경로. 바로 뒤의 `「절」` 들은 그 파일의 절이다 */
const POINTED_PATH = /^(?:[A-Z][A-Za-z_-]*\.md|(?:app|src|scripts|e2e|docs|supabase|public|\.github|\.claude)\/[A-Za-z0-9_.\/\[\]-]+)$/;
const BACKTICK_WITH_SECTIONS = /`([^`\s]+)`((?:\s*(?:·\s*)?「[^」]+」)*)/g;
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
 * GitHub 가 제목에 다는 앵커 — 굵기 · 백틱을 걷고 낱자 · 숫자 · `-` · `_` · 빈칸만 남겨 빈칸을 `-` 로.
 *
 * @param {string} title
 */
const anchorOf = (title) =>
  title
    .replace(/\*\*|`/g, '')
    .trim()
    .toLowerCase()
    .replace(/[^\p{L}\p{M}\p{N}\p{Pc}\- ]/gu, '')
    .replace(/ /g, '-');

/**
 * 파일의 제목들 — 바이트 위치 · 깊이 · 글자 · 앵커(같은 앵커가 또 서면 `-1` …). 코드 울타리 안은 뺀다.
 *
 * @param {string} text
 * @returns {{ start: number, end: number, depth: number, title: string, anchor: string }[]}
 */
function headingsOf(text) {
  const heads = [];
  const seen = new Map();
  let offset = 0;
  let fenced = false;
  for (const line of text.split('\n')) {
    if (line.startsWith('```')) fenced = !fenced;
    const match = fenced ? null : /^(#{1,6}) (.+)$/.exec(line);
    if (match) {
      const base = anchorOf(match[2]);
      const count = seen.get(base) ?? 0;
      seen.set(base, count + 1);
      heads.push({ start: offset, end: -1, depth: match[1].length, title: match[2].replace(/\*\*/g, '').trim(), anchor: count === 0 ? base : `${base}-${count}` });
    }
    offset += Buffer.byteLength(line) + 1;
  }
  const size = Buffer.byteLength(text);
  for (const [i, head] of heads.entries()) head.end = heads.slice(i + 1).find((next) => next.depth <= head.depth)?.start ?? size;
  return heads;
}

/**
 * @typedef {{ whole: boolean, titles: Set<string>, anchors: Set<string> }} Mention 한 파일을 어떻게 가리켰나 — 통째로 · 「절」 · `#앵커`
 * @typedef {[number, number][]} Ranges 센 바이트 구간(겹치지 않게 합친 것)
 */

/** @param {Map<string, Mention>} into @param {string} file @param {Partial<{ whole: boolean, title: string, anchor: string }>} how */
function mention(into, file, how) {
  const one = into.get(file) ?? { whole: false, titles: new Set(), anchors: new Set() };
  if (how.whole) one.whole = true;
  if (how.title) one.titles.add(how.title);
  if (how.anchor) one.anchors.add(how.anchor);
  into.set(file, one);
}

/** @param {Map<string, Mention>} into @param {Map<string, Mention>} from */
function mergeMentions(into, from) {
  for (const [file, one] of from) {
    if (one.whole) mention(into, file, { whole: true });
    for (const title of one.titles) mention(into, file, { title });
    for (const anchor of one.anchors) mention(into, file, { anchor });
  }
}

/**
 * 글 한 토막이 가리키는 파일(어떻게 가리켰나와 함께)과 디렉터리 — 백틱의 뿌리 경로와 그 뒤 「절」 · Markdown 링크와 앵커,
 * `withAdr` 이면 `ADR NNNN` 도(통째로).
 *
 * @param {string} chunk
 * @param {string} doc 역할 문서의 절대 경로 — 링크는 여기서 푼다
 * @param {string} root
 * @param {boolean} withAdr
 * @returns {{ files: Map<string, Mention>, dirs: Set<string> }}
 */
function pointedIn(chunk, doc, root, withAdr) {
  /** @type {Map<string, Mention>} */
  const files = new Map();
  const dirs = new Set();
  for (const match of chunk.matchAll(BACKTICK_WITH_SECTIONS)) {
    if (!POINTED_PATH.test(match[1]) || !isFile(join(root, match[1]))) continue;
    const titles = match[1].endsWith('.md') ? [...match[2].matchAll(/「([^」]+)」/g)].map((quoted) => quoted[1]) : [];
    if (titles.length === 0) mention(files, match[1], { whole: true });
    for (const title of titles) mention(files, match[1], { title });
  }
  for (const { path, anchor } of linksOf(chunk)) {
    const target = resolve(dirname(doc), path);
    if (isFile(target)) mention(files, relPath(root, target), anchor ? { anchor: decodeURIComponent(anchor) } : { whole: true });
    else if (isDirectory(target)) dirs.add(`${relPath(root, target)}/`);
  }
  if (!withAdr) return { files, dirs };
  const adrFiles = readdirSync(join(root, 'docs/adr')).filter((name) => /^\d{4}-.+\.md$/.test(name));
  for (const line of chunk.split('\n').filter((one) => /\bADR\b/.test(one))) {
    for (const [number] of line.matchAll(/\b0\d{3}\b/g)) {
      const file = adrFiles.find((name) => name.startsWith(`${number}-`));
      if (file !== undefined) mention(files, `docs/adr/${file}`, { whole: true });
    }
  }
  return { files, dirs };
}

/** @param {Ranges} ranges @returns {Ranges} */
function union(ranges) {
  const sorted = [...ranges].sort((a, b) => a[0] - b[0]);
  /** @type {Ranges} */
  const out = [];
  for (const [start, end] of sorted) {
    const last = out[out.length - 1];
    if (last && start <= last[1]) last[1] = Math.max(last[1], end);
    else out.push([start, end]);
  }
  return out;
}

/** @param {Ranges} ranges */
const bytesOf = (ranges) => ranges.reduce((sum, [start, end]) => sum + end - start, 0);

/** `ranges` 가운데 `minus` 에 안 든 바이트 — 선택지가 고정이 이미 센 자리를 두 번 세지 않게 @param {Ranges} ranges @param {Ranges} minus */
function bytesOutside(ranges, minus) {
  let total = 0;
  for (const [start, end] of ranges) {
    let covered = 0;
    for (const [from, to] of minus) covered += Math.max(0, Math.min(end, to) - Math.max(start, from));
    total += end - start - covered;
  }
  return total;
}

/**
 * 가리킨 자리의 바이트 구간 — 통째로면 파일 전부, 아니면 「절」 · 앵커마다 그 절. 없는 절은 던진다.
 *
 * @param {string} root
 * @param {string} file
 * @param {Mention} how
 * @returns {Ranges}
 */
function rangesOf(root, file, how) {
  const text = readFileSync(join(root, file), 'utf8');
  if (how.whole) return [[0, Buffer.byteLength(text)]];
  const heads = headingsOf(text);
  /** @type {Ranges} */
  const ranges = [];
  for (const title of how.titles) {
    const head = heads.find((one) => one.title.startsWith(title));
    if (head === undefined) throw new Error(`${file} 「${title}」: 그 글자로 시작하는 제목이 없다`);
    ranges.push([head.start, head.end]);
  }
  for (const anchor of how.anchors) {
    const head = heads.find((one) => one.anchor === anchor);
    if (head === undefined) throw new Error(`${file}#${anchor}: 그 앵커의 제목이 없다`);
    ranges.push([head.start, head.end]);
  }
  return union(ranges);
}

/** @param {Mention} how @returns {string[] | null} 센 절(「절」 · `#앵커`) — 통째로면 `null` */
const sectionsOfMention = (how) => (how.whole ? null : [...[...how.titles].map((title) => `「${title}」`), ...[...how.anchors].map((anchor) => `#${anchor}`)]);

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
 * @returns {{ fixed: string[], fixedHow: Map<string, Mention>, routes: string[], choices: { name: string, options: { name: string, files: string[], how: Map<string, Mention>, routes: string[] }[] }[] }}
 */
export function pointersOf(role, root = ROOT) {
  const doc = join(root, ROLES_DIR, `${role}.md`);
  const text = readFileSync(doc, 'utf8');
  /** @type {Map<string, Mention>} */
  const fixedHow = new Map();
  const routes = new Set();
  const choices = [];
  for (const heading of COUNTED_SECTIONS) {
    // 「먼저 읽는 것」의 `ADR NNNN` 은 읽을 파일이다. 다른 칸의 ADR 은 출처 표시라 세지 않는다(줄마다 원본 링크가 따로 있다)
    const withAdr = heading === '먼저 읽는 것';
    const { plain, groups } = splitChoices(sectionOf(text, heading) ?? '', `${role} 「${heading}」`);
    const pointed = pointedIn(plain, doc, root, withAdr);
    mergeMentions(fixedHow, pointed.files);
    for (const dir of pointed.dirs) routes.add(dir);
    for (const group of groups) {
      const options = group.options.map((option) => {
        const inOption = pointedIn(option.text, doc, root, withAdr);
        const where = `${role} 「${group.name}」 · ${option.name}`;
        if (inOption.files.size === 0) throw new Error(`${where}: 가리킨 파일이 없다 — 선택지는 원본 파일(색인)을 들고, 그 뒤에서 고르는 것만 디렉터리 링크다`);
        return { name: option.name, files: [...inOption.files.keys()].sort(), how: inOption.files, routes: [...inOption.dirs].sort() };
      });
      choices.push({ name: group.name, options });
    }
  }
  fixedHow.delete(relPath(root, doc));
  return { fixed: [...fixedHow.keys()].sort(), fixedHow, routes: [...routes].sort(), choices };
}

/**
 * 역할 하나의 읽기량 — 고정(역할 문서 자신이 첫 줄, 센 절과 함께) · 동적 라우트마다 후보와 최댓값 · 선택 묶음마다 선택지 합과
 * 최댓값 · 합.
 *
 * @param {string} role
 * @param {string} [root]
 */
export function readBudgetOf(role, root = ROOT) {
  const own = `${ROLES_DIR}/${role}.md`;
  const pointers = pointersOf(role, root);
  /** @type {Map<string, Ranges>} */
  const fixedRanges = new Map([[own, rangesOf(root, own, { whole: true, titles: new Set(), anchors: new Set() })]]);
  for (const file of pointers.fixed) fixedRanges.set(file, rangesOf(root, file, /** @type {Mention} */ (pointers.fixedHow.get(file))));
  const fixed = [...fixedRanges].map(([file, ranges]) => ({
    file,
    sections: file === own ? null : sectionsOfMention(/** @type {Mention} */ (pointers.fixedHow.get(file))),
    bytes: bytesOf(ranges),
  }));
  const alreadyRead = new Set(fixedRanges.keys());
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
  // 선택지는 고정이 이미 센 바이트를 다시 세지 않는다. 선택지 안의 라우트는 고정과 그 선택지의 파일을 후보에서 뺀다
  const choices = pointers.choices.map((group) => {
    const options = group.options.map((option) => {
      const files = option.files.map((file) => {
        const how = /** @type {Mention} */ (option.how.get(file));
        const ranges = rangesOf(root, file, how);
        return { file, sections: sectionsOfMention(how), inFixed: alreadyRead.has(file), bytes: bytesOutside(ranges, fixedRanges.get(file) ?? []) };
      });
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

/**
 * 합에 맞는 천장 — `CEILING_STEP / 2` 이상 남는 가장 작은 `CEILING_STEP` 의 배수. 천장을 다시 정할 때 이 값을 쓴다.
 *
 * @param {number} total
 */
export const ceilingFor = (total) => Math.ceil((total + CEILING_STEP / 2) / CEILING_STEP) * CEILING_STEP;

/** @param {number} n */
export const grouped = (n) => n.toLocaleString('en-US');

/** 표의 칸 — 시험은 「합」 칸을 이름으로 찾는다 */
export const TABLE_COLUMNS = ['역할', '고정', '동적', '묶음', '합', '천장', '여유', '동적 라우트 → 가장 큰 후보', '선택 묶음 → 선택지마다 합(굵게가 최댓값)'];

/**
 * 역할마다 고정 · 동적 · 묶음 · 합 · 천장의 표(Markdown).
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

/**
 * 한 역할의 고정 목록 — 파일 · 센 절 · 바이트, 큰 것부터. `npm run read-budget -- <역할>` 이 찍는다(무엇을 줄일지 볼 때).
 *
 * @param {string} role
 * @param {string} [root]
 */
export function detailOf(role, root = ROOT) {
  const budget = readBudgetOf(role, root);
  const rows = [...budget.fixed].sort((a, b) => b.bytes - a.bytes).map((one) => `| ${one.file} | ${one.sections ? one.sections.join(' · ') : '전부'} | ${grouped(one.bytes)} |`);
  return [`| ${role} 고정 | 센 자리 | 바이트 |`, '| --- | --- | ---: |', ...rows].join('\n');
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const role = process.argv[2];
  console.log(role ? detailOf(role) : tableOf());
}
