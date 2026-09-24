/**
 * **`npm run db:remote` 는 목적 없이 안 돌고, 원문 대신 목적과 해시를 적는다** (G-23 ⑩, ADR 0105).
 *
 * 운영 DB 에는 안 닿는다 — 인자를 읽는 법, 적는 SQL 의 모양, 실행자, 그리고 `package.json` 이 이것을 잠금 안에서
 * 부르는지를 잰다. 적는 함수 자체(`audit.note_cli_query`)는 pgTAP `46_operator_access_log` 가 잰다.
 */
import { readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';

import { describe, expect, it } from 'vitest';

import { accessIdOf, actorOf, errorClassOf, noteSqlOf, parseArgs, resultSqlOf, sqlHashOf } from './db-remote.mjs';

const SQL = 'select count(*) from public.report where reviewed_at is null';

describe('인자', () => {
  it('목적과 SQL 하나를 읽는다 — 앞뒤 어디에 와도', () => {
    expect(parseArgs(['--purpose', '미검토 신고 건수', SQL])).toEqual({ ok: true, purpose: '미검토 신고 건수', sql: SQL });
    expect(parseArgs([SQL, '--purpose=미검토 신고 건수'])).toEqual({ ok: true, purpose: '미검토 신고 건수', sql: SQL });
  });

  it('목적 없이는 안 돈다', () => {
    expect(parseArgs([SQL])).toMatchObject({ ok: false });
    expect(parseArgs([SQL, '--purpose'])).toMatchObject({ ok: false });
    expect(parseArgs(['--purpose', '짧음', SQL])).toMatchObject({ ok: false });
  });

  it('목적에 이메일을 적지 않는다 — 목적도 반출된다', () => {
    expect(parseArgs(['--purpose', 'someone@example.com 계정 확인', SQL])).toMatchObject({ ok: false });
  });

  it('SQL 은 정확히 하나다', () => {
    expect(parseArgs(['--purpose', '두 문장 보내기', SQL, SQL])).toMatchObject({ ok: false });
    expect(parseArgs(['--purpose', '빈 문장 보내기', ' '])).toMatchObject({ ok: false });
  });
});

describe('적는 SQL', () => {
  const sha256 = sqlHashOf(SQL);

  it('원문을 싣지 않고 sha256 만 싣는다', () => {
    const note = noteSqlOf({ actor: 'sungheeyoon', purpose: '미검토 신고 건수', sha256 });
    expect(sha256).toMatch(/^[0-9a-f]{64}$/);
    expect(note).toContain(sha256);
    expect(note).not.toContain('reviewed_at');
    expect(note).toMatch(/^select audit\.note_cli_query\(/);
  });

  it('목적의 따옴표가 문장을 깨지 않는다 — 16진으로 싣는다', () => {
    const note = noteSqlOf({ actor: "o'neil", purpose: "'); drop table x; --", sha256 });
    expect(note).not.toContain('drop table');
    expect(note).not.toContain("o'neil");
  });

  it('해시가 아닌 값은 싣지 않는다', () => {
    expect(() => noteSqlOf({ actor: 'a', purpose: '목적입니다', sha256: "x'); drop" })).toThrow();
  });
});

describe('실행자', () => {
  it('git 이름, 없으면 OS 사용자, 에이전트 세션이면 (agent)', () => {
    expect(actorOf({ gitName: 'sungheeyoon', osName: 'kyunglee', env: {} })).toBe('sungheeyoon');
    expect(actorOf({ gitName: null, osName: 'kyunglee', env: {} })).toBe('kyunglee');
    expect(actorOf({ gitName: 'sungheeyoon', osName: 'kyunglee', env: { CLAUDECODE: '1' } })).toBe('sungheeyoon (agent)');
  });
});

describe('잠금 안에서 부른다', () => {
  it('db:remote 는 remote-lock 이 이 파일을 감싼다 — 한 번에 하나(ADR 0096)와 기록이 함께 선다', () => {
    const { scripts } = JSON.parse(readFileSync(join(resolve(__dirname, '..'), 'package.json'), 'utf8')) as {
      scripts: Record<string, string>;
    };
    expect(scripts['db:remote']).toBe('node scripts/remote-lock.mjs node scripts/db-remote.mjs');
  });
});

describe('끝난 뒤의 결과 (`20261014090000`)', () => {
  const noted = JSON.stringify({ boundary: 'b', rows: [{ access_log_id: 42 }], warning: 'w' }, null, 2);

  it('적은 줄의 번호를 db query 의 JSON 에서 집는다', () => {
    expect(accessIdOf(`Connecting to remote database...\n${noted}`)).toBe(42);
    expect(accessIdOf('')).toBeNull();
    expect(accessIdOf('{"rows":[]}')).toBeNull();
  });

  it('성공은 분류가 없고, 실패는 문장이 아니라 분류만 — SQL 오류 · 접속 · 그 밖', () => {
    expect(errorClassOf({ status: 0, signal: null, output: '' })).toBeNull();
    expect(errorClassOf({ status: 1, signal: null,
      output: '{"_tag":"Error","error":{"message":"failed to execute query: error: division by zero"}}' })).toBe('sql');
    expect(errorClassOf({ status: 1, signal: null, output: 'failed to connect: dial tcp: i/o timeout' })).toBe('connection');
    expect(errorClassOf({ status: 1, signal: null, output: '???' })).toBe('unknown');
    expect(errorClassOf({ status: null, signal: 'SIGINT', output: '' })).toBe('signal');
  });

  it('결과를 적는 SQL 은 번호와 분류만 싣는다 — 모양이 아니면 짓지 않는다', () => {
    expect(resultSqlOf({ id: 42, errorClass: null })).toBe("select audit.note_cli_result(42, 'succeeded') as result_log_id");
    expect(resultSqlOf({ id: 42, errorClass: 'sql' })).toBe(
      "select audit.note_cli_result(42, 'failed', 'sql') as result_log_id");
    expect(() => resultSqlOf({ id: 0, errorClass: null })).toThrow();
    expect(() => resultSqlOf({ id: 42, errorClass: "sql'); drop table x; --" })).toThrow();
  });
});
