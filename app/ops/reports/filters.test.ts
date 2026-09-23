import { describe, expect, it } from 'vitest';

import { NO_FILTERS, argsOf, filtersOf, hrefOf, isFiltered, isReportId } from './filters';
import {
  accountStatusLabel,
  evidenceTime,
  reasonLabel,
  sideOf,
} from './labels';
import { chosenOnce } from './snapshot';

describe('신고 목록의 주소', () => {
  it('빈 주소는 걸러지지 않은 첫 쪽이다', () => {
    expect(filtersOf({})).toEqual(NO_FILTERS);
    expect(hrefOf(NO_FILTERS, {})).toBe('/ops/reports');
  });

  it('주소의 칸 셋과 쪽을 읽고 같은 주소로 다시 짓는다', () => {
    const filters = filtersOf({ review: 'unreviewed', reason: 'harassment', evidence: 'chat', page: '3' });
    expect(filters).toEqual({ review: 'unreviewed', reason: 'harassment', evidence: 'chat', page: 3 });
    expect(hrefOf(filters, { page: 3 })).toBe(
      '/ops/reports?review=unreviewed&reason=harassment&evidence=chat&page=3',
    );
  });

  it('모르는 값은 걸러지지 않은 것으로 읽는다 — 오류로 세우지 않는다', () => {
    expect(filtersOf({ review: 'maybe', reason: 'spam', evidence: 'yes', page: 'x' })).toEqual(NO_FILTERS);
    expect(filtersOf({ page: '0' }).page).toBe(1);
    expect(filtersOf({ page: '-2' }).page).toBe(1);
    expect(filtersOf({ page: '1.5' }).page).toBe(1);
    expect(filtersOf({ page: '10001' }).page).toBe(1);
  });

  it('같은 이름이 둘이면 앞의 것을 읽는다', () => {
    expect(filtersOf({ review: ['reviewed', 'unreviewed'] }).review).toBe('reviewed');
  });

  it('거르는 칸을 바꾸면 첫 쪽으로 돌아간다', () => {
    const third = filtersOf({ page: '3' });
    expect(hrefOf(third, { reason: 'other' })).toBe('/ops/reports?reason=other');
    expect(hrefOf(third, { page: 4 })).toBe('/ops/reports?page=4');
  });

  it('목록 문의 인자는 전체면 null, 쪽은 0 부터다', () => {
    expect(argsOf(NO_FILTERS)).toEqual({ p_reviewed: null, p_reason: null, p_has_snapshot: null, p_page: 0 });
    expect(argsOf({ review: 'reviewed', reason: 'other', evidence: 'none', page: 2 })).toEqual({
      p_reviewed: true,
      p_reason: 'other',
      p_has_snapshot: false,
      p_page: 1,
    });
    expect(argsOf({ ...NO_FILTERS, review: 'unreviewed', evidence: 'chat' })).toMatchObject({
      p_reviewed: false,
      p_has_snapshot: true,
    });
  });

  it('쪽만 옮긴 것은 거른 것이 아니다', () => {
    expect(isFiltered({ ...NO_FILTERS, page: 5 })).toBe(false);
    expect(isFiltered({ ...NO_FILTERS, evidence: 'none' })).toBe(true);
  });

  it('신고 id 는 uuid 모양만 DB 에 묻는다', () => {
    expect(isReportId('3f0b8f5e-2c1d-4b7a-9e2f-0a1b2c3d4e5f')).toBe(true);
    expect(isReportId('3f0b8f5e')).toBe(false);
    expect(isReportId("x' or 1=1")).toBe(false);
  });
});

describe('신고 화면이 값을 부르는 말', () => {
  it('사유는 신고한 사람이 누른 글자 그대로다', () => {
    expect(reasonLabel('harassment')).toBe('괴롭힘이나 위협');
    expect(reasonLabel('unknown')).toBe('unknown');
  });

  it('보낸 쪽은 두 자리 중 하나고, 아니면 모른다', () => {
    expect(sideOf('reporter')).toBe('reporter');
    expect(sideOf('reported')).toBe('reported');
    expect(sideOf(null)).toBeNull();
    expect(sideOf('someone')).toBeNull();
  });

  it('계정 상태는 PRD 의 이름으로 부른다', () => {
    expect(accountStatusLabel('suspended')).toBe('이용 정지');
    expect(accountStatusLabel('deletion_requested')).toBe('탈퇴 대기');
    expect(accountStatusLabel(null)).toBe('알 수 없음');
  });

  it('근거의 시각은 한국 시간으로 초까지 선다 — 서버의 시간대와 무관하다', () => {
    expect(evidenceTime('2026-09-20T12:03:05Z')).toBe('2026년 9월 20일 오후 9:03:05');
  });
});

describe('스냅샷의 고른 표시', () => {
  const message = (seq: number, chosen: boolean) => ({
    seq,
    sentAt: '2026-09-20T12:00:00Z',
    side: 'reported' as const,
    body: String(seq),
    chosen,
  });

  it('고른 표시는 첫 하나만 남는다', () => {
    const marked = chosenOnce([message(1, false), message(2, true), message(3, true)]);
    expect(marked.filter((one) => one.chosen).map((one) => one.seq)).toEqual([2]);
  });

  it('하나뿐이면 그대로다', () => {
    const as = [message(1, false), message(2, true)];
    expect(chosenOnce(as)).toEqual(as);
  });
});
