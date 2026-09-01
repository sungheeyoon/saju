import { execFileSync } from 'node:child_process';

import { createServerClient } from '@supabase/ssr';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { test as base, type Page } from '@playwright/test';

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

/**
 * 지난 실행이 남긴 참여자를 **이 사람의 후보 목록에서 치운다.**
 *
 * 검사는 서로 나란히 돈다. 치우지 않으면 어제 만든 계정이 오늘의 후보 목록에 서고,
 * 「상대가 목록에 선다」가 자리 번호에 기대는 시험이 된다.
 */
export function hideEveryoneExcept(emails: readonly string[]): void {
  const quoted = emails.map((one) => `'${one}'`).join(', ');
  for (const email of emails) {
    sql(`insert into public.discovery_hidden (user_id, hidden_user_id)
         select u.id, p.user_id
         from auth.users u, public.discovery_profile p
         where u.email = '${email}'
           and p.user_id <> u.id
           and p.user_id not in (select id from auth.users where email in (${quoted}))
         on conflict do nothing`);
  }
}

export type Account = {
  readonly email: string;
  readonly label: string;
  /** 이 계정이 등록한 가족·친구 — `people` 을 요청했을 때만 */
  readonly managed: readonly string[];
  /**
   * 내 selfPerson — `selfPerson` 을 요청했을 때만.
   *
   * `/me/people/{이 값}` 은 화면 안에서 가는 링크가 없다(목록이 selfPerson 을 걸러 낸다).
   * 그래도 주소로는 열리므로, 그 자리가 무엇을 세우는지 재려면 id 가 필요하다.
   */
  readonly selfPersonId: string | null;
};

/**
 * 사람 하나 — **브라우저 하나와 문 하나.**
 *
 * `page` 로 화면을 몰고, `api` 로 재려는 것이 아닌 부분을 빠르게 세운다. 요청 하나를
 * pending 으로 만들려고 참여 화면부터 열 번을 누르면, 무효화를 재는 시험이 참여 화면이
 * 깨졌을 때도 빨간불이 된다 — 무엇이 깨졌는지 못 읽는 시험이 된다.
 */
