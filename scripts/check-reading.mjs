/**
 * 현재 AI 결과를 **실제 스택에 대고** 돌린다 — 모델만 빼고.
 *
 * 모델을 부르지 않는다. 부르면 검사가 느려지고 값이 매번 달라지며 돈이 든다. 대신
 * **모델이 냈다고 치고** 저장 RPC 를 그대로 부른다 — 근거를 자르고 프롬프트를 짓고
 * 검사하는 절반은 단위 시험이 이미 재고 있고(`src/lib/reading`), 여기서 재려는 것은
 * **화면과 RPC 가 실제로 이어져 있는가**다.
 *
 * 1. **화면 조회가 AI 를 부르지 않는가** — 없으면 없다고 말하고 버튼만 선다.
 * 2. **저장된 글이 화면에 서는가** — 자기 풀이와 공유 궁합. 비공개 궁합은 아직 DB 계약까지다.
 * 3. **근거와 프롬프트가 사용자 화면에 없는가** — 그 둘은 내부 화면의 것이다.
 * 4. **양쪽이 같은 글을 읽는가** — 「첫 번째 분」이 누구인지는 자리마다 다르게 적힌다.
 * 5. **표를 브라우저가 직접 못 읽는가** — 근거가 그 안에 있다.
 * 6. **매인 판본으로 서 있는가** — 한쪽이 입력을 고쳐도 공유 결과의 글이 안 바뀐다.
 */
import { createClient } from '@supabase/supabase-js';
import { createServerClient } from '@supabase/ssr';
import { execFileSync } from 'node:child_process';

import { startCheckServer } from './next-server.mjs';

const status = JSON.parse(execFileSync('npx', ['supabase', 'status', '-o', 'json'], { encoding: 'utf8' }));
const API = status.API_URL;
const PORT = Number(process.env.CHECK_PORT ?? 3214);

const anon = () => createClient(API, status.ANON_KEY, { auth: { persistSession: false } });

/**
 * 열쇠를 든 client — **서버가 저장할 때 쓰는 그 문**이다(ADR 0013).
 *
 * `save_reading` 은 `authenticated` 에게 닫혀 있다. 그것이 실제로 닫혀 있는지도 아래에서
 * 브라우저와 같은 길(PostgREST)로 두드려 본다.
 */
const keyed = () =>
  createClient(API, status.SERVICE_ROLE_KEY, { auth: { persistSession: false } });

const checks = [];
const check = (name, pass, detail = '') => {
  checks.push({ name, pass, detail });
  console.log(`${pass ? 'ok  ' : 'FAIL'} ${name}${detail ? ` — ${detail}` : ''}`);
};

const stamp = Date.now();
const tag = String(stamp).slice(-4);
const NAME = { a: `민읽${tag}`, b: `지읽${tag}` };
const BIRTH = {
  a: { date: '1990-05-15', city: '서울', gender: 'male' },
  b: { date: '1992-03-03', city: '부산', gender: 'female' },
};

const password = `pw-${stamp}-Aa1!`;
const mail = { a: `read-a-${stamp}@example.com`, b: `read-b-${stamp}@example.com` };

const sql = (statement) =>
  execFileSync('docker', ['exec', '-i', 'supabase_db_saju', 'psql', '-U', 'postgres', '-tAq', '-c', statement],
    { encoding: 'utf8' }).trim();

sql(`insert into public.invite (email, note) values ('${mail.a}', '검사'), ('${mail.b}', '검사')`);

/** 지난 실행이 남긴 참여자가 후보 목록을 헛디디게 하지 않는다 */
const hideOthers = (email) => {
  const uid = sql(`select id from auth.users where email = '${email}'`);
  sql(`insert into public.discovery_hidden (user_id, hidden_user_id)
       select '${uid}', p.user_id from public.discovery_profile p
       where p.user_id <> '${uid}'
         and p.user_id not in (select id from auth.users where email in ('${mail.a}', '${mail.b}'))
       on conflict do nothing`);
};

const person = async (email, label, birth) => {
  const client = anon();
  await client.auth.signUp({ email, password });
  await client.rpc('create_self_person', {
    p_local_label: label, p_calendar: 'solar',
    p_original_date: birth.date, p_solar_date: birth.date, p_birth_time: '14:30',
    p_gender: birth.gender, p_city: birth.city, p_late_night_rule: 'jo', p_time_basis: 'localMean',
  });
  await client.from('discovery_profile').insert({ nickname: label, prefer_gender: 'any' });
  await client.rpc('set_discovery_participation', {
    p_on: true,
    p_summary: {
      glyphCount: 8,
      counts: { 木: 2, 火: 2, 土: 2, 金: 1, 水: 1 },
      ratios: { 木: 0.25, 火: 0.25, 土: 0.25, 金: 0.125, 水: 0.125 },
    },
  });
  return client;
};

