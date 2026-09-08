/**
 * UI 를 눈으로 보려고 **로컬 스택에 사람을 세우는 자리.**
 *
 * `e2e/session.ts` 가 하는 일과 같지만 쓰는 곳이 다르다 — 저기는 시험이 재려고 세우고,
 * 여기는 사람이 보려고 세운다. 그래서 계정을 지우지 않고, 화면을 열어 둔 채로 둔다.
 *
 * **원격은 안 건드린다.** 접속값을 `supabase status` 에서만 받는다.
 * `.env.development.local` 은 프로덕션을 가리키므로 이 파일은 그 값을 한 번도 안 읽는다.
 */

import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

import { createClient } from '@supabase/supabase-js';
import { createServerClient } from '@supabase/ssr';

const here = dirname(fileURLToPath(import.meta.url));
const root = join(here, '..');

/**
 * 안내 판본을 **소스에서 읽는다.**
 *
 * 여기 문자열로 적으면 판본을 올리는 날 이 스크립트만 옛 값을 들고, 그때 가입이
 * 「안내가 바뀌었습니다」로 막힌다 — 화면이 아니라 도구가 틀린 것인데 화면을 의심하게 된다.
 */
export function noticeVersion() {
  const source = readFileSync(join(root, 'src/lib/consent/notice.ts'), 'utf8');
  const found = /NOTICE_VERSION\s*=\s*'([^']+)'/.exec(source);
  if (!found) throw new Error('NOTICE_VERSION 을 못 읽었습니다.');
  return found[1];
}

export function localStack() {
  let status;
  try {
    status = JSON.parse(
      execFileSync('npx', ['supabase', 'status', '-o', 'json'], {
        encoding: 'utf8',
        stdio: ['ignore', 'pipe', 'ignore'],
      }),
    );
  } catch {
    throw new Error('로컬 Supabase 가 안 떠 있습니다 — `npm run db:start` 뒤에 다시 도세요.');
  }
  return {
    api: status.API_URL,
    anonKey: status.ANON_KEY,
    publishableKey: status.PUBLISHABLE_KEY ?? status.ANON_KEY,
    secretKey: status.SECRET_KEY,
    serviceRoleKey: status.SERVICE_ROLE_KEY,
  };
}

/** 운영자 자리 — 테스트 코드와 베타 일정은 `service_role` 에도 안 열려 있다 */
export const sql = (statement) =>
  execFileSync(
    'docker',
    ['exec', '-i', 'supabase_db_saju', 'psql', '-U', 'postgres', '-tAq', '-c', statement],
    { encoding: 'utf8' },
  ).trim();

const CODE = 'UIWALK';

/**
 * 로컬 스택의 종료일 — **날짜를 적는 자리는 여기 하나다.**
 *
 * 화면도(`/privacy` · `/signup` · `/closed`), 끝난 뒤를 찍으려고 시계를 미는 자리도
 * 전부 표에서 읽는다(`current_beta_schedule`). 이 상수가 하는 일은 **빈 로컬 DB 에
 * 그 한 줄을 넣는 것**뿐이고, 넣고 나면 아무도 이 값을 다시 안 본다 — 두 번째로 적는
 * 자리가 생기면 그 둘은 갈리고, 갈린 날 화면 하나만 딴 날을 찍는다.
 *
 * **운영이 약속한 날과 같게 둔다.** 프로덕션의 진짜 값은 코드가 아니라 `beta_schedule`
 * 표에 있고(배포 없이 옮기려고 그렇게 뒀다), 옮겼으면 여기도 따라 고친다 —
 * `docs/ops/runbook.md` 의 「테스트 시작하기」.
 *
 * 파기 기한은 `purge_within_days` 기본값(30일)에서 DB 가 짓는다.
 */
export const BETA_ENDS_ON = '2026-10-31';

