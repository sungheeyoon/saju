import { expect, test } from './anon';

import { fillBirth } from './birth-form';

/**
 * 로그인 전 첫 화면 — **두 입구 · 잠긴 목차(첫 절에 로그인 전 사주 문단) · 접힌 만세력**(흐름 시안 g, ADR 0131).
 *
 * 로그인 전 사주 문단은 서버가 이 사람의 사주로 쓴다(ADR 0143). 시험의 서버는 모델 열쇠가 없고(`playwright.config.ts`)
 * CI 의 익명 차선에는 DB 도 없다 — 그래서 여기서 서는 것은 **실패 · 한도의 자리**다: 다른 글로 바꿔치기하지 않고, 첫 절이
 * 잠긴 채 선다. 글이 서는 길과 가입 왕복은 로그인 차선(`signed-in.spec.ts`)이 DB 에 글을 심어 잰다.
 */

test('첫 화면은 두 입구와 생일 칸이고, 코드 띠와 이야기 칸은 없다', async ({ page }) => {
  await page.goto('/');

  const entries = page.getByRole('tablist', { name: '무엇을 볼까요' });
  await expect(entries.getByRole('tab', { name: /내 사주 보기/ })).toHaveAttribute('aria-selected', 'true');
  await expect(entries.getByRole('tab', { name: /궁합 보기/ })).toHaveAttribute('aria-selected', 'false');
  await expect(page.getByRole('button', { name: '무료로 내 사주 보기' })).toBeVisible();

  /* 제목은 폼 종이의 물음이고, 폼 아래는 「할 수 있는 것」이다 — 조건(로그인 · 풀이권)은 안 싣는다 */
  await expect(page.getByRole('heading', { level: 1, name: '나는 어떤 사람일까?' })).toBeVisible();
  const guide = page.getByRole('region', { name: '할 수 있는 것' });
  await expect(guide.getByRole('heading', { level: 3 })).toHaveText(['사주풀이', '궁합', '인연']);
  await expect(guide).not.toContainText('풀이권');

  await expect(page.getByText('테스트 코드를 받으셨나요?')).toHaveCount(0);
  await expect(page.getByText('사주풀이에서 만날 이야기')).toHaveCount(0);

  /* 로그인 전의 「처음으로」 링크는 이 화면이다 — 회원만 곧장 홈으로 간다(`HomeLink`) */
  await page.goto('/about');
  await expect(page.getByRole('link', { name: '무료로 내 사주 보기' })).toHaveAttribute('href', '/');
});

test('무료로 내 사주 보기 → 결과 머리로 내려가고 · 잠긴 목차(첫 절에 로그인 전 사주 문단) · 접힌 만세력 → 로그인은 입력을 주소에 안 싣는다', async ({ page }) => {
  await page.goto('/');
  await fillBirth(page, { name: '민수', date: '1990-05-15', time: '14:30' });
  await page.getByRole('button', { name: '무료로 내 사주 보기' }).click();

  /* 카드는 홈의 내 사주 카드 — 이름과 오행 분포가 선다 */
  const card = page.getByRole('region', { name: '내 사주' });
  await expect(card).toContainText('민수');
  /* 폼 아래에 선 결과로 데려간다(2026-10-09 화면 점검 A1) — 카드가 화면에 들고 초점이 그 머리에 있다 */
  await expect(card).toBeInViewport();
  expect(await page.evaluate(() => document.activeElement?.contains(document.querySelector('[aria-label="내 사주"]')) ?? false)).toBe(true);
  await expect(card.getByRole('list', { name: '오행 분포' })).toBeVisible();

  /* 주 단추 아래의 고지 한 줄은 걷었다(운영자 결정 2026-10-08, ADR 0143 「2026-10-08 덧」) — 처리는 그대로다 */
  await expect(page.getByText('입력한 생년월일시는', { exact: false })).toHaveCount(0);

  /*
    로그인 전 사주 문단은 따로 칸이 없다 — 잠긴 목차의 첫 절 자리에 선다(운영자 결정 2026-10-09, ADR 0143 「2026-10-09 덧」).
    모델이 없는 시험 서버에서는 실패로 선다 — 첫 절도 다른 절처럼 잠긴 채 조용히 서고, 다른 글 · 다른 단추로 바꿔치기하지 않는다
  */
  await expect(page.getByRole('region', { name: '사주가 보여 주는 나' })).toHaveCount(0);
  const outline = page.getByRole('region', { name: '전체 사주풀이 목차' });
  await expect(outline).toHaveAttribute('aria-busy', 'false', { timeout: 30_000 });
  await expect(page.getByRole('button', { name: '다시 읽기' })).toHaveCount(0);
  await expect(page.getByRole('link', { name: /무료 회원가입/ })).toHaveCount(0);

  /* 잠긴 목차는 본 사주풀이의 절 이름이다 — 첫 줄은 프롬프트의 첫 절. 가입 단추는 카드 끝의 하나다 */
  await expect(outline.getByRole('listitem').first()).toContainText('먼저 볼 핵심 세 가지');
  await expect(outline.getByRole('listitem').first().locator('p')).toHaveCount(1);
  expect(await outline.getByRole('listitem').count()).toBeGreaterThanOrEqual(5);
  await expect(outline.getByRole('link')).toHaveCount(1);

  /* 폰에서도 가로로 넘치지 않는다 */
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  expect(overflow).toBeLessThanOrEqual(0);

  /* 만세력은 지우지 않고 접었다 — 펴면 여덟 글자가 선다 */
  await expect(page.getByRole('heading', { name: '사주팔자' })).toBeHidden();
  await page.locator('#saju-detail > summary').click();
  await expect(page.getByRole('heading', { name: '사주팔자' })).toBeVisible();

  await outline.getByRole('link', { name: '로그인하고 전체 풀이 받기' }).click();
  await expect(page).toHaveURL(/\/auth\?next=%2Fsaju%23resume-reading$/);
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
