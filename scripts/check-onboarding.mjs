/**
 * 온보딩 한 바퀴를 **실제 Supabase 에 대고** 돌린다.
 *
 * pgTAP 은 DB 안에서만 돈다. 그래서 못 재는 것이 둘 있다.
 *
 * 1. **구글 로그인만 한 계정이 실제로 아무것도 못 하는가** — 이메일 명단을 걷은 뒤로
 *    (ADR 0042) 그 상태가 실재한다. 화면 관문은 길만 가리키므로, 되돌릴 수 없는 첫
 *    쓰기가 RPC 로도 막히는지는 실제 스택에 대고 재야 한다.
 * 2. **화면이 쓰는 질의가 도는가** — 정책이 옳아도 PostgREST 질의 모양이 틀리면
 *    화면은 빈 채로 나온다. 빈 화면은 「저장 안 됨」과 구별되지 않는다.
 *
 * 로컬 스택에 대고 돈다(`npm run db:start`). 원격은 건드리지 않는다.
 */
import { createClient } from '@supabase/supabase-js';
import { execFileSync } from 'node:child_process';
import { CHECK_CODE, NOTICE_VERSION, passNotice, scheduleBeta, seedSignupCode } from './notice.mjs';

const status = JSON.parse(execFileSync('npx', ['supabase', 'status', '-o', 'json'], { encoding: 'utf8' }));
const API = status.API_URL;

const anon = () => createClient(API, status.ANON_KEY, { auth: { persistSession: false } });

const checks = [];
const check = (name, pass, detail = '') => {
  checks.push({ name, pass, detail });
  console.log(`${pass ? 'ok  ' : 'FAIL'} ${name}${detail ? ` — ${detail}` : ''}`);
};

const stamp = Date.now();
const tester = `tester-${stamp}@example.com`;
const password = `pw-${stamp}-Aa1!`;

const scheduleId = async (client) =>
  (await client.rpc('current_beta_schedule')).data?.[0]?.schedule_id;

// ── 1. 코드는 운영자가 만든다 ────────────────────────────────────────────────
{
  scheduleBeta();
  let ok = true;
  let detail = '';
  try {
    seedSignupCode();
  } catch (error) {
    ok = false;
    detail = String(error.stderr ?? error.message).trim();
  }
  check('테스트 코드를 넣는다 (운영자 SQL)', ok, detail);
}

// ── 2. 구글 로그인만으로 계정 행이 생긴다 ─────────────────────────────────────
const client = anon();
{
  const { data, error } = await client.auth.signUp({ email: tester, password });
  check('명단 없이도 로그인은 된다 — 문은 코드가 지킨다', error === null && data.user !== null,
    error?.message);
  check('세션이 선다', Boolean(data.session));

  const { data: account, error: readError } = await client
    .from('app_user').select('status, self_person_id, signed_up_at').maybeSingle();
  check('로그인하면 계정 행이 따라 생긴다', account?.status === 'active', readError?.message);
  check('아직 selfPerson 이 없다', account?.self_person_id === null);
  check('가입은 아직 안 끝났다', account?.signed_up_at === null);
}

// ── 3. 가입이 안 끝난 계정은 아무것도 못 쓴다 ────────────────────────────────
{
  /**
   * **여기가 출생 정보가 처음 들어오는 자리다.** 화면에도 관문이 있지만(`proxy.ts`)
   * 되돌릴 수 없는 첫 쓰기는 DB 가 막는다 — 화면만 막으면 이렇게 RPC 로 지나간다.
   */
  const { error } = await client.rpc('create_self_person', {
    p_local_label: '민수', p_calendar: 'solar',
    p_original_date: '1990-05-15', p_solar_date: '1990-05-15', p_birth_time: '14:30',
    p_gender: 'male', p_city: '서울', p_late_night_rule: 'jo', p_time_basis: 'localMean',
  });
  check('가입을 안 끝냈으면 첫 입력이 거절된다',
    error !== null && error.message.includes('가입을 먼저'), error?.message ?? '들어가 버렸다');

  /** 남의 생년월일시가 들어오는 문도 같은 자리에서 막힌다 */
  const { error: managed } = await client.rpc('create_managed_person', {
    p_local_label: '어머니', p_note: null, p_calendar: 'solar',
    p_original_date: '1965-03-02', p_solar_date: '1965-03-02', p_birth_time: '09:00',
    p_gender: 'female', p_city: '서울', p_late_night_rule: 'jo', p_time_basis: 'localMean',
  });
  check('가입을 안 끝냈으면 남의 사주도 거절된다',
    managed !== null && managed.message.includes('가입을 먼저'), managed?.message ?? '들어가 버렸다');
}

// ── 3-1. 코드가 실제로 문이다 ────────────────────────────────────────────────
{
  const { error: nocode } = await client.rpc('complete_signup', {
    p_code: null, p_nickname: '민수', p_version: NOTICE_VERSION,
    p_schedule_id: await scheduleId(client), p_improvement: false, p_contact: false,
  });
  check('코드 없이는 가입이 안 끝난다', nocode !== null, nocode?.message ?? '지나가 버렸다');

  const { error: wrong } = await client.rpc('complete_signup', {
    p_code: 'NOSUCHCODE', p_nickname: '민수', p_version: NOTICE_VERSION,
    p_schedule_id: await scheduleId(client), p_improvement: false, p_contact: false,
  });
  check('없는 코드는 거절된다', wrong !== null, wrong?.message ?? '지나가 버렸다');

  /** 선택 답을 비운 채 지나가는 길이 없다 — 물었는데 `null` 인 사람이 생기면 안 된다 */
  const { error: blank } = await client.rpc('complete_signup', {
    p_code: CHECK_CODE, p_nickname: '민수', p_version: NOTICE_VERSION,
    p_schedule_id: await scheduleId(client), p_improvement: null, p_contact: false,
  });
  check('선택 항목을 비운 채로는 가입할 수 없다', blank !== null, blank?.message ?? '지나가 버렸다');
}

