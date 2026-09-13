import { afterEach, describe, expect, it, vi } from 'vitest';

import { siteUrl } from './site-url';

const clear = () => {
  for (const name of ['SITE_URL', 'VERCEL_ENV', 'VERCEL_PROJECT_PRODUCTION_URL', 'VERCEL_URL']) {
    vi.stubEnv(name, '');
  }
};

afterEach(() => vi.unstubAllEnvs());

describe('밖으로 나가는 링크가 쓰는 주소', () => {
  it('프로덕션은 배포마다 바뀌는 주소가 아니라 대표 주소를 쓴다', () => {
    clear();
    vi.stubEnv('VERCEL_ENV', 'production');
    vi.stubEnv('VERCEL_PROJECT_PRODUCTION_URL', 'saju-snowy.vercel.app');
    vi.stubEnv('VERCEL_URL', 'saju-abc123-team.vercel.app');

    expect(siteUrl().toString()).toBe('https://saju-snowy.vercel.app/');
  });

  /**
   * 미리보기 배포가 대표 주소를 쓰면 **프로덕션의 그림을 긁어 간다** — 미리보기에서
   * 고친 것이 미리보기에서 안 보인다.
   */
  it('미리보기 배포는 자기 주소를 쓴다', () => {
    clear();
    vi.stubEnv('VERCEL_ENV', 'preview');
    vi.stubEnv('VERCEL_PROJECT_PRODUCTION_URL', 'saju-snowy.vercel.app');
    vi.stubEnv('VERCEL_URL', 'saju-abc123-team.vercel.app');

    expect(siteUrl().toString()).toBe('https://saju-abc123-team.vercel.app/');
  });

  it('도메인을 사면 코드를 안 고치고 옮긴다', () => {
    clear();
    vi.stubEnv('VERCEL_ENV', 'production');
    vi.stubEnv('VERCEL_PROJECT_PRODUCTION_URL', 'saju-snowy.vercel.app');
    vi.stubEnv('SITE_URL', 'https://manseryeok.kr');

    expect(siteUrl().toString()).toBe('https://manseryeok.kr/');
  });

  it('아무것도 없으면 로컬이다', () => {
    clear();
    expect(siteUrl().toString()).toBe('http://localhost:3000/');
  });
});
