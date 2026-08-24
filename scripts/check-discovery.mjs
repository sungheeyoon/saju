/**
 * 후보 노출을 **실제 스택에 대고** 돌린다.
 *
 * pgTAP 이 못 재는 것이 여기 셋 있다.
 *
 * 1. **화면이 후보에 대해 무엇을 내려보내는가** — 정책이 옳아도 서버가 오행 요약이나
 *    점수를 함께 실어 보내면, 「개수로만 말한다」는 약속이 개발자 도구 한 번에 무너진다.
 *    그건 응답 본문을 봐야 알 수 있다.
 * 2. **노출 기록이 실제로 쌓이는가** — 화면을 한 번 열었을 때 쌓이는지는 화면을 열어
 *    봐야 안다. 안 쌓이는 상태는 화면에서 아무 티도 나지 않는다.
 * 3. **낡은 요약이 스스로 낫는가** — 판본을 고치면 요약이 낡아 후보에서 빠지는데,
 *    그 사람이 화면을 한 번 열면 돌아와야 한다. 두 경로가 걸린 일이라 DB 안에서 못 잰다.
 */
import { createClient } from '@supabase/supabase-js';
import { createServerClient } from '@supabase/ssr';
import { execFileSync } from 'node:child_process';

import { startCheckServer } from './next-server.mjs';

const status = JSON.parse(execFileSync('npx', ['supabase', 'status', '-o', 'json'], { encoding: 'utf8' }));
const API = status.API_URL;
const PORT = Number(process.env.CHECK_PORT ?? 3211);

const anon = () => createClient(API, status.ANON_KEY, { auth: { persistSession: false } });

const checks = [];
const check = (name, pass, detail = '') => {
  checks.push({ name, pass, detail });
  console.log(`${pass ? 'ok  ' : 'FAIL'} ${name}${detail ? ` — ${detail}` : ''}`);
};

const stamp = Date.now();
const password = `pw-${stamp}-Aa1!`;
const mine = `seeker-${stamp}@example.com`;
const theirs = `sought-${stamp}@example.com`;

const sql = (statement) =>
  execFileSync('docker', ['exec', '-i', 'supabase_db_saju', 'psql', '-U', 'postgres', '-tAq', '-c', statement],
    { encoding: 'utf8' }).trim();

/** 운영자만 읽는 표다. 앱이 아니라 SQL 로 본다 — 그게 이 표의 유일한 읽는 길이다 */
const impressionsFor = (email) =>
  Number(
    sql(`select count(*) from public.discovery_impression i
         join auth.users u on u.id = i.viewer_user_id where u.email = '${email}'`),
  );

// ── 1. 두 사람이 사주를 등록한다 ──────────────────────────────────────────────
sql(`insert into public.invite (email, note) values ('${mine}', '검사'), ('${theirs}', '검사')`);

const me = anon();
await me.auth.signUp({ email: mine, password });
await me.rpc('create_self_person', {
  p_local_label: '민수', p_calendar: 'solar',
  p_original_date: '1990-05-15', p_solar_date: '1990-05-15', p_birth_time: '14:30',
  p_gender: 'male', p_city: '서울', p_late_night_rule: 'jo', p_time_basis: 'localMean',
});

const other = anon();
await other.auth.signUp({ email: theirs, password });
await other.rpc('create_self_person', {
  p_local_label: '지영', p_calendar: 'solar',
  p_original_date: '1992-03-03', p_solar_date: '1992-03-03', p_birth_time: '09:00',
  p_gender: 'female', p_city: '부산', p_late_night_rule: 'jo', p_time_basis: 'localMean',
});

// ── 2. 참여하지 않으면 후보도 없다 ────────────────────────────────────────────
{
  const { error } = await me.rpc('discovery_candidates', { p_limit: 200 });
  check('참여하기 전에는 후보를 볼 수 없다', error?.code === '42501', error?.message ?? '통과돼 버렸다');

  const { data: profiles } = await me.from('discovery_profile').select('user_id');
  check('남의 프로필은 한 줄도 안 보인다', profiles?.length === 0, `${profiles?.length ?? '?'}줄`);
}

