/**
 * 현재 사주풀이를 **실제 스택에 대고** 돌린다 — 모델만 빼고.
 *
 * 모델을 부르지 않는다. 부르면 검사가 느려지고 값이 매번 달라지며 돈이 든다. 대신
 * **모델이 냈다고 치고** 저장 RPC 를 그대로 부른다 — 근거를 자르고 프롬프트를 짓고
 * 검사하는 절반은 단위 시험이 이미 재고 있고(`src/lib/reading`), 여기서 재려는 것은
 * **화면과 RPC 가 실제로 이어져 있는가**다.
 *
 * 1. **화면 조회가 AI 를 부르지 않는가** — 없으면 없다고 말하고 버튼만 선다.
 * 2. **저장된 글이 화면에 서는가** — 세 kind 를 다 잰다.
 * 3. **근거와 프롬프트가 사용자 화면에 없는가** — 그 둘은 내부 화면의 것이다.
 * 4. **양쪽이 같은 글을 읽는가** — 「첫 번째 분」이 누구인지는 자리마다 다르게 적힌다.
 * 5. **표를 브라우저가 직접 못 읽는가** — 근거가 그 안에 있다.
 * 6. **매인 판본으로 서 있는가** — 한쪽이 입력을 고쳐도 공유 결과의 글이 안 바뀐다.
 * 7. **실패가 알림함에 서는가** — 만드는 일이 누름에서 떠난 뒤로 실패를 말할 화면이
 *    없을 수 있다(ADR 0016). 그 줄이 어디를 다시 눌러야 하는지까지 들어야 한다.
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
  self: `## 한 줄로\n${'스스로 정한 규칙 안에서 오래 버티는 사람입니다. '.repeat(20)}\n\n### 근거 (검사용)\n한 줄로 — analysis.strength [유도]`,
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
    p_model: 'gpt-5.6-luna',
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
    p_model: 'gpt-5.6-luna',
    p_generation: { provider: 'openai-responses-api', settings: { store: false } },
    p_viewed_at: new Date().toISOString(),
  });
  return { error: saved.error, run };
};

try {
  // ── 1. 조회는 모델을 부르지 않는다 ───────────────────────────────────────
  {
    const mine = await body('/me', cookie.a);
    check('내 사주에 사주풀이 칸이 선다', mine.includes('나의 사주풀이'));
    check('아직 없으면 없다고 말한다', plain(mine).includes('아직 만들어 둔 사주풀이가 없습니다'));
    check('만드는 버튼이 선다', mine.includes('사주풀이 받기'));
    check('누가 쓰는지는 버튼 옆에 남는다', plain(mine).includes('언어 모델이 씁니다'));
    check('넘기지 않는 것을 화면이 말한다', plain(mine).includes('넣지 않은 값은 나올 수 없습니다'));
    check('풀이권이 버튼 옆에 선다', plain(mine).includes('풀이권 5번 중 5번 남음'));
  }

  // ── 2. 자기 풀이 ─────────────────────────────────────────────────────────
  {
    const saved = await saveAs(a, 'self', {}, OUTPUT.self, null);
    check('자기 풀이가 저장된다', !saved.error, saved.error?.message ?? '');

    const mine = plain(await body('/me', cookie.a));
    check('저장한 글이 화면에 선다', mine.includes('스스로 정한 규칙 안에서'));
    check('내부 검토용 근거 절은 사용자 결과에서 숨긴다', !mine.includes('근거 (검사용)'));
    check('자기 풀이에는 점수가 서지 않는다', !mine.includes('실험 중인 풀이가 붙인 값'));
    check('다시 열어도 그대로라고 말한다', mine.includes('화면을 다시 열어도'));
    check('만들면 풀이권이 하나 준다', mine.includes('풀이권 5번 중 4번 남음'));

    /**
     * **설문 전체가 동의 뒤에 있다.**
     *
     * 점수와 태그도 `respondent_user_id` 와 시도에 매여 제품 개선에 쓰인다. 「선택
     * 동의를 거절했다고 서비스가 좁아지면 안 된다」가 지키라는 것은 **사주 서비스**이지
     * 개선 자료 수집이 아니다.
     *
     * 그리고 「동의하면 더 답할 수 있어요」 같은 줄도 없다 — 거절한 사람에게 거절을
     * 다시 보여 주는 자리가 된다.
     */
    check('동의 전에는 설문이 통째로 없다', !mine.includes('이 풀이는 어떠셨어요'));
    check('점수 문항도 없다', !mine.includes('실제 경험과 얼마나 비슷했나요'));
    check('적는 칸도 없다', !mine.includes('어느 대목이 맞았고'));
    check('동의를 권하는 줄도 없다', !mine.includes('동의하면'));

    /** **그래도 사주는 그대로다** — 닫히는 것은 설문 하나뿐이다 */
    check('동의 전에도 풀이는 그대로 선다', mine.includes('스스로 정한 규칙 안에서'));
    check('동의 전에도 만드는 버튼은 그대로다', mine.includes('풀이권 5번 중 4번 남음'));

    const userA = await userIdOf(mail.a);
    sql(`update public.app_user set improvement_consent = true where id = '${userA}'`);

    /**
     * 여기서 재는 것은 배선이다 — 저장이 `source_run_id` 를 적었고, `my_reading` 이
     * 그 값을 냈고, 화면이 그 자리에 칸을 세웠다. 셋 중 하나만 빠져도 빨개진다.
     */
    const consented = plain(await body('/me', cookie.a));
    check('동의하면 설문이 글 아래에 선다', consented.includes('이 풀이는 어떠셨어요'));
    check('어느 글에 대한 답인지 말한다', consented.includes('지금 읽은 이 풀이에 대한 답입니다'));
    /*
      「정확」만 보고 재면 안 된다 — 같은 화면에 「정확한 생년월일시는 넘기지 않습니다」가
      이미 서 있다(ADR 0008). 재려는 것은 **묻는 말**이므로 낱말을 좁혀서 본다.
    */
    check('「정확도」라고 묻지 않는다',
      !consented.includes('정확도') && consented.includes('실제 경험과 얼마나 비슷했나요'));
    check('적는 칸이 열린다', consented.includes('어느 대목이 맞았고 어느 대목이 달랐나요'));
    check('넓게 묻지 않는다', consented.includes('풀이의 문장을 가리켜 주시면'));
    check('한도가 화면에 선다', consented.includes('200자'));

    /**
     * 답을 남기면 화면이 그 사실로 선다.
     *
     * **누르는 길은 여기서 안 잰다** — 이 검사는 JS 를 안 돌린다. 그 길은 e2e 가
     * 실제 브라우저로 잰다(`signed-in.spec.ts`). 여기서 재는 것은 RPC 와 화면 사이의
     * 배선이고, 특히 **남긴 답이 그대로 다시 내려오는가**다.
     */
    const answered = await a.rpc('leave_reading_feedback', {
      p_run_id: saved.run.run_id,
      p_usefulness: 4,
      p_perceived_fit: 2,
      p_felt_length: 'long',
      p_issue_tags: ['abstract', 'repetitive', 'assertive', 'jargon', 'mismatch', 'ui'],
      p_comment: '두 번째 문단이 제일 맞았어요',
    });
    check('여섯 태그를 다 넣어도 받는다', !answered.error, answered.error?.message ?? '');

    const thanked = plain(await body('/me', cookie.a));
    check('답한 뒤에는 고맙다고 말한다', thanked.includes('답해 주셔서 고맙습니다'));
    check('고칠 수 있다고도 말한다', thanked.includes('답 고치기'));

    /**
     * **동의를 철회하면 그때까지 받은 답이 지워진다.**
     *
     * 「앞으로는 안 받는다」로만 두면 사용자는 자기가 철회한 뒤에도 자기 답이 개선에
     * 쓰이는 것을 모른다.
     */
    await a.rpc('set_improvement_consent', { p_consent: false });
    const left = Number(sql(
      `select count(*) from public.reading_feedback where respondent_user_id = '${userA}'`));
    check('철회하면 받아 둔 답이 남지 않는다', left === 0, `${left}줄 남음`);

    const withdrawn = plain(await body('/me', cookie.a));
    check('철회하면 설문도 화면에서 사라진다', !withdrawn.includes('이 풀이는 어떠셨어요'));
    check('그래도 풀이는 그대로 선다', withdrawn.includes('스스로 정한 규칙 안에서'));

    sql(`update public.app_user set improvement_consent = true where id = '${userA}'`);

    /** 근거와 프롬프트는 **사용자 화면의 것이 아니다** */
    check('근거가 사용자 화면에 없다', !mine.includes('evidence-v0'));
    check('프롬프트가 사용자 화면에 없다', !mine.includes('검사용 프롬프트 원문'));
  }

  // ── 3. 비공개 궁합 ───────────────────────────────────────────────────────
  {
    const { data: account } = await a.from('app_user').select('self_person_id').maybeSingle();
    const pair = `?a=${account.self_person_id}&b=${momId}`;

    const before = plain(await body(`/me/compat${pair}`, cookie.a));
    /**
     * 이 두 줄은 「아직 안 선다」를 재고 있었다. `b6e1893` 이 그 칸을 세웠는데 여기가
     * 안 따라와서, 그 뒤로 흐름 검사가 **고쳐진 것을 고장이라고 부르고 있었다.**
     */
    check('저장된 사람끼리 궁합에도 사주풀이 칸이 선다', before.includes('사주풀이'));
    /**
     * **명식은 접혀 있다.** 사람이 보러 온 것은 읽어 주는 글인데, 그 앞에 표 스물몇
     * 개를 세워 두면 글까지 내려오지 못한다. 시험이 끝나면 이 칸은 통째로 내린다.
     */
    check('둘의 명식은 접어 둔다', before.includes('둘의 명식 보기'));
    /** 상세 화면에서는 글을 또 펼치라고 하지 않는다 — 그 글을 읽으러 온 자리다 */
    check('풀이 전문을 접는 버튼이 없다', !before.includes('펼쳐보기'));
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
    check('준비된 비공개 궁합이 사용자 화면에 선다',
      after.includes('둘은 서로 다른 속도로'));

    /**
     * **사이는 고르는 칸 옆에서 묻는다.**
     *
     * 관계를 묻는 까닭이 「사이에 따라 해석의 방향을 달리 잡겠다」는 것이라, 읽고 난
     * 뒤에 묻는 것은 아무 뜻이 없다 — 이미 나온 글은 그 답을 못 쓴다.
     */
    const picker = plain(await body('/me/compat', cookie.a));
    check('고르는 화면이 무슨 사이인지 묻는다', picker.includes('두 분은 무슨 사이인가요'));
    check('점수에 안 쓴다는 것도 그 자리에서 말한다', picker.includes('점수에는 쓰지 않습니다'));
    /**
     * **상세 화면에서도 묻는다 — 다만 다음 글을 위해서다.**
     *
     * 이 줄은 「상세 화면에서는 다시 묻지 않는다」였다. 고르는 칸에서만 물었으므로
     * 처음에 안 골랐거나 잘못 고른 사람은 바꿀 길이 없다는 것이 뒤에 드러났고, 그래서
     * 만드는 버튼 옆에 고치는 칸이 섰다(`RelationForNext`). 「읽기 전에 묻는다」(ADR
     * 0019)는 그대로다 — 이 칸이 바꾸는 것은 지금 서 있는 글이 아니라 다음 글이다.
     *
     * 검사가 그 결정을 안 따라와 이 자리는 그동안 빨간 채로 서 있었다.
     */
    check('상세 화면에서는 다음 글을 위해 묻는다', after.includes('두 분은 무슨 사이인가요'));
    check('지금 서 있는 글은 안 바뀐다고 말한다',
      after.includes('다시 풀이받을 때부터 이 사이로 읽어 드려요'));

    const set = await a.rpc('set_pair_relation', {
      p_person_a: momId, p_person_b: account.self_person_id, p_relation: 'family',
    });
    check('궁합 화면이 쌍의 사이를 적는다', set.error === null, set.error?.message ?? '');

    const asked = await a.rpc('pair_relation_of', {
      p_person_a: account.self_person_id, p_person_b: momId,
    });
    check('차례를 뒤집어 물어도 같은 답이다', asked.data === 'family', String(asked.data));

    /** 남의 쌍은 안 읽힌다 — 안 읽히면 남의 관계로 내 글이 달라질 길도 없다 */
    const stranger = await b.rpc('pair_relation_of', {
      p_person_a: account.self_person_id, p_person_b: momId,
    });
    check('남이 적어 둔 사이는 안 읽힌다', !stranger.data, String(stranger.data));
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

  // ── 8. 실패는 알림함에 서고 다시 누를 자리까지 닿는다 ────────────────────
  {
    /**
     * **만드는 일이 누름에서 떠났다**(ADR 0016). 탭을 닫으면 실패를 말할 화면이
     * 없으므로 알림함이 그 자리를 멘다. 여기서 재는 것은 두 가지다 — 그 줄이 서는가,
     * 그리고 **어느 것을 다시 눌러야 하는지** 말하는가.
     */
    const before = plain(await body('/me/requests', cookie.a));
    check('아직 실패 알림은 없다', !before.includes('만들지 못했습니다'));

    const opened = await a.rpc('start_reading_run', {
      p_kind: 'self', p_idempotency_key: `check-fail-self-${stamp}`,
    });
    check('자기 풀이 시도가 열린다', !opened.error && opened.data?.[0]?.run_id,
      opened.error?.message ?? '');

    await a.rpc('fail_reading_run', {
      p_run_id: opened.data[0].run_id,
      p_failure_code: 'model-call-failed',
      p_failure_detail: '모델이 안 왔다',
    });

    const told = await body('/me/requests', cookie.a);
    const text = plain(told);
    check('실패가 알림함에 선다', text.includes('내 사주풀이를 만들지 못했습니다'));
    check('지금 보이는 글은 그대로라고 말한다', text.includes('지금 보이는 글은 그대로입니다'));
    check('다시 누를 자리로 가는 링크가 붙는다', told.includes('href="/me"'));

    /** **어느 궁합인지**까지 말한다 — 비공개 궁합은 두 사람을 다시 골라야 닿는 자리다 */
    const { data: account } = await a.from('app_user').select('self_person_id').maybeSingle();
    const pairRun = await a.rpc('start_reading_run', {
      p_kind: 'private', p_idempotency_key: `check-fail-private-${stamp}`,
      p_person_a: account.self_person_id, p_person_b: momId,
    });
    await a.rpc('fail_reading_run', {
      p_run_id: pairRun.data[0].run_id,
      p_failure_code: 'model-no-output',
      p_failure_detail: '모양이 아니다',
    });

    const both = await body('/me/requests', cookie.a);
    const pair = [account.self_person_id, momId].sort();
    check('궁합 실패는 그 두 사람의 화면으로 간다',
      both.includes(`/me/compat?a=${pair[0]}&amp;b=${pair[1]}`));

    /** 남의 실패는 내 알림함에 없다 — 시도는 부른 사람의 것이다 */
    const stranger = plain(await body('/me/requests', cookie.b));
    check('남의 실패는 내 알림함에 안 선다', !stranger.includes('만들지 못했습니다'));

    /**
     * **실패는 풀이권을 먹지 않는다.** 여기까지 성공한 것은 셋(자기·비공개·Match)이고
     * 방금 둘이 실패했다. 반환하는 일을 아무도 하지 않았는데 잔액이 그대로여야 한다 —
     * 그것이 「차감하고 반환한다」가 아니라 「센다」로 만든 이유다.
     */
    const after = plain(await body('/me', cookie.a));
    check('실패한 시도는 풀이권을 쓰지 않는다', after.includes('풀이권 5번 중 2번 남음'));
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