/**
 * **훑기가 만든 시도를 오늘에서 비켜 둔다.**
 *
 * 하루 전체 상한(`reading_daily_budget`)은 사람이 아니라 서비스에 걸린 벽이라, 훑기를
 * 몇 번 돌리면 도구가 제 상한에 갇힌다 — 100번째 그림을 찍고 나면 101번째 실행이
 * 「오늘 만들 수 있는 풀이를 모두 썼습니다」로 죽는다. **벽을 낮추지는 않는다**(그러면
 * 그 벽이 실제로 서는지를 영영 못 본다). 훑기가 심은 것만 어제로 미룬다 —
 * `gpt-ui-walk` 이 그 표식이고, 사람이 만든 줄에는 안 닿는다.
 */
function clearTheWalkFromToday() {
  sql(`update public.reading_run
         set created_at = created_at - interval '1 day'
       where model = 'gpt-ui-walk'
         and created_at >= (date_trunc('day', now() at time zone 'Asia/Seoul')
                            at time zone 'Asia/Seoul')`);
}

function openTheDoor() {
  sql(`insert into public.beta_schedule
         (ends_on, note, operator_name, operator_officer, operator_contact)
       select '${BETA_ENDS_ON}', 'UI 훑기', '만세력 운영자', '보기 담당', 'ops@example.com'
       where coalesce((select s.ends_on from public.current_beta_schedule() s),
                      '1900-01-01') <> '${BETA_ENDS_ON}'`);
  sql(`insert into public.signup_code (code, note, valid_on, max_uses)
       values ('${CODE}', 'ui-walk', (now() at time zone 'Asia/Seoul')::date, 1000)
       on conflict (code) do update
         set valid_on = excluded.valid_on, max_uses = excluded.max_uses`);
}

const BIRTH = {
  calendar: 'solar',
  date: '1990-05-15',
  time: '14:30',
  gender: 'male',
  city: '서울',
};

async function awaitUsable(client) {
  const deadline = Date.now() + 5_000;
  for (;;) {
    const { error } = await client.from('app_user').select('status').maybeSingle();
    if (error === null || !error.message.includes('JWT issued at future')) return;
    if (Date.now() > deadline) throw new Error(`토큰이 계속 미래입니다 — ${error.message}`);
    await new Promise((resolve) => setTimeout(resolve, 200));
  }
}

/**
 * 사람 하나를 세운다.
 *
 * `label` 은 앱 안에서 부르는 이름이 아니라 **출생 정보에 붙인 이름**이고, `nickname` 이
 * 남에게 보이는 이름이다. 둘을 같은 값으로 두면 화면에서 어느 쪽이 서 있는지 못 가른다.
 */
export async function seed(local, wanted, tag) {
  const stamp = tag ?? `${Date.now()}`.slice(-6);
  const email = `ui-${stamp}-${Math.random().toString(36).slice(2, 6)}@example.com`;
  const password = `pw-${stamp}-Aa1!`;
  const label = wanted.label ?? `민수${stamp.slice(-3)}`;
  const nickname = wanted.nickname ?? `벗${stamp.slice(-4)}`;

  const client = createClient(local.api, local.anonKey, { auth: { persistSession: false } });
  const { error } = await client.auth.signUp({ email, password });
  if (error) throw new Error(`계정을 못 만들었습니다 — ${error.message}`);
  await awaitUsable(client);

  clearTheWalkFromToday();

  if (wanted.skipSignup !== true) {
    openTheDoor();
    const current = await client.rpc('current_beta_schedule');
    const passed = await client.rpc('complete_signup', {
      p_code: CODE,
      p_nickname: nickname,
      p_version: noticeVersion(),
      p_schedule_id: current.data?.[0]?.schedule_id,
      p_improvement: true,
      p_contact: false,
    });
    if (passed.error) throw new Error(`가입을 못 끝냈습니다 — ${passed.error.message}`);
  }

  let selfPersonId = null;
  if (wanted.selfPerson) {
    const saved = await client.rpc('create_self_person', {
      p_local_label: label,
      p_calendar: BIRTH.calendar,
      p_original_date: BIRTH.date,
      p_solar_date: BIRTH.date,
      p_birth_time: BIRTH.time,
      p_gender: wanted.gender ?? BIRTH.gender,
      p_city: BIRTH.city,
      p_late_night_rule: 'jo',
      p_time_basis: 'localMean',
    });
    if (saved.error) throw new Error(`자기 사주를 못 넣었습니다 — ${saved.error.message}`);
    selfPersonId = saved.data;
  }

  const managed = [];
  /**
   * 목록의 한 줄은 **이름만일 수도, 메모를 단 것일 수도 있다.**
   *
   * 적어 둔 메모는 카드가 직접 보이는데(`PersonActions` 로 옮긴 뒤로 그 자리가 생겼다),
   * 씨앗이 메모를 하나도 안 심으면 훑기는 **그 칸이 없는 화면만** 찍는다. 문자열은 그대로
   * 두고 객체를 함께 받는다 — 부르는 쪽 대부분은 이름 하나로 족하다.
   */
  for (const wantedPerson of wanted.people ?? []) {
    const person = typeof wantedPerson === 'string' ? { label: wantedPerson } : wantedPerson;
    const made = await client.rpc('create_managed_person', {
      p_local_label: person.label,
      p_note: person.note ?? null,
      p_calendar: 'solar',
      p_original_date: person.date ?? '1962-03-02',
      p_solar_date: person.date ?? '1962-03-02',
      p_birth_time: person.time ?? '07:10',
      p_gender: person.gender ?? 'female',
      p_city: person.city ?? '대구',
      p_late_night_rule: 'jo',
      p_time_basis: 'localMean',
    });
    if (made.error) throw new Error(`${person.label} 을 못 넣었습니다 — ${made.error.message}`);
    managed.push({ label: person.label, personId: made.data });
  }

  return { email, password, label, nickname, selfPersonId, managed, api: client };
}

