import 'server-only';

import { createHmac, randomBytes } from 'node:crypto';

import { cookies, headers } from 'next/headers';

import { ipSubjectOf, seoulDateOf } from '@/src/lib/reading/taste-visit';

/**
 * **로그인 전 방문자를 가리키는 두 이름 — 브라우저 묶음과 IP 의 HMAC**(ADR 0143 의 4 · 6).
 *
 * DB 는 원문을 받는 칸이 없고 16진 64자만 받는다(`20261118090000`). 원문을 HMAC 으로 바꾸는 일은 이 파일 하나가 한다 —
 * 쿠키 원문 · IP 원문은 여기서 HMAC 이 되고 그 밖으로 안 나간다(기록에도 안 싣는다).
 *
 * - **브라우저** — httpOnly 쿠키(`TASTE_BROWSER_COOKIE`)에 무작위 32바이트를 두고, `HMAC(TASTE_BROWSER_SECRET, 쿠키)` 를 보낸다.
 *   이 비밀은 날짜로 돌리지 않는다 — 자정을 넘겨 가입한 사람이 다른 브라우저가 되면 귀속이 끊긴다.
 * - **IP** — `HMAC(HMAC(TASTE_IP_SECRET, 서울 날짜), IP)`. 날짜 키는 DB 의 IP 하루 한도와 같은 서울 자정에 바뀐다.
 *
 * ## 어느 헤더를 믿나 — `x-forwarded-for` 의 첫 칸
 *
 * Vercel 은 요청을 받을 때 `x-forwarded-for` 를 **제가 본 클라이언트 IP 로 덮어 쓴다** — 바깥에서 실어 보낸 값은 안 남는다
 * (https://vercel.com/docs/headers/request-headers 의 `x-forwarded-for`: 「we currently overwrite the X-Forwarded-For header
 * and do not forward external IPs. This restriction is in place to prevent IP spoofing.」, 2026-10-03 확인). 그래서 운영에서는 이 헤더가 곧 접속한 IP 다. 로컬 · CI 의 Next 서버는 그 헤더가 없을 때만
 * 소켓 주소로 채운다(`next/dist/server/base-server.js` 의 `x-forwarded-for ??=`) — 시험이 헤더로 IP 를 갈라 보낼 수 있다.
 * 모양이 IP 가 아니면 이 자리를 닫는다(`null`).
 *
 * ## 비밀이 없으면 닫는다
 *
 * 둘 중 하나라도 없으면 `null` 이고 화면은 「실패 · 가입 경로」로 선다. **기본값 비밀로 돌지 않는다** — 그러면 HMAC 이 누구나
 * 다시 지을 수 있는 값이 된다. 로컬 · CI 는 시험이 시험용 값을 넣는다(`playwright.config.ts` · `scripts/check-taste.mjs`),
 * 운영은 Vercel 의 두 값이다(`docs/ops/runbook/ai.md` 「로그인 전 사주 문단 — 비밀 둘 · 상한 · 비용」).
 */

/** 브라우저 묶음 쿠키 — 값은 무작위 32바이트(base64url) */
export const TASTE_BROWSER_COOKIE = 'saju_taste';

/**
 * 「다음 누름은 이 세션을 잇는다」는 표 — 귀속한 세션 id 를 든다(httpOnly). 가입 뒤 `/me/readings/self` 가 「아까 보던
 * 내용」을 세우고, 그 화면의 첫 누름이 세션을 풀이 시도에 잇는다. 값은 열쇠가 아니다 — 서버가 DB 에 다시 물을 때
 * (`claim_taste_session`) 회원 id · 브라우저 HMAC · 다시 잰 지문이 함께 맞아야 한다.
 */
export const TASTE_CLAIM_COOKIE = 'saju_taste_claim';

/** 쿠키의 수명 — 세션 보존(24시간)보다 넉넉하게. 쿠키가 먼저 사라지면 열린 세션을 못 읽는다 */
const BROWSER_COOKIE_DAYS = 7;

/** 귀속 표의 수명 — 가입한 날 첫 풀이를 누르기까지 */
const CLAIM_COOKIE_DAYS = 7;

const COOKIE_SHAPE = /^[A-Za-z0-9_-]{43}$/;

/** 짧은 비밀은 비밀이 아니다 — 지어 놓은 자리표시자(`[SENSITIVE]`)도 여기서 걸린다 */
const MIN_SECRET_LENGTH = 32;

const hmacHex = (key: string | Buffer, value: string): string => createHmac('sha256', key).update(value).digest('hex');

