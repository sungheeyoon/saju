/**
 * 앱(`mobile/`)의 읽기 · 쓰기를 **실제 스택에 대고** 돌린다 — 모델만 빼고.
 *
 * 앱 화면은 가짜 서버로 재어 왔다(`mobile/scripts/measure/`). 그 길은 그림을 재지 권한을 못 잰다. 여기서는 앱과 같은 자격 —
 * anon 키로 로그인한 `authenticated` 세션과 그 토큰(Bearer)으로 `mobile/src/**` 가 부르는 표 · 함수와 `/api/mobile/**` 를 두드린다.
 *
 * 1. **앱이 부르는 함수 · 표가 그 세션에 열려 있는가** — 권한 거절 · 없는 칸 · 앱이 읽는 칸의 모양. `MOBILE_RPCS` 는 소스와 견준다
 * 2. **남의 행이 안 보이는가**
 * 3. **미가입 · 정지 · 탈퇴 신청 · 베타 종료에서 무엇이 되는가**
 * 4. **앱의 문** — 토큰 없음 · 낡음 · 남의 id, 모델 없이 시도가 어디까지 가는가
 * 5. **흐름 하나** — 가입 → 저장 → 수정 → 참여 끔 → 다시 켬 → 앱을 껐다 켠 세션으로 복귀
 *
 * 모델은 안 부른다 — 열쇠를 비우고 주소도 닫힌 포트로 돌린다. 저장소(S3)는 로컬에 없어 재지 않는다.
 */
import { createClient } from '@supabase/supabase-js';
import { execFileSync } from 'node:child_process';
import { createHmac, randomUUID } from 'node:crypto';
import { readFileSync, readdirSync, statSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

import { startCheckServer } from './next-server.mjs';
import { passNotice, seedSignupCode, scheduleBeta, chartArgs, NOTICE_VERSION, CHECK_CODE } from './notice.mjs';
import { createChecks, sql } from './checks.mjs';
import { worktreeStack } from '../src/lib/local-env.ts';

const status = JSON.parse(execFileSync('npx', ['supabase', 'status', '-o', 'json'], { encoding: 'utf8' }));
const API = status.API_URL;
const PORT = Number(process.env.CHECK_PORT ?? worktreeStack().checkPort + 9);

const { check, finish } = createChecks('check-mobile');

/** 표로 남기는 값 — `CHECK_MOBILE_DUMP` 를 주면 파일로 쓴다. 판정이 아니다 */
const measured = [];
const note = (call, who, actual) => {
  measured.push({ call, who, actual });
  console.log(`  ·  ${who} | ${call} | ${actual}`);
};

const stamp = Date.now();
const tag = String(stamp).slice(-4);
const password = `pw-${stamp}-Aa1!`;

/** 앱의 클라이언트와 같은 모양 — 저장소만 메모리다. 넘겨받으면 「앱을 다시 켠」 것이다 */
const memoryStorage = () => {
  const items = new Map();
  return {
    items,
    getItem: async (key) => items.get(key) ?? null,
    setItem: async (key, value) => void items.set(key, value),
    removeItem: async (key) => void items.delete(key),
  };
};
const appClient = (storage = memoryStorage()) =>
  createClient(API, status.PUBLISHABLE_KEY ?? status.ANON_KEY, {
    auth: { storage, persistSession: true, autoRefreshToken: false, detectSessionInUrl: false },
  });
const anon = () => createClient(API, status.ANON_KEY, { auth: { persistSession: false, autoRefreshToken: false } });

const newAccount = async (label) => {
  const storage = memoryStorage();
  const client = appClient(storage);
  const email = `mobile-${label}-${stamp}@example.com`;
  const { data, error } = await client.auth.signUp({ email, password });
  if (error) throw new Error(`${label} 계정 — ${error.message}`);
  return { client, storage, email, id: data.user.id, label };
};
const tokenOf = async (who) => (await who.client.auth.getSession()).data.session.access_token;

const QUERY = (date, gender, name = '') =>
  new URLSearchParams({ ...(name ? { name } : {}), date, hour: '14:30', gender, city: '서울', rule: 'jo', basis: 'localMean', saeun: '2026' }).toString();

const PNG =
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==';

/** 칸이 있는가 — 빈 줄은 안 잰다. 앱이 그 줄에서 읽는 이름만 적는다 */
const hasColumns = (row, names) => names.filter((name) => !(name in row));

/** 앱이 부르는 함수 전부 — 아래 표가 빠뜨리면 소스와 견주는 첫 줄이 붉다 */
const MOBILE_RPCS = [
  'acknowledge_warning', 'add_my_photo', 'block_user', 'cancel_match_request', 'complete_signup', 'create_managed_person',
  'create_pair_for_reading', 'current_beta_schedule', 'leave_reading_feedback', 'mark_chat_read', 'mark_notifications_read',
  'mark_reading_ready_read', 'move_my_photo', 'my_chat_messages', 'my_chat_rooms', 'my_discovery_board', 'my_last_reading_run',
  'my_match_requests', 'my_match_scope', 'my_matches', 'my_notifications', 'my_passed_connections', 'my_person_slots', 'my_photos',
  'my_reading', 'my_reading_credits', 'my_reading_orders', 'my_readings', 'my_running_readings', 'my_service_survey', 'my_suspension',
  'my_warning_notice', 'nickname_is_available', 'pair_relation_of', 'photo_at', 'remove_my_photo', 'replace_my_photo',
  'report_chat_message', 'report_user', 'request_account_deletion', 'request_match', 'restore_passed_connection', 'save_my_profile',
  'save_service_survey', 'send_chat_message', 'service_survey_context', 'set_contact_consent', 'set_improvement_consent',
  'set_my_photo_focus', 'set_pair_relation', 'share_my_reading', 'shared_reading', 'touch_activity', 'unread_chat_count',
];
const MOBILE_TABLES = ['app_user', 'block', 'discovery_passed', 'discovery_profile', 'person', 'user_person_access'];

const sourcesUnder = (dir) =>
  readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) return sourcesUnder(path);
    return /\.tsx?$/.test(name) ? [readFileSync(path, 'utf8')] : [];
  });

