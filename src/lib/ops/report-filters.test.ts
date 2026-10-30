import { describe, expect, it } from 'vitest';

import { NO_FILTERS, argsOf, filterSummary, filtersOf, hrefOf, isFiltered, isReportId } from './report-filters';
import {
  accountStatusLabel,
  evidenceTime,
  reasonLabel,
  reviewOutcomeLabel,
  reviewStateLabel,
  sideOf,
} from './report-labels';
import { openByReported } from './report-same-account';
import { chosenOnce } from './report-snapshot';

describe('신고 목록의 주소', () => {
  it('빈 주소는 처리 필요의 첫 쪽이다 (G-111-6)', () => {
    expect(filtersOf({})).toEqual(NO_FILTERS);
    expect(NO_FILTERS.review).toBe('open');
    expect(hrefOf(NO_FILTERS, {})).toBe('/ops/reports');
  });

  it('처리 상태 「전체」는 주소에 적힌다 — 빈 주소는 처리 필요다', () => {
    expect(hrefOf(NO_FILTERS, { review: 'all' })).toBe('/ops/reports?review=all');
    expect(filtersOf({ review: 'all' }).review).toBe('all');
  });

  it('안내번호로 찾으면 처리 상태를 안 고른 한 전체에서 찾는다 — 경고는 처리를 마친 신고에 붙는다', () => {
    expect(filtersOf({ ref: 'W-7K3F' }).review).toBe('all');
    expect(isFiltered(filtersOf({ ref: 'W-7K3F' }))).toBe(true);
    expect(hrefOf(filtersOf({ ref: 'W-7K3F' }), {})).toBe('/ops/reports?ref=W-7K3F');
  });

  it('주소의 칸 셋과 쪽을 읽고 같은 주소로 다시 짓는다', () => {
    const filters = filtersOf({ review: 'done', reason: 'harassment', evidence: 'chat', page: '3' });
    expect(filters).toEqual({ review: 'done', reason: 'harassment', evidence: 'chat', ref: null, page: 3 });
    expect(hrefOf(filters, { page: 3 })).toBe(
      '/ops/reports?review=done&reason=harassment&evidence=chat&page=3',
    );
  });

  it('모르는 값은 기본(처리 필요)으로 읽는다 — 오류로 세우지 않는다', () => {
    expect(filtersOf({ review: 'maybe', reason: 'spam', evidence: 'yes', page: 'x' })).toEqual(NO_FILTERS);
    expect(filtersOf({ page: '0' }).page).toBe(1);
    expect(filtersOf({ page: '-2' }).page).toBe(1);
    expect(filtersOf({ page: '1.5' }).page).toBe(1);
    expect(filtersOf({ page: '10001' }).page).toBe(1);
  });

  it('같은 이름이 둘이면 앞의 것을 읽는다', () => {
    expect(filtersOf({ review: ['done', 'open'] }).review).toBe('done');
  });

  it('거르는 칸을 바꾸면 첫 쪽으로 돌아간다', () => {
    const third = filtersOf({ page: '3' });
    expect(hrefOf(third, { reason: 'other' })).toBe('/ops/reports?reason=other');
    expect(hrefOf(third, { page: 4 })).toBe('/ops/reports?page=4');
  });

  it('목록 문의 인자는 전체면 null, 쪽은 0 부터, 처리 필요는 급한 순이다', () => {
    expect(argsOf(NO_FILTERS)).toEqual({
      p_reviewed: false,
      p_reason: null,
      p_has_snapshot: null,
      p_page: 0,
      p_warning_ref: null,
      p_order: 'urgent',
    });
    expect(argsOf({ review: 'done', reason: 'other', evidence: 'none', ref: 'W-7K3F', page: 2 })).toEqual({
      p_reviewed: true,
      p_reason: 'other',
      p_has_snapshot: false,
      p_page: 1,
      p_warning_ref: 'W-7K3F',
      p_order: 'recent',
    });
    expect(argsOf({ ...NO_FILTERS, review: 'all', evidence: 'chat' })).toMatchObject({
      p_reviewed: null,
      p_has_snapshot: true,
      p_order: 'recent',
    });
  });

  it('안내번호는 친 모양을 표의 모양으로 고쳐 읽고 주소에 다시 싣는다 — 안 맞는 것은 친 글자 그대로 찾는다', () => {
    expect(filtersOf({ ref: ' w7k3f ' }).ref).toBe('W-7K3F');
    expect(hrefOf(filtersOf({ ref: 'w-7k3f', page: '2' }), {})).toBe('/ops/reports?ref=W-7K3F');
    expect(filtersOf({ ref: 'w-0oil' }).ref).toBe('W-0OIL');
    expect(filtersOf({ ref: 'x'.repeat(40) }).ref).toHaveLength(16);
    expect(filtersOf({ ref: '   ' }).ref).toBeNull();
    expect(isFiltered(filtersOf({ ref: 'W-7K3F' }))).toBe(true);
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

  it('검토 결과는 운영자가 정한 네 이름이고, 모르는 값은 그대로 선다', () => {
    expect(['no_action', 'warning', 'suspension', 'needs_more'].map(reviewOutcomeLabel)).toEqual([
      '조치 없음',
      '경고',
      '이용 정지 결정',
      '추가 확인 필요',
    ]);
    expect(reviewOutcomeLabel('later')).toBe('later');
  });

  it('처리 상태는 문이 낸 처리 필요 여부 그대로다 — 결정은 계정의 지금 상태와 다른 글자다', () => {
    expect(reviewStateLabel(true)).toBe('처리 필요');
    expect(reviewStateLabel(false)).toBe('처리 완료');
    expect(reviewOutcomeLabel('suspension')).not.toBe(accountStatusLabel('suspended'));
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

describe('접힌 거르기 판의 머리', () => {
  it('처리 상태까지 전체면 「전체」, 기본은 「처리 필요」다', () => {
    expect(filterSummary({ ...NO_FILTERS, review: 'all' })).toBe('전체');
    expect(filterSummary(NO_FILTERS)).toBe('처리 필요');
  });

  it('거른 것을 판 안의 글자 그대로 잇는다', () => {
    expect(
      filterSummary(filtersOf({ review: 'open', reason: 'harassment', evidence: 'chat', ref: 'w-7k3f' })),
    ).toBe(`안내번호 W-7K3F · 처리 필요 · ${reasonLabel('harassment')} · 대화 근거 있음`);
  });
});

describe('같은 계정의 처리 필요 건수 — 지금 쪽 안에서', () => {
  const row = (userId: string, isOpen: boolean) => ({ isOpen, reported: { userId } });

  it('신고받은 계정마다 처리 필요만 센다', () => {
    const counts = openByReported([row('a', true), row('b', true), row('a', true), row('a', false)]);
    expect(counts.get('a')).toBe(2);
    expect(counts.get('b')).toBe(1);
  });

  it('처리 완료뿐인 계정은 세지 않는다', () => {
    expect(openByReported([row('c', false)]).has('c')).toBe(false);
  });
});
