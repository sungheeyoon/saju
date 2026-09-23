import { createHash } from 'node:crypto';

import { describe, expect, it } from 'vitest';

import { bundleOf, sha256Hex, type AccessLine, type Bundle } from './bundle';
import { BATCH_ROWS, configOf, exportOnce, type ExportSource } from './export';
import { putInputOf } from './s3';

const line = (id: number, at = '2026-09-24T15:30:00Z'): AccessLine => ({
  id,
  at,
  channel: 'app',
  actor_user_id: '00000000-0000-4000-8000-000000000001',
  actor_name: null,
  action: 'reports.detail',
  target_report_id: '00000000-0000-4000-8000-0000000000aa',
  filter_summary: null,
  purpose: null,
  sql_sha256: null,
  outcome: 'allowed',
});

describe('묶음 한 파일의 모양', () => {
  const bundle = bundleOf([line(7), line(9), line(12)], 6, new Date('2026-09-25T03:40:00Z'));
  const [headLine, ...rest] = bundle.body.split('\n');

  it('첫 줄이 머리다 — 행 수 · 첫/마지막 번호 · 이어지는 자리', () => {
    expect(JSON.parse(headLine)).toMatchObject({
      kind: 'saju-operator-access',
      version: 1,
      rows: 3,
      first_id: 7,
      last_id: 12,
      after_id: 6,
      exported_at: '2026-09-25T03:40:00.000Z',
    });
  });

  it('머리의 해시는 머리를 뗀 나머지(끝 줄바꿈 포함)의 sha256 이다', () => {
    const rows = rest.join('\n');
    expect(rows.endsWith('\n')).toBe(true);
    expect(bundle.head.sha256).toBe(createHash('sha256').update(rows).digest('hex'));
    expect(bundle.head.sha256).toBe(sha256Hex(rows));
  });

  it('한 줄에 한 행, 칸은 DB 가 적은 것뿐이다', () => {
    const rows = rest.filter((one) => one !== '').map((one) => JSON.parse(one));
    expect(rows.map((one) => one.id)).toEqual([7, 9, 12]);
    expect(Object.keys(rows[0])).toEqual([
      'id',
      'at',
      'channel',
      'actor_user_id',
      'actor_name',
      'action',
      'target_report_id',
      'filter_summary',
      'purpose',
      'sql_sha256',
      'outcome',
    ]);
  });

  it('키는 첫 줄의 서울 날짜와 열두 자리 번호 범위다 — UTC 15:30 은 서울의 다음 날', () => {
    expect(bundle.key).toBe('operator-access/2026/09/25/000000000007-000000000012.jsonl');
  });

  it('빈 묶음 · 차례가 아닌 번호 · 이어지는 자리보다 작은 번호는 짓지 않는다', () => {
    expect(() => bundleOf([], 0, new Date())).toThrow('빈 묶음');
    expect(() => bundleOf([line(3), line(2)], 0, new Date())).toThrow('차례');
    expect(() => bundleOf([line(5)], 5, new Date())).toThrow('차례');
  });
});

describe('S3 로 올리는 요청', () => {
  const config = { bucket: 'b', region: 'ap-northeast-2', accessKeyId: 'AKIAFAKE', secretAccessKey: 'fake' };
  const bundle = bundleOf([line(1)], 0, new Date('2026-09-25T00:00:00Z'));

  it('버킷 · 키 · 본문 · 본문 전체의 SHA-256(base64) · 머리의 값이 실린다', () => {
    const input = putInputOf(config, bundle);
    expect(input).toMatchObject({
      Bucket: 'b',
      Key: bundle.key,
      Body: bundle.body,
      ChecksumSHA256: createHash('sha256').update(bundle.body).digest('base64'),
      Metadata: { rows: '1', 'first-id': '1', 'last-id': '1', 'after-id': '0', 'rows-sha256': bundle.head.sha256 },
    });
  });

  it('보존을 객체마다 적지 않는다 — 버킷의 기본 보존이 정한다', () => {
    const input = putInputOf(config, bundle);
    expect(input).not.toHaveProperty('ObjectLockMode');
    expect(input).not.toHaveProperty('ObjectLockRetainUntilDate');
  });
});

