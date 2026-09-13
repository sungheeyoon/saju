/**
 * 공유 링크를 **실제 스택에 대고** 돌린다 — 로그인 없는 쪽까지.
 *
 * 여기서 재려는 것은 단위 시험이 못 재는 자리다.
 *
 * 1. **로그인도 코드도 없이 열리는가** — 쿠키 한 줄 없이 두드린다.
 * 2. **남의 글은 못 내보내는가** — 남의 본문을 그대로 들고 와도 막힌다.
 * 3. **내부 자료가 안 실리는가** — 근거 절·프롬프트·모델이 공개 화면에 없다.
 * 4. **같은 결과는 같은 링크인가** — 두 번 눌러도 주소가 하나다.
 * 5. **원본을 다시 만들어도 보낸 글이 그대로인가** — 그리고 새 글은 새 링크를 받는다.
 * 6. **미리보기 메타데이터가 첫 HTML 에 있는가** — 수집기는 화면을 안 그린다.
 * 7. **그림이 절대 주소로 서고 그 주소가 실제로 응답하는가.**
 *
 * 모델은 안 부른다(`check-reading.mjs` 와 같은 까닭). 글은 모델이 냈다고 치고 저장
 * RPC 를 그대로 부른다 — 여기서 재는 것은 글의 내용이 아니라 **문과 화면이 이어져
 * 있는가**다.
 */
import { createClient } from '@supabase/supabase-js';
import { execFileSync } from 'node:child_process';

import { startCheckServer } from './next-server.mjs';
import { passNotice } from './notice.mjs';

const status = JSON.parse(execFileSync('npx', ['supabase', 'status', '-o', 'json'], { encoding: 'utf8' }));
const API = status.API_URL;
const PORT = Number(process.env.CHECK_PORT ?? 3216);

/**
 * 프로덕션 배포인 척한다 — **미리보기 그림이 절대 주소여야 하기 때문**이다.
 *
 * 카카오톡은 우리 화면을 안 그리고 `<head>` 만 긁어 가므로 상대 경로를 못 푼다.
 * Vercel 이 주는 값을 그대로 심어 두고, 나오는 주소가 그 값으로 서는지 잰다 —
 * 도메인을 코드에 적지 않았다는 것이 이 검사로 값이 된다.
 */
const HOST = 'saju-snowy.vercel.app';

/**
 * 미리보기 그림은 **두 장이고 쓰임이 다르다.**
 *
 * 받은 사람이 열기 전에 보는 유일한 것이 이 그림이라, 무엇이 열릴지를 그림이 말해
 * 줘야 한다 — 서비스를 소개하는 그림과 「누가 풀이를 하나 보냈다」는 그림은 다른
 * 말을 한다. 그래서 여기서도 **어느 화면이 어느 장을 쓰는지**를 따로 잰다. 한 장으로
 * 돌아가는 실수는 화면 어디에도 안 나타난다.
 */
const SITE_IMAGE = `https://${HOST}/brand/saju-share-v1.jpg`;
const READING_IMAGE = `https://${HOST}/brand/reading-share-v1.jpg`;
const COMPAT_IMAGE = `https://${HOST}/brand/compat-share-v1.jpg`;

/**
 * JPEG 가 스스로 말하는 가로세로 — **적어 둔 수가 맞는지 재려고 읽는다.**
 *
 * `og:image:width` 는 우리가 손으로 적는 값이다. 그림을 갈아 끼우면서 그 수를 안
 * 고치면 수집기는 **틀린 칸을 잡아 놓고** 그림을 그린다 — 잘린 미리보기가 나가는데
 * 우리 화면에는 아무 일도 안 일어난다. 파일에 답이 있으므로 짐작하지 않는다.
 */
const jpegSize = (bytes) => {
  const view = new DataView(bytes);
  let at = 2; // FFD8 다음부터
  while (at + 9 < view.byteLength) {
    if (view.getUint8(at) !== 0xff) {
      at += 1;
      continue;
    }
    const marker = view.getUint8(at + 1);
    /* SOF0~SOF15 중 DHT(C4)·JPG(C8)·DAC(CC) 는 크기를 안 든다 */
    if (marker >= 0xc0 && marker <= 0xcf && ![0xc4, 0xc8, 0xcc].includes(marker)) {
      return { height: view.getUint16(at + 5), width: view.getUint16(at + 7) };
    }
    at += 2 + view.getUint16(at + 2);
  }
  return null;
};

