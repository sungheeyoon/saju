import {
  answerReading,
  expect,
  leavePersonSlots,
  makeOperator,
  personLimit,
  sql,
  test,
} from './session';

import { chartOf } from '@/src/lib/input/chart';
import { DEFAULT_QUERY } from '@/src/lib/input/query';
import { CHART_ENGINE_VERSION, chartSnapshotOf } from '@/src/lib/saju';
import { DISCOVERY_POLICY } from '@/src/lib/discovery';
import { PROMPT_VARIANTS } from '@/src/lib/reading';

import { PRICE_STEM, PRICE_SUBJECT_LABEL, QUESTION, SURVEY_COPY } from '@/src/lib/survey';

import { expectBirthDate, fillBirthDate, fillBirthTime } from './birth-form';
import { hydrated } from './hydrated';
import { expectTargets, focusedOutline } from './target';
import type { Page } from '@playwright/test';

/** 익명 파일에서 함께 옮겨 온 손잡이 — 그 시험이 쓰던 것과 같은 값이다 */
const sharedParams = (page: Page) =>
  new URLSearchParams(new URL(page.url()).hash.slice(1));

/**
 * 계산기가 **붙을 때까지** 기다린다 — 폼에 적기 전에 한 번.
 *
 * `/` 는 미리 그려지고 계산기는 `Suspense` 뒤에서 따로 붙는다. 붙기 전에 칸을 채우면
 * React 가 자기 상태(빈 값)로 되돌리고, 시험은 「이름을 입력해 주세요」를 만난다.
 *
 * **신호가 버튼에서 그 아래 한 줄로 옮겼다.** 전에는 버튼 글자가 세션을 말했다 —
 * 미리 그려진 HTML 은 「내 사주 먼저 살펴보기」, 회원은 「사주 보기」. 이제 버튼은
 * 양쪽 다 「사주 보기」이고(`saju-calculator.tsx`), 세션으로 갈리는 것은 **비로그인
 * 안내 한 줄**이다. 미리 그려진 HTML 은 그 줄을 들고 오므로, 그 줄이 사라진 것이 곧
 * 계산기가 붙어 세션 통로를 읽었다는 뜻이다(`signed-in.tsx`).
 */
async function submitReady(page: Page) {
  await expect(page.getByRole('button', { name: '사주 보기' })).toBeVisible();
  await expect(page.getByText('로그인 없이 사주와 오행을 확인할 수 있어요')).toHaveCount(0);
}

/** 화면 크기가 달라도 풀이권은 계정 자리에서 찾을 수 있어야 한다. */
async function expectReadingCredits(page: Page, label: string) {
  const header = page.getByRole('banner');
  await expect(header.getByText(label, { exact: true })).toBeVisible();
}

/**
 * 로그인한 사람의 세로 흐름 — **브라우저에서.**
 *
 * 흐름 검사(`scripts/check-*.mjs`)가 이미 같은 길을 지나지만 그쪽은 HTTP 로 본문을
 * 받아 글자를 센다. 그래서 못 재는 것이 셋이다.
 *
 * 1. **누르는 것이 실제로 도는가** — 온보딩 저장도 사람 추가도 클라이언트 컴포넌트다.
 *    본문을 받아 보는 검사에는 그 버튼을 누를 손이 없다.
 * 2. **모바일 화면에서도 같은가** — `prd-archive` 가 데스크톱과 모바일 둘 다를 요구한다.
 * 3. **다시 그려지는가** — Server Action 뒤의 `router.refresh()` 는 브라우저에만 있다.
 *
 * 반대로 여기서 재지 않는 것도 분명하다. 권한·RLS·판본 수명주기는 pgTAP 이 재고,
 * RPC 응답의 모양은 흐름 검사가 잰다. 같은 것을 세 층에서 세 번 재면 한 층을 고칠
 * 때마다 세 곳이 깨진다.
 */

