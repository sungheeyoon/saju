/**
 * 로그인하지 않은 시험이 쓰는 `test` · `expect` — CSP 를 어긴 자리를 자동으로 모은다(G-23 ②).
 *
 * `@playwright/test` 를 바로 쓰면 그 시험은 CSP 를 안 잰다. 익명 spec 은 여기서 가져온다.
 *
 * 로그인 전 사주 문단은 이제 서버 액션이 쓴다(ADR 0143) — 브라우저가 Supabase 를 직접 부르던 자리(`taste_passage`)가 없어져
 * 그 부름을 막아 두던 가로채기도 걷었다. CI 의 익명 차선에는 Supabase 가 없으므로 서버가 그 자리를 닫고(「실패」) 화면은
 * 가입 경로로 선다 — 브라우저 콘솔에는 아무것도 안 남는다.
 */
import { anonTest } from './csp';

export { expect } from '@playwright/test';

export const test = anonTest;
