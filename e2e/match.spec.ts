import type { Locator } from '@playwright/test';

import { expect, forgetBoards, onlyTheseParticipate, optIn, sql, test, type Person } from './session';

import { DISCOVERY_EMPTY } from '@/src/lib/discovery';
import { READING_FAILED_NOTE } from '@/src/lib/reading';

import { fillBirthDate } from './birth-form';
import { expectTargets } from './target';

/**
 * 둘이 있어야 성립하는 흐름 — **창을 둘 열고 잰다.**
 *
 * 쿠키만 갈아 끼우면 「상대에게는 무엇이 보이는가」를 한 번도 못 잰다. 그 답이 이
 * 제품의 절반이다 — 동의 전에 닫혀 있던 것이 동의 뒤에 열리는 것이 곧 제품이다.
 *
 * **재려는 것만 손으로 몬다.** 요청 하나를 pending 으로 세우려고 참여 화면부터 열 번을
 * 누르면, 무효화를 재는 시험이 참여 화면이 깨졌을 때도 빨간불이 된다. 그래서 첫
 * 시험만 참여·요청·수락을 전부 화면으로 지나고, 나머지는 RPC 로 세운 뒤 재려는 자리만
 * 누른다.
 */

/**
 * 이 시험만의 꼬리표 — **이름이 부딪히지 않게.**
 *
 * `Date.now()` 의 끝 네 자리였다. 그러면 십 초에 한 번씩 같은 값이 돌아오고, 로컬 DB 는
 * 실행 사이에 안 지워지므로 **어제 만든 계정과 이름이 부딪힌다** — 시험이 재려던 것과
 * 상관없는 자리에서 「이미 쓰고 있는 닉네임입니다」로 죽는다. 무작위를 섞어 그 자리를 없앤다.
 *
 * 닉네임은 여덟 자까지라 다섯 자만 쓴다(앞에 한 글자가 붙는다).
 */
const freshTag = (): string =>
  (Date.now().toString(36) + Math.random().toString(36).slice(2)).slice(-5);

/** 둘 다 매칭에 참여시키고 서로만 보이게 한다 */
async function bothParticipate(a: Person, b: Person, tag: string): Promise<void> {
  await optIn(a.api, `가${tag}`);
  await optIn(b.api, `나${tag}`);
  onlyTheseParticipate([a.account.email, b.account.email]);
  // 참여를 켜기 전에 만들어진 목록이 있으면 그 목록에는 서로가 없다.
  forgetBoards([a.account.email, b.account.email]);
}

/**
 * **덱을 넘겨 그 사람의 카드를 세운다** — 덱은 한 번에 한 장이고, `onlyTheseParticipate` 는 부를 때 있던 프로필만
 * 끄므로 나란히 도는 시험이 그 뒤에 만든 참여자가 앞에 설 수 있다. 목록이라면 이름으로 좁히면 되지만 덱에서는
 * 넘겨서 찾아야 한다 — 그것이 이 화면의 사용법이기도 하다.
 *
 * **넘긴 뒤에는 시간이 아니라 다음 장을 기다린다.** 고른 것을 읽을 시간(700ms)과 떠나는 시간(550ms) 뒤에 다음 장이
 * 서는데, 1.4초를 재워 두던 때는 느린 러너에서 그보다 늦으면 같은 장을 두 번 넘겼다. 뒤에서 기다리는 다음 카드는
 * `aria-hidden` 이라 역할로 잡히지 않는다 — 보이는 카드의 제목이 바뀌거나 덱이 비는 것이 「넘어갔다」다.
 */
async function passUntilShown(page: Person['page'], target: Locator): Promise<void> {
  const next = page.getByRole('button', { name: '다음 인연으로 지나가기' });
  const heading = page.getByRole('region', { name: '인연 카드' }).getByRole('article').getByRole('heading').first();
  for (let step = 0; step < 12; step += 1) {
    if (await target.isVisible()) break;
    if (!(await next.isVisible()) || !(await next.isEnabled())) break;
    await passShownCard(page, heading, next);
  }
  await expect(target).toBeVisible();
}

/** 보이는 카드 한 장을 넘기고 다음 장이 서거나 덱이 빌 때까지 선다 */
async function passShownCard(page: Person['page'], heading: Locator, next: Locator): Promise<void> {
  const shown = (await heading.textContent()) ?? '';
  await next.click();
  await expect(page.getByRole('region', { name: '인연 카드' }).getByRole('heading', { name: shown, exact: true })).toHaveCount(0);
}

/**
 * **「보냈다」는 화면이 말한다 — 누른 것으로는 모른다.**
 *
 * 「요청 보내기」를 누르면 창이 닫히고 서버 액션이 **아직 가는 중**이다. 그 자리에서
 * 다른 화면으로 옮기면 브라우저가 그 POST 를 끊고, 서버는 액션을 **한 번도 안 돈다** —
 * 요청은 `pending` 조차 되지 못한다. 로컬에서는 액션이 먼저 끝나 안 보이고 공유 러너에서는
 * 옮김이 먼저 와서 빨간불이 된다(#92). 그래서 카드가 「요청했어요」라고 말할 때까지 선다.
 */
async function sentRequest(person: Person): Promise<void> {
  await expect(person.page.getByText(/님에게 상세 궁합을 요청했어요/)).toBeAttached();
}

/**
 * **「답했다」도 마찬가지다.** 수락을 누르면 단추의 글자가 「보내는 중…」으로 바뀌므로
 * 「수락하고 궁합 열기」가 사라진 것은 눌렀다는 뜻이지 답했다는 뜻이 아니다. 답이 나면 화면이 새로 그려져 받은
 * 요청 띠가 내려간다 — 그것을 기다린 뒤에 옮긴다. 그 요청은 인연 기록의 「끝난 요청」으로 가서 성립을 말한다
 * (2026-09-29 u2) — 그 문장까지 본다.
 */
async function acceptedRequest(person: Person): Promise<void> {
  await expect(person.page.locator('#requests-lead')).toHaveCount(0);
  await person.page.goto('/me/matching/history');
  await expect(person.page.getByText('수락해서 인연 궁합이 열렸어요.')).toBeVisible();
}

/** 요청 하나를 pending 으로 세운다 — 화면으로 재는 자리가 아닐 때 */
async function pendingRequest(from: Person, to: Person): Promise<void> {
  // 후보 목록을 한 번 받아야 요청의 근거(reason snapshot)가 선다(ADR 0009).
  const board = await from.api.rpc('my_discovery_board');
  if (board.error) throw new Error(`후보 목록을 못 받았습니다 — ${board.error.message}`);

  const partner = await to.api.from('discovery_profile').select('user_id').maybeSingle();
  const asked = await from.api.rpc('request_match', { p_candidate_user_id: partner.data?.user_id });
  if (asked.error) throw new Error(`요청을 못 보냈습니다 — ${asked.error.message}`);
}

/** 받은 요청 하나에 화면을 안 거치고 답한다 — 화면으로 재는 자리가 아닐 때 */
async function respondThroughApi(person: Person, accept: boolean): Promise<void> {
  const mine = await person.api.rpc('my_match_requests');
  if (mine.error) throw new Error(`요청을 못 읽었습니다 — ${mine.error.message}`);
  const received = (mine.data as { request_id: string; direction: string; status: string }[]).find(
    (row) => row.direction === 'received' && row.status === 'pending',
  );
  if (!received) throw new Error('답할 요청이 없습니다.');
  const answered = await person.api.rpc('respond_to_match_request', { p_request_id: received.request_id, p_accept: accept });
  if (answered.error) throw new Error(`답하지 못했습니다 — ${answered.error.message}`);
}

/**
 * 인연 탭 맨 위 「받은 요청 N」 띠가 올리는 시트(ADR 0130, 2026-09-29 u2). **시트로 좁혀서 잡는다** — 같은 화면의 덱에도
 * 사람 이름의 제목이 서므로, 이름으로만 찾으면 요청 카드인지 후보 카드인지 가르지 못한다. 닫힌 시트는 안 잡힌다.
 */
function receivedRequests(person: Person): Locator {
  return person.page.getByRole('dialog', { name: '받은 요청' });
}

/**
 * 받은 요청 띠를 눌러 카드 시트를 올린다 — 카드는 그 자리에서 답한다. **올라오는 움직임이 끝날 때까지 선다** — 움직이는
 * 동안은 카드가 화면 아래에 있어 누르는 자리를 재면 0 이 나온다.
 */
async function openReceivedRequests(person: Person): Promise<void> {
  await person.page.getByRole('button', { name: /^받은 요청 \d+/ }).click();
  const sheet = receivedRequests(person);
  await expect(sheet).toBeVisible();
  await expect.poll(() => sheet.evaluate((node) => node.getAnimations().length)).toBe(0);
}