{
  const source = sourcesUnder(new URL('../mobile/src', import.meta.url).pathname).join('\n');
  /* 문 이름은 `rpc('…')` · 여러 줄의 `rpc(\n 'name'` · 갈래 식(`key === … ? 'a' : 'b'`) 셋으로 온다 */
  const named = new Set();
  for (const found of source.matchAll(/\.rpc\(\s*([^,)]*)/g)) {
    for (const literal of found[1].matchAll(/'([a-z_]+)'/g)) {
      if (!['improvement'].includes(literal[1])) named.add(literal[1]);
    }
  }
  const tables = new Set([...source.matchAll(/\.from\(\s*'([a-z_]+)'/g)].map((found) => found[1]));
  const missing = [...named].filter((name) => !MOBILE_RPCS.includes(name));
  const stale = MOBILE_RPCS.filter((name) => !named.has(name));
  check('앱이 부르는 함수를 이 검사가 전부 든다', missing.length === 0 && stale.length === 0, `없음 ${missing} · 낡음 ${stale}`);
  check('앱이 읽는 표를 이 검사가 전부 든다', [...tables].every((name) => MOBILE_TABLES.includes(name)), [...tables].join(','));
  const grants = sql(`select string_agg(p.proname, ',') from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.proname = any(array[${MOBILE_RPCS.map((one) => `'${one}'`).join(',')}])
      and has_function_privilege('authenticated', p.oid, 'execute')`).split(',');
  check('앱이 부르는 함수는 전부 authenticated 에 열려 있다', MOBILE_RPCS.every((name) => grants.includes(name)),
    MOBILE_RPCS.filter((name) => !grants.includes(name)).join(','));
}

/** 앱 코드의 select 그대로 — 없는 칸이면 PostgREST 가 42703 으로 답한다 */
const ACCOUNT_COLUMNS = 'status, self_person_id, nickname, intro, signed_up_at, notice_version, notice_schedule_id, improvement_consent';
const PERSON_COLUMNS = 'id, calendar, original_date, solar_date, birth_time, gender, city, late_night_rule, time_basis';
const EDGE_COLUMNS = 'person_id, local_label, note, listed';

const accountRead = (who) => who.client.from('app_user').select(ACCOUNT_COLUMNS).maybeSingle();

/** 인자 없이 또는 제 값만으로 부르는 읽기 — 상태마다 돌린다 */
const statelessReads = (client) => ({
  current_beta_schedule: () => client.rpc('current_beta_schedule'),
  my_chat_rooms: () => client.rpc('my_chat_rooms'),
  my_discovery_board: () => client.rpc('my_discovery_board'),
  my_match_requests: () => client.rpc('my_match_requests'),
  my_matches: () => client.rpc('my_matches'),
  my_notifications: () => client.rpc('my_notifications'),
  my_passed_connections: () => client.rpc('my_passed_connections'),
  my_person_slots: () => client.rpc('my_person_slots'),
  my_photos: () => client.rpc('my_photos'),
  my_reading_credits: () => client.rpc('my_reading_credits'),
  my_reading_orders: () => client.rpc('my_reading_orders'),
  my_readings: () => client.rpc('my_readings'),
  my_running_readings: () => client.rpc('my_running_readings'),
  my_service_survey: () => client.rpc('my_service_survey'),
  my_suspension: () => client.rpc('my_suspension'),
  my_warning_notice: () => client.rpc('my_warning_notice'),
  service_survey_context: () => client.rpc('service_survey_context'),
  touch_activity: () => client.rpc('touch_activity'),
  unread_chat_count: () => client.rpc('unread_chat_count'),
  'app_user.select': () => client.from('app_user').select(ACCOUNT_COLUMNS).maybeSingle(),
  'user_person_access.select': () => client.from('user_person_access').select(EDGE_COLUMNS).order('created_at', { ascending: true }),
  'person.select': () => client.from('person').select(PERSON_COLUMNS),
  'discovery_profile.select': () => client.from('discovery_profile').select('prefer_gender, opted_out_at').maybeSingle(),
  'block.select': () => client.from('block').select('blocked_user_id'),
});

const shapeOf = ({ data, error }) => {
  if (error) return `거절 ${error.code ?? error.status}: ${String(error.message).slice(0, 60)}`;
  if (Array.isArray(data)) return `${data.length}줄`;
  if (data === null) return 'null';
  return typeof data === 'object' ? '한 줄' : String(data);
};

/** 상태 하나의 모든 읽기를 돌려 값을 낸다 — 거절이 난 이름도 함께 */
const readAll = async (client, who) => {
  const refused = [];
  for (const [name, read] of Object.entries(statelessReads(client))) {
    const answer = await read();
    note(name, who, shapeOf(answer));
    if (answer.error) refused.push(name);
  }
  return refused;
};

const { base: BASE, stop } = await startCheckServer({
  port: PORT,
  supabaseUrl: API,
  anonKey: status.ANON_KEY,
  secretKey: status.SERVICE_ROLE_KEY,
  /* 모델은 안 부른다 — 열쇠를 비우고, 혹시 불러도 닫힌 포트다 */
  whileRunning: { OPENAI_API_KEY: '', OPENAI_BASE_URL: 'http://127.0.0.1:9/v1' },
});

/** 앱의 `door` 와 같다 — 토큰을 머리에 싣는다. `token` 이 `null` 이면 머리가 없다 */
const door = async (path, { token, method = 'GET', json, form } = {}) => {
  const response = await fetch(`${BASE}${path}`, {
    method,
    headers: {
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(json === undefined ? {} : { 'Content-Type': 'application/json' }),
    },
    body: json !== undefined ? JSON.stringify(json) : form,
  });
  const text = await response.text();
  let body = null;
  try {
    body = JSON.parse(text);
  } catch {
    /* 사진 바이트 · 빈 본문 */
  }
  return { status: response.status, body, type: response.headers.get('content-type') };
};
const said = (answer) => `${answer.status} ${JSON.stringify(answer.body)?.slice(0, 110) ?? ''}`;

const readingQuery = (target) => new URLSearchParams(target).toString();

/** 저장은 앱의 문으로 — 앱과 같이 입력 글자만 보낸다 */
const saveSelf = (token, date, gender) => door('/api/mobile/me/self-person', { token, method: 'POST', json: { query: QUERY(date, gender, '나') } });

const expiredToken = (sub) => {
  const encode = (value) => Buffer.from(JSON.stringify(value)).toString('base64url');
  const head = encode({ alg: 'HS256', typ: 'JWT' });
  const claims = encode({ sub, role: 'authenticated', aud: 'authenticated', exp: Math.floor(Date.now() / 1000) - 3600, iat: Math.floor(Date.now() / 1000) - 7200 });
  return `${head}.${claims}.${createHmac('sha256', status.JWT_SECRET).update(`${head}.${claims}`).digest('base64url')}`;
};

try {
  scheduleBeta();
  seedSignupCode(CHECK_CODE, 500);

  /* ---------- 흐름: 가입 → 저장 → 수정 → 참여 끔 → 다시 켬 → 복귀 ---------- */
  const a = await newAccount('a');
  const beforeSignup = await accountRead(a);
  check('막 로그인한 사람의 계정 줄이 읽힌다 — 앱이 가입 화면을 고르는 값', beforeSignup.error === null && beforeSignup.data?.signed_up_at === null, shapeOf(beforeSignup));

  const available = await a.client.rpc('nickname_is_available', { p_nickname: `벗${tag}` });
  check('이름이 비었는지 묻는다', available.data === true, shapeOf(available));
  const schedule = await a.client.rpc('current_beta_schedule');
  check('일정을 읽는다 — 앱이 읽는 칸이 다 있다',
    schedule.error === null && hasColumns(schedule.data[0], ['schedule_id', 'ends_on', 'purge_by', 'purge_within_days', 'operator_name', 'operator_officer', 'operator_contact']).length === 0,
    shapeOf(schedule));

  const wrongCode = await a.client.rpc('complete_signup', { p_code: 'NOPE', p_nickname: `벗${tag}`, p_version: NOTICE_VERSION, p_schedule_id: schedule.data[0].schedule_id, p_improvement: false, p_contact: false });
  check('틀린 코드는 거절이 아니라 false — 앱이 그 값으로 칸을 가른다', wrongCode.error === null && wrongCode.data === false, shapeOf(wrongCode));
  const signup = await a.client.rpc('complete_signup', { p_code: CHECK_CODE, p_nickname: `벗${tag}`, p_version: NOTICE_VERSION, p_schedule_id: schedule.data[0].schedule_id, p_improvement: true, p_contact: false });
  check('가입을 마친다', signup.error === null && signup.data !== false, shapeOf(signup));

  const aToken = await tokenOf(a);
  const saved = await saveSelf(aToken, '1990-05-15', 'male');
  check('내 사주 저장 — 문이 ok 를 답한다', saved.status === 200 && saved.body?.ok === true, said(saved));
  const account = await accountRead(a);
  const selfId = account.data?.self_person_id;
  check('저장한 사주가 계정에 선다', typeof selfId === 'string');
  const stored = sql(`select p.solar_date || '|' || p.gender || '|' || (p.current_chart is not null) from public.person p where p.id = '${selfId}'`);
  check('여덟 글자는 서버가 지어 넣는다', stored === '1990-05-15|male|true', stored);
  const again = await saveSelf(aToken, '1990-05-15', 'male');
  check('다시 저장해도 된다 — 이미 있으면 됐다고 답한다', again.status === 200 && again.body?.ok === true, said(again));

  const mine = await a.client.from('person').select(PERSON_COLUMNS).in('id', [selfId]);
  check('앱의 입력 칸 여덟이 읽힌다', mine.error === null && mine.data?.length === 1 && hasColumns(mine.data[0], ['calendar', 'original_date', 'solar_date', 'birth_time', 'gender', 'city', 'late_night_rule', 'time_basis']).length === 0, shapeOf(mine));

  const edited = await door('/api/mobile/me/person-input', { token: aToken, method: 'POST', json: { personId: selfId, query: QUERY('1990-05-16', 'male', '나') } });
  check('입력 수정', edited.status === 200 && edited.body?.ok === true, said(edited));
  check('고친 날짜가 표에 있다', sql(`select solar_date from public.person where id = '${selfId}'`) === '1990-05-16');

  const opened = await door('/api/mobile/me/participation', { token: aToken, method: 'PUT' });
  check('홈이 열리며 참여를 연다', opened.status === 200 && opened.body?.ok === true, said(opened));
  const off = await door('/api/mobile/me/participation', { token: aToken, method: 'POST', json: { on: false } });
  check('참여를 끈다', off.status === 200 && off.body?.ok === true, said(off));
  const rested = await a.client.from('discovery_profile').select('prefer_gender, opted_out_at').maybeSingle();
  check('끈 값이 앱의 읽기에 보인다', rested.data?.opted_out_at != null, shapeOf(rested));
  const stayOff = await door('/api/mobile/me/participation', { token: aToken, method: 'PUT' });
  const stillRested = await a.client.from('discovery_profile').select('opted_out_at').maybeSingle();
  check('끈 사람은 홈이 열려도 안 열린다', stayOff.body?.ok === true && stillRested.data?.opted_out_at != null, said(stayOff));
  const on = await door('/api/mobile/me/participation', { token: aToken, method: 'POST', json: { on: true } });
  const back = await a.client.from('discovery_profile').select('opted_out_at').maybeSingle();
  check('다시 켠다', on.body?.ok === true && back.data?.opted_out_at == null, said(on));
  const badOn = await door('/api/mobile/me/participation', { token: aToken, method: 'POST', json: { on: 'yes' } });
  check('켜고 끄는 값이 불이 아니면 400', badOn.status === 400, said(badOn));

  /* 앱을 껐다 켰다 — 같은 저장소의 새 클라이언트 */
  const reopened = appClient(a.storage);
  const resumed = await reopened.auth.getSession();
  check('앱을 다시 켜면 세션이 그대로 있다', resumed.data.session?.user.id === a.id);
  const rereadAccount = await reopened.from('app_user').select(ACCOUNT_COLUMNS).maybeSingle();
  check('복귀한 세션으로 계정을 읽는다', rereadAccount.data?.self_person_id === selfId, shapeOf(rereadAccount));
  const refreshed = await reopened.auth.refreshSession();
  check('복귀한 세션을 갱신한다', refreshed.error === null && refreshed.data.session !== null, refreshed.error?.message ?? '');
  const afterRefresh = await door('/api/mobile/readings', { token: refreshed.data.session.access_token });
  check('갱신한 토큰으로 문이 열린다', afterRefresh.status === 200 && afterRefresh.body?.view === 'shelf', said(afterRefresh));
  a.client = reopened;
  const aFresh = refreshed.data.session.access_token;

  /* ---------- 상대 · 낯선 사람 ---------- */
  const b = await newAccount('b');
  await passNotice(b.client, `상대${tag}`);
  const bToken = await tokenOf(b);
  const bSaved = await saveSelf(bToken, '1992-03-03', 'female');
  check('둘째 사람도 문으로 저장한다', bSaved.body?.ok === true, said(bSaved));
  await door('/api/mobile/me/participation', { token: bToken, method: 'PUT' });

  const c = await newAccount('c');
  await passNotice(c.client, `남${tag}`);
  const cToken = await tokenOf(c);
  await saveSelf(cToken, '1988-11-20', 'male');
  await door('/api/mobile/me/participation', { token: cToken, method: 'PUT' });

  sql(`update public.discovery_profile set opted_in_at = null, opted_out_at = now()
       where user_id not in ('${a.id}', '${b.id}', '${c.id}')`);
  sql(`delete from public.discovery_candidate where user_id in ('${a.id}', '${b.id}')`);

  /* ---------- 활성 계정의 읽기 전부 ---------- */
  const refusedActive = await readAll(a.client, '활성');
  check('활성 계정에 거절되는 읽기가 없다', refusedActive.length === 0, refusedActive.join(','));

  /* ---------- 저장한 사람 · 궁합 ---------- */
  const momArgs = { p_local_label: '엄마', p_note: '메모', p_calendar: 'solar', p_original_date: '1962-03-02', p_solar_date: '1962-03-02', p_birth_time: '07:10', p_gender: 'female', p_city: '대구', p_late_night_rule: 'jo', p_time_basis: 'localMean', ...chartArgs('mom') };
  const mom = await a.client.rpc('create_managed_person', momArgs);
  check('사람을 저장한다 — 답은 글자 id', mom.error === null && typeof mom.data === 'string', shapeOf(mom));
  const momId = mom.data;
  const noted = await a.client.from('user_person_access').update({ note: '새 메모' }).eq('person_id', momId);
  check('메모를 고친다', noted.error === null, shapeOf(noted));
  const spare = await a.client.rpc('create_managed_person', { ...momArgs, p_local_label: '뺄 사람', ...chartArgs('spare') });
  const dropped = await a.client.from('user_person_access').delete().eq('person_id', spare.data);
  check('목록에서 뺀다', spare.error === null && dropped.error === null && sql(`select count(*) from public.user_person_access where person_id = '${spare.data}'`) === '0', shapeOf(dropped));
  const selfDrop = await a.client.from('user_person_access').delete().eq('person_id', selfId);
  check('나는 목록에서 안 빠진다', selfDrop.error === null && sql(`select count(*) from public.user_person_access where person_id = '${selfId}'`) === '1', shapeOf(selfDrop));
  const slots = await a.client.rpc('my_person_slots');
  check('자리 수의 칸', slots.error === null && hasColumns(slots.data[0], ['person_limit', 'used', 'remaining']).length === 0, shapeOf(slots));

  const blank = (side) => Object.fromEntries(['local_label', 'note', 'calendar', 'original_date', 'solar_date', 'birth_time', 'gender', 'city', 'late_night_rule', 'time_basis', 'chart', 'chart_engine_version'].map((key) => [`p_${side}_${key}`, null]));
  const pair = await a.client.rpc('create_pair_for_reading', { ...blank('a'), ...blank('b'), p_relation: 'family', p_a_person: selfId, p_b_person: momId, p_listed: false });
  check('고른 두 사람으로 쌍을 세운다', pair.error === null && pair.data?.length === 1 && hasColumns(pair.data[0], ['person_a', 'person_b']).length === 0, shapeOf(pair));
  const typedSeat = (side, seed) => Object.fromEntries(Object.entries({ ...momArgs, ...chartArgs(seed), p_local_label: seed, p_note: null }).map(([key, value]) => [key.replace(/^p_/, `p_${side}_`), value]));
  const typedPair = await a.client.rpc('create_pair_for_reading', { ...blank('a'), ...typedSeat('b', '적은 사람'), p_relation: null, p_a_person: selfId, p_b_person: null, p_listed: false });
  check('적어 넣은 사람과 쌍을 세운다 — 한쪽만 적은 인자로 함수가 잡힌다', typedPair.error === null && typedPair.data?.length === 1, shapeOf(typedPair));
  const { person_a: pairA, person_b: pairB } = pair.data?.[0] ?? {};
  const relation = await a.client.rpc('pair_relation_of', { p_person_a: pairA, p_person_b: pairB });
  note('pair_relation_of', '활성', shapeOf(relation));
  const clearRelation = await a.client.rpc('set_pair_relation', { p_person_a: pairA, p_person_b: pairB, p_relation: null });
  check('관계를 비운다', clearRelation.error === null, shapeOf(clearRelation));

  /* ---------- 풀이 — 모델 없이 어디까지 ---------- */
  const selfTarget = { kind: 'self' };
  const viewNone = await door(`/api/mobile/reading?${readingQuery(selfTarget)}`, { token: aFresh });
  check('글이 없을 때 풀이 칸이 선다', viewNone.body?.view === 'reading' && viewNone.body.reading === null, said(viewNone));
  const pressKey = randomUUID();
  const press = await door('/api/mobile/reading', { token: aFresh, method: 'POST', json: { target: selfTarget, requestKey: pressKey } });
  note('POST /api/mobile/reading 모델 없음', '활성', said(press));
  const press2 = await door('/api/mobile/reading', { token: aFresh, method: 'POST', json: { target: selfTarget, requestKey: pressKey } });
  note('POST /api/mobile/reading 같은 열쇠 재전송', '활성', said(press2));
  check('같은 누름의 재전송은 시도를 하나만 연다', sql(`select count(*) from public.reading_run where user_id = '${a.id}' and kind = 'self'`) === '1', sql(`select count(*) from public.reading_run where user_id = '${a.id}'`));
  const noKey = await door('/api/mobile/reading', { token: aFresh, method: 'POST', json: { target: selfTarget } });
  check('누름 열쇠가 없으면 400', noKey.status === 400, said(noKey));
  const badTarget = await door('/api/mobile/reading', { token: aFresh, method: 'POST', json: { target: { kind: 'nope' }, requestKey: randomUUID() } });
  check('대상이 틀리면 400', badTarget.status === 400, said(badTarget));

  let lastRun = null;
  const deadline = Date.now() + 20_000;
  while (Date.now() < deadline) {
    lastRun = await door(`/api/mobile/reading/run?${readingQuery(selfTarget)}`, { token: aFresh });
    if (lastRun.body?.run?.status && lastRun.body.run.status !== 'running') break;
    await new Promise((resolve) => setTimeout(resolve, 500));
  }
  note('GET /api/mobile/reading/run 모델 없음의 끝', '활성', said(lastRun));
  note('reading_run 표', '활성', sql(`select string_agg(status || ':' || coalesce(failure_code, '-'), ',') from public.reading_run where user_id = '${a.id}'`));
  const creditsAfter = await a.client.rpc('my_reading_credits');
  note('my_reading_credits 실패 뒤', '활성', JSON.stringify(creditsAfter.data?.[0]));
  check('풀이권의 칸', hasColumns(creditsAfter.data?.[0] ?? {}, ['credit_limit', 'used', 'reserved', 'requested', 'available']).length === 0);

  /* 모델이 낸 셈 치고 글 하나 — 시작은 그 사람으로, 저장은 열쇠로(서버와 같은 차례) */
  const keyed = createClient(API, status.SERVICE_ROLE_KEY, { auth: { persistSession: false } });
  const started = await a.client.rpc('start_reading_run', { p_kind: 'self', p_idempotency_key: `mobile-${stamp}`, p_person_a: null, p_person_b: null, p_match_id: null, p_model: 'gpt-5.6-luna', p_prompt_version: 'reading-prompt-v1' });
  note('start_reading_run 글을 심으려고', '활성', shapeOf(started));
  const OUTPUT = `## 한 줄로\n${'스스로 정한 규칙 안에서 오래 버티는 사람입니다. '.repeat(20)}\n\n### 근거 (검사용)\n한 줄로 — analysis.strength [유도]`;
  const runId = started.data?.[0]?.run_id;
  const savedReading = await keyed.rpc('save_reading', {
    p_run_id: runId, p_output: OUTPUT, p_score: null, p_metaphor: `비유 ${tag}`, p_evidence: '{"contract":{"version":"evidence-v0"},"charts":{}}',
    p_prompt: '# 역할\n검사용', p_prompt_version: 'reading-prompt-v1', p_model: 'gpt-5.6-luna',
    p_generation: { provider: 'openai-responses-api', settings: { store: false } }, p_viewed_at: new Date().toISOString(),
  });
  check('글을 심는다', savedReading.error === null, shapeOf(savedReading));

  const viewDone = await door(`/api/mobile/reading?${readingQuery(selfTarget)}`, { token: aFresh });
  check('문이 글을 낸다', viewDone.body?.view === 'reading' && viewDone.body.reading !== null, said(viewDone));
  check('문의 답에 근거 절이 없다', !JSON.stringify(viewDone.body).includes('analysis.strength'));
  const shelf = await door('/api/mobile/readings', { token: aFresh });
  check('보관함에 한 권이 선다', shelf.body?.books?.length === 1 && shelf.body.hasSelf === true, said(shelf));
  check('보관함에 본문이 없다', !JSON.stringify(shelf.body).includes('오래 버티는'));
  const direct = await a.client.rpc('my_reading', { p_kind: 'self', p_person_a: null, p_person_b: null, p_match_id: null });
  check('my_reading 의 칸', direct.error === null && hasColumns(direct.data?.[0] ?? {}, ['id', 'kind', 'score', 'metaphor', 'output', 'created_at']).length === 0, shapeOf(direct));
  const lastDirect = await a.client.rpc('my_last_reading_run', { p_kind: 'self', p_person_a: null, p_person_b: null, p_match_id: null });
  check('my_last_reading_run 의 칸', lastDirect.error === null && hasColumns(lastDirect.data?.[0] ?? {}, ['status']).length === 0, shapeOf(lastDirect));
  const readRow = await a.client.rpc('my_readings');
  check('my_readings 의 칸', readRow.error === null && hasColumns(readRow.data?.[0] ?? {}, ['kind', 'person_a', 'person_b', 'match_id', 'label_a', 'label_b', 'score', 'metaphor', 'created_at']).length === 0, shapeOf(readRow));
  const readDone = await a.client.rpc('mark_reading_ready_read', { p_reading_id: direct.data?.[0]?.id });
  check('완성 소식을 읽음으로', readDone.error === null, shapeOf(readDone));

  const feedback = await a.client.rpc('leave_reading_feedback', { p_run_id: runId, p_usefulness: 4, p_perceived_fit: 4, p_felt_length: 'right', p_issue_tags: [], p_comment: null });
  note('leave_reading_feedback', '활성', shapeOf(feedback));
  const share = await a.client.rpc('share_my_reading', { p_body: direct.data?.[0]?.output, p_metaphor: direct.data?.[0]?.metaphor, p_kind: 'self', p_person_a: null, p_person_b: null });
  check('공유 토큰을 받는다', share.error === null && typeof share.data === 'string', shapeOf(share));
  const shared = await anon().rpc('shared_reading', { p_token: share.data });
  check('세션 없는 클라이언트가 공유본을 연다', shared.error === null && shared.data?.length === 1 && hasColumns(shared.data[0], ['kind', 'name_a', 'name_b', 'metaphor', 'score', 'body', 'created_at']).length === 0, shapeOf(shared));
  const sharedNone = await anon().rpc('shared_reading', { p_token: 'nope' });
  check('없는 토큰은 빈 답 — 앱은 gone', sharedNone.error === null && sharedNone.data?.length === 0, shapeOf(sharedNone));

  /* ---------- 사진 ---------- */
  const modeRead = await door('/api/mobile/me/photo', { token: aFresh });
  note('GET /api/mobile/me/photo', '활성', said(modeRead));
  const added = await a.client.rpc('add_my_photo', { p_content_type: 'image/png', p_base64: PNG });
  check('사진을 올린다 — 답은 자리', added.error === null && typeof added.data === 'number', shapeOf(added));
  const photos = await a.client.rpc('my_photos');
  check('내 사진 칸', hasColumns(photos.data?.[0] ?? {}, ['position', 'version', 'focus_x', 'focus_y']).length === 0, shapeOf(photos));
  const photo = photos.data?.[0];
  const atMine = await a.client.rpc('photo_at', { p_user_id: a.id, p_position: 1 });
  check('photo_at 칸', atMine.error === null && hasColumns(atMine.data?.[0] ?? {}, ['content_type', 'base64', 'version']).length === 0, shapeOf(atMine));
  const focused = await a.client.rpc('set_my_photo_focus', { p_position: 1, p_x: 40, p_y: 60, p_version: photo.version });
  check('초점을 고친다', focused.error === null, shapeOf(focused));
  const replaced = await a.client.rpc('replace_my_photo', { p_position: 1, p_version: photo.version, p_content_type: 'image/png', p_base64: PNG });
  check('사진을 바꾼다 — 답은 새 판본', replaced.error === null && replaced.data !== null, shapeOf(replaced));
  const stale = await a.client.rpc('replace_my_photo', { p_position: 1, p_version: photo.version, p_content_type: 'image/png', p_base64: PNG });
  note('replace_my_photo 낡은 판본', '활성', shapeOf(stale));
  const second = await a.client.rpc('add_my_photo', { p_content_type: 'image/png', p_base64: PNG });
  note('add_my_photo 둘째', '활성', shapeOf(second));
  const listed = await a.client.rpc('my_photos');
  const moved = await a.client.rpc('move_my_photo', { p_from: 2, p_to: 1, p_version: listed.data?.find((one) => one.position === 2)?.version });
  check('사진 차례를 옮긴다', moved.error === null, shapeOf(moved));
  const listed2 = await a.client.rpc('my_photos');
  const removed = await a.client.rpc('remove_my_photo', { p_position: 2, p_version: listed2.data?.find((one) => one.position === 2)?.version });
  check('사진을 지운다', removed.error === null, shapeOf(removed));

  const photoOf = (user, query = '?n=1') => `/api/mobile/photo/${user}${query}`;
  const ownPhoto = await door(photoOf(a.id), { token: aFresh });
  check('내 사진을 받는다', ownPhoto.status === 200 && ownPhoto.type?.startsWith('image/'), `${ownPhoto.status} ${ownPhoto.type}`);
  const cardPhoto = await door(photoOf(a.id, '?n=1&s=card'), { token: aFresh });
  note('GET 사진 ?s=card (db 장)', '활성', `${cardPhoto.status} ${cardPhoto.type}`);
  const noPhotoToken = await door(photoOf(a.id));
  check('사진 — 토큰 없으면 404', noPhotoToken.status === 404, String(noPhotoToken.status));
  const garbagePhoto = await door(photoOf(a.id), { token: 'garbage' });
  check('사진 — 깨진 토큰은 404', garbagePhoto.status === 404, String(garbagePhoto.status));
  const strangerPhoto = await door(photoOf(a.id), { token: cToken });
  check('사진 — 인연 없는 사람은 404', strangerPhoto.status === 404, String(strangerPhoto.status));
  const badId = await door('/api/mobile/photo/not-a-uuid', { token: aFresh });
  check('사진 — id 모양이 틀리면 404', badId.status === 404, String(badId.status));
  const badN = await door(photoOf(a.id, '?n=99'), { token: aFresh });
  check('사진 — 없는 자리는 404', badN.status === 404, String(badN.status));

  const form = () => {
    const made = new FormData();
    const bytes = Buffer.from(PNG, 'base64');
    made.append('card', new Blob([bytes], { type: 'image/png' }), 'card');
    made.append('large', new Blob([bytes], { type: 'image/png' }), 'large');
    made.append('focusX', '50');
    made.append('focusY', '50');
    return made;
  };
  const uploadDb = await door('/api/mobile/me/photo', { token: aFresh, method: 'POST', form: form() });
  note('POST /api/mobile/me/photo 저장소 없음', '활성', said(uploadDb));
  check('저장소 없는 배포의 올리기는 정해진 답으로 거절한다', uploadDb.status === 200 && uploadDb.body?.ok === false, said(uploadDb));
  const noForm = await door('/api/mobile/me/photo', { token: aFresh, method: 'POST', json: {} });
  check('폼이 아니면 400', noForm.status === 400, said(noForm));
  const badPut = (() => { const made = form(); made.append('position', 'x'); made.append('version', 'y'); return made; })();
  const putBad = await door('/api/mobile/me/photo', { token: aFresh, method: 'PUT', form: badPut });
  check('바꾸기의 자리 · 판본이 숫자가 아니면 400', putBad.status === 400, said(putBad));
  const huge = new FormData();
  huge.append('card', new Blob([Buffer.alloc(1_200_000)], { type: 'image/png' }), 'card');
  const tooBig = await door('/api/mobile/me/photo', { token: aFresh, method: 'POST', form: huge });
  check('1MB 를 넘는 본문은 413', tooBig.status === 413, said(tooBig));

  /* ---------- 인연: 요청 → 수락 → 궁합 제출 → 방 ---------- */
  await door('/api/mobile/me/participation', { token: aFresh, method: 'PUT' });
  const board = await a.client.rpc('my_discovery_board');
  check('덱에 상대가 선다', board.error === null && (board.data ?? []).some((row) => row.candidate_user_id === b.id), shapeOf(board));
  check('덱 카드의 칸', hasColumns(board.data?.[0] ?? {}, ['candidate_user_id', 'nickname', 'intro', 'has_photo', 'exploration', 'supplied_elements', 'balance_band', 'activity']).length === 0, Object.keys(board.data?.[0] ?? {}).join(','));

  const pass = await a.client.from('discovery_passed').upsert({ user_id: a.id, passed_user_id: b.id, passed_at: new Date().toISOString() }, { onConflict: 'user_id,passed_user_id' });
  check('넘긴다 — upsert 가 정책을 지난다', pass.error === null, shapeOf(pass));
  const passedList = await a.client.rpc('my_passed_connections');
  check('넘긴 인연이 보인다', passedList.data?.some((row) => row.candidate_user_id === b.id), shapeOf(passedList));
  const restored = await a.client.rpc('restore_passed_connection', { p_candidate_user_id: b.id });
  check('되돌리면 앱이 읽는 card 가 온다', restored.error === null && restored.data?.card != null, shapeOf(restored));
  const spoofPass = await c.client.from('discovery_passed').upsert({ user_id: a.id, passed_user_id: b.id, passed_at: new Date().toISOString() }, { onConflict: 'user_id,passed_user_id' });
  check('남의 이름으로 넘기기는 거절된다', spoofPass.error !== null, shapeOf(spoofPass));

  const asked = await a.client.rpc('request_match', { p_candidate_user_id: b.id });
  check('요청을 보낸다', asked.error === null && typeof asked.data === 'string', shapeOf(asked));
  const requestId = asked.data;
  const inbox = await b.client.rpc('my_match_requests');
  check('받은 요청의 칸', inbox.error === null && hasColumns(inbox.data?.find((row) => row.request_id === requestId) ?? {}, ['request_id', 'direction', 'counterpart_user_id', 'counterpart_nickname', 'status']).length === 0, shapeOf(inbox));

  /* 내 요청을 무른다 — 답이 앱의 `REQUEST_STATUSES` 글자인가 */
  await c.client.rpc('my_discovery_board');
  const cAsked = await c.client.rpc('request_match', { p_candidate_user_id: b.id });
  const cCancelled = await c.client.rpc('cancel_match_request', { p_request_id: cAsked.data });
  check('내 요청을 무른다 — 답은 상태 글자', cAsked.error === null && cCancelled.data === 'cancelled', `${shapeOf(cAsked)} ${shapeOf(cCancelled)}`);

  const strangerRespond = await door('/api/mobile/matching/respond', { token: cToken, method: 'POST', json: { requestId, accept: true } });
  check('남의 요청에 답하면 문이 안 받는다', strangerRespond.body?.ok !== true, said(strangerRespond));
  check('남이 답해도 요청은 그대로다', sql(`select status from public.match_request where id = '${requestId}'`) === 'pending');
  const badRespond = await door('/api/mobile/matching/respond', { token: bToken, method: 'POST', json: { requestId: 'x', accept: true } });
  check('요청 id 모양이 틀리면 400', badRespond.status === 400, said(badRespond));
  const accepted = await door('/api/mobile/matching/respond', { token: bToken, method: 'POST', json: { requestId, accept: true } });
  check('수락한다 — matchId 가 온다', accepted.body?.ok === true && accepted.body.status === 'accepted' && typeof accepted.body.matchId === 'string', said(accepted));
  const matchId = accepted.body?.matchId;
  await new Promise((resolve) => setTimeout(resolve, 1500));
  note('수락 뒤 궁합풀이 시도', '수락', sql(`select coalesce(string_agg(status || ':' || coalesce(failure_code, '-'), ','), '없음') from public.reading_run where match_id = '${matchId}'`));

  const scope = await a.client.rpc('my_match_scope', { p_match_id: matchId });
  check('인연 범위의 칸', scope.error === null && hasColumns(scope.data?.[0] ?? {}, ['match_id', 'partner_user_id', 'partner_nickname', 'partner_intro', 'partner_has_photo', 'my_chart', 'partner_chart']).length === 0, shapeOf(scope));
  const scopeStranger = await c.client.rpc('my_match_scope', { p_match_id: matchId });
  check('남의 인연 범위는 비어 있다', scopeStranger.error === null && scopeStranger.data?.length === 0, shapeOf(scopeStranger));
  const matches = await a.client.rpc('my_matches');
  check('my_matches 의 칸', matches.error === null && hasColumns(matches.data?.[0] ?? {}, ['match_id', 'partner_user_id', 'partner_nickname', 'partner_photo_focus']).length === 0, shapeOf(matches));
  const matchView = await door(`/api/mobile/reading?${readingQuery({ kind: 'match', matchId })}`, { token: aFresh });
  check('인연 궁합 칸이 선다', matchView.body?.view === 'reading', said(matchView));
  const matchViewStranger = await door(`/api/mobile/reading?${readingQuery({ kind: 'match', matchId })}`, { token: cToken });
  note('GET 풀이 칸 남의 match', '낯선', said(matchViewStranger));
  check('남의 인연 궁합은 글을 안 낸다', matchViewStranger.body?.reading == null, said(matchViewStranger));
  const partnerPhoto = await door(photoOf(a.id), { token: bToken });
  check('사진 — 인연이 된 상대는 받는다', partnerPhoto.status === 200, String(partnerPhoto.status));

  /* 방 */
  const clientId = randomUUID();
  const sent = await a.client.rpc('send_chat_message', { p_match_id: matchId, p_body: '안녕하세요', p_client_id: clientId });
  check('메시지를 보낸다', sent.error === null, shapeOf(sent));
  note('send_chat_message 답', '활성', String(sent.data));
  const dup = await a.client.rpc('send_chat_message', { p_match_id: matchId, p_body: '안녕하세요', p_client_id: clientId });
  note('send_chat_message 재전송', '활성', shapeOf(dup));
  const messages = await b.client.rpc('my_chat_messages', { p_match_id: matchId, p_limit: 30 });
  check('받는 쪽이 메시지를 읽는다 — 칸', messages.error === null && messages.data?.length === 1 && hasColumns(messages.data[0], ['message_id', 'seq', 'sender_user_id', 'mine', 'body', 'created_at', 'client_id']).length === 0, shapeOf(messages));
  const unread = await b.client.rpc('unread_chat_count');
  check('안 읽은 수는 수다', unread.error === null && Number(unread.data) === 1, shapeOf(unread));
  const rooms = await b.client.rpc('my_chat_rooms');
  check('방 목록의 칸', rooms.error === null && hasColumns(rooms.data?.[0] ?? {}, ['match_id', 'partner_user_id', 'partner_nickname', 'partner_has_photo', 'opened_at', 'closed_reason']).length === 0, shapeOf(rooms));
  const marked = await b.client.rpc('mark_chat_read', { p_match_id: matchId, p_up_to_seq: messages.data?.[0]?.seq });
  check('읽음으로 적는다', marked.error === null, shapeOf(marked));
  const strangerMessages = await c.client.rpc('my_chat_messages', { p_match_id: matchId, p_limit: 30 });
  check('남의 방의 메시지가 안 보인다', (strangerMessages.data ?? []).length === 0, shapeOf(strangerMessages));
  const strangerSend = await c.client.rpc('send_chat_message', { p_match_id: matchId, p_body: '끼어들기', p_client_id: randomUUID() });
  note('send_chat_message 남의 방', '낯선', `${shapeOf(strangerSend)}`);
  check('남의 방에 보낸 글이 안 남는다', sql(`select count(*) from public.chat_message m join public.chat_room r on r.id = m.room_id where r.match_id = '${matchId}' and m.body = '끼어들기'`) === '0');
  const reportMessage = await b.client.rpc('report_chat_message', { p_message_id: messages.data?.[0]?.message_id, p_reason: 'harassment', p_detail: null });
  note('report_chat_message', '수락', shapeOf(reportMessage));

  /* 알림 · 경고 · 신고 · 차단 */
  const news = await a.client.rpc('my_notifications');
  check('알림의 칸', news.error === null && hasColumns(news.data?.[0] ?? {}, ['notification_id', 'kind', 'read_at']).length === 0, shapeOf(news));
  const readNews = await a.client.rpc('mark_notifications_read');
  check('알림을 읽음으로', readNews.error === null, shapeOf(readNews));
  const ack = await a.client.rpc('acknowledge_warning', { p_ref: 'none' });
  note('acknowledge_warning 없는 ref', '활성', shapeOf(ack));
  const reported = await c.client.rpc('report_user', { p_user_id: a.id, p_reason: 'harassment', p_detail: null });
  note('report_user', '낯선', shapeOf(reported));

  /* 프로필 · 설정 · 설문 */
  const profile = await a.client.rpc('save_my_profile', { p_nickname: `벗${tag}`, p_intro: '소개' });
  check('프로필을 저장한다', profile.error === null, shapeOf(profile));
  const surveyContext = await a.client.rpc('service_survey_context');
  check('설문 문맥의 칸', hasColumns(surveyContext.data?.[0] ?? {}, ['schedule_id', 'credits_left', 'read_solo', 'read_pair', 'consented', 'beta_over']).length === 0, shapeOf(surveyContext));
  /* 앱의 `surveyRequest` 와 같은 칸 — `p_price_options` 를 안 보낸다 */
  const surveySaved = await a.client.rpc('save_service_survey', { p_liked: [], p_unknown: [], p_improve: [], p_improve_text: null, p_wants: [], p_wants_new: [], p_price_solo: null, p_price_pair: null, p_price_factors: [], p_free_text: null, p_submit: false });
  check('설문 임시 저장 — 앱이 보내는 칸으로 함수가 잡힌다', surveySaved.error === null, shapeOf(surveySaved));
  const improvement = await a.client.rpc('set_improvement_consent', { p_consent: false });
  const contact = await a.client.rpc('set_contact_consent', { p_consent: true });
  check('선택 동의 둘', improvement.error === null && contact.error === null, `${shapeOf(improvement)} ${shapeOf(contact)}`);
  const prefer = await a.client.from('discovery_profile').select('user_id').maybeSingle();
  const preferSaved = await a.client.from('discovery_profile').update({ prefer_gender: 'female' }).eq('user_id', prefer.data.user_id);
  check('보고 싶은 성별 — 있는 줄을 고친다', preferSaved.error === null, shapeOf(preferSaved));
  const fresh = await newAccount('fresh');
  await passNotice(fresh.client, `새${tag}`);
  const noProfile = await fresh.client.from('discovery_profile').select('user_id').maybeSingle();
  const preferInsert = await fresh.client.from('discovery_profile').insert({ prefer_gender: 'female' });
  check('보고 싶은 성별 — 처음이면 넣는다', noProfile.data === null && preferInsert.error === null, shapeOf(preferInsert));

  /* ---------- 남의 행 ---------- */
  const seenPeople = await c.client.from('person').select('id').in('id', [selfId, momId]);
  check('남의 사람 입력이 안 보인다', seenPeople.error === null && seenPeople.data.length === 0, shapeOf(seenPeople));
  const edgesSeen = await c.client.from('user_person_access').select('person_id').eq('person_id', momId);
  check('남의 사람 목록이 안 보인다', edgesSeen.data?.length === 0, shapeOf(edgesSeen));
  const edgeEdit = await c.client.from('user_person_access').update({ note: '해킹' }).eq('person_id', momId);
  const edgeDrop = await c.client.from('user_person_access').delete().eq('person_id', momId);
  check('남의 메모를 못 고치고 못 뺀다', edgeEdit.error === null && edgeDrop.error === null && sql(`select note from public.user_person_access where person_id = '${momId}' and user_id = '${a.id}'`) === '새 메모');
  const accountsSeen = await c.client.from('app_user').select('status');
  check('계정 표는 내 줄 하나다 — maybeSingle 이 믿는 값', accountsSeen.data?.length === 1, shapeOf(accountsSeen));
  const profilesSeen = await c.client.from('discovery_profile').select('prefer_gender');
  check('참여 표도 내 줄 하나다 — maybeSingle 이 믿는 값', profilesSeen.data?.length === 1, shapeOf(profilesSeen));
  const profileEdit = await c.client.from('discovery_profile').update({ prefer_gender: 'male' }).eq('user_id', a.id);
  check('남의 참여 값을 못 고친다', profileEdit.error === null && sql(`select prefer_gender from public.discovery_profile where user_id = '${a.id}'`) === 'female', shapeOf(profileEdit));
  const readingStranger = await door(`/api/mobile/reading?${readingQuery({ kind: 'person', personId: momId })}`, { token: cToken });
  check('남의 사람의 풀이 칸은 404', readingStranger.status === 404, said(readingStranger));
  const runStranger = await door(`/api/mobile/reading/run?${readingQuery({ kind: 'person', personId: momId })}`, { token: cToken });
  check('남의 사람의 시도는 없는 것', runStranger.status === 200 && runStranger.body?.run === null, said(runStranger));
  const pressStranger = await door('/api/mobile/reading', { token: cToken, method: 'POST', json: { target: { kind: 'person', personId: momId }, requestKey: randomUUID() } });
  check('남의 사람으로 시도를 못 연다', pressStranger.body?.ok === false, said(pressStranger));
  const pressPair = await door('/api/mobile/reading', { token: cToken, method: 'POST', json: { target: { kind: 'private', personA: pairA, personB: pairB }, requestKey: randomUUID() } });
  check('남의 쌍으로 시도를 못 연다', pressPair.body?.ok === false, said(pressPair));
  check('남의 대상으로 시도가 안 남았다', sql(`select count(*) from public.reading_run where user_id = '${c.id}'`) === '0', sql(`select count(*) from public.reading_run where user_id = '${c.id}'`));
  const editStranger = await door('/api/mobile/me/person-input', { token: cToken, method: 'POST', json: { personId: momId, query: QUERY('1970-01-01', 'female', '해킹') } });
  check('남의 사람의 입력을 못 고친다', editStranger.body?.ok !== true && sql(`select solar_date from public.person where id = '${momId}'`) === '1962-03-02', said(editStranger));
  const editShape = await door('/api/mobile/me/person-input', { token: cToken, method: 'POST', json: { personId: 'x', query: QUERY('1970-01-01', 'female', '해킹') } });
  check('사람 id 모양이 틀리면 400', editShape.status === 400, said(editShape));
  const relationStranger = await c.client.rpc('pair_relation_of', { p_person_a: pairA, p_person_b: pairB });
  note('pair_relation_of 남의 쌍', '낯선', shapeOf(relationStranger));
  const atStranger = await c.client.rpc('photo_at', { p_user_id: a.id, p_position: 1 });
  check('남의 사진을 함수로도 못 받는다', (atStranger.data ?? []).length === 0, shapeOf(atStranger));
  const cancelStranger = await c.client.rpc('cancel_match_request', { p_request_id: requestId });
  note('cancel_match_request 남의 요청', '낯선', shapeOf(cancelStranger));
  const passStrangerList = await c.client.rpc('my_chat_rooms');
  check('남의 방이 목록에 없다', passStrangerList.data?.every((row) => row.match_id !== matchId), shapeOf(passStrangerList));

  /* 차단 — 끝에 둔다. 방이 닫힌다 */
  const blocked = await b.client.rpc('block_user', { p_user_id: a.id });
  check('차단한다', blocked.error === null, shapeOf(blocked));
  const blockList = await b.client.from('block').select('blocked_user_id');
  check('차단 목록은 내 것뿐이다', blockList.data?.length === 1 && blockList.data[0].blocked_user_id === a.id, shapeOf(blockList));
  const blockSeen = await c.client.from('block').select('blocked_user_id');
  check('남의 차단 목록이 안 보인다', blockSeen.data?.length === 0, shapeOf(blockSeen));

  /* ---------- 토큰 ---------- */
  const doors = [
    ['GET', '/api/mobile/readings', undefined],
    ['GET', `/api/mobile/reading?kind=self`, undefined],
    ['GET', `/api/mobile/reading/run?kind=self`, undefined],
    ['POST', '/api/mobile/reading', { target: selfTarget, requestKey: randomUUID() }],
    ['POST', '/api/mobile/me/self-person', { query: QUERY('1990-05-15', 'male', '나') }],
    ['POST', '/api/mobile/me/person-input', { personId: selfId, query: QUERY('1990-05-15', 'male', '나') }],
    ['POST', '/api/mobile/me/participation', { on: true }],
    ['PUT', '/api/mobile/me/participation', undefined],
    ['GET', '/api/mobile/me/photo', undefined],
    ['POST', '/api/mobile/matching/respond', { requestId, accept: true }],
  ];
  const everyDoor = async (label, token, expected) => {
    for (const [method, path, json] of doors) {
      const answer = await door(path, { token, method, json });
      check(`${label}: ${method} ${path} → ${expected}`, answer.status === expected && answer.body?.refused === 'sign-in', said(answer));
    }
  };
  await everyDoor('토큰 없음', null, 401);
  await everyDoor('깨진 토큰', 'garbage.token.here', 401);
  await everyDoor('낡은 토큰', expiredToken(a.id), 401);

  const signedOut = await newAccount('out');
  await passNotice(signedOut.client, `끝${tag}`);
  const outToken = await tokenOf(signedOut);
  await signedOut.client.auth.signOut({ scope: 'global' });
  const afterOut = await door('/api/mobile/readings', { token: outToken });
  check('로그아웃한 세션의 토큰은 401', afterOut.status === 401, said(afterOut));

  const gone = await newAccount('gone');
  await passNotice(gone.client, `떠남${tag}`);
  const goneToken = await tokenOf(gone);
  await keyed.auth.admin.deleteUser(gone.id);
  const afterGone = await door('/api/mobile/readings', { token: goneToken });
  check('지워진 계정의 토큰은 401', afterGone.status === 401, said(afterGone));
  const goneRead = await gone.client.from('app_user').select(ACCOUNT_COLUMNS).maybeSingle();
  note('app_user.select 지워진 계정의 토큰', '지워짐', shapeOf(goneRead));

  /* ---------- 미가입 ---------- */
  const unsigned = await newAccount('unsigned');
  const unsignedToken = await tokenOf(unsigned);
  await readAll(unsigned.client, '미가입');
  const unsignedWrites = {
    save_my_profile: () => unsigned.client.rpc('save_my_profile', { p_nickname: `미${tag}`, p_intro: null }),
    create_managed_person: () => unsigned.client.rpc('create_managed_person', momArgs),
    request_match: () => unsigned.client.rpc('request_match', { p_candidate_user_id: b.id }),
    add_my_photo: () => unsigned.client.rpc('add_my_photo', { p_content_type: 'image/png', p_base64: PNG }),
  };
  for (const [name, write] of Object.entries(unsignedWrites)) note(name, '미가입', shapeOf(await write()));
  for (const [method, path, json] of doors) {
    const answer = await door(path, { token: unsignedToken, method, json });
    check(`미가입: ${method} ${path} → 403 signup`, answer.status === 403 && answer.body?.refused === 'signup', said(answer));
  }
  check('미가입: 문이 사람을 안 세웠다', sql(`select self_person_id is null from public.app_user where id = '${unsigned.id}'`) === 't');
  const unsignedPhoto = await door(photoOf(a.id), { token: unsignedToken });
  check('미가입: 남의 사진은 404', unsignedPhoto.status === 404, String(unsignedPhoto.status));

  /* ---------- 정지 ---------- */
  const suspended = await newAccount('susp');
  await passNotice(suspended.client, `정지${tag}`);
  const suspendedToken = await tokenOf(suspended);
  await saveSelf(suspendedToken, '1991-01-01', 'male');
  sql(`update public.app_user set status = 'suspended' where id = '${suspended.id}'`);
  await readAll(suspended.client, '정지');
  const suspendedReason = await suspended.client.rpc('my_suspension');
  note('my_suspension 칸', '정지', JSON.stringify(suspendedReason.data?.[0] ?? null));
  for (const [name, write] of Object.entries({
    save_my_profile: () => suspended.client.rpc('save_my_profile', { p_nickname: `정지${tag}`, p_intro: null }),
    create_managed_person: () => suspended.client.rpc('create_managed_person', momArgs),
    add_my_photo: () => suspended.client.rpc('add_my_photo', { p_content_type: 'image/png', p_base64: PNG }),
    request_match: () => suspended.client.rpc('request_match', { p_candidate_user_id: b.id }),
  })) note(name, '정지', shapeOf(await write()));
  for (const [method, path, json] of doors) note(`${method} ${path}`, '정지', said(await door(path, { token: suspendedToken, method, json })));
  note('POST 참여 끄기', '정지', said(await door('/api/mobile/me/participation', { token: suspendedToken, method: 'POST', json: { on: false } })));
  check('정지: 시도가 안 열렸다', sql(`select count(*) from public.reading_run where user_id = '${suspended.id}'`) === '0');
  const suspendedShelf = await door('/api/mobile/readings', { token: suspendedToken });
  check('정지: 보관함은 blocked 로 답한다', suspendedShelf.body?.view === 'blocked', said(suspendedShelf));

  /* ---------- 탈퇴 신청 ---------- */
  const leaving = await newAccount('leave');
  await passNotice(leaving.client, `탈퇴${tag}`);
  const leavingToken = await tokenOf(leaving);
  await saveSelf(leavingToken, '1993-01-01', 'male');
  const deletion = await leaving.client.rpc('request_account_deletion');
  check('탈퇴를 신청한다', deletion.error === null, shapeOf(deletion));
  await readAll(leaving.client, '탈퇴 신청');
  for (const [method, path, json] of doors) note(`${method} ${path}`, '탈퇴 신청', said(await door(path, { token: leavingToken, method, json })));
  check('탈퇴 신청: 시도가 안 열렸다', sql(`select count(*) from public.reading_run where user_id = '${leaving.id}'`) === '0');
  const leavingShelf = await door('/api/mobile/readings', { token: leavingToken });
  check('탈퇴 신청: 보관함은 blocked 로 답한다', leavingShelf.body?.view === 'blocked', said(leavingShelf));

  /* ---------- 베타 종료 ---------- */
  const endedId = sql(`insert into public.beta_schedule (ends_on, note, operator_name, operator_officer, operator_contact)
    values ((now() at time zone 'Asia/Seoul')::date - 3, '앱 검사 — 끝남', '만세력 운영자', '검사 담당', 'ops@example.com') returning id`);
  try {
    await readAll(c.client, '베타 종료');
    for (const [method, path, json] of doors) {
      const answer = await door(path, { token: cToken, method, json });
      note(`${method} ${path}`, '베타 종료', said(answer));
    }
    const closedShelf = await door('/api/mobile/readings', { token: cToken });
    check('종료: 읽기 문은 closed', closedShelf.status === 403 && closedShelf.body?.refused === 'closed', said(closedShelf));
    const closedPress = await door('/api/mobile/reading', { token: cToken, method: 'POST', json: { target: selfTarget, requestKey: randomUUID() } });
    check('종료: 누름도 closed', closedPress.status === 403 && closedPress.body?.refused === 'closed', said(closedPress));
    const closedOff = await door('/api/mobile/me/participation', { token: cToken, method: 'POST', json: { on: false } });
    check('종료: 참여 끄기는 열려 있다 — 고지의 약속', closedOff.status === 200 && closedOff.body?.ok === true, said(closedOff));
    const closedOn = await door('/api/mobile/me/participation', { token: cToken, method: 'POST', json: { on: true } });
    note('POST 참여 켜기', '베타 종료', said(closedOn));
    const closedPhotoMode = await door('/api/mobile/me/photo', { token: cToken });
    note('GET 사진 길', '베타 종료', said(closedPhotoMode));
    for (const [name, write] of Object.entries({
      save_my_profile: () => c.client.rpc('save_my_profile', { p_nickname: `남${tag}`, p_intro: null }),
      create_managed_person: () => c.client.rpc('create_managed_person', momArgs),
      add_my_photo: () => c.client.rpc('add_my_photo', { p_content_type: 'image/png', p_base64: PNG }),
      request_match: () => c.client.rpc('request_match', { p_candidate_user_id: b.id }),
      send_chat_message: () => a.client.rpc('send_chat_message', { p_match_id: matchId, p_body: '끝', p_client_id: randomUUID() }),
    })) note(name, '베타 종료', shapeOf(await write()));
  } finally {
    sql(`delete from public.beta_schedule where id = ${endedId}`);
  }
} finally {
  if (process.env.CHECK_MOBILE_DUMP) writeFileSync(process.env.CHECK_MOBILE_DUMP, JSON.stringify(measured, null, 1));
  stop();
  finish();
}
