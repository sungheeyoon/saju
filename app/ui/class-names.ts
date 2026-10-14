import { existsSync, readFileSync, statSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';

import ts from 'typescript';

/**
 * **시험이 화면의 `className` 을 문법 나무로 읽는 자리** — 화면이 부르지 않는다(`source-files.ts` 와 같은 처지).
 *
 * 입력 칸의 글자 크기(`fields.test.ts`)와 단추 상수 뒤에 덧붙인 클래스(`buttons.test.ts`)를 정규식으로 찾던 때는 같은 파일의
 * `const FIELD = '…'` 와 같은 이름의 `.module.css` 만 알아서, 모양 상수를 `app/ui` 로 올리거나 CSS 모듈을 쓰는 칸을 다른 파일로
 * 떼면 시험이 그 칸을 놓쳤다(G-109). 여기서는 TypeScript 로 읽어 **들여온 상수와 들여온 CSS 모듈까지** 따라간다.
 */

const ROOT = process.cwd();

export type Source = { file: string; tree: ts.SourceFile };

const cache = new Map<string, Source>();

/** 파일 하나를 나무로 — `.tsx` 는 JSX 로 읽는다 */
export function sourceOf(file: string): Source {
  const path = resolve(file);
  const known = cache.get(path);
  if (known) return known;
  const text = readFileSync(path, 'utf8');
  const kind = path.endsWith('.tsx') ? ts.ScriptKind.TSX : ts.ScriptKind.TS;
  const parsed = { file: path, tree: ts.createSourceFile(path, text, ts.ScriptTarget.Latest, true, kind) };
  cache.set(path, parsed);
  return parsed;
}

/** 들여온 경로를 파일로 — 상대 경로와 `@/` 만. 패키지는 null */
function moduleFile(from: string, specifier: string): string | null {
  const bare = specifier.startsWith('@/') ? join(ROOT, specifier.slice(2)) : specifier.startsWith('.') ? join(dirname(from), specifier) : null;
  if (bare === null) return null;
  const candidates = [bare, `${bare}.ts`, `${bare}.tsx`, join(bare, 'index.ts')];
  return candidates.find((candidate) => existsSync(candidate) && statSync(candidate).isFile()) ?? null;
}

/** 이 파일에서 이름이 가리키는 것 — 같은 파일의 `const`, 들여온 상수, 들여온 CSS 모듈 */
export type Binding =
  | { kind: 'value'; expression: ts.Expression; source: Source }
  | { kind: 'import'; name: string; from: string; module: string | null }
  | { kind: 'css-module'; path: string };

const bindings = new WeakMap<Source, Map<string, Binding>>();

export function bindingsOf(source: Source): Map<string, Binding> {
  const known = bindings.get(source);
  if (known) return known;
  const found = new Map<string, Binding>();
  bindings.set(source, found);
  for (const statement of source.tree.statements) {
    if (ts.isImportDeclaration(statement) && ts.isStringLiteral(statement.moduleSpecifier) && statement.importClause) {
      const specifier = statement.moduleSpecifier.text;
      const clause = statement.importClause;
      if (clause.name && specifier.endsWith('.module.css')) {
        found.set(clause.name.text, { kind: 'css-module', path: resolve(dirname(source.file), specifier) });
      }
      const named = clause.namedBindings;
      if (named && ts.isNamedImports(named)) {
        for (const one of named.elements) {
          found.set(one.name.text, {
            kind: 'import',
            name: (one.propertyName ?? one.name).text,
            from: specifier,
            module: moduleFile(source.file, specifier),
          });
        }
      }
    }
    if (ts.isVariableStatement(statement) && (statement.declarationList.flags & ts.NodeFlags.Const) !== 0) {
      for (const one of statement.declarationList.declarations) {
        if (ts.isIdentifier(one.name) && one.initializer) {
          found.set(one.name.text, { kind: 'value', expression: one.initializer, source });
        }
      }
    }
  }
  return found;
}

/** 클래스 식이 낼 수 있는 것 — 글자 조각과, 그 식이 부른 CSS 모듈 */
export type Pieces = { texts: string[]; modules: string[] };

/**
 * 식이 낼 수 있는 클래스 글자를 모은다. 글자 · 템플릿의 글자 조각 · 이름(같은 파일의 상수와 들여온 상수를 풀어서) · 조건식의
 * 두 갈래 · `&&` 의 오른쪽 · `||` `??` 의 두 쪽 · 부름의 인자(`cx(…)`) · 배열의 원소 · 괄호. `styles.x` 는 그 CSS 모듈을 적는다.
 * 모르는 식(함수가 지은 값 · 객체의 칸)은 건너뛴다.
 */
export function piecesOf(expression: ts.Expression, source: Source, depth = 0): Pieces {
  const out: Pieces = { texts: [], modules: [] };
  const add = (more: Pieces) => {
    out.texts.push(...more.texts);
    out.modules.push(...more.modules);
  };
  if (depth > 8) return out;
  const node = expression;
  if (ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node)) out.texts.push(node.text);
  else if (ts.isTemplateExpression(node)) {
    out.texts.push(node.head.text);
    for (const span of node.templateSpans) {
      add(piecesOf(span.expression, source, depth + 1));
      out.texts.push(span.literal.text);
    }
  } else if (ts.isParenthesizedExpression(node) || ts.isAsExpression(node) || ts.isNonNullExpression(node)) {
    add(piecesOf(node.expression, source, depth + 1));
  } else if (ts.isConditionalExpression(node)) {
    add(piecesOf(node.whenTrue, source, depth + 1));
    add(piecesOf(node.whenFalse, source, depth + 1));
  } else if (ts.isBinaryExpression(node)) {
    const op = node.operatorToken.kind;
    if (op === ts.SyntaxKind.AmpersandAmpersandToken) add(piecesOf(node.right, source, depth + 1));
    else if (op === ts.SyntaxKind.BarBarToken || op === ts.SyntaxKind.QuestionQuestionToken || op === ts.SyntaxKind.PlusToken) {
      add(piecesOf(node.left, source, depth + 1));
      add(piecesOf(node.right, source, depth + 1));
    }
  } else if (ts.isCallExpression(node)) {
    for (const argument of node.arguments) add(piecesOf(argument, source, depth + 1));
    if (ts.isPropertyAccessExpression(node.expression)) add(piecesOf(node.expression.expression, source, depth + 1));
  } else if (ts.isArrayLiteralExpression(node)) {
    for (const element of node.elements) add(piecesOf(element, source, depth + 1));
  } else if (ts.isPropertyAccessExpression(node) && ts.isIdentifier(node.expression)) {
    const bound = bindingsOf(source).get(node.expression.text);
    if (bound?.kind === 'css-module') out.modules.push(bound.path);
  } else if (ts.isIdentifier(node)) {
    const resolved = resolveName(node.text, source);
    if (resolved) add(piecesOf(resolved.expression, resolved.source, depth + 1));
  }
  return out;
}

