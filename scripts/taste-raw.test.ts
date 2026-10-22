import { describe, expect, it } from 'vitest';

import { rawLeaks, tasteRowsSql } from './taste-raw.mjs';

/** 흐름 검사 「5 · 원문」이 찾는 것과 같은 꼴 */
const needles = ['1990-05-15', '2001-01-0', '14:30', /10\.(77|88|99)\.0\./];
const clock = { since: Date.parse('2026-10-12T14:00:00Z'), until: Date.parse('2026-10-13T16:00:00Z') };

/** 서버가 `to_jsonb` 로 내는 정상 행 — 실행이 14:30:12 에 돌았다(#686) */
const artifact = (over: Record<string, unknown> = {}) => ({
  id: '3f1c0d8e-0000-4000-8000-000000000001',
  evidence_fingerprint: 'a'.repeat(64),
  status: 'succeeded',
  attempts: 1,
  attempt_started_at: '2026-10-12T14:30:12.481+00:00',
  preview_markdown: '이 사주는 123456 번째 장면에서 먼저 움직이는 쪽이에요.',
  topic: '결정하거나 행동하는 방식',
  supporting_claims: ['analysis.structure'],
  check_findings: null,
  failure_code: null,
  created_at: '2026-10-12T14:30:12.481+00:00',
  updated_at: '2026-10-12T14:30:12.481+00:00',
  expires_at: '2026-10-13T14:30:12.481+00:00',
  ...over,
});
const rateEvent = { id: '3f1c0d8e-0000-4000-8000-000000000002', subject_hmac: 'b'.repeat(64), kind: 'ip-request', at: '2026-10-12T14:30:12.900+00:00' };
const daily = { day: '2026-10-12', metric: 'model_calls', value: 3 };

describe('맛보기 표의 원문 찾기 — 칸별로 읽는다', () => {
  it('정상 시각 칸이 14:30 을 품어도 원문이 아니다 — 표를 통째 글자로 읽던 때는 이 행에서 붉었다(#556 · #686)', () => {
    const rows = { taste_artifact: [artifact()], taste_session: [], taste_rate_event: [rateEvent], taste_daily_count: [daily] };
    // 전의 검사가 본 글자 — 같은 행을 통째로 뽑으면 '14:30' 이 걸린다
    expect(JSON.stringify(rows).includes('14:30')).toBe(true);
    expect(rawLeaks(rows, { needles, clock })).toEqual([]);
  });

  it('시각 칸이 아닌 칸의 14:30 은 잡는다', () => {
    const rows = { taste_artifact: [artifact({ topic: '14:30 에 태어난 사람' })] };
    expect(rawLeaks(rows, { needles, clock })).toEqual(['taste_artifact.topic: 14:30']);
  });

  it('배열 · JSON 칸 안의 원문도 잡는다', () => {
    const rows = {
      taste_artifact: [artifact({ supporting_claims: ['birth 1990-05-15'], check_findings: { seen: '10.77.0.1' } })],
    };
    expect(rawLeaks(rows, { needles, clock })).toEqual([
      'taste_artifact.supporting_claims: 1990-05-15',
      `taste_artifact.check_findings: ${/10\.(77|88|99)\.0\./}`,
    ]);
  });

  it('시각 칸에 원문을 담으면 이번 실행의 시계 밖이라 잡는다', () => {
    const rows = { taste_artifact: [artifact({ created_at: '1990-05-15T05:30:00+00:00' })] };
    expect(rawLeaks(rows, { needles, clock })).toEqual(['taste_artifact.created_at: 이번 실행의 시계 밖 — 1990-05-15T05:30:00+00:00']);
  });

  it('시각 칸을 안 적은 표는 조용히 지나가지 않는다', () => {
    expect(() => rawLeaks({ taste_new: [{ at: '2026-10-12T14:30:12Z' }] }, { needles, clock })).toThrow('taste_new');
  });

  it('행을 칸 이름이 붙은 JSON 으로 뽑는다', () => {
    expect(tasteRowsSql('taste_session')).toBe("select coalesce(jsonb_agg(to_jsonb(t)), '[]'::jsonb) from public.taste_session t");
  });
});
