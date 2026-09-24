import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative, sep } from 'node:path';

import ts from 'typescript';
import { describe, expect, it } from 'vitest';

/**
 * **서버 액션은 던지지 않는다 — 값으로 답한다** (ADR 0078).
 *
 * 액션이 던지면 운영의 Next 는 그 문장을 지우고 영어 안내로 바꿔 보낸다. 문이 이미 우리말로
 * 지은 문장(`dbFailure`)도 거기서 사라지고, 폼은 받을 값이 없어 멈춘다. 그래서 액션은 던지는
 * 문을 `try` 로 받아 `answerOfThrown` 으로 값을 낸다.
 *
 * 그 길이 되돌아오는 모양은 늘 같다 — 새 액션이 `await sameChartInMyList(…)` 한 줄을 받지 않고
 * 적는다. 단위 시험은 **이미 아는** 액션만 재므로, 여기서는 원본을 읽어 **배선**을 잰다.
 *
 * ## 무엇을 「던지는 문」으로 치나
 *
 * `app/` 의 `.ts` 에 적힌 함수 중 몸통에 **받지 않은 `throw`** 가 있거나, 받지 않은 채 그런
 * 함수를 부르는 것 — 이름으로 이어 가며 더 늘지 않을 때까지 센다. 「받았다」는 `catch` 가 있는
 * `try` 의 몸통 안이거나 `.catch(…)` 가 바로 붙은 부름이다. `after(…)` 에 넘긴 함수는 응답이
 * 나간 뒤에 돌므로 액션의 답과 상관이 없어 안 센다.
 *
 * **`src/lib` 는 안 센다.** 엔진이 던지는 것(`InvalidSajuInputError`)은 사용자가 고칠 수 없는
 * 입력이고, 액션은 그 앞에서 `unsupportedForSaving` 으로 막는다(CONTEXT.md 「입력」). 이 시험이
 * 재는 것은 DB 를 읽는 문이다.
 *
 * 이름으로 잇는다 — 같은 이름이 두 파일에 있으면 하나만 던져도 던지는 것으로 친다. 넘치게 세는
 * 쪽이지 모자라게 세는 쪽이 아니다. `import { a as b }` 로 바꾼 이름은 원래 이름으로 되돌려 잇는다.
 *
 * ## 무엇을 「액션」으로 치나
 *
 * `'use server'`(홑 · 겹따옴표) 파일이 내보낸 `export function f` 와 `export const f = async (…) =>`,
 * 그리고 `.ts` · `.tsx` 어디서든 몸통 첫 줄이 `'use server'` 인 함수(화면 안에 적은 액션).
 *
 * ## 못 재는 것
 *
 * **`객체.메서드()` 로 부르는 문은 안 잇는다** — 이름만으로는 어느 함수인지 모른다. 지금 문은 전부
 * 맨 이름으로 불리고 있다. 문을 객체에 담아 부르기 시작하면 여기를 넓힌다.
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

/** 저장소 어디서든 같은 이름으로 부르게 — 윈도우의 `\` 가 비교를 조용히 깨뜨린다 */
const asPosix = (path: string) => relative(process.cwd(), path).split(sep).join('/');

const sources = sourceFiles(ROOT).map((path) => {
  const text = readFileSync(path, 'utf8');
  const kind = path.endsWith('.tsx') ? ts.ScriptKind.TSX : ts.ScriptKind.TS;
  return { path: asPosix(path), text, source: ts.createSourceFile(path, text, ts.ScriptTarget.Latest, true, kind) };
});

/**
 * `import { a as b }` — 바꾼 이름 `b` 에서 원래 이름 `a` 로. **파일마다 따로 든다** — 한 파일의 별칭이 다른 파일에서 같은
 * 이름으로 적은 함수를 덮으면, 그 파일의 던지는 부름이 엉뚱한 이름으로 읽혀 빠진다.
 */
const ORIGINAL_NAME: ReadonlyMap<string, ReadonlyMap<string, string>> = new Map(
  sources.map(({ path, source }) => [
    path,
    new Map(
      source.statements.flatMap((statement) => {
        const bindings = ts.isImportDeclaration(statement) ? statement.importClause?.namedBindings : undefined;
        if (!bindings || !ts.isNamedImports(bindings)) return [];
        return bindings.elements.flatMap((element) =>
          element.propertyName ? [[element.name.text, element.propertyName.text] as const] : [],
        );
      }),
    ),
  ]),
);

