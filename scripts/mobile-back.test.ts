import { readFileSync, readdirSync } from 'node:fs';
import { join, relative } from 'node:path';

import { describe, expect, it } from 'vitest';

import { appHeadStands, dockStands } from '../src/lib/app-shell';

/**
 * **앱의 뒤로가기는 부품 하나다**(운영자 2026-10-31) — `<` 아이콘만, 맨 위 왼쪽 고정. 화면마다 제 뒤로가기를 다시 지으면
 * 모양과 자리가 또 갈린다. `router.back` 은 `mobile/src/ui/top-bar.tsx` 안에만 있고, 라우트마다 그 줄을 세우거나 안 세우는 까닭이 아래 표에 있다.
 */
const MOBILE = join(import.meta.dirname, '..', 'mobile', 'src');
const PART = 'ui/top-bar.tsx';

const filesIn = (dir: string): string[] =>
  readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) return filesIn(path);
    return /\.tsx?$/.test(entry.name) ? [path] : [];
  });

const sources = filesIn(MOBILE).map((path) => ({ file: relative(MOBILE, path), text: readFileSync(path, 'utf8') }));
const textOf = (file: string) => sources.find((one) => one.file === file)?.text ?? '';

/** 뒤로가기가 아닌 화살표 글자와 그 사유 */
const GLYPH_OK: Record<string, string> = {
  'chart/parts.tsx': '표를 좌우로 넘기라는 안내 글자다',
};

/** 맨 위 줄이 없는 라우트와 그 사유 — 여기 없는 라우트는 줄을 세워야 한다 */
const NO_BAR: Record<string, string> = {
  'app/index.tsx': '앱의 입구 — 돌아갈 곳이 없다',
  'app/signup.tsx': '나가는 길이 로그아웃을 함께 하는 「다른 구글 계정」 줄이다 — 세션을 든 채 앞으로 돌아가면 다시 이 화면이다',
  'app/auth/index.tsx': '막다른 안내 판 — replace 로만 오고 나가는 길은 「처음으로」다',
  'app/auth/denied.tsx': '막다른 안내 판 — replace 로만 오고 나가는 길은 판 안의 두 단추다',
  'app/closed.tsx': '테스트 종료 고지 — 돌아갈 곳이 없게 관문이 보낸 자리다',
  'app/me/index.tsx': '탭 첫 화면 — 앱 머리',
  'app/me/matching/index.tsx': '탭 첫 화면 — 앱 머리',
  'app/me/chat/index.tsx': '탭 첫 화면 — 앱 머리',
  'app/me/discovery.tsx': '화면 없이 설정으로 넘긴다',
  'app/dev-parts.tsx': '개발에서만 서는 부품 견본 — 앱 안의 길이 없다',
};

/** 라우트가 직접 쓰거나, 그 라우트가 곧바로 부르는 부품이 쓰면 그 화면에 줄이 선다 */
function drawsBar(file: string): boolean {
  const text = textOf(file);
  if (/<TopBar\b|<InfoScreen\b/.test(text)) return true;
  return [...text.matchAll(/from '@\/([^']+)'/g)].some((match) => /<TopBar\b/.test(textOf(`${match[1]}.tsx`)));
}

describe('앱의 뒤로가기', () => {
  it('router.back · canGoBack 은 부품 안에만 있다', () => {
    const outside = sources.filter(({ file, text }) => file !== PART && /\.(back|canGoBack)\(/.test(text.replace(/\/\*[\s\S]*?\*\/|\/\/.*$/gm, '')) && /\brouter\b/.test(text));
    expect(outside.map(({ file }) => file)).toEqual([]);
  });

  it('화살표 글자나 다른 뒤로 아이콘을 다시 짓지 않는다', () => {
    const glyphs = sources.filter(({ file }) => !(file in GLYPH_OK)).filter(({ text }) => /[>}\s][‹←]\s*[{\p{L}]/u.test(text.replace(/\/\*[\s\S]*?\*\/|\/\/.*$/gm, '')));
    expect(glyphs.map(({ file }) => file)).toEqual([]);
    const icons = sources.filter(({ text }) => /name="back"|function (BackLink|Back)\b/.test(text));
    expect(icons.map(({ file }) => file)).toEqual([]);
  });

  it('뒤로 갈 곳이 있는 라우트는 모두 맨 위 줄을 세운다', () => {
    const routes = sources.map(({ file }) => file).filter((file) => file.startsWith('app/') && !file.endsWith('_layout.tsx'));
    expect(routes.filter((file) => !(file in NO_BAR) && !drawsBar(file))).toEqual([]);
  });

  it('줄이 없는 라우트의 표에 사라진 파일이 남지 않는다', () => {
    expect(Object.keys(NO_BAR).filter((file) => textOf(file) === '')).toEqual([]);
  });

  it('맨 위 줄을 쓰는 틀은 안전 영역의 위를 또 내지 않는다', () => {
    const doubled = sources.filter(({ text }) => /<TopBar\b/.test(text) && /<SafeAreaView (?![^>]*edges=)[^>]*>/.test(text));
    expect(doubled.map(({ file }) => file)).toEqual([]);
    const edgedTop = sources.filter(({ text }) => /<TopBar\b/.test(text) && /edges=\{\[[^\]]*'top'/.test(text));
    expect(edgedTop.map(({ file }) => file)).toEqual([]);
  });

  it('앱 머리는 탭 첫 화면에만 선다', () => {
    for (const path of ['/me', '/me/', '/me/compat', '/me/matching', '/me/chat']) expect(appHeadStands(path), path).toBe(true);
    for (const path of ['/me/settings', '/me/people', '/me/people/1', '/me/readings', '/me/requests', '/me/match/1', '/me/matching/history', '/me/chat/1', '/me/credits']) {
      expect(appHeadStands(path), path).toBe(false);
    }
    expect(appHeadStands('/me/compat', { a: '1', b: '2' })).toBe(false);
    expect(appHeadStands('/me/compat', { pickA: '1' } as never)).toBe(true);
  });

  it('탭 막대는 대화방에서만 걷힌다', () => {
    expect(dockStands('/me/chat/1')).toBe(false);
    for (const path of ['/me', '/me/settings', '/me/people/1', '/me/chat']) expect(dockStands(path), path).toBe(true);
  });
});
