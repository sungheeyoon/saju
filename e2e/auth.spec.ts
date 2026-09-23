import { expect, test } from './anon';

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
  await expect(page.getByRole('link', { name: '사주로 돌아가기' })).toBeVisible();
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

/**
 * **콜백은 다른 오리진으로 보내지 않는다.**
 *
 * 여기서 `new URL(경로, request.url)` 로 절대 주소를 짓고 있었는데, 그 origin 은
 * 요청이 들어온 주소가 아니라 **서버가 묶인 주소**다. `--hostname 0.0.0.0` 으로 띄운
 * 개발 서버에서 `localhost:3000` 으로 로그인하면 `0.0.0.0:3000` 으로 돌려보냈다.
 *
 * 그 둘은 다른 오리진이라 **방금 붙인 세션 쿠키가 안 실린다.** 로그인은 성공했는데
 * 도착한 화면에는 세션이 없고, 관문이 다시 로그인 화면으로 튕긴다 — 사용자에게는
 * 「로그인했는데 계속 로그인하라고 한다」로 보인다. 실제로 그렇게 보였다.
 *
 * 붙은 서버 이름에 기대지 않고 재려고 **응답의 `Location` 을 직접 본다.** 검사용
 * 서버는 `localhost` 로 묶이므로, 화면이 어디에 도착했는지만 보면 버그가 있어도
 * 초록으로 지나간다.
 */
test('로그인 콜백은 오리진을 짓지 않고 경로만 돌려준다', async ({ request }) => {
  const denied = await request.get('/auth/callback?error=access_denied', { maxRedirects: 0 });
  expect(denied.status()).toBe(307);
  expect(denied.headers()['location']).toBe('/auth/denied');

  const stray = await request.get('/auth/callback', { maxRedirects: 0 });
  expect(stray.status()).toBe(307);
  expect(stray.headers()['location']).toBe('/auth');
});

/**
 * **끝난 로그인 흐름은 자기 검증 쿠키를 남기지 않는다.**
 *
 * 로그인을 시작할 때마다 PKCE 검증 쿠키가 하나 생기는데, 이름에 그 시도의 번호가
 * 박혀서(`…-flow-<난수>-code-verifier`) **덮어쓰이지 않고 쌓인다.** 끝까지 못 간
 * 시도마다 하나씩 늘고, 쌓인 것은 그 뒤 모든 요청에 실려 나간다.
 *
 * 쌓이면 요청 헤더가 Node 의 한도(16KB)를 넘고 서버는 화면 대신 **431** 을 돌려준다.
 * 그러면 로그인이 안 되고, 안 되니 또 시도하고, 시도마다 하나가 는다 — 로컬에서
 * 실제로 이 구덩이에 빠져 한동안 아무 화면도 안 열렸다.
 *
 * **세션 쿠키는 안 건드린다**를 함께 잰다. 쓸어 내는 빗자루가 넓으면 이 자리가
 * 사람을 로그아웃시키는 자리가 된다.
 */
test('로그인 흐름이 끝나면 쌓인 검증 쿠키를 쓸어 낸다', async ({ page, context }) => {
  await context.addCookies(
    [
      { name: 'sb-test-auth-token-flow-1111-code-verifier', value: 'a' },
      { name: 'sb-test-auth-token-flow-2222-code-verifier', value: 'b' },
      { name: 'sb-test-auth-token-flows-code-verifier', value: 'c' },
      /* 지우면 안 되는 것 — 이게 사라지면 로그인이 풀린다 */
      { name: 'sb-test-auth-token.0', value: 'keep' },
    ].map((cookie) => ({ ...cookie, url: 'http://localhost:3000' })),
  );

  await page.goto('/auth/callback?error=access_denied');
  await expect(page).toHaveURL(/\/auth\/denied$/);

  const left = (await context.cookies()).map((cookie) => cookie.name);
  expect(left.filter((name) => name.endsWith('-code-verifier'))).toEqual([]);
  expect(left).toContain('sb-test-auth-token.0');
});

test('사주 계산은 로그인 없이 열리고 궁합은 로그인으로 이어진다', async ({ page }) => {
  await page.goto('/');

  /*
    헤더 오른쪽 끝은 **세션을 보고 정해진다**(`SiteHeader`). 로그인한 사람에게는
    계정 메뉴가 서므로, 세션이 없을 때 그 자리가 로그인을 권하는지도 함께 잰다 —
    한쪽만 재면 둘 중 하나가 늘 틀린 채로 지나간다.
  */
  await expect(page.getByRole('link', { name: '로그인', exact: true })).toBeVisible();
  await expect(page.getByLabel(/^(전체|설정) 메뉴$/)).toHaveCount(0);
  await expect(page.getByRole('heading', { name: '출생 정보를 입력해 주세요' })).toBeVisible();

  await page.goto('/compat');
  await expect(page).toHaveURL(/\/auth\?next=%2Fcompat/);
  await expect(page.getByRole('heading', { name: '궁합은 로그인 후 이용할 수 있습니다' })).toBeVisible();
});
