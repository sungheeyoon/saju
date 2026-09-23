import { expect, forgetBoards, onlyTheseParticipate, optIn, sql, test, type Person } from './session';

import {
  CHAT_EMPTY_TITLE,
  CHAT_POLICY,
  RATE_LIMITED_TEXT,
  closedRoomText,
} from '@/src/lib/chat';

/**
 * 채팅 안전 베타의 완료 조건 여섯을 브라우저에서 밟는다(PRD §7.0) — 주고받음 · 차단 · 이용 정지 ·
 * 탈퇴 신청 · 신고 스냅샷 · 한도. DB 층은 pgTAP 34 가 같은 여섯을 재고, 여기는 **화면이 그 값을
 * 사람에게 어떻게 말하는가**를 잰다. 두 계정은 `match.spec.ts` 와 같은 픽스처로 세운다.
 */

const freshTag = (): string =>
  (Date.now().toString(36) + Math.random().toString(36).slice(2)).slice(-5);

async function bothParticipate(a: Person, b: Person, tag: string): Promise<void> {
  await optIn(a.api, `가${tag}`);
  await optIn(b.api, `나${tag}`);
  onlyTheseParticipate([a.account.email, b.account.email]);
  forgetBoards([a.account.email, b.account.email]);
}

/** 요청 → 수락 → Match. 동의가 나면 방이 트리거로 선다(ADR 0091) — 화면이 세우는 것이 아니다 */
async function matched(from: Person, to: Person): Promise<string> {
  const board = await from.api.rpc('my_discovery_board');
  if (board.error) throw new Error(`후보 목록을 못 받았습니다 — ${board.error.message}`);

  const partner = await to.api.from('discovery_profile').select('user_id').maybeSingle();
  const asked = await from.api.rpc('request_match', { p_candidate_user_id: partner.data?.user_id });
  if (asked.error) throw new Error(`요청을 못 보냈습니다 — ${asked.error.message}`);

  const answered = await to.api.rpc('respond_to_match_request', {
    p_request_id: asked.data,
    p_accept: true,
  });
  if (answered.error || answered.data !== 'accepted') {
    throw new Error(`수락이 안 됐습니다 — ${answered.error?.message ?? String(answered.data)}`);
  }

  const matches = await from.api.rpc('my_matches');
  const matchId: unknown = matches.data?.[0]?.match_id;
  if (typeof matchId !== 'string') throw new Error('Match 가 서지 않았습니다');
  return matchId;
}

const userIdOf = (email: string): string =>
  sql(`select id from auth.users where email = '${email}'`);

async function pair(openAs: (seed: { selfPerson: true }) => Promise<Person>) {
  const tag = freshTag();
  const a = await openAs({ selfPerson: true });
  const b = await openAs({ selfPerson: true });
  await bothParticipate(a, b, tag);
  const matchId = await matched(a, b);
  return { a, b, tag, matchId, room: `/me/chat/${matchId}` };
}

