import { expect, test, type Page } from '@playwright/test';

/**
 * 시각을 아는 입력 한 벌.
 *
 * **라디오를 고르는 줄이 요점이다.** 시간 모름이 체크박스에서 라디오 둘로 바뀌면서
 * (`hourKnown: boolean | null`) 아무것도 고르지 않은 상태가 생겼고, 그 상태에서는
 * 시각 칸이 잠긴다 — 고르지 않은 것을 골랐다고 치지 않기로 한 결정의 결과다.
 * 이름도 필수라 여기서 함께 채운다(계산에는 안 들어가고 제출 조건에만 든다).
 */
const enterKnownBirth = async (page: Page, name = '민수') => {
  await page.getByLabel('이름', { exact: true }).fill(name);
  await page.getByLabel('생년월일', { exact: true }).fill('1990-05-15');
  await page.getByRole('radio', { name: '시각', exact: true }).check();
  await page.getByLabel('출생시각', { exact: true }).fill('14:30');
};

test('입력 전에는 예시 명식을 보여주지 않고 계산 뒤 핵심 탐색을 제공한다', async ({
  page,
}) => {
  const consoleErrors: string[] = [];
  page.on('console', (message) => {
    if (message.type() === 'error') consoleErrors.push(message.text());
  });

  await page.goto('/');

  await expect(page.getByRole('heading', { name: '생년월일시를 입력해 주세요' })).toBeVisible();
  await expect(page.getByRole('heading', { name: '사주팔자' })).toHaveCount(0);

  await enterKnownBirth(page);
  await page.getByRole('button', { name: '사주 보기' }).click();

  await expect(page.getByRole('heading', { name: '사주팔자' })).toBeVisible();
  await expect(page.getByRole('navigation', { name: '결과 바로가기' })).toBeVisible();
  await expect(page.getByRole('heading', { name: '오행 분포' })).toBeVisible();
  await expect(page.getByRole('heading', { name: '신강 · 신약' })).toBeVisible();
  await expect(page.getByRole('tabpanel')).toContainText('세운');
  await expect(consoleErrors).toEqual([]);
});

test('연속 입력, 시간 미상, 진태양시와 운 탭이 함께 동작한다', async ({ page }) => {
  await page.goto('/');
  await enterKnownBirth(page);

  await page.getByRole('radio', { name: '모름', exact: true }).check();
  await expect(page.getByLabel('출생시각', { exact: true })).toBeDisabled();
  await page.getByRole('button', { name: '사주 보기' }).click();
  await expect(page.getByText('미상 · 시주를 뽑지 않았습니다')).toBeVisible();

  // 라디오는 끌 수 없다 — 반대쪽을 고른다. 그것이 라디오로 바꾼 이유이기도 하다.
  await page.getByRole('radio', { name: '시각', exact: true }).check();
  await page.getByLabel('출생시각', { exact: true }).fill('14:30');
  await page.locator('summary').filter({ hasText: '고급 설정' }).click();
  await page.getByRole('radio', { name: '진태양시' }).check();
  await expect(page.getByText('입력이 바뀌었습니다.', { exact: false })).toBeVisible();
  await page.getByRole('button', { name: '결과 업데이트' }).click();
  await expect(page.getByRole('heading', { name: /적용된 보정.*진태양시/ })).toBeVisible();
  await expect(page.getByText('균시차', { exact: true })).toBeVisible();

  await page.getByRole('tab', { name: '월운' }).click();
  await expect(page.getByRole('tabpanel')).toContainText('월운');
  await page.getByRole('tab', { name: '월운' }).press('ArrowRight');
  await expect(page.getByRole('tabpanel')).toContainText('대운');
});

/**
 * 결과 화면을 링크로 줄 수 있어야 한다. 상태가 컴포넌트 안에만 있으면 주소를
 * 복사해 줘도 상대는 빈 폼을 본다 — 그것이 이 동기화의 이유이므로, 주소에
 * 실렸는지가 아니라 **그 주소로 다시 열었을 때 같은 명식이 나오는지**를 본다.
 */
