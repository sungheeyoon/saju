import { createClient } from '@supabase/supabase-js';
import { execFileSync } from 'node:child_process';
import { randomBytes } from 'node:crypto';

import webpush from 'web-push';

import { startCheckServer } from './next-server.mjs';
import { passNotice, chartArgs } from './notice.mjs';
import { createChecks, sql, testNeed, keyedRpc, shapeOnlySummary, fetchWhole, sessionCookie } from './checks.mjs';
import { startFakePushService } from './fake-push-service.mjs';
import { localDispatchUrl, setLocalPushExtraHosts, setLocalPushVault } from './push-local.mjs';
import { PUSH_TTL_SECONDS, pushPayloadFor, pushTopicFor } from '../src/lib/push/index.ts';
import { worktreeStack } from '../src/lib/local-env.ts';

/**
 * 웹 푸시 — **메시지 한 통이 잠금 화면까지 가는 길을 끝까지** 잰다(ADR 0156).
 *
 *   다른 계정이 메시지를 보낸다 → DB 가 배달 줄을 남기고 `pg_net` 으로 배달 문을 깨운다 → 배달 문이 `web-push` 로
 *   암호화해 보낸다 → 가짜 푸시 서비스(`fake-push-service.mjs`)가 받아 **암호를 풀고** 페이로드를 본다 → 배달 줄이 닫힌다
 *
 * 운영의 푸시 서비스(FCM · Mozilla · Apple)와 실제 사용자에게는 아무것도 안 간다 — endpoint 는 전부 이 프로세스의
 * `https://localhost:<포트>` 이고, VAPID 열쇠 · 배달 비밀은 이번 실행에서 지은 일회용이다. Vault 는 로컬 스택의 것만 쓴다.
 *
 * 재는 것: 보냄(페이로드 · TTL · Urgency · Topic) · 410 이면 구독이 지워짐 · 500 이면 다시 기한이 서고 다음 깨움에 감 ·
 * 같은 방에 셋이 연달아 와도 대기 줄은 하나 · 받는 사람이 이미 읽었으면 안 감 · 배달 문의 자격.
 */

const status = JSON.parse(execFileSync('npx', ['supabase', 'status', '-o', 'json'], { encoding: 'utf8' }));
const API = status.API_URL;
const PORT = Number(process.env.CHECK_PORT ?? worktreeStack().checkPort + 11);

const anon = () => createClient(API, status.ANON_KEY, { auth: { persistSession: false } });

const { check, finish } = createChecks('check-push');

const stamp = Date.now();
const tag = String(stamp).slice(-4);
const password = `pw-${stamp}-Aa1!`;
const mail = { a: `push-a-${stamp}@example.com`, b: `push-b-${stamp}@example.com` };
const userId = (email) => sql(`select id from auth.users where email = '${email}'`);

const person = async (email, label, birth) => {
  const client = anon();
  await client.auth.signUp({ email, password });
  await passNotice(client);
  await keyedRpc(client, 'create_self_person', {
    p_local_label: label, p_calendar: 'solar',
    p_original_date: birth.date, p_solar_date: birth.date, p_birth_time: '14:30',
    p_gender: birth.gender, p_city: birth.city, p_late_night_rule: 'jo', p_time_basis: 'localMean',
    ...chartArgs(label),
  });
  return client;
};

// ── 무대: 두 사람 · 한 방 ────────────────────────────────────────────────────
const a = await person(mail.a, '민수', { date: '1990-05-15', city: '서울', gender: 'male' });
const b = await person(mail.b, '지영', { date: '1992-03-03', city: '부산', gender: 'female' });
for (const [client, nickname] of [[a, `민푸${tag}`], [b, `지푸${tag}`]]) {
  await client.rpc('save_my_profile', { p_nickname: nickname, p_intro: null });
  await keyedRpc(client, 'set_discovery_participation', { p_on: true, p_summary: shapeOnlySummary, p_need: testNeed() });
}
const list = Object.values(mail).map((email) => `'${email}'`).join(', ');
sql(`update public.discovery_profile set opted_in_at = null, opted_out_at = now()
     where user_id not in (select id from auth.users where email in (${list}))`);

