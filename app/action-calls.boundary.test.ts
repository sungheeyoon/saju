import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { dirname, join, relative, sep } from 'node:path';

import ts from 'typescript';
import { describe, expect, it } from 'vitest';

/**
 * **화면이 서버 액션을 부르는 자리는 그 부름이 던져도 받는다** — `actionAnswer(…)` 로 감싸거나, `catch` 가 있는 `try` 안이거나,
 * `.catch(…)` 를 바로 붙인다(`docs/agents/code-rules/failures.md` 「실패를 말하는 법」).
 *
 * 액션은 값으로 답하지만 부름 자체가 던지는 길이 남는다 — 망이 끊김 · 배포 직후 화면이 든 액션 id 를 서버가 모름 · 액션 안의
 * 받지 않은 예외. 받지 않으면 예외가 전환을 타고 오류 경계(`app/error.tsx`)로 올라가 머리글 아래가 오류 화면으로 바뀌고 쓰던
 * 입력이 사라진다(`app/ui/action-answer.ts`).
 *
 * ## 무엇을 재나
 *
 * `'use client'` 파일이 `'use server'` 파일(맨 위 줄)에서 이름으로 들여온 함수를 **부르는 자리** 전부. 들여온 이름을 넘기기만
 * 하는 자리(`claimCarriedTaste(…, claimTaste)`)는 부름이 아니다 — 받는 쪽이 부른다.
 *
 * ## 못 재는 것
 *
 * - **속성으로 받은 액션** — 서버 화면이 액션을 넘기고(`onSave={…}`) 클라이언트가 그 속성을 부르면 이름이 끊긴다. 지금 그런
 *   자리(`ReportForm` 의 `send`)는 손으로 감쌌다.
 * - **인자로 받은 액션** — `app/carried-taste.ts` 처럼 액션을 인자로 받아 부르는 모듈은 이름이 끊긴다. 지금 그 모듈은 `try` 로 받는다.
 * - `'use client'` 가 없는데 클라이언트 묶음에 드는 파일(클라이언트 파일이 부르는 모듈)은 안 훑는다.
 */

const ROOT = 'app';

function sourceFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((entry) => {
    const path = join(dir, entry);
    if (entry === 'node_modules' || entry.startsWith('.')) return [];
    if (statSync(path).isDirectory()) return sourceFiles(path);
    return /\.tsx?$/.test(entry) && !/\.test\.tsx?$/.test(entry) ? [path] : [];
  });
}

const asPosix = (path: string) => relative(process.cwd(), path).split(sep).join('/');

const parse = (path: string) => {
  const text = readFileSync(path, 'utf8');
  const kind = path.endsWith('.tsx') ? ts.ScriptKind.TSX : ts.ScriptKind.TS;
  return ts.createSourceFile(path, text, ts.ScriptTarget.Latest, true, kind);
};

const sources = sourceFiles(ROOT).map((path) => ({ path: asPosix(path), source: parse(path) }));

/** 맨 위 줄의 지시어 — `'use client'` · `'use server'` */
function directive(source: ts.SourceFile): string | null {
  const first = source.statements[0];
  return first !== undefined && ts.isExpressionStatement(first) && ts.isStringLiteral(first.expression)
    ? first.expression.text
    : null;
}

const SERVER_FILES = new Set(sources.filter(({ source }) => directive(source) === 'use server').map(({ path }) => path));

/** import 의 대상을 저장소 안 파일로 — `@/` 별칭과 상대경로, 확장자 없이 */
function resolved(from: string, spec: string): string | null {
  const base = spec.startsWith('@/') ? spec.slice(2) : spec.startsWith('.') ? join(dirname(from), spec) : null;
  if (base === null) return null;
  for (const candidate of [`${base}.ts`, `${base}.tsx`, join(base, 'index.ts')]) {
    const path = candidate.split(sep).join('/');
    if (existsSync(path)) return path;
  }
  return null;
}

/** 이 파일에서 액션을 가리키는 이름 — 바꾼 이름(`import { a as b }`)이면 `b` */
function actionNames(path: string, source: ts.SourceFile): Set<string> {
  const names = new Set<string>();
  for (const statement of source.statements) {
    if (!ts.isImportDeclaration(statement) || !ts.isStringLiteral(statement.moduleSpecifier)) continue;
    if (statement.importClause?.isTypeOnly) continue;
    const target = resolved(path, statement.moduleSpecifier.text);
    if (target === null || !SERVER_FILES.has(target)) continue;
    const bindings = statement.importClause?.namedBindings;
    if (!bindings || !ts.isNamedImports(bindings)) continue;
    for (const element of bindings.elements) if (!element.isTypeOnly) names.add(element.name.text);
  }
  return names;
}

const isFunctionLike = (node: ts.Node) =>
  ts.isArrowFunction(node) || ts.isFunctionExpression(node) || ts.isFunctionDeclaration(node) || ts.isMethodDeclaration(node);