// ── 3. 브라우저처럼 로그인해 쿠키를 얻는다 ────────────────────────────────────
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

const myCookie = await cookieFor(mine);
const theirCookie = await cookieFor(theirs);

const { base: BASE, stop } = await startCheckServer({
  port: PORT,
  supabaseUrl: API,
  anonKey: status.ANON_KEY,
});

const get = (path, cookie) => fetch(`${BASE}${path}`, { headers: { cookie }, redirect: 'manual' });

try {
  // ── 4. 참여하기 전 화면 ─────────────────────────────────────────────────────
  {
    const response = await get('/me/discovery', myCookie);
    const body = await response.text();
    check('후보 화면이 열린다', response.status === 200, String(response.status));
    check('참여를 켜기 전에는 무엇이 나가는지 먼저 적는다',
      body.includes('상대에게 보이는 것') && body.includes('보이지 않는 것'));
    check('오행 요약이 순서를 정한다고 미리 말한다', body.includes('오행 요약'));
  }

  // ── 5. 둘 다 참여한다 ───────────────────────────────────────────────────────
  const profileFor = (client, nickname, intro) =>
    client.from('discovery_profile').insert({ nickname, intro, prefer_gender: 'any' });

  await profileFor(me, '민수', '조용한 편입니다');
  await profileFor(other, '지영', '주말엔 걷습니다');

  const summaryOf = (email) =>
    sql(`select coalesce(p.element_summary::text, '') from public.discovery_profile p
         join auth.users u on u.id = p.user_id where u.email = '${email}'`);

  const personOf = async (client) => {
    const { data: account } = await client.from('app_user').select('self_person_id').maybeSingle();
    return account.self_person_id;
  };
  const theirPersonId = await personOf(other);

  /**
   * 참여를 켤 때 **모양만 맞는 가짜 요약**을 넣어 둔다.
   *
   * 요약을 만드는 것은 앱이고(`selfElementSummary`), 검사가 그 계산을 흉내 내면 앱이
   * 옳게 만드는지를 한 번도 안 재게 된다. 그래서 일부러 판본과 무관한 값을 넣고,
   * **화면을 한 번 열었을 때 내 판본에서 다시 계산돼 자리를 잡는지**를 잰다.
   * DB 는 모양까지만 보므로 이 값은 통과한다 — 그 사실도 함께 드러난다.
   */
  const 가짜 = {
    glyphCount: 8,
    counts: { 木: 8, 火: 0, 土: 0, 金: 0, 水: 0 },
    ratios: { 木: 1, 火: 0, 土: 0, 金: 0, 水: 0 },
  };
  await me.rpc('set_discovery_participation', { p_on: true, p_summary: 가짜 });
  await other.rpc('set_discovery_participation', { p_on: true, p_summary: 가짜 });

  await get('/me/discovery', myCookie);
  await get('/me/discovery', theirCookie);

  check(
    '화면을 열면 요약이 내 판본에서 다시 계산된다',
    summaryOf(mine) !== '' && !summaryOf(mine).includes('"木": 8') &&
      summaryOf(theirs) !== '' && !summaryOf(theirs).includes('"木": 8'),
    summaryOf(mine).slice(0, 70),
  );

  // ── 6. 후보가 선다 ──────────────────────────────────────────────────────────
  {
    const before = impressionsFor(mine);
    const response = await get('/me/discovery', myCookie);
    const body = await response.text();

    check('참여하면 상대가 후보로 선다', body.includes('지영'), String(response.status));
    check('왜 그 자리에 섰는지 한 줄이 붙는다', /오행|균형|탐색 후보/.test(body));
    check('순서가 좋고 나쁨이 아니라는 말이 함께 선다',
      body.includes('궁합의 좋고 나쁨이 아닙니다'));

    /**
     * **후보의 오행 요약도, 두 축의 값도, 점수도 나가지 않는다.**
     *
     * 상대의 생년월일시는 애초에 이 서버에도 오지 않는다. 그래도 함께 재는 것은,
     * 나가지 않아야 하는 것의 목록이 하나이기 때문이다.
     */
    check('상대의 생년월일시가 응답에 없다', !body.includes('1992-03-03'));
    check('상대의 출생지가 응답에 없다', !body.includes('부산'));
    check('오행 요약이 응답에 없다', !body.includes('glyphCount') && !body.includes('"counts"'));
    check('두 축의 값과 점수가 응답에 없다',
      !body.includes('combinedBalance') && !body.includes('combined_balance') &&
      !/"complement"/.test(body) && !/"score"/.test(body));

    check('노출 기록이 쌓인다', impressionsFor(mine) > before, `${before} → ${impressionsFor(mine)}`);
  }

  // 노출 기록의 요약 두 벌은 DB 가 채운다 — 앱은 후보의 요약을 받지도 않는다.
  {
    const filled = sql(`select count(*) from public.discovery_impression
                        where candidate_summary ? 'counts' and viewer_summary ? 'counts'`);
    check('노출 기록의 오행 요약은 DB 가 채운다', Number(filled) > 0, `${filled}줄`);
  }

  // ── 7. 다시 보지 않기 ───────────────────────────────────────────────────────
  {
    const { data: account } = await other.from('app_user').select('self_person_id').maybeSingle();
    check('상대의 selfPerson 은 여전히 내게 안 보인다',
      (await me.from('person').select('id')).data?.length === 1,
      String(account?.self_person_id ?? '?').slice(0, 8));

    const theirUserId = sql(`select id from auth.users where email = '${theirs}'`);
    await me.from('discovery_hidden').insert({ hidden_user_id: theirUserId });

    const body = await (await get('/me/discovery', myCookie)).text();
    check('다시 보지 않기로 하면 후보에서 빠진다', !body.includes('지영'));
    // React 는 나란한 글자 마디 사이에 `<!-- -->` 를 넣는다. 수를 견줄 때 그것을 지운다.
    const plain = body.replace(/<!--\s*-->/g, '');
    check('감춘 사람이 몇인지는 말하되 누구인지는 적지 않는다',
      plain.includes('다시 보지 않기로 한 사람 1명') && !body.includes(theirUserId));

    await me.from('discovery_hidden').delete().eq('hidden_user_id', theirUserId);
    const back = await (await get('/me/discovery', myCookie)).text();
    check('되돌리면 다시 선다', back.includes('지영'));
  }

  // ── 8. 판본을 고치면 요약이 따라간다 ────────────────────────────────────────
  {
    await other.rpc('add_person_revision', {
      p_person_id: theirPersonId,
      p_calendar: 'solar', p_original_date: '1992-03-03', p_solar_date: '1992-03-03',
      p_birth_time: '09:00', p_gender: 'female', p_city: '대구',
      p_late_night_rule: 'jo', p_time_basis: 'localMean',
    });

    // RPC 를 직접 불렀으므로 요약은 아직 옛 판본의 것이다 — 그 사이에는 후보가 아니다.
    const stale = await (await get('/me/discovery', myCookie)).text();
    check('요약이 낡은 사람은 후보에서 빠진다', !stale.includes('지영'));

    // 그 사람이 화면을 한 번 열면 스스로 낫는다.
    await get('/me/discovery', theirCookie);
    const healed = await (await get('/me/discovery', myCookie)).text();
    check('그 사람이 화면을 열면 요약이 따라와 다시 선다', healed.includes('지영'));
  }

  // ── 9. 참여를 끄면 풀에서 사라지고 요약도 거둬진다 ──────────────────────────
  {
    await other.rpc('set_discovery_participation', { p_on: false, p_summary: null });

    const body = await (await get('/me/discovery', myCookie)).text();
    check('참여를 끄면 후보에서 사라진다', !body.includes('지영'));
    check('내놓은 요약도 거둬진다', summaryOf(theirs) === '', summaryOf(theirs).slice(0, 40));

    const { data: person } = await other.from('person').select('id');
    check('참여를 꺼도 내 사주는 그대로다', person?.length === 1, `${person?.length ?? '?'}줄`);
  }
} finally {
  stop();
}

const failed = checks.filter((entry) => !entry.pass);
console.log(`\n${checks.length - failed.length}/${checks.length} 통과`);
process.exit(failed.length === 0 ? 0 : 1);
