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

    /*
      **풀이권은 머리글에 선다 — 설정 옆이다.**

      한동안 만드는 버튼과 한 덩어리였다. 「누를지 정할 때 눈이 가 있는 자리」라는
      이유였고 그건 지금도 맞다. 그런데 풀이권은 이 글의 성질이 아니라 **계정의 성질**
      이라, 화면마다 세우면 넷에 같은 숫자가 네 번 서고 그중 하나를 안 고치는 날이 온다.

      그래서 「있다」가 아니라 **머리글 안에 있다**를 잰다. 본문 어딘가로 돌아가면
      이 줄이 빨개진다.
    */
    await expect(
      page.locator('header').getByText('풀이권 5번 중 5번 남음'),
    ).toBeVisible();

    /* 서버 HTML 에는 없다 — 브라우저가 읽는다. 그래서 흐름 검사는 셈만 잰다 */
    await expect(page.getByRole('button', { name: '사주풀이 받기' })).toBeVisible();

    // 다시 열어도 만들어지지 않는다 — 같은 자리에 같은 문장이 그대로 선다.
    await page.reload();
    await expect(page.getByText('아직 만들어 둔 사주풀이가 없습니다')).toBeVisible();
  });

  /**
   * **내 명식 화면에는 이 칸이 없다.**
   *
   * 목록은 selfPerson 을 걸러 내지만 이 주소는 열린다. 칸을 세우면 같은 명식에 글이
   * 둘 서고 같은 자료로 풀이권이 두 번 나간다. 막는 것은 DB 이고, 화면은 그 자리에
   * 어디로 가면 되는지를 세운다 — 못 만드는 버튼을 눌러야 알게 하지 않는다.
   */
  test('내 명식을 저장한 사람으로 열면 풀이 칸 대신 갈 곳을 말한다', async ({
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
    await expect(page.getByText('내 명식의 사주풀이는')).toBeVisible();
    /* 머리글에도 같은 이름의 링크가 있다 — 재려는 것은 본문에 세운 그 길이다 */
    await page.getByRole('main').getByRole('link', { name: '내 사주' }).click();

    await expect(page.getByRole('heading', { name: '나의 사주풀이' })).toBeVisible();
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
    await expect(page.getByText('내 명식의 사주풀이는')).toBeVisible();
  });

  /** 저장된 글이 그 사람의 화면에 실제로 서는가 — 위 시험은 빈 자리까지만 본다 */
  test('저장한 사람의 풀이는 그 사람의 화면에서 읽힌다', async ({ page, personReader }) => {
    await page.goto(`/me/people/${personReader.personId}`);

    await expect(page.getByRole('heading', { name: '어머니의 사주풀이' })).toBeVisible();

    /* 카드 배치라 긴 글이 접혀 있다 — 펼쳐서 그 글이 진짜 저장돼 있는지 본다 */
    await page.getByRole('button', { name: '펼쳐보기 ↓' }).click();
    await expect(page.getByText('어머니의 결')).toBeVisible();

    /* 한 사람짜리라 궁합 점수가 안 선다 */
    await expect(page.getByText('현재 관계 해석 점수')).toBeHidden();

    /* 만든 것이 하나이므로 풀이권도 하나 줄어 있다 — kind 를 안 묻는다 */
    await expect(page.locator('header').getByText('풀이권 5번 중 4번 남음')).toBeVisible();
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
    await page.goto('/me');

    /* `/me` 는 카드 배치라 긴 글이 접혀 있다 — 펼쳐서 그 글이 진짜 저장돼 있는지 본다 */
    await page.getByRole('button', { name: '펼쳐보기 ↓' }).click();
    await expect(page.getByText('브라우저가 읽을 글입니다')).toBeVisible();

    /* 설문은 접힘 밖에 선다 — 읽고 나서 곧바로 묻는 자리다 */
    await expect(page.getByText('이 풀이는 어떠셨어요')).toBeVisible();

    /* **세 가지를 다 고르기 전에는 못 보낸다** — 안 고른 것이 어느 값으로든 저장되면 안 된다 */
    const send = page.getByRole('button', { name: '답 보내기' });
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
   * **저장한 사람의 상세 화면에도 만드는 버튼이 선다.**
   *
   * 이 화면에는 명식 표만 있었다. 엄마의 풀이를 보려면 엄마 × 다른 한 사람 궁합으로
   * 가야 했고, 한 명짜리 길이 없었다.
   *
   * 흐름 검사가 이미 같은 화면을 받아 글자를 세지만, **누르는 손**은 여기에만 있다.
   */
  test('저장한 사람의 상세 화면에서 그 사람의 사주풀이를 받을 수 있다', async ({
    page,
    signedIn,
  }) => {
    const kin = signedIn.managed[0];
    expect(kin).not.toBe(undefined);

    await page.goto('/me/people');
    await expect(page.getByText(kin).first()).toBeVisible();
    /* 목록에 관리 Person 은 이 사람 하나뿐이다 — 이어서 제목으로 누구인지 확인한다 */
    await page.getByRole('link', { name: '사주 상세 보기' }).first().click();

    await expect(
      page.getByRole('heading', { name: `${kin}의 사주`, exact: true }),
    ).toBeVisible();

    /* 제목이 그 사람 이름으로 선다 — kind 로 지어내던 자리다 */
    await expect(page.getByRole('heading', { name: `${kin}의 사주풀이` })).toBeVisible();
    await expect(page.getByText('아직 만들어 둔 사주풀이가 없습니다')).toBeVisible();

    const make = page.getByRole('button', { name: '사주풀이 받기' });
    await expect(make).toBeVisible();

    /* 풀이권은 kind 를 안 묻는다 — 전역 다섯에서 함께 센다 */
    await expect(page.locator('header').getByText('풀이권 5번 중 5번 남음')).toBeVisible();

    /*
      **여는 것만으로는 아무것도 안 만든다.** 다시 열어도 같은 자리에 같은 문장이 선다 —
      화면을 여는 것이 요금이 되면 새로고침이 곧 비용이다.
    */
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
    for (const id of ['control', 'longer-v1', 'recency-check-v1', 'legacy-v1']) {
      await expect(page.getByText(id, { exact: true })).toBeVisible();
    }

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

    // 공개 계산 화면에서도 로그인 상태에 맞는 내 메뉴가 선다.
    const header = page.getByRole('banner');
    await expect(header.getByRole('link', { name: '로그인' })).toHaveCount(0);

    const back = header.getByRole('link', { name: '내 사주' });
    await expect(back).toBeVisible();

    await back.click();
    await expect(page).toHaveURL(/\/me$/);
    await expect(page.getByRole('heading', { name: '내 사주' })).toBeVisible();
  });

  test('사람을 추가하면 목록에 서고 그 사람과의 수동 궁합이 열린다', async ({ page, signedIn }) => {
    await page.goto('/me/people');

    await expect(page.getByRole('heading', { name: '저장한 사람' })).toBeVisible();
    await expect(page.getByRole('heading', { name: '어머니' })).toBeVisible();

    await page.getByRole('button', { name: '사람 추가' }).click();
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

    await friendCard.getByRole('link', { name: '사주 상세 보기' }).click();
    /*
      `exact` 를 안 주면 **두 개를 잡는다.** 같은 화면에 「친구의 사주풀이」가 함께
      서면서 「친구의 사주」가 그 부분 문자열이 됐다. 이름을 쓰는 제목이 하나 늘면
      이런 자리가 조용히 생긴다.
    */
    await expect(
      page.getByRole('heading', { name: '친구의 사주', exact: true }),
    ).toBeVisible();
    await expect(page.getByRole('heading', { name: '사주팔자' })).toBeVisible();
    await page.getByRole('link', { name: '사람 목록으로' }).click();

    // 스무 명 한도를 세는 것도 이 목록이다(US 18).
    await page.getByRole('link', { name: '저장한 사람으로 궁합 보기' }).click();
    await expect(page).toHaveURL(/\/me\/compat/);

    /*
      **무슨 사이인지는 고르는 칸 옆에서 묻는다.** 관계를 묻는 까닭이 「사이에 따라
      해석의 방향을 달리 잡겠다」는 것이라, 읽고 난 뒤에 묻는 것은 아무 뜻이 없다.
    */
    await expect(page.getByText('두 분은 무슨 사이인가요')).toBeVisible();
    await expect(page.getByText('점수에는 쓰지 않습니다')).toBeVisible();

    await page.getByLabel('첫 번째').selectOption({ label: `${signedIn.label} (나)` });

    /*
      **두 칸이 서로를 안다.** 첫 번째에서 고른 사람은 두 번째 목록에서 빠진다 —
      같은 사람 둘을 고를 수 있게 두면 누르고 나서야 거절을 만난다.
    */
    await expect(page.getByLabel('두 번째').locator('option')).not.toContainText([
      `${signedIn.label} (나)`,
    ]);

    await page.getByLabel('두 번째').selectOption({ label: '어머니' });
    await page.getByRole('radio', { name: '가족' }).check();
    await expect(page.getByRole('radio', { name: '가족' })).toBeChecked();

    /*
      **누르지 않는다.** 이 버튼은 이제 모델을 부른다 — 시험이 누르면 4분과 돈이 든다.
      여기서 재는 것은 배선이 아니라 **고르는 자리가 무엇을 묻는가**이고, 배선은
      흐름 검사와 단위 시험이 잰다.
    */
    await expect(page.getByRole('button', { name: '궁합 보기' })).toBeEnabled();

    /*
      **본 적 없으면 목록도 없다.** 처음 온 사람에게 빈 목록은 할 일이 하나 더 있는
      것처럼 보이는데, 고르는 칸이 이미 그 말을 하고 있다.
    */
    await expect(page.getByRole('heading', { name: '본 궁합' })).toHaveCount(0);
    await expect(page.getByText('궁합 베타')).toHaveCount(0);
  });

  test('계정 작업은 우측 설정 메뉴의 계정 관리에 모여 있다', async ({ page, signedIn }) => {
    expect(signedIn.label).not.toBe('');
    await page.goto('/me');

    await page.locator('summary[aria-label="설정 메뉴"]').click();
    await page.getByRole('link', { name: '계정 관리' }).click();

    await expect(page.getByRole('heading', { name: '계정 관리' })).toBeVisible();
    const account = page.getByRole('main');
    await expect(account.getByRole('button', { name: '로그아웃' })).toBeVisible();
    await expect(account.getByRole('button', { name: '계정 삭제 요청' })).toBeVisible();
  });

  test('입력을 고치면 새 판본으로 다시 그린다', async ({ page, signedIn }) => {
    expect(signedIn.label).not.toBe('');
    await page.goto('/me');

    await expect(page.getByText('1990-05-15')).toBeVisible();

    await page.getByRole('button', { name: '출생 정보 수정' }).click();
    await fillBirthDate(page, '1990-06-20');
    await page.getByRole('button', { name: '변경 사항 저장' }).click();

    await expect(page.getByText('1990-06-20')).toBeVisible();
    await expect(page.getByText('1990-05-15')).toHaveCount(0);
  });
});
