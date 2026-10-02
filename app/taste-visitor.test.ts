import { describe, expect, it } from 'vitest';

import { browserHmacOf, ipHmacOf, newBrowserCookie, tasteSecrets } from './taste-visitor';

/**
 * **원문은 HMAC 이 되고 밖으로 안 간다**(ADR 0143 의 6) — 쿠키 · IP 의 HMAC 이 DB 의 모양(16진 64자)이고, 원문을 품지 않고,
 * IP 키가 서울 자정에 바뀐다.
 */

const BROWSER = 'b'.repeat(40);
const IP = 'i'.repeat(40);
const HEX64 = /^[0-9a-f]{64}$/;

describe('브라우저 묶음', () => {
  it('쿠키는 32바이트 무작위다 — 매번 다르다', () => {
    const one = newBrowserCookie();
    expect(one).toMatch(/^[A-Za-z0-9_-]{43}$/);
    expect(Buffer.from(one, 'base64url')).toHaveLength(32);
    expect(newBrowserCookie()).not.toBe(one);
  });

  it('HMAC 은 16진 64자이고 쿠키 원문을 품지 않는다 — 비밀이 다르면 다른 값이다', () => {
    const cookie = newBrowserCookie();
    const hmac = browserHmacOf(BROWSER, cookie);
    expect(hmac).toMatch(HEX64);
    expect(hmac).not.toContain(cookie);
    expect(browserHmacOf(BROWSER, cookie)).toBe(hmac);
    expect(browserHmacOf('c'.repeat(40), cookie)).not.toBe(hmac);
  });

  it('날짜로 돌리지 않는다 — 자정을 넘겨도 같은 브라우저다', () => {
    const cookie = newBrowserCookie();
    expect(browserHmacOf(BROWSER, cookie)).toBe(browserHmacOf(BROWSER, cookie));
  });
});

describe('IP — 날짜별 키', () => {
  it('HMAC 은 16진 64자이고 IP 원문을 품지 않는다', () => {
    const hmac = ipHmacOf(IP, '203.0.113.7', new Date('2026-10-03T03:00:00Z'));
    expect(hmac).toMatch(HEX64);
    expect(hmac).not.toContain('203.0.113.7');
  });

  it('서울 자정(UTC 15:00)에 키가 바뀐다 — 그 전 1ms 와 후 1ms 가 다르다', () => {
    const before = ipHmacOf(IP, '203.0.113.7', new Date('2026-10-03T14:59:59.999Z'));
    const after = ipHmacOf(IP, '203.0.113.7', new Date('2026-10-03T15:00:00.000Z'));
    expect(before).not.toBe(after);
  });

  it('서울의 같은 날 안에서는 같다 — UTC 날짜가 바뀌어도', () => {
    const morning = ipHmacOf(IP, '203.0.113.7', new Date('2026-10-03T15:00:00.000Z'));
    const evening = ipHmacOf(IP, '203.0.113.7', new Date('2026-10-04T14:59:59.999Z'));
    expect(morning).toBe(evening);
  });
});

describe('비밀이 없으면 닫는다', () => {
  it('둘 다 있어야 하고 짧으면 없는 것이다 — 자리표시자도', () => {
    expect(tasteSecrets(BROWSER, IP)).toEqual({ browser: BROWSER, ip: IP });
    expect(tasteSecrets(undefined, IP)).toBeNull();
    expect(tasteSecrets(BROWSER, '')).toBeNull();
    expect(tasteSecrets('[SENSITIVE]', IP)).toBeNull();
  });
});
