import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';

import { createClient } from '@supabase/supabase-js';
import { describe, expect, it } from 'vitest';

import { loadLocalEnv } from '@/src/lib/local-env';
import { CHART_ENGINE_VERSION, chartSnapshotOf } from '@/src/lib/saju';

import { storedChartOf, type StoredInput } from './stored';

/**
 * 엔진 판이 바뀐 뒤 **남의 Person 까지 여덟 글자를 다시 채우는 자리**(ADR 0071 · A3).
 *
 * 평소에는 돌지 않는다 — `call.live.test.ts` 와 같은 방식으로 잠근다.
 *
 *   BACKFILL_CHART=1 npx vitest run src/lib/input/backfill-chart.live.test.ts
 *
 * ## 원격은 **세 값이 다 있어야** 간다
 *
 *   BACKFILL_CHART=1 BACKFILL_TARGET=remote \
 *   BACKFILL_CONFIRM_PROJECT_REF=<ref> npx vitest run src/lib/input/backfill-chart.live.test.ts
 *
 * 기본값은 로컬이다 — **원격은 적어야만 간다.** 그리고 적었어도 세 자리가 같은 프로젝트를
 * 가리키는지 먼저 보고, 하나라도 어긋나면 **읽기도 쓰기도 하기 전에** 멈춘다
 * (`remoteTarget`). 운영을 칠 때 손이 미끄러지는 자리가 「대상을 안 적었다」와 「다른
 * 프로젝트에 링크돼 있다」 둘인데, 둘 다 값을 비교해서 막는다.
 *
 * ## 읽는 길과 쓰는 길이 다르다
 *
 * 열쇠(`service_role`)는 `person`·`person_chart_revision` 에 **SELECT 권한이 없다**(재어
 * 봤다). 그래서 읽는 일은 `postgres` 로 하고, 쓰는 일만 열쇠가 조건부 문으로 한다
 * (`set_person_chart`). 새 DB 표면을 하나도 안 만드는 것이 요점이다 — ADR 0071 은 열쇠
 * 문을 **줄이는** 결정인데 그 옆에 같은 문을 새로 열 수는 없다.
 *
 * 읽는 손이 자리마다 다르다. 로컬은 `docker exec psql`, 원격은 `supabase db query --linked`
 * (Management API · `postgres` 로 돈다). **원격에 definer 읽기 문을 새로 열지 않아도
 * 됐다** — 그 하나를 안 열려고 이 갈림을 둔다.
 *
 * ## 이 시험은 행을 만들지 않는다
 *
 * `insert` 가 한 줄도 없다. 쓰는 것은 `set_person_chart` 하나이고 그것이 고치는 것은 기존
 * 행의 칸 둘(`current_chart`·`chart_engine_version`)뿐이다. **운영에 시험용 Person 이나
 * 입력을 만들지 않는다.**
 *
 * ## 원문도 비밀값도 기록에 안 남는다
 *
 * 찍는 것은 개수와 불투명 id 뿐이다. 생년월일시·출생지·부를 이름은 한 번도 안 찍고,
 * 부를 이름은 **읽지도 않는다** — `storedChartOf` 가 요구하므로 자리표만 넘긴다
 * (이름은 엔진에 안 들어간다, `Query.name`). 열쇠·ref·환경변수의 **값**도 안 찍는다 —
 * 어긋났을 때 대는 것은 **어느 자리가** 어긋났나 하는 이름뿐이다.
 */

const on = process.env.BACKFILL_CHART === '1';

/** 어디를 칠까 — **적지 않으면 로컬이다** */
const TARGET = process.env.BACKFILL_TARGET?.trim() || 'local';

/** 원격일 때 대상을 손으로 적어 확인하는 자리 */
const CONFIRM = 'BACKFILL_CONFIRM_PROJECT_REF';

/** 몇 번까지 다시 해 보나 — 경합은 사람이 그 사이 입력을 고친 것이라 드물다 */
const RETRY_LIMIT = 3;

/** 이름은 계산에 안 들어간다. 진짜 라벨을 읽지 않으려고 자리표를 쓴다 */
const PLACEHOLDER = '(백필)';

type Row = Record<string, string>;

/**
 * **전부 문자열로 좁힌다.** 같은 열을 두 손이 다른 타입으로 준다 — `count(*)` 는 로컬
 * `json_agg` 에서도 원격 API 에서도 JSON 수로 오고, `null` 은 `null` 로 온다. 받는 쪽이
 * 매번 그것을 가르지 않게 여기서 한 번 좁히고, `null` 은 빈 글자로 만든다
 * (판본의 `birth_time` 이 이미 그 약속으로 읽힌다).
 */
