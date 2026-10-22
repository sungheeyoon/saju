import ts from 'typescript';
import { describe, expect, it } from 'vitest';

import * as BUTTONS from './buttons';
import { ICON_BUTTON, ICON_BUTTON_ACTIVE } from './buttons';
import * as SURFACES from './surfaces';
import { bindingsOf, lineOf, nodesOf, piecesOf, sourceOf, tokensOf, type Source } from './class-names';
import { asPosix, filesUnder, scaleTokens } from './source-files';

const screens = (dir: string): string[] => filesUnder(dir).filter((path) => path.endsWith('.tsx'));

/** 뒤에 덧붙이면 지는 공용 상수 — 단추 상수와 판 · 글자 단(`surfaces.ts`). 모듈 경로 끝 → 그 모듈의 상수 */
const MODULES: [RegExp, Record<string, unknown>][] = [
  [/(^|\/)ui\/buttons$/, BUTTONS as unknown as Record<string, unknown>],
  [/(^|\/)ui\/surfaces$/, SURFACES as unknown as Record<string, unknown>],
];

/** 글자 크기 단의 이름 — `text-small` 은 크기, `text-secondary` 는 색이다 */
const SIZE_NAMES = new Set([
  ...['xs', 'sm', 'base', 'lg', 'xl', '2xl', '3xl', '4xl'].map((name) => `text-${name}`),
  ...Object.keys(scaleTokens().text).map((name) => `text-${name}`),
]);

/** 변형 머리(`sm:` · `hover:` · `[&>a]:`)와 바탕 낱 — 대괄호 안의 `:` 는 가르지 않는다 */
function variantOf(token: string): { variant: string; base: string } {
  let depth = 0;
  let cut = 0;
  for (let at = 0; at < token.length; at += 1) {
    if (token[at] === '[') depth += 1;
    else if (token[at] === ']') depth -= 1;
    else if (token[at] === ':' && depth === 0) cut = at + 1;
  }
  return { variant: token.slice(0, cut), base: token.slice(cut) };
}

/**
 * 클래스 한 낱이 세우는 속성 — 겹침을 가르는 데만 쓴다. 변형 아래 낱은 그 변형을 앞에 단 속성이다(`sm:p-8` → `sm:padding-block`) —
 * 다른 조건의 낱끼리는 겹치지 않고, 같은 조건(`sm:p-6` 뒤의 `sm:p-8`)끼리는 바탕 낱처럼 겹친다. 중요 표시(`px-3!`)는 null 이다:
 * 차례와 상관없이 이기므로 덧붙여도 쓴 사람이 뜻한 대로 선다.
 */
function propertiesOf(token: string): string[] | null {
  if (token.endsWith('!') || token.startsWith('!')) return null;
  const { variant, base } = variantOf(token);
  return basePropertiesOf(base).map((property) => `${variant}${property}`);
}