export type Person = {
  readonly account: Account;
  readonly page: Page;
  readonly api: SupabaseClient;
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

async function seed(
  local: Local,
  wanted: Seed,
): Promise<{ account: Account; password: string; api: SupabaseClient }> {
  const stamp = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const email = `e2e-${stamp}@example.com`;
  const password = `pw-${stamp}-Aa1!`;
  const label = `민수${stamp.slice(-4)}`;

  sql(`insert into public.invite (email, note) values ('${email}', 'e2e')`);

  const client = createClient(local.api, local.anonKey, { auth: { persistSession: false } });
  const { error } = await client.auth.signUp({ email, password });
  if (error) throw new Error(`초대된 주소인데 가입이 막혔습니다 — ${error.message}`);
  await awaitUsable(client);

  let selfPersonId: string | null = null;

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
    selfPersonId = saved.data as string;
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

  return {
    account: { email, label, managed: wanted.people ?? [], selfPersonId },
    password,
    api: client,
  };
}

/**
 * 매칭 참여를 **RPC 로** 켠다 — 참여 화면 자체를 재는 시험만 손으로 켠다.
 *
 * 요약을 손으로 적는 것이 여기서는 맞다. 이 값은 남에 대한 사실이 아니라 이 계정이
 * 매칭 풀에 내놓는 자기 요약이고, 우리가 재려는 것은 그 숫자가 아니라 **요청·수락·
 * 무효화가 이어지는가**다.
 */
export async function optIn(api: SupabaseClient, nickname: string): Promise<void> {
  const profile = await api.from('discovery_profile').insert({ nickname, prefer_gender: 'any' });
  if (profile.error) throw new Error(`공개용 프로필을 못 넣었습니다 — ${profile.error.message}`);

  const on = await api.rpc('set_discovery_participation', {
    p_on: true,
    p_summary: {
      glyphCount: 8,
      counts: { 木: 2, 火: 2, 土: 2, 金: 1, 水: 1 },
      ratios: { 木: 0.25, 火: 0.25, 土: 0.25, 金: 0.125, 水: 0.125 },
    },
  });
  if (on.error) throw new Error(`매칭 참여를 못 켰습니다 — ${on.error.message}`);
}

/**
 * 방금 받은 토큰이 **쓸 수 있게 될 때까지** 기다린다.
 *
 * 로컬 스택에서 가끔 `JWT issued at future` 가 난다. 시계가 틀어진 것이 아니라
 * (`date` 로 재 보면 컨테이너들이 같다) `iat` 이 초 단위라 발급 순간과 검사 순간이
 * 같은 초의 앞뒤에 걸리는 것이다. 제품의 문제가 아니므로 **재시도로 넘긴다** — 다만
 * 다른 실패는 그대로 통과시켜 이 함수가 진짜 고장을 삼키지 않게 한다.
 */
async function awaitUsable(client: SupabaseClient): Promise<void> {
  const deadline = Date.now() + 3_000;
  for (;;) {
    const { error } = await client.from('app_user').select('status').maybeSingle();
    if (error === null || !error.message.includes('JWT issued at future')) return;
    if (Date.now() > deadline) throw new Error(`토큰이 계속 미래입니다 — ${error.message}`);
    await new Promise((resolve) => setTimeout(resolve, 200));
  }
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

/**
 * 자기 풀이가 **이미 저장돼 있는** 계정 — 설문을 실제로 눌러 보려면 답할 글이 있어야 한다.
 *
 * 모델은 부르지 않는다. 시도는 사용자 JWT 로 열고(자격을 `auth.uid()` 가 판정한다),
 * 저장은 `postgres` 로 한다 — 서버가 열쇠로 부르는 그 문이다. 재려는 것은 글이 어떻게
 * 만들어지는가가 아니라 **저장된 글 아래의 설문을 브라우저가 실제로 보낼 수 있는가**다.
 */
export type Reader = {
  readonly account: Account;
  /** 그 글을 만든 시도 — 설문이 매달린 자리 */
  readonly runId: string;
};

/** 저장한 사람 하나의 풀이까지 만들어 둔 계정 */
export type PersonReader = Reader & { readonly personId: string };

/**
 * 한 사람짜리 풀이 한 벌을 세워 둔다 — **모델은 안 부른다.**
 *
 * 시도는 사용자 JWT 로 열고(자격을 `auth.uid()` 가 판정한다) 저장은 `postgres` 로 한다 —
 * 서버가 열쇠로 부르는 그 문이다.
 */
async function saveReadingAs(
  api: SupabaseClient,
  email: string,
  kind: 'self' | 'person',
  personId: string | null,
  body: string,
): Promise<string> {
  const started = await api.rpc('start_reading_run', {
    p_kind: kind,
    p_idempotency_key: `e2e-${kind}-${email}`,
    p_person_a: personId,
    p_model: 'gpt-e2e',
    p_prompt_version: 'reading-prompt-v1',
  });
  if (started.error) throw new Error(`시도를 못 열었습니다 — ${started.error.message}`);

  const run = started.data?.[0];
  if (!run) throw new Error('시도가 시작되지 않았습니다');

  sql(`select public.save_reading(
         '${run.run_id}'::uuid, '${run.revision_a}'::uuid, null,
         '## ${body} — 브라우저가 읽을 글입니다.', null,
         '{"charts":{}}', '# 역할', 'reading-prompt-v1', 'gpt-e2e', '{}'::jsonb, now())`);

  return run.run_id as string;
}

type Fixtures = {
  /** 자기 사주와 가족 한 명까지 넣어 둔 계정으로 로그인한 상태 */
  signedIn: Account;
  /** 자기 풀이가 저장돼 있고 개선 활용에도 동의한 계정 */
  reader: Reader;
  /** 저장한 사람 하나의 풀이가 이미 있는 계정 */
  personReader: PersonReader;
  /** 가입만 끝난 계정 — 온보딩 화면에서 시작한다 */
  newcomer: Account;
  /**
   * 사람을 **하나 더** 연다 — 요청·수락·차단처럼 둘이 있어야 성립하는 흐름.
   *
   * 창을 따로 여는 것이 핵심이다. 한 브라우저에서 쿠키만 갈아 끼우면 「상대에게는
   * 무엇이 보이는가」를 한 번도 못 잰다 — 그 답이 이 제품의 절반이다.
   */
  openAs: (wanted: Seed) => Promise<Person>;
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

  reader: async ({ local, context, baseURL }, use) => {
    const { account, password, api } = await seed(local, { selfPerson: true });

    /*
      **설문 전체가 동의 뒤에 있다.** 이 값을 켜는 화면은 아직 없으므로(안내와
      처리방침이 설 때 온다) 여기서는 운영자가 하듯 SQL 로 켠다.
    */
    sql(`update public.app_user set improvement_consent = true
         where id = (select id from auth.users where email = '${account.email}')`);

    const runId = await saveReadingAs(api, account.email, 'self', null, '지금의 핵심');

    const cookies = await cookiesFor(local, account.email, password);
    await context.addCookies(cookies.map((one) => ({ ...one, url: baseURL as string })));
    await use({ account, runId });
  },

  personReader: async ({ local, context, baseURL }, use) => {
    const { account, password, api } = await seed(local, {
      selfPerson: true,
      people: ['어머니'],
    });

    const { data: edges } = await api.from('user_person_access').select('person_id, local_label');
    const kin = (edges ?? []).find((row) => row.local_label === '어머니');
    if (!kin) throw new Error('저장한 사람을 못 찾았습니다');

    const personId = kin.person_id as string;
    const runId = await saveReadingAs(api, account.email, 'person', personId, '어머니의 결');

    const cookies = await cookiesFor(local, account.email, password);
    await context.addCookies(cookies.map((one) => ({ ...one, url: baseURL as string })));
    await use({ account, runId, personId });
  },

  newcomer: async ({ local, context, baseURL }, use) => {
    const { account, password } = await seed(local, { selfPerson: false });
    const cookies = await cookiesFor(local, account.email, password);
    await context.addCookies(cookies.map((one) => ({ ...one, url: baseURL as string })));
    await use(account);
  },

  openAs: async ({ local, browser, baseURL }, use, testInfo) => {
    /**
     * 프로젝트가 정한 화면을 **그대로 물려준다.** 새 context 는 기본값으로 열리므로,
     * 물려주지 않으면 모바일 프로젝트에서 상대의 창만 데스크톱이 된다.
     */
    const { viewport, userAgent, deviceScaleFactor, isMobile, hasTouch } = testInfo.project.use;
    const opened: Awaited<ReturnType<typeof browser.newContext>>[] = [];

    await use(async (wanted) => {
      const { account, password, api } = await seed(local, wanted);
      const cookies = await cookiesFor(local, account.email, password);

      const context = await browser.newContext({
        viewport,
        userAgent,
        deviceScaleFactor,
        isMobile,
        hasTouch,
      });
      opened.push(context);
      await context.addCookies(cookies.map((one) => ({ ...one, url: baseURL as string })));

      return { account, page: await context.newPage(), api };
    });

    for (const context of opened) await context.close();
  },
});

export { expect } from '@playwright/test';
