/**
 * 후보 노출을 **실제 스택에 대고** 돌린다.
 *
 * pgTAP 이 못 재는 것이 여기 셋 있다.
 *
 * 1. **화면이 후보에 대해 무엇을 내려보내는가** — 정책이 옳아도 서버가 전체 오행 요약이나
 *    숫자 점수를 함께 실어 보내면, 맛보기의 공개 경계가 개발자 도구 한 번에 무너진다.
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
// 별명에 이번 실행의 꼬리표를 붙인다 — 지난 실행이 남긴 동명이인이 후보로 서면 본문을
// 뒤지는 검사가 헛디딘다(별명 상한이 12자라 네 자리만 붙인다).
const tag = String(stamp).slice(-4);
const MINE_NAME = `민수${tag}`;
const THEIR_NAME = `지영${tag}`;
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
  const { error } = await me.rpc('discovery_board');
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
    /**
     * **켜기 전에 알린다.** 후보 카드가 내 오행을 이름과 뜻으로 말하게 되므로, 그
     * 사실이 참여 버튼 위에 있어야 한다.
     */
    check('오행 이름과 뜻이 상대 카드에 나타난다고 미리 말한다',
      body.includes('오행의 이름과 그 뜻'));
    check('보이지 않는 것에 개수표와 숫자 점수를 적는다',
      body.includes('전체 오행 개수표') && body.includes('숫자 점수'));
  }

  // ── 5. 둘 다 참여한다 ───────────────────────────────────────────────────────
  const profileFor = (client, nickname, intro) =>
    client.from('discovery_profile').insert({ nickname, intro, prefer_gender: 'any' });

  await profileFor(me, MINE_NAME, '조용한 편입니다');
  await profileFor(other, THEIR_NAME, '주말엔 걷습니다');


/**
 * **이번 실행의 사람들만 서로의 후보가 되게 한다.**
 *
 * 후보 목록은 한 번에 열 명까지다. 지난 실행이 쌓아 둔 참여자가 스무 명이면 이번 상대는
 * 목록에 못 서고, 그러면 이 검사는 「후보가 뜨는가」가 아니라 「DB 가 비어 있는가」를
 * 잰다(pgTAP 이 같은 이유로 같은 일을 한다). 검사가 DB 를 비우게 하는 대신, 이번
 * 사람들이 나머지를 목록에서 빼 두고 시작한다.
 */
