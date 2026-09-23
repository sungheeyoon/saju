import { createClient } from '@supabase/supabase-js';
import { createServerClient } from '@supabase/ssr';
import { execFileSync } from 'node:child_process';

import { startCheckServer } from './next-server.mjs';
import { passNotice, chartArgs } from './notice.mjs';
import { createChecks, sql } from './checks.mjs';
import { CHAT_POLICY, RATE_LIMITED_TEXT, closedRoomText } from '../src/lib/chat/index.ts';
import { PRESENCE_POLICY } from '../src/lib/presence/index.ts';
import { worktreeStack } from '../src/lib/local-env.ts';

/**
 * 채팅 — 문과 액션과 화면을 실제 스택에 대고 두드린다(PRD §7.1, ADR 0091).
 *
 * pgTAP 34 가 DB 층의 완료 조건 여섯을 재고, e2e `chat.spec.ts` 가 브라우저에서 밟는다. 여기는
 * 그 사이 — **`chat_policy()` 와 lib 의 수가 같은가**(갈리면 화면이 거짓말한다), 읽는 문이 내주는
 * 것이 화면에 그대로 서는가, 상대의 이메일·출생 원문이 방 화면에 새지 않는가.
 */

const status = JSON.parse(execFileSync('npx', ['supabase', 'status', '-o', 'json'], { encoding: 'utf8' }));
const API = status.API_URL;
const PORT = Number(process.env.CHECK_PORT ?? worktreeStack().checkPort + 7);

const anon = () => createClient(API, status.ANON_KEY, { auth: { persistSession: false } });

const { check, finish } = createChecks('check-chat');

const stamp = Date.now();
const tag = String(stamp).slice(-4);
const NAME = { a: `민챗${tag}`, b: `지챗${tag}` };

const BIRTH = {
  a: { date: '1990-05-15', city: '서울', gender: 'male' },
  b: { date: '1992-03-03', city: '부산', gender: 'female' },
};

const password = `pw-${stamp}-Aa1!`;
const mail = { a: `chat-a-${stamp}@example.com`, b: `chat-b-${stamp}@example.com` };

const userId = (email) => sql(`select id from auth.users where email = '${email}'`);

const person = async (email, label, birth) => {
  const client = anon();
  await client.auth.signUp({ email, password });
  await passNotice(client);
  await client.rpc('create_self_person', {
    p_local_label: label, p_calendar: 'solar',
    p_original_date: birth.date, p_solar_date: birth.date, p_birth_time: '14:30',
    p_gender: birth.gender, p_city: birth.city, p_late_night_rule: 'jo', p_time_basis: 'localMean',
    ...chartArgs(label),
  });
  return client;
};

const a = await person(mail.a, '민수', BIRTH.a);
const b = await person(mail.b, '지영', BIRTH.b);

const 가짜 = {
  glyphCount: 8,
  counts: { 木: 8, 火: 0, 土: 0, 金: 0, 水: 0 },
  ratios: { 木: 1, 火: 0, 土: 0, 金: 0, 水: 0 },
};

for (const [client, nickname] of [[a, NAME.a], [b, NAME.b]]) {
  await client.rpc('save_my_profile', { p_nickname: nickname, p_intro: null });
  await client.rpc('set_discovery_participation', { p_on: true, p_summary: 가짜 });
}

const list = Object.values(mail).map((email) => `'${email}'`).join(', ');
sql(`update public.discovery_profile set opted_in_at = null, opted_out_at = now()
     where user_id not in (select id from auth.users where email in (${list}))`);

const cookieFor = async (email) => {
  const jar = new Map();
  const browser = createServerClient(API, status.ANON_KEY, {
    cookies: {
      getAll: () => [...jar].map(([name, value]) => ({ name, value })),
      setAll: (written) => {
        for (const { name, value } of written) jar.set(name, value);
      },
    },
  });
  const { error } = await browser.auth.signInWithPassword({ email, password });
  if (error) throw new Error(`${email} 로그인 실패 — ${error.message}`);
  return [...jar].map(([name, value]) => `${name}=${encodeURIComponent(value)}`).join('; ');
};

