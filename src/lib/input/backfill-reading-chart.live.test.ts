import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';

import { describe, expect, it } from 'vitest';

import { loadLocalEnv } from '@/src/lib/local-env';
import { CHART_ENGINE_VERSION, chartSnapshotOf } from '@/src/lib/saju';

import { chartOf } from './chart';
import { UnreadableRevisionError, queryFromRevision, type StoredRevision } from './revision';

/**
 * 이미 쌓인 Match 와 Reading 에 **동의·생성 당시 여덟 글자**를 채운다 (ADR 0071 · #68).
 *
 * 평소에는 돌지 않는다 — `backfill-chart.live.test.ts` 와 같은 방식으로 잠근다.
 *
 *   BACKFILL_READING_CHART=1 npx vitest run src/lib/input/backfill-reading-chart.live.test.ts
 *
 * 원격은 **세 값이 다 있어야** 간다(같은 파일의 규율을 그대로 쓴다).
 *
 *   BACKFILL_READING_CHART=1 BACKFILL_TARGET=remote \
 *   BACKFILL_CONFIRM_PROJECT_REF=<ref> npx vitest run src/lib/input/backfill-reading-chart.live.test.ts
 *
 * ## 마이그레이션이 못 채운 나머지가 여기 온다
 *
 * `20260925120000` 이 SQL 로 채울 수 있는 것은 **매인 판본이 아직 현재인** 행뿐이다 —
 * 그때만 `person.current_chart` 가 그때의 여덟 글자와 같다고 말할 수 있다. 그 사이
 * 입력을 고친 사람의 Match·Reading 은 **옛 판본에서 다시 세어야** 하고, 그것은 절기·
 * 자시·경도를 아는 TypeScript 엔진만 할 수 있다.
 *
 * ## **#70 보다 먼저 돌아야 한다**
 *
 * #70 이 `person_chart_revision` 을 지우면 이 계산의 재료가 없어진다. 그때까지 안 채운
 * 행은 영영 못 채운다 — Match 는 보드를 못 세우고(화면이 「동의 당시 여덟 글자를 찾지
 * 못했습니다」로 닫힌다), Reading 은 「이전 명식」으로 굳는다.
 *
 * ## **새 문을 안 연다**
 *
 * 읽기도 쓰기도 `postgres` 로 한다 — 로컬은 `docker exec psql`, 원격은
 * `supabase db query --linked`(Management API). ADR 0071 은 열쇠 문을 **줄이는**
 * 결정인데 그 옆에 같은 문을 새로 열 수는 없다. `set_person_chart` 같은 영구 문을
 * 하나 더 만들지 않는 것이 요점이다 — 이 일은 한 번 돌고 끝난다.
 *
 * ## 원문도 비밀값도 기록에 안 남는다
 *
 * 찍는 것은 개수와 불투명 id 뿐이다. 생년월일시·출생지·부를 이름은 한 번도 안 찍고,
 * 부를 이름은 **읽지도 않는다** — `queryFromRevision` 이 요구하므로 자리표만 넘긴다.
 */

const on = process.env.BACKFILL_READING_CHART === '1';

/** 어디를 칠까 — **적지 않으면 로컬이다** */
const TARGET = process.env.BACKFILL_TARGET?.trim() || 'local';

const CONFIRM = 'BACKFILL_CONFIRM_PROJECT_REF';

/** 이름은 계산에 안 들어간다. 진짜 라벨을 읽지 않으려고 자리표를 쓴다 */
const PLACEHOLDER = '(백필)';

type Row = Record<string, string>;

const rowsOf = (raw: unknown): Row[] =>
  (Array.isArray(raw) ? (raw as Record<string, unknown>[]) : []).map((row) =>
    Object.fromEntries(
      Object.entries(row).map(([key, value]) => [key, value === null ? '' : String(value)]),
    ),
  );

const localSql = (statement: string): string =>
  execFileSync(
    'docker',
    ['exec', '-i', 'supabase_db_saju', 'psql', '-U', 'postgres', '-d', 'postgres', '-At',
     '-c', statement],
    { encoding: 'utf8' },
  ).trim();

const localRows = (statement: string): Row[] =>
  rowsOf(JSON.parse(localSql(`select coalesce(json_agg(src), '[]'::json) from (${statement}) src`)));

const remoteSql = (statement: string): string =>
  execFileSync(
    'npx',
    ['supabase', 'db', 'query', '--linked', '--output-format', 'json', statement],
    { encoding: 'utf8' },
  );