/**
 * **띄울 때가 아니라 지을 때부터** 심는다.
 *
 * 첫 화면(`/`)은 정적으로 미리 그려지므로 그 메타데이터는 **빌드 때** 굳는다. 띄울 때만
 * 주면 그 화면의 그림 주소가 `localhost` 로 굳어, 「절대 주소인가」를 재는 자리가 검사
 * 안에서만 참이 된다. Vercel 에서는 빌드에도 이 값이 있으므로 여기서도 그렇게 둔다.
 */
process.env.VERCEL_ENV = 'production';
process.env.VERCEL_PROJECT_PRODUCTION_URL = HOST;

const anon = () => createClient(API, status.ANON_KEY, { auth: { persistSession: false } });
const keyed = () => createClient(API, status.SERVICE_ROLE_KEY, { auth: { persistSession: false } });

const checks = [];
const check = (name, pass, detail = '') => {
  checks.push({ name, pass, detail });
  console.log(`${pass ? 'ok  ' : 'FAIL'} ${name}${detail ? ` — ${detail}` : ''}`);
};

const stamp = Date.now();
const tag = String(stamp).slice(-4);
const password = `pw-${stamp}-Aa1!`;
const mail = { a: `share-a-${stamp}@example.com`, b: `share-b-${stamp}@example.com` };
const NAME = { a: `민공${tag}`, b: `지공${tag}` };

/** 닉네임이 본문에 든다 — 그것이 공유본에 그대로 남는지가 검사 항목이다 */
const BODY = {
  first: `## 지금의 핵심\n\n${NAME.a}님은 ${'스스로 정한 기준 안에서 오래 버티는 편입니다. '.repeat(18)}`,
  second: `## 다시 읽은 핵심\n\n${NAME.a}님은 ${'이번에는 조금 다르게 움직이는 편으로 보입니다. '.repeat(18)}`,
};
/** 사용자에게 안 나가는 뒷부분 — 저장은 되지만 화면에도 링크에도 없어야 한다 */
const GROUNDING = '\n\n### 근거 (검사용)\n지금의 핵심 — analysis.strength [유도]';
const METAPHOR = {
  first: `늘 앞장서 걷다가 가끔 뒤를 돌아보는 사람 검사${tag}`,
  second: `한 걸음 물러서서 다시 고르는 사람 검사${tag}`,
};
const MODEL = 'gpt-5.6-luna';
const PROMPT_VERSION = 'reading-prompt-v1';
const PROMPT = `검사용 프롬프트 본문 ${tag} — 이 글자는 사용자 화면에 서면 안 된다`;
const EVIDENCE = `{"charts":{"검사근거":"${tag}"}}`;

const person = async (email, label) => {
  const client = anon();
  await client.auth.signUp({ email, password });
  await passNotice(client);
  await client.rpc('create_self_person', {
    p_local_label: label, p_calendar: 'solar',
    p_original_date: '1990-05-15', p_solar_date: '1990-05-15', p_birth_time: '14:30',
    p_gender: 'female', p_city: '서울', p_late_night_rule: 'jo', p_time_basis: 'localMean',
  });
  await client.rpc('save_my_profile', { p_nickname: label, p_intro: null });
  return client;
};

/** 모델을 안 부르고 자기 풀이 한 편을 저장한다 — 시작은 사용자 JWT, 저장은 열쇠 */
const saveSelfReading = async (client, body, metaphor) => {
  const { data: started, error: startFailure } = await client.rpc('start_reading_run', {
    p_kind: 'self',
    p_idempotency_key: `share-check-${crypto.randomUUID()}`,
    p_model: MODEL,
    p_prompt_version: PROMPT_VERSION,
  });
  if (startFailure) throw new Error(`시도를 못 열었다 — ${startFailure.message}`);

  const run = started?.[0];
  if (!run) throw new Error('시도가 시작되지 않았다');
  const { error } = await keyed().rpc('save_reading', {
    p_run_id: run.run_id,
    p_revision_a: run.revision_a,
    p_revision_b: null,
    p_output: `${body}${GROUNDING}`,
    p_score: null,
    p_metaphor: metaphor,
    p_evidence: EVIDENCE,
    p_prompt: PROMPT,
    p_prompt_version: PROMPT_VERSION,
    p_model: MODEL,
    p_generation: { temperature: 1 },
    p_viewed_at: new Date().toISOString(),
  });
  if (error) throw new Error(`풀이를 못 저장했다 — ${error.message}`);
};

const a = await person(mail.a, NAME.a);
const b = await person(mail.b, NAME.b);

