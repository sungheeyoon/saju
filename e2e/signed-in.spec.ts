import { expect, leavePersonSlots, personLimit, test } from './session';

import { expectBirthDate, fillBirthDate, fillBirthTime } from './birth-form';
import type { Page } from '@playwright/test';

/** 익명 파일에서 함께 옮겨 온 손잡이 — 그 시험이 쓰던 것과 같은 값이다 */
const sharedParams = (page: Page) =>
  new URLSearchParams(new URL(page.url()).hash.slice(1));

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
      **버튼 옆에 남는 것은 한 줄뿐이다.** 넉 줄이 쌓여 통째로 안 읽히던 자리라, 누를지
      정하는 시점에 실제로 쓰는 사실 하나만 남겼다 — 무엇을 안 넘기는가(ADR 0008).
    */
    await expect(page.getByText('출생지는 넘기지 않습니다', { exact: false })).toBeVisible();

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
    await expect(page.getByText('현재 궁합 풀이 점수')).toBeHidden();

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
  test('다시 풀이받기는 확인 창을 먼저 띄우고, 그만두면 아무것도 만들지 않는다', async ({
    page,
    reader,
  }) => {
    expect(reader.runId).not.toBe('');
    await page.goto('/me');

    /* 있는 글 옆의 설명은 걷었다 — 버튼이 이미 자기 이름으로 말한다 */
    await expect(page.getByText('지금 풀이를 새로 받을 수 있어요')).toHaveCount(0);
    await expect(page.getByText('화면을 다시 열어도')).toHaveCount(0);

    const again = page.getByRole('button', { name: '다시 풀이받기' });
    await again.click();

    /* 닫힌 `<dialog>` 는 접근성 트리에 없다 — 그래서 이 자리가 「열렸는가」를 잰다 */
    const asking = page.getByRole('dialog');
    await expect(asking).toBeVisible();
    await expect(asking.getByText('이전 것은 남기지 않습니다', { exact: false })).toBeVisible();

    await asking.getByRole('button', { name: '그만두기' }).click();
    await expect(asking).toBeHidden();

    /*
      **그만두면 정말 아무 일도 없다.** 만들기가 시작됐으면 기다리는 화면으로 바뀌고
      풀이권이 하나 더 잡힌다 — 둘 다 그대로인 것으로 잰다(하나는 이미 이 글을 만들 때 썼다).
    */
    await expect(page.getByText('풀이 만드는 중…')).toHaveCount(0);
    await expect(page.locator('header').getByText('풀이권 5번 중 4번 남음')).toBeVisible();
    await expect(again).toBeEnabled();
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
    await expect(page.locator('main')).not.toContainText('AI 풀이');
    // 혼자 보는 풀이에는 물을 상대가 없다.
    await expect(page.getByText('두 분은 무슨 사이인가요')).toHaveCount(0);

    await page.getByLabel('이름', { exact: true }).fill('상우');
    await page.getByRole('button', { name: '수정한 정보로 다시 보기' }).click();

    await expect(page.locator('main')).toContainText('저장한 사람 목록에 상우');
    await page.getByRole('button', { name: '이 사람을 저장하고 사주풀이로 가기' }).click();

    await expect(page).toHaveURL(/\/me\/people\/[0-9a-f-]+$/);
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
    await page.getByRole('button', { name: '수정한 정보로 다시 보기' }).click();
    await page.getByRole('button', { name: '이 사람을 저장하고 사주풀이로 가기' }).click();

    const ask = page.getByRole('group', { name: '같은 사람인지 확인' });
    await expect(ask).toContainText('저장된 어머니 님과 같은 사람인가요?');
    // 왜 묻는지 적는다 — 「이미 있습니다」로 끝내면 막는 줄로 읽는다.
    await expect(ask).toContainText('풀이권을 한 번 더');

    /*
      **물음이 서면 저장 버튼은 내려간다.** 함께 세우면 답하지 않고 다시 누를 수 있고,
      그때 사용자는 자기 답이 안 먹혔다고 읽는다.
    */
    await expect(
      page.getByRole('button', { name: '이 사람을 저장하고 사주풀이로 가기' }),
    ).toHaveCount(0);

    await ask.getByRole('button', { name: '네, 같은 사람입니다' }).click();

    await expect(page).toHaveURL(/\/me\/people\/[0-9a-f-]+$/);
    // 「엄마」가 아니라 저장돼 있던 이름이다 — 아무것도 새로 저장되지 않았다.
    await expect(page.getByRole('heading', { name: '어머니의 사주', exact: true })).toBeVisible();

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
    await page.getByRole('button', { name: '수정한 정보로 다시 보기' }).click();
    await page.getByRole('button', { name: '이 사람을 저장하고 사주풀이로 가기' }).click();

    const ask = page.getByRole('group', { name: '같은 사람인지 확인' });
    await expect(ask).toBeVisible();
    await ask.getByRole('button', { name: '아니요, 다른 사람입니다' }).click();

    await expect(page).toHaveURL(/\/me\/people\/[0-9a-f-]+$/);
    await expect(page.getByRole('heading', { name: '쌍둥이의 사주', exact: true })).toBeVisible();
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

    /*
      **사람 상세가 궁합으로 가는 길을 낸다**(ADR 0036). `/me/compat` 은 메뉴에 없어서,
      거기 가려면 머리글의 「궁합 보기」로 직접 입력 화면에 닿은 뒤 길을 찾아야 했다.
      첫 칸이 이 사람으로 채워진 채 열린다.
    */
    await expect(
      page.getByRole('link', { name: '이 사람과 궁합 보기' }),
    ).toHaveAttribute('href', /^\/me\/compat\?a=.+/);

    await page.getByRole('link', { name: '사람 목록으로' }).click();

    // 저장 자리 한도를 세는 것도 이 목록이다(US 18).
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
      **본 적 없으면 목록도 없다.** 처음 온 사람에게 빈 목록은 할 일이 하나 더 있는
      것처럼 보이는데, 고르는 칸이 이미 그 말을 하고 있다.
    */
    await expect(page.getByRole('heading', { name: '본 궁합' })).toHaveCount(0);
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
      본론이고, 관계표는 우리가 검산하려고 세운 원자료라 여기 안 선다(ADR 0025·0035).
    */
    await expect(page.getByText('일간').first()).toBeVisible();
    await expect(page.getByRole('heading', { name: '두 원국 사이의 관계' })).toHaveCount(0);

    /*
      **고른 사이는 쌍에 남는다.** 옮겨 왔다고 사라지지 않는다 — 결과 아래의 칸이
      저장된 값을 그대로 세운다(`RelationForNext`).
    */
    await expect(page.getByRole('radio', { name: '가족' })).toBeChecked();

    // 글을 만드는 버튼은 **여기** 있다. 누르지 않는다 — 누르면 4분과 돈이 든다.
    await expect(page.getByRole('button', { name: '사주풀이 받기' })).toBeVisible();
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
    // 머리글에도 같은 이름의 길이 있으므로 본문 안에서 찾는다.
    await expect(
      page.getByRole('main').getByRole('link', { name: '내 사주', exact: true }),
    ).toBeVisible();
  });

  test('계정 작업은 우측 설정 메뉴의 계정 관리에 모여 있다', async ({ page, signedIn }) => {
    expect(signedIn.label).not.toBe('');
    await page.goto('/me');

    await page.locator('summary[aria-label="설정 메뉴"]').click();

    /* 프로필도 같은 메뉴에서 닿는다 — 이름은 앱 전체의 것이라 길도 앱 전체의 자리에 선다 */
    await expect(page.getByRole('link', { name: '프로필' })).toBeVisible();

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
test.describe('로그인한 사람의 궁합 화면', () => {
  /**
   * 궁합 화면은 한 주소에 입력 두 벌을 싣는다. 접두사가 섞이면 상대의 생일로 내
   * 사주가 나오므로, 링크로 다시 열었을 때 두 명식이 그대로인지가 본론이다.
   */
  test('궁합은 두 사람의 입력을 한 주소에 싣고 링크로 그대로 열린다', async ({
    page,
    context,
    signedIn,
  }) => {
    await context.grantPermissions(['clipboard-read', 'clipboard-write']);
    expect(signedIn.label).not.toBe('');
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

      await fillBirthDate(group, date);
      await fillBirthTime(group, time);
      await group.getByLabel('이름', { exact: true }).fill(name);
    }

    /**
     * **입력하는 동안에는 사이를 묻지 않는다.**
     *
     * 이 값이 움직이는 것은 저장하고 나서다. 폼 옆에 세우면 저장을 안 할 사람에게도
     * 아무것도 바꾸지 않는 라디오가 서고, 그 자리에서 한 번 걷어 낸 적이 있다. 묻는
     * 칸은 **결과 아래 저장 버튼 옆**에 선다 — 그 누름이 그 값을 함께 적는다.
     */
    await expect(page.getByText('두 분은 무슨 사이인가요')).toHaveCount(0);

    const first = page.getByRole('group', { name: '민수' });
    await page.getByRole('button', { name: '궁합 보기' }).click();

    /*
      **분석 표는 접혀 있다**(ADR 0035). 결과가 났다는 것은 접이칸이 서는 것으로 안다 —
      관계 표는 응답에 실려 있지만 사용자 앞에 먼저 서지는 않는다.
    */
    const analysis = page.getByText('두 원국을 맞대어 본 표');
    await expect(analysis).toBeVisible();
    await expect(page.getByRole('heading', { name: '두 원국 사이의 관계' })).toBeHidden();

    /*
      **접는 것이지 자르는 것이 아니다.** 자료는 그대로 그려져 있고 안 보일 뿐이다 —
      `toContainText` 는 `textContent` 를 보므로 접힌 안쪽까지 센다. 흐름 검사가 이
      자리를 못 잡는 것은 이 화면이 주소의 `#` 뒤를 읽어 **브라우저에서** 계산하기
      때문이다(ADR 0007). 서버 응답에는 결과 자체가 없다.
    */
    await expect(page.locator('main')).toContainText('두 원국 사이의 관계');

    const shared = page.url();
    const params = sharedParams(page);
    expect(params.get('a.date')).toBe('1990-05-15');
    expect(params.get('b.date')).toBe('1992-08-20');
    expect(params.get('a.hour')).toBe('14:30');

    const chart = await page.locator('main').innerText();

    await page.goto(shared);
    await expect(analysis).toBeVisible();
    expect(await page.locator('main').innerText()).toBe(chart);
    await expectBirthDate(first, '1990-05-15');
    expect(consoleErrors).toEqual([]);

    /*
      **펼침을 실제로 눌러 본다.** 마크업만 재는 검사는 태그 한 겹에 조용히 0을 낸다 —
      접힌 것과 아예 없는 것이 같은 답을 내면 이 검사는 아무것도 안 지킨다.
    */
    await analysis.click();
    await expect(page.getByRole('heading', { name: '두 원국 사이의 관계' })).toBeVisible();
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
     * **고른 사이가 복사해 가는 글에 실린다** — `/evidence` 에서.
     *
     * 결과 화면의 링크를 그대로 넘기면 같은 명식으로 자료가 선다. 코덱도 계산도 한
     * 함수라 여기 여덟 글자와 저쪽 여덟 글자가 갈릴 자리가 없고, 그래서 이 검사가
     * 옮겨 간 화면에서도 같은 것을 잰다.
     */
    await page.goto(shared.replace('/compat#', '/evidence#'));

    await expect(page.getByText('두 분은 무슨 사이인가요')).toBeVisible();
    await page.getByRole('radio', { name: '가족' }).check();

    await page.getByText('풀이에 넘기는 자료').click();
    await page.getByRole('button', { name: '궁합', exact: false }).first().click();
    await page.getByRole('button', { name: '프롬프트 + 자료 복사' }).click();

    const copied = await page.evaluate(() => navigator.clipboard.readText());
    expect(copied).toContain('두 사람은 무슨 사이인가');
    expect(copied).toContain('가족이다');
    // 관계는 장면을 고르는 값이지 점수를 움직이는 값이 아니다.
    expect(copied).toContain('점수는 이 값으로 움직이지 않는다');
  });

  /**
   * 주소가 곧 결과라는 것을 화면이 말해 주지 않으면 아무도 링크를 공유하지 않는다.
   * 버튼이 실제로 지금 주소를 클립보드에 넣는지까지 본다.
   */

  /**
   * **직접 입력한 두 사람이 궁합 풀이로 가는 길.**
   *
   * 이 화면은 아무것도 저장하지 않아서 AI 가 없었다 — 시도도 잠금도 풀이권도 대상에
   * 거는데(ADR 0013) 걸 대상이 없다. 그래서 길은 저장 하나이고, 무슨 사이인지도
   * **그 누름에 함께** 적힌다. 따로 두면 골라 놓고 저장만 한 사람의 답이 사라진다.
   *
   * 여기서 재는 것은 세 걸음이 실제로 이어지는가다 — 묻고 · 저장하고 · 풀이 화면에
   * 그 답이 이미 서 있는가. pgTAP 은 한 문으로 들어가는 것까지만 알고, 흐름 검사는
   * `#` 뒤를 못 읽는다(주소의 조각은 서버에 오지 않는다).
   */
  test('직접 입력한 두 사람을 저장하면 그 사이까지 궁합 화면으로 건너간다', async ({
    page,
    signedIn,
  }) => {
    expect(signedIn.label).not.toBe('');
    // 첫 칸이 씨앗의 자기 사주와 같은 날이면 저장 직전에 같은 명식 물음이 선다(ADR 0034).
    await page.goto('/compat#a.date=1988-11-07&a.hour=09:15&b.date=1992-08-20&b.hour=09:00');

    await expect(page.getByText('두 원국을 맞대어 본 표')).toBeVisible();

    // 이름이 없으면 목록에서 알아볼 수 없다 — 저장하는 자리가 그것을 먼저 묻는다.
    for (const [placeholder, name] of [
      ['첫 번째 사람', '민수'],
      ['두 번째 사람', '지영'],
    ] as const) {
      await page.getByRole('group', { name: placeholder }).getByLabel('이름', { exact: true }).fill(name);
    }
    await page.getByRole('button', { name: '결과 업데이트' }).click();

    const save = page.getByRole('heading', { name: '궁합 풀이로 이어 보기' });
    await expect(save).toBeVisible();

    // 사실이 먼저 읽히고 AI 로 가는 다리는 그 아래다 — 접힌 채로도 자리는 그대로다.
    const shown = await page.locator('main').innerText();
    expect(shown.indexOf('두 원국을 맞대어 본 표')).toBeLessThan(
      shown.indexOf('궁합 풀이로 이어 보기'),
    );
    // 제목·설명·버튼이 한 낱말을 쓴다 — 세 번째 이름을 세우지 않는다
    expect(shown).not.toContain('AI 풀이');
    // 무엇이 목록에 남는지 누르기 전에 적는다. 남은 자리도 — 서버에서 건너온 값이다.
    expect(shown).toContain('저장한 사람 목록에 민수 · 지영');
    // 이 계정은 「어머니」 하나를 들고 있다. 수는 DB 에 묻는다 — 여기 적으면 한도를
    // 옮기는 날 이 검사만 옛 수를 지킨다.
    expect(shown).toContain(`앞으로 ${personLimit() - 1}명 더 저장할 수 있습니다`);

    await expect(page.getByText('두 분은 무슨 사이인가요')).toBeVisible();
    await page.getByRole('radio', { name: '가족' }).check();

    await page.getByRole('button', { name: '두 사람을 저장하고 궁합 풀이로 가기' }).click();

    await expect(page).toHaveURL(/\/me\/compat\?a=[0-9a-f-]+&b=[0-9a-f-]+$/);
    await expect(page.getByRole('heading', { name: '민수 × 지영' })).toBeVisible();
    // 저장된 두 사람이라 이 화면에는 풀이를 만드는 자리가 있다.
    await expect(page.locator('main')).toContainText('사주풀이');

    /**
     * **고른 사이가 그 쌍에 적혀 있다.** 다음 풀이를 위한 칸이 저장된 값을 그대로
     * 보여 주므로(`RelationForNext`), 여기서 「가족」이 눌려 있으면 저장이 실제로
     * 그 값을 적은 것이다 — 화면이 기본값으로 그렇게 보이는 것이 아니다.
     */
    await expect(page.getByRole('radio', { name: '가족' })).toBeChecked();
  });

  /**
   * **자리가 없으면 버튼을 세우지 않는다.**
   *
   * 저장이 한 문이라 한도에 걸리면 둘 다 되돌아간다 — 우리 쪽에서 보면 옳지만 사용자에게는
   * **눌러도 아무 일이 안 일어나는 앱**이다. 그러면 이 입구는 있는 것보다 나쁘다.
   *
   * 궁합은 둘이 필요하므로 **한 자리만 남은 것도 못 쓰는 자리**다. 그 경계를 재려고
   * **한 자리만 남기고** 채운다 — 다 채우면 `remaining === 0` 갈래만 서고 이 자리는
   * 안 재진다. 몇 개를 넣을지는 DB 가 센다(`signedIn` 이 「어머니」 하나를 이미 들고
   * 있고, 한도는 `person_limit()` 이 든다).
   */
  test('저장할 자리가 모자라면 버튼 대신 무엇을 해야 하는지가 선다', async ({
    page,
    signedIn,
  }) => {
    leavePersonSlots(signedIn.email, 1);

    await page.goto('/compat#a.date=1990-05-15&a.hour=14:30&b.date=1992-08-20&b.hour=09:00');
    await expect(page.getByRole('heading', { name: '궁합 풀이로 이어 보기' })).toBeVisible();

    await expect(
      page.getByRole('button', { name: '두 사람을 저장하고 궁합 풀이로 가기' }),
    ).toHaveCount(0);

    await expect(page.getByText('자리가 1명분만 남았습니다')).toBeVisible();
    await expect(page.getByRole('link', { name: '사람 탭에서 자리 비우기 →' })).toBeVisible();
  });

  test('한 사람만 적힌 궁합 주소는 빈 폼으로 연다', async ({ page, signedIn }) => {
    expect(signedIn.label).not.toBe('');
    // 반쪽 링크로 남의 사주가 섞여 보이면 안 된다.
    await page.goto('/compat#a.date=1990-05-15&a.hour=14:30');
    await expect(
      page.getByRole('heading', { name: '두 사람의 생년월일시를 입력해 주세요' }),
    ).toBeVisible();
  });

  /**
   * 검증된 사실이 검증 중인 수치보다 먼저 읽혀야 한다 — `docs/product/matching-beta.md`
   * 가 적어 둔 결정이고, 화면에서는 순서가 그 결정의 전부다. 지표 카드를 위로 올리는
   * 변경은 여기서 걸린다.
   *
   * 지표 아래의 부름도 함께 본다. 여기 「관심 있어요」가 서 있었고 누르면 「지금은
   * 신청을 받지 않습니다」로 답했다 — **아무 데도 닿지 않는 버튼**이었다. 그 사이에
   * `/me/discovery` 가 실제로 요청을 받게 되었으므로 그리로 잇는다. 링크가 `/auth` 를
   * 거치는 것은 로그인 여부를 익명 화면이 몰라도 되게 하려는 것이라, **로그인한 사람이
   * 눌렀을 때 실제로 인연 찾기에 닿는지**가 이 검사의 요점이다.
   */

  test('베타 매칭 지표는 사실 아래에 서고, 그 아래 부름은 인연 찾기에 닿는다', async ({ page, signedIn }) => {
    expect(signedIn.label).not.toBe('');
    await page.goto('/compat#a.date=1990-05-15&a.hour=14:30&b.date=1992-08-20&b.hour=09:00');

    const analysis = page.getByText('두 원국을 맞대어 본 표');
    await expect(analysis).toBeVisible();
    await expect(page.getByText('궁합 베타', { exact: true })).toBeVisible();
    // 내부 판본 이름은 화면 어디에도 없다(ADR 0026).
    await expect(page.locator('main')).not.toContainText('match-v0');

    const shown = await page.locator('main').innerText();
    expect(shown.indexOf('두 원국을 맞대어 본 표')).toBeLessThan(shown.indexOf('먼저 보이는 신호'));

    /*
      **접힌 것이지 잘린 것이 아니다**(ADR 0035). 눌러서 안에 든 것을 본다 — 자료는
      응답에 그대로 실려 있고, 갈린 것은 **먼저 서는가**뿐이다.
    */
    await analysis.click();
    await expect(page.getByRole('heading', { name: '두 원국 사이의 관계' })).toBeVisible();

    // 받지 않는 신청을 받는 것처럼 보이던 버튼은 없다.
    await expect(page.getByRole('button', { name: '관심 있어요' })).toHaveCount(0);

    await page.getByRole('link', { name: '인연 찾기에서 요청하기' }).click();
    await expect(page).toHaveURL(/\/me\/discovery$/);
    await expect(page.getByRole('heading', { name: '인연 찾기 설정' })).toBeVisible();
  });

  /**
   * **궁합 결과에도 넘길 자료는 없다.**
   *
   * 결과 화면 둘 다에서 내렸다(`/` 와 여기). 옮긴 칸은 다시 돌아오기 쉬우므로 두
   * 화면이 각자 지킨다 — 익명 사주 쪽은 `e2e/saju.spec.ts` 가 같은 것을 짚는다.
   */

  test('궁합 결과에는 넘길 자료 패널이 서지 않는다', async ({ page, signedIn }) => {
    expect(signedIn.label).not.toBe('');
    await page.goto('/compat#a.date=1990-05-15&a.hour=14:30&b.date=1992-08-20&b.hour=09:00');

    // 접이칸을 펴 놓고 본다 — 접힌 안쪽까지 훑어야 「어디에도 없다」가 된다.
    await page.getByText('두 원국을 맞대어 본 표').click();
    await expect(page.getByRole('heading', { name: '두 원국 사이의 관계' })).toBeVisible();

    const shown = await page.locator('main').innerText();
    for (const word of ['풀이에 넘기는 자료', '무엇을 시킬 것인가', 'JSON 내려받기']) {
      expect(shown).not.toContain(word);
    }
  });

  /**
   * 넘길 자료는 **열기 전에는 만들지 않는다.** 두 사람짜리가 들여쓴 JSON 으로
   * 460KB 라 방문마다 만들면 비싸고, 대부분의 방문은 이 칸을 안 연다.
   *
   * 그래서 여기서 보는 것은 「칸이 있다」가 아니라 **「열면 실제로 나온다」**이다.
   * 상한 표가 서고 시각을 아는 명식과 모르는 명식에서 다르게 서는 것까지 본다 —
   * 그 표가 이 자료의 요점이고, 값이 아니라 계약이라 화면 어디에도 없던 것이다.
   */

  test('넘길 자료는 열었을 때 상한 표와 함께 선다', async ({ page, signedIn }) => {
    expect(signedIn.label).not.toBe('');
    await page.goto('/evidence#a.date=1990-05-15&a.hour=14:30&b.date=1992-08-20&b.hour=09:00');

    const panel = page.getByRole('group').filter({ hasText: '풀이에 넘기는 자료' });
    await expect(panel).toBeVisible();

    // 닫혀 있는 동안에는 자료를 안 만든다 — 표도 버튼도 없다.
    await expect(page.getByRole('button', { name: 'JSON 내려받기' })).toBeHidden();

    await panel.getByText('풀이에 넘기는 자료').click();

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
});

/**
 * 가입할 때 만드는 프로필 — **안내 다음이 이름이다**(PRD §5.1).
 *
 * 관문이 넷 있다: 레이아웃이 길을 가리키고, `create_self_person` 이 문장으로 거절하고,
 * 검사식이 마지막으로 막는다. 여기서 재는 것은 **첫째**다 — 사람이 실제로 그 길로
 * 가는가. 나머지 셋은 pgTAP 이 잰다.
 */
test.describe('가입할 때 만드는 프로필', () => {
  test('이름을 안 지었으면 이름부터 짓게 하고, 지으면 내 사주로 보낸다', async ({ openAs }) => {
    const newcomer = await openAs({ selfPerson: false, skipProfile: true });

    await newcomer.page.goto('/me');
    await expect(newcomer.page).toHaveURL(/\/me\/profile$/);
    await expect(newcomer.page.getByRole('heading', { name: '어떻게 불러 드릴까요' })).toBeVisible();

    const name = `벗${String(Date.now()).slice(-6)}`;
    await newcomer.page.getByLabel('닉네임').fill(name);
    await newcomer.page.getByRole('button', { name: '중복 확인' }).click();
    await expect(newcomer.page.getByText('쓸 수 있는 닉네임입니다.')).toBeVisible();

    await newcomer.page.getByRole('button', { name: '이 이름으로 시작하기' }).click();

    /* 짓고 나면 원래 가려던 자리다 — 고치러 온 사람은 이 화면에 그대로 남는다 */
    await expect(newcomer.page).toHaveURL(/\/me$/);
    await expect(newcomer.page.getByRole('heading', { name: '내 사주 등록' })).toBeVisible();
  });

  /**
   * **이름이 없다고 나가는 길까지 막지 않는다.**
   *
   * 계정 관리는 로그아웃과 삭제 요청이 닿는 자리다. 이름을 안 지었다는 이유로 그것까지
   * 막으면 들어오지도 나가지도 못한다 — 베타가 끝난 뒤에도 이 화면만 열어 두는 것과
   * 같은 까닭이다.
   */
  /**
   * **앱 안에서 걸어 다닐 때도 관문이 선다.**
   *
   * `page.goto` 는 전체 적재라 서버가 튕김을 다 처리한다. 실제 사람은 링크를 누르고,
   * 그때는 화면 조각만 오간다 — 관문이 레이아웃에 있던 동안 **그 길에서는 한 번도 안
   * 돌았다.** 이름 없는 사람이 헤더의 「내 사주」를 누르면 등록 화면이 그대로 열렸다.
   *
   * 그래서 이 시험은 **반드시 눌러서** 간다. `goto` 로 재면 고쳐지기 전에도 통과한다.
   */
  test('이름이 없으면 앱 안 링크로 홈에 가도 이름부터 짓게 한다', async ({ openAs }) => {
    const newcomer = await openAs({ selfPerson: false, skipProfile: true });

    await newcomer.page.goto('/me/settings');
    await expect(newcomer.page.getByRole('heading', { name: '계정 관리' })).toBeVisible();

    await newcomer.page.getByRole('link', { name: '내 사주' }).first().click();

    await expect(newcomer.page).toHaveURL(/\/me\/profile$/);
    await expect(newcomer.page.getByRole('heading', { name: '어떻게 불러 드릴까요' })).toBeVisible();
  });

  test('이름이 없어도 계정 관리는 열린다', async ({ openAs }) => {
    const newcomer = await openAs({ selfPerson: false, skipProfile: true });

    await newcomer.page.goto('/me/settings');
    await expect(newcomer.page).toHaveURL(/\/me\/settings$/);
    await expect(newcomer.page.getByRole('heading', { name: '계정 관리' })).toBeVisible();
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
});
