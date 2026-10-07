import { createClient } from '@supabase/supabase-js';
import type { Page } from '@playwright/test';

import { expect, forgetBoards, onlyTheseParticipate, optIn, sql, test, type Person } from './session';

import { CHAT_EMPTY_TITLE, NEW_MESSAGES_LABEL, OLDER_MESSAGES_LABEL, closedRoomText } from '@/src/lib/chat';
import { readingCreditsLabel } from '@/src/lib/reading/notes';

/**
 * **앱이 스스로 갱신된다** — 두 계정 · 두 브라우저(서로 다른 저장소의 독립된 세션)로 잰다(ADR 0155 「수용 기준」).
 *
 * 받는 쪽 화면은 **다시 열지 않는다** — 받는 쪽에서 `reload` · `goto` · 주소 이동이 없이 기다린다. 「다시 열면 보인다」는
 * 여기서 재는 것이 아니다. 화면을 처음 여는 `goto` 는 기다리기 **전**에만 있다.
 *
 * 채널은 화면 폭과 관계없으므로 넓은 화면에서만 돈다 — 넓은 화면은 방 곁에 목록이 함께 서서 그 갱신까지 한 번에 잰다.
 */

test.skip(({ isMobile }) => isMobile, '채널은 화면 폭과 관계없다 — 넓은 화면 한 벌로 잰다');

/** 수용 기준의 상한 — 서버 커밋 뒤 이 안에 선다 */
const WITHIN_MS = 2_000;

const freshTag = (): string => (Date.now().toString(36) + Math.random().toString(36).slice(2)).slice(-5);

const userIdOf = (email: string): string => sql(`select id from auth.users where email = '${email}'`);

async function bothParticipate(people: readonly Person[], tag: string): Promise<void> {
  for (const [index, person] of people.entries()) await optIn(person.api, `${'가나다라마바'[index]}${tag}`);
  onlyTheseParticipate(people.map((person) => person.account.email));
  forgetBoards(people.map((person) => person.account.email));
}

async function ask(from: Person, to: Person): Promise<string> {
  const board = await from.api.rpc('my_discovery_board');
  if (board.error) throw new Error(`후보 목록을 못 받았습니다 — ${board.error.message}`);
  const asked = await from.api.rpc('request_match', { p_candidate_user_id: userIdOf(to.account.email) });
  if (asked.error) throw new Error(`요청을 못 보냈습니다 — ${asked.error.message}`);
  return asked.data as string;
}

async function accept(to: Person, requestId: string): Promise<void> {
  const answered = await to.api.rpc('respond_to_match_request', { p_request_id: requestId, p_accept: true });
  if (answered.error || answered.data !== 'accepted') {
    throw new Error(`수락이 안 됐습니다 — ${answered.error?.message ?? String(answered.data)}`);
  }
}

async function matchIdOf(person: Person): Promise<string> {
  const matches = await person.api.rpc('my_matches');
  const matchId: unknown = matches.data?.[0]?.match_id;
  if (typeof matchId !== 'string') throw new Error('Match 가 서지 않았습니다');
  return matchId;
}

async function pair(openAs: (seed: { selfPerson: true }) => Promise<Person>) {
  const tag = freshTag();
  const a = await openAs({ selfPerson: true });
  const b = await openAs({ selfPerson: true });
  await bothParticipate([a, b], tag);
  await accept(b, await ask(a, b));
  const matchId = await matchIdOf(a);
  return { a, b, tag, matchId, room: `/me/chat/${matchId}` };
}

/** 서버에 메시지를 쓴다 — 돌아오면 커밋된 것이다. 그 시각(벽시계 ms)을 낸다 */
async function sendAs(person: Person, matchId: string, body: string): Promise<number> {
  const sent = await person.api.rpc('send_chat_message', { p_match_id: matchId, p_body: body });
  const committedAt = Date.now();
  if (sent.error || sent.data !== 'sent') throw new Error(`못 보냈습니다 — ${sent.error?.message ?? String(sent.data)}`);
  return committedAt;
}

