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

const share = (client, body, metaphor) =>
  client.rpc('share_my_reading', { p_body: body, p_metaphor: metaphor });

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
check('내주는 것은 글 둘과 시각 하나뿐이다',
  row !== undefined && Object.keys(row).sort().join(',') === 'body,created_at,metaphor',
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
