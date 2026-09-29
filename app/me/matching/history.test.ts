import { describe, expect, it } from 'vitest';

import type { ReadingEntry } from '../reading/current';
import type { InboxMatch, InboxRequest } from '../requests/inbox';
import { historySummary, makingMatches, matchBooks, pastRequests } from './history';

/**
 * 인연 기록 — **줄이 말한 수와 화면에 선 수가 같다**(2026-09-29 u2).
 *
 * 인연 탭의 「인연 기록 N」 한 줄과 기록 화면은 같은 셈을 부른다. 직접 본 궁합이나 한 사람 풀이가 섞이면 궁합 탭 · 보관함과
 * 같은 글이 여기 또 서고, 답할 요청이 섞이면 탭 맨 위 띠와 같은 요청을 두 번 센다.
 */
const entry = (over: Partial<ReadingEntry>): ReadingEntry => ({
  kind: 'match',
  personA: null,
  personB: null,
  matchId: null,
  labelA: null,
  labelB: null,
  score: null,
  metaphor: null,
  createdAt: '2026-09-03T00:00:00Z',
  fromCurrentChart: true,
  dayMasterA: null,
  dayMasterB: null,
  ...over,
});

const match = (id: string, partner: string | null = id) => entry({ kind: 'match', matchId: id, labelA: partner });

const made = (matchId: string, nickname: string): InboxMatch => ({
  matchId,
  partnerUserId: `u-${matchId}`,
  nickname,
  intro: null,
  hasPhoto: false,
  suppliedToMe: null,
  balanceLabel: '',
  createdAt: '2026-09-03T00:00:00Z',
});

const request = (over: Partial<InboxRequest>): InboxRequest => ({
  requestId: 'r',
  direction: 'sent',
  counterpartUserId: 'u',
  nickname: '누군가',
  intro: null,
  hasPhoto: false,
  status: 'pending',
  suppliedToMe: null,
  suppliedToThem: null,
  balanceLabel: '',
  createdAt: '2026-09-03T00:00:00Z',
  decidedAt: null,
  ...over,
});

describe('인연 기록', () => {
  it('인연 궁합만 받은 차례 그대로 세우고, 결과 화면이 기록으로 돌아오게 `from=history` 를 단다', () => {
    const books = matchBooks([
      entry({ kind: 'self' }),
      match('m1'),
      entry({ kind: 'private', personA: 'a', personB: 'b' }),
      match('m2'),
    ]);
    expect(books.map((book) => book.href)).toEqual(['/me/match/m1?from=history', '/me/match/m2?from=history']);
  });

  it('지난 요청은 보낸 요청과 끝난 요청이다 — 답할 요청은 탭 맨 위 띠가 든다', () => {
    const past = pastRequests({
      requests: [
        request({ requestId: 'sent', direction: 'sent', status: 'pending' }),
        request({ requestId: 'inbox', direction: 'received', status: 'pending' }),
        request({ requestId: 'done', direction: 'received', status: 'rejected' }),
      ],
      blocked: 2,
    });
    expect(past.sent.map((one) => one.requestId)).toEqual(['sent']);
    expect(past.decided.map((one) => one.requestId)).toEqual(['done']);
    expect(past.blocked).toBe(2);
  });

  it('글이 아직 없는 인연 궁합만 「만드는 중」으로 가른다 — 책장과 같은 셈이다', () => {
    const making = makingMatches([match('m1'), entry({ kind: 'self' })], [made('m1', '다온'), made('m2', '유진')]);
    expect(making.map((one) => one.matchId)).toEqual(['m2']);
  });

  it('요약 한 줄은 두 수와 가장 최근 인연의 상대를 말한다 — 인연 궁합은 성립한 Match 의 수다', () => {
    const summary = historySummary(
      { ok: true, value: [made('m2', '다온'), made('m1', '유진')] },
      { ok: true, value: { requests: [request({ status: 'expired' })], blocked: 0 } },
    );
    expect(summary).toEqual({ count: 3, hint: '인연 궁합 2 · 지난 요청 1 — 최근 다온' });
  });

  it('수가 0 이면 줄이 안 선다 — 받은 요청만 있는 날도 그렇다', () => {
    const summary = historySummary(
      { ok: true, value: [] },
      { ok: true, value: { requests: [request({ direction: 'received' })], blocked: 1 } },
    );
    expect(summary).toBeNull();
  });

  it('한쪽을 못 읽으면 읽은 쪽만 센다', () => {
    const summary = historySummary(
      { ok: false, reason: '잠시 뒤' },
      { ok: true, value: { requests: [request({ status: 'accepted' })], blocked: 0 } },
    );
    expect(summary).toEqual({ count: 1, hint: '지난 요청 1' });
  });
});
