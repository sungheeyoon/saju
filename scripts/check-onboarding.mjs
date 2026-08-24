/**
 * 온보딩 한 바퀴를 **실제 Supabase 에 대고** 돌린다.
 *
 * pgTAP 은 DB 안에서만 돈다. 그래서 못 재는 것이 둘 있다.
 *
 * 1. **GoTrue 가 초대 훅을 정말 부르는가** — 함수가 옳게 판정하는 것과, 가입 경로가
 *    그 함수를 거치는 것은 다른 문제다. 설정 한 줄이면 안 부르게 된다.
 * 2. **화면이 쓰는 질의가 도는가** — 정책이 옳아도 PostgREST 질의 모양이 틀리면
 *    화면은 빈 채로 나온다. 빈 화면은 「저장 안 됨」과 구별되지 않는다.
 *
 * 로컬 스택에 대고 돈다(`npm run db:start`). 원격은 건드리지 않는다.
 */
import { createClient } from '@supabase/supabase-js';
import { execFileSync } from 'node:child_process';

const status = JSON.parse(execFileSync('npx', ['supabase', 'status', '-o', 'json'], { encoding: 'utf8' }));
const API = status.API_URL;

const admin = createClient(API, status.SERVICE_ROLE_KEY, { auth: { persistSession: false } });
const anon = () => createClient(API, status.ANON_KEY, { auth: { persistSession: false } });

const checks = [];
const check = (name, pass, detail = '') => {
  checks.push({ name, pass, detail });
  console.log(`${pass ? 'ok  ' : 'FAIL'} ${name}${detail ? ` — ${detail}` : ''}`);
};

const stamp = Date.now();
const invited = `invited-${stamp}@example.com`;
const stranger = `stranger-${stamp}@example.com`;
const password = `pw-${stamp}-Aa1!`;

/**
 * 초대는 **운영자가 SQL 로 넣는다.**
 *
 * PostgREST 로 안 넣는 이유가 설계다 — `service_role` 에도 이 표의 권한을 주지 않았다.
 * 그 키가 새면 초대 명단이 통째로 열리기 때문이다. 그래서 이 검사도 앱이 쓰는 길이
 * 아니라 운영자가 쓰는 길로 넣는다.
 */
const sql = (statement) =>
  execFileSync('docker', ['exec', '-i', 'supabase_db_saju', 'psql', '-U', 'postgres', '-q', '-c', statement],
    { encoding: 'utf8' });

// ── 1. 초대 명단에 하나 넣는다 ────────────────────────────────────────────────
{
  let ok = true;
  let detail = '';
  try {
    sql(`insert into public.invite (email, note) values ('${invited}', '검사')`);
  } catch (error) {
    ok = false;
    detail = String(error.stderr ?? error.message).trim();
  }
  check('초대 명단에 넣는다 (운영자 SQL)', ok, detail);
}

// ── 2. 초대 안 된 주소는 가입 자체가 안 된다 ──────────────────────────────────
{
  const { data, error } = await anon().auth.signUp({ email: stranger, password });
  check('초대 안 된 주소는 계정이 만들어지지 않는다', error !== null && data.user === null,
    error ? `거부: ${error.message}` : '가입돼 버렸다');

  const { data: leftover } = await admin.auth.admin.listUsers();
  const stayed = leftover.users.some((u) => u.email === stranger);
  check('거부된 주소는 auth.users 에 흔적도 안 남긴다', !stayed);
}

// ── 3. 초대된 주소는 들어오고, 계정 행이 따라 생긴다 ──────────────────────────
const client = anon();
{
  const { data, error } = await client.auth.signUp({ email: invited, password });
  check('초대된 주소는 들어온다', error === null && data.user !== null, error?.message);
  check('세션이 선다', Boolean(data.session));

  const { data: account, error: readError } = await client
    .from('app_user').select('status, self_person_id').maybeSingle();
  check('가입하면 계정 행이 따라 생긴다', account?.status === 'active', readError?.message);
  check('아직 selfPerson 이 없다', account?.self_person_id === null);
}

// ── 4. 자기 사주를 저장한다 ───────────────────────────────────────────────────
{
  const { error } = await client.rpc('create_self_person', {
    p_local_label: '민수',
    p_calendar: 'solar',
    p_original_date: '1990-05-15',
    p_solar_date: '1990-05-15',
    p_birth_time: '14:30',
    p_gender: 'male',
    p_city: '서울',
    p_late_night_rule: 'jo',
    p_time_basis: 'localMean',
  });
  check('자기 사주를 저장한다', error === null, error?.message);

  const { error: again } = await client.rpc('create_self_person', {
    p_local_label: '민수2', p_calendar: 'solar',
    p_original_date: '1991-01-01', p_solar_date: '1991-01-01', p_birth_time: '09:00',
    p_gender: 'male', p_city: '서울', p_late_night_rule: 'jo', p_time_basis: 'localMean',
  });
  check('두 번째는 조용히 덮어쓰지 않고 거절한다', again?.code === '23505', again?.message);
}

