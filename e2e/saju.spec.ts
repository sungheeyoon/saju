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
 * 지금의 운 — **브라우저로 눌러야 보이는 것이 있는 카드다.**
 *
 * 기준 시각은 `Date.now()` 에서 오므로 골든이 못 잡는다. 그리고 이 카드는 조립기가 낸
 * 발화를 네 자리로 나눠 놓는데(`placeNowUtterances`) **두 번 놓거나 빼먹는 것은 화면의
 * 일이라 유닛 테스트가 못 본다** — 실제로 `relation.coverage` 가 두 곳에 찍힌 적이 있다.
 *
 * 기준 시각 줄이 없으면 나머지가 전부 기준점 없는 문장이 되므로 그것부터 본다.
 */
test('지금의 운이 기준 시각과 세 칸을 한 번씩 보인다', async ({ page }) => {
  const consoleErrors: string[] = [];
  page.on('console', (message) => {
    if (message.type() === 'error') consoleErrors.push(message.text());
  });

  await page.goto('/');
  await enterKnownBirth(page);
  await page.getByRole('button', { name: '사주 보기' }).click();

  const now = page.locator('#fortune');
  await expect(now.getByRole('heading', { name: '지금의 운' })).toBeVisible();

  const text = await now.innerText();

  // 기준 시각. 지금이 언제인지는 브라우저가 정하므로 모양만 본다.
  expect(text).toMatch(/\d{4}년 \d{1,2}월 \d{1,2}일 \d{1,2}시 \d{1,2}분 기준으로 짚은 운입니다/);
  expect(text).toContain('해는 입춘에서, 달은 절입에서 갈립니다');
  // 스스로 갱신되는 것처럼 말하지 않는다 — 오래 열어 둔 탭을 신선한 것으로 읽게 된다.
  expect(text).toContain('다시 제출하기 전까지는 이 기준 시각이 바뀌지 않습니다');

  // 세 칸이 각각 한 번씩. 두 번 놓으면 여기서 걸린다.
  expect(text.match(/대운/g)?.length).toBeGreaterThan(0);
  expect(text.match(/년 세운 /g)).toHaveLength(1);
  expect(text.match(/월 월운 /g)).toHaveLength(1);
  expect(text.match(/기준으로 짚은 운입니다/g)).toHaveLength(1);
  expect(text.match(/원국과 걸리는 것만 셌습니다/g)).toHaveLength(1);
  // 대운 관계가 실제로 행으로 선다 — 고지가 좁아진 것이 채워졌다는 증거다.
  expect(text).toMatch(/대운 월[간지] /);

  // 강도 딱지가 한 카드 안에서 갈린다 — 세운·월운은 사실, 대운은 유도다.
  expect(text).toContain('사실');
  expect(text).toContain('유도');

  // 표는 그대로 아래에 있다. 이 카드가 표를 대신하는 것이 아니다.
  await expect(page.getByRole('heading', { name: '운 흐름' })).toBeVisible();
  await expect(page.getByRole('tab', { name: '세운' })).toBeVisible();

  expect(consoleErrors).toEqual([]);
});

/**
 * 시간을 모르면 대운만 한 칸 내려앉는다. 세운의 해와 월운의 달은 시주 두 글자가
 * 바꾸지 않으므로 사실로 남고, 흔들리는 것은 관계 목록의 전체성이라 목록이 따로 든다.
 */
test('시간 미상이면 지금의 운에서 대운만 후보로 내려앉는다', async ({ page }) => {
  await page.goto('/');
  await page.getByLabel('이름', { exact: true }).fill('민수');
  await page.getByLabel('생년월일', { exact: true }).fill('1990-05-15');
  await page.getByRole('radio', { name: '모름', exact: true }).check();
  await page.getByRole('button', { name: '사주 보기' }).click();

  const text = await page.locator('#fortune').innerText();

  expect(text).toContain('후보로 봅니다');
  expect(text).toContain('시각을 몰라 대운수가 두 달쯤 흔들리므로');
  // 목록의 한계 둘이 나란히 선다 — 하나는 우리 구현, 하나는 빠진 입력이다.
  expect(text).toContain('원국과 걸리는 것만 셌습니다');
  expect(text).toContain('시주를 빼고 센 목록이라');
});

