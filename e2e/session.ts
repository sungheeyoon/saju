import { execFileSync } from 'node:child_process';

import { createServerClient } from '@supabase/ssr';
import { createClient } from '@supabase/supabase-js';
import { test as base } from '@playwright/test';

/**
 * 로그인한 사람의 화면을 **진짜 브라우저로** 재는 자리.
 *
 * `auth.spec.ts` 는 로그인하지 않은 쪽만 잰다 — 세션이 없으면 백엔드가 필요 없기
 * 때문이다. 여기서부터는 필요하다. 그래서 이 파일이 하는 일은 하나다: **로컬 스택에
 * 초대된 계정을 하나 만들어 그 세션을 브라우저에 쥐여 준다.**
 *
 * ## 구글은 몰지 않는다
 *
 * 로그인 자체는 남의 화면을 지나가므로 자동화하지 않는다. 대신 **가입 관문은 그대로
 * 지난다** — 초대 명단에 넣고 GoTrue 로 가입한다. 훅이 거부하면 여기서 계정이 안
 * 생기고 시험이 그 자리에서 죽는다. 우리가 건너뛰는 것은 구글의 동의 화면뿐이다.
 *
 * ## 시험마다 **새 계정**을 만든다
 *
 * 저장된 세션 파일 하나를 여럿이 나눠 쓰면 온보딩처럼 **한 번만 할 수 있는 일**이
 * 두 번째 실행에서 다르게 끝난다. 데스크톱과 모바일이 같은 계정을 물면 그것이 곧
 * 순서에 기대는 시험이 된다. 계정 하나는 싸다 — 순서에 기대는 시험은 비싸다.
 *
 * ## 원격은 건드리지 않는다
 *
 * 접속값을 `supabase status` 에서 받는다. 개발 서버의 `.env.development.local` 은
 * 원격을 가리키므로 `playwright.config.ts` 가 그 위에 로컬 값을 덮어 띄운다. 두
 * 자리가 같은 곳을 보지 않으면 브라우저는 로컬에 로그인하고 서버는 원격에 묻는다.
 */

type Local = { api: string; anonKey: string };

/** 초대 명단은 **운영자가 SQL 로 넣는다** — `service_role` 에도 이 표는 안 열려 있다. */
const sql = (statement: string) =>
  execFileSync(
    'docker',
    ['exec', '-i', 'supabase_db_saju', 'psql', '-U', 'postgres', '-tAq', '-c', statement],
    { encoding: 'utf8' },
  ).trim();

export type Account = {
  readonly email: string;
  readonly label: string;
  /** 이 계정이 등록한 가족·친구 — `people` 을 요청했을 때만 */
  readonly managed: readonly string[];
};

/** 이 계정으로 무엇까지 만들어 둘 것인가 */
type Seed = {
  /** 자기 사주까지 저장해 둔다. `false` 면 온보딩 화면에서 시작한다 */
  readonly selfPerson: boolean;
  /** 함께 만들어 둘 가족·친구의 부를 이름 */
  readonly people?: readonly string[];
};

const BIRTH = {
  calendar: 'solar',
  date: '1990-05-15',
  time: '14:30',
  gender: 'male',
  city: '서울',
} as const;