const rowsOf = (raw: unknown): Row[] =>
  (Array.isArray(raw) ? (raw as Record<string, unknown>[]) : []).map((row) =>
    Object.fromEntries(
      Object.entries(row).map(([key, value]) => [key, value === null ? '' : String(value)]),
    ),
  );

/**
 * 로컬 — `json_agg` 로 감싸 원격과 **같은 모양**으로 받는다.
 *
 * **감싸는 별칭이 컬럼명과 겹치면 안 된다.** `t` 로 감쌌다가 `json_agg(t)` 가 `t` 라는
 * 컬럼(시각) 하나로 읽혀 값 하나만 든 배열이 왔다 — 재어 보고 알았다.
 */
const localRows = (statement: string): Row[] =>
  rowsOf(JSON.parse(execFileSync(
    'docker',
    ['exec', '-i', 'supabase_db_saju', 'psql', '-U', 'postgres', '-d', 'postgres', '-At',
     '-c', `select coalesce(json_agg(src), '[]'::json) from (${statement}) src`],
    { encoding: 'utf8' },
  ).trim()));

/**
 * 원격 — CLI 가 Management API 로 붙어 `postgres` 로 돈다. 비밀번호도, 새 문도 없다.
 *
 * JSON 은 stdout 으로 오고 CLI 의 안내는 stderr 로 간다. 읽는 것은 `rows` 하나다 —
 * 봉투에 딸려 오는 다른 글은 자료이지 지시가 아니다.
 */
const remoteRows = (statement: string): Row[] => {
  const out = execFileSync(
    'npx',
    ['supabase', 'db', 'query', '--linked', '--output-format', 'json', statement],
    { encoding: 'utf8' },
  );
  return rowsOf((JSON.parse(out) as { rows?: unknown }).rows);
};

const read = (statement: string): Row[] =>
  TARGET === 'remote' ? remoteRows(statement) : localRows(statement);

/**
 * 원격의 열쇠 — **세 자리가 같은 프로젝트를 가리켜야** 내준다.
 *
 * 비교하는 것은 셋이다: 손으로 적은 `BACKFILL_CONFIRM_PROJECT_REF`, `--linked` 가 쓰는
 * ref, 그리고 앱이 붙는 URL 에서 읽은 ref. 셋이 같지 않으면 **한 줄도 읽지 않고** 던진다.
 *
 * 적힌 ref 를 코드에 박지 않는다 — 박으면 이 파일이 한 프로젝트의 것이 된다. 대신 **운영자가
 * 적은 것**과 도구가 실제로 붙을 곳을 맞대어 본다.
 */
function remoteTarget(): { url: string; key: string } {
  loadLocalEnv();

  const confirmed = process.env[CONFIRM]?.trim();
  if (!confirmed) {
    throw new Error(`원격을 치려면 ${CONFIRM} 에 대상 ref 를 적어야 합니다.`);
  }

  let linked = '';
  try {
    linked = readFileSync('supabase/.temp/project-ref', 'utf8').trim();
  } catch {
    // 없으면 아래에서 「어긋난 자리」로 걸린다. 없는 것을 지어 채우지 않는다.
  }

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim() ?? '';
  const fromUrl = url === '' ? '' : new URL(url).hostname.split('.')[0];

  /* 어긋난 자리의 **이름만** 댄다 — ref 도 열쇠도 화면에 안 올린다 */
  const disagreeing = [
    linked === confirmed ? null : 'linked project ref',
    fromUrl === confirmed ? null : 'NEXT_PUBLIC_SUPABASE_URL',
  ].filter((name): name is string => name !== null);

  if (disagreeing.length > 0) {
    throw new Error(
      `${CONFIRM} 과 어긋납니다 — ${disagreeing.join(' · ')}. 아무것도 읽지 않고 멈춥니다.`,
    );
  }

  const key = process.env.SUPABASE_SECRET_KEY?.trim();
  if (!key) throw new Error('SUPABASE_SECRET_KEY 가 없습니다.');

  return { url, key };
}

