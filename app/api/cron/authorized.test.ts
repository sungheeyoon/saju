import { afterEach, describe, expect, it, vi } from 'vitest';

import { cronAuthorized } from './authorized';

/**
 * **크론 자격은 한 자리가 든다.** 두 라우트의 거절 갈래는 제 `route.test.ts` 가 주소를 두드려 재고,
 * 여기서는 비교 자체 — 길이가 달라도 던지지 않는가, 한 글자만 달라도 닫는가 — 를 잰다.
 */
const SECRET = 'cron-secret-for-test';
const request = (authorization?: string) =>
  new Request('http://localhost/api/cron/reading', {
    headers: authorization === undefined ? {} : { authorization },
  });

afterEach(() => {
  vi.unstubAllEnvs();
});

describe('크론 자격', () => {
  it('올바른 비밀이면 연다', () => {
    vi.stubEnv('CRON_SECRET', SECRET);
    expect(cronAuthorized(request(`Bearer ${SECRET}`))).toBe(true);
  });

  it.each([
    ['머리가 없다', undefined],
    ['빈 머리', ''],
    ['마지막 한 글자가 다르다', `Bearer ${SECRET.slice(0, -1)}X`],
    ['비밀이 짧다', `Bearer ${SECRET.slice(0, 3)}`],
    ['비밀이 길다', `Bearer ${SECRET}${SECRET}`],
    ['대소문자가 다르다', `bearer ${SECRET}`],
  ])('%s — 닫고, 던지지 않는다', (_, authorization) => {
    vi.stubEnv('CRON_SECRET', SECRET);
    expect(() => cronAuthorized(request(authorization))).not.toThrow();
    expect(cronAuthorized(request(authorization))).toBe(false);
  });

  it.each([
    ['설정되지 않았다', undefined, 'Bearer undefined'],
    ['빈 문자열이다', '', 'Bearer '],
    ['빈 문자열이다(공백 없이)', '', 'Bearer'],
  ])('서버의 비밀이 %s — 어떤 머리든 닫는다', (_, secret, authorization) => {
    vi.stubEnv('CRON_SECRET', secret);
    expect(cronAuthorized(request(authorization))).toBe(false);
  });
});
