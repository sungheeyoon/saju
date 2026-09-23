/**
 * 로그인하지 않은 시험이 쓰는 `test` · `expect` — CSP 를 어긴 자리를 자동으로 모은다(G-23 ②).
 *
 * `@playwright/test` 를 바로 쓰면 그 시험은 CSP 를 안 잰다. 익명 spec 은 여기서 가져온다.
 */
export { expect } from '@playwright/test';
export { anonTest as test } from './csp';
