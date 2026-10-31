// 가짜 Supabase + 앱용 문 — 운영을 밟지 않고 네이티브 화면을 데이터가 찬 채로 잰다.
// 사람 · 값은 모두 지어낸 것이다. 띄우는 차례는 `docs/agents/delegation/local-env.md` 「앱을 네이티브로 재기」.
// `node mobile/scripts/measure/fake-server.mjs` — 포트는 `FAKE_PORT`(기본 18999), 요청 기록은 `MEASURE_DIR/fake.log`.
// 상태 바꾸기: `curl 'localhost:18999/__set?m=<reset|empty|unsigned|closed|suspended|warning|no-credits|no-self>'`
import { Buffer } from 'node:buffer';
import http from 'node:http';
import zlib from 'node:zlib';
import fs from 'node:fs';
import os from 'node:os';
import nodePath from 'node:path';
import { createRequire } from 'node:module';
import process from 'node:process';

const OUT = process.env.MEASURE_DIR ?? nodePath.join(os.tmpdir(), 'saju-measure');
fs.mkdirSync(OUT, { recursive: true });
const LOG = nodePath.join(OUT, 'fake.log');
const PORT = Number(process.env.FAKE_PORT ?? 18999);
const log = (line) => fs.appendFileSync(LOG, `${new Date().toISOString().slice(11, 19)} ${line}\n`);

const ME = '11111111-1111-4111-8111-111111111111';
const SELF = 'aaaaaaaa-0000-4000-8000-000000000001';
const P1 = 'aaaaaaaa-0000-4000-8000-000000000002';
const P2 = 'aaaaaaaa-0000-4000-8000-000000000003';
const U1 = '22222222-2222-4222-8222-222222222221';
const U2 = '22222222-2222-4222-8222-222222222222';
const U3 = '22222222-2222-4222-8222-222222222223';
const U4 = '22222222-2222-4222-8222-222222222224';
const M1 = 'bbbbbbbb-0000-4000-8000-000000000001';
const M2 = 'bbbbbbbb-0000-4000-8000-000000000002';
const M3 = 'bbbbbbbb-0000-4000-8000-000000000003';
const R1 = 'cccccccc-0000-4000-8000-000000000001';
const R2 = 'cccccccc-0000-4000-8000-000000000002';
const R3 = 'cccccccc-0000-4000-8000-000000000003';

const ago = (min) => new Date(Date.now() - min * 60000).toISOString();
const LONG = '처음 만나도 오래 안 사이처럼 편안한 사람을 찾고 있어요. 주말에는 동네 책방과 산책로를 오래 걷는 편이고, 맛있는 커피 한 잔이면 하루가 풀립니다.';

const output = (name) => `## 한눈에 보는 ${name}

겉으로는 잔잔해도 **한번 정한 길은 오래 걷는** 사람입니다. 사주 여덟 글자에서 나무 기운이 두텁게 받치고 있어, 서두르기보다 뿌리를 먼저 내리는 쪽을 택합니다.

## 일과 재물

- 혼자 깊이 파고드는 일에서 힘이 납니다
- 눈앞의 이익보다 *쌓이는 것*을 고릅니다
- 아주아주아주아주아주아주아주아주아주아주아주아주아주아주아주아주긴띄어쓰기없는한줄이어도넘치지않아야합니다

## 사람과 인연

처음에는 거리를 두지만, 마음을 연 사람에게는 끝까지 곁을 내어 줍니다. 말보다 행동으로 챙기는 편이라 상대가 알아채기까지 시간이 걸립니다.

> 올해는 새 사람보다 곁에 있던 사람을 다시 보는 해입니다.

## 올해의 흐름

상반기에는 준비, 하반기에는 움직임입니다. 큰 결정은 가을 뒤로 미루는 편이 좋습니다.
`;