// ── 4. 자기 사주를 저장한다 ───────────────────────────────────────────────────
{
  await passNotice(client);
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

  // ── 음력 판본 — 원본과 변환값을 둘 다 든다 ─────────────────────────────────
  const { data: lunar, error: lunarError } = await revise({
    p_calendar: 'lunar',
    p_original_date: '1990-04-21',
    p_solar_date: '1990-05-15',
  });
  check('음력 판본을 받는다', typeof lunar === 'string', lunarError?.message);

  const { data: stored } = await client
    .from('person_chart_revision')
    .select('calendar, original_date, solar_date')
    .eq('id', lunar)
    .maybeSingle();
  check(
    '사용자가 적은 음력과 변환된 양력이 둘 다 남는다',
    stored?.calendar === 'lunar' &&
      stored?.original_date === '1990-04-21' &&
      stored?.solar_date === '1990-05-15',
    JSON.stringify(stored),
  );

  // 변환은 앱이 한다. DB 가 잡을 수 있는 것은 변환을 아예 건너뛴 쓰기다.
  const { error: skipped } = await revise({
    p_calendar: 'lunar',
    p_original_date: '1990-04-21',
    p_solar_date: '1990-04-21',
  });
  check('변환을 건너뛴 음력 쓰기는 거절된다', skipped?.code === '23514', skipped?.code);

  /**
   * 미참조 이전 판본은 최근 둘까지 — **앱이 부르지 않아도 돈다**(ADR 0011).
   *
   * 같은 규칙을 pgTAP 이 이미 잰다. 여기서 다시 재는 것은 질문이 다르기 때문이다:
   * **브라우저가 쓰는 그 길로** 판본을 쌓아도 정리가 함께 도는가. 앱이 정리를 따로
   * 불러야 하는 구조라면 그 한 줄을 잊는 배포가 언젠가 나오고, 그때 지워졌어야 할
   * 출생 입력이 조용히 남는다.
   */
  check('여기까지 판본은 셋이다', (await countRevisions()) === 3);

  const { data: fourth } = await revise({ p_city: '대구' });
  check('네 번째를 쌓아도 판본은 셋이다 — 정리가 함께 돈다', (await countRevisions()) === 3);
  check('현재 판본은 방금 쌓은 것이다', (await currentRevision()) === fourth);

  const { data: oldest } = await client
    .from('person_chart_revision').select('id').eq('id', before).maybeSingle();
  check('가장 오래된 미참조 입력은 남지 않는다', oldest === null, JSON.stringify(oldest));

  const { error: cleanup } = await client.rpc('retain_person_revisions', {
    p_person_id: personId,
  });
  check(
    '정리는 브라우저가 부르는 문이 아니다',
    cleanup !== null,
    cleanup?.message ?? '통과돼 버렸다',
  );

  /**
   * **겹쳐 저장해도 죽지 않는다.**
   *
   * 저장 버튼을 두 번 누르거나 두 탭에서 고치면 같은 Person 에 두 호출이 겹친다.
   * 새 판본을 먼저 넣고 그 다음 `person.current_revision_id` 를 고치는 차례라, 잠그지
   * 않으면 둘이 서로가 든 것을 서로 기다려 deadlock(40P01) 이 난다 — 재현했다.
   *
   * pgTAP 으로는 못 잰다. 한 파일이 한 세션·한 트랜잭션이라 겹칠 자리가 없다. 그래서
   * **실제로 동시에 보내는** 이 자리에 회귀 검사를 둔다.
   */
  const overlapping = await Promise.all(
    Array.from({ length: 12 }, (_, i) =>
      revise({
        p_birth_time: `${String(i % 24).padStart(2, '0')}:${String((i * 5) % 60).padStart(2, '0')}`,
      }),
    ),
  );
  const broke = overlapping.filter(({ error }) => error !== null);
  check(
    '겹쳐 저장해도 deadlock 이 나지 않는다',
    broke.length === 0,
    broke.map(({ error }) => `${error.code} ${error.message}`).join(' · '),
  );
  check('겹쳐 저장한 뒤에도 상한은 그대로다', (await countRevisions()) === 3);
}

// ── 8. 남은 못 고친다 — RPC 는 정책을 지나가므로 스스로 물어야 한다 ───────────
{
  const { error } = await other.rpc('add_person_revision', {
    p_person_id: personId,
    p_calendar: 'solar', p_original_date: '1980-01-01', p_solar_date: '1980-01-01',
    p_birth_time: '01:00', p_gender: 'male', p_city: '서울',
    p_late_night_rule: 'jo', p_time_basis: 'localMean',
  });
  check('claim 된 Person 의 출생 정보는 남이 못 고친다', error?.code === '42501', error?.message ?? '통과돼 버렸다');
}

const failed = checks.filter((c) => !c.pass);
console.log(`\n${checks.length - failed.length}/${checks.length} 통과`);
process.exit(failed.length === 0 ? 0 : 1);
