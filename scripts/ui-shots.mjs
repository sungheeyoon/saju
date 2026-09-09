/**
 * 화면을 전부 **찍는다** — 눈으로 훑을 한 벌을 만들려고.
 *
 *     node scripts/ui-shots.mjs [내보낼 곳]
 *
 * `ui-walk.mjs` 와 같은 상태를 쓴다. 다른 것은 사람이 모는 대신 목록을 따라 돌며
 * 데스크톱·모바일 두 폭으로 한 장씩 남긴다는 것뿐이다.
 *
 * **한 경로에 한 화면이 아니다.** `/me` 는 자기 사주가 없을 때와 있을 때가 다른 화면이고,
 * `/signup` 은 가입 전에만 선다. 그래서 목록의 단위가 상태 안의 경로다.
 */

import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

import { chromium } from '@playwright/test';

import { startCheckServer } from './next-server.mjs';
import { build } from './ui-states.mjs';
import { localStack, sql } from './ui-seed.mjs';

const out = process.argv[2] ?? 'ui-shots';
const port = process.env.UI_PORT ?? '3100';
const baseURL = `http://localhost:${port}`;

/**
 * **끝난 뒤를 찍을 때는 날짜가 아니라 시계를 옮긴다.**
 *
 * `/closed` 는 종료일이 지나야 서므로 전에는 일정 줄을 옛 날짜로 갈아 끼웠다. 그러면
 * 그 화면만 약속하지 않은 날짜를 찍는다 — `/privacy` 와 `/signup` 이 「10월 31일 종료 ·
 * 11월 30일 파기」를 적는데 「끝났습니다」가 딴 날을 들면, 훑는 사람이 문구가 아니라
 * 씨앗을 읽게 된다. 일정은 그대로 두고 이 서버의 시계만 종료일 다음 날로 민다.
 *
 * **날짜는 표에 물어본다.** 여기서 다시 적으면 정의가 둘이 되고, 둘은 갈린다 — 화면이
 * 읽는 것과 시계를 미는 근거가 갈리는 순간 이 화면은 또 딴 날을 찍는다. 화면이 보는
 * 바로 그 값(`current_beta_schedule`)에서 민다.
 *
 * **따로 세운다.** 앞의 화면들은 아직 안 끝난 때를 보여야 하므로 같은 서버를 못 쓴다.
 */
const endsOn = () => {
  const day = sql('select s.ends_on from public.current_beta_schedule() s');
  if (!day) throw new Error('일정이 비어 있습니다 — 씨앗이 안 돌았습니다.');
  return day;
};
/**
 * **`next dev` 는 한 폴더에 하나만 뜬다.** 그래서 시계를 민 쪽은 검사가 쓰는 자리를
 * 그대로 쓴다 — 따로 지어(`.next-check`) `next start` 로 세우므로 켜 둔 개발 서버와
 * 안 다툰다. `next start` 는 `NODE_ENV=production` 이라 `.env.development.local`
 * (원격 값)도 안 읽는다.
 */
const laterPort = Number(port) + 1;

async function serverPastTheEnd(day) {
  const local = localStack();
  /* 종료일 자정을 **1초 넘긴다** — 종료일은 한국 시각 그날 끝까지다 */
  const now = new Date(new Date(`${day}T23:59:59+09:00`).getTime() + 1000);
  return startCheckServer({
    port: laterPort,
    supabaseUrl: local.api,
    anonKey: local.publishableKey,
    secretKey: local.secretKey,
    whileRunning: {
      NODE_OPTIONS: `${process.env.NODE_OPTIONS ?? ''} --import ./scripts/fake-clock.mjs`.trim(),
      UI_FAKE_NOW: now.toISOString(),
    },
  });
}