/** 받는 자리인가 — `actionAnswer(부름, …)` · 같은 함수 안의 `try { … } catch` · `부름.catch(…)` */
function received(call: ts.CallExpression): boolean {
  const parent = call.parent;
  if (
    ts.isCallExpression(parent) &&
    ts.isIdentifier(parent.expression) &&
    parent.expression.text === 'actionAnswer' &&
    parent.arguments[0] === call
  ) {
    return true;
  }
  if (ts.isPropertyAccessExpression(parent) && parent.name.text === 'catch' && ts.isCallExpression(parent.parent)) return true;
  /* 함수 경계에서 멈춘다 — 바깥 함수의 `try` 는 안쪽 비동기 함수가 나중에 던진 것을 못 받는다 */
  for (let at: ts.Node = call; at.parent && !isFunctionLike(at); at = at.parent) {
    if (ts.isTryStatement(at.parent) && at.parent.tryBlock === at && at.parent.catchClause) return true;
  }
  return false;
}

/** 받지 않은 액션 부름 — `파일 :: 이름` */
function unreceivedCalls(): string[] {
  const out: string[] = [];
  for (const { path, source } of sources) {
    if (directive(source) !== 'use client') continue;
    const names = actionNames(path, source);
    if (names.size === 0) continue;
    const visit = (node: ts.Node) => {
      if (ts.isCallExpression(node) && ts.isIdentifier(node.expression) && names.has(node.expression.text) && !received(node)) {
        out.push(`${path} :: ${node.expression.text}`);
      }
      ts.forEachChild(node, visit);
    };
    visit(source);
  }
  return out.sort();
}

/**
 * **아직 안 받는 자리 — 줄어들기만 한다.** 다른 작업이 맡은 파일이라 이번에 안 고쳤다(`docs/product/gaps.md` G-95).
 * 하나를 감싸면 그 줄을 지운다 — 남은 줄이 있으면 시험이 붉어져 지우라고 말한다.
 */
const NOT_YET: readonly string[] = [
  'app/me/chat/composer.tsx :: sendChatMessage',
  'app/me/discovery/manage.tsx :: setDiscoveryParticipation',
  'app/me/profile/form.tsx :: checkNickname',
  'app/me/profile/form.tsx :: saveProfile',
  'app/me/profile/photo-grid.tsx :: movePhoto',
  'app/me/profile/photo-grid.tsx :: removePhoto',
];

/**
 * **다른 모양으로 받는 자리** — 부름 바로 곁이 아니라서 위의 셋으로는 안 보이지만 받는다. 까닭을 적는다.
 */
const RECEIVED_ELSEWHERE: Readonly<Record<string, string>> = {
  'app/me/chat/[matchId]/report.tsx :: reportChatMessage': '`ReportForm` 의 `send` 로 넘기고, 받는 쪽이 `actionAnswer(send(…))` 로 부른다(`app/me/requests/report-block.tsx`)',
  'app/me/chat/[matchId]/report.tsx :: reportUser': '같다',
  'app/me/home/running-band-live.tsx :: runningLinesNow': '부르는 `ask` 를 `watchRun` 이 `try` 로 받는다(`app/me/reading/watch-run.ts`)',
  'app/me/reading/share-button.tsx :: shareMyReading': '약속을 클립보드에 넘기려고 기다리지 않고 들고, `issued.catch` 와 `answered.catch` 로 받는다',
};

describe('화면의 액션 부름', () => {
  it('클라이언트 파일이 부르는 서버 액션은 던져도 받는다 — 남은 자리는 목록과 같다', () => {
    const left = unreceivedCalls().filter((call) => !(call in RECEIVED_ELSEWHERE));
    expect(left).toEqual([...NOT_YET].sort());
  });

  it('다른 모양으로 받는 자리의 목록은 지금 있는 부름만 든다', () => {
    const calls = new Set(unreceivedCalls());
    expect(Object.keys(RECEIVED_ELSEWHERE).filter((call) => !calls.has(call))).toEqual([]);
  });

  it('잰다 — 액션을 들여오는 클라이언트 파일이 있고, 그 부름을 센다', () => {
    const clientFiles = sources.filter(({ path, source }) => directive(source) === 'use client' && actionNames(path, source).size > 0);
    expect(clientFiles.length).toBeGreaterThan(15);
  });

  it('받지 않은 부름 · 바깥 함수의 try 는 받는 자리가 아니다', () => {
    const calls = (text: string) => {
      const source = ts.createSourceFile('x.tsx', text, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
      const found: boolean[] = [];
      const visit = (node: ts.Node) => {
        if (ts.isCallExpression(node) && ts.isIdentifier(node.expression) && node.expression.text === 'act') found.push(received(node));
        ts.forEachChild(node, visit);
      };
      visit(source);
      return found;
    };
    expect(calls('async () => { await act(); }')).toEqual([false]);
    expect(calls('async () => { await actionAnswer(act()); }')).toEqual([true]);
    expect(calls('async () => { await actionAnswer(other(act())); }')).toEqual([false]);
    expect(calls('async () => { try { await act(); } catch {} }')).toEqual([true]);
    expect(calls('async () => { try { await act(); } finally {} }')).toEqual([false]);
    expect(calls('try { start(async () => { await act(); }); } catch {}')).toEqual([false]);
    expect(calls('void act().catch(() => null);')).toEqual([true]);
    expect(calls('void act().then(() => null);')).toEqual([false]);
  });
});