const a = await person(mail.a, NAME.a, BIRTH.a);
const b = await person(mail.b, NAME.b, BIRTH.b);
hideOthers(mail.a);
hideOthers(mail.b);

/** 비공개 궁합의 대상 — 내가 등록한 사람 */
const { data: momId } = await a.rpc('create_managed_person', {
  p_local_label: '엄마', p_note: null, p_calendar: 'solar',
  p_original_date: '1962-03-02', p_solar_date: '1962-03-02', p_birth_time: '07:10',
  p_gender: 'female', p_city: '대구', p_late_night_rule: 'jo', p_time_basis: 'localMean',
});

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

/** 모델이 냈다고 치는 글 — 검사 문장이 걸리지 않게 간지도 날짜도 넣지 않는다 */
const OUTPUT = {
  self: `## 한 줄로\n${'스스로 정한 규칙 안에서 오래 버티는 사람입니다. '.repeat(20)}`,
  private: `## 한 줄로\n${'둘은 서로 다른 속도로 같은 방향을 봅니다. '.repeat(20)}`,
  match: `## 한 줄로\n${'첫 번째 분과 두 번째 분은 서로의 빈자리를 채웁니다. '.repeat(20)}`,
};

/**
 * 모델을 부르지 않고 결과 한 벌을 저장한다 — 시작과 저장 RPC 는 진짜를 부른다.
 *
 * 시작은 **사용자 JWT** 로(자격을 `auth.uid()` 가 판정한다), 저장은 **열쇠**로 한다.
 * 서버가 하는 것과 같은 차례다.
 */
const saveAs = async (client, kind, target, output, score) => {
  const started = await client.rpc('start_reading_run', {
    p_kind: kind,
    p_idempotency_key: `check-${kind}-${stamp}`,
    p_person_a: target.personA ?? null,
    p_person_b: target.personB ?? null,
    p_match_id: target.matchId ?? null,
    p_model: 'openai/gpt-5.6-luna',
    p_prompt_version: 'reading-prompt-v1',
  });
  if (started.error) return { error: started.error };

  const run = started.data?.[0];
  if (!run) return { error: new Error('시도가 시작되지 않았다') };

  const saved = await keyed().rpc('save_reading', {
    p_run_id: run.run_id,
    p_revision_a: run.revision_a,
    p_revision_b: run.revision_b,
    p_output: output,
    p_score: score,
    p_evidence: '{"contract":{"version":"evidence-v0"},"charts":{}}',
    p_prompt: '# 역할\n검사용 프롬프트 원문',
    p_prompt_version: 'reading-prompt-v1',
    p_model: 'openai/gpt-5.6-luna',
    p_generation: { provider: 'vercel-ai-gateway', settings: {} },
    p_viewed_at: new Date().toISOString(),
  });
  return { error: saved.error, run };
};

