import { expect, test, type Page } from '@playwright/test';

import { BIRTH_YEAR_MAX } from '@/src/lib/input/query';

import {
  chooseCalendar,
  chooseHourUnknown,
  expectBirthDate,
  fillBirthDate,
  fillBirthTime,
} from './birth-form';

/**
 * 운 표가 서는 판 — **이름으로 좁힌다.**
 *
 * 화면에 `tabpanel` 이 둘이다(용신 후보 · 운 흐름). 이름 없이 짚으면 strict mode 가
 * 물고, 그것은 화면이 깨진 것이 아니라 **검사가 판이 하나뿐이라고 여기고 있었다**는 뜻이다.
 * 판의 이름은 지금 고른 탭에서 온다(`aria-labelledby`).
 */
const fortunePanel = (page: Page) => page.getByRole('tabpanel', { name: /대운|세운|월운/ });

/**
 * 공유된 주소가 든 입력 — **`#` 뒤에서 읽는다.**
 *
 * 쿼리스트링이 아니다. 입력이 서버 로그와 링크 미리보기 크롤러에 닿지 않게 fragment 로
 * 옮겼으므로(`app/hash-query.ts`), 링크가 무엇을 들고 있는지 확인하는 자리도 여기다.
 */
const sharedParams = (page: Page): URLSearchParams =>
  new URLSearchParams(new URL(page.url()).hash.slice(1));

const enterKnownBirth = async (page: Page, name = '민수') => {
  await page.getByLabel('이름', { exact: true }).fill(name);
  await fillBirthDate(page, '1990-05-15');
  await fillBirthTime(page, '14:30');
};

test('입력 전에는 예시 명식을 보여주지 않고 계산 뒤 핵심 탐색을 제공한다', async ({
  page,
}) => {
  const consoleErrors: string[] = [];
  page.on('console', (message) => {
    if (message.type() === 'error') consoleErrors.push(message.text());
  });

  await page.goto('/');

  /* 빈 칸에 세우던 안내는 걷혔다 — 입력 전 화면이 무엇을 **안** 세우는지로 본다 */
  await expect(page.getByRole('heading', { name: '사주팔자' })).toHaveCount(0);

  await enterKnownBirth(page);
  await page.getByRole('button', { name: '사주 결과 보기' }).click();

  await expect(page.getByRole('heading', { name: '사주팔자' })).toBeVisible();
  await expect(page.getByRole('navigation', { name: '결과 바로가기' })).toBeVisible();
  await expect(page.getByRole('heading', { name: '오행 분포' })).toBeVisible();
  await expect(page.getByRole('heading', { name: '신강 · 신약' })).toBeVisible();
  await expect(fortunePanel(page)).toContainText('세운');
  await expect(consoleErrors).toEqual([]);

  /* 일간과 일지의 의미를 가른 화면이 아래 설명에서 다시 합쳐지지 않는다. */
  await expect(page.getByLabel('일주 천간과 지지').getByText('관계 자리')).toBeVisible();

  /*
    같은 庚에서 나온 월덕귀인도 어느 자리의 庚인지 문구 자체가 밝힌다. 카드 열을
    보지 않고 근거만 읽어도 일간과 년간이 서로 다른 적중이라는 것을 알 수 있어야 한다.
  */
  const stars = page.locator('#stars');
  await expect(stars.getByText('일간 庚 · 월지 巳')).toBeVisible();
  await expect(stars.getByText('년간 庚 · 월지 巳')).toBeVisible();
  await expect(stars.getByLabel('신살 전통 분류별 개수')).toHaveCount(0);

  /* 강약의 비율은 한 번만 말한다 — 같은 46.9%를 문장으로 되풀이하지 않는다. */
  await expect(page.getByText(/일간을 돕는 힘은 절반보다/)).toHaveCount(0);

  /*
    **채워지지 않은 슬롯이 화면까지 간 적이 있다.** 격국 문장의 `{kind}` 가
    엔진 쪽 버그로 비어 있었는데, 계약은 그것을 잡을 줄 알면서도 손으로 고른
    명식만 보고 있어서 놓쳤고 브라우저에서야 보였다. 조립기 쪽은 모집단
    시험이 잠갔고(`assemble.test.ts`), 여기서는 **화면에 중괄호가 남는 일이
    없다**만 본다 — 무엇이 새든 이 모양으로 나타난다.
  */
  expect(await page.locator('main').innerText()).not.toMatch(/\{[a-zA-Z]+\}/);

  /*
    **발화 층은 이 화면에 더 이상 서지 않는다.**

    여기서 네 묶음을 재고 있었다 — 오신을 자리로만 부르는가(「기신은 X다」 금지), 표와
    문장이 같은 분포를 보는가, 뿌리의 사실과 판정이 나란히 서는가, 성패를 이름으로
    접지 않는가. 전부 「이 명식에 대해 말할 수 있는 것」 카드를 통해 읽던 것이고,
    **그 카드가 없어졌다** — 익명 화면에서 결과물은 표다(ADR 0025).

    지운다. 여기 남겨 두면 화면에 없는 문자열을 찾다 실패하고, 그 빨간불은 계약이
    깨졌다는 뜻이 아니라 **검사가 옛 화면을 붙들고 있다**는 뜻이 된다. 계약 자체는
    조립기 쪽 말뭉치 시험이 재고 있고, 그 층은 여전히 AI 자료로 나간다.
  */
});

