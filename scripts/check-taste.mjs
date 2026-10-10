/**
 * 로그인 전 사주 문단을 **실제 스택에 대고** 돌린다 — 서버 액션 → DB, 모델만 빼고(ADR 0143).
 *
 * 모델은 안 부른다 — 서버의 `OPENAI_API_KEY` 를 비워 두면 부르는 갈래는 그 자리에서 실패로 적힌다(`model-call-failed`).
 * 성공한 글은 **모델이 냈다고 치고** artifact 를 성공으로 바꿔 둔다 — 재려는 것은 글을 어떻게 쓰는가가 아니라 예약 · 재사용 ·
 * 한도 · 귀속 · 잇기가 서버 액션에서 DB 까지 실제로 이어지는가다(글과 검사는 단위 시험 `app/taste-run.test.ts`).
 *
 * 서버 액션은 브라우저가 부르는 그대로 부른다 — `Next-Action` 머리에 빌드가 지은 액션 id 를 싣고(`server-reference-manifest.json`),
 * 답은 RSC 줄에서 읽는다. IP 는 `x-forwarded-for` 로 가른다 — 로컬 Next 서버는 그 머리가 있으면 그대로 둔다
 * (`app/taste-visitor.ts` 머리말).
 *
 * 1. **연타 · 새로고침** — 같은 브라우저 · 같은 입력은 세션 하나 · 모델 0번이다
 * 2. **같은 입력 다른 브라우저 · 쿠키 지우고 같은 입력** — 새 세션, 같은 글, 모델 0번
 * 3. **남의 세션은 못 읽는다** — 세션 id 를 알아도 쿠키가 다르면 글이 안 선다
 * 4. **다른 입력 반복 → 한도** — IP 1분 셋 · 브라우저 1시간 새 지문 다섯
 * 5. **원문이 DB 에 없다** — 날짜 · IP 원문이 맛보기 표 어디에도 없다
 * 6. **귀속** — 문이 터지면 `retryable` 이고 다시 시도하면 붙는다. 내 것은 붙고, 남이 붙인 것은 못 가져가고, 지문이 다르면
 *    버리고, 바꾼 id 는 조용히 지나간다(셋 다 `terminal`). 지문은 **서버에 저장된 내 사주**로 잰다 — 클라이언트가 다른 입력을
 *    실어 보내도 저장된 입력이 이긴다
 * 7. **세션 하나 = 풀이 하나** — 잇는 문이 터지면 그 시도는 실패로 닫히고(`taste-link-failed`), 「전체 풀이만 보기」가 귀속
 *    표를 걷으면 다음 누름은 보통 풀이고, 누름이 잇고, 실패한 풀이만 다시 잇고, 성공한 풀이가 있으면 새로 안 연다
 * 8. **퍼널은 세션당 한 번** — 가입 시작 · 가입 완료를 거듭해도 · 귀속 표를 지우고 다시 와도 한 번, 다른 브라우저 · 쿠키 없음은 0.
 *    걷은 「더보기」(`more_clicked`)는 서버 액션이 받지 않는다(G-85)
 * 9. **회원은 맛보기로 안 간다** — 로그인한 요청은 예약도 세션도 없이 닫힌다
 */
import { createClient } from '@supabase/supabase-js';
import { execFileSync } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { readFileSync } from 'node:fs';

import { startCheckServer } from './next-server.mjs';
import { passNotice, chartArgs } from './notice.mjs';
import { createChecks, sql, keyedRpc, sessionCookie } from './checks.mjs';
import { worktreeStack } from '../src/lib/local-env.ts';

const status = JSON.parse(execFileSync('npx', ['supabase', 'status', '-o', 'json'], { encoding: 'utf8' }));
const API = status.API_URL;
const PORT = Number(process.env.CHECK_PORT ?? worktreeStack().checkPort + 5);

const anon = () => createClient(API, status.ANON_KEY, { auth: { persistSession: false } });
const { check, finish } = createChecks('check-taste');

const stamp = Date.now();
const tag = String(stamp).slice(-6);