/** 보낸 요청 · 끝난 요청 · 차단 수는 인연 기록에 펼쳐 선다(2026-09-29 u2) */
async function openRequestHistory(person: Person): Promise<void> {
  await person.page.goto('/me/matching/history');
  await expect(person.page.getByRole('heading', { level: 1, name: '인연 기록' })).toBeVisible();
}

test.describe('동의로 열리는 흐름', () => {
  test('내 사주의 소식 버튼으로 들어오면 도착한 소식을 모두 읽은 것으로 남긴다', async ({
    openAs,
  }) => {
    const tag = freshTag();
    const asker = await openAs({ selfPerson: true });
    const receiver = await openAs({ selfPerson: true });

    await bothParticipate(asker, receiver, tag);
    await pendingRequest(asker, receiver);
    /*
      **요청이 왔다는 소식은 종이 안 센다** — 그 요청은 인연 탭이 센다(ADR 0130). 그래서 거절을 받은 쪽(청한 사람)의
      소식으로 잰다 — 답이 난 뒤의 소식은 종이 센다.
    */
    await respondThroughApi(receiver, false);

    await asker.page.goto('/me');
    await expect(asker.page.getByText('아직 확인하지 않은 새 소식이 있어요.')).toBeVisible();
    await asker.page.getByText('아직 확인하지 않은 새 소식이 있어요.').click();

    await expect(asker.page).toHaveURL(/\/me\/requests$/);
    // 처음 내려온 알림의 읽지 않음 표시는 자동 읽음 처리 뒤의 refresh 에서 사라진다.
    await expect(asker.page.getByLabel('읽지 않음')).toHaveCount(0);

    await asker.page.goto('/me');
    await expect(asker.page.getByText('아직 확인하지 않은 새 소식이 있어요.')).toHaveCount(0);
  });

  /**
   * **요청 하나가 딱지 하나만 켠다**(ADR 0130). 받은 요청은 인연 탭이 「답할 요청」으로 세고, 종은 그 도착을 안 센다 —
   * 같은 일을 두 자리에서 세면 둘 다 덜 읽힌다. 답하면 탭의 딱지가 그 자리에서 내려간다.
   */
  test('받은 요청은 인연 탭의 딱지가 세고 종은 안 켜진다', async ({ openAs }) => {
    const tag = freshTag();
    const asker = await openAs({ selfPerson: true });
    const receiver = await openAs({ selfPerson: true });

    await bothParticipate(asker, receiver, tag);
    await pendingRequest(asker, receiver);

    await receiver.page.goto('/me');
    const banner = receiver.page.getByRole('banner');
    const tab = receiver.page.getByRole('link', { name: /^인연\s*1\s*건 답할 요청$/ }).filter({ visible: true });
    await expect(tab).toBeVisible();
    await expect(banner.getByRole('link', { name: /^소식/ })).toHaveAccessibleName('소식');
    /* 나 탭의 소식 띠도 종과 같은 수를 센다 */
    await expect(receiver.page.getByText('아직 확인하지 않은 새 소식이 있어요.')).toHaveCount(0);

    await tab.click();
    await expect(receiver.page).toHaveURL(/\/me\/matching$/);
    await openReceivedRequests(receiver);
    await receivedRequests(receiver).getByRole('button', { name: '거절' }).click();
    await expect(receiver.page.getByRole('link', { name: /답할 요청/ })).toHaveCount(0);
  });

  test('저장한 사람은 이미 참여 중이고, 요청을 보내 수락하면 같은 결과 화면에 선다', async ({ openAs, isMobile }) => {
    const tag = freshTag();
    const asker = await openAs({ selfPerson: true });
    const receiver = await openAs({ selfPerson: true });

    // ── 참여는 이미 켜져 있다 — 화면에서 그것을 확인한다 ────────────────────
    for (const [person, nickname] of [
      [asker, `보내는${tag}`],
      [receiver, `받는${tag}`],
    ] as const) {
      /*
        **이름은 프로필 화면에서 짓는다**(§5.1). 인연 찾기 설정에 남은 것은 조건 하나다 —
        이름이 참여의 부속물이던 때에는 참여하지 않는 사람에게 이름이 없었다.
      */
      await person.page.goto('/me/profile');
      await person.page.getByLabel('닉네임').fill(nickname);
      await person.page.getByRole('button', { name: '중복 확인' }).click();
      await expect(person.page.getByText('사용할 수 있는 닉네임입니다.')).toBeVisible();
      await person.page.getByRole('button', { name: '프로필 저장' }).click();
      await expect(person.page.getByText('저장했습니다')).toBeVisible();

      await person.page.goto('/me/settings');
      await expect(person.page.getByRole('heading', { name: '계정 관리' })).toBeVisible();

      /*
        **누를 버튼이 없다**(PRD §4.1, ADR 0037). 참여가 기본으로 켜진 뒤로 이 화면에서
        켜는 일이 없어졌고, 무엇이 나가는지는 가입 관문이 읽힌다(`notice-v4`). 여기 남은
        누름은 끄는 것 하나다 — 그 버튼이 서 있는 것으로 「지금 켜져 있다」를 잰다.
      */
      await expect(person.page.getByRole('heading', { name: '인연 찾기', exact: true })).toBeVisible();
      await expect(person.page.getByText('현재 다른 사람에게 내 프로필이 소개되고 있어요.')).toBeVisible();
      await expect(person.page.getByRole('button', { name: '인연 찾기 쉬기' })).toBeVisible();

      /*
        **참여가 실제로 열리는 자리는 홈이다.** 요약은 DB 가 못 만들어서 앱이 넣고, 그
        자리가 목록이 서는 화면이다. 여기서 홈을 한 번 여는 것이 그 문을 지나는 일이다.
      */
      await person.page.goto('/me');
    }

    onlyTheseParticipate([asker.account.email, receiver.account.email]);
    forgetBoards([asker.account.email, receiver.account.email]);

    // ── 매칭에서 후보를 보고 요청을 보낸다 ──────────
    await asker.page.goto('/me/matching');
    await expect(asker.page.getByRole('heading', { name: `받는${tag}` })).toBeVisible();

    /**
     * **카드를 이름으로 좁힌다.** `onlyTheseParticipate` 는 부를 때 있던 프로필만 끄므로,
     * 나란히 도는 시험이 그 뒤에 만든 참여자는 이 목록에 함께 선다. 그때 이름 없이
     * 버튼을 잡으면 strict mode 가 물고, 그것은 **화면이 깨진 것이 아니라 시험이
     * 목록 순서를 재고 있었다는 뜻**이다.
     */
    const card = asker.page.getByRole('article').filter({ hasText: `받는${tag}` });

    /*
      **맛보기다.** 어느 오행을 채우는지는 말하고 원문은 닫는다(ADR 0003 · `prd-archive`).

      낱말이 아니라 **값**을 센다. 「생년월일」은 참여 화면이 「보이지 않는 것」을
      적으면서 이미 쓰고 있는 말이라, 낱말을 세면 약속을 적어 둔 문장이 그 약속을
      깨뜨린 것으로 잡힌다.

      **카드 안에서 센다.** 목록이 홈으로 온 뒤로(ADR 0037) 같은 화면에 내 저장된
      출생 정보가 함께 서 있고, 그것은 내 것이라 거기 있어야 한다. 재려는 것은
      **후보 카드가 무엇을 말하는가**다.
    */
    await expect(card.getByText('1990-05-15')).toHaveCount(0);

    await asker.page.getByRole('button', { name: '상세 궁합 요청하기', exact: true }).click();
    const confirmRequest = asker.page.getByRole('dialog');
    await expect(confirmRequest).toContainText('풀이권 1회가 임시로 차감됩니다');
    await expect(confirmRequest).toContainText('내 사주팔자 여덟 글자가 상대에게 공개');
    await expect(confirmRequest).toContainText('정확한 생년월일시와 출생지는 공개되지 않습니다');
    await confirmRequest.getByRole('button', { name: '요청 보내기' }).click();
    await sentRequest(asker);

    // ── 받은 쪽이 읽고 수락한다 ─────────────────────────────────────────────
    await receiver.page.goto('/me/matching');
    /*
      **받은 요청은 인연 탭 맨 위 띠에서 연다**(ADR 0130, 2026-09-29 u2). 시트 「받은 요청」과 세 걸음이 함께
      서지 않으면 「동의」라는 낱말만 남고, 받은 쪽은 자기가 무엇을 정하는 중인지
      모른 채 버튼을 고른다(`CONSENT_FLOW_STEPS`).
    */
    await expect(receiver.page.getByRole('heading', { level: 1, name: '오늘의 인연' })).toBeVisible();
    await openReceivedRequests(receiver);
    const receivedSection = receivedRequests(receiver);
    await expect(receivedSection).toBeVisible();
    await receivedSection.getByText('궁합 요청은 어떻게 진행되나요?').click();
    await expect(receivedSection.getByRole('listitem').filter({ hasText: '요청을 보냅니다' })).toBeVisible();
    await expect(receivedSection.getByText('보내는 것만으로 상대에게 열리는 것은 없고')).toBeVisible();
    await expect(receivedSection.getByRole('heading', { name: `보내는${tag}` })).toBeVisible();
    const receivedCard = receivedSection.getByRole('listitem').filter({ hasText: `보내는${tag}` });
    await expect(receivedCard).toContainText('당신의 사주팔자 여덟 글자가 상대에게 공개');
    await expect(receivedCard).toContainText('상대와 자세한 궁합을 함께 보는 데 동의하시겠어요?');

    // 수락 전에도 상대의 정확한 출생 정보는 없다(US 39).
    await expect(receiver.page.getByText('1990-05-15')).toHaveCount(0);

    await receivedCard.getByRole('button', { name: '수락하고 궁합 열기' }).click();
    await expect(receivedCard.getByRole('button', { name: '수락하고 궁합 열기' })).toHaveCount(0);
    // 단추가 사라진 것은 눌렀다는 뜻이지 답했다는 뜻이 아니다 — 곧바로 옮기면 가던 수락이 끊긴다
    await acceptedRequest(receiver);

    // ── 양쪽이 같은 결과 화면에 선다 ────────────────────────────────────────
    for (const [person, partner] of [
      [asker, `받는${tag}`],
      [receiver, `보내는${tag}`],
    ] as const) {
      await person.page.goto('/me/readings');
      await person.page
        .getByRole('link', { name: new RegExp(`${partner} 님과의 궁합풀이`) })
        .click();

      /*
        **보관함에서 연 인연 궁합은 사주풀이처럼 책장 옆 칸에 선다**(ADR 0134, 2026-09-29). 넓은 화면은 책장이 옆에
        그대로 서고, 폰은 한 화면에 ← 「풀이 보관함」이다. 방으로 가기와 차단은 그 칸 안에서도 그대로 선다.
      */
      await expect(person.page).toHaveURL(/\/me\/readings\/match\/[0-9a-f-]+\?from=shelf$/);
      const main = person.page.getByRole('main');
      if (isMobile) {
        await expect(main.getByRole('link', { name: '풀이 보관함', exact: true })).toHaveAttribute('href', '/me/readings');
      } else {
        await expect(person.page.getByRole('navigation', { name: '풀이 종류' })).toBeVisible();
        await expect(main.getByRole('link', { name: new RegExp(`${partner} 님과의 궁합풀이`) })).toHaveAttribute('aria-current', 'page');
      }
      await expect(main.getByRole('link', { name: '채팅', exact: true })).toHaveAttribute('href', /^\/me\/chat\/[0-9a-f-]+$/);
      await expect(main.getByRole('button', { name: '차단', exact: true })).toBeVisible();

      /* 옆 책장에도 「인연 궁합」 절 제목이 서므로 글 칸(`article`) 안에서 찾는다 */
      await expect(main.getByRole('article').getByRole('heading', { name: '인연 궁합', exact: true })).toBeVisible();
      await expect(person.page.getByRole('heading', { name: '궁합의 출발점' })).toBeVisible();
      await expect(person.page.getByText('각자의 여덟 글자를 한자리에서 견줍니다')).toHaveCount(0);
      /* 두 사람의 여덟 글자가 각자의 네 기둥 띠로 선다(`PillarPair`) — 관계 표는 없다 */
      await expect(person.page.getByRole('group', { name: /의 네 기둥$/ })).toHaveCount(2);
      await expect(person.page.getByRole('table')).toHaveCount(0);
      await expect(person.page.getByText('두 사주 사이의 관계')).toHaveCount(0);

      /*
        **동의 뒤에도 열리지 않는 것**(ADR 0012). 여덟 글자는 결과 화면에서 서로에게
        공개되지만 정확한 출생 원문과 출생지는 그때도 열리지 않는다.
      */
      await expect(person.page.getByText('1990-05-15')).toHaveCount(0);
      await expect(person.page.getByText('서울')).toHaveCount(0);

      /*
        **누를 것이 없다** (ADR 0038) — **성공 경로에서는.**

        풀이권은 요청할 때 예약되고 동의가 그것을 쓴다. 「먼저 누른 사람이 쓴다」가
        사라지는 것은 규칙을 하나 더 세워서가 아니라 누를 것이 없어져서다.

        **실패 경로에서까지 없애지는 않는다.** 글도 없고 도는 시도도 없으면 그 자리는
        막다른 골목이 되고, 그것이야말로 이 ADR 이 없애려던 자리다 — 그때는 「궁합풀이
        받기」가 되돌아오고 누른 사람이 한 번을 쓴다(`panel.tsx`, PRD §6.2).

        앞서 이 줄은 `toHaveCount(0)` 이었고 **그것이 통과한 까닭은 실패가 닫히지
        않았기 때문**이다: 수락한 쪽 세션으로는 청한 쪽의 시도를 못 닫아
        (`fail_reading_run` 이 `auth.uid()` 를 묻는다) 제출이 실패해도 시도가 10분간
        `running` 으로 서 있었고, 화면은 「만드는 중」을 보였다. 이제 열쇠로 닫으므로
        (ADR 0071 · #66) 실패가 제때 보인다. 이 시험 환경에는 모델 열쇠가 없어 자동
        생성이 곧 실패한다.

        그래서 시각에 안 달린 것을 잰다: **그 버튼은 실패한 자리에서만 선다.**
      */
      await expect(person.page.getByRole('heading', { name: `${partner} 님과의 궁합풀이` })).toBeVisible();

      const make = person.page.getByRole('button', { name: '궁합풀이 받기' });
      if ((await make.count()) > 0) {
        await expect(person.page.getByText(READING_FAILED_NOTE)).toBeVisible();
      }

    }
  });

  test('한쪽이 출생 정보를 고치면 pending 요청이 무효가 되고 그 사실이 알림함에 선다', async ({
    openAs,
  }) => {
    const tag = freshTag();
    const asker = await openAs({ selfPerson: true });
    const receiver = await openAs({ selfPerson: true });

    await bothParticipate(asker, receiver, tag);
    await pendingRequest(asker, receiver);

    await receiver.page.goto('/me/matching');
    await openReceivedRequests(receiver);
    await expect(receiver.page.getByRole('button', { name: '수락하고 궁합 열기' })).toBeVisible();

    // 보낸 쪽이 Evidence 를 바꾼다 — 이름이 아니라 여덟 글자를 바꾸는 수정이다.
    await asker.page.goto('/me');
    await asker.page.getByRole('button', { name: '출생 정보 수정' }).click();
    await fillBirthDate(asker.page, '1988-02-11');
    await asker.page.getByRole('button', { name: '변경 사항 저장' }).click();
    // 요청이 취소된다는 확인을 거쳐야 저장된다 — 경고는 그 누름 직전에 선다.
    await asker.page.getByRole('button', { name: '바꾸고 저장하기' }).click();
    await expect(asker.page.getByText('1988-02-11')).toBeVisible();

    /*
      **동의한 대상과 실제 계산 대상이 달라지지 않는다**(US 42 · 43). 받은 쪽에서 답할
      요청이 사라지고, **왜** 사라졌는지가 알림함에 남는다 — `invalidated` 와
      `cancelled` 를 갈라서 말하기로 한 것이 여기서 실제로 읽힌다.
    */
    await receiver.page.reload();
    await expect(receiver.page.getByRole('heading', { level: 1, name: '오늘의 인연' })).toBeVisible();
    await expect(receiver.page.getByRole('button', { name: '수락하고 궁합 열기' })).toHaveCount(0);
    await expect(receivedRequests(receiver)).toHaveCount(0);
    await expect(receiver.page.locator('#requests-lead')).toHaveCount(0);
    /* 무효가 된 까닭은 끝난 요청의 줄과 종의 소식 둘 다 말한다 */
    await openRequestHistory(receiver);
    await expect(receiver.page.getByText('출생 정보가 바뀌어 요청이 무효가 됐어요', { exact: false })).toBeVisible();
    await receiver.page.goto('/me/requests');
    await expect(
      receiver.page.getByText(`가${tag} 님과의 요청이 출생 정보가 바뀌어 무효가 됐어요`),
    ).toBeVisible();
  });

  test('신고는 차단과 따로 남고, 상대는 목록에서 사라지지 않는다', async ({ openAs }) => {
    const tag = freshTag();
    const asker = await openAs({ selfPerson: true });
    const receiver = await openAs({ selfPerson: true });

    await bothParticipate(asker, receiver, tag);
    await pendingRequest(asker, receiver);

    await receiver.page.goto('/me/matching');
    await openReceivedRequests(receiver);
    await receivedRequests(receiver).getByRole('button', { name: '신고', exact: true }).click();

    /*
      **차단과 무엇이 다른지 먼저 읽힌다.** 나란한 두 버튼이 같은 무게로 읽히면
      운영자가 봐야 할 일이 조용한 차단으로 끝나거나 그 반대가 된다.
    */
    await expect(receiver.page.getByText('신고는 운영자에게 기록을 남기는 것입니다', { exact: false })).toBeVisible();

    await receiver.page.getByLabel('신고 사유').selectOption({ label: '괴롭힘이나 위협' });
    await receiver.page.getByLabel('덧붙일 말 (선택)').fill('겪은 일을 적습니다.');
    await receiver.page.getByRole('button', { name: '신고하기' }).click();

    await expect(receiver.page.getByText('신고를 접수했습니다')).toBeVisible();

    /*
      **신고가 차단이 아니다.** 답할 요청은 그대로 서 있고, 상대도 후보 목록에서
      사라지지 않는다 — 보이지 않게 하려면 차단을 따로 눌러야 한다.
    */
    await expect(receiver.page.getByRole('button', { name: '수락하고 궁합 열기' })).toBeVisible();
    await expect(receiver.page.getByText('차단한 사람', { exact: false })).toHaveCount(0);
  });

  test('탈퇴를 신청하면 그 자리에서 모든 화면이 닫히고 이유를 갈라서 말한다', async ({
    openAs,
  }) => {
    const tag = freshTag();
    const leaver = await openAs({ selfPerson: true });
    const other = await openAs({ selfPerson: true });

    await bothParticipate(leaver, other, tag);
    await pendingRequest(other, leaver);

    await leaver.page.goto('/me/settings');
    await leaver.page.getByRole('button', { name: '탈퇴', exact: true }).click();

    /*
      **누르기 전에 읽는 말이 실제와 같아야 한다.**

      이 줄은 「저장된 자료는 그 자리에서 지워지지 않습니다 … 두 사람의 기록은 한쪽이
      지울 수 없습니다」를 잠그고 있었다. 그때는 참이었다 — 삭제 절차가 없었고 공유
      결과를 어떻게 할지 정하지 않았다. ADR 0023 이 그것을 정하면서 **반대가 됐다**:
      Match 는 양쪽 계정에 cascade 라 한쪽이 나가면 공유 결과가 양쪽에서 사라진다.

      시험이 틀린 약속을 잠그고 있었던 것이다. 지금 계약을 잠근다.
    */
    await expect(
      leaver.page.getByText('탈퇴 신청 후 3일 이내에 자동으로 지웁니다', { exact: false }),
    ).toBeVisible();
    await expect(
      leaver.page.getByText('상대 화면에서도 함께 사라집니다', { exact: false }),
    ).toBeVisible();

    await leaver.page.getByRole('button', { name: '탈퇴 신청하기' }).click();

    /*
      **이유를 갈라서 말한다.** 자기가 신청해서 그렇게 된 사람에게 「이용이 정지된 계정입니다」는
      거짓이다 — 상태 하나에 문장 하나가 매여 있다(`src/lib/account`). 이름은 PRD §5.3 의 표.
    */
    await expect(leaver.page.getByText('탈퇴를 신청한 계정입니다')).toBeVisible();
    await expect(leaver.page.getByText('이용이 정지된 계정입니다')).toHaveCount(0);

    // 새 관문을 두지 않았으므로 다른 화면도 같은 값을 보고 같은 말을 한다.
    for (const path of ['/me/people', '/me/discovery', '/me/requests']) {
      await leaver.page.goto(path);
      await expect(leaver.page.getByText('탈퇴를 신청한 계정입니다')).toBeVisible();
    }

    // 답을 기다리던 요청은 정리된다 — 상대가 답할 수 없는 요청을 계속 보지 않는다.
    await openRequestHistory(other);
    await expect(other.page.getByRole('heading', { name: '보낸 요청', exact: true })).toHaveCount(0);
  });

  /**
   * **동의 범위가 제출 버튼 앞에 읽히는가** — 좁은 화면에서(`prd-archive` 접근성 항목).
   *
   * 마크업 차례만 재면 부족하다. 좁은 화면에서 범위 목록이 길어지면 버튼이 위로
   * 올라와 붙어 버릴 수 있고, 그러면 **읽기 전에 누를 수 있는 배치**가 된다.
   * 재는 것은 「먼저 그려졌나」가 아니라 **「버튼보다 위에 있나」**다.
   */
  test('좁은 화면에서도 요청 안내가 보내기 버튼 위에 선다', async ({ openAs, isMobile }) => {
    test.skip(!isMobile, '좁은 화면에서만 재는 배치다');

    const tag = freshTag();
    const asker = await openAs({ selfPerson: true });
    const receiver = await openAs({ selfPerson: true });
    await bothParticipate(asker, receiver, tag);

    await asker.page.goto('/me/matching');
    /*
      **첫 카드로 좁힌다.** 시험들이 나란히 도는 동안 남의 후보가 목록에 함께 설 수
      있고, 여기서 재는 것은 「누가 서 있나」가 아니라 **한 카드 안의 배치**다.
    */
    await asker.page.getByRole('button', { name: '상세 궁합 요청하기' }).first().click();

    const dialog = asker.page.getByRole('dialog');
    const scope = dialog.getByText('풀이권 1회가 임시로 차감됩니다', { exact: false });
    const send = dialog.getByRole('button', { name: '요청 보내기' });
    await expect(scope).toBeVisible();
    await expect(send).toBeVisible();

    const above = await scope.boundingBox();
    const below = await send.boundingBox();
    expect(above).not.toBeNull();
    expect(below).not.toBeNull();
    expect(above!.y + above!.height).toBeLessThanOrEqual(below!.y);

    // 가로로 밀려나 있으면 세로 차례는 지켜도 안 읽힌다.
    const width = asker.page.viewportSize()?.width ?? 0;
    expect(above!.x).toBeGreaterThanOrEqual(0);
    expect(above!.x + above!.width).toBeLessThanOrEqual(width);
  });

  /**
   * **인연 기록은 인연 탭 안의 화면이다**(2026-09-29 u2). 기록이 없으면 탭에 「인연 기록」 줄이 안 서고, 주소로 열어도 인연 탭
   * 불이 켜진 채 빈 기록을 한 줄로 말한다. ← 는 인연 탭으로 간다.
   */
  test('인연 기록은 인연 탭 불을 켜고, 비어 있으면 탭에 줄이 안 선다', async ({ openAs }) => {
    const viewer = await openAs({ selfPerson: true });
    const page = viewer.page;

    await page.goto('/me/matching');
    await expect(page.getByRole('heading', { level: 1, name: '오늘의 인연' })).toBeVisible();
    await expect(page.getByRole('link', { name: /^인연 기록/ })).toHaveCount(0);

    await page.goto('/me/matching/history');
    await expect(page.getByRole('heading', { level: 1, name: '인연 기록' })).toBeVisible();
    await expect(page.getByText('아직 인연 기록이 없어요.')).toBeVisible();
    await expect(
      page.getByRole('link', { name: /^인연/ }).and(page.locator('[aria-current="page"]')).filter({ visible: true }),
    ).toHaveCount(1);

    await page.getByRole('main').getByRole('link', { name: '인연', exact: true }).click();
    await expect(page).toHaveURL(/\/me\/matching$/);
  });

  /**
   * **인연 탭은 한 화면이다 — 받은 요청이 있는 날도**(운영자 답 2026-09-29 u2, 시안 u).
   *
   * 폰은 덱이 뷰포트에 묶여(`globals.css` 의 `data-deck-fit`) 넘친 것은 스크롤로도 못 본다 — #330 의 최근 인연 궁합과 지난
   * 요청이 그렇게 잘렸다. 그래서 재는 것은 「띠 · 카드 · 인연 기록 한 줄이 아래 독 위에서 끝나는가」와 「문서가 안 넘치는가」다.
   * 띠가 선 날은 그 높이만큼 카드 사진이 준다 — 그 값을 남긴다(시안의 예산과 견준다).
   */
  test('받은 요청 띠 · 오늘의 인연 · 인연 기록 한 줄이 폰 한 화면에 든다', async ({ openAs, isMobile }) => {
    test.skip(!isMobile, '폰 한 화면을 재는 배치다');

    const tag = freshTag();
    const asker = await openAs({ selfPerson: true });
    const receiver = await openAs({ selfPerson: true });
    const past = await openAs({ selfPerson: true });
    const shown = await openAs({ selfPerson: true });
    await optIn(asker.api, `가${tag}`);
    await optIn(receiver.api, `나${tag}`);
    await optIn(past.api, `다${tag}`);
    await optIn(shown.api, `라${tag}`);
    const everyone = [asker, receiver, past, shown].map((person) => person.account.email);
    onlyTheseParticipate(everyone);
    forgetBoards(everyone);

    /* 끝난 요청 하나(인연 기록 1)와 답할 요청 하나(띠) — 덱에는 요청이 얽히지 않은 사람이 선다 */
    await pendingRequest(past, receiver);
    await respondThroughApi(receiver, false);
    await pendingRequest(asker, receiver);

    const page = receiver.page;
    await page.setViewportSize({ width: 390, height: 664 });

    const measure = async () => {
      await page.goto('/me/matching');
      const card = page.locator('[data-deck-fit]');
      const row = page.getByRole('link', { name: /^인연 기록 \d/ });
      const dock = page.locator('#mobile-member-navigation');
      await expect(card).toBeVisible();
      await expect(row).toBeVisible();
      const [cardBox, rowBox, dockBox] = await Promise.all([card.boundingBox(), row.boundingBox(), dock.boundingBox()]);
      expect(rowBox!.y + rowBox!.height).toBeLessThanOrEqual(dockBox!.y);
      expect(await page.evaluate(() => document.documentElement.scrollHeight <= window.innerHeight)).toBe(true);
      /* 사진이 줄어도 사진 위의 이름은 카드 안에서 온전히 읽힌다 — 위로 잘리면 누구의 카드인지 모른다 */
      const name = await card.getByRole('heading', { level: 2 }).last().boundingBox();
      expect(name!.y).toBeGreaterThanOrEqual(cardBox!.y);
      return Math.round(cardBox!.height);
    };

    const withBand = await measure();
    await expect(page.getByRole('button', { name: /^받은 요청 1/ })).toBeVisible();

    await respondThroughApi(receiver, false);
    const withoutBand = await measure();
    await expect(page.getByRole('button', { name: /^받은 요청/ })).toHaveCount(0);

    /* 띠가 선 날 사진이 준 값 — 한 화면에 들되 카드는 사진으로 읽힐 만큼 남는다 */
    test.info().annotations.push({ type: 'deck-card-height', description: `띠 없음 ${withoutBand}px · 띠 있음 ${withBand}px` });
    expect(withBand).toBeLessThan(withoutBand);
    expect(withBand).toBeGreaterThanOrEqual(200);
  });

  /**
   * **키보드만으로 요청·수락·차단에 닿는가**(`prd-archive` 접근성 항목).
   *
   * 세 문 다 `button` 이라 마우스로는 눌린다. 키보드로도 눌리는지는 **초점이
   * 그 자리에 갈 수 있는가**에 달려 있고, 그것은 마크업이 아니라 배치가 정한다 —
   * 초점을 못 받는 칸에 얹힌 조작은 이 시험에서만 드러난다.
   */
  test('요청·수락·차단에 키보드만으로 닿는다', async ({ openAs }) => {
    const tag = freshTag();
    const asker = await openAs({ selfPerson: true });
    const receiver = await openAs({ selfPerson: true });
    await bothParticipate(asker, receiver, tag);

    /**
     * 초점을 눌러 옮긴다. 못 닿으면 그 자리에서 죽는다 — 눌러 본 적 없는 문이다.
     *
     * **카드를 이름으로 좁혀서 잡는다.** 시험들이 나란히 도는 동안 남의 후보가 목록에
     * 함께 서면 `.first()` 는 매번 다른 카드를 가리키고, 그러면 이 시험은 배치가
     * 아니라 **그날의 목록 순서**를 재게 된다.
     */
    const reach = async (person: Person, name: string, within?: Locator) => {
      const target = (within ?? person.page).getByRole('button', { name });
      await expect(target).toBeVisible();
      for (let step = 0; step < 80; step += 1) {
        if (await target.evaluate((node) => node === document.activeElement)) return;
        await person.page.keyboard.press('Tab');
      }
      throw new Error(`탭으로 「${name}」에 못 닿았습니다`);
    };

    await asker.page.goto('/me/matching');
    await reach(asker, '상세 궁합 요청하기');
    await asker.page.keyboard.press('Enter');

    const confirmRequest = asker.page.getByRole('dialog');
    await expect(confirmRequest).toBeVisible();
    await expect(confirmRequest.getByRole('button', { name: '요청 보내기' })).toBeFocused();
    await asker.page.keyboard.press('Enter');
    await sentRequest(asker);
    // 눌린 것이 실제로 요청이 됐는지는 목록에서 본다 — 초점만 닿고 안 눌리면 여기서 갈린다.
    await openRequestHistory(asker);
    await expect(asker.page.getByRole('heading', { name: '보낸 요청', exact: true })).toBeVisible();

    await receiver.page.goto('/me/matching');
    await openReceivedRequests(receiver);
    const received = receivedRequests(receiver).getByRole('listitem').filter({ hasText: `가${tag}` });
    /* 카드 밑단의 조용한 글자 둘 — 「차단」은 글자 둘이라 폭이 31.8px 이었다(2026-09-25) */
    await expectTargets({
      '요청 카드의 차단': received.getByRole('button', { name: '차단', exact: true }),
      '요청 카드의 신고': received.getByRole('button', { name: '신고', exact: true }),
    });
    await reach(receiver, '수락하고 궁합 열기', received);
    await receiver.page.keyboard.press('Enter');
    /**
     * **수락은 화면을 옮기지 않는다**(ADR 0058) — 성립한 궁합은 요청 카드 자리가 아니라 풀이
     * 목록에 선다. 그래서 답이 난 것을 이 자리에서 재고, 결과가 어디 서는지는 흐름
     * 시험이 따로 잡는다. 결과 화면으로 옮겨 가는 것을 여기서 기다리면, 안 눌렸을
     * 때와 「안 옮겨 가는 것이 맞을 때」가 같은 실패로 보인다.
     *
     * 단추가 사라진 것으로 재면 안 된다 — 누르는 순간 글자가 바뀌어 사라진다. 그 뒤에
     * 화면을 옮기면 가던 POST 가 끊겨 수락이 서버에 닿지 않는다(`acceptedRequest`).
     */
    await acceptedRequest(receiver);

    /**
     * 차단은 **한 번 더 묻는다.** 그래서 키보드로 닿아야 하는 문이 둘이다 — 여는
     * 것과 확인하는 것. 확인 칸이 탭 순서 밖에 있으면 마우스로만 차단할 수 있게 된다.
     *
     * **수락한 뒤의 차단은 결과 화면에 있다.** 인연 탭의 요청 카드는 답이 난 순간 「끝난 요청」
     * 으로 접히고, 그 줄에는 조작이 없다 — 성립한 쌍을 끊는 자리는 풀이가 사는 곳이다.
     */
    await receiver.page.goto('/me/readings');
    await receiver.page.getByRole('link', { name: new RegExp(`가${tag} 님과의 궁합풀이`) }).click();
    await expectTargets({ '결과 화면의 차단': receiver.page.getByRole('button', { name: '차단', exact: true }) });
    await reach(receiver, '차단');
    await receiver.page.keyboard.press('Enter');
    await reach(receiver, '차단하기');
  });

  test('차단하면 그 사람은 후보에서도 사라지고 새 요청도 서지 않는다', async ({ openAs }) => {
    const tag = freshTag();
    const asker = await openAs({ selfPerson: true });
    const receiver = await openAs({ selfPerson: true });

    await bothParticipate(asker, receiver, tag);
    await pendingRequest(asker, receiver);

    await receiver.page.goto('/me/matching');
    await openReceivedRequests(receiver);
    await expect(receivedRequests(receiver).getByRole('heading', { name: `가${tag}` })).toBeVisible();

    // 차단은 한 번 더 묻는다 — 되돌리지 않기 때문이다(용어집).
    await receivedRequests(receiver).getByRole('button', { name: '차단', exact: true }).click();
    await receivedRequests(receiver).getByRole('button', { name: '차단하기' }).click();
    await expect(receivedRequests(receiver)).toHaveCount(0);
    await openRequestHistory(receiver);

    /*
      **누구를 차단했는지는 적지 않는다.** 차단한 뒤에는 그 사람의 프로필을 읽을 이유가
      없어서 별명을 붙들고 있지 않다.
    */
    await expect(receiver.page.getByText('차단한 사람 1명', { exact: false })).toBeVisible();
    await expect(receiver.page.getByRole('heading', { name: `가${tag}` })).toHaveCount(0);

    // 막는 것은 한쪽이 아니다 — 보낸 쪽의 후보 목록에서도 사라진다(제재는 양방향).
    await asker.page.goto('/me/matching');
    await expect(asker.page.getByRole('heading', { name: `나${tag}` })).toHaveCount(0);

    // 새 요청도 서지 않는다.
    const board = await asker.api.rpc('my_discovery_board');
    expect(board.error).toBeNull();
    const partner = await receiver.api.from('discovery_profile').select('user_id').maybeSingle();
    const again = await asker.api.rpc('request_match', {
      p_candidate_user_id: partner.data?.user_id,
    });
    expect(again.error).not.toBeNull();
  });
});

