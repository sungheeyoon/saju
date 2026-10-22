/**
 * 맛보기 표에서 원문(생년월일 · 시각 · IP)을 찾는다 — 흐름 검사 `check-taste.mjs` 「5 · 원문」의 재는 손.
 *
 * **행을 칸별로 읽는다.** 표를 통째 글자로 뽑아(`string_agg(t::text)`) 찾던 때는 정상 시각 칸이 시각 원문과 겹치면
 * 붉었다 — `created_at` 이 `…14:30:12…` 이면 `'14:30'` 이 걸린다(#556 · #686 의 가끔 실패). 다른 시각 문자열로 바꿔도 같은
 * 일이 그 시각에 다시 난다.
 *
 * 그래서 서버 시계가 채우는 칸만 **이름으로** 원문 찾기에서 빼고(`TASTE_CLOCK_COLUMNS`), 그 칸에는 다른 것을 잰다 — 값이
 * 이번 실행의 시계 안에 있는가. 원문을 시각 칸에 담으면(예: 생일 `1990-05-15 14:30`) 시계 밖이라 그대로 잡힌다. 나머지 칸은
 * 이름을 안 적어도 다 찾는다 — 새 칸이 생기면 저절로 들어온다. 새 **시각** 칸이 생기면 `check-taste.mjs` 가 DB 의 칸 타입과
 * 이 목록을 견줘 붉다.
 */

/** 서버 시계(`now()`)가 채우는 칸 — 표마다. DB 에서 `timestamptz` 인 칸과 같아야 한다(`check-taste.mjs` 가 잰다) */
export const TASTE_CLOCK_COLUMNS = {
  taste_artifact: ['attempt_started_at', 'created_at', 'updated_at', 'expires_at'],
  taste_session: ['snapshot_at', 'created_at', 'expires_at', 'claimed_at'],
  taste_rate_event: ['at'],
  taste_daily_count: [],
};

/** 표 하나의 행 전부를 칸 이름이 붙은 JSON 배열 하나로 — `psql -tA` 한 줄이다(글 안의 줄바꿈은 `\n` 으로 적힌다) */
export const tasteRowsSql = (table) => `select coalesce(jsonb_agg(to_jsonb(t)), '[]'::jsonb) from public.${table} t`;

/**
 * 원문이 든 자리를 낸다 — 빈 배열이면 깨끗하다.
 *
 * @param {Record<string, Record<string, unknown>[]>} rowsByTable 표 이름 → 행(칸 이름 → 값)
 * @param {{ needles: (string | RegExp)[], clock: { since: number, until: number } }} what
 *   `needles` 는 시각 칸이 아닌 칸에서 찾을 원문, `clock` 은 시각 칸이 들어야 할 이번 실행의 시계(ms)
 * @returns {string[]} `표.칸: 까닭` 줄
 */
export function rawLeaks(rowsByTable, { needles, clock }) {
  const found = [];
  for (const [table, rows] of Object.entries(rowsByTable)) {
    const clockColumns = TASTE_CLOCK_COLUMNS[table];
    if (clockColumns === undefined) throw new Error(`시각 칸을 안 적은 표다 — ${table}`);
    for (const row of rows) {
      for (const [column, value] of Object.entries(row)) {
        if (value === null) continue;
        if (clockColumns.includes(column)) {
          const at = Date.parse(String(value));
          if (!(at >= clock.since && at <= clock.until)) found.push(`${table}.${column}: 이번 실행의 시계 밖 — ${value}`);
          continue;
        }
        const text = typeof value === 'string' ? value : JSON.stringify(value);
        for (const needle of needles) {
          if (typeof needle === 'string' ? text.includes(needle) : needle.test(text)) found.push(`${table}.${column}: ${needle}`);
        }
      }
    }
  }
  return found;
}
