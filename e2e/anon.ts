/**
 * 로그인하지 않은 시험이 쓰는 `test` · `expect` — CSP 를 어긴 자리를 자동으로 모은다(G-23 ②).
 *
 * `@playwright/test` 를 바로 쓰면 그 시험은 CSP 를 안 잰다. 익명 spec 은 여기서 가져온다.
 */
import { anonTest } from './csp';

export { expect } from '@playwright/test';

/**
 * **맛보기 표는 비어 있다** — 로그인 전 첫 화면은 브라우저에서 미리 만든 맛보기 한 칸을 읽는다(ADR 0131).
 *
 * CI 의 익명 차선에는 Supabase 가 없다 — 그 부름은 이름을 못 풀어 실패하고, 화면은 실패를 기록(`unread`)하느라
 * 콘솔에 오류를 남긴다. 그러면 「예상 못한 콘솔 오류가 없다」를 재는 시험이 화면과 상관없는 까닭으로 붉는다.
 * 그 부름 하나만 **아직 만들지 않은 칸**(`null`)으로 답한다 — 운영의 지금 모습(표를 채우는 스크립트는 운영자가
 * 돈다)과 같고, 화면은 엔진의 문장으로 선다. 콘솔 검사는 그대로 엄격하다. 글이 있는 칸을 재려는 시험은
 * `page.route` 로 덮는다(페이지의 가로채기가 문맥의 것보다 먼저다).
 */
export const test = anonTest.extend<{ emptyTasteTable: void }>({
  emptyTasteTable: [
    async ({ context }, use) => {
      await context.route('**/rest/v1/rpc/taste_passage', (route) =>
        route.fulfill({ status: 200, contentType: 'application/json', body: 'null' }),
      );
      await use();
    },
    { auto: true },
  ],
});