/** 이름을 값의 식으로 — 같은 파일의 `const` 이거나, 들여온 파일이 `export const` 로 내는 것(그 파일 안의 이름도 따라간다) */
export function resolveName(name: string, source: Source): { expression: ts.Expression; source: Source } | null {
  const bound = bindingsOf(source).get(name);
  if (bound === undefined) return null;
  if (bound.kind === 'value') return { expression: bound.expression, source: bound.source };
  if (bound.kind === 'import' && bound.module !== null) return resolveName(bound.name, sourceOf(bound.module));
  return null;
}

/** 글자 조각을 클래스 낱으로 */
export const tokensOf = (texts: readonly string[]): string[] => texts.flatMap((text) => text.split(/\s+/)).filter((token) => token !== '');

/** 나무를 돌며 맞는 마디를 모은다 */
export function nodesOf<T extends ts.Node>(source: Source, pick: (node: ts.Node) => node is T): T[] {
  const found: T[] = [];
  const visit = (node: ts.Node) => {
    if (pick(node)) found.push(node);
    ts.forEachChild(node, visit);
  };
  visit(source.tree);
  return found;
}

/** JSX 요소의 속성 하나 — 글자 값이면 그 글자, 식이면 그 식, 없으면 undefined */
export function attributeOf(element: ts.JsxOpeningLikeElement, name: string): ts.Expression | undefined {
  for (const property of element.attributes.properties) {
    if (!ts.isJsxAttribute(property) || property.name.getText() !== name) continue;
    const value = property.initializer;
    if (value === undefined) return undefined;
    if (ts.isStringLiteral(value)) return value;
    if (ts.isJsxExpression(value) && value.expression) return value.expression;
  }
  return undefined;
}

/** 이 마디가 선 줄(1부터) */
export const lineOf = (source: Source, node: ts.Node): number =>
  source.tree.getLineAndCharacterOfPosition(node.getStart(source.tree)).line + 1;