// ── 일회용 열쇠 · 가짜 푸시 서비스 · 배달 문을 든 서버 ─────────────────────────
const vapid = webpush.generateVAPIDKeys();
const dispatchSecret = randomBytes(32).toString('base64url');
const fake = await startFakePushService();

const { base: BASE, stop } = await startCheckServer({
  port: PORT,
  supabaseUrl: API,
  anonKey: status.ANON_KEY,
  secretKey: status.SECRET_KEY ?? status.SERVICE_ROLE_KEY,
  built: { NEXT_PUBLIC_WEB_PUSH_VAPID_PUBLIC_KEY: vapid.publicKey },
  // DB 컨테이너의 `pg_net` 이 배달 문을 두드린다 — 리눅스에서는 루프백 밖에서 와야 닿는다
  listenAll: true,
  whileRunning: {
    WEB_PUSH_VAPID_PRIVATE_KEY: vapid.privateKey,
    WEB_PUSH_SUBJECT: 'mailto:push-check@example.com',
    PUSH_DISPATCH_SECRET: dispatchSecret,
    // 가짜 푸시 서비스의 자기 서명 인증서만 더 믿는다 — 앱 코드에 시험 갈래가 없다
    NODE_EXTRA_CA_CERTS: fake.certPath,
    // 가짜 푸시 서비스의 호스트만 더 연다 — 운영에는 없는 값이다(알려진 푸시 서비스 넷만)
    WEB_PUSH_EXTRA_HOSTS: 'localhost',
  },
});
setLocalPushVault({ url: localDispatchUrl(PORT), secret: dispatchSecret });
setLocalPushExtraHosts('localhost');

/** 배달 줄 — 받는 사람의 그 방 줄들 */
const deliveries = (matchId) =>
  sql(`select coalesce(json_agg(d order by d.created_at), '[]') from public.push_delivery d
       join public.chat_room r on r.id = d.room_id where r.match_id = '${matchId}'`);
const rowsOf = (matchId) => JSON.parse(deliveries(matchId));

/**
 * 기다리는 줄을 지금 기한으로 당긴다 — 60초 묶음 · 뒤물림을 시험이 기다리지 않게. 잡는 문은 기한과 따로 마지막 보냄 + 60초를
 * 지키므로 그 방의 보냄도 61초 전 일로 민다.
 */
const dueNow = (matchId) => {
  sql(`update public.push_delivery d
       set sent_at = least(d.sent_at, now() - interval '61 seconds'), settled_at = least(d.settled_at, now() - interval '61 seconds')
       from public.chat_room r
       where r.id = d.room_id and r.match_id = '${matchId}' and d.status = 'sent'`);
  sql(`update public.push_delivery d set due_at = now() from public.chat_room r
       where r.id = d.room_id and r.match_id = '${matchId}' and d.status = 'pending'`);
};

/** 아직 안 닫힌 줄(기다림 · 보내는 중) */
const open = (row) => row.status === 'pending' || row.status === 'sending';

/** 크론이 하듯 DB 가 배달 문을 깨운다 — `pg_net` 을 지난다 */
const wake = () => sql('select public.wake_push_dispatch()');

const waitUntil = async (predicate, ms = 15_000) => {
  const deadline = Date.now() + ms;
  while (Date.now() < deadline) {
    if (predicate()) return true;
    await new Promise((resolve) => setTimeout(resolve, 250));
  }
  return false;
};

