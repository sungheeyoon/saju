/**
 * 공유 결과를 **실제 스택에 대고** 돌린다 — AI 없이 전체 동의 흐름을 끝까지.
 *
 * 이 단계는 앱 코드에 기대는 자리가 하나 있다(ADR 0010): 서버가 두 판본을 읽어
 * 계산하고 **잘라서** 내려보낸다. 자르는 일이 앱에 있으면 밖에서 재야 한다.
 *
 * 1. **결과 화면이 실제로 서는가** — 요청·수락 화면이 「열린다」고 적은 것이 정말 열리는지.
 * 2. **두 사람이 같은 지표를 보는가**(US 47) — 보는 사람이 언제나 `a` 자리에 서므로,
 *    자리가 뒤집혀도 숫자가 같아야 공유가 성립한다.
 * 3. **출생 원문이 응답에 없는가**(US 49) — 서버가 두 판본을 손에 들고 있는 화면이라,
 *    「안 내보낸다」는 약속을 본문을 봐야 확인할 수 있다.
 * 4. **매인 판본으로 나는가** — 한쪽이 입력을 고쳐도 결과가 움직이지 않아야 한다.
 * 5. **열쇠 없이는 못 여는가** — 로그인한 사람이 RPC 를 그대로 두드리는 경로.
 */
import { createClient } from '@supabase/supabase-js';
import { createServerClient } from '@supabase/ssr';
import { execFileSync } from 'node:child_process';

import { startCheckServer } from './next-server.mjs';
import { passNotice } from './notice.mjs';

const status = JSON.parse(execFileSync('npx', ['supabase', 'status', '-o', 'json'], { encoding: 'utf8' }));
const API = status.API_URL;
const PORT = Number(process.env.CHECK_PORT ?? 3213);

const anon = () => createClient(API, status.ANON_KEY, { auth: { persistSession: false } });

const checks = [];
const check = (name, pass, detail = '') => {
  checks.push({ name, pass, detail });
  console.log(`${pass ? 'ok  ' : 'FAIL'} ${name}${detail ? ` — ${detail}` : ''}`);
};

const stamp = Date.now();
/** 별명에 이번 실행의 꼬리표 — 지난 실행의 동명이인이 검사를 헛디디게 하지 않는다 */
const tag = String(stamp).slice(-4);
const NAME = { a: `민결${tag}`, b: `지결${tag}`, c: `현결${tag}` };

/** 두 사람의 출생을 **또렷하게 다르게** 잡는다 — 무엇이 새는지 문자열로 잴 수 있게 */
const BIRTH = {
  a: { date: '1990-05-15', city: '서울', gender: 'male' },
  b: { date: '1992-03-03', city: '부산', gender: 'female' },
  c: { date: '1988-11-20', city: '대구', gender: 'male' },
};

const password = `pw-${stamp}-Aa1!`;
const mail = {
  a: `res-a-${stamp}@example.com`,
  b: `res-b-${stamp}@example.com`,
  c: `res-c-${stamp}@example.com`,
};

const sql = (statement) =>
  execFileSync('docker', ['exec', '-i', 'supabase_db_saju', 'psql', '-U', 'postgres', '-tAq', '-c', statement],
    { encoding: 'utf8' }).trim();

const userId = (email) => sql(`select id from auth.users where email = '${email}'`);

sql(`insert into public.invite (email, note) values
     ('${mail.a}', '검사'), ('${mail.b}', '검사'), ('${mail.c}', '검사')`);

const person = async (email, label, birth) => {
  const client = anon();
  await client.auth.signUp({ email, password });
  await passNotice(client);
  await client.rpc('create_self_person', {
    p_local_label: label, p_calendar: 'solar',
    p_original_date: birth.date, p_solar_date: birth.date, p_birth_time: '14:30',
    p_gender: birth.gender, p_city: birth.city, p_late_night_rule: 'jo', p_time_basis: 'localMean',
  });
  return client;
};

const a = await person(mail.a, '민수', BIRTH.a);
const b = await person(mail.b, '지영', BIRTH.b);
const c = await person(mail.c, '현우', BIRTH.c);

/** 모양만 맞는 가짜 요약 — 화면을 한 번 열면 자기 판본에서 다시 계산된다 */
const 가짜 = {
  glyphCount: 8,
  counts: { 木: 8, 火: 0, 土: 0, 金: 0, 水: 0 },
  ratios: { 木: 1, 火: 0, 土: 0, 金: 0, 水: 0 },
};