const cookie = { a: await cookieFor(mail.a), b: await cookieFor(mail.b) };

const { base: BASE, stop } = await startCheckServer({
  port: PORT,
  supabaseUrl: API,
  anonKey: status.ANON_KEY,
  secretKey: status.SERVICE_ROLE_KEY,
});

const get = (path, jar) => fetch(`${BASE}${path}`, { headers: jar ? { cookie: jar } : {}, redirect: 'manual' });
const body = async (path, jar) => (await get(path, jar)).text();
const plain = (html) => html.replace(/<!--\s*-->/g, '');

try {
  // ── 0. 수의 원본은 DB 다 — lib 의 사본과 같아야 한다 ─────────────────────
  {
    const { data, error } = await a.rpc('chat_policy');
    const policy = data?.[0];
    check('chat_policy() 가 한 벌을 내준다', !error && policy !== undefined, error?.message ?? '');
    check('한도 · 창 · 길이 · 문맥 · 보존이 lib 의 수와 같다',
      policy?.rate_limit === CHAT_POLICY.rateLimit
        && policy?.rate_window_seconds === CHAT_POLICY.rateWindowSeconds
        && policy?.max_length === CHAT_POLICY.maxLength
        && policy?.snapshot_context === CHAT_POLICY.snapshotContext
        && policy?.retention_days === CHAT_POLICY.retentionDays,
      JSON.stringify(policy));

    const presence = await a.rpc('presence_policy');
    const bands = presence.data?.[0];
    check('presence_policy() 가 한 벌을 내준다', !presence.error && bands !== undefined, presence.error?.message ?? '');
    check('「지금」 창 · 억제 창 · 하루가 lib 의 수와 같다',
      bands?.now_window_seconds === PRESENCE_POLICY.nowWindowSeconds
        && bands?.write_window_seconds === PRESENCE_POLICY.writeWindowSeconds
        && bands?.day_window_seconds === PRESENCE_POLICY.dayWindowSeconds,
      JSON.stringify(bands));
  }

  // ── 1. 방이 없을 때의 목록, 로그인 없이의 목록 ────────────────────────────
  {
    const anonymous = await get('/me/chat');
    check('로그인 없이는 목록이 안 열린다', anonymous.status !== 200, String(anonymous.status));

    const empty = plain(await body('/me/chat', cookie.a));
    check('방이 없으면 빈 목록이 말한다', empty.includes('아직 채팅방이 없습니다'));
  }

  // ── 2. 후보 → 요청 → 수락 → 방 ────────────────────────────────────────────
  await get('/me', cookie.a);
  await get('/me', cookie.b);
  sql(`delete from public.discovery_candidate s using auth.users u
       where u.id = s.user_id and u.email = '${mail.a}'`);
  await get('/me/matching', cookie.a);

  const asked = await a.rpc('request_match', { p_candidate_user_id: userId(mail.b) });
  const accepted = await b.rpc('respond_to_match_request', { p_request_id: asked.data, p_accept: true });
  check('수락하면 Match 가 선다', accepted.data === 'accepted', accepted.error?.message ?? '');

  const { data: rooms } = await a.rpc('my_chat_rooms');
  const matchId = rooms?.[0]?.match_id;
  check('동의가 나면 방이 트리거로 선다 — 화면이 세우는 것이 아니다',
    typeof matchId === 'string' && rooms.length === 1, `${rooms?.length ?? '?'}건`);
  const ROOM = `/me/chat/${matchId}`;

  // ── 3. 보내고, 상대의 목록과 방에 선다 ────────────────────────────────────
  {
    const hello = `안녕하세요 ${tag}`;
    const sent = await a.rpc('send_chat_message', { p_match_id: matchId, p_body: hello });
    check('보내면 값 sent 가 온다', sent.data === 'sent', sent.error?.message ?? String(sent.data));

    const listed = plain(await body('/me/chat', cookie.b));
    check('상대의 목록에 내 이름과 마지막 메시지가 선다', listed.includes(NAME.a) && listed.includes(hello));
    check('안 읽은 수가 1 이다', listed.includes('1<span class="sr-only">건 안 읽음'), '');

    const opened = await get(ROOM, cookie.b);
    const html = plain(await opened.text());
    check('방이 열린다', opened.status === 200, String(opened.status));
    check('제목은 「{닉네임} 님」이다', html.includes(`${NAME.a} 님`));
    check('메시지가 선다', html.includes(hello));
    check('입력 칸과 보내기가 선다', html.includes('메시지를 입력해 주세요') && html.includes('보내기'));
    check('상대의 이메일과 출생 원문은 방 화면에 새지 않는다',
      !html.includes(mail.a) && !html.includes(BIRTH.a.date) && !html.includes('1990'));

    const marked = await b.rpc('mark_chat_read', { p_match_id: matchId });
    const { data: after } = await b.rpc('unread_chat_count');
    check('읽으면 안 읽은 수가 0 이다', !marked.error && after === 0, `${after}`);

    const other = await get(ROOM, cookie.a);
    check('보낸 쪽도 같은 방을 본다', other.status === 200, String(other.status));
    const stranger = await get(ROOM);
    check('로그인 없이는 방이 안 열린다', stranger.status !== 200, String(stranger.status));
  }

  // ── 4. 한도 — 30 은 되고 31 은 값으로 거절된다 ────────────────────────────
  {
    let last = null;
    for (let i = 1; i < CHAT_POLICY.rateLimit; i += 1) {
      last = await a.rpc('send_chat_message', { p_match_id: matchId, p_body: `${i}` });
      if (last.error || last.data !== 'sent') break;
    }
    check(`${CHAT_POLICY.rateLimit}번째까지 sent 다`, last?.data === 'sent', last?.error?.message ?? String(last?.data));
    const over = await a.rpc('send_chat_message', { p_match_id: matchId, p_body: '넘침' });
    check(`${CHAT_POLICY.rateLimit + 1}번째는 rate_limited 다`, over.data === 'rate_limited', String(over.data));
    check('한도 거절의 문장은 lib 가 든다 — 화면이 값을 문장으로 옮긴다',
      RATE_LIMITED_TEXT.length > 0 && !RATE_LIMITED_TEXT.includes('rate_limited'));
    const hits = Number(sql(`select count(*) from public.chat_rate_limit_hit
      where user_id = '${userId(mail.a)}'`));
    check('거절 한 건이 한 줄로 남는다', hits === 1, `${hits}`);
  }

  // ── 5. 차단하면 닫히고 둘 다 본다 ─────────────────────────────────────────
  {
    await b.rpc('block_user', { p_user_id: userId(mail.a) });

    for (const [who, jar] of [['차단한 쪽', cookie.b], ['차단당한 쪽', cookie.a]]) {
      const opened = await get(ROOM, jar);
      const html = plain(await opened.text());
      check(`${who}에서 방이 그대로 열린다`, opened.status === 200, String(opened.status));
      check(`${who}에서 이전 대화가 보인다`, html.includes(`안녕하세요 ${tag}`));
      check(`${who}에 닫힌 까닭 한 줄이 선다`, html.includes(closedRoomText('block')));
      check(`${who}에서 입력이 안 된다`, !html.includes('메시지를 입력해 주세요'));
    }

    const listed = plain(await body('/me/chat', cookie.a));
    check('목록에도 닫힌 채 남는다', listed.includes(NAME.b) && listed.includes(closedRoomText('block')));

    const sent = await a.rpc('send_chat_message', { p_match_id: matchId, p_body: '닫힌 뒤' });
    check('닫힌 방에 보내면 값 closed 가 온다', sent.data === 'closed', String(sent.data));
  }
} finally {
  stop();
}

finish();