const originalOf = (file: string, name: string) => ORIGINAL_NAME.get(file)?.get(name) ?? name;

/**
 * **던져도 문으로 안 치는 것과 그 까닭.** 목록이지 예외가 아니다.
 */
const NOT_DOORS: Readonly<Record<string, string>> = {
  supabaseEnv:
    '접속값이 없는 배포 — 모든 화면이 같이 무너지고 사용자가 할 일이 없다. 액션 하나가 값으로 바꿀 실패가 아니다',
};

/** 이름 있는 함수 — `function f` 와 `const f = (…) =>` */
type Named = { readonly file: string; readonly name: string; readonly body: ts.Node };

function namedFunctions(source: ts.SourceFile, file: string): Named[] {
  const out: Named[] = [];
  const visit = (node: ts.Node) => {
    if (ts.isFunctionDeclaration(node) && node.name && node.body) {
      out.push({ file, name: node.name.text, body: node.body });
    }
    if (
      ts.isVariableDeclaration(node) &&
      ts.isIdentifier(node.name) &&
      node.initializer &&
      (ts.isArrowFunction(node.initializer) || ts.isFunctionExpression(node.initializer))
    ) {
      out.push({ file, name: node.name.text, body: node.initializer.body });
    }
    ts.forEachChild(node, visit);
  };
  visit(source);
  return out;
}

const functions = sources.flatMap(({ path, source }) => namedFunctions(source, path));

/** `catch` 가 있는 `try` 의 몸통 안인가 — `stop` 까지만 올라간다 */
function caughtWithin(node: ts.Node, stop: ts.Node): boolean {
  for (let at: ts.Node = node; at !== stop && at.parent; at = at.parent) {
    const parent = at.parent;
    if (ts.isTryStatement(parent) && parent.tryBlock === at && parent.catchClause) return true;
  }
  return false;
}

/** 부름에 `.catch(…)` 가 바로 붙었나 — `x().catch(() => null)` */
function chainedCatch(call: ts.CallExpression): boolean {
  const parent = call.parent;
  return ts.isPropertyAccessExpression(parent) && parent.name.text === 'catch' && ts.isCallExpression(parent.parent);
}

/** `after(…)` 에 넘긴 함수 안인가 — 응답이 나간 뒤에 돈다 */
function insideAfter(node: ts.Node, stop: ts.Node): boolean {
  for (let at: ts.Node = node; at !== stop && at.parent; at = at.parent) {
    const parent = at.parent;
    if (
      ts.isCallExpression(parent) &&
      ts.isIdentifier(parent.expression) &&
      parent.expression.text === 'after' &&
      parent.arguments.includes(at as ts.Expression)
    ) {
      return true;
    }
  }
  return false;
}

/** 몸통에서 **받지 않은** 던짐 — `throw` 문과, 던지는 이름을 부르는 자리 */
function unguarded(file: string, body: ts.Node, throwing: ReadonlySet<string>): string[] {
  const out: string[] = [];
  const visit = (node: ts.Node) => {
    if (ts.isThrowStatement(node) && !caughtWithin(node, body) && !insideAfter(node, body)) out.push('throw');
    if (
      ts.isCallExpression(node) &&
      ts.isIdentifier(node.expression) &&
      throwing.has(originalOf(file, node.expression.text)) &&
      !caughtWithin(node, body) &&
      !chainedCatch(node) &&
      !insideAfter(node, body)
    ) {
      out.push(originalOf(file, node.expression.text));
    }
    ts.forEachChild(node, visit);
  };
  visit(body);
  return out;
}

/** 던지는 이름 — 더 늘지 않을 때까지 잇는다 */
function throwingNames(): Set<string> {
  const throwing = new Set<string>();
  for (let grew = true; grew; ) {
    grew = false;
    for (const { file, name, body } of functions) {
      if (throwing.has(name) || name in NOT_DOORS) continue;
      if (unguarded(file, body, throwing).length === 0) continue;
      throwing.add(name);
      grew = true;
    }
  }
  return throwing;
}

