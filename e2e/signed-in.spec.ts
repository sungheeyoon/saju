import { expect, test } from './session';

import { fillBirthDate, fillBirthTime } from './birth-form';

/**
 * 로그인한 사람의 세로 흐름 — **브라우저에서.**
 *
 * 흐름 검사(`scripts/check-*.mjs`)가 이미 같은 길을 지나지만 그쪽은 HTTP 로 본문을
 * 받아 글자를 센다. 그래서 못 재는 것이 셋이다.
 *
 * 1. **누르는 것이 실제로 도는가** — 온보딩 저장도 사람 추가도 클라이언트 컴포넌트다.
 *    본문을 받아 보는 검사에는 그 버튼을 누를 손이 없다.
 * 2. **모바일 화면에서도 같은가** — PRD 가 데스크톱과 모바일 둘 다를 요구한다.
 * 3. **다시 그려지는가** — Server Action 뒤의 `router.refresh()` 는 브라우저에만 있다.
 *
 * 반대로 여기서 재지 않는 것도 분명하다. 권한·RLS·판본 수명주기는 pgTAP 이 재고,
 * RPC 응답의 모양은 흐름 검사가 잰다. 같은 것을 세 층에서 세 번 재면 한 층을 고칠
 * 때마다 세 곳이 깨진다.
 */

