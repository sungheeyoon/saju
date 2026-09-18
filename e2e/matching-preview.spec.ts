import { expect, test } from '@playwright/test';

test('선택 문구를 읽을 시간을 준 뒤 한 장만 넘기고 되돌릴 수 있다', async ({ page }) => {
  await page.goto('/me/matching');
  await expect(page.getByRole('heading', { name: '서연 28' })).toBeVisible();
  await page.clock.install();
  await page.clock.pauseAt(new Date());

  await page.getByRole('button', { name: '상세 궁합 요청하기', exact: true }).click();
  await page.clock.runFor(650);
  await expect(page.getByRole('heading', { name: '서연 28' })).toBeVisible();
  await expect(page.getByText('궁합이 궁금해요', { exact: true })).toHaveCSS('opacity', '1');
  await expect(page.getByRole('button', { name: '상세 궁합 요청하기', exact: true })).toBeDisabled();

  await page.clock.runFor(650);
  await expect(page.getByRole('heading', { name: '지우 27' })).toBeVisible();
  await page.getByRole('button', { name: '이전 인연으로 되돌리기' }).click();
  await expect(page.getByRole('heading', { name: '서연 28' })).toBeVisible();
});

test('모션 최소화에서도 넘김이 끝나고 프로필 사진과 상세 소개를 볼 수 있다', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/me/matching');
  const photo = page.getByRole('img', { name: '서연님의 AI 생성 예시 프로필 사진' });
  await expect(photo).toBeVisible();
  await expect.poll(() => photo.evaluate((image) => (image as HTMLImageElement).naturalWidth)).toBeGreaterThan(0);
  await page.getByRole('button', { name: '궁합의 이유와 프로필 보기' }).click();
  await expect(page.getByRole('dialog')).toBeVisible();
  await page.keyboard.press('Escape');
  await page.getByRole('button', { name: '다음 인연으로 지나가기' }).click();
  await expect(page.getByRole('heading', { name: '지우 27' })).toBeVisible();
});

test('궁합 점수와 추천 이유가 같은 인연을 설명하고 상세 궁합으로 이어진다', async ({ page }) => {
  await page.goto('/me/matching');
  await expect(page.getByRole('heading', { name: /내 귀인은/ })).toBeVisible();
  const score = page.getByRole('button', { name: '서연님과의 예측 궁합 79점, 추천 이유 보기' });
  await expect(score).toContainText('아주 좋은 궁합일 수 있어요.');
  await expect(score).toContainText('내게 적은 목(木) 기운을 보완해 줘요.');
  await score.click();
  const detail = page.getByRole('dialog');
  await expect(detail.getByRole('heading', { name: '왜 나와 잘 맞을까요?' })).toBeVisible();
  await expect(detail).toContainText('두 사람의 오행도 고르게 어우러져요.');
  await expect(detail).toContainText('상대가 동의하면');
  await detail.getByRole('button', { name: /상세 궁합 요청해 보기/ }).click();
  await expect(detail).not.toBeVisible();
  const nextScore = page.getByRole('button', { name: '지우님과의 예측 궁합 74점, 추천 이유 보기' });
  await expect(nextScore).toBeVisible();
  await expect(nextScore).toContainText('좋은 궁합에 가까워요.');
  await expect(nextScore).toContainText('내게 적은 화(火) 기운을 보완해 줘요.');
});
