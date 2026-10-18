/**
 * 배포 smoke 의 판정이 `docs/ops/runbook/deploy.md` 「배포」 4 단계의 문턱 그대로인가(G-115). 브라우저 · 운영 주소를 부르지 않는다 —
 * 관찰한 값을 넣어 잰다.
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

import { argsOf, judge, productionUrlOf, SCREENS, tableOf } from './deploy-smoke.mjs';

const ROOT = join(__dirname, '..');
const open = SCREENS.find((screen) => screen.path === '/')!;
const login = SCREENS.find((screen) => screen.path === '/me/people')!;
const BASE = 'https://smoke.example';

const seenOpen = {
  status: 200,
  finalOrigin: BASE,
  finalPath: '/',
  finalNext: null,
  title: '만날지도',
  h1: '나는 어떤 사람일까?',
  textLength: 400,
  csp: [] as string[],
  cspHeader: true,
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

  it('화면마다 기대하는 제 제목이 앱 코드의 글자 그대로다', () => {
    const hero = readFileSync(join(ROOT, 'app/home-hero.tsx'), 'utf8');
    const auth = readFileSync(join(ROOT, 'app/auth/page.tsx'), 'utf8');
    const brand = readFileSync(join(ROOT, 'src/lib/brand/index.ts'), 'utf8');
    expect(hero).toContain(SCREENS[0].h1);
    // 로그인 화면의 기본 제목은 `${SERVICE_NAME} 시작하기`, 궁합에서 온 사람은 forCompat 갈래다
    expect(auth).toContain('`${SERVICE_NAME} 시작하기`');
    expect(brand).toContain(`export const SERVICE_NAME = '${SCREENS[1].h1.replace(' 시작하기', '')}'`);
    expect(auth).toContain(`forCompat ? '${SCREENS.find((screen) => screen.path === '/compat')!.h1}'`);
    expect(auth).toMatch(/const forCompat = returnTo === '\/compat'/);
    for (const screen of SCREENS.filter((one) => one.login && one.path !== '/compat')) expect(screen.h1).toBe(SCREENS[1].h1);
  });
});

describe('로그인 없이 서는 화면', () => {
  it('제 주소 · 500 아님 · 제목 · 본문 · CSP 위반 없음이면 통과다', () => {
    expect(judge(open, seenOpen, BASE)).toEqual({ pass: true, reasons: [] });
  });

  it('500 · h1 없음 · 빈 화면 · CSP 위반 · 잡히지 않은 예외는 각각 실패다', () => {
    expect(judge(open, { ...seenOpen, status: 500 }, BASE).reasons).toEqual(['500']);
    expect(judge(open, { ...seenOpen, h1: '' }, BASE).reasons).toEqual(['제 제목이 아니다(h1 「없음」)']);
    expect(judge(open, { ...seenOpen, textLength: 0 }, BASE).reasons).toEqual(['빈 화면']);
    expect(judge(open, { ...seenOpen, csp: ['script-src https://x'] }, BASE).reasons).toEqual(['CSP 위반 1']);
    expect(judge(open, { ...seenOpen, pageErrors: ['TypeError: x'] }, BASE).reasons).toEqual(['잡히지 않은 예외 1']);
  });

  it('라우트가 빠진 배포의 404 화면은 실패다 — 기본 <title> 과 not-found 의 h1 이 서도', () => {
    const missing = { ...seenOpen, status: 404, title: '만날지도', h1: '페이지를 찾을 수 없어요' };
    expect(judge(open, missing, BASE).reasons).toEqual(['404', '제 제목이 아니다(h1 「페이지를 찾을 수 없어요」)']);
  });

  it('오류 경계가 선 화면은 실패다 — 200 으로 와도 제 제목이 아니다', () => {
    expect(judge(open, { ...seenOpen, h1: '화면을 불러오지 못했어요' }, BASE).reasons).toEqual(['제 제목이 아니다(h1 「화면을 불러오지 못했어요」)']);
  });

  it('다른 주소로 넘어가면 실패다', () => {
    expect(judge(open, { ...seenOpen, finalPath: '/closed' }, BASE).reasons).toEqual(['다른 주소로 넘어갔다(/closed)']);
  });

  it('같은 경로라도 다른 호스트로 넘어가면 실패다', () => {
    expect(judge(open, { ...seenOpen, finalOrigin: 'https://other.example' }, BASE).reasons).toEqual([
      '다른 호스트로 넘어갔다(https://other.example)',
    ]);
  });

  it('응답에 강제 CSP 헤더가 없으면 실패다 — 운영자 결정 2026-10-18', () => {
    expect(judge(open, { ...seenOpen, cspHeader: false }, BASE).reasons).toEqual(['강제 CSP 헤더가 없다']);
  });

  it('CSP 가 아닌 콘솔 오류는 판정에 넣지 않는다', () => {
    expect(judge(open, { ...seenOpen, consoleErrors: ['x'] }, BASE).pass).toBe(true);
  });

  it('응답이 없거나 열지 못했으면 실패다', () => {
    expect(judge(open, { ...seenOpen, status: null }, BASE).reasons).toEqual(['응답이 없다']);
    expect(judge(open, { ...seenOpen, error: 'net::ERR_NAME_NOT_RESOLVED' }, BASE)).toEqual({
      pass: false,
      reasons: ['열지 못했다 — net::ERR_NAME_NOT_RESOLVED'],
    });
  });
});

describe('로그인이 드는 화면 — 로그인 없이 /auth?next= 로 넘어가는지만', () => {
  it('제 주소를 next 로 든 /auth 에 닿으면 통과다', () => {
    expect(judge(login, seenLogin, BASE)).toEqual({ pass: true, reasons: [] });
  });

  it('넘어가지 않거나 next 가 다르면 실패다', () => {
    expect(judge(login, { ...seenLogin, finalPath: '/me/people', finalNext: null }, BASE).reasons).toEqual([
      '/auth?next=/me/people 로 넘어가지 않았다(/me/people)',
    ]);
    expect(judge(login, { ...seenLogin, finalNext: '/' }, BASE).reasons).toEqual(['/auth?next=/me/people 로 넘어가지 않았다(/auth?next=/)']);
  });

  it('넘어간 /auth 가 404 면 실패다 — 로그인 화면 라우트가 빠진 배포', () => {
    const missing = { ...seenLogin, status: 404, h1: '페이지를 찾을 수 없어요' };
    expect(judge(login, missing, BASE).reasons).toEqual(['404', '제 제목이 아니다(h1 「페이지를 찾을 수 없어요」)']);
  });

  it('넘어간 /auth 응답에 강제 CSP 헤더가 없으면 실패다', () => {
    expect(judge(login, { ...seenLogin, cspHeader: false }, BASE).reasons).toEqual(['강제 CSP 헤더가 없다']);
  });

  it('넘어간 /auth 가 다른 호스트면 실패다', () => {
    expect(judge(login, { ...seenLogin, finalOrigin: 'https://other.example' }, BASE).pass).toBe(false);
  });

  it('넘어간 로그인 화면도 500 · CSP 위반이면 실패다', () => {
    expect(judge(login, { ...seenLogin, status: 502, csp: ['a', 'b'] }, BASE).reasons).toEqual(['502', 'CSP 위반 2']);
  });
});

describe('운영 주소 — domain.md 맨 위의 그 줄', () => {
  it('저장소의 원본에서 https 주소 하나를 읽는다', () => {
    const url = productionUrlOf(readFileSync(join(ROOT, 'docs/ops/runbook/domain.md'), 'utf8'));
    expect(url).toMatch(/^https:\/\/[^/\s]+$/);
    expect(argsOf([])).toEqual({ url: null });
  });

  it('줄이 없으면 null 이다 — 주소를 지어내지 않는다', () => {
    expect(productionUrlOf('# 도메인\n\n운영 주소는 아직 없다')).toBeNull();
    expect(productionUrlOf('**운영 주소는 `https://example.test/` 이다**')).toBe('https://example.test');
  });
});

describe('명령줄 — 잘못 적으면 운영을 대신 돌지 않는다', () => {
  it('--url <주소> 하나만 받고 origin 으로 맞춘다', () => {
    expect(argsOf(['--url', 'https://preview.example/'])).toEqual({ url: 'https://preview.example' });
    expect(argsOf(['--url', 'http://localhost:4789'])).toEqual({ url: 'http://localhost:4789' });
  });

  it('--url=… 꼴 · 값 없는 --url · 모르는 인자 · 주소 아닌 값 · 경로 붙은 주소는 오류다', () => {
    for (const args of [
      ['--url=https://preview.example'],
      ['--url'],
      ['--ur', 'https://preview.example'],
      ['--url', 'https://preview.example', '--extra'],
      ['https://preview.example'],
      ['--url', 'preview.example'],
      ['--url', 'ftp://preview.example'],
      ['--url', 'https://preview.example/auth'],
    ]) {
      expect(argsOf(args), args.join(' ')).toHaveProperty('error');
    }
  });
});

describe('표 — 이슈에 그대로 붙인다', () => {
  it('화면마다 한 줄이고 칸의 | 가 표를 깨지 않는다', () => {
    const table = tableOf([
      { screen: open, seen: { ...seenOpen, h1: 'a | b' }, verdict: judge(open, seenOpen, BASE) },
      { screen: login, seen: seenLogin, verdict: judge(login, seenLogin, BASE) },
    ]);
    const lines = table.split('\n');
    expect(lines).toHaveLength(4);
    expect(lines[2]).toContain('a \\| b');
    expect(lines[3]).toContain('통과 — 로그인 앞까지');
    expect(lines[3]).toContain('`/auth?next=%2Fme%2Fpeople`');
  });
});