test.describe('초대된 사람의 로그인 흐름', () => {
  test('온보딩에서 내 사주를 저장하면 그 자리에서 저장된 명식으로 바뀐다', async ({
    page,
    newcomer,
  }) => {
    await page.goto('/me');

    // 아직 selfPerson 이 없다 — 화면은 계산 결과가 아니라 등록 폼이다.
    await expect(page.getByRole('heading', { name: '내 사주 등록' })).toBeVisible();

    await page.getByLabel('이름').fill(newcomer.label);
    await fillBirthDate(page, '1990-05-15');
    await fillBirthTime(page, '14:30');

    const save = page.getByRole('button', { name: '내 사주로 저장' });
    await expect(save).toBeEnabled();
    await save.click();

    // 저장하면 폼이 사라지고 저장된 입력이 선다. 미리 계산해 보여준 값이 아니다.
    await expect(page.getByRole('heading', { name: '내 사주 등록' })).toBeHidden();
    await expect(page.getByText('1990-05-15')).toBeVisible();
  });

  test('내 사주 화면은 사주풀이 칸을 세우되 여는 것만으로 만들지 않는다', async ({
    page,
    signedIn,
  }) => {
    await page.goto('/me');

    await expect(page.getByText(signedIn.label, { exact: false }).first()).toBeVisible();

    /*
      **US 23-1 · 25 가 걸린 자리다.** 칸은 서고, 아직 없다고 말하고, 버튼만 있다.
      화면을 여는 것으로 모델이 불리면 배포와 새로고침이 결과를 바꾼다.
    */
    await expect(page.getByRole('heading', { name: '나의 사주풀이' })).toBeVisible();
    await expect(page.getByText('아직 만들어 둔 사주풀이가 없습니다')).toBeVisible();
    await expect(page.getByRole('button', { name: '사주풀이 받기' })).toBeVisible();

    /*
      **도구 이름은 제목에 서지 않지만 사라지지도 않는다.** 「AI 해석」이라는 제목을
      내리면서 「누가 썼는가」까지 같이 내려가면, 조립된 문장과 모델이 쓴 글이 한
      화면에서 구별되지 않는다. 그래서 만드는 버튼 옆의 한 줄을 함께 잰다.
    */
    await expect(page.getByText('언어 모델이 씁니다', { exact: false })).toBeVisible();

    // 넘기지 않는 것을 화면이 먼저 말한다(ADR 0008).
    await expect(page.getByText('넣지 않은 값은 나올 수 없습니다', { exact: false })).toBeVisible();

    // 다시 열어도 만들어지지 않는다 — 같은 자리에 같은 문장이 그대로 선다.
    await page.reload();
    await expect(page.getByText('아직 만들어 둔 사주풀이가 없습니다')).toBeVisible();
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
      **실험판은 따로 선다.** 위의 「지금 보낼 프롬프트」를 토글로 갈아 끼우면 기준판이
      무엇이었는지 화면에서 사라지고, 그러면 견주는 사람이 무엇과 무엇을 견주는지 잊는다.
    */
    await expect(
      page.getByRole('heading', { name: '실험용 변형 — 실제 생성에는 쓰지 않습니다' }),
    ).toBeVisible();
    for (const id of ['control', 'recency-check-v1', 'length-v1', 'selection-bridge-v1']) {
      await expect(page.getByText(id, { exact: true })).toBeVisible();
    }

    /*
      **고정 사례는 저장된 판본과 무관하다.** 내 판본 하나로는 「이 변형이 낫다」가 아니라
      「나에게 낫다」만 나오고, 뻔한 문장은 여러 명식을 나란히 놓아야 드러난다.

      그리고 **어느 변형인지는 채점하는 동안 화면에 없다.** 있으면 재는 것이 글이 아니라
      기대가 된다 — 짝은 내보낸 JSON 에서만 열린다.
    */
    await page.goto('/me/reading/inspect?kind=self&case=Q01');
    await expect(page.getByRole('heading', { name: /고정 사례 실험/ })).toBeVisible();

    for (const blind of ['Q01-A', 'Q01-B', 'Q01-C', 'Q01-D']) {
      await expect(page.locator('summary').filter({ hasText: blind })).toBeVisible();
    }
    /*
      **적기 전에 고르게 한다.** 저장해 둔 사례로 돌아오면 화면은 비어 있고, 그 상태에서
      한 칸이라도 적으면 빈 것을 바탕으로 통째로 다시 저장되어 예전 기록이 한 줄로 덮인다.
    */
    await expect(page.getByRole('button', { name: '저장된 채점 이어서' })).toBeVisible();
    await expect(page.getByRole('button', { name: '버리고 새로 시작' })).toBeVisible();
    await expect(page.getByRole('button', { name: '이 사례 기록 복사 (JSON)' })).toHaveCount(0);

    await page.getByRole('button', { name: '버리고 새로 시작' }).click();
    await expect(page.getByRole('button', { name: '이 사례 기록 복사 (JSON)' })).toBeVisible();

    /*
      **짝은 사례별 기록에 없다.** 있으면 첫 사례를 끝내는 순간 남은 넷의 블라인드가
      깨진다 — 차례가 사례마다 섞여 있어도, 정답표를 한 번 본 사람에게는 소용이 없다.
    */
    const sheet = page.locator('fieldset').filter({ hasText: 'Q01-A' });
    for (const variant of ['control', 'length-v1', 'recency-check-v1', 'selection-bridge-v1']) {
      await expect(sheet.getByText(variant)).toHaveCount(0);
    }

    // 셀 수 있는 것은 센다 — 사람이 스무 건을 손으로 세면 몇 개는 틀린다.
    await sheet.getByRole('textbox').first().fill('{"score": null, "markdown": "## 한 줄로"}');
    await expect(sheet.getByText('null', { exact: true })).toBeVisible();

    // 짝은 따로, 접힌 채로 선다.
    await expect(
      page.getByRole('group').filter({ hasText: '짝 공개 — 다섯 사례를 다 채점한 뒤에 여세요' }),
    ).toBeVisible();

    await page.goto('/me/reading/inspect?kind=self');

    // 세 kind 의 몸통도 복사할 수 있다 — 자료 없이 몸통만 고쳐 볼 때의 자리다.
    // 접혀 있으므로 펴고 본다. 접힌 채로 세면 「없다」와 「안 보인다」가 같은 답이 된다.
    await expect(page.locator('summary').filter({ hasText: 'private' })).toBeVisible();
    await page.locator('summary').filter({ hasText: 'match' }).click();
    await expect(page.getByRole('button', { name: '몸통 복사' })).toBeVisible();
  });

  /**
   * **익명 화면이라고 로그아웃된 것이 아니다.**
   *
   * 전체 명식은 익명 화면이 그린다(입력이 `#` 뒤에 실려 서버로 안 가기 때문이다).
   * 그래서 로그인한 사람도 `/` 로 건너오는데, 그 자리에 「로그인」이 서 있으면 화면이
   * 세션이 풀렸다고 말하는 것이 된다 — 회원 메뉴까지 사라져서 돌아갈 길도 없었다.
   *
   * 세션이 실제로 살아 있다는 것도 함께 잰다. 돌아온 `/me` 가 로그인 화면으로 튕기면
   * 헤더만 고친 것이 된다.
   */
  test('전체 명식으로 건너가도 로그인이 풀린 것처럼 보이지 않는다', async ({ page, signedIn }) => {
    expect(signedIn.label).not.toBe('');
    await page.goto('/me');

    await page.getByRole('link', { name: '전체 명식 자세히 보기' }).click();
    await expect(page).toHaveURL(/\/#/);

    // 익명 화면이므로 공개 메뉴가 선다 — 그렇다고 로그인을 권하지는 않는다.
    const header = page.getByRole('banner');
    await expect(header.getByRole('link', { name: '로그인' })).toHaveCount(0);

    const back = header.getByRole('link', { name: '내 자리' });
    await expect(back).toBeVisible();

    await back.click();
    await expect(page).toHaveURL(/\/me$/);
    await expect(page.getByRole('heading', { name: '나의 흐름' })).toBeVisible();
  });

  test('사람을 추가하면 목록에 서고 그 사람과의 수동 궁합이 열린다', async ({ page, signedIn }) => {
    await page.goto('/me/people');

    await expect(page.getByRole('heading', { name: '등록한 사람' })).toBeVisible();
    await expect(page.getByRole('heading', { name: '어머니' })).toBeVisible();

    await page.getByRole('button', { name: '사람 추가' }).click();
    await expect(page.getByRole('heading', { name: '사람 추가' })).toBeVisible();

    const form = page.locator('form, section').filter({ hasText: '사람 추가' }).last();
    await form.getByLabel('이름').fill('친구');
    await fillBirthDate(form, '1991-08-08');
    await fillBirthTime(form, '09:20');
    await form.getByRole('button', { name: '등록', exact: true }).click();

    await expect(page.getByRole('heading', { name: '친구' })).toBeVisible();

    // 스무 명 한도를 세는 것도 이 목록이다(US 18).
    await page.getByRole('link', { name: '저장된 사람끼리 궁합' }).click();
    await expect(page).toHaveURL(/\/me\/compat/);

    await page.getByLabel('첫 번째').selectOption({ label: `${signedIn.label} (나)` });
    await page.getByLabel('두 번째').selectOption({ label: '어머니' });
    await page.getByRole('button', { name: '궁합 보기' }).click();

    await expect(page.getByText('두 원국 사이의 관계')).toBeVisible();
    await expect(page.getByText('현재 저장된 출생정보 기준입니다')).toBeVisible();

    /*
      **내부 지표는 로그인 화면에 서지 않는다.** 점수 자리는 하나이고 그것은 현재
      Reading 의 것이다 — 둘이면 무엇을 믿을지 사용자가 정해야 한다.
    */
    await expect(page.getByText('match-v0')).toHaveCount(0);
    await expect(page.getByText('궁합 베타')).toHaveCount(0);
  });

  test('입력을 고치면 새 판본으로 다시 그린다', async ({ page, signedIn }) => {
    expect(signedIn.label).not.toBe('');
    await page.goto('/me');

    await expect(page.getByText('1990-05-15')).toBeVisible();

    await page.getByRole('button', { name: '생년월일시 고치기' }).click();
    await fillBirthDate(page, '1990-06-20');
    await page.getByRole('button', { name: '새 판본으로 저장' }).click();

    await expect(page.getByText('1990-06-20')).toBeVisible();
    await expect(page.getByText('1990-05-15')).toHaveCount(0);
  });
});