async function seed(local: Local, wanted: Seed): Promise<{ account: Account; password: string }> {
  const stamp = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const email = `e2e-${stamp}@example.com`;
  const password = `pw-${stamp}-Aa1!`;
  const label = `민수${stamp.slice(-4)}`;

  sql(`insert into public.invite (email, note) values ('${email}', 'e2e')`);

  const client = createClient(local.api, local.anonKey, { auth: { persistSession: false } });
  const { error } = await client.auth.signUp({ email, password });
  if (error) throw new Error(`초대된 주소인데 가입이 막혔습니다 — ${error.message}`);

  if (wanted.selfPerson) {
    const saved = await client.rpc('create_self_person', {
      p_local_label: label,
      p_calendar: BIRTH.calendar,
      p_original_date: BIRTH.date,
      p_solar_date: BIRTH.date,
      p_birth_time: BIRTH.time,
      p_gender: BIRTH.gender,
      p_city: BIRTH.city,
      p_late_night_rule: 'jo',
      p_time_basis: 'localMean',
    });
    if (saved.error) throw new Error(`자기 사주를 못 넣었습니다 — ${saved.error.message}`);
  }

  for (const person of wanted.people ?? []) {
    const made = await client.rpc('create_managed_person', {
      p_local_label: person,
      p_note: null,
      p_calendar: 'solar',
      p_original_date: '1962-03-02',
      p_solar_date: '1962-03-02',
      p_birth_time: '07:10',
      p_gender: 'female',
      p_city: '대구',
      p_late_night_rule: 'jo',
      p_time_basis: 'localMean',
    });
    if (made.error) throw new Error(`${person} 을 못 넣었습니다 — ${made.error.message}`);
  }

  return { account: { email, label, managed: wanted.people ?? [] }, password };
}

/**
 * 브라우저가 들고 갈 쿠키 — **로그인해서 받는다.**
 *
 * 손으로 짓지 않는다. `@supabase/ssr` 이 서버에서 쓰는 것과 같은 client 로 로그인해
 * 그것이 적어 내려는 쿠키를 그대로 받아 낸다. 이름·조각내기·값의 모양을 우리가
 * 흉내 내기 시작하면 라이브러리가 그 규칙을 바꾸는 날 시험만 조용히 통과한다.
 */
async function cookiesFor(local: Local, email: string, password: string) {
  const jar = new Map<string, string>();
  const browser = createServerClient(local.api, local.anonKey, {
    cookies: {
      getAll: () => [...jar].map(([name, value]) => ({ name, value })),
      setAll: (written) => {
        for (const { name, value } of written) jar.set(name, value);
      },
    },
  });

  const { error } = await browser.auth.signInWithPassword({ email, password });
  if (error) throw new Error(`${email} 로그인 실패 — ${error.message}`);

  return [...jar].map(([name, value]) => ({ name, value: encodeURIComponent(value) }));
}

type Fixtures = {
  /** 자기 사주와 가족 한 명까지 넣어 둔 계정으로 로그인한 상태 */
  signedIn: Account;
  /** 가입만 끝난 계정 — 온보딩 화면에서 시작한다 */
  newcomer: Account;
};

export const test = base.extend<Fixtures, { local: Local }>({
  local: [
    async ({}, use) => {
      let status: { API_URL?: string; ANON_KEY?: string };
      try {
        status = JSON.parse(
          execFileSync('npx', ['supabase', 'status', '-o', 'json'], {
            encoding: 'utf8',
            // 붙지 않은 서비스 목록을 stderr 로 흘린다 — 검사 출력에 섞일 것이 아니다.
            stdio: ['ignore', 'pipe', 'ignore'],
          }),
        );
      } catch {
        throw new Error('로컬 Supabase 가 떠 있지 않습니다 — `npm run db:start` 뒤에 다시 도세요.');
      }
      if (!status.API_URL || !status.ANON_KEY) throw new Error('로컬 접속값을 읽지 못했습니다.');

      await use({ api: status.API_URL, anonKey: status.ANON_KEY });
    },
    { scope: 'worker' },
  ],

  signedIn: async ({ local, context, baseURL }, use) => {
    const { account, password } = await seed(local, { selfPerson: true, people: ['어머니'] });
    const cookies = await cookiesFor(local, account.email, password);
    await context.addCookies(cookies.map((one) => ({ ...one, url: baseURL as string })));
    await use(account);
  },

  newcomer: async ({ local, context, baseURL }, use) => {
    const { account, password } = await seed(local, { selfPerson: false });
    const cookies = await cookiesFor(local, account.email, password);
    await context.addCookies(cookies.map((one) => ({ ...one, url: baseURL as string })));
    await use(account);
  },
});

export { expect } from '@playwright/test';
