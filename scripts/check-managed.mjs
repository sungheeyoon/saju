/**
 * 가족·친구 Person 과 저장된 두 사람의 궁합을 **실제 스택에 대고** 돌린다.
 *
 * 앞선 검사(`check-onboarding.mjs`)가 못 재는 것이 여기 둘 더 있다.
 *
 * 1. **화면이 쓰는 목록 질의가 도는가** — 정책이 옳아도 PostgREST 질의 모양이
 *    틀리면 목록은 빈 채로 나오고, 빈 목록은 「등록 안 됨」과 구별되지 않는다.
 * 2. **없는 사람과 못 보는 사람이 정말 같은 응답인가** — pgTAP 은 「둘 다 RLS 에서
 *    안 보인다」까지만 잰다. 그 뒤의 한 문장은 화면이 쓰므로, HTTP 상태·본문·화면
 *    종류가 같은지는 **서버를 세워 놓고 두 번 두드려야** 알 수 있다(ADR 0007 「이행」).
 *
 * 로컬 스택(`npm run db:start`)에 대고 돌고, Next 서버는 이 스크립트가 직접 띄운다.
 * 원격은 건드리지 않는다 — 접속값을 로컬로 넘겨서 띄우므로 `.env.*` 의 원격 값은
 * 덮인다(`@next/env` 는 이미 있는 환경변수를 덮어쓰지 않는다).
 */
import { createClient } from '@supabase/supabase-js';
import { createServerClient } from '@supabase/ssr';
import { execFileSync } from 'node:child_process';

import { startCheckServer } from './next-server.mjs';
import { passNotice } from './notice.mjs';

const status = JSON.parse(execFileSync('npx', ['supabase', 'status', '-o', 'json'], { encoding: 'utf8' }));
const API = status.API_URL;
const PORT = Number(process.env.CHECK_PORT ?? 3210);

const anon = () => createClient(API, status.ANON_KEY, { auth: { persistSession: false } });

const checks = [];
const check = (name, pass, detail = '') => {
  checks.push({ name, pass, detail });
  console.log(`${pass ? 'ok  ' : 'FAIL'} ${name}${detail ? ` — ${detail}` : ''}`);
};

const stamp = Date.now();
const password = `pw-${stamp}-Aa1!`;
const mine = `mine-${stamp}@example.com`;
const theirs = `theirs-${stamp}@example.com`;

const birth = {
  p_calendar: 'solar',
  p_original_date: '1990-05-15',
  p_solar_date: '1990-05-15',
  p_birth_time: '14:30',
  p_gender: 'male',
  p_city: '서울',
  p_late_night_rule: 'jo',
  p_time_basis: 'localMean',
};

// ── 1. 두 계정을 세운다 ───────────────────────────────────────────────────────

const client = anon();
await client.auth.signUp({ email: mine, password });

const other = anon();
await other.auth.signUp({ email: theirs, password });

// ── 2. 나와 가족 둘을 등록한다 ────────────────────────────────────────────────
let selfPersonId;
let momId;
{
  await passNotice(client);
  await client.rpc('create_self_person', { p_local_label: '민수', ...birth });

  const { data: mom, error } = await client.rpc('create_managed_person', {
    p_local_label: '엄마',
    p_note: '음력 생일만 아신다',
    p_calendar: 'lunar',
    p_original_date: '1962-03-11',
    p_solar_date: '1962-04-15',
    p_birth_time: '07:20',
    p_gender: 'female',
    p_city: '부산',
    p_late_night_rule: 'jo',
    p_time_basis: 'localMean',
  });
  check('가족을 등록한다 (음력 입력)', typeof mom === 'string', error?.message);
  momId = mom;

  const { error: dadError } = await client.rpc('create_managed_person', {
    p_local_label: '아빠', p_note: null, ...birth, p_original_date: '1960-01-20', p_solar_date: '1960-01-20',
  });
  check('한 사람 더 등록한다', dadError === null, dadError?.message);

  const { data: account } = await client.from('app_user').select('self_person_id').maybeSingle();
  selfPersonId = account?.self_person_id;
  check('가족을 등록해도 selfPerson 은 그대로다', typeof selfPersonId === 'string' && selfPersonId !== momId);
}

// ── 3. 화면이 읽는 그대로 읽는다 (app/me/people/page.tsx 와 같은 질의) ────────
{
  const { data: edges, error } = await client
    .from('user_person_access')
    .select('person_id, local_label, note')
    .order('created_at', { ascending: true });

  check('목록 질의가 돈다', Array.isArray(edges), error?.message);
  check('나까지 세 줄이다', edges?.length === 3, `${edges?.length ?? '?'}줄`);

  const managed = (edges ?? []).filter((edge) => edge.person_id !== selfPersonId);
  check('selfPerson 을 빼면 둘이다', managed.length === 2);
  check(
    '부를 이름과 메모는 엣지가 든다',
    managed.some((edge) => edge.local_label === '엄마' && edge.note === '음력 생일만 아신다'),
    JSON.stringify(managed.map((edge) => [edge.local_label, edge.note])),
  );

  const { data: persons } = await client
    .from('person')
    .select('id, current_revision_id')
    .in('id', managed.map((edge) => edge.person_id));
  check('등록한 사람은 저마다 현재 판본을 가리킨다',
    persons?.length === 2 && persons.every((person) => typeof person.current_revision_id === 'string'));

  const { data: revisions } = await client
    .from('person_chart_revision')
    .select('id, person_id, calendar, original_date, solar_date, birth_time, city')
    .in('id', (persons ?? []).map((person) => person.current_revision_id));
  check('판본을 되읽는다', revisions?.length === 2);

  const mom = (revisions ?? []).find((revision) => revision.person_id === momId);
  check('음력으로 등록하면 원본과 변환값이 둘 다 남는다',
    mom?.calendar === 'lunar' && mom?.original_date === '1962-03-11' && mom?.solar_date === '1962-04-15',
    JSON.stringify(mom));
}

