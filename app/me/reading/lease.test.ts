import { describe, expect, it } from 'vitest';

import { DB_CALL_MS, HOLD_BOUND_MS, READING_JOB_DEADLINE_MS, READING_JOB_LEASE_MS, RETRIEVE_REQUEST } from './lease';

describe('임대 시간의 셈(ADR 0201)', () => {
  it('일감 하나를 쥐는 상한은 100초다 — 집기의 답 10 + 회수 10 × 2 + 다시 보내기 전 기다림 60 + 적기 10', () => {
    expect(HOLD_BOUND_MS).toBe(100_000);
  });

  it('상한이 임대보다 짧다 — 산 작업자의 일감을 남이 다시 집지 않는다', () => {
    expect(HOLD_BOUND_MS).toBeLessThan(READING_JOB_LEASE_MS);
  });

  it('임대에 복구기 한 바퀴(1분)를 더해도 8분 기한보다 짧다 — 죽은 작업자의 일감을 기한 전에 다시 집는다', () => {
    expect(READING_JOB_LEASE_MS + 60_000).toBeLessThan(READING_JOB_DEADLINE_MS);
  });

  it('회수 한 번과 DB 한 번은 webhook 의 수명(60초) 안이다', () => {
    expect(RETRIEVE_REQUEST.timeout + DB_CALL_MS).toBeLessThan(60_000);
  });
});