/**
 * 덱으로 보는 오늘의 인연 — **목록과 같은 자료, 같은 문턱.**
 *
 * 카드 모양이 다르다고 규칙이 달라지면 안 된다. 재는 것은 둘이다: 진짜 후보가 실제로
 * 서는가, 그리고 **하트 한 번으로 요청이 나가 버리지 않는가.** 풀이권 1회 예약과
 * 여덟 글자 공개는 누르기 전에 읽혀야 한다.
 */
test.describe('덱으로 보는 오늘의 인연', () => {
  test('진짜 후보가 서고, 확인 창을 지나야 요청이 난다', async ({ openAs }) => {
    const tag = freshTag();
    const asker = await openAs({ selfPerson: true });
    const receiver = await openAs({ selfPerson: true });
    await bothParticipate(asker, receiver, tag);

    await asker.page.goto('/me/matching');
    await passUntilShown(asker.page, asker.page.getByRole('heading', { name: `나${tag}` }));

    /*
      **점수는 서버가 준 값이다 — 화면이 다시 세지 않는다.**

      상세 창을 걷은 뒤로(5차) 점수와 판정과 이유가 카드 위에 펼쳐져 있다. 재는 것은
      그대로다: 서버가 준 수가 그 사람의 카드에 서는가. 숫자는 폭마다 자리가 달라(폰은 사진
      위, 넓은 화면은 사진 아래) 둘 중 **지금 보이는 하나**를 잰다.
    */
    await expect(
      asker.page.getByRole('region', { name: '인연 카드' }).getByText(/\d+ \/ 100/).filter({ visible: true }),
    ).toBeVisible();

    // ── 하트만으로는 안 나간다 ──────────────────────────────────────────────
    await asker.page.getByRole('button', { name: '상세 궁합 요청하기' }).click();
    const confirming = asker.page.getByRole('dialog');
    await expect(confirming).toContainText('풀이권 1회가 임시로 차감됩니다');
    await expect(confirming).toContainText('내 사주팔자 여덟 글자가 상대에게 공개');
    await confirming.getByRole('button', { name: '요청 보내기' }).click();
    await sentRequest(asker);

    // 눌린 것이 실제로 요청이 됐는지는 **받은 쪽에서** 본다 — 인연 탭 맨 위의 받은 요청(ADR 0130).
    await receiver.page.goto('/me/matching');
    await openReceivedRequests(receiver);
    await expect(receivedRequests(receiver).getByRole('heading', { name: `가${tag}` })).toBeVisible();
  });
});