function basePropertiesOf(token: string): string[] {
  const rules: [RegExp, string[]][] = [
    [/^px-/, ['padding-inline']],
    [/^py-/, ['padding-block']],
    [/^p-/, ['padding-inline', 'padding-block']],
    [/^min-h-/, ['min-height']],
    [/^min-w-/, ['min-width']],
    [/^(h|size)-/, ['height']],
    [/^(w|size)-/, ['width']],
    [/^font-(thin|extralight|light|normal|medium|semibold|bold|extrabold|black)$/, ['font-weight']],
    [/^bg-/, ['background']],
    [/^(flex|inline-flex|grid|inline-grid|block|inline-block|inline|hidden|contents)$/, ['display']],
    [/^rounded(-|$)/, ['border-radius']],
    [/^shadow(-|$)/, ['box-shadow']],
    [/^gap-/, ['gap']],
    [/^border-(?!\d|[xytblrse](-|$)|(solid|dashed|dotted|double|none|hidden|collapse|separate|spacing)(-|$)|\[\d)/, ['border-color']],
  ];
  const found = rules.filter(([pattern]) => pattern.test(token)).flatMap(([, properties]) => properties);
  if (token.startsWith('text-') && !/^text-(left|center|right|justify|start|end|wrap|nowrap|balance|pretty|ellipsis|clip)$/.test(token)) {
    found.push(SIZE_NAMES.has(token) || /^text-\[\d/.test(token) ? 'font-size' : 'color');
  }
  return found;
}

/** 이 파일에서 `app/ui/buttons` · `app/ui/surfaces` 의 상수를 부르는 이름 → 그 값 */
function constantNamesOf(source: Source): Map<string, string> {
  const names = new Map<string, string>();
  for (const [local, binding] of bindingsOf(source)) {
    if (binding.kind !== 'import') continue;
    const constants = MODULES.find(([path]) => path.test(binding.from))?.[1];
    const value = constants?.[binding.name];
    if (typeof value === 'string') names.set(local, value);
  }
  return names;
}

/** 템플릿 하나의 단추 상수 낱과 덧붙인 낱 — 조건식으로 고른 상수(`${a ? X : Y}`)도 상수다 */
function partsOf(template: ts.TemplateExpression, source: Source, names: Map<string, string>) {
  const constants: string[] = [];
  const added: string[] = [];
  added.push(...tokensOf([template.head.text]));
  for (const span of template.templateSpans) {
    const choices = ts.isConditionalExpression(span.expression) ? [span.expression.whenTrue, span.expression.whenFalse] : [span.expression];
    const named = choices.filter((one) => ts.isIdentifier(one) && names.has(one.text)) as ts.Identifier[];
    if (named.length === choices.length) constants.push(...named.map((one) => names.get(one.text)!));
    else added.push(...tokensOf(piecesOf(span.expression, source).texts));
    added.push(...tokensOf([span.literal.text]));
  }
  return { constants: tokensOf(constants), added };
}

/** 이 파일에서 단추 상수 뒤에 그 상수가 이미 세운 속성을 덧붙인 낱 — `줄 — 낱` */
function overlapsIn(source: Source): string[] {
  const names = constantNamesOf(source);
  if (names.size === 0) return [];
  return nodesOf(source, ts.isTemplateExpression).flatMap((template) => {
    const { constants, added } = partsOf(template, source, names);
    if (constants.length === 0) return [];
    const taken = new Set(constants.flatMap((token) => propertiesOf(token) ?? []));
    return added
      .filter((token) => (propertiesOf(token) ?? []).some((property) => taken.has(property)))
      .map((token) => `${lineOf(source, template)} — ${token}`);
  });
}

/** 글로 지은 화면 한 장 — 시험이 겹침을 실제로 찾는지 보는 데만 쓴다 */
function sampleOf(text: string): Source {
  const file = 'app/sample.tsx';
  return { file, tree: ts.createSourceFile(file, text, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX) };
}

describe('공용 상수 뒤에 덧붙이는 클래스', () => {
  /**
   * 단추 상수 뒤에 그 상수가 이미 세운 속성(옆 여백 · 글자 크기 · 색 · 면 …)을 덧붙이면, 이기는 쪽은 클래스를 적은 차례가 아니라
   * Tailwind 가 지은 CSS 의 차례가 정한다. 흰 아이콘 단추 뒤에 `bg-accent` 를 덧붙여 소식 종이 흰 면에 흰 그림으로 사라졌고
   * (2026-09-27), 2026-10-14 에 빌드된 CSS 로 재어 보니 「차단으로 넘어가기」의 `text-danger` 가 `text-foreground` 에, 내 사주 카드의
   * 폰 `px-3` 이 `px-5` 에, 결제 화면 작은 링크의 `font-medium` 이 `font-semibold` 에 졌다(G-109). 바꿀 속성은 면(`*_FACE`)에 덧붙이거나
   * 변형 상수(`BUTTON_TERTIARY_DANGER` · `ICON_BUTTON_QUIET`)를 쓴다.
   *
   * 판 · 글자 단(`surfaces.ts`)도 같다 — 2026-10-22 에 재어 보니 인연 탭 접이칸의 `py-0` 이 줄 카드의 `py-3` 에, 도움말 링크의
   * `text-foreground` 가 보조 글자의 `text-secondary` 에 졌다. 같은 조건의 변형끼리(`CARD` 의 `sm:p-6` 뒤 `sm:p-8`)도 겹침이다.
   */
  it('공용 상수 뒤에 그 상수가 이미 세운 속성을 덧붙이지 않는다', () => {
    const offenders = screens('app').flatMap((path) => overlapsIn(sourceOf(path)).map((found) => `${asPosix(path)}:${found}`));
    expect(offenders).toEqual([]);
  });

  it('덧붙인 클래스를 실제로 찾는다 — 조건식으로 고른 상수 뒤도, 면 뒤는 세지 않는다', () => {
    const sample = sampleOf(`import { BUTTON_PRIMARY, BUTTON_PRIMARY_FACE, BUTTON_SECONDARY } from './ui/buttons';
const a = <button className={\`\${BUTTON_PRIMARY} flex-1 px-4 sm:px-5\`} />;
const b = (on: boolean) => <button className={\`\${on ? BUTTON_PRIMARY : BUTTON_SECONDARY} \${on ? 'px-3' : 'w-full'}\`} />;
const c = <button className={\`\${BUTTON_PRIMARY_FACE} px-4 sm:px-5\`} />;
`);
    expect(overlapsIn(sample)).toEqual(['2 — px-4', '3 — px-3']);
  });

  it('판 · 글자 단 뒤도 찾는다 — 같은 조건의 변형 · 테 색까지, 다른 조건은 세지 않는다', () => {
    const sample = sampleOf(`import { CARD, CARD_FACE, ROW_CARD, TYPE_META } from './ui/surfaces';
const a = <details className={\`\${ROW_CARD} group py-0\`} />;
const b = <a className={\`\${TYPE_META} text-foreground\`} />;
const c = <article className={\`\${CARD} border-warning/25 sm:p-8 max-sm:p-4\`} />;
const d = <article className={\`\${CARD_FACE} border-warning/25 p-5 sm:p-8\`} />;
`);
    expect(overlapsIn(sample)).toEqual(['2 — py-0', '3 — text-foreground', '4 — border-warning/25', '4 — sm:p-8']);
  });

  it('켜진 모양은 흰 면을 들지 않는다', () => {
    const classes = (value: string) => value.split(/\s+/);
    expect(classes(ICON_BUTTON_ACTIVE)).not.toContain('bg-surface');
    expect(classes(ICON_BUTTON_ACTIVE)).not.toContain('text-foreground');
    expect(classes(ICON_BUTTON_ACTIVE)).not.toContain('ring-border');
    expect(classes(ICON_BUTTON)).not.toContain('bg-accent');
    expect(classes(ICON_BUTTON)).not.toContain('text-on-accent');
  });
});