test('제출한 입력이 주소에 실려 링크와 새로고침에서 같은 명식을 낸다', async ({ page }) => {
  // 링크로 바로 들어오는 경로는 서버가 그린 HTML 위에 브라우저가 결과를 얹는
  // 순간이라 하이드레이션이 깨지기 쉽다. 콘솔 오류를 함께 본다.
  const consoleErrors: string[] = [];
  page.on('console', (message) => {
    if (message.type() === 'error') consoleErrors.push(message.text());
  });

  await page.goto('/');
  await enterKnownBirth(page);
  await page.getByRole('button', { name: '사주 보기' }).click();
  await expect(page.getByRole('heading', { name: '사주팔자' })).toBeVisible();

  const shared = new URL(page.url());
  expect(Object.fromEntries(shared.searchParams)).toEqual({
    // 이름은 계산에 안 들어가지만 주소에는 실린다 — 링크를 나누면 이름도 나눠진다.
    name: '민수',
    date: '1990-05-15',
    hour: '14:30',
    gender: 'female',
    city: '서울',
    rule: 'jo',
    basis: 'localMean',
    saeun: '2026',
  });

  const chart = await page.locator('#chart').innerText();

  await page.goto(shared.toString());
  await expect(page.getByRole('heading', { name: '사주팔자' })).toBeVisible();
  expect(await page.locator('#chart').innerText()).toBe(chart);
  // 폼도 주소를 따라와야 한다. 안 그러면 사용자가 바꾼 적 없는데 '입력이 바뀌었습니다'가 뜬다.
  await expect(page.getByLabel('생년월일', { exact: true })).toHaveValue('1990-05-15');
  await expect(page.getByText('입력이 바뀌었습니다.', { exact: false })).toHaveCount(0);
  expect(consoleErrors).toEqual([]);
});

/**
 * 세운 연도를 몇 번 옮겼다고 뒤로가기를 그만큼 눌러야 하면 안 된다. 첫 계산만
 * 히스토리에 쌓고 이후 수정은 같은 자리를 덮어쓴다.
 */
test('수정은 히스토리를 쌓지 않아 뒤로가기 한 번에 빈 화면으로 돌아온다', async ({ page }) => {
  await page.goto('/');
  await enterKnownBirth(page);
  await page.getByRole('button', { name: '사주 보기' }).click();
  await expect(page.getByRole('heading', { name: '사주팔자' })).toBeVisible();

  await page.locator('summary').filter({ hasText: '고급 설정' }).click();
  await page.getByLabel('세운 시작').fill('2030');
  await page.getByRole('button', { name: '결과 업데이트' }).click();
  await expect(page).toHaveURL(/saeun=2030/);

  await page.goBack();
  await expect(page.getByRole('heading', { name: '생년월일시를 입력해 주세요' })).toBeVisible();
  await expect(page).toHaveURL(/\/$/);
});

/**
 * 궁합 화면은 한 주소에 입력 두 벌을 싣는다. 접두사가 섞이면 상대의 생일로 내
 * 사주가 나오므로, 링크로 다시 열었을 때 두 명식이 그대로인지가 본론이다.
 */