/**
 * **기본 아바타는 그 사람 일간의 색이다 — 채워 주는 기운의 색이 아니다**(운영자 2026-09-24).
 *
 * 전에는 아바타가 카드처럼 채워 주는 기운을 입어, 한 화면의 사진 없는 후보가 거의 다 같은 색이었다. 재는 것은 셋이다:
 * 일간이 다른 두 사람의 아바타가 **다른 색**을 입는가, 그 색이 그 사람 일간의 오행인가, 아바타에 **첫 글자 밖의 글자가
 * 없는가**(일간 · 오행을 글로 말하지 않는다). 두 사람의 여덟 글자는 같게 태어나므로 일주의 천간만 SQL 로 갈아 끼운다.
 */
test.describe('사진 없는 후보의 기본 아바타', () => {
  test('일간이 다른 두 사람은 서로 다른 색을 입고, 그 색을 글로 말하지 않는다', async ({ openAs }, testInfo) => {
    const tag = freshTag();
    const asker = await openAs({ selfPerson: true });
    const wood = await openAs({ selfPerson: true });
    const fire = await openAs({ selfPerson: true });
    await optIn(asker.api, `가${tag}`);
    await optIn(wood.api, `라${tag}`);
    await optIn(fire.api, `마${tag}`);
    for (const [person, stem] of [[wood, '甲'], [fire, '丙']] as const) {
      sql(`update public.person p
           set current_chart = jsonb_set(jsonb_set(p.current_chart, '{day,stem}', '"${stem}"'), '{dayMaster}', '"${stem}"')
           from public.app_user u join auth.users a on a.id = u.id
           where u.self_person_id = p.id and a.email = '${person.account.email}'`);
    }
    const emails = [asker, wood, fire].map((person) => person.account.email);
    onlyTheseParticipate(emails);
    forgetBoards(emails);

    await asker.page.goto('/me/matching');
    await expect(asker.page.getByRole('region', { name: '인연 카드' })).toBeVisible();

    /* 첫 글자가 선 자리 — 덱 · 지도가 같은 얼굴(`CandidatePhoto`)을 쓴다. 판의 색은 클래스 이름이 든다 */
    const avatarOf = (initial: string) =>
      asker.page.locator('span[aria-hidden="true"][class*="tone-"]').filter({ hasText: new RegExp(`^${initial}$`) }).first();
    await expect(avatarOf('라')).toHaveClass(/\btone-wood\b/);
    await expect(avatarOf('마')).toHaveClass(/\btone-fire\b/);

    for (const initial of ['라', '마']) {
      const avatar = avatarOf(initial);
      await expect(avatar).toHaveText(initial);
      await expect(avatar).not.toHaveAttribute('title');
      await expect(avatar).not.toHaveAttribute('aria-label');
    }

    await asker.page.screenshot({ path: testInfo.outputPath('avatars.png'), fullPage: true });
  });
});

