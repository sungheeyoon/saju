import { expect, test, scheduleBeta, scheduledEndsOn } from './session';

import { NOTICE_NOT_READY, asKoreanDay } from '@/src/lib/consent';

/**
 * 안내 관문 — **날짜 하나가 시작을 막고 있다.**
 *
 * 보유기간을 말할 수 없는 안내는 안내가 아니다. 「추후 종료 예정」으로 메우면 그 문장이
 * 지키는 것이 없고, 그때 우리는 알린 적 없는 것을 알렸다고 여기게 된다. 그래서 종료일이
 * 없으면 **아무도 못 지나간다** — 못 지나가는 것이 그 값을 잊지 않게 하는 유일한 장치다.
 *
 * 일정이 표에 있으므로 **둘 다 잰다.** 비운 채로 열면 못 지나가고, 넣고 열면 지나간다.
 * 코드 상수였을 때는 뒤의 시험이 건너뛰어졌다 — 소스를 고쳐야 켜졌기 때문이다.
 */
/* 전역 상태를 두고 다투므로 이 파일 안에서도 줄을 세운다 */
test.describe.configure({ mode: 'serial' });

test.describe('시작하기 전에', () => {
  test('처리방침은 로그인 없이 열린다', async ({ page }) => {
    await page.goto('/privacy');

    /*
      초대 메일에 이 주소를 싣는다. 로그인해야 읽을 수 있으면 「가입하기 전에 무엇을
      주는지 알고 정한다」가 성립하지 않는다.
    */
    await expect(page.getByRole('heading', { name: '개인정보 처리방침' })).toBeVisible();
    await expect(page).toHaveURL(/\/privacy$/);
  });

  test('안내를 안 본 사람은 내 사주로 못 간다', async ({ page, newcomerRaw }) => {
    expect(newcomerRaw.email).not.toBe('');

    await page.goto('/me');

    /* 화면은 길을 가리키고, 막는 일은 DB 가 한다(`create_self_person`) */
    await expect(page).toHaveURL(/\/welcome$/);
    await expect(page.getByRole('heading', { name: /무엇을 받고 언제까지/ })).toBeVisible();
  });

  test('종료일이 없으면 아무도 지나갈 수 없다', async ({ page, newcomerRaw }) => {
    expect(newcomerRaw.email).not.toBe('');
    scheduleBeta(null);

    await page.goto('/welcome');

    await expect(page.getByText(NOTICE_NOT_READY)).toBeVisible();
    await expect(page.getByRole('button', { name: '확인하고 시작하기' })).toHaveCount(0);

    /* 처리방침도 같은 말을 한다 — 두 화면이 같은 자료를 쓴다 */
    await page.goto('/privacy');
    await expect(page.getByText(NOTICE_NOT_READY)).toBeVisible();
  });

  test('안내를 확인하면 시작할 수 있다', async ({ page, newcomerRaw }) => {
    expect(newcomerRaw.email).not.toBe('');
    scheduleBeta(scheduledEndsOn());

    await page.goto('/welcome');

    /*
      **날짜가 문장 안에 실제로 서 있어야 한다** — 그것이 이 화면이 있는 이유다.
      「파기합니다」 같은 낱말로 재면 날짜 없이도 지나가는 문장이 통과한다.
    */
    await expect(page.getByText(asKoreanDay(scheduledEndsOn()), { exact: false })).toBeVisible();

    /*
      **선택은 꺼진 채로 열린다.** 미리 켜 두면 고른 것이 아니라 안 끈 것이 되고,
      그것을 동의라고 부를 수 없다.
    */
    const improvement = page.getByRole('checkbox', { name: /풀이 개선/ });
    const contact = page.getByRole('checkbox', { name: /다음 테스트 안내/ });
    await expect(improvement).not.toBeChecked();
    await expect(contact).not.toBeChecked();

    await improvement.check();
    await page.getByRole('button', { name: '확인하고 시작하기' }).click();

    /* 지나오면 온보딩이다 — 이 사람은 아직 사주를 안 넣었다 */
    await expect(page).toHaveURL(/\/me$/);
    await expect(page.getByRole('heading', { name: '내 사주 등록' })).toBeVisible();

    /* 다시 열어도 안 묻는다 — 한 번만 확인하면 된다 */
    await page.goto('/welcome');
    await expect(page).toHaveURL(/\/me$/);
  });
});
