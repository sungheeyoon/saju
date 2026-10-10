import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

/**
 * **입력 칸의 글자는 16px 이상이다.** iOS Safari 는 글자가 16px 보다 작은 입력 칸(input · textarea · select)에 초점이
 * 가면 화면을 확대하고, 초점이 떠나도 되돌리지 않아 좌우에 빈자리가 남는다 — 대화방 입력칸(15px)에서 운영자가 실기기로
 * 봤다(2026-10-10). 고치는 길은 칸의 글자다. viewport 를 `maximum-scale=1` · `user-scalable=no` 로 잠그면 핀치 확대까지
 * 막혀 접근성을 해치므로 쓰지 않는다(ADR 0109 추기).
 *
 * 보는 것: `app/**\/*.tsx` 의 `<input>` · `<textarea>` · `<select>` 여는 태그. 고르는 칸(radio · checkbox) · 숨은 칸
 * (hidden · file · `sr-only` · `opacity-0`)은 글자를 받지 않아 뺀다. Tailwind 로 꾸민 칸은 글자 크기를 **적어야** 한다 —
 * 안 적으면 부모의 크기를 물려받아 언제든 16px 아래로 내려간다. 같은 파일의 상수(`const FIELD = '…'`)는 풀어서 본다.
 * CSS 모듈로 꾸민 칸(출생 정보 폼)은 그 모듈의 입력 칸 규칙을 따로 본다.
 */

const MIN_PX = 16;

function screens(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) return screens(path);
    return path.endsWith('.tsx') && !path.endsWith('.test.tsx') ? [path] : [];
  });
}

/** `<input` 부터 여는 태그의 끝(중괄호 밖의 `>`)까지 — `=>` 는 중괄호 안에 있어 끝으로 안 친다 */
function openingTags(source: string): { tag: string; line: number }[] {
  const found: { tag: string; line: number }[] = [];
  for (const match of source.matchAll(/<(input|textarea|select)(?=[\s/>])/g)) {
    let depth = 0;
    let end = match.index;
    for (let at = match.index + 1; at < source.length; at += 1) {
      const char = source[at];
      if (char === '{') depth += 1;
      else if (char === '}') depth -= 1;
      else if (char === '>' && depth === 0) {
        end = at;
        break;
      }
    }
    found.push({ tag: source.slice(match.index, end + 1), line: source.slice(0, match.index).split('\n').length });
  }
  return found;
}

/** 클래스 한 낱의 글자 크기(px). 크기가 아니면 null — `text-secondary` 같은 색은 크기가 아니다 */
function sizeOf(token: string): number | null {
  const bare = token.split(':').at(-1) ?? token;
  const named: Record<string, number> = { 'text-xs': 12, 'text-sm': 14, 'text-base': 16, 'text-lg': 18, 'text-xl': 20 };
  if (bare in named) return named[bare];
  const px = /^text-\[(\d+(?:\.\d+)?)px\]$/.exec(bare);
  if (px) return Number(px[1]);
  const rem = /^text-\[(\d+(?:\.\d+)?)rem\]$/.exec(bare);
  if (rem) return Number(rem[1]) * 16;
  return null;
}

type Verdict = { kind: 'skip' } | { kind: 'module' } | { kind: 'sizes'; sizes: number[] };

function judge(tag: string, source: string): Verdict {
  if (/\btype="(radio|checkbox|hidden|file)"/.test(tag)) return { kind: 'skip' };
  const attr = /\bclassName=(?:"([^"]*)"|\{([\s\S]*?)\}(?=\s+\w+=|\s*\/?>))/.exec(tag);
  if (attr === null) return { kind: 'module' };
  const raw = attr[1] ?? attr[2];
  if (/\bstyles\./.test(raw)) return { kind: 'module' };
  const expanded = raw.replace(/\$\{(\w+)\}|^(\w+)$/g, (whole, inTemplate: string | undefined, alone: string | undefined) => {
    const name = inTemplate ?? alone;
    const constant = new RegExp(`const ${name} =\\s*'([^']*)'`).exec(source);
    return constant ? constant[1] : whole;
  });
  const tokens = expanded.split(/[\s`'"]+/).filter((token) => !token.startsWith('placeholder:'));
  if (tokens.includes('sr-only') || tokens.includes('opacity-0')) return { kind: 'skip' };
  return { kind: 'sizes', sizes: tokens.map(sizeOf).filter((size): size is number => size !== null) };
}

describe('입력 칸의 글자 크기 (iOS 의 초점 확대)', () => {
  const files = screens('app');
  const fields = files.flatMap((path) => {
    const source = readFileSync(path, 'utf8');
    return openingTags(source).map(({ tag, line }) => ({ at: `${path}:${line}`, verdict: judge(tag, source) }));
  });

  it('입력 칸을 실제로 찾고 있다', () => {
    expect(fields.filter((field) => field.verdict.kind === 'sizes').length).toBeGreaterThan(10);
  });

  it(`Tailwind 로 꾸민 입력 칸은 글자 크기를 적고, 어느 크기도 ${MIN_PX}px 아래가 아니다`, () => {
    const offenders = fields.flatMap(({ at, verdict }) => {
      if (verdict.kind !== 'sizes') return [];
      if (verdict.sizes.length === 0) return [`${at} — 글자 크기가 없다`];
      const small = verdict.sizes.filter((size) => size < MIN_PX);
      return small.length > 0 ? [`${at} — ${small.join(', ')}px`] : [];
    });
    expect(offenders).toEqual([]);
  });

  it(`CSS 모듈로 꾸민 입력 칸의 font-size 는 ${MIN_PX}px 아래가 아니다`, () => {
    const modules = files
      .filter((path) =>
        fields.some(({ at, verdict }) => verdict.kind === 'module' && at.startsWith(`${path}:`)),
      )
      .map((path) => path.replace(/\.tsx$/, '.module.css'));
    expect(modules.length).toBeGreaterThan(0);
    const offenders = modules.flatMap((path) => {
      const css = readFileSync(path, 'utf8');
      return [...css.matchAll(/([^{}]+)\{([^{}]*)\}/g)].flatMap(([, selector, body]) => {
        const targets = selector
          .split(',')
          .some((one) => !one.includes('::placeholder') && /(?<!:has\()\binput\b(?![^(]*\))|Input\b/.test(one));
        const size = /font-size:\s*(\d+(?:\.\d+)?)px/.exec(body);
        return targets && size && Number(size[1]) < MIN_PX ? [`${path} ${selector.trim()} — ${size[1]}px`] : [];
      });
    });
    expect(offenders).toEqual([]);
  });
});
