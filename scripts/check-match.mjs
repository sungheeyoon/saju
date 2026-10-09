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
import { execFileSync } from 'node:child_process';

import { startCheckServer } from './next-server.mjs';
import { passNotice, chartArgs } from './notice.mjs';
import { createChecks, sql, testNeed, fetchWhole, keyedRpc, sessionCookie, shapeOnlySummary } from './checks.mjs';
/** 공개 범위 목록의 **제품 원본** — 손으로 베끼면 문구가 바뀐 날 검사만 옛 글자를 든다 */
import { MATCH_DISCLOSURE } from '../src/lib/consent/disclosure.ts';
import { bellCount } from '../src/lib/consent/counts.ts';
import { worktreeStack } from '../src/lib/local-env.ts';

const status = JSON.parse(execFileSync('npx', ['supabase', 'status', '-o', 'json'], { encoding: 'utf8' }));
const API = status.API_URL;
const PORT = Number(process.env.CHECK_PORT ?? worktreeStack().checkPort + 2);

const anon = () => createClient(API, status.ANON_KEY, { auth: { persistSession: false } });

const { check, finish } = createChecks('check-match');

const stamp = Date.now();
/**
 * 별명에 **이번 실행의 꼬리표**를 붙인다.
 *
 * 화면 본문에서 별명을 찾아 재는 검사가 여럿인데, 지난 실행이 남긴 동명이인이 DB 에
 * 있으면 그 사람이 후보 목록에 서서 검사가 헛디딘다(재어 봤다 — 43/44). 별명 상한이
 * 여덟 자라 네 자리만 붙인다.
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

const userId = (email) => sql(`select id from auth.users where email = '${email}'`);

/** 사람 하나를 세운다 — 가입·사주·공개 프로필·참여까지 */
const person = async (email, label, birth, city, gender) => {
  const client = anon();
  await client.auth.signUp({ email, password });
  await passNotice(client);
  await keyedRpc(client, 'create_self_person', {
    p_local_label: label, p_calendar: 'solar',
    p_original_date: birth, p_solar_date: birth, p_birth_time: '14:30',
    p_gender: gender, p_city: city, p_late_night_rule: 'jo', p_time_basis: 'localMean',
    ...chartArgs(label),
  });
  return client;
};

const a = await person(aMail, '민수', '1990-05-15', '서울', 'male');
const b = await person(bMail, '지영', '1992-03-03', '부산', 'female');
const c = await person(cMail, '현우', '1988-11-20', '대구', 'male');

for (const [client, nickname, intro] of [
  [a, NAME.a, '조용한 편입니다'],
  [b, NAME.b, '주말엔 걷습니다'],
  [c, NAME.c, '요리를 합니다'],
]) {
  await client.rpc('save_my_profile', { p_nickname: nickname, p_intro: intro });
  await keyedRpc(client, 'set_discovery_participation', { p_on: true, p_summary: shapeOnlySummary, p_need: testNeed() });
}

/**
 * **이번 실행의 사람들만 서로의 후보가 되게 한다.**
 *
 * 덱은 한 번에 여섯 명이다(ADR 0115). 지난 실행이 쌓아 둔 참여자가 스무 명이면 이번 상대는
 * 목록에 못 서고, 그러면 이 검사는 「후보가 뜨는가」가 아니라 「DB 가 비어 있는가」를
 * 잰다(pgTAP 이 같은 이유로 같은 일을 한다). 검사가 DB 를 비우게 하는 대신, 이번
 * 사람들이 나머지를 목록에서 빼 두고 시작한다.
 */
const isolate = (emails) => {
  const list = emails.map((email) => `'${email}'`).join(', ');
  sql(`update public.discovery_profile set opted_in_at = null, opted_out_at = now()
       where user_id not in (select id from auth.users where email in (${list}))`);
};

isolate([aMail, bMail, cMail]);

/**
 * 다음에 홈을 열 때 목록을 **다시 뽑게 한다** (ADR 0037).
 *
 * 목록은 스냅샷이라 두 번째 열기는 아무것도 안 적는다. 사람이 새로 뽑게 하는 문은 없고
 * (새로고침 단추는 ADR 0115 에서 걷혔다) 씨앗을 고르는 문은 닫혀 있어, 검사는 스냅샷을
 * 지워 다음 열기가 새로 뽑게 한다.
 */
const forgetBoard = (email) =>
  sql(`delete from public.discovery_candidate s using auth.users u
       where u.id = s.user_id and u.email = '${email}'`);

const aCookie = await sessionCookie(status, aMail, password);
const bCookie = await sessionCookie(status, bMail, password);
const cCookie = await sessionCookie(status, cMail, password);