test.describe('매칭된 한 쌍의 채팅', () => {
  test('방이 없으면 빈 목록이 말하고, 동의가 나면 방이 서서 메시지를 주고받는다', async ({ openAs }) => {
    const alone = await openAs({ selfPerson: true });
    await alone.page.goto('/me/chat');
    await expect(alone.page.getByRole('heading', { name: '채팅', exact: true })).toBeVisible();
    await expect(alone.page.getByText(CHAT_EMPTY_TITLE)).toBeVisible();

    const { a, b, tag, room } = await pair(openAs);

    // 목록에 상대가 서고, 눌러 들어가면 제목이 「{닉네임} 님」이다
    await a.page.goto('/me/chat');
    await expect(a.page.getByText(CHAT_EMPTY_TITLE)).toHaveCount(0);
    await a.page.getByRole('link', { name: new RegExp(`나${tag}`) }).click();
    await expect(a.page).toHaveURL(new RegExp(`${room}$`));
    await expect(a.page.getByRole('heading', { name: `나${tag} 님` })).toBeVisible();

    const hello = `안녕하세요 ${tag}`;
    await a.page.getByPlaceholder('메시지를 입력해 주세요').fill(hello);
    await a.page.getByRole('button', { name: '보내기' }).click();
    await expect(a.page.getByText(hello)).toBeVisible();
    // 보낸 뒤 입력 칸은 비고, 내 메시지에는 신고 버튼이 없다
    await expect(a.page.getByPlaceholder('메시지를 입력해 주세요')).toHaveValue('');
    await expect(a.page.getByRole('button', { name: '신고' })).toHaveCount(0);

    // 상대의 목록에 안 읽은 수가 서고, 들어가면 읽은 것이 된다
    await b.page.goto('/me/chat');
    await expect(b.page.getByText(hello)).toBeVisible();
    await expect(b.page.getByText('1건 안 읽음')).toBeVisible();
    await b.page.getByRole('link', { name: new RegExp(`가${tag}`) }).click();
    await expect(b.page.getByText(hello)).toBeVisible();
    // 방 안에서 읽음이 끝나면 **주소를 안 옮겨도** 헤더의 배지가 내려간다
    await expect(b.page.getByText('1건 안 읽음')).toHaveCount(0);

    const reply = `반갑습니다 ${tag}`;
    await b.page.getByPlaceholder('메시지를 입력해 주세요').fill(reply);
    await b.page.getByRole('button', { name: '보내기' }).click();
    await expect(b.page.getByText(reply)).toBeVisible();

    await b.page.goto('/me/chat');
    await expect(b.page.getByText('1건 안 읽음')).toHaveCount(0);

    // 보낸 쪽이 다시 열면 답이 보인다 — 실시간이 아니라 다시 읽는 것이다
    await a.page.goto(room);
    await expect(a.page.getByText(reply)).toBeVisible();
  });

  test('전송 한도에 걸린 한 건이 거절된다 — 30건은 되고 31번째가 막힌다', async ({ openAs }) => {
    const { a, room, matchId } = await pair(openAs);

    for (let i = 0; i < CHAT_POLICY.rateLimit; i += 1) {
      const sent = await a.api.rpc('send_chat_message', { p_match_id: matchId, p_body: `${i + 1}` });
      if (sent.error || sent.data !== 'sent') {
        throw new Error(`${i + 1}번째가 막혔습니다 — ${sent.error?.message ?? String(sent.data)}`);
      }
    }

    await a.page.goto(room);
    await a.page.getByPlaceholder('메시지를 입력해 주세요').fill('31');
    await a.page.getByRole('button', { name: '보내기' }).click();
    // `getByRole('alert')` 는 Next 의 라우트 안내와 겹친다 — 글자로 잡는다
    await expect(a.page.getByText(RATE_LIMITED_TEXT)).toBeVisible();
    // 거절된 본문은 그대로 남는다 — 잠시 뒤 다시 보낼 수 있게
    await expect(a.page.getByPlaceholder('메시지를 입력해 주세요')).toHaveValue('31');
  });

  test('차단이 방을 닫고, 닫힌 뒤 두 쪽 다 이전 대화를 본다', async ({ openAs }) => {
    const { a, b, tag, room, matchId } = await pair(openAs);
    const said = `차단 전 ${tag}`;
    await a.api.rpc('send_chat_message', { p_match_id: matchId, p_body: said });

    await a.page.goto(room);
    await a.page.getByRole('button', { name: '차단', exact: true }).click();
    await a.page.getByRole('button', { name: '차단합니다' }).click();

    for (const person of [a, b]) {
      await person.page.goto(room);
      await expect(person.page.getByText(said)).toBeVisible();
      await expect(person.page.getByRole('status')).toHaveText(closedRoomText('block'));
      await expect(person.page.getByPlaceholder('메시지를 입력해 주세요')).toHaveCount(0);
    }

    // 목록에도 닫힌 채 남는다 — 사라지는 것이 아니다
    await b.page.goto('/me/chat');
    await expect(b.page.getByText(closedRoomText('block'))).toBeVisible();
  });

  test('이용 정지와 탈퇴 신청은 방을 닫고, 그 사람이 아닌 쪽만 본다', async ({ openAs }) => {
    const suspended = await pair(openAs);
    await suspended.a.api.rpc('send_chat_message', {
      p_match_id: suspended.matchId,
      p_body: `정지 전 ${suspended.tag}`,
    });
    sql(`update public.app_user set status = 'suspended'
         where id = '${userIdOf(suspended.b.account.email)}'`);

    await suspended.a.page.goto(suspended.room);
    await expect(suspended.a.page.getByText(`정지 전 ${suspended.tag}`)).toBeVisible();
    await expect(suspended.a.page.getByRole('status')).toHaveText(closedRoomText('suspension'));

    // 정지된 쪽은 자기 상태 말고는 아무것도 못 본다(§5.3)
    await suspended.b.page.goto(suspended.room);
    await expect(suspended.b.page.getByText('이용이 정지된 계정입니다')).toBeVisible();
    await expect(suspended.b.page.getByText(`정지 전 ${suspended.tag}`)).toHaveCount(0);

    const leaving = await pair(openAs);
    await leaving.a.api.rpc('send_chat_message', {
      p_match_id: leaving.matchId,
      p_body: `탈퇴 전 ${leaving.tag}`,
    });
    const asked = await leaving.b.api.rpc('request_account_deletion');
    if (asked.error) throw new Error(`탈퇴를 못 신청했습니다 — ${asked.error.message}`);

    await leaving.a.page.goto(leaving.room);
    await expect(leaving.a.page.getByText(`탈퇴 전 ${leaving.tag}`)).toBeVisible();
    await expect(leaving.a.page.getByRole('status')).toHaveText(closedRoomText('deletion_request'));

    await leaving.b.page.goto('/me/chat');
    await expect(leaving.b.page.getByText('탈퇴를 신청한 계정입니다')).toBeVisible();
    await expect(leaving.b.page.getByText(`탈퇴 전 ${leaving.tag}`)).toHaveCount(0);
  });

  test('신고 한 건이 고른 메시지와 앞뒤 문맥의 스냅샷과 함께 남는다', async ({ openAs }) => {
    const { a, b, tag, room, matchId } = await pair(openAs);
    for (const body of ['하나', '둘', `셋 ${tag}`, '넷']) {
      await a.api.rpc('send_chat_message', { p_match_id: matchId, p_body: body });
    }

    await b.page.goto(room);
    const chosen = b.page.getByRole('listitem').filter({ hasText: `셋 ${tag}` });
    await chosen.getByRole('button', { name: '신고' }).click();
    await chosen.getByRole('button', { name: '신고합니다' }).click();
    await expect(chosen.getByText('신고를 접수했습니다')).toBeVisible();

    // 방은 그대로 열려 있다 — 신고는 방을 닫지 않는다
    await expect(b.page.getByPlaceholder('메시지를 입력해 주세요')).toBeVisible();

    const snapshot = sql(`select s.messages
      from public.chat_report_snapshot s
      join public.chat_message m on m.id = s.message_id
      where s.match_id = '${matchId}' and m.body = '셋 ${tag}'`);
    const messages = JSON.parse(snapshot) as { body: string; chosen: boolean }[];
    expect(messages.map((m) => m.body)).toEqual(['하나', '둘', `셋 ${tag}`, '넷']);
    expect(messages.filter((m) => m.chosen).map((m) => m.body)).toEqual([`셋 ${tag}`]);
  });
});