// ── 4. 라벨과 메모는 고치고, 역할은 못 올린다 ─────────────────────────────────
{
  const { error } = await client
    .from('user_person_access')
    .update({ local_label: '어머니', note: null })
    .eq('person_id', momId);
  check('부를 이름과 메모를 고친다', error === null, error?.message);

  const { data: edge } = await client
    .from('user_person_access').select('local_label, note').eq('person_id', momId).maybeSingle();
  check('고친 것이 되읽힌다', edge?.local_label === '어머니' && edge?.note === null, JSON.stringify(edge));

  const { error: escalation } = await client
    .from('user_person_access').update({ role: 'owner' }).eq('person_id', momId);
  check('역할은 스스로 못 올린다', escalation !== null, escalation?.code ?? '통과돼 버렸다');
}

// ── 5. 남에게는 없는 것과 같다 ────────────────────────────────────────────────
let theirPersonId;
{
  await passNotice(other);
  await other.rpc('create_self_person', { p_local_label: '지영', ...birth, p_gender: 'female' });
  const { data: account } = await other.from('app_user').select('self_person_id').maybeSingle();
  theirPersonId = account?.self_person_id;
  check('상대도 자기 사주를 등록했다', typeof theirPersonId === 'string');

  const { data: people } = await other.from('person').select('id');
  check('남이 등록한 가족은 한 줄도 안 보인다', people?.length === 1, `${people?.length ?? '?'}줄`);

  const { error } = await other.rpc('add_person_revision', { p_person_id: momId, ...birth });
  check('남의 가족 출생 정보는 못 고친다', error?.code === '42501', error?.message ?? '통과돼 버렸다');
}

// ── 6. 화면 — 여기서부터는 HTTP 다 ────────────────────────────────────────────
//
// 세션 쿠키는 **@supabase/ssr 이 직접 쓰게 한다.** 이름과 조각내는 규칙을 손으로
// 흉내 내면 그 규칙이 바뀌는 날 이 검사만 조용히 틀린다.
const jar = new Map();
{
  const browser = createServerClient(API, status.ANON_KEY, {
    cookies: {
      getAll: () => [...jar].map(([name, value]) => ({ name, value })),
      setAll: (written) => {
        for (const { name, value } of written) jar.set(name, value);
      },
    },
  });
  const { error } = await browser.auth.signInWithPassword({ email: mine, password });
  check('브라우저처럼 로그인해 쿠키를 얻는다', error === null && jar.size > 0, error?.message);
}

const cookie = [...jar].map(([name, value]) => `${name}=${encodeURIComponent(value)}`).join('; ');

const { base: BASE, stop } = await startCheckServer({
  port: PORT,
  supabaseUrl: API,
  anonKey: status.ANON_KEY,
});

const get = (path, headers = {}) => fetch(`${BASE}${path}`, { headers, redirect: 'manual' });