const { base: BASE, stop } = await startCheckServer({
  port: PORT,
  supabaseUrl: API,
  anonKey: status.ANON_KEY,
  // 풀에 오르는 값(내 사람의 여덟 글자 · 참여 요약)은 앱이 열쇠로 쓴다(G-64, ADR 0136)
  secretKey: status.SERVICE_ROLE_KEY,
});

const get = (path, cookie) => fetchWhole(`${BASE}${path}`, { headers: { cookie }, redirect: 'manual' });
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

/**
 * 요청 자리 — **그 요소 하나의 마크업만.** 인연 탭 맨 위의 받은 요청 띠와 그 시트(`#requests-lead`, ADR 0130)와 인연 기록
 * 화면의 지난 요청(`#requests-log`, `/me/matching/history`, 2026-09-29 u2)이 따로 선다.
 *
 * 요청이 종에서 인연 탭으로 오면서 같은 응답에 덱과 내 궤도 지도가 함께 선다. 그 둘은 내 일간과 후보의 점수를
 * 들고 있어야 하는 자리라, 「요청 카드가 무엇을 말하는가」를 응답 전체로 재면 덱이 걸린다. 요청 자리의 클라이언트
 * 부품은 요청 · 사람 id 만 받으므로(`requests-lead.tsx`) 서버가 그린 이 마크업이 요청이 브라우저에 내주는 글자의 전부다.
 */
const markupOf = (html, id) => {
  const at = html.indexOf(`id="${id}"`);
  if (at < 0) return '';
  const start = html.lastIndexOf('<div', at);
  const tags = /<div\b|<\/div>/g;
  tags.lastIndex = start;
  let depth = 0;
  for (let tag = tags.exec(html); tag !== null; tag = tags.exec(html)) {
    depth += tag[0] === '</div>' ? -1 : 1;
    if (depth === 0) return html.slice(start, tags.lastIndex);
  }
  return html.slice(start);
};
const leadOf = (html) => markupOf(html, 'requests-lead');
const logOf = (html) => markupOf(html, 'requests-log');
/** 지난 요청은 인연 탭이 아니라 인연 기록에 선다(2026-09-29 u2) */
const HISTORY = '/me/matching/history';

/**
 * 머리글 종의 수 — 머리글이 브라우저에서 읽는 문(`readUnreadNotifications`)과 같은 목록 · 같은 셈(`bellCount`).
 *
 * 전에는 `/me` 의 서버 HTML 에서 홈의 소식 띠 배지(`건 안 읽음`)를 쟀다. 그 띠는 종과 겹쳐 걷었고(운영자 2026-10-09),
 * 종은 브라우저에서 세므로 서버 HTML 에는 수가 없다 — HTML 로 재면 늘 「0」이라 검사가 소리 없이 통과한다.
 */
const bell = async (client) => {
  const { data, error } = await client.rpc('my_notifications');
  if (error) throw error;
  return String(bellCount((data ?? []).map((row) => ({ kind: row.kind, unread: row.read_at === null }))));
};

