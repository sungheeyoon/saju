import { describe, expect, it } from 'vitest';

import type { RpcRow } from '@/src/lib/db';

import { sanctionsOf } from './sanctions';

/** 처분 이력 문의 한 줄 — `lines` 는 jsonb 라 문이 비우면 `[]` 이지만(`20261219090000`) 생성 타입은 그것을 모른다 */
const row = (over: Partial<Record<keyof RpcRow<'operator_member_sanctions'>, unknown>> = {}) =>
  ({
    status: 'active',
    is_operator: false,
    version: 2,
    warnings_12m: 1,
    lines: [],
    ...over,
  }) as unknown as RpcRow<'operator_member_sanctions'>;

describe('처분 이력과 지금 상태 — 문의 한 줄을 화면의 값으로 (G-111 ③)', () => {
  it('상태 · 버전 · 12개월 경고 수를 그대로 옮긴다 — 0 도 0 이다', () => {
    expect(sanctionsOf(row({ version: 0, warnings_12m: 0 }))).toEqual({
      status: 'active',
      isOperator: false,
      version: 0,
      warnings12m: 0,
      entries: [],
    });
  });

  it('운영자 계정은 true 일 때만 참이다 — null · undefined 는 거짓', () => {
    expect(sanctionsOf(row({ is_operator: true })).isOperator).toBe(true);
    expect(sanctionsOf(row({ is_operator: null })).isOperator).toBe(false);
    expect(sanctionsOf(row({ is_operator: undefined })).isOperator).toBe(false);
  });

  it('줄이 없거나 배열이 아니면 빈 이력이다', () => {
    for (const lines of [[], null, undefined, {}, 'lines', 0]) {
      expect(sanctionsOf(row({ lines })).entries).toEqual([]);
    }
  });

  it('줄은 문이 준 차례대로 옮기고, 모양이 아닌 줄만 버린다', () => {
    const { entries } = sanctionsOf(
      row({
        status: 'suspended',
        version: 3,
        lines: [
          { id: 'b', source: 'status', at: '2026-10-17T01:00:00Z', kind: 'suspended', from_status: 'active', reason: 'policy', note: '메모', recorded: true, actor_nickname: '운영' },
          { id: 'x', source: 'status', at: null, kind: 'active' },
          { id: 'a', source: 'report', at: '2026-10-16T01:00:00Z', kind: 'warning', reason: 'harassment', report_id: 'r1', warning_ref: 'W-1', counted: null, recorded: true },
        ],
      }),
    );
    expect(entries.map((entry) => entry.id)).toEqual(['b', 'a']);
    expect(entries[0]).toMatchObject({ source: 'status', fromStatus: 'active', reason: 'policy', note: '메모', recorded: true, actorNickname: '운영' });
    // 셈 · 기록은 true 일 때만 참이다 — 그 밖의 값은 셈에 들지 않는다
    expect(entries[1]).toMatchObject({ source: 'report', reportId: 'r1', warningRef: 'W-1', counted: false, fromStatus: null, actorNickname: null });
  });
});