// ── 5. 화면이 읽는 그대로 읽는다 (app/me/page.tsx 와 같은 질의) ───────────────
let personId;
{
  const { data: account } = await client.from('app_user').select('status, self_person_id').maybeSingle();
  check('selfPerson 이 지정됐다', typeof account?.self_person_id === 'string');

  personId = account.self_person_id;
  const [{ data: person }, { data: edge }] = await Promise.all([
    client.from('person').select('current_revision_id').eq('id', personId).maybeSingle(),
    client.from('user_person_access').select('local_label').eq('person_id', personId).maybeSingle(),
  ]);
  check('Person 이 현재 판본을 가리킨다', typeof person?.current_revision_id === 'string');
  check('부를 이름은 엣지가 든다', edge?.local_label === '민수');

  const { data: revision, error } = await client
    .from('person_chart_revision')
    .select('calendar, original_date, solar_date, birth_time, gender, city, late_night_rule, time_basis, created_at, fingerprint')
    .eq('id', person.current_revision_id)
    .maybeSingle();
  check('판본을 되읽는다', revision !== null, error?.message);
  check('넣은 그대로 돌아온다',
    revision?.solar_date === '1990-05-15' && revision?.city === '서울' && revision?.late_night_rule === 'jo',
    JSON.stringify({ date: revision?.solar_date, city: revision?.city }));
  // Postgres 는 `time` 을 초까지 붙여 돌려준다. 되읽기가 이걸 다룰 줄 알아야 한다.
  check('시각은 초까지 붙어 돌아온다', revision?.birth_time === '14:30:00', revision?.birth_time);
  check('지문이 붙어 있다', /^[0-9a-f]{64}$/.test(revision?.fingerprint ?? ''));
}

// ── 6. 남에게는 안 보인다 ─────────────────────────────────────────────────────
const other = anon();
{
  const otherEmail = `other-${stamp}@example.com`;
  sql(`insert into public.invite (email, note) values ('${otherEmail}', '검사')`);
  await other.auth.signUp({ email: otherEmail, password });

  const { data: people } = await other.from('person').select('id');
  check('남의 Person 은 한 줄도 안 보인다', Array.isArray(people) && people.length === 0,
    `${people?.length ?? '?'}줄`);

  const { data: revisions } = await other.from('person_chart_revision').select('id');
  check('남의 판본도 안 보인다', Array.isArray(revisions) && revisions.length === 0);
}

// ── 7. 고치면 쌓인다 ─────────────────────────────────────────────────────────
{
  const revise = (patch) =>
    client.rpc('add_person_revision', {
      p_person_id: personId,
      p_calendar: 'solar',
      p_original_date: '1990-05-15',
      p_solar_date: '1990-05-15',
      p_birth_time: '14:30',
      p_gender: 'male',
      p_city: '서울',
      p_late_night_rule: 'jo',
      p_time_basis: 'localMean',
      ...patch,
    });

  const countRevisions = async () => {
    const { data } = await client.from('person_chart_revision').select('id').eq('person_id', personId);
    return data?.length ?? -1;
  };
  const currentRevision = async () => {
    const { data } = await client.from('person').select('current_revision_id').eq('id', personId).maybeSingle();
    return data?.current_revision_id;
  };

  const before = await currentRevision();

  const { data: unchanged } = await revise({});
  check('같은 값으로 저장하면 판본을 쌓지 않는다', unchanged === before, `${unchanged} vs ${before}`);
  check('그래서 판본 수도 그대로다', (await countRevisions()) === 1);

  const { data: next, error } = await revise({ p_city: '부산' });
  check('고치면 새 판본이 쌓인다', typeof next === 'string' && next !== before, error?.message);
  check('현재 판본이 새것으로 옮겨간다', (await currentRevision()) === next);
  check('옛 판본은 남는다', (await countRevisions()) === 2);

  const { data: old } = await client
    .from('person_chart_revision').select('city').eq('id', before).maybeSingle();
  check('옛 판본의 값은 덮어써지지 않았다', old?.city === '서울', old?.city);

  // 이름은 판본이 아니라 엣지가 든다 — 고쳐도 판본이 늘지 않는다.
  const { error: labelError } = await client
    .from('user_person_access').update({ local_label: '아빠' }).eq('person_id', personId);
  check('부를 이름을 고친다', labelError === null, labelError?.message);
  check('이름을 고쳐도 판본은 늘지 않는다', (await countRevisions()) === 2);

  const { data: edge } = await client
    .from('user_person_access').select('local_label').eq('person_id', personId).maybeSingle();
  check('고친 이름이 되읽힌다', edge?.local_label === '아빠', edge?.local_label);
}

// ── 8. 남은 못 고친다 — RPC 는 정책을 지나가므로 스스로 물어야 한다 ───────────
{
  const { error } = await other.rpc('add_person_revision', {
    p_person_id: personId,
    p_calendar: 'solar', p_original_date: '1980-01-01', p_solar_date: '1980-01-01',
    p_birth_time: '01:00', p_gender: 'male', p_city: '서울',
    p_late_night_rule: 'jo', p_time_basis: 'localMean',
  });
  check('claim 된 Person 의 출생정보는 남이 못 고친다', error?.code === '42501', error?.message ?? '통과돼 버렸다');
}

const failed = checks.filter((c) => !c.pass);
console.log(`\n${checks.length - failed.length}/${checks.length} 통과`);
process.exit(failed.length === 0 ? 0 : 1);
