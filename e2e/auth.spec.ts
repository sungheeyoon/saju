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

test('로그인 화면은 코드가 한 번 필요하다고 미리 말한다', async ({ page }) => {
  await page.goto('/auth');

  /*
    **로그인 버튼을 누르기 전에 알려 준다.** 이메일 명단이 문을 지킬 때는 「초대받은
    분만」이었고, 그때는 명단에 없으면 로그인 자체가 안 됐다. 지금은 로그인이 되고
    그다음에 코드를 묻는다(ADR 0042) — 코드가 없는 사람이 로그인부터 하고 나서
    막다른 화면을 만나지 않게, 필요한 것을 여기서 먼저 말한다.
  */
  await expect(page.getByText('테스트 코드', { exact: false })).toBeVisible();
  await expect(page.getByRole('link', { name: '사주 보기로 돌아가기' })).toBeVisible();
});

test('로그인이 끊기면 왜인지 모른다고 말한다', async ({ page }) => {
  /*
    초대 훅이 거부하면 Supabase 가 `error` 를 달아 이 자리로 돌려보냈다. 훅을 걷은
    뒤로 그 길은 없어졌지만, 구글 쪽에서 취소하거나 중간에 끊기면 여전히 이리로 온다.
  */
  await page.goto('/auth/callback?error=access_denied&error_description=cancelled');

  await expect(page).toHaveURL(/\/auth\/denied$/);
  await expect(page.getByRole('heading', { name: '로그인하지 못했습니다' })).toBeVisible();
});

test('사주 계산은 로그인 없이 열리고 궁합은 로그인으로 이어진다', async ({ page }) => {
  await page.goto('/');

  /*
    헤더 오른쪽 끝은 **세션을 보고 정해진다**(`SiteHeader`). 로그인한 사람에게는
    설정 메뉴가 서므로, 세션이 없을 때 그 자리가 로그인을 권하는지도 함께 잰다 —
    한쪽만 재면 둘 중 하나가 늘 틀린 채로 지나간다.
  */
  await expect(page.getByRole('link', { name: '로그인', exact: true })).toBeVisible();
  await expect(page.getByLabel('설정 메뉴')).toHaveCount(0);
  await expect(page.getByRole('heading', { name: '생년월일시를 입력해 주세요' })).toBeVisible();

  await page.goto('/compat');
  await expect(page).toHaveURL(/\/auth\?next=%2Fcompat/);
  await expect(page.getByRole('heading', { name: '궁합을 보려면 로그인해 주세요' })).toBeVisible();
});