/*
  **금지 표현이 화면까지 나가는 유일한 자리.**

  '합화'는 어느 강도로도 못 쓰는 낱말인데(`FORBIDDEN_CLAIMS` 의 `transformation`),
  化를 판정한 명식에서만 근거가 되어 열린다. 무작위 3000건의 합 1774건 중 34건뿐이라
  기본 e2e 명식에는 천간합조차 없다. 통로가 실제로 열리는 것과, 그 옆에서 **묶이기만
  한 합은 여전히 그렇게 불리는 것**을 한 화면에서 본다 — 관계 표가 '무계합화'라고
  적어 둔 것을 문장이 '합이불화'로 바로잡는 자리다.
*/
test('化를 판정한 명식에서만 합화라고 부른다', async ({ page }) => {
  await page.goto('/');
  await page.getByLabel('이름', { exact: true }).fill('민수');
  await fillBirthDate(page, '1999-10-23');
  await fillBirthTime(page, '22:00');
  await page.getByRole('button', { name: '사주 결과 보기' }).click();

  /*
    **판정만 적고 까닭을 안 적으면 이 카드는 제 일을 안 한 것이다.**

    「합이불화」는 결과의 이름이지 까닭이 아니다. 무게를 옮긴 것과 안 옮긴 것을 한 줄로
    보여 주려고 세운 카드인데 까닭이 빠지면, 읽는 사람은 「왜 이 합은 안 옮겼나」를
    여전히 유도 문장에서 역추적해야 한다.

    까닭을 낱말로 못박지 않는 것은 그것이 엔진의 판정이기 때문이다 — 여기서 잠그는
    것은 **까닭이 서 있다**는 것이고, 어느 까닭인지는 엔진의 골든이 잰다.
    (`TRANSFORMATION_BLOCKER_KO` 가 한동안 아무 데서도 안 쓰인 채 남아 있었다.)

    **펴고 읽는다.** 이 칸은 접혀 있다 — 「왜 이 숫자냐」는 표를 보다가 걸렸을 때 찾는
    물음이라서다. 접힌 것을 `innerText` 는 안 읽으므로, 검사도 사용자가 하는 일을 한다.
  */
  await page.getByText('세력에 반영한 합과 안 한 합').click();
  const shifts = await page.locator('main').innerText();

  /*
    두 판정이 한 칸 안에 나란히 선다 — 옮긴 합과 안 옮긴 합.

    전에는 발화 카드가 이 대조를 문장으로 들었는데(「합화 자리라 두 천간의 무게를
    통째로…」) 그 카드가 없어졌다. 대조 자체는 이 칸이 원래 하던 일이라 여기서 잰다.
  */
  expect(shifts).toContain('만큼 기울임');
  expect(shifts).toMatch(/합이불화 자리: [^)]+\)/);
});

/**
 * 음력 입력 — **부모 세대가 자기 생일을 아는 형식이다.**
 *
 * 폼이 양력만 받으면 상당수가 음력 날짜를 양력 칸에 그대로 적고, 그러면 틀린 사주가
 * 나오는데 화면은 아무 말도 하지 않는다(ADR 0002). 그래서 형식을 묻고, **무엇을
 * 양력으로 잡았는지 계산 전에 보여준다.**
 *
 * 여기서 잠그는 것은 화면에 뜬 그 양력이 **정말로 계산에 들어간 값**이라는 것이다.
 * 변환을 폼과 계산이 따로 하면 둘이 갈릴 수 있는데, 그러면 사용자는 맞는 날짜를
 * 보면서 다른 사주를 받는다.
 */
