import { describe, expect, it } from 'vitest';

import type { RpcRow } from '@/src/lib/db';

import { reportRowOf } from './read';

/** 목록 문의 한 줄 — 생성 타입은 칸을 전부 `null` 아님으로 적지만 실제로는 빈다(`read.ts` 머리말) */
const row = (over: Partial<Record<keyof RpcRow<'operator_reports'>, unknown>> = {}) =>
  ({
    report_id: '00000000-0000-4000-8000-000000000001',
    created_at: '2026-10-10T03:00:00Z',
    reason: 'harassment',
    reporter_user_id: '00000000-0000-4000-8000-0000000000aa',
    reporter_nickname: '가',
    reported_user_id: '00000000-0000-4000-8000-0000000000bb',
    reported_nickname: '나',
    reviewed_at: null,
    review_outcome: null,
    snapshot_messages: 3,
    pages: 1,
    is_open: true,
    warning_ref: null,
    chosen_excerpt: '계속 연락 안 받으면 찾아갈 거예요',
    ...over,
  }) as unknown as RpcRow<'operator_reports'>;

describe('신고 목록의 한 줄 — 고른 메시지 발췌 (화면 점검 C17)', () => {
  it('DB 가 낸 발췌를 그대로 옮긴다 — 자르는 것은 DB 의 일이다', () => {
    expect(reportRowOf(row()).chosenExcerpt).toBe('계속 연락 안 받으면 찾아갈 거예요');
  });

  it('대화 근거가 없거나 고른 메시지가 없으면 null 이다', () => {
    expect(reportRowOf(row({ chosen_excerpt: null, snapshot_messages: null })).chosenExcerpt).toBeNull();
  });

  it('발췌 칸이 생기기 전의 DB(칸이 아예 없다)여도 null 로 서고 넘어지지 않는다', () => {
    const before = row();
    delete (before as Partial<RpcRow<'operator_reports'>>).chosen_excerpt;
    const mapped = reportRowOf(before);
    expect(mapped.chosenExcerpt).toBeNull();
    expect(mapped.reported).toEqual({ userId: '00000000-0000-4000-8000-0000000000bb', nickname: '나' });
  });
});