/**
 * **X 는 보관이다.**
 *
 * 그냥 넘기는 것이 아니라 「지나친 인연」에 쌓이고 새 추천에 다시 서지 않는다. 부담 없이
 * 넘기되 나중에 다시 꺼내 볼 수 있어야 하므로, 누른 직후에 **되돌릴 한 줄**이 선다.
 * 이 구분은 눈에 안 보여서 회귀가 조용히 난다 — 그래서 잰다.
 */
test.describe('지나친 인연에 보관하기', () => {
  test('X 로 둔 사람은 되돌릴 수 있다', async ({ openAs }) => {
    const tag = freshTag();
    const asker = await openAs({ selfPerson: true });
    const receiver = await openAs({ selfPerson: true });
    await bothParticipate(asker, receiver, tag);

    await asker.page.goto('/me/matching');

    const target = asker.page.getByRole('heading', { name: `나${tag}` });
    const next = asker.page.getByRole('button', { name: '다음 인연으로 지나가기' });
    await passUntilShown(asker.page, target);

    // 「지나친 인연」을 여는 문이 카드 위에 선다.
    await expect(asker.page.getByRole('button', { name: /지나친 인연/ })).toBeVisible();

    await next.click();

    /*
      확인 창을 띄우지 않는다 — 둔 다음에 한 줄로 알리고 되돌릴 길을 준다.

      **되돌릴 문으로 잰다.** 낱말로 잡으면 그 말이 화면에 몇 번 적혔는지를 재게 된다.
    */
    const undo = asker.page.getByRole('button', { name: '실행 취소' });
    await expect(undo).toBeVisible();

    /*
      **카드가 다 떠난 뒤에 누른다.** 고른 것을 읽을 시간(700ms)과 떠나는 시간(550ms)이
      끝나기 전에 누르면, 되돌리는 것과 다음 장으로 넘기는 것이 같은 자리를 두고 다툰다.

      **넘김 버튼이 살아나기를 기다리면 안 된다.** 그 버튼은 `!profile || exit` 일 때
      죽는데, 풀을 둘로 좁힌 이 시험에서는 한 장뿐인 덱이 비어 `profile` 이 없어진다 —
      영영 안 살아난다(`f263eda` 에서 그렇게 죽었다). 떠난 것은 그 사람의 제목이 사라진 것으로 본다.
    */
    await expect(target).toHaveCount(0);
    await undo.click();

    await expect(target).toBeVisible();
  });
});