const chart = { year: { stem: '庚', branch: '午' }, month: { stem: '戊', branch: '寅' }, day: { stem: '甲', branch: '子' }, hour: { stem: '丙', branch: '寅' }, dayMaster: '甲' };
const chart2 = { year: { stem: '壬', branch: '申' }, month: { stem: '癸', branch: '卯' }, day: { stem: '丁', branch: '巳' }, hour: null, dayMaster: '丁' };

const person = (id, date, time, gender) => ({ id, calendar: 'solar', original_date: date, solar_date: date, birth_time: time, gender, city: '서울', late_night_rule: 'jo', time_basis: 'record' });

const fresh = () => ({
  account: { user_id: ME, status: 'active', self_person_id: SELF, nickname: '달빛산책', intro: LONG, signed_up_at: ago(90000), notice_version: 'notice-v12', notice_schedule_id: 1, improvement_consent: true, contact_consent: false, marketing_consent: false, created_at: ago(90000), first_seen_at: ago(90000), notice_ack_at: ago(50000), last_active_at: ago(1), birth_year: 1990, gender: 'female' },
  schedule: [{ schedule_id: 1, ends_on: '2027-06-30', purge_by: '2027-07-30', purge_within_days: 30, operator_name: '가짜 운영자', operator_officer: '가짜 책임자', operator_contact: 'fake@example.invalid' }],
  edges: [
    { person_id: SELF, local_label: '윤하늘', note: null, listed: false, created_at: ago(90000) },
    { person_id: P1, local_label: '엄마', note: '양력 생일로 적었어요. 음력 생일은 따로 챙기기.', listed: true, created_at: ago(80000) },
    { person_id: P2, local_label: '아주아주긴이름의오랜친구입니다', note: null, listed: true, created_at: ago(70000) },
  ],
  persons: [person(SELF, '1990-03-15', '07:30:00', 'female'), person(P1, '1962-11-02', '13:10:00', 'female'), person(P2, '1991-07-21', null, 'male')],
  readings: [
    { kind: 'self', person_a: SELF, person_b: null, label_a: '윤하늘', label_b: null, match_id: null, metaphor: '바람을 등에 지고 천천히 뿌리내리는 나무', score: null, created_at: ago(3000), from_current_chart: true, day_master_a: '甲', day_master_b: null },
    { kind: 'person', person_a: P1, person_b: null, label_a: '엄마', label_b: null, match_id: null, metaphor: '겨울을 건너 먼저 꽃을 피우는 매화', score: null, created_at: ago(2000), from_current_chart: false, day_master_a: '乙', day_master_b: null },
    { kind: 'private', person_a: SELF, person_b: P1, label_a: '윤하늘', label_b: '엄마', match_id: null, metaphor: '서로의 그늘이 되어 주는 두 나무', score: 82, created_at: ago(1000), from_current_chart: true, day_master_a: '甲', day_master_b: '乙' },
    { kind: 'match', person_a: null, person_b: null, label_a: '달빛산책', label_b: '바다소년', match_id: M1, metaphor: '불과 물이 함께 끓이는 차 한 잔', score: 74, created_at: ago(500), from_current_chart: true, day_master_a: '甲', day_master_b: '丁' },
  ],
  running: [{ kind: 'person', label_a: '아주아주긴이름의오랜친구입니다', label_b: null, person_a: P2, person_b: null, match_id: null, created_at: ago(1), job_status: 'running', sections_begun: 2, body_written: false }],
  credits: [{ available: 3, credit_limit: 5, requested: 1, reserved: 0, used: 1 }],
  orders: [
    { amount: 9900, bundle_credits: 3, paid_at: ago(20000), provider_order_id: 'ORD-1', refunded_amount: 0, remaining: 2, status: 'paid' },
    { amount: 19900, bundle_credits: 7, paid_at: ago(40000), provider_order_id: 'ORD-2', refunded_amount: 19900, remaining: 0, status: 'refunded' },
  ],
  slots: [{ person_limit: 10, used: 2, remaining: 8 }],
  photos: [{ position: 1, version: 3, focus_x: 0.5, focus_y: 0.3 }, { position: 2, version: 2, focus_x: 0.5, focus_y: 0.5 }, { position: 3, version: 1, focus_x: 0.2, focus_y: 0.8 }],
  board: [
    { seat: 1, candidate_user_id: U1, nickname: '바다소년', intro: LONG, has_photo: true, photo_count: 3, photo_focus: [0.5, 0.3, 0.5, 0.5, 0.2, 0.8], avatar_element: '水', balance_band: 'even', supplied_elements: ['水', '金'], preview_score: 88, activity: 'now', exploration: false },
    { seat: 2, candidate_user_id: U2, nickname: '열두글자닉네임이꽤길어요', intro: null, has_photo: false, photo_count: 0, photo_focus: [], avatar_element: '火', balance_band: 'mixed', supplied_elements: ['火'], preview_score: 61, activity: 'day', exploration: false },
    { seat: 3, candidate_user_id: U3, nickname: '새벽러너', intro: '달리기 좋아해요', has_photo: true, photo_count: 1, photo_focus: [0.5, 0.5], avatar_element: '土', balance_band: 'skewed', supplied_elements: [], preview_score: 40, activity: 'earlier', exploration: true },
  ],
  passed: [{ candidate_user_id: U4, nickname: '지나간사람', intro: '안녕하세요', has_photo: true, photo_count: 1, photo_focus: [0.5, 0.5], avatar_element: '木', balance_band: 'even', supplied_elements: ['木'], preview_score: 70, passed_at: ago(4000) }],
  requests: [
    { request_id: R1, direction: 'received', status: 'pending', counterpart_user_id: U2, counterpart_nickname: '열두글자닉네임이꽤길어요', counterpart_intro: LONG, counterpart_has_photo: true, counterpart_photo_focus: [0.5, 0.5, 0.2, 0.2], balance_band: 'even', supplied_to_me: ['水', '金'], supplied_to_them: ['火'], created_at: ago(60), decided_at: null },
    { request_id: R2, direction: 'sent', status: 'pending', counterpart_user_id: U3, counterpart_nickname: '새벽러너', counterpart_intro: null, counterpart_has_photo: false, counterpart_photo_focus: [], balance_band: 'mixed', supplied_to_me: ['土'], supplied_to_them: ['木'], created_at: ago(300), decided_at: null },
    { request_id: R3, direction: 'sent', status: 'rejected', counterpart_user_id: U4, counterpart_nickname: '지나간사람', counterpart_intro: null, counterpart_has_photo: false, counterpart_photo_focus: [], balance_band: 'skewed', supplied_to_me: [], supplied_to_them: [], created_at: ago(9000), decided_at: ago(8000) },
  ],
  matches: [
    { match_id: M1, partner_user_id: U1, partner_nickname: '바다소년', partner_intro: LONG, partner_has_photo: true, partner_photo_focus: [0.5, 0.3, 0.5, 0.5, 0.2, 0.8], balance_band: 'even', supplied_to_me: ['水', '金'], created_at: ago(5000) },
    { match_id: M2, partner_user_id: U4, partner_nickname: '지나간사람', partner_intro: null, partner_has_photo: false, partner_photo_focus: [], balance_band: 'mixed', supplied_to_me: ['木'], created_at: ago(15000) },
  ],
  rooms: [
    { match_id: M1, partner_user_id: U1, partner_nickname: '바다소년', partner_left: false, opened_at: ago(5000), closed_at: null, closed_reason: null, last_message_at: ago(5), last_message_body: '이번 주말에 시간 괜찮으세요? 아주 길게 적어서 목록의 한 줄을 넘기는 메시지가 어떻게 잘리는지 봅니다. 한 줄 더, 한 줄 더.', unread_count: 2, partner_activity: 'now', partner_has_photo: true, partner_photo_focus: [0.5, 0.3, 0.5, 0.5, 0.2, 0.8] },
    { match_id: M2, partner_user_id: U4, partner_nickname: '지나간사람', partner_left: true, opened_at: ago(15000), closed_at: ago(9000), closed_reason: 'left', last_message_at: ago(9100), last_message_body: '안녕히 계세요', unread_count: 0, partner_activity: null, partner_has_photo: false, partner_photo_focus: [] },
  ],
  messages: {
    [M1]: Array.from({ length: 24 }, (_, i) => {
      const mine = i % 3 === 0;
      return { seq: i + 1, message_id: `dddddddd-0000-4000-8000-${String(i + 1).padStart(12, '0')}`, client_id: `eeeeeeee-0000-4000-8000-${String(i + 1).padStart(12, '0')}`, sender_user_id: mine ? ME : U1, mine, body: i % 7 === 3 ? '아주 긴 메시지입니다. '.repeat(14) : `메시지 ${i + 1} 번째예요`, created_at: ago(2000 - i * 80) };
    }),
    [M2]: [{ seq: 1, message_id: 'dddddddd-0000-4000-8000-1000000000f1', client_id: 'eeeeeeee-0000-4000-8000-1000000000f1', sender_user_id: U4, mine: false, body: '안녕히 계세요', created_at: ago(9100) }],
  },
  notifications: [
    { notification_id: 'ffffffff-0000-4000-8000-000000000001', kind: 'request_received', counterpart_nickname: '열두글자닉네임이꽤길어요', request_id: R1, match_id: null, read_at: null, created_at: ago(60), credit_count: null, credit_reason: null, reading_kind: null, reading_label_a: null, reading_label_b: null, reading_person_a: null, reading_person_b: null },
    { notification_id: 'ffffffff-0000-4000-8000-000000000002', kind: 'request_accepted', counterpart_nickname: '바다소년', request_id: R2, match_id: M1, read_at: null, created_at: ago(500), credit_count: null, credit_reason: null, reading_kind: null, reading_label_a: null, reading_label_b: null, reading_person_a: null, reading_person_b: null },
    { notification_id: 'ffffffff-0000-4000-8000-000000000003', kind: 'request_expired', counterpart_nickname: '지나간사람', request_id: R3, match_id: null, read_at: ago(100), created_at: ago(9000), credit_count: null, credit_reason: null, reading_kind: null, reading_label_a: null, reading_label_b: null, reading_person_a: null, reading_person_b: null },
  ],
  warning: [],
  survey: [],
  block: [],
  discovery: { user_id: ME, prefer_gender: 'male', opted_out_at: null },
});