/** 시험용 비밀 둘 — 운영 값이 아니다. 앱은 비밀이 없으면 문단을 닫는다(기본값으로 돌지 않는다) */
const SECRETS = {
  TASTE_BROWSER_SECRET: 'check-taste-browser-secret-0123456789abcdef',
  TASTE_IP_SECRET: 'check-taste-ip-secret-0123456789abcdefghijkl',
};

/** 입력 하나 — 화면이 주소 `#` 뒤에 싣는 모양 그대로 */
const draftOf = (date, time = '14:30') =>
  new URLSearchParams({ date, hour: time, gender: 'male', city: '서울', rule: 'jo', basis: 'localMean' }).toString();

const BIRTH = '1990-05-15';
const DRAFT = draftOf(BIRTH);

/* 지난 실행이 남긴 맛보기를 걷는다 — 같은 입력의 artifact 는 전역 한 행이라, 남아 있으면 첫 요청이 재사용으로 시작한다 */
sql(`delete from public.taste_session`);
sql(`delete from public.taste_artifact`);
sql(`delete from public.taste_rate_event`);

const { base: BASE, stop } = await startCheckServer({
  port: PORT,
  supabaseUrl: API,
  anonKey: status.ANON_KEY,
  secretKey: status.SERVICE_ROLE_KEY,
  whileRunning: { ...SECRETS, OPENAI_API_KEY: '' },
});

/** 빌드가 지은 액션 id — 파일과 이름으로 찾는다 */
const manifest = JSON.parse(readFileSync('.next-check/server/server-reference-manifest.json', 'utf8'));
const actionId = (filename, name) => {
  const found = Object.entries(manifest.node).find(([, entry]) => entry.filename === filename && entry.exportedName === name);
  if (found === undefined) throw new Error(`액션을 못 찾았다 — ${filename}::${name}`);
  return found[0];
};

/** 브라우저 하나 — 쿠키 항아리 */
const browser = () => new Map();

/**
 * 액션 하나를 부른다 — 브라우저처럼. 답의 RSC 줄에서 값을 읽고, 내려온 쿠키를 항아리에 담는다.
 */
async function act(path, [filename, name], args, { jar = browser(), ip = '10.0.0.1', session = '' } = {}) {
  const cookie = [session, ...[...jar].map(([key, value]) => `${key}=${value}`)].filter((one) => one !== '').join('; ');
  const response = await fetch(`${BASE}${path}`, {
    method: 'POST',
    headers: {
      'Next-Action': actionId(filename, name),
      'Content-Type': 'text/plain;charset=UTF-8',
      Accept: 'text/x-component',
      Origin: BASE,
      'x-forwarded-for': ip,
      ...(cookie === '' ? {} : { cookie }),
    },
    body: JSON.stringify(args),
  });
  for (const line of response.headers.getSetCookie()) {
    const [pair, ...attributes] = line.split(';');
    const at = pair.indexOf('=');
    const key = pair.slice(0, at).trim();
    const value = pair.slice(at + 1).trim();
    if (value === '' || attributes.some((one) => /max-age=0\b|expires=thu, 01 jan 1970/i.test(one.trim()))) jar.delete(key);
    else jar.set(key, value);
  }
  const rows = new Map(
    (await response.text()).split('\n').flatMap((line) => {
      const at = line.indexOf(':');
      return at < 0 ? [] : [[line.slice(0, at), line.slice(at + 1)]];
    }),
  );
  const head = JSON.parse(rows.get('0') ?? 'null');
  const ref = typeof head?.a === 'string' ? head.a.replace(/^\$@/, '') : null;
  const value = ref === null ? undefined : rows.get(ref);
  return value === undefined ? { broken: response.status } : JSON.parse(value);
}

const REQUEST = ['app/actions.ts', 'requestTaste'];
const READ = ['app/actions.ts', 'readTaste'];
const CLAIM = ['app/actions.ts', 'claimTaste'];
const NOTE = ['app/actions.ts', 'noteTasteStep'];
const GENERATE = ['app/me/reading/actions.ts', 'generateReading'];
const SKIP = ['app/me/reading/actions.ts', 'skipTasteCarry'];