/**
 * 기준 시각이 **제출할 때마다** 새로 잡히는가.
 *
 * 한동안 결과 화면 안에서 `useState(() => Date.now())` 로 잡아 **첫 계산 때 한 번
 * 얼었다.** 탭을 열어 둔 채 입춘·절입·생일을 넘기면 지난 운을 지금이라고 보여 주는데,
 * 문장은 "다시 제출하기 전까지는 이 기준 시각이 바뀌지 않습니다"라고 적고 있다.
 *
 * **유닛 테스트가 못 보는 종류다** — 조립기는 넘겨받은 시각으로 정확히 셈하고 있었고,
 * 틀린 것은 화면이 무엇을 넘기는지였다. 그래서 시계를 손으로 돌려 브라우저에서 본다.
 */
test('기준 시각은 제출할 때마다 새로 잡힌다', async ({ page }) => {
  await page.clock.install({ time: new Date('2026-08-17T10:00:00+09:00') });
  await page.goto('/');

  await enterKnownBirth(page);
  await page.getByRole('button', { name: '사주 보기' }).click();

  const asOf = async () =>
    (await page.locator('#fortune').innerText()).match(/(\d+년 \d+월 \d+일 \d+시 \d+분) 기준/)?.[1];

  expect(await asOf()).toBe('2026년 8월 17일 10시 0분');

  await page.clock.fastForward('05:00:00');

  // 아직 제출하지 않았으므로 그대로다 — 초마다 다시 그리지는 않는다.
  expect(await asOf()).toBe('2026년 8월 17일 10시 0분');

  await page.locator('summary').filter({ hasText: '고급 설정' }).click();
  await page.getByLabel('세운 시작').fill('2030');
  await page.getByRole('button', { name: '결과 업데이트' }).click();
  await expect(page).toHaveURL(/saeun=2030/);

  // 제출은 "지금 다시 봐 달라"는 뜻이기도 하다.
  expect(await asOf()).toBe('2026년 8월 17일 15시 0분');
});

/**
 * 대운 표가 **세운 표와 같은 모양**이 됐다 — 십성·12운성·12신살·관계.
 *
 * 그리고 '현재' 강조가 세 표에서 **한 곳**에서 나온다(`CurrentFortune`). 세운·월운 표가
 * 각자 절입 시각을 견주고 있었는데, 표마다 따로 짚으면 어긋나는 날 어느 쪽이 맞는지
 * 알 수 없다 — 그 어긋남은 브라우저로 눌러야만 보인다.
 */
test('대운 표가 칸 안을 채우고 지금 도는 칸을 짚는다', async ({ page }) => {
  const errors: string[] = [];
  page.on('console', (message) => {
    if (message.type() === 'error') errors.push(message.text());
  });

  await page.goto('/');
  await enterKnownBirth(page);
  await page.getByRole('button', { name: '사주 보기' }).click();

  await page.getByRole('tab', { name: '대운' }).click();
  const panel = page.getByRole('tabpanel');
  const text = await panel.innerText();

  // 칸 안이 세운 표와 같은 모양이다 — 십성·12운성·12신살이 함께 선다.
  expect(text).toContain('천간 십성');
  expect(text).toContain('12운성(일간 기준)');
  // 대운이 원국과 맺는 관계가 실제로 찍힌다.
  expect(text).toMatch(/[가-힣]+(합|충|형|파|해|원진|귀문)/);
  // 세운·월운을 함께 놓지 않았다는 것을 표가 밝힌다.
  expect(text).toContain('세운·월운은 함께 놓지 않았습니다');

  // 지금 도는 칸이 짚혀 있다. 어느 칸인지는 브라우저의 '지금' 이 정하므로
  // 몇 번째인지 대신 **한 칸만** 짚혔는지를 본다.
  expect(text.match(/현재/g)).toHaveLength(1);

  // 같은 판정이 세운 표에도 서고, 그 값은 한 곳에서 나온다.
  await page.getByRole('tab', { name: '세운' }).click();
  expect((await panel.innerText()).match(/현재/g)?.length ?? 0).toBeLessThanOrEqual(1);

  expect(errors).toEqual([]);
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