/** 브라우저 HMAC — 쿠키 원문을 안정 비밀로 */
export const browserHmacOf = (secret: string, cookie: string): string => hmacHex(secret, cookie);

/** 그날의 IP 키 — 서울 날짜마다 바뀐다 */
export const ipDayKeyOf = (secret: string, at: Date): Buffer =>
  createHmac('sha256', secret).update(`taste-ip:${seoulDateOf(at)}`).digest();

/** IP HMAC — 그날의 키로 IP 의 이름(`ipSubjectOf`)을 */
export const ipHmacOf = (secret: string, subject: string, at: Date): string => hmacHex(ipDayKeyOf(secret, at), subject);

/** 새 쿠키 값 — 32바이트(256비트) 무작위 */
export const newBrowserCookie = (): string => randomBytes(32).toString('base64url');

type Secrets = { browser: string; ip: string };

/** 비밀 둘 — 하나라도 없거나 짧으면 `null` */
export function tasteSecrets(
  browserSecret: string | undefined = process.env.TASTE_BROWSER_SECRET,
  ipSecret: string | undefined = process.env.TASTE_IP_SECRET,
): Secrets | null {
  const browser = browserSecret?.trim() ?? '';
  const ip = ipSecret?.trim() ?? '';
  if (browser.length < MIN_SECRET_LENGTH || ip.length < MIN_SECRET_LENGTH) return null;
  return { browser, ip };
}

const secure = (): boolean => process.env.NODE_ENV === 'production';

/** 방문자의 두 이름 — 서버가 지은 HMAC 뿐이다 */
export type Visitor = { readonly browserHmac: string; readonly ipHmac: string };

/**
 * 이 요청의 방문자 — 쿠키가 없으면 **지어서 심는다**(서버 액션 안에서만 부른다). 비밀이 없거나 IP 를 못 읽으면 `null`.
 */
export async function tasteVisitor(at: Date = new Date()): Promise<Visitor | null> {
  const secrets = tasteSecrets();
  if (secrets === null) {
    console.error('taste: TASTE_BROWSER_SECRET · TASTE_IP_SECRET 이 없다 — 로그인 전 사주 문단을 닫는다');
    return null;
  }

  const subject = ipSubjectOf((await headers()).get('x-forwarded-for'));
  if (subject === null) return null;

  const jar = await cookies();
  let cookie = jar.get(TASTE_BROWSER_COOKIE)?.value ?? '';
  if (!COOKIE_SHAPE.test(cookie)) {
    cookie = newBrowserCookie();
    jar.set(TASTE_BROWSER_COOKIE, cookie, {
      httpOnly: true,
      secure: secure(),
      sameSite: 'lax',
      path: '/',
      maxAge: BROWSER_COOKIE_DAYS * 24 * 60 * 60,
    });
  }

  return { browserHmac: browserHmacOf(secrets.browser, cookie), ipHmac: ipHmacOf(secrets.ip, subject, at) };
}

/** 이미 있는 쿠키의 브라우저 HMAC — 새로 심지 않는다(화면 · 귀속이 부른다). 없거나 비밀이 없으면 `null` */
export async function browserHmacNow(): Promise<string | null> {
  const secrets = tasteSecrets();
  if (secrets === null) return null;
  const cookie = (await cookies()).get(TASTE_BROWSER_COOKIE)?.value ?? '';
  return COOKIE_SHAPE.test(cookie) ? browserHmacOf(secrets.browser, cookie) : null;
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

/** 귀속 표가 든 세션 id — 없거나 모양이 아니면 `null` */
export async function claimedTasteSessionId(): Promise<string | null> {
  const value = (await cookies()).get(TASTE_CLAIM_COOKIE)?.value ?? '';
  return UUID.test(value) ? value : null;
}

/** 귀속 표를 세운다 — 서버 액션 안에서만 */
export async function markTasteClaimed(sessionId: string): Promise<void> {
  (await cookies()).set(TASTE_CLAIM_COOKIE, sessionId, {
    httpOnly: true,
    secure: secure(),
    sameSite: 'lax',
    path: '/',
    maxAge: CLAIM_COOKIE_DAYS * 24 * 60 * 60,
  });
}

/** 귀속 표를 걷는다 — 서버 액션 안에서만. 세션이 다 쓰였거나(이어진 풀이가 섰다) 못 쓰는 것일 때 */
export async function forgetTasteClaim(): Promise<void> {
  const jar = await cookies();
  if (jar.has(TASTE_CLAIM_COOKIE)) jar.delete(TASTE_CLAIM_COOKIE);
}