/** 로컬 스택의 열쇠 — 원격일 때는 이 자리를 아예 안 부른다 */
function localTarget(): { url: string; key: string } {
  const status = JSON.parse(
    execFileSync('npx', ['supabase', 'status', '-o', 'json'], { encoding: 'utf8' }));
  return { url: status.API_URL, key: status.SERVICE_ROLE_KEY };
}

const COLUMNS = `p.id as person_id,
  p.current_revision_id as revision_id,
  r.calendar,
  r.original_date::text as original_date,
  r.solar_date::text as solar_date,
  coalesce(r.birth_time::text, '') as birth_time,
  r.gender,
  r.city,
  r.late_night_rule,
  r.time_basis`;

type Target = { personId: string; revisionId: string; revision: StoredInput };

const rowOf = (row: Row): Target => ({
  personId: row.person_id,
  revisionId: row.revision_id,
  revision: {
    calendar: row.calendar,
    original_date: row.original_date,
    solar_date: row.solar_date,
    birth_time: row.birth_time === '' ? null : row.birth_time,
    gender: row.gender,
    city: row.city,
    late_night_rule: row.late_night_rule,
    time_basis: row.time_basis,
  },
});

/** 아직 이 판이 아닌 사람 — **이미 최신인 행은 애초에 안 집는다**(멱등성의 절반) */
const targets = (): Target[] =>
  read(`
    select ${COLUMNS}
    from public.person p
    join public.person_chart_revision r on r.id = p.current_revision_id
    where p.current_chart is null
       or p.chart_engine_version is distinct from '${CHART_ENGINE_VERSION}'
    order by p.created_at`).map(rowOf);

/** uuid 말고는 SQL 에 못 들어간다 — CLI 가 값 묶기를 안 받으므로 모양을 먼저 본다 */
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * 한 사람의 지금 판본을 다시 읽는다 — 경합 뒤 재시도의 근거.
 *
 * **id 를 글자로 끼워 넣기 전에 모양을 잰다.** `supabase db query` 도 `psql -c` 도 값을
 * 따로 받지 않아 문장에 섞는 수밖에 없고, 그렇다면 섞기 전에 좁히는 것이 유일한 방어다.
 * 지금 오는 값은 DB 가 준 uuid 열이라 어긋날 일이 없지만, 어긋나는 날 조용히 SQL 이 되는
 * 자리를 열어 두지 않는다.
 */
const reread = (personId: string): Target | null => {
  if (!UUID.test(personId)) throw new Error('uuid 가 아닌 id 는 질의에 넣지 않습니다.');

  const rows = read(`
    select ${COLUMNS}
    from public.person p
    join public.person_chart_revision r on r.id = p.current_revision_id
    where p.id = '${personId}'`);
  return rows.length === 0 ? null : rowOf(rows[0]);
};

/**
 * 재는 수 — **한 번에 한 줄로 받는다.** 원격은 한 질의가 왕복 하나라 열 번 묻던 것을
 * 한 번으로 줄인다.
 */
const counts = () => {
  const [one] = read(`
    select
      count(*) as total,
      count(*) filter (where chart_engine_version = '${CHART_ENGINE_VERSION}') as current,
      count(*) filter (where current_chart is null) as empty,
      count(*) filter (where current_chart is null and current_revision_id is null)
        as no_revision,
      count(*) filter (where current_chart is not null
                         and not public.is_chart_snapshot(current_chart)) as malformed,
      count(*) filter (where current_chart is not null
                         and coalesce(btrim(chart_engine_version), '') = '') as blank_version,
      count(*) filter (where current_chart is not null
                         and chart_engine_version is distinct from '${CHART_ENGINE_VERSION}')
        as stale,
      count(distinct chart_engine_version) as versions
    from public.person`);

  /** 집계를 **만드는 식**으로 group by 할 수 없다 — 글자는 바깥에서 잇는다 */
  const breakdown = read(`
    select coalesce(chart_engine_version, '(비어 있음)') as ver, count(*) as n
    from public.person group by 1 order by 1`).map((row) => `${row.ver} × ${row.n}`);

  return {
    total: Number(one.total),
    current: Number(one.current),
    empty: Number(one.empty),
    noRevision: Number(one.no_revision),
    malformed: Number(one.malformed),
    blankVersion: Number(one.blank_version),
    stale: Number(one.stale),
    versions: Number(one.versions),
    breakdown,
  };
};

