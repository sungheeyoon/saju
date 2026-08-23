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

  /*
    **채워지지 않은 슬롯이 화면까지 간 적이 있다.** 격국 문장의 `{kind}` 가
    엔진 쪽 버그로 비어 있었는데, 계약은 그것을 잡을 줄 알면서도 손으로 고른
    명식만 보고 있어서 놓쳤고 브라우저에서야 보였다. 조립기 쪽은 모집단
    시험이 잠갔고(`assemble.test.ts`), 여기서는 **화면에 중괄호가 남는 일이
    없다**만 본다 — 무엇이 새든 이 모양으로 나타난다.
  */
  expect(await page.locator('main').innerText()).not.toMatch(/\{[a-zA-Z]+\}/);

  /*
    **오신은 자리로만 부른다.** 「기신은 X다」와 「X가 기신 자리에 온다」를 가르는
    것이 계약의 `onlyBefore` 한 낱말인데, 그 규칙이 지키는 것은 결국 화면에 찍히는
    글자다. 자리 이름이 실제로 서 있는지와, 동일시가 새어 나오지 않았는지를 함께
    본다 — 조각 쪽은 말뭉치 시험이 잠그지만 여기가 사람이 읽는 문자열이다.
  */
  const said = await page.locator('main').innerText();
  expect(said).toContain('기신 자리');
  expect(said).not.toMatch(/기신은|기신이다|기신입니다/);

  /*
    **표와 문장이 다른 분포를 세고 있었다.** 오행 분포 표는 글자를 그대로 센 것을
    보이는데(외부 만세력과 바로 대조하려고 그렇게 뒀다), 세력을 재는 문장들은 국으로
    옮긴 뒤의 분포를 본다. 무작위 3000건의 78.3% 에서 무게가 움직이고 그중 11.2% 는
    가장 무거운 오행이 아예 갈리는데, 화면은 그 사실을 한 번도 말하지 않았다.
    이 명식(1990-05-15 14:30)에는 사유 반합이 서 있다.
  */
  expect(said).toMatch(/무게의 \d+% 정도가/);
  expect(said).toContain('세력을 말하는 문장들은 옮긴 뒤를 봅니다');

  /*
    **같은 뿌리를 두고 사실과 판정이 나란히 선다.** 뿌리 표는 「질은 매기지 않는다」가
    정책이라(`ROOTEDNESS_POLICY.quality`) 자리만 늘어놓는데, 그 뿌리가 국에 끌려가
    있는 것은 말하지 않는다. 이 명식은 월주 뿌리 하나가 정확히 그 자리다 — 두 줄이
    같은 화면에 함께 서는 것이 「세는 일」과 「쓸 몫을 재는 일」을 가른 이유다.
  */
  expect(said).toContain('뿌리를 둡니다');
  expect(said).toContain('뿌리로 세는 것은 그대로이고 여기서는 쓸 몫만 덜어 봅니다');

  /*
    **성패는 접지 않고 이름을 그대로 든다.** 격 이름 다음에서 문장이 끊겨 있던
    자리인데, 이룸과 깨짐은 조건의 목록이라 「성격/파격」 한 낱말로 접으면 반올림이
    된다. 조건이 어느 쪽으로 걸렸는지까지만 말하고 결론은 이름으로 안 부른다 —
    `STRUCTURE_OUTCOME_KO` 의 '성격'은 사주 화면에서 사람의 성격으로 읽힌다.
  */
  // 이 명식은 조건이 하나도 안 걸리는 쪽(3000건의 15.5%)이다. 네 변종이 다
  // 「이루는 조건」·「깨는 조건」이라는 말로 서므로 어느 쪽이 서든 걸린다.
  expect(said).toMatch(/이루는 조건|깨는 조건/);
  expect(said).not.toMatch(/성격 쪽|파격 쪽|격을 이루/);
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
  await page.getByLabel('생년월일', { exact: true }).fill('1999-10-23');
  await page.getByRole('radio', { name: '시각', exact: true }).check();
  await page.getByLabel('출생시각', { exact: true }).fill('22:00');
  await page.getByRole('button', { name: '사주 보기' }).click();

  const said = await page.locator('main').innerText();

  expect(said).toContain('합화 자리라 두 천간의 무게를 통째로');
  expect(said).toContain('합이불화 자리라');
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
  expect(text.match(/지금 도는 대운을 기준으로만 셌습니다/g)).toHaveLength(1);
  // 대운 관계가 실제로 행으로 선다 — 고지가 좁아진 것이 채워졌다는 증거다.
  expect(text).toMatch(/대운 월[간지] /);
  // 대운이 **세운·월운과** 걸리는 행까지 선다. 원국과만 걸리던 것이 채워진 자리다.
  expect(text).toMatch(/대운 월[간지] .*(세운|월운) [년월][간지]/);

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
  // 목록의 한계 둘이 나란히 선다 — 하나는 우리가 고른 기준, 하나는 빠진 입력이다.
  expect(text).toContain('지금 도는 대운을 기준으로만 셌습니다');
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
  await page.getByRole('button', { name: '사주 보기' }).click();

  const panel = page.getByRole('tabpanel');

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

/**
 * 검증된 사실이 검증 중인 수치보다 먼저 읽혀야 한다 — `docs/product/matching-beta.md`
 * 가 적어 둔 결정이고, 화면에서는 순서가 그 결정의 전부다. 지표 카드를 위로 올리는
 * 변경은 여기서 걸린다. 관심 버튼도 함께 본다: 받지 않는 신청을 받는 것처럼
 * 보이지 않기로 했으므로, 눌렀을 때 그렇게 말하는지가 계약이다.
 */