for (const [client, nickname] of [[a, NAME.a], [b, NAME.b], [c, NAME.c]]) {
  await client.from('discovery_profile').insert({ nickname, prefer_gender: 'any' });
  await client.rpc('set_discovery_participation', { p_on: true, p_summary: 가짜 });
}

/** 이번 실행의 사람들만 서로의 후보가 되게 한다 — 아니면 「DB 가 비어 있는가」를 잰다 */
const list = Object.values(mail).map((email) => `'${email}'`).join(', ');
sql(`insert into public.discovery_hidden (user_id, hidden_user_id)
     select mine.id, p.user_id
     from auth.users mine, public.discovery_profile p
     where mine.email in (${list})
       and p.user_id not in (select id from auth.users where email in (${list}))
     on conflict do nothing`);

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

const cookie = {
  a: await cookieFor(mail.a),
  b: await cookieFor(mail.b),
  c: await cookieFor(mail.c),
};

const { base: BASE, stop } = await startCheckServer({
  port: PORT,
  supabaseUrl: API,
  anonKey: status.ANON_KEY,
  // **로컬 열쇠다.** 이 화면 하나가 이것으로 매인 판본을 읽는다(ADR 0010).
  secretKey: status.SERVICE_ROLE_KEY,
});

const get = (path, jar) => fetch(`${BASE}${path}`, { headers: jar ? { cookie: jar } : {}, redirect: 'manual' });
const body = async (path, jar) => (await get(path, jar)).text();
/** React 는 나란한 글자 마디 사이에 `<!-- -->` 를 넣는다. 문장을 견줄 때 지운다 */
const plain = (html) => html.replace(/<!--\s*-->/g, '');

/**
 * **`match-v0` 는 이 화면에서 내려갔다**(9단계).
 *
 * 사용자에게 보이는 점수는 현재 Reading 의 일부이고, 한 화면에 점수가 둘이면 무엇을
 * 믿을지 사용자가 정해야 한다. 그래서 여기서 재는 것은 **그 지표가 없다는 것**이다 —
 * 지표 자체는 익명 화면에 그대로 있고 그쪽은 e2e 가 잰다.
 */
const NO_INDEX = ['match-v0', '100점 만점 베타 탐색 지표', '입력 완성도'];

/**
 * 두 원국 **사이의 관계** 칸 전체 — 매인 판본으로 났는지 재는 자리.
 *
 * 판본이 바뀌면 걸린 글자와 자리가 바뀐다. 큰 수 하나 대신 칸을 통째로 견주는 것은
 * 지표가 이 화면에서 내려갔기 때문이다.
 */
const betweenOf = (html) =>
  (/두 원국 사이의 관계[\s\S]*?(?=두 사람의 궁합 풀이)/.exec(plain(html)) ?? [null])[0];

