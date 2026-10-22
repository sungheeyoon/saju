import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

import { HOLD_BOUND_MS, READING_JOB_DEADLINE_MS, READING_JOB_LEASE_MS } from './lease';

const MIGRATIONS = join(process.cwd(), 'supabase', 'migrations');

/** `reading_job_lease()` 를 마지막으로 정의한 마이그레이션이 든 값(초) — DB 에 실제로 오른 정의다 */
const leaseInDatabase = (): number => {
  const defining = readdirSync(MIGRATIONS)
    .filter((name) => name.endsWith('.sql'))
    .sort()
    .map((name) => readFileSync(join(MIGRATIONS, name), 'utf8'))
    .filter((text) => /function public\.reading_job_lease\(\)/.test(text));
  const last = defining.at(-1) ?? '';
  const seconds = /function public\.reading_job_lease\(\)[\s\S]*?interval '(\d+) seconds'/.exec(last)?.[1];
  if (seconds === undefined) throw new Error('reading_job_lease() 의 값을 마이그레이션에서 못 읽었다');
  return Number(seconds) * 1000;
};

describe('임대 시간의 셈(ADR 0201)', () => {
  it('일감 하나를 쥐는 상한은 110초다 — 집기의 답 10 + 회수 10 × 2 + 다시 보내기 전 기다림 60 + 적기 10 × 2', () => {
    expect(HOLD_BOUND_MS).toBe(110_000);
  });

  it('상한이 임대보다 짧다 — 산 작업자의 일감을 남이 다시 집지 않는다', () => {
    expect(HOLD_BOUND_MS).toBeLessThan(READING_JOB_LEASE_MS);
  });

  it('임대에 복구기 한 바퀴(1분)를 더해도 8분 기한보다 짧다 — 죽은 작업자의 일감을 기한 전에 다시 집는다', () => {
    expect(READING_JOB_LEASE_MS + 60_000).toBeLessThan(READING_JOB_DEADLINE_MS);
  });

  it('앱의 임대 값은 DB 의 reading_job_lease() 와 같다', () => {
    expect(leaseInDatabase()).toBe(READING_JOB_LEASE_MS);
  });
});