let db = fresh();
const scopeOf = (id) => {
  const m = db.matches.find((one) => one.match_id === id);
  return m ? [{ match_id: id, created_at: m.created_at, my_chart: chart, partner_chart: chart2, partner_has_photo: m.partner_has_photo, partner_intro: m.partner_intro, partner_nickname: m.partner_nickname, partner_user_id: m.partner_user_id, balance_band: m.balance_band, supplied_to_me: m.supplied_to_me, supplied_to_them: ['火'] }] : [];
};
const readingRow = (a) => {
  const found = db.readings.find((r) => r.kind === a.p_kind && (a.p_kind === 'self' || (a.p_match_id && r.match_id === a.p_match_id) || (a.p_person_a === r.person_a && (a.p_person_b ?? null) === r.person_b) ));
  if (!found) return [];
  return [{ ...found, id: '99999999-0000-4000-8000-000000000001', model: 'fake', my_feedback: null, output: output(found.label_a ?? '나'), score_baseline: 60, score_relation: null, score_version: 'v1', source_run_id: '99999999-0000-4000-8000-000000000002', viewed_at: ago(3), viewer_is_first: true }];
};

const rpc = {
  current_beta_schedule: () => db.schedule,
  my_readings: () => db.readings,
  my_running_readings: () => db.running,
  my_person_slots: () => db.slots,
  my_photos: () => db.photos,
  my_suspension: () => [{ nickname: db.account.nickname, reason: '가짜 사유입니다' }],
  my_warning_notice: () => db.warning,
  unread_chat_count: () => db.rooms.reduce((sum, room) => sum + room.unread_count, 0),
  my_match_requests: () => db.requests,
  my_notifications: () => db.notifications,
  my_reading_credits: () => db.credits,
  my_reading_orders: () => db.orders,
  my_chat_rooms: () => db.rooms,
  my_chat_messages: (a) => (db.messages[a.p_match_id] ?? []).filter((m) => a.p_before_seq === undefined || m.seq < a.p_before_seq).slice(-(a.p_limit ?? 50)).reverse(),
  my_match_scope: (a) => scopeOf(a.p_match_id),
  my_matches: () => db.matches,
  my_discovery_board: () => db.board,
  my_passed_connections: () => db.passed,
  my_reading: readingRow,
  my_last_reading_run: () => [{ status: 'succeeded', created_at: ago(500), failure_code: null, failure_detail: null, job_status: null, sections_begun: 0, body_written: true }],
  pair_relation_of: () => 'family',
  service_survey_context: () => [{ beta_over: false, consented: true, credits_left: 3, read_pair: true, read_solo: true, schedule_id: 1 }],
  my_service_survey: () => db.survey,
  nickname_is_available: () => true,
  touch_activity: () => null,
  mark_chat_read: () => null,
  mark_notifications_read: () => null,
  mark_reading_ready_read: () => null,
  send_chat_message: (a) => {
    const list = (db.messages[a.p_match_id] ??= []);
    const seq = list.length + 1;
    list.push({ seq, message_id: `dddddddd-1111-4000-8000-${String(seq).padStart(12, '0')}`, client_id: a.p_client_id, sender_user_id: ME, mine: true, body: a.p_body, created_at: new Date().toISOString() });
    log(`SEND client_id=${a.p_client_id} body=${a.p_body}`);
    return 'sent';
  },
  block_user: () => null,
  report_user: () => null,
  report_chat_message: () => null,
  acknowledge_warning: () => { db.warning = []; return null; },
  request_match: () => null,
  cancel_match_request: () => 'cancelled',
  restore_passed_connection: () => db.passed,
  shared_reading: (a) => {
    const kind = a.p_token.startsWith('compat') ? 'private' : 'person';
    if (a.p_token.startsWith('self')) return [{ kind: 'self', body: output('윤하늘'), metaphor: '바람을 등에 지고 천천히 뿌리내리는 나무', name_a: '윤하늘', name_b: null, score: null, created_at: ago(3000) }];
    return [{ kind, body: output('공유'), metaphor: '서로의 그늘이 되어 주는 두 나무', name_a: '윤하늘', name_b: kind === 'private' ? '엄마' : null, score: kind === 'private' ? 82 : null, created_at: ago(1000) }];
  },
  save_my_profile: () => null,
  save_service_survey: () => null,
  request_account_deletion: () => null,
  create_managed_person: () => P2,
  add_my_photo: () => null,
  move_my_photo: () => null,
  remove_my_photo: () => null,
  set_my_photo_focus: () => null,
  photo_at: () => [{ content_type: 'image/png', base64: png.toString('base64'), version: 1, object_key: null }],
  open_pair: () => [{ person_a: SELF, person_b: P1 }],
};