try {
  /**
   * ── 1. 참여자끼리 후보로 선다 ─────────────────────────────────────────────
   *
   * **현우는 매칭을 열지 않는다.** 목록을 뽑는 자리가 노출 기록을 남기므로(ADR 0009·0037),
   * 매칭을 열면 아래에서 「후보로 본 적 없는 사람」을 한 번도 못 재게 된다. 참여는
   * `person()` 이 이미 켜 두었으므로 남의 목록에는 선다.
   *
   * **홈은 참여를 여는 자리다.** `DiscoveryBoard({ participationOnly })` 가 여기서
   * `ensure_discovery_participation` 을 부르고 — 그 호출이 자기 요약을 판본에서 다시
   * 계산한다 — 목록을 읽기 전에 돌아선다.
   */
  for (const cookie of [aCookie, bCookie]) await get('/me', cookie);

  /*
    **첫 방문이 자기 요약을 판본에서 다시 계산한다.** 민수가 먼저 열었으므로 그때 민수가
    본 지영은 아직 가짜 요약이었고, 그 카드는 지금의 지영이 아니라 목록에서 빠진다
    (ADR 0037). 사람에게는 다음 목록이 그 자리이고, 검사는 스냅샷을 지워 다시 뽑게 한다.
  */
  forgetBoard(aMail);

  /**
   * **후보와 노출 기록은 `/me/matching` 에서 난다**(2026-09-18 매칭 개정, `docs/product/prd-changelog.md`).
   *
   * 홈의 중복 목록을 걷으면서 목록을 뽑는 일도 그리로 옮겨 갔다. 이 검사는 홈을 재던
   * 시절 그대로여서 **걷어낸 화면을 재고 있었고**, 첫 줄부터 빨갰다. 뒤따르던 열여섯
   * 건은 노출 기록이 안 생겨 `request_match` 가 거절한 결과이지 따로 고장난 것이
   * 아니었다.
   */
  {
    const html = await body('/me/matching', aCookie);
    check('후보 목록에 다른 참여자가 선다', html.includes(NAME.b) && html.includes(NAME.c));
    check('요청 버튼이 후보 카드에 선다', html.includes('상세 궁합 요청하기'));
  }

  // ── 2. 요청은 후보로 본 데서만 난다 ─────────────────────────────────────────
  {
    // 현우는 아직 홈을 연 적이 없다 — 민수를 후보로 본 적이 없다.
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
    /*
      **덱을 내주는 문으로 잰다.** 인연 탭에는 이제 보낸 요청도 서므로(ADR 0130) 화면 전체에서 이름을 찾으면 보낸
      요청 줄이 걸린다. 덱이 읽는 문(`my_discovery_board`)이 그 사람을 안 내주는지를 본다 — 화면이 부르는 그 문이다.
    */
    await get('/me/matching', aCookie);
    const { data: board, error } = await a.rpc('my_discovery_board');
    const names = (board ?? []).map((row) => row.nickname);
    check('청한 사람은 후보 목록에서 빠진다', !error && !names.includes(NAME.b) && names.includes(NAME.c),
      error?.message ?? names.join(', '));
  }

  // ── 4. 받는 쪽 화면 — **동의 화면이다**(인연 탭 맨 위, ADR 0130) ─────────────────
  {
    const html = leadOf(await body('/me/matching', bCookie));
    const text = plain(html);

    check('받은 요청이 인연 탭에 선다', text.includes('받은 요청') && html.includes(NAME.a));
    const news = plain(await body('/me/requests', bCookie));
    check('새 요청 알림이 종의 소식에 뜨고 인연 탭으로 간다',
      news.includes(`${NAME.a} 님이 상세 궁합을 함께 보자고 요청했어요`) && news.includes('href="/me/matching"'));
    check('소식 화면에는 받은 요청 카드가 없다', !news.includes('수락하고 궁합 열기'));

    check('수락 카드가 여덟 글자 공개와 인연 궁합을 한 문장으로 묻는다',
      text.includes('당신의 사주팔자 여덟 글자가 상대에게 공개됩니다')
        && text.includes('상대와 자세한 궁합을 함께 보는 데 동의하시겠어요'));
    /**
     * **제목이 아니라 목록을 잰다.**
     *
     * 여기서 「'서로에게 열리는 것'이 없다」를 재고 있었는데, 그건 2026-09-11 에 지워진
     * `<dt>` 제목이라 그 뒤로는 무엇을 그려도 통과했다. 되풀이되면 안 되는 것은 제목이
     * 아니라 **목록 본문**이고, 그 본문은 `MATCH_DISCLOSURE` 에 살아 있다 — 제품이
     * 문구를 고치면 이 검사도 새 문구를 본다.
     */
    check('수락 카드에 긴 공개 범위 목록을 되풀이하지 않는다',
      [...MATCH_DISCLOSURE.shown, ...MATCH_DISCLOSURE.hidden].every((line) => !html.includes(line)));
    /**
     * 문구가 「다시 서지 않고」에서 「다시 나타나지 않고」로 바뀌었는데 여기가 안
     * 따라왔다. **재는 것은 문구가 아니라 약속이므로** 갈래를 지고 있는 뒷절을 짚는다.
     */
    check('거절이 되돌아오지 않는다는 것도 누르기 전에 적는다',
      html.includes('같은 요청을 다시 받지도 않습니다'));

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

  // ── 5. 요청 하나는 딱지 하나만 켠다(ADR 0130) ─────────────────────────────────
  {
    /*
      **요청이 왔다는 소식은 종이 안 센다** — 그 요청은 인연 탭이 「답할 요청」으로 센다.
      인연 탭의 딱지는 머리글이 브라우저에서 세므로 e2e 가 잰다(`match.spec.ts`).
    */
    check('받은 요청의 도착은 종의 수에 안 선다', (await bell(b)) === '0', await bell(b));
    check('청한 쪽에는 알림이 서지 않는다 — 자기가 한 일이다',
      (await bell(a)) === '0', await bell(a));
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
      const news = plain(await body('/me/requests', cookie));
      const readings = plain(await body('/me/readings', cookie));
      check(`${who} 소식 화면에는 함께 보기 카드가 남지 않는다`,
        !news.includes('/me/match/'));
      check(`${who} 풀이 화면에 인연 궁합이 선다`,
        /* 보관함에서 여는 인연 궁합은 보관함 틀 안 주소다 — 사주풀이와 같은 옆 칸(ADR 0134 덧붙임) */
        readings.includes(partner) && readings.includes('/me/readings/match/') && readings.includes('함께 보기'));
    }

    const history = await body(HISTORY, bCookie);
    check('인연 기록에 인연 궁합이 서고 결과 화면이 기록으로 돌아온다',
      history.includes('/me/match/') && history.includes('from=history') && plain(history).includes(NAME.a));

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
    await keyedRpc(c, 'edit_person_input', {
      p_person_id: account.self_person_id,
      p_calendar: 'solar', p_original_date: '1988-11-20', p_solar_date: '1988-11-20',
      p_birth_time: '20:10', p_gender: 'male', p_city: '대구',
      p_late_night_rule: 'jo', p_time_basis: 'localMean',
      ...chartArgs('현우'),
    });

    const asker = plain(await body('/me/requests', aCookie));
    check('출생 정보를 고치면 pending 이 무효가 된다',
      asker.includes(`${NAME.c} 님과의 요청이 출생 정보가 바뀌어 무효가 됐어요`));
    const askerLog = logOf(await body(HISTORY, aCookie));
    const askerTab = text(askerLog);
    check('무효가 된 요청은 보낸 요청에서 내려간다',
      !/>보낸 요청</.test(askerLog) && askerTab.includes('끝난 요청'), askerTab.slice(0, 200));

    const other = plain(await body('/me/requests', cCookie));
    check('무효화는 양쪽 다 알림을 받는다',
      other.includes(`${NAME.a} 님과의 요청이 출생 정보가 바뀌어 무효가 됐어요`));
  }

  // ── 9. 차단은 요청과 성립한 Match 까지 거둔다 ───────────────────────────────
  {
    await a.rpc('block_user', { p_user_id: userId(bMail) });

    /**
     * **별명만 보고는 못 잰다** — 지난 알림 문장에도 상대의 별명이 있고, 그 알림은
     * 지우지 않는다(사건은 일어났다). Match 칸이 비었는지는 그 칸에만 서는 것으로 잰다 —
     * 결과로 들어가는 길이 그것이다.
     */
    const asker = plain(logOf(await body(HISTORY, aCookie)));
    const askerReadings = plain(await body('/me/readings', aCookie));
    check('차단하면 풀이 탭의 Match 가 목록에서 내려간다', !askerReadings.includes('/me/match/'));
    check('차단한 사람이 몇인지는 말하되 누구인지는 적지 않는다',
      asker.includes('차단한 사람 1명') && !asker.includes(userId(bMail)));

    const blocked = plain(await body('/me/readings', bCookie));
    check('차단당한 쪽의 풀이 탭에서도 내려간다', !blocked.includes('/me/match/'));

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
    const d = await person(dMail, '수민', '1991-07-07', '인천', 'female');
    const e = await person(eMail, '태호', '1989-02-02', '광주', 'male');
    await d.rpc('save_my_profile', { p_nickname: NAME.d, p_intro: null });
    await e.rpc('save_my_profile', { p_nickname: NAME.e, p_intro: null });
    await keyedRpc(d, 'set_discovery_participation', { p_on: true, p_summary: shapeOnlySummary, p_need: testNeed() });
    await keyedRpc(e, 'set_discovery_participation', { p_on: true, p_summary: shapeOnlySummary, p_need: testNeed() });

    isolate([aMail, bMail, cMail, dMail, eMail]);

    const dCookie = await sessionCookie(status, dMail, password);
    const eCookie = await sessionCookie(status, eMail, password);
    /**
     * 둘 다 화면을 연 **뒤에** 한 번 더 연다.
     *
     * 첫 화면에서 각자 자기 요약을 판본에서 다시 계산하므로, 상대가 아직 안 열었을 때
     * 남은 기록은 **지금의 그 사람이 아니다.** 요청은 그런 기록으로는 나지 않는다 —
     * 그것이 이 단계에서 새로 건 규칙이다(ADR 0009).
     */
    await get('/me', dCookie);
    await get('/me', eCookie);

    /*
      **다시 열어도 새 기록은 안 난다** (ADR 0037) — 목록은 만들어 둔 것을 읽을 뿐이고,
      기록은 뽑을 때 난다. 새로 뽑게 하는 문이 없으므로 스냅샷을 지워 다음 열기가
      새로 뽑게 한다.
    */
    forgetBoard(dMail);
    /* 노출 기록은 목록을 뽑는 자리에서 난다 — 홈이 아니라 매칭이다 */
    await get('/me/matching', dCookie);

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
    // 청하려면 본 적이 있어야 한다 — 현우가 이제 매칭을 연다(노출 기록이 거기서 난다).
    await get('/me/matching', cCookie);

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
    /* 종이 세는 수를 그대로 잰다(`bell`) — 홈의 소식 띠는 걷었다(2026-10-09) */
    const shown = await bell(b);
    check('읽고 나면 수가 서지 않는다', shown === '0', shown);
  }
} finally {
  stop();
}

finish();