test('궁합은 두 사람의 입력을 한 주소에 싣고 링크로 그대로 열린다', async ({ page }) => {
  const consoleErrors: string[] = [];
  page.on('console', (message) => {
    if (message.type() === 'error') consoleErrors.push(message.text());
  });

  await page.goto('/compat');
  await expect(
    page.getByRole('heading', { name: '두 사람의 생년월일시를 입력해 주세요' }),
  ).toBeVisible();

  // **묶음의 이름이 입력한 이름으로 바뀐다**(`legend` 가 `nameOf(form, side)`다).
  // 그래서 이름을 마지막에 채우고, 그 뒤로는 사람 이름으로 가리킨다.
  for (const [placeholder, name, date, time] of [
    ['첫 번째 사람', '민수', '1990-05-15', '14:30'],
    ['두 번째 사람', '지영', '1992-08-20', '09:00'],
  ] as const) {
    const group = page.getByRole('group', { name: placeholder });

    await group.getByLabel('생년월일', { exact: true }).fill(date);
    await group.getByRole('radio', { name: '시각', exact: true }).check();
    await group.getByLabel('출생시각', { exact: true }).fill(time);
    await group.getByLabel('이름', { exact: true }).fill(name);
  }

  const first = page.getByRole('group', { name: '민수' });
  await page.getByRole('button', { name: '궁합 보기' }).click();

  await expect(page.getByRole('heading', { name: '두 원국 사이의 관계' })).toBeVisible();

  const shared = new URL(page.url());
  expect(shared.searchParams.get('a.date')).toBe('1990-05-15');
  expect(shared.searchParams.get('b.date')).toBe('1992-08-20');
  expect(shared.searchParams.get('a.hour')).toBe('14:30');

  const chart = await page.locator('main').innerText();

  await page.goto(shared.toString());
  await expect(page.getByRole('heading', { name: '두 원국 사이의 관계' })).toBeVisible();
  expect(await page.locator('main').innerText()).toBe(chart);
  await expect(first.getByLabel('생년월일', { exact: true })).toHaveValue('1990-05-15');
  expect(consoleErrors).toEqual([]);

  // 관계 표가 넓어 가로로 흐르기 쉽다 — 표 안에서만 스크롤되어야 한다.
  const overflow = await page.evaluate(() => ({
    client: document.documentElement.clientWidth,
    scroll: document.documentElement.scrollWidth,
  }));
  expect(overflow.scroll).toBeLessThanOrEqual(overflow.client);
});

/**
 * 주소가 곧 결과라는 것을 화면이 말해 주지 않으면 아무도 링크를 공유하지 않는다.
 * 버튼이 실제로 지금 주소를 클립보드에 넣는지까지 본다.
 */
test('결과 링크 복사 버튼이 지금 주소를 클립보드에 넣는다', async ({ page, context }) => {
  await context.grantPermissions(['clipboard-read', 'clipboard-write']);

  await page.goto('/');
  // 입력 전에는 복사할 결과가 없다.
  await expect(page.getByRole('button', { name: '결과 링크 복사' })).toHaveCount(0);

  await enterKnownBirth(page);
  await page.getByRole('button', { name: '사주 보기' }).click();
  await expect(page.getByRole('heading', { name: '사주팔자' })).toBeVisible();

  await page.getByRole('button', { name: '결과 링크 복사' }).click();
  await expect(page.getByRole('button', { name: '복사했습니다' })).toBeVisible();

  const copied = await page.evaluate(() => navigator.clipboard.readText());
  expect(copied).toBe(page.url());
  expect(copied).toContain('date=1990-05-15');
});

test('한 사람만 적힌 궁합 주소는 빈 폼으로 연다', async ({ page }) => {
  // 반쪽 링크로 남의 사주가 섞여 보이면 안 된다.
  await page.goto('/compat?a.date=1990-05-15&a.hour=14:30');
  await expect(
    page.getByRole('heading', { name: '두 사람의 생년월일시를 입력해 주세요' }),
  ).toBeVisible();
});

test('모바일에서 전역 가로 넘침이 없고 주요 조작 영역이 44px 이상이다', async ({
  page,
}, testInfo) => {
  test.skip(!testInfo.project.name.startsWith('mobile'));
  await page.goto('/');

  const viewport = page.viewportSize();
  expect(viewport?.width).toBeLessThanOrEqual(430);

  const overflow = await page.evaluate(() => ({
    client: document.documentElement.clientWidth,
    scroll: document.documentElement.scrollWidth,
  }));
  expect(overflow.scroll).toBeLessThanOrEqual(overflow.client);

  for (const control of [
    page.getByLabel('생년월일', { exact: true }),
    page.getByLabel('출생시각', { exact: true }),
    page.getByRole('button', { name: '사주 보기' }),
  ]) {
    const box = await control.boundingBox();
    expect(box?.height).toBeGreaterThanOrEqual(44);
  }

  await enterKnownBirth(page);
  await page.getByRole('button', { name: '사주 보기' }).click();
  await expect(page.getByText('좌우로 넘겨 전체 보기', { exact: false }).first()).toBeVisible();
});