/** 훑는 차례 — 사람이 실제로 지나가는 순서다 */
const PLAN = [
  {
    state: null,
    group: '익명',
    shots: [
      { id: 'home', at: '/', name: '첫 화면 (사주 입력)' },
      {
        id: 'home-result',
        at: '/?name=민수&date=1990-05-15&hour=14:30&gender=female&city=서울&rule=jo&basis=localMean&saeun=2026',
        name: '첫 화면 — 원국 결과',
      },
      { id: 'auth', at: '/auth', name: '로그인' },
      { id: 'auth-compat', at: '/auth?next=/compat', name: '로그인 — 궁합에서 온 사람' },
      { id: 'auth-denied', at: '/auth/denied', name: '로그인하지 못했습니다' },
      { id: 'privacy', at: '/privacy', name: '개인정보 처리방침' },
    ],
  },
  {
    state: 'raw',
    group: '가입',
    shots: [{ id: 'signup', at: '/signup', name: '가입 (코드·닉네임·안내 확인)' }],
  },
  {
    state: 'new',
    group: '온보딩',
    shots: [
      { id: 'me-empty', at: '/me', name: '내 계정 — 자기 사주 등록 전' },
      { id: 'people-empty', at: '/me/people', name: '저장한 사람 — 비어 있음' },
      { id: 'readings-empty', at: '/me/readings', name: '사주풀이 — 비어 있음' },
    ],
  },
  {
    state: 'full',
    group: '쓰는 중',
    shots: [
      { id: 'me', at: '/me', name: '내 계정 (홈)' },
      { id: 'self-reading', at: '/me/readings/self', name: '내 사주풀이' },
      { id: 'profile', at: '/me/profile', name: '프로필' },
      { id: 'settings', at: '/me/settings', name: '설정' },
      { id: 'people', at: '/me/people', name: '저장한 사람' },
      { id: 'person', at: (one) => `/me/people/${one.managed[0].personId}`, name: '저장한 사람 — 상세' },
      {
        id: 'person-reading',
        at: (one) => `/me/readings/${one.managed[0].personId}`,
        name: '저장한 사람 — 사주풀이',
      },
      { id: 'person-self', at: (one) => `/me/people/${one.selfPersonId}`, name: '내 원국 상세' },
      { id: 'readings', at: '/me/readings', name: '사주풀이 목록' },
      {
        id: 'feedback',
        at: '/me/readings/self',
        name: '풀이 설문',
        act: async (page) => {
          await page.getByText('이 풀이는 어떠셨어요').waitFor();
        },
      },
      { id: 'inspect', at: '/me/reading/inspect?kind=self', name: '해석 내부 보기 (검산)' },
      { id: 'discovery', at: '/me/discovery', name: '인연 찾기 설정' },
      { id: 'requests', at: '/me/requests', name: '궁합 요청과 새 소식' },
      { id: 'compat-anon', at: '/compat', name: '궁합 — 직접 입력' },
      {
        id: 'compat-anon-result',
        at: '/compat#a.date=1990-05-15&a.hour=14:30&b.date=1992-08-20&b.hour=09:00',
        name: '궁합 — 직접 입력 결과',
      },
      { id: 'my-compat', at: '/me/compat', name: '저장한 사람으로 궁합' },
      {
        id: 'my-compat-result',
        at: (one) => `/me/compat?a=${one.selfPersonId}&b=${one.managed[0].personId}`,
        name: '저장한 사람으로 궁합 — 결과',
      },
    ],
  },
  {
    state: 'pair',
    group: '인연',
    shots: [
      { id: 'match', at: (one, all) => `/me/match/${all.matchId}`, name: '함께 보는 궁합' },
      { id: 'requests-matched', at: '/me/requests', name: '요청함 — 맺어진 뒤' },
      {
        id: 'inspect-match',
        at: (one, all) => `/me/reading/inspect?kind=match&m=${all.matchId}`,
        name: '해석 내부 보기 — 궁합',
      },
    ],
  },
  /*
    **맨 끝에 둔다.** 베타를 끝내는 것은 이 DB 전체에 걸리는 값이라, 앞에 두면 뒤의
    상태들이 전부 관문에 막힌다. 찍고 나서 되돌린다.
  */
  {
    state: 'full',
    group: '베타 종료',
    /* 이 무리만 시계를 민 서버에서 찍는다 — 일정 줄은 안 건드린다 */
    from: 'later',
    shots: [
      { id: 'closed', at: '/closed', name: '베타가 끝났습니다' },
      { id: 'me-closed', at: '/me', name: '끝난 뒤 내 계정을 열면' },
    ],
  },
];

const SIZES = [
  { id: 'desktop', width: 1280, height: 900 },
  { id: 'mobile', width: 390, height: 844 },
];

const ready = await fetch(baseURL).then(
  () => true,
  () => false,
);
if (!ready) {
  console.error(`${baseURL} 에 아무도 없습니다 — \`node scripts/ui-dev.mjs\` 를 먼저 도세요.`);
  process.exit(1);
}

await mkdir(out, { recursive: true });

const browser = await chromium.launch();
const index = [];

let later = null;

for (const step of PLAN) {
  const built = step.state === null ? null : await build(step.state);
  const person = built?.people[0] ?? null;

  /* 시계를 민 서버는 **쓸 때 세운다** — 앞의 스물여덟 화면에는 필요 없다 */
  if (step.from === 'later' && later === null) {
    const day = endsOn();
    console.log(`  · 시계를 ${day} 다음으로 민 서버를 ${laterPort} 에 세웁니다`);
    later = await serverPastTheEnd(day);
  }
  const from = step.from === 'later' ? later.base : baseURL;

  for (const size of SIZES) {
    const context = await browser.newContext({
      viewport: { width: size.width, height: size.height },
      /*
        **한 배로 찍는다.** 두 배는 읽기 좋지만 한 벌이 17MB 가 되어 한 페이지에 못 싣는다.
        여기서 보려는 것은 글자의 선명함이 아니라 **배치와 문구**다.
      */
      deviceScaleFactor: 1,
      isMobile: size.id === 'mobile',
      hasTouch: size.id === 'mobile',
    });
    if (person) {
      await context.addCookies(person.cookies.map((one) => ({ ...one, url: from })));
    }
    const page = await context.newPage();

    for (const shot of step.shots) {
      const at = typeof shot.at === 'function' ? shot.at(person, built) : shot.at;
      await page.goto(`${from}${at}`, { waitUntil: 'networkidle' }).catch(() => {});
      /* 화면이 누름 뒤에만 서면 그 누름까지 하고 찍는다 — 실패해도 찍는다(그 화면도 값이다) */
      if (shot.act) await shot.act(page).catch((error) => console.log(`    ↳ ${error.message}`));
      /*
        **주소가 갈렸으면 그대로 적는다.** 관문이 다른 데로 보냈다는 뜻이고, 그것도
        훑을 값이 있는 사실이다 — 찍힌 그림만 남기면 「이 경로가 이 화면」으로 읽힌다.
      */
      const landed = new URL(page.url()).pathname + new URL(page.url()).search;

      const file = `${shot.id}-${size.id}.jpg`;
      await page.screenshot({
        path: join(out, file),
        fullPage: true,
        type: 'jpeg',
        quality: 72,
      });

      if (size.id === 'desktop') {
        index.push({ id: shot.id, group: step.group, name: shot.name, at, landed });
      }
      console.log(`  ${step.group} · ${shot.name} (${size.id})`);
    }

    await context.close();
  }
}

await writeFile(join(out, 'index.json'), `${JSON.stringify(index, null, 2)}\n`);
await browser.close();
later?.stop();
console.log(`\n${index.length}개 화면 × 2폭 → ${out}/`);
