/**
 * 요청·동의·Match 를 **실제 스택에 대고** 돌린다.
 *
 * pgTAP 이 못 재는 것이 여기 넷 있다.
 *
 * 1. **동의 화면이 실제로 서는가** — 무엇이 열리는지는 수락 버튼을 누르기 전에 화면에
 *    있어야 한다. 서버가 내려보낸 본문에 그 문장이 있는지는 본문을 봐야 안다.
 * 2. **요청 화면이 상대에 대해 무엇을 내려보내는가** — 반환형에서 뺐어도 화면이 다른
 *    질의로 채워 넣으면 그 자리에서 새어 나간다.
 * 3. **알림이 사용자에게 닿는가** — 앱 내 알림만 있는 제품이라, 들어왔을 때 눈에 띄지
 *    않으면 아무에게도 닿지 않는다. `/me` 에 수가 서는지는 화면을 열어 봐야 안다.
 * 4. **Match 가 내 사람 목록을 늘리지 않는가** — 「내가 등록했다」와 「우리가 합의했다」가
 *    두 갈래로 남는지는 두 화면을 함께 봐야 안다.
 */
import { createClient } from '@supabase/supabase-js';
import { createServerClient } from '@supabase/ssr';
import { execFileSync } from 'node:child_process';

import { startCheckServer } from './next-server.mjs';

const status = JSON.parse(execFileSync('npx', ['supabase', 'status', '-o', 'json'], { encoding: 'utf8' }));
const API = status.API_URL;
const PORT = Number(process.env.CHECK_PORT ?? 3212);

const anon = () => createClient(API, status.ANON_KEY, { auth: { persistSession: false } });

const checks = [];
const check = (name, pass, detail = '') => {
  checks.push({ name, pass, detail });
  console.log(`${pass ? 'ok  ' : 'FAIL'} ${name}${detail ? ` — ${detail}` : ''}`);
};

const stamp = Date.now();
/**
 * 별명에 **이번 실행의 꼬리표**를 붙인다.
 *
 * 화면 본문에서 별명을 찾아 재는 검사가 여럿인데, 지난 실행이 남긴 동명이인이 DB 에
 * 있으면 그 사람이 후보 목록에 서서 검사가 헛디딘다(재어 봤다 — 43/44). 별명 상한이
 * 12자라 네 자리만 붙인다.
 */
const tag = String(stamp).slice(-4);
const NAME = {
  a: `민수${tag}`,
  b: `지영${tag}`,
  c: `현우${tag}`,
  d: `수민${tag}`,
  e: `태호${tag}`,
};
const password = `pw-${stamp}-Aa1!`;
const aMail = `asker-${stamp}@example.com`;
const bMail = `answerer-${stamp}@example.com`;
const cMail = `third-${stamp}@example.com`;

const sql = (statement) =>
  execFileSync('docker', ['exec', '-i', 'supabase_db_saju', 'psql', '-U', 'postgres', '-tAq', '-c', statement],
    { encoding: 'utf8' }).trim();

const userId = (email) => sql(`select id from auth.users where email = '${email}'`);

sql(`insert into public.invite (email, note) values
     ('${aMail}', '검사'), ('${bMail}', '검사'), ('${cMail}', '검사')`);

/** 사람 하나를 세운다 — 가입·사주·공개 프로필·참여까지 */
const person = async (email, label, birth, city, gender) => {
  const client = anon();
  await client.auth.signUp({ email, password });
  await client.rpc('create_self_person', {
    p_local_label: label, p_calendar: 'solar',
    p_original_date: birth, p_solar_date: birth, p_birth_time: '14:30',
    p_gender: gender, p_city: city, p_late_night_rule: 'jo', p_time_basis: 'localMean',
  });
  return client;
};

const a = await person(aMail, '민수', '1990-05-15', '서울', 'male');
const b = await person(bMail, '지영', '1992-03-03', '부산', 'female');
const c = await person(cMail, '현우', '1988-11-20', '대구', 'male');

/**
 * 참여를 켤 때 **모양만 맞는 가짜 요약**을 넣는다(`check-discovery` 와 같은 이유).
 * 화면을 한 번 열면 자기 판본에서 다시 계산돼 자리를 잡는다.
 */