const talkOf = (page: Page) => page.getByRole('log', { name: '메시지' });
const memberNav = (page: Page) => page.getByRole('navigation', { name: '내 메뉴' });
const chatTab = (page: Page) => memberNav(page).getByRole('link', { name: /채팅/ });
const matchingTab = (page: Page) => memberNav(page).getByRole('link', { name: /인연/ });

/**
 * 받는 쪽 화면에 **글자가 선 순간**을 그 화면이 스스로 적게 한다 — 시험이 기다리는 간격이 지연에 섞이지 않는다.
 * 벽시계(`Date.now`)로 적어 서버 커밋 시각(시험 프로세스의 `Date.now`)과 같은 시계로 견준다.
 */
async function stampWhenShown(page: Page, texts: readonly string[]): Promise<void> {
  await page.evaluate((wanted) => {
    const seen = ((window as unknown as { __shownAt?: Record<string, number> }).__shownAt ??= {});
    const check = () => {
      const log = document.querySelector('[role="log"]');
      for (const text of wanted) {
        if (seen[text] === undefined && log?.textContent?.includes(text)) seen[text] = Date.now();
      }
    };
    new MutationObserver(check).observe(document.body, { subtree: true, childList: true, characterData: true });
    check();
  }, texts);
}

async function shownAt(page: Page, text: string): Promise<number> {
  const handle = await page.waitForFunction(
    (wanted) => (window as unknown as { __shownAt?: Record<string, number> }).__shownAt?.[wanted],
    text,
    { timeout: 10_000 },
  );
  return (await handle.jsonValue()) as number;
}

/** Realtime 소켓이 오간 글을 모은다 — 걷힌 채널은 더 받지 않고, 다른 계정의 주제는 오지 않는다 */
function socketLog(page: Page): { readonly frames: { dir: 'in' | 'out'; text: string }[] } {
  const frames: { dir: 'in' | 'out'; text: string }[] = [];
  const textOf = (payload: string | Buffer) => (typeof payload === 'string' ? payload : payload.toString('utf8'));
  page.on('websocket', (socket) => {
    if (!socket.url().includes('/realtime/')) return;
    socket.on('framereceived', (frame) => frames.push({ dir: 'in', text: textOf(frame.payload) }));
    socket.on('framesent', (frame) => frames.push({ dir: 'out', text: textOf(frame.payload) }));
  });
  return { frames };
}

/** 그 화면의 채널이 섰다 — 방 · 딱지를 재기 전에 기다린다(서기 전의 변경은 「다시 대조」가 메우지만 지연을 섞는다) */
async function channelUp(log: ReturnType<typeof socketLog>, userId: string): Promise<void> {
  await expect
    .poll(() => log.frames.some((frame) => frame.dir === 'in' && frame.text.includes(`user:${userId}`) && frame.text.includes('"ok"')), {
      timeout: 10_000,
    })
    .toBe(true);
}

/** 그 사람의 마지막 활동 — 로컬 DB 에서 잰다. 줄이 없으면 `none` */
const activityOf = (userId: string): string =>
  sql(`select coalesce((select last_active_at::text from public.user_activity where user_id = '${userId}'), 'none')`);

/**
 * 활동을 10분 앞으로 민다 — 1분 억제(`presence_write_window`) 밖이라 무엇이든 적히면 값이 움직인다. 민 값을 낸다.
 */
const pushActivityBack = (userId: string): string => {
  sql(`update public.user_activity set last_active_at = now() - interval '10 minutes' where user_id = '${userId}'`);
  return activityOf(userId);
};

const readOf = (matchId: string, userId: string): number =>
  Number(
    sql(`select coalesce(max(r.last_read_seq), 0) from public.chat_read r join public.chat_room c on c.id = r.room_id
         where c.match_id = '${matchId}' and r.user_id = '${userId}'`),
  );

const newestOf = (matchId: string): number =>
  Number(sql(`select max(m.seq) from public.chat_message m join public.chat_room c on c.id = m.room_id where c.match_id = '${matchId}'`));

const percentile =(values: readonly number[], p: number): number => {
  const sorted = [...values].sort((x, y) => x - y);
  return sorted[Math.min(sorted.length - 1, Math.floor((sorted.length - 1) * p))];
};

