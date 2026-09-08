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

import { build } from './ui-states.mjs';
import { sql } from './ui-seed.mjs';

/** 베타를 끝내 놓는다 — `/closed` 는 **끝난 뒤에만** 서는 화면이다 */
const endBeta = () =>
  sql(`insert into public.beta_schedule
         (ends_on, note, operator_name, operator_officer, operator_contact)
       values ('2026-01-31', 'UI 훑기 — 끝난 뒤', '만세력 운영자', '보기 담당', 'ops@example.com')`);

const reopenBeta = () =>
  sql(`insert into public.beta_schedule
         (ends_on, note, operator_name, operator_officer, operator_contact)
       values ('2026-12-31', 'UI 훑기', '만세력 운영자', '보기 담당', 'ops@example.com')`);

const out = process.argv[2] ?? 'ui-shots';
const port = process.env.UI_PORT ?? '3100';
const baseURL = `http://localhost:${port}`;

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
      { id: 'profile', at: '/me/profile', name: '프로필' },
      { id: 'settings', at: '/me/settings', name: '설정' },
      { id: 'people', at: '/me/people', name: '저장한 사람' },
      { id: 'person', at: (one) => `/me/people/${one.managed[0].personId}`, name: '저장한 사람 — 상세' },
      { id: 'person-self', at: (one) => `/me/people/${one.selfPersonId}`, name: '내 원국 상세' },
      { id: 'readings', at: '/me/readings', name: '사주풀이 목록' },
      /*
        **누른 뒤에만 서는 화면이다.** 설문은 경로가 아니라 상태다 — 글을 펼치기 전에는
        안 선다(읽지도 않은 글에 답을 받는 자리가 되므로). 그래서 `act` 로 그 누름까지
        적는다.
      */
      {
        id: 'feedback',
        at: '/me',
        name: '풀이 설문 (글을 펼친 뒤)',
        act: async (page) => {
          await page.getByRole('button', { name: '자세히 보기', exact: true }).first().click();
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
    before: endBeta,
    after: reopenBeta,
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

for (const step of PLAN) {
  const built = step.state === null ? null : await build(step.state);
  const person = built?.people[0] ?? null;

  // 상태를 세운 **뒤에** 건다 — 관문을 켜 두면 그 상태를 못 만든다.
  step.before?.();

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
      await context.addCookies(person.cookies.map((one) => ({ ...one, url: baseURL })));
    }
    const page = await context.newPage();

    for (const shot of step.shots) {
      const at = typeof shot.at === 'function' ? shot.at(person, built) : shot.at;
      await page.goto(`${baseURL}${at}`, { waitUntil: 'networkidle' }).catch(() => {});
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

  step.after?.();
}

await writeFile(join(out, 'index.json'), `${JSON.stringify(index, null, 2)}\n`);
await browser.close();
console.log(`\n${index.length}개 화면 × 2폭 → ${out}/`);
