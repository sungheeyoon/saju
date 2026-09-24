/**
 * **S3 의 반출 객체를 DB 의 기록과 대조하는 검사** (G-23 ⑩, ADR 0105, `20261014090000`).
 *
 * S3 는 가짜(`Map`)로 대신한다 — 진짜 버킷은 AWS 계정이 서는 날 runbook 「반출」의 검증 절이 잰다. 객체의 모양은
 * `app/api/cron/audit-export/bundle.ts` 가 짓는 것과 같게 여기서 짓는다(scripts 는 app 을 못 부른다 —
 * `layers.test.ts`). 모양이 갈리면 `bundle.ts` 의 시험(`export.test.ts`)과 이 시험 중 하나가 붉어진다.
 */
import { createHash } from 'node:crypto';

import { describe, expect, it } from 'vitest';

import { recordsSqlOf, rowsOf, verifyAll, verifyObject } from './audit-verify.mjs';

const sha = (text: string) => createHash('sha256').update(text, 'utf8').digest('hex');

/** `bundleOf` 와 같은 모양 — 첫 줄이 머리, 그 뒤 한 줄에 한 행, 끝 줄바꿈 */
function objectOf(ids: number[], afterId: number) {
  const rows = `${ids.map((id) => JSON.stringify({ id, action: 'reports.detail', outcome: 'allowed' })).join('\n')}\n`;
  const head = {
    kind: 'saju-operator-access',
    version: 2,
    rows: ids.length,
    first_id: ids[0],
    last_id: ids.at(-1),
    after_id: afterId,
    sha256: sha(rows),
    exported_at: '2026-09-25T03:40:00.000Z',
  };
  const key = `operator-access/2026/09/25/${ids[0]}-${ids.at(-1)}.jsonl`;
  return {
    key,
    body: `${JSON.stringify(head)}\n${rows}`,
    record: { first_id: ids[0], last_id: ids.at(-1) ?? 0, rows: ids.length, sha256: sha(rows), object_key: key },
  };
}

describe('객체 하나', () => {
  const one = objectOf([3, 4, 7], 2);

  it('기록과 머리와 본문이 모두 맞으면 어긋남이 없다', () => {
    expect(verifyObject(one.record, one.body, 2)).toEqual([]);
  });

  it('줄 하나를 고치면 본문 해시가 머리와 다르다', () => {
    expect(verifyObject(one.record, one.body.replace('"outcome":"allowed"', '"outcome":"denied"'), 2)).toContain(
      '본문의 sha256 이 머리와 다르다');
  });

  it('줄 하나를 빼고 머리까지 새로 지으면 DB 의 기록이 잡는다', () => {
    const forged = objectOf([3, 7], 2);
    expect(verifyObject(one.record, forged.body, 2)).toEqual(
      expect.arrayContaining(['머리의 rows 값이 기록과 다르다', '머리의 sha256 값이 기록과 다르다', '줄 수가 행 수와 다르다']));
  });

  it('이어지는 자리가 다르면 잡는다', () => {
    expect(verifyObject(one.record, one.body, 0)).toContain('머리의 after_id 값이 기록과 다르다');
  });

  it('객체가 없거나 머리가 깨졌으면 그렇다고 말한다', () => {
    expect(verifyObject(one.record, null, 2)).toEqual(['객체가 없다']);
    expect(verifyObject(one.record, 'not json\n', 2)).toEqual(['머리가 JSON 이 아니다']);
  });
});

describe('기록 전부', () => {
  const a = objectOf([1, 2], 0);
  const b = objectOf([3, 5], 2);
  const bucket = new Map([[a.key, a.body], [b.key, b.body]]);
  const fetchObject = async (key: string) => bucket.get(key) ?? null;

  it('빠짐도 겹침도 없이 이어지면 전부 맞다', async () => {
    const results = await verifyAll([a.record, b.record], fetchObject);
    expect(results.map((one) => one.problems)).toEqual([[], []]);
  });

  it('S3 에서 객체 하나가 사라지면 그 키만 붉다', async () => {
    const missing = new Map([[a.key, a.body]]);
    const results = await verifyAll([a.record, b.record], async (key) => missing.get(key) ?? null);
    expect(results.map((one) => one.problems)).toEqual([[], ['객체가 없다']]);
  });

  it('기록이 겹치면 잡는다', async () => {
    const overlap = objectOf([2, 3], 1);
    const results = await verifyAll([a.record, overlap.record], async (key) =>
      key === overlap.key ? overlap.body : a.body);
    expect(results[1].problems).toContain('범위가 앞 기록과 겹친다');
  });
});

describe('DB 에서 읽는 것', () => {
  it('반출 기록만 읽는다 — 접속기록 본표를 안 읽는다', () => {
    const sql = recordsSqlOf(0);
    expect(sql).toContain('from audit.operator_access_export e');
    expect(sql).not.toMatch(/from audit\.operator_access\b(?!_export)/);
    expect(() => recordsSqlOf(-1)).toThrow();
    expect(() => recordsSqlOf(Number.NaN)).toThrow();
  });

  it('db query 의 JSON 에서 기록을 집는다', () => {
    const stdout = `Connecting...\n${JSON.stringify({ boundary: 'b', rows: [
      { first_id: 1, last_id: 2, rows: 2, sha256: 'x', object_key: 'k', after_id: 0 }] })}`;
    expect(rowsOf(stdout)).toEqual([{ first_id: 1, last_id: 2, rows: 2, sha256: 'x', object_key: 'k', after_id: 0 }]);
  });
});