try {
  // ── 1. 조회는 AI 를 부르지 않는다 ─────────────────────────────────────────
  {
    const mine = await body('/me', cookie.a);
    check('내 사주에 AI 해석 칸이 선다', mine.includes('AI 해석'));
    check('아직 없으면 없다고 말한다', plain(mine).includes('아직 AI 해석을 만들지 않았습니다'));
    check('만드는 버튼이 선다', mine.includes('AI 해석 만들기'));
    check('넘기지 않는 것을 화면이 말한다', plain(mine).includes('넣지 않은 값은 나올 수 없습니다'));
  }

  // ── 2. 자기 풀이 ─────────────────────────────────────────────────────────
  {
    const saved = await saveAs(a, 'self', {}, OUTPUT.self, null);
    check('자기 풀이가 저장된다', !saved.error, saved.error?.message ?? '');

    const mine = plain(await body('/me', cookie.a));
    check('저장한 글이 화면에 선다', mine.includes('스스로 정한 규칙 안에서'));
    check('자기 풀이에는 점수가 서지 않는다', !mine.includes('실험 중인 해석이 붙인 값'));
    check('다시 열어도 그대로라고 말한다', mine.includes('화면을 다시 열어도'));

    /** 근거와 프롬프트는 **사용자 화면의 것이 아니다** */
    check('근거가 사용자 화면에 없다', !mine.includes('evidence-v0'));
    check('프롬프트가 사용자 화면에 없다', !mine.includes('검사용 프롬프트 원문'));
  }

  // ── 3. 비공개 궁합 ───────────────────────────────────────────────────────
  {
    const { data: account } = await a.from('app_user').select('self_person_id').maybeSingle();
    const pair = `?a=${account.self_person_id}&b=${momId}`;

    const before = plain(await body(`/me/compat${pair}`, cookie.a));
    check('저장된 사람끼리 궁합에는 아직 AI 해석 칸이 서지 않는다', !before.includes('AI 해석'));
    for (const word of ['match-v0', '100점 만점 베타 탐색 지표']) {
      check(`내부 지표(${word})가 로그인 화면에 없다`, !before.includes(word));
    }

    const saved = await saveAs(
      a, 'private',
      { personA: account.self_person_id, personB: momId },
      OUTPUT.private, 71,
    );
    check('비공개 궁합이 저장된다', !saved.error, saved.error?.message ?? '');

    const current = await a.rpc('my_reading', {
      p_kind: 'private', p_person_a: account.self_person_id, p_person_b: momId,
    });
    check('비공개 궁합이 공통 조회 계약으로 읽힌다',
      current.data?.[0]?.output?.includes('둘은 서로 다른 속도로'));
    check('비공개 궁합 점수가 같은 결과에 있다', current.data?.[0]?.score === 71);

    const after = plain(await body(`/me/compat${pair}`, cookie.a));
    check('준비된 비공개 궁합도 아직 사용자 화면에는 서지 않는다',
      !after.includes('둘은 서로 다른 속도로'));
  }

  // ── 4. 공유 궁합 — 양쪽이 같은 글을 읽는다 ───────────────────────────────
  let matchId;
  {
    await a.rpc('discovery_board');
    const asked = await a.rpc('request_match', { p_candidate_user_id: await userIdOf(mail.b) });
    check('요청이 선다', !asked.error, asked.error?.message ?? '');
    const accepted = await b.rpc('respond_to_match_request', { p_request_id: asked.data, p_accept: true });
    check('수락하면 Match 가 선다', accepted.data === 'accepted', accepted.error?.message ?? '');

    const { data: matches } = await a.rpc('my_matches');
    matchId = matches?.[0]?.match_id;

    const saved = await saveAs(a, 'match', { matchId }, OUTPUT.match, 64);
    check('공유 궁합이 저장된다', !saved.error, saved.error?.message ?? '');

    const mine = plain(await body(`/me/match/${matchId}`, cookie.a));
    const theirs = plain(await body(`/me/match/${matchId}`, cookie.b));

    check('양쪽이 같은 글을 읽는다',
      mine.includes('서로의 빈자리를 채웁니다') && theirs.includes('서로의 빈자리를 채웁니다'));
    check('양쪽이 같은 점수를 본다', mine.includes('64') && theirs.includes('64'));

    /**
     * **자리는 뒤집히지 않고 안내만 갈린다.** 글 하나를 둘이 읽으므로 「첫 번째 분」이
     * 누구인지는 화면이 말한다 — 글을 뒤집어 그리면 두 사람이 다른 글을 읽게 된다.
     */
    check('내가 앞인지 화면이 말한다',
      mine.includes('「첫 번째 분」이') && theirs.includes('「첫 번째 분」이'));
    check('그 안내가 서로 다르다',
      mine.includes('「첫 번째 분」이 나이고') !== theirs.includes('「첫 번째 분」이 나이고'));

    check('매인 판본으로 났다고 말한다', mine.includes('동의한 그때의 입력으로 썼습니다'));

    /** 상대에게 준비 완료가 뜬다 — 누른 사람에게는 안 뜬다 */
    const inbox = plain(await body('/me/requests', cookie.b));
    check('상대의 알림함에 준비 완료가 뜬다', inbox.includes('궁합 해석이 새로 만들어졌습니다'));
    const mineInbox = plain(await body('/me/requests', cookie.a));
    check('누른 사람에게는 뜨지 않는다', !mineInbox.includes('궁합 해석이 새로 만들어졌습니다'));
  }

  // ── 5. 표는 브라우저가 직접 못 읽는다 ────────────────────────────────────
  {
    const rows = await a.from('reading').select('output');
    const runs = await a.from('reading_run').select('status');
    check('결과 표를 직접 못 읽는다', rows.error !== null, rows.error?.message ?? '읽혔다');
    check('시도 기록도 직접 못 읽는다', runs.error !== null, runs.error?.message ?? '읽혔다');

    const scope = await a.rpc('reading_scope', { p_kind: 'self' });
    check('대상을 푸는 함수도 못 부른다', scope.error !== null, scope.error?.message ?? '불렸다');

    /**
     * **저장하는 문이 브라우저에 닫혀 있는가**(ADR 0013).
     *
     * 열려 있으면 로그인한 사람이 모델·redaction·출력 검사를 다 건너뛰고 Match 상대에게
     * 임의의 글을 보낼 수 있다. 브라우저와 같은 길(PostgREST)로 두드려 본다.
     */
    const forged = await a.rpc('save_reading', {
      p_run_id: '00000000-0000-0000-0000-000000000000',
      p_revision_a: '00000000-0000-0000-0000-000000000000',
      p_revision_b: null,
      p_output: '지어낸 글',
      p_score: null,
      p_evidence: '{}',
      p_prompt: 'x',
      p_prompt_version: 'x',
      p_model: 'x',
      p_generation: {},
      p_viewed_at: new Date().toISOString(),
    });
    check('결과를 저장하는 문은 브라우저가 못 두드린다', forged.error !== null,
      forged.error?.message ?? '저장됐다');
  }

  // ── 6. 내부 보기 화면에는 근거와 프롬프트가 있다 ─────────────────────────
  {
    const inspect = plain(await body('/me/reading/inspect?kind=self', cookie.a));
    check('내부 화면이 열린다', inspect.includes('해석 내부 보기'));
    check('실제로 보낸 프롬프트가 보인다', inspect.includes('검사용 프롬프트 원문'));
    check('보낸 근거가 보인다', inspect.includes('evidence-v0'));
    check('프롬프트 판본이 보인다', inspect.includes('reading-prompt-v1'));

    const stranger = await get('/me/reading/inspect?kind=self', cookie.b);
    const other = plain(await stranger.text());
    check('남의 결과는 그 화면에도 안 나온다', !other.includes('검사용 프롬프트 원문'));
  }

  // ── 7. 공유 결과는 매인 판본에 서 있다 ───────────────────────────────────
  {
    const { data: account } = await b.from('app_user').select('self_person_id').maybeSingle();
    await b.rpc('add_person_revision', {
      p_person_id: account.self_person_id,
      p_calendar: 'solar', p_original_date: BIRTH.b.date, p_solar_date: BIRTH.b.date,
      p_birth_time: '05:20', p_gender: BIRTH.b.gender, p_city: BIRTH.b.city,
      p_late_night_rule: 'jo', p_time_basis: 'localMean',
    });

    const after = plain(await body(`/me/match/${matchId}`, cookie.a));
    check('상대가 입력을 고쳐도 공유 결과의 글은 그대로다',
      after.includes('서로의 빈자리를 채웁니다'));
    check('그래도 「이전 입력으로 썼다」고 말하지 않는다', !after.includes('이전 출생정보로 썼습니다'));

    /** 자기 풀이는 반대다 — 지금 판본이 아니면 그렇게 말한다 */
    const mineAccount = await a.from('app_user').select('self_person_id').maybeSingle();
    await a.rpc('add_person_revision', {
      p_person_id: mineAccount.data.self_person_id,
      p_calendar: 'solar', p_original_date: BIRTH.a.date, p_solar_date: BIRTH.a.date,
      p_birth_time: '09:40', p_gender: BIRTH.a.gender, p_city: BIRTH.a.city,
      p_late_night_rule: 'jo', p_time_basis: 'localMean',
    });

    const mine = plain(await body('/me', cookie.a));
    check('자기 풀이는 이전 입력으로 썼다고 말한다', mine.includes('이전 출생정보로 썼습니다'));
    check('그래도 글은 그대로 서 있다', mine.includes('스스로 정한 규칙 안에서'));
  }
} finally {
  stop();
}

async function userIdOf(email) {
  return sql(`select id from auth.users where email = '${email}'`);
}

const failed = checks.filter((one) => !one.pass);
console.log(`\n${checks.length - failed.length}/${checks.length} 통과`);
if (failed.length > 0) process.exit(1);
