import { expect, test } from './anon';

import { SERVICE_NAME } from '@/src/lib/brand';
import { REFUND_TERMS_POINTER } from '@/src/lib/brand/refund';

/**
 * 로그인 없이 여는 안내 화면 셋 — 자주 묻는 질문 · 이용약관 · 환불정책(G-116). 전에는 공용 바닥글의 링크로만 닿아 그 주소를 직접 여는
 * 시험이 없었다. 여기서는 주소를 열어 제목과 몸의 첫 자리가 서는지만 본다 — 글자의 내용은 `src/lib/brand/*` 의 단위가 잰다.
 */

test('자주 묻는 질문은 `#` 이 가리키는 물음을 펴서 연다', async ({ page }) => {
  await page.goto('/help#credits');
  await expect(page.getByRole('heading', { level: 1, name: '자주 묻는 질문' })).toBeVisible();
  await expect(page.getByRole('navigation', { name: '묶음' }).getByRole('link', { name: '풀이권' })).toBeVisible();
  /* 앵커로 와도 `<details>` 는 닫힌 채다 — `OpenHashed` 가 펴서 답까지 보인다 */
  await expect(page.locator('#credits details')).toHaveAttribute('open', '');
  await expect(page.getByText('사주풀이나 궁합풀이를 새로 받을 때 1장씩 써요.', { exact: false })).toBeVisible();
});

test('이용약관은 제목과 첫 장이 선다', async ({ page }) => {
  await page.goto('/terms');
  await expect(page.getByRole('heading', { level: 1, name: `${SERVICE_NAME} 이용약관` })).toBeVisible();
  await expect(page.getByRole('heading', { level: 2, name: '제1장 총칙' })).toBeVisible();
});

test('환불정책은 제목과 첫 절이 서고 끝 줄이 약관을 가리킨다', async ({ page }) => {
  await page.goto('/refund');
  await expect(page.getByRole('heading', { level: 1, name: `${SERVICE_NAME} 환불정책` })).toBeVisible();
  await expect(page.getByRole('heading', { level: 2, name: '한눈에' })).toBeVisible();
  await expect(page.getByRole('main').getByRole('link', { name: REFUND_TERMS_POINTER.link, exact: true })).toHaveAttribute('href', '/terms');
});