const 가짜 = {
  glyphCount: 8,
  counts: { 木: 8, 火: 0, 土: 0, 金: 0, 水: 0 },
  ratios: { 木: 1, 火: 0, 土: 0, 金: 0, 水: 0 },
};

for (const [client, nickname, intro] of [
  [a, NAME.a, '조용한 편입니다'],
  [b, NAME.b, '주말엔 걷습니다'],
  [c, NAME.c, '요리를 합니다'],
]) {
  await client.from('discovery_profile').insert({ nickname, intro, prefer_gender: 'any' });
  await client.rpc('set_discovery_participation', { p_on: true, p_summary: 가짜 });
}


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

isolate([aMail, bMail, cMail]);

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

const aCookie = await cookieFor(aMail);
const bCookie = await cookieFor(bMail);
const cCookie = await cookieFor(cMail);

const { base: BASE, stop } = await startCheckServer({
  port: PORT,
  supabaseUrl: API,
  anonKey: status.ANON_KEY,
});

const get = (path, cookie) => fetch(`${BASE}${path}`, { headers: { cookie }, redirect: 'manual' });
const body = async (path, cookie) => (await get(path, cookie)).text();
/** React 는 나란한 글자 마디 사이에 `<!-- -->` 를 넣는다. 문장을 견줄 때 지운다 */
const plain = (html) => html.replace(/<!--\s*-->/g, '');

/**
 * 태그를 걷어 낸 본문 — **화면에 실제로 서는 글자만.**
 *
 * 배지를 마크업으로 찾으려 하면 태그 한 겹이 끼는 순간 소리 없이 못 찾고, 그때
 * 검사는 「배지가 없다」가 아니라 「0 이다」라고 말한다. 배지가 자기 말을 들고 있으면
 * (`건 안 읽음`) 겉모양이 바뀌어도 재는 것은 그대로다.
 */
const text = (html) => plain(html).replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ');

/** `/me` 의 「요청과 알림」 옆에 선 수 — 없으면 `'0'` */
const badge = async (cookie) => (/(\d+) 건 안 읽음/.exec(text(await body('/me', cookie))) ?? [null, '0'])[1];