const png = (() => {
  const w = 300, h = 400;
  const raw = Buffer.alloc((w * 3 + 1) * h);
  for (let y = 0; y < h; y++) {
    const at = y * (w * 3 + 1);
    for (let x = 0; x < w; x++) {
      raw[at + 1 + x * 3] = 120 + (x * 100) / w;
      raw[at + 2 + x * 3] = 90 + (y * 120) / h;
      raw[at + 3 + x * 3] = 160 - (y * 80) / h;
    }
  }
  const crcT = Array.from({ length: 256 }, (_, n) => { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; return c >>> 0; });
  const crc = (b) => { let c = 0xffffffff; for (const v of b) c = crcT[(c ^ v) & 255] ^ (c >>> 8); return (c ^ 0xffffffff) >>> 0; };
  const chunk = (t, d) => { const l = Buffer.alloc(4); l.writeUInt32BE(d.length); const td = Buffer.concat([Buffer.from(t), d]); const c = Buffer.alloc(4); c.writeUInt32BE(crc(td)); return Buffer.concat([l, td, c]); };
  const ih = Buffer.alloc(13); ih.writeUInt32BE(w, 0); ih.writeUInt32BE(h, 4); ih[8] = 8; ih[9] = 2;
  return Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk('IHDR', ih), chunk('IDAT', zlib.deflateSync(raw)), chunk('IEND', Buffer.alloc(0))]);
})();