/** 열린 채로 있는 시도와 **그 시도가 쓸 판본** — 판본은 저장할 때 그대로여야 한다 */
function runningRun(kind, personId, matchId) {
  /*
    **궁합은 `match_id` 로만 좁힌다.** 그 시도의 `person_a`·`person_b` 는 문이 채워
    넣은 값이라 부르는 쪽이 모른다 — 여기서 `person_a is null` 을 걸면 실제로 열려 있는
    시도를 못 찾고 「없다」로 답한다.
  */
  const where = matchId
    ? [`r.status = 'running'`, `r.kind = '${kind}'`, `r.match_id = '${matchId}'`]
    : [
        `r.status = 'running'`,
        `r.kind = '${kind}'`,
        personId ? `r.person_a = '${personId}'` : 'r.person_a is null',
        'r.match_id is null',
      ];

  const row = sql(`select r.id || '|' || coalesce(s.revision_a::text, '')
                          || '|' || coalesce(s.revision_b::text, '')
                   from public.reading_run r
                   cross join lateral public.reading_scope_for(
                     r.user_id, r.kind, r.person_a, r.person_b, r.match_id) s
                   where ${where.join(' and ')}
                   order by r.created_at desc limit 1`);
  if (row === '') return null;

  const [runId, revisionA, revisionB] = row.split('|');
  return {
    run_id: runId,
    revision_a: revisionA === '' ? null : revisionA,
    revision_b: revisionB === '' ? null : revisionB,
  };
}

/**
 * 글 한 벌을 심는다 — **모델은 안 부른다.**
 *
 * 시도는 사용자 열쇠로 열고 저장은 `postgres` 로 한다. 재려는 것이 아니라 보려는 것이므로
 * 글은 화면이 실제로 받는 모양(머리글·문단·목록)을 흉내 낸 것을 넣는다 — 한 줄짜리를
 * 넣으면 어느 배치에서나 예뻐서 **깨지는 자리를 못 본다.**
 */
