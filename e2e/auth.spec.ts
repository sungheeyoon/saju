import { expect, test } from '@playwright/test';

/**
 * 로그인 흐름 중 **살아 있는 Supabase 없이 잴 수 있는 부분**만 여기서 잰다.
 *
 * 구글 로그인 자체는 남의 화면을 지나가므로 여기서 몰지 않는다. 대신 그 앞뒤 —
 * 로그인하지 않은 사람이 어디로 가는가, 관문에 막혀 돌아온 사람에게 무엇이 보이는가 —
 * 는 전부 우리 코드이고, 이쪽이 실제로 틀리기 쉬운 자리다.
 *
 * 세션이 없으면 클라이언트는 Supabase 를 두드리지 않고 바로 「없음」을 낸다. 그래서
 * 이 시험들은 CI 의 껍데기 접속값으로도 돈다 — 로그인하지 않은 사람을 돌려보내는 데
 * 백엔드가 필요하면 그것부터 잘못이다.
 */

test('로그인하지 않으면 내 계정 화면에 들어가지 못한다', async ({ page }) => {
  await page.goto('/me');

  await expect(page).toHaveURL(/\/auth$/);
  await expect(page.getByRole('button', { name: '구글로 로그인' })).toBeVisible();
});

test('로그인 화면은 초대받은 사람만 들어온다고 미리 말한다', async ({ page }) => {
  await page.goto('/auth');

  await expect(page.getByText('초대받은 분만', { exact: false })).toBeVisible();
  // 익명 흐름으로 돌아갈 길을 막지 않는다. 로그인은 매칭을 위한 것이지 계산의 조건이 아니다.
  await expect(page.getByRole('link', { name: '로그인 없이 명식 보기' })).toBeVisible();
});

test('초대 관문에 막혀 돌아오면 계정이 만들어지지 않았다고 말한다', async ({ page }) => {
  // 훅이 거부하면 구글이 아니라 Supabase 가 `error` 를 달아 이 자리로 돌려보낸다.
  await page.goto('/auth/callback?error=access_denied&error_description=not+invited');

  await expect(page).toHaveURL(/\/auth\/denied$/);
  await expect(page.getByRole('heading', { name: '초대된 주소가 아닙니다' })).toBeVisible();
  await expect(page.getByText('계정은 만들어지지 않았습니다', { exact: false })).toBeVisible();
});

test('익명 흐름은 로그인과 무관하게 그대로 열려 있다', async ({ page }) => {
  await page.goto('/');

  await expect(page.getByRole('link', { name: '로그인' })).toBeVisible();
  await expect(page.getByRole('heading', { name: '생년월일시를 입력해 주세요' })).toBeVisible();
});
