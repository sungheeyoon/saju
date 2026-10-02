import { expect, test } from './anon';

import { fillBirth } from './birth-form';

/**
 * 로그인 전 첫 화면 — **두 입구 · 로그인 전 사주 문단 · 잠긴 목차 · 접힌 만세력**(흐름 시안 g, ADR 0131).
 *
 * 로그인 전 사주 문단은 서버가 이 사람의 사주로 쓴다(ADR 0143). 시험의 서버는 모델 열쇠가 없고(`playwright.config.ts`)
 * CI 의 익명 차선에는 DB 도 없다 — 그래서 여기서 서는 것은 **실패 · 한도의 자리**다: 다른 글로 바꿔치기하지 않고, 다시 읽기나
 * 가입 경로가 선다. 글이 서는 길과 가입 왕복은 로그인 차선(`signed-in.spec.ts`)이 DB 에 글을 심어 잰다.
 */

test('첫 화면은 두 입구와 생일 칸이고, 코드 띠와 이야기 칸은 없다', async ({ page }) => {
  await page.goto('/');

  const entries = page.getByRole('tablist', { name: '무엇을 볼까요' });
  await expect(entries.getByRole('tab', { name: /내 사주 보기/ })).toHaveAttribute('aria-selected', 'true');
  await expect(entries.getByRole('tab', { name: /궁합 보기/ })).toHaveAttribute('aria-selected', 'false');
  await expect(page.getByRole('button', { name: '무료로 내 사주 보기' })).toBeVisible();

  await expect(page.getByText('테스트 코드를 받으셨나요?')).toHaveCount(0);
  await expect(page.getByText('사주풀이에서 만날 이야기')).toHaveCount(0);
});

test('무료로 내 사주 보기 → 로그인 전 사주 문단 · 잠긴 목차 · 접힌 만세력 → 로그인은 입력을 주소에 안 싣는다', async ({ page }) => {
  await page.goto('/');
  await fillBirth(page, { name: '민수', date: '1990-05-15', time: '14:30' });
  await page.getByRole('button', { name: '무료로 내 사주 보기' }).click();

  /* 카드는 홈의 내 사주 카드 — 이름과 오행 분포가 선다 */
  const card = page.getByRole('region', { name: '내 사주' });
  await expect(card).toContainText('민수');
  await expect(card.getByRole('list', { name: '오행 분포' })).toBeVisible();

  /* 무엇이 어디로 가는지 — 누르는 단추 곁의 고지(운영자가 정한 문구, ADR 0143) */
  await expect(page.getByText('입력한 생년월일시는 우리 서버에서 사주를 계산하는 데만 쓰고 저장하지 않아요.', { exact: false })).toBeVisible();

  /* 로그인 전 사주 문단 — 모델이 없는 시험 서버에서는 실패로 선다. 엔진 문장으로 바꿔치기하지 않고 다음 걸음이 선다 */
  const taste = page.getByRole('region', { name: '사주가 보여 주는 나' });
  await expect(taste).toHaveAttribute('aria-busy', 'false', { timeout: 30_000 });
  await expect(taste.getByRole('button', { name: '다시 읽기' }).or(taste.getByRole('link', { name: '무료 회원가입하고 이어보기' }))).toBeVisible();
  await expect(taste.getByRole('button', { name: '더보기' })).toHaveCount(0);

  /* 잠긴 목차는 본 사주풀이의 절 이름이다 — 첫 줄은 프롬프트의 첫 절 */
  const outline = page.getByRole('region', { name: '전체 사주풀이 목차' });
  await expect(outline.getByRole('listitem').first()).toContainText('먼저 볼 핵심 세 가지');
  expect(await outline.getByRole('listitem').count()).toBeGreaterThanOrEqual(5);

  /* 폰에서도 가로로 넘치지 않는다 */
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  expect(overflow).toBeLessThanOrEqual(0);

  /* 만세력은 지우지 않고 접었다 — 펴면 여덟 글자가 선다 */
  await expect(page.getByRole('heading', { name: '사주팔자' })).toBeHidden();
  await page.locator('#saju-detail > summary').click();
  await expect(page.getByRole('heading', { name: '사주팔자' })).toBeVisible();

  await outline.getByRole('link', { name: '로그인하고 전체 풀이 받기' }).click();
  await expect(page).toHaveURL(/\/auth\?next=%2F%23resume-reading$/);
  expect(page.url()).not.toContain('1990');
  expect(await page.evaluate(() => sessionStorage.getItem('saju:reading-draft'))).toContain('date=1990-05-15');
});

test('궁합 보기 → 두 사람의 한 줄 · 가린 점수 · 잠긴 목록 → 로그인은 두 사람을 주소에 안 싣는다', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('tab', { name: /궁합 보기/ }).click();

  const panel = page.getByRole('tabpanel', { name: /궁합 보기/ });
  await fillBirth(panel.getByRole('group', { name: '나' }), { name: '민수', date: '1990-05-15', time: '14:30' });
  await fillBirth(panel.getByRole('group', { name: '상대' }), { name: '지영', date: '1992-08-20', time: '09:00' });
  await panel.getByRole('button', { name: '무료로 두 사람 궁합 보기' }).click();

  const taste = panel.getByRole('region', { name: '민수 × 지영 · 두 사람의 궁합' });
  await expect(taste).toContainText(/민수|지영/);
  await expect(taste).toContainText('점수는 궁합풀이에서 볼 수 있어요');

  await panel.getByRole('link', { name: '로그인하고 궁합풀이 받기' }).click();
  await expect(page).toHaveURL(/\/auth\?next=%2Fcompat%23resume-pair$/);
  expect(page.url()).not.toContain('1990');
  const draft = await page.evaluate(() => sessionStorage.getItem('saju:pair-draft'));
  expect(draft).toContain('a.date=1990-05-15');
  expect(draft).toContain('b.date=1992-08-20');
});

test('궁합 입구를 닫아도 적던 내 사주의 결과는 그대로다', async ({ page }) => {
  await page.goto('/#name=민수&date=1990-05-15&hour=14:30');
  await expect(page.getByRole('region', { name: '내 사주' })).toContainText('민수');

  await page.getByRole('tab', { name: /궁합 보기/ }).click();
  await expect(page.getByRole('region', { name: '내 사주' })).toBeHidden();
  await page.getByRole('tab', { name: /내 사주 보기/ }).click();
  await expect(page.getByRole('region', { name: '내 사주' })).toContainText('민수');
});