await saveSelfReading(a, BODY.first, METAPHOR.first);
await saveSelfReading(b, `## 지오\n\n${NAME.b}님의 글입니다.`, `지오의 한 줄 ${tag}`);

// ── 링크를 낸다 ────────────────────────────────────────────────────────────

const share = (client, body, metaphor, kind = 'self', a = null, b = null) =>
  client.rpc('share_my_reading', {
    p_body: body, p_metaphor: metaphor, p_kind: kind, p_person_a: a, p_person_b: b,
  });

const first = await share(a, BODY.first, METAPHOR.first);
check('내 사주풀이로 공유 링크가 난다', !first.error && typeof first.data === 'string',
  first.error?.message ?? first.data);

const token = first.data;
check('토큰이 서른두 자리 난수다', /^[0-9a-f]{32}$/.test(token ?? ''), token);

const again = await share(a, BODY.first, METAPHOR.first);
check('같은 결과를 다시 공유하면 같은 링크다', again.data === token, again.data ?? again.error?.message);

// ── 못 내보내는 것들 ───────────────────────────────────────────────────────

const faked = await share(a, `${NAME.a}님, 이 링크로 들어오면 상품권을 드립니다.`, METAPHOR.first);
check('지어낸 글은 링크가 안 난다', Boolean(faked.error), faked.error?.message ?? '통과해 버렸다');

const stolen = await share(b, BODY.first, METAPHOR.first);
check('남의 풀이 본문을 들고 와도 안 난다', Boolean(stolen.error),
  stolen.error?.message ?? '통과해 버렸다');

const otherMetaphor = await share(a, BODY.first, '내가 지어 넣은 다른 한 줄');
check('한 줄 요약을 바꿔 넣어도 안 난다', Boolean(otherMetaphor.error),
  otherMetaphor.error?.message ?? '통과해 버렸다');

// ── 표는 브라우저에게 안 열린다 ────────────────────────────────────────────

const table = await anon().from('reading_share').select('token').limit(1);
check('공유본 표는 브라우저가 직접 못 읽는다', Boolean(table.error), table.error?.message ?? '읽혔다');

const asMine = await a.from('reading_share').select('token').limit(1);
check('내 것이라도 표로는 안 읽힌다', Boolean(asMine.error), asMine.error?.message ?? '읽혔다');

// ── 로그인 없는 문 ─────────────────────────────────────────────────────────

const open = await anon().rpc('shared_reading', { p_token: token });
const row = (open.data ?? [])[0];
check('로그인하지 않은 역할이 공유본을 읽는다', !open.error && row !== undefined,
  open.error?.message ?? '');
/**
 * **내주는 것을 센다.** `anon` 에게 열린 유일한 문이라, 여기 열이 하나 느는 것은
 * 로그인 없는 사람이 볼 수 있는 것이 하나 느는 일이다. 지금 나가는 다섯을 못박아
 * 두면, 여섯째가 생기는 날 그것이 **결정으로** 일어난다.
 *
 * `shared_by` 도 `version_key` 도 여기 없다 — 앞엣것은 누구의 글인지를 말하고,
 * 뒤엣것은 그 사람의 다른 링크를 짐작하게 한다.
 */
check('내주는 것은 갈래·글 둘·점수·시각뿐이다',
  row !== undefined
    && Object.keys(row).sort().join(',') === 'body,created_at,kind,metaphor,score',
  row === undefined ? '' : Object.keys(row).join(','));
check('닉네임이 든 사용자용 본문이 그대로 남는다', row?.body?.includes(`${NAME.a}님은`) === true);
check('내부 검토용 근거 절은 공유본에 없다', row?.body?.includes('### 근거') === false);

// ── 화면 ───────────────────────────────────────────────────────────────────

const { base: BASE, stop } = await startCheckServer({
  port: PORT,
  supabaseUrl: API,
  anonKey: status.ANON_KEY,
  secretKey: status.SERVICE_ROLE_KEY,
});

/** **쿠키를 한 줄도 안 보낸다** — 링크를 받은 사람이 그렇기 때문이다 */
const get = (path) => fetch(`${BASE}${path}`, { redirect: 'manual' });

const page = await get(`/share/readings/${token}`);
const html = await page.text();

