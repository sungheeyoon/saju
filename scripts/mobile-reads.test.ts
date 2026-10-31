import { readFileSync, readdirSync } from 'node:fs';
import { join, relative } from 'node:path';

import ts from 'typescript';
import { describe, expect, it } from 'vitest';

/**
 * **앱의 `.then(` 은 거절을 받는다.** 받지 않으면 읽기가 던진 날 첫 답을 기다리는 화면이 빈 채로 멈춘다 — 관문은 그 뒤의 앱 전체를 멈춘다.
 * 받는 꼴은 셋이다: `settled(읽기, …).then(`, 체인 어딘가의 `.catch(`, `.then(` 의 둘째 인자.
 */
const ROOT = join(import.meta.dirname, '..');

/** 안에서 스스로 받아 던지지 않는 읽기 — 받아 주는 코드가 그 함수 안에 있다 */
const NEVER_REJECTS = new Set(['readGate']);

const filesUnder = (dir: string): string[] =>
  readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const path = join(dir, entry.name);
    return entry.isDirectory() ? filesUnder(path) : [path];
  });

const callNamed = (node: ts.Node, name: string): node is ts.CallExpression & { expression: ts.PropertyAccessExpression } =>
  ts.isCallExpression(node) && ts.isPropertyAccessExpression(node.expression) && node.expression.name.text === name;

/** 체인을 뿌리까지 내려간다 — `a().catch().then()` 의 `.then` 은 앞의 `.catch` 로 받혔다 */
function handledBelow(node: ts.Expression): boolean {
  if (callNamed(node, 'catch')) return true;
  if (callNamed(node, 'then')) return node.arguments.length > 1 || handledBelow(node.expression.expression);
  if (callNamed(node, 'finally')) return handledBelow(node.expression.expression);
  if (ts.isCallExpression(node) && ts.isIdentifier(node.expression)) return node.expression.text === 'settled' || NEVER_REJECTS.has(node.expression.text);
  return false;
}

/** 체인을 위로 올라간다 — `.then(…).catch(…)` */
function handledAbove(node: ts.Node): boolean {
  const access = node.parent;
  /* `settled(a().then(f), …)` — 그 부름이 체인 전체를 받는다 */
  if (ts.isCallExpression(access) && ts.isIdentifier(access.expression) && access.expression.text === 'settled') return true;
  if (!ts.isPropertyAccessExpression(access) || !ts.isCallExpression(access.parent)) return false;
  if (access.name.text === 'catch') return true;
  if (access.name.text === 'then' && access.parent.arguments.length > 1) return true;
  return (access.name.text === 'then' || access.name.text === 'finally') && handledAbove(access.parent);
}

/** 그 자리에서 받지 않는 `.then(` 의 줄. 돌려주는(`return`) 체인은 부른 쪽이 받으므로 세지 않는다 */
export function unhandledThens(name: string, text: string): number[] {
  const source = ts.createSourceFile(name, text, ts.ScriptTarget.Latest, true, name.endsWith('x') ? ts.ScriptKind.TSX : ts.ScriptKind.TS);
  const lines: number[] = [];
  const visit = (node: ts.Node) => {
    if (callNamed(node, 'then') && node.arguments.length === 1 && !handledBelow(node.expression.expression) && !handledAbove(node)) {
      lines.push(source.getLineAndCharacterOfPosition(node.expression.name.getStart()).line + 1);
    }
    ts.forEachChild(node, visit);
  };
  visit(source);
  return lines;
}

describe('앱의 읽기', () => {
  it('mobile/src 에 거절을 안 받는 .then( 이 없다', () => {
    const found = filesUnder(join(ROOT, 'mobile/src'))
      .filter((file) => /\.tsx?$/.test(file))
      .flatMap((file) => unhandledThens(file, readFileSync(file, 'utf8')).map((line) => `${relative(ROOT, file)}:${line}`));
    expect(found).toEqual([]);
  });

  it.each([
    ['맨 .then', `void readX().then(setX);`, 1],
    ['함수 부름의 결과', `void a.b().then(setX);`, 1],
    ['Promise.all', `void Promise.all([a()]).then(setX);`, 1],
    ['이어 붙인 .then', `void readX().then(f).then(g);`, 2],
    ['.finally 만', `void readX().then(f).finally(g);`, 1],
    ['settled 안의 .then', `void settled(a().then(f), 'x', g).then(setX);`, 0],
    ['settled 로 받음', `void settled(readX(), 'x', g).then(setX);`, 0],
    ['뒤의 .catch', `void readX().then(f).catch(g);`, 0],
    ['앞의 .catch', `void readX().catch(g).then(f);`, 0],
    ['둘째 인자', `void readX().then(f, g);`, 0],
    ['스스로 받는 읽기', `void readGate().then(f);`, 0],
    ['주석', `// void readX().then(f);`, 0],
  ])('%s', (_name, text, count) => {
    expect(unhandledThens('a.ts', text)).toHaveLength(count);
  });
});
