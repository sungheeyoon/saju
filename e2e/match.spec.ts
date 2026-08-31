import { expect, hideEveryoneExcept, optIn, test, type Person } from './session';

import { fillBirthDate } from './birth-form';

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

/** 둘 다 매칭에 참여시키고 서로만 보이게 한다 */
async function bothParticipate(a: Person, b: Person, tag: string): Promise<void> {
  await optIn(a.api, `가${tag}`);
  await optIn(b.api, `나${tag}`);
  hideEveryoneExcept([a.account.email, b.account.email]);
}

/** 요청 하나를 pending 으로 세운다 — 화면으로 재는 자리가 아닐 때 */
async function pendingRequest(from: Person, to: Person): Promise<void> {
  // 후보 목록을 한 번 받아야 요청의 근거(reason snapshot)가 선다(ADR 0009).
  const board = await from.api.rpc('discovery_board');
  if (board.error) throw new Error(`후보 목록을 못 받았습니다 — ${board.error.message}`);

  const partner = await to.api.from('discovery_profile').select('user_id').maybeSingle();
  const asked = await from.api.rpc('request_match', { p_candidate_user_id: partner.data?.user_id });
  if (asked.error) throw new Error(`요청을 못 보냈습니다 — ${asked.error.message}`);
}

test.describe('동의로 열리는 흐름', () => {
  test('참여를 켜고 요청을 보내 수락하면 두 사람이 같은 결과 화면에 선다', async ({ openAs }) => {
    const tag = String(Date.now()).slice(-4);
    const asker = await openAs({ selfPerson: true });
    const receiver = await openAs({ selfPerson: true });

    // ── 참여를 화면에서 켠다 ────────────────────────────────────────────────
    for (const [person, nickname] of [
      [asker, `보내는${tag}`],
      [receiver, `받는${tag}`],
    ] as const) {
      await person.page.goto('/me/discovery');
      // 낱말이 「매칭」에서 「인연 찾기」로 바뀌었는데 이 시험이 안 따라왔었다.
      await expect(person.page.getByRole('heading', { name: '인연 찾기 프로필' })).toBeVisible();

      await person.page.getByLabel('별명').fill(nickname);
      await person.page.getByRole('button', { name: '프로필 저장' }).click();
      await expect(person.page.getByText('저장했습니다.')).toBeVisible();

      /*
        **켜기 전에 무엇이 나가고 무엇이 안 나가는지 읽힌다**(US 26 · PRD).
        화면·ADR·PRD 가 같은 문장을 쓰기로 한 자리다.
      */
      await expect(person.page.getByText('상대에게 보이는 것')).toBeVisible();
      await expect(person.page.getByText('보이지 않는 것')).toBeVisible();

      await person.page.getByRole('button', { name: '인연 찾기 시작' }).click();
      await expect(person.page.getByRole('heading', { name: '인연 찾기 참여 중' })).toBeVisible();
    }

    hideEveryoneExcept([asker.account.email, receiver.account.email]);

    // ── 후보를 보고 요청을 보낸다 ───────────────────────────────────────────
    await asker.page.goto('/me/discovery');
    await expect(asker.page.getByRole('heading', { name: `받는${tag}` })).toBeVisible();

    /*
      **맛보기다.** 어느 오행을 채우는지는 말하고 원문은 닫는다(ADR 0003 · PRD).

      낱말이 아니라 **값**을 센다. 「생년월일」은 참여 화면이 「보이지 않는 것」을
      적으면서 이미 쓰고 있는 말이라, 낱말을 세면 약속을 적어 둔 문장이 그 약속을
      깨뜨린 것으로 잡힌다.
    */
    await expect(asker.page.getByText('1990-05-15')).toHaveCount(0);

    await asker.page.getByRole('button', { name: '상세 궁합 요청하기' }).click();
    // 보내기 전에 공개 범위를 읽는다 — 후보 카드만 본 것은 동의가 아니다(PRD).
    await expect(asker.page.getByText('여덟 글자', { exact: false }).first()).toBeVisible();
    await asker.page.getByRole('button', { name: '요청 보내기' }).click();

    // ── 받은 쪽이 읽고 수락한다 ─────────────────────────────────────────────
    await receiver.page.goto('/me/requests');
    /*
      **화면이 자기가 무엇을 하는 곳인지부터 말한다.** 제목 한 줄과 세 걸음이 함께
      서지 않으면 「동의」라는 낱말만 남고, 받은 쪽은 자기가 무엇을 정하는 중인지
      모른 채 버튼을 고른다(`CONSENT_FLOW_STEPS`).
    */
    await expect(receiver.page.getByRole('heading', { name: '궁합 요청과 새 소식' })).toBeVisible();
    await receiver.page.getByText('궁합 요청은 어떻게 진행되나요?').click();
    await expect(receiver.page.getByRole('listitem').filter({ hasText: '요청을 보냅니다' })).toBeVisible();
    await expect(receiver.page.getByText('보내는 것만으로 상대에게 열리는 것은 없고')).toBeVisible();
    await expect(receiver.page.getByRole('heading', { name: `보내는${tag}` })).toBeVisible();

    // 수락 전에도 상대의 정확한 출생정보는 없다(US 39).
    await expect(receiver.page.getByText('1990-05-15')).toHaveCount(0);

    await receiver.page.getByRole('button', { name: '수락하고 궁합 열기' }).click();
    await expect(receiver.page.getByRole('heading', { name: '함께 보는 궁합' })).toBeVisible();

    // ── 양쪽이 같은 결과 화면에 선다 ────────────────────────────────────────
    for (const person of [asker, receiver]) {
      await person.page.goto('/me/requests');
      await person.page.getByRole('link', { name: '함께 보기' }).click();

      await expect(person.page.getByRole('heading', { name: '함께 보는 궁합' })).toBeVisible();
      await expect(person.page.getByText('두 원국 사이의 관계')).toBeVisible();

      /*
        **동의 뒤에도 열리지 않는 것**(ADR 0012). 여덟 글자는 관계를 합쳐 드러날 수
        있지만 정확한 출생 원문과 출생지는 그때도 열리지 않는다.
      */
      await expect(person.page.getByText('1990-05-15')).toHaveCount(0);
      await expect(person.page.getByText('서울')).toHaveCount(0);

      // 현재 Reading 은 아직 없다 — 화면을 여는 것으로 만들어지지 않는다(US 25).
      await expect(person.page.getByRole('heading', { name: '두 사람의 사주풀이' })).toBeVisible();
      await expect(person.page.getByText('아직 만들어 둔 사주풀이가 없습니다')).toBeVisible();
      await expect(person.page.getByRole('button', { name: '사주풀이 받기' })).toBeVisible();
    }
  });

  test('한쪽이 출생정보를 고치면 pending 요청이 무효가 되고 그 사실이 알림함에 선다', async ({
    openAs,
  }) => {
    const tag = String(Date.now()).slice(-4);
    const asker = await openAs({ selfPerson: true });
    const receiver = await openAs({ selfPerson: true });

    await bothParticipate(asker, receiver, tag);
    await pendingRequest(asker, receiver);

    await receiver.page.goto('/me/requests');
    await expect(receiver.page.getByRole('button', { name: '수락하고 궁합 열기' })).toBeVisible();

    // 보낸 쪽이 Evidence 를 바꾼다 — 이름이 아니라 여덟 글자를 바꾸는 수정이다.
    await asker.page.goto('/me');
    await asker.page.getByRole('button', { name: '출생 정보 수정' }).click();
    await fillBirthDate(asker.page, '1988-02-11');
    await asker.page.getByRole('button', { name: '변경 사항 저장' }).click();
    await expect(asker.page.getByText('1988-02-11')).toBeVisible();

    /*
      **동의한 대상과 실제 계산 대상이 달라지지 않는다**(US 42 · 43). 받은 쪽에서 답할
      요청이 사라지고, **왜** 사라졌는지가 알림함에 남는다 — `invalidated` 와
      `cancelled` 를 갈라서 말하기로 한 것이 여기서 실제로 읽힌다.
    */
    await receiver.page.reload();
    await expect(receiver.page.getByRole('button', { name: '수락하고 궁합 열기' })).toHaveCount(0);
    await expect(receiver.page.getByText('답할 요청이 없습니다')).toBeVisible();
    await expect(
      receiver.page.getByText(`가${tag} 님과의 요청이 출생정보 수정으로 무효가 되었습니다`),
    ).toBeVisible();
  });

  test('신고는 차단과 따로 남고, 상대는 목록에서 사라지지 않는다', async ({ openAs }) => {
    const tag = String(Date.now()).slice(-4);
    const asker = await openAs({ selfPerson: true });
    const receiver = await openAs({ selfPerson: true });

    await bothParticipate(asker, receiver, tag);
    await pendingRequest(asker, receiver);

    await receiver.page.goto('/me/requests');
    await receiver.page.getByRole('button', { name: '신고', exact: true }).click();

    /*
      **차단과 무엇이 다른지 먼저 읽힌다.** 나란한 두 버튼이 같은 무게로 읽히면
      운영자가 봐야 할 일이 조용한 차단으로 끝나거나 그 반대가 된다.
    */
    await expect(receiver.page.getByText('신고는 운영자에게 기록을 남기는 것입니다', { exact: false })).toBeVisible();

    await receiver.page.getByLabel('신고 사유').selectOption({ label: '괴롭힘이나 위협' });
    await receiver.page.getByLabel('덧붙일 말 (선택)').fill('겪은 일을 적습니다.');
    await receiver.page.getByRole('button', { name: '신고합니다' }).click();

    await expect(receiver.page.getByText('신고를 접수했습니다')).toBeVisible();

    /*
      **신고가 차단이 아니다.** 답할 요청은 그대로 서 있고, 상대도 후보 목록에서
      사라지지 않는다 — 보이지 않게 하려면 차단을 따로 눌러야 한다.
    */
    await expect(receiver.page.getByRole('button', { name: '수락하고 궁합 열기' })).toBeVisible();
    await expect(receiver.page.getByText('차단한 사람', { exact: false })).toHaveCount(0);
  });

  test('삭제를 요청하면 그 자리에서 모든 화면이 닫히고 이유를 갈라서 말한다', async ({
    openAs,
  }) => {
    const tag = String(Date.now()).slice(-4);
    const leaver = await openAs({ selfPerson: true });
    const other = await openAs({ selfPerson: true });

    await bothParticipate(leaver, other, tag);
    await pendingRequest(other, leaver);

    await leaver.page.goto('/me/settings');
    await leaver.page.getByRole('button', { name: '계정 삭제 요청' }).click();

    // **무엇이 지워지지 않는지**를 누르기 전에 말한다.
    await expect(
      leaver.page.getByText('저장된 자료는 그 자리에서 지워지지 않습니다', { exact: false }),
    ).toBeVisible();

    await leaver.page.getByRole('button', { name: '삭제를 요청합니다' }).click();

    /*
      **이유를 갈라서 말한다.** 자기가 요청해서 그렇게 된 사람에게 「중지되었습니다」는
      거짓이다 — 상태 하나에 문장 하나가 매여 있다(`src/lib/account`).
    */
    await expect(leaver.page.getByText('삭제를 요청한 계정입니다.')).toBeVisible();
    await expect(leaver.page.getByText('중지된 계정입니다.')).toHaveCount(0);

    // 새 관문을 두지 않았으므로 다른 화면도 같은 값을 보고 같은 말을 한다.
    for (const path of ['/me/people', '/me/discovery', '/me/requests']) {
      await leaver.page.goto(path);
      await expect(leaver.page.getByText('삭제를 요청한 계정입니다.')).toBeVisible();
    }

    // 답을 기다리던 요청은 정리된다 — 상대가 답할 수 없는 요청을 계속 보지 않는다.
    await other.page.goto('/me/requests');
    await expect(other.page.getByText('기다리는 중인 요청이 없습니다')).toBeVisible();
  });

  test('차단하면 그 사람은 후보에서도 사라지고 새 요청도 서지 않는다', async ({ openAs }) => {
    const tag = String(Date.now()).slice(-4);
    const asker = await openAs({ selfPerson: true });
    const receiver = await openAs({ selfPerson: true });

    await bothParticipate(asker, receiver, tag);
    await pendingRequest(asker, receiver);

    await receiver.page.goto('/me/requests');
    await expect(receiver.page.getByRole('heading', { name: `가${tag}` })).toBeVisible();

    // 차단은 한 번 더 묻는다 — 되돌리지 않기 때문이다(용어집).
    await receiver.page.getByRole('button', { name: '차단', exact: true }).click();
    await receiver.page.getByRole('button', { name: '차단합니다' }).click();

    /*
      **누구를 차단했는지는 적지 않는다.** 차단한 뒤에는 그 사람의 프로필을 읽을 이유가
      없어서 별명을 붙들고 있지 않다.
    */
    await expect(receiver.page.getByText('차단한 사람 1명', { exact: false })).toBeVisible();
    await expect(receiver.page.getByRole('heading', { name: `가${tag}` })).toHaveCount(0);

    // 막는 것은 한쪽이 아니다 — 보낸 쪽의 후보 목록에서도 사라진다(제재는 양방향).
    await asker.page.goto('/me/discovery');
    await expect(asker.page.getByRole('heading', { name: `나${tag}` })).toHaveCount(0);

    // 새 요청도 서지 않는다.
    const board = await asker.api.rpc('discovery_board');
    expect(board.error).toBeNull();
    const partner = await receiver.api.from('discovery_profile').select('user_id').maybeSingle();
    const again = await asker.api.rpc('request_match', {
      p_candidate_user_id: partner.data?.user_id,
    });
    expect(again.error).not.toBeNull();
  });
});
