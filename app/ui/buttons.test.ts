import ts from 'typescript';
import { describe, expect, it } from 'vitest';

import * as BUTTONS from './buttons';
import { ICON_BUTTON, ICON_BUTTON_ACTIVE } from './buttons';
import { bindingsOf, lineOf, nodesOf, piecesOf, sourceOf, tokensOf, type Source } from './class-names';
import { asPosix, filesUnder, scaleTokens } from './source-files';

const screens = (dir: string): string[] => filesUnder(dir).filter((path) => path.endsWith('.tsx'));

const CONSTANTS = BUTTONS as unknown as Record<string, unknown>;

/** 글자 크기 단의 이름 — `text-small` 은 크기, `text-secondary` 는 색이다 */
const SIZE_NAMES = new Set([
  ...['xs', 'sm', 'base', 'lg', 'xl', '2xl', '3xl', '4xl'].map((name) => `text-${name}`),
  ...Object.keys(scaleTokens().text).map((name) => `text-${name}`),
]);

/**
 * 클래스 한 낱이 세우는 속성 — 겹침을 가르는 데만 쓴다. 변형(`sm:` · `hover:`)과 중요 표시(`px-3!`)는 null 이다: 변형은 제 조건에서,
 * 중요 표시는 차례와 상관없이 이기므로 덧붙여도 쓴 사람이 뜻한 대로 선다.
 */
function propertiesOf(token: string): string[] | null {
  if (token.includes(':') || token.endsWith('!') || token.startsWith('!')) return null;
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
  ];
  const found = rules.filter(([pattern]) => pattern.test(token)).flatMap(([, properties]) => properties);
  if (token.startsWith('text-') && !/^text-(left|center|right|justify|start|end|wrap|nowrap|balance|pretty|ellipsis|clip)$/.test(token)) {
    found.push(SIZE_NAMES.has(token) || /^text-\[\d/.test(token) ? 'font-size' : 'color');
  }
  return found;
}

/** 이 파일에서 `app/ui/buttons` 의 상수를 부르는 이름 → 그 값 */
function buttonNamesOf(source: Source): Map<string, string> {
  const names = new Map<string, string>();
  for (const [local, binding] of bindingsOf(source)) {
    if (binding.kind !== 'import' || !/(^|\/)ui\/buttons$/.test(binding.from)) continue;
    const value = CONSTANTS[binding.name];
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

/**
 * 고칠 수 없어 남긴 자리 — 그 파일을 다른 세션이 쥐고 있었다(2026-10-14). 간극 대장 G-109 기록의 「UI」 줄이 함께 든다.
 * 고치면 이 목록에서 빼고, 비면 목록째 지운다.
 */
const LEFT_FOR_LATER = new Set([
  'app/save-for-reading.tsx:px-4',
  'app/me/reading/share-button.tsx:px-3',
  'app/me/reading/panel.tsx:px-3',
  'app/taste/taste.tsx:text-small',
]);

describe('단추 상수 뒤에 덧붙이는 클래스', () => {
  /**
   * 단추 상수 뒤에 그 상수가 이미 세운 속성(옆 여백 · 글자 크기 · 색 · 면 …)을 덧붙이면, 이기는 쪽은 클래스를 적은 차례가 아니라
   * Tailwind 가 지은 CSS 의 차례가 정한다. 흰 아이콘 단추 뒤에 `bg-accent` 를 덧붙여 소식 종이 흰 면에 흰 그림으로 사라졌고
   * (2026-09-27), 2026-10-14 에 빌드된 CSS 로 재어 보니 「차단으로 넘어가기」의 `text-danger` 가 `text-foreground` 에, 내 사주 카드의
   * 폰 `px-3` 이 `px-5` 에, 결제 화면 작은 링크의 `font-medium` 이 `font-semibold` 에 졌다(G-109). 바꿀 속성은 면(`*_FACE`)에 덧붙이거나
   * 변형 상수(`BUTTON_TERTIARY_DANGER` · `ICON_BUTTON_QUIET`)를 쓴다.
   */
  it('단추 상수 뒤에 그 상수가 이미 세운 속성을 덧붙이지 않는다', () => {
    const offenders = screens('app').flatMap((path) => {
      const source = sourceOf(path);
      const names = buttonNamesOf(source);
      if (names.size === 0) return [];
      return nodesOf(source, ts.isTemplateExpression).flatMap((template) => {
        const { constants, added } = partsOf(template, source, names);
        if (constants.length === 0) return [];
        const taken = new Set(constants.flatMap((token) => propertiesOf(token) ?? []));
        return added
          .filter((token) => (propertiesOf(token) ?? []).some((property) => taken.has(property)))
          .filter((token) => !LEFT_FOR_LATER.has(`${asPosix(path)}:${token}`))
          .map((token) => `${asPosix(path)}:${lineOf(source, template)} — ${token}`);
      });
    });
    expect(offenders).toEqual([]);
  });

  it('덧붙인 클래스를 실제로 찾고 있다 — 남긴 자리는 아직 겹친다', () => {
    const save = sourceOf('app/save-for-reading.tsx');
    const found = nodesOf(save, ts.isTemplateExpression).some((template) =>
      partsOf(template, save, buttonNamesOf(save)).added.includes('px-4'),
    );
    expect(found).toBe(true);
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