test.describe('앱이 스스로 갱신된다', () => {
  test('(1) 방을 열어 둔 상대에게 메시지가 2초 안에 선다 — 쓰던 글 · 초점은 그대로다', async ({ openAs }) => {
    const { a, b, tag, matchId, room } = await pair(openAs);
    const bLog = socketLog(b.page);
    await a.page.goto(room);
    await b.page.goto(room);
    await channelUp(bLog, userIdOf(b.account.email));

    // B 는 쓰던 글이 있다 — 받는 동안 입력 칸이 다시 그려지면 이 글과 초점이 사라진다
    const field = b.page.getByPlaceholder('메시지를 입력해 주세요');
    await field.fill(`쓰던 글 ${tag}`);
    await field.focus();

    // 첫 건은 화면에서 보낸다 — 보낸 쪽도 다시 열지 않고 제 말을 본다
    const byHand = `손으로 ${tag}`;
    await stampWhenShown(b.page, [byHand]);
    await a.page.getByPlaceholder('메시지를 입력해 주세요').fill(byHand);
    await a.page.getByRole('button', { name: '보내기' }).click();
    await expect(talkOf(a.page).getByText(byHand)).toBeVisible();
    await expect(talkOf(b.page).getByText(byHand)).toBeVisible({ timeout: WITHIN_MS });

    // 지연은 문으로 보낸 것으로 잰다 — 커밋이 돌아온 시각에서 받는 화면에 글자가 선 시각까지
    const delays: number[] = [];
    for (let round = 0; round < 8; round += 1) {
      const body = `지연 ${round} ${tag}`;
      await stampWhenShown(b.page, [body]);
      const committedAt = await sendAs(a, matchId, body);
      delays.push((await shownAt(b.page, body)) - committedAt);
    }
    const summary = `n=${delays.length} p50=${percentile(delays, 0.5)}ms max=${Math.max(...delays)}ms [${delays.join(', ')}]`;
    test.info().annotations.push({ type: '실측 지연(커밋 → 상대 화면)', description: summary });
    console.log(`실시간 지연 — ${summary}`);
    expect(Math.max(...delays)).toBeLessThan(WITHIN_MS);

    await expect(field).toHaveValue(`쓰던 글 ${tag}`);
    await expect(field).toBeFocused();
    // 같은 메시지가 두 번 서지 않는다
    await expect(talkOf(b.page).getByText(byHand)).toHaveCount(1);
  });

  test('(2) 다른 화면에서는 채팅 딱지가 오르고, 목록 화면에서는 마지막 메시지와 안 읽은 수가 바뀐다', async ({ openAs }) => {
    const { a, b, tag, matchId } = await pair(openAs);
    const bLog = socketLog(b.page);
    await b.page.goto('/me');
    await channelUp(bLog, userIdOf(b.account.email));
    await expect(chatTab(b.page).getByText('건 안 읽음')).toHaveCount(0);

    await sendAs(a, matchId, `첫 말 ${tag}`);
    await expect(chatTab(b.page).getByText('1건 안 읽음')).toBeVisible({ timeout: WITHIN_MS });

    // 목록 화면 — 여기서부터 B 는 다시 열지 않는다
    await b.page.goto('/me/chat');
    await channelUp(bLog, userIdOf(b.account.email));
    const row = b.page.getByRole('link', { name: new RegExp(`가${tag}`) });
    await expect(row.getByText(`첫 말 ${tag}`)).toBeVisible();
    await expect(row.getByText('1건 안 읽음')).toBeVisible();

    await sendAs(a, matchId, `둘째 말 ${tag}`);
    await expect(row.getByText(`둘째 말 ${tag}`)).toBeVisible({ timeout: WITHIN_MS + 1_000 });
    await expect(row.getByText('2건 안 읽음')).toBeVisible();
    await expect(chatTab(b.page).getByText('2건 안 읽음')).toBeVisible();
  });

  test('(2) 서버가 목록을 그린 뒤 채널이 서기 전에 온 메시지도, 채널이 처음 서면 손대지 않아도 목록에 선다', async ({ openAs }) => {
    const { a, b, tag, matchId } = await pair(openAs);
    // 채널의 첫 소켓을 붙잡아 둔다 — 화면은 서버가 그렸고 채널은 아직 안 섰다
    let release = () => {};
    const held = new Promise<void>((resolve) => {
      release = resolve;
    });
    await b.page.routeWebSocket(/\/realtime\//, async (socket) => {
      await held;
      socket.connectToServer();
    });
    await b.page.goto('/me/chat');
    const row = b.page.getByRole('link', { name: new RegExp(`가${tag}`) });
    await expect(row).toBeVisible();
    await expect(row.getByText('건 안 읽음')).toHaveCount(0);

    await sendAs(a, matchId, `서기 전의 말 ${tag}`);
    release();
    // 30초 대체 조회보다 짧게 — 첫 다시 대조가 그린 것이다
    await expect(row.getByText(`서기 전의 말 ${tag}`)).toBeVisible({ timeout: 15_000 });
    await expect(row.getByText('1건 안 읽음')).toBeVisible();
  });

  test('(2) 수락으로 새 방이 서면 보낸 쪽의 빈 대화방 목록에 그 방이 선다', async ({ openAs }) => {
    const tag = freshTag();
    const a = await openAs({ selfPerson: true });
    const b = await openAs({ selfPerson: true });
    await bothParticipate([a, b], tag);
    const requestId = await ask(a, b);

    const aLog = socketLog(a.page);
    await a.page.goto('/me/chat');
    await channelUp(aLog, userIdOf(a.account.email));
    await expect(a.page.getByText(CHAT_EMPTY_TITLE)).toBeVisible();

    await accept(b, requestId);
    await expect(a.page.getByRole('link', { name: new RegExp(`나${tag}`) })).toBeVisible({ timeout: WITHIN_MS + 1_000 });
    await expect(a.page.getByText(CHAT_EMPTY_TITLE)).toHaveCount(0);
  });

  test('(3) 같은 계정의 다른 탭에서 읽으면 첫 탭의 딱지와 목록의 수가 내려간다', async ({ openAs }) => {
    const { a, b, tag, matchId, room } = await pair(openAs);
    const bLog = socketLog(b.page);
    await b.page.goto('/me/chat');
    await channelUp(bLog, userIdOf(b.account.email));

    await sendAs(a, matchId, `읽을 말 ${tag}`);
    const row = b.page.getByRole('link', { name: new RegExp(`가${tag}`) });
    await expect(row.getByText('1건 안 읽음')).toBeVisible({ timeout: WITHIN_MS + 1_000 });
    await expect(chatTab(b.page).getByText('1건 안 읽음')).toBeVisible();

    // 같은 브라우저(같은 저장소)의 둘째 탭 — 방을 열어 읽는다
    const second = await b.page.context().newPage();
    await second.goto(room);
    await expect(talkOf(second).getByText(`읽을 말 ${tag}`)).toBeVisible();

    // 첫 탭은 아무것도 안 했다
    await expect(chatTab(b.page).getByText('건 안 읽음')).toHaveCount(0, { timeout: WITHIN_MS + 1_000 });
    await expect(row.getByText('건 안 읽음')).toHaveCount(0);
    await second.close();
  });

  test('(3) 풀이권이 움직이면 다른 탭의 잔액 글자가 따라 바뀐다', async ({ openAs }) => {
    const tag = freshTag();
    const a = await openAs({ selfPerson: true });

    const aLog = socketLog(a.page);
    await a.page.goto('/me/settings');
    await channelUp(aLog, userIdOf(a.account.email));
    const before = await a.api.rpc('my_reading_credits');
    const row = before.data?.[0];
    if (!row) throw new Error('풀이권을 못 읽었습니다');
    await expect(a.page.getByText(readingCreditsLabel({ limit: row.credit_limit, available: row.available }))).toBeVisible();

    // 풀이 하나를 열면 풀이권 한 자리를 잡는다 — 다른 탭(여기서는 문)에서 연다. 모델은 안 부른다(열쇠가 없다)
    const started = await a.api.rpc('start_reading_run', {
      p_kind: 'self',
      p_idempotency_key: `e2e-live-${tag}`,
      p_person_a: null,
      p_model: 'gpt-e2e',
      p_prompt_version: 'reading-prompt-v1',
    });
    if (started.error) throw new Error(`풀이를 못 열었습니다 — ${started.error.message}`);
    await expect(
      a.page.getByText(readingCreditsLabel({ limit: row.credit_limit, available: row.available - 1 })),
    ).toBeVisible({ timeout: WITHIN_MS + 1_000 });
  });

  test('(4) 받은 요청이 인연 탭 딱지와 띠에 서고, 거두면 둘 다 내려간다', async ({ openAs }) => {
    const tag = freshTag();
    const a = await openAs({ selfPerson: true });
    const b = await openAs({ selfPerson: true });
    await bothParticipate([a, b], tag);

    const bLog = socketLog(b.page);
    await b.page.goto('/me/matching');
    await channelUp(bLog, userIdOf(b.account.email));
    await expect(b.page.getByText(/받은 요청 \d/)).toHaveCount(0);

    const requestId = await ask(a, b);
    await expect(matchingTab(b.page).getByText('1건 답할 요청')).toBeVisible({ timeout: WITHIN_MS + 1_000 });
    await expect(b.page.getByText('받은 요청 1')).toBeVisible();

    const cancelled = await a.api.rpc('cancel_match_request', { p_request_id: requestId });
    if (cancelled.error) throw new Error(`요청을 못 거뒀습니다 — ${cancelled.error.message}`);
    await expect(matchingTab(b.page).getByText('건 답할 요청')).toHaveCount(0, { timeout: WITHIN_MS + 1_000 });
    await expect(b.page.getByText(/받은 요청 \d/)).toHaveCount(0);
  });

  test('(4) 차단으로 방이 닫히면 상대 화면의 입력 자리가 닫힌 까닭으로 바뀌고 보낼 수 없다', async ({ openAs }) => {
    const { a, b, tag, matchId, room } = await pair(openAs);
    const aLog = socketLog(a.page);
    await a.page.goto(room);
    await channelUp(aLog, userIdOf(a.account.email));
    await a.page.getByPlaceholder('메시지를 입력해 주세요').fill(`쓰다 만 글 ${tag}`);

    const blocked = await b.api.rpc('block_user', { p_user_id: userIdOf(a.account.email) });
    if (blocked.error) throw new Error(`차단이 안 됐습니다 — ${blocked.error.message}`);

    // 차단 사실은 말하지 않는다 — 닫힌 까닭의 문장은 읽는 문이 정한 그것뿐이다
    await expect(a.page.getByRole('status')).toHaveText(closedRoomText('block'), { timeout: WITHIN_MS + 1_000 });
    await expect(a.page.getByPlaceholder('메시지를 입력해 주세요')).toHaveCount(0);
    const refused = await a.api.rpc('send_chat_message', { p_match_id: matchId, p_body: '닫힌 뒤' });
    expect(refused.data === 'sent').toBe(false);
  });

  test('(5) 끊긴 동안 온 메시지가 다시 붙으면 빠짐 · 겹침 없이 차례대로 선다', async ({ openAs }) => {
    const { a, b, tag, matchId, room } = await pair(openAs);
    const bLog = socketLog(b.page);
    await b.page.goto(room);
    await channelUp(bLog, userIdOf(b.account.email));

    await b.page.context().setOffline(true);
    const bodies = Array.from({ length: 6 }, (_, index) => `끊긴 동안 ${index} ${tag}`);
    for (const body of bodies) await sendAs(a, matchId, body);
    await b.page.waitForTimeout(1_000);
    await b.page.context().setOffline(false);

    for (const body of bodies) await expect(talkOf(b.page).getByText(body)).toHaveCount(1, { timeout: 10_000 });
    // 끊긴 동안 화면을 다시 그리려다 페이지 이동으로 물러서지 않았다 — 같은 화면이 그대로 받았다
    await expect(b.page).toHaveURL(new RegExp(`${room}$`));
    const order = await talkOf(b.page)
      .locator('li')
      .allInnerTexts()
      .then((rows) => rows.map((text) => bodies.findIndex((body) => text.includes(body))).filter((index) => index >= 0));
    expect(order).toEqual([0, 1, 2, 3, 4, 5]);
  });

  test('(6) 숨은 탭은 읽음을 남기지 않고, 보이게 되면 남긴다', async ({ openAs }) => {
    const { a, b, tag, matchId, room } = await pair(openAs);
    const bLog = socketLog(b.page);
    await b.page.goto(room);
    await channelUp(bLog, userIdOf(b.account.email));

    await b.page.evaluate(() => {
      Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => 'hidden' });
      document.dispatchEvent(new Event('visibilitychange'));
    });
    const body = `숨은 동안 ${tag}`;
    await sendAs(a, matchId, body);
    await expect(talkOf(b.page).getByText(body)).toBeVisible({ timeout: WITHIN_MS });

    const readOf = () =>
      Number(
        sql(`select coalesce(max(r.last_read_seq), 0) from public.chat_read r join public.chat_room c on c.id = r.room_id
             where c.match_id = '${matchId}' and r.user_id = '${userIdOf(b.account.email)}'`),
      );
    const newest = Number(
      sql(`select max(m.seq) from public.chat_message m join public.chat_room c on c.id = m.room_id where c.match_id = '${matchId}'`),
    );
    await b.page.waitForTimeout(1_500);
    expect(readOf()).toBeLessThan(newest);

    await b.page.evaluate(() => {
      Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => 'visible' });
      document.dispatchEvent(new Event('visibilitychange'));
    });
    await expect.poll(readOf, { timeout: WITHIN_MS + 1_000 }).toBe(newest);
  });

  test('(6) 로그아웃하면 채널이 걷히고, 같은 창에서 다른 계정으로 들어가면 앞 계정의 사건을 받지 않는다', async ({ openAs, switchAccount }) => {
    const { a, b, tag, matchId } = await pair(openAs);
    const bId = userIdOf(b.account.email);
    const bLog = socketLog(b.page);
    await b.page.goto('/me');
    await channelUp(bLog, bId);

    await b.page.getByLabel('설정 메뉴').click();
    await b.page.getByRole('button', { name: '로그아웃' }).click();
    await expect(b.page).toHaveURL(/\/$/);
    // 떠나는 글이 나갔다
    await expect
      .poll(() => bLog.frames.some((frame) => frame.dir === 'out' && frame.text.includes(`user:${bId}`) && frame.text.includes('phx_leave')))
      .toBe(true);

    const heardBefore = bLog.frames.filter((frame) => frame.dir === 'in' && frame.text.includes('changed')).length;
    await sendAs(a, matchId, `나간 뒤 ${tag}`);
    await b.page.waitForTimeout(WITHIN_MS);
    expect(bLog.frames.filter((frame) => frame.dir === 'in' && frame.text.includes('changed')).length).toBe(heardBefore);

    // 같은 창 · 같은 저장소에서 다른 계정 C 로 들어간다
    const c = await switchAccount(b.page, { selfPerson: true });
    const cId = userIdOf(c.account.email);
    await b.page.goto('/me');
    await channelUp(bLog, cId);
    const framesAt = bLog.frames.length;

    await sendAs(a, matchId, `바꾼 뒤 ${tag}`);
    await b.page.waitForTimeout(WITHIN_MS);
    const after = bLog.frames.slice(framesAt);
    expect(after.filter((frame) => frame.text.includes(`user:${bId}`))).toEqual([]);
    expect(after.filter((frame) => frame.dir === 'in' && frame.text.includes('changed'))).toEqual([]);
    await expect(chatTab(b.page).getByText('건 안 읽음')).toHaveCount(0);
  });

  test('(7) 남의 주제는 구독이 거절되고, 남의 방 메시지는 0행이다', async ({ openAs, local }) => {
    const { a, b, matchId } = await pair(openAs);
    const stranger = await openAs({ selfPerson: true });

    const { data } = await stranger.api.auth.getSession();
    const token = data.session?.access_token;
    if (!token) throw new Error('세션이 없습니다');

    /* 브라우저의 클라이언트와 같은 판의 supabase-js 를 그 사람의 토큰으로 — 서버의 판정은 토큰 하나로 갈린다 */
    const join = async (topic: string) => {
      const client = createClient(local.api, local.anonKey, {
        auth: { persistSession: false, autoRefreshToken: false },
        accessToken: async () => token,
      });
      await client.realtime.setAuth(token);
      const status = await new Promise<string>((resolve) => {
        const channel = client.channel(topic, { config: { private: true } });
        const timer = setTimeout(() => resolve('NO_ANSWER'), 8_000);
        channel.subscribe((state) => {
          if (state === 'SUBSCRIBED' || state === 'CHANNEL_ERROR' || state === 'TIMED_OUT') {
            clearTimeout(timer);
            resolve(state);
          }
        });
      });
      await client.removeAllChannels();
      return status;
    };

    expect(await join(`user:${userIdOf(stranger.account.email)}`)).toBe('SUBSCRIBED');
    expect(await join(`user:${userIdOf(b.account.email)}`)).not.toBe('SUBSCRIBED');

    const peek = await stranger.api.rpc('my_chat_messages', { p_match_id: matchId, p_limit: 200 });
    expect(peek.error).toBeNull();
    expect(peek.data ?? []).toHaveLength(0);
    // 같은 문을 방의 사람이 부르면 읽힌다 — 0행이 문이 고장 나서가 아니다
    await sendAs(a, matchId, '방 안의 말');
    const own = await a.api.rpc('my_chat_messages', { p_match_id: matchId, p_limit: 200 });
    expect((own.data ?? []).length).toBeGreaterThan(0);
  });

  test('(8) 손대지 않는 동안 온 메시지의 다시 그리기 · 자동 읽음은 활동이 아니다 — 사람이 옮기면 활동이다 (G-76)', async ({ openAs }) => {
    const { a, b, tag, matchId, room } = await pair(openAs);
    const bId = userIdOf(b.account.email);
    const bLog = socketLog(b.page);
    // 방 화면 — 채팅 갈래가 오면 다시 그리고(`router.refresh`), 상대 말이 화면에 들면 저절로 읽음을 남긴다
    await b.page.goto(room);
    await channelUp(bLog, bId);
    await expect.poll(() => activityOf(bId), { timeout: 5_000 }).not.toBe('none');

    const idle = pushActivityBack(bId);
    const body = `자리 비운 동안 ${tag}`;
    await sendAs(a, matchId, body);
    await expect(talkOf(b.page).getByText(body)).toBeVisible({ timeout: WITHIN_MS });
    // 자동 읽음이 그 말까지 남았다 — 브라우저가 곧장 부른 쓰기다
    await expect.poll(() => readOf(matchId, bId), { timeout: WITHIN_MS + 1_000 }).toBe(newestOf(matchId));
    // 다시 그리기(400ms 묶음)와 그 뒤의 `after` 가 끝날 만큼 기다린다
    await b.page.waitForTimeout(2_000);
    expect(activityOf(bId)).toBe(idle);
    expect((await b.page.context().cookies()).some((cookie) => cookie.name === 'live-redraw')).toBe(false);

    // 사람이 탭을 옮기면 활동이다 — 표지가 그 요청을 빼지 않는다
    await matchingTab(b.page).click();
    await expect(b.page).toHaveURL(/\/me\/matching/);
    await expect.poll(() => activityOf(bId), { timeout: 5_000 }).not.toBe(idle);
  });

  test('(8) 채널이 내려가 30초 대체 조회가 목록을 다시 그려도 활동이 아니다 (G-76)', async ({ openAs }) => {
    test.setTimeout(120_000);
    const { a, b, tag, matchId } = await pair(openAs);
    const bId = userIdOf(b.account.email);
    // 채널의 소켓을 서버에 잇지 않고 닫는다 — 망은 살아 있고 채널만 못 선다
    await b.page.routeWebSocket(/\/realtime\//, (socket) => socket.close());
    await b.page.goto('/me/chat');
    await expect.poll(() => activityOf(bId), { timeout: 5_000 }).not.toBe('none');

    const idle = pushActivityBack(bId);
    await sendAs(a, matchId, `대체 조회 ${tag}`);
    const row = b.page.getByRole('link', { name: new RegExp(`가${tag}`) });
    // 대체 조회가 다시 그린 목록에 새 말이 선다 — 다시 그리기가 정말 있었다
    await expect(row.getByText(`대체 조회 ${tag}`)).toBeVisible({ timeout: 45_000 });
    await b.page.waitForTimeout(1_500);
    expect(activityOf(bId)).toBe(idle);
  });

  test('위에서 과거를 읽는 동안 새 말이 오면 자리를 지키고 「새 메시지」가 서며, 맨 위에서 이전 메시지를 더 읽는다', async ({ openAs }) => {
    const { a, b, tag, matchId, room } = await pair(openAs);
    // 첫 200건 밖까지 — 230건을 미리 쌓는다(한도는 SQL 이 아니라 문이 센다 — 표에 바로 넣는다)
    const roomId = sql(`select id from public.chat_room where match_id = '${matchId}'`);
    const aId = userIdOf(a.account.email);
    sql(`insert into public.chat_message (room_id, sender_user_id, body, created_at)
         select '${roomId}', '${aId}', '쌓인 말 ' || n || ' ${tag}', now() - interval '1 hour' + n * interval '1 second'
         from generate_series(1, 230) n`);

    const bLog = socketLog(b.page);
    await b.page.goto(room);
    await channelUp(bLog, userIdOf(b.account.email));
    await expect(talkOf(b.page).getByText(`쌓인 말 230 ${tag}`)).toBeVisible();
    await expect(talkOf(b.page).getByText(`쌓인 말 30 ${tag}`, { exact: true })).toHaveCount(0);

    // 위로 올려 읽는 중 — 그때 눈앞의 말풍선 하나를 잡아 둔다
    const reading = talkOf(b.page).getByText(`쌓인 말 120 ${tag}`, { exact: true });
    await reading.scrollIntoViewIfNeeded();
    const topBefore = (await reading.boundingBox())?.y ?? NaN;

    await sendAs(a, matchId, `새로 온 말 ${tag}`);
    await expect(b.page.getByRole('button', { name: NEW_MESSAGES_LABEL })).toBeVisible({ timeout: WITHIN_MS });
    const topAfter = (await reading.boundingBox())?.y ?? NaN;
    const moved = Math.abs(topAfter - topBefore);
    test.info().annotations.push({ type: '새 말이 붙은 뒤 읽던 말풍선이 움직인 거리', description: `${moved}px` });
    expect(moved).toBeLessThanOrEqual(1);

    await b.page.getByRole('button', { name: NEW_MESSAGES_LABEL }).click();
    await expect(talkOf(b.page).getByText(`새로 온 말 ${tag}`)).toBeInViewport();
    await expect(b.page.getByRole('button', { name: NEW_MESSAGES_LABEL })).toHaveCount(0);

    // 맨 위 — 이전 메시지 더 보기. 읽은 뒤에도 보던 말풍선이 제자리다
    const more = b.page.getByRole('button', { name: OLDER_MESSAGES_LABEL });
    await more.scrollIntoViewIfNeeded();
    const oldest = talkOf(b.page).getByText(`쌓인 말 31 ${tag}`, { exact: true });
    const oldestBefore = (await oldest.boundingBox())?.y ?? NaN;
    await more.click();
    await expect(talkOf(b.page).getByText(`쌓인 말 1 ${tag}`, { exact: true })).toHaveCount(1);
    const oldestAfter = (await oldest.boundingBox())?.y ?? NaN;
    test.info().annotations.push({ type: '이전 메시지를 붙인 뒤 보던 말풍선이 움직인 거리', description: `${Math.abs(oldestAfter - oldestBefore)}px` });
    expect(Math.abs(oldestAfter - oldestBefore)).toBeLessThanOrEqual(1);
    // 처음까지 다 읽었다 — 단추 대신 첫머리가 선다
    await expect(more).toHaveCount(0);
  });
});