const remoteRows = (statement: string): Row[] =>
  rowsOf((JSON.parse(remoteSql(statement)) as { rows?: unknown }).rows);

const read = (statement: string): Row[] =>
  TARGET === 'remote' ? remoteRows(statement) : localRows(statement);

/** 쓰는 것도 같은 손이다 — 새 문을 안 연다 */
const write = (statement: string): void => {
  if (TARGET === 'remote') remoteSql(statement);
  else localSql(statement);
};

/**
 * 원격이면 **세 자리가 같은 프로젝트를 가리켜야** 한 줄도 읽지 않는다.
 *
 * 손으로 적은 ref, `--linked` 가 쓰는 ref, 앱이 붙는 URL 에서 읽은 ref. 어긋난 자리의
 * **이름만** 댄다 — ref 도 열쇠도 화면에 안 올린다.
 */
function assertRemoteTarget(): void {
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

  const disagreeing = [
    linked === confirmed ? null : 'linked project ref',
    fromUrl === confirmed ? null : 'NEXT_PUBLIC_SUPABASE_URL',
  ].filter((name): name is string => name !== null);

  if (disagreeing.length > 0) {
    throw new Error(
      `${CONFIRM} 과 어긋납니다 — ${disagreeing.join(' · ')}. 아무것도 읽지 않고 멈춥니다.`,
    );
  }
}

const BIRTH_COLUMNS = `r.calendar,
  r.original_date::text as original_date,
  r.solar_date::text as solar_date,
  coalesce(r.birth_time::text, '') as birth_time,
  r.gender,
  r.city,
  r.late_night_rule,
  r.time_basis`;

const birthOf = (row: Row, prefix = ''): StoredRevision => ({
  calendar: row[`${prefix}calendar`],
  original_date: row[`${prefix}original_date`],
  solar_date: row[`${prefix}solar_date`],
  birth_time: row[`${prefix}birth_time`] === '' ? null : row[`${prefix}birth_time`],
  gender: row[`${prefix}gender`],
  city: row[`${prefix}city`],
  late_night_rule: row[`${prefix}late_night_rule`],
  time_basis: row[`${prefix}time_basis`],
});

/** uuid 말고는 SQL 에 못 들어간다 — CLI 가 값 묶기를 안 받으므로 모양을 먼저 본다 */
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const quoted = (value: unknown): string => `'${JSON.stringify(value).replaceAll("'", "''")}'`;

/** 한 칸을 센다 — 못 읽는 판본이면 까닭만 남기고 건너뛴다 */
function glyphsFor(birth: StoredRevision): { chart: unknown } | { why: string } {
  try {
    return { chart: chartSnapshotOf(chartOf(queryFromRevision(birth, PLACEHOLDER)).pillars) };
  } catch (error) {
    return {
      why: error instanceof UnreadableRevisionError ? `못 읽는 판본 (${error.field})` : '계산 실패',
    };
  }
}

const counts = () => {
  const [one] = read(`
    select
      (select count(*) from public.match
       where chart_low is null or chart_high is null) as matches_empty,
      (select count(*) from public.match) as matches_total,
      (select count(*) from public.reading where chart_a is null) as readings_empty,
      (select count(*) from public.reading) as readings_total`);

  return {
    matchesEmpty: Number(one.matches_empty),
    matchesTotal: Number(one.matches_total),
    readingsEmpty: Number(one.readings_empty),
    readingsTotal: Number(one.readings_total),
  };
};