const isolate = (emails) => {
  const list = emails.map((email) => `'${email}'`).join(', ');
  sql(`insert into public.discovery_hidden (user_id, hidden_user_id)
       select mine.id, p.user_id
       from auth.users mine, public.discovery_profile p
       where mine.email in (${list})
         and p.user_id not in (select id from auth.users where email in (${list}))
       on conflict do nothing`);
};

  isolate([mine, theirs]);

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

    check('참여하면 상대가 후보로 선다', body.includes(THEIR_NAME), String(response.status));

    /**
     * **추천 이유는 적극적으로 나간다.** 어느 오행이 무엇을 채우는지까지 —
     * 감추면 「왜 이 사람인가」에 답하지 못한다.
     */
    check('어느 오행을 채우는지 이름으로 말한다', /부족한 [목화토금수]\([木火土金水]\) 기운/.test(body),
      (/당신에게 부족한[^<]{0,60}/.exec(body) ?? ['(없다)'])[0]);
    check('그 오행이 무엇인지 뜻을 붙인다',
      /성장과 확장|열정과 표현|중심과 포용|안정감과 결단력|유연함과 통찰/.test(body));
    check('함께 놓았을 때의 균형을 말로 낸다', /오행 균형이 고르게|대체로 고른 편|한쪽으로 기우는 편/.test(body));
    check('상세 궁합은 서로 동의한 뒤라고 말한다',
      body.includes('서로 동의하면') && body.includes('형충회합'));
    check('순서가 좋고 나쁨이 아니라는 말이 함께 선다',
      body.includes('궁합의 좋고 나쁨이 아닙니다'));

    /**
     * **여기서 멈추는 것들.** 맛보기가 열리는 만큼 닫히는 자리도 또렷해야 한다 —
     * 정책의 `withholds` 가 화면에서 실제로 지켜지는지는 본문을 봐야 안다.
     */
    check('상대의 생년월일시가 응답에 없다', !body.includes('1992-03-03'));
    check('상대의 출생지가 응답에 없다', !body.includes('부산'));
    check('상대의 오행 구성(개수표)이 응답에 없다',
      !body.includes('glyphCount') && !body.includes('"counts"') && !body.includes('"ratios"'));
    check('두 축의 값과 점수가 응답에 없다',
      !body.includes('combinedBalance') && !body.includes('combined_balance') &&
      !/"complement"/.test(body) && !/"score"/.test(body));
    /**
     * 「세운」은 평범한 말과 겹치므로(「줄 세운」) 빼고, 명식을 가리키는 말만 본다.
     * 「형충회합」은 **여기 없어야 할 것이 아니라 다음에 열리는 것**이라 위에서 따로 쟀다.
     */
    check('여덟 글자·십성·신살·대운은 후보 화면에 없다',
      !/일간|십성|신살|천간|지장간|대운/.test(body));

    check('노출 기록이 쌓인다', impressionsFor(mine) > before, `${before} → ${impressionsFor(mine)}`);
  }

  // 후보·자리·탐색 여부와 노출 기록의 요약·이유·두 축을 전부 DB 가 같은 호출에서 정한다.
  {
    const filled = sql(`select count(*) from public.discovery_impression
                        where candidate_summary ? 'counts' and viewer_summary ? 'counts'
                          and complement is not null and combined_balance is not null`);
    check('노출 기록의 요약·이유·두 축을 DB 가 채운다', Number(filled) > 0, `${filled}줄`);
  }

  /**
   * **손으로 적을 자리가 아예 없다.**
   *
   * 예전에는 인증 사용자가 후보 id·자리·탐색 여부를 적어 넣는 RPC 가 따로 있었다. 같은
   * 후보 백 번, 자리 999 같은 위조가 그 자리에서 나왔다. 고르는 일과 남기는 일을 한
   * 함수에 넣었으므로 그 함수 자체가 없다.
   */
  {
    const forged = await me.rpc('log_discovery_impressions', {
      p_rows: Array.from({ length: 100 }, () => ({
        candidateUserId: sql(`select id from auth.users where email = '${mine}'`),
        position: 999,
        exploration: true,
      })),
    });
    check('노출 기록을 손으로 적는 함수가 없다', forged.error !== null,
      forged.error?.message ?? '남아 있다');

    const direct = await me.from('discovery_impression').insert({
      viewer_user_id: sql(`select id from auth.users where email = '${mine}'`),
      candidate_user_id: sql(`select id from auth.users where email = '${theirs}'`),
      policy_version: 'discovery-v0',
      position: 999,
      exploration: true,
      viewer_summary: {},
      candidate_summary: {},
      supplied_elements: ['木'],
      complement: 100,
      combined_balance: 100,
    });
    check('노출 기록 표에 직접 쓰지도 못한다', direct.error !== null,
      direct.error?.message ?? '써졌다');
  }

  /**
   * **로그인한 브라우저가 숫자를 직접 받을 수 없다.**
   *
   * 반환형에서 뺀 것이 뜻을 가지려면 같은 값을 다른 문으로 받아 갈 수 없어야 한다.
   * 그래서 카드에 없는 것과, 그 값을 세는 함수가 안 열려 있는 것을 함께 잰다.
   */
  {
    const { data: rows, error } = await me.rpc('discovery_board');
    check('후보 목록을 직접 불러도 돈다', !error && Array.isArray(rows), error?.message);

    const keys = Object.keys(rows?.[0] ?? {}).sort();
    check('반환에 두 축의 값도 점수도 없다',
      !keys.includes('complement') && !keys.includes('combined_balance') && !keys.includes('score'),
      keys.join(','));
    check('반환은 카드에 설 값뿐이다',
      keys.join(',') === 'balance_band,candidate_user_id,exploration,intro,nickname,seat,supplied_elements',
      keys.join(','));

    const axis = await me.rpc('discovery_complement', { a: {}, b: {} });
    check('두 축을 세는 함수는 직접 못 부른다', axis.error !== null, axis.error?.message ?? '불렸다');

    const active = await me.rpc('is_active_account');
    check('내 계정 상태는 인자 없이만 물을 수 있다', !active.error && active.data === true,
      active.error?.message ?? String(active.data));

    const others = await me.rpc('is_active_account', {
      actor: sql(`select id from auth.users where email = '${theirs}'`),
    });
    check('남의 상태를 묻는 길은 없다', others.error !== null, others.error?.message ?? '답했다');

    // 로그인하지 않은 쪽은 아예 못 묻는다.
    const stranger = await anon().rpc('is_active_account');
    check('로그인하지 않으면 계정 상태를 물을 수 없다', stranger.error !== null,
      stranger.error?.message ?? '답했다');
  }

  /**
   * **보여준 그 목록이 그대로 기록된다.**
   *
   * 한 함수가 둘 다 하므로 어긋날 자리가 없다 — 그래도 재는 것은, 그 사실이 이 제품의
   * 노출 기록을 믿을 수 있게 하는 유일한 근거이기 때문이다.
   */
  {
    sql(`delete from public.discovery_impression i using auth.users u
         where u.id = i.viewer_user_id and u.email = '${mine}'`);

    const { data: rows } = await me.rpc('discovery_board');
    const logged = sql(`select coalesce(string_agg(
        i.candidate_user_id::text || ':' || i.position || ':' || i.exploration, ',' order by i.position), '')
      from public.discovery_impression i
      join auth.users u on u.id = i.viewer_user_id
      where u.email = '${mine}'`);

    const shown = (rows ?? [])
      .map((row) => `${row.candidate_user_id}:${row.seat}:${row.exploration}`)
      .join(',');

    check('노출 기록의 수·후보·자리·탐색이 목록과 정확히 같다', logged === shown,
      `${logged} vs ${shown}`);
  }

  // ── 7. 다시 보지 않기 ───────────────────────────────────────────────────────
  {
    const { data: account } = await other.from('app_user').select('self_person_id').maybeSingle();
    check('상대의 selfPerson 은 여전히 내게 안 보인다',
      (await me.from('person').select('id')).data?.length === 1,
      String(account?.self_person_id ?? '?').slice(0, 8));

    const theirUserId = sql(`select id from auth.users where email = '${theirs}'`);
    /**
     * **몇 명인지는 세어서 견준다.**
     *
     * 이 검사는 목록을 좁히려고 다른 참여자들을 이미 감춰 뒀다(`isolate`). 「1명」으로
     * 못박으면 그 격리가 늘 때마다 여기가 깨진다 — 지금 감춘 수는 DB 에 물어 본다.
     */
    const hiddenCount = () =>
      Number(sql(`select count(*) from public.discovery_hidden h
                  join auth.users u on u.id = h.user_id where u.email = '${mine}'`));

    const before = hiddenCount();
    await me.from('discovery_hidden').insert({ hidden_user_id: theirUserId });

    const body = await (await get('/me/discovery', myCookie)).text();
    check('다시 보지 않기로 하면 후보에서 빠진다', !body.includes(THEIR_NAME));
    // React 는 나란한 글자 마디 사이에 `<!-- -->` 를 넣는다. 수를 견줄 때 그것을 지운다.
    const plain = body.replace(/<!--\s*-->/g, '');
    check('감춘 사람이 몇인지는 말하되 누구인지는 적지 않는다',
      plain.includes(`다시 보지 않기로 한 사람 ${before + 1}명`) && !body.includes(theirUserId),
      `${before + 1}명이어야 한다`);

    await me.from('discovery_hidden').delete().eq('hidden_user_id', theirUserId);
    const back = await (await get('/me/discovery', myCookie)).text();
    check('되돌리면 다시 선다', back.includes(THEIR_NAME));
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
    check('요약이 낡은 사람은 후보에서 빠진다', !stale.includes(THEIR_NAME));

    // 그 사람이 화면을 한 번 열면 스스로 낫는다.
    await get('/me/discovery', theirCookie);
    const healed = await (await get('/me/discovery', myCookie)).text();
    check('그 사람이 화면을 열면 요약이 따라와 다시 선다', healed.includes(THEIR_NAME));
  }

  // ── 9. 참여를 끄면 풀에서 사라지고 요약도 거둬진다 ──────────────────────────
  {
    await other.rpc('set_discovery_participation', { p_on: false, p_summary: null });

    const body = await (await get('/me/discovery', myCookie)).text();
    check('참여를 끄면 후보에서 사라진다', !body.includes(THEIR_NAME));
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
