import { expect, test } from './anon';

/**
 * 로그인 전의 풀이 입구 — **잠긴 목차의 단추**가 출생 정보를 주소에 안 싣고 로그인으로 간다(ADR 0128 · 0131).
 * 입력은 탭의 `sessionStorage` 가 들고, 돌아온 주소(`/#resume-reading`)가 그것을 되찾는다.
 */
test('풀이 입구는 맛보기 아래 잠긴 목차에 서고 로그인에 출생 정보를 보내지 않는다', async ({ page }) => {
  await page.goto('/#name=민수&date=1990-05-15&hour=14:30');
  const outline = page.getByRole('region', { name: '전체 사주풀이 목차' });
  await expect(outline).toBeVisible();
  /* 카드 · 맛보기가 먼저 선다 — 입구는 그 아래다 */
  const card = (await page.getByRole('region', { name: '내 사주' }).boundingBox())!;
  const entry = (await outline.boundingBox())!;
  expect(entry.y).toBeGreaterThanOrEqual(card.y + card.height);
  await outline.getByRole('link', { name: '로그인하고 전체 풀이 받기' }).click();
  await expect(page).toHaveURL(/\/auth\?next=%2F%23resume-reading/);
  expect(page.url()).not.toContain('1990');
  await expect(page.getByRole('heading', { name: '내 사주풀이로 이어갈까요?' })).toBeVisible();
  // OAuth's same-tab return, without requiring a real Google login.
  await page.goto('/#resume-reading');
  await expect(page.getByRole('region', { name: '내 사주' })).toContainText('민수');
  await expect(page.getByLabel('이름')).toHaveValue('민수');
  await expect(page).toHaveURL(/date=1990-05-15/);
  expect(await page.evaluate(() => sessionStorage.getItem('saju:reading-draft'))).toBeNull();
});

test('임시 입력이 없는 복귀 주소에서도 출생 정보를 입력할 수 있다', async ({ page }) => {
  await page.goto('/#resume-reading');
  await expect(page.getByRole('button', { name: '무료로 내 사주 보기' })).toBeVisible();
  await expect(page.getByLabel('이름')).toHaveValue('');
});
