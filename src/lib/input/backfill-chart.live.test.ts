import { execFileSync } from 'node:child_process';

import { createClient } from '@supabase/supabase-js';
import { describe, expect, it } from 'vitest';

import { CHART_ENGINE_VERSION, chartSnapshotOf } from '@/src/lib/saju';

import { chartOf } from './chart';
import { UnreadableRevisionError, queryFromRevision, type StoredRevision } from './revision';

/**
 * 엔진 판이 바뀐 뒤 **남의 Person 까지 여덟 글자를 다시 채우는 자리**(ADR 0071 · A3).
 *
 * 평소에는 돌지 않는다 — `call.live.test.ts` 와 같은 방식으로 잠근다.
 *
 *   BACKFILL_CHART=1 npx vitest run src/lib/input/backfill-chart.live.test.ts
 *
 * ## 읽는 길과 쓰는 길이 다르다
 *
 * 열쇠(`service_role`)는 `person`·`person_chart_revision` 에 **SELECT 권한이 없다**(재어
 * 봤다). 그래서 읽는 일은 `postgres` 로 하고, 쓰는 일만 열쇠가 조건부 문으로 한다
 * (`set_person_chart`). 새 DB 표면을 하나도 안 만드는 것이 요점이다 — ADR 0071 은 열쇠
 * 문을 **줄이는** 결정인데 그 옆에 같은 문을 새로 열 수는 없다.
 *
 * ## 원문은 기록에 안 남는다
 *
 * 찍는 것은 개수와 불투명 id 뿐이다. 생년월일시·출생지·부를 이름은 한 번도 안 찍고,
 * 부를 이름은 **읽지도 않는다** — `queryFromRevision` 이 요구하므로 자리표만 넘긴다
 * (이름은 엔진에 안 들어간다, `Query.name`).
 */

const on = process.env.BACKFILL_CHART === '1';

/** 몇 번까지 다시 해 보나 — 경합은 사람이 그 사이 입력을 고친 것이라 드물다 */
const RETRY_LIMIT = 3;

/** 이름은 계산에 안 들어간다. 진짜 라벨을 읽지 않으려고 자리표를 쓴다 */
const PLACEHOLDER = '(백필)';

const psql = (statement: string): string =>
  execFileSync(
    'docker',
    ['exec', '-i', 'supabase_db_saju', 'psql', '-U', 'postgres', '-d', 'postgres',
     '-At', '-F', '\t', '-c', statement],
    { encoding: 'utf8' },
  ).trim();

const COLUMNS = `p.id, p.current_revision_id, r.calendar, r.original_date, r.solar_date,
  coalesce(r.birth_time::text, ''), r.gender, r.city, r.late_night_rule, r.time_basis`;

type Target = { personId: string; revisionId: string; revision: StoredRevision };

const rowOf = (line: string): Target => {
  const [id, revisionId, calendar, original, solar, time, gender, city, rule, basis] =
    line.split('\t');
  return {
    personId: id,
    revisionId,
    revision: {
      calendar, original_date: original, solar_date: solar,
      birth_time: time === '' ? null : time,
      gender, city, late_night_rule: rule, time_basis: basis,
    },
  };
};

/** 아직 이 판이 아닌 사람 — **이미 최신인 행은 애초에 안 집는다**(멱등성의 절반) */
const targets = (): Target[] => {
  const out = psql(`
    select ${COLUMNS}
    from public.person p
    join public.person_chart_revision r on r.id = p.current_revision_id
    where p.current_chart is null
       or p.chart_engine_version is distinct from '${CHART_ENGINE_VERSION}'
    order by p.created_at`);
  return out === '' ? [] : out.split('\n').map(rowOf);
};

/** 한 사람의 지금 판본을 다시 읽는다 — 경합 뒤 재시도의 근거 */
const reread = (personId: string): Target | null => {
  const out = psql(`
    select ${COLUMNS}
    from public.person p
    join public.person_chart_revision r on r.id = p.current_revision_id
    where p.id = '${personId}'`);
  return out === '' ? null : rowOf(out);
};

const counts = () => ({
  total: Number(psql('select count(*) from public.person')),
  current: Number(psql(
    `select count(*) from public.person where chart_engine_version = '${CHART_ENGINE_VERSION}'`)),
  empty: Number(psql('select count(*) from public.person where current_chart is null')),
  noRevision: Number(psql(
    'select count(*) from public.person where current_chart is null and current_revision_id is null')),
  malformed: Number(psql(`select count(*) from public.person
    where current_chart is not null and not public.is_chart_snapshot(current_chart)`)),
  blankVersion: Number(psql(`select count(*) from public.person
    where current_chart is not null and coalesce(btrim(chart_engine_version), '') = ''`)),
  /** 집계를 **만드는 식**으로 group by 할 수 없다 — 글자는 바깥에서 잇는다 */
  versions: psql(`select ver || ' × ' || n from (
      select coalesce(chart_engine_version, '(비어 있음)') as ver, count(*) as n
      from public.person group by 1) t order by ver`).split('\n').filter(Boolean),
});

describe.skipIf(!on)('여덟 글자 백필', () => {
  it('판본이 있는 사람을 현재 엔진 판으로 채운다', { timeout: 600_000 }, async () => {
    const status = JSON.parse(
      execFileSync('npx', ['supabase', 'status', '-o', 'json'], { encoding: 'utf8' }));
    const keyed = createClient(status.API_URL, status.SERVICE_ROLE_KEY,
      { auth: { persistSession: false } });

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

        let chart;
        try {
          chart = chartSnapshotOf(chartOf(queryFromRevision(at.revision, PLACEHOLDER)).pillars);
        } catch (error) {
          /* 못 읽는 판본은 메우지 않는다 — 무엇을 못 읽었는지만 남긴다(원문은 안 남는다) */
          failed.push({
            personId: target.personId,
            why: error instanceof UnreadableRevisionError
              ? `못 읽는 판본 (${error.field})`
              : '계산 실패',
          });
          break;
        }

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
      `엔진 판별 개수    : ${after.versions.join(' | ')}`,
      '──────────────────────────────────────────────',
      '',
    ].join('\n'));

    /* 합격 조건 — 판본이 있는데 안 채워진 행은 없다 */
    expect(failed).toEqual([]);
    expect(after.malformed).toBe(0);
    expect(after.blankVersion).toBe(0);
    expect(after.empty - after.noRevision).toBe(0);
    expect(after.current).toBe(before.current + updated);
  });
});