try {
  /**
   * ── 1. 참여자끼리 후보로 선다 ─────────────────────────────────────────────
   *
   * **현우는 후보 화면을 열지 않는다.** 화면을 여는 것이 곧 노출 기록을 남기는 일이라
   * (`discovery_board` 가 고르면서 함께 적는다), 열어 버리면 아래에서 「후보로 본 적
   * 없는 사람」을 한 번도 못 재게 된다. 참여는 켜 뒀으므로 남의 목록에는 선다.
   */
  for (const cookie of [aCookie, bCookie]) await get('/me/discovery', cookie);

  {
    const html = await body('/me/discovery', aCookie);
    check('후보 목록에 다른 참여자가 선다', html.includes(NAME.b) && html.includes(NAME.c));
    check('요청 버튼이 후보 카드에 선다', html.includes('상세 궁합 요청하기'));
  }

  // ── 2. 요청은 후보로 본 데서만 난다 ─────────────────────────────────────────
  {
    // 현우는 아직 목록을 연 적이 없다 — 민수를 후보로 본 적이 없다.
    await get('/me', cCookie);
    const unseen = await c.rpc('request_match', { p_candidate_user_id: userId(aMail) });
    const nobody = await c.rpc('request_match', {
      p_candidate_user_id: '00000000-0000-0000-0000-000000000000',
    });

    check('후보로 본 적 없는 사람에게는 청할 수 없다', unseen.error !== null,
      unseen.error?.message ?? '통과돼 버렸다');
    check('없는 사람에게 청할 때와 **같은 문장**이다',
      unseen.error?.message === nobody.error?.message,
      `${unseen.error?.message} vs ${nobody.error?.message}`);
  }

  // ── 3. 민수가 지영에게 청한다 ───────────────────────────────────────────────
  const asked = await a.rpc('request_match', { p_candidate_user_id: userId(bMail) });
  check('후보로 본 사람에게는 청할 수 있다', !asked.error, asked.error?.message ?? '');

  {
    const html = await body('/me/discovery', aCookie);
    check('청한 사람은 후보 목록에서 빠진다', !html.includes(NAME.b) && html.includes(NAME.c));
  }

  // ── 4. 받는 쪽 화면 — **동의 화면이다** ─────────────────────────────────────
  {
    const html = await body('/me/requests', bCookie);
    const text = plain(html);

    check('받은 요청이 화면에 선다', text.includes('받은 요청') && html.includes(NAME.a));
    check('새 요청 알림이 뜬다',
      text.includes(`${NAME.a} 님이 상세 궁합을 함께 보자고 요청했습니다`));

    /**
     * **무엇이 열리는지는 누르기 전에 있다.** 눌러야 나타나는 고지는 「읽고 눌렀다」를
     * 보장하지 못한다.
     */
    check('수락 전에 열리는 것과 열리지 않는 것을 함께 적는다',
      html.includes('서로에게 열리는 것') && html.includes('열리지 않는 것'));
    check('여덟 글자가 전부 보일 수 있음을 수락 전에 적는다',
      html.includes('여덟 글자') && html.includes('전부 보일 수 있습니다'));
    check('그래도 출생 원문과 상대 원국 전체 판정은 열리지 않는다고 적는다',
      html.includes('정확한 생년월일시와 출생지')
        && html.includes('상대 원국 하나에 대한 전체 판정'));
    check('요청이 판본에 매여 있다고 미리 말한다',
      text.includes('출생정보 판본에 매여') || html.includes('판본에 매여'));
    check('거절이 되돌아오지 않는다는 것도 누르기 전에 적는다',
      html.includes('다시 서지 않고'));

    /** **여기서 멈추는 것들.** 반환형에서 뺀 것이 화면에서 다시 채워지지 않았는가 */
    check('상대의 생년월일시가 응답에 없다', !html.includes('1990-05-15'));
    check('상대의 출생지가 응답에 없다', !html.includes('서울'));
    check('상대의 오행 구성(개수표)이 응답에 없다',
      !html.includes('glyphCount') && !html.includes('"counts"') && !html.includes('"ratios"'));
    check('두 축의 값과 점수가 응답에 없다',
      !html.includes('combined_balance') && !/"complement"/.test(html) && !/"score"/.test(html));
    /**
     * **동의 전에는 여전히 한 글자도 안 나간다.** Match 수락은 여덟 글자 공개 가능성까지
     * 열지만, 요청을 받은 것만으로 동의가 되지는 않는다(ADR 0012). 그래서 실제 천간·지지가
     * 한 자라도 응답에 있으면 아직은 새어 나간 것이다. 고지의 한글 문장은 이 검사와
     * 겹치지 않는다.
     */
    check('천간·지지가 한 자도 응답에 없다',
      !/[甲乙丙丁戊己庚辛壬癸子丑寅卯辰巳午未申酉戌亥]/.test(html),
      (/[甲乙丙丁戊己庚辛壬癸子丑寅卯辰巳午未申酉戌亥]/.exec(html) ?? [''])[0]);
  }

  // ── 5. 앱 내 알림은 들어왔을 때 눈에 띈다 ───────────────────────────────────
  {
    check('내 사주 화면에 안 읽은 알림 수가 선다', (await badge(bCookie)) === '1', await badge(bCookie));
    check('청한 쪽에는 알림이 서지 않는다 — 자기가 한 일이다',
      (await badge(aCookie)) === '0', await badge(aCookie));
  }

  // ── 6. 요청·알림·Match 는 표로 직접 안 보인다 ───────────────────────────────
  {
    for (const [table, client] of [['match_request', b], ['notification', b], ['match', b]]) {
      const { data, error } = await client.from(table).select('*');
      check(`${table} 표는 브라우저에서 못 읽는다`, error !== null || (data ?? []).length === 0,
        error?.message ?? `${data?.length ?? '?'}줄`);
    }

    const stranger = await c.rpc('respond_to_match_request', {
      p_request_id: asked.data, p_accept: true,
    });
    check('남의 요청에는 답할 수 없다', stranger.error !== null,
      stranger.error?.message ?? '답해졌다');
  }

  // ── 7. 수락하면 Match 가 선다 ───────────────────────────────────────────────
  {
    const { data: settled, error } = await b.rpc('respond_to_match_request', {
      p_request_id: asked.data, p_accept: true,
    });
    check('수락하면 accepted 다', !error && settled === 'accepted', error?.message ?? String(settled));

    for (const [who, cookie, partner] of [['청한 쪽', aCookie, NAME.b], ['받은 쪽', bCookie, NAME.a]]) {
      const html = plain(await body('/me/requests', cookie));
      check(`${who} 화면에 함께 보는 궁합이 선다`,
        html.includes('함께 보는 궁합') && html.includes(partner));
      check(`${who} 화면에서 결과로 들어가는 길이 선다`,
        html.includes('/me/match/') && html.includes('함께 보기'));
    }

    /** **Match 는 내 사람 목록을 늘리지 않는다**(US 46) — 두 갈래로 남는다 */
    const people = await body('/me/people', aCookie);
    check('Match 상대는 등록한 사람 목록에 나타나지 않는다', !people.includes(NAME.b));
    const { data: persons } = await a.from('person').select('id');
    check('Match 가 내가 볼 수 있는 Person 을 늘리지 않는다', persons?.length === 1,
      `${persons?.length ?? '?'}줄`);
  }

  // ── 8. 입력을 고치면 pending 이 무효가 되고, 그 이유가 화면에 뜬다 ──────────
  {
    const asked2 = await a.rpc('request_match', { p_candidate_user_id: userId(cMail) });
    check('현우에게도 청한다', !asked2.error, asked2.error?.message ?? '');

    const { data: account } = await c.from('app_user').select('self_person_id').maybeSingle();
    await c.rpc('add_person_revision', {
      p_person_id: account.self_person_id,
      p_calendar: 'solar', p_original_date: '1988-11-20', p_solar_date: '1988-11-20',
      p_birth_time: '20:10', p_gender: 'male', p_city: '대구',
      p_late_night_rule: 'jo', p_time_basis: 'localMean',
    });

    const asker = plain(await body('/me/requests', aCookie));
    check('출생정보를 고치면 pending 이 무효가 된다',
      asker.includes(`${NAME.c} 님과의 요청이 출생정보 수정으로 무효가 되었습니다`));
    check('무효가 된 요청은 기다리는 목록에서 내려간다',
      asker.includes('기다리는 중인 요청이 없습니다'));

    const other = plain(await body('/me/requests', cCookie));
    check('무효화는 양쪽 다 알림을 받는다',
      other.includes(`${NAME.a} 님과의 요청이 출생정보 수정으로 무효가 되었습니다`));
  }

  // ── 9. 차단은 「다시 보지 않기」보다 넓다 ───────────────────────────────────
  {
    await a.rpc('block_user', { p_user_id: userId(bMail) });

    /**
     * **별명만 보고는 못 잰다** — 지난 알림 문장에도 상대의 별명이 있고, 그 알림은
     * 지우지 않는다(사건은 일어났다). Match 칸이 비었는지는 그 칸에만 서는 것으로 잰다 —
     * 결과로 들어가는 길이 그것이다.
     */
    const asker = plain(await body('/me/requests', aCookie));
    check('차단하면 Match 가 목록에서 내려간다', !asker.includes('/me/match/'));
    check('차단한 사람이 몇인지는 말하되 누구인지는 적지 않는다',
      asker.includes('차단한 사람 1명') && !asker.includes(userId(bMail)));

    const blocked = plain(await body('/me/requests', bCookie));
    check('차단당한 쪽에서도 내려간다', !blocked.includes('/me/match/'));

    check('그래도 Match 행은 지우지 않는다', Number(sql('select count(*) from public.match')) > 0);
  }

  /**
   * ── 10. **동시에 일어나는 일** ──────────────────────────────────────────────
   *
   * pgTAP 은 한 세션이라 이것을 못 잰다. 여기서는 `Promise.all` 이 서로 다른 접속으로
   * 나가므로 **진짜로 겹친다.**
   */
  {
    const dMail = `racer-a-${stamp}@example.com`;
    const eMail = `racer-b-${stamp}@example.com`;
    sql(`insert into public.invite (email, note) values ('${dMail}', '검사'), ('${eMail}', '검사')`);

    const d = await person(dMail, '수민', '1991-07-07', '인천', 'female');
    const e = await person(eMail, '태호', '1989-02-02', '광주', 'male');
    await d.from('discovery_profile').insert({ nickname: NAME.d, prefer_gender: 'any' });
    await e.from('discovery_profile').insert({ nickname: NAME.e, prefer_gender: 'any' });
    await d.rpc('set_discovery_participation', { p_on: true, p_summary: 가짜 });
    await e.rpc('set_discovery_participation', { p_on: true, p_summary: 가짜 });

    isolate([aMail, bMail, cMail, dMail, eMail]);

    const dCookie = await cookieFor(dMail);
    const eCookie = await cookieFor(eMail);
    /**
     * 둘 다 화면을 연 **뒤에** 한 번 더 연다.
     *
     * 첫 화면에서 각자 자기 요약을 판본에서 다시 계산하므로, 상대가 아직 안 열었을 때
     * 남은 기록은 **지금의 그 사람이 아니다.** 요청은 그런 기록으로는 나지 않는다 —
     * 그것이 이 단계에서 새로 건 규칙이다(ADR 0009).
     */
    await get('/me/discovery', dCookie);
    await get('/me/discovery', eCookie);
    await get('/me/discovery', dCookie);

    // ── 동시 수락은 Match 를 하나만 만든다 ──────────────────────────────────
    const race = await d.rpc('request_match', { p_candidate_user_id: userId(eMail) });
    check('겨루기용 요청이 난다', !race.error, race.error?.message ?? '');

    const both = await Promise.all([
      e.rpc('respond_to_match_request', { p_request_id: race.data, p_accept: true }),
      e.rpc('respond_to_match_request', { p_request_id: race.data, p_accept: true }),
    ]);
    const matchRows = Number(
      sql(`select count(*) from public.match m join public.match_request r on r.id = m.request_id
           where r.id = '${race.data}'`),
    );
    check('동시에 두 번 수락해도 Match 는 하나다', matchRows === 1, `${matchRows}행`);
    check('두 응답이 모두 accepted 를 돌려준다',
      both.every((one) => one.data === 'accepted'),
      both.map((one) => one.error?.message ?? String(one.data)).join(' / '));

    /**
     * **차단과 요청이 겹쳐도 차단된 쌍에 pending 이 남지 않는다.**
     *
     * 잠금이 없을 때는 남았다 — 차단이 살아 있던 요청을 다 거둔 **직후**에 요청 하나가
     * 들어오면 아무도 그것을 거두지 않는다. 어느 쪽이 먼저 잠그느냐에 따라 답은 둘
     * 중 하나지만(요청이 거절되거나, 만들어졌다가 그 자리에서 거둬지거나), **pending 이
     * 남는 갈래는 없어야 한다.**
     */
    // 청하려면 본 적이 있어야 한다 — 현우가 이제 목록을 연다.
    await get('/me/discovery', cCookie);

    const clash = await Promise.all([
      e.rpc('block_user', { p_user_id: userId(cMail) }),
      c.rpc('request_match', { p_candidate_user_id: userId(eMail) }),
    ]);
    const pending = Number(
      sql(`select count(*) from public.match_request r
           join auth.users u1 on u1.id = r.requester_user_id
           join auth.users u2 on u2.id = r.addressee_user_id
           where r.status = 'pending'
             and (u1.email, u2.email) in (('${cMail}', '${eMail}'), ('${eMail}', '${cMail}'))`),
    );
    check('차단과 요청이 겹쳐도 pending 은 남지 않는다', pending === 0,
      `${pending}행 — ${clash[1].error?.message ?? '요청이 만들어졌다'}`);
  }

  // ── 11. 읽음은 사건이다 ─────────────────────────────────────────────────────
  {
    await b.rpc('mark_notifications_read');
    /**
     * **배지만 본다.** 예전에는 「요청과 알림」 뒤에 아무 태그나 하나 온 뒤의 숫자를
     * 찾았는데, 그 그물에는 화면 아래 붙는 RSC 자료까지 걸린다 — 그 안에도 같은 낱말이
     * 있고 뒤따르는 값은 화면과 무관하다. 재려는 것은 **그려진 배지**다.
     */
    const shown = /([1-9]\d*) 건 안 읽음/.exec(text(await body('/me', bCookie)));
    check('읽고 나면 수가 서지 않는다', shown === null, shown?.[1] ?? '');
  }
} finally {
  stop();
}

const failed = checks.filter((entry) => !entry.pass);
console.log(`\n${checks.length - failed.length}/${checks.length} 통과`);
process.exit(failed.length === 0 ? 0 : 1);