check('공유 화면이 로그인 없이 열린다', page.status === 200, `HTTP ${page.status}`);
check('풀이 본문이 화면에 선다', html.includes('지금의 핵심') && html.includes(`${NAME.a}님은`));
check('한 줄 요약이 화면에 선다', html.includes(METAPHOR.first));
check('근거 절은 화면에 없다', !html.includes('analysis.strength') && !html.includes('### 근거'));
check('프롬프트와 근거 자료는 화면에 없다', !html.includes(PROMPT) && !html.includes('검사근거'));
check('시작하는 길이 위아래로 둘 선다', (html.match(/내 사주풀이 보기/g) ?? []).length >= 2);
check('가입에 코드가 필요하다는 것을 미리 말한다', html.includes('테스트 코드가 필요합니다'));

/* 원본 사용자의 손잡이는 하나도 없다 */
for (const forbidden of ['다시 풀이받기', '서비스 설문', '풀이권', '소식']) {
  check(`원본 사용자의 자리가 없다 — ${forbidden}`, !html.includes(forbidden));
}

// ── 미리보기 ───────────────────────────────────────────────────────────────

const metaIn = (source, property) =>
  new RegExp(`<meta[^>]+property="${property}"[^>]+content="([^"]*)"`).exec(source)?.[1]
  ?? new RegExp(`<meta[^>]+content="([^"]*)"[^>]+property="${property}"`).exec(source)?.[1]
  ?? null;
const namedIn = (source, name) =>
  new RegExp(`<meta[^>]+name="${name}"[^>]+content="([^"]*)"`).exec(source)?.[1]
  ?? new RegExp(`<meta[^>]+content="([^"]*)"[^>]+name="${name}"`).exec(source)?.[1]
  ?? null;
const meta = (property) => metaIn(html, property);
const named = (name) => namedIn(html, name);

check('첫 HTML 에 미리보기 제목이 있다', meta('og:title') === '사주풀이가 도착했어요 | 만세력', meta('og:title'));
check('첫 HTML 에 미리보기 설명이 있다',
  meta('og:description') === '공유된 사주풀이를 읽고, 나를 이루는 흐름도 알아보세요.', meta('og:description'));
check('공유본은 풀이 전용 그림을 쓴다', meta('og:image') === READING_IMAGE, meta('og:image'));
check('공유본이 서비스 소개 그림을 쓰지 않는다', meta('og:image') !== SITE_IMAGE);
check('트위터 카드도 같은 그림을 쓴다',
  named('twitter:card') === 'summary_large_image' && named('twitter:image') === READING_IMAGE,
  `${named('twitter:card')} ${named('twitter:image')}`);
check('미리보기에 닉네임도 풀이 문장도 없다',
  !(meta('og:title') ?? '').includes(NAME.a) && !(meta('og:description') ?? '').includes(NAME.a));
check('검색 색인에서 빠진다', (named('robots') ?? '').includes('noindex'), named('robots'));

// ── 저장한 사람과 두 사람의 궁합 ───────────────────────────────────────────

/**
 * **셋을 열고 하나를 닫았다**(ADR 0064). 내가 넣은 자료는 내보낼 수 있고, 인연
 * 궁합은 상대가 동의한 범위가 링크 하나로 바뀌므로 못 내보낸다.
 *
 * 주소가 갈린 것도 여기서 잰다 — 미리보기 그림이 주소마다 상수로 서야 해서 갈랐고,
 * 갈랐으면 **엉뚱한 주소로 열리지 않는지**가 곧 그 결정이 지켜지는지다.
 */
const { data: momId } = await a.rpc('create_managed_person', {
  p_local_label: `엄마${tag}`, p_note: null, p_calendar: 'solar',
  p_original_date: '1962-03-02', p_solar_date: '1962-03-02', p_birth_time: '07:10',
  p_gender: 'female', p_city: '대구', p_late_night_rule: 'jo', p_time_basis: 'localMean',
});
const { data: kidId } = await a.rpc('create_managed_person', {
  p_local_label: `동생${tag}`, p_note: null, p_calendar: 'solar',
  p_original_date: '1995-08-08', p_solar_date: '1995-08-08', p_birth_time: '09:20',
  p_gender: 'male', p_city: '광주', p_late_night_rule: 'jo', p_time_basis: 'localMean',
});

const PERSON_BODY = `## 엄마의 결` + String.fromCharCode(10) + `엄마${tag}님은 ${'오래 참고 나중에 말하는 편입니다. '.repeat(12)}`;
const PERSON_SAID = `오래 참고 나중에 말하는 사람 검사${tag}`;
const PAIR_BODY = `## 두 사람` + String.fromCharCode(10) + `${'둘은 같은 방향을 다른 속도로 봅니다. '.repeat(12)}`;
const PAIR_SAID = `같은 방향을 다른 속도로 걷는 둘 검사${tag}`;

