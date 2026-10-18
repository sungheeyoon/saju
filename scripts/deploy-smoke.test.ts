/**
 * 배포 smoke 의 판정이 `docs/ops/runbook/deploy.md` 「배포」 4 단계의 문턱 그대로인가(G-115). 브라우저 · 운영 주소를 부르지 않는다 —
 * 관찰한 값을 넣어 잰다.
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

import { judge, productionUrlOf, SCREENS, tableOf } from './deploy-smoke.mjs';

const ROOT = join(__dirname, '..');
const open = SCREENS.find((screen) => screen.path === '/')!;
const login = SCREENS.find((screen) => screen.path === '/me/people')!;

const seenOpen = {
  status: 200,
  finalPath: '/',
  finalNext: null,
  title: '만날지도',
  h1: '나는 어떤 사람일까?',
  textLength: 400,
  csp: [] as string[],
  consoleErrors: [] as string[],
  pageErrors: [] as string[],
};
const seenLogin = { ...seenOpen, finalPath: '/auth', finalNext: '/me/people', h1: '만날지도 시작하기' };

describe('다섯 화면 — 4 단계가 적은 그대로', () => {
  it('로그인 없이 서는 둘과 로그인이 드는 셋이다', () => {
    expect(SCREENS.filter((screen) => !screen.login).map((screen) => screen.path)).toEqual(['/', '/auth']);
    expect(SCREENS.filter((screen) => screen.login).map((screen) => screen.path)).toEqual(['/compat', '/me/people', '/ops/reports']);
  });

  it('런북 4 단계가 다섯 주소와 이 명령을 든다', () => {
    const runbook = readFileSync(join(ROOT, 'docs/ops/runbook/deploy.md'), 'utf8');
    for (const screen of SCREENS) expect(runbook).toContain(`\`${screen.path}\``);
    expect(runbook).toContain('npm run smoke:deploy');
  });
});

describe('로그인 없이 서는 화면', () => {
  it('제 주소 · 500 아님 · 제목 · 본문 · CSP 위반 없음이면 통과다', () => {
    expect(judge(open, seenOpen)).toEqual({ pass: true, reasons: [] });
  });

  it('500 · 빈 제목 · h1 없음 · 빈 화면 · CSP 위반은 각각 실패다', () => {
    expect(judge(open, { ...seenOpen, status: 500 }).reasons).toEqual(['500']);
    expect(judge(open, { ...seenOpen, title: ' ' }).reasons).toEqual(['<title> 이 비었다']);
    expect(judge(open, { ...seenOpen, h1: '' }).reasons).toEqual(['h1 이 없다']);
    expect(judge(open, { ...seenOpen, textLength: 0 }).reasons).toEqual(['빈 화면']);
    expect(judge(open, { ...seenOpen, csp: ['script-src https://x'] }).reasons).toEqual(['CSP 위반 1']);
  });

  it('다른 주소로 넘어가면 실패다 — 종료 화면으로 넘기는 날도 잡힌다', () => {
    expect(judge(open, { ...seenOpen, finalPath: '/closed' }).reasons).toEqual(['다른 주소로 넘어갔다(/closed)']);
  });

  it('404 처럼 500 이 아닌 응답은 응답만으로 떨어뜨리지 않는다 — 제목 · 본문이 가른다', () => {
    expect(judge(open, { ...seenOpen, status: 404 }).pass).toBe(true);
  });

  it('콘솔 오류 · 페이지 예외는 판정에 넣지 않는다', () => {
    expect(judge(open, { ...seenOpen, consoleErrors: ['x'], pageErrors: ['y'] }).pass).toBe(true);
  });

  it('응답이 없거나 열지 못했으면 실패다', () => {
    expect(judge(open, { ...seenOpen, status: null }).reasons).toEqual(['응답이 없다']);
    expect(judge(open, { ...seenOpen, error: 'net::ERR_NAME_NOT_RESOLVED' })).toEqual({
      pass: false,
      reasons: ['열지 못했다 — net::ERR_NAME_NOT_RESOLVED'],
    });
  });
});

describe('로그인이 드는 화면 — 로그인 없이 /auth?next= 로 넘어가는지만', () => {
  it('제 주소를 next 로 든 /auth 에 닿으면 통과다', () => {
    expect(judge(login, seenLogin)).toEqual({ pass: true, reasons: [] });
  });

  it('넘어가지 않거나 next 가 다르면 실패다', () => {
    expect(judge(login, { ...seenLogin, finalPath: '/me/people', finalNext: null }).reasons).toEqual([
      '/auth?next=/me/people 로 넘어가지 않았다(/me/people)',
    ]);
    expect(judge(login, { ...seenLogin, finalNext: '/' }).reasons).toEqual(['/auth?next=/me/people 로 넘어가지 않았다(/auth?next=/)']);
  });

  it('넘어간 로그인 화면도 500 · CSP 위반이면 실패다', () => {
    expect(judge(login, { ...seenLogin, status: 502, csp: ['a', 'b'] }).reasons).toEqual(['502', 'CSP 위반 2']);
  });
});

describe('운영 주소 — domain.md 맨 위의 그 줄', () => {
  it('저장소의 원본에서 https 주소 하나를 읽는다', () => {
    const url = productionUrlOf(readFileSync(join(ROOT, 'docs/ops/runbook/domain.md'), 'utf8'));
    expect(url).toMatch(/^https:\/\/[^/\s]+$/);
  });

  it('줄이 없으면 null 이다 — 주소를 지어내지 않는다', () => {
    expect(productionUrlOf('# 도메인\n\n운영 주소는 아직 없다')).toBeNull();
    expect(productionUrlOf('**운영 주소는 `https://example.test/` 이다**')).toBe('https://example.test');
  });
});

describe('표 — 이슈에 그대로 붙인다', () => {
  it('화면마다 한 줄이고 칸의 | 가 표를 깨지 않는다', () => {
    const table = tableOf([
      { screen: open, seen: { ...seenOpen, h1: 'a | b' }, verdict: judge(open, seenOpen) },
      { screen: login, seen: seenLogin, verdict: judge(login, seenLogin) },
    ]);
    const lines = table.split('\n');
    expect(lines).toHaveLength(4);
    expect(lines[2]).toContain('a \\| b');
    expect(lines[3]).toContain('통과 — 로그인 앞까지');
    expect(lines[3]).toContain('`/auth?next=%2Fme%2Fpeople`');
  });
});