try {
  // ── 0. 배달 문의 자격 ─────────────────────────────────────────────────────
  {
    const none = await fetchWhole(`${BASE}/api/push/dispatch`, { method: 'POST' });
    const wrong = await fetchWhole(`${BASE}/api/push/dispatch`, { method: 'POST', headers: { authorization: 'Bearer nope' } });
    const right = await fetchWhole(`${BASE}/api/push/dispatch`, {
      method: 'POST',
      headers: { authorization: `Bearer ${dispatchSecret}` },
    });
    check('비밀 없이 두드리면 401', none.status === 401, String(none.status));
    check('틀린 비밀이면 401', wrong.status === 401, String(wrong.status));
    check('맞는 비밀이면 202 이고 설정이 선 것을 말한다', right.status === 202 && (await right.json()).configured === true);
  }

  // ── 방을 세운다 ─────────────────────────────────────────────────────────────
  // `check-chat.mjs` 와 같은 길 — 홈을 열어 풀에 들고, 후보를 다시 짓는다
  const cookie = { a: await sessionCookie(status, mail.a, password), b: await sessionCookie(status, mail.b, password) };
  const get = (path, jar) => fetchWhole(`${BASE}${path}`, { headers: { cookie: jar }, redirect: 'manual' });
  await get('/me', cookie.a);
  await get('/me', cookie.b);
  sql(`delete from public.discovery_candidate s using auth.users u where u.id = s.user_id and u.email = '${mail.a}'`);
  await get('/me/matching', cookie.a);
  const asked = await a.rpc('request_match', { p_candidate_user_id: userId(mail.b) });
  const accepted = await b.rpc('respond_to_match_request', { p_request_id: asked.data, p_accept: true });
  check('두 사람의 방이 선다', accepted.data === 'accepted', accepted.error?.message ?? '');
  const { data: rooms } = await a.rpc('my_chat_rooms');
  const matchId = rooms?.[0]?.match_id;

  // ── 1. 보냄 ────────────────────────────────────────────────────────────────
  const first = fake.subscription('b-1');
  const saved = await b.rpc('save_push_subscription', { p_endpoint: first.endpoint, p_p256dh: first.p256dh, p_auth: first.auth });
  check('받는 사람이 이 기기의 구독을 남긴다', !saved.error, saved.error?.message ?? '');

  await a.rpc('send_chat_message', { p_match_id: matchId, p_body: `비밀 본문 ${tag}` });
  const got = await fake.waitFor((one) => one.name === 'b-1');
  check(
    '메시지 한 통이 pg_net → 배달 문 → 푸시 서비스로 간다',
    got !== null,
    // 안 닿았으면 DB 쪽에서 본 그 요청의 끝을 싣는다 — 컨테이너에서 앱으로 가는 길이 막힌 것인지 여기서 갈린다
    got === null ? sql(`select coalesce(json_agg(r), '[]') from (select status_code, error_msg from net._http_response order by created desc limit 3) r`) : '',
  );
  check('푸시 서비스가 받은 것을 풀면 주소와 표뿐이다', JSON.stringify(got?.payload) === JSON.stringify(pushPayloadFor(matchId)),
    JSON.stringify(got?.payload ?? got?.error));
  check('암호를 풀기 전의 본문에 메시지 · 닉네임이 없다 — 풀린 값에도 없다',
    !JSON.stringify(got?.payload ?? {}).includes('비밀 본문') && !JSON.stringify(got?.payload ?? {}).includes(tag));
  check('TTL · Urgency · Topic 을 싣는다',
    got?.headers.ttl === String(PUSH_TTL_SECONDS) && got?.headers.urgency === 'high' && got?.headers.topic === pushTopicFor(matchId),
    JSON.stringify({ ttl: got?.headers.ttl, urgency: got?.headers.urgency, topic: got?.headers.topic }));
  check('VAPID 로 서명한다', /^vapid t=.+, k=.+/.test(got?.headers.authorization ?? ''));
  check('배달 줄이 보냄으로 닫힌다', await waitUntil(() => rowsOf(matchId).some((row) => row.status === 'sent')));

  // ── 2. 같은 방에 셋이 연달아 와도 대기 줄은 하나 ─────────────────────────────
  for (const n of [1, 2, 3]) await a.rpc('send_chat_message', { p_match_id: matchId, p_body: `연달아 ${n}` });
  const waiting = rowsOf(matchId).filter((row) => row.status === 'pending');
  check('셋이 와도 기다리는 배달 줄은 하나다', waiting.length === 1, `${waiting.length}줄`);

  // ── 3. 받는 사람이 이미 읽었으면 안 간다 ──────────────────────────────────────
  {
    const before = fake.received.length;
    await b.rpc('mark_chat_read', { p_match_id: matchId, p_up_to_seq: 2147483647 });
    dueNow(matchId);
    wake();
    await waitUntil(() => rowsOf(matchId).every((row) => !open(row)), 8000);
    await new Promise((resolve) => setTimeout(resolve, 1500));
    check('읽은 뒤의 깨움은 푸시 서비스에 아무것도 안 보낸다', fake.received.length === before, `${fake.received.length - before}건`);
    check('그 줄은 건너뜀으로 닫힌다', rowsOf(matchId).some((row) => row.status === 'skipped'),
      rowsOf(matchId).map((row) => row.status).join(','));
  }

  // ── 4. 500 → 다시 기한 → 다음 깨움에 간다 ──────────────────────────────────────
  {
    fake.answer('b-1', 500);
    const before = fake.received.filter((one) => one.name === 'b-1').length;
    await a.rpc('send_chat_message', { p_match_id: matchId, p_body: '오백' });
    dueNow(matchId);
    wake();
    await fake.waitFor((one) => one.name === 'b-1' && one.status === 500);
    const retried = await waitUntil(() => rowsOf(matchId).some((row) => row.status === 'pending' && row.attempts === 1));
    const row = rowsOf(matchId).find((one) => one.status === 'pending');
    check('500 이면 그 줄은 다시 보내기다 — 시도 1 · 기한이 뒤로 선다',
      retried && row !== undefined && new Date(row.due_at) > new Date(), JSON.stringify(row));

    fake.answer('b-1', 201);
    dueNow(matchId);
    wake();
    const again = await fake.waitFor((one) => one.name === 'b-1' && one.status === 201 && fake.received.indexOf(one) >= before);
    check('다음 깨움에 다시 가서 보냄으로 닫힌다', again !== null
      && await waitUntil(() => rowsOf(matchId).every((one) => !open(one))));
  }

  // ── 5. 410 → 구독이 지워진다 ─────────────────────────────────────────────────
  {
    fake.answer('b-1', 410);
    await a.rpc('send_chat_message', { p_match_id: matchId, p_body: '사백십' });
    dueNow(matchId);
    wake();
    await fake.waitFor((one) => one.name === 'b-1' && one.status === 410);
    const gone = await waitUntil(
      () => sql(`select count(*) from public.push_subscription where endpoint = '${first.endpoint}'`) === '0',
    );
    check('410 이면 그 구독이 지워진다', gone);
  }

  // ── 5½. 모르는 푸시 서비스는 받지 않는다 — DB 와 앱 둘 다 ──────────────────────
  {
    const keys = fake.subscription('stranger');
    for (const endpoint of ['https://evil.example/push/x', 'https://fcm.googleapis.com.evil.example/x',
      'https://evil.example@fcm.googleapis.com/x', 'https://fcm.googleapis.com:8443/x', 'https://169.254.169.254/latest']) {
      const refused = await b.rpc('save_push_subscription', { p_endpoint: endpoint, p_p256dh: keys.p256dh, p_auth: keys.auth });
      check(`DB 가 모르는 호스트를 거절한다 — ${endpoint}`, refused.error?.code === '22023', refused.error?.message ?? 'saved');
    }
    const known = await b.rpc('save_push_subscription', {
      p_endpoint: `https://fcm.googleapis.com/fcm/send/check-${tag}`, p_p256dh: keys.p256dh, p_auth: keys.auth });
    check('DB 가 알려진 푸시 서비스는 받는다', !known.error, known.error?.message ?? '');
    await b.rpc('remove_push_subscription', { p_endpoint: `https://fcm.googleapis.com/fcm/send/check-${tag}` });

    const post = (jar, endpoint) => fetchWhole(`${BASE}/me/push/subscription`, {
      method: 'POST',
      headers: { cookie: jar, origin: BASE, 'content-type': 'application/json' },
      body: JSON.stringify({ endpoint, p256dh: keys.p256dh, auth: keys.auth }),
      redirect: 'manual',
    });
    const strange = await post(cookie.b, 'https://evil.example/push/x');
    check('워커의 다시 남기기 주소도 모르는 호스트는 400 이다', strange.status === 400, String(strange.status));
    const signedOut = await post('', keys.endpoint);
    check('로그인 없는 다시 남기기는 401 이다 — DB 실패가 아니다', signedOut.status === 401, String(signedOut.status));
    const resaved = await post(cookie.b, keys.endpoint);
    check('로그인한 다시 남기기는 204 다', resaved.status === 204, String(resaved.status));
    await b.rpc('remove_push_subscription', { p_endpoint: keys.endpoint });
  }

  // ── 6. 계정 전환 — 같은 endpoint 를 다른 계정이 남기면 옮겨 간다 ─────────────────
  {
    const shared = fake.subscription('shared');
    await b.rpc('save_push_subscription', { p_endpoint: shared.endpoint, p_p256dh: shared.p256dh, p_auth: shared.auth });
    await a.rpc('save_push_subscription', { p_endpoint: shared.endpoint, p_p256dh: shared.p256dh, p_auth: shared.auth });
    const owner = sql(`select u.email from public.push_subscription s join auth.users u on u.id = s.user_id
                       where s.endpoint = '${shared.endpoint}'`);
    check('같은 endpoint 는 마지막에 켠 계정의 것이다', owner === mail.a, owner);
    const { data: hers } = await b.rpc('push_subscription_registered', { p_endpoint: shared.endpoint });
    check('앞 계정에게는 등록이 없다 — 설정 줄은 꺼짐이다', hers === false, String(hers));
  }

  // ── 7. 답하지 않는 푸시 서비스가 다른 구독을 세우지 않는다 ───────────────────────
  {
    const slow = fake.subscription('slow');
    const quick = fake.subscription('quick');
    fake.answer('slow', 'hang');
    for (const one of [slow, quick]) {
      await b.rpc('save_push_subscription', { p_endpoint: one.endpoint, p_p256dh: one.p256dh, p_auth: one.auth });
    }
    const started = Date.now();
    await a.rpc('send_chat_message', { p_match_id: matchId, p_body: '느린 서버' });
    const hung = await fake.waitFor((one) => one.name === 'slow');
    const fast = await fake.waitFor((one) => one.name === 'quick');
    check('답하지 않는 서버가 받는 동안에도 다른 구독은 간다', hung !== null && fast !== null && fast.at - started < 8000,
      fast ? `${fast.at - started}ms` : '안 감');
    const slowRow = () => JSON.parse(sql(`select coalesce(json_agg(d), '[]') from public.push_delivery d
      join public.push_subscription s on s.id = d.subscription_id where s.endpoint = '${slow.endpoint}'`));
    const cut = await waitUntil(() => slowRow().some((row) => row.status === 'pending' && row.attempts === 1), 20_000);
    check('답하지 않는 서버는 전체 시한(10초)에 끊기고 다시 보내기가 된다', cut, JSON.stringify(slowRow()));
    check('끊긴 것은 시한 뒤다 — 머리를 기다리다 끊는다', Date.now() - started >= 9000, `${Date.now() - started}ms`);
  }
} finally {
  stop();
  fake.stop();
  setLocalPushExtraHosts(null);
}

finish();