test.describe('보관함 복원 회귀', () => {
  test('새로고침 뒤 보관함에서 복원하면 실제 카드와 저장이 함께 돌아온다', async ({ openAs }) => {
    const tag = freshTag();
    const asker = await openAs({ selfPerson: true });
    const receiver = await openAs({ selfPerson: true });
    await bothParticipate(asker, receiver, tag);
    await asker.page.goto('/me/matching');
    await expect(asker.page.getByRole('heading', { name: `나${tag}` })).toBeVisible();
    await asker.page.getByRole('button', { name: '다음 인연으로 지나가기' }).click();
    await expect(asker.page.getByRole('button', { name: '실행 취소' })).toBeVisible();
    await asker.page.reload();
    await asker.page.getByRole('button', { name: /지나친 인연/ }).click();
    const panel = asker.page.getByRole('region', { name: /지나친 인연/ });
    await panel.getByRole('listitem').filter({ hasText: `나${tag}` }).getByRole('button', { name: '다시 만나보기' }).click();
    await expect(panel).not.toBeVisible();
    await expect(asker.page.getByRole('heading', { name: `나${tag}` })).toBeVisible();
    expect((await asker.api.rpc('my_passed_connections')).data).toEqual([]);
    await asker.page.reload();
    await expect(asker.page.getByRole('heading', { name: `나${tag}` })).toBeVisible();
  });
});

