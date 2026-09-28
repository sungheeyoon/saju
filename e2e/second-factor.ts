import { createHmac } from 'node:crypto';

import { expect, type Page } from '@playwright/test';

/**
 * **운영자가 두 번째 요소를 지나는 자리** — 화면으로 등록하고 화면으로 코드를 넣는다(ADR 0123).
 *
 * 운영 화면은 세션이 aal2 가 아니면 운영자 문을 안 부른다. 검사도 그 경계를 넘지 않는다 — 요소를 SQL 로 심거나
 * 토큰을 손으로 짓지 않고, 운영자가 하는 그대로 `/ops/mfa` 에서 등록을 열고, 화면이 보여 준 설정 키로 인증 앱이
 * 할 계산(RFC 6238, 30초 · 6자리 · SHA-1)을 여기서 해 코드를 넣는다. 그래서 이 한 걸음이 등록 · 확인 · aal2 로 오른
 * 쿠키가 운영 화면을 여는 것까지 함께 잰다.
 *
 * 앱의 문구 상수(`app/ops/mfa/copy.ts`)는 e2e 가 못 부른다(층 규칙) — 글자를 여기 적는다.
 */

const BASE32 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';

function base32Bytes(secret: string): Buffer {
  let bits = '';
  for (const char of secret.replace(/=+$/, '').toUpperCase()) {
    const at = BASE32.indexOf(char);
    if (at < 0) throw new Error(`설정 키에 base32 가 아닌 글자가 있습니다 — ${char}`);
    bits += at.toString(2).padStart(5, '0');
  }
  const bytes = bits.match(/.{8}/g) ?? [];
  return Buffer.from(bytes.map((byte) => parseInt(byte, 2)));
}

/** 인증 앱이 지금 보여 줄 6자리 */
export function totpNow(secret: string, at: number = Date.now()): string {
  const counter = Buffer.alloc(8);
  counter.writeBigUInt64BE(BigInt(Math.floor(at / 1000 / 30)));
  const digest = createHmac('sha1', base32Bytes(secret)).update(counter).digest();
  const offset = digest[digest.length - 1] & 0x0f;
  const value = (digest.readUInt32BE(offset) & 0x7fffffff) % 1_000_000;
  return String(value).padStart(6, '0');
}

/**
 * 이 창의 세션을 aal2 로 올린다 — 등록한 적이 없는 계정이어야 한다. 끝나면 `next` 에 서 있다.
 *
 * 30초 경계에 걸려 코드가 막 바뀌어도 Auth 는 앞뒤 한 칸을 받는다 — 그래도 경계 1초 안이면 다음 칸을 기다린다.
 */
export async function passSecondFactor(page: Page, next: string): Promise<string> {
  await page.goto(`/ops/mfa?next=${encodeURIComponent(next)}`);
  await expect(page.getByRole('heading', { name: '2단계 인증' })).toBeVisible();
  await page.getByRole('button', { name: '인증 앱 등록하기' }).click();

  await expect(page.getByRole('img', { name: '인증 앱에 등록할 QR 코드' })).toBeVisible();
  const secret = (await page.locator('dt:text-is("설정 키") + dd').innerText()).trim();

  if (Date.now() / 1000 % 30 > 29) await page.waitForTimeout(1_500);
  await page.getByLabel('6자리 코드').fill(totpNow(secret));
  await page.getByRole('button', { name: '확인하기' }).click();

  await expect(page).toHaveURL(new RegExp(`${next.replace(/[?]/g, '\\?')}$`));
  return secret;
}