test.describe('초대된 사람의 로그인 흐름', () => {
  test('모바일은 탭 넷을 하단 독에 보이고 나머지 길은 종과 톱니에 둔다', async ({
    page,
    signedIn,
  }, testInfo) => {
    test.skip(!testInfo.project.name.includes('mobile'));
    expect(signedIn.label).not.toBe('');
    await page.goto('/me');

    const mobileNav = page.getByRole('navigation', { name: '모바일 내 메뉴' });
    await expect(mobileNav).toBeVisible();

    const viewportWidth = page.viewportSize()?.width ?? 0;
    // 탭 넷(2026-09-24, 5차) — 넷이 폰 폭에 다 서는지도 여기서 잰다
    for (const label of ['홈', '매칭', '풀이', '채팅']) {
      const link = mobileNav.getByRole('link', { name: label, exact: true });
      await expect(link).toBeVisible();
      const box = await link.boundingBox();
      expect(box?.x).toBeGreaterThanOrEqual(0);
      expect((box?.x ?? viewportWidth) + (box?.width ?? 0)).toBeLessThanOrEqual(viewportWidth);
    }
    await expect(mobileNav.getByRole('link', { name: '홈', exact: true })).toHaveAttribute('aria-current', 'page');

    /* 소식은 머리글의 종 — 탭에서 빠져도 1클릭이다 */
    const banner = page.getByRole('banner');
    await expect(banner.getByRole('link', { name: /^소식/ })).toHaveAttribute('href', '/me/requests');

    const mobileCredit = banner.getByText('풀이권 5번 중 5번 남음', { exact: true });
    const settingsMenu = page.getByLabel('설정 메뉴');
    await expect(mobileCredit).toBeVisible();
    const creditBox = await mobileCredit.boundingBox();
    const menuBox = await settingsMenu.boundingBox();
    expect((creditBox?.x ?? 0) + (creditBox?.width ?? 0)).toBeLessThanOrEqual(menuBox?.x ?? 0);
    /* 머리글도 폰 폭을 안 넘는다 */
    expect((menuBox?.x ?? viewportWidth) + (menuBox?.width ?? 0)).toBeLessThanOrEqual(viewportWidth);

    await settingsMenu.click();
    for (const [name, href] of [
      ['프로필', '/me/profile'],
      ['계정 관리', '/me/settings'],
      ['서비스 설문', '/me/survey'],
    ] as const) {
      await expect(banner.getByRole('link', { name, exact: true })).toHaveAttribute('href', href);
    }
    await expect(banner.getByRole('button', { name: '로그아웃' })).toBeVisible();
    await expect(page.getByRole('link', { name: '사주 보기', exact: true })).toHaveCount(0);
    await expect(page.getByRole('link', { name: '인연 설정', exact: true })).toHaveCount(0);
  });

  test('로그아웃이 실패하면 톱니 판이 열린 채로 그 까닭을 말한다', async ({ page, signedIn }) => {
    expect(signedIn.label).not.toBe('');
    /*
      실패 문장은 톱니 판(`<details>`) 안에 선다. 누르자마자 판을 닫던 동안에는 문장이 닫힌 판 안에 서서
      아무에게도 안 보였다 — 로그아웃은 조용히 안 된 채로 끝났다(2026-09-26).
    */
    await page.route('**/auth/v1/logout**', (route) =>
      route.fulfill({ status: 500, contentType: 'application/json', body: '{"message":"unavailable"}' }),
    );
    await page.goto('/me');

    const banner = page.getByRole('banner');
    await page.getByLabel('설정 메뉴').click();
    await banner.getByRole('button', { name: '로그아웃' }).click();

    await expect(banner.getByRole('alert')).toHaveText('로그아웃하지 못했습니다. 다시 시도해 주세요.');
    await expect(banner.getByRole('button', { name: '로그아웃' })).toBeEnabled();
    await expect(page).toHaveURL(/\/me$/);
  });

  test('계정 관리의 로그아웃도 실패하면 그 자리에서 말하고, 되면 첫 화면으로 나간다', async ({ openAs }) => {
    /*
      서버 액션이던 동안에는 `signOut()` 의 오류를 버리고 첫 화면으로 보냈다 — 세션이 남아도 나간 것처럼 보였다.
      톱니 판과 같은 한 벌(`useSignOut`)을 부른다. 새 사람으로 연다 — 성공한 로그아웃은 그 계정의 세션을 닫는다.
    */
    const { page } = await openAs({ selfPerson: true });
    await page.route('**/auth/v1/logout**', (route) =>
      route.fulfill({ status: 500, contentType: 'application/json', body: '{"message":"unavailable"}' }),
    );
    await page.goto('/me/settings');

    const account = page.getByRole('main');
    await account.getByRole('button', { name: '로그아웃' }).click();
    await expect(account.getByRole('alert')).toHaveText('로그아웃하지 못했습니다. 다시 시도해 주세요.');
    await expect(page).toHaveURL(/\/me\/settings$/);

    await page.unroute('**/auth/v1/logout**');
    await account.getByRole('button', { name: '로그아웃' }).click();
    await expect(page).toHaveURL(/\/$/);
    await page.goto('/me');
    await expect(page).toHaveURL(/\/auth/);
  });

  test('톱니 판은 Esc 로 닫히고 초점이 톱니로 돌아온다 — 바깥을 눌러도 닫힌다', async ({ page, signedIn }) => {
    expect(signedIn.label).not.toBe('');
    await page.goto('/me');

    const banner = page.getByRole('banner');
    const gear = page.getByLabel('설정 메뉴');
    const profile = banner.getByRole('link', { name: '프로필', exact: true });

    await gear.click();
    await expect(profile).toBeVisible();
    await profile.focus();
    await page.keyboard.press('Escape');
    await expect(profile).toBeHidden();
    await expect(gear).toBeFocused();

    await gear.click();
    await expect(profile).toBeVisible();
    await page.mouse.click(5, 300);
    await expect(profile).toBeHidden();
  });

  test('온보딩에서 내 사주를 저장하면 그 자리에서 저장된 명식으로 바뀐다', async ({
    page,
    newcomer,
  }) => {
    await page.goto('/me');

    // 아직 selfPerson 이 없다 — 화면은 계산 결과가 아니라 등록 폼이다.
    await expect(page.getByRole('heading', { name: '내 사주 등록' })).toBeVisible();

    await expect(page.getByLabel('이름')).toHaveCount(0);
    await expect(page.getByText(`${newcomer.label} 님의 출생 정보를 입력해 주세요.`)).toBeVisible();
    await fillBirthDate(page, '1990-05-15');
    await fillBirthTime(page, '14:30');

    const save = page.getByRole('button', { name: '내 사주로 저장' });
    await expect(save).toBeEnabled();
    await save.click();

    // 저장하면 폼이 사라지고 저장된 입력이 선다. 미리 계산해 보여준 값이 아니다.
    await expect(page.getByRole('heading', { name: '내 사주 등록' })).toBeHidden();
    await expect(page.getByText('1990-05-15')).toBeVisible();
  });

  test('홈의 내 사주와 사주풀이는 다른 화면이고 풀이 화면을 여는 것만으로 만들지 않는다', async ({
    page,
    signedIn,
  }) => {
    await page.goto('/me');

    /* 홈의 내 카드 — 여덟 글자와 저장된 출생 정보, 고치는 손잡이, 상세로 가는 길 */
    const mine = page.getByRole('region', { name: '내 사주' });
    await expect(mine.getByRole('heading', { name: signedIn.label, exact: true })).toBeVisible();
    const glyphs = mine.getByRole('list', { name: '여덟 글자' });
    await expect(glyphs.getByRole('listitem')).toHaveCount(4);
    await expect(glyphs.getByLabel(/^일주 /)).toBeVisible();
    await expect(mine.getByText('1990-05-15 14:30')).toBeVisible();
    await expect(mine.getByRole('button', { name: '출생 정보 수정' })).toBeVisible();
    await expect(mine.getByRole('link', { name: /사주 자세히 보기/ })).toHaveAttribute(
      'href',
      `/me/people/${signedIn.selfPersonId}`,
    );

    /* 풀이는 홈에 안 선다 — 받는 길만 서고, 그 길은 풀이 화면이다 */
    await mine.getByRole('link', { name: /사주풀이 받기/ }).click();

    await expect(page).toHaveURL(/\/me\/readings\/self$/);
    await expect(page.getByRole('heading', { name: '내 사주풀이', exact: true }).first()).toBeVisible();
    await expect(page.getByText('아직 받아 둔 사주풀이가 없습니다')).toBeVisible();
    await expect(page.getByRole('button', { name: '사주풀이 받기' })).toBeVisible();
    await expect(page.getByText('사주 자세히 보기')).toHaveCount(0);
    await expect(page.getByRole('heading', { name: '사주팔자' })).toHaveCount(0);
    /* 풀이 화면에는 사주/사주풀이 탭이 없다 — 두 자리는 각 화면의 입구에서 연다 */
    await expect(page.getByRole('navigation', { name: '내 사주의 사주와 사주풀이' })).toHaveCount(0);

    /*
      **풀이권은 머리글에 선다 — 설정 옆이다.**

      한동안 만드는 버튼과 한 덩어리였다. 「누를지 정할 때 눈이 가 있는 자리」라는
      이유였고 그건 지금도 맞다. 그런데 풀이권은 이 글의 성질이 아니라 **계정의 성질**
      이라, 화면마다 세우면 넷에 같은 숫자가 네 번 서고 그중 하나를 안 고치는 날이 온다.

      그래서 「있다」가 아니라 **머리글 안에 있다**를 잰다. 본문 어딘가로 돌아가면
      이 줄이 빨개진다.
    */
    await expectReadingCredits(page, '풀이권 5번 중 5번 남음');

    /* 처음 받을 때도 풀이권을 쓰기 전에 확인한다. 취소하면 생성은 시작되지 않는다. */
    await page.getByRole('button', { name: '사주풀이 받기' }).click();
    const asking = page.getByRole('dialog');
    await expect(asking).toBeVisible();
    await expect(asking.getByText('풀이권 1회가 사용됩니다', { exact: false })).toBeVisible();
    await expect(asking.getByText('이전 것은 남기지 않습니다', { exact: false })).toHaveCount(0);
    await asking.getByRole('button', { name: '그만두기' }).click();
    await expect(asking).toBeHidden();
    await expect(page.getByText('풀이 만드는 중…')).toHaveCount(0);
    await expectReadingCredits(page, '풀이권 5번 중 5번 남음');

    // 다시 열어도 만들어지지 않는다 — 같은 자리에 같은 문장이 그대로 선다.
    await page.reload();
    await expect(page.getByText('아직 받아 둔 사주풀이가 없습니다')).toBeVisible();
  });

  /**
   * **홈의 관계 지도와 사람 타일** — 저장한 사람이 둘 다에 서고, 타일이 그 사람의 길을 전부 든다.
   *
   * 나와 궁합을 아직 안 봤으면 궁합 화면으로 가되 **두 칸이 찬 채로**(`a.person` · `b.person`) 간다.
   * 지도의 원을 누르면 작은 카드가 열리고, 그 카드도 같은 세 길을 든다.
   */
  test('홈은 저장한 사람을 지도와 타일에 세우고 원을 누르면 그 사람의 길이 열린다', async ({ page, signedIn }, testInfo) => {
    await page.goto('/me');

    const tile = page.locator('li[id^="person-"]').filter({ has: page.getByRole('link', { name: '어머니', exact: true }) });
    const detail = await tile.getByRole('link', { name: '어머니', exact: true }).getAttribute('href');
    const personId = (detail ?? '').replace('/me/people/', '');
    expect(personId).not.toBe('');
    await expect(tile.getByRole('link', { name: '풀이 받기' })).toHaveAttribute('href', `/me/readings/${personId}`);
    await expect(tile.getByRole('link', { name: '나와 궁합' })).toHaveAttribute(
      'href',
      `/compat#a.person=${signedIn.selfPersonId}&b.person=${personId}`,
    );
    await expect(page.getByRole('link', { name: '전체 관리' })).toHaveAttribute('href', '/me/people');

    const map = page.getByRole('region', { name: '관계 지도' });
    const dot = map.getByRole('link', { name: /^어머니, 일간/ });
    await expect(dot).toHaveAttribute('href', `#person-${personId}`);
    await dot.click();
    await expect(dot).toHaveAttribute('aria-expanded', 'true');
    await expect(map.getByRole('link', { name: '자세히' })).toHaveAttribute('href', `/me/people/${personId}`);
    await expect(map.getByRole('link', { name: '나와 궁합' })).toHaveAttribute(
      'href',
      `/compat#a.person=${signedIn.selfPersonId}&b.person=${personId}`,
    );
    /* 누른 자리에서 주소가 안 바뀐다 — 자바스크립트가 돌면 카드가 열리는 것이 전부다 */
    await expect(page).toHaveURL(/\/me$/);
    await map.getByRole('button', { name: '닫기' }).click();
    await expect(map.getByRole('link', { name: '자세히' })).toHaveCount(0);

    /* 홈을 떠나는 길 셋 — 메뉴에서 빠진 「사주·궁합」의 길이 여기 선다 */
    const more = page.getByRole('navigation', { name: '더 해 보기' });
    await expect(more.getByRole('link', { name: '다른 사람 사주 보기' })).toHaveAttribute('href', '/');
    await expect(more.getByRole('link', { name: '궁합 보러 가기' })).toHaveAttribute('href', '/compat');
    await expect(more.getByRole('link', { name: /매칭에서 오늘의 인연 만나기/ })).toHaveAttribute('href', '/me/matching');

    /*
      **초점 테두리는 타일이 두른 한 겹이다.** 이름 링크의 `::after` 가 타일 전체를 덮고 초점도 그
      자리에 두른다 — 링크 자신은 `outline-none` 이다. 전역 테두리가 층 밖에 있을 때는 그것을 눌러
      이름 글자 둘레에 한 겹이 더 섰다(2026-09-25 운영에서 잰 것). 사람 화면의 타일도 같은 모양이다.
    */
    for (const at of ['/me', '/me/people']) {
      await page.goto(at);
      const name = page.getByRole('main').getByRole('link', { name: '어머니', exact: true }).first();
      const focused = await focusedOutline(name);
      expect.soft(focused.own, `${at} 이름 링크`).toBe('none');
      expect.soft(focused.after, `${at} 타일 테두리`).toBe('solid');
    }

    /* 넓은 화면의 머리글 탭 넷 — 칸이 40px 이었다 */
    if (testInfo.project.name.includes('desktop')) {
      const nav = page.getByRole('navigation', { name: '내 메뉴' });
      await expectTargets(
        Object.fromEntries(
          ['홈', '매칭', '풀이', '채팅'].map((label) => [
            label,
            nav.getByRole('link', { name: new RegExp(`^${label}`) }),
          ]),
        ),
      );
    }
  });

  /**
   * **내 명식 화면에는 이 칸이 없다.**
   *
   * 목록은 selfPerson 을 걸러 내지만 이 주소는 열린다. 칸을 세우면 같은 명식에 글이
   * 둘 서고 같은 자료로 풀이권이 두 번 나간다. 막는 것은 DB 이고, 화면은 그 자리에
   * 어디로 가면 되는지를 세운다 — 못 만드는 버튼을 눌러야 알게 하지 않는다.
   */
  test('내 사주를 저장한 사람 주소로 열어도 자기 풀이 탭으로 간다', async ({
    page,
    signedIn,
  }) => {
    expect(signedIn.label).not.toBe('');

    /* 화면 안에는 이리 오는 링크가 없다 — 목록이 selfPerson 을 걸러 내므로 주소로 연다 */
    await page.goto(`/me/people/${signedIn.selfPersonId}`);
    await expect(
      page.getByRole('heading', { name: `${signedIn.label}의 사주`, exact: true }),
    ).toBeVisible();

    await expect(page.getByRole('button', { name: '사주풀이 받기' })).toHaveCount(0);
    const tabs = page.getByRole('navigation', { name: '내 사주의 사주와 사주풀이' });
    await tabs.getByRole('link', { name: '사주풀이', exact: true }).click();

    await expect(page).toHaveURL(/\/me\/readings\/self$/);
    await expect(page.getByRole('heading', { name: '내 사주풀이', exact: true }).first()).toBeVisible();
  });

  /**
   * **대문자로 적은 주소도 같은 답을 받는다.**
   *
   * `uuid` 비교도 주소 검사 정규식도 대소문자를 안 가리므로 이 주소는 조회를 지나간다.
   * 그런데 화면의 「이게 내 selfPerson 인가」는 문자열 비교라 가린다 — 주소에 적힌
   * 글자를 그대로 들고 견주면 거짓이 되고, 그때 못 만드는 버튼이 선다.
   *
   * DB 는 그래도 거절하므로 안전은 지켜진다. 여기서 재는 것은 **화면의 약속**이다:
   * 못 만드는 버튼을 애초에 안 보여 준다.
   */
  test('대문자로 적은 내 명식 주소도 풀이 칸을 세우지 않는다', async ({ page, signedIn }) => {
    const shouted = (signedIn.selfPersonId as string).toUpperCase();
    expect(shouted).not.toBe(signedIn.selfPersonId);

    await page.goto(`/me/people/${shouted}`);

    /* 조회 자체는 지나간다 — 그래서 이 시험이 뜻이 있다 */
    await expect(
      page.getByRole('heading', { name: `${signedIn.label}의 사주`, exact: true }),
    ).toBeVisible();

    await expect(page.getByRole('button', { name: '사주풀이 받기' })).toHaveCount(0);
    await expect(
      page.getByRole('navigation', { name: '내 사주의 사주와 사주풀이' })
        .getByRole('link', { name: '사주풀이', exact: true }),
    ).toHaveAttribute('href', '/me/readings/self');
  });

  /** 저장된 글이 그 사람의 화면에 실제로 서는가 — 위 시험은 빈 자리까지만 본다 */
  test('저장한 사람의 풀이는 그 사람의 화면에서 읽힌다', async ({ page, personReader }) => {
    await page.goto('/me/people');

    /* 목록 카드가 글의 유무를 알고, 이미 만든 사람에게는 만드는 길을 다시 내지 않는다. */
    const personCard = page
      .locator('section')
      .filter({ has: page.getByRole('heading', { name: '어머니' }) });
    const readingLink = personCard.getByRole('link', { name: /사주풀이 보기/ });
    await expect(readingLink).toHaveAttribute(
      'href',
      `/me/readings/${personReader.personId}`,
    );
    await readingLink.click();

    await expect(page.getByRole('heading', { name: '어머니의 사주풀이' })).toBeVisible();

    /* 풀이 전용 페이지에는 글만 선다 — 명식으로 가는 탭도 없다 */
    await expect(page.getByText('어머니의 결')).toBeVisible();
    await expect(page.getByText('사주 자세히 보기')).toHaveCount(0);
    await expect(page.getByRole('heading', { name: '사주팔자' })).toHaveCount(0);
    await expect(page.getByRole('navigation', { name: '어머니의 사주와 사주풀이' })).toHaveCount(0);

    /* 한 사람짜리라 궁합 점수가 안 선다 */
    await expect(page.getByText('궁합풀이 점수')).toBeHidden();

    /*
      **점수가 없어도 비유는 선다.** 그 칸은 둘 중 하나만 있어도 열린다 — 자기 풀이와
      저장한 사람 풀이에는 점수가 없고 비유만 있다.

      길게 심어 둔 문장을 그대로 잰다. 화면이 줄여 쓰거나 자르면 여기서 걸린다. **`exact` 로 글의 표지만
      잡는다** — 넓은 화면에서는 옆 칸 책장의 표지도 같은 비유를 따옴표에 넣어 든다(거기서는 잘려도 된다).
    */
    await expect(
      page.getByText('서로 다른 속도로 달리던 두 사람이 같은 자전거를 타고 오르막길을 오르는 모습이에요.', {
        exact: true,
      }),
    ).toBeVisible();

    /* 만든 것이 하나이므로 풀이권도 하나 줄어 있다 — kind 를 안 묻는다 */
    await expectReadingCredits(page, '풀이권 5번 중 4번 남음');
  });

  /**
   * **설문을 실제로 눌러 본다.**
   *
   * 흐름 검사(`check-reading.mjs`)가 이미 같은 화면을 받아 글자를 세지만 그쪽은 JS 를
   * 안 돌린다. 그래서 못 재는 것이 이 시험의 전부다 — 라디오가 눌리는가, 다 안 고르면
   * 막히는가, **보낸 뒤에 고맙다는 화면으로 바뀌는가**, 그리고 새로고침하고 돌아와도
   * 그 상태로 열리는가.
   *
   * 마지막 둘이 갈린다. 보낸 직후의 화면은 이 컴포넌트가 스스로 바꾸고, 새로고침 뒤의
   * 화면은 서버가 내려준 값(`my_feedback`)으로 선다. 둘 중 하나만 되면 「보냈는데
   * 사라졌다」나 「보냈다고 하는데 다시 물어본다」가 된다.
   */
  test('읽은 글 아래에서 설문을 보내면 그 자리에서 고맙다고 하고, 다시 열어도 그대로다', async ({
    page,
    reader,
  }) => {
    expect(reader.runId).not.toBe('');
    await page.goto('/me/readings/self');

    /**
     * **풀이 화면은 글을 다시 접지 않는다**(ADR 0055). 이 주소로 온 사람은 그 글을
     * 읽으러 온 것이라, 전문도 그 아래 설문도 펴는 걸음 없이 바로 선다. 접는 자리는
     * `/me` 의 카드였고 그 카드는 이제 명식 화면의 것이다.
     */
    await expect(page.getByRole('button', { name: '자세히 보기', exact: true })).toHaveCount(0);
    await expect(page.getByText('브라우저가 읽을 글입니다')).toBeVisible();
    await expect(page.getByText('이 풀이는 어떠셨어요')).toBeVisible();

    /* **세 가지를 다 고르기 전에는 못 보낸다** — 안 고른 것이 어느 값으로든 저장되면 안 된다 */
    const send = page.getByRole('button', { name: '의견 보내기' });
    await expect(send).toBeDisabled();

    await page.getByRole('radio', { name: '5 — 많이 됐어요' }).check();
    await expect(send).toBeDisabled();
    await page.getByRole('radio', { name: '1 — 많이 달라요' }).check();
    await expect(send).toBeDisabled();
    await page.getByRole('radio', { name: '길어요' }).check();
    await expect(send).toBeEnabled();

    await page.getByRole('checkbox', { name: '너무 추상적이에요' }).check();
    await page
      .getByLabel('어느 대목이 맞았고 어느 대목이 달랐나요?')
      .fill('첫 문단은 맞았고 마지막은 달랐어요');

    await send.click();

    await expect(page.getByText('답해 주셔서 고맙습니다')).toBeVisible();
    await expect(page.getByText('이 풀이는 어떠셨어요')).toBeHidden();

    /*
      **다시 열면 서버가 내려준 값으로 선다.** 위의 화면은 컴포넌트가 스스로 바꾼
      것이라, 새로고침을 안 해 보면 저장이 실제로 됐는지 이 시험이 한 번도 못 잰다.
    */
    await page.reload();
    await expect(page.getByText('답해 주셔서 고맙습니다')).toBeVisible();

    /* **고치는 화면은 빈 칸으로 열리지 않는다** — 빈 칸이면 다시 보낼 때 적은 글이 지워진다 */
    await page.getByRole('button', { name: '답 고치기' }).click();
    await expect(page.getByRole('radio', { name: '5 — 많이 됐어요' })).toBeChecked();
    await expect(page.getByRole('radio', { name: '길어요' })).toBeChecked();
    await expect(page.getByRole('checkbox', { name: '너무 추상적이에요' })).toBeChecked();
    await expect(page.getByLabel('어느 대목이 맞았고 어느 대목이 달랐나요?')).toHaveValue(
      '첫 문단은 맞았고 마지막은 달랐어요',
    );
  });

  /**
   * **서비스 설문은 탭에서 언제든 열린다**(ADR 0062).
   *
   * 흐름 검사가 화면을 받아 글자를 세지만 여기서만 재는 것이 셋이다.
   *
   * 1. **읽어 본 종류만 값을 묻는가** — `reader` 는 자기 풀이만 읽었으므로 궁합 값 문항이
   *    서면 안 된다. 안 써 본 것의 값은 값이 아니라 인상이다
   * 2. **단독 항목이 나머지를 푸는가** — 「특별히 없었어요」와 「내 사주풀이」가 함께 서면
   *    그 답은 아무 뜻이 없다. 서버도 그것을 거절하므로 화면이 안 막으면 제출이 죽는다
   * 3. **쓰던 답이 자동으로 남는가** — 새로고침 뒤에도 그대로 열려야 자동 저장이 한 일이다
   */
  test('서비스 설문은 읽은 종류만 값을 묻고, 쓰던 답이 남았다가 제출된다', async ({
    page,
    reader,
  }) => {
    expect(reader.runId).not.toBe('');
    await page.goto('/me');

    /* 길은 폰이든 넓은 화면이든 톱니 안에 든다 — 탭에서는 빠졌다(5차) */
    await page.getByLabel('설정 메뉴').click();
    await page
      .getByRole('link', { name: SURVEY_COPY.tab, exact: true })
      .first()
      .click();

    await expect(page.getByRole('heading', { name: SURVEY_COPY.title })).toBeVisible();

    /*
      **읽어 본 종류만 값을 묻는다** — `reader` 는 궁합을 읽지 않았다.

      묻는 문장(`PRICE_STEM`)은 한 번만 서고 상품 이름이 칸마다 선다. 상품마다 온전한
      문장을 세웠더니 같은 질문이 두 번 서 있는 것으로 읽혔다.
    */
    await expect(page.getByText(PRICE_STEM)).toBeVisible();
    await expect(page.getByRole('group', { name: PRICE_SUBJECT_LABEL.solo })).toBeVisible();
    await expect(page.getByRole('group', { name: PRICE_SUBJECT_LABEL.pair })).toHaveCount(0);

    const liked = page.getByRole('group', { name: QUESTION.liked });
    await liked.getByRole('checkbox', { name: '내 사주풀이', exact: true }).check();
    await liked.getByRole('checkbox', { name: '특별히 없었어요', exact: true }).check();

    /* 단독 항목을 누르면 나머지가 풀린다 */
    await expect(liked.getByRole('checkbox', { name: '내 사주풀이', exact: true })).not.toBeChecked();
    await liked.getByRole('checkbox', { name: '내 사주풀이', exact: true }).check();
    await expect(
      liked.getByRole('checkbox', { name: '특별히 없었어요', exact: true }),
    ).not.toBeChecked();

    await page
      .getByRole('group', { name: PRICE_SUBJECT_LABEL.solo })
      .getByRole('radio', { name: '4,900원', exact: true })
      .check();

    /* **쓰던 답이 저절로 남는다** — 다음에 들어와 처음부터 다시 쓰지 않게 */
    await expect(page.getByText(SURVEY_COPY.draftSaved)).toBeVisible();

    await page.reload();
    await expect(
      page.getByRole('group', { name: QUESTION.liked })
        .getByRole('checkbox', { name: '내 사주풀이', exact: true }),
    ).toBeChecked();

    await page.getByRole('button', { name: SURVEY_COPY.submit }).click();
    await expect(page.getByText(SURVEY_COPY.thanks)).toBeVisible();

    /* 고치는 화면은 빈 칸으로 열리지 않는다 */
    await page.getByRole('button', { name: '답 고치기' }).click();
    await expect(
      page.getByRole('group', { name: QUESTION.liked })
        .getByRole('checkbox', { name: '내 사주풀이', exact: true }),
    ).toBeChecked();
    await expect(page.getByRole('button', { name: SURVEY_COPY.resubmit })).toBeVisible();
  });

  /**
   * **운영자 화면은 운영자에게만 있다.**
   *
   * 여기서 재는 것 둘. 하나는 **없는 화면이 되는가** — 운영자가 아닌 로그인 사용자에게
   * 이 주소는 404 다(`notFound`). pgTAP 이 함수가 거절하는 것을 이미 재지만, 거절을 받고
   * 화면이 무엇을 하는지는 여기서만 잰다: 반쪽짜리 화면이나 붉은 오류가 서면 그것은
   * 「여기 뭔가 있다」고 알려 주는 것이다.
   *
   * 다른 하나는 **남긴 답이 실제로 그 자리에 오르는가**다. 문·함수·화면이 각자 초록인데
   * 이어 보면 비어 있는 자리를 이 한 줄이 잡는다.
   */
  test('설문 요약은 운영자에게만 서고, 남긴 답이 그 자리에 오른다', async ({ page, reader }) => {
    expect(reader.runId).not.toBe('');

    const closed = await page.goto('/ops/survey');
    expect(closed?.status()).toBe(404);
    await expect(page.getByRole('heading', { name: '설문 요약' })).toHaveCount(0);

    /*
      **글에 이 실행의 표를 남긴다.** 운영자에게는 모두의 답이 보이므로, 지난 실행이
      남긴 같은 문장이 로컬 DB 에 쌓이면 「내가 방금 남긴 것이 섰는가」를 못 가린다.
    */
    const said = `셋째 문단이 제 얘기 같았어요 (${reader.runId.slice(0, 8)})`;
    answerReading(reader.runId, reader.account.email, said);
    makeOperator(reader.account.email);

    await page.goto('/ops/survey');
    await expect(page.getByRole('heading', { name: '설문 요약' })).toBeVisible();
    await expect(page.getByRole('heading', { name: '적어 주신 글' })).toBeVisible();
    await expect(page.getByText(said)).toBeVisible();

    /* 누가 썼는지는 함수가 안 내준다 — 화면에도 그 값이 설 자리가 없다 */
    await expect(page.getByText(reader.account.nickname)).toHaveCount(0);
  });

  /**
   * **되돌릴 수 없는 누름 앞에서 한 번 더 묻는다.**
   *
   * 새로 만들면 지금 글과 점수는 사라진다(ADR 0013). 그 경고가 한동안 만드는 버튼 옆에
   * **늘** 적혀 있었다 — 늘 서 있는 문장은 누르지 않을 사람에게 하는 말이고, 정작 누르는
   * 사람은 그것을 배경으로 읽고 지나간다. 이제 누른 그때 창이 뜬다.
   *
   * 흐름 검사는 그 창이 화면에 실려 왔는지까지만 잰다(JS 를 안 돌린다). **열리는가,
   * 그만두면 닫히는가, 그리고 그만둔 뒤에 아무것도 안 만들어졌는가**는 여기서만 잰다 —
   * 마지막이 이 시험의 요점이다. 확인 창이 취소를 안 지키면 걸음만 하나 는 것이 된다.
   */
  test('사주풀이 다시 받기는 확인 창을 먼저 띄우고, 그만두면 아무것도 만들지 않는다', async ({
    page,
    reader,
  }) => {
    expect(reader.runId).not.toBe('');
    /* 만드는 버튼은 풀이 화면의 것이다(ADR 0055) — `/me` 는 명식만 든다 */
    await page.goto('/me/readings/self');

    /* 있는 글 옆의 설명은 걷었다 — 버튼이 이미 자기 이름으로 말한다 */
    await expect(page.getByText('지금 풀이를 새로 받을 수 있어요')).toHaveCount(0);
    await expect(page.getByText('화면을 다시 열어도')).toHaveCount(0);

    const again = page.getByRole('button', { name: '사주풀이 다시 받기' });
    await again.click();

    /* 닫힌 `<dialog>` 는 접근성 트리에 없다 — 그래서 이 자리가 「열렸는가」를 잰다 */
    const asking = page.getByRole('dialog');
    await expect(asking).toBeVisible();
    await expect(asking.getByText('풀이권 1회가 사용됩니다', { exact: false })).toBeVisible();
    await expect(asking.getByText('이전 것은 남기지 않습니다', { exact: false })).toBeVisible();

    await asking.getByRole('button', { name: '그만두기' }).click();
    await expect(asking).toBeHidden();

    /*
      **그만두면 정말 아무 일도 없다.** 만들기가 시작됐으면 기다리는 화면으로 바뀌고
      풀이권이 하나 더 잡힌다 — 둘 다 그대로인 것으로 잰다(하나는 이미 이 글을 만들 때 썼다).
    */
    await expect(page.getByText('풀이 만드는 중…')).toHaveCount(0);
    await expectReadingCredits(page, '풀이권 5번 중 4번 남음');
    await expect(again).toBeEnabled();
  });

  /** 사람 카드의 단일 진입점이 풀이로 가고, 명식은 그 화면의 탭으로 오간다. */
  test('저장한 사람의 풀이 화면에는 탭이 없고, 명식 화면에서 풀이로 돌아온다', async ({
    page,
    signedIn,
  }) => {
    const kin = signedIn.managed[0];
    expect(kin).not.toBe(undefined);

    await page.goto('/me/people');
    await expect(page.getByText(kin).first()).toBeVisible();
    /* 목록에 관리 Person 은 이 사람 하나뿐이다 — 이어서 제목으로 누구인지 확인한다 */
    await page.getByRole('link', { name: '사주풀이 받기' }).first().click();

    await expect(page).toHaveURL(/\/me\/readings\/[0-9a-f-]+$/);
    await expect(page.getByRole('heading', { name: `${kin}의 사주풀이`, exact: true }).first()).toBeVisible();
    await expect(page.getByText('아직 받아 둔 사주풀이가 없습니다')).toBeVisible();

    await expect(page.getByRole('navigation', { name: `${kin}의 사주와 사주풀이` })).toHaveCount(0);

    /* 명식은 목록의 이름에서 열고, 명식 화면의 탭이 풀이로 돌려보낸다 */
    const readingUrl = page.url();
    await page.goto('/me/people');
    await page.getByRole('link', { name: kin, exact: true }).first().click();
    await expect(page.getByRole('heading', { name: `${kin}의 사주`, exact: true })).toBeVisible();
    await page.getByRole('link', { name: '사주풀이', exact: true }).click();
    await expect(page).toHaveURL(readingUrl);

    const make = page.getByRole('button', { name: '사주풀이 받기' });
    await expect(make).toBeVisible();

    /* 풀이권은 kind 를 안 묻는다 — 전역 다섯에서 함께 센다 */
    await expectReadingCredits(page, '풀이권 5번 중 5번 남음');

    /*
      **여는 것만으로는 아무것도 안 만든다.** 다시 열어도 같은 자리에 같은 문장이 선다 —
      화면을 여는 것이 요금이 되면 새로고침이 곧 비용이다.
    */
    await page.reload();
    await expect(page.getByText('아직 받아 둔 사주풀이가 없습니다')).toBeVisible();
  });

  /**
   * **열쇠 없이도 실험의 입력은 손에 쥘 수 있어야 한다.**
   *
   * 저장된 artifact 는 성공한 시도가 있어야 나오고, 게이트웨이가 붙기 전에는 그 자리가
   * 영영 비어 있다. 그러면 프롬프트를 고쳐 놓고도 무엇이 나가는지 못 본다 — 9단계가
   * 만든 것이 「해석」이 아니라 실험 인프라라면 그 자리가 비어 있으면 안 된다.
   *
   * 그리는 것만으로 모델이 불리지 않는다는 것도 함께 잰다 — 시도가 열리면 이 화면을
   * 여는 것이 곧 요금이 된다.
   */
  test('해석 내부 보기는 시도 없이도 지금 보낼 프롬프트를 낸다', async ({ page, signedIn }) => {
    expect(signedIn.label).not.toBe('');
    await page.goto('/me/reading/inspect?kind=self');

    await expect(page.getByText('아직 시도한 적이 없습니다.')).toBeVisible();
    await expect(page.getByRole('heading', { name: '지금 보낼 프롬프트 — 자기 풀이' })).toBeVisible();

    // 몸통과 실제 자료가 **함께** 서야 붙여 넣을 수 있다.
    const preview = page.locator('pre').first();
    await expect(preview).toContainText('# 역할');
    await expect(preview).toContainText('## 자료 (evidence-v0)');

    await expect(page.getByRole('button', { name: '프롬프트 전체 복사' })).toBeVisible();
    await expect(page.getByRole('button', { name: '자료만 복사' })).toBeVisible();

    /*
      **실험판은 서지 않는다**(G-32). 기준판 곁에 나란히 세웠던 변형들이 운영판처럼 읽혔다 —
      판을 고르는 자리가 없으니 화면에 설 까닭이 없다. 글자가 아니라 **판의 id** 로 잰다:
      머리 문구를 세면 문구가 바뀌는 날 영원히 통과한다. `control` 은 기준판이라 뺀다.
    */
    const shown = await page.locator('main').innerText();
    const variantIds = PROMPT_VARIANTS.map((one) => one.id).filter((id) => id !== 'control');
    expect(variantIds.length).toBeGreaterThan(0);
    expect(variantIds.filter((id) => shown.includes(id))).toEqual([]);

    // 세 kind 의 몸통도 복사할 수 있다 — 자료 없이 몸통만 고쳐 볼 때의 자리다.
    // 접혀 있으므로 펴고 본다. 접힌 채로 세면 「없다」와 「안 보인다」가 같은 답이 된다.
    await expect(page.locator('summary').filter({ hasText: 'private' })).toBeVisible();
    await page.locator('summary').filter({ hasText: 'match' }).click();
    await expect(page.getByRole('button', { name: '몸통 복사' })).toBeVisible();
  });

  /** 내 사주 상세는 공개 입력 화면이 아니라 저장한 사람과 같은 화면으로 간다. */
  test('사주 자세히 보기는 저장된 내 사주 상세를 연다', async ({ page, signedIn }) => {
    expect(signedIn.label).not.toBe('');
    await page.goto('/me');

    await page.getByRole('link', { name: '사주 자세히 보기' }).click();
    await expect(page).toHaveURL(new RegExp(`/me/people/${signedIn.selfPersonId}$`));
    /*
      **머리 안에서 잰다.** 눈썹이 「내 명식」이던 동안에는 이 글자가 화면에 하나뿐이라
      아무 데서나 찾아도 됐다. 이제 「내 사주」는 메뉴의 줄과도 같은 글자라, 어디서
      찾는지를 적지 않으면 셋이 걸린다.
    */
    await expect(
      page.locator('main header').first().getByText('내 사주', { exact: true }),
    ).toBeVisible();
    await expect(page.getByRole('heading', { name: `${signedIn.label}의 사주`, exact: true })).toBeVisible();
    await expect(page.getByRole('heading', { name: '사주팔자' })).toBeVisible();
    await expect(page.getByRole('link', { name: '궁합 보러 가기' })).toBeVisible();

    await page.getByRole('link', { name: '내 사주로' }).click();
    await expect(page).toHaveURL(/\/me$/);
    await expect(page.getByRole('heading', { level: 1, name: `${signedIn.nickname}님, 오늘도 반가워요` })).toBeVisible();
  });

  /**
   * **`/` 는 회원에게 다른 얼굴을 세운다.**
   *
   * 한 주소가 두 사람을 받는다 — 로그인하지 않은 사람에게는 현관이고, 회원에게는
   * 메뉴의 「사주·궁합」이 데려오는 연장이다(`home-hero.tsx`). 익명 쪽은
   * `saju.spec.ts` 가 재므로 여기서는 **회원에게 사라져야 할 것**을 잰다: 이미 지난
   * 가입 관문, 이미 아는 제품 소개, 이미 가진 세션을 두고 하는 「로그인 필요」.
   */
  test('회원이 보는 `/` 에는 가입 안내 대신 직접 입력하는 얼굴이 선다', async ({
    page,
    signedIn,
  }) => {
    expect(signedIn.label).not.toBe('');
    await page.goto('/');

    await expect(page.getByRole('heading', { name: '궁금한 사람의 사주를 바로 봅니다.' })).toBeVisible();

    /* 코드는 가입할 때 한 번 쓴다 — 회원이 눌러도 다시 지날 수 없는 길이다 */
    await expect(page.getByText('테스트 코드를 받으셨나요?')).toHaveCount(0);
    await expect(page.getByRole('link', { name: /테스트 코드로 시작하기/ })).toHaveCount(0);
    /* 제품 소개와 「로그인 후」 안내도 현관의 것이다 */
    await expect(page.getByText('사주풀이에서 만날 이야기')).toHaveCount(0);
    await expect(page.getByText('사주풀이와 궁합은 로그인 후')).toHaveCount(0);

    /*
      **회원의 머리에는 토글이 선다.** 사주와 궁합은 나란한 짝이라 버튼이 아니라 지금
      어디에 있는지 함께 보이는 한 덩이로 잇는다(`segmented-nav.tsx`).

      **「로그인 필요」는 깜빡이지도 않아야 한다.** 그 꼬리표는 현관의 것이고, 회원
      화면에 한 틱이라도 서면 화면이 그 사람의 세션이 풀렸다고 말하는 셈이다.
    */
    const tabs = page.getByRole('navigation', { name: '사주와 궁합' });
    await expect(tabs.getByRole('link', { name: '사주', exact: true })).toHaveAttribute(
      'aria-current',
      'page',
    );
    await expect(tabs.getByRole('link', { name: '궁합', exact: true })).toHaveAttribute(
      'href',
      '/compat',
    );
    await expect(page.getByText('로그인 필요')).toHaveCount(0);

    /*
      **현관에서 하던 말은 회원에게 안 한다.** 버튼은 이제 양쪽이 같은 글자를 쓰지만
      (「사주 보기」 — 누름이 하는 일이 같다), 그 아래 「로그인 없이…」 한 줄과 현관의
      눈썹은 로그인하지 않은 사람에게만 참이다. 회원에게 세우면 화면이 그 사람의 세션이
      풀렸다고 말하는 셈이다(`saju-calculator.tsx`).
    */
    await expect(page.getByRole('heading', { name: '출생 정보를 입력해 주세요' })).toBeVisible();
    await expect(page.getByText('첫 단계 · 사주 확인')).toHaveCount(0);
    await expect(page.getByText('로그인 없이 사주와 오행을 확인할 수 있어요')).toHaveCount(0);

    await submitReady(page);
    await page.getByLabel('이름', { exact: true }).fill('민수');
    await fillBirthDate(page, '1988-11-07');
    await fillBirthTime(page, '09:15');
    await page.getByRole('button', { name: '사주 보기' }).click();
    await expect(page.locator('#chart')).toBeVisible();
  });

  /**
   * **이름 뒤에 조사를 안 붙인다.**
   *
   * 「이(가)」는 앞 글자의 받침을 따르는데 이름은 사용자가 적는 값이다 —
   * 「영희이(가) 추가됩니다」가 화면에 그대로 찍혀 있었다. 받침 없는 이름과 이름이
   * 아예 없는 경우, 둘 다 잰다: 갈리는 자리가 그 둘이다(`save-for-reading.tsx`).
   */
  test('저장 안내는 이름 뒤에 짝 조사를 찍지 않는다', async ({ page, signedIn }) => {
    expect(signedIn.label).not.toBe('');

    await page.goto('/');
    /*
      **회원 얼굴이 선 뒤에 채운다.** 폼은 붙기 전까지 값을 못 지킨다 — 하이드레이션
      전에 적으면 React 가 자기 상태로 칸을 되돌리고, 그러면 「이름을 입력해 주세요」가
      뜬 채 이 시험이 조사 이야기를 시작한다. 머리는 계산기보다 **먼저** 서므로
      (계산기는 `Suspense` 뒤에서 따로 붙는다) 제목만으로는 모자란다.
    */
    await expect(page.getByRole('heading', { name: '궁금한 사람의 사주를 바로 봅니다.' })).toBeVisible();
    await submitReady(page);
    await page.getByLabel('이름', { exact: true }).fill('영희');
    await fillBirthDate(page, '1988-11-07');
    await fillBirthTime(page, '09:15');
    await page.getByRole('button', { name: '사주 보기' }).click();
    await expect(page.locator('#chart')).toBeVisible();

    const entry = page.locator('#reading-next');
    await expect(entry).toContainText('「영희」 이름으로 추가됩니다');
    await expect(entry).not.toContainText('이(가)');

    /* 이름은 주소로 들어온 입력에서 빠질 수 있다 — 그때는 문장이 통째로 갈린다 */
    await page.goto('/#date=1988-11-07&hour=09:15');
    await expect(page.locator('#chart')).toBeVisible();
    await expect(entry).toContainText('이 사람이 추가됩니다');
    await expect(entry).not.toContainText('이(가)');
  });

  /**
   * **직접 입력한 한 사람이 사주풀이로 가는 길.**
   *
   * 궁합 쪽과 같은 다리이고 갈리는 것은 둘이다 — 사이를 묻지 않고(혼자 보는 풀이에는
   * 물을 상대가 없다), 저장이 하나라 한 문으로 묶을 일이 없다. 도착하는 곳은 사람 탭의
   * 그 사람 화면이고, 거기가 저장한 사람의 풀이가 사는 자리다(`person` 흐름).
   */
  test('직접 입력한 한 사람을 저장하면 그 사람의 사주풀이 화면으로 건너간다', async ({
    page,
    signedIn,
  }) => {
    expect(signedIn.label).not.toBe('');
    /*
      **씨앗의 자기 사주와 안 겹치는 날을 쓴다.** 씨앗은 1990-05-15 14:30 으로 자기
      사주를 든다(`BIRTH`). 그 날을 여기 쓰면 저장 직전에 「저장된 나와 같은 사람인가요?」
      가 서고(ADR 0034), 이 검사가 재려던 것은 그것이 아니다. 성별을 바꿔도 안 갈린다 —
      여덟 글자는 성별로 갈리지 않는다.
    */
    await page.goto('/#date=1988-11-07&hour=09:15');

    /*
      **도착지가 부르는 이름을 그대로 쓴다.** 제목이 「AI 풀이」였던 동안 이 칸은 앱
      어디에도 없는 세 번째 이름을 세우고 있었고, 그래서 제목과 버튼이 서로 다른 것을
      가리켰다(ADR 0026·0027).
    */
    await expect(page.getByRole('heading', { name: '사주풀이로 이어 보기' })).toBeVisible();
    /*
      **이름을 재는 자리는 제목과 버튼이다** — 본문이 아니다.

      `main` 전체에 `not.toContainText('AI 풀이')` 를 걸고 있었는데, 분석 카드의 설명이
      「그 배정은 … AI 풀이 자료에 함께 실립니다」라고 적는다. 그건 세 번째 이름을 세우는
      것이 아니라 **어디로 넘어가는 자료인지**를 말하는 산문이다. 그래서 이 시험은
      로그인 e2e 가 안 돌던 동안 내내 빨간불이었고, 아무도 그것을 못 봤다.

      막으려던 것은 「제목과 버튼이 서로 다른 것을 가리킨다」이므로 그 둘만 잰다.
    */
    await expect(page.getByRole('heading', { name: /AI 풀이/ })).toHaveCount(0);
    await expect(page.getByRole('button', { name: /AI 풀이/ })).toHaveCount(0);
    // 혼자 보는 풀이에는 물을 상대가 없다.
    await expect(page.getByText('두 분은 무슨 사이인가요')).toHaveCount(0);

    await page.getByLabel('이름', { exact: true }).fill('상우');
    await page.getByRole('button', { name: '수정하고 다시 보기' }).click();

    /* 이름 뒤에 조사를 안 붙인다 — 갈리는 두 경우는 따로 잰다(「짝 조사」 시험) */
    await expect(page.locator('main')).toContainText('저장한 사람 목록에 「상우」 이름으로 추가됩니다');
    await page.getByRole('button', { name: '저장하고 계속하기' }).click();

    await expect(page).toHaveURL(/\/me\/readings\/[0-9a-f-]+$/);
    // 저장한 사람이라 이 화면에는 그 사람 이름으로 풀이를 만드는 자리가 있다.
    await expect(page.getByRole('heading', { name: '상우의 사주풀이' })).toBeVisible();
    // 이미 저장된 사람에게 「저장하세요」가 다시 서지 않는다.
    await expect(page.getByRole('heading', { name: '사주풀이로 이어 보기' })).toHaveCount(0);
  });

  /**
   * **같은 명식이면 저장하기 전에 묻는다** (ADR 0034).
   *
   * 막으려는 것은 중복 행이 아니라 **풀이권이 두 번 나가는 것**이다 — 대상이 둘이면
   * 풀이도 둘이고 풀이권도 둘이다(ADR 0013·0021).
   *
   * `signedIn` 이 든 「어머니」와 **같은 입력**을 친다. 이름만 다르다 — 그것이 정확히
   * 사용자가 자기가 이미 저장한 줄 모르는 경우다.
   *
   * **도시를 인코딩한다.** 조각에 한글을 그대로 실으면 도시가 안 잡히고, 그러면
   * 「다시 보기」 버튼이 영영 잠긴 채로 남는다 — 처음에 이 검사가 그렇게 걸렸다.
   *
   * 이 흐름은 **단위 시험으로 못 잰다.** 견주는 일은 서버에서 저장된 판본을 읽어
   * 엔진으로 다시 계산하는 것이라, 세 조각(엔진·저장된 판본·저장 액션)이 서로에 대해
   * 옳은지는 실제로 이어 봐야 드러난다.
   */
  const SAME_AS_MOTHER = `/#${new URLSearchParams({
    date: '1962-03-02',
    hour: '07:10',
    gender: 'female',
    city: '대구',
  })}`;

  test('같은 명식을 저장하려 하면 묻고, 맞다고 하면 그 사람에게 간다', async ({ page, signedIn }) => {
    expect(signedIn.label).not.toBe('');
    await page.goto(SAME_AS_MOTHER);
    // 붙기 전에 채우면 React 가 그 값을 안 보고, 그러면 「다시 보기」가 영영 잠긴다.
    await expect(page.getByRole('heading', { name: '사주풀이로 이어 보기' })).toBeVisible();

    await page.getByLabel('이름', { exact: true }).fill('엄마');
    await page.getByRole('button', { name: '수정하고 다시 보기' }).click();
    await page.getByRole('button', { name: '저장하고 계속하기' }).click();

    const ask = page.getByRole('group', { name: '같은 사람인지 확인' });
    await expect(ask).toContainText('저장된 어머니 님과 같은 사람인가요?');
    // 왜 묻는지 적는다 — 「이미 있습니다」로 끝내면 막는 줄로 읽는다.
    await expect(ask).toContainText('풀이권을 한 번 더');

    /*
      **물음이 서면 저장 버튼은 내려간다.** 함께 세우면 답하지 않고 다시 누를 수 있고,
      그때 사용자는 자기 답이 안 먹혔다고 읽는다.
    */
    await expect(
      page.getByRole('button', { name: '저장하고 계속하기' }),
    ).toHaveCount(0);

    await ask.getByRole('button', { name: '네, 같은 사람입니다' }).click();

    await expect(page).toHaveURL(/\/me\/readings\/[0-9a-f-]+$/);
    // 「엄마」가 아니라 저장돼 있던 이름이다 — 아무것도 새로 저장되지 않았다.
    await expect(page.getByRole('heading', { name: '어머니의 사주풀이', exact: true }).first()).toBeVisible();

    await page.goto('/me/people');
    await expect(page.getByRole('heading', { name: '엄마' })).toHaveCount(0);
  });

  /**
   * **「아니다」가 있어야 한다.** 쌍둥이가 있고 생년월일시가 겹치는 남남이 있다.
   * 강제로 합치면 우리가 모르는 것을 아는 척하는 것이다(ADR 0005).
   */
  test('다른 사람이라고 답하면 그대로 저장된다', async ({ page, signedIn }) => {
    expect(signedIn.label).not.toBe('');
    await page.goto(SAME_AS_MOTHER);
    await expect(page.getByRole('heading', { name: '사주풀이로 이어 보기' })).toBeVisible();

    await page.getByLabel('이름', { exact: true }).fill('쌍둥이');
    await page.getByRole('button', { name: '수정하고 다시 보기' }).click();
    await page.getByRole('button', { name: '저장하고 계속하기' }).click();

    const ask = page.getByRole('group', { name: '같은 사람인지 확인' });
    await expect(ask).toBeVisible();
    await ask.getByRole('button', { name: '아니요, 다른 사람입니다' }).click();

    await expect(page).toHaveURL(/\/me\/readings\/[0-9a-f-]+$/);
    await expect(page.getByRole('heading', { name: '쌍둥이의 사주풀이', exact: true }).first()).toBeVisible();
  });

  test('사람을 추가하면 목록에 서고 그 사람과의 수동 궁합이 열린다', async ({ page, signedIn }) => {
    await page.goto('/me/people');

    await expect(page.getByRole('heading', { name: '저장한 사람' })).toBeVisible();
    await expect(page.getByRole('heading', { name: '어머니' })).toBeVisible();

    await (await hydrated(page.getByRole('button', { name: '사람 추가' }))).click();
    await expect(page.getByRole('heading', { name: '사람 추가' })).toBeVisible();

    const form = page.locator('form, section').filter({ hasText: '사람 추가' }).last();
    await form.getByLabel('이름').fill('친구');
    await fillBirthDate(form, '1991-08-08');
    await fillBirthTime(form, '09:20');

    await form.getByRole('button', { name: '등록', exact: true }).click();

    await expect(page.getByRole('heading', { name: '친구' })).toBeVisible();

    /*
      **사람 탭은 그 사람의 사주를 보는 자리다.** 무슨 사이인지는 여기서 묻지 않는다 —
      내 사주 화면에 「나와 나는 무슨 사이인가」가 없는 것과 같다. 관계가 글을 바꾸는
      것은 궁합을 읽을 때뿐이라, 묻는 자리도 거기다.
    */
    await expect(page.getByText('무슨 사이')).toHaveCount(0);

    const friendCard = page
      .locator('section')
      .filter({ has: page.getByRole('heading', { name: '친구' }) });

    /*
      **타일이 내는 길은 셋이다** — 이름(타일 전체)은 그 사람의 사주로, 먹색 단추는 사주풀이로, 하트는
      나와의 궁합으로. 사주와 풀이는 다음 화면의 탭으로도 오가므로 같은 길을 두 번 세우지 않는다.
    */
    const readingLink = friendCard.getByRole('link', { name: /사주풀이 받기/ });
    await expect(readingLink).toHaveAttribute(
      'href',
      /\/me\/readings\/[0-9a-f-]+$/,
    );
    await expect(friendCard.getByRole('link', { name: '친구', exact: true })).toHaveAttribute(
      'href',
      /\/me\/people\/[0-9a-f-]+$/,
    );
    /* 궁합으로 가는 길은 person id 만 싣는다 — 출생 원문이 주소에 안 실린다(ADR 0007) */
    const compatLink = friendCard.getByRole('link', { name: '나와 궁합' });
    await expect(compatLink).toHaveAttribute(
      'href',
      /^\/compat#a\.person=[0-9a-f-]+&b\.person=[0-9a-f-]+$/,
    );
    await expect(friendCard.getByRole('link')).toHaveCount(3);

    /* 설명이 긴 버튼도 카드의 최소 너비를 밀어내지 않는다 — 320px에서 실제로 넘쳤다. */
    const cardBox = await friendCard.boundingBox();
    const actionBox = await readingLink.boundingBox();
    expect(actionBox?.x).toBeGreaterThanOrEqual(cardBox?.x ?? 0);
    expect((actionBox?.x ?? 0) + (actionBox?.width ?? 0)).toBeLessThanOrEqual(
      (cardBox?.x ?? 0) + (cardBox?.width ?? 0) + 0.5,
    );

    /* 명식은 카드의 이름에서 연다 — 풀이 화면에는 사주로 가는 탭이 없다 */
    await friendCard.getByRole('link', { name: '친구', exact: true }).click();
    await expect(
      page.getByRole('heading', { name: '친구의 사주', exact: true }),
    ).toBeVisible();
    await expect(page.getByRole('heading', { name: '사주팔자' })).toBeVisible();

    /*
      **사람 상세가 궁합으로 가는 길을 낸다**(ADR 0036). 저장한 사람을 보고 있는 사람이
      「이 사람과 누구」를 떠올리는 자리가 여기라, 궁합의 첫 걸음이 **첫 칸이 이 사람으로
      채워진 채** 열린다(ADR 0054 — 주소의 `#a.person`).
    */
    await expect(
      page.getByRole('link', { name: '궁합 보러 가기' }),
    ).toHaveAttribute('href', /^\/compat#a\.person=.+/);

    await page.getByRole('link', { name: '사람 목록으로' }).click();
    await expect(page).toHaveURL(/\/me\/people$/);

    /*
      **목록의 타일도 상세와 같은 길을 낸다** — 나와 그 사람이 두 칸에 앉은 채로 열린다(주소에는 id 만).
      홈의 「나와 궁합」도 이 모양의 주소를 쓴다.
    */
    await compatLink.click();
    await expect(page).toHaveURL(/\/compat#a\.person=[0-9a-f-]+&b\.person=[0-9a-f-]+$/);
    await expect(page.getByRole('combobox', { name: '두 번째' })).toHaveValue('친구');

    /*
      **사이는 여기서 묻는다**(ADR 0019·0054). 읽기 전에 물어야 뜻이 있고, 다음 화면은
      이 답이 정해진 채로 선다.
    */
    await expect(page.getByText('두 분은 무슨 사이인가요')).toBeVisible();
    /* 사이가 점수의 눈금도 고른다(ADR 0113) — 안내가 옛 약속 「점수에는 쓰지 않습니다」를 말하지 않는다 */
    await expect(page.getByText('점수의 기준도 이 답을 따릅니다')).toBeVisible();
    await expect(page.getByText('점수에는 쓰지 않습니다')).toHaveCount(0);

    /* 목록의 카드가 연 길이라 첫 칸에는 그 사람이 이미 앉아 있다 — 찾아 고르는 칸이 그 이름을 든다 */
    await expect(page.getByRole('combobox', { name: '첫 번째' })).not.toHaveValue('');

    await choosePerson(page, '첫 번째', `${signedIn.label} (나)`);

    /*
      **두 칸이 서로를 안다.** 첫 번째에서 고른 사람은 두 번째 목록에서 빠진다 —
      같은 사람 둘을 고를 수 있게 두면 누르고 나서야 거절을 만난다.
    */
    await page.getByRole('combobox', { name: '두 번째' }).click();
    await expect(page.getByRole('listbox', { name: '두 번째' }).getByRole('option')).not.toContainText([
      `${signedIn.label} (나)`,
    ]);

    await choosePerson(page, '두 번째', '어머니');
    await page.getByRole('radio', { name: '가족' }).check();

    /* 고르는 자리에는 결과가 없다 — 지표도 명식도 다음 화면의 것이다 */
    await expect(page.getByText('궁합 베타')).toHaveCount(0);

    /*
      **눌러도 아무것도 안 만들어진다**(ADR 0036). 이 누름이 모델을 부르던 동안에는
      여기서 멈춰야 했다 — 시험이 누르면 4분과 돈이 들었다. 이제 이 누름은 만세력을
      열 뿐이고, 글은 그 아래의 버튼이 만든다. 걸음이 하나 늘었으므로 시험도 하나 는다.
    */
    await page.getByRole('button', { name: '궁합 보기' }).click();

    await expect(page).toHaveURL(/\/me\/compat\?a=.+&b=.+/);
    await expect(
      page.getByRole('heading', { name: `${signedIn.label} × 어머니` }),
    ).toBeVisible();

    /*
      **만세력이 먼저 서고 만드는 버튼은 그 아래다.** 두 사람의 여덟 글자가 이 화면의
      본론이고, 관계표는 우리가 검산하려고 세운 원자료라 **접힌 채로** 선다(ADR 0035).
    */
    await expect(page.getByText('일간').first()).toBeVisible();
    await expect(page.getByRole('heading', { name: '두 사주 사이의 관계' })).toBeHidden();

    /*
      **차례가 정해져 있다** — 두 명식 → 베타 지표 → 만드는 버튼(ADR 0054). 사이는
      앞 화면에서 이미 물었으므로 여기서는 **무엇으로 읽는지만** 적는다.
    */
    await expect(page.getByText('궁합 베타')).toBeVisible();
    await expect(page.getByText('두 분은 무슨 사이인가요')).toHaveCount(0);
    await expect(page.locator('main')).toContainText('가족 사이로 읽어 드립니다');

    /*
      **사이가 점수의 눈금을 고른다**(ADR 0113) — 가족은 일반 정책이라 축이 둘(서로 채우는 기운 60 · 함께 놓은 균형 40)이고
      일주 · 일지 축은 안 선다. 판본 이름은 화면 어디에도 없다.
    */
    await expect(page.getByText('일반 관계 기준', { exact: true })).toBeVisible();
    await expect(page.getByText('서로 채우는 기운', { exact: true })).toBeVisible();
    await expect(page.getByText('점수 반영 60%', { exact: true })).toBeVisible();
    await expect(page.getByText('점수 반영 40%', { exact: true })).toBeVisible();
    await expect(page.getByText('생활의 맞물림')).toHaveCount(0);
    await expect(page.locator('main')).not.toContainText('v2');

    /*
      **도착한 자리가 그 글을 부르는 말로 적는다.** 궁합 화면에서 「사주풀이 받기」라고
      적으면 눌러 온 사람이 다른 것을 보고 있다고 읽는다(ADR 0026·0027).
      누르지 않는다 — 누르면 4분과 돈이 든다.
    */
    await expect(page.getByRole('button', { name: '궁합풀이 받기' })).toBeVisible();
  });

  test('사람을 목록에서 빼기 전에 확인 창을 띄우고 취소하면 그대로 둔다', async ({
    page,
    signedIn,
  }) => {
    const kin = signedIn.managed[0];
    expect(kin).not.toBe(undefined);
    await page.goto('/me/people');

    const card = page.locator('section').filter({
      has: page.getByRole('heading', { name: kin, exact: true }),
    });
    await card.getByLabel(`${kin} 관리`, { exact: true }).click();
    await card.getByRole('button', { name: '목록에서 빼기' }).click();

    const asking = page.getByRole('dialog');
    await expect(asking).toBeVisible();
    await expect(asking.getByRole('heading', { name: `${kin} 님을 목록에서 뺄까요?` })).toBeVisible();
    await expect(asking.getByText('되돌릴 수 없습니다', { exact: false })).toBeVisible();
    await asking.getByRole('button', { name: '취소' }).click();

    await expect(asking).toBeHidden();
    await expect(card.getByRole('heading', { name: kin, exact: true })).toBeVisible();
  });

  /**
   * **사람 목록도 스물이 넘으면 이름으로 찾는다**(ADR 0102, G-21).
   *
   * 2026-09-24 에 쟀다 — 카드가 커서 첫 화면에 온전히 서는 카드는 수와 상관없이 하나였고, 스물여섯이면
   * 휴대폰에서 열세 화면을 내려야 끝의 사람에 닿았다. 그래서 여섯부터 목록 위에 찾는 칸이 선다.
   * 궁합 칸과 같은 규칙(초성도)으로 좁히고, 몇 명인지 · 없다는 것을 `role="status"` 가 말한다.
   */
  test('저장한 사람이 스물여섯이면 목록 위의 칸에 이름을 쳐서 좁힌다', async ({ page, signedIn }) => {
    const names = [...Array.from({ length: 20 }, (_, index) => `이웃${index + 1}`), '지영', '지수', '민지', '수정'];
    saveManyPeople(signedIn.email, names);
    await page.goto('/me/people');

    const cards = page.locator('main ul > li');
    const find = page.getByRole('searchbox', { name: '이름으로 찾기' });
    /* 결과를 말하는 칸 — 찾는 칸이 `aria-describedby` 로 가리키는 그 칸이다 */
    const status = page.locator(`[id="${await find.getAttribute('aria-describedby')}"]`);
    await expect(cards).toHaveCount(names.length + 1);
    await expect(cards.filter({ visible: true })).toHaveCount(names.length + 1);
    await expect(find).toBeVisible();
    await expect(status).toHaveAttribute('role', 'status');
    /* 안 쳤으면 말하지 않는다 */
    await expect(status).toHaveText('');

    /* 초성만 쳐도 좁혀진다 — 「수정」의 정까지 넷, 차례는 저장한 그대로다 */
    await find.fill('ㅈ');
    await expect(cards.filter({ visible: true })).toHaveCount(4);
    await expect(status).toHaveText('검색 결과 4명');
    await find.fill('민지');
    const shown = cards.filter({ visible: true });
    await expect(shown).toHaveCount(1);
    await expect(shown.getByRole('heading', { name: '민지', exact: true })).toBeInViewport();

    /* 좁혀진 카드도 그대로 쓴다 — 관리 메뉴가 열린다 */
    await shown.getByLabel('민지 관리', { exact: true }).click();
    await expect(shown.getByRole('button', { name: '목록에서 빼기' })).toBeVisible();

    await find.fill('없는이름');
    await expect(cards.filter({ visible: true })).toHaveCount(0);
    await expect(status).toHaveText('찾는 사람이 없습니다');

    /* 지우면 전부가 다시 선다 */
    await find.fill('');
    await expect(cards.filter({ visible: true })).toHaveCount(names.length + 1);
    await expect(status).toHaveText('');

    /* 열려도 화면을 가로로 밀지 않는다 */
    const width = await page.evaluate(() => ({
      client: document.documentElement.clientWidth,
      scroll: document.documentElement.scrollWidth,
    }));
    expect(width.scroll).toBeLessThanOrEqual(width.client);
  });

  /**
   * **백 명이어도 끝의 사람에 몇 글자로 닿는다.** 칸 없이는 휴대폰에서 마흔여덟 화면을 내려야
   * 했던 사람이 이름을 치면 스크롤 없이 첫 화면에 선다. 서버는 수와 상관없이 같은 문을 부른다 —
   * 그것은 PR 에서 쟀고 여기서는 화면만 본다.
   */
  test('저장한 사람이 백이어도 끝의 사람이 이름을 치면 첫 화면에 선다', async ({ page, signedIn }) => {
    const names = Array.from({ length: 99 }, (_, index) => `사람${String(index + 1).padStart(3, '0')}`);
    saveManyPeople(signedIn.email, names);
    await page.goto('/me/people');

    const cards = page.locator('main ul > li');
    await expect(cards).toHaveCount(100);
    const last = names[names.length - 1];
    await expect(page.getByRole('heading', { name: last, exact: true })).not.toBeInViewport();

    const find = page.getByRole('searchbox', { name: '이름으로 찾기' });
    await find.click();
    await find.pressSequentially(last);
    await expect(page.locator('main [role="status"]')).toHaveText('검색 결과 1명');
    await expect(cards.filter({ visible: true })).toHaveCount(1);
    await expect(page.getByRole('heading', { name: last, exact: true })).toBeInViewport();
    expect(await page.evaluate(() => window.scrollY)).toBe(0);
  });

  /** 적을 때는 칸이 안 선다 — 눈으로 찾는 수에 쓸 일 없는 칸이 첫 카드를 밀지 않게 */
  test('저장한 사람이 없거나 하나면 찾는 칸이 안 선다', async ({ page, signedIn, openAs }) => {
    await page.goto('/me/people');
    await expect(page.getByRole('heading', { name: signedIn.managed[0], exact: true })).toBeVisible();
    await expect(page.getByRole('searchbox')).toHaveCount(0);

    const alone = await openAs({ selfPerson: true });
    await alone.page.goto('/me/people');
    await expect(alone.page.getByText('아직 저장한 사람이 없습니다', { exact: false })).toBeVisible();
    await expect(alone.page.getByRole('searchbox')).toHaveCount(0);
    await expect(alone.page.locator('main ul > li')).toHaveCount(0);
  });

  /**
   * **만든 글이 사는 자리는 메뉴에 있다**(ADR 0033).
   *
   * 풀이가 네 화면에 흩어져 있어서, 만든 글에 닿으려면 그것이 어느 화면의 것인지를
   * 먼저 기억해야 했다. 여기서 재는 것은 **길이 나 있는가**와, 아직 아무것도 없는
   * 사람에게 그 화면이 무엇을 말하는가다.
   *
   * 글을 실제로 만들어 놓고 재지는 않는다 — 누르면 4분과 돈이 든다. 네 kind 가 다
   * 서는지는 흐름 검사가 열쇠로 저장해 놓고 잰다(`check-reading.mjs`).
   */
  test('머리글의 풀이가 만든 글의 목록으로 간다', async ({ page, signedIn }) => {
    expect(signedIn.label).not.toBe('');
    await page.goto('/me');

    await page.getByRole('link', { name: '풀이', exact: true }).click();

    await expect(page).toHaveURL(/\/me\/readings$/);
    // `exact` 를 안 주면 **두 개를 잡는다** — 「아직 만든 풀이가 없습니다」가 이것을 품는다.
    await expect(page.getByRole('heading', { name: '만든 풀이', exact: true })).toBeVisible();

    /*
      **빈 화면만 남기지 않는다.** 「본 궁합」은 비어 있으면 아무것도 안 그렸는데, 거기서는
      고르는 칸이 이미 그 말을 하고 있었다. 여기는 메뉴에서 눌러 들어온 제 화면이라 그
      말을 대신해 줄 것이 없다.
    */
    await expect(page.getByRole('heading', { name: '아직 만든 풀이가 없습니다' })).toBeVisible();
    /*
      「내 사주」 탭이 없어진 뒤로(메뉴: 홈 · 매칭 · 풀이 · 채팅) 빈 화면은 만드는 자리로 **곧장** 가는
      표지를 세운다 — 내 사주가 있는 사람에게는 내 사주풀이 화면이다.
    */
    const mine = page.getByRole('main').getByRole('link', { name: '내 사주풀이', exact: true });
    await expect(mine).toHaveAttribute('href', '/me/readings/self');
    await expect(page.getByRole('main').getByRole('link', { name: '저장한 사람', exact: true })).toHaveAttribute(
      'href',
      '/me/people',
    );
  });

  /**
   * **책장 옆에서 읽는다**(6차 warm). 넓은 화면은 왼쪽 책장 · 오른쪽 글의 두 칸이고 목록만 열면 가장 최근
   * 글이 펼쳐진다. 폰은 같은 두 칸을 주소로 갈아 끼운다 — 그래서 뒤로 가기가 책장으로 돌아온다.
   * 어느 쪽이든 **주소가 한 글을 가리킨다.**
   */
  test('풀이 목록은 넓은 화면에서 책장 옆에 글을 펴고 폰에서는 글과 책장을 오간다', async ({ page, personReader }, testInfo) => {
    const reading = `/me/readings/${personReader.personId}`;
    const shelfTitle = page.getByRole('heading', { name: '만든 풀이', exact: true });
    const cover = page.getByRole('link', { name: /어머니 사주/ });
    await page.goto('/me/readings');

    if (!testInfo.project.name.includes('mobile')) {
      await expect(page).toHaveURL(new RegExp(`${reading}$`));
      await expect(shelfTitle).toBeVisible();
      await expect(page.getByRole('heading', { name: '어머니의 사주풀이' })).toBeVisible();
      await expect(cover).toHaveAttribute('aria-current', 'page');
      /* 책장이 옆에 있으니 돌아가는 길은 안 선다 */
      await expect(page.getByRole('link', { name: '만든 풀이 목록' })).toBeHidden();
      return;
    }

    await expect(page).toHaveURL(/\/me\/readings$/);
    await cover.click();
    await expect(page).toHaveURL(new RegExp(`${reading}$`));
    await expect(page.getByRole('heading', { name: '어머니의 사주풀이' })).toBeVisible();
    await expect(shelfTitle).toBeHidden();

    await page.goBack();
    await expect(page).toHaveURL(/\/me\/readings$/);
    await expect(shelfTitle).toBeVisible();

    await cover.click();
    await page.getByRole('link', { name: '만든 풀이 목록' }).click();
    await expect(page).toHaveURL(/\/me\/readings$/);
    await expect(shelfTitle).toBeVisible();
  });

  test('계정 작업은 우측 계정 메뉴의 계정 관리에 모여 있다', async ({ page, signedIn }) => {
    expect(signedIn.label).not.toBe('');
    await page.goto('/me');

    /* 폰과 넓은 화면이 같은 톱니다 */
    await page.locator('summary[aria-label="설정 메뉴"]').click();

    /* 프로필도 같은 메뉴에서 닿는다 — 이름은 앱 전체의 것이라 길도 앱 전체의 자리에 선다 */
    await expect(page.getByRole('link', { name: '프로필' })).toBeVisible();

    await page.getByRole('link', { name: '계정 관리' }).click();

    await expect(page.getByRole('heading', { name: '계정 관리' })).toBeVisible();
    const account = page.getByRole('main');
    await expect(account.getByRole('button', { name: '로그아웃' })).toBeVisible();
    await expect(account.getByRole('button', { name: '탈퇴', exact: true })).toBeVisible();
    const cardTitles = await account.getByRole('heading', { level: 2 }).allTextContents();
    expect(cardTitles.indexOf('선택 동의')).toBeLessThan(cardTitles.indexOf('로그인 정보'));
    expect(cardTitles.indexOf('로그인 정보')).toBeLessThan(cardTitles.indexOf('탈퇴'));
    expect(cardTitles.at(-1)).toBe('탈퇴');

    /* 인연 찾기의 성별 칸 셋 — 높이가 36px 이었다 */
    await expectTargets(
      Object.fromEntries(
        ['남성', '여성', '상관없음'].map((label) => [
          label,
          account.locator('label', { has: page.getByRole('radio', { name: label, exact: true }) }),
        ]),
      ),
    );

    /*
      **누르고 나면 판이 닫힌다.** `<details>` 는 안의 링크를 눌러도 스스로 안 닫히고,
      앱 안 이동은 화면만 갈아 끼우므로 펼친 판이 새 화면 위에 그대로 얹혀 있었다.
    */
    await expect(page.locator('details:has(summary[aria-label="설정 메뉴"])')).not.toHaveAttribute(
      'open',
      /.*/,
    );
  });

  /**
   * **버튼의 이름은 「끄기」다.**
   *
   * 「철회하기」라고 적혀 있었다 — 서류의 말이지 누르는 것의 이름이 아니다. 처리 안내가
   * 「계정 관리 화면에서 켜고 끄실 수 있습니다」라고 약속하므로 화면도 그 낱말을 쓴다.
   * 끄는 일 자체는 그대로다 — 없애면 처리방침이 약속한 것이 화면에 없게 된다.
   */
  test('선택 동의는 켜고 끄는 말로 서고, 끄면 남긴 답도 지운다고 미리 말한다', async ({
    page,
    reader,
  }) => {
    expect(reader.account.email).not.toBe('');
    await page.goto('/me/settings');

    const consent = page.getByRole('main');
    await expect(consent.getByRole('button', { name: '철회하기' })).toHaveCount(0);

    /* `reader` 는 개선 활용에 동의한 계정이라 그 줄이 켜져 있다 */
    await expect(consent.getByRole('button', { name: '끄기' }).first()).toBeVisible();
    /* 지움 문장은 상태 줄의 꼬리가 아니라 제 줄이다 — 켜져 있든 아니든 선다 */
    await expect(consent.getByText('동의를 끄면 지금까지 남긴 설문 답변을 삭제합니다.')).toBeVisible();
    await expect(consent.getByText('현재 동의 중').first()).toBeVisible();
  });

  test('입력을 고치면 새 판본으로 다시 그린다', async ({ page, signedIn }) => {
    expect(signedIn.label).not.toBe('');
    await page.goto('/me');

    await expect(page.getByText('1990-05-15')).toBeVisible();

    const handle = page.getByRole('button', { name: '출생 정보 수정' });
    await handle.click();

    /**
     * **열리는 자리가 누르는 자리 옆이어야 한다.**
     *
     * 이 폼이 카드 밑바닥에 서던 때가 있었다. 손잡이는 카드 오른쪽 위 모서리에 떠
     * 있으므로 폰에서 그 사이가 1,100px 이었고, 눌러도 화면 안에서는 아무 일도 안
     * 일어났다. **시험은 초록이었다** — 채우기 전에 스크롤해 주기 때문이다. 사람은
     * 스크롤하지 않는다. 그래서 여기서 재는 것은 「폈는가」가 아니라 「어디에 폈는가」다.
     */
    const from = (await handle.boundingBox())!;
    const to = (await page.getByLabel('출생연도').boundingBox())!;
    expect(to.y - from.y).toBeLessThan(page.viewportSize()!.height);
    await expect(page.getByLabel('이름')).toHaveCount(0);
    await expect(page.getByText('내 이름은 프로필 닉네임으로 표시됩니다.')).toBeVisible();

    await fillBirthDate(page, '1990-06-20');
    await page.getByRole('button', { name: '변경 사항 저장' }).click();

    // 내 사주는 여덟 글자를 바꾸기 전에 한 번 묻는다 — 걸린 인연 요청이 취소되기 때문이다.
    await expect(page.getByRole('dialog', { name: '출생 정보를 바꿀까요?' })).toBeVisible();
    await page.getByRole('button', { name: '바꾸고 저장하기' }).click();

    await expect(page.getByText('1990-06-20')).toBeVisible();
    await expect(page.getByText('1990-05-15')).toHaveCount(0);
  });
});

/**
 * **로그인이 필요한데 익명 파일에 살던 것들.**
 *
 * `saju.spec.ts` 는 CI 가 도는 유일한 e2e 인데, 거기에 세션이 필요한 시험 넷이 섞여
 * 있었다. CI 에는 살아 있는 Supabase 가 없으므로 그 넷은 **언제나 실패할 자리**였고,
 * 앞선 단계가 먼저 죽는 동안 가려져 있었다. 파일이 재는 것을 파일 이름과 맞춘다.
 */

/**
 * **로그인이 필요한데 익명 파일에 살던 것들.**
 *
 * `saju.spec.ts` 는 CI 가 도는 유일한 e2e 인데, 거기에 세션이 필요한 시험 넷이 섞여
 * 있었다. CI 에는 살아 있는 Supabase 가 없으므로 그 넷은 **언제나 실패할 자리**였고,
 * 앞선 단계가 먼저 죽는 동안 가려져 있었다. 파일이 재는 것을 파일 이름과 맞춘다.
 */
/**
 * 칸 하나를 **토글로** 짚는다 — 이름으로도 자리로도 못 짚는다.
 *
 * 묶음의 이름은 그 칸이 들고 있는 사람의 이름이다(`legend`). 비어 있을 때만
 * 「첫 번째 사람」이고, 첫 칸은 처음부터 자기 사주가 앉아 있어 그 계정의 별명으로
 * 선다 — 고르거나 적을 때마다 또 바뀐다.
 *
 * 몇 번째 묶음인지로 세는 것도 안 된다. 한 칸을 「직접 입력」으로 돌리면 그 안에
 * 입력 묶음이 자라서 뒤 칸의 번호가 밀린다. 두 칸에만 있고 모양이 바뀌어도 그대로
 * 있는 것은 **어디서 올지를 고르는 토글** 하나다.
 */
const slotCard = (page: Page, side: '첫 번째' | '두 번째') =>
  page
    .getByRole('group')
    .filter({ has: page.getByRole('button', { name: '저장한 사람' }) })
    .nth(side === '첫 번째' ? 0 : 1);

/**
 * 저장한 사람을 **찾아 고르는 칸**에서 고른다(ADR 0102) — 눌러서 목록을 열고 이름을 누른다.
 *
 * `select` 였을 때는 `selectOption` 한 줄이었다. 지금은 사람이 하듯 칸을 누르고 목록의
 * 이름을 누른다 — 고른 뒤 칸에 그 이름이 서고 목록이 닫히는 것까지가 한 걸음이다.
 */
async function choosePerson(page: Page, side: '첫 번째' | '두 번째', name: string): Promise<void> {
  const box = page.getByRole('combobox', { name: side });
  await box.click();
  await page.getByRole('listbox', { name: side }).getByRole('option', { name, exact: true }).click();
  await expect(box).toHaveValue(name);
  await expect(box).toHaveAttribute('aria-expanded', 'false');
}

/**
 * 저장한 사람을 **한도 너머까지** 넣는다 — 스물 · 백이 들어온 고르는 칸을 재려고(ADR 0102).
 *
 * 한도 10 은 공개 출시에서 걷히고(ADR 0102) 이 시험이 재는 것은 그 뒤의 칸이다. 그래서
 * `leavePersonSlots` 처럼 SQL 로 넣되, `person_limit` 트리거를 **이 트랜잭션에서만** 끈다
 * (`session_replication_role = replica` 를 `set local` 로). 한도를 옮기는 일이 아니다 —
 * 제품의 `person_limit()` 은 그대로이고, 다른 시험은 이 계정을 못 본다.
 *
 * 사람은 이 계정의 「어머니」를 본떠 만든다 — 명식이 온전해야 행이 서고, 자기 사주와
 * 같은 명식이면 궁합을 열 때 같은 사람인지 묻는 물음(ADR 0034)이 끼어든다.
 */
function saveManyPeople(email: string, names: readonly string[]): Map<string, string> {
  const labels = names.map((name) => `'${name.replace(/'/g, "''")}'`).join(', ');
  sql(`
    begin;
    set local session_replication_role = replica;
    with here as (
      select id as user_id from auth.users where email = '${email}'
    ),
    model as (
      select p.* from public.person p
      join public.user_person_access a on a.person_id = p.id
      where a.user_id = (select user_id from here) and a.local_label = '어머니'
    ),
    made as (
      insert into public.person (
        calendar, original_date, solar_date, birth_time, gender, city,
        late_night_rule, time_basis, input_version, current_chart, chart_engine_version)
      select
        calendar, original_date, solar_date, birth_time, gender, city,
        late_night_rule, time_basis, input_version, current_chart, chart_engine_version
      from model, generate_series(1, ${names.length})
      returning id
    ),
    numbered as (
      select id, row_number() over () as n from made
    )
    insert into public.user_person_access (user_id, person_id, local_label, role)
    select (select user_id from here), numbered.id, wanted.label, 'owner'
    from numbered
    join unnest(array[${labels}]) with ordinality as wanted(label, n) using (n);
    commit;`);

  const rows = sql(`
    select a.local_label || '|' || a.person_id
    from public.user_person_access a join auth.users u on u.id = a.user_id
    where u.email = '${email}'`);
  return new Map(
    rows
      .split('\n')
      .filter((row) => row !== '')
      .map((row) => row.split('|') as [string, string]),
  );
}

/**
 * 궁합의 첫 걸음을 **적어 넣어** 지나간다 — 여러 시험이 이 걸음을 함께 쓴다.
 *
 * 칸마다 어디서 올지를 고르는 화면이라(ADR 0054), 직접 적으려면 그 칸을 먼저
 * 「직접 입력」으로 돌린다. 저장한 사람이 없는 계정에서는 이미 그 모양이지만 **이
 * 시험들의 계정은 「어머니」를 들고 있다** — 화면이 고르는 칸에서 시작한다.
 */
async function typeInto(
  page: Page,
  side: '첫 번째' | '두 번째',
  { name, date, time }: { name: string; date: string; time: string },
): Promise<void> {
  const card = slotCard(page, side);
  await card.getByRole('button', { name: '직접 입력' }).click();

  await fillBirthDate(card, date);
  await fillBirthTime(card, time);
  // 이름을 채우면 묶음의 이름이 그 이름으로 바뀐다 — 그래서 마지막이다.
  await card.getByLabel('이름', { exact: true }).fill(name);
}

test.describe('로그인한 사람의 궁합 화면', () => {
  /**
   * 궁합의 첫 걸음은 한 주소에 입력 두 벌을 싣는다. 접두사가 섞이면 상대의 생일로 내
   * 사주가 나오므로, 눌러서 넘어간 화면의 두 명식이 적은 대로인지가 본론이다.
   *
   * **결과는 다음 화면이다**(ADR 0054). 고르는 자리와 결과가 한 화면에 쌓여 있었는데,
   * 저장한 사람에서 고른 쪽은 처음부터 화면이 갈려 있었다 — 둘을 같은 모양으로 세운다.
   */
  test('적어 넣은 두 사람이 그대로 명식 화면에 선다', async ({ page, signedIn }) => {
    expect(signedIn.label).not.toBe('');
    const consoleErrors: string[] = [];
    page.on('console', (message) => {
      if (message.type() === 'error') consoleErrors.push(message.text());
    });

    await page.goto('/compat');

    /*
      **씨앗의 자기 사주와 같은 명식이면 물음이 먼저 선다**(ADR 0034). 시각만 비켜
      두면 일주는 그대로라(庚辰) 아래에서 재는 것이 안 흔들린다.
    */
    await typeInto(page, '첫 번째', { name: '민수', date: '1990-05-15', time: '11:20' });
    await typeInto(page, '두 번째', { name: '지영', date: '1992-08-20', time: '09:00' });

    /**
     * **사이는 여기서 묻는다**(ADR 0019·0054). 읽기 전에 물어야 뜻이 있고, 다음 화면은
     * 이 답이 정해진 채로 선다 — 거기서 또 물으면 한 흐름이 같은 것을 두 번 묻는다.
     */
    await expect(page.getByText('두 분은 무슨 사이인가요')).toBeVisible();
    await page.getByRole('radio', { name: '가족' }).check();

    await page.getByRole('button', { name: '궁합 보기' }).click();

    await expect(page).toHaveURL(/\/me\/compat\?a=[0-9a-f-]+&b=[0-9a-f-]+$/);
    await expect(page.getByRole('heading', { name: '민수 × 지영' })).toBeVisible();

    /*
      **적은 대로 계산됐는가.** 두 칸이 섞이면 여기서 드러난다 — 첫 사람의 일주가
      두 번째 사람의 것으로 나오거나 그 반대가 된다.
    */
    await expect(page.getByText('庚辰').first()).toBeVisible();
    await expect(page.getByText('戊辰').first()).toBeVisible();

    /*
      **분석 표는 접혀 있다**(ADR 0035). 관계 표는 우리가 대조하는 값이라 사용자 앞에
      먼저 서지 않는다. 접는 것이지 자르는 것이 아니다 — `toContainText` 는
      `textContent` 를 보므로 접힌 안쪽까지 센다.
    */
    const analysis = page.getByText('두 사주를 맞대어 본 표');
    await expect(analysis).toBeVisible();
    await expect(page.getByRole('heading', { name: '두 사주 사이의 관계' })).toBeHidden();
    await expect(page.locator('main')).toContainText('두 사주 사이의 관계');

    /*
      **펼침을 실제로 눌러 본다.** 마크업만 재는 검사는 태그 한 겹에 조용히 0을 낸다 —
      접힌 것과 아예 없는 것이 같은 답을 내면 이 검사는 아무것도 안 지킨다.
    */
    await analysis.click();
    await expect(page.getByRole('heading', { name: '두 사주 사이의 관계' })).toBeVisible();
    await expect(
      page.getByRole('heading', { name: '두 사람 사이에 대해 말할 수 있는 것' }),
    ).toBeVisible();

    // 관계 표가 넓어 가로로 흐르기 쉽다 — 펴 놓고 재야 그 표를 재는 것이 된다.
    const overflow = await page.evaluate(() => ({
      client: document.documentElement.clientWidth,
      scroll: document.documentElement.scrollWidth,
    }));
    expect(overflow.scroll).toBeLessThanOrEqual(overflow.client);

    /**
     * **고른 것은 주소에 남는다.** 뒤로 오면 적어 넣은 두 벌이 그대로 서 있어야 한다 —
     * 다시 적게 하면 한 글자 고치려는 사람이 열 칸을 다시 채운다.
     */
    await page.goBack();
    await expect(page).toHaveURL(/\/compat#/);
    const params = sharedParams(page);
    expect(params.get('a.date')).toBe('1990-05-15');
    expect(params.get('b.date')).toBe('1992-08-20');
    expect(params.get('a.hour')).toBe('11:20');
    await expectBirthDate(page.getByRole('group', { name: '민수' }), '1990-05-15');

    expect(consoleErrors).toEqual([]);
  });

  /**
   * 주소가 곧 결과라는 것을 화면이 말해 주지 않으면 아무도 링크를 공유하지 않는다.
   * 버튼이 실제로 지금 주소를 클립보드에 넣는지까지 본다.
   */

  /**
   * **적어 넣은 두 사람이 저장 없이 궁합풀이로 간다.**
   *
   * 이 길은 아무것도 저장하지 않아서 AI 가 없었다 — 시도도 잠금도 풀이권도 대상에
   * 거는데(ADR 0013) 걸 대상이 없었다. 지금은 대상을 만들되 **사람 목록에 안 세운다**
   * (ADR 0053).
   *
   * 여기서 재는 것은 네 걸음이 이어지는가다 — 묻고 · 열고 · 궁합 화면에 그 답이 이미
   * 서 있고 · **사람 목록은 그대로인가.** pgTAP 은 문 하나까지만 알고, 흐름 검사는
   * 브라우저가 만드는 이 걸음을 못 지난다.
   */
  /**
   * **한 칸은 고르고 한 칸은 적는 조합이 진짜 문에 닿는가** — 그리고 저장된 여덟 글자가
   * 엔진이 낸 것과 같은가. 한 시험이 둘을 재는 것은 둘 다 **앱을 띄워야만** 잴 수 있기
   * 때문이다.
   *
   * ## 왜 이 조합인가
   *
   * PostgREST 는 **보낸 키 이름의 집합**으로 서명을 고른다. 이 조합이 운영에서
   * `PGRST202`(함수를 못 찾음)로 떨어져 있었다 — 「고른 사람」 가지가 여덟 글자 두 칸을
   * 안 실어 **26키**로 나갔고, 24인자(옛)·28인자(새) 어느 쪽에도 안 맞았다. 자기 사주를
   * 등록하고 저장한 사람이 한 명 이하인 계정에게는 이 조합이 **화면을 연 그대로의
   * 기본값**이라, 그 사람들에게 궁합은 열리지 않았다.
   *
   * 단위시험이 키 집합을 재지만 거기서는 `rpc` 가 모킹이라 **해석 자체가 안 일어난다.**
   * 서명을 고르는 일은 PostgREST 의 몫이므로 진짜 문에 닿는 자리가 하나 있어야 한다.
   *
   * ## 저장된 값을 화면이 아니라 행에서 읽는다
   *
   * ADR 0071 이 흐름에 요구한 것이 「저장된 스냅샷이 엔진이 내는 여덟 글자와 같은가」다.
   * 화면과 견주면 **「화면 == 엔진」을 재는 것이지 「저장된 값 == 엔진」이 아니다** —
   * 화면은 볼 때마다 다시 계산하므로 저장하는 문이 엉뚱한 값을 앉혀도 옳게 보인다.
   * 그래서 `person` 행을 직접 읽는다. DB 의 `is_chart_snapshot` 은 모양까지만 보고
   * 「이 여덟 글자가 저 입력에서 나왔나」는 끝내 못 본다.
   */
  test('고른 사람과 적어 넣은 사람을 섞어도 궁합이 열리고, 저장된 여덟 글자가 엔진과 같다', async ({
    page,
    signedIn,
  }) => {
    expect(signedIn.label).not.toBe('');
    const typed = { name: '지영', date: '1992-08-20', time: '09:00' };

    await page.goto('/compat');

    /* 첫 칸은 고른다 — 이 계정은 자기 사주와 어머니를 들고 있어 고르는 칸에서 시작한다 */
    await choosePerson(page, '첫 번째', `${signedIn.label} (나)`);
    await typeInto(page, '두 번째', typed);

    await page.getByRole('radio', { name: '가족' }).check();
    await page.getByRole('button', { name: '궁합 보기' }).click();

    /* 26키로 나가면 여기 못 온다 — 문을 못 찾아 고르는 자리에 실패 문구가 대신 선다 */
    await expect(page).toHaveURL(/\/me\/compat\?a=[0-9a-f-]+&b=[0-9a-f-]+$/);
    await expect(
      page.getByRole('heading', { name: `${signedIn.label} × ${typed.name}` }),
    ).toBeVisible();

    const personId = new URL(page.url()).searchParams.get('b') ?? '';
    expect(personId).not.toBe('');

    const stored = JSON.parse(
      sql(`select current_chart from public.person where id = '${personId}'`),
    );
    const version = sql(
      `select chart_engine_version from public.person where id = '${personId}'`,
    );

    expect(stored).toEqual(chartSnapshotOf(chartOf({ ...DEFAULT_QUERY, ...typed }).pillars));
    expect(version).toBe(CHART_ENGINE_VERSION);
  });

  test('적어 넣은 두 사람은 저장 없이 궁합풀이로 건너간다', async ({ page, signedIn }) => {
    expect(signedIn.label).not.toBe('');

    await page.goto('/compat');
    // 첫 칸이 씨앗의 자기 사주와 같은 날이면 같은 명식 물음이 선다(ADR 0034) — 피한다.
    await typeInto(page, '첫 번째', { name: '민수', date: '1991-03-03', time: '11:20' });
    await typeInto(page, '두 번째', { name: '지영', date: '1992-08-20', time: '09:00' });

    await page.getByRole('radio', { name: '가족' }).check();
    await page.getByRole('button', { name: '궁합 보기' }).click();

    await expect(page).toHaveURL(/\/me\/compat\?a=[0-9a-f-]+&b=[0-9a-f-]+$/);
    await expect(page.getByRole('heading', { name: '민수 × 지영' })).toBeVisible();

    /**
     * **고른 사이가 그 쌍에 적혀 있다.** 화면이 그 값을 한 줄로 적으므로, 여기서
     * 「가족」이 보이면 앞 화면의 누름이 실제로 그 값을 적은 것이다.
     */
    await expect(page.locator('main')).toContainText('가족 사이로 읽어 드립니다');

    /*
      **여기서는 다시 안 묻는다**(ADR 0054). 라디오가 또 서면 한 흐름이 같은 것을
      두 번 묻는 셈이고, 사용자는 그것을 서로 다른 두 물음으로 읽는다.
    */
    await expect(page.getByText('두 분은 무슨 사이인가요')).toHaveCount(0);

    // 만드는 버튼은 **여기** 있다. 누르지 않는다 — 누르면 4분과 돈이 든다.
    await expect(page.getByRole('button', { name: '궁합풀이 받기' })).toBeVisible();

    /**
     * **사람 목록은 그대로다.** 궁합을 보려고 만든 둘이 목록에 서면, 사용자는 저장한
     * 적 없는 사람을 목록에서 지우는 일을 떠맡는다. 자리 수도 안 는다 — 이 계정이
     * 들고 있는 것은 여전히 「어머니」 하나다.
     */
    await page.goto('/me/people');
    await expect(page.getByRole('heading', { name: '저장한 사람' })).toBeVisible();
    const list = await page.locator('main').innerText();
    expect(list).not.toContain('민수');
    expect(list).not.toContain('지영');
    expect(list).toContain(`1/${personLimit()}명`);
  });

  /**
   * **풀이를 받은 뒤 사이를 바꾸면, 두 줄이 서로 다른 사이를 말하지 않는다.**
   *
   * 지표는 그 풀이를 잰 사이로 선다(ADR 0113) — 옛 풀이 옆에 새 눈금을 세우지 않는다. 사이 줄은 지금 적어 둔
   * 사이를 말한다 — 다음 풀이가 그 사이로 난다. 둘을 한 줄씩 따로 세우면 「가족 사이로 읽어 드립니다」 위에
   * 「연인·배우자 기준」이 서서, 지금 보는 글이 무슨 사이로 읽혔는지 화면이 두 말을 한다(2026-09-26).
   * 모델은 안 부른다 — 글은 `postgres` 로 심고, 그 글의 눈금만 연인으로 적는다.
   */
  test('풀이를 받은 뒤 사이를 바꾸면 사이 줄이 지금 글의 사이와 다음 풀이의 사이를 갈라 말한다', async ({
    openAs,
  }) => {
    const { page, api } = await openAs({ selfPerson: true });

    await page.goto('/compat');
    await typeInto(page, '첫 번째', { name: '민수', date: '1991-03-03', time: '11:20' });
    await typeInto(page, '두 번째', { name: '지영', date: '1992-08-20', time: '09:00' });
    await page.getByRole('radio', { name: '가족' }).check();
    await page.getByRole('button', { name: '궁합 보기' }).click();
    await expect(page).toHaveURL(/\/me\/compat\?a=[0-9a-f-]+&b=[0-9a-f-]+$/);

    const address = new URL(page.url());
    const started = await api.rpc('start_reading_run', {
      p_kind: 'private',
      p_idempotency_key: `e2e-private-${address.search}`,
      p_person_a: address.searchParams.get('a'),
      p_person_b: address.searchParams.get('b'),
      p_model: 'gpt-e2e',
      p_prompt_version: 'reading-prompt-v1',
    });
    expect(started.error).toBeNull();
    const runId = started.data?.[0]?.run_id as string;
    sql(`select public.save_reading('${runId}'::uuid, '## 연인으로 읽은 글', null, null,
           '{"charts":{}}', '# 역할', 'reading-prompt-v1', 'gpt-e2e', '{}'::jsonb, now())`);
    sql(`update public.reading
           set score_baseline = 70, score_version = '${DISCOVERY_POLICY.version}', score_relation = 'partner'
         where source_run_id = '${runId}'`);

    await page.reload();
    await expect(page.getByText('연인·배우자 기준', { exact: true })).toBeVisible();
    const main = page.locator('main');
    await expect(main).toContainText('지금 글과 점수는 연인·배우자 사이로 읽었습니다');
    await expect(main).toContainText('다음 풀이는 가족 사이로 읽어 드립니다');
  });

  /**
   * **저장 자리가 없어도 궁합은 열린다.**
   *
   * 여기 「자리가 1명분만 남았습니다」가 서 있었다. 궁합에 둘이 필요한데 저장이 관문이던
   * 시절에는 한 자리로 못 하는 일이었기 때문이다 — 그때는 버튼 대신 **무엇을 해야 하는지**
   * 를 세우는 것이 맞았다.
   *
   * 지금은 궁합을 보려고 만든 사람이 목록에 안 서고(`listed`) **자리도 안 쓴다.** 그래서
   * 한 자리만 남은 사람도, 열 자리를 다 쓴 사람도 궁합은 그대로 본다. 자리를 비우라는
   * 말이 다시 여기 서면 그것은 참이 아닌 말이다.
   */
  test('저장할 자리가 모자라도 궁합은 열린다', async ({ page, signedIn }) => {
    leavePersonSlots(signedIn.email, 1);

    await page.goto('/compat#a.name=민수&a.date=1990-05-15&a.hour=11:20&b.name=지영&b.date=1992-08-20&b.hour=09:00');

    await expect(page.getByRole('button', { name: '궁합 보기' })).toBeEnabled();
    await expect(page.getByText('자리가 1명분만 남았습니다')).toHaveCount(0);
    await expect(page.getByRole('link', { name: '사람 탭에서 자리 비우기 →' })).toHaveCount(0);
  });

  /**
   * **반쪽 링크로는 못 넘어간다.** 한 칸만 적힌 주소로 열면 그 칸만 채워지고, 나머지
   * 한 칸을 정하기 전에는 버튼이 안 눌린다 — 남의 사주가 섞여 보일 자리가 없다.
   */
  test('한 사람만 적힌 궁합 주소는 그 칸만 채운다', async ({ page, signedIn }) => {
    expect(signedIn.label).not.toBe('');
    await page.goto('/compat#a.name=민수&a.date=1990-05-15&a.hour=11:20');

    await expectBirthDate(slotCard(page, '첫 번째'), '1990-05-15');
    await expect(page.getByRole('button', { name: '궁합 보기' })).toBeDisabled();
    await expect(page.getByText('두 번째 사람을 골라 주세요')).toBeVisible();
  });

  /**
   * 검증된 사실이 검증 중인 수치보다 먼저 읽혀야 한다 — `docs/product/matching-beta.md`
   * 가 적어 둔 결정이고, 화면에서는 순서가 그 결정의 전부다. 지표 카드를 위로 올리는
   * 변경은 여기서 걸린다.
   *
   * 지표 아래의 부름도 함께 본다. 여기 「관심 있어요」가 서 있었고, 그다음에는 「인연
   * 찾기에서 요청하기」가 섰다 — 둘 다 **AI 궁합으로 가는 길이 없던 시절**의 자리다.
   * 지금은 바로 아래에서 궁합풀이를 만들 수 있으므로, 그 옆에서 「상세 궁합은 두 분이
   * 서로 동의해야 열립니다」라고 말하면 방금 만들 수 있다고 한 것을 못 만든다고 하는
   * 셈이 된다. 인연 찾기는 **모르는 사람과 이어지는 길**이지 이 두 사람을 읽는 길이 아니다.
   */

  test('베타 매칭 지표는 사실 아래에 서고, 그 아래는 궁합풀이로 이어진다', async ({ page, signedIn }) => {
    expect(signedIn.label).not.toBe('');
    await page.goto('/compat#a.name=민수&a.date=1990-05-15&a.hour=11:20&b.name=지영&b.date=1992-08-20&b.hour=09:00');
    await page.getByRole('button', { name: '궁합 보기' }).click();
    await expect(page).toHaveURL(/\/me\/compat\?a=/);

    const analysis = page.getByText('두 사주를 맞대어 본 표');
    await expect(analysis).toBeVisible();
    await expect(page.getByText('궁합 베타', { exact: true })).toBeVisible();
    // 내부 판본 이름은 화면 어디에도 없다(ADR 0026).
    await expect(page.locator('main')).not.toContainText('match-v0');

    const shown = await page.locator('main').innerText();
    expect(shown.indexOf('두 사주를 맞대어 본 표')).toBeLessThan(shown.indexOf('먼저 보이는 신호'));

    /*
      **접힌 것이지 잘린 것이 아니다**(ADR 0035). 눌러서 안에 든 것을 본다 — 자료는
      응답에 그대로 실려 있고, 갈린 것은 **먼저 서는가**뿐이다.
    */
    await analysis.click();
    await expect(page.getByRole('heading', { name: '두 사주 사이의 관계' })).toBeVisible();

    // 받지 않는 신청을 받는 것처럼 보이던 버튼도, 그것을 대신했던 링크도 없다.
    await expect(page.getByRole('button', { name: '관심 있어요' })).toHaveCount(0);
    await expect(page.getByRole('link', { name: '인연 찾기에서 요청하기' })).toHaveCount(0);
    await expect(page.locator('main')).not.toContainText('상세 궁합은 두 분이 서로 동의해야');

    // 그 자리는 이제 궁합풀이를 만드는 버튼이 쓴다 — 지표 **아래**다.
    const order = await page.locator('main').innerText();
    expect(order.indexOf('먼저 보이는 신호')).toBeLessThan(order.indexOf('두 사람의 궁합풀이'));
    await expect(page.getByRole('button', { name: '궁합풀이 받기' })).toBeVisible();
  });

  /**
   * **궁합 결과에도 내부 검산 도구는 없다.**
   *
   * 결과 화면 둘 다에서 내렸다(`/` 와 여기). 옮긴 칸은 다시 돌아오기 쉬우므로 두
   * 화면이 각자 지킨다 — 익명 사주 쪽은 `e2e/saju.spec.ts` 가 같은 것을 짚는다.
   *
   * **짚는 것은 살아 있는 것만이다.** 여기 「풀이에 넘기는 자료」·「무엇을 시킬 것인가」가
   * 함께 있었는데 둘 다 2026-09-06 에 제품을 떠난 문구라(`b7b0fed`) 그 뒤로는 무엇을
   * 그려도 통과했다. 낱말마다 단언이 따로 서므로, 옆에 살아 있는 낱말이 있다고 죽은
   * 것이 반증 가능해지지 않는다(ADR 0079).
   */

  test('궁합 결과에 내부 검산 도구가 서지 않는다', async ({ page, signedIn }) => {
    expect(signedIn.label).not.toBe('');
    await page.goto('/compat#a.name=민수&a.date=1990-05-15&a.hour=11:20&b.name=지영&b.date=1992-08-20&b.hour=09:00');
    await page.getByRole('button', { name: '궁합 보기' }).click();
    await expect(page).toHaveURL(/\/me\/compat\?a=/);

    // 접이칸을 펴 놓고 본다 — 접힌 안쪽까지 훑어야 「어디에도 없다」가 된다.
    await page.getByText('두 사주를 맞대어 본 표').click();
    await expect(page.getByRole('heading', { name: '두 사주 사이의 관계' })).toBeVisible();

    const shown = await page.locator('main').innerText();
    expect(shown).not.toContain('JSON 내려받기');
  });

  /**
   * **저장한 사람이 스물을 넘어도 고르는 칸이 읽힌다**(ADR 0102).
   *
   * 한도 10 은 고르는 칸이 `select` 둘이던 동안 **목록이 읽히는 동안의 수**였다(ADR 0032).
   * 공개 출시에서 그 10 을 걷으므로 칸이 먼저 바뀐다 — 쳐서 좁히고, 키보드로 오르내리고,
   * 주소로 미리 골라져 들어오는 길과 두 칸이 서로를 아는 규칙은 그대로다.
   *
   * 스물넷을 더 넣어 스물여섯에서 잰다. 넣은 행끼리는 `created_at` 이 같아 차례가 안 정해지므로,
   * 차례에 기대지 않고 **지금 선 줄**을 읽어 견준다.
   */
  test('저장한 사람이 많아도 이름을 쳐서 좁히고 키보드로 고른다', async ({ page, signedIn }) => {
    const names = [...Array.from({ length: 20 }, (_, index) => `이웃${index + 1}`), '지영', '지수', '민지', '수정'];
    const ids = saveManyPeople(signedIn.email, names);
    expect(ids.size).toBe(names.length + 2);

    /* 사람 상세 · 목록이 여는 길 — 주소에 담긴 사람이 그 칸에 앉은 채로 선다(ADR 0054) */
    await page.goto(`/compat#b.person=${ids.get('지영')}`);
    const first = page.getByRole('combobox', { name: '첫 번째' });
    const second = page.getByRole('combobox', { name: '두 번째' });
    await expect(first).toHaveValue(`${signedIn.label} (나)`);
    await expect(second).toHaveValue('지영');

    /* 누르면 전부가 선다 — 다른 칸에서 고른 사람(나)만 빠진다 */
    await second.click();
    const list = page.getByRole('listbox', { name: '두 번째' });
    const options = list.getByRole('option');
    await expect(second).toHaveAttribute('aria-expanded', 'true');
    /* listbox 는 닫히면 숨어 역할로는 안 잡힌다 — id 를 지금 쥐어 두고 뒤에서 그 id 로 본다 */
    const listId = (await list.getAttribute('id')) ?? '';
    expect(listId).not.toBe('');
    await expect(second).toHaveAttribute('aria-controls', listId);
    await expect(options).toHaveCount(names.length + 1);
    await expect(options.filter({ hasText: `${signedIn.label} (나)` })).toHaveCount(0);

    /*
      **치지 않고 누르기만 해도 전체가 서고, 스크롤로 고른다.** 한 번에 다섯 줄과 여섯째의 반이
      보인다 — 반쯤 걸친 줄이 더 있다는 것을 말한다. 목록 안에서만 흐르고 화면 밖으로 안 넘친다.
    */
    const rows = await list.evaluate((node) => {
      const first = node.querySelector('[role="option"]') as HTMLElement;
      return { client: node.clientHeight, scroll: node.scrollHeight, row: first.offsetHeight };
    });
    expect(rows.scroll).toBeGreaterThan(rows.client);
    expect(rows.client / rows.row).toBeGreaterThan(5.2);
    expect(rows.client / rows.row).toBeLessThan(5.8);

    await list.evaluate((node) => node.scrollTo({ top: node.scrollHeight }));
    const last = options.last();
    await expect(last).toBeInViewport();
    /*
      목록의 끝이 **보이는 자리 안**이다 — 화면 아래, 휴대폰 폭이면 아래 고정 메뉴의 위.
      화면은 부드럽게 스크롤하므로(`scroll-behavior: smooth`) 멈출 때까지 기다려 잰다.
    */
    const bottomMenu = page.getByRole('navigation', { name: '모바일 내 메뉴' });
    const floor = (await bottomMenu.isVisible())
      ? ((await bottomMenu.boundingBox())?.y ?? 0)
      : (page.viewportSize()?.height ?? 0);
    await expect
      .poll(async () => {
        const box = await list.boundingBox();
        return (box?.y ?? 0) + (box?.height ?? 0);
      })
      .toBeLessThanOrEqual(floor + 1); // 소수점 반 픽셀은 반올림 차이다
    if (test.info().project.name === 'authed-mobile') {
      await page.screenshot({ path: test.info().outputPath('compat-list-mobile.png') });
    }
    await list.evaluate((node) => node.scrollTo({ top: 0 }));

    /* 열려도 화면을 가로로 밀지 않는다 — 목록은 칸 폭 안에서 세로로만 흐른다 */
    const width = await page.evaluate(() => ({
      client: document.documentElement.clientWidth,
      scroll: document.documentElement.scrollWidth,
    }));
    expect(width.scroll).toBeLessThanOrEqual(width.client);
    const listBox = await list.boundingBox();
    expect((listBox?.x ?? 0) + (listBox?.width ?? 0)).toBeLessThanOrEqual(width.client);

    /* 치면 좁혀진다 — 초성만 쳐도 된다(「수정」의 정까지) */
    await second.fill('ㅈ');
    await expect(options).toHaveCount(4);
    await second.fill('지');
    await expect(options).toHaveCount(3);

    /*
      **키보드로 오르내린다.** 친 뒤에는 첫 줄에 서 있고, 초점은 칸에 남은 채 서 있는 줄을
      `aria-activedescendant` 가 가리킨다. 끝에서 한 번 더 누르면 반대 끝으로 돈다.
    */
    await expect(options.nth(0)).toHaveAttribute('aria-selected', 'true');
    await second.press('ArrowDown');
    await expect(options.nth(1)).toHaveAttribute('aria-selected', 'true');
    await expect(second).toHaveAttribute('aria-activedescendant', (await options.nth(1).getAttribute('id')) ?? '');
    const picked = await options.nth(1).innerText();

    await second.press('ArrowUp');
    await second.press('ArrowUp');
    await expect(options.nth(2)).toHaveAttribute('aria-selected', 'true');
    await second.press('ArrowDown');
    await second.press('ArrowDown');
    await expect(options.nth(1)).toHaveAttribute('aria-selected', 'true');
    await second.press('Enter');

    await expect(second).toHaveValue(picked);
    await expect(list).toBeHidden();
    await expect(second).toHaveAttribute('aria-expanded', 'false');

    /* 치다가 물리면 고른 사람이 그대로다 */
    await second.fill('ㅁㅈ');
    await expect(options).toHaveText(['민지']);
    await second.press('Escape');
    await expect(second).toHaveValue(picked);

    /*
      **맞는 사람이 없으면 없다고 말한다** — 펼친 것이 아니다(`aria-expanded=false`). listbox 는
      숨은 채 그대로 있어 `aria-controls` 가 여전히 그것을 가리키고, 문구는 늘 붙어 있는 status 칸이 든다.
    */
    await second.fill('없는이름');
    const status = page.getByRole('status').filter({ hasText: '찾는 사람이 없습니다' });
    await expect(status).toBeVisible();
    await expect(second).toHaveAttribute('aria-expanded', 'false');
    await expect(second).toHaveAttribute('aria-controls', listId);
    await expect(page.locator(`[id="${listId}"]`)).toBeHidden();
    await expect(page.locator(`[id="${listId}"]`)).toHaveAttribute('role', 'listbox');
    expect(await status.getAttribute('id')).not.toBe(listId);

    /* 다시 맞는 이름이 되면 펼친다 */
    await second.fill('수정');
    await expect(second).toHaveAttribute('aria-expanded', 'true');
    await expect(options).toHaveText(['수정']);
    await expect(page.getByText('찾는 사람이 없습니다')).toHaveCount(0);
    await second.press('Escape');

    /* **두 칸이 서로를 안다** — 두 번째에서 고른 사람은 첫 번째 목록에 안 선다 */
    await first.click();
    await expect(
      page.getByRole('listbox', { name: '첫 번째' }).getByRole('option', { name: picked, exact: true }),
    ).toHaveCount(0);
    await first.press('Escape');

    await page.getByRole('button', { name: '궁합 보기' }).click();
    await expect(page).toHaveURL(/\/me\/compat\?a=[0-9a-f-]+&b=[0-9a-f-]+$/);
    await expect(page.getByRole('heading', { name: `${signedIn.label} × ${picked}` })).toBeVisible();
  });

  /**
   * **사람이 적을 때도 지금처럼 선다.** 고를 사람이 없으면 두 칸 다 적는 칸이고, 「저장한
   * 사람」은 눌러도 빈 목록이라 잠겨 있다 — 찾아 고르는 칸은 아예 안 선다.
   */
  test('저장한 사람이 없으면 두 칸 다 적는 칸으로 선다', async ({ page, newcomer }) => {
    expect(newcomer.email).not.toBe('');
    await page.goto('/compat');

    for (const side of ['첫 번째', '두 번째'] as const) {
      await expect(slotCard(page, side).getByRole('button', { name: '저장한 사람' })).toBeDisabled();
      await expect(slotCard(page, side).getByLabel('이름', { exact: true })).toBeVisible();
      await expect(page.getByRole('combobox', { name: side })).toHaveCount(0);
    }
  });

  /**
   * 한 사람(자기 사주)만 있으면 첫 칸에 앉고 두 번째는 적는 칸으로 선다. 두 번째를 고르는
   * 칸으로 돌려도 고를 사람이 없으므로 **빈 상자도 「없다」는 말도 안 선다** — 치지도 않았는데
   * 없다고 말하면 사용자가 무엇을 잘못했는지 찾는다.
   */
  test('저장한 사람이 하나면 첫 칸에 앉고 두 번째는 적는 칸이다', async ({ page, reader }) => {
    await page.goto('/compat');

    await expect(page.getByRole('combobox', { name: '첫 번째' })).toHaveValue(`${reader.account.label} (나)`);
    await expect(page.getByRole('combobox', { name: '두 번째' })).toHaveCount(0);

    await slotCard(page, '두 번째').getByRole('button', { name: '저장한 사람' }).click();
    const second = page.getByRole('combobox', { name: '두 번째' });
    await second.click();
    await expect(second).toHaveAttribute('aria-expanded', 'false');
    await expect(page.getByRole('listbox')).toHaveCount(0);
    await expect(second).toHaveAttribute('aria-controls', /.+/);
    await expect(page.getByText('찾는 사람이 없습니다')).toHaveCount(0);
    await expect(page.getByText('두 번째 사람을 골라 주세요.')).toBeVisible();
  });


  /**
   * 자료만 넘기면 계약은 값으로만 실려 있고, 받는 쪽이 모델이면 **읽히지 않은 채**
   * 지나간다. 그래서 프롬프트를 함께 복사한다.
   *
   * 여기서 보는 것은 문구가 아니라 **경계**다 — 클립보드에 실제로 규칙이 먼저 들어가고
   * 자료가 뒤에 붙는지, 그리고 한 사람일 때 두 사람용 프롬프트가 자리를 차지하지 않는지.
   * 둘 다 브라우저로 눌러야만 보인다.
   */
});

/**
 * 가입 관문 — **문 하나가 앱 안 이동에도 선다**(ADR 0041·0042).
 *
 * 관문이 셋 있다: `proxy.ts` 가 길을 가리키고, `create_self_person` 과
 * `create_managed_person` 이 문장으로 거절하고, 검사식이 마지막으로 막는다. 여기서
 * 재는 것은 **첫째**다 — 사람이 실제로 그 길로 가는가. 나머지 둘은 pgTAP 이 잰다.
 */
test.describe('가입 관문', () => {
  /**
   * **앱 안에서 걸어 다닐 때도 관문이 선다.**
   *
   * `page.goto` 는 전체 적재라 서버가 튕김을 다 처리한다. 실제 사람은 링크를 누르고,
   * 그때는 화면 조각만 오간다 — 관문이 레이아웃에 있던 동안 **그 길에서는 한 번도 안
   * 돌았다.**
   *
   * 그래서 이 시험은 **반드시 눌러서** 간다. `goto` 로 재면 고쳐지기 전에도 통과한다.
   * 누를 자리는 공개 화면의 메뉴다 — 가입이 안 끝난 사람에게는 `/me` 아래가 통째로
   * 닫혀 있어서, 그 안에서 누를 링크가 하나도 없다.
   */
  test('가입을 안 끝냈으면 앱 안 링크로 홈에 가도 가입 화면이 선다', async ({ openAs }) => {
    const newcomer = await openAs({ selfPerson: false, skipSignup: true });

    await newcomer.page.goto('/');
    await expect(
      newcomer.page.getByRole('heading', { name: '출생 정보를 입력해 주세요' }),
    ).toBeVisible();

    await newcomer.page.getByRole('link', { name: '점점 홈' }).first().click();

    await expect(newcomer.page).toHaveURL(/\/signup$/);
    await expect(
      newcomer.page.getByRole('heading', { name: /테스트 코드와 닉네임/ }),
    ).toBeVisible();
  });

  /**
   * **가입 전에는 계정 관리도 안 열린다.**
   *
   * 이름만 없던 시절에는 열어 두었다 — 나가는 길까지 막으면 들어오지도 나가지도 못하기
   * 때문이었다. 지금은 나가는 길이 가입 화면 안에 있다(`SignOutLink`). 관리할 것이 아직
   * 없는 계정에 관리 화면을 여는 것은 빈 화면을 하나 더 만드는 일이다.
   */
  test('가입 전에는 계정 관리도 가입 화면으로 보낸다', async ({ openAs }) => {
    const newcomer = await openAs({ selfPerson: false, skipSignup: true });

    await newcomer.page.goto('/me/settings');

    await expect(newcomer.page).toHaveURL(/\/signup$/);
    await expect(
      newcomer.page.getByRole('button', { name: '다른 계정으로 로그인하기' }),
    ).toBeVisible();
  });

  test('가입 화면의 나가는 길도 로그아웃이 실패하면 그 자리에서 말한다', async ({ openAs }) => {
    const newcomer = await openAs({ selfPerson: false, skipSignup: true });
    await newcomer.page.route('**/auth/v1/logout**', (route) =>
      route.fulfill({ status: 500, contentType: 'application/json', body: '{"message":"unavailable"}' }),
    );
    await newcomer.page.goto('/signup');

    const main = newcomer.page.getByRole('main');
    await main.getByRole('button', { name: '다른 계정으로 로그인하기' }).click();
    await expect(main.getByRole('alert')).toHaveText('로그아웃하지 못했습니다. 다시 시도해 주세요.');
    await expect(main.getByRole('button', { name: '다른 계정으로 로그인하기' })).toBeEnabled();
    await expect(newcomer.page).toHaveURL(/\/signup$/);
  });

  test('이름은 나중에 고칠 수 있고, 고칠 때도 중복 규칙은 같다', async ({ openAs }) => {
    const one = await openAs({ selfPerson: true });
    const two = await openAs({ selfPerson: true });

    await two.page.goto('/me/profile');
    await expect(two.page.getByRole('heading', { name: '프로필' })).toBeVisible();

    /* 남이 쓰는 이름으로 고치려 하면 확인 자리에서 먼저 말한다 */
    await two.page.getByLabel('닉네임').fill(one.account.nickname);
    await two.page.getByRole('button', { name: '중복 확인' }).click();
    await expect(two.page.getByText('이미 쓰고 있는 닉네임입니다.')).toBeVisible();

    /* 그래도 눌러 보면 저장이 거절한다 — 확인은 안내이고 막는 것은 DB 다 */
    await two.page.getByRole('button', { name: '프로필 저장' }).click();
    await expect(two.page.getByText(/저장하지 못했습니다/)).toBeVisible();
  });

  /**
   * **사진 여러 장 — 올리고, 옮기고, 지운다**(G-60).
   *
   * 칸 여섯, 첫 칸이 대표. 보조기기 이름은 운영자가 승인한 글자 그대로다 — 첫 칸 무리는 「대표 사진」,
   * 사진 칸은 「사진 n / 전체, 길게 눌러 옮기기」. 옮기기는 두 길로 잰다 — 키보드 ← 와 길게 눌러 끌기.
   * 주소의 판본(`?v=`)은 장마다 달라서, 어느 장이 어느 칸에 앉았는지를 그 값으로 가른다.
   */
  test('프로필 사진을 여러 장 올리고, 길게 눌러 끌거나 ← → 로 옮기고, × 로 지운다', async ({ openAs }) => {
    const { page } = await openAs({ selfPerson: true });
    await page.goto('/me/profile');

    const lead = page.getByRole('group', { name: '대표 사진' });
    await expect(lead).toBeVisible();

    /*
      **주소가 아니라 그림을 잰다.** 칸의 `src` 는 자리 주소(`/me/photo/{id}/{n}?v=`)라, 옮긴 순서를 먼저 그리는
      순간 서버가 아직 옛 순서일 때 받아 가면 새 주소에 옛 장의 바이트가 1분 캐시된다 — `?v=` 는 맞는데 눈에는
      안 옮겨진 그림이 선다. 그래서 브라우저가 받은 바이트를 주소마다 적어 두고, 칸이 보이는 그림이 그 장인가를 본다.
    */
    /* 누름(서버 액션)이 그림 요청보다 늦게 닿는 망을 흉내 낸다 — 폰의 느린 올림에서는 늘 그렇다 */
    await page.route('**/me/profile', async (route) => {
      if (route.request().method() === 'POST') await new Promise((done) => setTimeout(done, 600));
      await route.continue();
    });
    const bodies = new Map<string, Buffer>();
    page.on('response', async (response) => {
      if (!/\/me\/photo\/[^/]+\/\d\?v=/.test(response.url()) || response.status() !== 200) return;
      bodies.set(new URL(response.url()).pathname + new URL(response.url()).search, await response.body());
    });
    const shownBytes = async (slot: typeof lead) => {
      const src = (await slot.locator('img').getAttribute('src')) ?? '';
      await expect.poll(() => bodies.has(src)).toBe(true);
      return bodies.get(src) ?? Buffer.alloc(0);
    };

    await page.getByLabel('사진 올리기').setInputFiles([
      'public/matching/harin.webp',
      'public/matching/jiwoo.webp',
    ]);

    const first = page.getByRole('button', { name: '사진 1 / 2, 길게 눌러 옮기기' });
    const second = page.getByRole('button', { name: '사진 2 / 2, 길게 눌러 옮기기' });
    await expect(first).toBeVisible();
    await expect(second).toBeVisible();
    await expect(lead.getByRole('button', { name: '사진 1 / 2, 길게 눌러 옮기기' })).toBeVisible();

    const versionAt = async (slot: typeof first) =>
      new URL((await slot.locator('img').getAttribute('src')) ?? '', 'http://x').searchParams.get('v');
    const a = await versionAt(first);
    const b = await versionAt(second);
    expect(a).not.toBe(b);
    const bytesOfA = await shownBytes(first);
    const bytesOfB = await shownBytes(second);
    expect(Buffer.compare(bytesOfA, bytesOfB)).not.toBe(0);

    /* 키보드 — 둘째 장에서 ← 한 번이면 대표가 되고, 초점이 그 장을 따라간다 */
    const saved = () => page.waitForResponse((response) => response.request().method() === 'POST');
    await second.focus();
    const moved = saved();
    await page.keyboard.press('ArrowLeft');
    await expect.poll(() => versionAt(first)).toBe(b);
    await expect(first).toBeFocused();
    expect(Buffer.compare(await shownBytes(first), bytesOfB)).toBe(0);
    expect(Buffer.compare(await shownBytes(second), bytesOfA)).toBe(0);

    /* 서버에도 앉았다 — 다시 열어도 같은 순서다 */
    await moved;
    await page.reload();
    await expect.poll(() => versionAt(first)).toBe(b);

    /*
      길게 눌러 끌기 — 대표를 둘째 칸에 놓으면 처음 순서로 돌아온다. 다시 연 화면은 서버 HTML 로 먼저 서고 누름을
      받는 손은 하이드레이션 뒤에 붙는다 — 그 전에 누르면 아무 일도 없다(모바일에서 세 번에 두 번, 2026-09-26).
    */
    await hydrated(first);
    const from = await first.boundingBox();
    const to = await second.boundingBox();
    if (from === null || to === null) throw new Error('사진 칸이 그려지지 않았다');
    await page.mouse.move(from.x + from.width / 2, from.y + from.height / 2);
    await page.mouse.down();
    await page.waitForTimeout(600);
    await page.mouse.move(to.x + to.width / 2, to.y + to.height / 2, { steps: 8 });
    const movedBack = saved();
    await page.mouse.up();
    await expect.poll(() => versionAt(first)).toBe(a);
    expect(Buffer.compare(await shownBytes(first), bytesOfA)).toBe(0);
    await movedBack;
    await page.reload();
    await expect.poll(() => versionAt(first)).toBe(a);

    /* 대표를 지우면 둘째가 대표가 된다 */
    await lead.getByRole('button', { name: '사진 지우기' }).click();
    const only = page.getByRole('button', { name: '사진 1 / 1, 길게 눌러 옮기기' });
    await expect(only).toBeVisible();
    await expect.poll(() => versionAt(only)).toBe(b);

    /* 그림은 자리 주소로 열린다 — 1번과 옛 주소가 같은 장이다 */
    const userId = new URL((await only.locator('img').getAttribute('src')) ?? '', 'http://x').pathname.split('/')[3];
    const byPosition = await page.request.get(`/me/photo/${userId}/1`);
    const byAlias = await page.request.get(`/me/photo/${userId}`);
    expect(byPosition.status()).toBe(200);
    expect(Buffer.compare(await byPosition.body(), await byAlias.body())).toBe(0);
    expect((await page.request.get(`/me/photo/${userId}/2`)).status()).toBe(404);
  });

  /**
   * **같은 지우기를 두 번 보내도 한 장만 지워진다**(`20261027090000`).
   *
   * 두 탭이 같은 목록(1 · 2 · 3)을 본다. 한 탭이 둘째 장을 지우면 셋째 장이 둘째 자리로 당겨 앉는다. 다른 탭은
   * 아직 옛 목록이라 같은 둘째 칸의 × 를 누른다 — 전에는 그 누름이 당겨 앉은 셋째 장을 지웠다. 지금은 화면이 본
   * 장의 판본을 함께 보내므로 DB 가 그 누름을 흘려보내고, 그 탭은 목록을 다시 받아 남은 두 장을 그린다.
   */
  test('두 탭에서 같은 사진을 지워도 한 장만 지워진다', async ({ openAs }) => {
    const { page } = await openAs({ selfPerson: true });
    await page.goto('/me/profile');

    await page.getByLabel('사진 올리기').setInputFiles([
      'public/matching/harin.webp',
      'public/matching/jiwoo.webp',
      'public/matching/seoyeon.webp',
    ]);
    const slot = (tab: typeof page, n: number, total: number) =>
      tab.getByRole('button', { name: `사진 ${n} / ${total}, 길게 눌러 옮기기` });
    await expect(slot(page, 3, 3)).toBeVisible();

    const versionAt = async (button: ReturnType<typeof slot>) =>
      new URL((await button.locator('img').getAttribute('src')) ?? '', 'http://x').searchParams.get('v');
    const first = await versionAt(slot(page, 1, 3));
    const third = await versionAt(slot(page, 3, 3));

    const other = await page.context().newPage();
    await other.goto('/me/profile');
    await expect(slot(other, 3, 3)).toBeVisible();

    /* 첫 탭이 둘째 장을 지운다 — 셋째 장이 둘째 자리로 당겨 앉는다 */
    const removeSecond = (tab: typeof page) =>
      tab.locator('[data-photo-slot="2"]').getByRole('button', { name: '사진 지우기' }).click();
    await removeSecond(page);
    await expect(slot(page, 2, 2)).toBeVisible();
    await expect.poll(() => versionAt(slot(page, 2, 2))).toBe(third);

    /* 다른 탭은 옛 목록 그대로 같은 칸을 누른다 */
    await expect(slot(other, 3, 3)).toBeVisible();
    const pressed = other.waitForResponse((response) => response.request().method() === 'POST');
    await removeSecond(other);
    await pressed;
    await expect(slot(other, 2, 2)).toBeVisible();
    await expect.poll(() => versionAt(slot(other, 1, 2))).toBe(first);
    await expect.poll(() => versionAt(slot(other, 2, 2))).toBe(third);

    await page.reload();
    await expect(slot(page, 2, 2)).toBeVisible();
    await expect(slot(page, 3, 3)).toHaveCount(0);
    await expect.poll(() => versionAt(slot(page, 2, 2))).toBe(third);
  });
});

/**
 * 공유하기 — **누르는 것과 받는 쪽을 한 시험에서 잇는다.**
 *
 * 흐름 검사(`scripts/check-share.mjs`)가 RPC 와 공개 화면과 미리보기를 이미 잰다.
 * 여기서 재는 것은 그쪽에 손이 없어서 못 재는 셋이다.
 *
 * 1. **버튼이 실제로 서버 액션을 도는가** — 화면이 든 글을 안 보내고 서버가 다시 읽는다.
 * 2. **클립보드에 주소 한 줄만 들어가는가** — 설명이 붙으면 붙여 넣는 자리에서 섞이고,
 *    실기기 카카오톡에서 실제로 그렇게 깨졌다.
 * 3. **거절됐을 때 주소가 서는가** — 아무 일도 안 일어나는 버튼이 가장 나쁘다.
 */
test.describe('사주풀이 공유하기', () => {
  const SHARE = '공유 링크 복사';

  test('풀이가 없으면 공유할 자리도 없다', async ({ page, signedIn }) => {
    expect(signedIn.label).not.toBe('');
    await page.goto('/me/readings/self');

    await expect(page.getByRole('button', { name: SHARE })).toHaveCount(0);
  });

  test('누르면 링크만 복사되고 그 주소가 로그인 없이 열린다', async ({
    page,
    context,
    reader,
    browser,
  }) => {
    expect(reader.runId).not.toBe('');
    await context.grantPermissions(['clipboard-read', 'clipboard-write']);
    await page.goto('/me/readings/self');

    /*
      **손잡이는 하나다.** 제목 옆과 본문 아래에 같은 버튼이 둘 서 있었다 — 글이 길다는
      까닭이었는데, 같은 문 앞에 손잡이가 둘이면 어느 것이 무엇인지 세어 봐야 한다.
      지금은 머리에서 「다시 받기」와 나란히 한 쌍으로 선다(`panel.tsx`).
    */
    await expect(page.getByRole('button', { name: SHARE })).toHaveCount(1);

    /**
     * **누르기 전후로 화면이 안 움직여야 한다.**
     *
     * 버튼 글자가 「공유 링크 복사」에서 「링크를 복사했습니다」로 바뀌고, 한동안은
     * 그 아래 안내 줄까지 새로 섰다 — 잘 된 일이 화면을 흔들면 사용자는 고장으로
     * 읽는다. 말로 고치면 다음에 또 밀리므로 **자리를 값으로 잡아 둔다.**
     */
    const anchor = page.getByText('이 풀이는 어떠셨어요').first();
    const before = {
      button: await page.getByRole('button', { name: SHARE }).first().boundingBox(),
      below: await anchor.boundingBox(),
    };

    await page.getByRole('button', { name: SHARE }).first().click();
    await expect(page.getByRole('button', { name: '복사했습니다' }).first()).toBeVisible();

    const after = {
      button: await page.getByRole('button', { name: '복사했습니다' }).first().boundingBox(),
      below: await anchor.boundingBox(),
    };
    expect(after.button?.width).toBe(before.button?.width);
    expect(after.below?.y).toBe(before.below?.y);

    const copied = (await page.evaluate(() => navigator.clipboard.readText())).trim();

    /**
     * **주소 한 줄이고 그 앞뒤에 아무것도 없다.**
     *
     * 여기가 이 시험의 핵심이다. 공유 시트에 설명을 함께 넘기던 때, 카카오톡이 주소와
     * 설명을 **구분자 없이 이어 붙여** 링크가 그 자리에서 깨졌다. 붙여 넣는 값이
     * 주소뿐이면 어느 앱에서도 그 일이 안 일어난다.
     */
    expect(copied).toMatch(/^https?:\/\/[^\s]+\/share\/readings\/[0-9a-f]{32}$/);

    /**
     * **쿠키 없는 창에서 연다.** 같은 창에서 열면 로그인한 사람이 여는 것이라,
     * 「로그인 없이 열린다」를 한 번도 안 재고 지나간다.
     */
    const guest = await browser.newContext();
    const theirs = await guest.newPage();
    await theirs.goto(copied);

    await expect(theirs.getByText('브라우저가 읽을 글입니다')).toBeVisible();
    await expect(theirs.getByRole('link', { name: '로그인하고 시작하기' }).first()).toBeVisible();
    /* 원본 사용자의 자리는 하나도 안 선다 */
    await expect(theirs.getByRole('button', { name: '사주풀이 다시 받기' })).toHaveCount(0);
    await expect(theirs.getByText('이 풀이는 어떠셨어요')).toHaveCount(0);
    await guest.close();
  });

  /**
   * **저장한 사람의 풀이도 같은 버튼으로 나간다** — 다만 **다른 주소**로.
   *
   * 주소가 갈린 것은 미리보기 그림이 주소마다 상수로 서야 하기 때문이다(ADR 0064).
   * 그래서 여기서 재는 것은 「버튼이 도는가」만이 아니라 **어느 주소가 나오는가**다.
   */
  test('저장한 사람의 풀이는 사람 주소로 나간다', async ({
    page,
    context,
    personReader,
    browser,
  }) => {
    expect(personReader.personId).not.toBe('');
    await context.grantPermissions(['clipboard-read', 'clipboard-write']);
    await page.goto(`/me/readings/${personReader.personId}`);

    await page.getByRole('button', { name: SHARE }).first().click();
    await expect(page.getByRole('button', { name: '복사했습니다' }).first()).toBeVisible();

    const copied = (await page.evaluate(() => navigator.clipboard.readText())).trim();
    expect(copied).toMatch(/^https?:\/\/[^\s]+\/share\/people\/[0-9a-f]{32}$/);

    const guest = await browser.newContext();
    const theirs = await guest.newPage();
    await theirs.goto(copied);
    await expect(theirs.getByText('브라우저가 읽을 글입니다')).toBeVisible();
    await expect(theirs.getByRole('link', { name: '로그인하고 시작하기' }).first()).toBeVisible();

    /**
     * **누구 것인지가 제목에 선다.** 이름이 없으면 링크를 받은 사람은 글을 다 읽고도
     * 「그래서 이게 누구 건데?」라고 묻는다 — 그 답은 본문에 흩어져 있다.
     */
    await expect(theirs.getByRole('heading', { level: 1 })).toHaveText('어머니님의 사주풀이');

    /* 같은 토큰을 내 사주풀이 주소로 열면 안 열린다 — 미리보기가 거짓말을 하는 자리다 */
    const wrong = await theirs.goto(copied.replace('/share/people/', '/share/readings/'));
    expect(wrong?.status()).toBe(404);
    await guest.close();
  });

  test('클립보드가 거절되면 주소를 세워 손으로 긁게 한다', async ({ page, reader }) => {
    expect(reader.runId).not.toBe('');
    /* 잡아 두는 길도 평범한 길도 다 막는다 — 실제로 둘 다 거절되는 브라우저가 있다 */
    await page.addInitScript(() => {
      Object.defineProperty(window, 'ClipboardItem', { configurable: true, value: undefined });
      Object.defineProperty(navigator, 'clipboard', {
        configurable: true,
        value: {
          write: async () => {
            throw new DOMException('막혔습니다', 'NotAllowedError');
          },
          writeText: async () => {
            throw new DOMException('막혔습니다', 'NotAllowedError');
          },
        },
      });
    });
    await page.goto('/me/readings/self');

    await page.getByRole('button', { name: SHARE }).first().click();

    await expect(page.getByRole('alert').first()).toContainText('직접 선택해 복사해 주세요');
    const shown = page.getByLabel('공유 주소').first();
    await expect(shown).toBeVisible();
    await expect(shown).toHaveValue(/\/share\/readings\/[0-9a-f]{32}$/);
  });
});

/**
 * **자바스크립트가 없어도 지도의 원은 길이다** — 그 사람의 타일로 간다(`#person-…`). 타일이 풀이 · 궁합 ·
 * 상세를 전부 링크로 든다. 원이 단추였다면 이 화면에서 아무 일도 안 일어난다.
 */
test.describe('자바스크립트 없이 여는 홈', () => {
  test.use({ javaScriptEnabled: false });

  test('지도의 원을 누르면 그 사람의 타일로 간다', async ({ page, signedIn }) => {
    expect(signedIn.managed).toContain('어머니');
    await page.goto('/me');
    const dot = page.getByRole('region', { name: '관계 지도' }).getByRole('link', { name: /^어머니, 일간/ });
    const target = (await dot.getAttribute('href')) ?? '';
    expect(target).toMatch(/^#person-/);
    await dot.click();
    await expect(page).toHaveURL(new RegExp(`/me${target}$`));
    await expect(page.locator(`li${target}`).getByRole('link', { name: '풀이 받기' })).toBeVisible();
  });
});
