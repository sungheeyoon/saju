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

    /*
      **되돌려 놓는다.** 이 표는 전역이라 비운 채로 끝내면 다음에 도는 것이 그 상태를
      물려받는다 — 다른 파일의 손잡이가 확인을 못 남기고, 그때 그 빨간불은 무엇이
      깨졌는지 말해 주지 않는다.
    */
    scheduleBeta(scheduledEndsOn());
  });

  /**
   * **날짜를 옮기면 다시 묻고, 루프에 빠지지 않는다.**
   *
   * `/me` 는 판본과 날짜를 보고 여기로 보내는데 여기는 **판본만** 보고 돌려보냈다.
   * 날짜를 언제든 옮길 수 있게 만든 것이 그 자리에서 `/me ↔ /welcome` 루프가 됐다 —
   * 같은 질문에 두 자리가 다르게 답하고 있었던 것이다.
   */
  test('일정을 옮기면 다시 확인받고 루프에 빠지지 않는다', async ({ page, signedIn }) => {
    expect(signedIn.label).not.toBe('');
    scheduleBeta(scheduledEndsOn());

    await page.goto('/me');
    await expect(page).toHaveURL(/\/me$/);

    /* 운영자가 미룬다 — 날짜가 아니라 **줄**이 바뀌므로, 같은 날짜로 연락처만 고쳐도 같다 */
    scheduleBeta('2026-12-31');

    await page.goto('/me');
    await expect(page).toHaveURL(/\/welcome$/);
    await expect(page.getByText(asKoreanDay('2026-12-31'), { exact: false })).toBeVisible();

    /* 다시 확인하면 돌아온다 — 여기서 루프면 이 줄이 타임아웃으로 죽는다 */
    await page.getByRole('button', { name: '확인하고 시작하기' }).click();
    await expect(page).toHaveURL(/\/me$/);

    /* 되돌려 둔다 — 뒤에 도는 시험이 이 표를 본다 */
    scheduleBeta(scheduledEndsOn());
  });

  /**
   * **종료일이 지나면 저절로 닫힌다.** 날짜가 적혀만 있고 집행되지 않으면 「10월 31일에
   * 끝납니다」는 지키는 것이 없는 문장이다.
   */
  test('종료일이 지나면 내 사주가 끝났다고 말한다', async ({ page, signedIn }) => {
    expect(signedIn.label).not.toBe('');
    scheduleBeta('2020-01-01');

    await page.goto('/me');

    /* 그리는 것이 아니라 튕긴다 — 관문 셋이 다 `proxy.ts` 로 옮겨 갔다 */
    await expect(page).toHaveURL(/\/closed$/);
    await expect(page.getByRole('heading', { name: '비공개 테스트가 끝났습니다' })).toBeVisible();
    await expect(page.getByRole('button', { name: '사주풀이 받기' })).toHaveCount(0);

    /* 끝나도 나가는 길은 열려 있다 */
    await page.goto('/me/settings');
    await expect(page).toHaveURL(/\/me\/settings$/);
    await expect(page.getByRole('heading', { name: '계정 관리' })).toBeVisible();

    scheduleBeta(scheduledEndsOn());
  });

  /**
   * **끝나지 않았는데 끝났다고 말하지 않는다.**
   *
   * 이 주소는 링크 하나로 아무 때나 열 수 있다. 안 물으면 「끝났습니다」가 거짓말이 된다.
   */
  test('아직 안 끝났으면 끝났다는 화면은 열리지 않는다', async ({ page, signedIn }) => {
    expect(signedIn.label).not.toBe('');
    scheduleBeta(scheduledEndsOn());

    await page.goto('/closed');
    await expect(page).toHaveURL(/\/me$/);
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

  /**
   * **관문 둘이 이어 설 때도 화면이 선다.**
   *
   * 위 시험의 사람은 이름이 있어서 안내를 지나면 `/me` 에 멈춘다. 실제로 처음 오는
   * 사람은 이름이 없어 거기서 한 번 더 `/me/profile` 로 보내지고, **그 두 번째 튕김에서
   * 화면이 빈 적이 있다** — 사람이 직접 새로고침해야 나왔다.
   *
   * 그래서 재는 것은 주소가 아니라 **글자**다. 주소만 보면 튕김은 끝났는데 아무것도
   * 안 그려진 상태를 통과시킨다 — 그게 정확히 그때 일어난 일이었다.
   */
  test('이름이 없는 사람은 안내를 지나 이름 짓는 화면까지 이어서 선다', async ({
    page,
    newcomerBare,
  }) => {
    expect(newcomerBare.email).not.toBe('');
    scheduleBeta(scheduledEndsOn());

    await page.goto('/welcome');
    await page.getByRole('button', { name: '확인하고 시작하기' }).click();

    await expect(page).toHaveURL(/\/me\/profile$/);
    await expect(page.getByRole('heading', { name: '어떻게 불러 드릴까요' })).toBeVisible();
    await expect(page.getByLabel('닉네임')).toBeVisible();
  });
});