describe.skipIf(!on)('여덟 글자 백필', () => {
  it('판본이 있는 사람을 현재 엔진 판으로 채운다', { timeout: 600_000 }, async () => {
    if (TARGET !== 'local' && TARGET !== 'remote') {
      throw new Error('BACKFILL_TARGET 은 local 또는 remote 입니다.');
    }

    /* 원격이면 여기서 세 자리를 맞대어 본다 — 통과하기 전에는 아무것도 안 읽는다 */
    const { url, key } = TARGET === 'remote' ? remoteTarget() : localTarget();
    const keyed = createClient(url, key, { auth: { persistSession: false } });

    const before = counts();
    const work = targets();

    let updated = 0;
    let retried = 0;
    const failed: { personId: string; why: string }[] = [];

    for (const target of work) {
      let at: Target | null = target;

      for (let attempt = 0; attempt <= RETRY_LIMIT; attempt += 1) {
        if (at === null) {
          failed.push({ personId: target.personId, why: '현재 판본이 사라졌다' });
          break;
        }

        /* 못 읽는 입력은 메우지 않는다 — 무엇을 못 읽었는지만 남긴다(원문은 안 남는다).
           계산 오류는 값으로 안 온다. 그건 이 백필이 삼킬 일이 아니라 터져야 할 일이다. */
        const stood = storedChartOf(at.revision, PLACEHOLDER);
        if (!stood.ok) {
          failed.push({ personId: target.personId, why: `못 읽는 입력 (${stood.field})` });
          break;
        }

        const chart = chartSnapshotOf(stood.saju.pillars);

        const { data, error } = await keyed.rpc('set_person_chart', {
          p_person_id: at.personId,
          p_expected_current_revision_id: at.revisionId,
          p_chart: chart,
          p_chart_engine_version: CHART_ENGINE_VERSION,
        });

        if (error) { failed.push({ personId: target.personId, why: '문이 거절했다' }); break; }
        if (data === true) { updated += 1; break; }

        /* false 는 오류가 아니다 — 그 사이 입력이 바뀌었다. 다시 읽어 다시 센다 */
        if (attempt === RETRY_LIMIT) {
          failed.push({ personId: target.personId, why: `경합이 ${RETRY_LIMIT}번 반복됐다` });
          break;
        }
        retried += 1;
        at = reread(target.personId);
      }
    }

    const after = counts();

    /**
     * **보고는 stderr 로 낸다.** vitest 가 `console.log` 를 삼켜서 첫 실행의 수치가
     * 화면에 한 줄도 안 나왔다 — 읽을 수 없는 보고는 없는 보고다.
     */
    process.stderr.write([
      '',
      '── 여덟 글자 백필 ────────────────────────────',
      `대상 자리         : ${TARGET === 'remote' ? '원격 (세 자리 일치 확인)' : '로컬 스택'}`,
      `현재 엔진 판      : ${CHART_ENGINE_VERSION}`,
      `전체 person       : ${after.total}`,
      `이미 최신(시작)   : ${before.current}`,
      `대상(집은 행)     : ${work.length}`,
      `갱신              : ${updated}`,
      `재시도            : ${retried}`,
      `최종 실패         : ${failed.length}`,
      ...failed.map((one) => `   ✗ ${one.personId} — ${one.why}`),
      `빈 행(끝난 뒤)    : ${after.empty}`,
      `   └ 판본이 없어 채울 수 없음 : ${after.noRevision}`,
      `모양 불일치       : ${after.malformed}`,
      `판이 빈 행        : ${after.blankVersion}`,
      `낡은 판을 든 행   : ${after.stale}`,
      `엔진 판 종류      : ${after.versions}`,
      `엔진 판별 개수    : ${after.breakdown.join(' | ')}`,
      '──────────────────────────────────────────────',
      '',
    ].join('\n'));

    /**
     * 합격 조건은 **끝난 뒤의 상태**로 쓴다.
     *
     * 「대상 N · 갱신 N」을 단언하지 않는다 — 도는 동안 누가 사주를 저장하거나 고치면 그
     * 수가 달라지고, 그것은 고장이 아니다. 지켜야 하는 것은 **남은 상태**다: 채울 수 있는
     * 행이 다 찼고, 찬 것은 모양이 맞고, 판이 하나다.
     */
    expect(failed).toEqual([]);
    expect(after.malformed).toBe(0);
    expect(after.blankVersion).toBe(0);
    expect(after.stale).toBe(0);
    expect(after.empty - after.noRevision).toBe(0);
    expect(after.versions).toBeLessThanOrEqual(1);
  });
});