/** 몸통 첫 줄이 `'use server'` 인가 */
const USE_SERVER = /^['"]use server['"];?\s*$/m;
const startsWithUseServer = (body: ts.Node | undefined) =>
  body !== undefined &&
  ts.isBlock(body) &&
  body.statements[0] !== undefined &&
  ts.isExpressionStatement(body.statements[0]) &&
  ts.isStringLiteral(body.statements[0].expression) &&
  body.statements[0].expression.text === 'use server';

const exported = (node: ts.Node) =>
  ts.canHaveModifiers(node) && (ts.getModifiers(node) ?? []).some((modifier) => modifier.kind === ts.SyntaxKind.ExportKeyword);

/** 액션 — `'use server'` 파일이 내보낸 함수, 그리고 몸통에 `'use server'` 를 적은 함수 */
function serverActions(): { id: string; body: ts.Node }[] {
  const fromFiles = sources
    .filter(({ source }) => {
      const first = source.statements[0];
      return first !== undefined && ts.isExpressionStatement(first) && ts.isStringLiteral(first.expression) && USE_SERVER.test(`'${first.expression.text}'`);
    })
    .flatMap(({ path, source }) =>
      source.statements.flatMap((statement) => {
        if (!exported(statement)) return [];
        if (ts.isFunctionDeclaration(statement) && statement.name && statement.body) {
          return [{ id: `${path}::${statement.name.text}`, body: statement.body as ts.Node }];
        }
        if (!ts.isVariableStatement(statement)) return [];
        return statement.declarationList.declarations.flatMap((declaration) =>
          ts.isIdentifier(declaration.name) &&
          declaration.initializer &&
          (ts.isArrowFunction(declaration.initializer) || ts.isFunctionExpression(declaration.initializer))
            ? [{ id: `${path}::${declaration.name.text}`, body: declaration.initializer.body as ts.Node }]
            : [],
        );
      }),
    );

  const inline = sources.flatMap(({ path, source }) => {
    const out: { id: string; body: ts.Node }[] = [];
    const visit = (node: ts.Node) => {
      if ((ts.isFunctionDeclaration(node) || ts.isFunctionExpression(node) || ts.isArrowFunction(node)) && startsWithUseServer(node.body)) {
        const name = ts.isFunctionDeclaration(node) && node.name
          ? node.name.text
          : ts.isVariableDeclaration(node.parent) && ts.isIdentifier(node.parent.name)
            ? node.parent.name.text
            : `(이름 없음 ${source.getLineAndCharacterOfPosition(node.getStart()).line + 1}행)`;
        out.push({ id: `${path}::${name}`, body: node.body as ts.Node });
      }
      ts.forEachChild(node, visit);
    };
    visit(source);
    return out;
  });

  const seen = new Set<string>();
  return [...fromFiles, ...inline].filter(({ id }) => !seen.has(id) && seen.add(id) !== undefined);
}

/**
 * **던져도 되는 액션과 그 까닭.** 여기 들어오려면 부르는 화면이 예외를 받아 **아무 문장도
 * 세우지 않는다**는 것을 적어야 한다.
 */
const MAY_THROW: Readonly<Record<string, string>> = {
  'app/me/reading/actions.ts::readingRunState -> lastReadingRun':
    '3초마다 묻는 고리 — 화면이 예외를 받아 「못 물었다」로 두고 다음 물음을 기다린다(`panel.tsx`). 세울 문장이 없다',
};

describe('서버 액션은 던지지 않는다', () => {
  const throwing = throwingNames();
  const actions = serverActions();

  /** 아무것도 못 찾았으면 이 시험은 아무것도 안 잰 것이다 */
  it('던지는 문과 액션을 실제로 읽어 왔다', () => {
    expect(actions.length).toBeGreaterThan(20);
    // 화면 안에 적은 액션도 액션이다 — 설정의 로그아웃이 그 모양이다
    expect(actions.map(({ id }) => id)).toContain('app/me/settings/page.tsx::signOut');
    // 이 셋은 `throw dbFailure(…)` 를 직접 · 한 다리 건너 든다 — 못 찾으면 잇는 셈이 깨졌다
    expect([...throwing]).toEqual(expect.arrayContaining(['sameChartInMyList', 'storedInputsOf', 'currentReading']));
  });

  it('액션이 받지 않은 채 부르는 던지는 문은 까닭이 적힌 것들뿐이다', () => {
    const found = actions
      // id 는 `파일::이름` — 별칭은 그 파일의 것으로 되돌린다
      .flatMap(({ id, body }) => unguarded(id.split('::')[0], body, throwing).map((callee) => `${id} -> ${callee}`))
      .sort();

    expect(found).toEqual(Object.keys(MAY_THROW).sort());
  });
});