try {
  // ── 1. 후보 → 요청 → 수락 ─────────────────────────────────────────────────
  /**
   * 둘 다 연 **뒤에** 민수가 한 번 더 연다.
   *
   * 첫 화면에서 각자 자기 요약을 판본에서 다시 계산하므로, 상대가 아직 안 열었을 때
   * 남은 노출 기록은 **지금의 그 사람이 아니다.** 요청은 그런 기록으로는 나지 않는다
   * (ADR 0009).
   */
  await get('/me/discovery', cookie.a);
  await get('/me/discovery', cookie.b);
  await get('/me/discovery', cookie.a);

  const asked = await a.rpc('request_match', { p_candidate_user_id: userId(mail.b) });
  check('후보로 본 사람에게 청한다', !asked.error, asked.error?.message ?? '');

  const accepted = await b.rpc('respond_to_match_request', {
    p_request_id: asked.data, p_accept: true,
  });
  check('수락하면 Match 가 선다', accepted.data === 'accepted', accepted.error?.message ?? '');

  const { data: matches } = await a.rpc('my_matches');
  const matchId = matches?.[0]?.match_id;
  check('내 Match 목록에서 그 Match 를 집는다', typeof matchId === 'string',
    `${matches?.length ?? '?'}건`);

  // ── 2. 결과 화면이 선다 ───────────────────────────────────────────────────
  const opened = await get(`/me/match/${matchId}`, cookie.a);
  const mine = await opened.text();
  const theirs = await body(`/me/match/${matchId}`, cookie.b);

  /**
   * **상태 코드부터 본다.** 제목은 못 연 화면에도 남는다 — 거절은 이 경로의 메타데이터를
   * 그대로 쓰면서 본문만 갈아 끼우기 때문이다(재어 봤다: 없는 Match 로도 제목이 맞았다).
   */
  check('결과 화면이 열린다', opened.status === 200, String(opened.status));
  check('상대는 공개용 별명으로 불린다', mine.includes(NAME.b) && theirs.includes(NAME.a));
  check('두 원국 사이의 관계가 선다', mine.includes('두 원국 사이의 관계'));
  check('중립적인 문장이 함께 선다', mine.includes('두 사람 사이에 대해 말할 수 있는 것'));

  /**
   * **점수 자리가 하나다.** 내부 지표는 사용자 화면에 서지 않는다(PRD).
   */
  for (const word of NO_INDEX) {
    check(`내부 지표(${word})가 결과 화면에 없다`, !mine.includes(word));
  }

  /** 사주풀이 칸은 서되, 아직 만들지 않았으면 **그렇게 말한다** */
  check('사주풀이 칸이 선다', mine.includes('두 사람의 궁합 풀이'));
  check('아직 만들지 않았으면 그렇게 말한다', plain(mine).includes('아직 만들어 둔 사주풀이가 없습니다'));
  check('두 사람이 같은 상태를 본다',
    plain(theirs).includes('아직 만들어 둔 사주풀이가 없습니다'));

  // ── 3. 동의할 때 읽은 목록을 결과에서도 읽는다 ────────────────────────────
  {
    const text = plain(mine);
    check('결과 화면도 열리는 것과 열리지 않는 것을 함께 적는다',
      mine.includes('서로에게 열리는 것') && mine.includes('열리지 않는 것'));
    check('열리지 않는 것에 출생 원문이 그대로 적혀 있다',
      mine.includes('정확한 생년월일시와 출생지'));
    check('관계를 합치면 여덟 글자가 전부 보일 수 있음을 적는다',
      text.includes('여덟 글자가 전부 보일 수 있습니다'));
    /** 「매인 판본」은 내부어다 — 사용자에게는 동의하신 그때의 출생 정보다(ADR 0026) */
    check('동의한 그때의 출생 정보로 났다고 말한다',
      text.includes('동의하신 대상이 그때의 출생 정보이기 때문'));
    check('결과 화면에 내부어가 없다', !text.includes('판본'));
    check('조립된 문장과 궁합 풀이를 구별해 말한다', text.includes('곧바로 조립한 것입니다'));
    check('풀이를 누가 쓰는지 밝힌다', text.includes('언어 모델이 따로 써서'));
  }

  // ── 4. 출생 원문은 응답에 없다 ────────────────────────────────────────────
  {
    check('상대의 생년월일이 응답에 없다', !mine.includes(BIRTH.b.date));
    check('상대의 출생지가 응답에 없다', !mine.includes(BIRTH.b.city));
    check('내 생년월일도 이 화면에는 없다', !mine.includes(BIRTH.a.date));
    check('출생 시각이 응답에 없다', !mine.includes('14:30'));

    /**
     * **명식 표와 근거 패널은 이 화면에 아예 없다.**
     *
     * 궁합 화면은 두 명식을 나란히 놓고 근거까지 연다. 여기는 그 둘을 **받지 않는다** —
     * 낱말로 재는 대신, 그 칸들에만 서는 문장이 하나도 없는지를 본다.
     */
    check('상대의 명식 표가 서지 않는다', !plain(mine).includes('일간 '));
    check('근거 패널이 서지 않는다', !mine.includes('풀이에 넘기는 자료'));
    check('지금 도는 운이 서지 않는다', !mine.includes('지금 도는 운'));
    check('오행 개수표가 응답에 없다',
      !mine.includes('glyphCount') && !mine.includes('"counts"') && !mine.includes('"ratios"'));
  }

  // ── 5. 당사자가 아니면 없는 것과 같은 답이다 ──────────────────────────────
  {
    const stranger = await get(`/me/match/${matchId}`, cookie.c);
    const nothing = await get('/me/match/00000000-0000-0000-0000-000000000000', cookie.a);
    check('당사자가 아니면 못 연다', stranger.status === 404, String(stranger.status));
    check('없는 Match 와 **같은 상태 코드**다', stranger.status === nothing.status,
      `${stranger.status} vs ${nothing.status}`);

    const anonymous = await get(`/me/match/${matchId}`, null);
    check('로그인하지 않으면 로그인 화면으로 보낸다',
      anonymous.status === 307 && (anonymous.headers.get('location') ?? '').includes('/auth'),
      `${anonymous.status} ${anonymous.headers.get('location') ?? ''}`);
  }

  // ── 6. 브라우저가 직접 두드리는 길 ────────────────────────────────────────
  {
    const keyed = await a.rpc('match_calculation_inputs', { p_match_id: matchId });
    check('계산 입력 RPC 는 로그인한 사람이 못 부른다', keyed.error !== null,
      keyed.error?.message ?? `${keyed.data?.length ?? '?'}줄이 나왔다`);

    const narrowing = await a.rpc('visible_matches');
    check('좁힘을 든 함수도 직접 못 부른다', narrowing.error !== null,
      narrowing.error?.message ?? '열려 있다');

    /**
     * **판본 id 는 나가도 그 판본은 못 읽는다.**
     *
     * 결과 화면이 서려면 매인 판본 id 둘이 브라우저 쪽 함수에서 나가야 한다. 불투명
     * 식별자이고 접근은 정책이 잠근다 — 그 말이 참인지를 여기서 잰다.
     */
    const { data: rows } = await a.rpc('my_match_scope', { p_match_id: matchId });
    const partnerRevision = rows?.[0]?.partner_revision_id;
    check('내 자리에서 매인 판본 id 둘이 나온다',
      typeof partnerRevision === 'string' && typeof rows?.[0]?.my_revision_id === 'string');

    const peek = await a.from('person_chart_revision').select('*').eq('id', partnerRevision);
    check('그 id 를 알아도 상대의 판본은 못 읽는다', (peek.data ?? []).length === 0,
      `${peek.data?.length ?? '?'}줄`);
  }

  // ── 7. 매인 판본은 움직이지 않는다 ────────────────────────────────────────
  {
    const before = betweenOf(mine);

    const { data: account } = await b.from('app_user').select('self_person_id').maybeSingle();
    const revised = await b.rpc('add_person_revision', {
      p_person_id: account.self_person_id,
      p_calendar: 'solar', p_original_date: BIRTH.b.date, p_solar_date: BIRTH.b.date,
      p_birth_time: '05:20', p_gender: BIRTH.b.gender, p_city: BIRTH.b.city,
      p_late_night_rule: 'jo', p_time_basis: 'localMean',
    });
    check('상대가 출생 시각을 고친다', !revised.error, revised.error?.message ?? '');

    const reopened = await get(`/me/match/${matchId}`, cookie.a);
    const after = await reopened.text();
    check('성립한 Match 는 입력 수정으로 사라지지 않는다', reopened.status === 200,
      String(reopened.status));
    /**
     * **무엇으로 재는가가 바뀌었다.** 전에는 `match-v0` 지표의 큰 수 하나로 쟀는데,
     * 그 지표가 이 화면에서 내려갔다(9단계). 대신 두 원국 **사이의 관계** 칸을 통째로
     * 견준다 — 시주가 14:30 에서 05:20 으로 옮겨 가면 상대의 시지가 바뀌므로, 지금
     * 판본으로 다시 계산했다면 이 칸이 달라진다.
     *
     * 칸이 비어 있으면 이 검사는 아무것도 재지 않는다. 그래서 비어 있지 않은지도 함께 본다.
     */
    check('사이의 관계 칸이 비어 있지 않다', before !== null && before.length > 200,
      `${before?.length ?? 0}자`);
    check('**결과는 동의한 그때의 판본 그대로다**', betweenOf(after) === before);
  }

  // ── 8. 차단하면 결과도 내려간다 ───────────────────────────────────────────
  {
    await b.rpc('block_user', { p_user_id: userId(mail.a) });

    const blocked = await get(`/me/match/${matchId}`, cookie.b);
    const other = await get(`/me/match/${matchId}`, cookie.a);
    check('차단한 쪽에서 결과가 내려간다', blocked.status === 404, String(blocked.status));
    check('차단당한 쪽에서도 내려간다 — 한쪽에만 거는 규칙이 아니다',
      other.status === 404, String(other.status));
    check('그래도 Match 행은 지우지 않는다',
      Number(sql(`select count(*) from public.match where id = '${matchId}'`)) === 1);
  }
} finally {
  stop();
}

const failed = checks.filter((entry) => !entry.pass);
console.log(`\n${checks.length - failed.length}/${checks.length} 통과`);
process.exit(failed.length === 0 ? 0 : 1);