const modelCalls = () => Number(sql(`select coalesce(sum(value), 0) from public.taste_daily_count where metric = 'model_calls'`));
const funnel = (step) => Number(sql(`select coalesce(sum(value), 0) from public.taste_daily_count where metric = 'funnel:${step}'`));

try {
  // -------------------------------------------------------------------------
  // 1 · 처음 — 모델을 부르고(없으니 실패), 그 뒤 「모델이 냈다고 치고」 성공으로 바꾼다
  // -------------------------------------------------------------------------
  const first = browser();
  const before = modelCalls();
  const failed = await act('/', REQUEST, [DRAFT], { jar: first, ip: '10.77.0.1' });
  check('처음 부른 입력은 모델을 한 번 부르고, 모델이 없으니 「실패 · 다시 시도하기」다', failed.state === 'failed' && failed.retry === true, JSON.stringify(failed));
  check('부르기 전에 하루 예산을 하나 쓴다', modelCalls() === before + 1, `${before} → ${modelCalls()}`);
  check('쿠키를 심는다 — 32바이트 무작위', /^[A-Za-z0-9_-]{43}$/.test(first.get('saju_taste') ?? ''));

  const artifact = sql(`select id from public.taste_artifact order by created_at desc limit 1`);
  check('실패는 시도 1 · 실패 코드로 적힌다', sql(`select status || ':' || attempts || ':' || failure_code from public.taste_artifact where id = '${artifact}'`) === 'failed:1:model-call-failed');

  const retried = await act('/', REQUEST, [DRAFT], { jar: first, ip: '10.77.0.1' });
  check('다시 시도하기는 같은 artifact 의 다음 시도다 — 새 행을 안 만든다', retried.state === 'failed'
    && sql(`select attempts from public.taste_artifact where id = '${artifact}'`) === '2'
    && sql(`select count(*) from public.taste_artifact`) === '1');

  const PREVIEW = `이 사주는 ${tag} 번째 장면에서 먼저 움직이는 쪽이에요.\n\n그렇다면 그 걸음은 어디서 쉬어 갈까요?`;
  sql(`update public.taste_artifact set status = 'succeeded', failure_code = null, preview_markdown = '${PREVIEW}',
         topic = '결정하거나 행동하는 방식', distinctive_pattern = '먼저 움직인다', continuation_question = '어디서 쉬어 가나',
         answer_direction = '말로 먼저 꺼낸다', supporting_claims = '{analysis.structure}' where id = '${artifact}'`);

  // -------------------------------------------------------------------------
  // 2 · 새로고침 · 연타
  // -------------------------------------------------------------------------
  const settled = modelCalls();
  const again = await act('/', REQUEST, [DRAFT], { jar: first, ip: '10.77.0.1' });
  check('새로고침 — 같은 브라우저 · 같은 입력은 성공한 글을 다시 쓴다', again.state === 'ready' && again.preview === PREVIEW, JSON.stringify(again));
  const burst = await Promise.all([1, 2, 3].map(() => act('/', REQUEST, [DRAFT], { jar: first, ip: '10.77.0.1' })));
  check('연타 셋 — 셋 다 같은 세션 · 같은 글', burst.every((one) => one.state === 'ready' && one.sessionId === again.sessionId));
  check('새로고침 · 연타는 모델을 다시 안 부른다', modelCalls() === settled, `${settled} → ${modelCalls()}`);
  check('세션은 하나다', sql(`select count(*) from public.taste_session where id = '${again.sessionId}'`) === '1'
    && sql(`select count(*) from public.taste_session`) === '1');

  // -------------------------------------------------------------------------
  // 3 · 다른 브라우저 · 쿠키 지움 · 남의 세션
  // -------------------------------------------------------------------------
  const second = browser();
  const other = await act('/', REQUEST, [DRAFT], { jar: second, ip: '10.77.0.2' });
  check('같은 입력 다른 브라우저 — 새 세션 · 같은 글', other.state === 'ready' && other.sessionId !== again.sessionId && other.preview === PREVIEW);
  const wiped = await act('/', REQUEST, [DRAFT], { jar: browser(), ip: '10.77.0.1' });
  check('쿠키를 지우고 같은 입력 — 새 세션 · 같은 글', wiped.state === 'ready' && ![again.sessionId, other.sessionId].includes(wiped.sessionId));
  check('다른 브라우저 · 쿠키 지움도 모델을 안 부른다', modelCalls() === settled);

  const peek = await act('/', READ, [again.sessionId], { jar: second, ip: '10.77.0.2' });
  check('남의 세션 id 를 알아도 내 쿠키로는 글이 안 선다', peek.state !== 'ready', JSON.stringify(peek));
  const mine = await act('/', READ, [again.sessionId], { jar: first, ip: '10.77.0.1' });
  check('내 세션은 내 쿠키로 다시 읽힌다', mine.state === 'ready' && mine.preview === PREVIEW);

  // -------------------------------------------------------------------------
  // 8 · 퍼널은 세션당 한 번 — 가입 시작. 「더보기」는 걷었다(G-85)
  // -------------------------------------------------------------------------
  const startedBefore = funnel('signup_started');
  await act('/', NOTE, ['signup_started', again.sessionId], { jar: first, ip: '10.77.0.1' });
  await act('/', NOTE, ['signup_started', again.sessionId], { jar: first, ip: '10.77.0.1' });
  check('가입 시작을 두 번 눌러도 그 세션은 한 번 센다', funnel('signup_started') === startedBefore + 1, `${startedBefore} → ${funnel('signup_started')}`);
  await act('/', NOTE, ['signup_started', again.sessionId], { jar: second, ip: '10.77.0.2' });
  await act('/', NOTE, ['signup_started', again.sessionId], { jar: browser(), ip: '10.77.0.3' });
  check('남의 세션 id 로는 · 쿠키 없이는 안 센다', funnel('signup_started') === startedBefore + 1, `${startedBefore} → ${funnel('signup_started')}`);
  await act('/', NOTE, ['signup_started', other.sessionId], { jar: second, ip: '10.77.0.2' });
  check('다른 세션은 따로 센다', funnel('signup_started') === startedBefore + 2);
  await act('/', NOTE, ['more_clicked', again.sessionId], { jar: first, ip: '10.77.0.1' });
  check('걷은 「더보기」는 서버 액션이 받지 않는다 — 퍼널은 다섯 단계다(G-85)', funnel('more_clicked') === 0);

  // -------------------------------------------------------------------------
  // 4 · 한도
  // -------------------------------------------------------------------------
  const perIp = [];
  for (const day of ['01', '02', '03', '04']) perIp.push(await act('/', REQUEST, [draftOf(`2001-01-${day}`)], { jar: browser(), ip: '10.88.0.1' }));
  check('IP 하나가 1분에 셋 — 넷째는 「한도」(모델을 안 부른다)', perIp.slice(0, 3).every((one) => one.state === 'failed') && perIp[3].state === 'limited',
    perIp.map((one) => one.state).join(' · '));

  const hopping = browser();
  const perBrowser = [];
  for (const day of ['01', '02', '03', '04', '05', '06']) {
    perBrowser.push(await act('/', REQUEST, [draftOf(`2002-02-${day}`)], { jar: hopping, ip: `10.99.0.${Number(day)}` }));
  }
  check('브라우저 하나가 1시간에 새 입력 다섯 — 여섯째는 「한도」', perBrowser.slice(0, 5).every((one) => one.state === 'failed') && perBrowser[5].state === 'limited',
    perBrowser.map((one) => one.state).join(' · '));
  check('한도 답에는 세션도 숫자도 없다', !('sessionId' in perIp[3]) && Object.keys(perIp[3]).join() === 'state');

  // -------------------------------------------------------------------------
  // 5 · 원문
  // -------------------------------------------------------------------------
  const tables = ['taste_artifact', 'taste_session', 'taste_rate_event', 'taste_daily_count'];
  const dump = tables.map((table) => sql(`select coalesce(string_agg(t::text, ' '), '') from public.${table} t`)).join(' ');
  check('맛보기 표 어디에도 생년월일 원문이 없다', !dump.includes(BIRTH) && !dump.includes('2001-01-0') && !dump.includes('14:30'));
  check('맛보기 표 어디에도 IP 원문이 없다', !/10\.(77|88|99)\.0\./.test(dump));
  check('한도 기록은 16진 64자 HMAC 뿐이다', sql(`select count(*) from public.taste_rate_event where subject_hmac !~ '^[0-9a-f]{64}$'`) === '0');

  // -------------------------------------------------------------------------
  // 6 · 귀속
  // -------------------------------------------------------------------------
  const password = `pw-${stamp}-Aa1!`;
  const member = async (who) => {
    const email = `taste-${who}-${stamp}@example.com`;
    const client = anon();
    await client.auth.signUp({ email, password });
    await passNotice(client);
    return { client, email, id: (await client.auth.getUser()).data.user.id, session: await sessionCookie(status, email, password) };
  };
  const a = await member('a');
  const b = await member('b');
  const c = await member('c');

  /* 「이 사주가 내 사주 맞나요?」가 저장한 내 사주 — 귀속은 이 저장된 입력으로 지문을 잰다 */
  const saveSelf = (who, date) => keyedRpc(who.client, 'create_self_person', {
    p_local_label: `맛${tag}`, p_calendar: 'solar', p_original_date: date, p_solar_date: date, p_birth_time: '14:30',
    p_gender: 'male', p_city: '서울', p_late_night_rule: 'jo', p_time_basis: 'localMean', ...chartArgs(`taste-${who.email}`),
  });
  await saveSelf(a, BIRTH);
  await saveSelf(b, BIRTH);
  await saveSelf(c, '1985-03-03');

  // -------------------------------------------------------------------------
  // 9 · 회원은 맛보기로 안 간다
  // -------------------------------------------------------------------------
  const sessionsBefore = sql(`select count(*) from public.taste_session`);
  const eventsBefore = sql(`select count(*) from public.taste_rate_event`);
  const asMember = await act('/', REQUEST, [draftOf('1977-07-07')], { jar: browser(), ip: '10.66.0.1', session: a.session });
  check('로그인한 요청은 닫힌다 — 예약도 세션도 한도 사건도 없다', asMember.state === 'failed' && asMember.retry === false
    && sql(`select count(*) from public.taste_session`) === sessionsBefore
    && sql(`select count(*) from public.taste_rate_event`) === eventsBefore, JSON.stringify(asMember));

  const completedBefore = funnel('signup_completed');

  /* 귀속 문이 순간 터진다 — 열쇠의 실행 권한을 잠깐 걷는다. 답이 안 났으니 `retryable` 이고 세션 · 표 · 퍼널은 그대로다 */
  const CLAIM_FN = 'public.claim_taste_session(uuid, uuid, text, text)';
  sql(`revoke execute on function ${CLAIM_FN} from service_role`);
  let broken;
  try {
    broken = await act('/', CLAIM, [again.sessionId], { jar: first, ip: '10.77.0.1', session: a.session });
  } finally {
    sql(`grant execute on function ${CLAIM_FN} to service_role`);
  }
  check('귀속 문이 터지면 `retryable` — 보통 흐름으로 접지 않는다', broken.result === 'retryable', JSON.stringify(broken));
  check('답이 안 났으면 세션은 열린 채이고 귀속 표도 안 선다', sql(`select status from public.taste_session where id = '${again.sessionId}'`) === 'open'
    && !first.has('saju_taste_claim') && funnel('signup_completed') === completedBefore);

  /* 다시 시도 — 같은 id 로. 클라이언트가 다른 입력을 실어 보내도 서버는 세션 id 만 읽고 저장된 내 사주로 잰다 */
  const claimed = await act('/', CLAIM, [again.sessionId, draftOf('1985-03-03')], { jar: first, ip: '10.77.0.1', session: a.session });
  check('다시 시도하면 내 세션은 붙는다 — 저장된 내 사주로 다시 잰 지문이 같다(실어 보낸 다른 입력은 안 읽는다)', claimed.result === 'claimed', JSON.stringify(claimed));
  check('붙은 세션은 그 회원 것이다', sql(`select status || ':' || claimed_by from public.taste_session where id = '${again.sessionId}'`) === `claimed:${a.id}`);
  check('귀속 표(쿠키)가 선다', first.get('saju_taste_claim') === again.sessionId);
  check('가입 완료를 한 번 센다', funnel('signup_completed') === completedBefore + 1, `${completedBefore} → ${funnel('signup_completed')}`);

  first.delete('saju_taste_claim');
  const reclaimed = await act('/', CLAIM, [again.sessionId], { jar: first, ip: '10.77.0.1', session: a.session });
  check('귀속 표를 지우고 다시 와도 가입 완료는 다시 안 센다', reclaimed.result === 'claimed' && funnel('signup_completed') === completedBefore + 1,
    `${completedBefore} → ${funnel('signup_completed')}`);

  const stolen = await act('/', CLAIM, [again.sessionId], { jar: new Map([['saju_taste', first.get('saju_taste')]]), ip: '10.77.0.1', session: b.session });
  check('남이 붙인 세션은 같은 브라우저의 다른 회원도 못 가져간다 — `terminal`', stolen.result === 'terminal'
    && sql(`select claimed_by from public.taste_session where id = '${again.sessionId}'`) === a.id);
  check('남이 붙인 세션(taken)은 가입 완료로 안 센다', funnel('signup_completed') === completedBefore + 1);

  const discarded = await act('/', CLAIM, [other.sessionId, DRAFT], { jar: second, ip: '10.77.0.2', session: c.session });
  check('저장된 내 사주의 지문이 다르면 버린다(`terminal`) — 실어 보낸 같은 입력은 안 읽는다', discarded.result === 'terminal'
    && sql(`select status from public.taste_session where id = '${other.sessionId}'`) === 'discarded');
  check('버림이어도 세션을 들고 돌아온 것이라 가입 완료로 센다', funnel('signup_completed') === completedBefore + 2,
    `${completedBefore} → ${funnel('signup_completed')}`);

  const forged = await act('/', CLAIM, [randomUUID()], { jar: browser(), ip: '10.77.0.3', session: c.session });
  check('바꾼 id 는 조용히 지나간다(`terminal`) — 가입 완료로 안 센다', forged.result === 'terminal' && funnel('signup_completed') === completedBefore + 2);

  // -------------------------------------------------------------------------
  // 7 · 세션 하나 = 풀이 하나
  // -------------------------------------------------------------------------
  const linkedRun = () => sql(`select coalesce(reading_run_id::text, '') from public.taste_session where id = '${again.sessionId}'`);
  const runStatus = (run) => sql(`select status from public.reading_run where id = '${run}'`);
  const settledRun = async (run) => {
    for (let tries = 0; tries < 60 && runStatus(run) === 'running'; tries += 1) await new Promise((resolve) => setTimeout(resolve, 500));
    return runStatus(run);
  };
  const runsOfA = () => sql(`select count(*) from public.reading_run where user_id = '${a.id}'`);

  /* 잇는 문이 순간 터진다 — 보통 풀이로 강등하지 않고 그 시도를 실패로 닫는다. 세션은 안 이어진 채 표가 남는다 */
  const LINK_FN = 'public.link_taste_reading_run(uuid, uuid, uuid)';
  const runsBeforeBroken = Number(runsOfA());
  sql(`revoke execute on function ${LINK_FN} from service_role`);
  let brokenPress;
  try {
    brokenPress = await act('/me/readings/self', GENERATE, [{ kind: 'self' }, randomUUID()], { jar: first, ip: '10.77.0.1', session: a.session });
  } finally {
    sql(`grant execute on function ${LINK_FN} to service_role`);
  }
  const brokenRun = sql(`select id from public.reading_run where user_id = '${a.id}' order by created_at desc limit 1`);
  check('잇는 문이 터지면 연 시도를 실패로 닫는다(`taste-link-failed`) — 보통 풀이로 안 보낸다', brokenPress.started === true
    && Number(runsOfA()) === runsBeforeBroken + 1 && (await settledRun(brokenRun)) === 'failed'
    && sql(`select failure_code from public.reading_run where id = '${brokenRun}'`) === 'taste-link-failed', JSON.stringify(brokenPress));
  check('세션은 안 이어진 채이고 귀속 표가 남는다 — 다음 누름이 다시 잇는다', linkedRun() === '' && first.get('saju_taste_claim') === again.sessionId);

  /*
    막힌 사람의 탈출구 — 「전체 풀이만 보기」(`skipTasteCarry`)가 귀속 표를 걷으면 다음 누름은 보통 풀이다. DB 의 세션은 그대로다.
    그다음 걸음을 이으려고 표를 손으로 되돌린다(같은 브라우저가 다시 붙인 것과 같다 — 귀속은 멱등이다)
  */
  const claimCookie = first.get('saju_taste_claim');
  await act('/me/readings/self', SKIP, [], { jar: first, ip: '10.77.0.1', session: a.session });
  check('「전체 풀이만 보기」는 귀속 표를 걷는다', !first.has('saju_taste_claim'));
  const plainPress = await act('/me/readings/self', GENERATE, [{ kind: 'self' }, randomUUID()], { jar: first, ip: '10.77.0.1', session: a.session });
  const plainRun = sql(`select id from public.reading_run where user_id = '${a.id}' order by created_at desc limit 1`);
  check('표를 걷은 뒤 누름은 보통 풀이다 — 잇지 않고 잇기 실패로도 안 닫는다', plainPress.started === true && linkedRun() === ''
    && (await settledRun(plainRun)) === 'failed'
    && sql(`select coalesce(failure_code, '') from public.reading_run where id = '${plainRun}'`) !== 'taste-link-failed'
    && sql(`select status from public.taste_session where id = '${again.sessionId}'`) === 'claimed', JSON.stringify(plainPress));
  first.set('saju_taste_claim', claimCookie);

  const pressed = await act('/me/readings/self', GENERATE, [{ kind: 'self' }, randomUUID()], { jar: first, ip: '10.77.0.1', session: a.session });
  const run1 = linkedRun();
  check('누름이 연 시도에 세션을 잇는다', pressed.ok === true && pressed.started === true && run1 !== '', JSON.stringify(pressed));
  check('모델이 없는 시도는 실패로 닫힌다 — 풀이권은 안 쓰인다', (await settledRun(run1)) === 'failed');

  const pressedAgain = await act('/me/readings/self', GENERATE, [{ kind: 'self' }, randomUUID()], { jar: first, ip: '10.77.0.1', session: a.session });
  const run2 = linkedRun();
  check('풀이가 실패했으면 같은 맛보기로 다시 잇는다', pressedAgain.started === true && run2 !== '' && run2 !== run1, `${run1} → ${run2}`);
  await settledRun(run2);

  /* 모델이 냈다고 치고 이어진 풀이를 성공시킨다 — 시도는 그 사람으로 열고, 잇기와 저장은 서버가 열쇠로 부르는 그 문이다 */
  const opened = await a.client.rpc('start_reading_run', {
    p_kind: 'self', p_idempotency_key: `taste-${tag}`, p_model: 'gpt-check', p_prompt_version: 'reading-prompt-check',
  });
  const run3 = opened.data?.[0]?.run_id;
  sql(`select public.link_taste_reading_run('${a.id}'::uuid, '${again.sessionId}'::uuid, '${run3}'::uuid)`);
  sql(`select public.save_reading('${run3}'::uuid, '## 이어 쓴 풀이', null, '먼저 움직이는 사람', '{"charts":{}}', '# 역할',
         'reading-prompt-check', 'gpt-check', '{}'::jsonb, now())`);
  check('이어진 풀이가 섰다', runStatus(run3) === 'succeeded' && linkedRun() === run3);

  const runs = runsOfA();
  const done = await act('/me/readings/self', GENERATE, [{ kind: 'self' }, randomUUID()], { jar: first, ip: '10.77.0.1', session: a.session });
  check('성공한 풀이가 있으면 다시 눌러도 새로 안 연다 — 그 풀이로', done.ok === true && done.started === false && runsOfA() === runs, `${runs} → ${runsOfA()}`);
  check('다 쓴 귀속 표는 걷힌다 — 다음 누름부터는 보통 「다시 받기」다', !first.has('saju_taste_claim'));
} catch (failure) {
  check('검사가 끝까지 돌았다', false, failure instanceof Error ? failure.message : String(failure));
} finally {
  stop();
  finish();
}