/**
 * **덱은 여섯 자리이고, 떠나면 풀에서 한 명이 바로 채운다**(ADR 0115).
 *
 * 채우는 일은 DB 가 덱을 읽을 때 하고, 넘김의 응답이 다시 그린 목록으로 화면에 온다 — 새로 고치지 않아도 채운 사람이
 * 덱 뒤에 붙는가를 화면으로 잰다. 일곱을 세우면 처음 덱은 여섯이고 일곱째는 덱 밖에 있다. 한 명을 넘기면 일곱째가 뒤에 붙고,
 * 넘겨 가면 그 사람의 카드가 선다. 다 넘기면 풀이 비어 빈 화면이 선다.
 */
test.describe('채워지는 덱', () => {
  test('한 명을 넘기면 덱 밖의 사람이 뒤에 붙고, 풀이 비면 빈 화면이 선다', async ({ openAs }) => {
    const tag = freshTag();
    const viewer = await openAs({ selfPerson: true });
    const others: Person[] = [];
    for (let i = 0; i < 7; i += 1) others.push(await openAs({ selfPerson: true }));
    await optIn(viewer.api, `가${tag}`);
    const prefixes = ['나', '다', '라', '마', '바', '사', '아'];
    for (const [i, other] of others.entries()) await optIn(other.api, `${prefixes[i]}${tag}`);
    onlyTheseParticipate([viewer.account.email, ...others.map((other) => other.account.email)]);
    forgetBoards([viewer.account.email]);

    await viewer.page.goto('/me/matching');
    await expect(viewer.page.getByRole('region', { name: '인연 카드' })).toBeVisible();

    const inDeck = sql(`select count(*) from public.discovery_candidate_slot slot
         join public.discovery_candidate d on d.id = slot.snapshot_id
         join auth.users u on u.id = d.user_id where u.email = '${viewer.account.email}'`);
    expect(Number(inDeck)).toBe(6);
    const outside = sql(`select a.nickname from public.app_user a join auth.users u on u.id = a.id
       where u.email in (${others.map((other) => `'${other.account.email}'`).join(', ')})
         and not exists (
           select 1 from public.discovery_candidate_slot slot
           join public.discovery_candidate d on d.id = slot.snapshot_id
           join auth.users me on me.id = d.user_id
           where me.email = '${viewer.account.email}' and slot.candidate_user_id = a.id)`).trim();
    expect(outside).toMatch(new RegExp(`${tag}$`));

    const deck = viewer.page.getByRole('region', { name: '인연 카드' });
    await passShownCard(
      viewer.page,
      deck.getByRole('article').getByRole('heading').first(),
      viewer.page.getByRole('button', { name: '다음 인연으로 지나가기' }),
    );
    /* 새로 고치지 않는다 — 넘김의 응답이 채운 사람을 싣고 온다 */
    await passUntilShown(viewer.page, deck.getByRole('heading', { name: outside, exact: true }));

    await passUntilShown(viewer.page, viewer.page.getByRole('heading', { name: DISCOVERY_EMPTY.title }));
    await expect(viewer.page.getByText(DISCOVERY_EMPTY.line)).toBeVisible();
    await expect(viewer.page.getByRole('button', { name: /목록 새로 고치기/ })).toHaveCount(0);
  });
});

test.describe('매칭 덱 상태 회귀', () => {
  test('두 번 지나친 뒤 연속 되돌리면 두 사람 모두 서버 보관에서 빠진다', async ({ openAs }) => {
    const tag = freshTag();
    const viewer = await openAs({ selfPerson: true });
    const first = await openAs({ selfPerson: true });
    const second = await openAs({ selfPerson: true });
    await optIn(viewer.api, `가${tag}`);
    await optIn(first.api, `나${tag}`);
    await optIn(second.api, `다${tag}`);
    onlyTheseParticipate([viewer.account.email, first.account.email, second.account.email]);
    forgetBoards([viewer.account.email]);
    await viewer.page.goto('/me/matching');
    const article = viewer.page.getByRole('article');
    const names: string[] = [];
    for (let i = 0; i < 2; i++) {
      names.push((await article.getByRole('heading').textContent())!);
      await viewer.page.getByRole('button', { name: '다음 인연으로 지나가기' }).click();
      await expect(article.getByRole('heading', { name: names[i] })).not.toBeVisible();
    }
    expect((await viewer.api.rpc('my_passed_connections')).data).toHaveLength(2);
    for (const name of names.toReversed()) {
      /*
        덱이 비면 카드 아래의 되돌리기 단추도 카드와 함께 걷히고 「실행 취소」 한 줄만 남는다 —
        둘은 같은 복원 경로다. 첫 번은 빈 덱에서, 둘째 번은 돌아온 카드 아래에서 누른다.
      */
      const control = (await article.count()) > 0 ? '이전 인연으로 되돌리기' : '실행 취소';
      await viewer.page.getByRole('button', { name: control }).click();
      await expect(article.getByRole('heading', { name })).toBeVisible();
    }
    expect((await viewer.api.rpc('my_passed_connections')).data).toEqual([]);
    await viewer.page.reload();
    await expect(article.getByRole('heading', { name: names[0] })).toBeVisible();
  });

  test('이동 중 취소와 복원 실패 뒤 재시도가 카드를 잃지 않는다', async ({ openAs }) => {
    const tag = freshTag();
    const viewer = await openAs({ selfPerson: true });
    const partner = await openAs({ selfPerson: true });
    await bothParticipate(viewer, partner, tag);
    await viewer.page.goto('/me/matching');
    const heading = viewer.page.getByRole('article').getByRole('heading', { name: `나${tag}` });
    await viewer.page.getByRole('button', { name: '다음 인연으로 지나가기' }).click();
    /*
      저장 뒤 떠나는 동안 복원한다. 되돌리는 길은 **그때 서 있는 쪽**이다 — 카드가 아직 서 있으면 카드 아래의 ↶, 한 장뿐인
      덱이 이미 비었으면 「실행 취소」 줄(카드 위에는 되돌리기 줄이 없다, 2026-09-25). 둘은 같은 복원 경로다. ↶ 는 저장이 끝날
      때까지 잠기고 카드는 그 뒤 0.46초면 떠나므로, 한쪽만 기다리면 느린 러너에서 그 틈을 놓친다(CI 36085813111).
    */
    const back = viewer.page
      .getByRole('button', { name: '이전 인연으로 되돌리기' })
      .or(viewer.page.getByRole('button', { name: '실행 취소' }));
    await expect(back).toBeEnabled();
    await back.click();
    await viewer.page.waitForTimeout(1400);
    await expect(heading).toBeVisible();
    const undo = viewer.page.getByRole('button', { name: '실행 취소' });
    await expect(undo).not.toBeVisible();
    await viewer.page.getByRole('button', { name: '다음 인연으로 지나가기' }).click();
    await expect(undo).toBeEnabled();
    await viewer.page.route('**/me/matching', async (route) => {
      if (route.request().method() === 'POST') {
        await route.fulfill({ status: 500, body: 'test restore failure' });
      } else await route.continue();
    });
    await undo.click();
    await expect(viewer.page.getByText('카드를 되돌리지 못했어요. 잠시 뒤 다시 시도해 주세요.')).toBeVisible();
    await expect(undo).toBeEnabled();
    expect((await viewer.api.rpc('my_passed_connections')).data).toHaveLength(1);
    await viewer.page.unroute('**/me/matching');
    await undo.click();
    await expect(heading).toBeVisible();
    await expect(undo).not.toBeVisible();
    expect((await viewer.api.rpc('my_passed_connections')).data).toEqual([]);
  });

  test('보관함은 실제 사진을 읽고 예시 안내를 표시하지 않는다', async ({ openAs }) => {
    const tag = freshTag();
    const viewer = await openAs({ selfPerson: true });
    const partner = await openAs({ selfPerson: true });
    await bothParticipate(viewer, partner, tag);
    const png = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aWZkAAAAASUVORK5CYII=';
    const uploaded = await partner.api.rpc('set_my_photo', { p_content_type: 'image/png', p_base64: png });
    expect(uploaded.error).toBeNull();
    await viewer.page.goto('/me/matching');
    await viewer.page.getByRole('button', { name: '다음 인연으로 지나가기' }).click();
    await expect(viewer.page.getByRole('button', { name: '실행 취소' })).toBeVisible();
    await viewer.page.reload();
    await viewer.page.getByRole('button', { name: /지나친 인연/ }).click();
    const panel = viewer.page.getByRole('region', { name: /지나친 인연/ });
    // 목록 위의 궤도 띠도 같은 얼굴을 그린다 — 재는 것은 목록의 한 줄이다.
    const photo = panel.getByRole('listitem').locator('img');
    await expect(photo).toHaveCount(1);
    const response = await viewer.page.request.get((await photo.getAttribute('src'))!);
    expect(response.status()).toBe(200);
    await expect(panel.getByText(/예시|연결 준비 중/)).toHaveCount(0);
  });
});