try {
  // ── 로그인하지 않은 사람은 들어가지 못한다 ─────────────────────────────────
  {
    const response = await get('/me/compat');
    check('로그인 없이는 궁합 화면에 못 들어간다',
      [302, 303, 307].includes(response.status) && (response.headers.get('location') ?? '').includes('/auth'),
      `${response.status} → ${response.headers.get('location')}`);
  }

  // ── 목록 화면 ──────────────────────────────────────────────────────────────
  {
    const response = await get('/me/people', { cookie });
    const body = await response.text();
    check('등록한 사람 화면이 열린다', response.status === 200, String(response.status));
    check('목록에 부를 이름이 선다', body.includes('어머니') && body.includes('아빠'));
    check('여덟 글자를 서버가 계산해 놓는다', /일간/.test(body));
    /**
     * 남이 등록해 준 가족의 생년월일시를 주소에 싣지 않는다(ADR 0007). 그 링크는
     * 자기 사주 화면에만 있다.
     */
    check('관리 Person 의 입력을 `#` 링크로 내보내지 않는다', !body.includes('href="/#'));
  }

  // ── 저장된 두 사람의 궁합 ──────────────────────────────────────────────────
  {
    const response = await get(`/me/compat?a=${selfPersonId}&b=${momId}`, { cookie });
    const body = await response.text();
    check('저장된 두 사람의 궁합이 나온다', response.status === 200, String(response.status));
    check('두 사람을 부를 이름으로 부른다', body.includes('민수') && body.includes('어머니'));
    check('결과가 무엇을 기준으로 났는지 문장으로 말한다',
      body.includes('현재 저장된 출생 정보 기준입니다'));
    /**
     * `b6e1893` 이 이 칸을 세웠다. 그 전까지 여기는 「아직 안 선다」를 재고 있었고,
     * 화면이 고쳐진 뒤로도 그대로 남아 **고쳐진 것을 고장이라고 부르고 있었다.**
     */
    check('비공개 궁합에도 사주풀이 자리가 선다', body.includes('사주풀이'));
    /**
     * **여덟 글자는 서고 관계표는 안 선다.**
     *
     * 이 화면은 풀이를 만들기 **전에** 서는 자리다 — 만세력을 보고 나서 그 아래에서
     * 만든다(ADR 0036). 볼 만세력이 없으면 그 걸음은 걸음이 아니므로 두 명식이 선다.
     *
     * 관계표는 그대로 안 선다. 계산이 맞는지 우리가 보려고 세운 원자료다. 접이칸
     * 낱말만 재면 펼쳐진 채로 돌아와도 통과하므로 그 안에 있던 것을 짚는다
     * (`check-reading.mjs` 도 같은 자리를 본다).
     */
    check('두 사람의 여덟 글자가 선다', /일간/.test(body));
    check('관계 원자료가 로그인 화면에 없다',
      !body.includes('두 원국 사이의 관계') && !body.includes('둘의 명식 보기'));
    check('내부 지표는 로그인 화면에 없다', !body.includes('궁합 베타'));
    /**
     * 주소에는 Person id 둘뿐이다. 저장된 출생 원문이 주소로 새어 나가면 익명
     * 링크에서 막으려던 것과 같은 일이 된다.
     */
    check('주소에는 생년월일이 실리지 않는다', !body.includes('a.date=') && !body.includes('b.date='));
  }

  // ── 없는 사람과 못 보는 사람 ───────────────────────────────────────────────
  //
  // **넷이 다 같아야 한다** — HTTP 상태, 보이는 문장, 그려지는 화면의 종류,
  // 밖으로 나가는 응답의 구조. 갈리면 응답 차이만으로 그 Person 의 실재를 알아낸다.
  {
    const nobody = '00000000-0000-4000-8000-000000000000';

    const [missing, forbidden] = await Promise.all([
      get(`/me/compat?a=${selfPersonId}&b=${nobody}`, { cookie }),
      get(`/me/compat?a=${selfPersonId}&b=${theirPersonId}`, { cookie }),
    ]);
    const [missingBody, forbiddenBody] = await Promise.all([missing.text(), forbidden.text()]);

    check('없는 사람은 404 다', missing.status === 404, String(missing.status));
    check('못 보는 사람도 404 다', forbidden.status === forbidden.status && forbidden.status === 404,
      String(forbidden.status));
    check('둘의 상태가 같다', missing.status === forbidden.status);
    check('둘 다 찾을 수 없다고만 말한다',
      missingBody.includes('찾을 수 없습니다') && forbiddenBody.includes('찾을 수 없습니다'));
    check('어느 쪽인지 말하지 않는다',
      !/볼 수 없|권한|없는 사람/.test(missingBody + forbiddenBody));

    /**
     * 본문에는 주소의 uuid 가 섞여 들어간다(라우터 상태). 그것만 가리고 견주면
     * 남는 차이가 곧 **우리가 낸 차이**다.
     */
    const masked = (body) => body.replace(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi, 'UUID');
    check('응답 본문이 한 글자도 다르지 않다', masked(missingBody) === masked(forbiddenBody),
      `${missingBody.length} vs ${forbiddenBody.length}`);
  }

  // ── 같은 사람 둘은 궁합이 아니다 ───────────────────────────────────────────
  {
    const response = await get(`/me/compat?a=${momId}&b=${momId}`, { cookie });
    const body = await response.text();
    check('같은 사람을 두 번 고르면 그렇다고 말한다',
      response.status === 200 && body.includes('같은 사람을 두 번'), String(response.status));
  }

  // ── 목록에서 빼면 그 자리에서 안 보인다 ────────────────────────────────────
  {
    await client.from('user_person_access').delete().eq('person_id', momId);

    const response = await get(`/me/compat?a=${selfPersonId}&b=${momId}`, { cookie });
    check('목록에서 뺀 사람은 곧바로 못 본다', response.status === 404, String(response.status));

    const { data: mine } = await client.from('person').select('id');
    check('내 목록에서도 사라진다', mine?.length === 2, `${mine?.length ?? '?'}줄`);

    const { error } = await client.from('user_person_access').delete().eq('person_id', selfPersonId);
    const { data: after } = await client.from('person').select('id');
    check('자기 자신은 목록에서 못 뺀다', error === null && after?.length === 2,
      `${after?.length ?? '?'}줄`);
  }
} finally {
  stop();
}

const failed = checks.filter((entry) => !entry.pass);
console.log(`\n${checks.length - failed.length}/${checks.length} 통과`);
process.exit(failed.length === 0 ? 0 : 1);