test('음력으로 넣으면 잡은 양력을 먼저 보여주고 그 날로 계산한다', async ({ page }) => {
  await page.goto('/');

  await page.getByLabel('이름', { exact: true }).fill('엄마');
  await chooseCalendar(page, 'lunar');
  await fillBirthDate(page, '1965-03-12');
  await fillBirthTime(page, '09:00');

  await expect(page.getByText('양력 1965년 4월 13일로 계산합니다')).toBeVisible();

  await page.getByRole('button', { name: '사주 결과 보기' }).click();
  const fromLunar = await page.locator('#chart').innerText();

  // 링크는 음력이라는 것을 함께 든다 — 안 실으면 받은 사람이 양력으로 읽는다.
  expect(sharedParams(page).get('cal')).toBe('lunar');
  expect(sharedParams(page).get('date')).toBe('1965-03-12');

  // 같은 사람을 양력으로 넣으면 같은 여덟 글자가 나온다.
  await page.goto('/');
  await page.getByLabel('이름', { exact: true }).fill('엄마');
  await fillBirthDate(page, '1965-04-13');
  await fillBirthTime(page, '09:00');
  await page.getByRole('button', { name: '사주 결과 보기' }).click();

  expect(await page.locator('#chart').innerText()).toBe(fromLunar);
  expect(sharedParams(page).has('cal')).toBe(false);
});

/**
 * 없는 날은 **이유를 밝히고** 멈춘다.
 *
 * 「변환할 수 없습니다」로 뭉개면 사용자가 무엇을 고쳐야 하는지 모른다. 윤달이 없는
 * 해에 윤달을 고른 것과 표 밖의 해를 넣은 것은 할 일이 서로 다르다.
 */
test('있지도 않은 윤달은 계산하지 않고 어느 윤달이 있는지 말한다', async ({ page }) => {
  await page.goto('/');

  await page.getByLabel('이름', { exact: true }).fill('민수');
  await chooseCalendar(page, 'lunar_leap');
  await fillBirthDate(page, '2019-04-01');

  // Next 의 라우트 안내판도 `role="alert"` 이라 폼 안으로 좁힌다.
  const refusal = page.locator('main').getByRole('alert');
  await expect(refusal).toContainText('2019년에는 윤달이 없습니다');

  // 2017년에는 윤5월이 있다 — 어느 것이 있는지까지 말한다.
  await fillBirthDate(page, '2017-04-01');
  await expect(refusal).toContainText('윤5월');

  /*
    표 밖은 다른 말을 한다 — 그런데 **폼으로는 거기까지 못 간다.**

    연도 목록이 달력에 맞춰 좁혀지므로(음력은 1912년부터) 1905년은 고를 수가 없다.
    그래도 거절 문장이 필요하다: 입력은 주소의 `#` 뒤에서도 들어오고, 그 링크는
    폼이 좁아지기 전에 나갔을 수도 남이 손으로 고쳤을 수도 있다. 그래서 폼이 아니라
    **링크로** 그 자리를 짚는다.
  */
  await page.goto('/#cal=lunar&date=1905-04-01&hour=unknown&gender=female&city=%EC%84%9C%EC%9A%B8&rule=jo&basis=localMean&saeun=2026');

  /*
    **거절은 한 번만 선다.** 음력 표는 2100년까지 덮고 태어난 해는 그보다 좁게 받으니
    범위 밖에서는 두 문장이 동시에 설 수 있었다. 무엇을 어겼는지 사용자가 고르게 두지
    않는다 — 서는 것은 우리가 받기로 한 범위 하나다.
  */
  const refused = page.locator('main').getByRole('alert');
  await expect(refused).toHaveCount(1);
  await expect(refused).toContainText(`1912~${BIRTH_YEAR_MAX}년에 태어난 분만 계산합니다`);
});

/**
 * 태어난 해는 **적는 칸**이고, 범위 밖은 눌러도 안 넘어간다.
 *
 * 목록으로 두면 백 줄을 스크롤해야 하고 흔한 해를 미리 넣어 두면 손대지 않은 사람도
 * 그 해를 고른 것이 된다. 적는 칸은 둘 다 피하는 대신 **없는 해가 들어올 수 있다** —
 * 그래서 막는 자리가 있어야 한다.
 *
 * **막는 자리는 버튼이 아니라 제출이다.** 잠긴 버튼은 왜 안 눌리는지를 묻게 만들고,
 * 그 답을 옆에 늘 적어 두면 아직 아무것도 안 한 사람에게 하는 말이 된다. 그래서 누르게
 * 두고 **누른 뒤에** 이유를 말한다 — 재는 것도 그 순서다.
 */
