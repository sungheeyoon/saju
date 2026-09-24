import { createHash } from 'node:crypto';

import { describe, expect, it } from 'vitest';

import { bundleOf, sha256Hex, type AccessLine, type Bundle } from './bundle';
import {
  BATCH_ROWS,
  configOf,
  errorClassOf,
  exportOnce,
  runExport,
  type ConfigState,
  type ExportSource,
  type Finish,
  type RunLedger,
} from './export';
import { credentialsOf, putInputOf } from './s3';

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
  result_of: null,
  result: null,
  error_class: null,
});

describe('묶음 한 파일의 모양', () => {
  const bundle = bundleOf([line(7), line(9), line(12)], 6, new Date('2026-09-25T03:40:00Z'));
  const [headLine, ...rest] = bundle.body.split('\n');

  it('첫 줄이 머리다 — 행 수 · 첫/마지막 번호 · 이어지는 자리', () => {
    expect(JSON.parse(headLine)).toMatchObject({
      kind: 'saju-operator-access',
      version: 2,
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
      'result_of',
      'result',
      'error_class',
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
  const config = {
    bucket: 'b',
    region: 'ap-northeast-2',
    credentials: { kind: 'keys', accessKeyId: 'AKIAFAKE', secretAccessKey: 'fake' },
  } as const;
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

  it('접근 키면 그 둘을, 역할이면 부를 때마다 OIDC 토큰으로 받는 자격을 쓴다', () => {
    expect(credentialsOf(config)).toEqual({ accessKeyId: 'AKIAFAKE', secretAccessKey: 'fake' });
    expect(typeof credentialsOf({ ...config, credentials: { kind: 'role', roleArn: 'arn:aws:iam::1:role/r' } })).toBe(
      'function',
    );
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
    ).rejects.toThrow('audit-export: upload');
    expect(exported).toEqual([]);

    const s3: Bundle[] = [];
    await exportOnce(source, async (bundle) => void s3.push(bundle), now);
    expect(s3.map((one) => one.key)).toEqual(['operator-access/2026/09/25/000000000004-000000000006.jsonl']);
  });

  it('반출할 줄이 없으면 아무것도 안 올린다', async () => {
    const { source } = fakeLog([]);
    const s3: Bundle[] = [];
    expect(await exportOnce(source, async (bundle) => void s3.push(bundle), now)).toEqual({ objects: [], rows: 0, firstId: null, lastId: null });
    expect(s3).toEqual([]);
  });
});

describe('켜는 값 — 꺼짐 · 오설정 · 켜짐', () => {
  const none = {
    AUDIT_EXPORT_BUCKET: undefined,
    AUDIT_EXPORT_REGION: undefined,
    AUDIT_EXPORT_ROLE_ARN: undefined,
    AUDIT_EXPORT_ACCESS_KEY_ID: undefined,
    AUDIT_EXPORT_SECRET_ACCESS_KEY: undefined,
  };
  const keys = {
    ...none,
    AUDIT_EXPORT_BUCKET: 'saju-audit',
    AUDIT_EXPORT_REGION: 'ap-northeast-2',
    AUDIT_EXPORT_ACCESS_KEY_ID: 'AKIAFAKE',
    AUDIT_EXPORT_SECRET_ACCESS_KEY: 'fake-secret',
  };
  const role = {
    ...none,
    AUDIT_EXPORT_BUCKET: 'saju-audit',
    AUDIT_EXPORT_REGION: 'ap-northeast-2',
    AUDIT_EXPORT_ROLE_ARN: 'arn:aws:iam::123456789012:role/saju-audit-export',
  };

  it('다섯이 모두 비었으면 꺼짐이다 — 조용히', () => {
    expect(configOf(none)).toEqual({ state: 'off' });
    expect(configOf({ ...none, AUDIT_EXPORT_BUCKET: '  ' })).toEqual({ state: 'off' });
  });

  it('역할 하나 또는 접근 키 둘이면 켜진다 — 역할이 기본안', () => {
    expect(configOf(role)).toEqual({
      state: 'ready',
      config: { bucket: 'saju-audit', region: 'ap-northeast-2',
                credentials: { kind: 'role', roleArn: 'arn:aws:iam::123456789012:role/saju-audit-export' } },
    });
    expect(configOf(keys)).toEqual({
      state: 'ready',
      config: { bucket: 'saju-audit', region: 'ap-northeast-2',
                credentials: { kind: 'keys', accessKeyId: 'AKIAFAKE', secretAccessKey: 'fake-secret' } },
    });
  });

  it('하나라도 넣었는데 모자라면 오설정이다 — 빠진 이름을 분류로 든다, 값은 안 든다', () => {
    expect(configOf({ ...keys, AUDIT_EXPORT_REGION: undefined })).toEqual({ state: 'partial', problem: 'missing:region' });
    expect(configOf({ ...keys, AUDIT_EXPORT_SECRET_ACCESS_KEY: ' ' })).toEqual({
      state: 'partial', problem: 'missing:secret_access_key' });
    expect(configOf({ ...none, AUDIT_EXPORT_BUCKET: 'saju-audit' })).toEqual({
      state: 'partial', problem: 'missing:region.credentials' });
    expect(configOf({ ...none, AUDIT_EXPORT_ROLE_ARN: 'arn:x' })).toEqual({
      state: 'partial', problem: 'missing:bucket.region' });
  });

  it('역할과 접근 키를 함께 넣으면 오설정이다 — 어느 쪽을 쓸지 고르지 않는다', () => {
    expect(configOf({ ...role, AUDIT_EXPORT_ACCESS_KEY_ID: 'AKIAFAKE' })).toEqual({
      state: 'partial', problem: 'conflict:credentials' });
  });
});

describe('실행 하나 — 시작을 적고, 겹치면 물러나고, 어떻게 끝났든 결과를 적는다', () => {
  const now = () => new Date('2026-09-25T03:40:00Z');
  const ready: ConfigState = {
    state: 'ready',
    config: { bucket: 'b', region: 'ap-northeast-2',
              credentials: { kind: 'keys', accessKeyId: 'AKIAFAKE', secretAccessKey: 'fake' } },
  };

  function fakeLedger(busy = false) {
    const finished: Finish[] = [];
    const ledger: RunLedger = {
      begin: async () => ({ attemptId: 7, busy }),
      finish: async (attemptId, result) => {
        expect(attemptId).toBe(7);
        finished.push(result);
      },
    };
    return { ledger, finished };
  }

  it('앞 실행이 도는 중이면 아무것도 안 올리고 결과도 안 적는다 — 시작 문이 이미 적었다', async () => {
    const { ledger, finished } = fakeLedger(true);
    const { source } = fakeLog([1, 2, 3]);
    const s3: Bundle[] = [];
    expect(await runExport(ledger, ready, source, () => async (bundle) => void s3.push(bundle), now)).toEqual({
      kind: 'busy' });
    expect(s3).toEqual([]);
    expect(finished).toEqual([]);
  });

  it('꺼짐은 「설정 없음」, 오설정은 빠진 이름과 함께 「설정 오류」로 적힌다', async () => {
    const off = fakeLedger();
    expect(await runExport(off.ledger, { state: 'off' }, fakeLog([1]).source, () => async () => {}, now)).toEqual({
      kind: 'off' });
    expect(off.finished).toEqual([{ outcome: 'not_configured' }]);

    const half = fakeLedger();
    expect(
      await runExport(half.ledger, { state: 'partial', problem: 'missing:region' }, fakeLog([1]).source,
        () => async () => {}, now),
    ).toEqual({ kind: 'misconfigured', problem: 'missing:region' });
    expect(half.finished).toEqual([{ outcome: 'misconfigured', errorClass: 'missing:region' }]);
  });

  it('올리다 넘어지면 적지 않고, 어느 걸음에서 무엇으로 넘어졌는지만 적는다 — 문장은 안 적는다', async () => {
    const { ledger, finished } = fakeLedger();
    const { source, exported } = fakeLog([4, 5]);
    const denied = Object.assign(new Error('Access Denied for arn:aws:iam::123:role/secret-name'), { name: 'AccessDenied' });
    expect(await runExport(ledger, ready, source, () => async () => Promise.reject(denied), now)).toEqual({
      kind: 'failed', errorClass: 'upload:accessdenied' });
    expect(exported).toEqual([]);
    expect(finished).toEqual([{ outcome: 'failed', errorClass: 'upload:accessdenied' }]);
    expect(JSON.stringify(finished)).not.toContain('arn:');
  });

  it('끝까지 가면 행 수 · 객체 수 · 번호 범위를 적는다', async () => {
    const { ledger, finished } = fakeLedger();
    const { source } = fakeLog([4, 5, 9]);
    const run = await runExport(ledger, ready, source, () => async () => {}, now);
    expect(run.kind).toBe('succeeded');
    expect(finished).toEqual([{ outcome: 'succeeded', rows: 3, objects: 1, firstId: 4, lastId: 9 }]);
  });

  it('결과를 적는 문이 넘어져도 이미 올린 반출을 실패로 말하지 않는다', async () => {
    const ledger: RunLedger = {
      begin: async () => ({ attemptId: 1, busy: false }),
      finish: async () => Promise.reject(Object.assign(new Error('x'), { code: '08006' })),
    };
    const run = await runExport(ledger, ready, fakeLog([1]).source, () => async () => {}, now);
    expect(run.kind).toBe('succeeded');
  });

  it('실패의 분류는 걸음 · 코드(또는 이름)이고 검사식 안에 든다', () => {
    expect(errorClassOf(new Error('boom'))).toBe('run:unknown');
    expect(errorClassOf(Object.assign(new Error('x'), { code: 'PGRST 202!' }))).toBe('run:pgrst-202-');
    expect(errorClassOf(Object.assign(new Error('x'), { name: 'N'.repeat(100) }))).toHaveLength(60);
    expect(errorClassOf(Object.assign(new Error('x'), { name: 'N'.repeat(100) }))).toMatch(/^[a-z0-9_.:-]{1,60}$/);
  });
});
