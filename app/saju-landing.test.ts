import { describe, expect, it } from 'vitest';

import { memberLandingOf, visitorLandingOf } from './saju-landing';

describe('로그인한 사람이 `/` 에 오면', () => {
  it('아무것도 안 든 주소는 홈으로 간다', () => {
    expect(memberLandingOf({ search: '', hash: '' })).toBe('/me');
  });

  it('`#` 뒤가 있으면 무엇이든 그대로 /saju 로 싣는다', () => {
    expect(memberLandingOf({ search: '', hash: '#name=민수&date=1990-05-15&hour=14:30' })).toBe(
      '/saju#name=민수&date=1990-05-15&hour=14:30',
    );
    expect(memberLandingOf({ search: '', hash: '#resume-reading' })).toBe('/saju#resume-reading');
    expect(memberLandingOf({ search: '', hash: '#anything' })).toBe('/saju#anything');
  });

  it('옛 `?` 링크는 입력으로 읽힐 때만 싣고, 입력이 아닌 쿼리는 홈이다', () => {
    expect(memberLandingOf({ search: '?date=1990-05-15&hour=14:30', hash: '' })).toBe('/saju?date=1990-05-15&hour=14:30');
    expect(memberLandingOf({ search: '?utm_source=kakao', hash: '' })).toBe('/me');
  });
});

describe('로그인하지 않은 사람이 `/saju` 에 오면', () => {
  it('같은 쿼리와 `#` 뒤를 들고 첫 화면으로 간다', () => {
    expect(visitorLandingOf({ search: '', hash: '' })).toBe('/');
    expect(visitorLandingOf({ search: '', hash: '#name=민수&date=1990-05-15' })).toBe('/#name=민수&date=1990-05-15');
    expect(visitorLandingOf({ search: '', hash: '#resume-reading' })).toBe('/#resume-reading');
    expect(visitorLandingOf({ search: '?date=1990-05-15', hash: '' })).toBe('/?date=1990-05-15');
  });
});