test('생년월일시는 숫자로 적고 범위 밖이면 눌러도 안 넘어간다', async ({ page }) => {
  await page.goto('/');

  const year = page.getByLabel('출생연도');
  const show = page.getByRole('button', { name: '사주 결과 보기' });
  /* 폼 안에 서는 거절 하나 — 결과 자리의 알림과 섞이지 않게 폼으로 좁힌다 */
  const refusal = page.locator('form').getByRole('alert');
  await page.getByLabel('이름', { exact: true }).fill('민수');

  // 숫자만 들어간다 — 「19o0」 같은 값이 애초에 만들어지지 않는다.
  await year.fill('19o0년');
  await expect(year).toHaveValue('190');

  // 네 자리가 다 적히기 전에는 날짜가 아니다.
  await page.getByLabel('출생월').fill('05');
  await page.getByLabel('출생일').fill('15');
  await fillBirthTime(page, '14:30');

  // **누르기 전에는 아무 말도 안 한다.** 어긴 것이 생기는 시점이 제출이다.
  await expect(refusal).toHaveCount(0);
  await show.click();
  await expect(refusal).toHaveText('생년월일을 입력해 주세요.');

  // 아직 오지 않은 해는 거절한다 — 이유를 말하고 결과는 안 선다.
  const tooLate = BIRTH_YEAR_MAX + 1;
  await year.fill(String(tooLate));
  await show.click();
  await expect(refusal).toHaveText(
    `1900~${BIRTH_YEAR_MAX}년에 태어난 분만 계산합니다: ${tooLate}년`,
  );
  await expect(page.getByRole('heading', { name: '사주팔자' })).toHaveCount(0);

  // 경계는 열려 있다 — 고치면 거절이 스스로 사라진다.
  await year.fill(String(BIRTH_YEAR_MAX));
  await expect(refusal).toHaveCount(0);

  /*
    **고르는 칸이던 동안에는 「2월 30일」이 만들어질 수가 없었다.** 적는 칸은 그 보호막을
    내주므로 자리마다의 범위를 칸이 안다 — 벗어나면 날짜를 아예 내보내지 않고, 그래서
    제출이 거절한다. 판정하는 자리를 새로 만들지 않고 이미 있는 그 자리에 얹는 것이 요점이다.
  */
  await year.fill('1990');
  for (const [label, bad, good] of [
    ['출생월', '13', '02'],
    ['출생일', '30', '15'],
  ] as const) {
    await page.getByLabel(label).fill(bad);
    await expect(page.getByLabel(label)).toHaveAttribute('aria-invalid', 'true');
    await show.click();
    await expect(refusal).toHaveText('생년월일을 입력해 주세요.');
    await page.getByLabel(label).fill(good);
    await expect(refusal).toHaveCount(0);
  }

  // 2월은 스물여덟까지다 — 그 달의 마지막 날을 칸이 안다.
  await expect(page.getByLabel('출생일')).toHaveAttribute('placeholder', '1~28');

  // 시각도 같다. 25시는 계산으로 흘러가지 않는다.
  await page.getByLabel('출생 시', { exact: true }).fill('25');
  await expect(page.getByLabel('출생 시', { exact: true })).toHaveAttribute('aria-invalid', 'true');
  await show.click();
  await expect(refusal).toHaveText('출생 시각을 입력해 주세요.');
  await page.getByLabel('출생 시', { exact: true }).fill('14');

  await page.getByRole('button', { name: '사주 결과 보기' }).click();
  await expect(page.getByRole('heading', { name: '사주팔자' })).toBeVisible();
});

test('연속 입력, 시간 미상, 진태양시와 운 탭이 함께 동작한다', async ({ page }) => {
  await page.goto('/');
  await enterKnownBirth(page);

  await chooseHourUnknown(page);
  await expect(page.getByLabel('출생 시', { exact: true })).toBeDisabled();
  await expect(page.getByLabel('출생 분')).toBeDisabled();
  await page.getByRole('button', { name: '사주 결과 보기' }).click();
  await expect(
    page.getByLabel('시주 천간과 지지').getByText('출생 시각 모름').first(),
  ).toBeVisible();

  // 라디오는 끌 수 없다 — 반대쪽을 고른다. 그것이 라디오로 바꾼 이유이기도 하다.
  await fillBirthTime(page, '14:30');
  await expect(page.getByText('입력이 바뀌었습니다.', { exact: false })).toBeVisible();
  await page.getByRole('button', { name: '수정한 정보로 다시 보기' }).click();

  // 아무것도 안 고른 사람이 진태양시로 선다 — 고급 설정을 편 적이 없다(ADR 0057).
  await expect(page.getByRole('heading', { name: /적용된 보정.*진태양시/ })).toBeVisible();
  await expect(page.getByText('균시차', { exact: true })).toBeVisible();

  // 기준은 여전히 사용자가 옮긴다 — 옮기면 균시차 줄이 빠진다.
  await page.locator('summary').filter({ hasText: '고급 설정' }).click();
  await page.getByRole('radio', { name: '지방평균태양시' }).check();
  await page.getByRole('button', { name: '수정한 정보로 다시 보기' }).click();
  await expect(page.getByRole('heading', { name: /적용된 보정.*지방평균태양시/ })).toBeVisible();
  await expect(page.getByText('균시차', { exact: true })).toHaveCount(0);

  await page.getByRole('tab', { name: '월운' }).click();
  await expect(fortunePanel(page)).toContainText('월운');
  await page.getByRole('tab', { name: '월운' }).press('ArrowRight');
  await expect(fortunePanel(page)).toContainText('대운');
});