/** 가짜 DB — 적힌 범위를 들고, 앞 반출에서 이어지지 않으면 거절한다(`audit_export_done` 과 같게) */
function fakeLog(ids: readonly number[]) {
  const exported: Bundle[] = [];
  let lastId = 0;
  const source: ExportSource = {
    batch: async (limit) =>
      ids
        .filter((id) => id > lastId)
        .slice(0, limit)
        .map((id) => ({ ...line(id), after_id: lastId })),
    done: async (bundle) => {
      if (bundle.head.after_id !== lastId) throw new Error('이어지지 않는다');
      lastId = bundle.head.last_id;
      exported.push(bundle);
    },
  };
  return { source, exported };
}

describe('하루 한 번의 반출', () => {
  const now = () => new Date('2026-09-25T03:40:00Z');

  it('올린 뒤에 적는다 — 번호 범위가 빠짐도 겹침도 없이 이어진다', async () => {
    const ids = Array.from({ length: BATCH_ROWS + 3 }, (_, at) => at + 1);
    const { source, exported } = fakeLog(ids);
    const s3: Bundle[] = [];
    const result = await exportOnce(source, async (bundle) => void s3.push(bundle), now);

    expect(result.rows).toBe(ids.length);
    expect(exported.map((one) => [one.head.first_id, one.head.last_id])).toEqual([
      [1, BATCH_ROWS],
      [BATCH_ROWS + 1, BATCH_ROWS + 3],
    ]);
    expect(s3.map((one) => one.key)).toEqual(result.objects);
  });

  it('올리다 실패하면 적지 않는다 — 다음 실행이 같은 범위를 같은 키로 다시 올린다', async () => {
    const { source, exported } = fakeLog([4, 5, 6]);
    await expect(
      exportOnce(source, async () => Promise.reject(new Error('S3 가 거절했다')), now),
    ).rejects.toThrow('S3 가 거절했다');
    expect(exported).toEqual([]);

    const s3: Bundle[] = [];
    await exportOnce(source, async (bundle) => void s3.push(bundle), now);
    expect(s3.map((one) => one.key)).toEqual(['operator-access/2026/09/25/000000000004-000000000006.jsonl']);
  });

  it('반출할 줄이 없으면 아무것도 안 올린다', async () => {
    const { source } = fakeLog([]);
    const s3: Bundle[] = [];
    expect(await exportOnce(source, async (bundle) => void s3.push(bundle), now)).toEqual({ objects: [], rows: 0 });
    expect(s3).toEqual([]);
  });
});

describe('켜는 값', () => {
  const full = {
    AUDIT_EXPORT_BUCKET: 'saju-audit',
    AUDIT_EXPORT_REGION: 'ap-northeast-2',
    AUDIT_EXPORT_ACCESS_KEY_ID: 'AKIAFAKE',
    AUDIT_EXPORT_SECRET_ACCESS_KEY: 'fake-secret',
  };

  it('넷이 다 있어야 켜진다', () => {
    expect(configOf(full)).toEqual({
      bucket: 'saju-audit',
      region: 'ap-northeast-2',
      accessKeyId: 'AKIAFAKE',
      secretAccessKey: 'fake-secret',
    });
  });

  it('하나라도 없거나 비었으면 「설정 안 됨」이다 — AWS 계정이 아직 없다', () => {
    expect(configOf({ ...full, AUDIT_EXPORT_BUCKET: undefined })).toBeNull();
    expect(configOf({ ...full, AUDIT_EXPORT_SECRET_ACCESS_KEY: '  ' })).toBeNull();
    expect(
      configOf({
        AUDIT_EXPORT_BUCKET: undefined,
        AUDIT_EXPORT_REGION: undefined,
        AUDIT_EXPORT_ACCESS_KEY_ID: undefined,
        AUDIT_EXPORT_SECRET_ACCESS_KEY: undefined,
      }),
    ).toBeNull();
  });
});
