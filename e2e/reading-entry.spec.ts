import { expect, test } from '@playwright/test';

test('풀이 입구는 사주 아래에 작게 보이고 로그인에 출생 정보를 보내지 않는다', async ({ page }) => {
  await page.goto('/#name=민수&date=1990-05-15&hour=14:30');
  const entry = page.locator('#reading-next');
  await expect(entry).toContainText('이 사주가 내 삶에서는 어떤 뜻일까요?');
  await expect(page.locator('#chart')).toBeVisible();
  const chart = (await page.locator('#chart').boundingBox())!;
  const card = (await entry.boundingBox())!;
  expect(card.y).toBeGreaterThanOrEqual(chart.y + chart.height);
  expect(card.height).toBeLessThan(240);
  await page.getByRole('link', { name: '로그인하고 계속하기' }).click();
  await expect(page).toHaveURL(/\/auth\?next=%2F%23resume-reading/);
  expect(page.url()).not.toContain('1990');
  await expect(page.getByRole('heading', { name: '내 사주풀이로 이어갈까요?' })).toBeVisible();
  // OAuth's same-tab return, without requiring a real Google login.
  await page.goto('/#resume-reading');
  await expect(page.locator('#chart')).toBeVisible();
  await expect(page.getByLabel('이름')).toHaveValue('민수');
  await expect(page).toHaveURL(/date=1990-05-15/);
  expect(await page.evaluate(() => sessionStorage.getItem('saju:reading-draft'))).toBeNull();
});

test('임시 입력이 없는 복귀 주소에서도 출생 정보를 입력할 수 있다', async ({ page }) => {
  await page.goto('/#resume-reading');
  await expect(page.getByRole('button', { name: '사주 보기' })).toBeVisible();
  await expect(page.getByLabel('이름')).toHaveValue('');
});