test('명식을 바꾼 사주년과 자시 이동은 접지 않고 바로 알린다', async ({ page }) => {
  await page.goto('/#date=2025-01-15&hour=23:59');

  const notice = page.getByLabel('명식을 바꾼 입력 안내');
  await expect(notice).toContainText('사주년 2024년');
  await expect(notice).toContainText('달력연도 2025년과 다릅니다');
  await expect(notice).toContainText('일주를 다음 날로 넘겼습니다');
});

/**
 * 표가 짚은 **「현재」가 언제인지** 화면이 말하는가.
 *
 * 「지금의 운」 카드가 이 문장을 들고 있었다. 카드는 없어졌지만 사실은 그대로다 —
 * 표마다 「현재」 표시가 붙고, 그 표시를 정하는 것은 제출한 순간의 시각이다. 적지
 * 않으면 어제 열어 둔 탭이 오늘의 운으로 읽히고, 링크를 받은 사람은 남의 어제를
 * 자기 지금으로 읽는다.
 *
 * **겹침 칸도 여기서 잰다.** 카드에서 유일하게 살아남은 칸이고(다른 데서 안 말한다),
 * 겹칠 것이 있는 명식에서만 선다.
 */
test('운 표는 기준 시각을 밝히고 원국을 다시 밟는 자리를 따로 세운다', async ({ page }) => {
  const consoleErrors: string[] = [];
  page.on('console', (message) => {
    if (message.type() === 'error') consoleErrors.push(message.text());
  });

  await page.goto('/');
  await enterKnownBirth(page);
  await page.getByRole('button', { name: '사주 결과 보기' }).click();

  const fortune = page.locator('#fortune');
  const text = await fortune.innerText();

  // 기준 시각. 지금이 언제인지는 브라우저가 정하므로 모양만 본다.
  expect(text).toMatch(/\d{4}년 \d{1,2}월 \d{1,2}일 \d{1,2}시 \d{1,2}분 기준으로 짚었고/);
  // 스스로 갱신되는 것처럼 말하지 않는다 — 오래 열어 둔 탭을 신선한 것으로 읽게 된다.
  expect(text).toContain('다시 제출하기 전까지는 이 기준 시각이 바뀌지 않습니다');
  // 한 번만 선다. 표를 갈아 끼워도 되풀이되면 각주가 본문이 된다.
  expect(text.match(/기준으로 짚었고/g)).toHaveLength(1);

  /*
    **겹침 칸은 표 위에 따로 선다.** 원국에 이미 걸려 있던 관계를 운이 다시 밟는 것은
    표 안에 흩어져 있어서, 줄이 스물에 가까우면 그 짝을 아무도 못 맞춘다.
  */
  await expect(
    fortune.getByRole('heading', { name: '지금이 원국의 같은 자리를 다시 밟는 것' }),
  ).toBeVisible();
  expect(text).toMatch(/원국 [년월일시]주.*의 같은 자리를 다시 밟습니다/);

  // 표는 그대로 아래에 있다.
  await expect(page.getByRole('heading', { name: '운 흐름' })).toBeVisible();
  await expect(page.getByRole('tab', { name: '세운' })).toBeVisible();

  expect(consoleErrors).toEqual([]);
});

/**
 * 시간을 모르면 **대운수가 흔들린다** — 그 사실은 대운 표가 든다.
 *
 * 「지금의 운」 카드가 「후보로 봅니다」로 한 번 더 말했었다. 카드가 없어지면서 그 고지가
 * 사는 자리는 대운 표 하나가 됐다 — 흔들리는 것이 그 표의 값이므로 거기가 맞는 자리다.
 */