const saveFor = async (kind, personA, personB, body, said, points) => {
  const { data: started, error: failure } = await a.rpc('start_reading_run', {
    p_kind: kind,
    p_idempotency_key: `share-check-${crypto.randomUUID()}`,
    p_person_a: personA,
    p_person_b: personB,
    p_model: MODEL,
    p_prompt_version: PROMPT_VERSION,
  });
  if (failure) throw new Error(`${kind} 시도를 못 열었다 — ${failure.message}`);
  const run = started?.[0];

  const saved = await keyed().rpc('save_reading', {
    p_run_id: run.run_id,
    p_revision_a: run.revision_a,
    p_revision_b: run.revision_b,
    p_output: `${body}${GROUNDING}`,
    p_score: points,
    p_metaphor: said,
    p_evidence: EVIDENCE,
    p_prompt: PROMPT,
    p_prompt_version: PROMPT_VERSION,
    p_model: MODEL,
    p_generation: { temperature: 1 },
    p_viewed_at: new Date().toISOString(),
  });
  if (saved.error) throw new Error(`${kind} 풀이를 못 저장했다 — ${saved.error.message}`);
};

await saveFor('person', momId, null, PERSON_BODY, PERSON_SAID, null);
await saveFor('private', momId, kidId, PAIR_BODY, PAIR_SAID, 72);

const personLink = await share(a, PERSON_BODY, PERSON_SAID, 'person', momId, null);
check('저장한 사람의 풀이로 링크가 난다', !personLink.error && typeof personLink.data === 'string',
  personLink.error?.message ?? personLink.data);

const pairLink = await share(a, PAIR_BODY, PAIR_SAID, 'private', momId, kidId);
check('두 사람의 궁합으로 링크가 난다', !pairLink.error && typeof pairLink.data === 'string',
  pairLink.error?.message ?? pairLink.data);

const stolenPerson = await share(b, PERSON_BODY, PERSON_SAID, 'person', momId, null);
check('남이 관리하는 사람은 공유 대상이 못 된다', Boolean(stolenPerson.error),
  stolenPerson.error?.message ?? '통과해 버렸다');

const asMatch = await share(a, PERSON_BODY, PERSON_SAID, 'match', null, null);
check('인연 궁합은 갈래 이름으로도 막힌다', Boolean(asMatch.error),
  asMatch.error?.message ?? '통과해 버렸다');

const personPage = await get(`/share/people/${personLink.data}`);
const personHtml = await personPage.text();
check('저장한 사람의 공유 화면이 로그인 없이 열린다', personPage.status === 200, `HTTP ${personPage.status}`);
check('그 사람을 부르는 이름이 든 채로 선다', personHtml.includes(`엄마${tag}님은`));
check('저장한 사람 화면은 서비스 소개 그림을 쓴다',
  metaIn(personHtml, 'og:image') === SITE_IMAGE, metaIn(personHtml, 'og:image'));

const compatPage = await get(`/share/compat/${pairLink.data}`);
const compatHtml = await compatPage.text();
check('궁합 공유 화면이 로그인 없이 열린다', compatPage.status === 200, `HTTP ${compatPage.status}`);
check('궁합은 점수까지 화면에 선다', compatHtml.includes('궁합 풀이 점수') && compatHtml.includes('72'));
check('궁합 화면은 궁합 전용 그림을 쓴다',
  metaIn(compatHtml, 'og:image') === COMPAT_IMAGE, metaIn(compatHtml, 'og:image'));
check('궁합 화면은 제 제목을 쓴다',
  metaIn(compatHtml, 'og:title') === '두 사람의 궁합이 도착했어요 | 만세력',
  metaIn(compatHtml, 'og:title'));

/**
 * **엉뚱한 주소로는 안 열린다.** 주소마다 미리보기가 다르므로, 한 사람짜리 토큰이
 * 궁합 주소로 열리면 대화창에는 「두 사람의 궁합」이 서고 열면 한 사람 글이 나온다 —
 * 미리보기가 거짓말을 하는 자리다.
 */
for (const [label, address] of [
  ['자기 풀이 토큰을 궁합 주소로', `/share/compat/${token}`],
  ['궁합 토큰을 자기 풀이 주소로', `/share/readings/${pairLink.data}`],
  ['사람 토큰을 자기 풀이 주소로', `/share/readings/${personLink.data}`],
]) {
  const wrong = await get(address);
  check(`${label} 열면 안 열린다`, wrong.status === 404, `HTTP ${wrong.status}`);
}

