import { describe, expect, it } from 'vitest';

import { RESUME_READING_PATH, afterSignIn, safeReturnPath, signInFrom, withReturnPath } from './return-path';

describe('로그인 뒤 돌아갈 경로', () => {
  it('앱 안 경로는 쿼리와 # 까지 그대로 둔다', () => {
    expect(safeReturnPath('/compat')).toBe('/compat');
    expect(safeReturnPath('/me/people?from=settings')).toBe('/me/people?from=settings');
    expect(safeReturnPath('/me/compat?a=1&b=2')).toBe('/me/compat?a=1&b=2');
    expect(safeReturnPath('/saju#resume-reading')).toBe('/saju#resume-reading');
    expect(safeReturnPath('/saju')).toBe('/saju');
  });

  /** 배포 전에 로그인을 떠난 탭은 옛 주소를 들고 온다 — 회원의 계산 자리로 갈아 읽는다(ADR 0144) */
  it('옛 사주 이어 보기 주소는 /saju 의 이어 보기로 읽는다', () => {
    expect(RESUME_READING_PATH).toBe('/saju#resume-reading');
    expect(safeReturnPath('/#resume-reading')).toBe('/saju#resume-reading');
    expect(withReturnPath('/auth', '/#resume-reading')).toBe('/auth?next=%2Fsaju%23resume-reading');
    /* 다른 낱말은 그대로다 — 이어 보기 하나만 갈아 읽는다 */
    expect(safeReturnPath('/#name=x')).toBe('/#name=x');
  });

  it('다른 사이트로 가는 주소는 내 사주로 보낸다', () => {
    for (const outside of [
      'https://example.com',
      '//example.com',
      '/\\example.com',
      '/\\/example.com',
      '\\\\example.com',
      'javascript:alert(1)',
      'example.com',
      '',
    ]) {
      expect(safeReturnPath(outside), outside).toBe('/me');
    }
    expect(safeReturnPath(undefined)).toBe('/me');
    expect(safeReturnPath(null)).toBe('/me');
  });

  it('여러 값이 오면 첫 값만 본다', () => {
    expect(safeReturnPath(['/compat', 'https://example.com'])).toBe('/compat');
    expect(safeReturnPath(['//example.com', '/compat'])).toBe('/me');
  });

  /** 로그인 · 가입 화면이 돌아갈 곳이 되면 `next` 가 겹친다(ADR 0128) */
  it('로그인 · 가입 화면은 돌아갈 곳이 아니다', () => {
    expect(safeReturnPath('/auth?next=%2Fcompat')).toBe('/me');
    expect(safeReturnPath('/auth/denied')).toBe('/me');
    expect(safeReturnPath('/signup?next=%2Fcompat')).toBe('/me');
    expect(safeReturnPath('/signups')).toBe('/signups');
  });
});

describe('로그인 · 가입 주소', () => {
  it('돌아갈 곳을 next 하나로 싣고, 내 사주면 싣지 않는다', () => {
    expect(withReturnPath('/auth', '/me/match/abc')).toBe('/auth?next=%2Fme%2Fmatch%2Fabc');
    expect(withReturnPath('/auth', '/me/compat?a=1&b=2')).toBe('/auth?next=%2Fme%2Fcompat%3Fa%3D1%26b%3D2');
    expect(withReturnPath('/signup', '/compat')).toBe('/signup?next=%2Fcompat');
    expect(withReturnPath('/auth', '/me')).toBe('/auth');
    expect(withReturnPath('/auth', null)).toBe('/auth');
  });

  it('밖으로 가는 next 는 싣지 않는다', () => {
    expect(withReturnPath('/auth', 'https://example.com')).toBe('/auth');
    expect(withReturnPath('/auth/denied', '//example.com')).toBe('/auth/denied');
    expect(withReturnPath('/signup', '/\\example.com')).toBe('/signup');
  });

  it('겹친 next 를 짓지 않는다', () => {
    expect(withReturnPath('/auth', withReturnPath('/signup', '/compat'))).toBe('/auth');
  });

  it('현관에서 누른 로그인은 내 사주로, 다른 자리는 그 자리로 돌아온다', () => {
    expect(signInFrom('/')).toBe('/auth');
    expect(signInFrom('/privacy')).toBe('/auth?next=%2Fprivacy');
  });
});

describe('로그인을 마친 사람이 처음 설 곳', () => {
  it('사주 이어 보기만 가입 화면을 거친다 — 나머지는 관문이 끼운다', () => {
    expect(afterSignIn('/saju#resume-reading')).toBe('/signup?next=%2Fsaju%23resume-reading');
    expect(afterSignIn('/#resume-reading')).toBe('/signup?next=%2Fsaju%23resume-reading');
    expect(afterSignIn('/saju')).toBe('/saju');
    /* 궁합 이어 보기도 낱말째 가입 화면을 거친다 — 관문은 `#` 뒤를 못 봐서 가입 뒤 입력을 잃는다(ADR 0131) */
    expect(afterSignIn('/compat#resume-pair')).toBe('/signup?next=%2Fcompat%23resume-pair');
    expect(afterSignIn('/compat')).toBe('/compat');
    expect(afterSignIn('/compat')).toBe('/compat');
    expect(afterSignIn('/me/match/abc')).toBe('/me/match/abc');
    expect(afterSignIn('https://example.com')).toBe('/me');
  });
});