/**
 * **카드의 사진은 넘겨 보되 글은 그대로다**(G-60, 운영자 2026-09-25 시안).
 *
 * 사진 맨 위에 장 수만큼의 막대(단추, 「사진 2 / 4」), 사진 오른쪽 반 = 다음 · 왼쪽 반 = 이전. **끝에서는 돌지 않는다** —
 * 마지막 장에서 더 눌러도 첫 장으로 안 간다. 장이 바뀌어도 이름 · 점수 · 판정 · 기운 · 소개는 한 글자도 안 바뀐다.
 * 한 장이거나 없으면 막대도 누를 자리도 없다.
 */
test.describe('사진 여러 장을 넘겨 보는 카드', () => {
  const PNG_1PX = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aWZkAAAAASUVORK5CYII=';
  const barsOf = (card: Locator) => card.getByRole('button', { name: /^사진 \d+ \/ \d+$/ });

  /** 덱을 넘겨 그 사람의 카드를 세운다 — 나란히 도는 시험이 만든 참여자가 앞에 설 수 있다 */
  async function showCandidate(person: Person, nickname: string): Promise<Locator> {
    await person.page.goto('/me/matching');
    await passUntilShown(person.page, person.page.getByRole('heading', { name: nickname }));
    return person.page.getByRole('article', { name: `${nickname} 님` });
  }

  /** 빨강 · 초록 · 파랑 한 점 — 장마다 바이트가 달라야 넘긴 것이 보인다 */
  const COLOR_PNGS = [
    'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAIAAACQd1PeAAAADElEQVR4nGM4YWMDAAMQAUEiFmcFAAAAAElFTkSuQmCC',
    'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAIAAACQd1PeAAAADElEQVR4nGOwWRAFAAJSATfQrk7zAAAAAElFTkSuQmCC',
    'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAIAAACQd1PeAAAADElEQVR4nGOwiToBAAI0AV8p3ELTAAAAAElFTkSuQmCC',
  ];

  /** 사진을 뒤에 한 장씩 붙인다 — 첫 장이 대표다 */
  async function addPhotos(person: Person, count: number): Promise<void> {
    for (const png of COLOR_PNGS.slice(0, count)) {
      expect((await person.api.rpc('add_my_photo', { p_content_type: 'image/png', p_base64: png })).error).toBeNull();
    }
  }

  /** 사진의 한쪽 반을 누른다 — 글 판 위라도 누름은 사진으로 흘러간다 */
  async function tapPhoto(card: Locator, side: 'left' | 'right'): Promise<void> {
    const photos = card.locator('[data-card-photos]');
    const box = (await photos.boundingBox())!;
    await photos.click({ position: { x: box.width * (side === 'left' ? 0.2 : 0.8), y: box.height * 0.5 } });
  }

  test('한 장이거나 없으면 막대도 누를 자리도 없다', async ({ openAs }) => {
    const tag = freshTag();
    const viewer = await openAs({ selfPerson: true });
    const withPhoto = await openAs({ selfPerson: true });
    const without = await openAs({ selfPerson: true });
    await optIn(viewer.api, `가${tag}`);
    await optIn(withPhoto.api, `사${tag}`);
    await optIn(without.api, `아${tag}`);
    expect((await withPhoto.api.rpc('set_my_photo', { p_content_type: 'image/png', p_base64: PNG_1PX })).error).toBeNull();
    const emails = [viewer, withPhoto, without].map((person) => person.account.email);
    onlyTheseParticipate(emails);
    forgetBoards(emails);

    /* 덱을 한 번 지나며 두 사람을 다 본다 — 넘긴 사람은 덱에 다시 안 선다 */
    await viewer.page.goto('/me/matching');
    const card = viewer.page.getByRole('region', { name: '인연 카드' }).getByRole('article');
    const seen = new Set<string>();
    for (let step = 0; step < 12 && seen.size < 2; step += 1) {
      const nickname = (await card.getByRole('heading').first().textContent()) ?? '';
      if (nickname === `사${tag}` || nickname === `아${tag}`) {
        await expect(barsOf(card)).toHaveCount(0);
        await expect(card.locator('[data-card-photos]')).toHaveCount(0);
        // 뒤에서 기다리는 다음 카드(`aria-hidden`)의 사진은 세지 않는다
        await expect(card.locator('img:not([aria-hidden="true"] img)')).toHaveCount(nickname === `사${tag}` ? 1 : 0);
        seen.add(nickname);
      }
      const next = viewer.page.getByRole('button', { name: '다음 인연으로 지나가기' });
      if (seen.size === 2 || !(await next.isVisible())) break;
      await passShownCard(viewer.page, card.getByRole('heading').first(), next);
    }
    expect([...seen].sort()).toEqual([`사${tag}`, `아${tag}`]);
  });

  test('오른쪽 반은 다음 · 왼쪽 반은 이전, 끝에서 돌지 않고 글은 그대로다', async ({ openAs }, testInfo) => {
    const tag = freshTag();
    const viewer = await openAs({ selfPerson: true });
    const partner = await openAs({ selfPerson: true });
    await bothParticipate(viewer, partner, tag);
    await addPhotos(partner, 3);

    const card = await showCandidate(viewer, `나${tag}`);
    const bars = barsOf(card);
    await expect(bars).toHaveCount(3);
    const current = bars.and(card.locator('[aria-current="true"]'));
    const text = await card.innerText();
    const shown = async () => (await card.locator('[data-card-photos] img').getAttribute('src'))!;

    await expect(current).toHaveAccessibleName('사진 1 / 3');
    const first = await shown();
    await viewer.page.screenshot({ path: testInfo.outputPath('photos.png') });

    // 첫 장에서 왼쪽 — 끝 장으로 돌지 않는다
    await tapPhoto(card, 'left');
    await expect(current).toHaveAccessibleName('사진 1 / 3');
    expect(await shown()).toBe(first);

    await tapPhoto(card, 'right');
    await expect(current).toHaveAccessibleName('사진 2 / 3');
    expect(await shown()).not.toBe(first);
    expect(await card.innerText()).toBe(text);

    await tapPhoto(card, 'right');
    await expect(current).toHaveAccessibleName('사진 3 / 3');
    const last = await shown();

    // 끝 장에서 오른쪽 — 첫 장으로 돌지 않는다
    await tapPhoto(card, 'right');
    await expect(current).toHaveAccessibleName('사진 3 / 3');
    expect(await shown()).toBe(last);
    expect(await card.innerText()).toBe(text);

    await tapPhoto(card, 'left');
    await expect(current).toHaveAccessibleName('사진 2 / 3');

    // 키보드 — 막대는 단추다
    await bars.nth(0).focus();
    await viewer.page.keyboard.press('Enter');
    await expect(current).toHaveAccessibleName('사진 1 / 3');
    await viewer.page.keyboard.press('Tab');
    await expect(bars.nth(1)).toBeFocused();
    await viewer.page.keyboard.press('Space');
    await expect(current).toHaveAccessibleName('사진 2 / 3');
    expect(await card.innerText()).toBe(text);
  });
});
