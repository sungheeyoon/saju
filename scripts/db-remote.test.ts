/**
 * **`npm run db:remote` 는 목적 없이 안 돌고, 원문 대신 목적과 해시를 적는다** (G-23 ⑩, ADR 0105).
 *
 * 운영 DB 에는 안 닿는다 — 인자를 읽는 법, 적는 SQL 의 모양, 실행자, 그리고 `package.json` 이 이것을 잠금 안에서
 * 부르는지를 잰다. 적는 함수 자체(`audit.note_cli_query`)는 pgTAP `46_operator_access_log` 가 잰다.
 */
import { readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';

import { describe, expect, it } from 'vitest';

import {
  accessIdOf, actorOf, errorClassOf, jsonRowsOf, noteSqlOf, parseArgs, queryArgsOf, resultSqlOf, sqlHashOf,
} from './db-remote.mjs';

const SQL = 'select count(*) from public.report where reviewed_at is null';

describe('인자', () => {
  it('목적과 SQL 하나를 읽는다 — 앞뒤 어디에 와도', () => {
    expect(parseArgs(['--purpose', '미검토 신고 건수', SQL])).toEqual(
      { ok: true, purpose: '미검토 신고 건수', sql: SQL, json: false });
    expect(parseArgs([SQL, '--purpose=미검토 신고 건수'])).toEqual(
      { ok: true, purpose: '미검토 신고 건수', sql: SQL, json: false });
  });

  it('--json 이 있으면 본 질의를 기계가 읽는다 — 어디에 와도, SQL 로 세지 않는다(#431)', () => {
    expect(parseArgs(['--purpose', '반출 기록 읽기', '--json', SQL])).toEqual(
      { ok: true, purpose: '반출 기록 읽기', sql: SQL, json: true });
    expect(parseArgs([SQL, '--json', '--purpose=반출 기록 읽기'])).toMatchObject({ ok: true, sql: SQL, json: true });
    expect(parseArgs(['--purpose', '반출 기록 읽기', '--json'])).toMatchObject({ ok: false });
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

  // CLI 2.115 는 에이전트 세션(`CLAUDECODE` · `AI_AGENT`)을 알아채면 위의 봉투(JSON)를, 사람의 셸이면 박스 표(text)를
  // 낸다 — 이 시험의 봉투는 에이전트 세션에서 뜬 모양이라 사람이 돌릴 때마다 결과가 빠지는 것을 못 봤다(2026-10-02).
  // 아래 둘은 로컬 스택에 `noteSqlOf` 의 문장을 사람의 env 로 보내 받은 그대로다.
  it('사람의 셸에서 플래그 없이 받은 박스 표에서는 번호를 못 집는다 — 그래서 JSON 을 요청한다', () => {
    expect(accessIdOf('┌───────────────┐\n│ access_log_id │\n├───────────────┤\n│ 42            │\n└───────────────┘\n')).toBeNull();
  });

  it('사람의 셸에서 `--output-format json` 으로 받은 맨 배열에서도 번호를 집는다', () => {
    expect(accessIdOf('[\n  {\n    "access_log_id": 42\n  }\n]\n')).toBe(42);
    expect(accessIdOf('[]')).toBeNull();
  });

  it('JSON 출력의 줄은 봉투에서도 맨 배열에서도 같은 것으로 읽고, 표면 null 이다', () => {
    expect(jsonRowsOf(noted)).toEqual([{ access_log_id: 42 }]);
    expect(jsonRowsOf('[\n  {\n    "access_log_id": 42\n  }\n]\n')).toEqual([{ access_log_id: 42 }]);
    expect(jsonRowsOf('┌───────────────┐\n│ access_log_id │\n└───────────────┘\n')).toBeNull();
    expect(jsonRowsOf('{"boundary":"b"}')).toBeNull();
  });

  it('기록 · 결과 호출은 JSON 을 요청하고, 본 질의는 --json 일 때만(없으면 사람이면 표)', () => {
    expect(queryArgsOf('select 1', { json: true })).toEqual(
      ['supabase', 'db', 'query', '--linked', '--output-format', 'json', 'select 1']);
    expect(queryArgsOf('select 1', { json: false })).toEqual(['supabase', 'db', 'query', '--linked', 'select 1']);
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