test('시간 미상이면 대운 표가 대운수가 흔들린다고 말한다', async ({ page }) => {
  await page.goto('/');
  await page.getByLabel('이름', { exact: true }).fill('민수');
  await fillBirthDate(page, '1990-05-15');
  await chooseHourUnknown(page);
  await page.getByRole('button', { name: '사주 결과 보기' }).click();

  await page.getByRole('tab', { name: '대운' }).click();

  await expect(fortunePanel(page)).toContainText(
    '출생 시각을 몰라 정오 기준으로 계산해 대운수가 두어 달 흔들립니다',
  );
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
  await page.getByRole('button', { name: '사주 결과 보기' }).click();

  /* 기준 시각은 이제 「운 흐름」 카드의 머리에 선다 — 그 표들이 「현재」를 짚는 근거다 */
  const asOf = async () =>
    (await page.locator('#fortune').innerText()).match(/(\d+년 \d+월 \d+일 \d+시 \d+분) 기준/)?.[1];

  expect(await asOf()).toBe('2026년 8월 17일 10시 0분');

  await page.clock.fastForward('05:00:00');

  // 아직 제출하지 않았으므로 그대로다 — 초마다 다시 그리지는 않는다.
  expect(await asOf()).toBe('2026년 8월 17일 10시 0분');

  await page.locator('summary').filter({ hasText: '고급 설정' }).click();
  await page.getByLabel('세운 시작').fill('2030');
  await page.getByRole('button', { name: '수정한 정보로 다시 보기' }).click();
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
  await page.getByRole('button', { name: '사주 결과 보기' }).click();

  await page.getByRole('tab', { name: '대운' }).click();
  const panel = fortunePanel(page);
  const text = await panel.innerText();

  // 칸 안이 세운 표와 같은 모양이다 — 십성·12운성·12신살이 함께 선다.
  expect(text).toContain('천간 십성');
  expect(text).toContain('12운성(일간 기준)');
  // 대운이 원국과 맺는 관계가 실제로 찍힌다.
  expect(text).toMatch(/[가-힣]+(합|충|형|파|해|원진|귀문)/);
  // 세운·월운과 걸리는 것을 어디서 보는지 표가 밝힌다.
  expect(text).toContain('세운·월운과 걸리는 것은 세운·월운 표에 있습니다');

  // 지금 도는 칸이 짚혀 있다. 어느 칸인지는 브라우저의 '지금' 이 정하므로
  // 몇 번째인지 대신 **한 칸만** 짚혔는지를 본다.
  expect(text.match(/현재/g)).toHaveLength(1);

  // 같은 판정이 세운 표에도 서고, 그 값은 한 곳에서 나온다.
  await page.getByRole('tab', { name: '세운' }).click();
  expect((await panel.innerText()).match(/현재/g)?.length ?? 0).toBeLessThanOrEqual(1);

  expect(errors).toEqual([]);
});

/**
 * 세운·월운 표가 **자기를 감싼 대운과 걸리는 것**까지 낸다.
 *
 * 값이 있어도 화면에 안 서면 검증되지 않은 것과 같다. 그리고 여기서만 드러나는 것이
 * 하나 더 있다 — 대운과 걸린 줄이 원국과 걸린 줄과 **같은 모양으로 서면** 읽는 사람은
 * 둘을 구별할 길이 없다. 딱지가 실제로 붙는지는 브라우저로 눌러야 보인다.
 */
test('세운·월운 표가 대운과 걸리는 것을 딱지와 함께 낸다', async ({ page }) => {
  const errors: string[] = [];
  page.on('console', (message) => {
    if (message.type() === 'error') errors.push(message.text());
  });

  await page.goto('/');
  await enterKnownBirth(page);
  await page.getByRole('button', { name: '사주 결과 보기' }).click();

  const panel = fortunePanel(page);

  // 세운 — 머리에 몇 대운을 지나는지가 서고, 대운과 걸린 줄에 딱지가 붙는다.
  await page.getByRole('tab', { name: '세운' }).click();
  const saeun = await panel.innerText();

  expect(saeun).toMatch(/\d대운/);
  expect(saeun).toMatch(/[가-힣]+(합|충|형|파|해|원진|귀문) · 대운/);
  expect(saeun).toContain('원국과 그 해를 감싼 대운');

  // 월운 — 세운과 대운 두 딱지가 다 설 수 있다. 적어도 대운 쪽은 선다.
  await page.getByRole('tab', { name: '월운' }).click();
  const wolun = await panel.innerText();

  expect(wolun).toContain('원국과 세운과 대운');
  expect(wolun).toMatch(/[가-힣]+(합|충|형|파|해|원진|귀문) · (세운|대운)/);

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
  await page.getByRole('button', { name: '사주 결과 보기' }).click();
  await expect(page.getByRole('heading', { name: '사주팔자' })).toBeVisible();

  const shared = page.url();
  expect(Object.fromEntries(sharedParams(page))).toEqual({
    // 이름은 계산에 안 들어가지만 주소에는 실린다 — 링크를 나누면 이름도 나눠진다.
    name: '민수',
    date: '1990-05-15',
    hour: '14:30',
    gender: 'female',
    city: '서울',
    rule: 'jo',
    basis: 'trueSolar',
    saeun: '2026',
  });

  const chart = await page.locator('#chart').innerText();

  await page.goto(shared);
  await expect(page.getByRole('heading', { name: '사주팔자' })).toBeVisible();
  expect(await page.locator('#chart').innerText()).toBe(chart);
  // 폼도 주소를 따라와야 한다. 안 그러면 사용자가 바꾼 적 없는데 '입력이 바뀌었습니다'가 뜬다.
  await expectBirthDate(page, '1990-05-15');
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
  await page.getByRole('button', { name: '사주 결과 보기' }).click();
  await expect(page.getByRole('heading', { name: '사주팔자' })).toBeVisible();

  await page.locator('summary').filter({ hasText: '고급 설정' }).click();
  await page.getByLabel('세운 시작').fill('2030');
  await page.getByRole('button', { name: '수정한 정보로 다시 보기' }).click();
  await expect(page).toHaveURL(/saeun=2030/);

  await page.goBack();
  /* 빈 화면에는 세우는 것이 없다 — 결과가 걷혔는지로 본다 */
  await expect(page.getByRole('heading', { name: '사주팔자' })).toHaveCount(0);
  await expect(page).toHaveURL(/\/$/);
});