test('베타 매칭 지표는 사실 아래에 서고, 관심 버튼은 받지 않는다고 말한다', async ({ page }) => {
  await page.goto('/compat?a.date=1990-05-15&a.hour=14:30&b.date=1992-08-20&b.hour=09:00');

  const facts = page.getByRole('heading', { name: '두 원국 사이의 관계' });
  await expect(facts).toBeVisible();
  await expect(page.getByText('궁합 베타 · match-v0')).toBeVisible();

  const shown = await page.locator('main').innerText();
  expect(shown.indexOf('두 원국 사이의 관계')).toBeLessThan(shown.indexOf('먼저 보이는 신호'));

  await page.getByRole('button', { name: '관심 있어요' }).click();
  await expect(page.getByRole('status')).toContainText('신청을 받지 않고');
});

/**
 * 넘길 자료는 **열기 전에는 만들지 않는다.** 두 사람짜리가 들여쓴 JSON 으로
 * 460KB 라 방문마다 만들면 비싸고, 대부분의 방문은 이 칸을 안 연다.
 *
 * 그래서 여기서 보는 것은 「칸이 있다」가 아니라 **「열면 실제로 나온다」**이다.
 * 상한 표가 서고 시각을 아는 명식과 모르는 명식에서 다르게 서는 것까지 본다 —
 * 그 표가 이 자료의 요점이고, 값이 아니라 계약이라 화면 어디에도 없던 것이다.
 */
test('넘길 자료는 열었을 때 상한 표와 함께 선다', async ({ page }) => {
  await page.goto('/compat?a.date=1990-05-15&a.hour=14:30&b.date=1992-08-20&b.hour=09:00');

  const panel = page.getByRole('group').filter({ hasText: 'AI 에 넘길 자료' });
  await expect(panel).toBeVisible();

  // 닫혀 있는 동안에는 자료를 안 만든다 — 표도 버튼도 없다.
  await expect(page.getByRole('button', { name: 'JSON 내려받기' })).toBeHidden();

  await panel.getByText('AI 에 넘길 자료').click();

  await expect(page.getByRole('button', { name: 'JSON 내려받기' })).toBeVisible();
  await expect(panel).toContainText('analysis.eokbu');
  await expect(panel).toContainText('evidence-v0');
  // 안 싣는 것도 이유와 함께 적힌다.
  await expect(panel).toContainText('now');
});

/**
 * 자료만 넘기면 계약은 값으로만 실려 있고, 받는 쪽이 모델이면 **읽히지 않은 채**
 * 지나간다. 그래서 프롬프트를 함께 복사한다.
 *
 * 여기서 보는 것은 문구가 아니라 **경계**다 — 클립보드에 실제로 규칙이 먼저 들어가고
 * 자료가 뒤에 붙는지, 그리고 한 사람일 때 두 사람용 프롬프트가 자리를 차지하지 않는지.
 * 둘 다 브라우저로 눌러야만 보인다.
 */
test('프롬프트를 골라 자료와 함께 복사한다', async ({ page, context }) => {
  await context.grantPermissions(['clipboard-read', 'clipboard-write']);

  await page.goto('/?date=1990-05-15&hour=14:30');

  const panel = page.getByRole('group').filter({ hasText: 'AI 에 넘길 자료' });
  await panel.getByText('AI 에 넘길 자료').click();

  // 한 사람이면 궁합 프롬프트는 아예 없다 — 흐리게 두고 안 먹히는 것보다 낫다.
  await expect(panel.getByRole('button', { name: '궁합' })).toHaveCount(0);
  await expect(panel.getByRole('button', { name: '전부 해석' })).toBeVisible();

  await panel.getByRole('button', { name: '지금 도는 운' }).click();
  await panel.getByRole('button', { name: '프롬프트 + 자료 복사' }).click();

  const copied = await page.evaluate(() => navigator.clipboard.readText());

  // 규칙이 먼저, 자료가 뒤. 순서가 뒤집히면 긴 JSON 을 다 읽고 나서야 규칙을 만난다.
  expect(copied.indexOf('## 딱 하나 금지')).toBeLessThan(copied.indexOf('## 자료'));
  expect(copied).toContain('evidence-v0');
  // 고른 프롬프트가 실제로 실린다 — 지금 도는 운에만 있는 줄이다.
  expect(copied).toContain('crossedFortunes');
  expect(copied).toContain('"viewedAt"');

  // **해석용은 막지 않는다.** 이 줄이 사라지면 모델이 입을 닫고 넘길 이유가 없어진다.
  expect(copied).toContain('막지 않는다');

  // 조인 쪽은 견줄 짝으로 따로 있다.
  await panel.getByRole('button', { name: '상한 지키기' }).click();
  await panel.getByRole('button', { name: '프롬프트 + 자료 복사' }).click();

  const strict = await page.evaluate(() => navigator.clipboard.readText());
  expect(strict).toContain('길흉을 말하지 않는다');
});

test('시각을 모르면 상한 표가 내려앉고 없다는 쪽이 잠긴다', async ({ page }) => {
  await page.goto('/?date=1988-07-15&hour=unknown');

  const panel = page.getByRole('group').filter({ hasText: 'AI 에 넘길 자료' });
  await panel.getByText('AI 에 넘길 자료').click();

  const row = panel.locator('tr').filter({ hasText: 'analysis.elements' });
  await expect(row).toContainText('유도');
  await expect(row).toContainText('말하지 않음');

  // 흔들리지 않는 근거는 두 방향이 같다.
  const pillars = panel.locator('tr').filter({ hasText: /^pillars/ });
  await expect(pillars).toContainText('사실');
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