describe.skipIf(!on)('Match·Reading 여덟 글자 백필', () => {
  it('매인 판본에서 다시 세어 채운다', { timeout: 600_000 }, async () => {
    if (TARGET !== 'local' && TARGET !== 'remote') {
      throw new Error('BACKFILL_TARGET 은 local 또는 remote 입니다.');
    }
    if (TARGET === 'remote') assertRemoteTarget();

    const before = counts();
    const failed: { id: string; why: string }[] = [];
    let matchesFilled = 0;
    let readingsFilled = 0;

    // ── Match — 동의 당시 양쪽 여덟 글자 ────────────────────────────────────
    for (const row of read(`
      select m.id,
        lo.calendar as lo_calendar, lo.original_date::text as lo_original_date,
        lo.solar_date::text as lo_solar_date,
        coalesce(lo.birth_time::text, '') as lo_birth_time,
        lo.gender as lo_gender, lo.city as lo_city,
        lo.late_night_rule as lo_late_night_rule, lo.time_basis as lo_time_basis,
        hi.calendar as hi_calendar, hi.original_date::text as hi_original_date,
        hi.solar_date::text as hi_solar_date,
        coalesce(hi.birth_time::text, '') as hi_birth_time,
        hi.gender as hi_gender, hi.city as hi_city,
        hi.late_night_rule as hi_late_night_rule, hi.time_basis as hi_time_basis
      from public.match m
      join public.person_chart_revision lo on lo.id = m.low_revision_id
      join public.person_chart_revision hi on hi.id = m.high_revision_id
      where m.chart_low is null or m.chart_high is null
      order by m.created_at`)) {
      if (!UUID.test(row.id)) throw new Error('uuid 가 아닌 id 는 질의에 넣지 않습니다.');

      const low = glyphsFor(birthOf(row, 'lo_'));
      const high = glyphsFor(birthOf(row, 'hi_'));

      if ('why' in low || 'why' in high) {
        failed.push({ id: row.id, why: 'why' in low ? low.why : (high as { why: string }).why });
        continue;
      }

      write(`update public.match
             set chart_low = ${quoted(low.chart)}::jsonb,
                 chart_high = ${quoted(high.chart)}::jsonb,
                 chart_engine_low = '${CHART_ENGINE_VERSION}',
                 chart_engine_high = '${CHART_ENGINE_VERSION}'
             where id = '${row.id}'`);
      matchesFilled += 1;
    }

    // ── Reading — 생성 당시 여덟 글자 ───────────────────────────────────────
    for (const row of read(`
      select r.id, ${BIRTH_COLUMNS.replaceAll('r.', 'a.')}
      from public.reading r
      join public.person_chart_revision a on a.id = r.revision_a
      where r.chart_a is null
      order by r.created_at`)) {
      if (!UUID.test(row.id)) throw new Error('uuid 가 아닌 id 는 질의에 넣지 않습니다.');

      const made = glyphsFor(birthOf(row));
      if ('why' in made) {
        failed.push({ id: row.id, why: made.why });
        continue;
      }

      write(`update public.reading set chart_a = ${quoted(made.chart)}::jsonb
             where id = '${row.id}'`);
      readingsFilled += 1;
    }

    /** 두 사람짜리 글의 두 번째 칸 — 첫 칸과 따로 돈다(한쪽만 비어 있을 수 있다) */
    for (const row of read(`
      select r.id, ${BIRTH_COLUMNS.replaceAll('r.', 'b.')}
      from public.reading r
      join public.person_chart_revision b on b.id = r.revision_b
      where r.chart_b is null and r.revision_b is not null
      order by r.created_at`)) {
      if (!UUID.test(row.id)) throw new Error('uuid 가 아닌 id 는 질의에 넣지 않습니다.');

      const made = glyphsFor(birthOf(row));
      if ('why' in made) {
        failed.push({ id: row.id, why: made.why });
        continue;
      }

      write(`update public.reading set chart_b = ${quoted(made.chart)}::jsonb
             where id = '${row.id}'`);
    }

    const after = counts();

    /**
     * **보고는 stderr 로 낸다.** vitest 가 `console.log` 를 삼킨다 — 읽을 수 없는 보고는
     * 없는 보고다.
     */
    process.stderr.write([
      '',
      '── Match·Reading 여덟 글자 백필 ──────────────',
      `대상 자리         : ${TARGET === 'remote' ? '원격 (세 자리 일치 확인)' : '로컬 스택'}`,
      `현재 엔진 판      : ${CHART_ENGINE_VERSION}`,
      `Match 전체        : ${after.matchesTotal}`,
      `   └ 빈 행(시작)  : ${before.matchesEmpty}  → 끝난 뒤: ${after.matchesEmpty}`,
      `   └ 채움         : ${matchesFilled}`,
      `Reading 전체      : ${after.readingsTotal}`,
      `   └ 빈 행(시작)  : ${before.readingsEmpty}  → 끝난 뒤: ${after.readingsEmpty}`,
      `   └ 채움         : ${readingsFilled}`,
      `최종 실패         : ${failed.length}`,
      ...failed.map((one) => `   ✗ ${one.id} — ${one.why}`),
      '──────────────────────────────────────────────',
      '',
    ].join('\n'));

    /**
     * 합격 조건은 **끝난 뒤의 상태**로 쓴다. 「대상 N · 채움 N」을 단언하지 않는다 —
     * 도는 동안 누가 수락하거나 풀이를 만들면 그 수가 달라지고, 그것은 고장이 아니다.
     */
    expect(failed).toEqual([]);
    expect(after.matchesEmpty).toBe(0);
    expect(after.readingsEmpty).toBe(0);
  });
});