/**
 * 이미 뿌려진 `?` 링크를 깨뜨리지 않는다 — 대신 열자마자 `#` 으로 갈아 놓는다.
 *
 * 갈아 놓는 것은 **호환을 위한 것이지 프라이버시를 위한 것이 아니다.** 그 링크가
 * 열리는 한 번의 요청에서 값은 이미 서버에 닿았고 그건 되돌릴 수 없다. 되돌릴 수
 * 있는 것은 이 사용자가 다음에 복사할 링크뿐이다.
 */
test('옛 ? 링크도 그대로 열리고, 주소는 # 으로 갈린다', async ({ page }) => {
  await page.goto('/?name=민수&date=1990-05-15&hour=14:30&gender=female&city=서울&rule=jo&basis=localMean&saeun=2026');

  await expect(page.getByRole('heading', { name: '사주팔자' })).toBeVisible();
  await expectBirthDate(page, '1990-05-15');
  // 주소가 밖에서 바뀌었을 뿐인데 '입력이 바뀌었습니다' 가 뜨면 안 된다.
  await expect(page.getByText('입력이 바뀌었습니다.', { exact: false })).toHaveCount(0);

  // 쿼리스트링은 사라지고 같은 값이 `#` 뒤에 선다.
  await expect(page).toHaveURL(/#/);
  expect(new URL(page.url()).search).toBe('');
  expect(sharedParams(page).get('date')).toBe('1990-05-15');
  expect(sharedParams(page).get('name')).toBe('민수');
});

/**
 * **이 파일에서 가장 중요한 한 건이다** — fragment 로 옮긴 이유가 이것뿐이기 때문이다.
 *
 * 주소가 `#` 을 쓴다는 것만 확인하면 반쪽이다. 확인해야 하는 것은 **제출한 생년월일이
 * 어떤 요청에도 실리지 않는다**는 성질이다. 이게 깨지는 길은 여럿이다 — 누군가 다시
 * 쿼리스트링으로 되돌리거나, 분석 도구가 `location.href` 를 통째로 보내거나, 무심코
 * 서버 컴포넌트로 옮기거나. 셋 다 여기서 잡힌다.
 */
test('제출한 생년월일은 어떤 요청에도 실리지 않는다', async ({ page }) => {
  const requested: string[] = [];
  page.on('request', (request) => requested.push(request.url()));

  await page.goto('/');
  await enterKnownBirth(page);
  await page.getByRole('button', { name: '사주 결과 보기' }).click();
  await expect(page.getByRole('heading', { name: '사주팔자' })).toBeVisible();

  // 주소에는 있다.
  expect(sharedParams(page).get('date')).toBe('1990-05-15');

  // 그런데 서버로 간 것 중에는 없다.
  expect(requested.filter((url) => url.includes('1990-05-15'))).toEqual([]);
  expect(requested.filter((url) => url.includes('14%3A30') || url.includes('14:30'))).toEqual([]);
});

test('결과 링크 복사 버튼이 지금 주소를 클립보드에 넣는다', async ({ page, context }) => {
  await context.grantPermissions(['clipboard-read', 'clipboard-write']);

  await page.goto('/');
  // 입력 전에는 복사할 결과가 없다.
  await expect(page.getByRole('button', { name: '결과 링크 복사' })).toHaveCount(0);

  await enterKnownBirth(page);
  await page.getByRole('button', { name: '사주 결과 보기' }).click();
  await expect(page.getByRole('heading', { name: '사주팔자' })).toBeVisible();

  await page.getByRole('button', { name: '결과 링크 복사' }).click();
  await expect(page.getByRole('button', { name: '복사했습니다' })).toBeVisible();

  const copied = await page.evaluate(() => navigator.clipboard.readText());
  expect(copied).toBe(page.url());
  expect(copied).toContain('date=1990-05-15');
});


/**
 * **넘길 자료는 결과 화면에 없다.**
 *
 * 「프롬프트 + 자료 복사」·「JSON 내려받기」·「붙여 넣을 분량 46KB」·`relations-v1` 은
 * 계약을 검산하는 우리에게 필요한 것이지 사주를 보러 온 사람이 쓰는 것이 아니다.
 *
 * 한동안 `/evidence` 로 옮겨 두었고 그 화면은 이제 없다(ADR 0047) — 내부 검증은
 * `/me/reading/inspect` 하나다. **없앤 것이 다시 돌아오기 쉬우므로** 이 자리가 지킨다.
 */
test('사주 결과에는 넘길 자료 패널이 서지 않는다', async ({ page }) => {
  await page.goto('/#date=1990-05-15&hour=14:30');

  await expect(page.getByRole('heading', { name: '사주팔자' })).toBeVisible();

  const shown = await page.locator('main').innerText();
  for (const word of ['풀이에 넘기는 자료', '무엇을 시킬 것인가', 'JSON 내려받기', 'relations-v']) {
    expect(shown).not.toContain(word);
  }
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
    page.getByLabel('출생연도'),
    page.getByLabel('출생 시', { exact: true }),
    page.getByRole('button', { name: '사주 결과 보기' }),
    /*
      **히어로의 두 갈래도 과녁이다.** 좁은 화면에서 둘을 한 줄에 세우려고 글자와
      여백을 줄였고, 그때 높이가 42px 로 내려갔다 — 이 검사가 이 둘을 안 재고 있어서
      규칙이 깨진 것을 아무도 못 봤다. 화면에서 제일 먼저 누르는 것이 여기 없었다.
    */
    page.getByRole('link', { name: '출생 정보 입력하기' }),
    page.getByRole('link', { name: '궁합 보기', exact: false }),
  ]) {
    /*
      **재기 전에 서 있는지부터 본다.**

      `boundingBox()` 는 기다려 주지 않는다 — 붙어 있어도 아직 자리를 못 잡았으면
      `null` 을 돌려주고, 그러면 `undefined >= 44` 가 되어 검사는 「과녁이 작다」고
      말한다. 실제로는 아직 안 그려진 것이다. 계산기는 `Suspense` 뒤에서 오므로
      이 자리는 언제나 그 경주였고, 그동안 이겨 왔을 뿐이다.
    */
    await expect(control).toBeVisible();

    const box = await control.boundingBox();
    expect(box?.height).toBeGreaterThanOrEqual(44);
  }

  await enterKnownBirth(page);
  await page.getByRole('button', { name: '사주 결과 보기' }).click();
  const pillarDetails = page.getByRole('tablist', { name: '사주팔자 상세 정보' });
  await expect(pillarDetails).toBeVisible();
  for (const tab of await pillarDetails.getByRole('tab').all()) {
    expect((await tab.boundingBox())?.height).toBeGreaterThanOrEqual(44);
  }

  await pillarDetails.getByRole('tab', { name: '12신살' }).click();
  await expect(page.getByRole('tabpanel', { name: '12신살' })).toContainText('년지 기준');
  await expect(page.getByRole('tabpanel', { name: '12신살' })).toContainText('일지 기준');
  await expect(
    page.locator('#chart').getByText('좌우로 넘겨 전체 보기', { exact: false }),
  ).toHaveCount(0);

  const resultOverflow = await page.evaluate(() => ({
    client: document.documentElement.clientWidth,
    scroll: document.documentElement.scrollWidth,
  }));
  expect(resultOverflow.scroll).toBeLessThanOrEqual(resultOverflow.client);

  const starsOverflow = await page.locator('#stars').evaluate((card) => ({
    client: card.clientWidth,
    scroll: card.scrollWidth,
  }));
  expect(starsOverflow.scroll).toBeLessThanOrEqual(starsOverflow.client);
});


/**
 * **로그인 안 한 사람에게 저장 버튼을 세우지 않는다.**
 *
 * `/` 는 공개 화면이라 세션이 없는 방문이 대부분이다. 그 사람에게 「저장하고 사주풀이로
 * 가기」를 세우면 눌러야 거절을 만나고, 그때 이 입구는 있는 것보다 나쁘다. 못 읽은 것과
 * 로그인 안 한 것은 다른 사실이라 화면이 할 말도 다르다.
 */
test('로그인하지 않은 사주 결과에는 저장 버튼 대신 로그인 길이 선다', async ({ page }) => {
  await page.goto('/#date=1990-05-15&hour=14:30');

  await expect(page.getByRole('heading', { name: '사주풀이로 이어 보기' })).toBeVisible();
  await expect(
    page.getByRole('button', { name: '이 사람을 저장하고 사주풀이로 가기' }),
  ).toHaveCount(0);
  await expect(page.getByRole('link', { name: '로그인하기 →' })).toBeVisible();
});
