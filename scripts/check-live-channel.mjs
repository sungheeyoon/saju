import { createClient } from '@supabase/supabase-js';
import { execFileSync } from 'node:child_process';

import { passNotice } from './notice.mjs';
import { createChecks, sql } from './checks.mjs';

/**
 * 계정마다 비공개 채널 — **실제 소켓을 붙여** 정책과 지연을 잰다(ADR 0156).
 *
 * pgTAP 82 가 정책과 트리거를 DB 안에서 잰다. 여기는 그 사이의 Realtime 서버다 — 비공개 채널에 들어올 때 서버가 정말
 * `realtime.messages` 의 정책을 묻는가(남의 주제는 거절), 상대가 보낸 메시지가 커밋 뒤 **2초 안에** 닿는가.
 *
 * 로컬 스택에 realtime 이 떠 있어야 한다(`npm run db:start`). Next 서버는 안 띄운다 — 문과 소켓만 두드린다.
 */

const status = JSON.parse(execFileSync('npx', ['supabase', 'status', '-o', 'json'], { encoding: 'utf8' }));
const API = status.API_URL;

const { check, finish } = createChecks('check-live-channel');

/** 수용 기준(ADR 0156 의 1) — 전송 성공 뒤 이 안에 */
const BUDGET_MS = 2000;
const ROUNDS = 5;

const stamp = Date.now();
const password = `pw-${stamp}-Aa1!`;
const mail = { a: `live-a-${stamp}@example.com`, b: `live-b-${stamp}@example.com` };

const signedIn = async (email) => {
  const client = createClient(API, status.ANON_KEY, { auth: { persistSession: false } });
  await client.auth.signUp({ email, password });
  await passNotice(client);
  const { data } = await client.auth.getSession();
  await client.realtime.setAuth(data.session.access_token);
  return { client, id: data.session.user.id };
};

/** 채널을 열고 처음 선 상태를 기다린다 — SUBSCRIBED · CHANNEL_ERROR · TIMED_OUT */
const join = (client, topic, onChanged = () => {}) => new Promise((resolve) => {
  const channel = client.channel(topic, { config: { private: true } })
    .on('broadcast', { event: 'changed' }, (message) => onChanged(message.payload));
  const timer = setTimeout(() => resolve({ channel, state: 'NO_ANSWER' }), 10000);
  channel.subscribe((state, error) => {
    if (state === 'SUBSCRIBED' || state === 'CHANNEL_ERROR' || state === 'TIMED_OUT') {
      clearTimeout(timer);
      resolve({ channel, state, error: error?.message });
    }
  });
});

const a = await signedIn(mail.a);
const b = await signedIn(mail.b);

/** 둘의 Match — 요청 · 수락의 흐름은 `check-chat` 이 잰다. 여기는 방만 있으면 된다 */
sql(`insert into public.match (user_low, user_high)
     values (least('${a.id}'::uuid, '${b.id}'::uuid), greatest('${a.id}'::uuid, '${b.id}'::uuid))`);
const matchId = sql(`select id from public.match where user_low = least('${a.id}'::uuid, '${b.id}'::uuid)
                     and user_high = greatest('${a.id}'::uuid, '${b.id}'::uuid)`);

const heard = [];
let waiting = null;

try {
  // ── 1. 제 주제는 서고, 남의 주제는 거절된다 ─────────────────────────────────
  const mine = await join(a.client, `user:${a.id}`, (payload) => {
    heard.push(payload);
    if (waiting && payload.area === 'chat' && payload.seq !== null) waiting({ payload, at: performance.now() });
  });
  check('제 주제(user:<나>)의 비공개 채널이 SUBSCRIBED 로 선다', mine.state === 'SUBSCRIBED', mine.error ?? mine.state);

  const theirs = await join(a.client, `user:${b.id}`);
  check('남의 주제(user:<상대>)는 거절된다', theirs.state === 'CHANNEL_ERROR', theirs.error ?? theirs.state);
  await a.client.removeChannel(theirs.channel);

  const outsider = createClient(API, status.ANON_KEY, { auth: { persistSession: false } });
  const anonymous = await join(outsider, `user:${a.id}`);
  check('로그인 없이는 누구의 주제도 못 듣는다', anonymous.state === 'CHANNEL_ERROR', anonymous.error ?? anonymous.state);
  await outsider.removeAllChannels();

  // ── 2. 상대가 보내면 2초 안에 changed 가 온다 ────────────────────────────────
  const lags = [];
  for (let round = 1; round <= ROUNDS; round += 1) {
    const arrived = new Promise((resolve) => {
      waiting = resolve;
      setTimeout(() => resolve(null), 5000);
    });
    /** 부르기 전부터 센다 — 보내는 왕복이 든 위쪽 값이다. 소켓이 HTTP 응답보다 먼저 닿기도 한다 */
    const started = performance.now();
    const { data, error } = await b.client.rpc('send_chat_message', { p_match_id: matchId, p_body: `실측 ${round}` });
    if (error || data !== 'sent') {
      check(`보내기 ${round}`, false, error?.message ?? String(data));
      break;
    }
    const got = await arrived;
    const payload = got?.payload;
    waiting = null;
    lags.push(got ? Math.round(got.at - started) : null);
    if (round === 1) {
      check('온 것은 chat · 그 방의 match_id · seq 이고 본문이 없다',
        payload?.area === 'chat' && payload?.match_id === matchId && Number.isInteger(payload?.seq)
          && !JSON.stringify(payload).includes('실측'),
        JSON.stringify(payload));
    }
  }

  const measured = lags.filter((lag) => lag !== null);
  check(`${ROUNDS}번 다 닿는다`, measured.length === ROUNDS, JSON.stringify(lags));
  check(`가장 늦은 것도 ${BUDGET_MS}ms 안이다`, measured.length > 0 && Math.max(...measured) <= BUDGET_MS,
    `지연(ms, 보내기를 부른 때부터) ${JSON.stringify(lags)}`);

  // ── 3. 읽음은 다른 탭에 — 읽은 사람 자신의 주제로 ────────────────────────────
  const before = heard.length;
  const readerTab = await join(b.client, `user:${b.id}`, (payload) => heard.push({ ...payload, tab: 'b' }));
  check('상대도 제 주제를 연다', readerTab.state === 'SUBSCRIBED', readerTab.error ?? readerTab.state);
  await a.client.rpc('mark_chat_read', { p_match_id: matchId, p_up_to_seq: Number.MAX_SAFE_INTEGER });
  await new Promise((resolve) => setTimeout(resolve, 1500));
  const after = heard.slice(before);
  check('내가 읽으면 내 주제(다른 탭)에 chat 이 온다',
    after.some((one) => !one.tab && one.area === 'chat' && one.match_id === matchId && one.seq === null), JSON.stringify(after));
  check('상대의 주제에는 내 읽음이 안 간다 — 읽음 표시는 범위 밖', !after.some((one) => one.tab === 'b'), JSON.stringify(after));
} finally {
  await a.client.removeAllChannels();
  await b.client.removeAllChannels();
  sql(`delete from auth.users where email in ('${mail.a}', '${mail.b}')`);
  finish();
}