export async function plantReading(api, { kind, personId = null, matchId = null, title }) {
  const started = await api.rpc('start_reading_run', {
    p_kind: kind,
    p_idempotency_key: `ui-${kind}-${Math.random().toString(36).slice(2)}`,
    p_person_a: personId,
    p_person_b: null,
    p_match_id: matchId,
    p_model: 'gpt-ui-walk',
    p_prompt_version: 'reading-prompt-v7',
  });
  if (started.error) throw new Error(`시도를 못 열었습니다 — ${started.error.message}`);

  /**
   * **이미 도는 시도가 있으면 그것에 심는다.**
   *
   * 궁합이 그렇다 — 수락이 곧 시도를 연다(ADR 0038). 새로 열려고 하면 0행으로 거절되고
   * (같은 대상에 도는 시도는 하나다), 그 자리에서 「시작되지 않았습니다」로 죽으면 도구가
   * 제품의 규칙을 어기려 든 것이 된다. 열린 것을 찾아 **그 시도의 판본으로** 저장한다.
   */
  const run = started.data?.[0] ?? runningRun(kind, personId, matchId);
  if (!run) throw new Error('시도가 없습니다 — 같은 대상에 이미 끝난 글이 있습니다.');

  const body = [
    `## ${title}`,
    '',
    '이 글은 화면을 눈으로 보려고 심은 것입니다. 실제 글과 길이가 비슷해야 줄이 넘치는',
    '자리와 여백이 무너지는 자리가 그대로 드러납니다.',
    '',
    '### 지금의 결',
    '',
    '- 한 줄짜리 항목',
    '- 조금 더 길어서 좁은 화면에서 두 줄로 접히는 항목입니다. 이 정도 길이가 실제로 옵니다.',
    '',
    '> 인용도 한 번 서 봅니다.',
    '',
    '### 올해',
    '',
    '문단이 이어집니다. 여기서부터는 길이만 채웁니다 — 읽으라고 넣은 글이 아니라 배치를',
    '보려고 넣은 글입니다. 그래도 문장이 끊기지 않아야 어디가 어색한지 눈에 들어옵니다.',
  ].join('\n');

  const quoted = body.replaceAll("'", "''");
  /**
   * 비유는 **대상이 몇 사람인지에 따라 다르다.** 저장한 사람 목록의 카드가 이 문장을
   * 한 줄로 세우면서, 한 사람의 글에 두 사람 이야기가 서 있는 것이 눈에 띄었다.
   */
  const metaphor =
    kind === 'match' || kind === 'private'
      ? '서로 다른 속도로 달리던 두 사람이 같은 자전거를 타고 오르막길을 오르는 모습이에요.'
      : '느리게 데워지고 오래 식지 않는 무쇠솥 같은 결입니다.';

  sql(`select public.save_reading(
         '${run.run_id}'::uuid,
         '${run.revision_a}'::uuid,
         ${run.revision_b ? `'${run.revision_b}'::uuid` : 'null'},
         '${quoted}',
         ${kind === 'match' ? "72::smallint" : 'null'},
         '${metaphor}',
         '{"charts":{}}', '# 역할', 'reading-prompt-v7', 'gpt-ui-walk', '{}'::jsonb, now())`);

  return run.run_id;
}

/** 인연 찾기 풀에 세운다 — 요약은 앱이 넣는 값이라 손으로 준다 */
export async function participate(api) {
  const on = await api.rpc('set_discovery_participation', {
    p_on: true,
    p_summary: {
      glyphCount: 8,
      counts: { 木: 2, 火: 2, 土: 2, 金: 1, 水: 1 },
      ratios: { 木: 0.25, 火: 0.25, 土: 0.25, 金: 0.125, 水: 0.125 },
    },
  });
  if (on.error) throw new Error(`참여를 못 켰습니다 — ${on.error.message}`);
}

/** 지난 실행이 남긴 사람들을 **이 둘의 후보 목록에서 치운다** */
export function onlyTheseTwo(emails) {
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
  sql(`delete from public.discovery_snapshot s using auth.users u
       where u.id = s.user_id and u.email in (${quoted})`);
}

/**
 * 브라우저가 들고 갈 쿠키 — **로그인해서 받는다.**
 *
 * 손으로 짓지 않는다. 서버가 쓰는 것과 같은 client 로 로그인해 그것이 적어 내려는 쿠키를
 * 그대로 받는다. 이름과 조각내기를 흉내 내기 시작하면 라이브러리가 규칙을 바꾸는 날
 * **이 도구만 조용히 로그인 화면을 연다.**
 */
export async function cookiesFor(local, email, password) {
  const jar = new Map();
  const browser = createServerClient(local.api, local.publishableKey, {
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