const jwt = () => {
  const b = (o) => Buffer.from(JSON.stringify(o)).toString('base64url');
  return `${b({ alg: 'HS256', typ: 'JWT' })}.${b({ sub: ME, role: 'authenticated', aud: 'authenticated', exp: Math.floor(Date.now() / 1000) + 3600 * 24, email: 'fake@example.invalid' })}.fake`;
};
const user = { id: ME, aud: 'authenticated', role: 'authenticated', email: 'fake@example.invalid', app_metadata: { provider: 'google' }, user_metadata: {}, created_at: ago(90000) };
const session = () => ({ access_token: jwt(), refresh_token: 'fake-refresh', token_type: 'bearer', expires_in: 86400, expires_at: Math.floor(Date.now() / 1000) + 86400, user });

const tables = () => ({
  app_user: [db.account],
  person: db.persons,
  user_person_access: db.edges,
  block: db.block,
  discovery_profile: [db.discovery],
  discovery_passed: [],
});
const filter = (rows, query) => {
  let out = rows;
  for (const [key, value] of query) {
    if (['select', 'order', 'limit', 'offset', 'columns', 'on_conflict'].includes(key)) continue;
    if (value.startsWith('eq.')) out = out.filter((row) => String(row[key]) === value.slice(3));
    if (value.startsWith('in.(')) { const set = value.slice(4, -1).split(',').map((s) => s.replace(/"/g, '')); out = out.filter((row) => set.includes(String(row[key]))); }
  }
  return out;
};

const shelf = () => db.readings.length === 0 ? ({ view: 'shelf', hasSelf: true, books: [], making: [] }) : ({
  view: 'shelf', hasSelf: true,
  books: [
    { key: 'self', href: '/me/readings/self', single: true, shelf: 'saju', title: '내 사주풀이', metaphor: db.readings[0].metaphor, date: '2026년 10월 29일', score: null, stale: false, subjects: [{ stem: '甲', element: '木' }], names: ['윤하늘'] },
    { key: 'p1', href: `/me/readings/${P1}`, single: true, shelf: 'saju', title: '엄마 사주풀이', metaphor: db.readings[1].metaphor, date: '2026년 10월 30일', score: null, stale: true, subjects: [{ stem: '乙', element: '木' }], names: ['엄마'] },
    { key: 'pair', href: `/me/compat?a=${SELF}&b=${P1}`, single: false, shelf: 'compat', title: '윤하늘 × 엄마 궁합풀이', metaphor: db.readings[2].metaphor, date: '2026년 10월 30일', score: 82, stale: false, subjects: [{ stem: '甲', element: '木' }, { stem: '乙', element: '木' }], names: ['윤하늘', '엄마'] },
    { key: 'match', href: `/me/match/${M1}`, single: false, shelf: 'match', title: '바다소년 님과의 인연 궁합', metaphor: db.readings[3].metaphor, date: '2026년 10월 31일', score: 74, stale: false, subjects: [{ stem: '甲', element: '木' }, { stem: '丁', element: '火' }], names: ['달빛산책', '바다소년'] },
  ],
  making: [{ href: `/me/readings/${P2}`, name: '아주아주긴이름의오랜친구입니다 사주풀이', shelf: 'saju', names: ['아주아주긴이름의오랜친구입니다'] }],
});
const view = (query) => {
  const kind = query.get('kind');
  const person = query.get('personId') ?? query.get('personA');
  const none = person === P2;
  const row = readingRow({ p_kind: kind, p_person_a: person, p_person_b: query.get('personB') ?? null, p_match_id: query.get('matchId') })[0] ?? (kind === 'self' ? readingRow({ p_kind: 'self' })[0] : null);
  const reading = none || !row ? null : { id: row.id, score: row.score, metaphor: row.metaphor, output: row.output, model: 'fake', viewedAt: row.viewed_at, createdAt: row.created_at, viewerIsFirst: true, fromCurrentChart: row.from_current_chart, sourceRunId: row.source_run_id, myFeedback: null, scoreScale: { baseline: 60, version: 'v1', relation: null }, dayMasterA: row.day_master_a, dayMasterB: row.day_master_b };
  return { view: 'reading', reading, createdLabel: reading ? '2026년 10월 29일' : null, minutes: reading ? 4 : null, run: null, credits: { limit: 5, used: 1, reserved: 0, requested: 1, available: 3 }, outline: ['한눈에 보는 나', '일과 재물', '사람과 인연', '올해의 흐름'], waitNote: '보통 2분 안에 끝나요.', subject: kind === 'self' || kind === 'person' || person ? { name: '윤하늘', title: '윤하늘님의 사주풀이', dayMaster: { stem: '甲', element: '木' } } : null };
};

function send(res, code, body, headers = {}) {
  res.writeHead(code, { 'content-type': 'application/json', ...headers });
  res.end(body === undefined ? '' : JSON.stringify(body));
}

const server = http.createServer((req, res) => {
  const url = new URL(req.url, 'http://x');
  const chunks = [];
  req.on('data', (c) => chunks.push(c));
  req.on('end', () => {
    const text = Buffer.concat(chunks).toString();
    const body = text ? (() => { try { return JSON.parse(text); } catch { return {}; } })() : {};
    const path = url.pathname;

    if (path === '/__set') {
      const mode = url.searchParams.get('m');
      if (mode === 'reset') db = fresh();
      if (mode === 'empty') Object.assign(db, { edges: [db.edges[0]], readings: [], running: [], requests: [], matches: [], rooms: [], notifications: [], board: [], passed: [], orders: [] });
      if (mode === 'unsigned') db.account.signed_up_at = null;
      if (mode === 'closed') { db.schedule[0].ends_on = '2020-01-01'; db.schedule[0].purge_by = '2030-01-01'; }
      if (mode === 'suspended') db.account.status = 'suspended';
      if (mode === 'warning') db.warning = [{ category: 'harassment', warned_on: '2026-10-30', note: '가짜 경고' }];
      if (mode === 'no-credits') db.credits[0].available = 0;
      if (mode === 'no-self') db.account.self_person_id = null;
      log(`SET ${mode}`);
      return send(res, 200, { ok: true });
    }

    if (path.startsWith('/api/mobile/photo/')) {
      res.writeHead(200, { 'content-type': 'image/png' });
      return res.end(png);
    }
    log(`${req.method} ${path}${url.search.length > 110 ? url.search.slice(0, 110) + '…' : url.search} ${text.slice(0, 120)}`);

    if (path === '/auth/v1/user') return send(res, 200, user);
    if (path === '/auth/v1/token') return send(res, 200, session());
    if (path === '/auth/v1/logout') return send(res, 204);
    if (path === '/__session') return send(res, 200, session());

    if (path === '/api/mobile/readings') return send(res, 200, shelf());
    if (path === '/api/mobile/reading/run') return send(res, 200, { run: null });
    if (path === '/api/mobile/reading' && req.method === 'GET') return send(res, 200, view(url.searchParams));
    if (path === '/api/mobile/reading') return send(res, 200, { ok: true, started: true });
    if (path === '/api/mobile/matching/respond') {
      if (body.accept) {
        const r = db.requests.find((one) => one.request_id === (body.requestId ?? R1));
        if (r) r.status = 'accepted';
        const id = M3;
        if (!db.matches.some((m) => m.match_id === id)) {
          db.matches.unshift({ match_id: id, partner_user_id: U2, partner_nickname: '열두글자닉네임이꽤길어요', partner_intro: LONG, partner_has_photo: true, partner_photo_focus: [0.5, 0.5, 0.2, 0.2], balance_band: 'even', supplied_to_me: ['水', '金'], created_at: ago(0) });
          db.rooms.unshift({ match_id: id, partner_user_id: U2, partner_nickname: '열두글자닉네임이꽤길어요', partner_left: false, opened_at: ago(0), closed_at: null, closed_reason: null, last_message_at: null, last_message_body: null, unread_count: 0, partner_activity: 'now', partner_has_photo: true, partner_photo_focus: [0.5, 0.5, 0.2, 0.2] });
          db.messages[id] = [];
        }
        return send(res, 200, { ok: true, status: 'accepted', matchId: id });
      }
      return send(res, 200, { ok: true, status: 'rejected' });
    }
    if (path.startsWith('/api/mobile/')) return send(res, 200, { ok: true });

    if (path.startsWith('/rest/v1/rpc/')) {
      const name = path.slice('/rest/v1/rpc/'.length);
      const args = req.method === 'GET' ? Object.fromEntries(url.searchParams) : body;
      const run = rpc[name];
      if (!run) { log(`!! 없는 rpc ${name}`); return send(res, 200, []); }
      return send(res, 200, run(args) ?? null);
    }
    if (path.startsWith('/rest/v1/')) {
      const name = path.slice('/rest/v1/'.length);
      const all = tables()[name];
      if (!all) { log(`!! 없는 표 ${name}`); return send(res, 200, []); }
      if (req.method !== 'GET') return send(res, 200, []);
      const rows = filter(all, url.searchParams);
      const object = (req.headers.accept ?? '').includes('pgrst.object');
      return send(res, 200, object ? (rows[0] ?? null) : rows);
    }
    log(`!! 모름 ${path}`);
    send(res, 404, { message: 'fake: not found' });
  });
});

/* 실시간 — 접속만 받아 join 에 답한다 */
const require = createRequire(new URL('../../package.json', import.meta.url));
try {
  const WebSocketServer = require('ws').WebSocketServer ?? require('ws').Server;
  const wss = new WebSocketServer({ noServer: true });
  server.on('upgrade', (req, socket, head) => wss.handleUpgrade(req, socket, head, (ws) => {
    ws.on('message', (raw) => {
      try {
        const m = JSON.parse(raw.toString());
        const arr = Array.isArray(m);
        const [jr, ref, topic, event] = arr ? m : [m.join_ref, m.ref, m.topic, m.event];
        const reply = { status: 'ok', response: event === 'phx_join' ? { postgres_changes: [] } : {} };
        ws.send(JSON.stringify(arr ? [jr, ref, topic, 'phx_reply', reply] : { join_ref: jr, ref, topic, event: 'phx_reply', payload: reply }));
      } catch { /* 모름 */ }
    });
  }));
} catch (thrown) {
  log(`ws 없음 ${thrown.message}`);
}

server.listen(PORT, '0.0.0.0', () => log(`listening ${PORT}`));