/**
 * **주소를 손으로 복사해 붙여 넣는 사람도 미리보기를 본다.**
 *
 * 미리보기가 공유 버튼에만 붙어 있으면, 「만세력 한번 써 봐」 하고 첫 화면 주소만
 * 보내는 사람에게는 대화창에 파란 주소 한 줄만 선다. 미리보기는 기능이 아니라 앱
 * 전체의 것이라 루트 레이아웃에 세웠고, 그것을 여기서 잰다.
 */
const home = await get('/');
const homeHtml = await home.text();
check('첫 화면에도 미리보기가 선다',
  metaIn(homeHtml, 'og:title') === '만세력 — 나와 사람 사이를 이해하는 사주',
  metaIn(homeHtml, 'og:title'));
check('첫 화면은 서비스 소개 그림을 쓴다', metaIn(homeHtml, 'og:image') === SITE_IMAGE,
  metaIn(homeHtml, 'og:image'));
check('첫 화면은 색인에서 안 빠진다',
  (namedIn(homeHtml, 'robots') ?? '').includes('noindex') === false,
  namedIn(homeHtml, 'robots') ?? '(없다)');

/**
 * 두 장을 같은 잣대로 잰다 — **응답하는가 · 삼킬 만한가 · 적어 둔 수가 맞는가.**
 *
 * 300KB 는 지금 값(둘 다 약 220KB)에 여유를 둔 선이다. 수집기는 큰 파일을 기다려
 * 주지 않고 조용히 안 싣는다 — 대화창에 제목만 남고 그 고장은 우리 화면 어디에도
 * 안 나타난다. 그림을 갈아 끼우다 무거워지면 여기서 멈춘다.
 */
for (const [label, address, said] of [
  ['서비스 소개', '/brand/saju-share-v1.jpg', homeHtml],
  ['풀이 전용', '/brand/reading-share-v1.jpg', html],
  ['궁합 전용', '/brand/compat-share-v1.jpg', compatHtml],
]) {
  const image = await get(address);
  const bytes = await image.arrayBuffer();
  check(`${label} 그림이 공개 경로에서 응답한다`,
    image.status === 200 && (image.headers.get('content-type') ?? '').includes('image/jpeg'),
    `HTTP ${image.status} ${image.headers.get('content-type')}`);
  check(`${label} 그림이 미리보기가 삼킬 만한 크기다`, bytes.byteLength < 300_000,
    `${bytes.byteLength} bytes`);

  const real = jpegSize(bytes);
  check(`${label} 그림에 적어 둔 크기가 파일과 같다`,
    real !== null
      && metaIn(said, 'og:image:width') === String(real.width)
      && metaIn(said, 'og:image:height') === String(real.height),
    `적힘 ${metaIn(said, 'og:image:width')}x${metaIn(said, 'og:image:height')} · 파일 ${real?.width}x${real?.height}`);
}

const missing = await get('/share/readings/0123456789abcdef0123456789abcdef');
const missingHtml = await missing.text();
check('없는 토큰은 404 로 안내한다',
  missing.status === 404 && missingHtml.includes('열 수 없는 링크입니다'), `HTTP ${missing.status}`);

// ── 다시 만들어도 보낸 글은 그대로 ─────────────────────────────────────────

await saveSelfReading(a, BODY.second, METAPHOR.second);

const afterRegen = await get(`/share/readings/${token}`);
const afterHtml = await afterRegen.text();
check('원본을 다시 만들어도 보낸 링크의 글은 그대로다',
  afterHtml.includes('지금의 핵심') && !afterHtml.includes('다시 읽은 핵심'));
check('보낸 링크의 한 줄 요약도 그대로다',
  afterHtml.includes(METAPHOR.first) && !afterHtml.includes(METAPHOR.second));

const next = await share(a, BODY.second, METAPHOR.second);
check('새로 만든 풀이는 새 링크를 받는다', !next.error && next.data !== token,
  next.error?.message ?? next.data);

const nextPage = await get(`/share/readings/${next.data}`);
const nextHtml = await nextPage.text();
check('새 링크는 새 글을 연다', nextHtml.includes('다시 읽은 핵심'));

stop();

const failed = checks.filter((one) => !one.pass);
console.log(`\n${checks.length - failed.length}/${checks.length} 통과`);
if (failed.length > 0) process.exit(1);
